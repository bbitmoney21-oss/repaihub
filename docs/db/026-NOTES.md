# Migration 026: RLS and advisor fixes (DRAFT, NOT APPLIED)

Target: Supabase project `mievzzzxpsomrzxhkecu` (REPAIHUB, rebuilt 17 Nov 2026).
Status: draft only. Nothing in this folder has been run against any Supabase project. The only things run against the project were read-only catalog queries and `get_advisors`.

| File | Purpose |
|---|---|
| `026_rls_advisor_fixes.sql` | The migration. Idempotent, runs in one transaction, and ends with a self-check that aborts on any mismatch. |
| `rollback_026.sql` | Puts back the exact state before 026. That state is insecure, so use it only for an outage. |
| `verify_026.sql` | Read-only SELECTs for Testing. |
| `local_pglite_test.mjs` | Local test in a throwaway PGlite database (PG 17) that mocks the roles and tables. It passed 57 of 57 checks. |

## 1. Per-table decisions

**The frontend never reads any of the 11 tables through Supabase.** The only browser Supabase client is `src/lib/supabase.ts`. Its single importer is `src/pages/auth/ResetPassword.tsx`, which uses `supabase.auth.onAuthStateChange` (line 19) and `supabase.auth.updateUser` (line 34). Nothing calls `supabase.from(...)` or `.rpc(...)` in `src/pages`, `src/components`, `src/store` or `src/lib`. The built bundle `repaihub-src/dist` has no reference to these table names. The same holds for GitHub `dev`, `/workspace/repaihub-src` and `/workspace/rh`. The browser gets fees through the API (`src/lib/api.ts:322` calls `/fees/tiers`, `src/routes/fees.ts:17`, which calls `feeService`, which uses `supabaseAdmin`).

The server's anon client (`src/lib/supabaseClient.ts`) is used only for `supabase.auth.signInWithPassword` in `src/routes/auth.ts:277`, never for these tables. Every access below goes through `supabaseAdmin` (the service-role key, which has BYPASSRLS).

| Table | Code access (all via `supabaseAdmin`) | Decision |
|---|---|---|
| fee_config | `src/services/feeService.ts:47` read; `src/routes/admin.ts:22,43` admin read/update | Service role only |
| promo_codes | `feeService.ts:350,420` read, `:432` update; `admin.ts:108,131,169` | Service role only |
| promo_code_uses (has `user_id`) | `feeService.ts:371` count, `:426` insert | Service role only. No frontend "my promo uses" read exists. |
| risk_rules | `admin.ts:65,86` | Service role only |
| compliance_rules | `src/services/complianceService.ts:34` | Service role only |
| document_requirements | `complianceService.ts:51` | Service role only |
| customer_model_config | **No code reference at all** | Service role only (see question Q2) |
| compliance_config | `src/services/complianceConfigService.ts:39` | Service role only |
| audit_logs | `src/services/auditService.ts:15` insert; `admin.ts:207` read | Service role only (as required) |
| risk_assessments | `src/services/riskService.ts:301` insert | Service role only (as required) |
| compliance_checks | `complianceService.ts:160` insert | Service role only (as required) |

So **no table gets an anon or authenticated policy**. For each table the migration:
- runs `ENABLE ROW LEVEL SECURITY`
- adds an explicit `service_role_<table>` policy, `FOR ALL TO service_role USING (true) WITH CHECK (true)`. This is the same convention as `kyc_config` and `risk_config` on the live project. It documents the intent and avoids the `rls_enabled_no_policy` INFO lint.
- runs `REVOKE ALL ... FROM anon, authenticated` as defence in depth. RLS doesn't cover TRUNCATE, REFERENCES or TRIGGER, and anon and authenticated currently hold `arwdDxtm`.

No SQL function, view or trigger in the live project or in migrations 000–025 touches these tables. The only public functions are `handle_new_user` and `set_updated_at`. Foreign-key cascades (for example `risk_assessments` from `transfers`, which `devTools.ts:67` relies on) aren't subject to RLS.

## 2. Function changes

- **`public.handle_new_user()`**: the live signature has no arguments, `RETURNS trigger`, `SECURITY DEFINER`, owner `postgres`, `search_path=public`. Its ACL before 026 was `{=X, postgres=X, anon=X, authenticated=X, service_role=X}`.
  - Change: `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated`. `postgres` and `service_role` keep EXECUTE.
  - The signup trigger still works because Postgres checks EXECUTE on a trigger function only at `CREATE TRIGGER` time, not when the trigger fires. The function also runs as its owner.
  - Tested locally: an insert into `auth.users` by a non-superuser `supabase_auth_admin` still created the profile.
  - Caveat: `CREATE OR REPLACE` keeps the ACL. A future migration that does DROP and then CREATE would reset it to Supabase's default grants, so it would need the REVOKE again.
- **`public.set_updated_at()`**: `ALTER FUNCTION ... SET search_path = ''`. The body only calls `now()`, which lives in `pg_catalog`, and `pg_catalog` is always searched, so no schema qualification is needed. It's used by `transfers_set_updated_at` and `compliance_requests_set_updated_at`. Tested: the trigger still sets `updated_at`.

## 3. Advisors (security, read on 17 Nov 2026 at 10:11 PM EST)

The live `get_advisors(security)` shows **only the items 026 fixes**:
1. ERROR `rls_disabled_in_public` on the 11 tables
2. WARN `anon_security_definer_function_executable` on `handle_new_user()`
3. WARN `authenticated_security_definer_function_executable` on `handle_new_user()`
4. WARN `function_search_path_mutable` on `set_updated_at`

There are **no other security items**. Not fixed here (performance advisors, from the rebuild report): 41× `auth_rls_initplan`, 103× `multiple_permissive_policies`, 4× `duplicate_index`, 4× `unindexed_foreign_keys` (INFO), 53× `unused_index` (INFO).

Related observations, not advisor items and not changed:
- `outward_fee_tiers_service_role` uses `roles={public}` with `auth.jwt()->>'role' = 'service_role'` instead of `TO service_role`. It works, but it's inconsistent with the other policies.
- anon and authenticated hold full table grants (`arwdDxtm`) on **all** 32 public tables. That is Supabase's default, and those tables rely on RLS alone.

## 4. Open questions

- **Q1. Local copy drift.** This decision rests on the GitHub `main` code from Jul 6 plus the `repaihub-src` copy. Once Bhagi's local copy is on `dev`, re-run `rg -n "supabase\.(from|rpc)\(" src/pages src/components src/store src/lib` and check the native apps, which aren't in the repo. Any client-side read of one of these tables would need a SELECT policy. Otherwise it fails with a 42501 error, which is the fail-closed outcome.
- **Q2. `customer_model_config`** has 5 seed rows and no code reference. Keep it service-role only, or drop it?
- **Q3. `promo_code_uses`.** If a "my promotions" screen is planned, add `FOR SELECT TO authenticated USING (user_id = (select auth.uid()))`. The `user_id` column exists. Not added now.
- **Q4. Default privileges.** Supabase grants anon and authenticated full rights on every *new* public table. Should a later migration run `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated`, so new tables are closed by default? It's out of scope here and needs a design pass.
- **Q5. Transaction wrapper.** The file has its own `BEGIN`/`COMMIT`. If the tool that applies it already wraps each migration in a transaction (the Supabase CLI or MCP `apply_migration`), remove both lines to avoid the "already a transaction in progress" warning.

## 5. Tests for REPAIHUB Testing

Run these after the CEO applies 026. Use the anon key from the rebuild report; never use the service-role key on the client.

1. **anon can't read audit or compliance data.** `GET /rest/v1/audit_logs?select=*`, then the same for `risk_assessments`, `compliance_checks` and `promo_code_uses`, using only the `apikey` header. Expect HTTP 401 with Postgres code `42501` (permission denied). A signed-in user JWT gets HTTP 403 with the same `42501`. An empty `[]` is not the expected result here, because the grants are revoked too.
2. **anon can't read any config table.** The frontend needs none of them. Do the same GET on `fee_config`, `promo_codes`, `risk_rules`, `compliance_rules`, `document_requirements`, `customer_model_config` and `compliance_config`. Expect HTTP 401 / `42501` for anon, and HTTP 403 / `42501` for a signed-in user.
3. **anon and authenticated can't write.** `POST`, `PATCH` and `DELETE` on any of the 11 tables return Postgres `42501`. With the anon key the HTTP status is 401; with a signed-in user JWT it is 403.
4. **The RPC is closed.** `POST /rest/v1/rpc/handle_new_user` with the anon key, and again with a user JWT, returns HTTP 404 (`PGRST202`) because PostgREST does not expose trigger functions. A direct SQL call as anon or authenticated still returns `42501` permission denied.
5. **Signup still creates a profile.** Sign up a synthetic user (`qa+026@example.test`) through the app or `auth.signUp`. A `public.profiles` row with the same id appears, with the `full_name` from the metadata.
6. **The server still works.** `GET /api/fees/tiers` and an admin `GET` of `fee_config` and `audit_logs` succeed, and a test transfer writes `risk_assessments`, `compliance_checks` and `audit_logs` rows (all through the service role).
7. **`updated_at` still updates.** Update a test transfer and check that `updated_at` changes.
8. **The advisors are clean.** Re-run `get_advisors(security)`; expect 0 findings.
9. **The verification script passes.** `verify_026.sql`: every `rls` value is true, every `anon_*` and `auth_*` value is false, there are 11 `service_role_*` policies, query 3 returns 0 rows, `handle_new_user` shows `anon_exec`, `auth_exec` and `public_exec` all false, and the seed counts are unchanged.

Local test result (PGlite 0.3, PG 17, mocked roles): the vulnerability reproduced before the migration. The migration applied, then re-applied idempotently. All 11 tables denied anon and authenticated SELECT and INSERT while service_role could still read and write. The RPC was denied, the signup trigger and `set_updated_at` still worked, and `verify_026.sql` ran. The rollback restored the pre-026 state, and 026 re-applied cleanly after it.
