-- Rollback for 028: restores the exact pre-028 grants, policies and triggers
-- as read from mievzzzxpsomrzxhkecu on 17 Nov 2026.
-- WARNING: re-opens the QA escalation (users can self-verify KYC, set
-- transfer status, and fully control inward transfers). Outage use only.
BEGIN;

DROP TRIGGER IF EXISTS guard_server_only_columns ON public.profiles;
DROP TRIGGER IF EXISTS guard_server_only_columns ON public.kyc_submissions;
DROP TRIGGER IF EXISTS guard_server_only_columns ON public.transfers;
DROP TRIGGER IF EXISTS guard_server_only_columns ON public.inward_transfers;
DROP FUNCTION IF EXISTS public.guard_server_only_columns();

-- restore the kyc_submissions flags 028 reset (prior values are in the reason),
-- then drop the reset columns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.kyc_submissions'::regclass
             AND attname = 'verified_reset_reason' AND NOT attisdropped) THEN
    EXECUTE $q$
      UPDATE public.kyc_submissions
         SET canada_verified = (verified_reset_reason LIKE '%prior canada_verified=true%'),
             india_verified  = (verified_reset_reason LIKE '%india_verified=true%')
       WHERE verified_reset_reason LIKE '028:%'
    $q$;
  END IF;
END
$$;
ALTER TABLE public.kyc_submissions
  DROP COLUMN IF EXISTS verified_reset_at,
  DROP COLUMN IF EXISTS verified_reset_reason;

DROP POLICY IF EXISTS "profiles_update_own_safe"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own_safe"  ON public.profiles;
DROP POLICY IF EXISTS "kyc_insert_own_unverified" ON public.kyc_submissions;

-- pre-028 policies (roles {public}, exact quals from pg_policies)
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"      ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert"          ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"      ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "kyc_insert_own" ON public.kyc_submissions;
CREATE POLICY "kyc_insert_own" ON public.kyc_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "kyc_update_own" ON public.kyc_submissions;
CREATE POLICY "kyc_update_own" ON public.kyc_submissions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own transfers" ON public.transfers;
CREATE POLICY "Users insert own transfers" ON public.transfers FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "transfers_insert_own" ON public.transfers;
CREATE POLICY "transfers_insert_own"       ON public.transfers FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_own_inward" ON public.inward_transfers;
CREATE POLICY "users_own_inward" ON public.inward_transfers FOR ALL TO authenticated USING (user_id = auth.uid());

-- pre-028 grants: ALL (arwdDxtm) to anon and authenticated on all four tables
REVOKE ALL ON TABLE public.profiles, public.kyc_submissions, public.transfers, public.inward_transfers FROM anon, authenticated;
GRANT ALL ON TABLE public.profiles, public.kyc_submissions, public.transfers, public.inward_transfers TO anon, authenticated;

COMMIT;
