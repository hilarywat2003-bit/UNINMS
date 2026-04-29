const express  = require('express');
const { pool } = require('../config/database');
const { AppError } = require('../utils/AppError');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const handoverSelect = `
  h.id, h.title, h.context, h.status, h.deadline, h.completed_at, h.created_at,
  h.transfer_type, h.external_name, h.external_org, h.external_email, h.external_type,
  fu.full_name AS from_name, fu.profile_photo_url AS from_photo,
  fu.id AS from_id, fdep.name AS from_department,
  tu.full_name AS to_name, tu.profile_photo_url AS to_photo,
  tu.id AS to_id, tdep.name AS to_department,
  (SELECT COUNT(*) FROM handover_items WHERE handover_id=h.id) AS item_count,
  (SELECT COUNT(*) FROM handover_items WHERE handover_id=h.id AND is_done=true) AS done_count`;

// GET /handover — my handovers
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { role } = req.query;
    const where = [];
    if (role === 'sender')   where.push(`h.from_user_id = $1`);
    else if (role === 'receiver') where.push(`h.to_user_id = $1`);
    else where.push(`(h.from_user_id = $1 OR h.to_user_id = $1)`);

    const { rows } = await pool.query(
      `SELECT ${handoverSelect}
       FROM handovers h
       JOIN users fu ON fu.id = h.from_user_id
       LEFT JOIN users tu ON tu.id = h.to_user_id
       LEFT JOIN departments fdep ON fdep.id = fu.department_id
       LEFT JOIN departments tdep ON tdep.id = tu.department_id
       WHERE ${where.join(' AND ')}
       ORDER BY h.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /handover — create a new package
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { toUserId, title, context, deadline,
            transferType = 'internal',
            externalName, externalOrg, externalEmail, externalType } = req.body;

    if (!title || title.trim().length < 3)
      throw new AppError('Title must be at least 3 characters', 422, 'VALIDATION_ERROR');

    if (transferType === 'internal') {
      if (!toUserId) throw new AppError('Recipient is required for internal transfers', 422, 'VALIDATION_ERROR');
      if (toUserId === req.user.id) throw new AppError('Cannot transfer to yourself', 400, 'INVALID');
      const { rows: [target] } = await pool.query(`SELECT id FROM users WHERE id=$1 AND deleted_at IS NULL`, [toUserId]);
      if (!target) throw new AppError('Recipient not found', 404, 'NOT_FOUND');
    } else {
      if (!externalOrg) throw new AppError('Organisation name is required for external transfers', 422, 'VALIDATION_ERROR');
    }

    const { rows: [handover] } = await pool.query(
      `INSERT INTO handovers
         (from_user_id, to_user_id, title, context, deadline,
          transfer_type, external_name, external_org, external_email, external_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.id,
       transferType === 'internal' ? toUserId : null,
       title.trim(), context || null, deadline || null,
       transferType,
       externalName || null, externalOrg || null, externalEmail || null, externalType || null]
    );
    res.status(201).json({ success: true, data: handover });
  } catch (err) { next(err); }
});

// GET /handover/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { rows: [handover] } = await pool.query(
      `SELECT ${handoverSelect}
       FROM handovers h
       JOIN users fu ON fu.id = h.from_user_id
       LEFT JOIN users tu ON tu.id = h.to_user_id
       LEFT JOIN departments fdep ON fdep.id = fu.department_id
       LEFT JOIN departments tdep ON tdep.id = tu.department_id
       WHERE h.id=$2 AND (h.from_user_id=$1 OR h.to_user_id=$1)`,
      [req.user.id, req.params.id]
    );
    if (!handover) throw new AppError('Handover not found', 404, 'NOT_FOUND');

    const { rows: items } = await pool.query(
      `SELECT hi.*, d.title AS document_title
       FROM handover_items hi
       LEFT JOIN documents d ON d.id = hi.document_id
       WHERE hi.handover_id=$1
       ORDER BY
         CASE hi.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         hi.created_at ASC`,
      [req.params.id]
    );
    res.json({ success: true, data: { ...handover, items } });
  } catch (err) { next(err); }
});

// PATCH /handover/:id
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const { rows: [h] } = await pool.query(
      `SELECT from_user_id, to_user_id, status FROM handovers WHERE id=$1`, [req.params.id]
    );
    if (!h) throw new AppError('Handover not found', 404, 'NOT_FOUND');

    const { title, context, deadline, status } = req.body;
    const isSender    = h.from_user_id === req.user.id;
    const isRecipient = h.to_user_id   === req.user.id;

    if (status === 'acknowledged') {
      // Internal: only recipient can acknowledge. External: sender confirms on behalf of external party.
      const isExternalTransfer = !h.to_user_id;
      if (isExternalTransfer ? !isSender : !isRecipient)
        throw new AppError('Not authorised to acknowledge this handover', 403, 'FORBIDDEN');
      await pool.query(`UPDATE handovers SET status='acknowledged', updated_at=NOW() WHERE id=$1`, [req.params.id]);
    } else {
      if (!isSender) throw new AppError('Only the sender can edit this handover', 403, 'FORBIDDEN');
      await pool.query(
        `UPDATE handovers SET
           title=COALESCE($1,title), context=COALESCE($2,context),
           deadline=$3, updated_at=NOW()
         WHERE id=$4`,
        [title||null, context||null, deadline||null, req.params.id]
      );
    }
    const { rows: [updated] } = await pool.query(`SELECT * FROM handovers WHERE id=$1`, [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// PATCH /handover/:id/send
router.patch('/:id/send', authenticate, async (req, res, next) => {
  try {
    const { rows: [h] } = await pool.query(
      `SELECT from_user_id, status FROM handovers WHERE id=$1`, [req.params.id]
    );
    if (!h) throw new AppError('Handover not found', 404, 'NOT_FOUND');
    if (h.from_user_id !== req.user.id) throw new AppError('Not authorized', 403, 'FORBIDDEN');
    if (h.status !== 'draft') throw new AppError('Handover is already sent', 400, 'INVALID');

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM handover_items WHERE handover_id=$1`, [req.params.id]
    );
    if (parseInt(count) === 0) throw new AppError('Add at least one item before sending', 400, 'NO_ITEMS');

    await pool.query(`UPDATE handovers SET status='active', updated_at=NOW() WHERE id=$1`, [req.params.id]);
    res.json({ success: true, message: 'Handover sent' });
  } catch (err) { next(err); }
});

// PATCH /handover/:id/complete
router.patch('/:id/complete', authenticate, async (req, res, next) => {
  try {
    const { rows: [h] } = await pool.query(
      `SELECT from_user_id, status FROM handovers WHERE id=$1`, [req.params.id]
    );
    if (!h) throw new AppError('Handover not found', 404, 'NOT_FOUND');
    if (h.from_user_id !== req.user.id) throw new AppError('Not authorized', 403, 'FORBIDDEN');
    if (h.status !== 'active') throw new AppError('Handover must be active to complete', 400, 'INVALID');

    await pool.query(
      `UPDATE handovers SET status='completed', completed_at=NOW(), updated_at=NOW() WHERE id=$1`,
      [req.params.id]
    );
    res.json({ success: true, message: 'Handover completed' });
  } catch (err) { next(err); }
});

// POST /handover/:id/items
router.post('/:id/items', authenticate, async (req, res, next) => {
  try {
    const { rows: [h] } = await pool.query(
      `SELECT from_user_id, status FROM handovers WHERE id=$1`, [req.params.id]
    );
    if (!h) throw new AppError('Handover not found', 404, 'NOT_FOUND');
    if (h.from_user_id !== req.user.id) throw new AppError('Only the sender can add items', 403, 'FORBIDDEN');
    if (!['draft', 'active'].includes(h.status))
      throw new AppError('Cannot add items to a completed handover', 400, 'INVALID');

    const { title, category = 'other', description, documentId, priority = 'medium' } = req.body;
    if (!title || title.trim().length < 2) throw new AppError('Item title is required', 422, 'VALIDATION_ERROR');

    const { rows: [item] } = await pool.query(
      `INSERT INTO handover_items (handover_id, title, category, description, document_id, priority)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, title.trim(), category, description || null, documentId || null, priority]
    );
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

// PATCH /handover/:id/items/:itemId
router.patch('/:id/items/:itemId', authenticate, async (req, res, next) => {
  try {
    const { rows: [h] } = await pool.query(
      `SELECT from_user_id, to_user_id FROM handovers WHERE id=$1`, [req.params.id]
    );
    if (!h) throw new AppError('Handover not found', 404, 'NOT_FOUND');
    if (h.from_user_id !== req.user.id && h.to_user_id !== req.user.id)
      throw new AppError('Not authorized', 403, 'FORBIDDEN');

    const { isDone, title, description, priority } = req.body;
    const { rows: [item] } = await pool.query(
      `UPDATE handover_items SET
         is_done=COALESCE($1, is_done),
         title=COALESCE($2, title),
         description=COALESCE($3, description),
         priority=COALESCE($4, priority)
       WHERE id=$5 AND handover_id=$6 RETURNING *`,
      [isDone !== undefined ? isDone : null, title||null, description||null, priority||null,
       req.params.itemId, req.params.id]
    );
    if (!item) throw new AppError('Item not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// DELETE /handover/:id/items/:itemId
router.delete('/:id/items/:itemId', authenticate, async (req, res, next) => {
  try {
    const { rows: [h] } = await pool.query(
      `SELECT from_user_id FROM handovers WHERE id=$1`, [req.params.id]
    );
    if (!h || h.from_user_id !== req.user.id) throw new AppError('Not authorized', 403, 'FORBIDDEN');
    await pool.query(
      `DELETE FROM handover_items WHERE id=$1 AND handover_id=$2`,
      [req.params.itemId, req.params.id]
    );
    res.json({ success: true, message: 'Item removed' });
  } catch (err) { next(err); }
});

module.exports = router;
