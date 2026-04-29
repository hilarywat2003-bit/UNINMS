const express  = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /notifications
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { limit = 30, unreadOnly } = req.query;

    let where = 'WHERE n.user_id = $1 AND n.deleted_at IS NULL';
    if (unreadOnly === 'true') where += ' AND n.is_read = false';

    const { rows } = await pool.query(
      `SELECT id, channel, event_type, payload, is_read, sent_at
       FROM notifications n
       ${where} ORDER BY sent_at DESC LIMIT $2`,
      [req.user.id, parseInt(limit)]
    );

    const unread = await pool.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false AND deleted_at IS NULL`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        notifications: rows,
        unreadCount:   parseInt(unread.rows[0].count),
      },
    });
  } catch (err) { next(err); }
});

// PATCH /notifications/:id/read
router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /notifications/read-all
router.post('/read-all', authenticate, async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /notifications/push-token  — register / refresh an Expo push token
router.post('/push-token', authenticate, async (req, res, next) => {
  try {
    const { token, platform = 'expo' } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'token is required' });
    }

    await pool.query(
      `INSERT INTO push_tokens (user_id, token, platform, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (token) DO UPDATE
         SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = NOW()`,
      [req.user.id, token.trim(), platform]
    );

    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /notifications/push-token  — remove a token on logout
router.delete('/push-token', authenticate, async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'token is required' });

    await pool.query(
      `DELETE FROM push_tokens WHERE token = $1 AND user_id = $2`,
      [token, req.user.id]
    );

    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
