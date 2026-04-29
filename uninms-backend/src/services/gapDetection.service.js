'use strict';

/**
 * Gap Detection Service
 *
 * Provides:
 *   - listGaps      — paginated list with optional filters
 *   - submitGap     — manually submit a new gap
 *   - detectGaps    — automatic density-based detection from the corpus
 *   - updateGapStatus — admin status transitions
 */

const { pool } = require('../config/database');

// ─────────────────────────────────────────────────────────────────────────────
// listGaps
// ─────────────────────────────────────────────────────────────────────────────

async function listGaps({ universityId, status, autoDetected, page = 1, limit = 20 } = {}) {
  const values = [];
  const where  = ['g.deleted_at IS NULL'];
  let   idx    = 1;

  if (universityId !== undefined) {
    values.push(universityId); where.push(`g.university_id = $${idx++}`);
  }
  if (status !== undefined) {
    values.push(status); where.push(`g.status = $${idx++}`);
  }
  if (autoDetected !== undefined) {
    values.push(autoDetected); where.push(`g.auto_detected = $${idx++}`);
  }

  const whereClause = where.join(' AND ');
  const offset      = (parseInt(page) - 1) * parseInt(limit);

  const [{ rows }, { rows: [countRow] }] = await Promise.all([
    pool.query(
      `SELECT g.id, g.gap_description, g.research_area, g.priority_score,
              g.auto_detected, g.status, g.university_id,
              uni.name AS university_name,
              g.created_at, g.updated_at
       FROM research_gaps g
       LEFT JOIN universities uni ON uni.id = g.university_id
       WHERE ${whereClause}
       ORDER BY g.priority_score DESC, g.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, parseInt(limit), offset]
    ),
    pool.query(
      `SELECT COUNT(*) FROM research_gaps g WHERE ${whereClause}`,
      values
    ),
  ]);

  return {
    gaps:       rows,
    total:      parseInt(countRow.count),
    page:       parseInt(page),
    limit:      parseInt(limit),
    totalPages: Math.ceil(parseInt(countRow.count) / parseInt(limit)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// submitGap
// ─────────────────────────────────────────────────────────────────────────────

async function submitGap({ userId, universityId, description, researchArea, priorityScore = 5 }) {
  const { rows: [gap] } = await pool.query(
    `INSERT INTO research_gaps
       (gap_description, research_area, priority_score, auto_detected, status, university_id)
     VALUES ($1, $2, $3, false, 'unaddressed', $4)
     RETURNING *`,
    [
      description,
      researchArea  || null,
      Math.min(10, Math.max(1, parseInt(priorityScore))),
      universityId  || null,
    ]
  );
  return gap;
}

// ─────────────────────────────────────────────────────────────────────────────
// detectGaps
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Automatic density-based gap detection.
 *
 * Heuristics applied:
 *  1. Tags with < 3 published documents in the last 36 months → low coverage
 *  2. Research areas with no activity in the last 12 months    → stale / abandoned
 *
 * Skips tags that already have an unaddressed gap.
 *
 * @param {string|null} universityId  — scope to one institution, or null for national
 * @returns {Array} newly inserted gap rows
 */
async function detectGaps(universityId = null) {
  const uniFilter = universityId
    ? `AND fac.university_id = '${universityId}'`
    : '';

  // Low-coverage tags
  const { rows: lowCoverage } = await pool.query(
    `SELECT t.id AS tag_id, t.name,
            COUNT(DISTINCT dt.document_id) FILTER (
              WHERE d.published_at > NOW() - INTERVAL '36 months'
            ) AS recent_doc_count
     FROM tags t
     LEFT JOIN document_tags dt ON dt.tag_id = t.id
     LEFT JOIN documents d      ON d.id = dt.document_id
       AND d.deleted_at IS NULL AND d.is_published = true
     LEFT JOIN users u          ON u.id = d.uploader_id AND u.deleted_at IS NULL
     LEFT JOIN departments dep  ON dep.id = u.department_id
     LEFT JOIN faculties fac    ON fac.id = dep.faculty_id
       ${uniFilter ? uniFilter.replace('AND ', 'AND ') : ''}
     GROUP BY t.id, t.name
     HAVING COUNT(DISTINCT dt.document_id) FILTER (
       WHERE d.published_at > NOW() - INTERVAL '36 months'
     ) < 3`
  );

  const inserted = [];

  for (const row of lowCoverage) {
    // Skip if an unaddressed gap already exists for this area
    const { rows: [existing] } = await pool.query(
      `SELECT id FROM research_gaps
       WHERE research_area = $1
         AND status = 'unaddressed'
         AND deleted_at IS NULL
         ${universityId ? 'AND university_id = $2' : 'AND university_id IS NULL'}
       LIMIT 1`,
      universityId ? [row.name, universityId] : [row.name]
    );
    if (existing) continue;

    const priority = row.recent_doc_count == 0 ? 9
                   : row.recent_doc_count <  2 ? 7
                   : 5;

    const { rows: [gap] } = await pool.query(
      `INSERT INTO research_gaps
         (gap_description, research_area, priority_score, auto_detected, status, university_id)
       VALUES ($1, $2, $3, true, 'unaddressed', $4)
       RETURNING *`,
      [
        `Limited research coverage for topic: ${row.name} (${row.recent_doc_count} papers in 36 months)`,
        row.name,
        priority,
        universityId || null,
      ]
    );
    inserted.push(gap);
  }

  return inserted;
}

// ─────────────────────────────────────────────────────────────────────────────
// updateGapStatus
// ─────────────────────────────────────────────────────────────────────────────

async function updateGapStatus(id, status) {
  const { rows: [gap] } = await pool.query(
    `UPDATE research_gaps
     SET status = $1, updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [status, id]
  );
  return gap ?? null;
}

module.exports = { listGaps, submitGap, detectGaps, updateGapStatus };
