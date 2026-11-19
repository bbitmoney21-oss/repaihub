# REPAIHUB — Founder pack run (2026-11-19)

**Verdict: NOT YET** — 3 of 4 computed checks pass; simulated buy rate 22% vs 25% bar. Start with `summary.md`, then `one-pager.md`, then `business-plan.md` (everything compiled).

| Step | File(s) | Headline |
|---|---|---|
| Board | `board.md`, `board/` | 3 × FUND IF, avg 4.7/10 — no AD bank, two prices, no proof |
| Competitors | `competitors.md/.csv` | Gap = end-to-end, Canada-based, paperwork included; it's a convenience gap, not a price gap |
| Consumer panel v1 | `panel-v1/`, `pitch-v1.md` | Original % pricing: **0 / 20 buy** |
| Pricing | `pricing.md`, `pricing-curve*.md` | Acceptable fee for ₹10L: $59–$260; old $342 above range |
| Offer + panel v2 | `offer.md`, `pitch.md`, `panel/` | Flat fees + pay-on-arrival + CA pre-check: **15 / 69 buy (22%)** |
| CFO | `cfo.md`, `numbers.json`, `cfo-sources.md` (`cfo-v1.md` = old pricing) | $81/transfer; year 1 +$865 ops, –$19.1K after startup; cash need $26.1K |
| Marketing | `marketing.md` | Lead with tax-anxious + busy buyers; accountants as referral channel |
| Brand | `brand.md` | "REPAIHUB" is heard as "Repair Hub" — lead with a product name |
| Ops | `ops.md` | AD bank is the critical path; AML/PEP screening must go live; check RPAA |
| Launch | `launch.md` | Paperwork-Only Pilot now; public launch target 2027-04-05 (contingent) |

**Panel v2 is incomplete:** 69 of 100 buyers ran before the session usage limit. To finish: `python3 .claude/skills/founder-consumer/panel.py prompts` (rewrites briefs for the 31 missing only), run one sub-agent per brief, then `panel.py tally`, `/founder-pricing`, and `compile.py --dir founder`.

Simulated buyers are not customers; most CFO inputs are estimates. Not financial, legal or tax advice.
