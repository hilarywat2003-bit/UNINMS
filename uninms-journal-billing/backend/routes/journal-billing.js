'use strict';
const express  = require('express');
const { pool } = require('../config/database');
const { AppError } = require('../utils/AppError');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const APP_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

// ── Paystack helpers ──────────────────────────────────────────────────────────
async function initPaystack({ email, amount, reference, metadata, callbackUrl }) {
  const { default: fetch } = await import('node-fetch');
  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, amount: Math.round(amount * 100), reference, callback_url: callbackUrl, metadata }),
  });
  const data = await res.json();
  if (!data.status) throw new Error(data.message || 'Paystack failed');
  return data.data;
}

async function verifyPaystack(reference) {
  const { default: fetch } = await import('node-fetch');
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
  });
  const data = await res.json();
  return data.data;
}

// ── Plans ─────────────────────────────────────────────────────────────────────
router.get('/plans', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM journal_plans WHERE is_active=true ORDER BY sort_order`);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.patch('/plans/:id', authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const fields = ['name','price_yearly','price_monthly','max_articles','max_issues','max_editors','max_reviewers','features','is_active'];
    const updates = [], vals = [];
    let i = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) { updates.push(`${f}=$${i++}`); vals.push(req.body[f]); }
    }
    if (!updates.length) throw new AppError('Nothing to update', 400, 'NO_CHANGES');
    vals.push(req.params.id);
    const { rows: [plan] } = await pool.query(
      `UPDATE journal_plans SET ${updates.join(',')},updated_at=NOW() WHERE id=$${i} RETURNING *`, vals
    );
    res.json({ success: true, data: plan });
  } catch (err) { next(err); }
});

// ── IT Admin: Create journal + initiate subscription payment ──────────────────
router.post('/journals', authenticate, requireRole('admin','super_admin'), async (req, res, next) => {
  try {
    const { title, departmentId, editorId, issn_print, issn_online, scope, description,
            frequency, reviewType, isOpenAccess, language, subjects, planId, billingCycle } = req.body;

    if (!title)  throw new AppError('Journal title is required', 422, 'VALIDATION_ERROR');
    if (!planId) throw new AppError('A subscription plan must be selected', 422, 'VALIDATION_ERROR');

    const { rows: [plan] } = await pool.query(
      `SELECT * FROM journal_plans WHERE id=$1 AND is_active=true`, [planId]
    );
    if (!plan) throw new AppError('Invalid or inactive plan', 422, 'VALIDATION_ERROR');

    const amount = billingCycle === 'monthly'
      ? parseFloat(plan.price_monthly || plan.price_yearly / 12)
      : parseFloat(plan.price_yearly);

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      + '-' + Date.now().toString(36);

    const { rows: [userInfo] } = await pool.query(
      `SELECT university_id, email FROM users WHERE id=$1`, [req.user.id]
    );

    // Create journal (pending state)
    const { rows: [journal] } = await pool.query(
      `INSERT INTO journals
         (university_id,department_id,editor_id,title,slug,issn_print,issn_online,
          scope,description,frequency,review_type,is_open_access,language,subjects,
          status,subscription_status,plan_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending','pending_payment',$15)
       RETURNING *`,
      [userInfo?.university_id||null, departmentId||null, editorId||null, title, slug,
       issn_print||null, issn_online||null, scope||null, description||null,
       frequency||'biannual', reviewType||'double_blind', isOpenAccess!==false,
       language||'English', subjects||[], planId]
    );

    // Create subscription record
    const expiresAt = new Date();
    if (billingCycle === 'monthly') expiresAt.setMonth(expiresAt.getMonth() + 1);
    else expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const { rows: [sub] } = await pool.query(
      `INSERT INTO journal_subscriptions
         (journal_id,plan_id,status,billing_cycle,amount_paid,expires_at)
       VALUES ($1,$2,'pending_payment',$3,$4,$5) RETURNING *`,
      [journal.id, planId, billingCycle||'yearly', amount, expiresAt]
    );

    await pool.query(`UPDATE journals SET subscription_id=$1 WHERE id=$2`, [sub.id, journal.id]);

    // Init Paystack
    const reference  = `UNINMS-JNL-${journal.id.slice(0,8).toUpperCase()}-${Date.now()}`;
    const callbackUrl = `${APP_URL}/admin/journals/billing/success?ref=${reference}&journalId=${journal.id}`;

    let authUrl = null;
    try {
      const payData = await initPaystack({
        email: userInfo?.email || req.user.email,
        amount, reference, callbackUrl,
        metadata: { journal_id: journal.id, plan_name: plan.name, subscription_id: sub.id, uninms_type: 'journal_subscription' },
      });
      authUrl = payData.authorization_url;
    } catch (payErr) {
      // If Paystack keys not set, allow manual payment flow
      console.error('[journal-billing] Paystack init failed:', payErr.message);
    }

    await pool.query(
      `INSERT INTO journal_payments (journal_id,subscription_id,paid_by,plan_id,amount,currency,paystack_ref,status)
       VALUES ($1,$2,$3,$4,$5,'NGN',$6,'pending')`,
      [journal.id, sub.id, req.user.id, planId, amount, reference]
    );

    res.status(201).json({
      success: true,
      data: {
        journal, subscription: sub,
        payment: { reference, amount, currency: 'NGN', authorization_url: authUrl, plan_name: plan.name },
      },
      message: 'Journal created. Complete payment to activate.',
    });
  } catch (err) { next(err); }
});

// ── Verify payment after Paystack redirect ────────────────────────────────────
router.get('/verify/:reference', authenticate, async (req, res, next) => {
  try {
    const { rows: [payment] } = await pool.query(
      `SELECT * FROM journal_payments WHERE paystack_ref=$1`, [req.params.reference]
    );
    if (!payment) throw new AppError('Payment record not found', 404, 'NOT_FOUND');
    if (payment.status === 'success') {
      return res.json({ success: true, data: { status: 'already_verified', journalId: payment.journal_id } });
    }

    const psData = await verifyPaystack(req.params.reference);

    if (psData.status === 'success') {
      await pool.query(
        `UPDATE journal_payments SET status='success',payment_method=$1,paid_at=NOW() WHERE paystack_ref=$2`,
        [psData.channel||'card', req.params.reference]
      );
      await pool.query(
        `UPDATE journal_subscriptions SET status='payment_received',updated_at=NOW() WHERE id=$1`,
        [payment.subscription_id]
      );
      await pool.query(
        `UPDATE journals SET subscription_status='payment_received',updated_at=NOW() WHERE id=$1`,
        [payment.journal_id]
      );
      res.json({
        success: true,
        data: { status: 'payment_received', journalId: payment.journal_id, amount: payment.amount,
                message: 'Payment confirmed. Awaiting super admin approval.' },
      });
    } else {
      await pool.query(`UPDATE journal_payments SET status='failed' WHERE paystack_ref=$1`, [req.params.reference]);
      throw new AppError('Payment was not successful', 402, 'PAYMENT_FAILED');
    }
  } catch (err) { next(err); }
});

// ── Paystack webhook ──────────────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  try {
    if (req.body?.event === 'charge.success') {
      const ref = req.body.data?.reference;
      const { rows: [p] } = await pool.query(
        `SELECT * FROM journal_payments WHERE paystack_ref=$1 AND status='pending'`, [ref]
      );
      if (p) {
        await pool.query(`UPDATE journal_payments SET status='success',paid_at=NOW() WHERE paystack_ref=$1`, [ref]);
        await pool.query(`UPDATE journal_subscriptions SET status='payment_received',updated_at=NOW() WHERE id=$1`, [p.subscription_id]);
        await pool.query(`UPDATE journals SET subscription_status='payment_received',updated_at=NOW() WHERE id=$1`, [p.journal_id]);
      }
    }
    res.sendStatus(200);
  } catch { res.sendStatus(200); }
});

// ── Super Admin: Pending approvals ────────────────────────────────────────────
router.get('/pending', authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT j.id, j.title, j.slug, j.status, j.subscription_status,
              j.issn_print, j.issn_online, j.scope, j.frequency, j.review_type,
              j.is_open_access, j.created_at, j.rejection_reason,
              u.name AS university_name, dep.name AS department_name,
              jp.name AS plan_name, jp.price_yearly, jp.features,
              js.billing_cycle, js.amount_paid, js.expires_at,
              pay.amount AS paid_amount, pay.paid_at, pay.paystack_ref,
              payer.full_name AS paid_by_name, payer.email AS paid_by_email
       FROM journals j
       LEFT JOIN universities u   ON u.id=j.university_id
       LEFT JOIN departments dep  ON dep.id=j.department_id
       LEFT JOIN journal_plans jp ON jp.id=j.plan_id
       LEFT JOIN journal_subscriptions js ON js.id=j.subscription_id
       LEFT JOIN journal_payments pay ON pay.journal_id=j.id AND pay.status='success'
       LEFT JOIN users payer ON payer.id=pay.paid_by
       WHERE j.subscription_status IN ('payment_received','pending_payment')
         AND j.deleted_at IS NULL
       ORDER BY pay.paid_at DESC NULLS LAST, j.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── Super Admin: All journals ─────────────────────────────────────────────────
router.get('/all', authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = ['j.deleted_at IS NULL'];
    const vals = [];
    if (status) { where.push(`j.subscription_status=$1`); vals.push(status); }

    const { rows } = await pool.query(
      `SELECT j.id, j.title, j.slug, j.status, j.subscription_status,
              j.approved_at, j.rejection_reason, j.created_at,
              u.name AS university_name, jp.name AS plan_name,
              js.billing_cycle, js.expires_at,
              pay.paid_at, pay.amount AS paid_amount,
              approver.full_name AS approved_by_name
       FROM journals j
       LEFT JOIN universities u   ON u.id=j.university_id
       LEFT JOIN journal_plans jp ON jp.id=j.plan_id
       LEFT JOIN journal_subscriptions js ON js.id=j.subscription_id
       LEFT JOIN journal_payments pay ON pay.journal_id=j.id AND pay.status='success'
       LEFT JOIN users approver ON approver.id=j.approved_by
       WHERE ${where.join(' AND ')}
       ORDER BY j.created_at DESC`,
      vals
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── Super Admin: Approve ──────────────────────────────────────────────────────
router.post('/:journalId/approve', authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { note } = req.body;
    const { rows: [j] } = await pool.query(
      `SELECT j.*,js.id AS sub_id FROM journals j
       LEFT JOIN journal_subscriptions js ON js.id=j.subscription_id
       WHERE j.id=$1 AND j.deleted_at IS NULL`, [req.params.journalId]
    );
    if (!j) throw new AppError('Journal not found', 404, 'NOT_FOUND');
    if (j.subscription_status !== 'payment_received') {
      throw new AppError('Payment has not been confirmed for this journal', 422, 'INVALID_STATE');
    }

    await pool.query(
      `UPDATE journals SET status='active',subscription_status='active',
         approved_by=$1,approved_at=NOW(),updated_at=NOW() WHERE id=$2`,
      [req.user.id, req.params.journalId]
    );
    await pool.query(
      `UPDATE journal_subscriptions SET status='active',started_at=NOW(),updated_at=NOW() WHERE id=$1`,
      [j.sub_id]
    );
    await pool.query(
      `UPDATE journal_payments SET approved_by=$1,approved_at=NOW(),approval_note=$2
       WHERE journal_id=$3 AND status='success'`,
      [req.user.id, note||null, req.params.journalId]
    );
    await pool.query(
      `INSERT INTO journal_approval_log(journal_id,action,performed_by,note) VALUES($1,'approved',$2,$3)`,
      [req.params.journalId, req.user.id, note||null]
    );

    res.json({ success: true, message: `Journal "${j.title}" approved and activated.` });
  } catch (err) { next(err); }
});

// ── Super Admin: Reject ───────────────────────────────────────────────────────
router.post('/:journalId/reject', authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) throw new AppError('Rejection reason is required', 422, 'VALIDATION_ERROR');

    await pool.query(
      `UPDATE journals SET status='pending',subscription_status='rejected',
         rejection_reason=$1,updated_at=NOW() WHERE id=$2`,
      [reason, req.params.journalId]
    );
    await pool.query(
      `INSERT INTO journal_approval_log(journal_id,action,performed_by,note) VALUES($1,'rejected',$2,$3)`,
      [req.params.journalId, req.user.id, reason]
    );
    res.json({ success: true, message: 'Journal rejected.' });
  } catch (err) { next(err); }
});

// ── Super Admin: Suspend ──────────────────────────────────────────────────────
router.post('/:journalId/suspend', authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    await pool.query(
      `UPDATE journals SET status='suspended',subscription_status='suspended',
         rejection_reason=$1,updated_at=NOW() WHERE id=$2`,
      [reason||null, req.params.journalId]
    );
    await pool.query(
      `INSERT INTO journal_approval_log(journal_id,action,performed_by,note) VALUES($1,'suspended',$2,$3)`,
      [req.params.journalId, req.user.id, reason||null]
    );
    res.json({ success: true, message: 'Journal suspended.' });
  } catch (err) { next(err); }
});

// ── IT Admin: My journals with billing status ─────────────────────────────────
router.get('/my', authenticate, requireRole('admin','super_admin'), async (req, res, next) => {
  try {
    const { rows: [ui] } = await pool.query(`SELECT university_id FROM users WHERE id=$1`, [req.user.id]);
    const { rows } = await pool.query(
      `SELECT j.id, j.title, j.slug, j.status, j.subscription_status,
              j.rejection_reason, j.approved_at, j.created_at,
              jp.name AS plan_name, jp.price_yearly, jp.features,
              js.billing_cycle, js.expires_at, js.amount_paid,
              pay.paystack_ref, pay.paid_at, pay.amount AS paid_amount, pay.status AS payment_status
       FROM journals j
       LEFT JOIN journal_plans jp ON jp.id=j.plan_id
       LEFT JOIN journal_subscriptions js ON js.id=j.subscription_id
       LEFT JOIN journal_payments pay ON pay.journal_id=j.id
       WHERE j.university_id=$1 AND j.deleted_at IS NULL
       ORDER BY j.created_at DESC`,
      [ui?.university_id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── Super Admin: Billing stats ────────────────────────────────────────────────
router.get('/stats', authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const [totals, revenue, byPlan, recent] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE subscription_status='active')           AS active_journals,
          COUNT(*) FILTER (WHERE subscription_status='payment_received') AS pending_approval,
          COUNT(*) FILTER (WHERE subscription_status='pending_payment')  AS awaiting_payment,
          COUNT(*) FILTER (WHERE subscription_status='rejected')         AS rejected,
          COUNT(*) FILTER (WHERE status='suspended')                     AS suspended,
          COUNT(*)                                                        AS total_journals
        FROM journals WHERE deleted_at IS NULL`),
      pool.query(`
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE status='success'),0) AS total_revenue,
          COALESCE(SUM(amount) FILTER (WHERE status='success' AND paid_at>=date_trunc('month',NOW())),0) AS this_month,
          COUNT(*) FILTER (WHERE status='success')  AS total_payments,
          COUNT(*) FILTER (WHERE status='pending')  AS pending_payments
        FROM journal_payments`),
      pool.query(`
        SELECT jp.name,jp.slug,COUNT(j.id) AS journal_count,
               COALESCE(SUM(pay.amount) FILTER (WHERE pay.status='success'),0) AS revenue
        FROM journal_plans jp
        LEFT JOIN journals j ON j.plan_id=jp.id AND j.deleted_at IS NULL
        LEFT JOIN journal_payments pay ON pay.journal_id=j.id
        GROUP BY jp.id,jp.name,jp.slug ORDER BY jp.sort_order`),
      pool.query(`
        SELECT pay.amount,pay.paid_at,pay.paystack_ref,
               j.title AS journal_title,jp.name AS plan_name,u.full_name AS paid_by
        FROM journal_payments pay
        LEFT JOIN journals j ON j.id=pay.journal_id
        LEFT JOIN journal_plans jp ON jp.id=pay.plan_id
        LEFT JOIN users u ON u.id=pay.paid_by
        WHERE pay.status='success' ORDER BY pay.paid_at DESC LIMIT 8`),
    ]);
    res.json({ success: true, data: { totals: totals.rows[0], revenue: revenue.rows[0], byPlan: byPlan.rows, recent: recent.rows } });
  } catch (err) { next(err); }
});

module.exports = router;
