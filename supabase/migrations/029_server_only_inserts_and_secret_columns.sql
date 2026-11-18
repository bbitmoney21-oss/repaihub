-- ═══════════════════════════════════════════════════════════════════════════════
-- 029_server_only_inserts_and_secret_columns.sql
-- REPAIHUB — follow-up to 028 (same shape of gap, other tables).
--
--   1. transfer_events, canada_bank_accounts, india_nro_accounts,
--      inward_recipients: inserts (and any other write) become service-role
--      only. Users keep SELECT on their own rows.
--        live policies dropped: events_insert_own, canada_bank_insert_own,
--        india_nro_insert_own, users_own_recipients (FOR ALL → users could also
--        set is_verified / transfer_count and delete recipients).
--   2. profiles: authenticated can no longer SELECT the secret columns
--      password_hash, pan_number, pan_hash, reset_token_hash (column-level
--      SELECT on every other column). anon already has nothing (028).
--
-- Code evidence (GitHub main 80eb2ce == origin/dev): every read/write of these
-- tables is server-side with supabaseAdmin (service role):
--   transfer_events   insert: src/routes/transfers.ts:658, :1105,
--                             src/orchestrator/outwardOrchestrator.ts:261
--   canada_bank_accounts      insert src/routes/users.ts:210; reads auth.ts:374,
--                             :553, users.ts:35, outwardOrchestrator.ts:169, data/store.ts:144
--   india_nro_accounts        insert users.ts:246; reads auth.ts:376, :555,
--                             users.ts:37, transfers.ts:270, data/store.ts:143
--   inward_recipients         src/routes/inwardTransfers.ts:129, :166, :287
--   profiles secret columns   auth.ts:107, 299-345, 442-443, 510-530 (password /
--                             reset), transfers.ts:500 (pan_number),
--                             kycService.ts:228 (pan_hash)
-- The browser's Supabase client (src/lib/supabase.ts) is only used for
-- supabase.auth.* (src/pages/auth/ResetPassword.tsx:19,34).
--
-- Side effect (documented in NOTES): `select *` on profiles by an authenticated
-- JWT (e.g. PostgREST ?select=*) now fails with 42501; list columns instead.
-- No code path does that today.
--
-- Requires 028 (re-uses public.guard_server_only_columns()).
-- Transactional, idempotent, self-checking. DRAFT — not applied anywhere.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.guard_server_only_columns()') IS NULL THEN
    RAISE EXCEPTION '029 requires 028 (public.guard_server_only_columns() missing)';
  END IF;
END
$$;

-- ── 1. Server-only writes on the four user-adjacent tables ───────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transfer_events','canada_bank_accounts','india_nro_accounts','inward_recipients'] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
    EXECUTE format('DROP TRIGGER IF EXISTS guard_server_only_columns ON public.%I', t);
    EXECUTE format('CREATE TRIGGER guard_server_only_columns BEFORE INSERT OR UPDATE OR DELETE ON public.%I '
                   'FOR EACH ROW EXECUTE FUNCTION public.guard_server_only_columns()', t);
  END LOOP;
END
$$;

DROP POLICY IF EXISTS "events_insert_own"      ON public.transfer_events;
DROP POLICY IF EXISTS "canada_bank_insert_own" ON public.canada_bank_accounts;
DROP POLICY IF EXISTS "india_nro_insert_own"   ON public.india_nro_accounts;

-- inward_recipients: FOR ALL own → SELECT own only (+ explicit service_role policy)
DROP POLICY IF EXISTS "users_own_recipients"            ON public.inward_recipients;
DROP POLICY IF EXISTS "users_select_own_recipients"     ON public.inward_recipients;
CREATE POLICY "users_select_own_recipients" ON public.inward_recipients
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "service_role_inward_recipients"  ON public.inward_recipients;
CREATE POLICY "service_role_inward_recipients" ON public.inward_recipients
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 2. profiles: no client SELECT on secret columns ──────────────────────────
-- Table-level SELECT must go (a column REVOKE can't override a table GRANT);
-- then SELECT is granted on every column except the secret ones. New columns
-- added later are NOT readable by authenticated until granted (fail closed).
REVOKE SELECT ON TABLE public.profiles FROM anon, authenticated;
DO $$
DECLARE
  v_cols text;
BEGIN
  -- also clear any column-level SELECT on the secret columns (re-run safety)
  EXECUTE 'REVOKE SELECT (password_hash, pan_number, pan_hash, reset_token_hash) ON TABLE public.profiles FROM anon, authenticated';

  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO v_cols
  FROM pg_attribute
  WHERE attrelid = 'public.profiles'::regclass AND attnum > 0 AND NOT attisdropped
    AND attname NOT IN ('password_hash', 'pan_number', 'pan_hash', 'reset_token_hash');
  EXECUTE format('GRANT SELECT (%s) ON TABLE public.profiles TO authenticated', v_cols);
END
$$;

-- ── 3. Self-check ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_bad text := '';
  t text;
  v_col text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transfer_events','canada_bank_accounts','india_nro_accounts','inward_recipients'] LOOP
    IF has_table_privilege('anon', format('public.%I', t), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_any_column_privilege('anon', format('public.%I', t), 'SELECT,INSERT,UPDATE,REFERENCES') THEN
      v_bad := v_bad || format(' [anon has privileges on %s]', t); END IF;
    IF has_table_privilege('authenticated', format('public.%I', t), 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_any_column_privilege('authenticated', format('public.%I', t), 'INSERT,UPDATE') THEN
      v_bad := v_bad || format(' [authenticated can write %s]', t); END IF;
    IF NOT has_table_privilege('authenticated', format('public.%I', t), 'SELECT') THEN
      v_bad := v_bad || format(' [authenticated lost SELECT on %s]', t); END IF;
    IF NOT has_table_privilege('service_role', format('public.%I', t), 'SELECT,INSERT,UPDATE,DELETE') THEN
      v_bad := v_bad || format(' [service_role lost access to %s]', t); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = format('public.%I', t)::regclass
                   AND tgname = 'guard_server_only_columns' AND tgenabled = 'O') THEN
      v_bad := v_bad || format(' [guard trigger missing on %s]', t); END IF;
  END LOOP;

  SELECT v_bad || COALESCE(string_agg(format(' [user write policy %s on %s]', policyname, tablename), ''), '')
    INTO v_bad
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('transfer_events','canada_bank_accounts','india_nro_accounts','inward_recipients')
    AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
    AND roles <> ARRAY['service_role']::name[]
    AND COALESCE(qual, '') NOT LIKE '%auth.role() = ''service_role''%';

  FOR v_col IN SELECT attname FROM pg_attribute
               WHERE attrelid = 'public.profiles'::regclass AND attnum > 0 AND NOT attisdropped LOOP
    IF has_column_privilege('authenticated', 'public.profiles', v_col, 'SELECT')
       = (v_col IN ('password_hash','pan_number','pan_hash','reset_token_hash')) THEN
      v_bad := v_bad || format(' [profiles.%s SELECT privilege wrong]', v_col); END IF;
    IF has_column_privilege('anon', 'public.profiles', v_col, 'SELECT') THEN
      v_bad := v_bad || format(' [anon can select profiles.%s]', v_col); END IF;
  END LOOP;
  IF has_table_privilege('authenticated', 'public.profiles', 'SELECT') THEN
    v_bad := v_bad || ' [authenticated still has table-level SELECT on profiles]'; END IF;
  IF NOT has_column_privilege('service_role', 'public.profiles', 'password_hash', 'SELECT,UPDATE') THEN
    v_bad := v_bad || ' [service_role lost password_hash]'; END IF;

  IF v_bad <> '' THEN
    RAISE EXCEPTION '029 self-check failed:%', v_bad;
  END IF;
END
$$;

COMMIT;
