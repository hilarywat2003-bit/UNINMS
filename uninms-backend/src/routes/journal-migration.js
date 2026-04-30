'use strict';
const express  = require('express');
const xml2js   = require('xml2js');
const { pool } = require('../config/database');
const { AppError } = require('../utils/AppError');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── OAI-PMH helpers ───────────────────────────────────────────────────────────

const OAI_URL_PATTERNS = [
  (base) => `${base}?verb=Identify`,
  (base) => `${base.replace(/\/?$/, '')}/oai?verb=Identify`,
  (base) => `${base.replace(/\/?$/, '')}/index.php/index/oai?verb=Identify`,
  (base) => `${base.replace(/\/?$/, '')}/oai/request?verb=Identify`,
  (base) => `${base.replace(/\/?$/, '')}/oai2?verb=Identify`,
];

async function fetchXml(url, timeoutMs = 12000) {
  const { default: fetch } = await import('node-fetch');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'UniNMS-Harvester/1.0 (journal migration probe)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function parseXml(text) {
  return xml2js.parseStringPromise(text, { explicitArray: true, trim: true });
}

async function probeOaiPmh(baseUrl) {
  for (const pattern of OAI_URL_PATTERNS) {
    const url = pattern(baseUrl);
    try {
      const text = await fetchXml(url, 10000);
      if (!text.includes('OAI-PMH')) continue;

      const parsed  = await parseXml(text);
      const oaiRoot = parsed['OAI-PMH'];
      if (!oaiRoot?.Identify) continue;

      const identify   = oaiRoot.Identify[0];
      const oaiBaseUrl = url.split('?')[0];

      // Count available records
      let articleCount = 0;
      try {
        const listUrl  = `${oaiBaseUrl}?verb=ListIdentifiers&metadataPrefix=oai_dc`;
        const listText = await fetchXml(listUrl, 15000);
        const listParsed = await parseXml(listText);
        const listBlock  = listParsed['OAI-PMH']?.ListIdentifiers?.[0];

        if (listBlock?.resumptionToken?.[0]?.$?.completeListSize) {
          articleCount = parseInt(listBlock.resumptionToken[0].$.completeListSize) || 0;
        } else if (listBlock?.header) {
          articleCount = listBlock.header.length;
        }
      } catch {}

      return {
        success:           true,
        oai_pmh_url:       oaiBaseUrl,
        repository_name:   identify.repositoryName?.[0] || '',
        admin_email:       identify.adminEmail?.[0]    || '',
        protocol_version:  identify.protocolVersion?.[0] || '2.0',
        earliest_datestamp:identify.earliestDatestamp?.[0] || null,
        article_count:     articleCount,
      };
    } catch {}
  }

  return { success: false, oai_pmh_url: null, article_count: 0,
           message: 'No OAI-PMH endpoint detected. Manual import available.' };
}

// ── Submit migration request (IT admin) ───────────────────────────────────────
router.post('/', authenticate, requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const {
      journalTitle, existingUrl, oaiPmhUrl, platform,
      contactName, contactEmail, issnPrint, issnOnline, scope, notes,
    } = req.body;

    if (!journalTitle?.trim()) throw new AppError('Journal title is required', 422, 'VALIDATION_ERROR');
    if (!existingUrl?.trim())  throw new AppError('Existing URL is required', 422, 'VALIDATION_ERROR');

    const { rows: [ui] } = await pool.query(
      'SELECT university_id FROM users WHERE id=$1', [req.user.id]
    );

    const { rows: [entry] } = await pool.query(
      `INSERT INTO journal_migration_requests
         (university_id, submitted_by, journal_title, existing_url, oai_pmh_url, platform,
          contact_name, contact_email, issn_print, issn_online, scope, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [ui?.university_id, req.user.id, journalTitle.trim(), existingUrl.trim(),
       oaiPmhUrl?.trim()||null, platform||'unknown',
       contactName?.trim()||null, contactEmail?.trim()||null,
       issnPrint?.trim()||null, issnOnline?.trim()||null,
       scope?.trim()||null, notes?.trim()||null]
    );

    res.status(201).json({
      success: true,
      data:    entry,
      message: 'Migration request submitted. The UniNMS team will probe your journal URL and contact you.',
    });
  } catch (err) { next(err); }
});

// ── List requests ─────────────────────────────────────────────────────────────
router.get('/', authenticate, requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const isSA = req.user.roles?.includes('super_admin');
    let rows;

    if (isSA) {
      ({ rows } = await pool.query(
        `SELECT r.*, u.name AS university_name,
                s.full_name AS submitted_by_name, s.email AS submitted_by_email
         FROM journal_migration_requests r
         LEFT JOIN universities u ON u.id=r.university_id
         LEFT JOIN users s        ON s.id=r.submitted_by
         ORDER BY r.created_at DESC`
      ));
    } else {
      const { rows: [ui] } = await pool.query(
        'SELECT university_id FROM users WHERE id=$1', [req.user.id]
      );
      ({ rows } = await pool.query(
        `SELECT r.*, u.name AS university_name,
                s.full_name AS submitted_by_name, s.email AS submitted_by_email
         FROM journal_migration_requests r
         LEFT JOIN universities u ON u.id=r.university_id
         LEFT JOIN users s        ON s.id=r.submitted_by
         WHERE r.university_id=$1
         ORDER BY r.created_at DESC`,
        [ui?.university_id]
      ));
    }

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── Get single request ────────────────────────────────────────────────────────
router.get('/:id', authenticate, requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const { rows: [r] } = await pool.query(
      `SELECT r.*, u.name AS university_name, s.full_name AS submitted_by_name
       FROM journal_migration_requests r
       LEFT JOIN universities u ON u.id=r.university_id
       LEFT JOIN users s        ON s.id=r.submitted_by
       WHERE r.id=$1`, [req.params.id]
    );
    if (!r) throw new AppError('Request not found', 404, 'NOT_FOUND');

    // Attach imported article count
    const { rows: [counts] } = await pool.query(
      'SELECT COUNT(*) AS imported FROM journal_imported_articles WHERE migration_request_id=$1',
      [req.params.id]
    );
    r.article_count_imported = parseInt(counts.imported) || 0;

    res.json({ success: true, data: r });
  } catch (err) { next(err); }
});

// ── Probe OAI-PMH (super admin) ───────────────────────────────────────────────
router.post('/:id/probe', authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { rows: [r] } = await pool.query(
      'SELECT * FROM journal_migration_requests WHERE id=$1', [req.params.id]
    );
    if (!r) throw new AppError('Request not found', 404, 'NOT_FOUND');

    await pool.query(
      `UPDATE journal_migration_requests SET status='probing',updated_at=NOW() WHERE id=$1`, [r.id]
    );

    let result;
    try {
      result = await probeOaiPmh(r.oai_pmh_url || r.existing_url);
    } catch (err) {
      result = { success: false, error: err.message, article_count: 0 };
    }

    const newStatus = result.success ? 'probe_done' : 'failed';
    const { rows: [updated] } = await pool.query(
      `UPDATE journal_migration_requests
       SET status=$1, probe_result=$2, article_count_found=$3,
           oai_pmh_url=COALESCE($4, oai_pmh_url), updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [newStatus, JSON.stringify(result), result.article_count || 0,
       result.oai_pmh_url || null, r.id]
    );

    res.json({ success: true, data: updated, probe: result });
  } catch (err) { next(err); }
});

// ── Start import (super admin) ────────────────────────────────────────────────
router.post('/:id/import', authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { rows: [r] } = await pool.query(
      'SELECT * FROM journal_migration_requests WHERE id=$1', [req.params.id]
    );
    if (!r) throw new AppError('Request not found', 404, 'NOT_FOUND');
    if (!r.oai_pmh_url) throw new AppError(
      'No OAI-PMH URL available. Run probe first or provide the OAI-PMH URL manually.', 422, 'NO_OAI_URL'
    );
    if (r.status === 'importing') throw new AppError('Import already in progress', 409, 'ALREADY_RUNNING');

    await pool.query(
      `UPDATE journal_migration_requests SET status='importing',updated_at=NOW() WHERE id=$1`, [r.id]
    );

    // Run in background — don't await
    setImmediate(() =>
      runOaiImport(r, req.user.id).catch(async (err) => {
        await pool.query(
          `UPDATE journal_migration_requests
           SET status='failed', error_message=$1, updated_at=NOW() WHERE id=$2`,
          [err.message, r.id]
        );
      })
    );

    res.json({ success: true, message: 'Import started in background. Refresh to see progress.' });
  } catch (err) { next(err); }
});

// ── Reject request (super admin) ──────────────────────────────────────────────
router.post('/:id/reject', authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { note } = req.body;
    await pool.query(
      `UPDATE journal_migration_requests
       SET status='rejected', reviewed_by=$1, reviewed_at=NOW(), review_note=$2, updated_at=NOW()
       WHERE id=$3`,
      [req.user.id, note || null, req.params.id]
    );
    res.json({ success: true, message: 'Migration request rejected.' });
  } catch (err) { next(err); }
});

// ── Get imported articles for a request ───────────────────────────────────────
router.get('/:id/articles', authenticate, requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows } = await pool.query(
      `SELECT * FROM journal_imported_articles
       WHERE migration_request_id=$1
       ORDER BY published_at DESC NULLS LAST, created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.params.id, parseInt(limit), offset]
    );
    const { rows: [{ total }] } = await pool.query(
      'SELECT COUNT(*) AS total FROM journal_imported_articles WHERE migration_request_id=$1',
      [req.params.id]
    );

    res.json({ success: true, data: rows, total: parseInt(total), page: parseInt(page) });
  } catch (err) { next(err); }
});

// ── Background OAI-PMH import ─────────────────────────────────────────────────
async function runOaiImport(migReq, reviewerId) {
  // 1. Create or find the journal record
  let journalId = migReq.journal_id;
  if (!journalId) {
    const slug = migReq.journal_title
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      + '-' + Date.now().toString(36);

    const { rows: [j] } = await pool.query(
      `INSERT INTO journals
         (university_id, title, slug, issn_print, issn_online, scope,
          status, is_open_access, subscription_status, website_url)
       VALUES ($1,$2,$3,$4,$5,$6,'active',true,'active',$7)
       RETURNING id`,
      [migReq.university_id, migReq.journal_title, slug,
       migReq.issn_print || null, migReq.issn_online || null,
       migReq.scope || null, migReq.existing_url]
    );
    journalId = j.id;
    await pool.query(
      'UPDATE journal_migration_requests SET journal_id=$1 WHERE id=$2',
      [journalId, migReq.id]
    );
  }

  // 2. Page through OAI-PMH ListRecords
  let importedCount = 0;
  let resumptionToken = null;
  const oaiBase = migReq.oai_pmh_url;

  do {
    const url = resumptionToken
      ? `${oaiBase}?verb=ListRecords&resumptionToken=${encodeURIComponent(resumptionToken)}`
      : `${oaiBase}?verb=ListRecords&metadataPrefix=oai_dc`;

    let listBlock;
    try {
      const text   = await fetchXml(url, 30000);
      const parsed = await parseXml(text);
      listBlock = parsed['OAI-PMH']?.ListRecords?.[0];
    } catch (err) {
      // Network error on a page — stop
      throw new Error(`Failed fetching OAI page: ${err.message}`);
    }

    if (!listBlock) break;

    const records = listBlock.record || [];
    for (const record of records) {
      try {
        const header   = record.header?.[0];
        const metadata = record.metadata?.[0]?.['oai_dc:dc']?.[0];
        if (!metadata) continue;

        const title    = (metadata['dc:title']?.[0]       || 'Untitled').slice(0, 500);
        const abstract = metadata['dc:description']?.[0]   || null;
        const authors  = (metadata['dc:creator']  || []).join('; ') || null;
        const rawDate  = metadata['dc:date']?.[0]           || null;
        const extId    = header?.identifier?.[0]            || null;
        const subjects = (metadata['dc:subject']  || []).flatMap(s => s.split(/[,;]/)).map(s => s.trim()).filter(Boolean);

        // Pick DOI from identifiers
        const identifiers = metadata['dc:identifier'] || [];
        const doi = identifiers.find(s => /doi\.org/i.test(s)) || null;
        const sourceUrl = identifiers.find(s => /^https?:\/\//.test(s) && !/doi\.org/i.test(s)) || null;

        // Parse date safely
        let publishedAt = null;
        if (rawDate) {
          const d = new Date(rawDate);
          if (!isNaN(d)) publishedAt = d;
        }

        await pool.query(
          `INSERT INTO journal_imported_articles
             (migration_request_id, journal_id, external_id, title, abstract,
              author_names, doi, source_url, published_at, subjects, raw_metadata)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (external_id) DO NOTHING`,
          [migReq.id, journalId, extId, title, abstract,
           authors, doi, sourceUrl, publishedAt,
           subjects, JSON.stringify(metadata)]
        );
        importedCount++;
      } catch {}
    }

    // Update running count every page
    await pool.query(
      'UPDATE journal_migration_requests SET article_count_imported=$1,updated_at=NOW() WHERE id=$2',
      [importedCount, migReq.id]
    );

    // Handle resumption token
    const tokenNode = listBlock.resumptionToken?.[0];
    resumptionToken = typeof tokenNode === 'object' ? tokenNode._ : (tokenNode || null);

    if (resumptionToken) await new Promise(r => setTimeout(r, 1200));
  } while (resumptionToken);

  // 3. Mark complete
  await pool.query(
    `UPDATE journal_migration_requests
     SET status='imported', article_count_imported=$1,
         reviewed_by=$2, reviewed_at=NOW(), updated_at=NOW()
     WHERE id=$3`,
    [importedCount, reviewerId, migReq.id]
  );
}

module.exports = router;
