'use strict';

/**
 * Plagiarism & Similarity Detection Service  (v2)
 *
 * Four-pass detection pipeline:
 *
 *  1. Exact-duplicate    — SHA-256 hash of normalised title + abstract
 *  2. Semantic vector    — cosine distance on 1536-dim OpenAI embeddings (pgvector)
 *  3. Text shingles      — Jaccard similarity on 3-word shingles of full document text
 *  4. External sources   — CrossRef + Semantic Scholar title search
 *
 * Scoring blend (internal matches):
 *   With embedding:    0.6 × semantic + 0.4 × shingle
 *   Without embedding: shingle only
 *
 * Key improvements over v1:
 *  - Uses full_text (extracted from PDF/DOCX) instead of abstract only
 *  - Sentence-level match pairs for the top 3 internal matches
 *  - External source check (CrossRef + Semantic Scholar) — no API key needed
 *  - Text-only candidate selection uses trigram title pre-filter instead of a
 *    random 500-document cap
 */

const crypto   = require('crypto');
const { pool } = require('../config/database');
const logger   = require('../utils/logger');
const { checkExternalSources } = require('./externalSources');

const SIMILARITY_THRESHOLD = 0.30;   // >= 30 % → flagged
const DUPLICATE_THRESHOLD  = 0.97;   // >= 97 % → hard duplicate
const TOP_MATCHES          = 5;      // store up to 5 best internal matches
const SHINGLE_SIZE         = 3;      // 3-word shingles
const MAX_FULL_TEXT_CHARS  = 50000;  // cap for shingle comparison
const MAX_SENTENCE_LEN     = 30;     // words — skip very short sentences
const TOP_SENTENCE_PAIRS   = 8;      // sentence pairs stored per match

// ── Text helpers ─────────────────────────────────────────────────────────────

function normalise(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenise(text) {
  return normalise(text).split(' ').filter(w => w.length >= 3);
}

function shingle(tokens, k = SHINGLE_SIZE) {
  const set = new Set();
  for (let i = 0; i <= tokens.length - k; i++) {
    set.add(tokens.slice(i, i + k).join(' '));
  }
  return set;
}

function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) { if (b.has(item)) intersection++; }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function docText(doc) {
  // Prefer full_text when available
  if (doc.full_text && doc.full_text.length > 100) {
    return doc.full_text.slice(0, MAX_FULL_TEXT_CHARS);
  }
  return `${doc.title || ''} ${doc.abstract || ''}`;
}

const r4 = n => Math.round(n * 10000) / 10000;

// ── Sentence-level matching ───────────────────────────────────────────────────

function splitSentences(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map(s => s.trim())
    .filter(s => {
      const words = s.split(/\s+/).length;
      return words >= 8 && s.length >= 40; // skip fragments
    });
}

/**
 * Find the highest-overlap sentence pairs between two texts.
 * Only runs when full_text is available for both documents.
 *
 * @returns {Array<{source: string, target: string, score: number}>}
 */
function findSentencePairs(sourceText, targetText, maxPairs = TOP_SENTENCE_PAIRS) {
  const sourceSentences = splitSentences(sourceText).slice(0, 300);
  const targetSentences = splitSentences(targetText).slice(0, 300);

  if (sourceSentences.length === 0 || targetSentences.length === 0) return [];

  // Pre-compute shingles for target sentences
  const targetShingles = targetSentences.map(s => shingle(tokenise(s)));

  const pairs = [];

  for (const src of sourceSentences) {
    const srcShingles = shingle(tokenise(src));
    if (srcShingles.size < 3) continue;

    let bestScore = 0;
    let bestTarget = '';

    for (let i = 0; i < targetSentences.length; i++) {
      if (targetShingles[i].size < 3) continue;
      const score = jaccard(srcShingles, targetShingles[i]);
      if (score > bestScore) {
        bestScore  = score;
        bestTarget = targetSentences[i];
      }
    }

    if (bestScore >= 0.25) {
      pairs.push({ source: src, target: bestTarget, score: r4(bestScore) });
    }
  }

  // Sort and deduplicate (don't report the same source sentence twice)
  pairs.sort((a, b) => b.score - a.score);
  const seen = new Set();
  return pairs
    .filter(p => { const k = p.source.slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, maxPairs);
}

// ── Hash helpers ─────────────────────────────────────────────────────────────

function contentHash(title, abstract) {
  const payload = normalise(title) + '|||' + normalise(abstract || '');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

async function stampHash(documentId, title, abstract) {
  const hash = contentHash(title, abstract);
  await pool.query(`UPDATE documents SET content_hash = $1 WHERE id = $2`, [hash, documentId]);
  return hash;
}

// ── Embedding helper ─────────────────────────────────────────────────────────

async function generateAndStoreEmbedding(documentId, text) {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.embeddings.create({
      model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
      input: text.slice(0, 8000),
    });
    const vector = response.data[0].embedding;
    await pool.query(
      `UPDATE documents SET embedding = $1::vector WHERE id = $2`,
      [JSON.stringify(vector), documentId]
    );
    logger.info(`[plagiarism] embedding stored for ${documentId}`);
    return vector;
  } catch (err) {
    logger.warn(`[plagiarism] embedding failed for ${documentId}: ${err.message}`);
    return null;
  }
}

// ── Core check ────────────────────────────────────────────────────────────────

async function checkDocument(documentId) {
  // 1. Fetch target document (now includes full_text)
  const { rows: [target] } = await pool.query(
    `SELECT id, title, abstract, full_text, content_hash, embedding
     FROM documents
     WHERE id = $1 AND deleted_at IS NULL`,
    [documentId]
  );
  if (!target) throw new Error(`Document ${documentId} not found`);

  const methodsUsed    = [];
  const analysisText   = docText(target);           // full_text or title+abstract
  const targetTokens   = tokenise(analysisText);
  const targetShingles = shingle(targetTokens);
  const hasEmbedding   = target.embedding !== null;
  const hasFullText    = !!(target.full_text && target.full_text.length > 100);

  // ── Pass 1: exact hash duplicate ─────────────────────────────────────────
  let exactDuplicateId = null;
  if (target.content_hash) {
    methodsUsed.push('exact_hash');
    const { rows: hashMatches } = await pool.query(
      `SELECT d.id, d.title
       FROM documents d
       WHERE d.content_hash = $1
         AND d.id          <> $2
         AND d.deleted_at  IS NULL
       LIMIT 1`,
      [target.content_hash, documentId]
    );
    if (hashMatches.length > 0) exactDuplicateId = hashMatches[0].id;
  }

  if (exactDuplicateId) {
    const { rows: [dupDoc] } = await pool.query(
      `SELECT id, title, uploader_id FROM documents WHERE id = $1`,
      [exactDuplicateId]
    );
    const topMatches = [{
      document_id:    exactDuplicateId,
      title:          dupDoc?.title ?? null,
      uploader_id:    dupDoc?.uploader_id ?? null,
      text_score:     1.0,
      semantic_score: null,
      combined_score: 1.0,
      sentence_pairs: [],
    }];

    // Still run external check even on exact duplicate
    const externalMatches = await checkExternalSources(target.title);
    methodsUsed.push('external_source');

    await _persistReport({
      documentId, matchedDocId: exactDuplicateId,
      overallScore: 1.0, semanticScore: null, textScore: 1.0,
      matchedTitle: dupDoc?.title ?? null,
      topMatches, methodsUsed, isDuplicate: true, status: 'duplicate',
      externalMatches, sentenceMatches: [],
    });
    return { overallScore: 1.0, status: 'duplicate', topMatches, methodsUsed, isDuplicate: true, externalMatches };
  }

  // ── Pass 2: vector similarity ─────────────────────────────────────────────
  let candidates = [];
  if (hasEmbedding) {
    methodsUsed.push('semantic_vector');
    const { rows } = await pool.query(
      `SELECT d.id, d.title, d.abstract, d.full_text, d.uploader_id,
              1 - (d.embedding <=> $1::vector) AS semantic_score
       FROM documents d
       WHERE d.id        <> $2
         AND d.deleted_at IS NULL
         AND d.embedding  IS NOT NULL
       ORDER BY d.embedding <=> $1::vector
       LIMIT 50`,
      [target.embedding, documentId]
    );
    candidates = rows;
  }

  // ── Pass 3: text shingle ──────────────────────────────────────────────────
  methodsUsed.push('text_shingle');

  if (!hasEmbedding) {
    // Use trigram pre-filter on title to find relevant candidates efficiently
    // rather than pulling a random hard-capped list.
    const trigramTitle = target.title?.slice(0, 200) ?? '';
    const { rows: titleMatches } = await pool.query(
      `SELECT id, title, abstract, full_text, uploader_id
       FROM documents
       WHERE id        <> $1
         AND deleted_at IS NULL
         AND title IS NOT NULL
         AND similarity(title, $2) > 0.15
       ORDER BY similarity(title, $2) DESC
       LIMIT 150`,
      [documentId, trigramTitle]
    );

    // Supplement with documents that share full_text keywords (ts_vector)
    const tsQuery = tokenise(`${target.title} ${target.abstract || ''}`).slice(0, 10).join(' & ');
    let keywordMatches = [];
    if (tsQuery.length > 2) {
      try {
        const { rows } = await pool.query(
          `SELECT id, title, abstract, full_text, uploader_id
           FROM documents
           WHERE id        <> $1
             AND deleted_at IS NULL
             AND to_tsvector('english', COALESCE(full_text, abstract, ''))
                 @@ to_tsquery('english', $2)
           LIMIT 100`,
          [documentId, tsQuery]
        );
        keywordMatches = rows;
      } catch {
        // pg_trgm or tsquery may fail on unusual characters — ignore
      }
    }

    // Merge and deduplicate by id
    const seen = new Set(titleMatches.map(r => r.id));
    const merged = [...titleMatches];
    for (const r of keywordMatches) {
      if (!seen.has(r.id)) { seen.add(r.id); merged.push(r); }
    }
    candidates = merged;
  }

  // ── Score each candidate ──────────────────────────────────────────────────
  const scored = candidates.map(doc => {
    const text      = docText(doc);
    const tokens    = tokenise(text);
    const shingles  = shingle(tokens);
    const textScore = jaccard(targetShingles, shingles);
    const semScore  = doc.semantic_score != null ? parseFloat(doc.semantic_score) : null;
    const combined  = semScore !== null ? 0.6 * semScore + 0.4 * textScore : textScore;
    return {
      document_id:    doc.id,
      title:          doc.title,
      uploader_id:    doc.uploader_id,
      _full_text:     doc.full_text,   // used for sentence matching, not persisted
      text_score:     r4(textScore),
      semantic_score: semScore !== null ? r4(semScore) : null,
      combined_score: r4(combined),
    };
  });

  scored.sort((a, b) => b.combined_score - a.combined_score);
  const top = scored.slice(0, TOP_MATCHES);

  // ── Sentence-level pairs (top 3 matches only) ─────────────────────────────
  const topMatchesWithSentences = await Promise.all(
    top.map(async (m, i) => {
      let sentencePairs = [];
      if (hasFullText && i < 3) {
        // Fetch matched doc's full_text if not in candidate result
        let matchedFullText = m._full_text;
        if (!matchedFullText) {
          const { rows: [mDoc] } = await pool.query(
            `SELECT full_text FROM documents WHERE id = $1`,
            [m.document_id]
          );
          matchedFullText = mDoc?.full_text;
        }
        if (matchedFullText) {
          sentencePairs = findSentencePairs(target.full_text, matchedFullText);
        }
      }
      const { _full_text: _ft, ...rest } = m;  // remove internal field
      return { ...rest, sentence_pairs: sentencePairs };
    })
  );

  // Flatten all sentence pairs for persistence
  const allSentenceMatches = topMatchesWithSentences
    .flatMap((m, i) => m.sentence_pairs.map(p => ({ match_rank: i + 1, matched_doc_id: m.document_id, ...p })));

  // ── Pass 4: external sources ──────────────────────────────────────────────
  const externalMatches = await checkExternalSources(target.title);
  methodsUsed.push('external_source');

  const overallScore = topMatchesWithSentences.length > 0 ? topMatchesWithSentences[0].combined_score : 0;
  const best         = topMatchesWithSentences[0] ?? null;
  const isDuplicate  = overallScore >= DUPLICATE_THRESHOLD;
  const status       = isDuplicate                          ? 'duplicate'
                     : overallScore >= SIMILARITY_THRESHOLD ? 'flagged'
                     : 'clear';

  await _persistReport({
    documentId,
    matchedDocId:   best?.document_id  ?? null,
    overallScore,
    semanticScore:  best?.semantic_score ?? null,
    textScore:      best?.text_score     ?? null,
    matchedTitle:   best?.title          ?? null,
    topMatches:     topMatchesWithSentences,
    methodsUsed,
    isDuplicate,
    status,
    externalMatches,
    sentenceMatches: allSentenceMatches,
  });

  logger.info(
    `[plagiarism] doc=${documentId} score=${overallScore} status=${status} ` +
    `candidates=${candidates.length} external=${externalMatches.length} ` +
    `fullText=${hasFullText}`
  );

  return {
    overallScore, status, topMatches: topMatchesWithSentences,
    methodsUsed, isDuplicate, externalMatches,
    sentenceMatches: allSentenceMatches,
  };
}

// ── Persist helpers ───────────────────────────────────────────────────────────

async function _persistReport({
  documentId, matchedDocId, overallScore, semanticScore, textScore,
  matchedTitle, topMatches, methodsUsed, isDuplicate, status,
  externalMatches, sentenceMatches,
}) {
  await pool.query(
    `INSERT INTO plagiarism_reports
       (document_id, matched_doc_id, overall_score, semantic_score, text_score,
        matched_title, match_details, methods_used, is_duplicate,
        external_matches, external_source_checked, sentence_matches, checked_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
     ON CONFLICT (document_id) DO UPDATE SET
       matched_doc_id          = EXCLUDED.matched_doc_id,
       overall_score           = EXCLUDED.overall_score,
       semantic_score          = EXCLUDED.semantic_score,
       text_score              = EXCLUDED.text_score,
       matched_title           = EXCLUDED.matched_title,
       match_details           = EXCLUDED.match_details,
       methods_used            = EXCLUDED.methods_used,
       is_duplicate            = EXCLUDED.is_duplicate,
       external_matches        = EXCLUDED.external_matches,
       external_source_checked = EXCLUDED.external_source_checked,
       sentence_matches        = EXCLUDED.sentence_matches,
       checked_at              = NOW()`,
    [
      documentId, matchedDocId, overallScore, semanticScore, textScore,
      matchedTitle,
      JSON.stringify(topMatches),
      methodsUsed,
      isDuplicate,
      JSON.stringify(externalMatches ?? []),
      (externalMatches ?? []).length > 0,
      JSON.stringify(sentenceMatches ?? []),
    ]
  );

  await pool.query(
    `UPDATE documents
     SET plagiarism_score  = $1,
         plagiarism_status = $2
     WHERE id = $3`,
    [overallScore, status, documentId]
  );
}

// ── Raw embedding helper ──────────────────────────────────────────────────────

async function _generateEmbeddingRaw(text) {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.embeddings.create({
      model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
      input: text.slice(0, 8000),
    });
    return response.data[0].embedding;
  } catch (err) {
    logger.warn(`[plagiarism] raw embedding failed: ${err.message}`);
    return null;
  }
}

// ── Ad-hoc text check (submissions) ──────────────────────────────────────────

async function checkSubmissionText(text) {
  const methodsUsed    = [];
  const targetTokens   = tokenise(text);
  const targetShingles = shingle(targetTokens);

  if (targetTokens.length < 8) {
    return { overallScore: 0, status: 'clear', topMatches: [], methodsUsed: ['text_shingle'], isDuplicate: false };
  }

  let candidates = [];
  const embedding = await _generateEmbeddingRaw(text.slice(0, 8000));

  if (embedding) {
    methodsUsed.push('semantic_vector');
    const { rows } = await pool.query(
      `SELECT d.id, d.title, d.abstract, d.full_text, d.uploader_id,
              1 - (d.embedding <=> $1::vector) AS semantic_score
       FROM documents d
       WHERE d.deleted_at IS NULL AND d.embedding IS NOT NULL
       ORDER BY d.embedding <=> $1::vector
       LIMIT 50`,
      [JSON.stringify(embedding)]
    );
    candidates = rows;
  }

  methodsUsed.push('text_shingle');
  if (!embedding) {
    const { rows } = await pool.query(
      `SELECT id, title, abstract, full_text, uploader_id
       FROM documents WHERE deleted_at IS NULL
       LIMIT 500`,
      []
    );
    candidates = rows;
  }

  const scored = candidates.map(doc => {
    const text2     = docText(doc);
    const tokens    = tokenise(text2);
    const shingles  = shingle(tokens);
    const textScore = jaccard(targetShingles, shingles);
    const semScore  = doc.semantic_score != null ? parseFloat(doc.semantic_score) : null;
    const combined  = semScore !== null ? 0.6 * semScore + 0.4 * textScore : textScore;
    return {
      document_id: doc.id, title: doc.title, uploader_id: doc.uploader_id,
      text_score: r4(textScore), semantic_score: semScore !== null ? r4(semScore) : null,
      combined_score: r4(combined),
    };
  });

  scored.sort((a, b) => b.combined_score - a.combined_score);
  const topMatches   = scored.slice(0, TOP_MATCHES);
  const overallScore = topMatches.length > 0 ? topMatches[0].combined_score : 0;
  const isDuplicate  = overallScore >= DUPLICATE_THRESHOLD;
  const status       = isDuplicate                          ? 'duplicate'
                     : overallScore >= SIMILARITY_THRESHOLD ? 'flagged'
                     : 'clear';

  logger.info(`[plagiarism] submission check score=${overallScore} status=${status}`);
  return { overallScore, status, topMatches, methodsUsed, isDuplicate };
}

// ── Batch backfill ────────────────────────────────────────────────────────────

async function generateMissingEmbeddings(batchSize = 20) {
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('[plagiarism] OPENAI_API_KEY not set');
    return { processed: 0, failed: 0 };
  }
  const { rows } = await pool.query(
    `SELECT id, title, abstract, full_text FROM documents
     WHERE embedding IS NULL AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT $1`,
    [batchSize]
  );
  let processed = 0, failed = 0;
  for (const doc of rows) {
    const text = doc.full_text
      ? `${doc.title || ''} ${doc.full_text}`.trim()
      : `${doc.title || ''} ${doc.abstract || ''}`.trim();
    if (!text) { failed++; continue; }
    const vector = await generateAndStoreEmbedding(doc.id, text.slice(0, 8000));
    if (vector) processed++; else failed++;
    await new Promise(r => setTimeout(r, 200));
  }
  logger.info(`[plagiarism] batch embedding: processed=${processed} failed=${failed}`);
  return { processed, failed };
}

// ── Fire-and-forget wrapper ───────────────────────────────────────────────────

function checkDocumentAsync(documentId) {
  pool.query(
    `UPDATE documents SET plagiarism_status = 'checking' WHERE id = $1`,
    [documentId]
  ).catch(() => {});

  setImmediate(() => {
    checkDocument(documentId).catch(err => {
      logger.error(`[plagiarism] async check failed for ${documentId}: ${err.message}`);
      pool.query(
        `UPDATE documents SET plagiarism_status = 'error' WHERE id = $1`,
        [documentId]
      ).catch(() => {});
    });
  });
}

module.exports = {
  checkDocument, checkDocumentAsync,
  checkSubmissionText, generateMissingEmbeddings,
  stampHash, generateAndStoreEmbedding, contentHash,
  SIMILARITY_THRESHOLD, DUPLICATE_THRESHOLD,
};
