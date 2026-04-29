-- ── Mentorship profiles ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mentorship_profiles (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role          VARCHAR(20)  NOT NULL DEFAULT 'mentee',  -- mentor | mentee | both
  support_types TEXT[]       DEFAULT '{}',               -- career | psychosocial
  mentor_roles  TEXT[]       DEFAULT '{}',               -- teacher | advisor | role_model | sponsor | counselor
  areas         TEXT[]       DEFAULT '{}',               -- expertise / interest areas
  bio           TEXT,
  availability  VARCHAR(100),
  is_active     BOOLEAN      DEFAULT true,
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Mentorship relationships ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mentorships (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  mentee_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  type          VARCHAR(20)  DEFAULT 'informal',    -- formal | informal
  stage         VARCHAR(30)  DEFAULT 'initiating',  -- initiating | challenging | growing | closing
  status        VARCHAR(20)  DEFAULT 'pending',     -- pending | active | completed | declined
  support_type  VARCHAR(20)  DEFAULT 'career',      -- career | psychosocial
  goals_summary TEXT,
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(mentor_id, mentee_id)
);

-- ── Sessions ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mentorship_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorship_id  UUID REFERENCES mentorships(id) ON DELETE CASCADE,
  title          VARCHAR(255) NOT NULL,
  notes          TEXT,
  session_date   TIMESTAMPTZ  DEFAULT NOW(),
  duration_mins  INTEGER,
  logged_by      UUID REFERENCES users(id)
);

-- ── Goals ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mentorship_goals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorship_id  UUID REFERENCES mentorships(id) ON DELETE CASCADE,
  title          VARCHAR(255) NOT NULL,
  description    TEXT,
  status         VARCHAR(20)  DEFAULT 'active',  -- active | achieved
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  achieved_at    TIMESTAMPTZ
);
