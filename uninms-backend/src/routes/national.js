'use strict';

/**
 * National Hub — /api/v1/national
 *
 * Aggregate national-level academic statistics:
 *   GET  /national/stats      — platform-wide counts
 *   GET  /national/top-universities — ranked by research output
 *   GET  /national/recent-assets   — recently registered IK assets
 *   GET  /national/ik-categories   — asset count per cultural context category
 */

const express      = require('express');
const { pool }     = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /national/stats — headline numbers for the national hub
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const [communities, assets, universities, researchers, documents, forums] = await Promise.all([
      pool.query(`SELECT COUNT(DISTINCT community_name) AS count FROM community_reps WHERE verified = TRUE`),
      pool.query(`SELECT COUNT(*) AS count FROM indigenous_knowledge WHERE deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*) AS count FROM universities WHERE deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*) AS count FROM users u
                  JOIN user_roles ur ON ur.user_id = u.id
                  JOIN roles r ON r.id = ur.role_id
                  WHERE r.name IN ('lecturer') AND u.deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*) AS count FROM documents WHERE deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*) AS count FROM forum_threads WHERE deleted_at IS NULL`),
    ]);

    res.json({
      success: true,
      data: {
        verified_communities: parseInt(communities.rows[0].count),
        ik_assets:            parseInt(assets.rows[0].count),
        universities:         parseInt(universities.rows[0].count),
        researchers:          parseInt(researchers.rows[0].count),
        documents:            parseInt(documents.rows[0].count),
        forum_threads:        parseInt(forums.rows[0].count),
      },
    });
  } catch (err) { next(err); }
});

// GET /national/top-universities — top 10 by research output score
router.get('/top-universities', authenticate, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.state,
              COUNT(DISTINCT rp.id) AS project_count,
              COUNT(DISTINCT rg.id) AS gap_count,
              COUNT(DISTINCT d.id)  AS document_count,
              (COUNT(DISTINCT rp.id) * 3 + COUNT(DISTINCT d.id)) AS output_score
       FROM universities u
       LEFT JOIN users usr ON usr.university_id = u.id
       LEFT JOIN research_projects rp ON rp.lead_researcher_id = usr.id
       LEFT JOIN research_gaps rg ON rg.university_id = u.id
       LEFT JOIN documents d ON d.uploader_id = usr.id AND d.deleted_at IS NULL
       WHERE u.deleted_at IS NULL
       GROUP BY u.id
       ORDER BY output_score DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /national/recent-assets — recent IK assets (public metadata only)
router.get('/recent-assets', authenticate, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const { rows } = await pool.query(
      `SELECT ik.id, ik.title, ik.community_name, ik.access_level,
              ik.is_sacred, ik.cultural_context, ik.created_at,
              u.full_name AS registered_by_name
       FROM indigenous_knowledge ik
       LEFT JOIN users u ON u.id = ik.registered_by
       WHERE ik.deleted_at IS NULL
         AND ik.access_level IN ('open', 'abstract_only', 'full_with_consent')
       ORDER BY ik.created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /national/ik-categories — asset breakdown by cultural context keyword
router.get('/ik-categories', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         COALESCE(NULLIF(TRIM(cultural_context), ''), 'Uncategorised') AS category,
         COUNT(*) AS asset_count
       FROM indigenous_knowledge
       WHERE deleted_at IS NULL
       GROUP BY category
       ORDER BY asset_count DESC
       LIMIT 20`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

module.exports = router;
