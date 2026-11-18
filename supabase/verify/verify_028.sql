-- Read-only verification for 028 (SELECT only).

-- 1. Table-level privileges. Expect anon all false; authenticated select=true,
--    write=false; service_role rw=true.
SELECT t AS table_name,
       has_table_privilege('anon', 'public.'||t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS anon_any,
       has_table_privilege('authenticated', 'public.'||t, 'SELECT')                     AS auth_select,
       has_table_privilege('authenticated', 'public.'||t, 'INSERT,UPDATE,DELETE,TRUNCATE') AS auth_table_write,
       has_any_column_privilege('authenticated', 'public.'||t, 'INSERT')                AS auth_any_col_insert,
       has_any_column_privilege('authenticated', 'public.'||t, 'UPDATE')                AS auth_any_col_update,
       has_table_privilege('service_role', 'public.'||t, 'SELECT,INSERT,UPDATE,DELETE') AS service_rw
FROM unnest(ARRAY['profiles','kyc_submissions','transfers','inward_transfers']) t;
-- expected: profiles col_insert=t col_update=t; kyc_submissions col_insert=t col_update=f;
--           transfers / inward_transfers col_insert=f col_update=f.

-- 2. Columns authenticated may write. Expect exactly:
--    profiles UPDATE: full_name, phone, updated_at
--    profiles INSERT: id, email, full_name, phone
--    kyc_submissions INSERT: user_id
SELECT c.relname AS table_name, a.attname AS column_name,
       has_column_privilege('authenticated', c.oid, a.attnum, 'INSERT') AS can_insert,
       has_column_privilege('authenticated', c.oid, a.attnum, 'UPDATE') AS can_update
FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN ('profiles','kyc_submissions','transfers','inward_transfers')
  AND (has_column_privilege('authenticated', c.oid, a.attnum, 'INSERT')
       OR has_column_privilege('authenticated', c.oid, a.attnum, 'UPDATE'))
ORDER BY 1, 2;

-- 3. Protected columns are NOT user-updatable (expect every row false).
SELECT col, has_column_privilege('authenticated', 'public.profiles', col, 'UPDATE') AS user_can_update
FROM unnest(ARRAY['kycStatus','canadaVerified','indiaVerified','kycVerifiedAt','kycExpiresAt',
                  'signup_complete','status','residency_type','email','password_hash',
                  'locked_until','failed_login_attempts','pan_number']) col
UNION ALL
SELECT 'kyc_submissions.'||col, has_column_privilege('authenticated', 'public.kyc_submissions', col, 'UPDATE')
FROM unnest(ARRAY['canada_verified','india_verified','canada_verified_at','india_verified_at']) col
UNION ALL
SELECT 'transfers.'||col, has_column_privilege('authenticated', 'public.transfers', col, 'INSERT,UPDATE')
FROM unnest(ARRAY['status','compliance_status','ca_status','fifteen_ca_number','fifteen_cb_number']) col;

-- 4. Policies on the 4 tables (expect no user INSERT/UPDATE/DELETE/ALL policy
--    except profiles_update_own_safe, profiles_insert_own_safe,
--    kyc_insert_own_unverified, each with a WITH CHECK).
SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles','kyc_submissions','transfers','inward_transfers')
ORDER BY tablename, cmd, policyname;

-- 5. Guard triggers (expect 4, enabled 'O') and function config.
SELECT tgrelid::regclass AS table_name, tgname, tgenabled,
       pg_get_triggerdef(oid) AS definition
FROM pg_trigger WHERE tgname = 'guard_server_only_columns' ORDER BY 1;

SELECT p.oid::regprocedure, p.prosecdef, p.proconfig,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec
FROM pg_proc p WHERE p.oid = 'public.guard_server_only_columns()'::regprocedure;

-- 6. One-time reset of self-attested kyc_submissions flags (028 section 2b).
--    Expect: both columns exist; reset rows have both flags false and a reason
--    with the prior values; authenticated cannot write either column.
SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS type,
       has_column_privilege('authenticated', a.attrelid, a.attnum, 'INSERT') AS auth_insert,
       has_column_privilege('authenticated', a.attrelid, a.attnum, 'UPDATE') AS auth_update
FROM pg_attribute a
WHERE a.attrelid = 'public.kyc_submissions'::regclass
  AND a.attname IN ('verified_reset_at', 'verified_reset_reason') AND NOT a.attisdropped;

SELECT count(*)                                                    AS total_rows,
       count(*) FILTER (WHERE verified_reset_at IS NOT NULL)       AS reset_rows,
       count(*) FILTER (WHERE verified_reset_at IS NOT NULL
                          AND (canada_verified OR india_verified)) AS reset_rows_reverified_since,
       min(verified_reset_at)                                      AS first_reset_at
FROM public.kyc_submissions;
