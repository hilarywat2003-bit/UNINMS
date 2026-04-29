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

module.exports = router;
