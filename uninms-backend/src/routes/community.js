'use strict';

/**
 * Community Representative Module — /api/v1/community
 *
 * Implements all COM-xxx requirements from the URS:
 *
 * Rep management
 *   POST   /community/reps/register        — register as community rep (any user)
 *   GET    /community/reps/me              — get own rep profile
 *   POST   /community/reps/co-rep          — add a co-representative (primary rep)
 *   POST   /community/reps/:userId/verify  — admin verifies a rep + assigns role
 *
 * Indigenous knowledge assets
 *   POST   /community/assets               — register new IK asset (verified rep)
 *   GET    /community/assets               — list accessible assets
 *   GET    /community/assets/:id           — get asset details
 *   PATCH  /community/assets/:id           — update metadata (owning rep)
 *   POST   /community/assets/:id/mark-sacred — permanently mark sacred (COM-003)
 *   POST   /community/assets/:id/documents — upload supporting documentation
 *
 * FPIC consent workflow
 *   POST   /community/assets/:id/requests  — request access (any auth user)
 *   GET    /community/assets/:id/requests  — list requests (owning rep)
 *   POST   /community/requests/:id/approve — approve (owning rep)
 *   POST   /community/requests/:id/reject  — reject  (owning rep)
 *   POST   /community/requests/:id/revoke  — revoke  (owning rep)
 *
 * Token ledger & benefit distribution
 *   GET    /community/assets/:id/tokens         — view ledger (owning rep)
 *   POST   /community/tokens/:id/confirm        — confirm receipt (owning rep)
 *   GET    /community/assets/:id/tokens/export  — CSV export
 */

const crypto         = require('crypto');
const express        = require('express');
const { pool }       = require('../config/database');
const { AppError }   = require('../utils/AppError');
const { authenticate, requireRole, isAdmin } = require('../middleware/auth');
const { logAdminAction } = require('../utils/auditLog');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Canonical SHA-256 of an IK asset's content */
function assetHash(title, description, culturalContext, provenance, communityName) {
  const payload = [title, description, culturalContext ?? '', provenance ?? '', communityName]
    .join('|||');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/** Append a new entry to the hash chain and return the updated array */
function extendHashChain(existing, event, hash, previousHash) {
  const chain = Array.isArray(existing) ? existing : [];
  chain.push({ event, hash, previous_hash: previousHash, timestamp: new Date().toISOString() });
  return chain;
}

/** Ensure the requesting user is the verified community rep for a given asset */
async function assertRepOwnsAsset(userId, assetId) {
  const { rows: [row] } = await pool.query(
    `SELECT ik.id
     FROM indigenous_knowledge ik
     JOIN community_reps cr ON cr.community_name = ik.community_name
     WHERE ik.id = $1 AND cr.user_id = $2 AND cr.verified = TRUE`,
    [assetId, userId]
  );
  if (!row) {
    throw new AppError('Only the verified community representative for this asset may perform this action', 403, 'FORBIDDEN');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// REP MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

// POST /community/reps/register — register as community rep (identity verification pending)
router.post('/reps/register', authenticate, async (req, res, next) => {
  try {
    const { communityName } = req.body;
    if (!communityName?.trim()) {
      throw new AppError('communityName is required', 422, 'VALIDATION_ERROR');
    }

    // Check not already registered
    const { rows: [existing] } = await pool.query(
      'SELECT id FROM community_reps WHERE user_id = $1', [req.user.id]
    );
    if (existing) throw new AppError('You are already registered as a community representative', 409, 'CONFLICT');

    const { rows: [rep] } = await pool.query(
      `INSERT INTO community_reps (user_id, community_name)
       VALUES ($1, $2) RETURNING id, community_name, verified, created_at`,
      [req.user.id, communityName.trim()]
    );

    res.status(201).json({
      success: true,
      message: 'Community rep registration submitted. Awaiting identity verification by an administrator.',
      data: rep,
    });
  } catch (err) { next(err); }
});

// GET /community/reps/me
router.get('/reps/me', authenticate, async (req, res, next) => {
  try {
    const { rows: [rep] } = await pool.query(
      `SELECT cr.*, u.full_name, u.email,
              (SELECT COUNT(*) FROM indigenous_knowledge
               WHERE community_name = cr.community_name AND deleted_at IS NULL) AS asset_count
       FROM community_reps cr
       JOIN users u ON u.id = cr.user_id
       WHERE cr.user_id = $1`,
      [req.user.id]
    );
    if (!rep) throw new AppError('You are not registered as a community representative', 404, 'NOT_FOUND');
    res.json({ success: true, data: rep });
  } catch (err) { next(err); }
});

// POST /community/reps/co-rep — add co-representative (COM-009)
router.post('/reps/co-rep', authenticate, requireRole('community_rep'), async (req, res, next) => {
  try {
    const { coRepUserId } = req.body;
    if (!coRepUserId) throw new AppError('coRepUserId is required', 422, 'VALIDATION_ERROR');

    const { rows: [primaryRep] } = await pool.query(
      'SELECT id, community_name FROM community_reps WHERE user_id = $1 AND verified = TRUE AND is_primary = TRUE',
      [req.user.id]
    );
    if (!primaryRep) throw new AppError('Only a verified primary representative can add a co-representative', 403, 'FORBIDDEN');

    const { rows: [coRep] } = await pool.query(
      'SELECT id FROM community_reps WHERE user_id = $1 AND verified = TRUE',
      [coRepUserId]
    );
    if (!coRep) throw new AppError('The specified user is not a verified community representative', 404, 'NOT_FOUND');

    await pool.query(
      `INSERT INTO community_co_reps (primary_rep_id, co_rep_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [primaryRep.id, coRep.id]
    );

    res.json({ success: true, message: 'Co-representative added' });
  } catch (err) { next(err); }
});

// POST /community/reps/:userId/verify — admin verifies a rep + assigns role (COM-013)
router.post('/reps/:userId/verify', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { rows: [rep] } = await pool.query(
      'SELECT id, user_id, community_name FROM community_reps WHERE user_id = $1',
      [userId]
    );
    if (!rep) throw new AppError('Community rep registration not found', 404, 'NOT_FOUND');

    await pool.query(
      `UPDATE community_reps SET verified = TRUE, verified_at = NOW(), verified_by = $1 WHERE user_id = $2`,
      [req.user.id, userId]
    );

    // Assign community_rep role
    const { rows: [role] } = await pool.query(
      "SELECT id FROM roles WHERE name = 'community_rep'"
    );
    if (role) {
      await pool.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, role.id]
      );
    }

    await logAdminAction(req.user.id, 'community_rep.verify', 'community_reps', rep.id,
      { community_name: rep.community_name }, req);

    res.json({ success: true, message: 'Community representative verified and role assigned' });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// INDIGENOUS KNOWLEDGE ASSETS
// ══════════════════════════════════════════════════════════════════════════════

// POST /community/assets — register new IK asset (COM-001, COM-004)
router.post('/assets', authenticate, requireRole('community_rep'), async (req, res, next) => {
  try {
    const { title, description, culturalContext, provenance, accessLevel } = req.body;
    if (!title?.trim() || !description?.trim()) {
      throw new AppError('title and description are required', 422, 'VALIDATION_ERROR');
    }

    const validAccessLevels = ['metadata_only', 'abstract_only', 'full_with_consent', 'open'];
    const level = accessLevel ?? 'full_with_consent';
    if (!validAccessLevels.includes(level)) {
      throw new AppError(`accessLevel must be one of: ${validAccessLevels.join(', ')}`, 422, 'VALIDATION_ERROR');
    }

    // Ensure rep is verified
    const { rows: [rep] } = await pool.query(
      'SELECT community_name FROM community_reps WHERE user_id = $1 AND verified = TRUE',
      [req.user.id]
    );
    if (!rep) throw new AppError('Only verified community representatives can register knowledge assets', 403, 'FORBIDDEN');

    // Build blockchain anchor (COM-004)
    const hash        = assetHash(title.trim(), description.trim(), culturalContext, provenance, rep.community_name);
    const hashChain   = extendHashChain([], 'registered', hash, null);

    const { rows: [asset] } = await pool.query(
      `INSERT INTO indigenous_knowledge
         (registered_by, community_name, title, description, cultural_context,
          provenance, access_level, content_hash, hash_chain)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, title, community_name, access_level, is_sacred, content_hash, created_at`,
      [
        req.user.id, rep.community_name,
        title.trim(), description.trim(),
        culturalContext ?? null, provenance ?? null,
        level, hash, JSON.stringify(hashChain),
      ]
    );

    await logAdminAction(req.user.id, 'ik.asset.register', 'indigenous_knowledge', asset.id,
      { title: asset.title, community: rep.community_name, hash }, req);

    res.status(201).json({ success: true, data: asset });
  } catch (err) { next(err); }
});

// GET /community/assets — list accessible assets
router.get('/assets', authenticate, async (req, res, next) => {
  try {
    const isCommunityRep = req.user.roles?.includes('community_rep');

    // Determine which access levels this user can see
    let accessFilter = `ik.access_level IN ('open')`;
    if (isCommunityRep) {
      // Reps see their own community's assets + open assets
      const { rows: [rep] } = await pool.query(
        'SELECT community_name FROM community_reps WHERE user_id = $1 AND verified = TRUE',
        [req.user.id]
      );
      if (rep) {
        accessFilter = `(ik.access_level = 'open' OR ik.community_name = '${rep.community_name.replace(/'/g, "''")}')`;
      }
    } else {
      // Regular authenticated users see open + abstract_only + full_with_consent metadata
      accessFilter = `ik.access_level IN ('open', 'abstract_only', 'full_with_consent')`;
    }

    const { rows } = await pool.query(
      `SELECT ik.id, ik.title, ik.community_name, ik.access_level, ik.is_sacred,
              ik.cultural_context, ik.created_at,
              CASE WHEN ik.access_level IN ('open','full_with_consent','abstract_only')
                   THEN ik.description ELSE NULL END AS description,
              u.full_name AS registered_by_name
       FROM indigenous_knowledge ik
       LEFT JOIN users u ON u.id = ik.registered_by
       WHERE ik.deleted_at IS NULL AND ${accessFilter}
       ORDER BY ik.created_at DESC
       LIMIT 50`
    );

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /community/assets/:id — full asset details
router.get('/assets/:id', authenticate, async (req, res, next) => {
  try {
    const { rows: [asset] } = await pool.query(
      `SELECT ik.*, u.full_name AS registered_by_name,
              (SELECT json_agg(json_build_object('id',ikd.id,'doc_type',ikd.doc_type,
                'file_name',ikd.file_name,'storage_url',ikd.storage_url,'created_at',ikd.created_at))
               FROM ik_documents ikd WHERE ikd.asset_id = ik.id) AS documents
       FROM indigenous_knowledge ik
       LEFT JOIN users u ON u.id = ik.registered_by
       WHERE ik.id = $1 AND ik.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!asset) throw new AppError('Asset not found', 404, 'NOT_FOUND');

    // Restrict full description for metadata_only assets unless rep
    const isCommunityRep = req.user.roles?.includes('community_rep');
    if (asset.access_level === 'metadata_only' && !isCommunityRep) {
      asset.description      = null;
      asset.cultural_context = null;
      asset.provenance       = null;
      asset.hash_chain       = null;
    }

    res.json({ success: true, data: asset });
  } catch (err) { next(err); }
});

// PATCH /community/assets/:id — update metadata (owning rep only)
router.patch('/assets/:id', authenticate, requireRole('community_rep'), async (req, res, next) => {
  try {
    await assertRepOwnsAsset(req.user.id, req.params.id);

    const { description, culturalContext, provenance, accessLevel } = req.body;
    const updates = [];
    const values  = [];
    let   idx     = 1;

    if (description    !== undefined) { updates.push(`description=$${idx++}`);       values.push(description);    }
    if (culturalContext !== undefined) { updates.push(`cultural_context=$${idx++}`);  values.push(culturalContext); }
    if (provenance     !== undefined) { updates.push(`provenance=$${idx++}`);         values.push(provenance);     }
    if (accessLevel    !== undefined) { updates.push(`access_level=$${idx++}`);       values.push(accessLevel);    }
    if (!updates.length) throw new AppError('Nothing to update', 400, 'NO_CHANGES');

    // Extend hash chain for the update event
    const { rows: [current] } = await pool.query(
      'SELECT content_hash, hash_chain, title, community_name FROM indigenous_knowledge WHERE id = $1',
      [req.params.id]
    );
    const newHash    = assetHash(current.title, description ?? '', culturalContext, provenance, current.community_name);
    const newChain   = extendHashChain(current.hash_chain, 'updated', newHash, current.content_hash);
    updates.push(`content_hash=$${idx++}`, `hash_chain=$${idx++}`, `updated_at=NOW()`);
    values.push(newHash, JSON.stringify(newChain));

    values.push(req.params.id);
    await pool.query(`UPDATE indigenous_knowledge SET ${updates.join(', ')} WHERE id = $${idx}`, values);

    res.json({ success: true, message: 'Asset updated' });
  } catch (err) { next(err); }
});

// POST /community/assets/:id/mark-sacred — irreversible (COM-003, COM-014)
router.post('/assets/:id/mark-sacred', authenticate, requireRole('community_rep'), async (req, res, next) => {
  try {
    await assertRepOwnsAsset(req.user.id, req.params.id);

    const { rows: [asset] } = await pool.query(
      'SELECT id, title, is_sacred, community_name FROM indigenous_knowledge WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (!asset) throw new AppError('Asset not found', 404, 'NOT_FOUND');
    if (asset.is_sacred) {
      return res.json({ success: true, message: 'Asset is already marked as sacred' });
    }

    // The DB trigger prevents clearing this — set once, permanent
    await pool.query(
      `UPDATE indigenous_knowledge
         SET is_sacred = TRUE, updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );

    await logAdminAction(req.user.id, 'ik.asset.mark_sacred', 'indigenous_knowledge', req.params.id,
      { title: asset.title, community: asset.community_name }, req);

    res.json({
      success: true,
      message: 'Asset marked as sacred. This action is permanent and cannot be reversed by any user.',
    });
  } catch (err) { next(err); }
});

// POST /community/assets/:id/documents — upload supporting documentation (COM-005)
router.post('/assets/:id/documents', authenticate, requireRole('community_rep'), async (req, res, next) => {
  try {
    await assertRepOwnsAsset(req.user.id, req.params.id);

    const { storageUrl, fileName, docType } = req.body;
    if (!storageUrl?.trim()) throw new AppError('storageUrl is required', 422, 'VALIDATION_ERROR');

    const validTypes = ['council_minutes', 'elder_testimonial', 'photograph', 'supporting', 'other'];
    const type = docType ?? 'supporting';
    if (!validTypes.includes(type)) {
      throw new AppError(`docType must be one of: ${validTypes.join(', ')}`, 422, 'VALIDATION_ERROR');
    }

    const { rows: [doc] } = await pool.query(
      `INSERT INTO ik_documents (asset_id, uploaded_by, doc_type, storage_url, file_name)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, doc_type, file_name, created_at`,
      [req.params.id, req.user.id, type, storageUrl.trim(), fileName ?? null]
    );

    res.status(201).json({ success: true, data: doc });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// FPIC CONSENT WORKFLOW
// ══════════════════════════════════════════════════════════════════════════════

// POST /community/assets/:id/requests — request access (COM-006, COM-007)
router.post('/assets/:id/requests', authenticate, async (req, res, next) => {
  try {
    const { purpose, requestType } = req.body;
    if (!purpose?.trim()) throw new AppError('purpose is required', 422, 'VALIDATION_ERROR');

    const validTypes = ['access', 'commercialisation'];
    const type = requestType ?? 'access';
    if (!validTypes.includes(type)) {
      throw new AppError(`requestType must be one of: ${validTypes.join(', ')}`, 422, 'VALIDATION_ERROR');
    }

    const { rows: [asset] } = await pool.query(
      `SELECT id, title, community_name, access_level, is_sacred
       FROM indigenous_knowledge WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!asset) throw new AppError('Asset not found', 404, 'NOT_FOUND');

    // Sacred assets cannot be commercialised
    if (asset.is_sacred && type === 'commercialisation') {
      throw new AppError('This asset is marked as sacred and cannot be commercialised', 403, 'SACRED_ASSET');
    }

    // Open assets don't need an FPIC request
    if (asset.access_level === 'open' && type === 'access') {
      return res.json({ success: true, message: 'This asset has open access — no request needed' });
    }

    const { rows: [req_] } = await pool.query(
      `INSERT INTO fpic_requests (asset_id, requester_id, request_type, purpose)
       VALUES ($1, $2, $3, $4)
       RETURNING id, request_type, status, created_at`,
      [req.params.id, req.user.id, type, purpose.trim()]
    );

    // Notify the community rep (COM-006)
    const { rows: repRows } = await pool.query(
      `SELECT cr.user_id FROM community_reps cr
       WHERE cr.community_name = $1 AND cr.verified = TRUE`,
      [asset.community_name]
    );
    for (const { user_id } of repRows) {
      await pool.query(
        `INSERT INTO notifications (user_id, event_type, payload)
         VALUES ($1, 'fpic.access_requested', $2)`,
        [user_id, JSON.stringify({
          requestId:   req_.id,
          assetId:     asset.id,
          assetTitle:  asset.title,
          requestType: type,
          requesterId: req.user.id,
        })]
      );
    }

    res.status(201).json({ success: true, data: req_ });
  } catch (err) { next(err); }
});

// GET /community/assets/:id/requests — list requests for owning rep
router.get('/assets/:id/requests', authenticate, requireRole('community_rep'), async (req, res, next) => {
  try {
    await assertRepOwnsAsset(req.user.id, req.params.id);

    const { rows } = await pool.query(
      `SELECT fr.*, u.full_name AS requester_name, u.email AS requester_email,
              dec.full_name AS decided_by_name
       FROM fpic_requests fr
       JOIN users u ON u.id = fr.requester_id
       LEFT JOIN users dec ON dec.id = fr.decision_by
       WHERE fr.asset_id = $1
       ORDER BY fr.created_at DESC`,
      [req.params.id]
    );

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /community/requests/:id/approve — approve (COM-007)
router.post('/requests/:id/approve', authenticate, requireRole('community_rep'), async (req, res, next) => {
  try {
    const { rows: [request] } = await pool.query(
      `SELECT fr.*, ik.community_name, ik.title AS asset_title
       FROM fpic_requests fr
       JOIN indigenous_knowledge ik ON ik.id = fr.asset_id
       WHERE fr.id = $1`,
      [req.params.id]
    );
    if (!request) throw new AppError('Request not found', 404, 'NOT_FOUND');
    if (request.status !== 'pending') throw new AppError(`Request is already ${request.status}`, 409, 'CONFLICT');
    await assertRepOwnsAsset(req.user.id, request.asset_id);

    await pool.query(
      `UPDATE fpic_requests
         SET status = 'approved', decision_by = $1,
             decision_note = $2, decided_at = NOW()
       WHERE id = $3`,
      [req.user.id, req.body.note ?? null, req.params.id]
    );

    // For commercialisation: create token ledger entries (50/25/15/10 split)
    if (request.request_type === 'commercialisation' && req.body.totalValue) {
      const total      = parseFloat(req.body.totalValue);
      const shares     = [
        { type: 'community_share',    recipient: request.community_name,  pct: 0.50 },
        { type: 'researcher_share',   recipient: 'researcher',            pct: 0.25 },
        { type: 'university_share',   recipient: 'university',            pct: 0.15 },
        { type: 'platform_fee',       recipient: 'UniNMS Platform',       pct: 0.10 },
      ];
      for (const s of shares) {
        await pool.query(
          `INSERT INTO ik_token_ledger
             (asset_id, fpic_request_id, transaction_type, amount, recipient, recipient_share)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [request.asset_id, req.params.id, s.type, total * s.pct, s.recipient, s.pct]
        );
      }
    }

    // Notify requester
    await pool.query(
      `INSERT INTO notifications (user_id, event_type, payload) VALUES ($1, 'fpic.approved', $2)`,
      [request.requester_id, JSON.stringify({ requestId: req.params.id, assetTitle: request.asset_title })]
    );

    // Immutable consent audit log (COM-015)
    await logAdminAction(req.user.id, 'fpic.consent.approved', 'fpic_requests', req.params.id,
      { asset_id: request.asset_id, request_type: request.request_type }, req);

    res.json({ success: true, message: 'Access request approved' });
  } catch (err) { next(err); }
});

// POST /community/requests/:id/reject
router.post('/requests/:id/reject', authenticate, requireRole('community_rep'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) throw new AppError('reason is required', 422, 'VALIDATION_ERROR');

    const { rows: [request] } = await pool.query(
      `SELECT fr.*, ik.title AS asset_title
       FROM fpic_requests fr JOIN indigenous_knowledge ik ON ik.id = fr.asset_id
       WHERE fr.id = $1`,
      [req.params.id]
    );
    if (!request) throw new AppError('Request not found', 404, 'NOT_FOUND');
    if (request.status !== 'pending') throw new AppError(`Request is already ${request.status}`, 409, 'CONFLICT');
    await assertRepOwnsAsset(req.user.id, request.asset_id);

    await pool.query(
      `UPDATE fpic_requests
         SET status = 'rejected', decision_by = $1,
             decision_note = $2, decided_at = NOW()
       WHERE id = $3`,
      [req.user.id, reason.trim(), req.params.id]
    );

    await pool.query(
      `INSERT INTO notifications (user_id, event_type, payload) VALUES ($1, 'fpic.rejected', $2)`,
      [request.requester_id, JSON.stringify({ requestId: req.params.id, reason: reason.trim(), assetTitle: request.asset_title })]
    );

    await logAdminAction(req.user.id, 'fpic.consent.rejected', 'fpic_requests', req.params.id,
      { asset_id: request.asset_id, reason: reason.trim() }, req);

    res.json({ success: true, message: 'Access request rejected' });
  } catch (err) { next(err); }
});

// POST /community/requests/:id/revoke — revoke previously granted consent (COM-008)
router.post('/requests/:id/revoke', authenticate, requireRole('community_rep'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) throw new AppError('reason is required', 422, 'VALIDATION_ERROR');

    const { rows: [request] } = await pool.query(
      `SELECT fr.*, ik.title AS asset_title
       FROM fpic_requests fr JOIN indigenous_knowledge ik ON ik.id = fr.asset_id
       WHERE fr.id = $1`,
      [req.params.id]
    );
    if (!request) throw new AppError('Request not found', 404, 'NOT_FOUND');
    if (request.status !== 'approved') throw new AppError('Only approved requests can be revoked', 409, 'CONFLICT');
    await assertRepOwnsAsset(req.user.id, request.asset_id);

    await pool.query(
      `UPDATE fpic_requests
         SET status = 'revoked', revoked_at = NOW(), revoke_reason = $1
       WHERE id = $2`,
      [reason.trim(), req.params.id]
    );

    // Immediate notification to the requester
    await pool.query(
      `INSERT INTO notifications (user_id, event_type, payload) VALUES ($1, 'fpic.revoked', $2)`,
      [request.requester_id, JSON.stringify({
        requestId: req.params.id, reason: reason.trim(), assetTitle: request.asset_title,
        revokedAt: new Date().toISOString(), effectiveImmediately: true,
      })]
    );

    await logAdminAction(req.user.id, 'fpic.consent.revoked', 'fpic_requests', req.params.id,
      { asset_id: request.asset_id, reason: reason.trim() }, req);

    res.json({ success: true, message: 'Consent revoked with immediate effect' });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// TOKEN LEDGER & BENEFIT DISTRIBUTION
// ══════════════════════════════════════════════════════════════════════════════

// GET /community/assets/:id/tokens — view token ledger (COM-010)
router.get('/assets/:id/tokens', authenticate, requireRole('community_rep'), async (req, res, next) => {
  try {
    await assertRepOwnsAsset(req.user.id, req.params.id);

    const { rows } = await pool.query(
      `SELECT tl.*, u.full_name AS confirmed_by_name
       FROM ik_token_ledger tl
       LEFT JOIN users u ON u.id = tl.confirmed_by
       WHERE tl.asset_id = $1
       ORDER BY tl.created_at DESC`,
      [req.params.id]
    );

    // Balance: total community share received (50 %)
    const { rows: [balance] } = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS community_balance
       FROM ik_token_ledger
       WHERE asset_id = $1 AND transaction_type = 'community_share'`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        community_balance: parseFloat(balance.community_balance),
        transactions:      rows,
      },
    });
  } catch (err) { next(err); }
});

// POST /community/tokens/:id/confirm — confirm receipt of token allocation (COM-011)
router.post('/tokens/:id/confirm', authenticate, requireRole('community_rep'), async (req, res, next) => {
  try {
    const { rows: [entry] } = await pool.query(
      'SELECT * FROM ik_token_ledger WHERE id = $1', [req.params.id]
    );
    if (!entry) throw new AppError('Ledger entry not found', 404, 'NOT_FOUND');
    if (entry.confirmed_at) throw new AppError('Already confirmed', 409, 'CONFLICT');
    await assertRepOwnsAsset(req.user.id, entry.asset_id);

    await pool.query(
      'UPDATE ik_token_ledger SET confirmed_by = $1, confirmed_at = NOW() WHERE id = $2',
      [req.user.id, req.params.id]
    );

    await logAdminAction(req.user.id, 'ik.token.confirmed', 'ik_token_ledger', req.params.id,
      { amount: entry.amount, transaction_type: entry.transaction_type }, req);

    res.json({ success: true, message: 'Token receipt confirmed' });
  } catch (err) { next(err); }
});

// GET /community/assets/:id/tokens/export — CSV benefit distribution report (COM-012)
router.get('/assets/:id/tokens/export', authenticate, requireRole('community_rep'), async (req, res, next) => {
  try {
    await assertRepOwnsAsset(req.user.id, req.params.id);

    const { rows: [asset] } = await pool.query(
      'SELECT title, community_name FROM indigenous_knowledge WHERE id = $1', [req.params.id]
    );

    const { rows } = await pool.query(
      `SELECT tl.transaction_type, tl.amount, tl.recipient, tl.recipient_share,
              tl.confirmed_at, tl.notes, tl.created_at,
              u.full_name AS confirmed_by
       FROM ik_token_ledger tl
       LEFT JOIN users u ON u.id = tl.confirmed_by
       WHERE tl.asset_id = $1
       ORDER BY tl.created_at ASC`,
      [req.params.id]
    );

    const escape = v => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const headers = 'transaction_type,amount,recipient,recipient_share_pct,confirmed_at,notes,created_at,confirmed_by';
    const dataRows = rows.map(r =>
      [r.transaction_type, r.amount, r.recipient,
       r.recipient_share ? (parseFloat(r.recipient_share) * 100).toFixed(0) + '%' : '',
       r.confirmed_at ?? '', r.notes ?? '', r.created_at, r.confirmed_by ?? '']
      .map(escape).join(',')
    );

    const csv = [
      `# UniNMS Benefit Distribution Report`,
      `# Asset: ${asset?.title}  |  Community: ${asset?.community_name}`,
      `# Generated: ${new Date().toISOString()}`,
      '',
      headers,
      ...dataRows,
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition',
      `attachment; filename="benefit-distribution-${req.params.id}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

module.exports = router;
