# REPAIHUB Development Rules — Read Before Every Task

## The Golden Rule

ALL work happens on the dev branch first.
Code is merged to main ONLY when the user explicitly says:
  "CONFIRMED — MERGE TO MAIN"

Never merge to main on your own initiative.
Never push to main without explicit user confirmation.
Never run migrations against the production database without confirmation.

## Branch Workflow

1. Always verify branch first: git branch --show-current  (must be dev)
2. Make ALL changes on dev branch only
3. Run: npm run build  — must pass with zero TypeScript errors
4. Commit and push to dev
5. Wait for user to test on the dev environment
6. Wait for user to say "CONFIRMED — MERGE TO MAIN"
7. Only then: git checkout main && git merge dev && git push origin main && git checkout dev

## Database Workflow

Two databases will exist (after dev/prod separation — see docs/dev-prod-separation-plan.md):
- Dev DB: used by code running on dev branch / Render dev service
- Prod DB: used by code running on main branch / Render prod service

Migration workflow:
1. Write migration file in supabase/migrations/
2. Apply to DEV database first
3. Test against dev code
4. Verify no breakage
5. User confirms it works
6. Apply same migration to PROD database
7. Then merge code to main

NEVER apply migrations to prod without testing in dev first.
NEVER assume dev and prod databases have the same schema.

## Before Writing Any Code

1. Read this file
2. Confirm you are on dev branch
3. Diagnose the problem — read the relevant files
4. Report findings to the user
5. Wait for confirmation
6. THEN implement

## Before Declaring Any Task Done

1. npm run build returns zero errors
2. No TypeScript errors (npx tsc --noEmit)
3. The changed feature works manually
4. Existing features still work (regression check)
5. Browser console shows no new JavaScript errors
6. Server logs show no unhandled 500 errors

## Code Quality Rules

- NEVER show fake UI states ("Transfer initiated 100%" when API failed)
- NEVER catch errors silently — always log and surface them
- NEVER use `any` to bypass TypeScript — fix the type properly
- NEVER fake progress bars unrelated to actual work
- NEVER add fake local transfer records as fallback for API failures
- ALL async Express route handlers must have a top-level try/catch
- ALL Express route handlers must return JSON, never HTML, on error
- Use `.maybeSingle()` not `.single()` in Supabase queries unless exactly one row is guaranteed

## Do Not Modify (Without Explicit Request)

- src/adapters/FableAdapter.ts
- src/orchestrator/outwardOrchestrator.ts
- src/orchestrator/inwardOrchestrator.ts
- src/services/complianceService.ts
- src/config/rbiRules.ts thresholds
- Existing database migrations
- Database schema (no new migrations without explicit request)

## Communication Rules

After diagnosis: Report what you found, propose the fix, wait for confirmation.
After each fix: Show files changed and what changed.
At end of session: Confirm dev branch only, list what was done, what is pending.

## Render Cold-Start Awareness

The Render free tier puts the server to sleep after inactivity.
The first request after a cold start may get a non-JSON 500 from Render itself
(not from Express). This is infrastructure behaviour, not a code bug.
Do not chase "Request failed (500)" errors that only happen once on first load.
If the error is reproducible and consistent, it is a code bug — investigate.

## Memory

This file is the canonical workflow reference for this project.
Update it when the user requests a workflow change.
Read it at the start of every coding session.

## Autonomy for business work (set by the user, 2026-11-19)

For the founder pack (`founder/`), the 11 founder skills, bank outreach and
website copy: act without asking, EXCEPT anything involving money —
spending, prices/fees, contracts, NDAs, bank terms, volumes or financial
commitments. Those always need the user's explicit approval.
Code still follows the dev-branch workflow above; nothing merges to main
without "CONFIRMED — MERGE TO MAIN".

## Bank outreach — who to email (set by the user, 2026-11-19)

Send partnership emails ONLY to named decision-makers at the bank (e.g.
Head of NRI Business, Head of Fintech/Digital Partnerships, Head of
International Banking/Forex/Treasury, CDO/CBO, MD & CEO's office).
NEVER send to customer-service, info@, nri@, grievance/nodal-officer or
other generic addresses shown on the bank website or Google — they return
auto-replies and go nowhere.
- Use only emails published by the bank or the person themselves (annual
  report, press release, official site, the person's own public profile),
  or given by the user. Never guess an address from a name pattern and
  never present a guess as verified.
- If no verified decision-maker email exists, record the person's name and
  role and use LinkedIn or a warm introduction instead; tell the user.

## Autonomous operations (set by the user, 2026-11-20 — supersedes the merge-confirmation rule above for these cases)

The user granted standing permission to run REPAIHUB operations without asking:
- Claude (and the scheduled QA/monitor agent) may fix bugs, merge to dev and
  main, and deploy (GitHub → Netlify, Render) WITHOUT waiting for
  "CONFIRMED — MERGE TO MAIN", provided: `npm run build` passes, the live
  smoke test passes after deploy, and any failing deploy is rolled back.
- Credentials are stored as environment network secrets (Render API,
  Supabase management API); never ask the user for them again, never print
  or commit them.
- Still needs the user's explicit OK: anything involving money (pricing,
  fees, paid plans, contracts), new database migrations on production that
  change or delete data, regulatory/compliance claims, and emails to new
  outside parties beyond the routine-reply rules.
- Report every autonomous change to the user in a short summary.

Production infrastructure (2026-11-20):
- Supabase project: mievzzzxpsomrzxhkecu (ca-central-1). The old project
  ycdpqjwvfuxdokytmaxh no longer exists.
- Render: srv-d7o2gru7r5hc73b6eb1g "repaihub" (main, production),
  srv-d7o2sp8sfn5c73ee45h0 "repaihub-dev" (dev). Both free plan.

## Agent company constitution (set by the user, 2026-11-20, later the same day — supersedes "Autonomous operations" above)

The AI workforce is defined in `repaihub-agent-team/`. Its constitution, `repaihub-agent-team/rules.md`, binds every agent. That includes the scheduled website monitor and the scheduled agent-company runs.

**Scheduled and background agents:**
- Never send, post, spend, sign, file or deploy without an APPROVED row in `repaihub-agent-team/queue/needs-founder-ok.md` for that exact item.
- Bug fixes are prepared on a branch, built and tested, and opened as a PR into `dev`. The deployment is then queued for the founder's yes.
- Agent workspace output (tasks, results, briefings, queue rows) is committed to the `agents/workspace` branch, which deploys nothing.

**Claude in a live conversation with the founder:**
- A direct instruction from him for a specific item counts as his yes for that item. Report what was done.

**Credentials:**
- They stay stored as environment network secrets.
- Never ask for them again. Never print or commit them.

**Never touched by any agent:**
- The CA portal (`/ca-login`, `/ca-dashboard`, and the CA team's systems).

## No customer documents (set by the user, 2026-11-20 — "the first thumb rule")

- **REPAIHUB never saves or holds customer documents.**
  - Verification is done by partners: DigiLocker and IDfy in India; Persona and Flinks-class bank verification in Canada.
  - Store only the minimum data and the verification result or reference. PAN is kept masked plus hashed.
- **Upload endpoints are blocked** by `src/middleware/noDocumentStorage.ts`. Never re-enable document storage without the founder's explicit approval of a new design.
- **Founder's test profile:** Venky Bhagi, bbitmoney21@gmail.com, Canadian citizen.
  - Always use it for manual and flow testing.
  - Never delete it. `scripts/qa/cleanup.sh` only removes `qa.*@repaihub.com` accounts.
