'use strict';

/**
 * Strategic Recommendations Service
 *
 * Provides:
 *   - listRecommendations      — paginated list with optional filters
 *   - generateRecommendations  — rule-based generation + persist to DB
 *   - updateStatus             — admin/management status transitions
 */

const { pool } = require('../config/database');

// ─────────────────────────────────────────────────────────────────────────────
// listRecommendations
// ─────────────────────────────────────────────────────────────────────────────

async function listRecommendations(universityId, status) {
  const values = [];
  const where  = ['deleted_at IS NULL'];
  let   idx    = 1;

  if (universityId) { values.push(universityId); where.push(`university_id = $${idx++}`); }
  if (status)       { values.push(status);       where.push(`status = $${idx++}`);        }

  const { rows } = await pool.query(
    `SELECT id, university_id, category, title, description,
            confidence_score, action_required, reasoning_steps,
            status, generated_at
     FROM strategic_recommendations
     WHERE ${where.join(' AND ')}
     ORDER BY confidence_score DESC, generated_at DESC`,
    values
  );
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// generateRecommendations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rule-based recommendation engine.
 * Each rule inspects the DB and conditionally inserts a recommendation.
 * Already-active recommendations for the same title are skipped (idempotent).
 *
 * @param {string} universityId
 * @returns {Array} newly inserted recommendation rows
 */
async function generateRecommendations(universityId) {
  const inserted = [];

  async function maybeInsert({ category, title, description, confidenceScore, actionRequired, reasoningSteps }) {
    // Idempotency: skip if a pending_review / accepted recommendation with the same title exists
    const { rows: [existing] } = await pool.query(
      `SELECT id FROM strategic_recommendations
       WHERE university_id = $1 AND title = $2
         AND status IN ('pending_review','accepted')
         AND deleted_at IS NULL
       LIMIT 1`,
      [universityId, title]
    );
    if (existing) return;

    const { rows: [rec] } = await pool.query(
      `INSERT INTO strategic_recommendations
         (university_id, category, title, description, confidence_score,
          action_required, reasoning_steps, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_review')
       RETURNING *`,
      [universityId, category, title, description, confidenceScore,
       actionRequired, JSON.stringify(reasoningSteps)]
    );
    inserted.push(rec);
  }

  // ── Rule 1: Low citation rate ─────────────────────────────────────────────
  const { rows: [citStats] } = await pool.query(
    `SELECT COALESCE(AVG(d.citation_count), 0) AS avg_citations
     FROM documents d
     JOIN users u ON u.id = d.uploader_id
     JOIN departments dep ON dep.id = u.department_id
     JOIN faculties fac ON fac.id = dep.faculty_id
     WHERE fac.university_id = $1
       AND d.deleted_at IS NULL AND d.is_published = true
       AND d.published_at > NOW() - INTERVAL '24 months'`,
    [universityId]
  );
  const avgCit = parseFloat(citStats.avg_citations);
  if (avgCit < 2.0) {
    await maybeInsert({
      category:        'research',
      title:           'Low average citation rate',
      description:     `Average citations per paper is ${avgCit.toFixed(2)}, below the 2.0 benchmark. Open-access publishing and mandatory DOI assignment would improve discoverability.`,
      confidenceScore: 0.88,
      actionRequired:  'Implement an open-access mandate and assign DOIs to all published papers.',
      reasoningSteps:  [
        { step: 1, observation: `avg_citations = ${avgCit.toFixed(2)}`, threshold: 2.0 },
        { step: 2, action: 'Recommend open-access and DOI policy' },
      ],
    });
  }

  // ── Rule 2: High-priority unaddressed gaps ────────────────────────────────
  const { rows: [gapStats] } = await pool.query(
    `SELECT COUNT(*) AS count FROM research_gaps
     WHERE (university_id = $1 OR university_id IS NULL)
       AND status = 'unaddressed' AND priority_score >= 8
       AND deleted_at IS NULL`,
    [universityId]
  );
  const highPriorityGaps = parseInt(gapStats.count);
  if (highPriorityGaps > 0) {
    await maybeInsert({
      category:        'research',
      title:           `${highPriorityGaps} high-priority research gap${highPriorityGaps > 1 ? 's' : ''} unaddressed`,
      description:     `${highPriorityGaps} critical knowledge gaps (priority ≥ 8) remain unaddressed. Forming targeted research swarms could close these gaps within 12 months.`,
      confidenceScore: 0.82,
      actionRequired:  'Review the Research Gaps dashboard and assign researchers to each critical area.',
      reasoningSteps:  [
        { step: 1, observation: `${highPriorityGaps} gaps with priority >= 8`, status: 'unaddressed' },
        { step: 2, action: 'Recommend targeted research group formation' },
      ],
    });
  }

  // ── Rule 3: Low upload activity (< 5 docs in last 3 months) ──────────────
  const { rows: [actStats] } = await pool.query(
    `SELECT COUNT(DISTINCT d.id) AS recent_docs
     FROM documents d
     JOIN users u ON u.id = d.uploader_id
     JOIN departments dep ON dep.id = u.department_id
     JOIN faculties fac ON fac.id = dep.faculty_id
     WHERE fac.university_id = $1
       AND d.deleted_at IS NULL AND d.is_published = true
       AND d.published_at > NOW() - INTERVAL '3 months'`,
    [universityId]
  );
  const recentDocs = parseInt(actStats.recent_docs);
  if (recentDocs < 5) {
    await maybeInsert({
      category:        'engagement',
      title:           'Low recent publication activity',
      description:     `Only ${recentDocs} document${recentDocs !== 1 ? 's' : ''} published in the last 3 months. An incentive programme or upload campaign could boost research output.`,
      confidenceScore: 0.75,
      actionRequired:  'Launch a targeted upload campaign with point multipliers for the next 30 days.',
      reasoningSteps:  [
        { step: 1, observation: `${recentDocs} docs in last 3 months`, threshold: 5 },
        { step: 2, action: 'Recommend upload incentive campaign' },
      ],
    });
  }

  // ── Rule 4: No active mentorship pairs ────────────────────────────────────
  const { rows: [mentStats] } = await pool.query(
    `SELECT COUNT(*) AS active_pairs
     FROM mentorship_pairs mp
     JOIN users mentee ON mentee.id = mp.mentee_id
     JOIN departments dep ON dep.id = mentee.department_id
     JOIN faculties fac ON fac.id = dep.faculty_id
     WHERE fac.university_id = $1
       AND mp.status = 'active' AND mp.deleted_at IS NULL`,
    [universityId]
  );
  const activePairs = parseInt(mentStats.active_pairs);
  if (activePairs === 0) {
    await maybeInsert({
      category:        'capacity',
      title:           'No active mentorship pairs',
      description:     'No active mentorship relationships were found. A structured mentorship programme would accelerate junior researcher development.',
      confidenceScore: 0.70,
      actionRequired:  'Promote the mentorship feature and encourage senior researchers to register as mentors.',
      reasoningSteps:  [
        { step: 1, observation: 'active mentorship pairs = 0' },
        { step: 2, action: 'Recommend mentorship programme launch' },
      ],
    });
  }

  return inserted;
}

// ─────────────────────────────────────────────────────────────────────────────
// updateStatus
// ─────────────────────────────────────────────────────────────────────────────

async function updateStatus(id, status, reviewedBy) {
  const { rows: [rec] } = await pool.query(
    `UPDATE strategic_recommendations
     SET status = $1, updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [status, id]
  );
  return rec ?? null;
}

// ── Note: strategic_recommendations does not have an updated_at column in the
//   base migration — migration 012 adds it.

module.exports = { listRecommendations, generateRecommendations, updateStatus };
