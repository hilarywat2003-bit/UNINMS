'use strict';

const { pool } = require('../config/database');
const logger   = require('./logger');

/**
 * Write an immutable admin action to the audit_log table.
 * Failures are logged but never thrown — auditing must not block requests.
 *
 * @param {string}      actorId    UUID of the user performing the action
 * @param {string}      action     Verb slug, e.g. 'user.suspend', 'document.approve'
 * @param {string|null} targetType Table name of the affected entity, e.g. 'users'
 * @param {string|null} targetId   UUID of the affected entity
 * @param {object}      details    Extra context stored as JSONB
 * @param {object|null} req        Express request (used to capture IP address)
 */
async function logAdminAction(actorId, action, targetType = null, targetId = null, details = {}, req = null) {
  try {
    const ip = req
      ? (req.headers['x-forwarded-for']?.split(',')[0].trim() ?? req.socket?.remoteAddress ?? null)
      : null;

    await pool.query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6::inet)`,
      [actorId, action, targetType, targetId, JSON.stringify(details), ip]
    );
  } catch (err) {
    logger.error(`[audit] Failed to write log entry for action "${action}": ${err.message}`);
  }
}

module.exports = { logAdminAction };
