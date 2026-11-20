# REPAIHUB website monitor — runbook

Run by Claude's scheduled QA monitor (a fresh cloud session each time). Follow
`.claude/rules.md`, section "Autonomous operations". Credentials for Render and
Supabase are injected by the environment's network proxy: never ask for them,
never print or commit them.

## Infra
- Production: https://repaihub.com (Netlify via GitHub Action on push to `main`, API on Render).
- Render services: `srv-d7o2gru7r5hc73b6eb1g` "repaihub" (main, production), `srv-d7o2sp8sfn5c73ee45h0` "repaihub-dev" (dev).
- Supabase project: `mievzzzxpsomrzxhkecu` (ca-central-1).
- Render API: `https://api.render.com/v1/services/{id}/deploys` (GET list, POST to deploy), `/deploys/{deployId}`.
- Supabase API: `POST https://api.supabase.com/v1/projects/{ref}/database/query` with `{"query": "..."}`.

## Each run
1. `npm ci` (if `node_modules` missing), then `node scripts/qa/smoke.cjs https://repaihub.com <scratch>/qa > <scratch>/qa/out.json`.
   A failure that clears on one re-run after 60s is a Render cold start — log it, don't "fix" it.
2. `bash scripts/qa/cleanup.sh` — always, pass or fail.
3. Check the latest production deploy status on Render (`live` expected) and that
   `GET https://repaihub.com/health` answers 200.
4. Look over the screenshots of the app pages for visible breakage (blank page,
   raw error text, wrong prices — prices must be CAD $79 / $199 / $499).

## When something is broken
1. Find the root cause in the code. Fix it on a branch `claude/qa-fix-<yyyymmdd>` from `dev`.
2. `npm run build` must pass. Re-run the smoke test locally if the fix is front-end
   (`npm run build && npx vite preview --port 4173`, then point smoke.cjs at it where possible).
3. Open a PR into `dev`, merge it, then merge `dev` into `main` and push.
4. Trigger a Render production deploy, wait until `live`, wait ~3 min for Netlify,
   re-run the smoke test against https://repaihub.com, then run cleanup.sh.
5. If the live smoke test fails after the deploy: revert the merge on `main`, push,
   redeploy, and confirm the site is back to the previous state.
6. Never change: pricing or fees in code or the DB, paid plans, production migrations
   that change or delete customer data, compliance/legal claims. Those go in the report
   as "needs Bhagi's OK".

## Report
Send a short push notification only when something failed, was fixed, or needs Bhagi:
what broke, what was changed (PR link), and whether the live smoke test now passes.
Append one line per run to `founder/qa-log.md` only when something changed (commit it with the fix).
A quiet pass needs no notification and no commit.
