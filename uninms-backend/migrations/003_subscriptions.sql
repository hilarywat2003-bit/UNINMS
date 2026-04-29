-- ═══════════════════════════════════════════════════════════════
-- UniNMS Migration 003 — Institutional Subscriptions
-- ═══════════════════════════════════════════════════════════════

-- Email domain → university mapping
-- Allows automatic institution detection on registration
CREATE TABLE IF NOT EXISTS university_domains (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  domain        VARCHAR(255) NOT NULL UNIQUE,  -- e.g. "unn.edu.ng"
  verified      BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription plans per institution
CREATE TABLE IF NOT EXISTS institution_subscriptions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id    UUID UNIQUE REFERENCES universities(id) ON DELETE CASCADE,
  plan             VARCHAR(50) DEFAULT 'free',  -- free | standard | premium | enterprise
  status           VARCHAR(20) DEFAULT 'active', -- active | suspended | expired | trial
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  expires_at       TIMESTAMPTZ,
  max_users        INTEGER DEFAULT 100,
  max_storage_gb   INTEGER DEFAULT 10,
  features         JSONB DEFAULT '{"semantic_search":false,"plagiarism":false,"vc_dashboard":false,"tetfund_reports":false}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

-- Seed: give UNN a free plan and register its domain
DO $$
DECLARE
  uni_id UUID;
BEGIN
  SELECT id INTO uni_id FROM universities WHERE short_name = 'UNN' LIMIT 1;
  IF uni_id IS NOT NULL THEN
    INSERT INTO university_domains (university_id, domain)
      VALUES (uni_id, 'unn.edu.ng')
      ON CONFLICT (domain) DO NOTHING;

    INSERT INTO institution_subscriptions
      (university_id, plan, status, max_users, max_storage_gb, features)
    VALUES (
      uni_id, 'free', 'active', 100, 10,
      '{"semantic_search":true,"plagiarism":true,"vc_dashboard":false,"tetfund_reports":false}'
    )
    ON CONFLICT (university_id) DO NOTHING;
  END IF;
END $$;

-- Enrich users table with department selection at registration
ALTER TABLE users ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES universities(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Add domain to user_credentials for lookup
ALTER TABLE user_credentials ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE user_credentials ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;
