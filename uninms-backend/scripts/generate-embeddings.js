/**
 * Backfill embeddings for all documents that don't have one yet.
 * Also extracts PDF text to populate missing abstracts.
 *
 * Run: node scripts/generate-embeddings.js
 *
 * Requires OPENAI_API_KEY in .env to generate semantic embeddings.
 * Without it, only the hash/shingle pipeline will work (no semantic pass).
 */
'use strict';

require('dotenv').config();
const { Pool }  = require('pg');
const path      = require('path');
const fs        = require('fs');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Inline the generateMissingEmbeddings from plagiarism service
async function run() {
  const { generateMissingEmbeddings } = require('../src/services/plagiarism');

  console.log('\nGenerating embeddings for documents without them...\n');

  const { rows: total } = await pool.query(
    'SELECT COUNT(*) FROM documents WHERE deleted_at IS NULL AND embedding IS NULL'
  );
  console.log(`Documents needing embeddings: ${total[0].count}\n`);

  if (parseInt(total[0].count) === 0) {
    console.log('✓ All documents already have embeddings.');
    await pool.end();
    return;
  }

  const processed = await generateMissingEmbeddings(20);
  console.log(`\n✓ Done. Processed ${processed} documents.`);

  if (!process.env.OPENAI_API_KEY) {
    console.log('\n⚠ No OPENAI_API_KEY set — embeddings were skipped.');
    console.log('  Add OPENAI_API_KEY to .env and re-run to enable semantic similarity.');
  }

  await pool.end();
}

run().catch(err => {
  console.error(err.message);
  process.exit(1);
});
