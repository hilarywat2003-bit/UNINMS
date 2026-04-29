'use strict';

/**
 * TETFund Performance Reporting Routes — /api/v1/tetfund
 *
 * Access: management, admin, super_admin roles
 *
 * GET  /tetfund/report          — compute + return live report (or latest snapshot)
 * POST /tetfund/report/generate — force-generate and persist a new snapshot
 * GET  /tetfund/report/history  — historical trend of saved snapshots
 * GET  /tetfund/report/export   — download report as JSON or CSV
 */

const express      = require('express');
const { pool }     = require('../config/database');
const { AppError } = require('../utils/AppError');
const { authenticate, isManagement } = require('../middleware/auth');
const { computeReport, generateAndSave, currentPeriodLabel } = require('../services/tetfund');
const { logAdminAction } = require('../utils/auditLog');

const router = express.Router();

router.use(authenticate, isManagement);

// ── University scoping helper ─────────────────────────────────────────────────
async function resolveUniversity(req) {
  // super_admin / management can pass ?universityId=; otherwise derive from user
  if (req.query.universityId) return req.query.universityId;
  if (req.user.university_id) return req.user.university_id;
  throw new AppError('No institution context — pass ?universityId=', 400, 'BAD_REQUEST');
}

// ── GET /tetfund/report ────────────────────────────────────────────────────────
// Returns the latest persisted snapshot if it exists for the current period;
// falls back to a live computed (but unsaved) report.
router.get('/report', async (req, res, next) => {
  try {
    const uniId  = await resolveUniversity(req);
    const period = req.query.period ?? currentPeriodLabel();

    // Try cached snapshot first
    const { rows: [snap] } = await pool.query(
      `SELECT ts.*, u.name AS university_name
       FROM tetfund_snapshots ts
       JOIN universities u ON u.id = ts.university_id
       WHERE ts.university_id = $1 AND ts.period_label = $2`,
      [uniId, period]
    );

    if (snap) {
      return res.json({
        success: true,
        data: {
          source:               'snapshot',
          period_label:         snap.period_label,
          university_name:      snap.university_name,
          performance_score:    parseFloat(snap.performance_score),
          allocation_multiplier: parseFloat(snap.allocation_multiplier),
          metrics:              snap.metrics,
          generated_at:         snap.generated_at,
        },
      });
    }

    // Live compute (no snapshot yet for this period)
    const report = await computeReport(uniId);
    const { rows: [uni] } = await pool.query(
      'SELECT name FROM universities WHERE id = $1', [uniId]
    );

    res.json({
      success: true,
      data: {
        source:               'live',
        period_label:         period,
        university_name:      uni?.name ?? null,
        performance_score:    report.performanceScore,
        allocation_multiplier: report.allocationMultiplier,
        metrics:              report.metrics,
        population:           report.population,
        generated_at:         new Date().toISOString(),
        note:                 'This report has not been saved. Use POST /generate to persist.',
      },
    });
  } catch (err) { next(err); }
});

// ── POST /tetfund/report/generate ─────────────────────────────────────────────
// Force-generate (or regenerate) and persist a snapshot for the given period.
router.post('/report/generate', async (req, res, next) => {
  try {
    const uniId  = await resolveUniversity(req);
    const period = req.body.period ?? currentPeriodLabel();

    const report = await generateAndSave(uniId, period, req.user.id);

    const { rows: [uni] } = await pool.query(
      'SELECT name FROM universities WHERE id = $1', [uniId]
    );

    await logAdminAction(req.user.id, 'tetfund.report.generate', 'universities', uniId,
      { period, score: report.performanceScore }, req);

    res.status(201).json({
      success: true,
      data: {
        period_label:         report.periodLabel,
        university_name:      uni?.name ?? null,
        performance_score:    report.performanceScore,
        allocation_multiplier: report.allocationMultiplier,
        metrics:              report.metrics,
        population:           report.population,
      },
    });
  } catch (err) { next(err); }
});

// ── GET /tetfund/report/history ────────────────────────────────────────────────
// Historical trend — all saved snapshots for the institution.
router.get('/report/history', async (req, res, next) => {
  try {
    const uniId = await resolveUniversity(req);

    const { rows } = await pool.query(
      `SELECT period_label, performance_score, allocation_multiplier, generated_at,
              metrics->>'research_publications' AS m_publications,
              metrics->>'citation_impact'       AS m_citations,
              metrics->>'postgraduate_output'   AS m_postgrad,
              metrics->>'research_collaboration' AS m_collaboration,
              metrics->>'industry_engagement'   AS m_engagement,
              metrics->>'platform_utilisation'  AS m_utilisation
       FROM tetfund_snapshots
       WHERE university_id = $1
       ORDER BY generated_at DESC`,
      [uniId]
    );

    res.json({
      success: true,
      data: {
        university_id: uniId,
        history: rows.map(r => ({
          period_label:          r.period_label,
          performance_score:     parseFloat(r.performance_score),
          allocation_multiplier: parseFloat(r.allocation_multiplier),
          generated_at:          r.generated_at,
        })),
        trend: rows.map(r => ({
          period:  r.period_label,
          score:   parseFloat(r.performance_score),
          multiplier: parseFloat(r.allocation_multiplier),
        })).reverse(), // ascending for chart rendering
      },
    });
  } catch (err) { next(err); }
});

// ── GET /tetfund/report/export?format=json|csv ─────────────────────────────────
// Download the full report in JSON (default) or CSV format (REQ-MGT-008).
router.get('/report/export', async (req, res, next) => {
  try {
    const uniId  = await resolveUniversity(req);
    const period = req.query.period ?? currentPeriodLabel();
    const format = req.query.format === 'csv' ? 'csv' : 'json';

    // Always compute a fresh report for exports
    const report = await computeReport(uniId);
    const { rows: [uni] } = await pool.query(
      'SELECT name, short_name FROM universities WHERE id = $1', [uniId]
    );

    const payload = {
      institution:          uni?.name ?? uniId,
      institution_short:    uni?.short_name ?? null,
      period_label:         period,
      generated_at:         new Date().toISOString(),
      performance_score:    report.performanceScore,
      allocation_multiplier: report.allocationMultiplier,
      population:           report.population,
      metrics:              report.metrics,
    };

    await logAdminAction(req.user.id, 'tetfund.report.export', 'universities', uniId,
      { period, format }, req);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition',
        `attachment; filename="tetfund-${uni?.short_name ?? uniId}-${period}.json"`);
      return res.send(JSON.stringify(payload, null, 2));
    }

    // CSV: one row per metric
    const escape = v => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const headerRow  = 'metric,label,raw_value,unit,benchmark,score,weight,weighted_score';
    const metricRows = Object.entries(report.metrics).map(([key, m]) =>
      [key, m.label, m.raw_value, m.unit, m.benchmark, m.score, m.weight, m.weighted_score]
        .map(escape).join(',')
    );
    const summarySection = [
      '',
      `institution,${escape(payload.institution)}`,
      `period,${escape(period)}`,
      `performance_score,${report.performanceScore}`,
      `allocation_multiplier,${report.allocationMultiplier}`,
      `generated_at,${payload.generated_at}`,
    ];

    const csv = [headerRow, ...metricRows, ...summarySection].join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition',
      `attachment; filename="tetfund-${uni?.short_name ?? uniId}-${period}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

module.exports = router;
