const express  = require('express');
const { pool } = require('../config/database');
const { AppError } = require('../utils/AppError');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const STAGES = ['idea', 'proposal', 'active', 'review', 'published'];

const projectSelect = `
  rp.id, rp.title, rp.abstract, rp.research_type, rp.stage,
  rp.start_date, rp.target_end_date, rp.actual_end_date,
  rp.funding_source, rp.funding_amount, rp.keywords,
  rp.ethical_approval, rp.is_public, rp.created_at, rp.updated_at,
  u.full_name AS lead_name, u.profile_photo_url AS lead_photo, u.id AS lead_id,
  dep.name AS department_name`;

// ── GET /research/projects ─────────────────────────────────────────────────────
router.get('/projects', authenticate, async (req, res, next) => {
  try {
    const { stage, type, mine } = req.query;
    const where = ['rp.deleted_at IS NULL'];
    const values = [];
    let idx = 1;

    if (stage) { where.push(`rp.stage = $${idx}`); values.push(stage); idx++; }
    if (type)  { where.push(`rp.research_type = $${idx}`); values.push(type); idx++; }
    if (mine === 'true') {
      where.push(`(rp.lead_researcher_id = $${idx} OR EXISTS (
        SELECT 1 FROM research_project_members rpm
        WHERE rpm.project_id = rp.id AND rpm.user_id = $${idx}
      ))`);
      values.push(req.user.id); idx++;
    }

    const { rows } = await pool.query(
      `SELECT ${projectSelect},
              (SELECT COUNT(*) FROM research_project_members WHERE project_id = rp.id) AS member_count,
              (SELECT COUNT(*) FROM research_milestones WHERE project_id = rp.id) AS milestone_count,
              (SELECT COUNT(*) FROM research_milestones WHERE project_id = rp.id AND is_done = true) AS done_count,
              (SELECT COUNT(*) FROM research_outputs WHERE project_id = rp.id) AS output_count
       FROM research_projects rp
       JOIN users u ON u.id = rp.lead_researcher_id
       LEFT JOIN departments dep ON dep.id = rp.department_id
       WHERE ${where.join(' AND ')}
       ORDER BY rp.created_at DESC`,
      values
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── POST /research/projects ────────────────────────────────────────────────────
router.post('/projects', authenticate, async (req, res, next) => {
  try {
    const {
      title, abstract, researchType = 'applied',
      startDate, targetEndDate, fundingSource, fundingAmount,
      keywords, isPublic = true,
    } = req.body;

    if (!title || title.trim().length < 5)
      throw new AppError('Title must be at least 5 characters', 422, 'VALIDATION_ERROR');

    const { rows: [user] } = await pool.query(`SELECT department_id FROM users WHERE id=$1`, [req.user.id]);

    const { rows: [project] } = await pool.query(
      `INSERT INTO research_projects
         (title, abstract, research_type, lead_researcher_id, department_id,
          start_date, target_end_date, funding_source, funding_amount, keywords, is_public)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [title.trim(), abstract || null, researchType, req.user.id,
       user?.department_id || null, startDate || null, targetEndDate || null,
       fundingSource || null, fundingAmount || null,
       keywords ? `{${keywords.map(k => `"${k}"`).join(',')}}` : null,
       isPublic]
    );

    // Auto-add lead as a member
    await pool.query(
      `INSERT INTO research_project_members (project_id, user_id, role)
       VALUES ($1,$2,'lead') ON CONFLICT DO NOTHING`,
      [project.id, req.user.id]
    );

    res.status(201).json({ success: true, data: project });
  } catch (err) { next(err); }
});

// ── GET /research/projects/:id ─────────────────────────────────────────────────
router.get('/projects/:id', authenticate, async (req, res, next) => {
  try {
    const { rows: [project] } = await pool.query(
      `SELECT ${projectSelect}
       FROM research_projects rp
       JOIN users u ON u.id = rp.lead_researcher_id
       LEFT JOIN departments dep ON dep.id = rp.department_id
       WHERE rp.id=$1 AND rp.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');

    const [{ rows: members }, { rows: milestones }, { rows: outputs }] = await Promise.all([
      pool.query(
        `SELECT rpm.user_id, rpm.role, rpm.joined_at,
                u.full_name, u.profile_photo_url, dep.name AS department_name
         FROM research_project_members rpm
         JOIN users u ON u.id = rpm.user_id
         LEFT JOIN departments dep ON dep.id = u.department_id
         WHERE rpm.project_id=$1`,
        [req.params.id]
      ),
      pool.query(
        `SELECT * FROM research_milestones
         WHERE project_id=$1 ORDER BY due_date ASC NULLS LAST, created_at ASC`,
        [req.params.id]
      ),
      pool.query(
        `SELECT ro.*, d.title AS doc_title
         FROM research_outputs ro
         LEFT JOIN documents d ON d.id = ro.document_id
         WHERE ro.project_id=$1 ORDER BY ro.created_at DESC`,
        [req.params.id]
      ),
    ]);

    res.json({ success: true, data: { ...project, members, milestones, outputs } });
  } catch (err) { next(err); }
});

// ── PATCH /research/projects/:id ──────────────────────────────────────────────
router.patch('/projects/:id', authenticate, async (req, res, next) => {
  try {
    const { rows: [p] } = await pool.query(
      `SELECT lead_researcher_id FROM research_projects WHERE id=$1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!p) throw new AppError('Project not found', 404, 'NOT_FOUND');
    if (p.lead_researcher_id !== req.user.id)
      throw new AppError('Only the project lead can edit', 403, 'FORBIDDEN');

    const { title, abstract, stage, researchType, startDate, targetEndDate,
            fundingSource, fundingAmount, keywords, isPublic, ethicalApproval } = req.body;

    if (stage && !STAGES.includes(stage))
      throw new AppError('Invalid stage', 422, 'VALIDATION_ERROR');

    const { rows: [updated] } = await pool.query(
      `UPDATE research_projects SET
         title             = COALESCE($1, title),
         abstract          = COALESCE($2, abstract),
         stage             = COALESCE($3, stage),
         research_type     = COALESCE($4, research_type),
         start_date        = COALESCE($5, start_date),
         target_end_date   = COALESCE($6, target_end_date),
         funding_source    = COALESCE($7, funding_source),
         funding_amount    = COALESCE($8, funding_amount),
         ethical_approval  = COALESCE($9, ethical_approval),
         is_public         = COALESCE($10, is_public),
         actual_end_date   = CASE WHEN $3 = 'published' THEN NOW()::DATE ELSE actual_end_date END,
         updated_at        = NOW()
       WHERE id=$11 RETURNING *`,
      [title||null, abstract||null, stage||null, researchType||null,
       startDate||null, targetEndDate||null, fundingSource||null, fundingAmount||null,
       ethicalApproval !== undefined ? ethicalApproval : null,
       isPublic !== undefined ? isPublic : null,
       req.params.id]
    );
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ── POST /research/projects/:id/members ───────────────────────────────────────
router.post('/projects/:id/members', authenticate, async (req, res, next) => {
  try {
    const { rows: [p] } = await pool.query(
      `SELECT lead_researcher_id FROM research_projects WHERE id=$1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!p) throw new AppError('Project not found', 404, 'NOT_FOUND');
    if (p.lead_researcher_id !== req.user.id)
      throw new AppError('Only the project lead can manage members', 403, 'FORBIDDEN');

    const { userId, role = 'collaborator' } = req.body;
    if (!userId) throw new AppError('userId is required', 422, 'VALIDATION_ERROR');

    const { rows: [target] } = await pool.query(
      `SELECT id FROM users WHERE id=$1 AND deleted_at IS NULL`, [userId]
    );
    if (!target) throw new AppError('User not found', 404, 'NOT_FOUND');

    await pool.query(
      `INSERT INTO research_project_members (project_id, user_id, role)
       VALUES ($1,$2,$3) ON CONFLICT (project_id, user_id) DO UPDATE SET role=$3`,
      [req.params.id, userId, role]
    );
    res.json({ success: true, message: 'Member added' });
  } catch (err) { next(err); }
});

// ── DELETE /research/projects/:id/members/:userId ─────────────────────────────
router.delete('/projects/:id/members/:userId', authenticate, async (req, res, next) => {
  try {
    const { rows: [p] } = await pool.query(
      `SELECT lead_researcher_id FROM research_projects WHERE id=$1`, [req.params.id]
    );
    if (!p || p.lead_researcher_id !== req.user.id)
      throw new AppError('Not authorized', 403, 'FORBIDDEN');

    await pool.query(
      `DELETE FROM research_project_members WHERE project_id=$1 AND user_id=$2`,
      [req.params.id, req.params.userId]
    );
    res.json({ success: true, message: 'Member removed' });
  } catch (err) { next(err); }
});

// ── POST /research/projects/:id/milestones ────────────────────────────────────
router.post('/projects/:id/milestones', authenticate, async (req, res, next) => {
  try {
    const { rows: [p] } = await pool.query(
      `SELECT lead_researcher_id FROM research_projects WHERE id=$1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!p) throw new AppError('Project not found', 404, 'NOT_FOUND');

    const { rows: [member] } = await pool.query(
      `SELECT 1 FROM research_project_members WHERE project_id=$1 AND user_id=$2`,
      [req.params.id, req.user.id]
    );
    if (p.lead_researcher_id !== req.user.id && !member)
      throw new AppError('Not a project member', 403, 'FORBIDDEN');

    const { title, description, dueDate } = req.body;
    if (!title || title.trim().length < 2)
      throw new AppError('Milestone title is required', 422, 'VALIDATION_ERROR');

    const { rows: [milestone] } = await pool.query(
      `INSERT INTO research_milestones (project_id, title, description, due_date)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, title.trim(), description || null, dueDate || null]
    );
    res.status(201).json({ success: true, data: milestone });
  } catch (err) { next(err); }
});

// ── PATCH /research/projects/:id/milestones/:mId ──────────────────────────────
router.patch('/projects/:id/milestones/:mId', authenticate, async (req, res, next) => {
  try {
    const { isDone, title, description, dueDate } = req.body;
    const { rows: [m] } = await pool.query(
      `UPDATE research_milestones SET
         is_done      = COALESCE($1, is_done),
         completed_at = CASE WHEN $1 = true THEN NOW() WHEN $1 = false THEN NULL ELSE completed_at END,
         title        = COALESCE($2, title),
         description  = COALESCE($3, description),
         due_date     = COALESCE($4, due_date)
       WHERE id=$5 AND project_id=$6 RETURNING *`,
      [isDone !== undefined ? isDone : null,
       title||null, description||null, dueDate||null,
       req.params.mId, req.params.id]
    );
    if (!m) throw new AppError('Milestone not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: m });
  } catch (err) { next(err); }
});

// ── POST /research/projects/:id/outputs ───────────────────────────────────────
router.post('/projects/:id/outputs', authenticate, async (req, res, next) => {
  try {
    const { rows: [p] } = await pool.query(
      `SELECT lead_researcher_id FROM research_projects WHERE id=$1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!p) throw new AppError('Project not found', 404, 'NOT_FOUND');

    const { rows: [member] } = await pool.query(
      `SELECT 1 FROM research_project_members WHERE project_id=$1 AND user_id=$2`,
      [req.params.id, req.user.id]
    );
    if (p.lead_researcher_id !== req.user.id && !member)
      throw new AppError('Not a project member', 403, 'FORBIDDEN');

    const { documentId, outputType = 'paper', title, externalUrl, publishedAt } = req.body;

    const { rows: [output] } = await pool.query(
      `INSERT INTO research_outputs (project_id, document_id, output_type, title, external_url, published_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, documentId || null, outputType,
       title || null, externalUrl || null, publishedAt || null]
    );
    res.status(201).json({ success: true, data: output });
  } catch (err) { next(err); }
});

// ── GET /research/projects/:id/intelligence ───────────────────────────────────
router.get('/projects/:id/intelligence', authenticate, async (req, res, next) => {
  try {
    const { rows: [p] } = await pool.query(
      `SELECT keywords, research_type FROM research_projects WHERE id=$1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!p) throw new AppError('Project not found', 404, 'NOT_FOUND');

    // Match gaps by keyword overlap
    let gaps = [];
    if (p.keywords && p.keywords.length > 0) {
      const conditions = p.keywords.map((_, i) => `research_area ILIKE $${i + 1}`).join(' OR ');
      const { rows } = await pool.query(
        `SELECT id, gap_description, research_area, priority_score
         FROM research_gaps
         WHERE status='unaddressed' AND deleted_at IS NULL AND (${conditions})
         ORDER BY priority_score DESC LIMIT 5`,
        p.keywords.map(k => `%${k}%`)
      );
      gaps = rows;
    }
    // Fallback to top gaps
    if (gaps.length === 0) {
      const { rows } = await pool.query(
        `SELECT id, gap_description, research_area, priority_score
         FROM research_gaps
         WHERE status='unaddressed' AND deleted_at IS NULL
         ORDER BY priority_score DESC LIMIT 3`
      );
      gaps = rows;
    }

    // Suggested collaborators: users with docs tagged with this project's keywords
    let collaborators = [];
    if (p.keywords && p.keywords.length > 0) {
      const conditions = p.keywords.map((_, i) => `t.name ILIKE $${i + 2}`).join(' OR ');
      const { rows } = await pool.query(
        `SELECT u.id, u.full_name, u.profile_photo_url, dep.name AS department_name,
                COUNT(DISTINCT t.id) AS match_count
         FROM users u
         JOIN documents d ON d.uploader_id = u.id AND d.deleted_at IS NULL
         JOIN document_tags dt ON dt.document_id = d.id
         JOIN tags t ON t.id = dt.tag_id
         LEFT JOIN departments dep ON dep.id = u.department_id
         WHERE u.id != $1 AND u.deleted_at IS NULL AND u.status='active'
           AND (${conditions})
         GROUP BY u.id, u.full_name, u.profile_photo_url, dep.name
         ORDER BY match_count DESC LIMIT 5`,
        [req.user.id, ...p.keywords.map(k => `%${k}%`)]
      );
      collaborators = rows;
    }

    res.json({ success: true, data: { gaps, collaborators } });
  } catch (err) { next(err); }
});

module.exports = router;
