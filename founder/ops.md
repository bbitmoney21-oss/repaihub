# Operations Manager — REPAIHUB Safe Passage

v1 scope (per board): **outward NRO → Canada only.** Inward transfers, Express and mobile are paused. Quebec excluded at launch (separate provincial MSB licensing regime — confirm with counsel).

## 1. Daily cycle (★ = customer sees it)
1. ★ Customer books free CA pre-check (calendar link).
2. CA pre-check call (15 min): source of funds, TDS status, tier → written summary.
3. ★ Customer completes KYC (Setu DigiLocker + PAN; Flinks/Fable bank link).
4. ★ Quote: amount, tier fee, partner-bank rate vs mid-market, total landed CAD → customer confirms.
5. Form 145 filed; CA issues Form 146 where required; A2 / bank mandate prepared.
6. Partner AD bank debits NRO (via customer mandate), converts, wires CAD.
7. ★ Status updates at each step (app + email).
8. Fable/Canadian bank receives CAD → ★ "landed" notice; fee deducted at this point.
9. FINTRAC records/reports (LCTR for ≥ $10,000 CAD where applicable; record keeping 5 years).
10. Daily exception sweep (anything not moved in 24 h gets a human).

## 2. Suppliers (all prices to be quoted — none confirmed)
| Input | Candidates to approach | What to ask |
|---|---|---|
| **AD Category-I bank (critical path)** | Banks with active NRI-remittance/fintech partnership desks — e.g. Federal Bank, IDFC FIRST, Kotak, IndusInd, Yes Bank, South Indian Bank (approach list, not claims of fit) | Per-transfer fee, FX margin over mid-market, mandate flow for NRO accounts held at *other* banks, API vs file-based, white-label/non-compete terms |
| CA firm (Form 146) | 3 firms specialising in NRI taxation; ask for bulk rate | ₹/certificate at 20, 50, 100/month; turnaround SLA; liability cover |
| India KYC/PAN/penny drop | Setu (current) | Published rate card |
| Canada bank link + payout | Flinks, Fable Fintech (current) | Per-link and per-payout fees |
| Hosting/DB | Render, Supabase (current) | Paid tier needed for production uptime |
If any real price differs from `numbers.json`, update it and re-run `/founder-cfo`.

## 3. People
| Role | Who | Hours/week (slow first month) | At plan (60 transfers/mo) |
|---|---|---:|---:|
| Founder (product, partners, escalations) | Founder | 10 | 15 |
| Compliance officer (FINTRAC requires one named) | Founder, with outsourced AML support | 2 | 4 |
| Customer support (Canadian hours) | Outsourced/part-time, $25/h estimate | 3 | 12 |
| CA pre-check + Form 146 | Partner CA firm | per transfer | per transfer |
Founder has a full-time job: **support must be covered 9–5 ET weekdays by someone other than the founder before launch.** Payroll/contractor costs beyond wages: ask the accountant.

## 4. SOPs (one page each, to be written in `docs/ops/`)
1. **Opening sweep (daily 8:00 ET):** check overnight status changes, any transfer > 24 h without movement → open exception.
2. **Core fulfilment:** steps 1–9 above with checklists per bank.
3. **Exception / complaint:** acknowledge < 2 business hours; named owner; root cause; customer update every 24 h; guarantee applied automatically.
4. **Closing (daily 17:00 ET):** reconcile landed CAD vs quotes; fee capture; FINTRAC record completeness.
5. **Weekly:** CA invoice reconciliation, partner-bank statement reconciliation, metrics review.

## 5. Tools (smallest stack)
Existing app (React/Express/Supabase on Render) · scheduling (any booking tool with a free tier) · help desk/shared inbox · bookkeeping (cloud accounting) · password manager + 2FA everywhere. Check each vendor's published price; budgeted at $180/month in `numbers.json`.

## 6. Licences, registrations, insurance (confirm each with the authority or counsel — not legal advice)
- **FINTRAC MSB registration** — submitted, not granted. https://fintrac-canafe.canada.ca/msb-esm/msb-eng
- **FINTRAC compliance program:** compliance officer, written policies, risk assessment, training, two-year effectiveness review. https://fintrac-canafe.canada.ca/guidance-directives/compliance-conformite/Guide4/4-eng
- **Bank of Canada — Retail Payment Activities Act (RPAA) PSP registration:** likely applies if REPAIHUB holds/transfers end-user funds. https://www.bankofcanada.ca/core-functions/retail-payments-supervision/
- **Quebec MSB licence (Revenu Québec)** if serving Quebec residents — excluded at launch.
- **PIPEDA** privacy obligations (document storage is already minimised).
- **India side:** the AD bank carries FEMA/RBI obligations; confirm with Indian counsel whether REPAIHUB or the CA needs any registration for facilitating Form 145/146.
- **Insurance:** E&O + cyber (budgeted $250/month estimate).

## 7. Risk register
| # | Risk | Likely | Impact | Plan |
|---|---|---|---|---|
| 1 | No AD bank signs | High | Fatal | Run the paperwork-only pilot (see `launch.md`) to show volume; approach 6 banks in parallel |
| 2 | FINTRAC registration delayed | Med | High | No money movement until granted; pilot meanwhile |
| 3 | RPAA registration required and not filed | Med | High | Counsel opinion before launch |
| 4 | Transfer stuck at partner bank | Med | High | Exception SOP; guarantee; daily sweep |
| 5 | CA rejects / errors in Form 146 | Med | Med | CA SLA + liability in contract; redo-free guarantee |
| 6 | Founder unavailable (day job) | High | Med | Outsourced support; documented SOPs |
| 7 | FX rate worse than promised | Med | High | Show bank rate vs mid-market on every quote |
| 8 | Fraud / AML hit (layering via NRO) | Low | High | Source-of-funds check in CA call; PEP/sanctions screening must be ON (currently mock in code) |
| 9 | Partner bank copies the service | Med | High | Non-solicit/white-label clauses; own the accountant channel |
| 10 | Bad public review in community | Med | High | Same-day human reply; fix and follow up publicly |

**Code note (not changed in this run):** `docs/FABLE_QUESTIONS.md` lists AML/PEP screening as "Skipped (mock)". That must be live before any real transfer.
