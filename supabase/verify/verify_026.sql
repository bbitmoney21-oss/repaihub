-- Read-only verification for 026. Safe to run any time (SELECT only).

-- 1. RLS status + effective privileges for the 11 tables
--    Expect: rls = true, every anon_* / auth_* column = false.
SELECT c.relname                                              AS table_name,
       c.relrowsecurity                                       AS rls,
       has_table_privilege('anon',          c.oid, 'SELECT')  AS anon_select,
       has_table_privilege('anon',          c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE') AS anon_write,
       has_table_privilege('authenticated', c.oid, 'SELECT')  AS auth_select,
       has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE') AS auth_write,
       has_table_privilege('service_role',  c.oid, 'SELECT,INSERT,UPDATE,DELETE')   AS service_rw
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('fee_config','promo_codes','promo_code_uses','risk_rules',
                    'compliance_rules','document_requirements','risk_assessments',
                    'compliance_checks','audit_logs','customer_model_config',
                    'compliance_config')
ORDER BY 1;

-- 2. Policies on the 11 tables. Expect exactly 11 rows, one
--    service_role_<table> per table, roles = {service_role}, cmd = ALL.
SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('fee_config','promo_codes','promo_code_uses','risk_rules',
                    'compliance_rules','document_requirements','risk_assessments',
                    'compliance_checks','audit_logs','customer_model_config',
                    'compliance_config')
ORDER BY tablename, policyname;

-- 3. Any public table still without RLS. Expect 0 rows.
SELECT c.relname
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity;

-- 4. Function privileges / config.
--    Expect: anon_exec = false, auth_exec = false, public_exec = false,
--            service_exec = true, prosecdef = true for handle_new_user;
--            set_updated_at proconfig = {search_path=""}.
SELECT p.oid::regprocedure                                       AS fn,
       p.prosecdef,
       p.proconfig,
       p.proacl,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
       has_function_privilege('service_role',  p.oid, 'EXECUTE') AS service_exec,
       CASE WHEN p.proacl IS NULL THEN true   -- NULL ACL = default = PUBLIC can execute
            ELSE EXISTS (SELECT 1 FROM aclexplode(p.proacl) a
                         WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')
       END                                                       AS public_exec
FROM pg_proc p
WHERE p.oid IN ('public.handle_new_user()'::regprocedure,
                'public.set_updated_at()'::regprocedure);

-- 5. Triggers still wired. Expect 3 rows, all enabled ('O').
SELECT tgname, tgrelid::regclass, tgfoid::regprocedure, tgenabled
FROM pg_trigger
WHERE NOT tgisinternal
  AND tgfoid IN ('public.handle_new_user()'::regprocedure,
                 'public.set_updated_at()'::regprocedure);

-- 6. Seed rows still present (service-role / SQL editor view). Expect the
--    counts from the rebuild report: fee_config 10, promo_codes 5,
--    risk_rules 19, compliance_rules 4, document_requirements 17,
--    customer_model_config 5, compliance_config 11.
SELECT 'fee_config' t, count(*) FROM public.fee_config
UNION ALL SELECT 'promo_codes', count(*) FROM public.promo_codes
UNION ALL SELECT 'risk_rules', count(*) FROM public.risk_rules
UNION ALL SELECT 'compliance_rules', count(*) FROM public.compliance_rules
UNION ALL SELECT 'document_requirements', count(*) FROM public.document_requirements
UNION ALL SELECT 'customer_model_config', count(*) FROM public.customer_model_config
UNION ALL SELECT 'compliance_config', count(*) FROM public.compliance_config;
