-- Rollback for 027: restores the pre-027 default privileges (new public objects
-- open to anon/authenticated again, PUBLIC EXECUTE on new functions).
BEGIN;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated;
-- restoring the built-in PUBLIC EXECUTE default removes the global entry
ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT EXECUTE ON FUNCTIONS TO PUBLIC;
DO $$
BEGIN
  BEGIN  -- needs the right to act as supabase_admin (not granted to postgres on hosted Supabase)
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'rollback_027: supabase_admin defaults not changeable by %, left as is', current_user;
  END;
END
$$;
COMMIT;
