-- Rollback for 029: restores the exact pre-029 policies, grants and triggers
-- (as read from mievzzzxpsomrzxhkecu on 17 Nov 2026, with 028 applied on top).
-- WARNING: re-opens user inserts on transfer_events / bank accounts, full user
-- control of inward_recipients, and client SELECT of password_hash / PAN.
BEGIN;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transfer_events','canada_bank_accounts','india_nro_accounts','inward_recipients'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS guard_server_only_columns ON public.%I', t);
    -- pre-029 grants: ALL (arwdDxtm) to anon and authenticated
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated', t);
  END LOOP;
END
$$;

DROP POLICY IF EXISTS "users_select_own_recipients"    ON public.inward_recipients;
DROP POLICY IF EXISTS "service_role_inward_recipients" ON public.inward_recipients;

-- pre-029 policies (exact quals from live pg_policies)
DROP POLICY IF EXISTS "events_insert_own" ON public.transfer_events;
CREATE POLICY "events_insert_own" ON public.transfer_events FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "canada_bank_insert_own" ON public.canada_bank_accounts;
CREATE POLICY "canada_bank_insert_own" ON public.canada_bank_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "india_nro_insert_own" ON public.india_nro_accounts;
CREATE POLICY "india_nro_insert_own" ON public.india_nro_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "users_own_recipients" ON public.inward_recipients;
CREATE POLICY "users_own_recipients" ON public.inward_recipients FOR ALL TO authenticated USING (user_id = auth.uid());

-- profiles: back to table-level SELECT for authenticated (028 state).
-- REVOKE at table level also clears the column-level grants.
REVOKE SELECT ON TABLE public.profiles FROM authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;

COMMIT;
