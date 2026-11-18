# Migration 029: server-only inserts and secret columns (DRAFT, NOT APPLIED)

Target: `mievzzzxpsomrzxhkecu`. Nothing was applied to any Supabase project. The live columns, policies, grants and row counts were read only with read-only SQL. Nothing was pushed. 029 **requires 028**, because it reuses `public.guard_server_only_columns()`, and it aborts if that function is missing.

| File | Purpose |
|---|---|
| `029_server_only_inserts_and_secret_columns.sql` | The migration. Runs in a transaction, is idempotent and ends with a self-check. |
| `rollback_029.sql` | Restores the exact pre-029 policies, grants and triggers, with 028 still applied. |
| `verify_029.sql` | Read-only checks for Testing. |
| `test_029_cases.sql` | 41 behaviour probes, each in a subtransaction. They include the server (service_role) write paths. |
| `test_029_realpg.sh` | Real PG 17 Supabase-like cluster (port 54339, `/tmp/pg028`). It builds 000–026, then applies 027 and 028, then runs 029 through apply, re-apply, rollback and re-apply. |
| `pglite/mock_schema_029.sql`, `pglite/run_pglite_029.mjs` | PGlite test. The mock schema adds the four tables, with live columns and policies, on top of the 028 mock. |
| `test-logs/` | Logs. |

## 1. What 029 changes

### Tables (exact live names)

| Table | Policy dropped | Grants after 029 | Guard trigger |
|---|---|---|---|
| `transfer_events` | `events_insert_own` | anon: none. authenticated: SELECT | BEFORE INSERT/UPDATE/DELETE: refused for anything other than service_role and postgres |
| `canada_bank_accounts` | `canada_bank_insert_own` | same | same |
| `india_nro_accounts` | `india_nro_insert_own` | same | same |
| `inward_recipients` | `users_own_recipients` (FOR ALL) | same | same |

`inward_recipients` gets `users_select_own_recipients` (FOR SELECT TO authenticated, `user_id = (select auth.uid())`) and `service_role_inward_recipients`. Before 029, users could also set `is_verified` and `transfer_count` on their recipients and delete them.

Users keep SELECT on their own rows through the existing policies (`events_select_own`, `canada_bank_select_own`, `Users see own accounts`, and the rest).

**Code evidence:** every write goes through the server's service-role client.
- `transfer_events`: `src/routes/transfers.ts:658` and `:1105`, `src/orchestrator/outwardOrchestrator.ts:261`
- Bank accounts: `src/routes/users.ts:210` and `:246`
- Recipients: `src/routes/inwardTransfers.ts:166` (insert) and `:287` (update)

The browser's Supabase client is only used for `supabase.auth.*`.

### profiles secret columns

authenticated loses SELECT on **`password_hash`, `pan_number`, `pan_hash`, `reset_token_hash`**. This is done with column-level SELECT on every other column, after removing table-level SELECT. anon already had nothing after 028. service_role is unchanged.

**I added `pan_hash` and `reset_token_hash` beyond the two you asked for.** A PAN is a short, structured value, so its SHA-256 can be brute-forced and is as sensitive as the PAN itself. `reset_token_hash` is a credential. Remove them from the list in section 2 of the SQL if you'd rather keep them readable.

**Side effects you asked to have documented:**
- `select *` on `profiles` with a user JWT now fails with 42501 "permission denied for table profiles". That includes PostgREST `?select=*` and supabase-js `.from('profiles').select()` or `.select('*')`. Callers must list columns.
  - **No code path does this today.** All `select('*')` on profiles are server-side through `supabaseAdmin`: `auth.ts:290` (login), and `/auth/me` at `auth.ts:551`.
  - Native apps and Bhagi's local copy weren't checked; see Q2.
- A filter on a hidden column (`where password_hash is not null`) is also refused, so the column can't be probed through filters.
- **Columns added to `profiles` later are not readable by authenticated until a migration grants them.** That's fail closed, and it's the same rule as 027.
- **Order dependency:** re-running **028** after 029 brings back table-level SELECT on profiles. Its `REVOKE ALL` also clears column grants, so 029 has to be re-run after it. Migrations normally run once in order, so this only matters for manual re-runs.
- I changed two probes in the 028 test file (`auth SELECT own profile`, `auth SELECT all profiles…`) from `select *` to an explicit column list, so they're valid both before and after 029.

## 2. Test results

**Real PG 17 (`test-logs/029_realpg_summary.log`, 10–18):**
- **Pre-029:** 22 of 41 probes matched, which reproduces the gaps. Users could insert their own transfer events, bank accounts and recipients, set and delete recipients, and read password_hash, PAN and the reset token. anon could reach the tables, and a filter on `password_hash` worked.
- **029 applied, then re-applied:** both succeeded and the self-check passed. **41 of 41** probes pass:
  - authenticated INSERT into all four tables gets 42501
  - recipient UPDATE `is_verified` and DELETE, transfer_events UPDATE and bank account DELETE get 42501
  - own-row SELECT works on all four tables, and another user's rows return 0
  - SELECT of each of the 4 secret columns, `select *` and the `password_hash` filter get 42501
  - safe profile columns are readable, and users can still update their own `full_name`
  - anon gets 42501 on all five tables
  - the guard trigger still blocks after a policy and grant are put back
  - signup still creates profiles
- **Server paths still work (service_role):**
  - insert `transfer_events` (`transfers.ts:658`)
  - insert both bank tables (`users.ts:210`, `:246`)
  - insert a recipient (`inwardTransfers.ts:166`) and bump `transfer_count` (`:287`)
  - `select *` on profiles including `password_hash` (login, `auth.ts:290`)
  - update `password_hash` (`auth.ts:336`) and `pan_number` (`transfers.ts:500`)
- **028 regression with 029 applied:** 77 of 77.
- **Rollback:** the catalog (policies, table and column ACLs, triggers) is **identical** to before 029, and the gaps re-open as documented. Re-applying gives a catalog identical to the first apply, and 41 of 41 again.
- **Negative tests:** 029 without 028 aborts ("029 requires 028"), and the self-check catches a re-opened INSERT policy.

**PGlite (`test-logs/pglite_029.log`):** 51 of 51 checks passed:
- pre-029 reproduces the gaps
- after apply: 41 of 41
- 028 cases with 029 applied: 77 of 77
- rollback re-opens the gaps; after re-apply: 41 of 41
- with 027, 028 and 029 in order: 41 of 41
- 029 without 028 aborts

## 3. Plan: remove `profiles.password_hash` (Supabase Auth already holds the credential)

### Why it exists (from the code)

The API runs **its own login and its own JWT**, separate from Supabase Auth sessions.
- `POST /auth/login` (`src/routes/auth.ts:267`) checks the password and then calls `issueToken()` (`auth.ts:34-36`). That returns `jwt.sign({id,email}, JWT_SECRET, 30d)`.
- `JWT_SECRET` has a hard-coded fallback at `auth.ts:13` and `src/middleware/auth.ts:13,30`.
- Every API route trusts that token through `authMiddleware`, not a Supabase JWT.
- Migration 004 (`004_auth_password_reset.sql:3-12`) added `password_hash` together with `reset_token_hash` and `reset_token_expiry`, so the API could check passwords locally with bcrypt (cost 12) and run its own reset-token flow.
- Supabase Auth holds the password as well. Registration creates the user in Supabase Auth, and the reset flow calls `auth.admin.updateUserById` (`auth.ts:526-531`). So the same password is stored twice.

### Where it's written and read

| Line | What |
|---|---|
| `auth.ts:227`, `:232`, then `:104-113` | Register: `bcrypt.hash`, then `ensureProfile` writes `password_hash`. If the column is missing it just logs a warning. |
| `auth.ts:276-285` | If the admin client isn't configured, login already checks only `supabase.auth.signInWithPassword` (anon client) and issues the token. **This is the target shape.** |
| `auth.ts:288-292` | Login reads `select('*')` from profiles by email, with the service role. |
| `auth.ts:296-311` | Profile repair: if no profile exists, Supabase `signInWithPassword` runs and a new hash is written. |
| `auth.ts:327-328` | **Login check:** `bcrypt.compare(password, profile.password_hash)`. **If that matches, Supabase Auth is never consulted.** |
| `auth.ts:329-339` | On a bcrypt mismatch, falls back to Supabase `signInWithPassword` and re-syncs the hash. |
| `auth.ts:341-346` | If there's no hash, Supabase `signInWithPassword`, then writes a hash. |
| `auth.ts:440-444` | Forgot-password clears `password_hash` and `reset_token_hash` before sending a Supabase recovery link. |
| `auth.ts:497-534` | `POST /auth/reset-password`, the custom token flow. It reads `reset_token_hash` (510-514) and writes `password_hash` (529). **Nothing ever writes `reset_token_hash`** (forgot-password only clears it), so this endpoint always returns 400. It's dead code. Its client, `apiCompletePasswordReset` (`src/lib/api.ts:91`), is never called. |
| `src/pages/auth/ResetPassword.tsx:34` | The real reset uses `supabase.auth.updateUser` after the recovery link. The hash was cleared earlier, so the next login falls back to Supabase and re-hashes. |

The CA portal also uses bcrypt (`caPortal.ts:65`, against `data/store.ts:172-181`), but that's the in-memory demo CA user, not `profiles`. It's out of scope here and covered under QA item 10 and DevOps' secrets work.

### Problems with the current design
- **A stale hash keeps the old password working.** Login accepts a bcrypt match before asking Supabase Auth (327-328). If the Supabase password changes any other way (dashboard, admin API, or a Supabase session's `updateUser` without going through `/auth/forgot-password`), the **old password still logs in** until the next mismatch.
- **A second credential store** doubles the offline-cracking exposure if the database or a backup leaks. Before 029, clients could also read their own hash.
- The custom JWT is signed with a secret that has a hard-coded fallback. DevOps is removing the fallbacks.

### Migration sequence
1. **Now:** 029 hides the column from clients (done in this draft).
2. **Code PR ("auth: Supabase Auth is the only password check"):**
   - In login, delete 288-346's bcrypt branch. Check the password only with `supabase.auth.signInWithPassword`, using the **anon** client from `lib/supabaseClient.ts` rather than `supabaseAdmin`. That makes the existing 276-285 branch the only path; the profile lookup is still needed for the lockout and status fields. Keep the lockout counters, or rely on Supabase Auth's rate limits. Keep issuing the app JWT for now so clients don't change.
   - Delete the hash writes at 104-113, 227, 299-305, 336, 345, 442 and 529.
   - Delete `POST /auth/reset-password` (497-534) and `apiCompletePasswordReset`.
   - Drop `bcryptjs` from the customer auth path. The CA portal still uses it.
   - Tests: login succeeds with the Supabase password and fails with a stale one; register writes no hash; forgot-password still works.
3. **Deploy and check:** watch login error rates for a few days.
   - **Live data risk is zero today:** the new project has **0 profiles and 0 password hashes** (read-only count, 17 Nov). No user depends on a hash that differs from their Supabase password. **Doing this before launch is the cheapest time.**
4. **Migration 03x ("drop password columns"):**
   - `ALTER TABLE public.profiles DROP COLUMN IF EXISTS password_hash, DROP COLUMN IF EXISTS reset_token_hash, DROP COLUMN IF EXISTS reset_token_expiry;` This also drops `idx_profiles_reset_token_hash`.
   - In the same PR, update 029's re-run list (it names `password_hash` and `reset_token_hash` explicitly), `verify_029.sql`, and the 028 verify list, and remove the columns from `APPLY_ALL_MIGRATIONS.sql:300-308` and `supabase-schema.sql`.
   - Order: the code first, then the migration. Even the *current* code survives the drop: at 341-346 an undefined hash falls through to Supabase Auth, and the hash writes fail silently. So the order matters less, but code first keeps the logs clean.
5. **Later (recommended end state):** the frontend signs in with Supabase Auth directly and sends the Supabase access token, and the API verifies Supabase JWTs. That removes the custom `JWT_SECRET` tokens and the server-side password proxy completely.

### Risks
- **Supabase Auth rate limits:** with server-side login, every user's sign-in comes from the API's IP, so Supabase Auth's per-IP limits could block logins at peak. Mitigate by raising the sign-in limit in the dashboard, or move to step 5.
- **Lockout semantics:** `failed_login_attempts` and `locked_until` (`auth.ts:350-357`) keep working, because they don't depend on the hash.
- **Native apps** using `/auth/login` aren't affected (same API contract). Any app that used `/auth/reset-password` would get a 404 instead of a 400; none was found in the repo.
- **Rollback:** re-add the columns. Old code re-creates hashes on the next successful Supabase login (341-346), so no user is locked out.

## 4. Lines to re-check against Bhagi's local copy once it's on `dev`
`auth.ts`: 13, 34-36, 104-113, 227-232, 267-357, 440-444, 497-534, 551. `users.ts`: 35-37, 210, 246. `transfers.ts`: 270, 500, 658, 1105. `inwardTransfers.ts`: 129, 166, 287. `outwardOrchestrator.ts`: 169, 261. `data/store.ts`: 143-144. `kycService.ts`: 228. `lib/api.ts`: 91. Also any new `select('*')` on `profiles` made with a user JWT.

## 5. Open questions
- **Q1.** Keep `pan_hash` and `reset_token_hash` in the hidden set? (Recommended: yes.)
- **Q2.** Do the native apps read `profiles` with a user JWT using `select *`? If so they'll get 42501 and need explicit columns.
- **Q3.** Approve the password_hash removal sequence (code PR, then a later drop migration), and decide whether to go straight to step 5.
- **Q4.** Numbering: an untracked `029_webhook_replay_and_inward_idempotency.sql` exists in `/workspace/repaihub-dev`, marked "renumber at merge". This 029 is committed as 029 on `chore/db-migrations-policy`, so the two need reconciling before either merges.
