# Dev/Prod Database & Deployment Separation Plan

## DO NOT EXECUTE TODAY
This document is for reference after the Fable meeting.
No action required now.

---

## Current State (May 2026)

REPAIHUB has **one Render service** and **one Supabase project**.
Both dev and main branches share the same database.
This is acceptable for early stage, but creates risk:
- Dev experiments can corrupt production data
- Migrations applied in dev affect production immediately
- Cannot test breaking schema changes safely

---

## Target State (After Fable Meeting)

| Environment | Branch | Render Service    | Supabase Project  |
|-------------|--------|-------------------|-------------------|
| Dev         | dev    | repaihub-dev      | repaihub-dev (new)|
| Production  | main   | repaihub (current)| repaihub (current)|

---

## Step-by-Step Setup (Do In This Order)

### Step 1 — Create New Supabase Project for Dev

- Log in to supabase.com
- Create new project: `repaihub-dev`
- Region: ca-central-1 (same as prod — FINTRAC compliance)
- Save credentials:
  - `DEV_SUPABASE_URL`
  - `DEV_SUPABASE_ANON_KEY`
  - `DEV_SUPABASE_SERVICE_ROLE_KEY`

### Step 2 — Apply All Migrations to Dev Database

Apply migrations 001 through 024 (and any newer) to the new dev DB.
Use the Supabase SQL editor or CLI:

```bash
# Using Supabase CLI (if configured)
supabase db push --db-url "postgresql://postgres:[password]@db.[dev-project-ref].supabase.co:5432/postgres"

# OR apply each migration manually in Supabase SQL Editor
# File order: 001 → 002 → ... → 024
```

Verify schema matches production after applying all migrations.

### Step 3 — Create Dev Render Service

- Log in to render.com
- New Web Service → Connect to same GitHub repo (bbitmoney21-oss/repaihub)
- Branch: **dev** (NOT main)
- Build command: `npm install && npm run build`
- Start command: `node dist/server.js`
- Environment variables: set to DEV Supabase credentials (NOT prod)
- Auto-deploy: enabled for dev branch

### Step 4 — Update Environment Variables

**Dev Render Service** (new):
```
SUPABASE_URL=<dev-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<dev-service-role-key>
JWT_SECRET=<any-dev-secret>
CA_JWT_SECRET=<any-dev-ca-secret>
NODE_ENV=development
FRONTEND_URL=https://repaihub-dev.onrender.com
```

**Prod Render Service** (existing — do NOT change):
```
SUPABASE_URL=<prod-supabase-url>  (unchanged)
SUPABASE_SERVICE_ROLE_KEY=<prod-service-role-key>  (unchanged)
JWT_SECRET=<prod-secret>  (unchanged)
NODE_ENV=production
FRONTEND_URL=https://repaihub.com  (unchanged)
```

### Step 5 — Verify Separation

Test by making a harmless change on dev:
1. Push change to dev branch
2. Verify it appears on `repaihub-dev.onrender.com` only
3. Verify `repaihub.com` is unaffected
4. Verify dev DB has the change, prod DB does not

### Step 6 — Workflow After Separation

Future workflow:
```
1. Code change → push to dev
2. Render auto-deploys to repaihub-dev.onrender.com
3. Test on dev URL
4. User says "CONFIRMED — MERGE TO MAIN"
5. git checkout main && git merge dev && git push origin main
6. Render auto-deploys to repaihub.com (production)
```

Migration workflow after separation:
```
1. Write new migration SQL file
2. Apply to dev DB (Supabase SQL editor for dev project)
3. Test dev deployment
4. User confirms working
5. Apply SAME migration to prod DB (Supabase SQL editor for prod project)
6. Merge code to main
```

---

## Risk Factors

| Risk | Mitigation |
|------|-----------|
| Applying migration to wrong DB | Double-check the Supabase project URL before running SQL |
| Dev data leaking to prod | Keep env vars strictly separated, never copy prod credentials to dev |
| Render billing | Free tier has limits; consider upgrading if cold starts cause issues |
| Schema drift | Always apply migrations to dev first, then prod, never the reverse |

---

## Estimated Effort

- Supabase setup: 30 minutes
- Render service creation: 15 minutes
- Migration application: 1-2 hours (24 migrations to apply)
- Testing and verification: 1 hour
- **Total: 3-4 hours**

---

## When To Do This

After the Fable meeting. Not before.
Current priority: get transfers working reliably on the single environment.
Database separation is a process improvement, not a blocker.
