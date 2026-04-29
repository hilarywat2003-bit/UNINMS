-- ═══════════════════════════════════════════════════════════════
-- UniNMS Migration 015 — Admin Tooling
-- Adds: audit_log, announcements, document moderation workflow,
--       per-institution plagiarism threshold
-- ═══════════════════════════════════════════════════════════════

-- ── Immutable admin audit log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id   UUID,
  details     JSONB       DEFAULT '{}',
  ip_address  INET,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_log(target_type, target_id);

-- Immutability triggers
CREATE OR REPLACE FUNCTION audit_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log rows are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_no_update ON audit_log;
DROP TRIGGER IF EXISTS audit_no_delete ON audit_log;
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

-- ── System announcements ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID        REFERENCES universities(id) ON DELETE CASCADE,
  author_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  title         VARCHAR(255) NOT NULL,
  body          TEXT        NOT NULL,
  is_active     BOOLEAN     DEFAULT TRUE,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_announcements_uni
  ON announcements(university_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ── Document moderation workflow ──────────────────────────────────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS moderation_note   TEXT,
  ADD COLUMN IF NOT EXISTS moderated_by      UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS moderated_at      TIMESTAMPTZ;

-- Backfill: currently published docs are already approved
UPDATE documents
   SET moderation_status = 'approved'
 WHERE deleted_at IS NULL
   AND moderation_status IS NULL
   AND is_published = TRUE;

UPDATE documents
   SET moderation_status = 'pending'
 WHERE deleted_at IS NULL
   AND moderation_status IS NULL
   AND is_published = FALSE;

CREATE INDEX IF NOT EXISTS idx_docs_moderation
  ON documents(moderation_status, created_at DESC)
  WHERE deleted_at IS NULL;

-- ── Per-institution plagiarism threshold ──────────────────────────────────────
ALTER TABLE institution_subscriptions
  ADD COLUMN IF NOT EXISTS plagiarism_threshold NUMERIC(4,3) DEFAULT 0.300;
