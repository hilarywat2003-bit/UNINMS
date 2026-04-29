'use strict';

/**
 * TETFund Performance Reporting Service
 *
 * Computes a 0-100 composite Performance Score from 6 weighted metrics
 * aligned with Tertiary Education Trust Fund reporting requirements.
 *
 * Metrics & weights:
 *  1. Research Publications   30 %  — peer-reviewed papers, theses, dissertations
 *  2. Citation Impact         20 %  — citations per published document
 *  3. Postgraduate Output     20 %  — theses + dissertations uploaded
 *  4. Research Collaboration  15 %  — cross-institutional research project activity
 *  5. Industry Engagement     10 %  — verified implementation claims
 *  6. Platform Utilisation     5 %  — total downloads + views per enrolled user
 *
 * Allocation multiplier bands (per TETFund guidelines):
 *  ≥ 90 → 1.5×  |  ≥ 80 → 1.3×  |  ≥ 70 → 1.2×  |  ≥ 60 → 1.1×
 *  ≥ 50 → 1.0×  |  ≥ 40 → 0.9×  |  < 40 → 0.8×
 */

const { pool } = require('../config/database');
const logger   = require('../utils/logger');

// ── Benchmarks (per-staff or per-student, depending on metric) ────────────────
const BENCHMARKS = {
  publications_per_staff:  0.5,   // 0.5 research docs per staff member
  citations_per_pub:       5,     // 5 citations per published document
  postgrad_per_100_students: 5,   // 5 theses/dissertations per 100 students
  projects_per_staff:      0.2,   // 0.2 research projects per staff member
  claims_total:            5,     // 5 verified implementation claims
  activity_per_student:    50,    // 50 combined downloads+views per student
};

const WEIGHTS = {
  publications:  0.30,
  citations:     0.20,
  postgrad:      0.20,
  collaboration: 0.15,
  engagement:    0.10,
  utilisation:   0.05,
};

// Normalise a ratio against its benchmark to a 0-100 score, capped at 100
function norm(actual, benchmark) {
  if (!benchmark || benchmark <= 0) return 0;
  return Math.min(100, Math.round((actual / benchmark) * 100 * 10) / 10);
}

function allocationMultiplier(score) {
  if (score >= 90) return 1.5;
  if (score >= 80) return 1.3;
  if (score >= 70) return 1.2;
  if (score >= 60) return 1.1;
  if (score >= 50) return 1.0;
  if (score >= 40) return 0.9;
  return 0.8;
}

/**
 * Compute the full TETFund report for a given university.
 * Returns raw metric values, individual scores, the composite score,
 * and the allocation multiplier.
 */
async function computeReport(universityId) {
  // ── 0. Population counts ────────────────────────────────────────────────────
  const { rows: [pop] } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE r.name = 'student')                          AS students,
       COUNT(*) FILTER (WHERE r.name IN ('lecturer','researcher','staff')) AS staff
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r       ON r.id       = ur.role_id
     WHERE u.university_id = $1 AND u.deleted_at IS NULL`,
    [universityId]
  );
  const students = Math.max(1, parseInt(pop.students));
  const staff    = Math.max(1, parseInt(pop.staff));

  // ── 1. Research Publications (30 %) ─────────────────────────────────────────
  const { rows: [pubsRow] } = await pool.query(
    `SELECT COUNT(*) AS count
     FROM documents d
     JOIN users u ON u.id = d.uploader_id
     WHERE u.university_id = $1
       AND d.deleted_at  IS NULL
       AND d.is_published = TRUE
       AND d.doc_type IN ('thesis','dissertation','research_paper','policy_doc')`,
    [universityId]
  );
  const publications  = parseInt(pubsRow.count);
  const pubScore      = norm(publications / staff, BENCHMARKS.publications_per_staff);

  // ── 2. Citation Impact (20 %) ────────────────────────────────────────────────
  const { rows: [citRow] } = await pool.query(
    `SELECT COALESCE(SUM(d.citation_count), 0)  AS total_citations,
            COUNT(*) FILTER (WHERE d.is_published) AS pub_count
     FROM documents d
     JOIN users u ON u.id = d.uploader_id
     WHERE u.university_id = $1 AND d.deleted_at IS NULL`,
    [universityId]
  );
  const totalCitations  = parseInt(citRow.total_citations);
  const citPerPub       = publications > 0 ? totalCitations / publications : 0;
  const citScore        = norm(citPerPub, BENCHMARKS.citations_per_pub);

  // ── 3. Postgraduate Output (20 %) ────────────────────────────────────────────
  const { rows: [pgRow] } = await pool.query(
    `SELECT COUNT(*) AS count
     FROM documents d
     JOIN users u ON u.id = d.uploader_id
     WHERE u.university_id = $1
       AND d.deleted_at  IS NULL
       AND d.is_published = TRUE
       AND d.doc_type IN ('thesis','dissertation')`,
    [universityId]
  );
  const postgrad   = parseInt(pgRow.count);
  const pgScore    = norm((postgrad / students) * 100, BENCHMARKS.postgrad_per_100_students);

  // ── 4. Research Collaboration (15 %) ─────────────────────────────────────────
  const { rows: [collabRow] } = await pool.query(
    `SELECT COUNT(DISTINCT rp.id) AS count
     FROM research_projects rp
     JOIN research_project_members rpm ON rpm.project_id = rp.id
     JOIN users u ON u.id = rpm.user_id
     WHERE u.university_id = $1 AND rp.deleted_at IS NULL`,
    [universityId]
  );
  const projects     = parseInt(collabRow.count);
  const collabScore  = norm(projects / staff, BENCHMARKS.projects_per_staff);

  // ── 5. Industry Engagement (10 %) ────────────────────────────────────────────
  const { rows: [claimsRow] } = await pool.query(
    `SELECT COUNT(*) AS count
     FROM implementation_claims c
     JOIN users u ON u.id = c.submitter_id
     WHERE u.university_id = $1 AND c.status = 'approved'`,
    [universityId]
  );
  const claims      = parseInt(claimsRow.count);
  const claimsScore = norm(claims, BENCHMARKS.claims_total);

  // ── 6. Platform Utilisation (5 %) ────────────────────────────────────────────
  const { rows: [utilRow] } = await pool.query(
    `SELECT COALESCE(SUM(d.download_count + d.view_count), 0) AS activity
     FROM documents d
     JOIN users u ON u.id = d.uploader_id
     WHERE u.university_id = $1 AND d.deleted_at IS NULL`,
    [universityId]
  );
  const activity    = parseInt(utilRow.activity);
  const utilScore   = norm(activity / students, BENCHMARKS.activity_per_student);

  // ── Composite score ──────────────────────────────────────────────────────────
  const metrics = {
    research_publications: {
      label:          'Research Publications',
      raw_value:      publications,
      unit:           'documents',
      benchmark:      `${BENCHMARKS.publications_per_staff} per staff member`,
      score:          pubScore,
      weight:         WEIGHTS.publications,
      weighted_score: Math.round(pubScore * WEIGHTS.publications * 10) / 10,
    },
    citation_impact: {
      label:          'Citation Impact',
      raw_value:      totalCitations,
      unit:           `total citations (${citPerPub.toFixed(2)} per publication)`,
      benchmark:      `${BENCHMARKS.citations_per_pub} citations per publication`,
      score:          citScore,
      weight:         WEIGHTS.citations,
      weighted_score: Math.round(citScore * WEIGHTS.citations * 10) / 10,
    },
    postgraduate_output: {
      label:          'Postgraduate Output',
      raw_value:      postgrad,
      unit:           'theses / dissertations',
      benchmark:      `${BENCHMARKS.postgrad_per_100_students} per 100 students`,
      score:          pgScore,
      weight:         WEIGHTS.postgrad,
      weighted_score: Math.round(pgScore * WEIGHTS.postgrad * 10) / 10,
    },
    research_collaboration: {
      label:          'Research Collaboration',
      raw_value:      projects,
      unit:           'active research projects',
      benchmark:      `${BENCHMARKS.projects_per_staff} per staff member`,
      score:          collabScore,
      weight:         WEIGHTS.collaboration,
      weighted_score: Math.round(collabScore * WEIGHTS.collaboration * 10) / 10,
    },
    industry_engagement: {
      label:          'Industry & Government Engagement',
      raw_value:      claims,
      unit:           'verified implementation claims',
      benchmark:      `${BENCHMARKS.claims_total} claims`,
      score:          claimsScore,
      weight:         WEIGHTS.engagement,
      weighted_score: Math.round(claimsScore * WEIGHTS.engagement * 10) / 10,
    },
    platform_utilisation: {
      label:          'Platform Utilisation',
      raw_value:      activity,
      unit:           'downloads + views',
      benchmark:      `${BENCHMARKS.activity_per_student} per enrolled student`,
      score:          utilScore,
      weight:         WEIGHTS.utilisation,
      weighted_score: Math.round(utilScore * WEIGHTS.utilisation * 10) / 10,
    },
  };

  const performanceScore = Object.values(metrics)
    .reduce((sum, m) => sum + m.weighted_score, 0);

  const roundedScore = Math.round(performanceScore * 10) / 10;
  const multiplier   = allocationMultiplier(roundedScore);

  return {
    universityId,
    performanceScore:     roundedScore,
    allocationMultiplier: multiplier,
    metrics,
    population: { students, staff },
  };
}

/**
 * Generate a report, persist it as a snapshot, and return the full result.
 */
async function generateAndSave(universityId, periodLabel, generatedBy = null) {
  const report = await computeReport(universityId);

  await pool.query(
    `INSERT INTO tetfund_snapshots
       (university_id, period_label, performance_score, allocation_multiplier, metrics, generated_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (university_id, period_label) DO UPDATE SET
       performance_score     = EXCLUDED.performance_score,
       allocation_multiplier = EXCLUDED.allocation_multiplier,
       metrics               = EXCLUDED.metrics,
       generated_by          = EXCLUDED.generated_by,
       generated_at          = NOW()`,
    [
      universityId,
      periodLabel,
      report.performanceScore,
      report.allocationMultiplier,
      JSON.stringify(report.metrics),
      generatedBy,
    ]
  );

  logger.info(
    `[tetfund] Report generated for ${universityId} period=${periodLabel} ` +
    `score=${report.performanceScore} multiplier=${report.allocationMultiplier}`
  );

  return { ...report, periodLabel };
}

/**
 * Default period label: current year + '-Annual'
 */
function currentPeriodLabel() {
  return `${new Date().getFullYear()}-Annual`;
}

module.exports = { computeReport, generateAndSave, currentPeriodLabel, allocationMultiplier };
