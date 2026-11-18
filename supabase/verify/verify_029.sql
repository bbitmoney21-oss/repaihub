-- Read-only verification for 029 (SELECT only).

-- 1. The four tables. Expect anon_any=f, auth_select=t, auth_write=f,
--    service_rw=t, guard=t.
SELECT t AS table_name,
       has_table_privilege('anon', 'public.'||t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')   AS anon_any,
       has_table_privilege('authenticated', 'public.'||t, 'SELECT')                       AS auth_select,
       has_table_privilege('authenticated', 'public.'||t, 'INSERT,UPDATE,DELETE,TRUNCATE')
         OR has_any_column_privilege('authenticated', 'public.'||t, 'INSERT,UPDATE')      AS auth_write,
       has_table_privilege('service_role', 'public.'||t, 'SELECT,INSERT,UPDATE,DELETE')   AS service_rw,
       EXISTS (SELECT 1 FROM pg_trigger g WHERE g.tgrelid = ('public.'||t)::regclass
               AND g.tgname = 'guard_server_only_columns' AND g.tgenabled = 'O')          AS guard
FROM unnest(ARRAY['transfer_events','canada_bank_accounts','india_nro_accounts','inward_recipients']) t;

-- 2. Policies on the four tables. Expect: no INSERT/UPDATE/DELETE/ALL policy
--    for users; inward_recipients has users_select_own_recipients (SELECT) and
--    service_role_inward_recipients.
SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('transfer_events','canada_bank_accounts','india_nro_accounts','inward_recipients')
ORDER BY tablename, cmd, policyname;

-- 3. profiles secret columns. Expect auth_select=f and anon_select=f for the
--    four secret columns, service_select=t.
SELECT col,
       has_column_privilege('anon',          'public.profiles', col, 'SELECT') AS anon_select,
       has_column_privilege('authenticated', 'public.profiles', col, 'SELECT') AS auth_select,
       has_column_privilege('service_role',  'public.profiles', col, 'SELECT') AS service_select
FROM unnest(ARRAY['password_hash','pan_number','pan_hash','reset_token_hash','id','email','full_name','kycStatus']) col;

-- 4. Expect auth_table_select = f (column-level grants only).
SELECT has_table_privilege('authenticated', 'public.profiles', 'SELECT') AS auth_table_select,
       (SELECT count(*) FROM pg_attribute a
         WHERE a.attrelid = 'public.profiles'::regclass AND a.attnum > 0 AND NOT a.attisdropped
           AND has_column_privilege('authenticated', a.attrelid, a.attnum, 'SELECT')) AS auth_readable_columns,
       (SELECT count(*) FROM pg_attribute a
         WHERE a.attrelid = 'public.profiles'::regclass AND a.attnum > 0 AND NOT a.attisdropped) AS total_columns;
