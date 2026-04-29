/**
 * Verification script — run after harvest to confirm import
 * Usage: node verify.js
 */

require('dotenv').config({ path: '../uninms-backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'uninms',
  user:     process.env.DB_USER     || 'uninms_user',
  password: process.env.DB_PASSWORD || 'uninms_dev_password',
  ssl:      false,
});

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  UniNMS Harvest Verification');
  console.log('═══════════════════════════════════════════════════════════\n');

  const { rows: [counts] } = await pool.query(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE is_published = true) AS published,
            COUNT(*) FILTER (WHERE doi IS NOT NULL) AS with_doi,
            COUNT(*) FILTER (WHERE storage_url IS NOT NULL) AS with_url,
            COUNT(*) FILTER (WHERE abstract IS NOT NULL) AS with_abstract
     FROM documents WHERE deleted_at IS NULL`
  );

  console.log('Document counts:');
  console.log(`  Total:         ${counts.total}`);
  console.log(`  Published:     ${counts.published}`);
  console.log(`  With DOI:      ${counts.with_doi}`);
  console.log(`  With URL:      ${counts.with_url}`);
  console.log(`  With abstract: ${counts.with_abstract}`);

  const { rows: byType } = await pool.query(
    `SELECT doc_type, COUNT(*) AS count
     FROM documents WHERE deleted_at IS NULL
     GROUP BY doc_type ORDER BY count DESC`
  );
  console.log('\nBy document type:');
  byType.forEach(r => console.log(`  ${r.doc_type.padEnd(20)} ${r.count}`));

  const { rows: recent } = await pool.query(
    `SELECT title, doi, published_at
     FROM documents WHERE deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 5`
  );
  console.log('\nMost recently imported:');
  recent.forEach((r, i) => {
    console.log(`  ${i+1}. ${r.title.slice(0,70)}`);
    if (r.doi) console.log(`     DOI: ${r.doi}`);
  });

  const { rows: tags } = await pool.query(
    `SELECT t.name, COUNT(*) AS usage
     FROM tags t JOIN document_tags dt ON dt.tag_id = t.id
     GROUP BY t.name ORDER BY usage DESC LIMIT 10`
  );
  console.log('\nTop 10 tags:');
  tags.forEach(t => console.log(`  ${t.name.padEnd(30)} (${t.usage} docs)`));

  console.log('\n✓ Now search for these at http://localhost:3001/search');
  console.log('  Try both keyword and Semantic AI mode.\n');

  await pool.end();
}

main().catch(err => { console.error(err.message); process.exit(1); });
