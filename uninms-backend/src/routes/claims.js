const express  = require('express');
const { pool } = require('../config/database');
const { AppError } = require('../utils/AppError');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const claimSelect = `
  ic.id, ic.title, ic.claim_type, ic.description, ic.organization, ic.location,
  ic.implementation_date, ic.evidence_url, ic.impact_summary,
  ic.status, ic.review_note, ic.endorsement_count, ic.created_at,
  u.full_name AS submitter_name, u.profile_photo_url AS submitter_photo,
  dep.name AS submitter_department,
  d.title AS document_title, d.id AS document_id,
  (ic.submitter_id = $1) AS is_mine,
  EXISTS(SELECT 1 FROM claim_endorsements WHERE claim_id=ic.id AND user_id=$1) AS endorsed`;

// GET /claims — list claims
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { type, status = 'approved', mine } = req.query;
    const where = [];
    const values = [req.user.id];
    let idx = 2;

    if (mine === 'true') {
      where.push(`ic.submitter_id = $1`);
    } else {
      where.push(`ic.status = $${idx++}`);
      values.push(status);
    }
    if (type) { where.push(`ic.claim_type = $${idx++}`); values.push(type); }

    const { rows } = await pool.query(
      `SELECT ${claimSelect}
       FROM implementation_claims ic
       JOIN users u ON u.id = ic.submitter_id
       LEFT JOIN departments dep ON dep.id = u.department_id
       LEFT JOIN documents d ON d.id = ic.document_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY ic.created_at DESC
       LIMIT 50`,
      values
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /claims — submit a claim
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { title, claimType = 'practice', description, documentId,
            organization, location, implementationDate, evidenceUrl, impactSummary } = req.body;

    if (!title || title.trim().length < 5)
      throw new AppError('Title must be at least 5 characters', 422, 'VALIDATION_ERROR');
    if (!description || description.trim().length < 20)
      throw new AppError('Description must be at least 20 characters', 422, 'VALIDATION_ERROR');

    const { rows: [claim] } = await pool.query(
      `INSERT INTO implementation_claims
         (submitter_id, document_id, title, claim_type, description,
          organization, location, implementation_date, evidence_url, impact_summary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [req.user.id, documentId || null, title.trim(), claimType, description.trim(),
       organization || null, location || null, implementationDate || null,
       evidenceUrl || null, impactSummary || null]
    );
    res.status(201).json({ success: true, data: claim });
  } catch (err) { next(err); }
});

// GET /claims/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { rows: [claim] } = await pool.query(
      `SELECT ${claimSelect},
              reviewer.full_name AS reviewer_name, ic.reviewed_at
       FROM implementation_claims ic
       JOIN users u ON u.id = ic.submitter_id
       LEFT JOIN departments dep ON dep.id = u.department_id
       LEFT JOIN documents d ON d.id = ic.document_id
       LEFT JOIN users reviewer ON reviewer.id = ic.reviewed_by
       WHERE ic.id = $2`,
      [req.user.id, req.params.id]
    );
    if (!claim) throw new AppError('Claim not found', 404, 'NOT_FOUND');

    const { rows: endorsements } = await pool.query(
      `SELECT ce.id, ce.comment, ce.created_at,
              u.full_name, u.profile_photo_url, dep.name AS department_name
       FROM claim_endorsements ce
       JOIN users u ON u.id = ce.user_id
       LEFT JOIN departments dep ON dep.id = u.department_id
       WHERE ce.claim_id = $1
       ORDER BY ce.created_at DESC`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...claim, endorsements } });
  } catch (err) { next(err); }
});

// PATCH /claims/:id/review — admin approves / rejects / requests revision
router.patch('/:id/review', authenticate, async (req, res, next) => {
  try {
    // Check reviewer has admin/moderator role
    const { rows: [role] } = await pool.query(
      `SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id
       WHERE ur.user_id=$1 AND r.name IN ('admin','moderator','staff')
       LIMIT 1`,
      [req.user.id]
    );
    if (!role) throw new AppError('Only staff can review claims', 403, 'FORBIDDEN');

    const { status, reviewNote } = req.body;
    if (!['approved', 'rejected', 'revision_needed'].includes(status))
      throw new AppError('Invalid status', 422, 'VALIDATION_ERROR');

    const { rows: [updated] } = await pool.query(
      `UPDATE implementation_claims
       SET status=$1, review_note=$2, reviewed_by=$3, reviewed_at=NOW(), updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [status, reviewNote || null, req.user.id, req.params.id]
    );
    if (!updated) throw new AppError('Claim not found', 404, 'NOT_FOUND');

    // Award points on approval
    if (status === 'approved') {
      await pool.query(
        `INSERT INTO points_log (user_id, action_type, points, reference_id)
         VALUES ($1, 'claim_approved', 50, $2)
         ON CONFLICT DO NOTHING`,
        [updated.submitter_id, updated.id]
      );
      await pool.query(
        `INSERT INTO reward_levels (user_id, total_points)
         VALUES ($1, 50)
         ON CONFLICT (user_id) DO UPDATE
         SET total_points = reward_levels.total_points + 50, updated_at=NOW()`,
        [updated.submitter_id]
      );
    }

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// POST /claims/:id/endorse
router.post('/:id/endorse', authenticate, async (req, res, next) => {
  try {
    const { rows: [claim] } = await pool.query(
      `SELECT id, status, submitter_id FROM implementation_claims WHERE id=$1`,
      [req.params.id]
    );
    if (!claim) throw new AppError('Claim not found', 404, 'NOT_FOUND');
    if (claim.status !== 'approved') throw new AppError('Only approved claims can be endorsed', 400, 'INVALID');
    if (claim.submitter_id === req.user.id) throw new AppError('You cannot endorse your own claim', 400, 'INVALID');

    const { comment } = req.body;
    await pool.query(
      `INSERT INTO claim_endorsements (claim_id, user_id, comment) VALUES ($1,$2,$3)
       ON CONFLICT (claim_id, user_id) DO NOTHING`,
      [req.params.id, req.user.id, comment || null]
    );
    await pool.query(
      `UPDATE implementation_claims
       SET endorsement_count=(SELECT COUNT(*) FROM claim_endorsements WHERE claim_id=$1)
       WHERE id=$1`,
      [req.params.id]
    );
    res.json({ success: true, message: 'Endorsed' });
  } catch (err) { next(err); }
});

// DELETE /claims/:id/endorse — remove endorsement
router.delete('/:id/endorse', authenticate, async (req, res, next) => {
  try {
    await pool.query(
      `DELETE FROM claim_endorsements WHERE claim_id=$1 AND user_id=$2`,
      [req.params.id, req.user.id]
    );
    await pool.query(
      `UPDATE implementation_claims
       SET endorsement_count=(SELECT COUNT(*) FROM claim_endorsements WHERE claim_id=$1)
       WHERE id=$1`,
      [req.params.id]
    );
    res.json({ success: true, message: 'Endorsement removed' });
  } catch (err) { next(err); }
});

// PATCH /claims/:id — submitter edits a pending/revision_needed claim
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const { rows: [claim] } = await pool.query(
      `SELECT submitter_id, status FROM implementation_claims WHERE id=$1`, [req.params.id]
    );
    if (!claim) throw new AppError('Claim not found', 404, 'NOT_FOUND');
    if (claim.submitter_id !== req.user.id) throw new AppError('Not authorized', 403, 'FORBIDDEN');
    if (!['pending', 'revision_needed'].includes(claim.status))
      throw new AppError('Cannot edit a claim that has been approved or rejected', 400, 'INVALID');

    const { title, description, organization, location, implementationDate, evidenceUrl, impactSummary } = req.body;
    const { rows: [updated] } = await pool.query(
      `UPDATE implementation_claims SET
         title=COALESCE($1,title), description=COALESCE($2,description),
         organization=$3, location=$4, implementation_date=$5,
         evidence_url=$6, impact_summary=$7, status='pending', updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [title||null, description||null, organization||null, location||null,
       implementationDate||null, evidenceUrl||null, impactSummary||null, req.params.id]
    );
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

module.exports = router;
