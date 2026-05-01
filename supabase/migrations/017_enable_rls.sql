-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 017 — Enable Row Level Security on all customer-facing tables
-- RUN IN SUPABASE SQL EDITOR MANUALLY
-- ═══════════════════════════════════════════════════════════════════════════
-- PIPEDA REQUIREMENT: Users must only be able to read their own data.
-- Backend routes use SERVICE_ROLE_KEY which bypasses RLS (intended).
-- Frontend (if it calls Supabase directly) uses ANON_KEY and IS RLS-protected.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── TABLE: transfers ─────────────────────────────────────────────────────────

ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own transfers"   ON public.transfers;
DROP POLICY IF EXISTS "Users insert own transfers" ON public.transfers;
DROP POLICY IF EXISTS "Service role bypasses RLS"  ON public.transfers;

CREATE POLICY "Users see own transfers" ON public.transfers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own transfers" ON public.transfers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role bypasses RLS" ON public.transfers
  FOR ALL USING (auth.role() = 'service_role');

-- ── TABLE: inward_transfers ───────────────────────────────────────────────────

ALTER TABLE public.inward_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own inward transfers" ON public.inward_transfers;
DROP POLICY IF EXISTS "Service role bypasses"          ON public.inward_transfers;

CREATE POLICY "Users see own inward transfers" ON public.inward_transfers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role bypasses" ON public.inward_transfers
  FOR ALL USING (auth.role() = 'service_role');

-- ── TABLE: profiles ───────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own profile"    ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role bypasses"    ON public.profiles;

CREATE POLICY "Users see own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Service role bypasses" ON public.profiles
  FOR ALL USING (auth.role() = 'service_role');

-- ── TABLE: kyc_submissions ────────────────────────────────────────────────────

ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own KYC"     ON public.kyc_submissions;
DROP POLICY IF EXISTS "Service role bypasses" ON public.kyc_submissions;

CREATE POLICY "Users see own KYC" ON public.kyc_submissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role bypasses" ON public.kyc_submissions
  FOR ALL USING (auth.role() = 'service_role');

-- ── TABLE: canada_bank_accounts ───────────────────────────────────────────────

ALTER TABLE public.canada_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own accounts" ON public.canada_bank_accounts;
DROP POLICY IF EXISTS "Service role bypasses"  ON public.canada_bank_accounts;

CREATE POLICY "Users see own accounts" ON public.canada_bank_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role bypasses" ON public.canada_bank_accounts
  FOR ALL USING (auth.role() = 'service_role');

-- ── TABLE: india_nro_accounts ─────────────────────────────────────────────────

ALTER TABLE public.india_nro_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own NRO accounts" ON public.india_nro_accounts;
DROP POLICY IF EXISTS "Service role bypasses"       ON public.india_nro_accounts;

CREATE POLICY "Users see own NRO accounts" ON public.india_nro_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role bypasses" ON public.india_nro_accounts
  FOR ALL USING (auth.role() = 'service_role');

-- ── TABLE: user_credits ───────────────────────────────────────────────────────

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Service role bypasses" ON public.user_credits;

CREATE POLICY "Users see own credits" ON public.user_credits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role bypasses" ON public.user_credits
  FOR ALL USING (auth.role() = 'service_role');

-- ── TABLE: referrals ──────────────────────────────────────────────────────────

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own referrals" ON public.referrals;
DROP POLICY IF EXISTS "Service role bypasses"   ON public.referrals;

CREATE POLICY "Users see own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_user_id OR auth.uid() = referee_user_id);

CREATE POLICY "Service role bypasses" ON public.referrals
  FOR ALL USING (auth.role() = 'service_role');

-- ── Confirmation ──────────────────────────────────────────────────────────────
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'transfers', 'inward_transfers', 'profiles',
    'kyc_submissions', 'canada_bank_accounts',
    'india_nro_accounts', 'user_credits', 'referrals'
  )
ORDER BY tablename;
