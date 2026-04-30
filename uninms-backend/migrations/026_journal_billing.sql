-- ═══════════════════════════════════════════════════════════════
-- UniNMS Migration 013 — Journal Subscription Plans & Payments
-- ═══════════════════════════════════════════════════════════════

-- ── Journal subscription plans (editable by super admin) ─────────────────────
CREATE TABLE IF NOT EXISTS journal_plans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,           -- Basic | Standard | Premium
  slug          VARCHAR(50)  UNIQUE NOT NULL,
  price_yearly  NUMERIC(12,2) NOT NULL,          -- in Naira
  price_monthly NUMERIC(12,2),
  max_articles  INTEGER DEFAULT 50,              -- per year
  max_issues    INTEGER DEFAULT 4,               -- per year
  max_editors   INTEGER DEFAULT 3,
  max_reviewers INTEGER DEFAULT 20,
  features      JSONB DEFAULT '{}',              -- {"doi_assignment":true,"plagiarism":true,...}
  is_active     BOOLEAN DEFAULT TRUE,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default plans
INSERT INTO journal_plans (name, slug, price_yearly, price_monthly, max_articles, max_issues, max_editors, max_reviewers, features, sort_order)
VALUES
  ('Starter',  'starter',  50000,  5000,  24,  2,  1, 10, '{"doi_assignment":false,"plagiarism":true,"oai_pmh":true,"custom_branding":false}', 1),
  ('Standard', 'standard', 150000, 15000, 100, 4,  3, 50, '{"doi_assignment":true,"plagiarism":true,"oai_pmh":true,"custom_branding":false}', 2),
  ('Premium',  'premium',  350000, 35000, 500, 12, 10,200, '{"doi_assignment":true,"plagiarism":true,"oai_pmh":true,"custom_branding":true}', 3)
ON CONFLICT (slug) DO NOTHING;

-- ── Journal subscriptions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_id      UUID REFERENCES journals(id) ON DELETE CASCADE,
  plan_id         UUID REFERENCES journal_plans(id),
  status          VARCHAR(20) DEFAULT 'pending_payment',
  -- pending_payment | payment_received | active | expired | cancelled | suspended
  billing_cycle   VARCHAR(10) DEFAULT 'yearly',   -- yearly | monthly
  amount_paid     NUMERIC(12,2),
  currency        VARCHAR(10) DEFAULT 'NGN',
  started_at      TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  auto_renew      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_subs_journal ON journal_subscriptions(journal_id);
CREATE INDEX IF NOT EXISTS idx_journal_subs_status  ON journal_subscriptions(status);

-- ── Journal payments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_payments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_id        UUID REFERENCES journals(id),
  subscription_id   UUID REFERENCES journal_subscriptions(id),
  paid_by           UUID REFERENCES users(id),          -- IT Admin who paid
  plan_id           UUID REFERENCES journal_plans(id),
  amount            NUMERIC(12,2) NOT NULL,
  currency          VARCHAR(10) DEFAULT 'NGN',
  paystack_ref      VARCHAR(200) UNIQUE,
  paystack_status   VARCHAR(50),
  payment_method    VARCHAR(50),
  status            VARCHAR(20) DEFAULT 'pending',
  -- pending | success | failed | refunded
  approved_by       UUID REFERENCES users(id),          -- super_admin
  approved_at       TIMESTAMPTZ,
  approval_note     TEXT,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  metadata          JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_journal_payments_journal ON journal_payments(journal_id);
CREATE INDEX IF NOT EXISTS idx_journal_payments_status  ON journal_payments(status);
CREATE INDEX IF NOT EXISTS idx_journal_payments_ref     ON journal_payments(paystack_ref);

-- ── Add subscription columns to journals ──────────────────────────────────────
ALTER TABLE journals
  ADD COLUMN IF NOT EXISTS plan_id            UUID REFERENCES journal_plans(id),
  ADD COLUMN IF NOT EXISTS subscription_id    UUID REFERENCES journal_subscriptions(id),
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(30) DEFAULT 'pending_payment',
  ADD COLUMN IF NOT EXISTS approved_by        UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason   TEXT;

-- ── Super admin approval audit ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_approval_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_id   UUID REFERENCES journals(id),
  action       VARCHAR(30) NOT NULL,   -- approved | rejected | suspended | reactivated
  performed_by UUID REFERENCES users(id),
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
