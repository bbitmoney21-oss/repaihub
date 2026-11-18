-- Read-only verification for 027 (SELECT only).

-- 1. Default ACLs. Expect for postgres/public: r, S, f contain only postgres
--    and service_role; a postgres/<all>/f row exists WITHOUT "=X" (PUBLIC).
--    supabase_admin/public rows: unchanged on live (postgres can't alter them).
SELECT defaclrole::regrole AS for_role,
       COALESCE(defaclnamespace::regnamespace::text, '<all schemas>') AS schema,
       defaclobjtype, defaclacl
FROM pg_default_acl
WHERE defaclrole IN ('postgres'::regrole, 'supabase_admin'::regrole)
  AND (defaclnamespace = 0 OR defaclnamespace = 'public'::regnamespace)
ORDER BY 1, 2, 3;

-- 2. Flattened: any default that still reaches anon/authenticated/PUBLIC.
--    Expect 0 rows for for_role = postgres.
SELECT d.defaclrole::regrole AS for_role,
       COALESCE(d.defaclnamespace::regnamespace::text, '<all schemas>') AS schema,
       d.defaclobjtype,
       CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END AS grantee,
       a.privilege_type
FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
WHERE (d.defaclnamespace = 0 OR d.defaclnamespace = 'public'::regnamespace)
  AND (a.grantee IN ('anon'::regrole, 'authenticated'::regrole) OR a.grantee = 0)
ORDER BY 1, 2, 3, 4, 5;

-- 3. 026 regression guard: customer_model_config still locked.
SELECT relname, relrowsecurity,
       has_table_privilege('anon', oid, 'SELECT') AS anon_select,
       has_table_privilege('authenticated', oid, 'SELECT') AS auth_select
FROM pg_class WHERE oid = to_regclass('public.customer_model_config');  -- expect t, f, f (0 rows if table absent)

-- 4. Functional probe (run in a scratch DB / local only, it creates objects):
-- BEGIN;
--   CREATE TABLE public.zz_probe(id int);  CREATE SEQUENCE public.zz_probe_seq;
--   CREATE FUNCTION public.zz_probe_fn() RETURNS int LANGUAGE sql AS 'select 1';
--   SELECT has_table_privilege('anon','public.zz_probe','SELECT'),        -- f
--          has_table_privilege('authenticated','public.zz_probe','INSERT'),-- f
--          has_table_privilege('service_role','public.zz_probe','SELECT'), -- t
--          has_sequence_privilege('anon','public.zz_probe_seq','USAGE'),   -- f
--          has_function_privilege('anon','public.zz_probe_fn()','EXECUTE'),-- f
--          has_function_privilege('authenticated','public.zz_probe_fn()','EXECUTE'), -- f
--          has_function_privilege('service_role','public.zz_probe_fn()','EXECUTE');  -- t
-- ROLLBACK;
