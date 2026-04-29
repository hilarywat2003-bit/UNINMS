-- ═══════════════════════════════════════════════════════════════
-- UniNMS Migration 013 — Journal Subscription Plans & Payments
-- ═══════════════════════════════════════════════════════════════

-- ── Journal subscription plans (editable by super admin) ─────────────────────
CREATE TABLE IF NOT EXISTS journal_plans (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           VARCHAR(100) NOT NULL,        -- Starter | Standard | Premium | Institution
  slug           VARCHAR(50)  UNIQUE NOT NULL,
  price_yearly   NUMERIC(12,2) NOT NULL,       -- in NGN
  max_volumes    INTEGER DEFAULT 2,
  max_issues_per_volume INTEGER DEFAULT 4,
  max_submissions_per_year INTEGER DEFAULT 100,
  features       JSONB DEFAULT '{}',           -- {oai_pmh, doi_assignment, custom_domain, analytics}
  is_active      BOOLEAN DEFAULT TRUE,
  sort_order     INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Journal subscriptions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_subscriptions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_id       UUID REFERENCES journals(id) ON DELETE CASCADE,
  plan_id          UUID REFERENCES journal_plans(id),
  university_id    UUID REFERENCES universities(id),
  it_admin_id      UUID REFERENCES users(id),          -- who initiated
  status           VARCHAR(20) DEFAULT 'pending_payment',
  -- pending_payment | payment_submitted | pending_approval | active | expired | suspended | cancelled
  paystack_ref     VARCHAR(200),
  paystack_txn_id  VARCHAR(200),
  amount_paid      NUMERIC(12,2),
  payment_method   VARCHAR(50),
  payment_date     TIMESTAMPTZ,
  payment_proof_url TEXT,                              -- optional manual proof upload
  approved_by      UUID REFERENCES users(id),
  approved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  started_at       TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,
  auto_renew       BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_subs_journal ON journal_subscriptions(journal_id);
CREATE INDEX IF NOT EXISTS idx_journal_subs_status  ON journal_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_journal_subs_admin   ON journal_subscriptions(it_admin_id);

-- ── Payment transactions log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_payment_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES journal_subscriptions(id),
  journal_id      UUID REFERENCES journals(id),
  university_id   UUID REFERENCES universities(id),
  event_type      VARCHAR(50) NOT NULL, -- initiated | completed | failed | refunded | webhook
  paystack_ref    VARCHAR(200),
  amount          NUMERIC(12,2),
  currency        VARCHAR(10) DEFAULT 'NGN',
  gateway_response TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Add subscription_id to journals ──────────────────────────────────────────
ALTER TABLE journals
  ADD COLUMN IF NOT EXISTS subscription_id  UUID REFERENCES journal_subscriptions(id),
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'unpaid';
  -- unpaid | pending_approval | active | expired | suspended

-- ── Seed default journal plans ────────────────────────────────────────────────
INSERT INTO journal_plans (name, slug, price_yearly, max_volumes, max_issues_per_volume, max_submissions_per_year, features, sort_order)
VALUES
  ('Starter',     'starter',     150000,  1, 2,  50,
   '{"oai_pmh":true,"doi_assignment":false,"custom_domain":false,"analytics_basic":true,"analytics_advanced":false}', 1),
  ('Standard',    'standard',    350000,  2, 4,  200,
   '{"oai_pmh":true,"doi_assignment":true,"custom_domain":false,"analytics_basic":true,"analytics_advanced":false}', 2),
  ('Premium',     'premium',     750000,  4, 6,  500,
   '{"oai_pmh":true,"doi_assignment":true,"custom_domain":true,"analytics_basic":true,"analytics_advanced":true}', 3),
  ('Institution', 'institution', 1500000, 999, 999, 999,
   '{"oai_pmh":true,"doi_assignment":true,"custom_domain":true,"analytics_basic":true,"analytics_advanced":true,"unlimited":true}', 4)
ON CONFLICT (slug) DO NOTHING;

-- ── Trigger ───────────────────────────────────────────────────────────────────
CREATE TRIGGER journal_subs_updated_at
  BEFORE UPDATE ON journal_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
