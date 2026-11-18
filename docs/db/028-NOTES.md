# Migration 028 and server patch: server-only verification state (DRAFT, NOT APPLIED)

Target: `mievzzzxpsomrzxhkecu`. Nothing was applied to any Supabase project. The live policies, grants and columns were read only with read-only SQL. Nothing was committed or pushed. The patch is a plain `git diff` against `/workspace/repaihub-audit/main` (`80eb2ce`), and `git apply --check` passes against it.

| File | Purpose |
|---|---|
| `028_protect_server_only_columns.sql` | The migration. Runs in a transaction, is idempotent, and ends with a self-check. |
| `rollback_028.sql` | Restores the exact live grants, policies and triggers from before 028. |
| `verify_028.sql` | Read-only checks for Testing. |
| `test_028_cases.sql` | 77 behaviour probes. Each runs in a subtransaction that is always rolled back. |
| `test_028_realpg.sh`, `build_local_pg.sh` | Disposable Supabase-like PG 17 cluster (port 54339, `/tmp/pg028`) with REPAIHUB 000–026 applied, then 027 and 028. QA's cluster isn't touched. |
| `pglite/` | PGlite mock schema (live columns and policies) and `run_pglite_tests.mjs`, which covers both 027 and 028. |
| `server-patch/028_server_kyc_trust.patch` | The server fix plus Vitest tests. `server-patch/work/` is the patched working copy. |
| `test-logs/` | All logs. |

## 1. What 028 changes

The QA finding was reproduced first. On the pre-028 schema, 60 of the 77 probes fail: a signed-in user can set `kycStatus`, `canadaVerified` and `indiaVerified`, set `kyc_submissions.*_verified`, insert completed or approved transfers, and fully control inward transfers.

The live column names are camelCase in quotes: `"kycStatus"`, `"canadaVerified"`, `"indiaVerified"`, `"kycVerifiedAt"`, `"kycExpiresAt"`, `"kycSessionId"`, `"kycProvider"`, `"customerModel"`, `"residencyType"`, `"hasNroAccount"`. The rest are snake_case: `signup_complete`, `status`, `residency_type`, `pan_number`, `password_hash`, `locked_until`, `failed_login_attempts` and others.

**Code evidence:** the web app never writes any of these tables through the Supabase client.
- `src/lib/supabase.ts` is only used for `supabase.auth.*` in `src/pages/auth/ResetPassword.tsx:19,34`.
- The server uses `supabaseAdmin` (the service role) for every write. Its anon client (`src/lib/supabaseClient.ts`) is only used for `signInWithPassword`, at `auth.ts:277`.
- Transfers are created only by `POST /transfers/initiate` (`transfers.ts:144`), and inward transfers only by `POST /inward/initiate` (`inwardTransfers.ts:209`).

So the decision fails closed. There are three layers of protection, and service_role and postgres (both BYPASSRLS) aren't affected.

| Table | Grants after 028 | RLS write policies after 028 | Guard trigger |
|---|---|---|---|
| profiles | anon: none. authenticated: SELECT, `UPDATE(full_name, phone, updated_at)`, `INSERT(id, email, full_name, phone)` | `profiles_update_own_safe`: USING and WITH CHECK `id = auth.uid()`. `profiles_insert_own_safe`: WITH CHECK requires own id, the email from the JWT, `kycStatus` pending, both verified flags false, `kycVerifiedAt` null, `signup_complete` false, `status` active. The old `Users update own profile`, `profiles_update_own`, `profiles_insert` and `profiles_insert_own` are dropped. | BEFORE UPDATE: any change outside full_name, phone and updated_at gets error 42501 |
| kyc_submissions | anon: none. authenticated: SELECT, `INSERT(user_id)` | `kyc_insert_own_unverified`: own user_id, both flags false, both `*_at` null. `kyc_update_own` and `kyc_insert_own` are dropped, so there's no user UPDATE. | BEFORE UPDATE: any change gets 42501 |
| transfers | anon: none. authenticated: SELECT only | Both user INSERT policies dropped (`Users insert own transfers`, `transfers_insert_own`) | BEFORE INSERT/UPDATE/DELETE: refused for everyone without BYPASSRLS |
| inward_transfers | anon: none. authenticated: SELECT only | `users_own_inward` (FOR ALL) dropped. `Users see own inward transfers` (SELECT) stays. | BEFORE INSERT/UPDATE/DELETE: refused |

- **Guard function:** `public.guard_server_only_columns()` is SECURITY INVOKER with `search_path=''` and no EXECUTE for PUBLIC, anon or authenticated. It treats a caller as privileged only when the caller's role is a superuser or has BYPASSRLS. That covers service_role, postgres, and `handle_new_user()`, which runs as postgres.
- **Signup is unaffected:** the `handle_new_user()` trigger inserts, and the guard on profiles only fires on UPDATE.

### Why transfers lost direct INSERT instead of getting a narrowed WITH CHECK

Direct inserts are never used. A narrowed INSERT would still let users choose `amount_cad` and `exchange_rate`, which are NOT NULL with no default. `GET /transfers/:id/certificate` (`transfers.ts:995-1015`) trusts `status='completed'` and prints the 15CA/15CB numbers. If Bhagi's local copy or the native apps do insert transfers directly, see Q2.

### Amendment (turn 3): reset previously self-attested KYC rows
Before 028, `/users/kyc/canada` and `/users/kyc/india` (bank-detail steps), or a direct user write, could set `kyc_submissions.canada_verified` / `india_verified` with no provider check.

Section 2b of the migration:
- adds `verified_reset_at timestamptz` and `verified_reset_reason text`
- **only on the run that creates those columns**, sets both flags to false on every row with either flag true. **Rows are kept.**
- stamps `verified_reset_at = now()` and a reason like `028: self-attested (bank-detail step / direct user write), not provider-verified; prior canada_verified=true india_verified=false`

Re-runs skip the reset, so a flag the server sets later through the provider callback is not wiped. The new columns are server-only: they're covered by the guard trigger's allow-list and users have no grants on them.

**Rollback** restores the flags from the stamped reason (only rows whose reason starts with `028:`), then drops both columns.

The live project has **0** `kyc_submissions` rows today (read-only count), so this is a no-op live, but it's tested on seeded rows.

Tests: `test_028_reset_seed.sql` seeds three synthetic users (R1 canada only, R2 both, R3 none). `test_028_reset_checks.sql` runs 9 checks per phase:
- after apply: the NOTICE reports 2 rows reset, the flags are false, the stamps and reasons are correct, and R3 is untouched
- after re-apply: the reset is skipped, and R3's later service-role flag is kept
- after rollback: the flags are restored exactly and the columns are gone

All 27 of 27 pass. The test file also has a new probe: an authenticated user inserting a forged reset stamp gets 42501.

## 2. Server patch (`server-patch/028_server_kyc_trust.patch`)

The patch stops the API trusting client-writable verification flags. The authoritative source becomes the profile columns that `kycService.updateKYCStatus()` writes after a provider result with a verified HMAC signature (`POST /kyc/fable/callback`). 028 makes those columns server-only.

| File | Change |
|---|---|
| `src/services/kycState.ts` (new) | `deriveKycState()` / `getVerifiedKycState()` / `getVerifiedKycStateOrUnverified()`. These read only `profiles."kycStatus","canadaVerified","indiaVerified","kycVerifiedAt","kycExpiresAt"` and require strict `=== true`, a verification window (`kycVerifiedAt` ≤ now < `kycExpiresAt`), and `kycStatus==='verified'` for `fullyVerified`. A DB error throws, or with `OrUnverified` degrades to unverified. `kyc_submissions` is never read. |
| `src/routes/auth.ts` | Login (was 371, 391-393, **405-406**) and `GET /auth/me` (was 551, 584, **603-604**) take `canadaBankVerified` and `indiaNROVerified` from kycState instead of `kyc_submissions`. |
| `src/routes/transfers.ts` | `/initiate` (was 465-469 and **511**): `isKYCVerified = kycState.fullyVerified`, which feeds risk scoring. A DB error counts as unverified (a higher risk score). |
| `src/routes/users.ts` | `POST /users/kyc/canada` (was 222-225) and `/kyc/india` (was 257-260) used to set `canada_verified` / `india_verified = true` just because bank details were submitted. They now only make sure an empty `kyc_submissions` row exists (`ignoreDuplicates`). The responses say "verification pending" and include `verified: false`. |
| `src/routes/webhooks.ts` | Unsigned `POST /webhooks/fable/kyc` (was 147-157) no longer upserts `kyc_submissions` true; it logs `KYC_WEBHOOK_IGNORED`. `handleKYCVerified` on the outward webhook (was 195-205) no longer writes `profiles.kyc_status`, a column that doesn't exist; it logs only. |
| `src/__tests__/kycTrust.test.ts` (new) | 17 Vitest tests, with no network or DB (`supabaseAdmin` is an in-memory fake). They cover deriveKycState edge cases and DB-error fail-closed behaviour. Route tests on a real Express app check that `/auth/me` and `/auth/login` ignore forged `kyc_submissions` flags and never read that table, that `/users/kyc/*` never write `*_verified`, and that a `verified` payload to the unsigned webhook writes nothing. |

**Results:**
- The patched tree passes **17 of 17**.
- The same test file on the **original** routes fails 6 of 17. The 11 that still pass are the kycState unit tests, which don't touch the routes. So the tests do detect the bug. Log: `test-logs/vitest_kycTrust.log`.
- `tsc -p tsconfig.server.json --noEmit` reports 0 errors, and `kycState.ts` also passes `--strict`.

**Running the tests:** the repo has no Vitest dependency or test script, and DevOps owns `package.json` and CI. They need to add `vitest` (^2.1) to devDependencies. Vitest's default include picks up `src/__tests__/*.test.ts`, so no config is needed. Locally I ran `vitest run src/__tests__/kycTrust.test.ts` using the QA suite's Vitest.

**Behaviour change to tell Bhagi about:** customers who only went through the self-attested `/users/kyc/canada|india` steps now show as *not* verified. That affects the AppLayout badge and AppSettings, until a provider result arrives through `/kyc/fable/callback`. This is the intended fail-closed result.

## 3. Tests run

**Real PG 17 Supabase-like cluster (`test-logs/028_realpg_summary.log` and 10–22):**
- Pre-028: 17 of 77 match, so the escalation reproduces.
- 027 then 028 applied, then 028 applied again: both succeeded.
- **77 of 77** probes pass:
  - an authenticated user updating each of the 27 protected profile columns gets 42501
  - named escalations (self-verify, unlock) get 42501
  - users can still update their own full_name and phone, and updating another user's row affects 0 rows
  - a pre-verified profile INSERT, or one with someone else's email, gets 42501
  - updating any of the 6 `kyc_submissions` columns, inserting a pre-verified row or deleting gets 42501, while inserting an empty own row works
  - transfers INSERT (completed or initiated), UPDATE and DELETE get 42501, while reading own transfers works
  - inward INSERT, UPDATE and DELETE get 42501, while reading own transfers works
  - anon gets 42501 on all four tables
  - service_role can update every protected column, the KYC flags and transfer status, and can insert, update and delete inward transfers
  - postgres can update
  - signup through the `auth.users` insert as `supabase_auth_admin` creates profiles
  - `set_updated_at` still bumps `updated_at`
  - defence in depth: with a column grant or permissive policy put back, the trigger still blocks `kycStatus`, transfer status, a KYC self-verify, and inward INSERT and DELETE
- Rollback: the catalog snapshot (policies, table and column ACLs, triggers) is **identical** to before 028, and the escalation re-opens as documented. Re-applying gives 77 of 77 again.
- 028 without 027 also gives 77 of 77.
- Negative test: the self-check aborts on a re-opened write policy.

**PGlite (`test-logs/pglite_027_028.log`):** 125 of 125 checks passed:
- 028 after apply, after re-apply, after rollback plus re-apply, and with 027 then 028: 77 of 77 cases each time
- pre-028: the escalation is reproduced
- 027: 13 checks
- reset amendment flow (apply, re-apply, rollback) on seeded rows

## 4. Lines to re-check against Bhagi's local copy once it's on `dev`

These refer to the original `main` at `80eb2ce`:
- `src/routes/auth.ts`: 371-375 (login `kyc_submissions` query), 391-393, **405-406**, 551, 584, **603-604**
- `src/routes/transfers.ts`: 465-469, **511**, and 995-1015 (certificate trusts `status`)
- `src/routes/users.ts`: 222-225, 229, 257-260, 274
- `src/routes/webhooks.ts`: 139-163 (`/fable/kyc`, unsigned) and 195-205 (`handleKYCVerified`)
- `src/services/kycService.ts`: 330-364 (`updateKYCStatus`, the only trusted writer) and 359-364 (its `kyc_submissions` mirror also writes `updated_at`, a column that doesn't exist on live, so the upsert probably fails silently; worth fixing)
- `src/routes/kyc.ts`: 87-115 (`/kyc/fable/callback`, the HMAC check)
- Any new `supabase.from(...)` or `.rpc(...)` in web or native code that writes `profiles`, `kyc_submissions`, `transfers` or `inward_transfers` would now get 42501 (see Q2)
- Persona, IDfy, Zum Rails and AD-I code (not in the GitHub repo): any place that sets or reads verified, KYC or status flags

## 5. Open questions

- **Q1. Profile fields users may edit.** I allowed only `full_name` and `phone`. `residency` and `residency_type` drive NRO/NRE routing and compliance, so they're server-only. Should any other field be editable directly? Today no client edits any of them through Supabase.
- **Q2. Direct inserts.** Do the native apps or Bhagi's local copy insert `transfers` or `inward_transfers`, or update `profiles`, `kyc_submissions` or `transfers`, through Supabase? If so, they'll get 42501, which is the fail-closed outcome. The fix would be to route them through the API, not to re-open the tables.
- **Q3. Similar gaps not in scope.** These have the same shape and weren't fixed:
  - `transfer_events` `events_insert_own` (users can insert into their own transfer audit trail)
  - `canada_bank_accounts` / `india_nro_accounts` `*_insert_own`
  - `inward_recipients` `users_own_recipients` (FOR ALL)
  - users can SELECT their own `password_hash`, `reset_token_hash` and `pan_number` through `profiles`

  Should I make a 029 for these?
- **Q4. KYC gate.** Inward transfers have no KYC check, and outward uses KYC only as a risk input. Making KYC a hard gate in both directions is QA item 8, planned for PR 3, and it would use `getVerifiedKycState()`, which throws on DB error.
- **Q5. Transaction wrapper.** As with 026 and 027, remove the explicit `BEGIN`/`COMMIT` if the tool applying 028 already wraps each migration in a transaction.
- **Q6. Existing kyc_submissions rows.** Rows that self-attestation already set to true stay in the table but are no longer trusted. Should a one-off data fix reset them to false, or leave them for audit?
