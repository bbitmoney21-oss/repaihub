# Company facts — read before every task

This is the single source of truth for every agent. If a fact you need is not here, say "unknown" and ask through the Orchestrator. Do not invent it (Rule 9). Any changes to this file go through the approval queue.

Last confirmed by the founder: 20 Nov 2026.

## Company
| Fact | Value |
|---|---|
| Legal name | REPAIHUB Remittance Inc. |
| Incorporation | Federal, Canada — CBCA number 1807192-6 (7 Jul 2026) |
| Founder & CEO | Venkateswarlu Bhagi (human), Oshawa, Ontario, Canada |
| Partner | Deepak |
| CFO | Satwik (human), CAD 2,500/month |
| CA Partner (India) | SriHarsha (human), $20 per 15CB (Form 146) file |
| CA team (India) | Certified CA associates, on board, working under SriHarsha on Form 145/146 and CA certification |
| Business email | founder@repaihub.com (Microsoft 365). **All company mail goes from this address only.** |
| Production domain | repaihub.com |
| Staging | https://repaihub-app-staging.netlify.app |
| GitHub | https://github.com/bbitmoney21-oss/repaihub |

## Regulatory
- **FINTRAC Money Services Business: REGISTERED. Registration number N300002485.**
  - Initial registration 2 Nov 2026. Expiry 31 Jul 2029. Services: Money Transferring.
  - Write it as **"Registered, N300002485"**, never "in process".
- **Form 145 / Form 146** replaced Form 15CA / 15CB on 1 April 2026 (Income-tax Act 2025).
- **FEMA:** NRO repatriation limit of USD 1 million per financial year (April–March).
- **PAN is required for every NRO transfer, at any amount** (Legal agent research, 20 Nov 2026: `results/legal/pan-below-5-lakh-2026-11-20.md`).
  - Why:
    - Form 145 Part A asks for the remitter's PAN.
    - RBI KYC requires PAN or Form 60, with no amount threshold.
    - Form 145 is filed on the PAN-based e-filing portal.
  - **Up to ₹5 lakh in the tax year** (a running total, not per transfer): Form 145 Part A, and **no CA certificate (Form 146)**.
  - **Above ₹5 lakh:** Form 145 Part C plus Form 146 from the CA Partner.
  - **No PAN:** hold for manual review.
  - Store the PAN masked and hashed only (Rule 12).
- **No money can legally move out of India without an Authorised Dealer bank partner.**

## Launch gates (in order)
1. **AD Category-I bank agreement** (Indian Authorised Dealer bank for the INR payout leg). **This is the launch gate.**
2. Vendor KYB: Zūm Rails, IDfy, Persona.
3. Integration and testing.
4. Pilot transactions.
5. Public launch.

**AD-I bank shortlist:**
1. Equitas Small Finance Bank
2. AU Small Finance Bank
3. South Indian Bank

Backup: Jana Small Finance Bank.

## Product
- **What it is:** a Canada–India remittance platform.
  - **Primary corridor: India → Canada (repatriation).**
  - Secondary corridor: Canada → India.
- **The customer:** an NRI moving money out of India, such as NRO account funds, property-sale proceeds or rental income.
- **The paperwork is the product:** Form 145/146 plus CA certification, FEMA compliance, and the USD 1M per financial year limit.
- **The flow (verify first, money second):**
  1. Canada: Persona licence check plus face-video identity check.
  2. India: DigiLocker, PAN and bank account verified via IDfy.
  3. The customer funds a wallet via Interac e-Transfer (Zūm Rails / VoPay class).
  4. INR is sent from the wallet via the AD-I partner bank.
- **Channels:** native mobile app (Android + iOS) is the product. The web is for staging, testing and marketing.
- **Website help assistant:** answers only approved facts, including the founder's story, limited to his education, career and living in Canada.

## Data rule (the founder's thumb rule — Rule 12)
- **REPAIHUB does not save or hold customer documents.**
- Verification is done by the partners: DigiLocker and IDfy in India; Persona and Flinks-class bank verification in Canada. We keep only the result and the reference.
- **Minimum data only.** For example, a PAN is stored masked (`XXXXXX234F`) with a SHA-256 hash, never in full.
- **Enforced in code (20 Nov 2026):**
  - Every document-upload endpoint returns 410 (`src/middleware/noDocumentStorage.ts`).
  - The `wallet-docs` storage bucket holds nothing.

## Stack
- **Target:** Fly.io backend (Toronto), Netlify web, Supabase database.
- **Current, as of 20 Nov 2026:**
  - Production backend on Render: service `srv-d7o2gru7r5hc73b6eb1g`, Oregon, free plan. The Starter upgrade is approved by the founder and awaits his click in the dashboard.
  - Dev backend on Render: service `srv-d7o2sp8sfn5c73ee45h0`.
  - Supabase project `mievzzzxpsomrzxhkecu` (ca-central-1).
  - Netlify deploys the web on push to `main`.
- **The move from Render to Fly.io is an open decision.**

## Pricing (approved tiers, India → Canada)
| Ticket | Standard (5 days) | Express (3 days) |
|---|---|---|
| Under ₹5L | CAD 9.99 + 1.05% | CAD 10.99 + 1.17% |
| ₹5–25L | CAD 14.99 + 1.20% | CAD 15.99 + 1.22% |
| ₹25–50L | CAD 24.99 + 1.22% | CAD 29.99 + 1.18% |

- Markups are marginal, like tax brackets: there is no cliff at ₹5L.
- **Positioning line:** "roughly half the all-in cost of a typical Indian bank repatriation, and comparable to Wise — except Wise cannot move NRO money."
- **Never use** "~4–5% below Indian banks". It was checked and is not accurate.
- **Decided 20 Nov 2026 (Q-001 closed):** these tier prices are live on the website calculator, in the app, in the database and in the help assistant. The earlier flat CAD 79 / 199 / 499 is retired. Express is priced in the tiers (no separate surcharge). The referral free first transfer waives the base fee only. Reasoning: `results/finance/pricing-decision-2026-11-20.md`. Shared calculator: `src/lib/outwardPricing.ts`.

## Costs
| Item | Cost |
|---|---|
| CFO (Satwik) | CAD 2,500/month |
| CA Partner (SriHarsha) | $20 per 15CB file |
| Bank rail | 0.20% |
| Support | $1,000/month |
| Home office | ~CAD 300/month |
| **Fixed costs** | **~CAD 3,800/month** |

**Break-even:** about 10 transfers/month at ₹25 lakh average tickets, ~26/month at ₹10 lakh, and ~53/month at ₹5 lakh.

## Market position (research, Nov 2026)
- **The gap:** no provider handles the Form 145/146 plus CA-certificate flow for NRO repatriation. REPAIHUB combines near-Wise FX pricing with the compliance flow handled.
- **Indian AD banks** do it slowly (branch visits, 2–4 weeks end to end) at roughly 0.6–3.5% all-in.
- **Wise, Remitly and XE** serve only resident LRS money, or do not serve India → Canada at all.
- **Market size:** see `founder/market-sizing.md`.
  - Canada ≈ CAD 4.5M/year in fees. This is an estimate, and its weakest assumptions are listed in that file.
  - Watch new entrants, e.g. Aspora (`founder/competitors.md`).

## Known open items
- **D1:** the FEMA limit check fails OPEN on a database error (`src/compliance/femaService.ts`). It must fail closed.
- **D2:** a mock ARN is generated in the transfers code (`src/routes/transfers.ts`). It must be a real income-tax-portal ARN at go-live.
- **D3:** the orchestrator continues with defaults if account-type routing fails (`src/orchestrator/outwardOrchestrator.ts`). It must hold for review at go-live.
- D1–D3 are awaiting the founder's decision.
- **Post-launch:** realtor portal.
- **Phase 2 only:** property vertical, as a partnership rather than a build. A Phase 2 interest page is live at repaihub.com/property.

## Spending and commitments
**No spending over CAD 100 without the founder's yes. No hiring, subscriptions or contracts without his yes.**
