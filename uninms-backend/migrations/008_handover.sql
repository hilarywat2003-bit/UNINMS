-- ── Knowledge transfer / handover packages ───────────────────────────────────
CREATE TABLE IF NOT EXISTS handovers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  to_user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  context      TEXT,                              -- role / reason for transfer
  status       VARCHAR(20)  DEFAULT 'draft',      -- draft | active | completed | acknowledged
  deadline     DATE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Individual knowledge items within a handover ──────────────────────────────
CREATE TABLE IF NOT EXISTS handover_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id  UUID REFERENCES handovers(id) ON DELETE CASCADE,
  category     VARCHAR(50)  DEFAULT 'other',
    -- ongoing_projects | key_contacts | procedures | access_credentials
    -- reports | meetings | institutional_knowledge | other
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  document_id  UUID REFERENCES documents(id) ON DELETE SET NULL,
  priority     VARCHAR(10)  DEFAULT 'medium',     -- high | medium | low
  is_done      BOOLEAN      DEFAULT false,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);
