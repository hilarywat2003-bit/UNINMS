-- ═══════════════════════════════════════════════════════════════
-- UniNMS Migration 017 — TETFund Performance Reporting
-- Stores periodic snapshots of each institution's TETFund score
-- for historical trend and allocation multiplier reporting
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tetfund_snapshots (
  id                    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id         UUID         NOT NULL REFERENCES universities(id),
  period_label          VARCHAR(50)  NOT NULL,
  -- e.g. '2025-Annual', '2025-Q1'
  performance_score     NUMERIC(6,3) NOT NULL,
  -- 0–100 weighted composite
  allocation_multiplier NUMERIC(4,3) NOT NULL,
  -- 0.8–1.5
  metrics               JSONB        NOT NULL DEFAULT '{}',
  -- per-metric raw value, score, weight, weighted_score
  generated_by          UUID         REFERENCES users(id),
  generated_at          TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tetfund_uni
  ON tetfund_snapshots(university_id, generated_at DESC);

-- Only one snapshot per university per period label
CREATE UNIQUE INDEX IF NOT EXISTS idx_tetfund_period
  ON tetfund_snapshots(university_id, period_label);
