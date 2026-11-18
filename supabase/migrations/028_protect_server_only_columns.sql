-- ═══════════════════════════════════════════════════════════════════════════════
-- 028_protect_server_only_columns.sql
-- REPAIHUB — signed-in users can no longer write security/verification state.
--
-- QA finding (qa-evidence/QA_REPORT.md, "Pre-existing, outside 026"):
--   profiles UPDATE own with no column limit  → "kycStatus", "canadaVerified",
--       "indiaVerified", signup_complete, status, password_hash, locked_until…
--   kyc_submissions INSERT/UPDATE own         → canada_verified / india_verified
--       (read by the API at src/routes/auth.ts:405-406, :603-604,
--        src/routes/transfers.ts:511)
--   transfers INSERT own                      → status='completed',
--       compliance_status='approved', fifteen_ca/cb numbers (→ certificate)
--   inward_transfers FOR ALL own              → full control
--   + one-time reset of self-attested kyc_submissions flags (section 2b)
--
-- Code evidence: the web app never writes (or reads) these tables with the
-- anon/user Supabase client — src/lib/supabase.ts is only used for
-- supabase.auth.* in src/pages/auth/ResetPassword.tsx. Every write goes through
-- the API with the service-role key (BYPASSRLS). So the user-side write surface
-- is cut to the minimum, in three layers:
--   1. GRANTs: anon loses everything on these 4 tables; authenticated keeps
--      SELECT plus column-level INSERT/UPDATE on harmless columns only.
--   2. RLS: write policies narrowed with WITH CHECK (no pre-verified rows);
--      no user INSERT/UPDATE/DELETE policy on transfers / inward_transfers.
--   3. BEFORE trigger guard: any role without BYPASSRLS/superuser that changes
--      a protected column (or writes transfers/inward_transfers at all) gets
--      42501 — even if a later migration re-grants or re-opens a policy.
-- service_role / postgres (BYPASSRLS) are unaffected. The signup trigger
-- handle_new_user() is SECURITY DEFINER (runs as postgres) and is unaffected.
--
-- Transactional, idempotent, self-checking. DRAFT — not applied anywhere.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 0. Guard function ────────────────────────────────────────────────────────
-- TG_ARGV = columns a non-privileged caller MAY change on UPDATE. Every other
-- column is server-only. On INSERT/DELETE (only attached where users must not
-- insert/delete at all) a non-privileged caller is always refused.
-- SECURITY INVOKER on purpose: current_user is the caller (authenticated /
-- anon / service_role / postgres via SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.guard_server_only_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_privileged boolean;
  v_changed    text[];
BEGIN
  SELECT r.rolsuper OR r.rolbypassrls INTO v_privileged
  FROM pg_catalog.pg_roles r WHERE r.rolname = current_user;

  IF COALESCE(v_privileged, false) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT pg_catalog.array_agg(n.key ORDER BY n.key) INTO v_changed
    FROM pg_catalog.jsonb_each(pg_catalog.to_jsonb(NEW)) n
    JOIN pg_catalog.jsonb_each(pg_catalog.to_jsonb(OLD)) o USING (key)
    WHERE n.value IS DISTINCT FROM o.value
      -- TG_ARGV is NULL when the trigger has no arguments: COALESCE so that
      -- "no safe columns" means every change is refused (fail closed).
      AND NOT (n.key = ANY (COALESCE(TG_ARGV, ARRAY[]::text[])));
    IF v_changed IS NULL THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'column(s) % on %.% can only be changed by the server',
      v_changed, TG_TABLE_SCHEMA, TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;

  RAISE EXCEPTION '% on %.% is server-only', TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = '42501';
END
$$;

REVOKE ALL ON FUNCTION public.guard_server_only_columns() FROM PUBLIC, anon, authenticated;

-- ── 1. profiles ──────────────────────────────────────────────────────────────
-- User-editable on UPDATE: full_name, phone (and updated_at). Everything else
-- — kycStatus, canadaVerified, indiaVerified, kycVerifiedAt/ExpiresAt,
-- kycSessionId, kycProvider, signup_complete, status, residency*, customerModel,
-- hasNroAccount, pan_number/pan_hash, email, password_hash, reset_token_*,
-- failed_login_attempts, locked_until, last_login_at, referred_by_code,
-- first_transfer_at — is server-only.
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (full_name, phone, updated_at) ON TABLE public.profiles TO authenticated;
GRANT INSERT (id, email, full_name, phone) ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users update own profile"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert"            ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_safe"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own_safe"   ON public.profiles;

CREATE POLICY "profiles_update_own_safe" ON public.profiles
  FOR UPDATE TO authenticated
  USING      (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- Normal signup goes through handle_new_user(); this is only a fallback and
-- can never create a pre-verified / pre-completed profile or claim another
-- user's email.
CREATE POLICY "profiles_insert_own_safe" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
        id = (SELECT auth.uid())
    AND email = ((SELECT auth.jwt()) ->> 'email')
    AND COALESCE("kycStatus", 'pending') = 'pending'
    AND COALESCE("canadaVerified", false) = false
    AND COALESCE("indiaVerified", false)  = false
    AND "kycVerifiedAt" IS NULL
    AND signup_complete = false
    AND COALESCE(status, 'active') = 'active'
  );

DROP TRIGGER IF EXISTS guard_server_only_columns ON public.profiles;
CREATE TRIGGER guard_server_only_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_server_only_columns('full_name', 'phone', 'updated_at');

-- ── 2. kyc_submissions ───────────────────────────────────────────────────────
-- No user-editable column exists (user_id + verification flags + timestamps).
-- Users may only create an empty, unverified row; no user UPDATE at all.
REVOKE ALL ON TABLE public.kyc_submissions FROM anon, authenticated;
GRANT SELECT ON TABLE public.kyc_submissions TO authenticated;
GRANT INSERT (user_id) ON TABLE public.kyc_submissions TO authenticated;

DROP POLICY IF EXISTS "kyc_update_own"               ON public.kyc_submissions;
DROP POLICY IF EXISTS "kyc_insert_own"               ON public.kyc_submissions;
DROP POLICY IF EXISTS "kyc_insert_own_unverified"    ON public.kyc_submissions;

CREATE POLICY "kyc_insert_own_unverified" ON public.kyc_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
        user_id = (SELECT auth.uid())
    AND canada_verified = false AND canada_verified_at IS NULL
    AND india_verified  = false AND india_verified_at  IS NULL
  );

DROP TRIGGER IF EXISTS guard_server_only_columns ON public.kyc_submissions;
CREATE TRIGGER guard_server_only_columns
  BEFORE UPDATE ON public.kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION public.guard_server_only_columns();

-- ── 2b. Reset self-attested "verified" flags (one-time data fix) ─────────────
-- Until this migration, kyc_submissions.canada_verified / india_verified = true
-- could only come from self-attestation: POST /users/kyc/canada|india set them
-- when bank details were submitted (src/routes/users.ts:222-225, 257-260), or a
-- user wrote them directly (QA finding). The provider path
-- (kycService.updateKYCStatus, src/services/kycService.ts:358-364) and the
-- unsigned /webhooks/fable/kyc both upsert columns that do not exist on live
-- (updated_at / kyc_verified_at), so they never set these flags. So every
-- verified row here is self-attested: keep the row, reset the flags to false,
-- and stamp why. The prior values are recorded in verified_reset_reason so the
-- rollback can restore them exactly.
-- Runs ONLY on the application that adds the columns, so re-running 028 later
-- never wipes flags the server has written since (e.g. the provider mirror).
-- Live (17 Nov 2026): 0 kyc_submissions rows, so this is a no-op there today.
DO $$
DECLARE
  v_first boolean;
  v_n     integer := 0;
BEGIN
  v_first := NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.kyc_submissions'::regclass
      AND attname = 'verified_reset_at' AND NOT attisdropped);

  ALTER TABLE public.kyc_submissions
    ADD COLUMN IF NOT EXISTS verified_reset_at     timestamptz,
    ADD COLUMN IF NOT EXISTS verified_reset_reason text;

  IF v_first THEN
    UPDATE public.kyc_submissions
       SET verified_reset_at     = now(),
           verified_reset_reason = format(
             '028: self-attested (bank-detail step / direct user write), not provider-verified; prior canada_verified=%s india_verified=%s',
             CASE WHEN canada_verified THEN 'true' ELSE 'false' END,
             CASE WHEN india_verified  THEN 'true' ELSE 'false' END),
           canada_verified = false,
           india_verified  = false
     WHERE canada_verified OR india_verified;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE '028: reset % self-attested kyc_submissions row(s)', v_n;

    IF EXISTS (SELECT 1 FROM public.kyc_submissions WHERE canada_verified OR india_verified) THEN
      RAISE EXCEPTION '028 self-check: kyc_submissions still has verified rows after reset';
    END IF;
  ELSE
    RAISE NOTICE '028: reset columns already present; one-time reset skipped';
  END IF;
END
$$;

COMMENT ON COLUMN public.kyc_submissions.verified_reset_at IS
  'Set by migration 028 when self-attested verified flags were reset to false. Server-only.';
COMMENT ON COLUMN public.kyc_submissions.verified_reset_reason IS
  'Why 028 reset the flags, with the prior values (used by rollback_028.sql). Server-only.';

-- ── 3. transfers ─────────────────────────────────────────────────────────────
-- Transfers are created only by POST /transfers/initiate (server computes fees,
-- FX, risk, compliance). A direct user INSERT could set status, compliance and
-- 15CA/15CB fields, amount_cad and exchange_rate (NOT NULL, no default), and
-- GET /transfers/:id/certificate trusts status='completed'. So: SELECT only.
REVOKE ALL ON TABLE public.transfers FROM anon, authenticated;
GRANT SELECT ON TABLE public.transfers TO authenticated;

DROP POLICY IF EXISTS "Users insert own transfers" ON public.transfers;
DROP POLICY IF EXISTS "transfers_insert_own"       ON public.transfers;

DROP TRIGGER IF EXISTS guard_server_only_columns ON public.transfers;
CREATE TRIGGER guard_server_only_columns
  BEFORE INSERT OR UPDATE OR DELETE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.guard_server_only_columns();

-- ── 4. inward_transfers ──────────────────────────────────────────────────────
-- Created only by POST /inward/initiate (server). No code path writes it with a
-- user client → no user INSERT/UPDATE/DELETE. Own-row SELECT stays
-- ("Users see own inward transfers").
REVOKE ALL ON TABLE public.inward_transfers FROM anon, authenticated;
GRANT SELECT ON TABLE public.inward_transfers TO authenticated;

DROP POLICY IF EXISTS "users_own_inward" ON public.inward_transfers;

DROP TRIGGER IF EXISTS guard_server_only_columns ON public.inward_transfers;
CREATE TRIGGER guard_server_only_columns
  BEFORE INSERT OR UPDATE OR DELETE ON public.inward_transfers
  FOR EACH ROW EXECUTE FUNCTION public.guard_server_only_columns();

-- ── 5. Self-check ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_bad text := '';
  v_col text;
  v_tbl text;
  v_safe_profiles constant text[] := ARRAY['full_name','phone','updated_at'];
BEGIN
  -- anon: nothing at all on the 4 tables
  FOREACH v_tbl IN ARRAY ARRAY['profiles','kyc_submissions','transfers','inward_transfers'] LOOP
    IF has_table_privilege('anon', format('public.%I', v_tbl), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_any_column_privilege('anon', format('public.%I', v_tbl), 'SELECT,INSERT,UPDATE,REFERENCES') THEN
      v_bad := v_bad || format(' [anon has privileges on %s]', v_tbl);
    END IF;
    IF has_table_privilege('authenticated', format('public.%I', v_tbl), 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
      v_bad := v_bad || format(' [authenticated has table-level write on %s]', v_tbl);
    END IF;
    IF NOT has_table_privilege('authenticated', format('public.%I', v_tbl), 'SELECT') THEN
      v_bad := v_bad || format(' [authenticated lost SELECT on %s]', v_tbl);
    END IF;
    IF NOT has_table_privilege('service_role', format('public.%I', v_tbl), 'SELECT,INSERT,UPDATE,DELETE') THEN
      v_bad := v_bad || format(' [service_role lost access to %s]', v_tbl);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = format('public.%I', v_tbl)::regclass
                   AND tgname = 'guard_server_only_columns' AND tgenabled = 'O') THEN
      v_bad := v_bad || format(' [guard trigger missing on %s]', v_tbl);
    END IF;
  END LOOP;

  -- profiles: authenticated may UPDATE only the safe columns
  FOR v_col IN SELECT attname FROM pg_attribute
               WHERE attrelid = 'public.profiles'::regclass AND attnum > 0 AND NOT attisdropped LOOP
    IF has_column_privilege('authenticated', 'public.profiles', v_col, 'UPDATE') <> (v_col = ANY (v_safe_profiles)) THEN
      v_bad := v_bad || format(' [profiles.%s UPDATE privilege wrong]', v_col);
    END IF;
    IF has_column_privilege('authenticated', 'public.profiles', v_col, 'INSERT') <> (v_col = ANY (ARRAY['id','email','full_name','phone'])) THEN
      v_bad := v_bad || format(' [profiles.%s INSERT privilege wrong]', v_col);
    END IF;
  END LOOP;

  -- kyc_submissions: INSERT(user_id) only, no UPDATE anywhere
  IF has_any_column_privilege('authenticated', 'public.kyc_submissions', 'UPDATE') THEN
    v_bad := v_bad || ' [kyc_submissions has user UPDATE]'; END IF;
  FOR v_col IN SELECT attname FROM pg_attribute
               WHERE attrelid = 'public.kyc_submissions'::regclass AND attnum > 0 AND NOT attisdropped LOOP
    IF has_column_privilege('authenticated', 'public.kyc_submissions', v_col, 'INSERT') <> (v_col = 'user_id') THEN
      v_bad := v_bad || format(' [kyc_submissions.%s INSERT privilege wrong]', v_col);
    END IF;
  END LOOP;

  -- transfers / inward_transfers: no user write privilege of any kind
  IF has_any_column_privilege('authenticated', 'public.transfers', 'INSERT,UPDATE')
     OR has_any_column_privilege('authenticated', 'public.inward_transfers', 'INSERT,UPDATE') THEN
    v_bad := v_bad || ' [user column write on transfers/inward_transfers]'; END IF;

  -- policies: no user-facing write policy other than the two narrowed ones
  -- (service-role policies keyed on auth.role() = 'service_role' are allowed)
  SELECT v_bad || COALESCE(string_agg(format(' [unexpected write policy %s on %s]', policyname, tablename), ''), '')
    INTO v_bad
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('profiles','kyc_submissions','transfers','inward_transfers')
    AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
    AND roles <> ARRAY['service_role']::name[]
    AND COALESCE(qual, '') NOT LIKE '%auth.role() = ''service_role''%'
    AND policyname NOT IN ('profiles_update_own_safe','profiles_insert_own_safe','kyc_insert_own_unverified');

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles'
                 AND policyname='profiles_update_own_safe' AND with_check IS NOT NULL) THEN
    v_bad := v_bad || ' [profiles_update_own_safe missing WITH CHECK]'; END IF;

  IF has_function_privilege('anon', 'public.guard_server_only_columns()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.guard_server_only_columns()', 'EXECUTE') THEN
    v_bad := v_bad || ' [guard function executable by API roles]'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.kyc_submissions'::regclass
                 AND attname = 'verified_reset_at' AND NOT attisdropped)
     OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.kyc_submissions'::regclass
                 AND attname = 'verified_reset_reason' AND NOT attisdropped) THEN
    v_bad := v_bad || ' [kyc_submissions reset columns missing]'; END IF;

  IF v_bad <> '' THEN
    RAISE EXCEPTION '028 self-check failed:%', v_bad;
  END IF;
END
$$;

COMMIT;
