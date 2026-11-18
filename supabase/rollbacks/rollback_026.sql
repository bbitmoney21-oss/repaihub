-- Rollback for 026_rls_advisor_fixes.sql
-- WARNING: this restores the INSECURE pre-026 state (11 tables readable and
-- writable with the public anon key). Use only to unblock a production outage,
-- and re-apply 026 (or a corrected version) as soon as possible.
BEGIN;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fee_config','promo_codes','promo_code_uses','risk_rules',
                           'compliance_rules','document_requirements','risk_assessments',
                           'compliance_checks','audit_logs','customer_model_config',
                           'compliance_config'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'service_role_' || t, t);
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
    -- pre-026 grants were ALL (arwdDxtm) to anon and authenticated
    EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated', t);
  END LOOP;
END
$$;

-- pre-026 ACL: {=X/postgres, anon=X, authenticated=X, service_role=X}
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC, anon, authenticated;

ALTER FUNCTION public.set_updated_at() RESET search_path;

COMMIT;
