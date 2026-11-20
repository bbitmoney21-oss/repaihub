# REPAIHUB website monitor — runbook

The scheduled website monitor runs this runbook in a fresh cloud session each time. It acts as the **QA Lead** and **DevOps Engineer** agents of `repaihub-agent-team/` and is bound by `repaihub-agent-team/rules.md`. Under that constitution:
- it never deploys, sends, posts or spends without an APPROVED row in the approval queue;
- it never touches the CA portal.

Credentials for Render and Supabase are injected by the environment's network proxy. Never ask for them, print them or commit them.

## Infra
- **Production:** https://repaihub.com. The API is on Render; the web deploys from `main`.
- **Render services:**
  - `srv-d7o2gru7r5hc73b6eb1g` "repaihub" (`main`, production);
  - `srv-d7o2sp8sfn5c73ee45h0` "repaihub-dev" (`dev`).
- **Supabase project:** `mievzzzxpsomrzxhkecu` (ca-central-1).
- **Render API:** `https://api.render.com/v1/services/{id}/deploys`. Use GET to list deploys; POST deploys and needs approval.
- **Supabase API:** `POST https://api.supabase.com/v1/projects/{ref}/database/query` with `{"query": "..."}`. Read-only, except `scripts/qa/cleanup.sh`.
- **Approval queue:** `repaihub-agent-team/queue/needs-founder-ok.md` on the `agents/workspace` branch.

## Each run
1. **Smoke test.**
   - Run `npm ci` if `node_modules` is missing.
   - Then run `node scripts/qa/smoke.cjs https://repaihub.com <scratch>/qa > <scratch>/qa/out.json`.
   - A failure that clears on one re-run after 60 s is a Render cold start. Log it; don't "fix" it.
2. **Clean up.** Run `bash scripts/qa/cleanup.sh`, always, whether the test passed or failed.
3. **Production health.**
   - The latest Render production deploy should be `live`.
   - `GET https://repaihub.com/health` should return 200.
4. **Screenshots.** Look over the app-page screenshots for visible breakage: a blank page, raw error text, wrong facts.
5. **Approved deployments.**
   - Check out `agents/workspace` and look for queue rows raised by the monitor that the founder has marked **APPROVED**.
   - For each one, run the deployment steps below.

## When something is broken (no approval yet)
1. **Fix it on a branch.**
   - Find the root cause.
   - Fix it on a branch `claude/qa-fix-<yyyymmdd>` from `dev`.
   - `npm run build` must pass.
   - Test locally: `npx vite preview --port 4173`, then run the smoke test against it.
2. **Open a PR into `dev`,** with the evidence: failing result before, passing result after. **Do not merge it.**
3. **Queue the deployment.**
   - On `agents/workspace`, add a row to the approval queue. Raised by: "DevOps Engineer agent (website monitor)".
   - The row states: what broke; the PR link; the exact deployment steps; the rollback; the deadline (as soon as possible for a production outage); and what happens if delayed.
   - Commit and push `agents/workspace`.
4. **Notify the founder.** End the run with a short summary. A push notification follows automatically.
5. **Never change:** pricing or fees, paid plans, production migrations that change or delete data, or compliance or legal claims. Those go in the queue only as decision rows.

## Deployment steps (only for an APPROVED row)
1. Merge the PR into `dev`, then merge `dev` into `main`, and push.
2. Trigger a Render production deploy and wait until it is `live`. Then wait about 3 minutes for the web deploy.
3. Re-run the smoke test against https://repaihub.com, then run `cleanup.sh`.
4. **If the live smoke test fails:**
   - revert the merge on `main`, push and redeploy;
   - confirm the site is back to its previous state;
   - report it.
5. On `agents/workspace`, move the row to "Closed" with the date and the result, and log the decision in `knowledge/decisions-log.md`.

## Report
- Only notify when something failed, a fix is waiting for approval, or an approved deployment ran.
- A quiet pass needs no notification and no commit. End with one line: "monitor: all N checks passed".
