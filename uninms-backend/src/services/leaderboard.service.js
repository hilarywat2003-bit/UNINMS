'use strict';

/**
 * Leaderboard Service
 *
 * Provides:
 *   - getLeaderboard      — retrieve computed rankings for a period
 *   - computeLeaderboard  — (re)compute and persist rankings
 *
 * Rankings are computed per-university and stored in the `leaderboard_rankings`
 * table (created in migration 012). If the table doesn't exist yet the service
 * falls back to computing on the fly.
 */

const { pool } = require('../config/database');
const logger   = require('../utils/logger');

const VALID_PERIODS = ['monthly', 'quarterly', 'annual'];

// ─────────────────────────────────────────────────────────────────────────────
// getLeaderboard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns stored rankings for the period, or computes them if none exist.
 * @param {'monthly'|'quarterly'|'annual'} period
 */
async function getLeaderboard(period = 'quarterly') {
  if (!VALID_PERIODS.includes(period)) period = 'quarterly';

  // Try stored rankings first
  try {
    const { rows } = await pool.query(
      `SELECT lr.rank_position, lr.university_id, lr.period,
              lr.doc_count, lr.total_citations, lr.active_researchers,
              lr.avg_peer_rating, lr.computed_at,
              uni.name AS university_name, uni.state
       FROM leaderboard_rankings lr
       JOIN universities uni ON uni.id = lr.university_id
       WHERE lr.period = $1
       ORDER BY lr.rank_position ASC
       LIMIT 100`,
      [period]
    );
    if (rows.length > 0) return rows;
  } catch {
    // Table may not exist yet — fall through to live compute
  }

  // Live compute (no caching)
  return _computeLive(period);
}

// ─────────────────────────────────────────────────────────────────────────────
// computeLeaderboard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute rankings and persist them, replacing any existing rows for the period.
 * @param {'monthly'|'quarterly'|'annual'} period
 */
async function computeLeaderboard(period = 'quarterly') {
  if (!VALID_PERIODS.includes(period)) period = 'quarterly';

  const rows = await _computeLive(period);

  try {
    // Delete stale rows for this period then bulk-insert
    await pool.query(`DELETE FROM leaderboard_rankings WHERE period = $1`, [period]);

    for (const row of rows) {
      await pool.query(
        `INSERT INTO leaderboard_rankings
           (university_id, period, rank_position, doc_count, total_citations,
            active_researchers, avg_peer_rating, computed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          row.university_id,
          period,
          row.rank_position,
          row.doc_count,
          row.total_citations,
          row.active_researchers,
          row.avg_peer_rating,
        ]
      );
    }
    logger.info(`[leaderboard] computed ${rows.length} rankings for period=${period}`);
  } catch (err) {
    logger.warn(`[leaderboard] could not persist rankings (table may not exist): ${err.message}`);
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// _computeLive  (internal)
// ─────────────────────────────────────────────────────────────────────────────

async function _computeLive(period) {
  const interval = period === 'monthly'   ? '1 month'
                 : period === 'quarterly' ? '3 months'
                 : '12 months';

  const { rows } = await pool.query(
    `SELECT uni.id AS university_id,
            uni.name AS university_name,
            uni.state,
            COUNT(DISTINCT d.id)                                  AS doc_count,
            COALESCE(SUM(d.citation_count), 0)                    AS total_citations,
            COUNT(DISTINCT u.id)                                   AS active_researchers,
            ROUND(
              COALESCE(AVG(d.average_peer_rating)
                FILTER (WHERE d.average_peer_rating IS NOT NULL), 0)::numeric, 2
            )                                                      AS avg_peer_rating,
            ROW_NUMBER() OVER (
              ORDER BY COALESCE(SUM(d.citation_count), 0) DESC,
                       COUNT(DISTINCT d.id) DESC
            )                                                      AS rank_position
     FROM universities uni
     LEFT JOIN faculties   fac ON fac.university_id = uni.id
     LEFT JOIN departments dep ON dep.faculty_id = fac.id
     LEFT JOIN users u
           ON u.department_id = dep.id AND u.deleted_at IS NULL
     LEFT JOIN documents d
           ON d.uploader_id = u.id
          AND d.deleted_at IS NULL AND d.is_published = true
          AND d.published_at > NOW() - INTERVAL '${interval}'
     WHERE uni.deleted_at IS NULL
     GROUP BY uni.id, uni.name, uni.state
     ORDER BY rank_position ASC
     LIMIT 100`
  );

  return rows.map(r => ({
    rank_position:      parseInt(r.rank_position),
    university_id:      r.university_id,
    university_name:    r.university_name,
    state:              r.state,
    period,
    doc_count:          parseInt(r.doc_count),
    total_citations:    parseInt(r.total_citations),
    active_researchers: parseInt(r.active_researchers),
    avg_peer_rating:    parseFloat(r.avg_peer_rating),
  }));
}

module.exports = { getLeaderboard, computeLeaderboard };
