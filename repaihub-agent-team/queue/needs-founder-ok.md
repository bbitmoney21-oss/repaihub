# Approval queue — needs the founder's OK

**This is the most important file after [`rules.md`](../rules.md).**
- Every decision, payment, filing, contract, external message and deployment waits here.
- Nothing leaves the company until the founder (Venkateswarlu Bhagi) marks that exact row **APPROVED** (Rules 2–3).

## How to use it
- **Agents:**
  - add one row per item and never bundle;
  - fill every column;
  - link the full draft or paper in "What is being asked";
  - use the next free ID (Q-001, Q-002, …);
  - never edit the Status column.
- **Founder:**
  - change Status to **APPROVED** or **DECLINED**, adding a note if you want; or
  - tell Claude "approve Q-xxx" or "decline Q-xxx".
- **The Orchestrator:**
  - executes only APPROVED rows, exactly as written;
  - moves closed rows to the "Closed" section with the date;
  - logs decisions in [`knowledge/decisions-log.md`](../knowledge/decisions-log.md).

**STOP:** if the founder writes STOP here, or says it anywhere, every agent stops at once (Rule 10).

## Format
| ID | Raised by | What is being asked | Why | Exact decision needed | Deadline | If delayed | Status |
|---|---|---|---|---|---|---|---|
| EXAMPLE | Banking Relations agent | Send the first-approach email to the named decision-maker at <bank> (draft: `results/banking/drafts/<bank>.md`) | Gate 1 — AD-I bank agreement | Yes/No: send this exact draft from founder@repaihub.com? | <date> | Gate 1 slips by the delay | EXAMPLE — not a real request |

## Open
| ID | Raised by | What is being asked | Why | Exact decision needed | Deadline | If delayed | Status |
|---|---|---|---|---|---|---|---|
| Q-002 | CTO agent | **D1 — FEMA limit check fails OPEN on a database error** (`src/compliance/femaService.ts`, catch near line 52 returns `allowed: true`). Fix: on error, hold the transfer and show "we could not verify your annual limit". | Rule 9 (fail closed). A database blip could let a customer exceed USD 1M/FY. | Yes/No: approve the fix to be built, tested and queued for deployment? | Before gate 3 (integration and testing) | Corridor cannot pass the release gate | WAITING |
| Q-003 | CTO agent | **D2 — mock ARN in transfers code** (`src/routes/transfers.ts` ≈ lines 552–568 generate `ITD` + epoch + random). Fix: remove mock generation; require the real income-tax-portal ARN (entered by the CA team) before the transfer moves. | A fabricated ARN must never reach a bank or a customer record at go-live. | Yes/No: approve removing the mock and requiring a real ARN? | Before gate 3 | Corridor cannot pass the release gate | WAITING |
| Q-004 | CTO agent | **D3 — orchestrator continues with defaults if account-type routing fails** (`src/orchestrator/outwardOrchestrator.ts`, catch after `determineAccountRoute`). Fix: hold the transfer for manual review. | Rule 9 (fail closed). Wrong routing could file the wrong Form 145 part. | Yes/No: approve the hold-for-review fix? | Before gate 3 | Corridor cannot pass the release gate | WAITING |
| Q-005 | DevOps Engineer agent | **Render production plan: click "Upgrade" to Starter (US$7/month)** at https://dashboard.render.com/web/srv-d7o2gru7r5hc73b6eb1g/settings → Instance type. The API cannot change a free service to paid; it needs your card on the account. | Free plan sleeps; the first visitor (e.g. a bank officer from a LinkedIn link) waits 30–50 s or sees an error. | Already approved in principle on 20 Nov 2026; needs your click. | Before LinkedIn outreach starts | Bank officers may see an error on first click | WAITING (founder action) |
| Q-006 | Data Analyst agent | **Read-only access to the Formspree waitlist** (count of sign-ups), so the briefing shows real demand numbers. | Rule 9: the waitlist count is currently unknown. | Yes/No: share Formspree read access (or forward the weekly count)? | 4 Dec 2026 | Demand stays unmeasured | WAITING |

## Closed
| ID | Decision | Date | Notes |
|---|---|---|---|
| Q-001 | Tier pricing adopted (flat 79 / 199 / 499 retired); Express in tiers; referral waiver kept (base fee only) | 2026-11-20 | Decided by the Financial Analyst agent under the founder's delegation; live on site, app, database and help assistant. See `results/finance/pricing-decision-2026-11-20.md`. |
