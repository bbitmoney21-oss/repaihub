# Decisions log

This file holds only decisions the founder made. Agents add an entry after the founder approves something. They never record a decision he did not make (Rule 2). Newest entries go at the bottom.

## Format
```
### <yyyy-mm-dd> — <short title>
- **Decision:** <what was decided, exactly>
- **Decided by:** Venkateswarlu Bhagi
- **Source:** <queue row ID, message, or document>
- **Affects:** <agents / files / systems>
```

## Log

### 2026-11-02 — FINTRAC MSB registration
- **Decision:** REPAIHUB Remittance Inc. is a registered Money Services Business. The registration number is N300002485, the service is Money Transferring, and the registration expires 31 Jul 2029. All copy must say "Registered, N300002485" and never "in process".
- **Decided by:** Venkateswarlu Bhagi.
- **Source:** FINTRAC registration and the founder's brief.
- **Affects:** all public copy, all drafts, the Legal and Content Writer agents.

### 2026-11-19 — Flat beta fees on the website
- **Decision:** adopt flat beta fees of CAD 79 / 199 / 499 (up to ₹5L / ₹5–25L / above ₹25L), from the founder-pack pricing work. This went live on the site calculator, in the app and in the database fee tiers.
- **Decided by:** Venkateswarlu Bhagi ("go with whatever the best as an entrepreneur using the founder skills").
- **Source:** conversation of 19 Nov 2026; `founder/pricing.md`.
- **Affects:** website, app, Supabase fee tables, help assistant. **Superseded on 2026-11-20 by the tier pricing (Q-001).**

### 2026-11-20 — India → Canada is the primary corridor
- **Decision:** India → Canada (repatriation of NRO funds, property-sale proceeds, rental income) is the primary corridor. Canada → India is secondary. Every change regression-checks the outward corridor (Rule 8).
- **Decided by:** Venkateswarlu Bhagi.
- **Source:** founder's agent-company brief.
- **Affects:** all engineering, QA and growth agents.

### 2026-11-20 — Approved pricing tiers (India → Canada)
- **Decision:**
  - **Standard (5 days):** under ₹5L CAD 9.99 + 1.05%; ₹5–25L CAD 14.99 + 1.20%; ₹25–50L CAD 24.99 + 1.22%.
  - **Express (3 days):** CAD 10.99 + 1.17%; CAD 15.99 + 1.22%; CAD 29.99 + 1.18%.
  - Markups are marginal, like tax brackets.
  - Positioning: "roughly half the all-in cost of a typical Indian bank repatriation, and comparable to Wise — except Wise cannot move NRO money."
  - Do not use "~4–5% below Indian banks".
- **Decided by:** Venkateswarlu Bhagi.
- **Source:** founder's agent-company brief.
- **Affects:** Financial Analyst, Growth, Content Writer, Frontend. **Confirmed as final on 2026-11-20 (Q-001, see below).**

### 2026-11-20 — CA team on board
- **Decision:** the CA team (certified CA associates in India, under CA Partner SriHarsha) is on board and ready to do Form 145/146 and CA certification work. The CA portal is SriHarsha's domain, and the AI workforce never touches it (Rule 7).
- **Decided by:** Venkateswarlu Bhagi.
- **Source:** founder's agent-company brief.
- **Affects:** all agents.

### 2026-11-20 — Render Starter plan approved
- **Decision:** upgrade the production backend from the Render free plan to Starter (US$7/month).
- **Decided by:** Venkateswarlu Bhagi.
- **Source:** conversation of 20 Nov 2026.
- **Affects:** DevOps. The founder must click the upgrade in the Render dashboard, because the API cannot change the plan (queue Q-005).

### 2026-11-20 — Website help assistant with the founder's story
- **Decision:** the website help assistant answers company questions, plus the founder's story, limited to his education, career and living in Canada.
- **Decided by:** Venkateswarlu Bhagi.
- **Source:** conversation of 20 Nov 2026.
- **Affects:** Content Writer and Frontend. The assistant is live at repaihub.com.

### 2026-11-20 — Final pricing: tier pricing (Q-001 closed)
- **Decision:** the tier pricing in company facts is final. The flat CAD 79 / 199 / 499 is retired.
  - Express is priced inside the tiers, with no separate CAD 24 surcharge.
  - The referral free first transfer is kept; it waives only the base fee.
  - The stale ₹5 lakh minimum-transfer setting is corrected to ₹10,000.
- **Decided by:** the Financial Analyst agent, under Venkateswarlu Bhagi's explicit delegation ("the finance/market agent selects the price — revenue first, reasonable for ₹1–5 lakh customers — do not ask me").
- **Source:** `results/finance/pricing-decision-2026-11-20.md`. Flat pricing would charge 5.0% on ₹1 lakh and 2.5% on ₹2 lakh, but only 0.5% on ₹25 lakh. Tier pricing charges 1.2–1.7% at every size and earns about 3.8× more net on ₹25 lakh.
- **Affects:** website calculator, app (new transfer, Fees), server fee engine, Supabase (`outward_fee_tiers`, `fee_config`, migration 026), help assistant, Terms page.

### 2026-11-20 — No customer documents (Rule 12)
- **Decision:** REPAIHUB never saves or holds customer documents. Verification is handled by the partners (DigiLocker, IDfy, Persona, Flinks-class bank verification), and only the minimum data and the verification result are kept.
- **Decided by:** Venkateswarlu Bhagi ("the first thumb rule").
- **Source:** conversation of 20 Nov 2026.
- **Affects:** all engineering, compliance and support agents.
  - Document-upload endpoints are disabled (410).
  - PAN is stored only masked and hashed.
  - The CA team receives document data through the verification partners, not from REPAIHUB storage.

### 2026-11-20 — PAN stays required below ₹5 lakh; transfer flow chained
- **Decision:**
  - The founder asked that transfers below ₹5 lakh not ask for PAN. The Legal agent's research found that PAN is legally required at any amount (Form 145 Part A, RBI KYC), so the app keeps asking for it.
  - What changes below ₹5 lakh is that no CA certificate (Form 146) is needed. The app says this plainly.
  - The DigiLocker → Flinks steps now chain without returning to the transfer in between, and the NRO/NRE choice is remembered.
- **Decided by:** Venkateswarlu Bhagi (direction: "a compliance agent should work on the current RBI rules and make the app work"). The rule itself comes from the law, not a preference.
- **Source:** `results/legal/pan-below-5-lakh-2026-11-20.md`.
- **Affects:** IndiaNRO, CanadaBank and NewTransfer screens; `scripts/qa/transfer-flow.cjs` (now run by the website monitor).

### 2026-11-20 — Q-002 and Q-007 approved; transfer flow fixed end to end
- **Decision:**
  - The founder approved Q-002 (the FEMA check fails closed) and Q-007 (the bank partnership one-pager and Model 2).
  - From the founder's own test: no retyping at Send. The Form 145 Part A screen shows verified details read-only, and the customer answers 1 question and ticks 1 declaration.
  - Form 145/146 naming is now used everywhere.
  - Inward (Canada → India) is selectable up front.
  - RBI purpose codes are corrected to S0014/S1301 (outward) and P1301 (inward).
- **Decided by:** Venkateswarlu Bhagi.
- **Source:** conversation of 20 Nov 2026; `results/legal/purpose-codes-2026-11-20.md`.
- **Affects:** NewTransfer, the Form 145 Part A screen, transfers route, rbiRules, Render env vars, Guide and Fees pages.
