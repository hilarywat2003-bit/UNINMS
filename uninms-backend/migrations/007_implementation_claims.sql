-- ── Implementation claims ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS implementation_claims (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  document_id          UUID REFERENCES documents(id) ON DELETE SET NULL,
  title                VARCHAR(255) NOT NULL,
  claim_type           VARCHAR(50)  DEFAULT 'practice',  -- policy | product | practice | community
  description          TEXT         NOT NULL,
  organization         VARCHAR(255),
  location             VARCHAR(255),
  implementation_date  DATE,
  evidence_url         TEXT,
  impact_summary       TEXT,
  status               VARCHAR(20)  DEFAULT 'pending',   -- pending | approved | rejected | revision_needed
  review_note          TEXT,
  reviewed_by          UUID REFERENCES users(id),
  reviewed_at          TIMESTAMPTZ,
  endorsement_count    INTEGER      DEFAULT 0,
  created_at           TIMESTAMPTZ  DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Endorsements ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS claim_endorsements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id   UUID REFERENCES implementation_claims(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  comment    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(claim_id, user_id)
);
