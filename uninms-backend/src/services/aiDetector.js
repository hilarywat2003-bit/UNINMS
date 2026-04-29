'use strict';

/**
 * AI-Generated Text Detection Service
 *
 * Uses the GPTZero API to determine the probability that a document
 * was written by an AI (ChatGPT, Claude, etc.).
 *
 * Requires env:  GPTZERO_API_KEY
 * Free tier:     10 requests/day
 * Paid tiers:    https://gptzero.me/api
 *
 * Returns:
 *   { score: 0.0–1.0, label: 'human'|'mixed'|'ai', checked: true }
 *   or null when the API key is not configured or the call fails.
 */

const logger = require('../utils/logger');

const TIMEOUT_MS  = 15000;
const AI_ENDPOINT = 'https://api.gptzero.me/v2/predict/text';

// Label thresholds (matches GPTZero's own classification)
function labelFromScore(score) {
  if (score >= 0.80) return 'ai';
  if (score >= 0.30) return 'mixed';
  return 'human';
}

/**
 * Detect AI authorship for the given text.
 *
 * @param {string} text — document full text (or title + abstract)
 * @returns {Promise<{score: number, label: string, checked: boolean}|null>}
 */
async function detectAI(text) {
  const apiKey = process.env.GPTZERO_API_KEY;
  if (!apiKey) return null;
  if (!text || text.trim().length < 100) return null;

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    const res = await fetch(AI_ENDPOINT, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'x-api-key':     apiKey,
      },
      body:    JSON.stringify({
        document:       text.slice(0, 50000), // GPTZero max
        multilingual:   false,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      logger.warn(`[aiDetector] GPTZero returned ${res.status}`);
      return null;
    }

    const data = await res.json();

    // GPTZero v2 shape: data.documents[0].completely_generated_prob
    const doc   = data?.documents?.[0] ?? data?.document ?? data;
    const score = doc?.completely_generated_prob
               ?? doc?.average_generated_prob
               ?? null;

    if (score === null) {
      logger.warn('[aiDetector] unexpected GPTZero response shape');
      return null;
    }

    const rounded = Math.round(score * 10000) / 10000;
    logger.info(`[aiDetector] score=${rounded}`);

    return { score: rounded, label: labelFromScore(rounded), checked: true };
  } catch (err) {
    if (err.name !== 'AbortError') {
      logger.warn(`[aiDetector] GPTZero call failed: ${err.message}`);
    }
    return null;
  }
}

module.exports = { detectAI };
