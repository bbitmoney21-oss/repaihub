-- ═══════════════════════════════════════════════════════════════════════════════
-- 026_rls_advisor_fixes.sql
-- REPAIHUB — close the Supabase security-advisor gaps found after the
-- 17 Nov 2026 rebuild of project mievzzzxpsomrzxhkecu.
--
--   1. ERROR rls_disabled_in_public (0013)  → enable RLS on 11 public tables
--   2. WARN  0028 / 0029                    → revoke EXECUTE on handle_new_user()
--   3. WARN  function_search_path_mutable    → pin search_path on set_updated_at()
--
-- Access model (matches 013/017): the browser uses the anon key and is gated by
-- RLS; the API server uses the service-role key (BYPASSRLS). A grep of the web
-- code (src/pages, src/components, src/store, src/lib/supabase.ts, built dist/)
-- found NO anon/user-client reads of any of these 11 tables — the frontend only
-- uses supabase.auth.* (ResetPassword.tsx). Every read/write goes through
-- supabaseAdmin on the server. So all 11 tables are service-role only:
-- no anon/authenticated policy of any kind (fail closed).
--
-- Idempotent: safe to run more than once. DRAFT — not applied anywhere.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. RLS on the 11 exposed tables ──────────────────────────────────────────
-- For each table:
--   • ENABLE ROW LEVEL SECURITY  (no anon/authenticated policy ⇒ deny all)
--   • explicit service_role policy, same convention as kyc_config /
--     risk_config / payment_rails_config (service_role bypasses RLS anyway;
--     the policy documents intent and avoids the rls_enabled_no_policy lint)
--   • REVOKE ALL table privileges from anon/authenticated (defence in depth:
--     RLS does not govern TRUNCATE/REFERENCES/TRIGGER, and a later accidental
--     permissive policy would otherwise expose the table)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    -- config tables (read only by the server via supabaseAdmin)
    'fee_config',
    'promo_codes',
    'document_requirements',
    'customer_model_config',
    'compliance_config',
    'risk_rules',
    'compliance_rules',
    -- per-user usage rows (written/read only by feeService via supabaseAdmin)
    'promo_code_uses',
    -- audit / compliance (service-role only by policy)
    'audit_logs',
    'risk_assessments',
    'compliance_checks'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE EXCEPTION '026: expected table public.% does not exist', t;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'service_role_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true)',
      'service_role_' || t, t);

    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
  END LOOP;
END
$$;

-- ── 2. handle_new_user(): not callable through the Data API ─────────────────
-- Signature on the live project: public.handle_new_user() RETURNS trigger,
-- SECURITY DEFINER, owner postgres, search_path=public.
-- Trigger functions do not need EXECUTE by the role that fires the trigger
-- (Postgres checks EXECUTE only at CREATE TRIGGER time), so the
-- on_auth_user_created trigger on auth.users keeps working. service_role and
-- the owner keep EXECUTE.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ── 3. set_updated_at(): pin search_path ─────────────────────────────────────
-- Body is only `new.updated_at = now(); return new;`. now() lives in
-- pg_catalog, which is always searched implicitly, so an empty search_path
-- is safe and the strictest option. Used by transfers_set_updated_at and
-- compliance_requests_set_updated_at.
ALTER FUNCTION public.set_updated_at() SET search_path = '';

-- ── 4. Self-check: abort the whole migration if anything is not as intended ─
DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(c.relname, ', ') INTO bad
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('fee_config','promo_codes','promo_code_uses','risk_rules',
                      'compliance_rules','document_requirements','risk_assessments',
                      'compliance_checks','audit_logs','customer_model_config',
                      'compliance_config')
    AND (NOT c.relrowsecurity
         OR has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
         OR has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE'));
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '026 self-check failed for: %', bad;
  END IF;

  SELECT string_agg(policyname || ' on ' || tablename, ', ') INTO bad
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('fee_config','promo_codes','promo_code_uses','risk_rules',
                      'compliance_rules','document_requirements','risk_assessments',
                      'compliance_checks','audit_logs','customer_model_config',
                      'compliance_config')
    AND roles <> ARRAY['service_role']::name[];
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '026 self-check: unexpected non-service_role policies: %', bad;
  END IF;

  IF has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE') THEN
    RAISE EXCEPTION '026 self-check: handle_new_user() still executable by anon/authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = 'public.set_updated_at()'::regprocedure
      AND proconfig @> ARRAY['search_path=""']
  ) THEN
    RAISE EXCEPTION '026 self-check: set_updated_at() search_path not pinned';
  END IF;
END
$$;

COMMIT;
