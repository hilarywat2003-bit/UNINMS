-- ═══════════════════════════════════════════════════════════════
-- UniNMS Migration 012 — Journal Hosting Platform
-- ═══════════════════════════════════════════════════════════════

-- ── New roles ─────────────────────────────────────────────────────────────────
INSERT INTO roles (name) VALUES ('journal_editor') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name) VALUES ('reviewer')       ON CONFLICT (name) DO NOTHING;

-- ── Journals ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journals (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id    UUID REFERENCES universities(id),
  department_id    UUID REFERENCES departments(id),
  editor_id        UUID REFERENCES users(id),         -- chief editor
  title            VARCHAR(500) NOT NULL,
  slug             VARCHAR(200) UNIQUE NOT NULL,       -- url-safe identifier
  issn_print       VARCHAR(20),
  issn_online      VARCHAR(20),
  scope            TEXT,
  description      TEXT,
  cover_image_url  TEXT,
  website_url      TEXT,
  frequency        VARCHAR(50) DEFAULT 'biannual',     -- monthly|quarterly|biannual|annual
  review_type      VARCHAR(30) DEFAULT 'double_blind', -- single_blind|double_blind|open
  status           VARCHAR(20) DEFAULT 'pending',      -- pending|active|suspended
  is_open_access   BOOLEAN DEFAULT TRUE,
  language         VARCHAR(50) DEFAULT 'English',
  subjects         TEXT[],                             -- array of subject areas
  indexing         TEXT[],                             -- e.g. {AJOL, Google Scholar}
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_journals_university ON journals(university_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_journals_slug ON journals(slug) WHERE deleted_at IS NULL;

-- ── Volumes & Issues ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_volumes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_id  UUID REFERENCES journals(id) ON DELETE CASCADE,
  volume_no   INTEGER NOT NULL,
  year        INTEGER NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (journal_id, volume_no)
);

CREATE TABLE IF NOT EXISTS journal_issues (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  volume_id      UUID REFERENCES journal_volumes(id) ON DELETE CASCADE,
  journal_id     UUID REFERENCES journals(id) ON DELETE CASCADE,
  issue_no       INTEGER NOT NULL,
  title          VARCHAR(300),                        -- e.g. "Special Issue on AI"
  published_at   TIMESTAMPTZ,
  status         VARCHAR(20) DEFAULT 'open',          -- open|closed|published
  cover_url      TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (volume_id, issue_no)
);

-- ── Editorial Board ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_board_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_id  UUID REFERENCES journals(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  role        VARCHAR(50) NOT NULL,  -- chief_editor|associate_editor|section_editor|reviewer
  affiliation VARCHAR(255),
  display_order INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Manuscript Submissions ────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE manuscript_status AS ENUM (
    'submitted','with_editor','under_review','revision_requested',
    'resubmitted','accepted','rejected','published','withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS manuscripts (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_id           UUID REFERENCES journals(id),
  issue_id             UUID REFERENCES journal_issues(id),  -- assigned on acceptance
  author_id            UUID REFERENCES users(id),
  title                VARCHAR(500) NOT NULL,
  abstract             TEXT NOT NULL,
  keywords             TEXT[],
  manuscript_file_url  TEXT,                              -- S3 URL
  cover_letter         TEXT,
  status               manuscript_status DEFAULT 'submitted',
  plagiarism_score     NUMERIC(5,4),
  plagiarism_status    VARCHAR(20) DEFAULT 'pending',
  doi                  VARCHAR(200),
  pages                VARCHAR(20),                        -- e.g. "1-15"
  article_no           INTEGER,                           -- assigned on publication
  submission_no        VARCHAR(30) UNIQUE,                -- e.g. "JNAME-2026-0042"
  submitted_at         TIMESTAMPTZ DEFAULT NOW(),
  decision_at          TIMESTAMPTZ,
  published_at         TIMESTAMPTZ,
  document_id          UUID REFERENCES documents(id),     -- linked after publication
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_manuscripts_journal ON manuscripts(journal_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_manuscripts_author  ON manuscripts(author_id)          WHERE deleted_at IS NULL;

-- ── Co-authors ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manuscript_authors (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manuscript_id  UUID REFERENCES manuscripts(id) ON DELETE CASCADE,
  full_name      VARCHAR(255) NOT NULL,
  email          VARCHAR(255),
  affiliation    VARCHAR(255),
  orcid_id       VARCHAR(50),
  is_corresponding BOOLEAN DEFAULT FALSE,
  author_order   INTEGER DEFAULT 1
);

-- ── Reviewer Assignments ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_assignments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manuscript_id   UUID REFERENCES manuscripts(id) ON DELETE CASCADE,
  reviewer_id     UUID REFERENCES users(id),
  assigned_by     UUID REFERENCES users(id),
  status          VARCHAR(20) DEFAULT 'invited',  -- invited|accepted|declined|completed|overdue
  due_date        DATE,
  invited_at      TIMESTAMPTZ DEFAULT NOW(),
  responded_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  reminder_sent   BOOLEAN DEFAULT FALSE
);

-- ── Review Reports ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_reports (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id       UUID REFERENCES review_assignments(id) ON DELETE CASCADE,
  manuscript_id       UUID REFERENCES manuscripts(id),
  reviewer_id         UUID REFERENCES users(id),
  recommendation      VARCHAR(30),   -- accept|minor_revision|major_revision|reject
  comments_to_editor  TEXT,          -- confidential
  comments_to_author  TEXT,          -- shared with author
  originality_score   INTEGER,       -- 1-5
  methodology_score   INTEGER,
  clarity_score       INTEGER,
  significance_score  INTEGER,
  overall_score       INTEGER,
  submitted_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Editorial Decisions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS editorial_decisions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manuscript_id  UUID REFERENCES manuscripts(id),
  editor_id      UUID REFERENCES users(id),
  decision       VARCHAR(30) NOT NULL,  -- accept|minor_revision|major_revision|reject
  letter         TEXT,                  -- decision letter to author
  revision_due   DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Revision History ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manuscript_revisions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manuscript_id   UUID REFERENCES manuscripts(id),
  revision_no     INTEGER DEFAULT 1,
  file_url        TEXT,
  response_letter TEXT,           -- author response to reviewers
  submitted_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Triggers ─────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS journals_updated_at ON journals;
CREATE TRIGGER journals_updated_at
  BEFORE UPDATE ON journals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS manuscripts_updated_at ON manuscripts;
CREATE TRIGGER manuscripts_updated_at
  BEFORE UPDATE ON manuscripts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Submission number sequence per journal ────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS manuscript_seq START 1;
