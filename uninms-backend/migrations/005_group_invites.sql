-- ── Group invites ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID REFERENCES research_groups(id) ON DELETE CASCADE,
  inviter_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  invitee_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  status      VARCHAR(20) DEFAULT 'pending',  -- pending | accepted | declined
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, invitee_id)
);
