'use strict';

/**
 * Shared OpenAI embedding helper — used by plagiarism detection and
 * research-gap semantic matching. Returns null (never throws) when no
 * OPENAI_API_KEY is configured or the API call fails, so callers can
 * degrade gracefully to non-semantic matching.
 */

const logger = require('../utils/logger');

async function generateEmbedding(text) {
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
    logger.warn(`[embeddings] generation failed: ${err.message}`);
    return null;
  }
}

module.exports = { generateEmbedding };
