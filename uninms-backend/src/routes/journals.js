'use strict';
const path     = require('path');
const fs       = require('fs');
const express  = require('express');
const multer   = require('multer');
const { pool } = require('../config/database');
const { AppError } = require('../utils/AppError');
const { authenticate, optionalAuth, requireRole } = require('../middleware/auth');
const { checkSubmissionText } = require('../services/plagiarism');
const email = require('../services/email');

const router = express.Router();

// ── Multer — local disk storage for manuscript files ──────────────────────────
const UPLOAD_DIR = path.join(__dirname, '../../uploads/manuscripts');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const manuscriptUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename:    (_req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase() || '.pdf';
      const safe = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      cb(null, safe);
    },
  }),
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '50') * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new AppError('Only PDF and Word documents are accepted', 422, 'INVALID_FILE_TYPE'));
  },
});

// ── Helpers ────────────────────────────────────────────────────────────────────
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function nextSubmissionNo(journalId) {
  const { rows: [j] } = await pool.query('SELECT slug FROM journals WHERE id=$1', [journalId]);
  const prefix = j?.slug?.split('-').map(w => w[0]).join('').toUpperCase().slice(0, 5) || 'JNL';
  const { rows: [{ count }] } = await pool.query(
    'SELECT COUNT(*) FROM manuscripts WHERE journal_id=$1', [journalId]
  );
  return `${prefix}-${new Date().getFullYear()}-${String(parseInt(count) + 1).padStart(4, '0')}`;
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// GET /journals/admin/all — list ALL journals regardless of status (admin only)
router.get('/admin/all', authenticate, requireRole('admin','super_admin'), async (req, res, next) => {
  try {
    const { search, page = 1, limit = 100 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const isSuperAdmin = (req.user.roles || []).includes('super_admin');

    let where = [`j.deleted_at IS NULL`];
    const vals = [];
    let i = 1;

    // Admins only see their own university's journals; super_admin sees all
    if (!isSuperAdmin && req.user.university_id) {
      where.push(`j.university_id = $${i}`); vals.push(req.user.university_id); i++;
    }
    if (search) { where.push(`j.title ILIKE $${i}`); vals.push(`%${search}%`); i++; }

    const w = 'WHERE ' + where.join(' AND ');
    vals.push(parseInt(limit), offset);

    const { rows } = await pool.query(
      `SELECT j.id, j.title, j.slug, j.status, j.issn_online, j.issn_print,
              j.frequency, j.review_type, j.is_open_access, j.subjects,
              j.created_at,
              u.name AS university_name, dep.name AS department_name,
              usr.full_name AS editor_name,
              (SELECT COUNT(*) FROM manuscripts WHERE journal_id=j.id AND status='published') AS article_count
       FROM journals j
       LEFT JOIN universities u ON u.id=j.university_id
       LEFT JOIN departments dep ON dep.id=j.department_id
       LEFT JOIN users usr ON usr.id=j.editor_id
       ${w} ORDER BY j.created_at DESC
       LIMIT $${i} OFFSET $${i+1}`,
      vals
    );
    res.json({ success: true, data: { journals: rows, total: rows.length } });
  } catch (err) { next(err); }
});

// GET /journals — browse all active journals
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { search, universityId, subject, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = [`j.deleted_at IS NULL`, `j.status = 'active'`];
    const vals = [];
    let i = 1;

    if (search)       { where.push(`(j.title ILIKE $${i} OR j.description ILIKE $${i})`); vals.push(`%${search}%`); i++; }
    if (universityId) { where.push(`j.university_id = $${i}`); vals.push(universityId); i++; }
    if (subject)      { where.push(`$${i} = ANY(j.subjects)`); vals.push(subject); i++; }

    const w = 'WHERE ' + where.join(' AND ');
    const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*) FROM journals j ${w}`, vals);

    vals.push(parseInt(limit), offset);
    const { rows } = await pool.query(
      `SELECT j.id, j.title, j.slug, j.issn_online, j.issn_print, j.scope,
              j.description, j.cover_image_url, j.frequency, j.review_type,
              j.is_open_access, j.subjects, j.indexing, j.language,
              u.name AS university_name, dep.name AS department_name,
              usr.full_name AS editor_name,
              (SELECT COUNT(*) FROM manuscripts WHERE journal_id=j.id AND status='published') AS article_count,
              (SELECT COUNT(*) FROM journal_issues WHERE journal_id=j.id AND status='published') AS issue_count
       FROM journals j
       LEFT JOIN universities u ON u.id=j.university_id
       LEFT JOIN departments dep ON dep.id=j.department_id
       LEFT JOIN users usr ON usr.id=j.editor_id
       ${w} ORDER BY j.title
       LIMIT $${i} OFFSET $${i+1}`,
      vals
    );

    res.json({ success: true, data: { journals: rows, total: parseInt(count), page: parseInt(page), totalPages: Math.ceil(count/parseInt(limit)) } });
  } catch (err) { next(err); }
});

// GET /journals/my/submissions — author's own submissions (must be before /:slug)
router.get('/my/submissions', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.id, m.submission_no, m.title, m.status, m.submitted_at,
              m.decision_at, m.published_at, m.plagiarism_score,
              j.title AS journal_title, j.slug AS journal_slug,
              (SELECT recommendation FROM review_reports WHERE manuscript_id=m.id ORDER BY submitted_at DESC LIMIT 1) AS latest_recommendation,
              (SELECT letter FROM editorial_decisions WHERE manuscript_id=m.id ORDER BY created_at DESC LIMIT 1) AS latest_decision_letter
       FROM manuscripts m
       JOIN journals j ON j.id=m.journal_id
       WHERE m.author_id=$1 AND m.deleted_at IS NULL
       ORDER BY m.submitted_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /journals/reviews/assigned — reviewer assignments (must be before /:slug)
router.get('/reviews/assigned', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ra.id AS assignment_id, ra.status AS assignment_status,
              ra.due_date, ra.invited_at,
              m.id AS manuscript_id, m.submission_no, m.title, m.abstract,
              m.keywords, m.status AS manuscript_status,
              j.title AS journal_title, j.slug AS journal_slug,
              rr.id AS report_id, rr.recommendation
       FROM review_assignments ra
       JOIN manuscripts m ON m.id=ra.manuscript_id
       JOIN journals j ON j.id=m.journal_id
       LEFT JOIN review_reports rr ON rr.assignment_id=ra.id
       WHERE ra.reviewer_id=$1
       ORDER BY ra.invited_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /journals/oai — OAI-PMH endpoint (must be before /:slug)
router.get('/oai', async (req, res, next) => {
  try {
    const { verb, metadataPrefix, from, until, set } = req.query;
    const base = `${req.protocol}://${req.get('host')}/api/v1/journals/oai`;
    const now  = new Date().toISOString();

    const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${now}</responseDate>
  <request verb="${verb||''}" baseURL="${base}">${base}</request>`;

    if (verb === 'Identify') {
      return res.type('xml').send(`${xmlHeader}
  <Identify>
    <repositoryName>UniNMS Nigerian University Journals</repositoryName>
    <baseURL>${base}</baseURL>
    <protocolVersion>2.0</protocolVersion>
    <adminEmail>contact@uninms.edu.ng</adminEmail>
    <earliestDatestamp>2024-01-01</earliestDatestamp>
    <deletedRecord>no</deletedRecord>
    <granularity>YYYY-MM-DD</granularity>
  </Identify>
</OAI-PMH>`);
    }

    if (verb === 'ListMetadataFormats') {
      return res.type('xml').send(`${xmlHeader}
  <ListMetadataFormats>
    <metadataFormat>
      <metadataPrefix>oai_dc</metadataPrefix>
      <schema>http://www.openarchives.org/OAI/2.0/oai_dc.xsd</schema>
      <metadataNamespace>http://www.openarchives.org/OAI/2.0/oai_dc/</metadataNamespace>
    </metadataFormat>
  </ListMetadataFormats>
</OAI-PMH>`);
    }

    if (verb === 'ListSets') {
      const { rows: journals } = await pool.query(
        `SELECT slug, title FROM journals WHERE status='active' AND deleted_at IS NULL`
      );
      const sets = journals.map(j => `
    <set>
      <setSpec>${j.slug}</setSpec>
      <setName>${j.title}</setName>
    </set>`).join('');
      return res.type('xml').send(`${xmlHeader}<ListSets>${sets}</ListSets></OAI-PMH>`);
    }

    if (verb === 'ListRecords' || verb === 'ListIdentifiers') {
      let query = `
        SELECT m.id, m.title, m.abstract, m.keywords, m.doi, m.published_at,
               m.submission_no, j.title AS journal_title, j.slug,
               u.full_name AS author_name,
               array_agg(ma.full_name ORDER BY ma.author_order) AS all_authors
        FROM manuscripts m
        JOIN journals j ON j.id=m.journal_id
        LEFT JOIN users u ON u.id=m.author_id
        LEFT JOIN manuscript_authors ma ON ma.manuscript_id=m.id
        WHERE m.status='published' AND m.deleted_at IS NULL`;

      const qVals = [];
      if (from)  { query += ` AND m.published_at >= $${qVals.length+1}`; qVals.push(from); }
      if (until) { query += ` AND m.published_at <= $${qVals.length+1}`; qVals.push(until); }
      if (set)   { query += ` AND j.slug = $${qVals.length+1}`;  qVals.push(set); }
      query += ' GROUP BY m.id,j.title,j.slug,u.full_name,u.email ORDER BY m.published_at DESC LIMIT 100';

      const { rows } = await pool.query(query, qVals);

      const records = rows.map(r => {
        const oaiId = `oai:uninms.edu.ng:${r.slug}:${r.id}`;
        const date  = r.published_at ? new Date(r.published_at).toISOString().split('T')[0] : '2026-01-01';
        const allAuthors = (r.all_authors||[]).filter(Boolean).join('; ') || r.author_name || '';

        if (verb === 'ListIdentifiers') return `
    <header>
      <identifier>${oaiId}</identifier>
      <datestamp>${date}</datestamp>
      <setSpec>${r.slug}</setSpec>
    </header>`;

        return `
    <record>
      <header>
        <identifier>${oaiId}</identifier>
        <datestamp>${date}</datestamp>
        <setSpec>${r.slug}</setSpec>
      </header>
      <metadata>
        <oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/"
                   xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>${r.title.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</dc:title>
          ${allAuthors.split(';').map(a => `<dc:creator>${a.trim()}</dc:creator>`).join('\n          ')}
          <dc:description>${(r.abstract||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').slice(0,1000)}</dc:description>
          ${(r.keywords||[]).map(k => `<dc:subject>${k}</dc:subject>`).join('\n          ')}
          <dc:publisher>UniNMS — ${r.journal_title}</dc:publisher>
          <dc:date>${date}</dc:date>
          <dc:type>journal article</dc:type>
          <dc:format>application/pdf</dc:format>
          ${r.doi ? `<dc:identifier>https://doi.org/${r.doi}</dc:identifier>` : ''}
          <dc:source>${r.journal_title}</dc:source>
          <dc:language>en</dc:language>
        </oai_dc:dc>
      </metadata>
    </record>`;
      }).join('');

      return res.type('xml').send(`${xmlHeader}<${verb}>${records}</${verb}></OAI-PMH>`);
    }

    res.type('xml').send(`${xmlHeader}
  <error code="badVerb">Illegal OAI verb: ${verb}</error>
</OAI-PMH>`);
  } catch (err) { next(err); }
});

// GET /journals/:slug — journal homepage
router.get('/:slug', optionalAuth, async (req, res, next) => {
  try {
    const { rows: [j] } = await pool.query(
      `SELECT j.*, u.name AS university_name, dep.name AS department_name,
              usr.full_name AS editor_name, usr.email AS editor_email
       FROM journals j
       LEFT JOIN universities u ON u.id=j.university_id
       LEFT JOIN departments dep ON dep.id=j.department_id
       LEFT JOIN users usr ON usr.id=j.editor_id
       WHERE j.slug=$1 AND j.deleted_at IS NULL`, [req.params.slug]
    );
    if (!j) throw new AppError('Journal not found', 404, 'NOT_FOUND');

    // Board members
    const { rows: board } = await pool.query(
      `SELECT jb.role, jb.affiliation, jb.display_order, u.full_name, u.orcid_id
       FROM journal_board_members jb JOIN users u ON u.id=jb.user_id
       WHERE jb.journal_id=$1 ORDER BY jb.display_order`, [j.id]
    );

    // Published volumes with issues
    const { rows: volumes } = await pool.query(
      `SELECT v.id, v.volume_no, v.year,
              json_agg(json_build_object(
                'id', i.id, 'issue_no', i.issue_no, 'title', i.title,
                'published_at', i.published_at,
                'article_count', (SELECT COUNT(*) FROM manuscripts WHERE issue_id=i.id AND status='published')
              ) ORDER BY i.issue_no DESC) FILTER (WHERE i.id IS NOT NULL) AS issues
       FROM journal_volumes v
       LEFT JOIN journal_issues i ON i.volume_id=v.id AND i.status='published'
       WHERE v.journal_id=$1
       GROUP BY v.id, v.volume_no, v.year
       ORDER BY v.volume_no DESC`, [j.id]
    );

    res.json({ success: true, data: { ...j, board, volumes } });
  } catch (err) { next(err); }
});

// GET /journals/:slug/issues/:issueId/articles
router.get('/:slug/issues/:issueId/articles', optionalAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.id, m.title, m.abstract, m.keywords, m.pages, m.article_no,
              m.doi, m.published_at, m.submission_no,
              u.full_name AS author_name,
              array_agg(json_build_object(
                'name', ma.full_name, 'affiliation', ma.affiliation,
                'orcid', ma.orcid_id, 'corresponding', ma.is_corresponding
              ) ORDER BY ma.author_order) AS authors
       FROM manuscripts m
       LEFT JOIN users u ON u.id=m.author_id
       LEFT JOIN manuscript_authors ma ON ma.manuscript_id=m.id
       WHERE m.issue_id=$1 AND m.status='published' AND m.deleted_at IS NULL
       GROUP BY m.id, u.full_name
       ORDER BY m.article_no`, [req.params.issueId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /journals/:slug/articles/latest — most recently published articles
router.get('/:slug/articles/latest', optionalAuth, async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const { rows: [j] } = await pool.query(
      `SELECT id FROM journals WHERE slug=$1 AND deleted_at IS NULL`, [req.params.slug]
    );
    if (!j) throw new AppError('Journal not found', 404, 'NOT_FOUND');

    const { rows } = await pool.query(
      `SELECT m.id, m.title, m.abstract, m.keywords, m.pages, m.article_no,
              m.doi, m.published_at,
              vi.volume_no, vi.year, vi.issue_no, vi.issue_id,
              u.full_name AS author_name,
              array_agg(json_build_object(
                'name', ma.full_name, 'affiliation', ma.affiliation,
                'orcid', ma.orcid_id, 'corresponding', ma.is_corresponding
              ) ORDER BY ma.author_order) FILTER (WHERE ma.id IS NOT NULL) AS authors
       FROM manuscripts m
       LEFT JOIN users u ON u.id=m.author_id
       LEFT JOIN manuscript_authors ma ON ma.manuscript_id=m.id
       LEFT JOIN LATERAL (
         SELECT v.volume_no, v.year, i.issue_no, i.id AS issue_id
         FROM journal_issues i
         JOIN journal_volumes v ON v.id=i.volume_id
         WHERE i.id=m.issue_id
       ) vi ON true
       WHERE m.journal_id=$1 AND m.status='published' AND m.deleted_at IS NULL
       GROUP BY m.id, u.full_name, vi.volume_no, vi.year, vi.issue_no, vi.issue_id
       ORDER BY m.published_at DESC NULLS LAST
       LIMIT $2`,
      [j.id, parseInt(limit)]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /journals/:slug/articles/search — search articles within a journal
router.get('/:slug/articles/search', optionalAuth, async (req, res, next) => {
  try {
    const { q = '', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { rows: [j] } = await pool.query(
      `SELECT id FROM journals WHERE slug=$1 AND deleted_at IS NULL`, [req.params.slug]
    );
    if (!j) throw new AppError('Journal not found', 404, 'NOT_FOUND');

    const { rows } = await pool.query(
      `SELECT m.id, m.title, m.abstract, m.keywords, m.doi, m.pages,
              m.published_at, m.article_no,
              vi.volume_no, vi.year, vi.issue_no,
              u.full_name AS author_name,
              array_agg(ma.full_name ORDER BY ma.author_order) FILTER (WHERE ma.full_name IS NOT NULL) AS author_names
       FROM manuscripts m
       LEFT JOIN users u ON u.id=m.author_id
       LEFT JOIN manuscript_authors ma ON ma.manuscript_id=m.id
       LEFT JOIN LATERAL (
         SELECT v.volume_no, v.year, i.issue_no
         FROM journal_issues i JOIN journal_volumes v ON v.id=i.volume_id
         WHERE i.id=m.issue_id
       ) vi ON true
       WHERE m.journal_id=$1 AND m.status='published' AND m.deleted_at IS NULL
         AND ($2='' OR m.title ILIKE $3 OR m.abstract ILIKE $3
              OR EXISTS (SELECT 1 FROM unnest(m.keywords) k WHERE k ILIKE $3))
       GROUP BY m.id, u.full_name, vi.volume_no, vi.year, vi.issue_no
       ORDER BY m.published_at DESC NULLS LAST
       LIMIT $4 OFFSET $5`,
      [j.id, q, `%${q}%`, parseInt(limit), offset]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /journals/:slug/articles/:id — single article detail
router.get('/:slug/articles/:id', optionalAuth, async (req, res, next) => {
  try {
    const { rows: [m] } = await pool.query(
      `SELECT m.id, m.title, m.abstract, m.keywords, m.pages, m.article_no,
              m.doi, m.published_at, m.manuscript_file_url, m.submission_no,
              m.view_count, m.download_count,
              j.title AS journal_title, j.slug AS journal_slug,
              j.issn_online, j.issn_print,
              vi.volume_no, vi.year, vi.issue_no, vi.issue_id,
              u.full_name AS author_name, u.email AS author_email,
              array_agg(json_build_object(
                'name', ma.full_name, 'affiliation', ma.affiliation,
                'email', ma.email, 'orcid', ma.orcid_id,
                'corresponding', ma.is_corresponding
              ) ORDER BY ma.author_order) FILTER (WHERE ma.id IS NOT NULL) AS authors
       FROM manuscripts m
       JOIN journals j ON j.id=m.journal_id
       LEFT JOIN users u ON u.id=m.author_id
       LEFT JOIN manuscript_authors ma ON ma.manuscript_id=m.id
       LEFT JOIN LATERAL (
         SELECT v.volume_no, v.year, i.issue_no, i.id AS issue_id
         FROM journal_issues i
         JOIN journal_volumes v ON v.id=i.volume_id
         WHERE i.id=m.issue_id
       ) vi ON true
       WHERE m.id=$1 AND j.slug=$2 AND m.status='published' AND m.deleted_at IS NULL
       GROUP BY m.id, j.id, u.full_name, u.email, vi.volume_no, vi.year, vi.issue_no, vi.issue_id`,
      [req.params.id, req.params.slug]
    );
    if (!m) throw new AppError('Article not found', 404, 'NOT_FOUND');

    // Increment view count (fire-and-forget)
    pool.query(
      `UPDATE manuscripts SET view_count = COALESCE(view_count,0)+1 WHERE id=$1`, [m.id]
    ).catch(() => {});

    // Related: same journal, overlapping keywords, most recent
    const keywords = m.keywords?.slice(0, 3) ?? [];
    let related = [];
    if (keywords.length) {
      const { rows } = await pool.query(
        `SELECT m2.id, m2.title, m2.published_at,
                u2.full_name AS author_name,
                array_agg(ma2.full_name ORDER BY ma2.author_order) FILTER (WHERE ma2.full_name IS NOT NULL) AS author_names
         FROM manuscripts m2
         LEFT JOIN users u2 ON u2.id=m2.author_id
         LEFT JOIN manuscript_authors ma2 ON ma2.manuscript_id=m2.id
         WHERE m2.journal_id=(SELECT journal_id FROM manuscripts WHERE id=$1)
           AND m2.id!=$1 AND m2.status='published' AND m2.deleted_at IS NULL
           AND m2.keywords && $2
         GROUP BY m2.id, u2.full_name
         ORDER BY m2.published_at DESC NULLS LAST LIMIT 5`,
        [m.id, keywords]
      );
      related = rows;
    }

    res.json({ success: true, data: { ...m, related } });
  } catch (err) { next(err); }
});

// POST /journals/:slug/articles/:id/download — increment download count
router.post('/:slug/articles/:id/download', optionalAuth, async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE manuscripts SET download_count = COALESCE(download_count,0)+1 WHERE id=$1`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /journals/subjects — distinct subjects across all active journals
router.get('/subjects/list', optionalAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT unnest(subjects) AS subject
       FROM journals WHERE status='active' AND deleted_at IS NULL AND subjects IS NOT NULL
       ORDER BY 1`
    );
    res.json({ success: true, data: rows.map(r => r.subject) });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
//  AUTHOR ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// POST /journals/:slug/submit/upload — upload manuscript file, returns URL
router.post('/:slug/submit/upload', authenticate, manuscriptUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError('No file uploaded', 422, 'VALIDATION_ERROR');
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/manuscripts/${req.file.filename}`;
    res.json({ success: true, data: { url: fileUrl, filename: req.file.originalname } });
  } catch (err) { next(err); }
});

// POST /journals/:slug/submit — submit a manuscript
router.post('/:slug/submit', authenticate, async (req, res, next) => {
  try {
    const { rows: [j] } = await pool.query(
      `SELECT id, status FROM journals WHERE slug=$1 AND deleted_at IS NULL`, [req.params.slug]
    );
    if (!j) throw new AppError('Journal not found', 404, 'NOT_FOUND');
    if (j.status !== 'active') throw new AppError('Journal is not accepting submissions', 403, 'NOT_ACCEPTING');

    const { title, abstract, keywords, coverLetter, coAuthors, manuscriptFileUrl } = req.body;
    if (!title || !abstract) throw new AppError('Title and abstract are required', 422, 'VALIDATION_ERROR');

    const submissionNo = await nextSubmissionNo(j.id);

    const { rows: [ms] } = await pool.query(
      `INSERT INTO manuscripts
         (journal_id, author_id, title, abstract, keywords, cover_letter,
          manuscript_file_url, status, submission_no)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'submitted',$8) RETURNING *`,
      [j.id, req.user.id, title, abstract,
       keywords ? (Array.isArray(keywords) ? keywords : keywords.split(',').map(k => k.trim())) : [],
       coverLetter || null, manuscriptFileUrl || null, submissionNo]
    );

    // Insert co-authors
    if (coAuthors?.length) {
      for (const [idx, ca] of coAuthors.entries()) {
        await pool.query(
          `INSERT INTO manuscript_authors (manuscript_id, full_name, email, affiliation, orcid_id, is_corresponding, author_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [ms.id, ca.fullName, ca.email||null, ca.affiliation||null, ca.orcidId||null, ca.isCorresponding||false, idx+1]
        );
      }
    }

    // Award 30 points for submission
    await pool.query(
      `INSERT INTO points_log (user_id, action_type, points, reference_table, reference_id)
       VALUES ($1,'journal_submission',30,'manuscripts',$2)`,
      [req.user.id, ms.id]
    );

    // Async: plagiarism check + submission email — do not block the response
    setImmediate(async () => {
      try {
        const text = `${title}\n\n${abstract}`;
        const result = await checkSubmissionText(text);
        await pool.query(
          `UPDATE manuscripts SET plagiarism_score=$1, plagiarism_status=$2, updated_at=NOW() WHERE id=$3`,
          [result.overallScore, result.status, ms.id]
        );
      } catch (_) {}

      try {
        const { rows: [jInfo] } = await pool.query(
          `SELECT j.title AS journal_title FROM journals j WHERE j.id=$1`, [j.id]
        );
        await email.manuscriptReceived({
          to:               req.user.email,
          authorName:       req.user.fullName || req.user.full_name || 'Author',
          manuscriptTitle:  title,
          submissionNo,
          journalTitle:     jInfo?.journal_title || 'the journal',
        });
      } catch (_) {}
    });

    res.status(201).json({ success: true, data: ms, message: `Manuscript submitted. Reference: ${submissionNo}` });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
//  EDITOR ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * isEditor — journal-scoped guard.
 *
 * admin / super_admin: always pass through.
 * journal_editor: must have an explicit assignment in journal_editors
 *                 for the journal identified by req.params.slug.
 */
const isEditor = async (req, res, next) => {
  try {
    const roles = req.user?.roles || [];
    if (roles.some(r => ['admin', 'super_admin'].includes(r))) return next();

    if (!roles.includes('journal_editor')) {
      return next(new AppError('Editor access required', 403, 'FORBIDDEN'));
    }

    // Verify this editor is assigned to THIS journal
    const slug = req.params.slug;
    if (!slug) return next(new AppError('Journal slug required', 400, 'BAD_REQUEST'));

    const { rows: [assignment] } = await pool.query(
      `SELECT je.id
       FROM journal_editors je
       JOIN journals j ON j.id = je.journal_id
       WHERE j.slug = $1 AND je.user_id = $2 AND j.deleted_at IS NULL`,
      [slug, req.user.id]
    );

    if (!assignment) {
      return next(new AppError('You are not assigned as editor for this journal', 403, 'FORBIDDEN'));
    }

    next();
  } catch (err) { next(err); }
};

// GET /journals/:slug/editor/manuscripts
router.get('/:slug/editor/manuscripts', authenticate, isEditor, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const { rows: [j] } = await pool.query('SELECT id FROM journals WHERE slug=$1', [req.params.slug]);
    if (!j) throw new AppError('Journal not found', 404, 'NOT_FOUND');

    let where = ['m.journal_id=$1', 'm.deleted_at IS NULL'];
    const vals = [j.id];
    let i = 2;
    if (status) { where.push(`m.status=$${i}`); vals.push(status); i++; }

    vals.push(parseInt(limit), (parseInt(page)-1)*parseInt(limit));
    const { rows } = await pool.query(
      `SELECT m.id, m.submission_no, m.title, m.status, m.submitted_at,
              m.plagiarism_score, m.plagiarism_status,
              u.full_name AS author_name, u.email AS author_email,
              COUNT(DISTINCT ra.id) AS reviewer_count,
              COUNT(DISTINCT rr.id) AS review_count
       FROM manuscripts m
       LEFT JOIN users u ON u.id=m.author_id
       LEFT JOIN review_assignments ra ON ra.manuscript_id=m.id AND ra.status NOT IN ('declined')
       LEFT JOIN review_reports rr ON rr.manuscript_id=m.id
       WHERE ${where.join(' AND ')}
       GROUP BY m.id, u.full_name, u.email
       ORDER BY m.submitted_at DESC
       LIMIT $${i} OFFSET $${i+1}`,
      vals
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// PATCH /journals/:slug/editor/manuscripts/:id/status — move manuscript status (e.g. submitted → with_editor)
router.patch('/:slug/editor/manuscripts/:id/status', authenticate, isEditor, async (req, res, next) => {
  try {
    const { status } = req.body;
    const valid = ['with_editor','under_review','revision_requested','resubmitted','accepted','rejected','withdrawn'];
    if (!valid.includes(status)) throw new AppError('Invalid status', 422, 'VALIDATION_ERROR');
    await pool.query(
      `UPDATE manuscripts SET status=$1, updated_at=NOW() WHERE id=$2`,
      [status, req.params.id]
    );
    res.json({ success: true, message: `Status updated to ${status}` });
  } catch (err) { next(err); }
});

// GET /journals/:slug/editor/users — list users in same university for reviewer selection
router.get('/:slug/editor/users', authenticate, isEditor, async (req, res, next) => {
  try {
    const { search = '', role = 'reviewer' } = req.query;
    const { rows: [j] } = await pool.query('SELECT university_id FROM journals WHERE slug=$1', [req.params.slug]);
    if (!j) throw new AppError('Journal not found', 404, 'NOT_FOUND');

    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email,
              dep.name AS department_name,
              array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) AS roles
       FROM users u
       LEFT JOIN departments dep ON dep.id=u.department_id
       LEFT JOIN user_roles ur ON ur.user_id=u.id
       LEFT JOIN roles r ON r.id=ur.role_id
       WHERE u.deleted_at IS NULL AND u.status='active'
         AND ($1='' OR u.university_id=$2::uuid)
         AND (u.full_name ILIKE $3 OR u.email ILIKE $3)
       GROUP BY u.id, dep.name
       ORDER BY u.full_name
       LIMIT 30`,
      [j.university_id||'', j.university_id, `%${search}%`]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /journals/:slug/editor/manuscripts/:id/assign — assign reviewer
router.post('/:slug/editor/manuscripts/:id/assign', authenticate, isEditor, async (req, res, next) => {
  try {
    const { reviewerId, dueDate } = req.body;
    if (!reviewerId) throw new AppError('Reviewer ID required', 422, 'VALIDATION_ERROR');

    // Check reviewer not already assigned
    const dup = await pool.query(
      `SELECT id FROM review_assignments WHERE manuscript_id=$1 AND reviewer_id=$2 AND status!='declined'`,
      [req.params.id, reviewerId]
    );
    if (dup.rows[0]) throw new AppError('Reviewer already assigned', 409, 'CONFLICT');

    const { rows: [assignment] } = await pool.query(
      `INSERT INTO review_assignments (manuscript_id, reviewer_id, assigned_by, due_date, status)
       VALUES ($1,$2,$3,$4,'invited') RETURNING *`,
      [req.params.id, reviewerId, req.user.id, dueDate || null]
    );

    // Move manuscript to 'under_review' if not already
    await pool.query(
      `UPDATE manuscripts SET status='under_review', updated_at=NOW()
       WHERE id=$1 AND status='with_editor'`,
      [req.params.id]
    );

    // Send reviewer invitation email (non-blocking)
    setImmediate(async () => {
      try {
        const { rows: [info] } = await pool.query(
          `SELECT u.email, u.full_name, m.title AS manuscript_title, j.title AS journal_title
           FROM review_assignments ra
           JOIN users u ON u.id=ra.reviewer_id
           JOIN manuscripts m ON m.id=ra.manuscript_id
           JOIN journals j ON j.id=m.journal_id
           WHERE ra.id=$1`, [assignment.id]
        );
        if (info) {
          await email.reviewerInvited({
            to:              info.email,
            reviewerName:    info.full_name,
            manuscriptTitle: info.manuscript_title,
            journalTitle:    info.journal_title,
            dueDate:         dueDate || null,
          });
        }
      } catch (_) {}
    });

    res.status(201).json({ success: true, data: assignment });
  } catch (err) { next(err); }
});

// POST /journals/:slug/editor/manuscripts/:id/decide — editorial decision
router.post('/:slug/editor/manuscripts/:id/decide', authenticate, isEditor, async (req, res, next) => {
  try {
    const { decision, letter, revisionDue, issueId } = req.body;
    const validDecisions = ['accept','minor_revision','major_revision','reject'];
    if (!validDecisions.includes(decision)) throw new AppError('Invalid decision', 422, 'VALIDATION_ERROR');

    await pool.query(
      `INSERT INTO editorial_decisions (manuscript_id, editor_id, decision, letter, revision_due)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.params.id, req.user.id, decision, letter||null, revisionDue||null]
    );

    const statusMap = {
      accept: 'accepted', minor_revision: 'revision_requested',
      major_revision: 'revision_requested', reject: 'rejected',
    };

    const newStatus = statusMap[decision];

    await pool.query(
      `UPDATE manuscripts SET status=$1, decision_at=NOW(), ${issueId?'issue_id=$3,':''} updated_at=NOW()
       WHERE id=$2`,
      issueId ? [newStatus, req.params.id, issueId] : [newStatus, req.params.id]
    );

    // Send editorial decision email to author (non-blocking)
    setImmediate(async () => {
      try {
        const { rows: [info] } = await pool.query(
          `SELECT u.email, u.full_name, m.title AS manuscript_title, j.title AS journal_title
           FROM manuscripts m
           JOIN users u ON u.id=m.author_id
           JOIN journals j ON j.id=m.journal_id
           WHERE m.id=$1`, [req.params.id]
        );
        if (info) {
          await email.editorialDecision({
            to:              info.email,
            authorName:      info.full_name,
            manuscriptTitle: info.manuscript_title,
            journalTitle:    info.journal_title,
            decision,
            letter:          letter || null,
          });
        }
      } catch (_) {}
    });

    res.json({ success: true, message: `Decision recorded: ${decision}` });
  } catch (err) { next(err); }
});

// POST /journals/:slug/editor/manuscripts/:id/publish — publish accepted manuscript
router.post('/:slug/editor/manuscripts/:id/publish', authenticate, isEditor, async (req, res, next) => {
  try {
    const { doi, pages, issueId } = req.body;

    // Assign to issue if provided (override whatever was set at decision time)
    if (issueId) {
      await pool.query(`UPDATE manuscripts SET issue_id=$1 WHERE id=$2`, [issueId, req.params.id]);
    }

    const { rows: [ms] } = await pool.query(
      `SELECT * FROM manuscripts WHERE id=$1 AND status='accepted'`, [req.params.id]
    );
    if (!ms) throw new AppError('Manuscript not found or not in accepted status', 404, 'NOT_FOUND');

    // Get next article number for issue
    const { rows: [{ max_no }] } = await pool.query(
      `SELECT COALESCE(MAX(article_no), 0) AS max_no FROM manuscripts WHERE issue_id=$1`,
      [ms.issue_id]
    );

    // Auto-create a document record in the main repository
    const { rows: [doc] } = await pool.query(
      `INSERT INTO documents
         (uploader_id, title, abstract, doc_type, visibility, is_published,
          doi, published_at, virus_scan_status, plagiarism_status)
       VALUES ($1,$2,$3,'research_paper','public',true,$4,NOW(),'clean','clean')
       RETURNING id`,
      [ms.author_id, ms.title, ms.abstract, doi||null]
    );

    // Tag with keywords
    if (ms.keywords?.length) {
      for (const kw of ms.keywords) {
        const { rows: [tag] } = await pool.query(
          `INSERT INTO tags(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
          [kw.toLowerCase().trim()]
        );
        await pool.query(
          `INSERT INTO document_tags(document_id,tag_id,auto_tagged) VALUES($1,$2,true) ON CONFLICT DO NOTHING`,
          [doc.id, tag.id]
        );
      }
    }

    await pool.query(
      `UPDATE manuscripts SET status='published', doi=$1, pages=$2,
         article_no=$3, published_at=NOW(), document_id=$4, updated_at=NOW()
       WHERE id=$5`,
      [doi||null, pages||null, parseInt(max_no)+1, doc.id, ms.id]
    );

    // Award publication points to author
    await pool.query(
      `INSERT INTO points_log(user_id,action_type,points,reference_table,reference_id)
       VALUES($1,'upload_document',50,'manuscripts',$2)`,
      [ms.author_id, ms.id]
    );

    // Send published notification email to author (non-blocking)
    setImmediate(async () => {
      try {
        const { rows: [info] } = await pool.query(
          `SELECT u.email, u.full_name, j.title AS journal_title, j.slug AS journal_slug
           FROM manuscripts m
           JOIN users u ON u.id=m.author_id
           JOIN journals j ON j.id=m.journal_id
           WHERE m.id=$1`, [ms.id]
        );
        if (info) {
          await email.manuscriptPublished({
            to:              info.email,
            authorName:      info.full_name,
            manuscriptTitle: ms.title,
            journalTitle:    info.journal_title,
            journalSlug:     info.journal_slug,
            doi:             doi || null,
          });
        }
      } catch (_) {}
    });

    res.json({ success: true, message: 'Manuscript published and added to repository' });
  } catch (err) { next(err); }
});

// PATCH /journals/:slug/editor/settings — update submission guidelines & author instructions
router.patch('/:slug/editor/settings', authenticate, isEditor, async (req, res, next) => {
  try {
    const { submissionGuidelines, authorInstructions } = req.body;
    const { rows: [j] } = await pool.query(
      `SELECT id FROM journals WHERE slug=$1 AND deleted_at IS NULL`, [req.params.slug]
    );
    if (!j) throw new AppError('Journal not found', 404, 'NOT_FOUND');

    await pool.query(
      `UPDATE journals
       SET submission_guidelines = COALESCE($1, submission_guidelines),
           author_instructions   = COALESCE($2, author_instructions),
           updated_at = NOW()
       WHERE id = $3`,
      [submissionGuidelines ?? null, authorInstructions ?? null, j.id]
    );
    res.json({ success: true, message: 'Journal settings updated' });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
//  REVIEWER ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// PATCH /journals/reviews/:assignmentId/respond — accept or decline invitation
router.patch('/reviews/:assignmentId/respond', authenticate, async (req, res, next) => {
  try {
    const { response } = req.body; // 'accepted' | 'declined'
    if (!['accepted','declined'].includes(response)) throw new AppError('Response must be accepted or declined', 422, 'VALIDATION_ERROR');

    await pool.query(
      `UPDATE review_assignments SET status=$1, responded_at=NOW() WHERE id=$2 AND reviewer_id=$3`,
      [response, req.params.assignmentId, req.user.id]
    );
    res.json({ success: true, message: `Review invitation ${response}` });
  } catch (err) { next(err); }
});

// POST /journals/reviews/:assignmentId/report — submit review report
router.post('/reviews/:assignmentId/report', authenticate, async (req, res, next) => {
  try {
    const {
      recommendation, commentsToEditor, commentsToAuthor,
      originalityScore, methodologyScore, clarityScore, significanceScore, overallScore,
    } = req.body;

    const { rows: [assignment] } = await pool.query(
      `SELECT * FROM review_assignments WHERE id=$1 AND reviewer_id=$2`,
      [req.params.assignmentId, req.user.id]
    );
    if (!assignment) throw new AppError('Assignment not found', 404, 'NOT_FOUND');

    await pool.query(
      `INSERT INTO review_reports
         (assignment_id, manuscript_id, reviewer_id, recommendation,
          comments_to_editor, comments_to_author,
          originality_score, methodology_score, clarity_score, significance_score, overall_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [assignment.id, assignment.manuscript_id, req.user.id, recommendation,
       commentsToEditor||null, commentsToAuthor||null,
       originalityScore||null, methodologyScore||null, clarityScore||null,
       significanceScore||null, overallScore||null]
    );

    await pool.query(
      `UPDATE review_assignments SET status='completed', completed_at=NOW() WHERE id=$1`,
      [req.params.assignmentId]
    );

    // Award reviewer points
    await pool.query(
      `INSERT INTO points_log(user_id,action_type,points,reference_table,reference_id)
       VALUES($1,'peer_review_written',30,'review_assignments',$2)`,
      [req.user.id, req.params.assignmentId]
    );

    res.json({ success: true, message: 'Review report submitted' });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
//  JOURNAL MANAGEMENT (Admin / Editor)
// ═══════════════════════════════════════════════════════════════

// POST /journals — create a new journal (IT admin or super_admin)
router.post('/', authenticate, requireRole('admin','super_admin'), async (req, res, next) => {
  try {
    const { title, departmentId, editorId, issn_print, issn_online, scope,
            description, frequency, reviewType, isOpenAccess, language, subjects,
            universityId } = req.body;

    if (!title) throw new AppError('Title is required', 422, 'VALIDATION_ERROR');

    const isSuperAdmin = (req.user.roles || []).includes('super_admin');
    const uniId = universityId || req.user.university_id || null;

    // super_admin bypasses subscription check; admin must have journals feature
    if (!isSuperAdmin) {
      if (!uniId) throw new AppError('No university associated with your account', 403, 'NO_UNIVERSITY');
      const { rows: [sub] } = await pool.query(
        `SELECT features FROM institution_subscriptions WHERE university_id = $1`,
        [uniId]
      );
      if (!sub) throw new AppError('University has no active subscription', 403, 'NO_SUBSCRIPTION');
      if (!sub.features?.journals) {
        throw new AppError('Journal hosting is not enabled for your institution', 403, 'FEATURE_NOT_AVAILABLE');
      }
    }

    const slug = slugify(title);

    const { rows: [j] } = await pool.query(
      `INSERT INTO journals
         (university_id, department_id, editor_id, title, slug,
          issn_print, issn_online, scope, description, frequency,
          review_type, is_open_access, language, subjects, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending')
       RETURNING *`,
      [uniId, departmentId||null, editorId||null,
       title, slug, issn_print||null, issn_online||null, scope||null, description||null,
       frequency||'biannual', reviewType||'double_blind', isOpenAccess!==false, language||'English',
       subjects||[]]
    );

    res.status(201).json({ success: true, data: j });
  } catch (err) { next(err); }
});

// PATCH /journals/:slug — update journal
router.patch('/:slug', authenticate, isEditor, async (req, res, next) => {
  try {
    const fields = ['title','scope','description','frequency','review_type',
                    'is_open_access','language','subjects','indexing','issn_print','issn_online',
                    'cover_image_url','website_url','status'];
    const updates = [], vals = [];
    let i = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) { updates.push(`${f}=$${i++}`); vals.push(req.body[f]); }
    }
    if (!updates.length) throw new AppError('Nothing to update', 400, 'NO_CHANGES');
    vals.push(req.params.slug);
    const { rows: [j] } = await pool.query(
      `UPDATE journals SET ${updates.join(',')},updated_at=NOW() WHERE slug=$${i} AND deleted_at IS NULL RETURNING *`,
      vals
    );
    res.json({ success: true, data: j });
  } catch (err) { next(err); }
});

// POST /journals/:slug/volumes — create volume
router.post('/:slug/volumes', authenticate, isEditor, async (req, res, next) => {
  try {
    const { volumeNo, year } = req.body;
    const { rows: [j] } = await pool.query('SELECT id FROM journals WHERE slug=$1', [req.params.slug]);
    const { rows: [v] } = await pool.query(
      `INSERT INTO journal_volumes(journal_id,volume_no,year) VALUES($1,$2,$3) RETURNING *`,
      [j.id, volumeNo, year]
    );
    res.status(201).json({ success: true, data: v });
  } catch (err) { next(err); }
});

// POST /journals/:slug/volumes/:volumeId/issues — create issue
router.post('/:slug/volumes/:volumeId/issues', authenticate, isEditor, async (req, res, next) => {
  try {
    const { issueNo, title } = req.body;
    const { rows: [j] } = await pool.query('SELECT id FROM journals WHERE slug=$1', [req.params.slug]);
    const { rows: [issue] } = await pool.query(
      `INSERT INTO journal_issues(volume_id,journal_id,issue_no,title,status)
       VALUES($1,$2,$3,$4,'open') RETURNING *`,
      [req.params.volumeId, j.id, issueNo, title||null]
    );
    res.status(201).json({ success: true, data: issue });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
//  EDITORIAL BOARD
// ═══════════════════════════════════════════════════════════════

// GET /journals/:slug/board — list board members
router.get('/:slug/board', authenticate, isEditor, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT jb.id, jb.role, jb.affiliation, jb.display_order,
              u.id AS user_id, u.full_name, u.email, u.orcid_id,
              dep.name AS department_name
       FROM journal_board_members jb
       JOIN users u ON u.id = jb.user_id
       LEFT JOIN departments dep ON dep.id = u.department_id
       JOIN journals j ON j.id = jb.journal_id
       WHERE j.slug = $1
       ORDER BY jb.display_order, jb.created_at`,
      [req.params.slug]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /journals/:slug/board — add board member
router.post('/:slug/board', authenticate, isEditor, async (req, res, next) => {
  try {
    const { userId, role, affiliation, displayOrder } = req.body;
    if (!userId || !role) throw new AppError('userId and role are required', 422, 'VALIDATION_ERROR');

    const { rows: [j] } = await pool.query(
      'SELECT id FROM journals WHERE slug=$1 AND deleted_at IS NULL', [req.params.slug]
    );
    if (!j) throw new AppError('Journal not found', 404, 'NOT_FOUND');

    const { rows: [member] } = await pool.query(
      `INSERT INTO journal_board_members (journal_id, user_id, role, affiliation, display_order)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [j.id, userId, role, affiliation||null, displayOrder||0]
    );
    res.status(201).json({ success: true, data: member });
  } catch (err) { next(err); }
});

// DELETE /journals/:slug/board/:memberId — remove board member
router.delete('/:slug/board/:memberId', authenticate, isEditor, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM journal_board_members WHERE id=$1', [req.params.memberId]);
    res.json({ success: true, message: 'Board member removed' });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
//  JOURNAL EDITOR ASSIGNMENT  (IT Admin only)
// ═══════════════════════════════════════════════════════════════

// GET /journals/:slug/editors — list assigned editors for a journal
router.get('/:slug/editors', authenticate, requireRole('admin','super_admin'), async (req, res, next) => {
  try {
    const { rows: [j] } = await pool.query(
      'SELECT id FROM journals WHERE slug=$1 AND deleted_at IS NULL', [req.params.slug]
    );
    if (!j) throw new AppError('Journal not found', 404, 'NOT_FOUND');

    const { rows } = await pool.query(
      `SELECT je.id, je.granted_at,
              u.id AS user_id, u.full_name, u.email,
              dep.name AS department_name,
              g.full_name AS granted_by_name
       FROM journal_editors je
       JOIN users u ON u.id = je.user_id
       LEFT JOIN departments dep ON dep.id = u.department_id
       LEFT JOIN users g ON g.id = je.granted_by
       WHERE je.journal_id = $1
       ORDER BY je.granted_at`,
      [j.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /journals/:slug/editors — assign a user as journal editor
router.post('/:slug/editors', authenticate, requireRole('admin','super_admin'), async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) throw new AppError('userId is required', 422, 'VALIDATION_ERROR');

    const { rows: [j] } = await pool.query(
      'SELECT id, title FROM journals WHERE slug=$1 AND deleted_at IS NULL', [req.params.slug]
    );
    if (!j) throw new AppError('Journal not found', 404, 'NOT_FOUND');

    const { rows: [u] } = await pool.query(
      'SELECT id, full_name, email FROM users WHERE id=$1 AND deleted_at IS NULL', [userId]
    );
    if (!u) throw new AppError('User not found', 404, 'NOT_FOUND');

    // Add to journal_editors
    const { rows: [assignment] } = await pool.query(
      `INSERT INTO journal_editors (journal_id, user_id, granted_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (journal_id, user_id) DO UPDATE SET granted_by=$3, granted_at=NOW()
       RETURNING *`,
      [j.id, userId, req.user.id]
    );

    // Grant journal_editor role if not already held
    const { rows: [role] } = await pool.query(
      'SELECT id FROM roles WHERE name=$1', ['journal_editor']
    );
    if (role) {
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, role.id]
      );
    }

    // Update journals.editor_id if currently unset (primary editor shortcut)
    await pool.query(
      `UPDATE journals SET editor_id = $1, updated_at = NOW()
       WHERE id = $2 AND editor_id IS NULL`,
      [userId, j.id]
    );

    res.status(201).json({
      success: true,
      data: { ...assignment, user_name: u.full_name, user_email: u.email },
      message: `${u.full_name} assigned as editor for "${j.title}"`,
    });
  } catch (err) { next(err); }
});

// DELETE /journals/:slug/editors/:userId — remove a journal editor
router.delete('/:slug/editors/:userId', authenticate, requireRole('admin','super_admin'), async (req, res, next) => {
  try {
    const { rows: [j] } = await pool.query(
      'SELECT id FROM journals WHERE slug=$1 AND deleted_at IS NULL', [req.params.slug]
    );
    if (!j) throw new AppError('Journal not found', 404, 'NOT_FOUND');

    await pool.query(
      'DELETE FROM journal_editors WHERE journal_id=$1 AND user_id=$2',
      [j.id, req.params.userId]
    );

    // If the user no longer edits ANY journal, revoke the journal_editor role
    const { rows: [remaining] } = await pool.query(
      'SELECT COUNT(*) FROM journal_editors WHERE user_id=$1',
      [req.params.userId]
    );
    if (parseInt(remaining.count) === 0) {
      const { rows: [role] } = await pool.query('SELECT id FROM roles WHERE name=$1', ['journal_editor']);
      if (role) {
        await pool.query('DELETE FROM user_roles WHERE user_id=$1 AND role_id=$2', [req.params.userId, role.id]);
      }
    }

    // Clear editor_id on the journal if it points to this user
    await pool.query(
      `UPDATE journals SET editor_id = NULL, updated_at = NOW()
       WHERE id = $1 AND editor_id = $2`,
      [j.id, req.params.userId]
    );

    res.json({ success: true, message: 'Editor removed' });
  } catch (err) { next(err); }
});

// GET /journals/editor/my-journals — list journals the current user is assigned to edit
router.get('/editor/my-journals', authenticate, async (req, res, next) => {
  try {
    const roles = req.user?.roles || [];
    if (!roles.some(r => ['journal_editor','admin','super_admin'].includes(r))) {
      throw new AppError('Editor access required', 403, 'FORBIDDEN');
    }

    let rows;
    if (roles.some(r => ['admin','super_admin'].includes(r))) {
      // Admins see all journals of their university (or all if super_admin)
      const { rows: r2 } = await pool.query(
        `SELECT j.id, j.slug, j.title, j.status, j.frequency, j.review_type,
                j.is_open_access, j.issn_online,
                u.name AS university_name,
                (SELECT COUNT(*) FROM manuscripts WHERE journal_id=j.id AND status='submitted') AS new_count,
                (SELECT COUNT(*) FROM manuscripts WHERE journal_id=j.id AND status NOT IN ('published','withdrawn','rejected')) AS active_count,
                (SELECT COUNT(*) FROM manuscripts WHERE journal_id=j.id AND status='published') AS published_count
         FROM journals j
         LEFT JOIN universities u ON u.id=j.university_id
         WHERE j.deleted_at IS NULL
           AND ($1 OR j.university_id=$2)
         ORDER BY j.title`,
        [roles.includes('super_admin'), req.user.university_id]
      );
      rows = r2;
    } else {
      // journal_editor: only assigned journals
      const { rows: r2 } = await pool.query(
        `SELECT j.id, j.slug, j.title, j.status, j.frequency, j.review_type,
                j.is_open_access, j.issn_online,
                u.name AS university_name,
                je.granted_at,
                (SELECT COUNT(*) FROM manuscripts WHERE journal_id=j.id AND status='submitted') AS new_count,
                (SELECT COUNT(*) FROM manuscripts WHERE journal_id=j.id AND status NOT IN ('published','withdrawn','rejected')) AS active_count,
                (SELECT COUNT(*) FROM manuscripts WHERE journal_id=j.id AND status='published') AS published_count
         FROM journal_editors je
         JOIN journals j ON j.id=je.journal_id
         LEFT JOIN universities u ON u.id=j.university_id
         WHERE je.user_id=$1 AND j.deleted_at IS NULL
         ORDER BY j.title`,
        [req.user.id]
      );
      rows = r2;
    }

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// (OAI-PMH endpoint is registered earlier, before /:slug routes)

module.exports = router;
