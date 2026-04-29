'use strict';

/**
 * Deep Check Service — Copyleaks
 *
 * Submits a document to Copyleaks for deep plagiarism analysis:
 *   - 60B+ web pages
 *   - Paraphrase detection
 *   - AI writing detection (included)
 *   - 200M+ academic papers
 *
 * Flow (async — Copyleaks does NOT respond immediately):
 *   1. POST /v3/{email}/scan/submit/file  — submit document
 *   2. Copyleaks processes (seconds to minutes)
 *   3. Copyleaks POSTs to our webhook: POST /api/v1/plagiarism/webhook/copyleaks
 *   4. Webhook handler saves result to plagiarism_reports
 *
 * Requires env:
 *   COPYLEAKS_EMAIL     — account email used to generate token
 *   COPYLEAKS_API_KEY   — API key from Copyleaks dashboard
 *   FRONTEND_URL        — used to build webhook callback URL
 *
 * Pricing: ~$0.10 per credit, 1 credit ≈ 1 A4 page of text.
 * Only called for premium/enterprise universities.
 */

const crypto   = require('crypto');
const { pool } = require('../config/database');
const logger   = require('../utils/logger');

const COPYLEAKS_BASE = 'https://api.copyleaks.com';
const TIMEOUT_MS     = 15000;

// ── Token management ─────────────────────────────────────────────────────────
// Cache the bearer token in memory; it expires after 48 h.
let _token    = null;
let _tokenExp = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExp) return _token;

  const email  = process.env.COPYLEAKS_EMAIL;
  const apiKey = process.env.COPYLEAKS_API_KEY;
  if (!email || !apiKey) return null;

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    const res = await fetch(`${COPYLEAKS_BASE}/v3/account/login/api`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, key: apiKey }),
      signal:  ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      logger.warn(`[deepCheck] Copyleaks login failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    _token    = data.access_token;
    // Token valid for 48h; refresh 1h early
    _tokenExp = Date.now() + (47 * 60 * 60 * 1000);
    return _token;
  } catch (err) {
    logger.warn(`[deepCheck] Copyleaks login error: ${err.message}`);
    return null;
  }
}

// ── Submission ───────────────────────────────────────────────────────────────

/**
 * Submit a document to Copyleaks for deep scanning.
 * Updates plagiarism_reports.copyleaks_status = 'submitted'.
 * Final results arrive via the webhook handler below.
 *
 * @param {string} documentId
 * @param {string} text         — full extracted text
 * @param {string} title        — document title (used as filename)
 * @returns {Promise<string|null>} scanId or null on failure
 */
async function submitTocopyleaks(documentId, text, title) {
  if (!process.env.COPYLEAKS_EMAIL || !process.env.COPYLEAKS_API_KEY) return null;
  if (!text || text.trim().length < 100) return null;

  const token = await getToken();
  if (!token) return null;

  const email  = process.env.COPYLEAKS_EMAIL;
  const scanId = crypto.randomUUID().replace(/-/g, '').slice(0, 20);

  // Copyleaks expects base64-encoded text
  const base64Content = Buffer.from(text.slice(0, 500000)).toString('base64');
  const fileName      = `${title?.replace(/[^a-z0-9]/gi, '_').slice(0, 50) || 'document'}.txt`;

  const webhookBase = process.env.BACKEND_URL || process.env.FRONTEND_URL?.replace(/\/+$/, '') || '';

  const payload = {
    base64: base64Content,
    filename: fileName,
    properties: {
      webhooks: {
        status: `${webhookBase}/api/v1/plagiarism/webhook/copyleaks/{STATUS}/${documentId}/${scanId}`,
      },
      sensitiveDataProtection: {
        copyrightHolder: 'UniNMS',
      },
      scanning: {
        internet:    true,
        copyleaks:   true,
        journals:    true,
      },
      pdf: { create: false },
    },
  };

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    const res = await fetch(
      `${COPYLEAKS_BASE}/v3/${encodeURIComponent(email)}/scan/submit/file/${scanId}`,
      {
        method:  'PUT',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body:    JSON.stringify(payload),
        signal:  ctrl.signal,
      }
    );
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      logger.warn(`[deepCheck] Copyleaks submit failed: ${res.status} ${errText}`);
      return null;
    }

    // Mark as submitted
    await pool.query(
      `UPDATE plagiarism_reports
       SET copyleaks_status  = 'submitted',
           copyleaks_scan_id = $1
       WHERE document_id     = $2`,
      [scanId, documentId]
    );

    logger.info(`[deepCheck] submitted scanId=${scanId} for doc=${documentId}`);
    return scanId;
  } catch (err) {
    if (err.name !== 'AbortError') {
      logger.warn(`[deepCheck] Copyleaks submit error: ${err.message}`);
    }
    return null;
  }
}

// ── Webhook handler ──────────────────────────────────────────────────────────

/**
 * Handle a Copyleaks webhook callback.
 * Called by plagiarism.js route when POST /plagiarism/webhook/copyleaks/:status/:docId/:scanId arrives.
 *
 * @param {string} status     — 'completed' | 'error' | 'credits-went-below-minimum'
 * @param {string} documentId
 * @param {string} scanId
 * @param {object} body       — raw Copyleaks webhook payload
 */
async function handleWebhook(status, documentId, scanId, body) {
  logger.info(`[deepCheck] webhook status=${status} doc=${documentId} scan=${scanId}`);

  if (status === 'error') {
    await pool.query(
      `UPDATE plagiarism_reports SET copyleaks_status = 'error' WHERE document_id = $1`,
      [documentId]
    );
    return;
  }

  if (status !== 'completed') return;

  try {
    // Extract summary from Copyleaks completed payload
    const results = body?.results ?? {};
    const score   = body?.scannedDocument?.matchedWords != null && body?.scannedDocument?.totalWords
      ? Math.round((body.scannedDocument.matchedWords / body.scannedDocument.totalWords) * 10000) / 10000
      : null;

    const matches = [];

    // Internet matches
    for (const m of (results.internet ?? [])) {
      matches.push({
        type:       'internet',
        url:        m.url ?? null,
        title:      m.title ?? null,
        score:      m.similarWords != null && body?.scannedDocument?.totalWords
          ? Math.round((m.similarWords / body.scannedDocument.totalWords) * 10000) / 10000
          : null,
      });
    }

    // Database/repository matches
    for (const m of (results.database ?? [])) {
      matches.push({
        type:       'database',
        url:        m.url ?? null,
        title:      m.title ?? null,
        score:      m.similarWords != null && body?.scannedDocument?.totalWords
          ? Math.round((m.similarWords / body.scannedDocument.totalWords) * 10000) / 10000
          : null,
      });
    }

    // Build report URL
    const reportUrl = body?.reportUrl ?? null;

    await pool.query(
      `UPDATE plagiarism_reports
       SET copyleaks_status     = 'completed',
           copyleaks_score      = $1,
           copyleaks_report_url = $2,
           copyleaks_matches    = $3
       WHERE document_id        = $4`,
      [score, reportUrl, JSON.stringify(matches), documentId]
    );

    // If Copyleaks score is higher than current overall score, update document
    if (score != null) {
      await pool.query(
        `UPDATE documents
         SET plagiarism_score  = GREATEST(plagiarism_score, $1),
             plagiarism_status = CASE
               WHEN GREATEST(plagiarism_score, $1) >= 0.97 THEN 'duplicate'
               WHEN GREATEST(plagiarism_score, $1) >= 0.30 THEN 'flagged'
               ELSE plagiarism_status
             END
         WHERE id = $2`,
        [score, documentId]
      );
    }

    logger.info(`[deepCheck] completed doc=${documentId} score=${score} matches=${matches.length}`);
  } catch (err) {
    logger.error(`[deepCheck] webhook processing error: ${err.message}`);
  }
}

module.exports = { submitTocopyleaks, handleWebhook };
