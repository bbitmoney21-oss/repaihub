# Is REPAIHUB good and scalable? — market assessment (2026-11-19)

## Market sizing update (2026-11-20)
Full sourced model: [`market-sizing.md`](market-sizing.md). It supersedes §2 below.
- **Canada TAM ≈ CAD 4.5M/yr** in fees at REPAIHUB prices (≈24K transfers, ≈CAD 370M moved; top-down and bottom-up agree; range CAD 1.6–14.8M). **SAM ≈ CAD 2.3M** (≈12K transfers). **SOM year 3 (base) ≈ CAD 187K** (1,000 transfers, 8% of SAM).
- **USA TAM ≈ CAD 10–11M/yr**, but SAM is CAD 0 until a US licence or licensed partner exists.
- **Break-even: 24 transfers/month** (≈2% of Canada SAM). Paying a CAD 80K founder salary needs 106/month (≈10% of SAM).
- Population correction: the 2021 Census counts **898,045 India-born immigrants** (≈1.42M by end-2025 with new PRs). The 1.86M figure below came from a Wikipedia mirror and is not confirmed by StatCan.
- Verdict unchanged: profitable small business, not venture-scale on NRO repatriation alone. Growth comes from property-sale/inheritance concierge, then adjacent annual tax services, then the USA.
- Weakest assumptions: share of NRO households that repatriate each year (5%), share of India-born adults holding NRO (50%), and Canada's share of NRO balances (7.7%).

Sources are linked. **Estimates are marked ESTIMATE**, with the arithmetic shown. Simulated-panel results are not customer data.

## Verdict
**The idea is real but niche. It works as a profitable small business in Canada. It does not become a large company on NRO repatriation alone.** Getting big needs (a) the US, which is expensive to enter, and (b) more services around the same customer.

## 1. How many people
| Market | Number | Source |
|---|---:|---|
| South Asian Canadians | 2.57M (2021) | [Statistics Canada](https://www150.statcan.gc.ca/n1/daily-quotidien/251208/dq251208b-eng.htm) |
| Indian-origin Canadians | ~1.86M (2021) | [Wikipedia mirror of the census; verify with StatCan](https://www.doc.surf/wiki/indian-canadians) |
| New Indian PRs in Canada | ~127K (2024), falling ~22% in 2025 | [SMU/IRCC newsletter](https://smuca-lb01-production.terminalfour.net/webfiles/ARGEIADNewsletterApril2025.pdf), [immigration2canada](https://www.immigration2canada.com/canada-immigration-down-19-in-2025-indian-arrivals-drop-22/) |
| Indian-born residents of the US | ~3.2M (2024) | [Migration Policy Institute](https://www.migrationpolicy.org/article/indian-immigrants-united-states-2024) |
| People in the US identifying as Indian | ~5.2M (2023) | [Pew / Census](https://www.pewresearch.org/race-ethnicity/fact-sheet/asian-americans-indians-in-the-u-s/) |
| **Money sitting in NRO accounts (all countries)** | **USD 34.3B** (end-June 2026) | [RBI data, reported](https://morungexpress.com/nri-deposit-inflows-surge-nearly-7-fold-to-3624-billion-in-april-july-fy27-rbi-data) |

"How many are interested" cannot be counted from public data. The only signals today: the simulated panel (20% upper bound on the improved offer; 32% among lump-sum sellers) and your waitlist sign-ups (Formspree; **send me the count**).

## 2. Size of the prize — ESTIMATE
- The US plus Canada hold ~7M of a ~35M Indian diaspora (≈20%). If NRO balances follow population: **≈USD 6.9B in NRO accounts held by US + Canada residents** (34.3B × 20%).
- If 10–20% of that is repatriated each year: **USD 0.7–1.4B a year moving**.
- At an average transfer of ≈USD 12K (₹10L) that is **≈57K–115K transfers a year**. At REPAIHUB's proposed fees (~CAD 187 blended): **≈CAD 11–21M a year in fees across the whole market**.
- Canada alone (≈27% of that diaspora): **≈CAD 3–6M a year**. Win 5–10% of Canada and you have **≈CAD 150–600K revenue a year**. That's a good side business or a small company, not a venture-scale one.

## 3. Exact competitors (verified)
| Competitor | What they do | Threat |
|---|---|---|
| **Aspora (ex-Vance)** | Diaspora banking app, Sequoia/Greylock-backed, ~USD 93M raised; digital NRE/NRO accounts via Shivalik Small Finance Bank; FINTRAC MSB in Canada; stated expansion to US/Canada ([TechCrunch](https://techcrunch.com/2025/11/17/sequoia-backed-fintech-aspora-will-let-indian-diaspora-pay-bills-back-home), [DealStreetAsia](https://dealstreetasia.com/stories/aspora-sequoia-445922), [Aspora](https://www.aspora.com/nri-banking)) | **Highest.** Has money, a bank partner and Canadian registration. An NRO→abroad feature is a product decision for them. |
| Indian banks' NRI desks (ICICI ₹500+GST online; SBI) | Repatriation for their own account holders; customer brings own CA | High for small amounts, weak on service |
| BookMyForex | Assisted NRO repatriation; must open an NRO at its partner bank | Medium |
| Belong | NRI investing via GIFT City; US expansion planned ([Inc](https://incbusiness.in/startups/nri-focused-fintech-belong-raises-5m-in-seed-round-led-by-elevation-capital/)) | Low–medium |
| SBNRI | NRI help, content, tax and paperwork | Medium (content and SEO) |
| CA firms (15CA/15CB, ₹2.5K–15K) | Paperwork only | Low (they're future partners) |
| **Remittances Hub (Kelowna, MSB M23799972)** | B2B payments, unrelated | **Name confusion** with "REPAIHUB". Never quote their number. |

**No public player does end-to-end, Canada-based NRO→Canada with the paperwork included.** That's your gap. Aspora is the one most likely to close it.

## 4. Scalability — what's true
1. **Canada is regulated and done.** REPAIHUB Remittance Inc. is a FINTRAC-registered MSB, **N300002485** (approved 2026-11-02, expires 2029-07-31; checked on the official registry CSV). Still to confirm with counsel: Bank of Canada RPAA PSP registration, and Quebec licensing.
2. **The US is expensive.** Money transmission in the US needs FinCEN MSB registration plus state money-transmitter licences (most states), with surety bonds and net-worth requirements. Realistic routes: partner with a licensed US transmitter, or serve US customers only as a paperwork service while the bank and a licensed partner move the money. **Ask a US payments lawyer before promising "Canada and USA".**
3. **The real scaling lever is the customer, not the corridor.** The same person also needs: property-sale paperwork, Indian tax filing, NRE/NRO account opening, Canadian T1135 reporting, and later insurance (your LLQP licence fits here, with proper disclosure). Revenue per customer grows; acquisition cost stays the same.
4. **Volume risk:** Indian PR inflows to Canada fell sharply in 2025–26. The pool of *new* customers is shrinking; the *existing* 1.86M is the market.

## 5. What would make me change this verdict
- More than 25% of real waitlist sign-ups book a paid pre-check: demand is stronger than estimated.
- A bank partner offers a fee under ₹1,000 and API access: margins improve materially.
- Aspora launches NRO→Canada: you must move to concierge and lump-sum transfers, or partner with them.
