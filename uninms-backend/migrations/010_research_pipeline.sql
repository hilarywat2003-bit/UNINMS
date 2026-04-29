-- ═══════════════════════════════════════════════════════════════
-- UniNMS Migration 010 — Intelligent Research Pipeline
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS research_projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title               VARCHAR(500) NOT NULL,
  abstract            TEXT,
  research_type       VARCHAR(50)  DEFAULT 'applied',
    -- basic | applied | action | policy | development
  stage               VARCHAR(30)  DEFAULT 'idea',
    -- idea | proposal | active | review | published
  lead_researcher_id  UUID REFERENCES users(id),
  department_id       UUID REFERENCES departments(id),
  start_date          DATE,
  target_end_date     DATE,
  actual_end_date     DATE,
  funding_source      VARCHAR(255),
  funding_amount      NUMERIC(15,2),
  keywords            TEXT[],
  ethical_approval    BOOLEAN DEFAULT FALSE,
  is_public           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS research_project_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES research_projects(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  role        VARCHAR(50) DEFAULT 'collaborator',
    -- lead | co-lead | collaborator | advisor | student
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

CREATE TABLE IF NOT EXISTS research_milestones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID REFERENCES research_projects(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  due_date     DATE,
  is_done      BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS research_outputs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID REFERENCES research_projects(id) ON DELETE CASCADE,
  document_id  UUID REFERENCES documents(id),
  output_type  VARCHAR(50) DEFAULT 'paper',
    -- paper | dataset | patent | report | presentation | software
  title        VARCHAR(500),
  external_url TEXT,
  published_at DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
