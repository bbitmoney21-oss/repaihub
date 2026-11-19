# CFO sources — REPAIHUB

## Price ($288 per transfer, blended) — computed, ESTIMATE of the mix
In-product tiers (migration 025): ≤₹5L 1.80%, ₹5–10L 2.00%, ₹10–20L 1.75%, ₹20–50L 1.25%, ₹50L+ 1.00%; flat CAD $24.99, waived ≥₹30L and on first transfer. FX working rate ₹63/CAD (landing page shows ₹63.42).
Assumed transfer mix (ESTIMATE, from the panel segments): 35% ₹3L, 35% ₹8L, 20% ₹15L, 10% ₹40L → average ₹10.85L.
- ₹3L: ₹5,400 = $85.7 + $24.99
- ₹8L: ₹16,000 = $254.0 + $24.99
- ₹15L: ₹26,250 = $416.7 + $24.99
- ₹40L: ₹50,000 = $793.7 (flat waived)
Weighted = $304. Less first-transfer flat waivers (≈70% of year-1 transfers are first transfers × 90% that pay flat × $24.99 ≈ $15.7) → **$288**.

## Variable costs
- Partner share 0.5%: `fee_config.commission_rate_partner = 0.5` (src/services/feeService.ts). 0.5% × ₹10.85L = ₹5,425 = $86. **Real AD-bank fee unknown — must be quoted.**
- CA Form 146: public range ₹2,500–₹15,000 ([assetlyhq](https://assetlyhq.com/blog/form-15ca-15cb-nri-property-sale-repatriation-guide/), [indiafornri](https://indiafornri.com/tax/repatriation)); bulk rate ₹3,000 is an ESTIMATE to negotiate.
- Nostro ₹1,180: [BookMyForex](https://www.bookmyforex.com/money-transfer/nro-repatriation/) (published for NRE; used as proxy).
- KYC/API, payout, support: ESTIMATES — get Setu, Flinks and Fable rate cards.

## Fixed and startup
All ESTIMATES for a bootstrapped, founder-unpaid operation. Founder salary = $0 (founder has full-time income). No hires in year 1.

## Ramp (ESTIMATE, sanity-checked against the panel)
Monthly completed transfers: 3, 5, 8, 12, 16, 20, 25, 30, 35, 40, 45, 50 (= 289 in year 1). Steady-state plan 60/month (2/day).
