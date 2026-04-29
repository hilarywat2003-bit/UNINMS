-- ═══════════════════════════════════════════════════════════════
-- UniNMS Migration 022 — Journal Editor Assignment
-- ═══════════════════════════════════════════════════════════════

-- Junction table: which users are managing editors for which journals.
-- A journal can have multiple editors; a user can manage multiple journals.
-- IT Admin assigns via POST /journals/:slug/editors  (admin-only endpoint).
CREATE TABLE IF NOT EXISTS journal_editors (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_id   UUID NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  granted_by   UUID REFERENCES users(id),            -- the admin who made the assignment
  granted_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (journal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_journal_editors_journal ON journal_editors(journal_id);
CREATE INDEX IF NOT EXISTS idx_journal_editors_user    ON journal_editors(user_id);

-- Back-fill: if journals already have an editor_id, carry that into the new table
INSERT INTO journal_editors (journal_id, user_id)
SELECT id, editor_id FROM journals
WHERE editor_id IS NOT NULL
ON CONFLICT (journal_id, user_id) DO NOTHING;
