/**
 * Migration: create payments table
 * Run: node scripts/migrate-payments.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        university_id     UUID        NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
        initiated_by      UUID        REFERENCES users(id),
        plan              VARCHAR(50) NOT NULL,
        amount_kobo       BIGINT      NOT NULL,
        reference         VARCHAR(255) UNIQUE NOT NULL,
        paystack_ref      VARCHAR(255),
        status            VARCHAR(50) NOT NULL DEFAULT 'pending',
        metadata          JSONB       DEFAULT '{}',
        paid_at           TIMESTAMPTZ,
        created_at        TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_payments_university ON payments(university_id);
      CREATE INDEX IF NOT EXISTS idx_payments_reference  ON payments(reference);
      CREATE INDEX IF NOT EXISTS idx_payments_status     ON payments(status);
    `);
    console.log('✓ payments table ready');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err.message); process.exit(1); });
