/**
 * Migration: create subscription_plans table and seed defaults
 * Run: node scripts/migrate-plans.js
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

const ALL_FEATURES = [
  'plagiarism', 'semantic_search', 'ai_insights', 'research_pipeline',
  'knowledge_transfer', 'vc_dashboard', 'tetfund_reports', 'national_hub',
  'api_access', 'sso', 'custom_branding', 'priority_support',
];

function makeFeatures(enabled) {
  const obj = {};
  ALL_FEATURES.forEach(k => (obj[k] = enabled.includes(k)));
  return obj;
}

const DEFAULTS = [
  {
    key: 'free',
    label: 'Free',
    tagline: 'Get started at no cost',
    price_naira: 0,
    max_users: 50,
    max_storage_gb: 5,
    plagiarism_checks_per_month: 0,
    badge: 'badge-stone',
    highlight: false,
    sort_order: 1,
    features: makeFeatures([]),
  },
  {
    key: 'basic',
    label: 'Basic',
    tagline: 'For small institutions getting started',
    price_naira: 250000,
    max_users: 500,
    max_storage_gb: 25,
    plagiarism_checks_per_month: 50,
    badge: 'badge-blue',
    highlight: false,
    sort_order: 2,
    features: makeFeatures(['plagiarism', 'research_pipeline']),
  },
  {
    key: 'standard',
    label: 'Standard',
    tagline: 'Most popular for mid-size universities',
    price_naira: 750000,
    max_users: 2000,
    max_storage_gb: 100,
    plagiarism_checks_per_month: 500,
    badge: 'badge-green',
    highlight: true,
    sort_order: 3,
    features: makeFeatures([
      'plagiarism', 'semantic_search', 'ai_insights', 'research_pipeline',
      'knowledge_transfer', 'vc_dashboard', 'priority_support',
    ]),
  },
  {
    key: 'premium',
    label: 'Premium',
    tagline: 'For large universities with full needs',
    price_naira: 2000000,
    max_users: 10000,
    max_storage_gb: 500,
    plagiarism_checks_per_month: 2000,
    badge: 'badge-purple',
    highlight: false,
    sort_order: 4,
    features: makeFeatures(ALL_FEATURES),
  },
  {
    key: 'enterprise',
    label: 'Enterprise',
    tagline: 'Unlimited scale — custom agreement',
    price_naira: -1,
    max_users: -1,
    max_storage_gb: -1,
    plagiarism_checks_per_month: -1,
    badge: 'badge-gold',
    highlight: false,
    sort_order: 5,
    features: makeFeatures(ALL_FEATURES),
  },
];

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        key                          VARCHAR(50)  PRIMARY KEY,
        label                        VARCHAR(100) NOT NULL,
        tagline                      TEXT,
        price_naira                  BIGINT       NOT NULL DEFAULT 0,
        max_users                    INT          NOT NULL DEFAULT 50,
        max_storage_gb               INT          NOT NULL DEFAULT 5,
        plagiarism_checks_per_month  INT          NOT NULL DEFAULT 0,
        features                     JSONB        NOT NULL DEFAULT '{}',
        badge                        VARCHAR(100) NOT NULL DEFAULT 'badge-stone',
        highlight                    BOOLEAN      NOT NULL DEFAULT false,
        sort_order                   INT          NOT NULL DEFAULT 99,
        is_active                    BOOLEAN      NOT NULL DEFAULT true,
        updated_at                   TIMESTAMPTZ  DEFAULT NOW()
      );
    `);
    console.log('✓ subscription_plans table ready');

    for (const plan of DEFAULTS) {
      await client.query(
        `INSERT INTO subscription_plans
           (key, label, tagline, price_naira, max_users, max_storage_gb,
            plagiarism_checks_per_month, features, badge, highlight, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (key) DO NOTHING`,
        [
          plan.key, plan.label, plan.tagline, plan.price_naira,
          plan.max_users, plan.max_storage_gb, plan.plagiarism_checks_per_month,
          JSON.stringify(plan.features), plan.badge, plan.highlight, plan.sort_order,
        ]
      );
      console.log(`  ✓ ${plan.key}`);
    }
    console.log('✓ Plans seeded');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err.message); process.exit(1); });
