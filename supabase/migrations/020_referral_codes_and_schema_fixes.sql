-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 020 — referral_codes + user_credits + referrals (self-contained)
-- RUN IN SUPABASE SQL EDITOR MANUALLY
-- Safe to run even if migration 019 was never applied.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. referral_codes table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.referral_codes (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code              TEXT          NOT NULL UNIQUE,
  total_referrals   INTEGER       NOT NULL DEFAULT 0,
  total_earned_cad  NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS referral_codes_user_id_idx ON public.referral_codes (user_id);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own referral code" ON public.referral_codes;
DROP POLICY IF EXISTS "Service role bypasses RLS"    ON public.referral_codes;

CREATE POLICY "Users see own referral code" ON public.referral_codes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role bypasses RLS" ON public.referral_codes
  FOR ALL USING (auth.role() = 'service_role');

-- ── 2. user_credits table (create if not exists with correct schema) ──────────
-- referralService.ts uses: balance_cad, total_earned, total_spent, user_id

CREATE TABLE IF NOT EXISTS public.user_credits (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_cad   NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_earned  NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_spent   NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- If migration 019 ran first and created user_credits with different columns,
-- add the missing columns now (ADD COLUMN IF NOT EXISTS is idempotent):
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS balance_cad  NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earned NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_spent  NUMERIC(10,2) NOT NULL DEFAULT 0;

-- UNIQUE(user_id) required by upsert in referralService.ts:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'user_credits'
      AND constraint_name = 'user_credits_user_id_key'
  ) THEN
    ALTER TABLE public.user_credits ADD CONSTRAINT user_credits_user_id_key UNIQUE (user_id);
  END IF;
END $$;

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Service role bypasses" ON public.user_credits;

CREATE POLICY "Users see own credits" ON public.user_credits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role bypasses" ON public.user_credits
  FOR ALL USING (auth.role() = 'service_role');

-- ── 3. referrals table (create if not exists) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.referrals (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id     UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_user_id      UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code        TEXT          NOT NULL,
  status               TEXT          NOT NULL DEFAULT 'pending',
  referee_transfer_id  UUID          REFERENCES public.transfers(id),
  referrer_reward_cad  NUMERIC(10,2),
  referee_reward_type  TEXT,
  rewarded_at          TIMESTAMPTZ,
  credited_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Add missing columns if referrals was created by migration 019 without them:
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS referee_transfer_id UUID        REFERENCES public.transfers(id),
  ADD COLUMN IF NOT EXISTS referrer_reward_cad  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS referee_reward_type  TEXT,
  ADD COLUMN IF NOT EXISTS rewarded_at          TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals (referrer_user_id);
CREATE INDEX IF NOT EXISTS referrals_code_idx     ON public.referrals (referral_code);

-- Composite UNIQUE required by upsert on (referrer_user_id, referee_user_id):
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'referrals'
      AND constraint_name = 'referrals_referrer_referee_key'
  ) THEN
    ALTER TABLE public.referrals
      ADD CONSTRAINT referrals_referrer_referee_key UNIQUE (referrer_user_id, referee_user_id);
  END IF;
END $$;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own referrals" ON public.referrals;
DROP POLICY IF EXISTS "Service role bypasses referrals" ON public.referrals;

CREATE POLICY "Users see own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_user_id OR auth.uid() = referee_user_id);

CREATE POLICY "Service role bypasses referrals" ON public.referrals
  FOR ALL USING (auth.role() = 'service_role');

-- ── 4. profiles.pan_hash column ───────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pan_hash TEXT;

-- ── 5. kyc_config seeds ───────────────────────────────────────────────────────

INSERT INTO public.kyc_config (key, value, description)
VALUES
  ('active_india_kyc',          'setu_digilocker', 'India KYC provider: setu_digilocker | fable'),
  ('active_canada_kyc',         'flinks',           'Canada KYC provider: flinks | fable'),
  ('fable_india_kyc_enabled',   'false',            'Route India identity KYC to Fable'),
  ('fable_canada_kyc_enabled',  'false',            'Route Canada bank KYC to Fable'),
  ('fable_pan_enabled',         'false',            'Route PAN verification to Fable'),
  ('fable_aml_screening',       'false',            'Enable Fable AML/PEP screening'),
  ('reverse_penny_drop_provider','setu',            'Inward recipient bank verification — always setu'),
  ('kyc_expiry_days',           '730',              'KYC session validity in days')
ON CONFLICT (key) DO NOTHING;

-- ── Confirmation ──────────────────────────────────────────────────────────────
SELECT
  'Migration 020 complete' AS status,
  EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='referral_codes') AS referral_codes_exists,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_credits' AND column_name='balance_cad') AS user_credits_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='referrals' AND column_name='rewarded_at') AS referrals_ok;
