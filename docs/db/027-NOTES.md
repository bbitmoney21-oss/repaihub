# Migration 027: default privileges closed (DRAFT, NOT APPLIED)

Target: `mievzzzxpsomrzxhkecu`. Nothing here was run against any Supabase project. The live state was read only through read-only `pg_default_acl` and `pg_has_role` queries.

| File | Purpose |
|---|---|
| `027_default_privileges_closed.sql` | The migration. Runs in a transaction, is idempotent, and ends with a catalog self-check and a probe that creates and drops a throwaway table and function. |
| `rollback_027.sql` | Restores the Supabase defaults that were in place before 027. |
| `verify_027.sql` | Read-only checks. |
| `test_027_realpg.sh` | Test on a disposable Supabase-like PG 17 cluster (port 54339, `/tmp/pg028`) running the REPAIHUB 000–026 schema. |
| `../repaihub-migration-028/pglite/run_pglite_tests.mjs` | PGlite test covering both 027 and 028. Log: `test-logs/pglite_027_028.log`. |

## Live default ACLs, read on 17 Nov 2026

- **FOR ROLE `postgres` IN SCHEMA public:** tables `arwdDxtm`, sequences `rwU` and functions `X` go to anon, authenticated, service_role and postgres.
- **FOR ROLE `supabase_admin` IN SCHEMA public:** the same grants.
- **PostgreSQL's built-in global default:** EXECUTE on new functions goes to PUBLIC. anon and authenticated inherit from PUBLIC.
- **Roles:** `pg_has_role('postgres','supabase_admin','MEMBER') = false`. postgres is not a superuser but has BYPASSRLS.

## What 027 changes

1. For role `postgres` in schema public, `REVOKE ALL` on tables, sequences and functions from anon and authenticated.
2. For role `postgres`, `REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`. This one is global. PostgreSQL doesn't let a per-schema entry take away a global grant, so this is the only way to close new functions.
3. service_role's defaults are re-stated (`GRANT ALL` on tables and sequences, `EXECUTE` on functions). postgres keeps owner rights.
4. `supabase_admin` defaults are changed only if the role running the migration is allowed to. The attempt is wrapped in `EXCEPTION WHEN insufficient_privilege`, so otherwise the migration raises a NOTICE and leaves them alone. That is expected on hosted Supabase (see Q1). An earlier draft gated this on `pg_has_role(..., 'MEMBER')`. On the local PG 17 cluster that returned true, yet `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin` still failed with "permission denied" and aborted the whole migration. The exception handler fixes that.
5. Existing objects are not changed.

## Effect on future migrations (intended: closed by default)

- A new user-facing table needs explicit grants to `authenticated` (or `anon`) as well as RLS and policies.
- A new function that a policy calls, or that is exposed through `/rpc`, needs `GRANT EXECUTE ... TO authenticated`.
- Trigger functions don't need EXECUTE grants, because Postgres checks EXECUTE only when the trigger is created.
- Functions that postgres creates in other schemas are also no longer executable by PUBLIC. That's a side effect of item 2. Grant them explicitly, for example to `supabase_auth_admin` for auth hooks, which Supabase requires anyway.

## Test results

**Real PG 17, Supabase-like cluster (`test-logs/027_realpg.log`):**
- Before 027, a new table, sequence and function were open to anon and authenticated (the problem reproduced).
- After 027, applied twice: anon and authenticated had no access to any of the three; service_role had full access. The new table's `relacl` was `{postgres=…, service_role=…}`.
- Existing 026 tables were unchanged.
- The rollback brought `pg_default_acl` back byte-for-byte to the pre-027 state, and new objects were open again.
- Re-applying after the rollback worked.
- Hosted-like run, where the migration can't change `supabase_admin` defaults: it applied with the NOTICE, and postgres-created objects were closed.
- Negative test: the self-check aborts if anon is put back into a default (`ERROR: 027 self-check: postgres defaults still grant r:anon:SELECT`).
- The self-check also creates a throwaway table (with a bigserial sequence) and function, asserts that anon and authenticated have no access while service_role does, then drops them.
- A table created by `supabase_admin` is still open, as expected (Q1).

**PGlite (`test-logs/pglite_027_028.log`):** 13 of 13 checks for 027 passed. These include "new table has NO anon/authenticated grants" and "anon SELECT on new table refused (permission denied)". The full PGlite run for 027 and 028 together passed 95 of 95.

## Open questions

- **Q1.** On the live project, `supabase_admin`'s defaults in public can't be changed from a migration. Objects created by `supabase_admin` (platform actions, and possibly some dashboard tools) would still be open. To check: confirm which role the dashboard Table Editor uses to create tables. Today every public table is owned by `postgres`. If needed, Supabase support can change it, or the project can rely on 026-style checks (an advisor run after every migration) to catch anything left open.
- **Q2.** The global PUBLIC EXECUTE revoke (item 2) also covers postgres-created functions outside public. OK to keep? The alternative is to leave PUBLIC alone and accept that new public functions start executable, which fails the "start closed" goal for functions.
- **Q3.** The file has its own `BEGIN`/`COMMIT`. Remove them if the tool applying it already wraps each migration in a transaction (same as 026 D1).
- `customer_model_config`: 027 doesn't touch it. It stays locked by 026 (RLS, a service_role-only policy, no anon or authenticated grants) and is not dropped.
