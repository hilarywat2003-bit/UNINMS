-- ═══════════════════════════════════════════════════════════════
-- UniNMS Migration 002 — Forums, Intelligence, Knowledge Transfer
-- ═══════════════════════════════════════════════════════════════

-- ── Forum threads & posts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forum_threads (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id    UUID REFERENCES users(id),
  title        VARCHAR(500) NOT NULL,
  category     VARCHAR(100),
  reply_count  INTEGER DEFAULT 0,
  is_pinned    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);
CREATE TRIGGER forum_threads_updated_at BEFORE UPDATE ON forum_threads FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS forum_posts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id    UUID REFERENCES forum_threads(id) ON DELETE CASCADE,
  author_id    UUID REFERENCES users(id),
  parent_id    UUID REFERENCES forum_posts(id),
  content      TEXT NOT NULL,
  upvote_count INTEGER DEFAULT 0,
  is_answer    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);
CREATE TRIGGER forum_posts_updated_at BEFORE UPDATE ON forum_posts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Mentorship ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mentorship_pairs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mentor_id         UUID REFERENCES users(id),
  mentee_id         UUID REFERENCES users(id),
  focus_area        VARCHAR(255),
  total_sessions    INTEGER DEFAULT 8,
  completed_sessions INTEGER DEFAULT 0,
  status            VARCHAR(20) DEFAULT 'pending',
  started_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS mentorship_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pair_id         UUID REFERENCES mentorship_pairs(id) ON DELETE CASCADE,
  session_number  INTEGER NOT NULL,
  title           VARCHAR(255),
  status          VARCHAR(20) DEFAULT 'pending',
  mentee_signed_off BOOLEAN DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Handover packages ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS handover_packages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id      UUID REFERENCES users(id),
  successor_id    UUID REFERENCES users(id),
  title           VARCHAR(255) NOT NULL,
  reason          VARCHAR(50) DEFAULT 'other',
  description     TEXT,
  status          VARCHAR(30) DEFAULT 'in_progress',
  completion_pct  INTEGER DEFAULT 0,
  target_date     DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS handover_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_id    UUID REFERENCES handover_packages(id) ON DELETE CASCADE,
  document_id   UUID REFERENCES documents(id),
  item_label    VARCHAR(500) NOT NULL,
  item_type     VARCHAR(50) DEFAULT 'document',
  is_complete   BOOLEAN DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Implementation claims ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS implementation_claims (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id          UUID REFERENCES documents(id),
  claimant_id          UUID REFERENCES users(id),
  implementor_name     VARCHAR(255) NOT NULL,
  implementor_type     VARCHAR(50) DEFAULT 'industry',
  description          TEXT NOT NULL,
  evidence_url         TEXT,
  status               VARCHAR(20) DEFAULT 'pending',
  points_awarded       INTEGER,
  claim_attempt_number INTEGER DEFAULT 1,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);

-- ── Research groups ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS research_groups (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id    UUID REFERENCES users(id),
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  type          VARCHAR(50) DEFAULT 'research',
  is_public     BOOLEAN DEFAULT TRUE,
  member_count  INTEGER DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

-- ── Knowledge graph ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_graph_nodes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id   UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  label       VARCHAR(500),
  properties  JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id   UUID REFERENCES knowledge_graph_nodes(id),
  target_id   UUID REFERENCES knowledge_graph_nodes(id),
  relation    VARCHAR(100) NOT NULL,
  weight      NUMERIC(6,4) DEFAULT 1.0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Research gaps ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS research_gaps (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gap_description  TEXT NOT NULL,
  research_area    VARCHAR(255),
  priority_score   INTEGER DEFAULT 5 CHECK (priority_score BETWEEN 1 AND 10),
  auto_detected    BOOLEAN DEFAULT FALSE,
  status           VARCHAR(30) DEFAULT 'unaddressed',
  university_id    UUID REFERENCES universities(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

-- ── Strategic recommendations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS strategic_recommendations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id     UUID REFERENCES universities(id),
  category          VARCHAR(50) NOT NULL,
  title             VARCHAR(500) NOT NULL,
  description       TEXT,
  confidence_score  NUMERIC(4,3),
  action_required   TEXT,
  reasoning_steps   JSONB DEFAULT '[]',
  status            VARCHAR(30) DEFAULT 'active',
  generated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

-- ── Courses ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id    UUID REFERENCES departments(id),
  lecturer_id      UUID REFERENCES users(id),
  title            VARCHAR(255) NOT NULL,
  course_code      VARCHAR(20),
  enrollment_count INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

-- ── Document views log ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_views (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id),
  user_id     UUID REFERENCES users(id),
  viewed_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Consent log (NDPR) ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consent_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id),
  consent_version VARCHAR(20),
  granted_at      TIMESTAMPTZ DEFAULT NOW(),
  ip_address      VARCHAR(45)
);
