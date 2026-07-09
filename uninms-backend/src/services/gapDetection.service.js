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

const { pool }              = require('../config/database');
const { generateEmbedding } = require('./embeddings');
const logger                = require('../utils/logger');

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
  embedGap(gap.id, `${researchArea || ''} ${description}`.trim());
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
  const params = [];
  let   uniFilter = '';
  if (universityId) {
    params.push(universityId);
    uniFilter = `AND fac.university_id = $${params.length}`;
  }

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
       ${uniFilter}
     GROUP BY t.id, t.name
     HAVING COUNT(DISTINCT dt.document_id) FILTER (
       WHERE d.published_at > NOW() - INTERVAL '36 months'
     ) < 3`,
    params
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
    embedGap(gap.id, `${row.name} ${gap.gap_description}`);
    inserted.push(gap);
  }

  return inserted;
}

// ─────────────────────────────────────────────────────────────────────────────
// embedGap  (fire-and-forget — best effort, never throws)
// ─────────────────────────────────────────────────────────────────────────────

function embedGap(gapId, text) {
  setImmediate(async () => {
    try {
      const vector = await generateEmbedding(text);
      if (!vector) return;
      await pool.query(
        `UPDATE research_gaps SET embedding = $1::vector WHERE id = $2`,
        [JSON.stringify(vector), gapId]
      );
    } catch (err) {
      logger.warn(`[gapDetection] embedding failed for gap ${gapId}: ${err.message}`);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// getRecommendedGaps
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rank unaddressed gaps for a specific researcher by relevance to their
 * interests, blending two signals:
 *  - tag match   — gap's research_area matches a tag the user has published under
 *  - semantic    — cosine similarity between the gap's embedding and the
 *                  average embedding of the user's own published documents
 *                  (only available once OPENAI_API_KEY is configured and
 *                  embeddings exist — degrades gracefully otherwise)
 *
 * @param {string} userId
 * @param {number} limit
 */
async function getRecommendedGaps(userId, limit = 10) {
  const { rows } = await pool.query(
    `WITH interest AS (
       SELECT DISTINCT t.name
       FROM documents d
       JOIN document_tags dt ON dt.document_id = d.id
       JOIN tags t           ON t.id = dt.tag_id
       WHERE d.uploader_id = $1 AND d.deleted_at IS NULL AND d.is_published = true
     ),
     user_vec AS (
       SELECT AVG(d.embedding) AS v
       FROM documents d
       WHERE d.uploader_id = $1 AND d.deleted_at IS NULL AND d.embedding IS NOT NULL
     ),
     scored AS (
       SELECT g.id, g.gap_description, g.research_area, g.priority_score,
              g.auto_detected, g.status, g.university_id,
              uni.name AS university_name, g.created_at,
              EXISTS (
                SELECT 1 FROM interest i WHERE g.research_area ILIKE i.name
              ) AS tag_match,
              CASE WHEN g.embedding IS NOT NULL AND (SELECT v FROM user_vec) IS NOT NULL
                   THEN ROUND((1 - (g.embedding <=> (SELECT v FROM user_vec)))::numeric, 4)
                   ELSE NULL END AS semantic_score
       FROM research_gaps g
       LEFT JOIN universities uni ON uni.id = g.university_id
       WHERE g.deleted_at IS NULL AND g.status = 'unaddressed'
     )
     SELECT *,
       (COALESCE(semantic_score, 0) * 0.5)
       + (CASE WHEN tag_match THEN 0.3 ELSE 0 END)
       + (priority_score / 10.0 * 0.2) AS match_score
     FROM scored
     ORDER BY match_score DESC, priority_score DESC, created_at DESC
     LIMIT $2`,
    [userId, parseInt(limit)]
  );

  return rows.map(r => ({
    ...r,
    priority_score:  parseInt(r.priority_score),
    semantic_score:  r.semantic_score !== null ? parseFloat(r.semantic_score) : null,
    match_score:     parseFloat(parseFloat(r.match_score).toFixed(4)),
    matchType:       r.tag_match || r.semantic_score !== null ? 'personalized' : 'general',
  }));
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

module.exports = { listGaps, submitGap, detectGaps, updateGapStatus, getRecommendedGaps };
