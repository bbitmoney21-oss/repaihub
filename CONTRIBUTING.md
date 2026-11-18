# Contributing to REPAIHUB

## Database changes

**Every schema change goes through a numbered migration file in this repo. Never use the Supabase dashboard's Table Editor or ad-hoc SQL Editor DDL.**

### Why
- **Tables created in the dashboard are owned by `supabase_admin`.** The default privileges for `supabase_admin` in `public` grant `SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER` to `anon` and `authenticated`.
  - The project's own migrations can't change that. `postgres` isn't a member of `supabase_admin`, which is why migration 027 can only close the `postgres` defaults.
  - So a dashboard-created table is **open to the public anon key** until someone notices and adds RLS and revokes.
- Dashboard changes don't show up in review, can't be rolled back, and make `dev` and `prod` drift apart.

### Rules
1. **One file per change** in `supabase/migrations/`, named `NNN_short_description.sql`.
   - `NNN` is the next free three-digit number on `dev`. Check `ls supabase/migrations` after pulling, and renumber at merge if someone else took the number first.
   - Never edit a migration that has already been applied to a shared project. Write a new one.
2. Every migration must:
   - run in a single transaction (`BEGIN; … COMMIT;`)
   - be **idempotent**, so running it twice is harmless (`IF NOT EXISTS`, `DROP POLICY IF EXISTS` then `CREATE POLICY`, guarded `DO` blocks)
   - end with a **self-check** `DO` block that raises an exception (and so rolls everything back) if the intended end state isn't reached
3. **New tables:**
   - `ENABLE ROW LEVEL SECURITY` in the same migration
   - explicit `GRANT`s, because migration 027 means new objects get **no** client grants by default
   - policies written `TO authenticated` (never `TO public` for write paths), using `(select auth.uid())`
   - columns the client must not set (verification flags, status, money, secrets) are server-only (see 028 and 029)
4. **New functions:**
   - `SET search_path = ''` with schema-qualified names
   - `SECURITY DEFINER` only when necessary
   - `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` unless clients must call it
5. **Add `profiles` columns with care:** after 029, `authenticated` reads `profiles` through column grants. A new column is not client-readable until the migration grants `SELECT (col)`. Don't grant it for secrets.
6. Each migration ships with:
   - `supabase/rollbacks/rollback_NNN.sql`, which restores the exact previous state
   - `supabase/verify/verify_NNN.sql`, read-only checks
   - a notes file in `docs/db/NNN-NOTES.md` (what, why, code evidence, tests)
7. **Test locally before any shared project:** apply, re-apply, rollback and re-apply on a local Postgres 17 (Supabase-like roles) or PGlite, and confirm the server's `service_role` paths still work.
8. **Applying to Supabase** (dev first, then prod) is done by the owner, following the migration's notes, after review. Run `verify_NNN.sql` and the Supabase security advisors afterwards.

### Emergency dashboard edits
If something had to be changed in the dashboard, write the equivalent migration the same day and check:
- `select tableowner from pg_tables where schemaname='public'`
- `select * from pg_default_acl`
- advisors

Any table owned by `supabase_admin` must be fixed (RLS and revokes) by a migration.
