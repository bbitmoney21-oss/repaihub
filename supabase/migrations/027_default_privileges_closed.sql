-- ═══════════════════════════════════════════════════════════════════════════════
-- 027_default_privileges_closed.sql
-- REPAIHUB — new objects in schema public start CLOSED to anon/authenticated.
--
-- Live state (read-only pg_default_acl, mievzzzxpsomrzxhkecu, 17 Nov 2026):
--   FOR ROLE postgres       IN public: r=arwdDxtm, S=rwU, f=X  → anon, authenticated, service_role
--   FOR ROLE supabase_admin IN public: same grants             → anon, authenticated, service_role
--   No global (schema-less) entry for postgres ⇒ built-in default
--   "EXECUTE on functions TO PUBLIC" still applies to every new function.
--   postgres is NOT a member of supabase_admin (pg_has_role = false), so the
--   supabase_admin entry can only be changed by Supabase / a superuser.
--
-- After 027, any table/sequence/function a migration creates as postgres in
-- public is reachable only by its owner and service_role. A migration that
-- really wants browser access must GRANT it explicitly (and add RLS).
--
-- Does NOT change existing objects (026/028 handle those). Does not drop
-- anything; customer_model_config stays as 026 left it (service-role only).
-- Idempotent. DRAFT — not applied anywhere.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. postgres-created objects in public: remove anon/authenticated, keep service_role.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
-- keep (re-assert) service_role on new objects
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

-- 2. Functions: anon/authenticated inherit PUBLIC, and the built-in default
--    gives EXECUTE to PUBLIC. A per-schema REVOKE cannot remove a global
--    default, so this one must be schema-less. It applies to functions
--    postgres creates in ANY schema (see NOTES: RLS helper functions in
--    future migrations need an explicit GRANT EXECUTE TO authenticated).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- 3. supabase_admin-created objects: only possible if the applying role may
--    act for supabase_admin. On the live project it may not → NOTICE only.
DO $$
BEGIN
  BEGIN  -- needs the right to act as supabase_admin (not granted to postgres on hosted Supabase)
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated';
    RAISE NOTICE '027: supabase_admin default privileges in public also closed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '027: % may not change supabase_admin default privileges; supabase_admin defaults in public left unchanged (see NOTES Q1)', current_user;
  END;
END
$$;

-- 4. Self-check (postgres entries only; supabase_admin is best-effort).
DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(d.defaclobjtype::text || ':' || CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END || ':' || a.privilege_type, ', ')
    INTO bad
  FROM pg_default_acl d
  CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  WHERE d.defaclrole = 'postgres'::regrole
    AND (d.defaclnamespace = 'public'::regnamespace OR d.defaclnamespace = 0)
    AND (a.grantee IN ('anon'::regrole, 'authenticated'::regrole)
         OR (a.grantee = 0 AND d.defaclobjtype = 'f'));
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '027 self-check: postgres defaults still grant %', bad;
  END IF;

  -- the global entry must exist and must not contain PUBLIC EXECUTE
  IF NOT EXISTS (SELECT 1 FROM pg_default_acl
                 WHERE defaclrole = 'postgres'::regrole AND defaclnamespace = 0
                   AND defaclobjtype = 'f') THEN
    RAISE EXCEPTION '027 self-check: global postgres function default missing';
  END IF;

  -- service_role must still get tables, sequences, functions
  IF (SELECT count(*) FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
      WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 'public'::regnamespace
        AND a.grantee = 'service_role'::regrole
        AND (d.defaclobjtype, a.privilege_type) IN (('r','SELECT'),('r','INSERT'),('r','UPDATE'),('r','DELETE'),
                                                    ('S','USAGE'),('f','EXECUTE'))) <> 6 THEN
    RAISE EXCEPTION '027 self-check: service_role default grants missing';
  END IF;

  -- functional probe: objects created now (as the applying role) must be closed.
  -- Only meaningful when the applying role is postgres; dropped again below.
  IF current_user = 'postgres' THEN
    CREATE TABLE public.zz_027_probe (id bigserial PRIMARY KEY);
    CREATE FUNCTION public.zz_027_probe_fn() RETURNS int LANGUAGE sql AS 'select 1';
    IF has_table_privilege('anon', 'public.zz_027_probe', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_table_privilege('authenticated', 'public.zz_027_probe', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_sequence_privilege('anon', 'public.zz_027_probe_id_seq', 'USAGE,SELECT,UPDATE')
       OR has_sequence_privilege('authenticated', 'public.zz_027_probe_id_seq', 'USAGE,SELECT,UPDATE')
       OR has_function_privilege('anon', 'public.zz_027_probe_fn()', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.zz_027_probe_fn()', 'EXECUTE')
       OR NOT has_table_privilege('service_role', 'public.zz_027_probe', 'SELECT,INSERT,UPDATE,DELETE')
       OR NOT has_function_privilege('service_role', 'public.zz_027_probe_fn()', 'EXECUTE') THEN
      RAISE EXCEPTION '027 self-check: probe objects not closed / service_role missing';
    END IF;
    DROP FUNCTION public.zz_027_probe_fn();
    DROP TABLE public.zz_027_probe;
  END IF;
END
$$;

COMMIT;
