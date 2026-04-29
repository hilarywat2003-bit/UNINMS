'use strict';

/**
 * Billing Routes — /api/v1/billing  (University IT Administrator)
 *
 * Paystack payment integration for university subscription upgrades.
 * Scoped to the authenticated admin's own university.
 *
 * Endpoints:
 *  GET  /billing/current          Current subscription + payment history
 *  POST /billing/initialize       Start a Paystack payment session
 *  GET  /billing/verify/:ref      Verify payment after redirect & activate plan
 *  POST /billing/webhook          Paystack webhook (no auth — verified by signature)
 */

const https        = require('https');
const crypto       = require('crypto');
const express      = require('express');
const { pool }     = require('../config/database');
const { AppError } = require('../utils/AppError');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── Plan catalogue (must match frontend plans.ts) ─────────────────────────────
const PLAN_PRICES = {
  free:       0,
  basic:      25_000_000,   // ₦250,000 in kobo
  standard:   75_000_000,   // ₦750,000
  premium:   200_000_000,   // ₦2,000,000
  enterprise: null,          // custom — contact sales
};

const PLAN_LIMITS = {
  free:       { maxUsers: 50,     maxStorageGb: 5,      plagiarismChecks: 5,      features: [],
                aiDetection: false, webSearch: false, deepCheck: false },
  basic:      { maxUsers: 500,    maxStorageGb: 25,     plagiarismChecks: 50,     features: ['plagiarism', 'research_pipeline'],
                aiDetection: false, webSearch: false, deepCheck: false },
  standard:   { maxUsers: 2000,   maxStorageGb: 100,    plagiarismChecks: 200,    features: ['plagiarism', 'semantic_search', 'ai_insights', 'research_pipeline', 'knowledge_transfer', 'vc_dashboard', 'priority_support'],
                aiDetection: true,  webSearch: true,  deepCheck: false },
  premium:    { maxUsers: 10000,  maxStorageGb: 500,    plagiarismChecks: 2000,   features: ['plagiarism', 'semantic_search', 'ai_insights', 'research_pipeline', 'knowledge_transfer', 'vc_dashboard', 'tetfund_reports', 'national_hub', 'journals', 'api_access', 'sso', 'custom_branding', 'priority_support'],
                aiDetection: true,  webSearch: true,  deepCheck: true  },
  enterprise: { maxUsers: 999999, maxStorageGb: 999999, plagiarismChecks: 999999, features: ['plagiarism', 'semantic_search', 'ai_insights', 'research_pipeline', 'knowledge_transfer', 'vc_dashboard', 'tetfund_reports', 'national_hub', 'journals', 'api_access', 'sso', 'custom_branding', 'priority_support'],
                aiDetection: true,  webSearch: true,  deepCheck: true  },
};

// ── Paystack helper ───────────────────────────────────────────────────────────
function paystackRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data    = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.paystack.co',
      port:     443,
      path,
      method,
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };

    const req = https.request(options, res => {
      let raw = '';
      res.on('data', chunk => (raw += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error('Invalid Paystack response')); }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── Auth middleware ───────────────────────────────────────────────────────────
router.use('/plans',      authenticate, requireRole('admin', 'super_admin'));
router.use('/current',    authenticate, requireRole('admin', 'super_admin'));
router.use('/initialize', authenticate, requireRole('admin', 'super_admin'));
router.use('/verify',     authenticate, requireRole('admin', 'super_admin'));
// /webhook skips auth — signature-verified instead

// ══════════════════════════════════════════════════════════════════════════════
// 0. PLAN CATALOGUE (readable by any authenticated admin)
// ══════════════════════════════════════════════════════════════════════════════

router.get('/plans', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT key, label, tagline, price_naira, max_users, max_storage_gb,
              plagiarism_checks_per_month, features, badge, highlight, sort_order
       FROM subscription_plans
       WHERE is_active = true
       ORDER BY sort_order`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 1. CURRENT SUBSCRIPTION + HISTORY
// ══════════════════════════════════════════════════════════════════════════════

router.get('/current', async (req, res, next) => {
  try {
    const uniId = req.user.university_id;
    if (!uniId) return next(new AppError('No university linked to your account', 400, 'BAD_REQUEST'));

    const { rows: [sub] } = await pool.query(
      `SELECT s.plan, s.status, s.max_users, s.max_storage_gb,
              s.plagiarism_checks_per_month, s.features, s.expires_at,
              u.name AS university_name
       FROM institution_subscriptions s
       JOIN universities u ON u.id = s.university_id
       WHERE s.university_id = $1`,
      [uniId]
    );

    const { rows: history } = await pool.query(
      `SELECT id, plan, amount_kobo, reference, status, paid_at, created_at
       FROM payments
       WHERE university_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [uniId]
    );

    res.json({ success: true, data: { subscription: sub ?? null, history } });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. INITIALIZE PAYMENT
// ══════════════════════════════════════════════════════════════════════════════

router.post('/initialize', async (req, res, next) => {
  try {
    const uniId = req.user.university_id;
    if (!uniId) return next(new AppError('No university linked to your account', 400, 'BAD_REQUEST'));

    const { plan } = req.body;
    if (!plan || !PLAN_PRICES.hasOwnProperty(plan)) {
      return next(new AppError('Invalid plan', 400, 'BAD_REQUEST'));
    }
    if (plan === 'free') {
      return next(new AppError('Free plan requires no payment', 400, 'BAD_REQUEST'));
    }
    if (plan === 'enterprise') {
      return next(new AppError('Enterprise plan requires a custom agreement — contact sales', 400, 'BAD_REQUEST'));
    }

    const amountKobo = PLAN_PRICES[plan];
    const reference  = `uninms-${uniId.slice(0, 8)}-${Date.now()}`;
    const callbackUrl = `${process.env.FRONTEND_URL}/admin/billing/success?reference=${reference}`;

    // Get admin email for Paystack
    const { rows: [admin] } = await pool.query(
      'SELECT email FROM users WHERE id = $1',
      [req.user.id]
    );

    // Record pending payment
    await pool.query(
      `INSERT INTO payments (university_id, initiated_by, plan, amount_kobo, reference, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [uniId, req.user.id, plan, amountKobo, reference]
    );

    // Call Paystack
    const psResp = await paystackRequest('POST', '/transaction/initialize', {
      email:        admin.email,
      amount:       amountKobo,
      reference,
      callback_url: callbackUrl,
      metadata: {
        university_id: uniId,
        plan,
        initiated_by: req.user.id,
      },
    });

    if (!psResp.status) {
      return next(new AppError(psResp.message ?? 'Paystack error', 502, 'PAYMENT_INIT_FAILED'));
    }

    res.json({
      success: true,
      data: {
        authorization_url: psResp.data.authorization_url,
        reference,
        plan,
        amount_kobo: amountKobo,
      },
    });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. VERIFY PAYMENT (called after Paystack redirect)
// ══════════════════════════════════════════════════════════════════════════════

router.get('/verify/:reference', async (req, res, next) => {
  try {
    const { reference } = req.params;
    const uniId = req.user.university_id;

    // Load payment record
    const { rows: [payment] } = await pool.query(
      'SELECT * FROM payments WHERE reference = $1',
      [reference]
    );
    if (!payment) return next(new AppError('Payment not found', 404, 'NOT_FOUND'));
    if (payment.university_id !== uniId && !req.user.roles?.includes('super_admin')) {
      return next(new AppError('Forbidden', 403, 'FORBIDDEN'));
    }

    // Already verified
    if (payment.status === 'success') {
      return res.json({ success: true, data: { status: 'success', plan: payment.plan } });
    }

    // Verify with Paystack
    const psResp = await paystackRequest('GET', `/transaction/verify/${encodeURIComponent(reference)}`);

    if (!psResp.status || psResp.data?.status !== 'success') {
      await pool.query(
        `UPDATE payments SET status = 'failed', paystack_ref = $1 WHERE reference = $2`,
        [psResp.data?.reference ?? null, reference]
      );
      return res.json({ success: true, data: { status: 'failed' } });
    }

    const plan   = payment.plan;
    const limits = PLAN_LIMITS[plan];

    // Build features object for DB
    const allFeatureKeys = ['plagiarism','semantic_search','ai_insights','research_pipeline','knowledge_transfer','vc_dashboard','tetfund_reports','national_hub','journals','api_access','sso','custom_branding','priority_support'];
    const featuresObj = {};
    for (const k of allFeatureKeys) featuresObj[k] = limits.features.includes(k);

    // Update payment record
    await pool.query(
      `UPDATE payments
       SET status = 'success', paystack_ref = $1, paid_at = NOW()
       WHERE reference = $2`,
      [psResp.data.reference, reference]
    );

    // Activate subscription
    await pool.query(
      `UPDATE institution_subscriptions
       SET plan = $1, status = 'active',
           max_users = $2, max_storage_gb = $3,
           plagiarism_checks_per_month = $4,
           features = $5,
           plagiarism_ai_detection = $6,
           plagiarism_web_search   = $7,
           plagiarism_deep_check   = $8,
           expires_at = NOW() + INTERVAL '1 year',
           updated_at = NOW()
       WHERE university_id = $9`,
      [plan, limits.maxUsers, limits.maxStorageGb,
       limits.plagiarismChecks,
       JSON.stringify(featuresObj),
       limits.aiDetection, limits.webSearch, limits.deepCheck,
       payment.university_id]
    );

    res.json({ success: true, data: { status: 'success', plan } });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. PAYSTACK WEBHOOK (raw body, no auth — verify HMAC)
// ══════════════════════════════════════════════════════════════════════════════

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY ?? '')
      .update(req.body)
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).end();
    }

    const event = JSON.parse(req.body.toString());
    if (event.event !== 'charge.success') return res.sendStatus(200);

    const ref = event.data?.reference;
    const { rows: [payment] } = await pool.query(
      'SELECT * FROM payments WHERE reference = $1 AND status = $2',
      [ref, 'pending']
    );
    if (!payment) return res.sendStatus(200);

    const plan   = payment.plan;
    const limits = PLAN_LIMITS[plan];
    const allFeatureKeys = ['plagiarism','semantic_search','ai_insights','research_pipeline','knowledge_transfer','vc_dashboard','tetfund_reports','national_hub','journals','api_access','sso','custom_branding','priority_support'];
    const featuresObj = {};
    for (const k of allFeatureKeys) featuresObj[k] = limits.features.includes(k);

    await pool.query(
      `UPDATE payments SET status = 'success', paystack_ref = $1, paid_at = NOW() WHERE reference = $2`,
      [event.data.reference, ref]
    );

    await pool.query(
      `UPDATE institution_subscriptions
       SET plan = $1, status = 'active',
           max_users = $2, max_storage_gb = $3,
           plagiarism_checks_per_month = $4,
           features = $5,
           plagiarism_ai_detection = $6,
           plagiarism_web_search   = $7,
           plagiarism_deep_check   = $8,
           expires_at = NOW() + INTERVAL '1 year',
           updated_at = NOW()
       WHERE university_id = $9`,
      [plan, limits.maxUsers, limits.maxStorageGb,
       limits.plagiarismChecks,
       JSON.stringify(featuresObj),
       limits.aiDetection, limits.webSearch, limits.deepCheck,
       payment.university_id]
    );

    res.sendStatus(200);
  } catch {
    res.sendStatus(200); // Always 200 to Paystack
  }
});

module.exports = router;
