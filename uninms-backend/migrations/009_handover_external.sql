-- ── Extend handovers to support external / third-party transfers ─────────────
ALTER TABLE handovers
  ALTER COLUMN to_user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS transfer_type  VARCHAR(20)  DEFAULT 'internal',
    -- internal | outgoing (univ → external) | incoming (external → univ)
  ADD COLUMN IF NOT EXISTS external_name  VARCHAR(255),   -- contact person at external org
  ADD COLUMN IF NOT EXISTS external_org   VARCHAR(255),   -- organisation name
  ADD COLUMN IF NOT EXISTS external_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS external_type  VARCHAR(50);
    -- industry | government | ngo | international | research_institute | other
