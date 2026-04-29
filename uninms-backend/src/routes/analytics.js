const express  = require('express');
const { pool } = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /analytics/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [docsResult, pointsResult, citationsResult] = await Promise.all([
      pool.query(
        `SELECT doc_type, COUNT(*) AS count,
                COALESCE(SUM(view_count),0) AS total_views,
                COALESCE(SUM(download_count),0) AS total_downloads,
                COALESCE(SUM(citation_count),0) AS total_citations
         FROM documents WHERE uploader_id = $1 AND deleted_at IS NULL
         GROUP BY doc_type`, [userId]
      ),
      pool.query(
        `SELECT total_points, current_level, level_number
         FROM reward_levels WHERE user_id = $1`, [userId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(citation_count),0) AS total_citations
         FROM documents WHERE uploader_id = $1 AND deleted_at IS NULL`, [userId]
      ),
    ]);

    res.json({
      success: true,
      data: {
        documents:     docsResult.rows,
        level:         pointsResult.rows[0] || { total_points: 0, current_level: 'Contributor' },
        totalCitations: parseInt(citationsResult.rows[0]?.total_citations || 0),
      },
    });
  } catch (err) { next(err); }
});

// GET /analytics/university — admin only
router.get('/university', authenticate, requireRole('admin','management','super_admin'), async (req, res, next) => {
  try {
    const uniId = req.query.universityId;

    const [usersResult, docsResult, submissionsResult, topDocsResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS total_users,
                COUNT(*) FILTER (WHERE ${ uniId ? "u.university_id = $1 AND " : "" }
                  ur.role_id = (SELECT id FROM roles WHERE name = 'student')) AS students
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         WHERE u.deleted_at IS NULL${uniId ? ' AND u.university_id = $1' : ''}`,
        uniId ? [uniId] : []
      ),
      pool.query(
        `SELECT COUNT(*) AS total_documents,
                COALESCE(SUM(citation_count),0) AS total_citations
         FROM documents WHERE deleted_at IS NULL AND is_published = true`
      ),
      pool.query(
        `SELECT COUNT(*) AS total_submissions,
                COUNT(*) FILTER (WHERE plagiarism_score > 0.3) AS flagged
         FROM submissions WHERE deleted_at IS NULL`
      ),
      pool.query(
        `SELECT d.id, d.title, d.citation_count, d.view_count,
                u.full_name AS uploader_name, dep.name AS department_name
         FROM documents d
         LEFT JOIN users u ON u.id = d.uploader_id
         LEFT JOIN departments dep ON dep.id = d.department_id
         WHERE d.deleted_at IS NULL AND d.is_published = true
         ORDER BY d.citation_count DESC LIMIT 5`
      ),
    ]);

    res.json({
      success: true,
      data: {
        users:        usersResult.rows[0],
        documents:    docsResult.rows[0],
        submissions:  submissionsResult.rows[0],
        topDocuments: topDocsResult.rows,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
