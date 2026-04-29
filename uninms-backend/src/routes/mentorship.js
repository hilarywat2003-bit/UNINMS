const express  = require('express');
const { pool } = require('../config/database');
const { AppError } = require('../utils/AppError');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const STAGES = ['initiating', 'challenging', 'growing', 'closing'];

// ── Static routes (before parameterised) ────────────────────────────────────

// GET /mentorship/profiles — browse active mentor profiles
router.get('/profiles', authenticate, async (req, res, next) => {
  try {
    const { support, area } = req.query;
    const where = [`mp.is_active = true`, `(mp.role = 'mentor' OR mp.role = 'both')`, `u.deleted_at IS NULL`];
    const values = [];
    let idx = 1;

    if (support) { where.push(`$${idx++} = ANY(mp.support_types)`); values.push(support); }
    if (area)    { where.push(`$${idx++} ILIKE ANY(mp.areas)`);     values.push(`%${area}%`); }

    const { rows } = await pool.query(
      `SELECT mp.user_id, mp.role, mp.support_types, mp.mentor_roles, mp.areas,
              mp.bio, mp.availability,
              u.full_name, u.profile_photo_url,
              dep.name AS department_name, fac.name AS faculty_name,
              uni.short_name AS university_short,
              rl.current_level,
              (SELECT COUNT(*) FROM mentorships
               WHERE mentor_id=u.id AND status='active') AS active_mentees,
              EXISTS(SELECT 1 FROM mentorships
               WHERE mentor_id=u.id AND mentee_id=$${idx} AND status NOT IN ('declined')) AS requested
       FROM mentorship_profiles mp
       JOIN users u ON u.id = mp.user_id
       LEFT JOIN departments dep ON dep.id = u.department_id
       LEFT JOIN faculties fac ON fac.id = dep.faculty_id
       LEFT JOIN universities uni ON uni.id = u.university_id
       LEFT JOIN reward_levels rl ON rl.user_id = u.id
       WHERE ${where.join(' AND ')} AND mp.user_id != $${idx}
       ORDER BY active_mentees ASC, mp.updated_at DESC
       LIMIT 30`,
      [...values, req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /mentorship/profiles/me
router.get('/profiles/me', authenticate, async (req, res, next) => {
  try {
    const { rows: [profile] } = await pool.query(
      `SELECT * FROM mentorship_profiles WHERE user_id=$1`, [req.user.id]
    );
    res.json({ success: true, data: profile || null });
  } catch (err) { next(err); }
});

// POST /mentorship/profiles — create or update my profile
router.post('/profiles', authenticate, async (req, res, next) => {
  try {
    const { role, supportTypes = [], mentorRoles = [], areas = [], bio, availability } = req.body;
    if (!role || !['mentor', 'mentee', 'both'].includes(role))
      throw new AppError('role must be mentor, mentee, or both', 422, 'VALIDATION_ERROR');

    const { rows: [profile] } = await pool.query(
      `INSERT INTO mentorship_profiles
         (user_id, role, support_types, mentor_roles, areas, bio, availability, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         role=$2, support_types=$3, mentor_roles=$4, areas=$5,
         bio=$6, availability=$7, updated_at=NOW()
       RETURNING *`,
      [req.user.id, role, supportTypes, mentorRoles, areas, bio || null, availability || null]
    );
    res.json({ success: true, data: profile });
  } catch (err) { next(err); }
});

// GET /mentorship/relationships — my mentorships
router.get('/relationships', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.*,
              mentor.full_name AS mentor_name, mentor.profile_photo_url AS mentor_photo,
              mentee.full_name AS mentee_name, mentee.profile_photo_url AS mentee_photo,
              dep_r.name AS mentor_department, dep_e.name AS mentee_department
       FROM mentorships m
       JOIN users mentor ON mentor.id = m.mentor_id
       JOIN users mentee ON mentee.id = m.mentee_id
       LEFT JOIN departments dep_r ON dep_r.id = mentor.department_id
       LEFT JOIN departments dep_e ON dep_e.id = mentee.department_id
       WHERE m.mentor_id=$1 OR m.mentee_id=$1
       ORDER BY m.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /mentorship/request/:mentorId — mentee sends a request
router.post('/request/:mentorId', authenticate, async (req, res, next) => {
  try {
    if (req.params.mentorId === req.user.id)
      throw new AppError('You cannot mentor yourself', 400, 'INVALID');

    const { supportType = 'career', goalsSummary } = req.body;

    const { rows: [mp] } = await pool.query(
      `SELECT role FROM mentorship_profiles WHERE user_id=$1 AND is_active=true`,
      [req.params.mentorId]
    );
    if (!mp || mp.role === 'mentee')
      throw new AppError('This user is not available as a mentor', 400, 'NOT_MENTOR');

    const { rows: [rel] } = await pool.query(
      `INSERT INTO mentorships (mentor_id, mentee_id, support_type, goals_summary)
       VALUES ($1,$2,$3,$4) ON CONFLICT (mentor_id, mentee_id) DO NOTHING RETURNING *`,
      [req.params.mentorId, req.user.id, supportType, goalsSummary || null]
    );
    if (!rel) throw new AppError('A request already exists with this mentor', 409, 'DUPLICATE');
    res.status(201).json({ success: true, data: rel });
  } catch (err) { next(err); }
});

// ── Relationship-level routes ────────────────────────────────────────────────

// PATCH /mentorship/:id/accept
router.patch('/:id/accept', authenticate, async (req, res, next) => {
  try {
    const { rows: [m] } = await pool.query(`SELECT * FROM mentorships WHERE id=$1`, [req.params.id]);
    if (!m) throw new AppError('Mentorship not found', 404, 'NOT_FOUND');
    if (m.mentor_id !== req.user.id) throw new AppError('Only the mentor can accept', 403, 'FORBIDDEN');
    if (m.status !== 'pending') throw new AppError('Request is not pending', 400, 'INVALID');

    const { rows: [updated] } = await pool.query(
      `UPDATE mentorships SET status='active', stage='initiating', started_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// PATCH /mentorship/:id/decline
router.patch('/:id/decline', authenticate, async (req, res, next) => {
  try {
    const { rows: [m] } = await pool.query(`SELECT * FROM mentorships WHERE id=$1`, [req.params.id]);
    if (!m) throw new AppError('Mentorship not found', 404, 'NOT_FOUND');
    if (m.mentor_id !== req.user.id && m.mentee_id !== req.user.id)
      throw new AppError('Not authorized', 403, 'FORBIDDEN');

    await pool.query(`UPDATE mentorships SET status='declined', ended_at=NOW() WHERE id=$1`, [req.params.id]);
    res.json({ success: true, message: 'Declined' });
  } catch (err) { next(err); }
});

// PATCH /mentorship/:id/stage — mentor advances stage
router.patch('/:id/stage', authenticate, async (req, res, next) => {
  try {
    const { rows: [m] } = await pool.query(`SELECT * FROM mentorships WHERE id=$1`, [req.params.id]);
    if (!m) throw new AppError('Mentorship not found', 404, 'NOT_FOUND');
    if (m.mentor_id !== req.user.id) throw new AppError('Only the mentor can update the stage', 403, 'FORBIDDEN');
    if (m.status !== 'active') throw new AppError('Mentorship is not active', 400, 'INVALID');

    const { stage } = req.body;
    if (!stage || !STAGES.includes(stage)) throw new AppError('Invalid stage', 422, 'VALIDATION_ERROR');

    const { rows: [updated] } = await pool.query(
      `UPDATE mentorships SET stage=$1 WHERE id=$2 RETURNING *`, [stage, req.params.id]
    );
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// PATCH /mentorship/:id/close
router.patch('/:id/close', authenticate, async (req, res, next) => {
  try {
    const { rows: [m] } = await pool.query(`SELECT * FROM mentorships WHERE id=$1`, [req.params.id]);
    if (!m) throw new AppError('Mentorship not found', 404, 'NOT_FOUND');
    if (m.mentor_id !== req.user.id && m.mentee_id !== req.user.id)
      throw new AppError('Not authorized', 403, 'FORBIDDEN');
    if (m.status !== 'active') throw new AppError('Mentorship is not active', 400, 'INVALID');

    await pool.query(
      `UPDATE mentorships SET status='completed', stage='closing', ended_at=NOW() WHERE id=$1`,
      [req.params.id]
    );
    res.json({ success: true, message: 'Mentorship completed' });
  } catch (err) { next(err); }
});

// GET /mentorship/:id/sessions
router.get('/:id/sessions', authenticate, async (req, res, next) => {
  try {
    const { rows: [m] } = await pool.query(`SELECT mentor_id, mentee_id FROM mentorships WHERE id=$1`, [req.params.id]);
    if (!m) throw new AppError('Mentorship not found', 404, 'NOT_FOUND');
    if (m.mentor_id !== req.user.id && m.mentee_id !== req.user.id) throw new AppError('Not authorized', 403, 'FORBIDDEN');

    const { rows } = await pool.query(
      `SELECT ms.*, u.full_name AS logged_by_name
       FROM mentorship_sessions ms
       JOIN users u ON u.id = ms.logged_by
       WHERE ms.mentorship_id=$1 ORDER BY ms.session_date DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /mentorship/:id/sessions
router.post('/:id/sessions', authenticate, async (req, res, next) => {
  try {
    const { rows: [m] } = await pool.query(`SELECT * FROM mentorships WHERE id=$1`, [req.params.id]);
    if (!m) throw new AppError('Mentorship not found', 404, 'NOT_FOUND');
    if (m.mentor_id !== req.user.id && m.mentee_id !== req.user.id) throw new AppError('Not authorized', 403, 'FORBIDDEN');
    if (m.status !== 'active') throw new AppError('Cannot log sessions for inactive mentorships', 400, 'INVALID');

    const { title, notes, sessionDate, durationMins } = req.body;
    if (!title) throw new AppError('Session title is required', 422, 'VALIDATION_ERROR');

    const { rows: [session] } = await pool.query(
      `INSERT INTO mentorship_sessions (mentorship_id, title, notes, session_date, duration_mins, logged_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, title, notes || null, sessionDate || new Date(), durationMins || null, req.user.id]
    );
    res.status(201).json({ success: true, data: session });
  } catch (err) { next(err); }
});

// GET /mentorship/:id/goals
router.get('/:id/goals', authenticate, async (req, res, next) => {
  try {
    const { rows: [m] } = await pool.query(`SELECT mentor_id, mentee_id FROM mentorships WHERE id=$1`, [req.params.id]);
    if (!m) throw new AppError('Mentorship not found', 404, 'NOT_FOUND');
    if (m.mentor_id !== req.user.id && m.mentee_id !== req.user.id) throw new AppError('Not authorized', 403, 'FORBIDDEN');

    const { rows } = await pool.query(
      `SELECT * FROM mentorship_goals WHERE mentorship_id=$1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /mentorship/:id/goals
router.post('/:id/goals', authenticate, async (req, res, next) => {
  try {
    const { rows: [m] } = await pool.query(`SELECT mentor_id, mentee_id FROM mentorships WHERE id=$1`, [req.params.id]);
    if (!m) throw new AppError('Mentorship not found', 404, 'NOT_FOUND');
    if (m.mentor_id !== req.user.id && m.mentee_id !== req.user.id) throw new AppError('Not authorized', 403, 'FORBIDDEN');

    const { title, description } = req.body;
    if (!title) throw new AppError('Goal title is required', 422, 'VALIDATION_ERROR');

    const { rows: [goal] } = await pool.query(
      `INSERT INTO mentorship_goals (mentorship_id, title, description) VALUES ($1,$2,$3) RETURNING *`,
      [req.params.id, title, description || null]
    );
    res.status(201).json({ success: true, data: goal });
  } catch (err) { next(err); }
});

// PATCH /mentorship/:id/goals/:goalId
router.patch('/:id/goals/:goalId', authenticate, async (req, res, next) => {
  try {
    const { rows: [m] } = await pool.query(`SELECT mentor_id, mentee_id FROM mentorships WHERE id=$1`, [req.params.id]);
    if (!m) throw new AppError('Mentorship not found', 404, 'NOT_FOUND');
    if (m.mentor_id !== req.user.id && m.mentee_id !== req.user.id) throw new AppError('Not authorized', 403, 'FORBIDDEN');

    const { status } = req.body;
    if (!['active', 'achieved'].includes(status)) throw new AppError('Invalid status', 422, 'VALIDATION_ERROR');

    const achievedAt = status === 'achieved' ? 'NOW()' : 'NULL';
    const { rows: [goal] } = await pool.query(
      `UPDATE mentorship_goals SET status=$1, achieved_at=${achievedAt}
       WHERE id=$2 AND mentorship_id=$3 RETURNING *`,
      [status, req.params.goalId, req.params.id]
    );
    if (!goal) throw new AppError('Goal not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: goal });
  } catch (err) { next(err); }
});

module.exports = router;
