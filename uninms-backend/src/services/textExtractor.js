'use strict';

/**
 * Text Extraction Service
 *
 * Extracts plain text from uploaded document buffers.
 * Supported formats:
 *   - PDF  (.pdf)         — via pdf-parse (already in dependencies)
 *   - DOCX (.docx)        — via mammoth   (optional, graceful no-op if absent)
 *   - Plain text          — direct UTF-8 decode
 *
 * Returns a cleaned, whitespace-normalised string.
 * Returns '' on any failure so callers never receive an error.
 */

const logger = require('../utils/logger');

const PDF_MIME  = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const TXT_MIMES = new Set(['text/plain', 'text/markdown', 'text/csv']);

/** Normalise extracted text: collapse whitespace, remove null bytes. */
function clean(raw) {
  return (raw || '')
    .replace(/\0/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractPdf(buffer) {
  const pdfParse = require('pdf-parse');
  const data     = await pdfParse(buffer, { max: 0 }); // max:0 = all pages
  return clean(data.text || '');
}

async function extractDocx(buffer) {
  // mammoth is an optional dependency — skip silently if not installed.
  let mammoth;
  try {
    mammoth = require('mammoth');
  } catch {
    return '';
  }
  const result = await mammoth.extractRawText({ buffer });
  return clean(result.value || '');
}

/**
 * Extract plain text from a document buffer.
 *
 * @param {Buffer}  buffer   — raw file bytes
 * @param {string}  mimetype — MIME type of the file
 * @returns {Promise<string>}
 */
async function extractText(buffer, mimetype) {
  if (!buffer || !buffer.length) return '';

  try {
    if (mimetype === PDF_MIME)  return await extractPdf(buffer);
    if (mimetype === DOCX_MIME) return await extractDocx(buffer);
    if (TXT_MIMES.has(mimetype)) return clean(buffer.toString('utf8'));
  } catch (err) {
    logger.warn(`[textExtractor] extraction failed (${mimetype}): ${err.message}`);
  }

  return '';
}

module.exports = { extractText };
