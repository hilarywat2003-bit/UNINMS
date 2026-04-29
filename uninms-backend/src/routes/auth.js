const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { client: redis } = require('../config/redis');
const { AppError } = require('../utils/AppError');
const { authenticate } = require('../middleware/auth');
const { logAdminAction } = require('../utils/auditLog');
const { z } = require('zod');

const router = express.Router();

// ── Token helpers ─────────────────────────────────────────────────────────────
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId, jti: uuidv4() },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
  const refreshToken = jwt.sign(
    { userId, jti: uuidv4() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
  return { accessToken, refreshToken };
};

// ── GET /auth/universities — list all universities for registration dropdown ──
router.get('/universities', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.short_name, u.state, u.type,
              s.plan, s.status AS subscription_status,
              array_agg(DISTINCT d.domain) FILTER (WHERE d.domain IS NOT NULL) AS domains
       FROM universities u
       LEFT JOIN institution_subscriptions s ON s.university_id = u.id
       LEFT JOIN university_domains d ON d.university_id = u.id
       WHERE u.deleted_at IS NULL
       GROUP BY u.id, u.name, u.short_name, u.state, u.type, s.plan, s.status
       ORDER BY u.name`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── GET /auth/detect-institution — detect university from email domain ────────
router.get('/detect-institution', async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email || !email.includes('@')) {
      return res.json({ success: true, data: null });
    }

    const domain = email.split('@')[1].toLowerCase();

    // Check exact domain match
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.short_name, u.state,
              s.plan, s.status AS subscription_status,
              s.features
       FROM universities u
       JOIN university_domains ud ON ud.university_id = u.id
       LEFT JOIN institution_subscriptions s ON s.university_id = u.id
       WHERE ud.domain = $1 AND u.deleted_at IS NULL
       LIMIT 1`,
      [domain]
    );

    if (rows[0]) {
      return res.json({ success: true, data: rows[0], detected: true });
    }

    // Try partial match (e.g. "staff.unn.edu.ng" → "unn.edu.ng")
    const parts = domain.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
      const partial = parts.slice(i).join('.');
      const { rows: partialRows } = await pool.query(
        `SELECT u.id, u.name, u.short_name, s.plan, s.status AS subscription_status
         FROM universities u
         JOIN university_domains ud ON ud.university_id = u.id
         LEFT JOIN institution_subscriptions s ON s.university_id = u.id
         WHERE ud.domain = $1 AND u.deleted_at IS NULL LIMIT 1`,
        [partial]
      );
      if (partialRows[0]) {
        return res.json({ success: true, data: partialRows[0], detected: true });
      }
    }

    res.json({ success: true, data: null, detected: false });
  } catch (err) { next(err); }
});

// ── GET /auth/departments/:universityId — departments for a university ─────────
router.get('/departments/:universityId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT dep.id, dep.name, dep.code, fac.name AS faculty_name
       FROM departments dep
       JOIN faculties fac ON fac.id = dep.faculty_id
       WHERE fac.university_id = $1 AND dep.deleted_at IS NULL
       ORDER BY fac.name, dep.name`,
      [req.params.universityId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── POST /auth/register ───────────────────────────────────────────────────────
const registerSchema = z.object({
  fullName:     z.string().min(2).max(255),
  email:        z.string().email(),
  password:     z.string().min(8).regex(/[A-Z]/, 'Needs uppercase').regex(/[0-9]/, 'Needs number'),
  role:         z.enum(['student','lecturer','researcher','admin','management']).default('student'),
  universityId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  matricNumber: z.string().max(50).optional(),
  staffId:      z.string().max(50).optional(),
  agreeTerms:   z.boolean().refine(v => v === true, { message: 'Must accept terms' }),
});

router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check email not already registered
    const existing = await pool.query(
      'SELECT id FROM users WHERE email=$1 AND deleted_at IS NULL', [data.email]
    );
    if (existing.rows[0]) throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');

    // Auto-detect university from email if not provided
    let universityId = data.universityId || null;
    let subscriptionOk = true;
    let plan = 'free';

    if (!universityId) {
      const domain = data.email.split('@')[1]?.toLowerCase();
      if (domain) {
        const { rows } = await pool.query(
          `SELECT u.id FROM universities u
           JOIN university_domains ud ON ud.university_id = u.id
           WHERE ud.domain = $1 AND u.deleted_at IS NULL LIMIT 1`,
          [domain]
        );
        if (rows[0]) universityId = rows[0].id;
      }
    }

    // Check subscription if university found
    if (universityId) {
      const { rows: [sub] } = await pool.query(
        `SELECT plan, status, max_users,
                (SELECT COUNT(*) FROM users WHERE university_id=$1 AND deleted_at IS NULL) AS current_users
         FROM institution_subscriptions
         WHERE university_id=$1`,
        [universityId]
      );

      if (sub) {
        plan = sub.plan;
        if (sub.status === 'suspended') {
          throw new AppError(
            'Your institution\'s UniNMS subscription is suspended. Contact your library administrator.',
            403, 'SUBSCRIPTION_SUSPENDED'
          );
        }
        if (sub.status === 'expired') {
          throw new AppError(
            'Your institution\'s UniNMS subscription has expired. Contact your library administrator.',
            403, 'SUBSCRIPTION_EXPIRED'
          );
        }
        if (parseInt(sub.current_users) >= sub.max_users) {
          throw new AppError(
            `Your institution has reached its user limit (${sub.max_users}). Contact your library administrator to upgrade.`,
            403, 'USER_LIMIT_REACHED'
          );
        }
      }
    }

    // Get department's university if department provided but no university
    if (data.departmentId && !universityId) {
      const { rows } = await pool.query(
        `SELECT fac.university_id FROM departments dep
         JOIN faculties fac ON fac.id = dep.faculty_id
         WHERE dep.id=$1`, [data.departmentId]
      );
      if (rows[0]) universityId = rows[0].university_id;
    }

    const hash = await bcrypt.hash(data.password, 12);

    // Create user
    const { rows: [user] } = await pool.query(
      `INSERT INTO users
         (full_name, email, status, department_id, university_id,
          matric_number, staff_id, subscription_verified)
       VALUES ($1,$2,'active',$3,$4,$5,$6,$7)
       RETURNING id, full_name, email`,
      [
        data.fullName, data.email,
        data.departmentId || null, universityId,
        data.matricNumber || null, data.staffId || null,
        universityId ? true : false,
      ]
    );

    // Save credentials
    await pool.query(
      `INSERT INTO user_credentials(user_id, password_hash, email_verified)
       VALUES($1,$2,true)`,
      [user.id, hash]
    );

    // Assign role
    const { rows: [role] } = await pool.query(
      'SELECT id FROM roles WHERE name=$1', [data.role]
    );
    if (role) {
      await pool.query(
        'INSERT INTO user_roles(user_id,role_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [user.id, role.id]
      );
    }

    // Initialise reward level
    await pool.query(
      'INSERT INTO reward_levels(user_id) VALUES($1) ON CONFLICT DO NOTHING', [user.id]
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        universityDetected: !!universityId,
        plan,
        subscriptionActive: subscriptionOk,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError('Validation failed', 422, 'VALIDATION_ERROR', err.errors));
    }
    next(err);
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new AppError('Email and password required', 400, 'VALIDATION_ERROR');

    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.status, u.university_id,
              uc.password_hash,
              array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) AS roles,
              s.plan, s.status AS sub_status, s.features
       FROM users u
       JOIN user_credentials uc ON uc.user_id = u.id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       LEFT JOIN institution_subscriptions s ON s.university_id = u.university_id
       WHERE u.email=$1 AND u.deleted_at IS NULL
       GROUP BY u.id, uc.password_hash, s.plan, s.status, s.features`,
      [email]
    );

    const user = rows[0];
    if (!user) throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');

    if (user.status === 'suspended') throw new AppError('Account suspended', 403, 'ACCOUNT_SUSPENDED');

    // Check subscription on login
    if (user.sub_status === 'suspended') {
      throw new AppError(
        'Your institution\'s subscription is suspended. Contact your library administrator.',
        403, 'SUBSCRIPTION_SUSPENDED'
      );
    }

    const { accessToken, refreshToken } = generateTokens(user.id);
    try { await redis.setEx(`rt:${user.id}`, 7*24*3600, refreshToken); } catch (_) {}

    await logAdminAction(user.id, 'auth.login', 'users', user.id, { email: user.email }, req);

    // Update login stats
    await pool.query(
      `UPDATE user_credentials
       SET last_login=NOW(), login_count=COALESCE(login_count,0)+1
       WHERE user_id=$1`,
      [user.id]
    );

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id:          user.id,
          fullName:    user.full_name,
          email:       user.email,
          roles:       user.roles || [],
          status:      user.status,
          plan:        user.plan || 'free',
          features:    user.features || {},
          universityId:user.university_id,
        },
      },
    });
  } catch (err) { next(err); }
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const token = req.headers.authorization?.slice(7);
    if (token) {
      const payload = jwt.decode(token);
      const ttl = Math.max(0, (payload?.exp||0) - Math.floor(Date.now()/1000));
      if (ttl > 0) await redis.setEx(`bl:${token}`, ttl, '1');
    }
    await redis.del(`rt:${req.user.id}`);
    await logAdminAction(req.user.id, 'auth.logout', 'users', req.user.id, {}, req);
    res.json({ success: true, message: 'Logged out' });
  } catch (err) { next(err); }
});

// ── POST /auth/refresh ────────────────────────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError('Refresh token required', 400, 'MISSING_TOKEN');
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const stored  = await redis.get(`rt:${payload.userId}`);
    if (stored !== refreshToken) throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
    const tokens = generateTokens(payload.userId);
    await redis.setEx(`rt:${payload.userId}`, 7*24*3600, tokens.refreshToken);
    res.json({ success: true, data: tokens });
  } catch (err) {
    if (err.name==='JsonWebTokenError'||err.name==='TokenExpiredError') {
      return next(new AppError('Invalid refresh token', 401, 'INVALID_TOKEN'));
    }
    next(err);
  }
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.status, u.bio, u.orcid_id,
              u.profile_photo_url, u.matric_number, u.staff_id,
              u.university_id, u.created_at,
              dep.name AS department_name, fac.name AS faculty_name,
              uni.name AS university_name, uni.short_name AS university_short,
              array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) AS roles,
              s.plan, s.status AS subscription_status, s.features
       FROM users u
       LEFT JOIN departments dep ON dep.id=u.department_id
       LEFT JOIN faculties fac ON fac.id=dep.faculty_id
       LEFT JOIN universities uni ON uni.id=u.university_id
       LEFT JOIN user_roles ur ON ur.user_id=u.id
       LEFT JOIN roles r ON r.id=ur.role_id
       LEFT JOIN institution_subscriptions s ON s.university_id=u.university_id
       WHERE u.id=$1 AND u.deleted_at IS NULL
       GROUP BY u.id,dep.name,fac.name,uni.name,uni.short_name,s.plan,s.status,s.features`,
      [req.user.id]
    );
    if (!rows[0]) throw new AppError('User not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
