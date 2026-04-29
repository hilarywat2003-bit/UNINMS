'use strict';

/**
 * Plagiarism Gate — Subscription Enforcement & Feature Orchestration
 *
 * Determines which plagiarism passes are available to a university
 * based on its subscription plan, then enforces monthly usage quotas.
 *
 * Plan → feature matrix:
 * ┌───────────┬───────┬──────┬───────────┬────────────┬────────────┬────────────┐
 * │ Plan      │ Hash  │ Text │ Semantic  │ AI detect  │ Web search │ Deep check │
 * │           │       │shingle│ (vector) │ (GPTZero)  │  (Bing)    │(Copyleaks) │
 * ├───────────┼───────┼──────┼───────────┼────────────┼────────────┼────────────┤
 * │ free      │  ✅   │  ✅  │    ❌     │     ❌     │     ❌     │     ❌     │
 * │ basic     │  ✅   │  ✅  │    ✅     │     ❌     │     ❌     │     ❌     │
 * │ standard  │  ✅   │  ✅  │    ✅     │     ✅     │     ✅     │     ❌     │
 * │ premium   │  ✅   │  ✅  │    ✅     │     ✅     │     ✅     │     ✅     │
 * │ enterprise│  ✅   │  ✅  │    ✅     │     ✅     │     ✅     │     ✅     │
 * └───────────┴───────┴──────┴───────────┴────────────┴────────────┴────────────┘
 *
 * Monthly check quotas:
 *   free: 5  |  basic: 50  |  standard: 200  |  premium: 2000  |  enterprise: ∞
 */

const { pool } = require('../config/database');
const logger   = require('../utils/logger');

// Fallback limits used when the subscription row is missing or plan is unrecognised
const DEFAULT_PLAN_CAPS = {
  free:       { checks: 5,       semantic: false, aiDetection: false, webSearch: false, deepCheck: false },
  basic:      { checks: 50,      semantic: true,  aiDetection: false, webSearch: false, deepCheck: false },
  standard:   { checks: 200,     semantic: true,  aiDetection: true,  webSearch: true,  deepCheck: false },
  premium:    { checks: 2000,    semantic: true,  aiDetection: true,  webSearch: true,  deepCheck: true  },
  enterprise: { checks: 999999,  semantic: true,  aiDetection: true,  webSearch: true,  deepCheck: true  },
};

/**
 * Load a university's subscription and resolve the feature set.
 *
 * @param {string|null} universityId
 * @returns {Promise<{
 *   plan: string,
 *   checksPerMonth: number,
 *   checksUsed: number,
 *   checksRemaining: number,
 *   quotaExceeded: boolean,
 *   semantic: boolean,
 *   aiDetection: boolean,
 *   webSearch: boolean,
 *   deepCheck: boolean,
 * }>}
 */
async function getGate(universityId) {
  // Unknown university → free plan, no quota tracking
  if (!universityId) return _buildGate('free', 0, false);

  try {
    const { rows: [sub] } = await pool.query(
      `SELECT plan, plagiarism_checks_per_month,
              plagiarism_ai_detection, plagiarism_web_search, plagiarism_deep_check,
              features
       FROM institution_subscriptions
       WHERE university_id = $1`,
      [universityId]
    );

    const plan            = sub?.plan ?? 'free';
    const capsFromDb      = DEFAULT_PLAN_CAPS[plan] ?? DEFAULT_PLAN_CAPS.free;
    const checksPerMonth  = sub?.plagiarism_checks_per_month ?? capsFromDb.checks;

    // Feature flags — prefer DB columns, fall back to plan defaults
    const aiDetection = sub?.plagiarism_ai_detection   ?? capsFromDb.aiDetection;
    const webSearch   = sub?.plagiarism_web_search      ?? capsFromDb.webSearch;
    const deepCheck   = sub?.plagiarism_deep_check      ?? capsFromDb.deepCheck;
    const semantic    = capsFromDb.semantic;

    // Load current month's usage
    const yearMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    const { rows: [usage] } = await pool.query(
      `SELECT checks_used FROM plagiarism_usage
       WHERE university_id = $1 AND year_month = $2`,
      [universityId, yearMonth]
    );
    const checksUsed      = usage?.checks_used ?? 0;
    const quotaExceeded   = checksPerMonth > 0 && checksUsed >= checksPerMonth;
    const checksRemaining = Math.max(0, checksPerMonth - checksUsed);

    return {
      plan, checksPerMonth, checksUsed, checksRemaining, quotaExceeded,
      semantic, aiDetection, webSearch, deepCheck,
    };
  } catch (err) {
    logger.warn(`[plagiarismGate] could not load subscription: ${err.message}`);
    return _buildGate('free', 0, false);
  }
}

/**
 * Increment the monthly usage counter for a university.
 * Safe to call fire-and-forget.
 */
async function incrementUsage(universityId) {
  if (!universityId) return;
  const yearMonth = new Date().toISOString().slice(0, 7);
  try {
    await pool.query(
      `INSERT INTO plagiarism_usage (university_id, year_month, checks_used)
       VALUES ($1, $2, 1)
       ON CONFLICT (university_id, year_month)
       DO UPDATE SET checks_used = plagiarism_usage.checks_used + 1,
                     updated_at  = NOW()`,
      [universityId, yearMonth]
    );
  } catch (err) {
    logger.warn(`[plagiarismGate] usage increment failed: ${err.message}`);
  }
}

function _buildGate(plan, checksUsed, quotaExceeded) {
  const caps = DEFAULT_PLAN_CAPS[plan] ?? DEFAULT_PLAN_CAPS.free;
  return {
    plan,
    checksPerMonth:  caps.checks,
    checksUsed,
    checksRemaining: Math.max(0, caps.checks - checksUsed),
    quotaExceeded,
    semantic:        caps.semantic,
    aiDetection:     caps.aiDetection,
    webSearch:       caps.webSearch,
    deepCheck:       caps.deepCheck,
  };
}

module.exports = { getGate, incrementUsage };
