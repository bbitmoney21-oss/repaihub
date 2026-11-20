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
- **Affects:** website, app, Supabase fee tables, help assistant. **Superseded or confirmed by Q-001.**

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
- **Affects:** Financial Analyst, Growth, Content Writer, Frontend. **Conflicts with the 2026-11-19 entry; open as Q-001 until the founder confirms which is final.**

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
