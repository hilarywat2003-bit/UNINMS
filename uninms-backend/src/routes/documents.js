const express  = require('express');
const multer   = require('multer');
const { pool } = require('../config/database');
const { AppError } = require('../utils/AppError');
const { authenticate, optionalAuth, requireRole } = require('../middleware/auth');
const { z } = require('zod');
const { stampHash, generateAndStoreEmbedding, checkDocumentAsync } = require('../services/plagiarism');
const { extractText } = require('../services/textExtractor');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const router = express.Router();

const listSchema = z.object({
  page:    z.coerce.number().int().min(1).default(1),
  limit:   z.coerce.number().int().min(1).max(50).default(20),
  sortBy:  z.enum(['published_at','view_count','download_count','citation_count']).default('published_at'),
  sortDir: z.enum(['ASC','DESC']).default('DESC'),
  docType: z.string().optional(),
  search:  z.string().optional(),
  uploaderId: z.string().uuid().optional(),
});

// GET /documents
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const params = listSchema.parse(req.query);
    const offset = (params.page - 1) * params.limit;

    let where = ['d.deleted_at IS NULL'];
    const values = [];
    let idx = 1;

    // Visibility + publication filter
    // Unauthenticated: only published public docs
    // Authenticated: published public docs + own docs (including pending/rejected)
    if (!req.user) {
      where.push(`d.is_published = true`, `d.visibility = 'public'`);
    } else {
      where.push(`(d.is_published = true OR d.uploader_id = $${idx})`);
      where.push(`(d.visibility = 'public' OR d.uploader_id = $${idx})`);
      values.push(req.user.id); idx++;
    }

    if (params.docType) {
      where.push(`d.doc_type = $${idx}`); values.push(params.docType); idx++;
    }
    if (params.uploaderId) {
      where.push(`d.uploader_id = $${idx}`); values.push(params.uploaderId); idx++;
    }
    if (params.search) {
      where.push(`(d.title ILIKE $${idx} OR d.abstract ILIKE $${idx})`);
      values.push(`%${params.search}%`); idx++;
    }

    const whereClause = 'WHERE ' + where.join(' AND ');
    const orderClause = `ORDER BY d.${params.sortBy} ${params.sortDir} NULLS LAST`;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM documents d ${whereClause}`, values
    );
    const total = parseInt(countResult.rows[0].count);

    values.push(params.limit, offset);
    const { rows } = await pool.query(
      `SELECT d.id, d.title, d.abstract, d.doc_type, d.visibility, d.doi,
              d.view_count, d.download_count, d.citation_count, d.average_peer_rating,
              d.published_at, d.created_at, d.mime_type, d.file_size_bytes,
              u.full_name AS uploader_name, dep.name AS department_name
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploader_id
       LEFT JOIN departments dep ON dep.id = d.department_id
       ${whereClause} ${orderClause}
       LIMIT $${idx} OFFSET $${idx+1}`,
      values
    );

    res.json({
      success: true,
      data: {
        documents:  rows,
        total,
        page:       params.page,
        limit:      params.limit,
        totalPages: Math.ceil(total / params.limit),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError('Validation failed', 422, 'VALIDATION_ERROR', err.errors));
    next(err);
  }
});

// GET /documents/:id
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new AppError('Invalid document ID', 422, 'VALIDATION_ERROR');

    const { rows } = await pool.query(
      `SELECT d.*, u.full_name AS uploader_name, dep.name AS department_name,
              coalesce(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name))
                FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploader_id
       LEFT JOIN departments dep ON dep.id = d.department_id
       LEFT JOIN document_tags dt ON dt.document_id = d.id
       LEFT JOIN tags t ON t.id = dt.tag_id
       WHERE d.id = $1 AND d.deleted_at IS NULL
       GROUP BY d.id, u.full_name, dep.name`,
      [id]
    );

    if (!rows[0]) throw new AppError('Document not found', 404, 'NOT_FOUND');

    // Increment view count
    await pool.query('UPDATE documents SET view_count = view_count + 1 WHERE id = $1', [id]);

    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// GET /documents/:id/download
router.get('/:id/download', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT storage_url, download_count FROM documents WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (!rows[0]) throw new AppError('Document not found', 404, 'NOT_FOUND');
    if (!rows[0].storage_url) throw new AppError('File not available', 404, 'FILE_NOT_FOUND');

    await pool.query('UPDATE documents SET download_count = download_count + 1 WHERE id = $1', [req.params.id]);

    res.json({ success: true, data: { downloadUrl: rows[0].storage_url } });
  } catch (err) { next(err); }
});
// POST /documents — upload a new document
router.post('/', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    // Handle both JSON and FormData
    const title      = req.body.title      || req.body.get?.('title');
    const abstract   = req.body.abstract   || req.body.get?.('abstract')   || null;
    const docType    = req.body.docType    || req.body.get?.('docType')    || 'other';
    const visibility = req.body.visibility || req.body.get?.('visibility') || 'public';

    if (!title || title.trim() === '') {
      throw new AppError('Title is required', 422, 'VALIDATION_ERROR');
    }

    const { rows: [doc] } = await pool.query(
      `INSERT INTO documents
        (uploader_id, title, abstract, doc_type, visibility, is_published,
         virus_scan_status, moderation_status)
       VALUES ($1, $2, $3, $4, $5, false, 'clean', 'pending')
       RETURNING *`,
      [req.user.id, title.trim(), abstract, docType, visibility]
    );

    await pool.query(
      `INSERT INTO points_log (user_id, action_type, points, reference_table, reference_id)
       VALUES ($1, 'upload_document', 50, 'documents', $2)`,
      [req.user.id, doc.id]
    );

    await pool.query(
      `INSERT INTO reward_levels (user_id, total_points) VALUES ($1, 50)
       ON CONFLICT (user_id) DO UPDATE
       SET total_points = reward_levels.total_points + 50, last_updated = NOW()`,
      [req.user.id]
    );

    res.status(201).json({ success: true, data: doc });

    // Post-upload pipeline (after response): extract full text → stamp hash →
    // generate embedding → plagiarism check.
    setImmediate(async () => {
      try {
        // ── 1. Extract full text from uploaded file ──────────────────────────
        let fullText = '';
        if (req.file?.buffer) {
          fullText = await extractText(req.file.buffer, req.file.mimetype);
        }

        if (fullText.length > 100) {
          await pool.query(
            'UPDATE documents SET full_text = $1 WHERE id = $2',
            [fullText, doc.id]
          );
          // Auto-fill abstract if not provided
          if (!abstract) {
            await pool.query(
              `UPDATE documents SET abstract = $1
               WHERE id = $2 AND (abstract IS NULL OR abstract = '')`,
              [fullText.slice(0, 800), doc.id]
            );
          }
        }

        // ── 2. Stamp content hash (uses abstract or extracted text) ──────────
        const hashBase = abstract || fullText.slice(0, 500) || '';
        await stampHash(doc.id, title.trim(), hashBase);

        // ── 3. Generate embedding using full text when available ─────────────
        const textForEmbedding = fullText
          ? `${title.trim()} ${fullText}`.slice(0, 8000)
          : `${title.trim()} ${abstract || ''}`.trim();
        await generateAndStoreEmbedding(doc.id, textForEmbedding);

        // ── 4. Run plagiarism check ──────────────────────────────────────────
        checkDocumentAsync(doc.id);
      } catch (e) {
        // Non-fatal — plagiarism status will remain 'checking' until retried
      }
    });
  } catch (err) { next(err); }
});

module.exports = router;
