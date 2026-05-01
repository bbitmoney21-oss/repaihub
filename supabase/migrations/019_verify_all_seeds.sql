-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 019 — KYC config seeds + missing tables + RLS fixes
-- RUN IN SUPABASE SQL EDITOR MANUALLY
-- ═══════════════════════════════════════════════════════════════════════════
-- Fixes:
--   1. kyc_config seeds — Fable-first routing rows + correct provider names
--   2. profiles.pan_hash column — SHA-256 of PAN for Form 145 compliance
--   3. user_credits table — missing from 013, caused 017 RLS to fail
--   4. referrals table — missing from 013, caused 017 RLS to fail
--   5. RLS policies for user_credits and referrals
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. kyc_config seeds ───────────────────────────────────────────────────────

-- Fix: active_india_kyc was 'digilocker' in 013 seeds — must be 'setu_digilocker'
INSERT INTO public.kyc_config (key, value, description)
VALUES ('active_india_kyc', 'setu_digilocker', 'India KYC provider: setu_digilocker | fable')
ON CONFLICT (key) DO UPDATE
  SET description = EXCLUDED.description;

-- Fable India KYC routing switch (set to true once Fable confirms capability)
INSERT INTO public.kyc_config (key, value, description)
VALUES ('fable_india_kyc_enabled', 'false', 'Route India identity KYC to Fable (unconfirmed — see docs/FABLE_QUESTIONS.md)')
ON CONFLICT (key) DO UPDATE
  SET description = EXCLUDED.description;

-- Fable Canada KYC routing switch (set to true once Fable confirms capability)
INSERT INTO public.kyc_config (key, value, description)
VALUES ('fable_canada_kyc_enabled', 'false', 'Route Canada bank KYC to Fable (unconfirmed — see docs/FABLE_QUESTIONS.md)')
ON CONFLICT (key) DO UPDATE
  SET description = EXCLUDED.description;

-- Fable PAN verification routing switch
INSERT INTO public.kyc_config (key, value, description)
VALUES ('fable_pan_enabled', 'false', 'Route PAN verification to Fable (unconfirmed — see docs/FABLE_QUESTIONS.md)')
ON CONFLICT (key) DO UPDATE
  SET description = EXCLUDED.description;

-- Setu Reverse Penny Drop is MANDATORY — no config switch, always Setu
INSERT INTO public.kyc_config (key, value, description)
VALUES ('reverse_penny_drop_provider', 'setu', 'Inward recipient bank verification provider — always setu, Fable cannot replace')
ON CONFLICT (key) DO UPDATE
  SET description = EXCLUDED.description;

-- KYC expiry in days (2 years = 730)
INSERT INTO public.kyc_config (key, value, description)
VALUES ('kyc_expiry_days', '730', 'KYC session validity in days (PIPEDA + FEMA retention minimum)')
ON CONFLICT (key) DO UPDATE
  SET description = EXCLUDED.description;

-- Fable AML screening switch
INSERT INTO public.kyc_config (key, value, description)
VALUES ('fable_aml_screening', 'false', 'Enable Fable AML/PEP/sanctions screening (requires FABLE_API_KEY)')
ON CONFLICT (key) DO UPDATE
  SET description = EXCLUDED.description;

-- Active Canada KYC provider (flinks while Fable unconfirmed)
INSERT INTO public.kyc_config (key, value, description)
VALUES ('active_canada_kyc', 'flinks', 'Canada KYC provider: flinks | fable')
ON CONFLICT (key) DO UPDATE
  SET description = EXCLUDED.description;

-- ── 2. profiles.pan_hash column ───────────────────────────────────────────────
-- SHA-256 hash of PAN — stored for Form 145 compliance (IT Act 2025 s.397(3)(d))
-- Never store raw PAN. Hash is irreversible.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pan_hash TEXT;

-- ── 3. user_credits table ─────────────────────────────────────────────────────
-- Referenced in 017_enable_rls.sql but never created. Tracks promotional credits.

CREATE TABLE IF NOT EXISTS public.user_credits (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency    TEXT        NOT NULL DEFAULT 'CAD',
  reason      TEXT,       -- 'referral_bonus', 'promo_code', 'manual_adjustment'
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_credits_user_id_idx ON public.user_credits (user_id);

-- ── 4. referrals table ────────────────────────────────────────────────────────
-- Referenced in 017_enable_rls.sql but never created. Tracks referral relationships.

CREATE TABLE IF NOT EXISTS public.referrals (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code    TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending', -- 'pending','credited','expired'
  credited_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referee_user_id) -- one referral per referee
);

CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals (referrer_user_id);
CREATE INDEX IF NOT EXISTS referrals_code_idx     ON public.referrals (referral_code);

-- ── 5. RLS on user_credits and referrals ──────────────────────────────────────
-- (Migration 017 failed because these tables didn't exist — now they do)

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Service role bypasses" ON public.user_credits;

CREATE POLICY "Users see own credits" ON public.user_credits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role bypasses" ON public.user_credits
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own referrals" ON public.referrals;
DROP POLICY IF EXISTS "Service role bypasses"   ON public.referrals;

CREATE POLICY "Users see own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_user_id OR auth.uid() = referee_user_id);

CREATE POLICY "Service role bypasses" ON public.referrals
  FOR ALL USING (auth.role() = 'service_role');

-- ── Confirmation ──────────────────────────────────────────────────────────────
SELECT
  'Migration 019 complete' AS status,
  (SELECT COUNT(*) FROM public.kyc_config)                   AS kyc_config_rows,
  (SELECT value FROM public.kyc_config WHERE key = 'active_india_kyc')   AS active_india_kyc,
  (SELECT value FROM public.kyc_config WHERE key = 'active_canada_kyc')  AS active_canada_kyc,
  (SELECT value FROM public.kyc_config WHERE key = 'fable_india_kyc_enabled')  AS fable_india_kyc_enabled,
  (SELECT value FROM public.kyc_config WHERE key = 'fable_canada_kyc_enabled') AS fable_canada_kyc_enabled,
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'profiles' AND column_name = 'pan_hash') AS pan_hash_col_exists,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_credits') AS user_credits_exists,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referrals')    AS referrals_exists;
