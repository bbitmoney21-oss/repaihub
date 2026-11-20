# Pricing decision — India → Canada (Q-001)

**Decided by:** Financial Analyst agent, under the founder's explicit delegation of 20 Nov 2026: "the finance/market agent selects the price; revenue first; reasonable for regular small-amount customers (₹1L, 2L, 5L); do not ask me."
**Peer review:** Data Analyst agent. Rule 1 check: the structure and numbers come from REPAIHUB's own tiers and costs, and nothing is taken from another company.
**Decision:** **adopt the tier pricing** from company facts. **Do not use the flat CAD 79 / 199 / 499.**

## The price
| Amount band | Standard (≤5 business days) | Express (≤3 business days) |
|---|---|---|
| Up to ₹5 lakh | CAD 9.99 + 1.05% | CAD 10.99 + 1.17% |
| ₹5–25 lakh | CAD 14.99 + 1.20% | CAD 15.99 + 1.22% |
| Above ₹25 lakh | CAD 24.99 + 1.22% | CAD 29.99 + 1.18% |

- Each percentage applies only to the part of the amount inside its band, like tax brackets.
- The base fee is the base fee of the band the amount falls in.

## The comparison (real arithmetic)
**Inputs:**
- Indicative rate: ₹63.42 per CAD (the site's reference rate).
- Costs, from company facts: bank rail 0.20% of the amount, plus CA $20 per Form 146 (above ₹5 lakh only).

| Ticket | CAD moved | Flat fee (% of amount) → net to REPAIHUB | Tier fee (% of amount) → net to REPAIHUB |
|---|---|---|---|
| ₹1 lakh | 1,577 | $79 (**5.01%**) → $76 | $26.55 (1.68%) → $23 |
| ₹2 lakh | 3,154 | $79 (**2.51%**) → $73 | $43.10 (1.37%) → $37 |
| ₹5 lakh | 7,884 | $79 (1.00%) → $63 | $92.77 (1.18%) → $77 |
| ₹10 lakh | 15,768 | $199 (1.26%) → $147 | $192.38 (1.22%) → $141 |
| ₹25 lakh | 39,420 | $199 (**0.50%**) → $100 | $476.20 (1.21%) → $377 |
| ₹50 lakh | 78,839 | $499 (0.63%) → $321 | $967.12 (1.23%) → $789 |

**On the founder's expected mix,** assuming most transfers are small (30% ₹1L, 30% ₹2L, 25% ₹5L, 10% ₹10L, 4% ₹25L, 1% ₹50L) and the same number of customers:

| | Average revenue per transfer | Average net per transfer | Break-even (CAD 3,800/month fixed) |
|---|---|---|---|
| Flat 79 / 199 / 499 | $100.0 | $82.3 | 46 transfers/month |
| Tier pricing | $92.0 | $74.4 | 51 transfers/month |

## Why the tier pricing wins
1. **The flat price fails the small customer, and the small customer is most of the volume.**
   - CAD 79 on ₹1 lakh is 5% of the money. On ₹2 lakh it is 2.5%.
   - Indian banks charge roughly 0.6–3.5% all-in.
   - A customer moving ₹1–2 lakh will not pay 2.5–5% to us when the bank is cheaper.
   - The flat model's small advantage at equal volume ($82 vs $74 net) only exists if those customers accept a price above the bank's. They will not.
   - **Tier pricing charges them 1.4–1.7%: below a typical bank, and an easy yes.**
2. **The flat price gives away the big tickets.**
   - ₹25 lakh at a flat $199 is 0.5%, about $100 net.
   - The tier price is 1.21%, about $377 net: **3.8× more on the transfers that carry the CA work and the risk.**
   - Revenue grows with the money moved, which is what pays for the CA team, the CFO, support and the company.
3. **It is fair at every size.**
   - The effective fee stays between 1.2% and 1.7% from ₹1 lakh to ₹50 lakh.
   - There is no cliff, because the markups are marginal. That is easy to explain and hard to attack.
4. **It matches the positioning line.** "Roughly half the all-in cost of a typical Indian bank repatriation, and comparable to Wise — except Wise cannot move NRO money."
5. **The revenue-first test.**
   - Tier pricing needs about 51 transfers a month to break even, vs about 46 for flat at equal volume.
   - But it is the only option that can win the high-volume ₹1–5 lakh segment the founder expects.
   - It also earns 3–4× more per large ticket.

## Related settings, decided with the price
- **Express:** priced inside the tiers (its own base and rates). The separate CAD 24 surcharge is set to 0.
- **Free first transfer for referred users:** **kept.**
  - It now waives only the base fee (CAD 9.99–24.99), and the markup is still charged. At ₹2 lakh, a referred customer's first transfer still pays CAD 33 and nets about $27.
  - It is a cheap way to acquire a customer.
- **Minimum transfer:** the stale ₹5 lakh value in the fee settings was corrected to ₹10,000, matching the app. It was never enforced.

## Implementation (20 Nov 2026)
- **Shared calculator:** `src/lib/outwardPricing.ts`, used by the server fee engine (`src/services/feeService.ts`), the new-transfer screen, the Fees page, the landing calculator and the help assistant.
- **Database:** migration `026_marginal_tier_pricing.sql` applied to Supabase. The old tier rows were deactivated, not deleted. Rollback: `026_marginal_tier_pricing.rollback.sql`.
- **Removed a wrong 5% "TCS" deduction** from the new-transfer preview. TCS does not apply to NRO repatriation; TDS is settled before the transfer.
- **Delivery times updated everywhere** to the company facts: Standard up to 5 business days, Express up to 3.

## Watch
- **Actual ticket mix:** if real transfers turn out mostly above ₹10 lakh, revenue beats this model. If they are mostly ₹1 lakh, the base fee may need to rise to about CAD 14.99 to cover support cost. Re-run this model after the first 50 pilot transfers.
- **FX rate:** the CAD amounts above use ₹63.42/CAD. Customers always see the exact fee at the live rate before confirming.
