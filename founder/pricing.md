# Pricing — REPAIHUB Safe Passage

Inputs: `pricing-curve-v1.md` (20 buyers, original pitch), `pricing-curve.md` (100 buyers, offer v2), `competitors.md`, `numbers.json` / `cfo.md`. All price answers are **the total CAD fee a buyer would pay to move ₹10 lakh**. Simulated buyers pick what to test; they are not proof.

## What buyers said

| | v1 panel (20) | v2 panel (100) |
|---|---:|---:|
| Too cheap below (PMC) | $60.80 | $59.31 |
| Least resistance (OPP) | $81.20 | $60.26 |
| Indifference (IPP) | $150.50 | $119.63 |
| Too expensive above (PME) | $300.32 | $249.84 |
| Median "getting expensive" | $250 | $250 |
| Median "too expensive" | $400 | $400 |

The original in-product price for ₹10L (2.00% + $24.99 = **$342**) is **above** the acceptable range. A flat **$199** is **inside** it.

## What competitors charge (same job, ₹10L)
Visible DIY cost ≈ **$50–$260** (bank wire ₹100–₹1,500 + CA certificate ₹2,500–₹15,000), plus the bank's FX markup (unpublished) and the customer's time/branch visit. See `competitors.md`.

## What the business needs (from the CFO tool)
Variable cost per Standard transfer ≈ $94 (bank fee, nostro, CA certificate, pre-check call, guarantee reserve, APIs, payout, support). At a blended $99 the business loses $7 per transfer; at $149 it makes $43; at $199 it makes $93 (`unit_economics.py --price`). **Anything under ~$100 for a CA-certified transfer is below cost.** The panel's least-resistance point ($60) is not a viable price for the Standard tier.

## 1. The price
**Standard (₹5L–₹25L, CA certificate included): CAD $199 flat.** Inside the acceptable range ($59–$250), above the indifference point ($120), below the median "getting expensive" ($250), and it leaves $105 contribution on that tier. It also makes the comparison honest: one price vs "CA + bank + a day off".

## 2. The ladder
| Tier | Amount | Price | Why step up |
|---|---|---:|---|
| Essential | up to ₹5L (no CA certificate needed) | **$79** | — |
| Standard | ₹5L–₹25L | **$199** | CA-certified Form 146 included |
| Lump-Sum Concierge | ₹25L to USD 1M/FY | **$499** | Written tax-position memo from the CA, a named person end-to-end, tranche planning across the financial year |

Test Concierge at $699 too: lump-sum buyers' "too expensive" answers ran to $450–$600 for only ₹10L.

## 3. The opening offer
**Founding 100: Standard at $149**, ends at the 100th completed transfer or 60 days after launch, whichever comes first. Contribution at $149 stays positive (~$55 on Standard). No "was $X" anchors — $199 must be the price actually charged after.

## 4. What to test with real buyers
- **$149 vs $199** for Standard: two landing-page variants, same traffic source (accountant referrals), measure booked CA pre-check calls.
- **$499 vs $699** Concierge: offer on the CA call only to ₹25L+ customers; measure accept rate.

## 5. The panel's top price objections (verbatim, research only — never use in ads)
1. "$199 on ten lakh is about 1.25% before I even see the exchange rate." (P016)
2. "My relative in India can sort this out for free… CAD $149–199 on top of the bank's rate… does not add up for me." (P010)
3. "the 'no extra margin' rate may still be worse than Wise or my own bank, and on a lump sum a rate gap would cost me more than the fee" (P041, paraphrase of objection field)

**The FX rate is now the hidden price objection.** Before launch, show the partner bank's rate next to the mid-market rate and the total landed CAD on every quote.

## Action
The live app and landing page still show two different prices (1.0–2.0% + $24.99 in `outward_fee_tiers`; $8/$12/$15 on `Landing.tsx`). Change both to the ladder above **only after** the AD-bank fee is quoted and the CFO re-run confirms it. (No code was changed in this run.)

## Decision (2026-11-19)
Bhagi delegated the call: **adopt the recommended ladder**: Essential CAD $79 (≤ ₹5L), Standard CAD $199 (₹5L–₹25L, CA certificate included), Lump-Sum Concierge CAD $499 (> ₹25L), plus a Founding 100 offer of Standard at $149. These are fees REPAIHUB charges customers on arrival of funds. Re-check once the AD-bank fee is quoted (CFO re-run). The backend fee tables (`fee_config`, `outward_fee_tiers`) still use the old % model; changing them needs a migration and Bhagi's explicit go-ahead under `.claude/rules.md`.
