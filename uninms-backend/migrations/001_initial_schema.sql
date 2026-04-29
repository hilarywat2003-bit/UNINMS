-- ═══════════════════════════════════════════════════════════════
-- UniNMS Migration 001 — Core Schema
-- ═══════════════════════════════════════════════════════════════

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ── Updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ── Enums ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_status    AS ENUM ('active','suspended','pending_verification','deactivated');
  CREATE TYPE doc_type       AS ENUM ('thesis','dissertation','research_paper','lecture_note','past_question','dataset','seminar_recording','policy_doc','administrative','other');
  CREATE TYPE doc_visibility AS ENUM ('public','department','enrolled','draft');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Universities / Institutions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS universities (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(255) NOT NULL,
  short_name   VARCHAR(50),
  state        VARCHAR(100),
  type         VARCHAR(50) DEFAULT 'federal',
  nuc_id       VARCHAR(50),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS faculties (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id  UUID REFERENCES universities(id),
  name           VARCHAR(255) NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS departments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_id   UUID REFERENCES faculties(id),
  name         VARCHAR(255) NOT NULL,
  code         VARCHAR(20),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name         VARCHAR(255) NOT NULL,
  email             VARCHAR(255) UNIQUE NOT NULL,
  department_id     UUID REFERENCES departments(id),
  status            user_status DEFAULT 'pending_verification',
  bio               TEXT,
  orcid_id          VARCHAR(50),
  nin_hash          VARCHAR(64),
  nin_verified      BOOLEAN DEFAULT FALSE,
  profile_photo_url TEXT,
  matric_number     VARCHAR(50),
  staff_id          VARCHAR(50),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS user_credentials (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  password_hash  VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  mfa_enabled    BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- ── Documents ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uploader_id      UUID REFERENCES users(id),
  department_id    UUID REFERENCES departments(id),
  title            VARCHAR(500) NOT NULL,
  abstract         TEXT,
  doc_type         doc_type DEFAULT 'other',
  visibility       doc_visibility DEFAULT 'public',
  doi              VARCHAR(200),
  storage_url      TEXT,
  preview_url      TEXT,
  mime_type        VARCHAR(100),
  file_size_bytes  BIGINT,
  virus_scan_status VARCHAR(20) DEFAULT 'pending',
  is_published     BOOLEAN DEFAULT FALSE,
  view_count       INTEGER DEFAULT 0,
  download_count   INTEGER DEFAULT 0,
  citation_count   INTEGER DEFAULT 0,
  average_peer_rating NUMERIC(3,2),
  embedding        vector(1536),
  vector_id        TEXT,
  published_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_documents_uploader ON documents(uploader_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_published ON documents(published_at DESC) WHERE deleted_at IS NULL AND is_published = TRUE;
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(doc_type) WHERE deleted_at IS NULL;

-- ── Tags ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(100) UNIQUE NOT NULL,
  category   VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_tags (
  document_id      UUID REFERENCES documents(id) ON DELETE CASCADE,
  tag_id           UUID REFERENCES tags(id) ON DELETE CASCADE,
  confidence_score NUMERIC(4,3) DEFAULT 1.0,
  auto_tagged      BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (document_id, tag_id)
);

-- ── Points / Rewards ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS points_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  action_type     VARCHAR(100) NOT NULL,
  points          INTEGER NOT NULL,
  reference_table VARCHAR(100),
  reference_id    UUID,
  notes           TEXT,
  earned_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_points_user ON points_log(user_id, earned_at DESC);

CREATE TABLE IF NOT EXISTS reward_levels (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_points  INTEGER DEFAULT 0,
  current_level VARCHAR(50) DEFAULT 'Contributor',
  level_number  INTEGER DEFAULT 1,
  next_level    VARCHAR(50) DEFAULT 'Scholar',
  points_to_next INTEGER DEFAULT 500,
  last_updated  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  channel    VARCHAR(50) DEFAULT 'in_app',
  event_type VARCHAR(100) NOT NULL,
  payload    JSONB DEFAULT '{}',
  is_read    BOOLEAN DEFAULT FALSE,
  sent_at    TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, sent_at DESC) WHERE deleted_at IS NULL;

-- ── Submissions ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS submissions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id       UUID REFERENCES users(id),
  course_id        UUID,
  document_id      UUID REFERENCES documents(id),
  status           VARCHAR(50) DEFAULT 'submitted',
  grade            VARCHAR(10),
  feedback         TEXT,
  plagiarism_score NUMERIC(5,4),
  check_status     VARCHAR(20) DEFAULT 'pending',
  submitted_at     TIMESTAMPTZ DEFAULT NOW(),
  graded_at        TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ
);
