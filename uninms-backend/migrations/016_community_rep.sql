-- ═══════════════════════════════════════════════════════════════
-- UniNMS Migration 016 — Community Representative Module
-- Adds: community_reps, indigenous_knowledge, FPIC workflow,
--       IK token ledger, user_credentials login tracking
-- ═══════════════════════════════════════════════════════════════

-- ── user_credentials login tracking (referenced by auth.js) ──────────────────
ALTER TABLE user_credentials
  ADD COLUMN IF NOT EXISTS last_login  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;

-- ── users: subscription_verified column (used by auth register) ───────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_verified BOOLEAN DEFAULT FALSE;

-- ── Community representatives profile ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_reps (
  id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID         UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_name VARCHAR(255) NOT NULL,
  verified       BOOLEAN      DEFAULT FALSE,
  verified_at    TIMESTAMPTZ,
  verified_by    UUID         REFERENCES users(id),
  is_primary     BOOLEAN      DEFAULT TRUE,
  created_at     TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_co_reps (
  primary_rep_id UUID REFERENCES community_reps(id) ON DELETE CASCADE,
  co_rep_id      UUID REFERENCES community_reps(id) ON DELETE CASCADE,
  added_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (primary_rep_id, co_rep_id)
);

-- ── Indigenous knowledge assets ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS indigenous_knowledge (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  registered_by    UUID         NOT NULL REFERENCES users(id),
  community_name   VARCHAR(255) NOT NULL,
  title            VARCHAR(500) NOT NULL,
  description      TEXT         NOT NULL,
  cultural_context TEXT,
  provenance       TEXT,
  access_level     VARCHAR(30)  NOT NULL DEFAULT 'full_with_consent',
  -- 'metadata_only' | 'abstract_only' | 'full_with_consent' | 'open'
  is_sacred        BOOLEAN      NOT NULL DEFAULT FALSE,
  content_hash     TEXT,        -- SHA-256 of canonical content at registration
  hash_chain       JSONB        NOT NULL DEFAULT '[]',
  -- [{hash, previous_hash, event, timestamp}] — blockchain anchor (COM-004)
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ik_community  ON indigenous_knowledge(community_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ik_access     ON indigenous_knowledge(access_level) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ik_sacred     ON indigenous_knowledge(is_sacred) WHERE is_sacred = TRUE;

-- Enforce is_sacred irreversibility at the database level (COM-014)
CREATE OR REPLACE FUNCTION ik_sacred_protect()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_sacred = TRUE AND NEW.is_sacred = FALSE THEN
    RAISE EXCEPTION
      'The is_sacred flag on indigenous knowledge asset % is irreversible and cannot be cleared', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ik_sacred_immutable ON indigenous_knowledge;
CREATE TRIGGER ik_sacred_immutable
  BEFORE UPDATE ON indigenous_knowledge
  FOR EACH ROW EXECUTE FUNCTION ik_sacred_protect();

-- ── Supporting documentation ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ik_documents (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id    UUID         NOT NULL REFERENCES indigenous_knowledge(id) ON DELETE CASCADE,
  uploaded_by UUID         REFERENCES users(id),
  doc_type    VARCHAR(100) DEFAULT 'supporting',
  -- 'council_minutes' | 'elder_testimonial' | 'photograph' | 'other'
  storage_url TEXT         NOT NULL,
  file_name   VARCHAR(255),
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ── FPIC access / commercialisation requests ──────────────────────────────────
CREATE TABLE IF NOT EXISTS fpic_requests (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id       UUID        NOT NULL REFERENCES indigenous_knowledge(id),
  requester_id   UUID        NOT NULL REFERENCES users(id),
  request_type   VARCHAR(30) NOT NULL DEFAULT 'access',
  -- 'access' | 'commercialisation'
  purpose        TEXT        NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- 'pending' | 'approved' | 'rejected' | 'revoked'
  decision_by    UUID        REFERENCES users(id),
  decision_note  TEXT,
  decided_at     TIMESTAMPTZ,
  revoked_at     TIMESTAMPTZ,
  revoke_reason  TEXT,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fpic_asset     ON fpic_requests(asset_id, status);
CREATE INDEX IF NOT EXISTS idx_fpic_requester ON fpic_requests(requester_id);

-- ── Token ledger: benefit distribution 50/25/15/10 ───────────────────────────
-- 50 % → community | 25 % → researcher | 15 % → university | 10 % → platform
CREATE TABLE IF NOT EXISTS ik_token_ledger (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id         UUID         NOT NULL REFERENCES indigenous_knowledge(id),
  fpic_request_id  UUID         REFERENCES fpic_requests(id),
  transaction_type VARCHAR(50)  NOT NULL,
  -- 'commercialisation_in' | 'community_share' | 'researcher_share'
  -- | 'university_share' | 'platform_fee'
  amount           NUMERIC(18,6) NOT NULL,
  recipient        VARCHAR(255) NOT NULL,
  recipient_share  NUMERIC(5,4),
  confirmed_by     UUID         REFERENCES users(id),
  confirmed_at     TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_asset ON ik_token_ledger(asset_id, created_at DESC);
