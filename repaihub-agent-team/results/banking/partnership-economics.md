# AD-I bank partnership — economics workings (internal, for the founder and the CFO)

**Prepared by:** Banking Relations agent, 20 Nov 2026 · **Peer review:** Financial Analyst agent (numbers re-run from the inputs below; Rule 1 check: the structure, models and wording are REPAIHUB's own, built from company facts, the pricing decision and the market-sizing file; nothing is taken from another company).
**Status:** **DRAFT — terms require the founder's decision (Rule 2).** Queue row Q-007. Nothing in this file has been shared with any bank (Rule 3).
**Companion:** bank-facing one-pager `results/banking/partnership-one-pager.md`.

> Every figure below is an **ESTIMATE / projection**, not a forecast and not bank data. Each input is tagged **[F]** company fact, **[P]** pricing decision (`results/finance/pricing-decision-2026-11-20.md`), **[M]** market sizing (`founder/market-sizing.md`), or **[A]** assumption made for this paper (with how to replace it). REPAIHUB has no transfers yet; no number here is a result (Rule 9).

---

## 1. Inputs

| # | Input | Value | Tag | How to replace with a real number |
|---|---|---|---|---|
| I1 | Transfers per year, Canada, India → Canada | Low 145 / 400 / 500 · Base 289 / 720 / 1,000 · High 578 / 1,400 / 2,000 (years 1 / 2 / 3) | [M] §6.2 | Pilot run-rate after the first 50 transfers. (The 300 US "paperwork-only" transfers in the High case are excluded: the customer's own bank sends that money, not our partner.) |
| I2 | Average ticket | **₹10 lakh** | [M] B6 (itself an assumption) | Actual amounts from the first 50 pre-checks. See sensitivity §5: the pricing-decision mix averages only ₹4.65 lakh. |
| I3 | FX working rate | **₹63.42 per CAD** | [P] | Live rate at signing. (Market sizing uses ₹63; difference < 1%.) |
| I4 | Processing fee to the bank ("bank rail") | **0.20% of amount** | [F] Costs | Bank's written fee schedule. **Assumed to go wholly to the AD-I bank**; company facts do not say who receives it. |
| I5 | Bank FX conversion margin (retained by bank) | Low **0.25%** · Base **0.50%** · High **0.75%** of amount | **[A] — negotiable, not market data** | The bank's quoted margin at our volumes (demo-brief question 4). These are negotiation parameters for the founder, not a claim about what any bank charges. |
| I6 | Share of customers who route the money through a **new** account at the partner bank | Low 50% · Base 70% · High 90% | [A] | Pilot data: count of customers whose NRO was already at the partner bank. Reasoning: the shortlist are small finance / regional banks, so most Canadian NRIs' existing NROs are likely elsewhere; Phase 1 per the demo brief is "customers who hold or open an NRO with you". |
| I7 | Days the money sits in that account before it leaves (transit float) | Low 10 · Base 15 · High 20 calendar days | [A] | Pilot timestamps: funds-in to SWIFT-out. Basis: Standard delivery ≤ 5 business days [F] plus Form 146 preparation time on larger tickets. |
| I8 | Bank's net earning on a rupee of deposit | **2.0% a year** (single placeholder) | **[A] — placeholder** | The bank's own funds-transfer-pricing rate for NRO/NRE balances. Only the bank knows it; ask in the first meeting. |
| I9 | Transfers per customer per year | 1.3 | [M] B5 | Pilot data. |
| I10 | REPAIHUB price, Standard, marginal tiers | ≤ ₹5L: CAD 9.99 + 1.05% · ₹5–25L: CAD 14.99 + 1.20% · > ₹25L: CAD 24.99 + 1.22% | [F]/[P] | Approved (Q-001 closed). |
| I11 | CA cost (Form 146) | $20 per file, only above ₹5 lakh | [F]/[P] | — |
| I12 | Fixed costs | ~CAD 3,800 / month | [F] | CFO's reconciled model (open backlog item). |
| I13 | Ticket mix (for "average transfer" figures) | 30% ₹1L · 30% ₹2L · 25% ₹5L · 10% ₹10L · 4% ₹25L · 1% ₹50L | [P] (founder's expected mix, an assumption) | Pilot data. |

---

## 2. Bank revenue — formulas

For one year with `T` transfers of average ticket `A` (₹):

```
Money moved                 V  = T × A
(a) Processing fee          Fa = 0.20% × V                         [I4]
(b) FX margin               Fb = s × V                             [I5, s = 0.25% / 0.50% / 0.75%]
(c) Transit float earnings  Fc = V × o × (d ÷ 365) × m             [I6 o, I7 d, I8 m]
Bank revenue (headline)     R  = Fa + Fb + Fc
CAD                         R ÷ 63.42                              [I3]
New accounts opened         N  = (T ÷ 1.3) × o                     [I9, I6]
```

Not in the headline total (no basis to size them yet; shown in §4 as upside):
- residual NRO/NRE balances customers leave with the bank after the transfer;
- other products to new account holders (FDs, NRE inflows, future transfers);
- the bank's own account-level charges.

### Worked example — Base, year 1
```
V  = 289 × ₹10,00,000                 = ₹28.90 crore   (CAD 4.56M)
Fa = 0.20% × ₹28.90 Cr                = ₹5,78,000      (CAD 9,114)
Fb = 0.50% × ₹28.90 Cr                = ₹14,45,000     (CAD 22,785)
Fc = ₹28.90 Cr × 0.70 × 15/365 × 2.0% = ₹1,66,274      (CAD 2,622)
R  = ₹21,89,274 ≈ ₹21.9 lakh          ≈ CAD 34,520
N  = 289 ÷ 1.3 × 0.70                 ≈ 156 new accounts
```

---

## 3. Bank revenue — scenarios (ESTIMATES)

Each scenario combines its own volume (I1) with its own FX margin, account share and float days (I5–I7). Ticket ₹10 lakh, deposit earning 2.0%, ₹63.42/CAD in all three.

| Scenario | Year | Transfers | Money moved | (a) Fee 0.20% | (b) FX margin | (c) Float | **Bank revenue (INR)** | **Bank revenue (CAD)** | New accounts |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Low (s 0.25%, o 50%, d 10) | 1 | 145 | ₹14.5 Cr | ₹2.90 L | ₹3.63 L | ₹0.40 L | **₹6.9 lakh** | **CAD 10,915** | 56 |
| | 2 | 400 | ₹40.0 Cr | ₹8.00 L | ₹10.00 L | ₹1.10 L | ₹19.1 lakh | CAD 30,110 | 154 |
| | 3 | 500 | ₹50.0 Cr | ₹10.00 L | ₹12.50 L | ₹1.37 L | **₹23.9 lakh** | **CAD 37,638** | 192 |
| **Base** (s 0.50%, o 70%, d 15) | 1 | 289 | ₹28.9 Cr | ₹5.78 L | ₹14.45 L | ₹1.66 L | **₹21.9 lakh** | **CAD 34,520** | 156 |
| | 2 | 720 | ₹72.0 Cr | ₹14.40 L | ₹36.00 L | ₹4.14 L | ₹54.5 lakh | CAD 86,002 | 388 |
| | 3 | 1,000 | ₹100.0 Cr | ₹20.00 L | ₹50.00 L | ₹5.75 L | **₹75.8 lakh** | **CAD 119,447** | 538 |
| High (s 0.75%, o 90%, d 20) | 1 | 578 | ₹57.8 Cr | ₹11.56 L | ₹43.35 L | ₹5.70 L | **₹60.6 lakh** | **CAD 95,571** | 400 |
| | 2 | 1,400 | ₹140.0 Cr | ₹28.00 L | ₹105.00 L | ₹13.81 L | ₹146.8 lakh | CAD 231,486 | 969 |
| | 3 | 2,000 | ₹200.0 Cr | ₹40.00 L | ₹150.00 L | ₹19.73 L | **₹2.10 crore** | **CAD 330,694** | 1,385 |

(L = lakh, Cr = crore.) Under a **fee-only** deal (no FX margin, Model 1 below), the bank keeps only (a) + (c): Base year 1 ≈ ₹7.4 lakh (CAD 11.7K), Base year 3 ≈ ₹25.8 lakh (CAD 40.6K).

**How to read it:** the FX margin (b) is 52–72% of the bank's estimated revenue across the scenarios, so the single number that matters most in the negotiation is the margin `s`. The float (c) is small (≈ 6–9% of the total) because money only passes through.

---

## 4. Upside not in the totals (method only)

| Item | Method | Why not sized |
|---|---|---|
| Residual balances | `N × average balance left × m` | No data on what NRIs leave behind after repatriating. Per **₹1 crore** of residual balance the bank earns ₹2 lakh/yr at the 2.0% placeholder. Capture in the pilot (with the customer's consent, as a count, not documents). |
| Repeat transfers | Already inside I9 (1.3/yr) | — |
| Large NRI-desk banks (HDFC/ICICI-type) | Same formulas, but `o` falls (many customers already bank there) and the value is **retention**: an existing NRO customer moves money out through the bank instead of through a competitor's route | Variant to prepare per bank once a named contact exists. |

---

## 5. Sensitivity — the ticket size

The market-sizing file uses ₹10 lakh average; the pricing decision's expected mix (I13) averages **₹4.65 lakh** (0.3×1 + 0.3×2 + 0.25×5 + 0.1×10 + 0.04×25 + 0.01×50). Same transfer counts, Base parameters:

| | ₹10 lakh ticket | ₹4.65 lakh ticket |
|---|---:|---:|
| Base year 1 bank revenue | ₹21.9 lakh / CAD 34,520 | ₹10.2 lakh / CAD 16,052 |
| Base year 3 bank revenue | ₹75.8 lakh / CAD 119,447 | ₹35.2 lakh / CAD 55,543 |

Bank revenue is proportional to money moved; the ticket assumption alone moves it by ~2×. Do not quote the ₹10 lakh case to a bank as an expectation.

---

## 6. Commercial models and REPAIHUB's unit economics

REPAIHUB net per transfer = REPAIHUB fee (I10) − 0.20% rail − CA $20 (above ₹5L) − whatever the model adds. Figures in CAD at ₹63.42.

**Important finding:** the approved pricing and its break-even (≈ 51 transfers/month) budget **only the 0.20% rail**. They contain **no bank FX margin**. Whoever pays the bank's FX margin has to be decided before any rate is shown to a customer.

| Model | What the bank gets | Who pays the FX margin | REPAIHUB net at ₹10L | REPAIHUB net, mix average (I13) | Break-even (CAD 3,800 ÷ mix net) | Customer all-in at ₹10L | Bank per ₹10L transfer |
|---|---|---|---:|---:|---:|---:|---:|
| **1. Fee only** | 0.20% processing fee; converts at a disclosed reference rate with no margin | nobody | **140.84** | **74.38** | 51/month | 1.22% | 31.54 + float |
| **2. Fee + capped, disclosed FX margin** | 0.20% + FX margin `s` (base 0.50%, cap proposed) | customer, shown as a separate line before confirming | **140.84** | **74.38** | 51/month | 1.22% + 0.50% = **1.72%** | 110.38 + float |
| 3. Fee + revenue share | 0.20% + **20% of REPAIHUB's percentage markup** [A: share is a negotiation parameter]; no FX margin | REPAIHUB (via the share) | 105.37 | 58.14 | 65/month | 1.22% | 67.01 + float |
| 4. Fee + FX margin absorbed by REPAIHUB | 0.20% + 0.50% margin; customer price held | REPAIHUB | 62.00 | 37.72 | 101/month | 1.22% | 110.38 + float |

Workings at ₹10 lakh (CAD 15,768):
```
REPAIHUB fee  = 14.99 + (5L × 1.05% + 5L × 1.20%) ÷ 63.42 = 14.99 + 177.39 = 192.38
Model 1/2 net = 192.38 − 0.20% × 15,768 (31.54) − 20                     = 140.84
Model 3 net   = 140.84 − 20% × 177.39 (35.48)                             = 105.37
Model 4 net   = 140.84 − 0.50% × 15,768 (78.84)                           =  62.00
Bank, Model 2 = 31.54 + 78.84                                             = 110.38
Bank, Model 3 = 31.54 + 35.48                                             =  67.01
```
Per ticket (net to REPAIHUB, CAD):

| Ticket | Model 1 / 2 | Model 3 | Model 4 | Customer all-in, Model 2 (s 0.50%) |
|---|---:|---:|---:|---:|
| ₹1 lakh | 23.39 | 20.08 | 15.51 | 2.18% |
| ₹2 lakh | 36.80 | 30.17 | 21.03 | 1.87% |
| ₹5 lakh | 77.00 | 60.45 | 37.58 | 1.68% |
| ₹10 lakh | 140.84 | 105.37 | 62.00 | 1.72% |
| ₹25 lakh | 377.36 | 285.12 | 180.26 | 1.71% |
| ₹50 lakh | 789.44 | 601.02 | 395.25 | 1.73% |

### Recommendation — DRAFT, terms require the founder's decision (Rule 2)

**Model 2: 0.20% processing fee + a capped FX margin retained by the bank, shown to the customer as its own line before they confirm.** Proposed negotiating position: total bank take **≤ 0.70% of amount** (0.20% fee + FX margin ≤ 0.50%); walk-away to be set by the founder.

Why:
1. It keeps the approved pricing, REPAIHUB's net (CAD 140.84 at ₹10L; CAD 74.38 on the expected mix) and the ≈ 51/month break-even **unchanged**.
2. It is what the demo brief already asks a bank for ("a transparent per-transfer fee and FX margin, so we can show the customer the rate before they confirm").
3. It gives the bank the largest share of the economics it controls (its own conversion), which is what makes the partnership worth the bank's onboarding effort; Model 1 leaves the bank ≈ CAD 32 per ₹10L transfer.
4. It is simple to reconcile: no monthly revenue-share statements.

Costs and risks of Model 2 the founder should weigh:
- The customer's all-in cost rises to ≈ 1.7–2.2% at a 0.50% margin. The positioning line ("roughly half the all-in cost of a typical Indian bank repatriation") **must be re-checked** against the bank's real margin before it is used again. Company facts give banks at "roughly 0.6–3.5% all-in"; a 1.7% REPAIHUB all-in is not half of the low end.
- Small tickets suffer most (₹1L → 2.18%). If the bank's margin is above 0.50%, revisit the ₹1–2 lakh base fee together with the pricing re-run after 50 pilot transfers.
- **Fallback:** if a bank wants a stake in growth, Model 3 at a share ≤ 20% of markup (break-even rises to ≈ 65/month). **Avoid Model 4** (break-even roughly doubles to ≈ 101/month).

---

## 7. Weakest assumptions (test first)

1. **Average ticket ₹10 lakh (I2).** The pricing mix implies ₹4.65 lakh; bank revenue halves. Test: amounts in the first 50 pre-checks.
2. **FX margin 0.25–0.75% (I5).** Not market data; it is a negotiation range and is the biggest component of the bank's revenue. Test: the bank's written quote.
3. **Volumes (I1).** Year-1 to year-3 transfer counts come from a model whose own weakest inputs (B4 repatriation rate, B2 NRO holding) have no public data. Test: waitlist conversion and the pilot run-rate.

Also soft: I6/I7/I8 (float), and the assumption that the 0.20% rail is paid to the AD-I bank.

## 8. Open questions for the bank (add to the meeting brief)
1. Your processing fee and FX margin for NRO outward remittances at these volumes; is a cap possible?
2. Your internal earning rate on NRO/NRE balances (to replace I8).
3. Who files Form 145 in your process, and how you verify the acknowledgement and the Form 146 UDIN.
4. Your reliance policy for third-party verified KYC (you will still do your own CDD on account holders).
5. File-based or API instruction, and how payment confirmations (SWIFT reference) come back to us.
