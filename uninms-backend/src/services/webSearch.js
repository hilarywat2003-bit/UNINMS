'use strict';

/**
 * Web Snippet Search Service
 *
 * Takes the highest-scoring sentences from a plagiarism check and
 * searches Bing Web Search API to find whether those sentences appear
 * verbatim on the open web.
 *
 * Requires env:  BING_SEARCH_KEY
 * Free tier:     1,000 calls/month (Azure Cognitive Services F1 tier)
 *
 * Strategy:
 *   - Extract up to MAX_SENTENCES top sentences from the document's full_text
 *   - For each, run a Bing search with the sentence as a quoted query
 *   - Collect matching URLs and snippets
 *   - Return deduplicated results with source URL + matched snippet
 */

const logger = require('../utils/logger');

const TIMEOUT_MS    = 8000;
const MAX_SENTENCES = 5;    // number of sentences to spot-check
const MIN_SENT_LEN  = 60;   // chars — skip fragments
const BING_ENDPOINT = 'https://api.bing.microsoft.com/v7.0/search';

function topSentences(text, n = MAX_SENTENCES) {
  if (!text) return [];
  return text
    .replace(/\r\n/g, '\n')
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map(s => s.trim())
    .filter(s => s.length >= MIN_SENT_LEN && s.split(/\s+/).length >= 10)
    .slice(0, n * 3)                        // take first batch
    .sort((a, b) => b.length - a.length)    // prefer longer sentences
    .slice(0, n);
}

async function searchOne(sentence, apiKey) {
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    const url = `${BING_ENDPOINT}?q=${encodeURIComponent(`"${sentence.slice(0, 200)}"`)}&count=3&responseFilter=Webpages`;

    const res = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
      signal:  ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return [];

    const data  = await res.json();
    const pages = data?.webPages?.value ?? [];

    return pages.map(p => ({
      sentence: sentence.slice(0, 300),
      url:      p.url,
      title:    p.name,
      snippet:  p.snippet,
    }));
  } catch (err) {
    if (err.name !== 'AbortError') {
      logger.warn(`[webSearch] Bing search failed: ${err.message}`);
    }
    return [];
  }
}

/**
 * Search the web for verbatim sentences from the document.
 *
 * @param {string} fullText — extracted document text
 * @returns {Promise<Array>}  array of { sentence, url, title, snippet }
 */
async function searchWeb(fullText) {
  const apiKey = process.env.BING_SEARCH_KEY;
  if (!apiKey) return [];
  if (!fullText || fullText.trim().length < 200) return [];

  const sentences = topSentences(fullText);
  if (sentences.length === 0) return [];

  // Run searches sequentially to avoid Bing rate-limit (3 req/s on free tier)
  const results = [];
  for (const sentence of sentences) {
    const hits = await searchOne(sentence, apiKey);
    results.push(...hits);
    // Small delay between requests
    await new Promise(r => setTimeout(r, 350));
  }

  // Deduplicate by URL
  const byUrl = new Map();
  for (const r of results) {
    if (!byUrl.has(r.url)) byUrl.set(r.url, r);
  }

  logger.info(`[webSearch] ${byUrl.size} unique web matches found`);
  return [...byUrl.values()].slice(0, 20);
}

module.exports = { searchWeb };
