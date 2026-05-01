-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 020 — referral_codes table + user_credits schema fixes
-- RUN IN SUPABASE SQL EDITOR MANUALLY (after 019)
-- ═══════════════════════════════════════════════════════════════════════════
-- Fixes:
--   1. referral_codes table — missing entirely (causes registration 500 when
--      referralService.createReferralCode() tries to insert after 5 retries)
--   2. user_credits columns — migration 019 created wrong schema
--      (amount/currency/reason/expires_at) but referralService.ts uses
--      (balance_cad/total_earned/total_spent). Add the correct columns.
--   3. user_credits UNIQUE on user_id — required by upsert in referralService
--   4. referrals composite UNIQUE — required by upsert on (referrer, referee)
--   5. referrals missing columns — referee_transfer_id, referrer_reward_cad,
--      referee_reward_type, rewarded_at used by referralService.processReferralReward
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. referral_codes table ───────────────────────────────────────────────────
-- Stores each user's shareable referral code.
-- code is UNIQUE (enforced by DB — service retries 5× on collision).

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

DROP POLICY IF EXISTS "Users see own referral code"  ON public.referral_codes;
DROP POLICY IF EXISTS "Service role bypasses RLS"     ON public.referral_codes;

CREATE POLICY "Users see own referral code" ON public.referral_codes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role bypasses RLS" ON public.referral_codes
  FOR ALL USING (auth.role() = 'service_role');

-- ── 2. Fix user_credits columns ───────────────────────────────────────────────
-- Migration 019 created user_credits with generic (amount, currency, reason)
-- but referralService.ts uses (balance_cad, total_earned, total_spent).

ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS balance_cad  NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earned NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_spent  NUMERIC(10,2) NOT NULL DEFAULT 0;

-- ── 3. user_credits UNIQUE(user_id) for upsert ───────────────────────────────
-- referralService.ts: supabaseAdmin.from('user_credits').upsert({...}, { onConflict: 'user_id' })
-- Requires a unique constraint on user_id.

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

-- ── 4. referrals composite UNIQUE for upsert ─────────────────────────────────
-- referralService.ts: upsert({...}, { onConflict: 'referrer_user_id,referee_user_id' })
-- Migration 019 only had UNIQUE(referee_user_id) — not the composite key.

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

-- ── 5. referrals missing columns ─────────────────────────────────────────────
-- referralService.processReferralReward() writes these columns:

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS referee_transfer_id UUID        REFERENCES public.transfers(id),
  ADD COLUMN IF NOT EXISTS referrer_reward_cad  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS referee_reward_type  TEXT,
  ADD COLUMN IF NOT EXISTS rewarded_at          TIMESTAMPTZ;

-- ── Confirmation ──────────────────────────────────────────────────────────────
SELECT
  'Migration 020 complete' AS status,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='referral_codes') AS referral_codes_exists,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_credits' AND column_name='balance_cad') AS user_credits_balance_cad_exists,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='referrals' AND column_name='rewarded_at') AS referrals_rewarded_at_exists;
