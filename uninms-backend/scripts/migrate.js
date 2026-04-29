require('dotenv').config();
const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'uninms',
  user:     process.env.DB_USER     || 'uninms_user',
  password: process.env.DB_PASSWORD || 'uninms_dev_password',
  ssl:      false,
});

const run = async () => {
  console.log('\n🗄  UniNMS — Running migrations\n');

  // Create migrations table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL PRIMARY KEY,
      filename   VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await pool.query('SELECT id FROM _migrations WHERE filename = $1', [file]);
    if (rows[0]) {
      console.log(`  ⏭  Skipping ${file} (already applied)`);
      continue;
    }

    console.log(`  ⚡ Applying ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    try {
      await pool.query(sql);
      await pool.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      console.log(`  ✓  ${file} complete`);
    } catch (err) {
      console.error(`  ✗  ${file} failed:`, err.message);
      process.exit(1);
    }
  }

  console.log('\n✅  All migrations complete\n');
  await pool.end();
};

run().catch(err => { console.error(err); process.exit(1); });
