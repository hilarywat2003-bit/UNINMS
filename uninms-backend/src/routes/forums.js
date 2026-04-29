const express  = require('express');
const { pool } = require('../config/database');
const { AppError } = require('../utils/AppError');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();

const threadSchema = z.object({
  title:    z.string().min(5).max(500),
  content:  z.string().min(10),
  category: z.string().optional(),
});

// GET /forums/threads
router.get('/threads', optionalAuth, async (req, res, next) => {
  try {
    const { limit = 20, category, search } = req.query;
    let where = ['ft.deleted_at IS NULL'];
    const values = [];
    let idx = 1;
    if (category) { where.push(`ft.category = $${idx}`); values.push(category); idx++; }
    if (search)   { where.push(`ft.title ILIKE $${idx}`); values.push(`%${search}%`); idx++; }

    values.push(parseInt(limit));
    const { rows } = await pool.query(
      `SELECT ft.id, ft.title, ft.category, ft.reply_count, ft.is_pinned,
              ft.updated_at, ft.created_at,
              u.full_name AS author_name,
              (SELECT content FROM forum_posts WHERE thread_id = ft.id
               ORDER BY created_at DESC LIMIT 1) AS last_post_preview
       FROM forum_threads ft
       JOIN users u ON u.id = ft.author_id
       WHERE ${where.join(' AND ')}
       ORDER BY ft.is_pinned DESC, ft.updated_at DESC
       LIMIT $${idx}`,
      values
    );
    res.json({ success: true, data: { threads: rows } });
  } catch (err) { next(err); }
});

// POST /forums/threads
router.post('/threads', authenticate, async (req, res, next) => {
  try {
    const data = threadSchema.parse(req.body);
    const { rows: [thread] } = await pool.query(
      `INSERT INTO forum_threads (author_id, title, category)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, data.title, data.category || null]
    );
    // Add first post
    await pool.query(
      `INSERT INTO forum_posts (thread_id, author_id, content)
       VALUES ($1, $2, $3)`,
      [thread.id, req.user.id, data.content]
    );
    res.status(201).json({ success: true, data: thread });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError('Validation failed', 422, 'VALIDATION_ERROR', err.errors));
    next(err);
  }
});

// GET /forums/threads/:id
router.get('/threads/:id', optionalAuth, async (req, res, next) => {
  try {
    const { rows: [thread] } = await pool.query(
      `SELECT ft.*, u.full_name AS author_name
       FROM forum_threads ft JOIN users u ON u.id = ft.author_id
       WHERE ft.id = $1 AND ft.deleted_at IS NULL`, [req.params.id]
    );
    if (!thread) throw new AppError('Thread not found', 404, 'NOT_FOUND');

    const { rows: posts } = await pool.query(
      `SELECT fp.id, fp.content, fp.upvote_count, fp.is_answer,
              fp.created_at, u.full_name AS author_name
       FROM forum_posts fp JOIN users u ON u.id = fp.author_id
       WHERE fp.thread_id = $1 AND fp.deleted_at IS NULL
       ORDER BY fp.is_answer DESC, fp.upvote_count DESC, fp.created_at ASC`,
      [req.params.id]
    );
    res.json({ success: true, data: { ...thread, posts } });
  } catch (err) { next(err); }
});

// POST /forums/threads/:id/posts
router.post('/threads/:id/posts', authenticate, async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || content.length < 3) throw new AppError('Content too short', 422, 'VALIDATION_ERROR');

    const { rows: [post] } = await pool.query(
      `INSERT INTO forum_posts (thread_id, author_id, content) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, req.user.id, content]
    );
    await pool.query(
      `UPDATE forum_threads SET reply_count = reply_count + 1, updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    res.status(201).json({ success: true, data: post });
  } catch (err) { next(err); }
});

// POST /forums/posts/:id/upvote
router.post('/posts/:id/upvote', authenticate, async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE forum_posts SET upvote_count = upvote_count + 1 WHERE id = $1`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
