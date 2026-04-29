'use strict';

/**
 * Admin1 Routes — /api/v1/platform  (UniNMS Operator)
 *
 * Requires the 'super_admin' role. Operates across ALL universities.
 *
 * Sections:
 *  1. University management   GET/PATCH  /platform/universities
 *  2. Subscription management PATCH      /platform/universities/:id/subscription
 *  3. Global analytics        GET        /platform/analytics
 *  4. Global audit log        GET        /platform/audit-log
 *  5. Platform announcements  GET/POST/DELETE /platform/announcements
 *  6. Global plagiarism batch POST       /platform/plagiarism/batch-check
 *  7. Platform settings       GET/PATCH  /platform/settings
 */

const express      = require('express');
const { pool }     = require('../config/database');
const { AppError } = require('../utils/AppError');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAdminAction } = require('../utils/auditLog');
const { checkDocumentAsync } = require('../services/plagiarism');

const router = express.Router();

// All platform routes require authentication + super_admin role
router.use(authenticate, requireRole('super_admin'));

// ══════════════════════════════════════════════════════════════════════════════
// 1. UNIVERSITY MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

// GET /platform/universities?q=&status=&plan=&page=1&limit=20
router.get('/universities', async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  ?? '1'));
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit ?? '20')));
    const offset = (page - 1) * limit;

    const conditions = ['u.deleted_at IS NULL'];
    const values     = [];
    let   idx        = 1;

    if (req.query.q) {
      conditions.push(`(u.name ILIKE $${idx} OR u.short_name ILIKE $${idx})`);
      values.push(`%${req.query.q.trim()}%`);
      idx++;
    }
    if (req.query.status) {
      conditions.push(`s.status = $${idx++}`);
      values.push(req.query.status);
    }
    if (req.query.plan) {
      conditions.push(`s.plan = $${idx++}`);
      values.push(req.query.plan);
    }

    const where = 'WHERE ' + conditions.join(' AND ');

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM universities u
       LEFT JOIN institution_subscriptions s ON s.university_id = u.id
       ${where}`, values
    );

    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.short_name, u.state, u.type, u.created_at,
              s.plan, s.status AS subscription_status, s.max_users, s.max_storage_gb,
              s.features, s.plagiarism_threshold,
              (SELECT COUNT(*) FROM users WHERE university_id = u.id AND deleted_at IS NULL) AS user_count,
              (SELECT COUNT(*) FROM documents d
               JOIN users usr ON usr.id = d.uploader_id
               WHERE usr.university_id = u.id AND d.deleted_at IS NULL) AS document_count
       FROM universities u
       LEFT JOIN institution_subscriptions s ON s.university_id = u.id
       ${where}
       ORDER BY u.name
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      data: {
        universities: rows,
        total:        parseInt(countRows[0].count),
        page, limit,
        totalPages:   Math.ceil(parseInt(countRows[0].count) / limit),
      },
    });
  } catch (err) { next(err); }
});

// GET /platform/universities/:id — single university detail
router.get('/universities/:id', async (req, res, next) => {
  try {
    const { rows: [uni] } = await pool.query(
      `SELECT u.id, u.name, u.short_name, u.state, u.type, u.created_at,
              s.plan, s.status AS subscription_status, s.max_users, s.max_storage_gb,
              s.features, s.plagiarism_threshold, s.expires_at,
              array_agg(DISTINCT d.domain) FILTER (WHERE d.domain IS NOT NULL) AS domains,
              (SELECT COUNT(*) FROM users WHERE university_id = u.id AND deleted_at IS NULL) AS user_count,
              (SELECT COUNT(*) FROM documents doc
               JOIN users usr ON usr.id = doc.uploader_id
               WHERE usr.university_id = u.id AND doc.deleted_at IS NULL) AS document_count
       FROM universities u
       LEFT JOIN institution_subscriptions s ON s.university_id = u.id
       LEFT JOIN university_domains d ON d.university_id = u.id
       WHERE u.id = $1 AND u.deleted_at IS NULL
       GROUP BY u.id, s.plan, s.status, s.max_users, s.max_storage_gb,
                s.features, s.plagiarism_threshold, s.expires_at`,
      [req.params.id]
    );
    if (!uni) throw new AppError('University not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: uni });
  } catch (err) { next(err); }
});

// PATCH /platform/universities/:id/status — activate | suspend
router.patch('/universities/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['active', 'suspended', 'trial', 'expired'];
    if (!allowed.includes(status)) {
      throw new AppError(`status must be one of: ${allowed.join(', ')}`, 422, 'VALIDATION_ERROR');
    }

    const { rows: [uni] } = await pool.query(
      'SELECT id, name FROM universities WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (!uni) throw new AppError('University not found', 404, 'NOT_FOUND');

    await pool.query(
      `UPDATE institution_subscriptions SET status = $1 WHERE university_id = $2`,
      [status, req.params.id]
    );

    await logAdminAction(req.user.id, `university.status.${status}`, 'universities', req.params.id,
      { university_name: uni.name }, req);

    res.json({ success: true, message: `University subscription status updated to "${status}"` });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. SUBSCRIPTION MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

// PATCH /platform/universities/:id/subscription
// { plan, maxUsers, maxStorageGb, features, expiresAt, plagiarismThreshold }
router.patch('/universities/:id/subscription', async (req, res, next) => {
  try {
    const { plan, maxUsers, maxStorageGb, features, expiresAt, plagiarismThreshold } = req.body;

    const { rows: [uni] } = await pool.query(
      'SELECT id, name FROM universities WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (!uni) throw new AppError('University not found', 404, 'NOT_FOUND');

    const updates = [];
    const values  = [];
    let   idx     = 1;

    const validPlans = ['free', 'basic', 'standard', 'premium', 'enterprise'];
    if (plan !== undefined) {
      if (!validPlans.includes(plan)) {
        throw new AppError(`plan must be one of: ${validPlans.join(', ')}`, 422, 'VALIDATION_ERROR');
      }
      updates.push(`plan = $${idx++}`); values.push(plan);
    }
    if (maxUsers      !== undefined) { updates.push(`max_users = $${idx++}`);           values.push(parseInt(maxUsers)); }
    if (maxStorageGb  !== undefined) { updates.push(`max_storage_gb = $${idx++}`);      values.push(parseInt(maxStorageGb)); }
    if (features      !== undefined) { updates.push(`features = $${idx++}`);            values.push(JSON.stringify(features)); }
    if (expiresAt     !== undefined) { updates.push(`expires_at = $${idx++}`);          values.push(expiresAt); }
    if (plagiarismThreshold !== undefined) {
      const t = parseFloat(plagiarismThreshold);
      if (isNaN(t) || t < 0 || t > 1) throw new AppError('plagiarismThreshold must be 0–1', 422, 'VALIDATION_ERROR');
      updates.push(`plagiarism_threshold = $${idx++}`); values.push(t);
    }

    if (!updates.length) throw new AppError('Nothing to update', 400, 'NO_CHANGES');

    values.push(req.params.id);
    await pool.query(
      `UPDATE institution_subscriptions SET ${updates.join(', ')} WHERE university_id = $${idx}`,
      values
    );

    await logAdminAction(req.user.id, 'university.subscription.update', 'institution_subscriptions',
      req.params.id, { university_name: uni.name, ...req.body }, req);

    res.json({ success: true, message: 'Subscription updated' });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. GLOBAL ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════

// GET /platform/analytics — platform-wide stats across all universities
router.get('/analytics', async (req, res, next) => {
  try {
    const [uniR, userR, docR, activityR, flaggedR] = await Promise.all([
      // University breakdown by plan
      pool.query(
        `SELECT s.plan, s.status, COUNT(*) AS count
         FROM institution_subscriptions s
         JOIN universities u ON u.id = s.university_id
         WHERE u.deleted_at IS NULL
         GROUP BY s.plan, s.status
         ORDER BY count DESC`
      ),
      // Users by role across all institutions
      pool.query(
        `SELECT r.name AS role, COUNT(DISTINCT u.id) AS count
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE u.deleted_at IS NULL
         GROUP BY r.name
         ORDER BY count DESC`
      ),
      // Documents by type platform-wide
      pool.query(
        `SELECT d.doc_type,
                COUNT(*) AS count,
                COALESCE(SUM(d.view_count),0)     AS total_views,
                COALESCE(SUM(d.download_count),0) AS total_downloads,
                COALESCE(SUM(d.citation_count),0) AS total_citations
         FROM documents d
         WHERE d.deleted_at IS NULL
         GROUP BY d.doc_type`
      ),
      // Top 10 most active universities by document count
      pool.query(
        `SELECT u.id, u.name, u.short_name, s.plan,
                COUNT(DISTINCT usr.id) AS users,
                COUNT(DISTINCT d.id)  AS documents
         FROM universities u
         LEFT JOIN institution_subscriptions s ON s.university_id = u.id
         LEFT JOIN users usr ON usr.university_id = u.id AND usr.deleted_at IS NULL
         LEFT JOIN documents d ON d.uploader_id = usr.id AND d.deleted_at IS NULL
         WHERE u.deleted_at IS NULL
         GROUP BY u.id, u.name, u.short_name, s.plan
         ORDER BY documents DESC
         LIMIT 10`
      ),
      // Plagiarism flag summary
      pool.query(
        `SELECT plagiarism_status, COUNT(*) AS count
         FROM documents
         WHERE deleted_at IS NULL
         GROUP BY plagiarism_status`
      ),
    ]);

    res.json({
      success: true,
      data: {
        universities: uniR.rows,
        users:        userR.rows,
        documents:    docR.rows,
        topUniversities: activityR.rows,
        plagiarism:   flaggedR.rows,
      },
    });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. GLOBAL AUDIT LOG
// ══════════════════════════════════════════════════════════════════════════════

// GET /platform/audit-log?page=1&limit=50&action=&actorId=&universityId=
router.get('/audit-log', async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  ?? '1'));
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit ?? '50')));
    const offset = (page - 1) * limit;

    const conditions = [];
    const values     = [];
    let   idx        = 1;

    if (req.query.actorId) {
      conditions.push(`al.actor_id = $${idx++}`);
      values.push(req.query.actorId);
    }
    if (req.query.action) {
      conditions.push(`al.action ILIKE $${idx++}`);
      values.push(`%${req.query.action}%`);
    }
    if (req.query.targetType) {
      conditions.push(`al.target_type = $${idx++}`);
      values.push(req.query.targetType);
    }
    if (req.query.universityId) {
      conditions.push(`u.university_id = $${idx++}`);
      values.push(req.query.universityId);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM audit_log al
       LEFT JOIN users u ON u.id = al.actor_id
       ${where}`, values
    );

    const { rows } = await pool.query(
      `SELECT al.id, al.action, al.target_type, al.target_id,
              al.details, al.ip_address, al.created_at,
              u.full_name AS actor_name, u.email AS actor_email,
              uni.name AS actor_university
       FROM audit_log al
       LEFT JOIN users u ON u.id = al.actor_id
       LEFT JOIN universities uni ON uni.id = u.university_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      data: {
        entries:    rows,
        total:      parseInt(countRows[0].count),
        page, limit,
        totalPages: Math.ceil(parseInt(countRows[0].count) / limit),
      },
    });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. PLATFORM ANNOUNCEMENTS (broadcast to all or specific universities)
// ══════════════════════════════════════════════════════════════════════════════

// GET /platform/announcements
router.get('/announcements', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.title, a.body, a.is_active, a.expires_at, a.created_at,
              u.full_name AS author_name,
              uni.name AS university_name
       FROM announcements a
       LEFT JOIN users u ON u.id = a.author_id
       LEFT JOIN universities uni ON uni.id = a.university_id
       WHERE a.deleted_at IS NULL
       ORDER BY a.created_at DESC
       LIMIT 100`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /platform/announcements — { title, body, universityId?, expiresAt? }
// universityId = null → broadcast to all institutions
router.post('/announcements', async (req, res, next) => {
  try {
    const { title, body, universityId, expiresAt } = req.body;
    if (!title?.trim() || !body?.trim()) {
      throw new AppError('title and body are required', 422, 'VALIDATION_ERROR');
    }

    // If targeting a specific university, verify it exists
    if (universityId) {
      const { rows: [uni] } = await pool.query(
        'SELECT id FROM universities WHERE id = $1 AND deleted_at IS NULL', [universityId]
      );
      if (!uni) throw new AppError('University not found', 404, 'NOT_FOUND');
    }

    const { rows: [ann] } = await pool.query(
      `INSERT INTO announcements (university_id, author_id, title, body, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, created_at`,
      [universityId ?? null, req.user.id, title.trim(), body.trim(), expiresAt ?? null]
    );

    await logAdminAction(req.user.id, 'platform.announcement.create', 'announcements', ann.id,
      { title: ann.title, scope: universityId ?? 'all' }, req);

    res.status(201).json({ success: true, data: ann });
  } catch (err) { next(err); }
});

// DELETE /platform/announcements/:id
router.delete('/announcements/:id', async (req, res, next) => {
  try {
    const { rows: [ann] } = await pool.query(
      `UPDATE announcements SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, title`,
      [req.params.id]
    );
    if (!ann) throw new AppError('Announcement not found', 404, 'NOT_FOUND');

    await logAdminAction(req.user.id, 'platform.announcement.delete', 'announcements', ann.id,
      { title: ann.title }, req);

    res.json({ success: true, message: 'Announcement removed' });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. GLOBAL PLAGIARISM BATCH CHECK
// ══════════════════════════════════════════════════════════════════════════════

// POST /platform/plagiarism/batch-check?universityId= (optional filter)
router.post('/plagiarism/batch-check', async (req, res, next) => {
  try {
    const universityId = req.query.universityId ?? null;

    const conditions = [`d.deleted_at IS NULL`, `d.plagiarism_status IN ('pending','error','unchecked')`];
    const values = [];
    if (universityId) {
      conditions.push(`u.university_id = $1`);
      values.push(universityId);
    }

    const { rows } = await pool.query(
      `SELECT d.id FROM documents d
       LEFT JOIN users u ON u.id = d.uploader_id
       WHERE ${conditions.join(' AND ')}
       LIMIT 500`,
      values
    );

    rows.forEach(r => checkDocumentAsync(r.id));

    await logAdminAction(req.user.id, 'platform.plagiarism.batch_check', null, null,
      { count: rows.length, university_id: universityId ?? 'all' }, req);

    res.json({
      success: true,
      message: `Batch plagiarism check started for ${rows.length} document(s) across ${universityId ? '1 university' : 'all universities'}`,
      data: { queued: rows.length },
    });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 7. PLATFORM SETTINGS
// ══════════════════════════════════════════════════════════════════════════════

// GET /platform/settings — summary of all active subscriptions
router.get('/settings', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.plan, s.status, COUNT(*) AS university_count,
              SUM(s.max_users) AS total_user_capacity,
              SUM(s.max_storage_gb) AS total_storage_gb
       FROM institution_subscriptions s
       JOIN universities u ON u.id = s.university_id
       WHERE u.deleted_at IS NULL
       GROUP BY s.plan, s.status
       ORDER BY s.plan`
    );

    const { rows: [totals] } = await pool.query(
      `SELECT COUNT(DISTINCT u.id) AS total_universities,
              COUNT(DISTINCT usr.id) AS total_users,
              COUNT(DISTINCT d.id) AS total_documents
       FROM universities u
       LEFT JOIN users usr ON usr.university_id = u.id AND usr.deleted_at IS NULL
       LEFT JOIN documents d ON d.uploader_id = usr.id AND d.deleted_at IS NULL
       WHERE u.deleted_at IS NULL`
    );

    res.json({ success: true, data: { subscriptionBreakdown: rows, totals } });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 8. PLATFORM USER MANAGEMENT
// Manages IT admins, management, community_rep, industry_partner, super_admin.
// Students, lecturers, and researchers are managed by each university's IT admin.
// ══════════════════════════════════════════════════════════════════════════════

const bcrypt = require('bcryptjs');

// Platform-level roles (not managed by university IT admins)
const PLATFORM_ROLES = ['admin', 'management', 'community_rep', 'industry_partner', 'super_admin'];
// University-scoped roles (managed by IT admins per institution)
const UNIVERSITY_ROLES = ['student', 'lecturer'];

// GET /platform/users?q=&role=&universityId=&status=&page=1&limit=20
router.get('/users', async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  ?? '1'));
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit ?? '20')));
    const offset = (page - 1) * limit;

    const conditions = ['u.deleted_at IS NULL'];
    const values     = [];
    let   idx        = 1;

    // Exclude university-scoped roles (student, lecturer, researcher)
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM user_roles ur2
      JOIN roles r2 ON r2.id = ur2.role_id
      WHERE ur2.user_id = u.id AND r2.name = ANY($${idx++})
    )`);
    values.push(UNIVERSITY_ROLES);

    if (req.query.q) {
      conditions.push(`(u.full_name ILIKE $${idx} OR u.email ILIKE $${idx})`);
      values.push(`%${req.query.q.trim()}%`);
      idx++;
    }
    if (req.query.role) {
      conditions.push(`EXISTS (
        SELECT 1 FROM user_roles ur3
        JOIN roles r3 ON r3.id = ur3.role_id
        WHERE ur3.user_id = u.id AND r3.name = $${idx++}
      )`);
      values.push(req.query.role);
    }
    if (req.query.universityId) {
      conditions.push(`u.university_id = $${idx++}`);
      values.push(req.query.universityId);
    }
    if (req.query.status) {
      conditions.push(`u.status = $${idx++}`);
      values.push(req.query.status);
    }

    const where = 'WHERE ' + conditions.join(' AND ');

    const [countRes, usersRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM users u ${where}`, values),
      pool.query(
        `SELECT u.id, u.full_name, u.email, u.status, u.created_at,
                u.university_id,
                uni.name AS university_name, uni.short_name AS university_short,
                uc.last_login,
                array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) AS roles
         FROM users u
         LEFT JOIN universities uni ON uni.id = u.university_id
         LEFT JOIN user_credentials uc ON uc.user_id = u.id
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         ${where}
         GROUP BY u.id, uni.name, uni.short_name, uc.last_login
         ORDER BY u.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...values, limit, offset]
      ),
    ]);

    res.json({
      success: true,
      data: {
        users:      usersRes.rows,
        total:      parseInt(countRes.rows[0].count),
        page, limit,
        totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
      },
    });
  } catch (err) { next(err); }
});

// POST /platform/users — create IT admin or other platform user
// { fullName, email, password, role, universityId? }
router.post('/users', async (req, res, next) => {
  try {
    const { fullName, email, password, role, universityId } = req.body;

    if (!fullName?.trim())   throw new AppError('fullName is required', 422, 'VALIDATION_ERROR');
    if (!email?.trim())      throw new AppError('email is required', 422, 'VALIDATION_ERROR');
    if (!password || password.length < 6) throw new AppError('password must be at least 6 characters', 422, 'VALIDATION_ERROR');
    if (!PLATFORM_ROLES.includes(role))   throw new AppError(`role must be one of: ${PLATFORM_ROLES.join(', ')}`, 422, 'VALIDATION_ERROR');

    // IT admins and management must be linked to a university
    if (['admin', 'management'].includes(role) && !universityId) {
      throw new AppError('universityId is required for admin and management roles', 422, 'VALIDATION_ERROR');
    }

    // Validate university exists
    let uni = null;
    if (universityId) {
      const { rows: [u] } = await pool.query(
        'SELECT id, name FROM universities WHERE id = $1 AND deleted_at IS NULL', [universityId]
      );
      if (!u) throw new AppError('University not found', 404, 'NOT_FOUND');
      uni = u;
    }

    // Check email uniqueness
    const { rows: [existing] } = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [email.toLowerCase().trim()]
    );
    if (existing) throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');

    // Get role id
    const { rows: [roleRow] } = await pool.query(
      'SELECT id FROM roles WHERE name = $1', [role]
    );
    if (!roleRow) throw new AppError(`Role "${role}" not found in database`, 500, 'INTERNAL_ERROR');

    const hash = await bcrypt.hash(password, 12);

    const { rows: [user] } = await pool.query(
      `INSERT INTO users (full_name, email, university_id, status, subscription_verified)
       VALUES ($1, $2, $3, 'active', TRUE)
       RETURNING id, full_name, email`,
      [fullName.trim(), email.toLowerCase().trim(), universityId ?? null]
    );

    await pool.query(
      `INSERT INTO user_credentials (user_id, password_hash) VALUES ($1, $2)`,
      [user.id, hash]
    );

    await pool.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
      [user.id, roleRow.id]
    );

    await logAdminAction(req.user.id, 'platform.user.create', 'users', user.id,
      { email: user.email, role, university: uni?.name ?? null }, req);

    res.status(201).json({ success: true, data: { id: user.id, fullName: user.full_name, email: user.email, role } });
  } catch (err) { next(err); }
});

// PATCH /platform/users/:id/status — active | suspended
router.patch('/users/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status))
      throw new AppError('status must be active or suspended', 422, 'VALIDATION_ERROR');

    const { rows: [user] } = await pool.query(
      `UPDATE users SET status = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING id, full_name, email`,
      [status, req.params.id]
    );
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

    await logAdminAction(req.user.id, `platform.user.${status}`, 'users', user.id,
      { email: user.email }, req);

    res.json({ success: true, message: `User ${status}` });
  } catch (err) { next(err); }
});

// PATCH /platform/users/:id/role — assign or revoke a platform role
router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const { role, action } = req.body; // action: 'assign' | 'revoke'
    if (!PLATFORM_ROLES.includes(role))
      throw new AppError(`role must be one of: ${PLATFORM_ROLES.join(', ')}`, 422, 'VALIDATION_ERROR');
    if (!['assign', 'revoke'].includes(action))
      throw new AppError('action must be assign or revoke', 422, 'VALIDATION_ERROR');

    const { rows: [user] } = await pool.query(
      'SELECT id, full_name, email FROM users WHERE id = $1 AND deleted_at IS NULL', [req.params.id]
    );
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

    const { rows: [roleRow] } = await pool.query('SELECT id FROM roles WHERE name = $1', [role]);
    if (!roleRow) throw new AppError(`Role "${role}" not found`, 404, 'NOT_FOUND');

    if (action === 'assign') {
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [req.params.id, roleRow.id]
      );
    } else {
      await pool.query(
        `DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2`,
        [req.params.id, roleRow.id]
      );
    }

    await logAdminAction(req.user.id, `platform.user.role.${action}`, 'users', user.id,
      { email: user.email, role }, req);

    res.json({ success: true, message: `Role ${action}ed` });
  } catch (err) { next(err); }
});

// PATCH /platform/users/:id/university — reassign user to a different university
router.patch('/users/:id/university', async (req, res, next) => {
  try {
    const { universityId } = req.body;
    const { rows: [uni] } = await pool.query(
      'SELECT id, name FROM universities WHERE id = $1 AND deleted_at IS NULL', [universityId]
    );
    if (!uni) throw new AppError('University not found', 404, 'NOT_FOUND');

    const { rows: [user] } = await pool.query(
      `UPDATE users SET university_id = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING id, email`,
      [universityId, req.params.id]
    );
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

    await logAdminAction(req.user.id, 'platform.user.reassign_university', 'users', user.id,
      { email: user.email, university: uni.name }, req);

    res.json({ success: true, message: `User reassigned to ${uni.name}` });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 9. SUBSCRIPTION PLAN DEFINITIONS (editable by super admin)
// ══════════════════════════════════════════════════════════════════════════════

const VALID_FEATURES = [
  'plagiarism', 'semantic_search', 'ai_insights', 'research_pipeline',
  'knowledge_transfer', 'vc_dashboard', 'tetfund_reports', 'national_hub',
  'api_access', 'sso', 'custom_branding', 'priority_support',
];

// GET /platform/plans — all plan definitions
router.get('/plans', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT key, label, tagline, price_naira, max_users, max_storage_gb,
              plagiarism_checks_per_month, features, badge, highlight, sort_order, is_active, updated_at
       FROM subscription_plans
       ORDER BY sort_order`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// PATCH /platform/plans/:key — update a plan definition
router.patch('/plans/:key', async (req, res, next) => {
  try {
    const { key } = req.params;
    const { rows: [existing] } = await pool.query(
      'SELECT key FROM subscription_plans WHERE key = $1', [key]
    );
    if (!existing) throw new AppError('Plan not found', 404, 'NOT_FOUND');

    const {
      label, tagline, priceNaira, maxUsers, maxStorageGb,
      plagiarismChecksPerMonth, features, highlight,
    } = req.body;

    const updates = ['updated_at = NOW()'];
    const values  = [];
    let   idx     = 1;

    if (label     !== undefined) { updates.push(`label = $${idx++}`);    values.push(label.trim()); }
    if (tagline   !== undefined) { updates.push(`tagline = $${idx++}`);  values.push(tagline.trim()); }
    if (priceNaira !== undefined) {
      const p = parseInt(priceNaira);
      if (isNaN(p) || p < -1) throw new AppError('priceNaira must be >= -1', 422, 'VALIDATION_ERROR');
      updates.push(`price_naira = $${idx++}`); values.push(p);
    }
    if (maxUsers !== undefined) {
      const v = parseInt(maxUsers);
      if (isNaN(v) || (v < 1 && v !== -1)) throw new AppError('maxUsers must be >= 1 or -1 for unlimited', 422, 'VALIDATION_ERROR');
      updates.push(`max_users = $${idx++}`); values.push(v);
    }
    if (maxStorageGb !== undefined) {
      const v = parseInt(maxStorageGb);
      if (isNaN(v) || (v < 1 && v !== -1)) throw new AppError('maxStorageGb must be >= 1 or -1 for unlimited', 422, 'VALIDATION_ERROR');
      updates.push(`max_storage_gb = $${idx++}`); values.push(v);
    }
    if (plagiarismChecksPerMonth !== undefined) {
      const v = parseInt(plagiarismChecksPerMonth);
      if (isNaN(v) || v < -1) throw new AppError('plagiarismChecksPerMonth must be >= 0 or -1 for unlimited', 422, 'VALIDATION_ERROR');
      updates.push(`plagiarism_checks_per_month = $${idx++}`); values.push(v);
    }
    if (features !== undefined) {
      if (typeof features !== 'object' || Array.isArray(features))
        throw new AppError('features must be an object', 422, 'VALIDATION_ERROR');
      const unknown = Object.keys(features).filter(k => !VALID_FEATURES.includes(k));
      if (unknown.length) throw new AppError(`Unknown features: ${unknown.join(', ')}`, 422, 'VALIDATION_ERROR');
      updates.push(`features = $${idx++}`); values.push(JSON.stringify(features));
    }
    if (highlight !== undefined) { updates.push(`highlight = $${idx++}`); values.push(Boolean(highlight)); }

    values.push(key);
    const { rows: [updated] } = await pool.query(
      `UPDATE subscription_plans SET ${updates.join(', ')}
       WHERE key = $${idx}
       RETURNING key, label, tagline, price_naira, max_users, max_storage_gb,
                 plagiarism_checks_per_month, features, badge, highlight, sort_order, updated_at`,
      values
    );

    await logAdminAction(req.user.id, 'platform.plan.update', 'subscription_plans', key,
      { plan: key, changes: req.body }, req);

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

module.exports = router;
