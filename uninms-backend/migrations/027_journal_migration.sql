-- ═══════════════════════════════════════════════════════════════
-- UniNMS Migration 027 — Journal Migration / Harvesting Portal
-- ═══════════════════════════════════════════════════════════════

-- Migration requests submitted by IT admins
CREATE TABLE IF NOT EXISTS journal_migration_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id   UUID REFERENCES universities(id),
  submitted_by    UUID NOT NULL REFERENCES users(id),

  -- Journal identity
  journal_title   VARCHAR(500) NOT NULL,
  existing_url    TEXT NOT NULL,
  oai_pmh_url     TEXT,                        -- auto-detected or provided
  platform        VARCHAR(100) DEFAULT 'unknown',
  -- OJS | DSpace | Bepress | WordPress | Custom | OAI-PMH | Unknown

  -- Contact for migration coordination
  contact_name    VARCHAR(200),
  contact_email   VARCHAR(200),
  issn_print      VARCHAR(20),
  issn_online     VARCHAR(20),
  scope           TEXT,
  notes           TEXT,

  -- Lifecycle
  status          VARCHAR(30) DEFAULT 'pending',
  -- pending | probing | probe_done | importing | imported | failed | rejected

  -- Probe output
  probe_result    JSONB DEFAULT '{}',
  article_count_found   INTEGER DEFAULT 0,
  article_count_imported INTEGER DEFAULT 0,
  error_message   TEXT,

  -- Review
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  review_note     TEXT,

  -- Linked journal record once created
  journal_id      UUID REFERENCES journals(id),

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jmr_university ON journal_migration_requests(university_id);
CREATE INDEX IF NOT EXISTS idx_jmr_status     ON journal_migration_requests(status);
CREATE INDEX IF NOT EXISTS idx_jmr_submitted  ON journal_migration_requests(submitted_by);

-- Imported articles harvested from external journal
CREATE TABLE IF NOT EXISTS journal_imported_articles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_request_id  UUID REFERENCES journal_migration_requests(id) ON DELETE CASCADE,
  journal_id            UUID REFERENCES journals(id),
  external_id           TEXT UNIQUE,           -- OAI-PMH identifier for dedup
  title                 TEXT NOT NULL,
  abstract              TEXT,
  author_names          TEXT,                  -- semicolon-separated
  doi                   TEXT,
  source_url            TEXT,
  published_at          TIMESTAMPTZ,
  subjects              TEXT[],
  volume_no             TEXT,
  issue_no              TEXT,
  raw_metadata          JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jia_journal   ON journal_imported_articles(journal_id);
CREATE INDEX IF NOT EXISTS idx_jia_migration ON journal_imported_articles(migration_request_id);
