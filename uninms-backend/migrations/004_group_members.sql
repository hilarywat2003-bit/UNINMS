-- ── Group members ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_members (
  group_id  UUID REFERENCES research_groups(id) ON DELETE CASCADE,
  user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  role      VARCHAR(30) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);
