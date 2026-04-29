'use strict';

/**
 * Admin2 Routes — /api/v1/admin  (University IT Administrator)
 *
 * Requires the 'admin' role. All data is scoped to the admin's own
 * university — cross-institution operations are handled by Admin1
 * in /api/v1/platform (super_admin only).
 *
 * Sections:
 *  1. User management        GET/POST/PATCH /admin/users
 *  2. Document moderation    GET/POST  /admin/moderation
 *  3. Plagiarism batch check POST      /admin/plagiarism/batch-check
 *  4. Analytics + CSV export GET       /admin/analytics
 *  5. Announcements          GET/POST/DELETE /admin/announcements
 *  6. Audit log              GET       /admin/audit-log
 *  7. Institution settings   GET/PATCH /admin/settings
 */

const express        = require('express');
const bcrypt         = require('bcryptjs');
const { pool }       = require('../config/database');
const { AppError }   = require('../utils/AppError');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAdminAction } = require('../utils/auditLog');
const { checkDocumentAsync } = require('../services/plagiarism');

const router = express.Router();

// All admin routes require authentication + admin role.
// super_admin platform-wide operations are in /api/v1/platform.
router.use(authenticate, requireRole('admin', 'super_admin'));

// ── Scope helper ──────────────────────────────────────────────────────────────
// Always returns the admin's own university_id.
// super_admin using these routes must pass ?universityId= to target a university;
// cross-institution operations belong in /api/v1/platform.
function scopeUniversity(req) {
  if (req.user.roles?.includes('super_admin') && req.query.universityId) {
    return req.query.universityId;
  }
  if (!req.user.university_id && !req.query.universityId) {
    throw new AppError('No institution context — pass ?universityId= or log in as a university admin', 400, 'BAD_REQUEST');
  }
  return req.user.university_id ?? req.query.universityId;
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. USER MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

// GET /admin/users?page=1&limit=20&q=&role=&status=
router.get('/users', async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  ?? '1'));
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit ?? '20')));
    const offset = (page - 1) * limit;
    const uniId  = scopeUniversity(req);

    const conditions = ['u.deleted_at IS NULL'];
    const values     = [];
    let   idx        = 1;

    if (uniId) {
      conditions.push(`u.university_id = $${idx++}`);
      values.push(uniId);
    }
    if (req.query.q) {
      conditions.push(`(u.full_name ILIKE $${idx} OR u.email ILIKE $${idx})`);
      values.push(`%${req.query.q.trim()}%`);
      idx++;
    }
    if (req.query.status) {
      conditions.push(`u.status = $${idx++}`);
      values.push(req.query.status);
    }
    if (req.query.role) {
      conditions.push(`EXISTS (
        SELECT 1 FROM user_roles ur2
        JOIN roles r2 ON r2.id = ur2.role_id
        WHERE ur2.user_id = u.id AND r2.name = $${idx++}
      )`);
      values.push(req.query.role);
    }

    const where = 'WHERE ' + conditions.join(' AND ');

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM users u ${where}`, values
    );

    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.status, u.created_at,
              u.matric_number, u.staff_id, u.university_id,
              dep.name  AS department_name,
              uni.name  AS university_name,
              uc.email_verified, uc.last_login, uc.login_count,
              array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) AS roles
       FROM users u
       LEFT JOIN departments dep ON dep.id = u.department_id
       LEFT JOIN universities uni ON uni.id = u.university_id
       LEFT JOIN user_credentials uc ON uc.user_id = u.id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       ${where}
       GROUP BY u.id, dep.name, uni.name, uc.email_verified, uc.last_login, uc.login_count
       ORDER BY u.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      data: {
        users:      rows,
        total:      parseInt(countRows[0].count),
        page, limit,
        totalPages: Math.ceil(parseInt(countRows[0].count) / limit),
      },
    });
  } catch (err) { next(err); }
});

// ── Shared helper: create one user under this university ─────────────────────
async function createUser({ fullName, email, password, role, departmentId, matricNumber, staffId, uniId }) {
  // Duplicate email check
  const { rows: [existing] } = await pool.query(
    'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [email]
  );
  if (existing) throw new AppError(`Email already registered: ${email}`, 409, 'EMAIL_EXISTS');

  // Validate department belongs to this university
  if (departmentId) {
    const { rows: [dep] } = await pool.query(
      `SELECT d.id FROM departments d
       JOIN faculties f ON f.id = d.faculty_id
       WHERE d.id = $1 AND f.university_id = $2 AND d.deleted_at IS NULL`,
      [departmentId, uniId]
    );
    if (!dep) throw new AppError(`Department ${departmentId} does not belong to this university`, 422, 'VALIDATION_ERROR');
  }

  const hash = await bcrypt.hash(password, 12);

  const { rows: [user] } = await pool.query(
    `INSERT INTO users (full_name, email, university_id, department_id,
                        matric_number, staff_id, status, subscription_verified)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', TRUE)
     RETURNING id, full_name, email`,
    [fullName, email, uniId, departmentId ?? null, matricNumber ?? null, staffId ?? null]
  );

  await pool.query(
    `INSERT INTO user_credentials (user_id, password_hash, email_verified) VALUES ($1, $2, TRUE)`,
    [user.id, hash]
  );

  const { rows: [roleRow] } = await pool.query('SELECT id FROM roles WHERE name = $1', [role]);
  if (roleRow) {
    await pool.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [user.id, roleRow.id]
    );
  }

  await pool.query(
    'INSERT INTO reward_levels (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]
  );

  return user;
}

// POST /admin/users/register — register a single student or staff member
// { fullName, email, password, role, departmentId?, matricNumber?, staffId? }
router.post('/users/register', async (req, res, next) => {
  try {
    const uniId = scopeUniversity(req);
    const { fullName, email, password, role, departmentId, matricNumber, staffId } = req.body;

    if (!fullName?.trim() || !email?.trim() || !password || !role) {
      throw new AppError('fullName, email, password and role are required', 422, 'VALIDATION_ERROR');
    }

    const allowedRoles = ['student', 'lecturer', 'management'];
    if (!allowedRoles.includes(role)) {
      throw new AppError(`role must be one of: ${allowedRoles.join(', ')}`, 422, 'VALIDATION_ERROR');
    }

    const user = await createUser({ fullName: fullName.trim(), email: email.trim().toLowerCase(),
      password, role, departmentId, matricNumber, staffId, uniId });

    await logAdminAction(req.user.id, 'user.register', 'users', user.id,
      { email: user.email, role }, req);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { id: user.id, fullName: user.full_name, email: user.email, role },
    });
  } catch (err) { next(err); }
});

// POST /admin/users/bulk-register — register multiple users at once
// Body: { users: [{ fullName, email, password, role, departmentId?, matricNumber?, staffId? }] }
router.post('/users/bulk-register', async (req, res, next) => {
  try {
    const uniId = scopeUniversity(req);
    const { users } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      throw new AppError('users must be a non-empty array', 422, 'VALIDATION_ERROR');
    }
    if (users.length > 200) {
      throw new AppError('Maximum 200 users per bulk request', 422, 'VALIDATION_ERROR');
    }

    const allowedRoles = ['student', 'lecturer', 'management'];
    const created  = [];
    const failed   = [];

    for (const entry of users) {
      try {
        if (!entry.fullName?.trim() || !entry.email?.trim() || !entry.password || !entry.role) {
          failed.push({ email: entry.email ?? '?', reason: 'fullName, email, password and role are required' });
          continue;
        }
        if (!allowedRoles.includes(entry.role)) {
          failed.push({ email: entry.email, reason: `Invalid role: ${entry.role}` });
          continue;
        }

        const user = await createUser({
          fullName:     entry.fullName.trim(),
          email:        entry.email.trim().toLowerCase(),
          password:     entry.password,
          role:         entry.role,
          departmentId: entry.departmentId ?? null,
          matricNumber: entry.matricNumber ?? null,
          staffId:      entry.staffId ?? null,
          uniId,
        });

        created.push({ id: user.id, email: user.email, role: entry.role });
      } catch (err) {
        failed.push({ email: entry.email ?? '?', reason: err.message });
      }
    }

    await logAdminAction(req.user.id, 'user.bulk_register', null, null,
      { created: created.length, failed: failed.length }, req);

    res.status(201).json({
      success: true,
      message: `${created.length} user(s) registered, ${failed.length} failed`,
      data: { created, failed },
    });
  } catch (err) { next(err); }
});

// PATCH /admin/users/:id/role  — { role, action: 'assign' | 'revoke' }
router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const { id }     = req.params;
    const { role, action } = req.body;
    if (!role || !['assign', 'revoke'].includes(action)) {
      throw new AppError('role and action (assign|revoke) are required', 422, 'VALIDATION_ERROR');
    }

    // Guard: super_admin role can only be assigned by a super_admin
    if (role === 'super_admin' && !req.user.roles?.includes('super_admin')) {
      throw new AppError('Only super_admin can assign the super_admin role', 403, 'FORBIDDEN');
    }

    // Guard: cannot remove own super_admin role (REQ-SYS-009)
    if (role === 'super_admin' && action === 'revoke' && id === req.user.id) {
      throw new AppError('Cannot remove your own super_admin role', 403, 'FORBIDDEN');
    }

    const { rows: [target] } = await pool.query(
      'SELECT id, full_name, university_id FROM users WHERE id = $1 AND deleted_at IS NULL', [id]
    );
    if (!target) throw new AppError('User not found', 404, 'NOT_FOUND');

    // Scope check: admin cannot manage users outside their institution
    const uniId = scopeUniversity(req);
    if (uniId && target.university_id !== uniId) {
      throw new AppError('User is not in your institution', 403, 'FORBIDDEN');
    }

    // Ensure role exists
    const { rows: [roleRow] } = await pool.query(
      'SELECT id FROM roles WHERE name = $1', [role]
    );
    if (!roleRow) throw new AppError(`Role "${role}" does not exist`, 404, 'NOT_FOUND');

    if (action === 'assign') {
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [id, roleRow.id]
      );
    } else {
      await pool.query(
        'DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [id, roleRow.id]
      );
    }

    await logAdminAction(req.user.id, `user.role.${action}`, 'users', id,
      { role, target_name: target.full_name }, req);

    res.json({ success: true, message: `Role "${role}" ${action}ed for user` });
  } catch (err) { next(err); }
});

// PATCH /admin/users/:id/status  — { status: 'active' | 'suspended' | 'deactivated' }
router.patch('/users/:id/status', async (req, res, next) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;
    const allowed    = ['active', 'suspended', 'deactivated', 'pending_verification'];
    if (!allowed.includes(status)) {
      throw new AppError(`status must be one of: ${allowed.join(', ')}`, 422, 'VALIDATION_ERROR');
    }

    const { rows: [target] } = await pool.query(
      'SELECT id, full_name, status, university_id FROM users WHERE id = $1 AND deleted_at IS NULL', [id]
    );
    if (!target) throw new AppError('User not found', 404, 'NOT_FOUND');

    const uniId = scopeUniversity(req);
    if (uniId && target.university_id !== uniId) {
      throw new AppError('User is not in your institution', 403, 'FORBIDDEN');
    }

    await pool.query(
      'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, id]
    );

    await logAdminAction(req.user.id, `user.status.${status}`, 'users', id,
      { previous_status: target.status, target_name: target.full_name }, req);

    res.json({ success: true, message: `User status updated to "${status}"` });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. DOCUMENT MODERATION
// ══════════════════════════════════════════════════════════════════════════════

// GET /admin/moderation?status=pending&page=1&limit=20
router.get('/moderation', async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  ?? '1'));
    const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit ?? '20')));
    const offset = (page - 1) * limit;
    const status = req.query.status ?? 'pending'; // pending | approved | rejected | all
    const uniId  = scopeUniversity(req);

    const conditions = ['d.deleted_at IS NULL'];
    const values     = [];
    let   idx        = 1;

    if (status !== 'all') {
      conditions.push(`d.moderation_status = $${idx++}`);
      values.push(status);
    }
    if (uniId) {
      conditions.push(`u.university_id = $${idx++}`);
      values.push(uniId);
    }

    const where = 'WHERE ' + conditions.join(' AND ');

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploader_id
       ${where}`, values
    );

    const { rows } = await pool.query(
      `SELECT d.id, d.title, d.abstract, d.doc_type, d.visibility,
              d.moderation_status, d.moderation_note, d.moderated_at,
              d.is_published, d.plagiarism_score, d.plagiarism_status,
              d.file_size_bytes, d.mime_type, d.created_at,
              u.id AS uploader_id, u.full_name AS uploader_name, u.email AS uploader_email,
              dep.name AS department_name, uni.name AS university_name,
              mod.full_name AS moderated_by_name
       FROM documents d
       LEFT JOIN users u   ON u.id   = d.uploader_id
       LEFT JOIN users mod ON mod.id = d.moderated_by
       LEFT JOIN departments dep ON dep.id = u.department_id
       LEFT JOIN universities uni ON uni.id = u.university_id
       ${where}
       ORDER BY d.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      data: {
        documents:  rows,
        total:      parseInt(countRows[0].count),
        page, limit, status,
        totalPages: Math.ceil(parseInt(countRows[0].count) / limit),
      },
    });
  } catch (err) { next(err); }
});

// POST /admin/moderation/:documentId/approve
router.post('/moderation/:documentId/approve', async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const { rows: [doc] } = await pool.query(
      `SELECT d.id, d.title, d.moderation_status, u.university_id
       FROM documents d LEFT JOIN users u ON u.id = d.uploader_id
       WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [documentId]
    );
    if (!doc) throw new AppError('Document not found', 404, 'NOT_FOUND');

    const uniId = scopeUniversity(req);
    if (uniId && doc.university_id !== uniId) {
      throw new AppError('Document is not in your institution', 403, 'FORBIDDEN');
    }

    await pool.query(
      `UPDATE documents
         SET moderation_status = 'approved',
             moderation_note   = NULL,
             moderated_by      = $1,
             moderated_at      = NOW(),
             is_published      = TRUE,
             published_at      = COALESCE(published_at, NOW())
       WHERE id = $2`,
      [req.user.id, documentId]
    );

    await logAdminAction(req.user.id, 'document.approve', 'documents', documentId,
      { title: doc.title }, req);

    res.json({ success: true, message: 'Document approved and published' });
  } catch (err) { next(err); }
});

// POST /admin/moderation/:documentId/reject  — { reason }
router.post('/moderation/:documentId/reject', async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const { reason }     = req.body;
    if (!reason?.trim()) {
      throw new AppError('A rejection reason is required', 422, 'VALIDATION_ERROR');
    }

    const { rows: [doc] } = await pool.query(
      `SELECT d.id, d.title, d.uploader_id, u.university_id
       FROM documents d LEFT JOIN users u ON u.id = d.uploader_id
       WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [documentId]
    );
    if (!doc) throw new AppError('Document not found', 404, 'NOT_FOUND');

    const uniId = scopeUniversity(req);
    if (uniId && doc.university_id !== uniId) {
      throw new AppError('Document is not in your institution', 403, 'FORBIDDEN');
    }

    await pool.query(
      `UPDATE documents
         SET moderation_status = 'rejected',
             moderation_note   = $1,
             moderated_by      = $2,
             moderated_at      = NOW(),
             is_published      = FALSE
       WHERE id = $3`,
      [reason.trim(), req.user.id, documentId]
    );

    // Notify the uploader
    await pool.query(
      `INSERT INTO notifications (user_id, event_type, payload)
       VALUES ($1, 'document.rejected', $2)`,
      [doc.uploader_id, JSON.stringify({ documentId, reason: reason.trim() })]
    );

    await logAdminAction(req.user.id, 'document.reject', 'documents', documentId,
      { title: doc.title, reason: reason.trim() }, req);

    res.json({ success: true, message: 'Document rejected' });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. PLAGIARISM BATCH CHECK  (REQ-ADM-010)
// ══════════════════════════════════════════════════════════════════════════════

// POST /admin/plagiarism/batch-check
router.post('/plagiarism/batch-check', async (req, res, next) => {
  try {
    const uniId = scopeUniversity(req);

    const conditions = [`d.deleted_at IS NULL`, `d.plagiarism_status IN ('pending','error','unchecked')`];
    const values = [];
    if (uniId) {
      conditions.push(`u.university_id = $1`);
      values.push(uniId);
    }

    const { rows } = await pool.query(
      `SELECT d.id FROM documents d
       LEFT JOIN users u ON u.id = d.uploader_id
       WHERE ${conditions.join(' AND ')}
       LIMIT 200`,
      values
    );

    rows.forEach(r => checkDocumentAsync(r.id));

    await logAdminAction(req.user.id, 'plagiarism.batch_check', null, null,
      { count: rows.length, university_id: uniId ?? 'all' }, req);

    res.json({
      success: true,
      message: `Batch plagiarism check started for ${rows.length} document(s)`,
      data: { queued: rows.length },
    });
  } catch (err) { next(err); }
});

// PATCH /admin/settings/plagiarism-threshold  — { threshold: 0.0–1.0 }
// (also listed under settings section below — kept here for semantic grouping)
router.patch('/plagiarism/threshold', async (req, res, next) => {
  try {
    const threshold = parseFloat(req.body.threshold);
    if (isNaN(threshold) || threshold < 0 || threshold > 1) {
      throw new AppError('threshold must be a number between 0 and 1', 422, 'VALIDATION_ERROR');
    }

    const uniId = scopeUniversity(req) ?? req.user.university_id;
    if (!uniId) throw new AppError('No institution context', 400, 'BAD_REQUEST');

    await pool.query(
      `UPDATE institution_subscriptions SET plagiarism_threshold = $1 WHERE university_id = $2`,
      [threshold, uniId]
    );

    await logAdminAction(req.user.id, 'settings.plagiarism_threshold', 'institution_subscriptions',
      null, { threshold, university_id: uniId }, req);

    res.json({ success: true, message: `Plagiarism threshold set to ${threshold}` });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. ANALYTICS  (REQ-ADM-012, ADM-013, ADM-014)
// ══════════════════════════════════════════════════════════════════════════════

// GET /admin/analytics
router.get('/analytics', async (req, res, next) => {
  try {
    const uniId = scopeUniversity(req);
    const uniFilter    = uniId ? 'AND u.university_id = $1' : '';
    const docUniFilter = uniId
      ? 'AND d.uploader_id IN (SELECT id FROM users WHERE university_id = $1 AND deleted_at IS NULL)'
      : '';
    const vals = uniId ? [uniId] : [];

    const [usersR, docsR, subR, deptR, topR, modR] = await Promise.all([
      // Users by role
      pool.query(
        `SELECT r.name AS role, COUNT(DISTINCT u.id) AS count
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE u.deleted_at IS NULL ${uniFilter}
         GROUP BY r.name
         ORDER BY count DESC`, vals
      ),
      // Documents by type
      pool.query(
        `SELECT d.doc_type, COUNT(*) AS count,
                COALESCE(SUM(d.view_count),0)     AS total_views,
                COALESCE(SUM(d.download_count),0) AS total_downloads,
                COALESCE(SUM(d.citation_count),0) AS total_citations
         FROM documents d
         WHERE d.deleted_at IS NULL ${docUniFilter}
         GROUP BY d.doc_type`, vals
      ),
      // Submissions + plagiarism flags
      pool.query(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE s.plagiarism_score > 0.3) AS flagged,
                COUNT(*) FILTER (WHERE s.check_status = 'completed') AS checked
         FROM submissions s
         LEFT JOIN users u ON u.id = s.student_id
         WHERE s.deleted_at IS NULL ${uniFilter}`, vals
      ),
      // Output by department
      pool.query(
        `SELECT dep.name AS department, COUNT(d.id) AS documents,
                COALESCE(SUM(d.citation_count),0) AS citations,
                COALESCE(SUM(d.download_count),0) AS downloads
         FROM documents d
         LEFT JOIN users u   ON u.id  = d.uploader_id
         LEFT JOIN departments dep ON dep.id = u.department_id
         WHERE d.deleted_at IS NULL AND d.is_published = TRUE ${uniFilter}
         GROUP BY dep.name
         ORDER BY documents DESC
         LIMIT 20`, vals
      ),
      // Top 10 documents by citation
      pool.query(
        `SELECT d.id, d.title, d.doc_type, d.citation_count,
                d.view_count, d.download_count,
                u.full_name AS uploader_name, dep.name AS department
         FROM documents d
         LEFT JOIN users u   ON u.id   = d.uploader_id
         LEFT JOIN departments dep ON dep.id = u.department_id
         WHERE d.deleted_at IS NULL AND d.is_published = TRUE ${uniFilter}
         ORDER BY d.citation_count DESC, d.view_count DESC
         LIMIT 10`, vals
      ),
      // Moderation queue snapshot
      pool.query(
        `SELECT d.moderation_status, COUNT(*) AS count
         FROM documents d
         LEFT JOIN users u ON u.id = d.uploader_id
         WHERE d.deleted_at IS NULL ${uniFilter}
         GROUP BY d.moderation_status`, vals
      ),
    ]);

    res.json({
      success: true,
      data: {
        users:        usersR.rows,
        documents:    docsR.rows,
        submissions:  subR.rows[0],
        byDepartment: deptR.rows,
        topDocuments: topR.rows,
        moderation:   modR.rows,
      },
    });
  } catch (err) { next(err); }
});

// GET /admin/analytics/export — returns CSV  (REQ-ADM-013)
router.get('/analytics/export', async (req, res, next) => {
  try {
    const uniId = scopeUniversity(req);
    const uniFilter = uniId
      ? 'AND d.uploader_id IN (SELECT id FROM users WHERE university_id = $1 AND deleted_at IS NULL)'
      : '';
    const vals = uniId ? [uniId] : [];

    const { rows } = await pool.query(
      `SELECT d.id, d.title, d.doc_type, d.visibility, d.is_published,
              d.moderation_status, d.plagiarism_score, d.plagiarism_status,
              d.view_count, d.download_count, d.citation_count,
              d.file_size_bytes, d.created_at, d.published_at,
              u.full_name AS uploader_name, u.email AS uploader_email,
              dep.name AS department, uni.name AS university
       FROM documents d
       LEFT JOIN users u   ON u.id  = d.uploader_id
       LEFT JOIN departments dep ON dep.id = u.department_id
       LEFT JOIN universities uni ON uni.id = u.university_id
       WHERE d.deleted_at IS NULL ${uniFilter}
       ORDER BY d.created_at DESC`, vals
    );

    // Build CSV
    const headers = [
      'id','title','doc_type','visibility','is_published','moderation_status',
      'plagiarism_score','plagiarism_status','view_count','download_count',
      'citation_count','file_size_bytes','created_at','published_at',
      'uploader_name','uploader_email','department','university',
    ];

    const escape = v => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
    ].join('\r\n');

    await logAdminAction(req.user.id, 'analytics.export_csv', null, null,
      { university_id: uniId ?? 'all', rows: rows.length }, req);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="uninms-analytics-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. ANNOUNCEMENTS  (REQ-ADM-006)
// ══════════════════════════════════════════════════════════════════════════════

// GET /admin/announcements
router.get('/announcements', async (req, res, next) => {
  try {
    const uniId = scopeUniversity(req) ?? req.user.university_id;
    const { rows } = await pool.query(
      `SELECT a.id, a.title, a.body, a.is_active, a.expires_at, a.created_at,
              u.full_name AS author_name
       FROM announcements a
       LEFT JOIN users u ON u.id = a.author_id
       WHERE a.deleted_at IS NULL
         AND (a.university_id = $1 OR a.university_id IS NULL)
       ORDER BY a.created_at DESC`,
      [uniId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /admin/announcements  — { title, body, expiresAt? }
router.post('/announcements', async (req, res, next) => {
  try {
    const { title, body, expiresAt } = req.body;
    if (!title?.trim() || !body?.trim()) {
      throw new AppError('title and body are required', 422, 'VALIDATION_ERROR');
    }

    const uniId = scopeUniversity(req) ?? req.user.university_id;
    const { rows: [ann] } = await pool.query(
      `INSERT INTO announcements (university_id, author_id, title, body, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, created_at`,
      [uniId, req.user.id, title.trim(), body.trim(), expiresAt ?? null]
    );

    await logAdminAction(req.user.id, 'announcement.create', 'announcements', ann.id,
      { title: ann.title }, req);

    res.status(201).json({ success: true, data: ann });
  } catch (err) { next(err); }
});

// DELETE /admin/announcements/:id
router.delete('/announcements/:id', async (req, res, next) => {
  try {
    const { rows: [ann] } = await pool.query(
      `UPDATE announcements SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, title`,
      [req.params.id]
    );
    if (!ann) throw new AppError('Announcement not found', 404, 'NOT_FOUND');

    await logAdminAction(req.user.id, 'announcement.delete', 'announcements', ann.id,
      { title: ann.title }, req);

    res.json({ success: true, message: 'Announcement removed' });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. AUDIT LOG  (REQ-XCT-014, REQ-SYS-015)
// ══════════════════════════════════════════════════════════════════════════════

// GET /admin/audit-log?page=1&limit=50&action=&actorId=
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

    // Scope non-super_admins to their own institution's actors
    if (!req.user.roles?.includes('super_admin') && req.user.university_id) {
      conditions.push(`u.university_id = $${idx++}`);
      values.push(req.user.university_id);
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
              u.full_name AS actor_name, u.email AS actor_email
       FROM audit_log al
       LEFT JOIN users u ON u.id = al.actor_id
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
// 7. INSTITUTION SETTINGS
// ══════════════════════════════════════════════════════════════════════════════

// GET /admin/settings
router.get('/settings', async (req, res, next) => {
  try {
    const uniId = scopeUniversity(req) ?? req.user.university_id;
    const { rows: [settings] } = await pool.query(
      `SELECT s.plan, s.status, s.max_users, s.max_storage_gb,
              s.features, s.plagiarism_threshold,
              u.name AS university_name, u.short_name
       FROM institution_subscriptions s
       JOIN universities u ON u.id = s.university_id
       WHERE s.university_id = $1`,
      [uniId]
    );
    if (!settings) throw new AppError('Institution settings not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
});

// PATCH /admin/settings — update institution settings
// Supports: plagiarismThreshold, maxUsers, maxStorageGb
router.patch('/settings', async (req, res, next) => {
  try {
    const uniId = scopeUniversity(req) ?? req.user.university_id;
    if (!uniId) throw new AppError('No institution context', 400, 'BAD_REQUEST');

    const { plagiarismThreshold, maxUsers, maxStorageGb } = req.body;

    const updates = [];
    const values  = [];
    let   idx     = 1;

    if (plagiarismThreshold !== undefined) {
      const t = parseFloat(plagiarismThreshold);
      if (isNaN(t) || t < 0 || t > 1)
        throw new AppError('plagiarismThreshold must be a number between 0 and 1', 422, 'VALIDATION_ERROR');
      updates.push(`plagiarism_threshold = $${idx++}`); values.push(t);
    }
    if (maxUsers !== undefined) {
      const v = parseInt(maxUsers);
      if (isNaN(v) || v < 1) throw new AppError('maxUsers must be a positive integer', 422, 'VALIDATION_ERROR');
      updates.push(`max_users = $${idx++}`); values.push(v);
    }
    if (maxStorageGb !== undefined) {
      const v = parseInt(maxStorageGb);
      if (isNaN(v) || v < 1) throw new AppError('maxStorageGb must be a positive integer', 422, 'VALIDATION_ERROR');
      updates.push(`max_storage_gb = $${idx++}`); values.push(v);
    }

    if (!updates.length) throw new AppError('Nothing to update', 400, 'NO_CHANGES');

    values.push(uniId);
    await pool.query(
      `UPDATE institution_subscriptions SET ${updates.join(', ')} WHERE university_id = $${idx}`,
      values
    );

    await logAdminAction(req.user.id, 'settings.update', 'institution_subscriptions',
      null, { changes: req.body, university_id: uniId }, req);

    res.json({ success: true, message: 'Settings updated' });
  } catch (err) { next(err); }
});

// GET /admin/departments — list departments for the scoped university
router.get('/departments', async (req, res, next) => {
  try {
    const uniId = scopeUniversity(req);
    const { rows } = await pool.query(
      `SELECT d.id, d.name, d.code, f.name AS faculty_name
       FROM departments d
       JOIN faculties f ON f.id = d.faculty_id
       WHERE f.university_id = $1
       ORDER BY f.name, d.name`,
      [uniId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

module.exports = router;
