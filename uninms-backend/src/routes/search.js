const express  = require('express');
const { pool } = require('../config/database');
const { client: redis } = require('../config/redis');
const { AppError } = require('../utils/AppError');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /search — full-text search with optional semantic blend
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { q, limit = 20, page = 1, docType } = req.query;
    if (!q || q.trim().length < 2) {
      throw new AppError('Search query must be at least 2 characters', 422, 'VALIDATION_ERROR');
    }

    const cacheKey = `search:ft:${q}:${docType || ''}:${page}:${limit}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return res.json({ success: true, cached: true, data: JSON.parse(cached) });
    } catch (_) {}

    const offset = (parseInt(page) - 1) * parseInt(limit);
    // $1 = raw query (for tsquery + tsrank), $2 = ILIKE pattern
    const values = [q.trim(), `%${q.trim()}%`];
    let idx = 3;
    let typeFilter = '';
    if (docType) { typeFilter = `AND d.doc_type = $${idx}`; values.push(docType); idx++; }

    const { rows } = await pool.query(
      `SELECT d.id, d.title, d.abstract, d.doc_type, d.view_count,
              d.download_count, d.citation_count, d.average_peer_rating,
              d.published_at, u.full_name AS uploader_name, dep.name AS department_name,
              ts_rank(to_tsvector('english', coalesce(d.title,'') || ' ' || coalesce(d.abstract,'')),
                      plainto_tsquery('english', $1)) AS relevance_score
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploader_id
       LEFT JOIN departments dep ON dep.id = d.department_id
       WHERE d.deleted_at IS NULL AND d.is_published = true
         AND d.visibility = 'public'
         AND (d.title ILIKE $2 OR d.abstract ILIKE $2) ${typeFilter}
       ORDER BY relevance_score DESC, d.published_at DESC
       LIMIT $${idx} OFFSET $${idx+1}`,
      [...values, parseInt(limit), offset]
    );

    const countValues = [`%${q.trim()}%`];
    let countTypeFilter = '';
    if (docType) { countTypeFilter = `AND d.doc_type = $2`; countValues.push(docType); }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM documents d
       WHERE d.deleted_at IS NULL AND d.is_published = true
         AND d.visibility = 'public'
         AND (d.title ILIKE $1 OR d.abstract ILIKE $1) ${countTypeFilter}`,
      countValues
    );

    const result = {
      query:   q,
      results: rows,
      total:   parseInt(countResult.rows[0].count),
      page:    parseInt(page),
    };

    try { await redis.setEx(cacheKey, 600, JSON.stringify(result)); } catch (_) {}
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// POST /search/semantic — vector similarity search
router.post('/semantic', optionalAuth, async (req, res, next) => {
  try {
    const { text, limit = 10 } = req.body;
    if (!text || text.trim().length < 3) {
      throw new AppError('Text must be at least 3 characters', 422, 'VALIDATION_ERROR');
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new AppError('Semantic search requires an OpenAI API key', 503, 'SERVICE_UNAVAILABLE');
    }

    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const embedding = await openai.embeddings.create({
      model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
      input: text.slice(0, 8000),
    });

    const vector = JSON.stringify(embedding.data[0].embedding);

    const { rows } = await pool.query(
      `SELECT d.id, d.title, d.abstract, d.doc_type, d.view_count, d.citation_count,
              u.full_name AS uploader_name,
              1 - (d.embedding <=> $1::vector) AS similarity
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploader_id
       WHERE d.deleted_at IS NULL AND d.is_published = true
         AND d.visibility = 'public' AND d.embedding IS NOT NULL
       ORDER BY d.embedding <=> $1::vector
       LIMIT $2`,
      [vector, parseInt(limit)]
    );

    res.json({ success: true, data: { results: rows, total: rows.length, query: text } });
  } catch (err) { next(err); }
});

module.exports = router;
