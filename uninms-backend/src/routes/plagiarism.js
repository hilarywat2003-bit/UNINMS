'use strict';

const express = require('express');
const { pool } = require('../config/database');
const { AppError } = require('../utils/AppError');
const { authenticate, requireRole } = require('../middleware/auth');
const { checkDocument, SIMILARITY_THRESHOLD } = require('../services/plagiarism');
const { detectAI }             = require('../services/aiDetector');
const { searchWeb }            = require('../services/webSearch');
const { submitTocopyleaks, handleWebhook } = require('../services/deepCheck');
const { getGate, incrementUsage } = require('../services/plagiarismGate');
const { logAdminAction }       = require('../utils/auditLog');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function quotaHeaders(gate) {
  return {
    'X-Plagiarism-Plan':            gate.plan,
    'X-Plagiarism-Quota-Total':     String(gate.checksPerMonth),
    'X-Plagiarism-Quota-Used':      String(gate.checksUsed),
    'X-Plagiarism-Quota-Remaining': String(gate.checksRemaining),
  };
}

// ── POST /plagiarism/:documentId/check ────────────────────────────────────────
router.post('/:documentId/check', authenticate, async (req, res, next) => {
  try {
    const { documentId } = req.params;
    if (!/^[0-9a-f-]{36}$/.test(documentId)) {
      throw new AppError('Invalid document ID', 422, 'VALIDATION_ERROR');
    }

    const { rows: [doc] } = await pool.query(
      `SELECT d.id, d.title, d.abstract, d.full_text, d.uploader_id,
              d.plagiarism_status, u.university_id
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploader_id
       WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [documentId]
    );
    if (!doc) throw new AppError('Document not found', 404, 'NOT_FOUND');

    const isPrivileged = req.user.roles?.some(r =>
      ['admin', 'super_admin', 'management', 'staff', 'lecturer'].includes(r)
    );
    if (doc.uploader_id !== req.user.id && !isPrivileged) {
      throw new AppError('Not authorised to check this document', 403, 'FORBIDDEN');
    }

    // ── Gate check ───────────────────────────────────────────────────────────
    const universityId = doc.university_id ?? req.user.university_id ?? null;
    const gate         = await getGate(universityId);

    if (gate.quotaExceeded) {
      res.set(quotaHeaders(gate));
      throw new AppError(
        `Monthly plagiarism quota reached (${gate.checksPerMonth} checks/month on the ${gate.plan} plan). ` +
        `Upgrade your plan to continue.`,
        402, 'QUOTA_EXCEEDED'
      );
    }

    if (doc.plagiarism_status === 'checking') {
      res.set(quotaHeaders(gate));
      return res.status(202).json({
        success: true,
        message: 'A plagiarism check is already in progress',
        data: { document_id: documentId, status: 'checking', quota: gate },
      });
    }

    // ── Run core check ───────────────────────────────────────────────────────
    const result = await checkDocument(documentId);

    // Increment usage NOW (after successful core check)
    await incrementUsage(universityId);

    // ── Enhanced passes (run in parallel, gated by plan) ────────────────────
    const analysisText = doc.full_text || `${doc.title || ''} ${doc.abstract || ''}`;

    const [aiResult, webMatches] = await Promise.all([
      gate.aiDetection ? detectAI(analysisText) : Promise.resolve(null),
      gate.webSearch   ? searchWeb(doc.full_text || '') : Promise.resolve([]),
    ]);

    // Persist AI + web results
    if (aiResult || webMatches.length > 0) {
      await pool.query(
        `UPDATE plagiarism_reports
         SET ai_score    = COALESCE($1, ai_score),
             ai_label    = COALESCE($2, ai_label),
             ai_checked  = COALESCE($3, ai_checked),
             web_matches = COALESCE($4::jsonb, web_matches),
             web_checked = CASE WHEN $5 THEN TRUE ELSE web_checked END
         WHERE document_id = $6`,
        [
          aiResult?.score ?? null,
          aiResult?.label ?? null,
          aiResult != null,
          webMatches.length > 0 ? JSON.stringify(webMatches) : null,
          gate.webSearch,
          documentId,
        ]
      );
    }

    // ── Deep check — fire-and-forget (Copyleaks webhook returns async) ───────
    if (gate.deepCheck) {
      setImmediate(() => {
        submitTocopyleaks(documentId, analysisText, doc.title).catch(err => {
          require('../utils/logger').warn(`[plagiarism] deep check submit error: ${err.message}`);
        });
      });
    }

    await logAdminAction(req.user.id, 'plagiarism.check', 'documents', documentId,
      { score: result.overallScore, status: result.status, plan: gate.plan }, req);

    res.set(quotaHeaders(gate));
    res.json({
      success: true,
      data: {
        document_id:   documentId,
        title:         doc.title,
        overall_score: result.overallScore,
        status:        result.status,
        is_duplicate:  result.isDuplicate,
        flagged:       result.overallScore >= SIMILARITY_THRESHOLD,
        methods_used:  result.methodsUsed,
        top_matches:   result.topMatches,
        threshold:     SIMILARITY_THRESHOLD,
        ai_result:     aiResult,
        web_matches:   webMatches,
        copyleaks_status: gate.deepCheck ? 'submitted' : 'not_available',
        quota: {
          plan:       gate.plan,
          used:       gate.checksUsed + 1,
          total:      gate.checksPerMonth,
          remaining:  gate.checksRemaining - 1,
        },
        features: {
          semantic:     true,
          ai_detection: gate.aiDetection,
          web_search:   gate.webSearch,
          deep_check:   gate.deepCheck,
        },
      },
    });
  } catch (err) { next(err); }
});

// ── GET /plagiarism/:documentId/report ────────────────────────────────────────
router.get('/:documentId/report', authenticate, async (req, res, next) => {
  try {
    const { documentId } = req.params;
    if (!/^[0-9a-f-]{36}$/.test(documentId)) {
      throw new AppError('Invalid document ID', 422, 'VALIDATION_ERROR');
    }

    const { rows: [doc] } = await pool.query(
      `SELECT d.id, d.title, d.uploader_id, d.plagiarism_score, d.plagiarism_status,
              u.university_id
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploader_id
       WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [documentId]
    );
    if (!doc) throw new AppError('Document not found', 404, 'NOT_FOUND');

    const isPrivileged = req.user.roles?.some(r => ['admin', 'lecturer', 'supervisor'].includes(r));
    if (doc.uploader_id !== req.user.id && !isPrivileged) {
      throw new AppError('Not authorised to view this report', 403, 'FORBIDDEN');
    }

    const universityId = doc.university_id ?? req.user.university_id ?? null;
    const gate         = await getGate(universityId);

    const { rows: [report] } = await pool.query(
      `SELECT pr.*, d.title AS matched_doc_title
       FROM plagiarism_reports pr
       LEFT JOIN documents d ON d.id = pr.matched_doc_id
       WHERE pr.document_id = $1`,
      [documentId]
    );

    res.set(quotaHeaders(gate));

    if (!report) {
      return res.json({
        success: true,
        data: {
          document_id:       documentId,
          document_title:    doc.title,
          plagiarism_score:  doc.plagiarism_score,
          plagiarism_status: doc.plagiarism_status ?? 'unchecked',
          report:            null,
          quota:             { plan: gate.plan, used: gate.checksUsed, total: gate.checksPerMonth, remaining: gate.checksRemaining },
          features:          { ai_detection: gate.aiDetection, web_search: gate.webSearch, deep_check: gate.deepCheck },
        },
      });
    }

    res.json({
      success: true,
      data: {
        document_id:       documentId,
        document_title:    doc.title,
        plagiarism_score:  parseFloat(report.overall_score),
        plagiarism_status: doc.plagiarism_status ?? 'checked',
        flagged:           parseFloat(report.overall_score) >= SIMILARITY_THRESHOLD,
        threshold:         SIMILARITY_THRESHOLD,
        report: {
          id:             report.id,
          overall_score:  parseFloat(report.overall_score),
          semantic_score: report.semantic_score != null ? parseFloat(report.semantic_score) : null,
          text_score:     report.text_score     != null ? parseFloat(report.text_score)     : null,
          is_duplicate:   report.is_duplicate,
          methods_used:   report.methods_used ?? [],
          top_match: report.matched_doc_id
            ? { document_id: report.matched_doc_id, title: report.matched_title }
            : null,
          match_details:           report.match_details           ?? [],
          external_matches:        report.external_matches        ?? [],
          external_source_checked: report.external_source_checked ?? false,
          sentence_matches:        report.sentence_matches         ?? [],
          // AI detection
          ai_score:    report.ai_score  != null ? parseFloat(report.ai_score) : null,
          ai_label:    report.ai_label  ?? null,
          ai_checked:  report.ai_checked ?? false,
          // Web search
          web_matches: report.web_matches ?? [],
          web_checked: report.web_checked ?? false,
          // Deep check (Copyleaks)
          copyleaks_status:     report.copyleaks_status     ?? 'not_submitted',
          copyleaks_score:      report.copyleaks_score != null ? parseFloat(report.copyleaks_score) : null,
          copyleaks_report_url: report.copyleaks_report_url ?? null,
          copyleaks_matches:    report.copyleaks_matches    ?? [],
          checked_at:           report.checked_at,
        },
        quota:    { plan: gate.plan, used: gate.checksUsed, total: gate.checksPerMonth, remaining: gate.checksRemaining },
        features: { ai_detection: gate.aiDetection, web_search: gate.webSearch, deep_check: gate.deepCheck },
      },
    });
  } catch (err) { next(err); }
});

// ── GET /plagiarism — list flagged documents ───────────────────────────────────
router.get('/', authenticate, requireRole('admin', 'lecturer', 'supervisor'), async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page  ?? '1'));
    const limit    = Math.min(50, Math.max(1, parseInt(req.query.limit ?? '20')));
    const offset   = (page - 1) * limit;
    const minScore = parseFloat(req.query.minScore ?? String(SIMILARITY_THRESHOLD));

    const { rows } = await pool.query(
      `SELECT d.id, d.title, d.doc_type, d.plagiarism_score, d.plagiarism_status,
              d.published_at, d.created_at,
              u.full_name AS uploader_name,
              pr.overall_score, pr.matched_title, pr.checked_at, pr.match_details,
              pr.ai_score, pr.ai_label,
              pr.copyleaks_status, pr.copyleaks_score
       FROM documents d
       LEFT JOIN plagiarism_reports pr ON pr.document_id = d.id
       LEFT JOIN users u ON u.id = d.uploader_id
       WHERE d.deleted_at IS NULL
         AND d.plagiarism_score >= $1
       ORDER BY d.plagiarism_score DESC
       LIMIT $2 OFFSET $3`,
      [minScore, limit, offset]
    );

    const { rows: [countRow] } = await pool.query(
      `SELECT COUNT(*) FROM documents WHERE deleted_at IS NULL AND plagiarism_score >= $1`,
      [minScore]
    );

    res.json({
      success: true,
      data: { flagged: rows, total: parseInt(countRow.count), page, limit, threshold: minScore },
    });
  } catch (err) { next(err); }
});

// ── POST /plagiarism/webhook/copyleaks/:status/:docId/:scanId ─────────────────
// Copyleaks calls this when a deep scan completes.
// No auth — verified by matching stored scanId.
router.post('/webhook/copyleaks/:status/:documentId/:scanId', async (req, res) => {
  try {
    const { status, documentId, scanId } = req.params;

    // Verify the scanId matches what we submitted
    const { rows: [report] } = await pool.query(
      `SELECT copyleaks_scan_id FROM plagiarism_reports WHERE document_id = $1`,
      [documentId]
    );

    if (!report || report.copyleaks_scan_id !== scanId) {
      return res.status(404).end();
    }

    await handleWebhook(status, documentId, scanId, req.body);
    res.sendStatus(200);
  } catch {
    res.sendStatus(200); // Always 200 to Copyleaks
  }
});

module.exports = router;
