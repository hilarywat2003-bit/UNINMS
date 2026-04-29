-- ═══════════════════════════════════════════════════════════════
-- UniNMS Migration 021 — Tiered Plagiarism Checks
-- ═══════════════════════════════════════════════════════════════

-- ── Monthly usage tracking per university ────────────────────────────────────
-- One row per (university, year-month). Upserted on every check.
CREATE TABLE IF NOT EXISTS plagiarism_usage (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  year_month      CHAR(7) NOT NULL,          -- e.g. '2026-04'
  checks_used     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (university_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_plag_usage_uni_month
  ON plagiarism_usage(university_id, year_month);

-- ── New result columns on plagiarism_reports ─────────────────────────────────

-- AI-generated text detection (GPTZero)
ALTER TABLE plagiarism_reports
  ADD COLUMN IF NOT EXISTS ai_score        NUMERIC(5,4),   -- 0–1 probability of AI authorship
  ADD COLUMN IF NOT EXISTS ai_label        VARCHAR(30),    -- 'human' | 'mixed' | 'ai'
  ADD COLUMN IF NOT EXISTS ai_checked      BOOLEAN DEFAULT FALSE;

-- Web snippet search (Bing)
ALTER TABLE plagiarism_reports
  ADD COLUMN IF NOT EXISTS web_matches     JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS web_checked     BOOLEAN DEFAULT FALSE;

-- Deep check (Copyleaks)
ALTER TABLE plagiarism_reports
  ADD COLUMN IF NOT EXISTS copyleaks_score      NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS copyleaks_status     VARCHAR(30) DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS copyleaks_scan_id    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS copyleaks_report_url TEXT,
  ADD COLUMN IF NOT EXISTS copyleaks_matches    JSONB DEFAULT '[]';

-- ── Subscription plan feature flags ──────────────────────────────────────────
-- Extend institution_subscriptions with the three new feature flags
ALTER TABLE institution_subscriptions
  ADD COLUMN IF NOT EXISTS plagiarism_ai_detection  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS plagiarism_web_search     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS plagiarism_deep_check     BOOLEAN DEFAULT FALSE;

-- Update the subscription_plans catalogue table if it exists
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS plagiarism_ai_detection  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS plagiarism_web_search     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS plagiarism_deep_check     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS plagiarism_checks_per_month INTEGER DEFAULT 0;

-- Seed sensible defaults into the plans catalogue
UPDATE subscription_plans SET
  plagiarism_checks_per_month = CASE key
    WHEN 'free'       THEN 5
    WHEN 'basic'      THEN 50
    WHEN 'standard'   THEN 200
    WHEN 'premium'    THEN 2000
    WHEN 'enterprise' THEN 999999
    ELSE 0
  END,
  plagiarism_ai_detection = key IN ('standard','premium','enterprise'),
  plagiarism_web_search   = key IN ('standard','premium','enterprise'),
  plagiarism_deep_check   = key IN ('premium','enterprise')
WHERE key IN ('free','basic','standard','premium','enterprise');
