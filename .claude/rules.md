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
