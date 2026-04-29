const express  = require('express');
const bcrypt   = require('bcryptjs');
const multer   = require('multer');
const { pool } = require('../config/database');
const { AppError } = require('../utils/AppError');
const { authenticate } = require('../middleware/auth');

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new AppError('Only image files allowed', 422, 'INVALID_FILE'));
    cb(null, true);
  },
});

const router = express.Router();

// GET /users/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.status, u.bio, u.orcid_id, u.phone,
              u.profile_photo_url, u.matric_number, u.staff_id, u.created_at,
              dep.name AS department_name, fac.name AS faculty_name,
              uni.name AS university_name, uni.short_name AS university_short,
              array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) AS roles,
              rl.total_points, rl.current_level, rl.next_level, rl.points_to_next,
              s.plan, s.status AS subscription_status, s.features
       FROM users u
       LEFT JOIN departments dep ON dep.id = u.department_id
       LEFT JOIN faculties fac ON fac.id = dep.faculty_id
       LEFT JOIN universities uni ON uni.id = u.university_id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       LEFT JOIN reward_levels rl ON rl.user_id = u.id
       LEFT JOIN institution_subscriptions s ON s.university_id = u.university_id
       WHERE u.id=$1 AND u.deleted_at IS NULL
       GROUP BY u.id,dep.name,fac.name,uni.name,uni.short_name,rl.total_points,rl.current_level,rl.next_level,rl.points_to_next,s.plan,s.status,s.features`,
      [req.user.id]
    );
    if (!rows[0]) throw new AppError('User not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// PATCH /users/me — update profile
router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const { fullName, bio, orcidId, phone } = req.body;
    const updates = [], values = [];
    let idx = 1;

    if (fullName !== undefined) { updates.push(`full_name=$${idx++}`); values.push(fullName); }
    if (bio !== undefined)      { updates.push(`bio=$${idx++}`);       values.push(bio);      }
    if (orcidId !== undefined)  { updates.push(`orcid_id=$${idx++}`);  values.push(orcidId);  }
    if (phone !== undefined)    { updates.push(`phone=$${idx++}`);     values.push(phone);    }

    if (!updates.length) throw new AppError('Nothing to update', 400, 'NO_CHANGES');

    values.push(req.user.id);
    await pool.query(
      `UPDATE users SET ${updates.join(',')}, updated_at=NOW() WHERE id=$${idx}`,
      values
    );
    res.json({ success: true, message: 'Profile updated' });
  } catch (err) { next(err); }
});

// PATCH /users/me/password — change password
router.patch('/me/password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      throw new AppError('Both current and new password are required', 422, 'VALIDATION_ERROR');
    }
    if (newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters', 422, 'VALIDATION_ERROR');
    }
    if (!/[A-Z]/.test(newPassword)) {
      throw new AppError('New password must contain at least one uppercase letter', 422, 'VALIDATION_ERROR');
    }
    if (!/[0-9]/.test(newPassword)) {
      throw new AppError('New password must contain at least one number', 422, 'VALIDATION_ERROR');
    }

    // Get current hash
    const { rows: [cred] } = await pool.query(
      'SELECT password_hash FROM user_credentials WHERE user_id=$1', [req.user.id]
    );
    if (!cred) throw new AppError('Credentials not found', 404, 'NOT_FOUND');

    const valid = await bcrypt.compare(currentPassword, cred.password_hash);
    if (!valid) throw new AppError('Current password is incorrect', 401, 'INVALID_PASSWORD');

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE user_credentials SET password_hash=$1, updated_at=NOW() WHERE user_id=$2',
      [newHash, req.user.id]
    );

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) { next(err); }
});

// POST /users/me/photo — upload profile picture
router.post('/me/photo', authenticate, photoUpload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError('No image uploaded', 422, 'VALIDATION_ERROR');
    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    await pool.query('UPDATE users SET profile_photo_url=$1, updated_at=NOW() WHERE id=$2', [base64, req.user.id]);
    res.json({ success: true, data: { profilePhotoUrl: base64 } });
  } catch (err) { next(err); }
});

// GET /users/search?q= — search users by name/email
router.get('/search', authenticate, async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ success: true, data: [] });
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.profile_photo_url,
              dep.name AS department_name, uni.short_name AS university_short
       FROM users u
       LEFT JOIN departments dep ON dep.id = u.department_id
       LEFT JOIN universities uni ON uni.id = u.university_id
       WHERE u.status='active' AND u.deleted_at IS NULL
         AND (u.full_name ILIKE $1 OR u.email ILIKE $1)
       LIMIT 10`,
      [`%${q.trim()}%`]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /users/:id/profile — public profile
router.get('/:id/profile', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.bio, u.orcid_id, u.profile_photo_url,
              dep.name AS department_name, fac.name AS faculty_name,
              uni.name AS university_name,
              array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) AS roles,
              rl.total_points, rl.current_level,
              (SELECT COUNT(*) FROM documents WHERE uploader_id=u.id AND is_published=true AND deleted_at IS NULL) AS document_count,
              (SELECT COALESCE(SUM(citation_count),0) FROM documents WHERE uploader_id=u.id AND deleted_at IS NULL) AS total_citations
       FROM users u
       LEFT JOIN departments dep ON dep.id=u.department_id
       LEFT JOIN faculties fac ON fac.id=dep.faculty_id
       LEFT JOIN universities uni ON uni.id=u.university_id
       LEFT JOIN user_roles ur ON ur.user_id=u.id
       LEFT JOIN roles r ON r.id=ur.role_id
       LEFT JOIN reward_levels rl ON rl.user_id=u.id
       WHERE u.id=$1 AND u.deleted_at IS NULL AND u.status='active'
       GROUP BY u.id,dep.name,fac.name,uni.name,rl.total_points,rl.current_level`,
      [req.params.id]
    );
    if (!rows[0]) throw new AppError('User not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// GET /users/:id/points
router.get('/:id/points', authenticate, async (req, res, next) => {
  try {
    const { rows:[summary] } = await pool.query(
      `SELECT total_points, current_level, level_number, next_level, points_to_next
       FROM reward_levels WHERE user_id=$1`, [req.params.id]
    );
    const { rows: activity } = await pool.query(
      `SELECT action_type, points, earned_at
       FROM points_log WHERE user_id=$1
       ORDER BY earned_at DESC LIMIT 20`, [req.params.id]
    );
    res.json({
      success: true,
      data: { summary: summary||{ total_points:0, current_level:'Contributor' }, recentActivity: activity }
    });
  } catch (err) { next(err); }
});

module.exports = router;
