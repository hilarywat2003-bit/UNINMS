'use strict';

/**
 * External Source Checker
 *
 * Searches CrossRef and Semantic Scholar for papers whose titles
 * closely match the document being checked.  Results are merged,
 * deduplicated by DOI, and ranked by title similarity.
 *
 * Both APIs are free and require no key.  Network failures are
 * swallowed — external-source checking is best-effort.
 */

const logger = require('../utils/logger');

const TIMEOUT_MS  = 7000;
const MIN_SCORE   = 0.35;   // minimum title overlap to include a result
const MAX_RESULTS = 10;

// ── Title similarity ─────────────────────────────────────────────────────────

/**
 * Word-level Jaccard overlap on significant words (length > 3).
 * Quick proxy for title similarity without heavy NLP.
 */
function titleScore(a, b) {
  const sig = t => new Set(
    (t || '').toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
  );
  const sa = sig(a);
  const sb = sig(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let shared = 0;
  for (const w of sa) { if (sb.has(w)) shared++; }
  return shared / (sa.size + sb.size - shared);
}

// ── CrossRef ─────────────────────────────────────────────────────────────────

async function checkCrossRef(title) {
  try {
    const url = `https://api.crossref.org/works?`
      + `query.title=${encodeURIComponent(title)}&rows=8`
      + `&select=title,DOI,author,published-print,published-online,container-title,type`;

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    const res = await fetch(url, {
      headers: { 'User-Agent': 'UNINMS/1.0 (plagiarism-check; mailto:admin@uninms.edu.ng)' },
      signal:  ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];

    const data = await res.json();
    return (data.message?.items ?? []).flatMap(item => {
      const t   = Array.isArray(item.title) ? item.title[0] : (item.title || '');
      const score = titleScore(title, t);
      if (score < MIN_SCORE) return [];

      const year = item['published-print']?.['date-parts']?.[0]?.[0]
                ?? item['published-online']?.['date-parts']?.[0]?.[0]
                ?? null;
      const journal = Array.isArray(item['container-title'])
        ? item['container-title'][0]
        : (item['container-title'] || null);
      const doi = item.DOI ?? null;

      return [{
        source:  'crossref',
        title:   t,
        doi,
        year,
        journal: journal || null,
        url:     doi ? `https://doi.org/${doi}` : null,
        score:   Math.round(score * 1000) / 1000,
      }];
    });
  } catch (err) {
    if (err.name !== 'AbortError') {
      logger.warn(`[externalSources] CrossRef failed: ${err.message}`);
    }
    return [];
  }
}

// ── Semantic Scholar ──────────────────────────────────────────────────────────

async function checkSemanticScholar(title) {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?`
      + `query=${encodeURIComponent(title)}&limit=8`
      + `&fields=title,externalIds,year,venue,authors`;

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res   = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return [];

    const data = await res.json();
    return (data.data ?? []).flatMap(p => {
      const t     = p.title || '';
      const score = titleScore(title, t);
      if (score < MIN_SCORE) return [];

      const doi = p.externalIds?.DOI ?? null;
      return [{
        source:  'semantic_scholar',
        title:   t,
        doi,
        year:    p.year ?? null,
        journal: p.venue || null,
        url:     doi
          ? `https://doi.org/${doi}`
          : `https://www.semanticscholar.org/paper/${p.paperId}`,
        score:   Math.round(score * 1000) / 1000,
      }];
    });
  } catch (err) {
    if (err.name !== 'AbortError') {
      logger.warn(`[externalSources] SemanticScholar failed: ${err.message}`);
    }
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Query both CrossRef and Semantic Scholar in parallel.
 * Returns deduplicated results sorted by title similarity score (desc).
 *
 * @param {string} title — document title to search
 * @returns {Promise<Array>}
 */
async function checkExternalSources(title) {
  if (!title || title.trim().length < 5) return [];

  const [cr, ss] = await Promise.allSettled([
    checkCrossRef(title),
    checkSemanticScholar(title),
  ]);

  const combined = [
    ...(cr.status === 'fulfilled' ? cr.value : []),
    ...(ss.status === 'fulfilled' ? ss.value : []),
  ];

  // Deduplicate by DOI; keep highest-scoring copy
  const byDoi  = new Map();
  const noDoi  = [];
  for (const m of combined) {
    if (m.doi) {
      const existing = byDoi.get(m.doi);
      if (!existing || m.score > existing.score) byDoi.set(m.doi, m);
    } else {
      noDoi.push(m);
    }
  }

  return [...byDoi.values(), ...noDoi]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);
}

module.exports = { checkExternalSources };
