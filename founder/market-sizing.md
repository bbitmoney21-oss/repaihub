# REPAIHUB market sizing: NRO → Canada (primary), USA (secondary)

Prepared 2026-11-20 by the marketing director (founder-marketing). Replaces the rough "size of the prize" in `market-assessment.md` §2 with a sourced, two-method model.

**How to read this.** Every input is either **[S]** sourced (link given) or **[A]** an assumption (labelled, with the range tested). All money is **CAD per year** unless marked. Fee-pool figures use REPAIHUB's own blended price of **CAD $187 per transfer** (`numbers.json`: 35% × $79, 55% × $199, 10% × $499), so "TAM" means *the fees the whole market would pay if every transfer were sold at REPAIHUB's prices*. Simulated-panel results are not customer data.

**Method note (honesty).** Page fetching was blocked from this session (statcan.gc.ca, rbi.org.in, news sites failed DNS), and the search tool cannot reach reddit.com. Numbers below were taken from search-engine extracts of the linked pages. Each link is the page the number comes from; open it to confirm before any number goes into a pitch deck.

---

## 0. Summary

| | Canada (primary) | USA (secondary) |
|---|---:|---:|
| **TAM** (fee pool at REPAIHUB prices) | **≈ CAD 4.5M/yr** (range 1.6–14.8M) · ≈ 24K transfers · ≈ CAD 370M moved | **≈ CAD 10–11M/yr** · ≈ 52–59K transfers |
| **SAM** (reachable by an online, Canada-based, English, paid service) | **≈ CAD 2.3M/yr** · ≈ 12.5K transfers | **CAD 0 today** (no US licence); ≈ CAD 5.3M if licensed/partnered |
| **SOM** year 3 (base) | **≈ CAD 187K** · 1,000 transfers · 8% of SAM | CAD 0 (base); ≈ CAD 30K paperwork-only (high case) |
| Break-even (current fixed costs, founder unpaid) | **24 transfers/month (279/yr) ≈ 2% of Canada SAM** | — |
| Break-even incl. CAD 80K founder salary | **106 transfers/month (1,270/yr) ≈ 10% of Canada SAM** | — |

**Verdict:** a real, profitable **small business** in Canada (low six figures revenue by year 3), **not a venture-scale company on NRO repatriation alone**. The four-country repatriation fee pool (CA + US + UK + AU) is ≈ CAD 20M/yr; even with adjacent services that roughly doubles revenue per customer, a realistic ceiling is ≈ CAD 2–4M revenue. See §6.

---

## 1. Inputs

### 1.1 Population

| # | Input | Value | Type | Source |
|---|---|---:|---|---|
| P1 | India-born immigrants in Canada, 2021 Census | **898,045** (10.7% of immigrants; #1 place of birth) | S | [StatCan Focus on Geography, 2021](https://www12.statcan.gc.ca/census-recensement/2021/as-sa/fogs-spg/page.cfm?lang=E&topic=9&dguid=2021A000011124); [Census Profile](https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/details/page.cfm?LANG=E&GENDERlist=1&STATISTIClist=1%2C4&DGUIDlist=2021A000011124&HEADERlist=31%2C30%2C25&SearchText=Canada) |
| P2 | Recent immigrants (2016–21) born in India | 246,995 (18.6%) | S | [StatCan Daily, 2022-10-26](https://www150.statcan.gc.ca/n1/daily-quotidien/221026/dq221026a-eng.htm) |
| P3 | People reporting Indian (India) ethnic origin, 2021 | 1,347,715 (single + multiple responses; includes Canada-born) | S | [Census Profile](https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/details/page.cfm?LANG=E&GENDERlist=1&STATISTIClist=1%2C4&DGUIDlist=2021A000011124&HEADERlist=31%2C30%2C25&SearchText=Canada). The 1.86M "Indian Canadians" figure in `market-assessment.md` is from a Wikipedia mirror and could not be confirmed against StatCan; **use 898K/1.35M instead.** |
| P4 | South Asian population, 2021 | 2.57M (7.1%) | S | [StatCan Daily, 2025-12-08](https://www150.statcan.gc.ca/daily-quotidien/251208/dq251208b-eng.htm) |
| P5 | New PRs from India: 2021 / 2022 / 2023 / 2024 / 2025 | 127,940 / 118,095 / 139,715 / 127,360 / ≈98,825 (–22%) | S | [immigration.ca (2021–22)](https://immigration.ca/rise-and-fall-of-indian-citizens-as-new-permanent-residents-of-canada/); [CIC News (2022)](https://cicnews.com/2023/02/ircc-unveils-the-top-10-source-countries-of-new-immigrants-to-canada-in-2022-0233180.html); [moving2canada (2023)](https://moving2canada.com/news-and-features/features/immigration/canada-pr-report/); [SMU/IRCC newsletter (2024)](https://ftp.smu.ca/webfiles/ARGEIADNewsletterApril2025.pdf); [immigrationnewscanada (2025)](https://immigrationnewscanada.ca/canada-permanent-resident-drop-in-2026/), [immigration2canada](https://www.immigration2canada.com/canada-immigration-down-19-in-2025-indian-arrivals-drop-22/). 2025 is a secondary-source figure; confirm on IRCC open data. |
| P6 | Q1 2026 PRs from India | 21,565 (vs 31,690 Q1 2025) | S | [immigration.ca](https://immigration.ca/?p=330501) |
| P7 | Indians granted Canadian citizenship, 2024 | ≈87,812 (23.4% of 374,832) | S | [getgis.org (citing IRCC via Times of India)](https://getgis.org/news/indians-got-canadian-citizenship-most-from-any-nation) |
| P8 | Study permits to Indian nationals: 2024 → 2025 | 188,715 → 94,605 (≈ –50%) | S | [Tribune India](https://www.tribuneindia.com/news/diaspora/indian-students-see-50-per-cent-drop-in-canadian-study-permits-in-2025/) |
| P9 | **India-born permanent residents/citizens in Canada, end-2025 (derived)** | **≈1.42M** | A (derived) | P1 + PRs after census day (≈80K of 2021 [A: ~⅔ of 2021 landings after 11 May] + 118K + 140K + 127K + 99K ≈ 564K) = 1.46M, less ≈3% deaths/onward migration [A] → **1.42M**. Excludes temporary residents (students/workers), who mostly hold small balances. |
| P10 | Indian immigrants in the USA, 2024 | **≈3.2M** (6% of US foreign-born) | S | [Migration Policy Institute](https://www.migrationpolicy.org/article/indian-immigrants-united-states-2024) |
| P11 | People in the US identifying as Indian, 2023 | ≈5.2M | S | [Pew Research](https://www.pewresearch.org/race-ethnicity/fact-sheet/asian-americans-indians-in-the-u-s/) |
| P12 | Indian emigrants worldwide, 2024 (UN DESA) | ≈18.5M; USA and UAE each ≈17% | S | [Data For India (UN DESA migrant stock)](https://www.dataforindia.com/international-migration/) |
| P13 | India-born in England & Wales, 2021 | 920,361 | S | [Scroll (ONS 2021)](https://scroll.in/latest/1037027/scroll_in) |
| P14 | India-born in Australia, 2021 | 673,352 | S | [ABS QuickStats](https://www.abs.gov.au/census/find-census-data/quickstats/2021/7103_AUS) |

### 1.2 Money

| # | Input | Value | Type | Source |
|---|---|---:|---|---|
| M1 | NRO deposits outstanding, all countries | **USD 34.59B** (end-July 2026); USD 34.26B (end-June 2026); USD 33.33B (Mar 2026) | S | [Morung Express / PTI, RBI data](https://morungexpress.com/nri-deposit-inflows-surge-nearly-7-fold-to-3624-billion-in-april-july-fy27-rbi-data); [RBI Handbook table](https://rbi.org.in/Scripts/PublicationsView.aspx?id=23964) |
| M2 | NRO net inflows | FY25: USD 4.4B; Apr–Dec 2025: USD 4.10B | S | [Business Standard (FY25)](https://www.business-standard.com/amp/economy/news/nri-deposits-rise-9-9-percent-fy25-fcnr-nre-nro-inflows-hit-16-billion-125052200446_1.html); [Business Standard (Apr–Dec 2025)](https://www.business-standard.com/finance/news/nri-deposit-flows-fall-16-to-11-2-bn-in-apr-dec-2025-shows-rbi-data-126022001182_1.html) |
| M3 | NRO share of all NRI deposits | 11.7% (FY19) → 20.1% (FY26), fastest-growing | S | [Bank of Baroda research, Jun 2026](https://www.barodaetrade.com/Reports/BOBEconomics-NRIDepositsTrend18Jun26-Research.pdf) |
| M4 | **Gross NRO outward repatriation (USD 1M scheme)** | **Not published** by RBI in any source found | — | Searched RBI bulletin/BoP coverage; none break out NRO outward remittances. LRS (USD 28.9B FY26, [report](https://www.business-standard.com/economy/news/lrs-outward-remittances-fy26-travel-education-investment-125082900590_1.html)) covers *residents* and is **not** a proxy. |
| M5 | Share of NRO stock repatriated abroad per year | **10% base** (5–15% tested) | **A** | No data (M4). Bounded by M2: NRO net inflows are ≈13% of stock a year and the stock still grows, so outflows of all kinds cannot be a very large share. |
| M6 | Form 15CA (now Form 145) filings, all remitters | ≈44–45 lakh (4.4–4.5M) per year, 5-yr average | S | [Income Tax Dept (CBDT) via taxguru](https://taxguru.in/?p=1070507); [Business Today](https://businesstoday.in/latest/corporate/story/income-tax-dept-identifies-suspicious-entities-sending-money-abroad-394-entities-under-scanner-549884-2026-08-18). Mostly business payments; not split by NRO. Used only as a ceiling sanity check. |
| M7 | Form 15CA/15CB renumbered 145/146 from 1 Apr 2026, substance unchanged; CA certificate needed above ₹5L in a year where chargeable | — | S | [BDO India](https://www.bdo.in/en-gb/news/2026/new-tax-declaration-forms-introduced-for-nri-remittances); [Income Tax Dept Form 146](https://www.incometaxindia.gov.in/documents/d/guest/fn-146) |
| M8 | NRO repatriation cap | USD 1M per financial year, all NRO accounts combined, net of tax | S | [RBI circular](https://website.rbi.org.in/documents/87730/39710850/08MCNF29062013.pdf); [Belong](https://getbelong.com/blog/rbi-rules-nri-accounts/) |

### 1.3 Behaviour and price

| # | Input | Value | Type | Source |
|---|---|---:|---|---|
| B1 | Share of India-born adults (18+) | Canada 85%, USA 90% | A | Immigrant age profile skews adult; not looked up |
| B2 | **Share of India-born adults holding an NRO account** | **50% base** (35–70%) | **A** | Only data: a WiseNRI reader survey found ≈85% of respondents hold NRO ([WiseNRI](https://wisenri.com/?p=5097)). Self-selected, finance-engaged sample, so cut hard. |
| B3 | NRO holders per household | 1.6 | A | Couples often both hold accounts; one household = one customer decision |
| B4 | **Share of NRO households that repatriate in a given year** | **5% base** (3–10%) | **A** | No data. Panel (`panel/results.md`): money "has sat for years" is the dominant pattern; property sales/inheritance are lumpy triggers |
| B5 | Transfers per repatriating household per year | 1.3 (1.1–1.5) | A | Panel says 1.0 in first month; large sums split across tranches (P020, P013 "send one tranche first") |
| B6 | Average transfer | ₹10L ≈ USD 11.4K | A | `cfo-sources.md` mix averages ₹10.85L; ₹88/USD [A] |
| B7 | FX | 1 USD = 1.38 CAD; 1 CAD = ₹63 | A | Working rates (₹63 from `cfo-sources.md`) |
| B8 | REPAIHUB blended price / contribution | CAD 187 / CAD 81 per transfer | S (internal) | `founder/numbers.json`, `founder/cfo.md` |
| B9 | DIY visible cost: bank fee + CA certificate | Bank ₹100–1,500; ICICI ₹500+GST; CA Form 146 from ₹2,499 (consultancy) to ₹3,000–10,000 (typical) and ₹5,000–15,000 for property sales | S | [ICICI FAQ](https://www.icici.bank.in/personal-banking/faq/accounts/outward-remittance-faqs); [SBI charges PDF](https://sbi.co.in/webfiles/uploads/nri/NRI_SERVICE%20CHARGES.pdf); [Patron Accounting](https://www.patronaccounting.com/foreign-remittance-certificate-15ca-15cb); [eximpe](https://eximpe.com/blog/payments/form-15ca-15cb-form-145-146); [assetlyhq](https://assetlyhq.com/blog/form-15ca-15cb-nri-property-sale-repatriation-guide/) |

---

## 2. Canada

### 2.1 TAM: top-down (from NRO deposits)

```
Canada share of Indian emigrants   = P9 / P12          = 1.42M / 18.5M      = 7.7%
NRO balances held from Canada      = M1 × 7.7%         = USD 34.59B × 7.7%  = USD 2.66B
Repatriated per year               = × M5 (10%)        =                     USD 266M  (≈ CAD 367M)
Transfers per year                 = ÷ B6 (USD 11.4K)  =                     ≈ 23,300
Fee pool at REPAIHUB prices        = × CAD 187         =                     ≈ CAD 4.4M / yr
```
Range on M5 (5–15%): 11.7K–35K transfers → **CAD 2.2M–6.5M**.

Bias to note: allocating NRO balances by headcount ignores that a large share of Indian emigrants live in the Gulf (the UAE alone ≈17%, [Data For India](https://www.dataforindia.com/international-migration/)), mostly on temporary status, and may hold proportionally more or less in NRO. Western-country NRIs are wealthier and more likely to own Indian property, which would push Canada's share **up**; no data found to adjust it.

### 2.2 TAM: bottom-up (from people)

```
India-born residents (P9)                         1,420,000
× adults (B1 85%)                               = 1,207,000
× hold an NRO (B2 50%)                          =   603,500 NRO holders
÷ holders per household (B3 1.6)                =   377,000 NRO households
× repatriate this year (B4 5%)                  =    18,900 households
× transfers each (B5 1.3)                       =    24,500 transfers / yr
× CAD 187                                       ≈ CAD 4.6M / yr
```
| Case | B2 | B4 | B5 | Transfers/yr | Fee pool |
|---|---:|---:|---:|---:|---:|
| Low | 35% | 3% | 1.1 | 8,700 | **CAD 1.6M** |
| **Base** | 50% | 5% | 1.3 | 24,500 | **CAD 4.6M** |
| High | 70% | 10% | 1.5 | 79,200 | **CAD 14.8M** |

**The two methods agree at ≈ CAD 4.4–4.6M and ≈ 23–25K transfers a year.** Use **TAM ≈ CAD 4.5M/yr**, ≈ 24K transfers, ≈ CAD 370M of money moved. Sanity check: 24K is ≈ 0.5% of India's 4.4M annual Form 15CA filings (M6), which is plausible for one mid-sized corridor.

What the market pays **today** (DIY, not at REPAIHUB prices): bank ≈ ₹1,000 + CA ≈ ₹3,000–10,000 on the ≈65% of transfers that need Form 146 ⇒ ≈ CAD 50–120 per transfer ⇒ **≈ CAD 1.2–2.9M/yr** of visible spend. REPAIHUB's fee pool is larger than today's spend because it charges for convenience, the CA call and the guarantee. That premium is what has to be proved (`competitors.md` §5: "a convenience gap, not a price gap").

### 2.3 SAM (who a Canada-based, online, English, paid service can actually sell to)

```
TAM transfers                                     24,000
× outside Quebec until licensing confirmed  0.97 [A: Quebec's share of India-born not looked up; small]
× not "bank-only" / "WhatsApp-first"        0.70 [panel: these 30% of buyers bought 0%]
× willing to pay over DIY / a relative      0.75 [A]
= SAM                                       ≈ 12,200 transfers ≈ CAD 2.3M / yr
```

### 2.4 SOM (what REPAIHUB can realistically win)

| | Year 1 | Year 2 | Year 3 |
|---|---:|---:|---:|
| Transfers (base) | 289 | 720 | 1,000 |
| Share of SAM | 2.4% | 5.9% | **8.2%** |
| Revenue (base) | CAD 54K | CAD 135K | **CAD 187K** |

Why not more: no brand, 46/100 panel buyers cited trust as the reason to pass, and the one funded rival (Aspora) can enter. Why not less: the gap (end-to-end + CA + Canada hours) is open today and accountant referrals are a cheap channel.

---

## 3. USA (secondary)

### 3.1 TAM

Top-down: USA share of emigrants 3.2M / 18.5M = 17.3% → USD 34.59B × 17.3% = USD 5.98B in NRO → × 10% = USD 598M/yr → ÷ USD 11.4K = **≈ 52,500 transfers → CAD 9.8M/yr**.

Bottom-up: 3.2M × 90% adults × 50% NRO ÷ 1.6 × 5% × 1.3 = **≈ 58,500 transfers → CAD 10.9M/yr**.

**TAM ≈ CAD 10–11M/yr** (≈ 2.3× Canada). US Indians have higher incomes (MPI: 6% poverty vs 14% for all immigrants), so ticket sizes and willingness to pay are probably higher. Not quantified.

### 3.2 SAM and SOM

- Moving the money for US residents needs FinCEN registration **plus state money-transmitter licences** (49 states require a surety bond; estimates for all states run from ≈USD 175K to USD 1.1–1.5M plus USD 100–500K net worth: [Faisal Khan pricing](https://faisalkhan.com/pricing/us-state-money-transmitter-license-pricing), [SuretyBonds](https://www.suretybonds.com/guide/federal/money-transmitter-license), [Faisal Khan video](https://faisalkhan.com/resources/videos/how-much-do-money-transmitter-licenses-cost)). Get a US payments lawyer's view before relying on these.
- **SAM today: CAD 0** for transfers. If licensed or partnered: 51% × TAM ≈ **CAD 5.3M**.
- **Paperwork-only route** (Form 145/146, TDS check, CA call; the customer's own Indian bank sends the money): plausible at ≈ CAD 99 [A]. High-case year 3: 300 customers ≈ CAD 30K. Needs legal review: no money handling, so likely no MSB licence, but unconfirmed.
- **SOM years 1–3: CAD 0 base.**

---

## 4. Demand signals

| Signal | What it shows | Link | Strength |
|---|---|---|---|
| Quora: "How do I repatriate money from an NRO account" | Recurring how-to question; answers send people to a CA | [Quora](https://www.quora.com/How-do-I-repatriate-money-from-an-NRO-account) | Medium (evergreen; dated answers) |
| Quora: "Is form 15CB mandatory to remit funds from NRO A/C?" | Confusion about which form applies | [Quora](https://www.quora.com/What-are-the-documents-required-for-remittance-frm-NRO-A-C-to-outside-India-Is-form-15CB-mandatory-to-remit-funds-from-NRO-A-C-Is-an-NRO-A-C-holder-in-any-case-eligible-to-make-remittance-from-his-NRO-account-by) | Medium |
| Quora: "Are there limits on repatriating funds from NRO accounts?" | Answers contradict each other ("₹0" vs "USD 1M") | [Quora](https://www.quora.com/Are-there-limits-on-repatriating-funds-from-NRO-Accounts) | Medium: misinformation is the pain |
| Quora (Income Tax space): "Can NRI transfer money from NRO to his account outside India? Is NRE necessary?" | Same confusion | [Quora](https://incometax.quora.com/Can-NRI-transfer-money-from-NRO-account-to-his-account-outside-India-Whether-NRE-account-is-necessary) | Medium |
| NRIinformation Q.868: "Get Indian bank to wire transfer funds abroad to NRI in Canada" | Canada-specific: user told to visit the branch | [nriinformation.com](https://nriinformation.com/questions13/question868.htm) | Thin (single case) |
| Belong guide: an NRI spent six weeks trying to move ₹15L to a Canadian bank; 15CB alone 7–10 days | Time cost | [Belong](https://getbelong.com/blog/nre-account/repatriation/) | Thin (vendor anecdote) |
| "Property sale proceeds stuck: Form 15CA/15CB" consumer guide | Stuck transfers exist often enough to get their own guide | [righttoinformation.wiki](https://righttoinformation.wiki/practical-guides/nri-property-sale-proceeds-nro-repatriation-stuck-form-15ca-15cb?do=diff) | Thin |
| CBDT verification of suspicious foreign remittances (Aug 2026), including professionals who issued Form 15CB | Raises the stakes of using a careless CA, which supports the "CA you can verify" message (state it neutrally; never imply customers are under scrutiny) | [Business Today](https://www.businesstoday.in/personal-finance/story/can-a-ca-be-exposed-by-a-clients-suspicious-foreign-remittance-what-form-15cb-means-551526-2026-08-26), [SCC Online](https://www.scconline.com/blog/post/2026/08/20/income-tax-department-verification-suspicious-foreign-remittances/) | Medium (a reason to act now) |
| Forms renumbered 145/146 from 1 Apr 2026 | Natural content hook; people search the old names | [BDO](https://www.bdo.in/en-gb/news/2026/new-tax-declaration-forms-introduced-for-nri-remittances) | Medium |
| NRI share of Indian housing sales rising (≈20–25% of major developers' sales, secondary sources) | More NRI property means more future sales to repatriate (Phase 2) | [Business Standard citing Anarock](https://www.business-standard.com/markets/news/rupee-fall-boosts-nri-investments-in-luxury-and-ultra-luxury-properties-125030900443_1.html) | Medium (indirect) |

**Gaps, stated plainly:**
- **Reddit** (r/IndiaInvestments, r/PersonalFinanceCanada, r/nri, r/ABCDesis) **could not be searched**: reddit.com blocks this research tool. **Founder action:** search each subreddit manually for "NRO", "15CB", "repatriate"; log 30 threads (date, upvotes, pain in one line) into this file. That is the strongest free demand evidence available.
- **Facebook groups and RedFlagDeals:** no threads surfaced. Check manually.
- **Google search volume:** not measured; no public tool reached. **Founder action:** run Google Keyword Planner (free with an Ads account) for "NRO to Canada", "NRO repatriation", "15CB", "Form 146", "transfer money from India to Canada NRO", geo = Canada and USA, and record the monthly volumes here. That converts the B4 assumption into a data point.

---

## 5. Competitor volume signals and share REPAIHUB can take

| Player | Volume / scale signal | NRO→Canada today? | Source |
|---|---|---|---|
| **Aspora** | ≈250K users (mainly UAE); transaction volume reported rising from USD 400M to USD 2B+ over six months (2025); USD 93M raised; plans for US, then Canada/Australia/Singapore | **Not confirmed live in Canada for NRO-outward**; one report says it has a regulated Canadian entity | [YourStory](https://yourstory.com/2025/06/nri-diaspora-fintech-aspora-banking-services-series-b-funding-round), [FF News](https://ffnews.com/newsarticle/funding/fintech-startup-aspora-secures-53-million-in-series-b-to-transform-banking-for-global-indians), [DealStreetAsia](https://dealstreetasia.com/stories/aspora-sequoia-445922) |
| ICICI Bank (NRO outward) | Largest NRI bank in the WiseNRI reader survey (31.5% of respondents; HDFC 20.2%); no public NRO-outward volumes | Yes, for its own NRO holders; customer brings CA certificate | [WiseNRI](https://wisenri.com/?p=5097), [ICICI FAQ](https://www.icici.bank.in/personal-banking/faq/accounts/outward-remittance-faqs) |
| SBI | Publishes an NRO outward-remittance request form (NRI 11.2); no public volumes | Yes, branch/forms-led | [SBI form](https://sbi.co.in/webfiles/uploads/nri/NRI_11.2.pdf) |
| Wise | Not for NRO→abroad (India→Canada only for Indian tax residents) | No | [Wise help](https://www.wise.com/help/articles/2932151/inr-transfers) |
| BookMyForex | Requires opening an NRO at its partner bank | Yes (assisted) | [BookMyForex](https://www.bookmyforex.com/money-transfer/nro-repatriation/) |
| CA firms (Form 146) | Fragmented; consultancies list from ₹2,499 per remittance | Paperwork only | [Patron Accounting](https://www.patronaccounting.com/foreign-remittance-certificate-15ca-15cb) |

No competitor publishes NRO→Canada volumes. Banks are the default for nearly all of the ≈24K Canadian transfers; REPAIHUB takes share from the **DIY bank + own-CA** route, not from another specialist.

**Realistic share:** year 1 ≈ 1% of TAM / 2.4% of SAM; year 3 ≈ 4% of TAM / 8% of SAM (base), up to 16% of SAM (high) if accountant referrals and property-sale lump sums work. If Aspora launches NRO-outward in Canada, assume the year-3 base halves unless REPAIHUB has moved upmarket to concierge and property sales.

---

## 6. Revenue the market supports for REPAIHUB

### 6.1 Break-even (from `numbers.json`)

```
Fixed costs                 CAD 1,880 / month
Contribution per transfer   CAD 81
Break-even                  1,880 ÷ 81 = 23.2  →  24 transfers / month  (279 / yr ≈ 2.3% of Canada SAM)

With a CAD 80K founder salary (6,667/month, ASSUMPTION):
(1,880 + 6,667) ÷ 81 = 105.5 → 106 transfers / month (1,270 / yr ≈ 10% of Canada SAM)
```
Keeping the business open needs ≈ 2% of the reachable market. **Paying the founder a full-time salary needs ≈ 10%**, which is the real hurdle.

### 6.2 Scenarios (CAD 187 blended; contribution CAD 81; fixed held at CAD 22,560/yr)

| | Y1 transfers | Y1 revenue | Y2 transfers | Y2 revenue | Y3 transfers | **Y3 revenue** | Y3 operating profit* | Y3 share of SAM |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Low (half CFO ramp) | 145 | 27K | 400 | 75K | 500 | **94K** | 18K | 4% |
| **Base** (CFO ramp, then 60/mo plan) | 289 | 54K | 720 | 135K | 1,000 | **187K** | **58K** | 8% |
| High (2× ramp + property-sale concierge mix + US paperwork) | 578 | 108K | 1,400 | 262K | 2,000 + 300 US | **≈404K** | ≈150K | 16% |

\*Contribution × transfers − CAD 22,560 fixed, **founder unpaid**, before tax. Fixed costs will rise with volume (compliance, support), so treat the high case as optimistic. Year 1 base matches `cfo.md` (CAD 54,080).

---

## 7. Verdict and how it grows

**Big enough for a real, profitable small company in Canada. Not big enough for a venture-scale company on NRO repatriation alone.**

- Canada's whole fee pool is ≈ CAD 4.5M/yr. Even an excellent 15–20% share is ≈ CAD 0.7–0.9M revenue.
- The base path reaches ≈ CAD 187K revenue and ≈ CAD 58K operating profit in year 3: a good side business, or one modest salary at ≈ 1,270 transfers/yr.

**What grows it (ranked by value ÷ effort):**

| # | Expansion | Size signal | Effort | Read |
|---|---|---|---|---|
| 1 | **Property-sale and inheritance concierge (Phase 2)** | Lump sums of ₹20L–1Cr+; panel's best segment (32% buy, `panel/results.md`); CA fees for property cases run ₹5–15K, so a CAD 499–999 concierge tier is credible | Low: same licence, same customer | **Do first.** Raises blended price; 5 points of mix to Concierge ≈ +CAD 21/transfer (`cfo.md`) |
| 2 | **Adjacent annual services for the same customer**: Indian ITR filing and TDS refunds, Section 197 lower-TDS certificate before a sale, T1135 summary for the Canadian accountant | Recurring, annual; turns one-off transfers into a relationship | Low–medium (CA partner does the work) | Could roughly double revenue per customer [A] |
| 3 | **USA** | TAM ≈ 2.3× Canada (CAD 10–11M) | **High**: state licences (≈USD 0.2–1.5M + net worth) or a licensed partner | Start paperwork-only, then partner. Do not self-license before Canada is profitable |
| 4 | **UK and Australia** | 920K + 673K India-born. At Canada's ≈ CAD 3.2 of fee pool per India-born resident [A, derived: 4.5M ÷ 1.42M]: UK ≈ CAD 2.9M, AU ≈ CAD 2.1M | High: new licences (FCA, AUSTRAC) | Year 4+; or license the software and process to a local partner |

**Four-country ceiling:** CA 4.5 + US 10.5 + UK 2.9 + AU 2.1 ≈ **CAD 20M/yr repatriation fee pool**; with adjacent services ≈ CAD 40M [A]. A strong 5–10% share ⇒ **CAD 2–4M revenue**: a solid company with a small team, but not a typical venture outcome unless it becomes a broader diaspora-finance platform, which is where Aspora is already heading with far more capital.

---

## 8. Weakest assumptions (test these first)

1. **B4 / M5: how often money actually moves** (5% of NRO households a year; 10% of NRO stock). No public NRO-outflow data exists. Each ±1 point of B4 moves Canada's TAM by ≈ ±CAD 0.9M. *Test:* Google Keyword Planner volumes, waitlist-to-booking rate, and asking 2–3 Indian banks' NRI desks (as a prospective partner) for corridor volumes.
2. **B2: share of India-born adults holding an NRO** (50%). The only data is a self-selected blog survey (≈85%). *Test:* add one question to the waitlist form ("Do you have an NRO account? Roughly how much?").
3. **Canada's share of NRO balances = its share of emigrants (7.7%)**, and the ₹10L average ticket. Gulf versus Western differences in NRO use are unknown, and ticket size drives how many transfers a given balance becomes. *Test:* record the actual amounts customers ask to move in the first 50 pre-checks.

Also soft: the SAM haircuts (0.70 × 0.75) come from a **simulated** panel; the 2025 India PR figure is secondary-sourced; US licensing costs come from vendor estimates.

Not financial, tax or legal advice.
