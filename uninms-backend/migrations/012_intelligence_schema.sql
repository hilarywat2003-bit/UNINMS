-- ═══════════════════════════════════════════════════════════════
-- UniNMS Migration 012 — Intelligence Schema Additions
-- ═══════════════════════════════════════════════════════════════

-- ── strategic_recommendations: add updated_at (missing from 002) ─────────────
ALTER TABLE strategic_recommendations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);

-- Backfill updated_at where null
UPDATE strategic_recommendations SET updated_at = generated_at WHERE updated_at IS NULL;

-- ── leaderboard_rankings — persisted computed rankings ───────────────────────
CREATE TABLE IF NOT EXISTS leaderboard_rankings (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id       UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  period              VARCHAR(20) NOT NULL CHECK (period IN ('monthly','quarterly','annual')),
  rank_position       INTEGER NOT NULL,
  doc_count           INTEGER DEFAULT 0,
  total_citations     INTEGER DEFAULT 0,
  active_researchers  INTEGER DEFAULT 0,
  avg_peer_rating     NUMERIC(4,2) DEFAULT 0,
  computed_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (university_id, period)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_period
  ON leaderboard_rankings(period, rank_position ASC);

-- ── research_gaps: index on status + priority for fast admin queries ──────────
CREATE INDEX IF NOT EXISTS idx_research_gaps_status_priority
  ON research_gaps(status, priority_score DESC) WHERE deleted_at IS NULL;
