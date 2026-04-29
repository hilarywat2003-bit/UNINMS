-- ═══════════════════════════════════════════════════════════════
-- UniNMS Migration 019 — Mentorship schema fix
--
-- Migration 002 created mentorship_sessions with pair_id/session_number
-- columns for the old mentorship_pairs model. Migration 006 introduced
-- the new `mentorships` table and expected mentorship_sessions to have
-- mentorship_id, notes, session_date, duration_mins, logged_by.
-- Because CREATE TABLE IF NOT EXISTS skips when the table exists, the
-- new columns were never added. This migration adds them safely.
-- ═══════════════════════════════════════════════════════════════

-- ── mentorship_sessions: add columns the route expects ────────
ALTER TABLE mentorship_sessions
  ADD COLUMN IF NOT EXISTS mentorship_id UUID REFERENCES mentorships(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS notes         TEXT,
  ADD COLUMN IF NOT EXISTS session_date  TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS duration_mins INTEGER,
  ADD COLUMN IF NOT EXISTS logged_by     UUID REFERENCES users(id);

-- Index for fast lookups per mentorship
CREATE INDEX IF NOT EXISTS idx_mentorship_sessions_mid
  ON mentorship_sessions(mentorship_id);

-- ── mentorship_goals: safety net in case migration 006 was partially skipped ──
CREATE TABLE IF NOT EXISTS mentorship_goals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorship_id  UUID REFERENCES mentorships(id) ON DELETE CASCADE,
  title          VARCHAR(255) NOT NULL,
  description    TEXT,
  status         VARCHAR(20)  DEFAULT 'active',
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  achieved_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mentorship_goals_mid
  ON mentorship_goals(mentorship_id);
