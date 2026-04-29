const express  = require('express');
const { pool } = require('../config/database');
const { AppError } = require('../utils/AppError');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── Static / non-parameterised routes first ───────────────────────────────

// GET /groups — list all public groups (or mine)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { search, mine } = req.query;
    let where = [`g.deleted_at IS NULL`];
    const values = [];
    let idx = 1;

    if (mine === 'true') {
      where.push(`gm_me.user_id = $${idx++}`);
      values.push(req.user.id);
    } else {
      where.push(`g.is_public = true`);
    }
    if (search) {
      where.push(`(g.name ILIKE $${idx} OR g.description ILIKE $${idx})`);
      values.push(`%${search}%`); idx++;
    }

    const { rows } = await pool.query(
      `SELECT g.id, g.name, g.description, g.type, g.is_public, g.member_count,
              g.created_at, u.full_name AS creator_name,
              EXISTS(SELECT 1 FROM group_members WHERE group_id=g.id AND user_id=$${idx}) AS is_member,
              (g.creator_id = $${idx}) AS is_owner
       FROM research_groups g
       JOIN users u ON u.id = g.creator_id
       ${mine === 'true' ? 'JOIN group_members gm_me ON gm_me.group_id = g.id' : ''}
       WHERE ${where.join(' AND ')}
       ORDER BY g.member_count DESC, g.created_at DESC
       LIMIT 50`,
      [...values, req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /groups — create a group
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { name, description, type = 'research', isPublic = true } = req.body;
    if (!name || name.trim().length < 3) throw new AppError('Group name must be at least 3 characters', 422, 'VALIDATION_ERROR');

    const { rows: [group] } = await pool.query(
      `INSERT INTO research_groups (creator_id, name, description, type, is_public)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, name.trim(), description || null, type, isPublic]
    );

    await pool.query(
      `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [group.id, req.user.id]
    );

    res.status(201).json({ success: true, data: group });
  } catch (err) { next(err); }
});

// GET /groups/my-invites — pending invites for the current user
router.get('/my-invites', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT gi.id, gi.created_at,
              g.id AS group_id, g.name AS group_name, g.description,
              u.full_name AS inviter_name
       FROM group_invites gi
       JOIN research_groups g ON g.id = gi.group_id
       JOIN users u ON u.id = gi.inviter_id
       WHERE gi.invitee_id = $1 AND gi.status = 'pending' AND g.deleted_at IS NULL
       ORDER BY gi.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /groups/invites/:inviteId/accept — accept an invite
router.post('/invites/:inviteId/accept', authenticate, async (req, res, next) => {
  try {
    const { rows: [invite] } = await pool.query(
      `SELECT * FROM group_invites WHERE id=$1 AND invitee_id=$2 AND status='pending'`,
      [req.params.inviteId, req.user.id]
    );
    if (!invite) throw new AppError('Invite not found', 404, 'NOT_FOUND');

    await pool.query(`UPDATE group_invites SET status='accepted' WHERE id=$1`, [invite.id]);
    await pool.query(
      `INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [invite.group_id, req.user.id]
    );
    await pool.query(
      `UPDATE research_groups SET member_count = (SELECT COUNT(*) FROM group_members WHERE group_id=$1) WHERE id=$1`,
      [invite.group_id]
    );
    res.json({ success: true, message: 'Joined group' });
  } catch (err) { next(err); }
});

// DELETE /groups/invites/:inviteId — decline (invitee) or revoke (inviter/owner)
router.delete('/invites/:inviteId', authenticate, async (req, res, next) => {
  try {
    const { rows: [invite] } = await pool.query(
      `SELECT gi.*, gm.role AS inviter_group_role
       FROM group_invites gi
       LEFT JOIN group_members gm ON gm.group_id = gi.group_id AND gm.user_id = $2
       WHERE gi.id = $1`,
      [req.params.inviteId, req.user.id]
    );
    if (!invite) throw new AppError('Invite not found', 404, 'NOT_FOUND');

    const canAct = invite.invitee_id === req.user.id ||
                   invite.inviter_id === req.user.id ||
                   invite.inviter_group_role === 'owner';
    if (!canAct) throw new AppError('Not authorized', 403, 'FORBIDDEN');

    await pool.query(`UPDATE group_invites SET status='declined' WHERE id=$1`, [invite.id]);
    res.json({ success: true, message: 'Invite removed' });
  } catch (err) { next(err); }
});

// ── Parameterised routes ──────────────────────────────────────────────────

// GET /groups/:id — group detail with members
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { rows: [group] } = await pool.query(
      `SELECT g.*, u.full_name AS creator_name,
              EXISTS(SELECT 1 FROM group_members WHERE group_id=g.id AND user_id=$2) AS is_member,
              (g.creator_id = $2) AS is_owner
       FROM research_groups g
       JOIN users u ON u.id = g.creator_id
       WHERE g.id=$1 AND g.deleted_at IS NULL`,
      [req.params.id, req.user.id]
    );
    if (!group) throw new AppError('Group not found', 404, 'NOT_FOUND');

    const { rows: members } = await pool.query(
      `SELECT u.id, u.full_name, u.profile_photo_url,
              dep.name AS department_name, uni.short_name AS university_short,
              gm.role, gm.joined_at
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       LEFT JOIN departments dep ON dep.id = u.department_id
       LEFT JOIN universities uni ON uni.id = u.university_id
       WHERE gm.group_id = $1
       ORDER BY gm.role DESC, gm.joined_at ASC`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...group, members } });
  } catch (err) { next(err); }
});

// POST /groups/:id/join — join a public group
router.post('/:id/join', authenticate, async (req, res, next) => {
  try {
    const { rows: [group] } = await pool.query(
      `SELECT id, is_public FROM research_groups WHERE id=$1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!group) throw new AppError('Group not found', 404, 'NOT_FOUND');
    if (!group.is_public) throw new AppError('This group is private — you need an invite to join', 403, 'FORBIDDEN');

    await pool.query(
      `INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.params.id, req.user.id]
    );
    await pool.query(
      `UPDATE research_groups SET member_count = (SELECT COUNT(*) FROM group_members WHERE group_id=$1) WHERE id=$1`,
      [req.params.id]
    );
    res.json({ success: true, message: 'Joined group' });
  } catch (err) { next(err); }
});

// POST /groups/:id/invite — owner invites a user by userId
router.post('/:id/invite', authenticate, async (req, res, next) => {
  try {
    const { rows: [gm] } = await pool.query(
      `SELECT role FROM group_members WHERE group_id=$1 AND user_id=$2`,
      [req.params.id, req.user.id]
    );
    if (!gm || gm.role !== 'owner') throw new AppError('Only the owner can invite members', 403, 'FORBIDDEN');

    const { userId } = req.body;
    if (!userId) throw new AppError('userId is required', 422, 'VALIDATION_ERROR');

    // Check target user exists
    const { rows: [target] } = await pool.query(
      `SELECT id FROM users WHERE id=$1 AND deleted_at IS NULL AND status='active'`,
      [userId]
    );
    if (!target) throw new AppError('User not found', 404, 'NOT_FOUND');

    // Check not already a member
    const { rows: [existing] } = await pool.query(
      `SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2`,
      [req.params.id, userId]
    );
    if (existing) throw new AppError('User is already a member', 400, 'ALREADY_MEMBER');

    await pool.query(
      `INSERT INTO group_invites (group_id, inviter_id, invitee_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (group_id, invitee_id) DO UPDATE SET status='pending', created_at=NOW()`,
      [req.params.id, req.user.id, userId]
    );
    res.json({ success: true, message: 'Invite sent' });
  } catch (err) { next(err); }
});

// GET /groups/:id/invites — owner sees pending invites for a group
router.get('/:id/invites', authenticate, async (req, res, next) => {
  try {
    const { rows: [gm] } = await pool.query(
      `SELECT role FROM group_members WHERE group_id=$1 AND user_id=$2`,
      [req.params.id, req.user.id]
    );
    if (!gm || gm.role !== 'owner') throw new AppError('Only the owner can view invites', 403, 'FORBIDDEN');

    const { rows } = await pool.query(
      `SELECT gi.id, gi.created_at,
              u.id AS user_id, u.full_name, u.profile_photo_url,
              dep.name AS department_name
       FROM group_invites gi
       JOIN users u ON u.id = gi.invitee_id
       LEFT JOIN departments dep ON dep.id = u.department_id
       WHERE gi.group_id = $1 AND gi.status = 'pending'
       ORDER BY gi.created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// DELETE /groups/:id/leave
router.delete('/:id/leave', authenticate, async (req, res, next) => {
  try {
    const { rows: [gm] } = await pool.query(
      `SELECT role FROM group_members WHERE group_id=$1 AND user_id=$2`,
      [req.params.id, req.user.id]
    );
    if (!gm) throw new AppError('You are not a member of this group', 400, 'NOT_MEMBER');
    if (gm.role === 'owner') throw new AppError('Owner cannot leave. Delete the group instead.', 400, 'OWNER_CANNOT_LEAVE');

    await pool.query(`DELETE FROM group_members WHERE group_id=$1 AND user_id=$2`, [req.params.id, req.user.id]);
    await pool.query(
      `UPDATE research_groups SET member_count = (SELECT COUNT(*) FROM group_members WHERE group_id=$1) WHERE id=$1`,
      [req.params.id]
    );
    res.json({ success: true, message: 'Left group' });
  } catch (err) { next(err); }
});

// DELETE /groups/:id — delete group (owner only)
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { rows: [group] } = await pool.query(
      `SELECT creator_id FROM research_groups WHERE id=$1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!group) throw new AppError('Group not found', 404, 'NOT_FOUND');
    if (group.creator_id !== req.user.id) throw new AppError('Only the owner can delete this group', 403, 'FORBIDDEN');

    await pool.query(`UPDATE research_groups SET deleted_at=NOW() WHERE id=$1`, [req.params.id]);
    res.json({ success: true, message: 'Group deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
