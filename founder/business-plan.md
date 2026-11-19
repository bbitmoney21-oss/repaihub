# REPAIHUB · Business plan

**Verdict: Not yet**

- ✓ Each transfer earns $81.00 before fixed costs (43% contribution).
- ✓ Year 1 operating profit: $865.
- ✓ Break-even is 1 transfers a day against a capacity of 10.
- ✗ 20 of 100 simulated buyers buy (20%, the bar is 25%).

| key number | |
| --- | ---: |
| Price | $187.00 a transfer |
| Profit margin at plan | 27% per transfer |
| Break-even | 1 transfers a day |
| Year 1 operating profit | $865 |
| Startup spend | $20,000 |
| Cash needed before it pays for itself | $26,080 |
| Startup money earned back | not in year 1 |
| Buyer panel | 20 buy · 80 pass |

## The idea

- What it is: A Canada-based digital service that moves an Indian-origin Canadian's savings out of their Indian NRO account into their Canadian bank account — legally, with the Indian tax paperwork (Form 145, formerly 15CA; Form 146, formerly 15CB, certified by a partner Chartered Accountant) handled for them, and no branch visit in India.
- Who it is for: Indian-origin residents of Canada (PRs, new Canadian citizens/OCI holders, long-term work-permit holders) who hold money in an Indian NRO account — rent from an Indian property, proceeds of a property sale, inheritance, matured FDs, pension or dividends — and want it in Canada. Secondary: small Canada→India inward transfers.
- What it sells, at what price: Outward NRO repatriation (India → Canada), priced as a percentage of the amount plus a flat fee, as configured in the product today (migration 025):
  - up to ₹5L: 1.80% + CAD $24.99
  - ₹5L–₹10L: 2.00% + $24.99 (CA-certified Form 146 included)
  - ₹10L–₹20L: 1.75% + $24.99
  - ₹20L–₹50L: 1.25% + $24.99 (flat fee waived at ₹30L+)
  - ₹50L+: 1.00%, no flat fee
  - First transfer flat fee waived; Express (8–12 h) +$24; no FX spread charged on outward.
  - Of the commission, 0.5 percentage points goes to the payment/banking partner; REPAIHUB keeps the rest.
  - NOTE: the public landing page calculator currently shows a different price (flat $8 / $12 / $15 CAD by amount, no percentage). The two must be reconciled before launch.
- Where and how: Online, Canada-wide (web app; mobile later). Customer links Canadian bank (Flinks / Fable Fintech) and Indian NRO account (Setu DigiLocker KYC, PAN verification), enters amount, REPAIHUB orchestrates forms and the transfer; CAD lands in 24–48 h. Legal limit: USD 1M per Indian financial year per person. Acquisition today: a waitlist on the landing page; founder content brand on Instagram.
- Budget and constraints:
  - Solo founder (Bhagi), full-time SAP test lead; builds evenings and weekends; operating it as an "AI-operated company".
  - Bootstrapped from personal income; cash for the venture is tight. Exact startup budget: NOT YET GIVEN (open question).
  - Pre-launch. FINTRAC MSB registration submitted (not yet registered). No Indian Authorised Dealer (AD Category-I) bank partner signed yet — the transfer cannot legally run without one. Canadian payment rail: Fable Fintech (in discussion). India KYC: Setu.
  - Product is built (React + Express + Supabase on Render), with a demo mode.

## Summary

**Verdict: NOT YET** (computed by `compile.py`). Three of four checks pass. The one that fails: **20% of simulated buyers buy (20 of 100), below the 25% bar.** Simulated buy rates are an upper bound, so the real number is likely lower.

**What has to change:** build *proof*, not product. The remaining "no" reason is "nobody I know has used it" (trust, 31 of 54 passes). That is fixed by real completed customers and accountants vouching for the service, not by more features. Next steps: `/founder-launch` (Paperwork-Only Pilot), then re-run `/founder-consumer` with real pilot proof in the pitch.

**What it is:** a Canada-based, done-for-you service that moves an Indian-origin Canadian's NRO savings to their Canadian bank account. Form 145/146 and the CA certificate are handled, with no branch visit. Flat fees: $79 / $199 / $499.

**The numbers (ESTIMATES, `cfo.md`):** contribution **$81 per transfer (43%)**; break-even **≈ 23 transfers/month**; year 1 **+$865** operating profit on $54,080 revenue, which is **–$19,135 after $20,000 startup**; **cash needed $26,080**. Volume decides everything: 2× the ramp gives +$24,290 in year 1.

**Board vs panel:**
- Board: 3 × FUND IF, average 4.7/10.
- They agree on trust. Both say the bank partner, the single price and proof are what's missing. Changing the offer moved the panel from 0% (v1) to 20% (v2).
- They disagree on scope. The board's Product lens wants a narrower v1. The panel's best buyers are tax-anxious (71%) and busy (60%) people, a *service* audience, which supports deepening the service (CA call, guarantee) rather than adding features.

**Biggest risk:** no AD Category-I bank partner. Without one, nothing legally moves. Plan: pitch 6 banks now and run a paperwork-only pilot to show demand. The pilot needs counsel's sign-off first.

**What the founder needs to start:** about $26K cash over year 1 before it pays for itself (CFO). The first test (pilot) needs about $1–2K: counsel opinion, CA retainer, booking page.

**The one thing to do this week:** send the partnership one-pager to six Indian AD Category-I banks, and book a counsel call on MSB/RPAA scope and the pilot.

*The panel is simulated buyers and the numbers are projections built on estimated inputs. Real customers and real quotes confirm them. Not financial, legal or tax advice.*

## What the board said

**Vote: 3 FUND IF, 0 FUND, 0 PASS · average score 4.7 / 10** (Offers 5, Monopoly 4, Product 5)

Memos: `board/offers.md`, `board/monopoly.md`, `board/product.md`. The lenses are summaries of published frameworks; no member speaks for any real person.

### Risks raised by more than one member (most dangerous first)

1. **No AD Category-I bank partner (all three).** Without one the transfer cannot legally run. The partner also sets the unit cost (unknown) and could cut REPAIHUB out. *Today the offer's "likelihood" is zero.*
2. **Two public prices (all three).** Landing page: flat $8 / $12 / $15. App: 1.0–2.0% + $24.99. On a money product, a mismatch on price breaks trust. The 5L–10L slab (2.00%) costing more per rupee than under 5L (1.80%) is also hard to explain.
3. **No proof on a high-stakes purchase (Offers, Product).** Someone sending ₹20–50L through a pre-launch, one-person app needs a named bank, a guarantee and completed transfers.
4. **Distribution and capacity unproven (Monopoly, Product).** A waitlist and an Instagram account; customer acquisition cost unknown; part-time solo founder; no defined exception path for a stuck transfer.
5. **FINTRAC MSB registration not yet granted (all three).**

### Disagreements worth keeping

- Monopoly sees the compliance know-how as a real moat; Offers warns that without a stacked offer it still drifts to "cheaper than a bank".
- Product wants inward transfers, Express and mobile **cut** from v1. Offers wants **more** stacked in (tax position check, TDS certificates, property-sale checklist, records for Canadian tax). Both are compatible: narrow the product, deepen the service around the one job.

### Conditions checklist (the rest of the pack tests these)

- [ ] Signed AD Category-I bank partner, with a known per-transfer fee and terms that don't make REPAIHUB easy to bypass — *ops, cfo*
- [ ] FINTRAC MSB registration granted — *ops, launch*
- [ ] One price, shown the same everywhere, explainable in one sentence — *pricing*
- [ ] Full cost of one transfer known (bank fee, partner 0.5%, CA fee per Form 146, KYC calls) — *cfo, ops*
- [ ] A written guarantee the CFO can afford — *offer, cfo*
- [ ] 5–10 completed paid transfers as proof before scaling — *launch*
- [ ] Named beachhead segment with paid deposits / committed sign-ups and a measured cost per customer — *consumer, marketing, launch*
- [ ] v1 scope = outward NRO→Canada only (inward, Express, mobile later) — *ops, plan*
- [ ] Written exception path for every handoff, named responder, response time — *ops*
- [ ] Plan for which durable advantage is built first (CA network, referral loop, brand, data) — *marketing, plan*

### The strongest version the board can see

Not "a remittance app". A **concierge-grade, fixed-price-feeling repatriation service** for one clear moment: an Indian-origin Canadian who has a lump sum in India — usually **property sale proceeds or an inheritance, ₹10L–₹1Cr** — and dreads the branch, the CA and the paperwork. One sentence, one price, one bank named on the page, a CA-certified Form 146 included, live tracking, a human who answers, and a guarantee. Small-ticket transfers and inward remittance are where Wise and the banks already win; leave them. This differs from the current pitch, which leads with speed and "no branch visit" for everyone and carries two sets of prices.

## The competition

Research date 2026-11-19, public web sources only, every fact linked. No ratings/review counts were collected (no review pages for these services surfaced in search); that gap is noted, not filled.

### 1. Who is there (sorted by how directly they compete)

| # | Name | Type | Comparable price | Notes |
|---|---|---|---|---|
| 1 | ICICI Bank NRO outward | Direct (bank) | **₹500 + GST** online NRO→overseas ([ICICI FAQ](https://www.icici.bank.in/personal-banking/faq/accounts/outward-remittance-faqs)) | Only for ICICI NRO holders; customer arranges own 15CA/15CB + CA |
| 2 | SBI NRI services | Direct (bank) | ₹100 + out-of-pocket FCY wire; "Express Remit Canada" ₹250 ([SBI PDF](https://sbi.co.in/webfiles/uploads/nri/NRI_SERVICE%20CHARGES.pdf)) | Branch-led; paperwork on customer |
| 3 | BookMyForex NRO repatriation | Direct (fintech) | NRO fee unpublished; NRE: ₹320 + GST + ₹1,180 nostro ([BMF](https://www.bookmyforex.com/money-transfer/nro-repatriation/)) | Must open an NRO at its partner bank; 5–6 working-day coordination call; ~48 working hours |
| 4 | SBNRI | Direct (NRI platform) | Not found ([SBNRI](https://sbnri.com/blog/repatriation)) | Content-led NRI help desk, India-based |
| 5 | CA firms (Form 15CB/146) | Indirect | **₹2,500–₹15,000** per certificate ([assetlyhq](https://assetlyhq.com/blog/form-15ca-15cb-nri-property-sale-repatriation-guide/), [indiafornri](https://indiafornri.com/tax/repatriation)) | Paperwork only |
| 6 | Aspora (Nesse Technologies, Toronto) | Indirect — **biggest threat** | No NRO-outward product found ([Aspora legal](https://legal.aspora.com/)) | FINTRAC MSB + Bank of Canada PSP, diaspora brand, funded; could add NRO-outward |
| 7 | Wise | Indirect | Canada→India incl. to NRO; India→Canada only for Indian tax residents, not NRO ([Wise help](https://www.wise.com/help/articles/2932151/inr-transfers)) | Owns the small-ticket Canada→India route |
| 8 | Belong | Indirect | Not published ([Belong](https://getbelong.com/blog/belong-nri-investment-gift-city.md)) | GIFT City investing, sidesteps NRO for new money |
| 9 | Abound | Indirect | Reportedly not available from Canada ([Wise blog — competitor source](https://wise.com/ca/blog/abound-canada-transfer-alternatives)) | US-focused |
| S1 | Informal swap via friend/relative | Substitute | "Free", non-compliant | The founder's own pitch says "so you ask a friend" |
| S2 | DIY during a trip to India | Substitute | Flight + leave + CA + bank fee | The default for many |

### 2. Price range for the comparable job

Explicit **bank fee** to wire NRO → Canada: **₹100 – ₹1,500** (≈ CAD $1.60 – $24 at ₹63/CAD, working rate). Plus the **CA certificate** for > ₹5L: **₹2,500 – ₹15,000** (≈ $40 – $240). Banks also apply their own FX rate; the markup was not published in any source found — **open question; get a real quote.**

So the all-in visible DIY cost for a ₹10L transfer is roughly **₹3,000 – ₹16,500 (≈ $50 – $260)** plus the FX markup and the customer's time. REPAIHUB today at ₹10L: 1.80% / 2.00% band edge → ≈ ₹18,000–20,000 + $24.99 ≈ **$310–$345**. At ₹50L: 1.25% = ₹62,500 ≈ **$990**; DIY is still ≈ $260 + FX markup. **Percentage pricing gets harder to justify as the ticket grows, because the DIY cost is mostly fixed.**

### 3. Positioning map (text)

Axes that matter to this buyer: **effort/hassle for the customer** (low ↔ high) and **visible price** (low ↔ high).

```
                 low hassle
                     |
       (gap)         |        REPAIHUB (planned)
   low price --------+-------- high price
   ICICI/SBI online  |  BookMyForex (assisted)
   (own customers,   |  CA firm + branch
   DIY forms)        |
                 high hassle — DIY trip, informal swap (illegal)
```

Nobody public sits at **low hassle + end-to-end + Canada-based support**. The banks are cheap but hand the paperwork and the CA to the customer and often require a branch.

### 4. Complaints (themes, from guides — thin evidence, no review data)

1. **Takes weeks** — one guide describes an NRI trying for six weeks to move ₹15L to a Canadian bank; 15CB alone "7–10 days" ([Belong guide](https://getbelong.com/blog/nre-account/repatriation/)). *Thin (single anecdote).*
2. **Branches interpret rules differently / RMs unfamiliar with NRI rules; online systems fail for repatriation** ([consumer guide](https://righttoinformation.wiki/practical-guides/nri-property-sale-proceeds-nro-repatriation-stuck-form-15ca-15cb?do=diff), [Instarem](https://www.instarem.com/blog/indian-bank-remittance-rejections-fixes/)). *Thin.*
3. **Generic CAs ask for unnecessary documents and delay** ([guide](https://calcguru.in/?p=2937)). *Thin.*
4. **Banks won't explain holds** — compliance reasons often can't be disclosed ([Instarem](https://www.instarem.com/blog/indian-bank-remittance-rejections-fixes/)). *Thin.*
5. **First-time repatriation usually needs a branch visit** (HDFC, per third-party blog — not authoritative). *Thin.*

All themes are marked thin: they come from guides, not counted reviews. **Next real step: read 30+ Reddit/Google reviews of ICICI/SBI/HDFC NRI desks and record counts.**

### 5. The gap

**An end-to-end, Canada-based, compliance-included NRO→Canada service, for any Indian bank, with a human on Canadian hours and live status.** Evidence: banks only serve their own customers and push the CA and paperwork back to the customer; BookMyForex makes you open a new NRO at its partner bank; Wise/Abound don't do this route from Canada. This gap is real but **it is a convenience gap, not a price gap** — the banks' visible fees are tiny. REPAIHUB must win on "done for me, guaranteed, fast", not "cheap".

### 6. The threat — who could copy fastest

1. **Aspora** — already a Toronto-registered FINTRAC MSB with diaspora distribution; adding an NRO-outward corridor is a product decision for them.
2. **The AD bank partner itself** — once it sees the volume, it can white-label the flow.
3. **BookMyForex** — already has the partner bank and process; needs only Canada marketing.

## The buyer panel

**20 buy · 80 pass** (20% buy) out of 100 simulated buyers. Seed 2027, so the same cards can be dealt again.

These are simulated buyers, not customers. Use this to find objections and weak spots, then confirm the big ones with real people before you spend.

### By segment

| group | buyers | buy rate |
| --- | ---: | ---: |
| Property seller / inheritor with a lump sum (₹20L-₹1Cr waiting in NRO) | 25 | 32% |
| Newer immigrant (PR < 5 yrs) with modest NRO balance (under ₹5L) | 25 | 20% |
| Settled mid-career professional with old FDs, rent or savings in NRO (₹5L-₹20L) | 35 | 14% |
| Retiree / parent-age with Indian pension or rental income (₹3L-₹15L a year) | 15 | 13% |

### By buying behaviour

| group | buyers | buy rate |
| --- | ---: | ---: |
| Busy, pays for convenience | 15 | 67% |
| Tax-anxious | 10 | 50% |
| Price comparer | 15 | 13% |
| Family-network fixer | 18 | 11% |
| Procrastinator | 12 | 8% |
| Trusts only big banks | 20 | 0% |
| Asks the WhatsApp group first | 10 | 0% |

### By income

| group | buyers | buy rate |
| --- | ---: | ---: |
| $129,000 and up | 34 | 26% |
| under $76,000 | 33 | 18% |
| $76,000 to $129,000 | 33 | 15% |

### Why they pass

| reason | buyers | in their words |
| --- | ---: | --- |
| trust | 46 | "I have never heard of REPAIHUB and I only move money through my own bank's NRI desk. My NRO balance is small, so I would not risk it with a new company over a few hundred dollars of savings." (P002) · "I have never heard of them and nobody in our WhatsApp group or temple association has used them. I do not move money on a stranger's advertisement, however nice the guarantee sounds." (P004) |
| habit | 21 | "My cousin in India already handles this kind of thing for me and doesn't charge a rupee. Paying $199 to a company I've never heard of, when I have a person I trust, doesn't make sense to me." (P011) · "The money has sat in NRO for years and I keep saying I'll sort it on the next trip. It sounds sensible, but I wouldn't actually get around to it this month, and I'd want to check it with my accountant first." (P012) |
| price | 8 | "My relative in India can sort this out for free, and I compare everything to the paisa. Paying CAD $149-199 on top of the bank's rate to move a sum my family could help me with does not add up for me." (P010) · "The regulated bank and CA details are reassuring, but I compare to the paisa and $199 on ten lakh is about 1.25% before I even see the exchange rate. I visit India every two years and can do some of this at my own branch, so I would not move money this month." (P016) |
| timing | 5 | "It sounds sensible, but I've let this money sit for years and I'd just say I'll sort it on my next trip. Nothing about it makes me act this month." (P001) · "It reads sensible and the fee is small next to the money, but my NRO has sat for years because I keep saying 'next trip'. I'd bookmark it and not start a transfer this month." (P042) |

### Why they buy

| reason | buyers | in their words |
| --- | ---: | --- |
| convenience | 9 | "I don't want to chase forms, a CA in India or a trip, and nothing is charged until the money lands, so the downside is small. The free CA call before anything moves is what gets me past my tax worry." (P021) · "I have a pile of money sitting in an SBI NRO account I never log into, and I'd happily pay a few hundred dollars not to deal with forms, a CA and time zones. Fee only when the money lands plus a refund guarantee makes it low-risk to try." (P023) |
| trust | 8 | "My lump sum from the property is big enough that I don't want to gamble it on a cousin's informal swap. A named RBI-authorised bank, a FINTRAC number and fee-only-on-arrival is what I'd want, and the fee is small next to the amount." (P003) · "Fee only on arrival plus the refund guarantee takes most of the risk off me, and the free CA call is what I'd want anyway. At about 1.25% to skip the forms and an India trip, I'd try it once with ten lakh before moving more." (P013) |
| need | 3 | "I have a lump sum sitting in NRO and I am scared of getting the TDS and 15CA/15CB paperwork wrong, so a CA call before anything moves and a fee taken only on arrival lowers the risk enough to try it. I would still check the FINTRAC number and the bank name myself, and probably send one tranche first." (P020) · "The free call with a CA and the Form 145/146 filing are exactly what I'm scared of getting wrong with TDS and T1135, and fee-only-on-arrival means little risk for a first small transfer. I'd start with the Essential tier on my own balance and see how it goes." (P066) |

### What would flip a no

- A real deadline, like a tax or rule change, or a friend who has already used it and says it worked smoothly.
- If my own Indian bank or a big Canadian bank referred me to them or offered the service itself, and a CA I could check confirmed in writing what tax I owe in India and what I must report in Canada.
- Two or three people in my community group saying they used it and the money arrived, plus the free CA call explaining my tax position clearly.
- Hearing from someone in my community who has moved a similar amount through them without trouble, plus a live side-by-side showing the total landed CAD against my relative doing it, with the fee at about $100 or under.
- Two or three people in my community or temple group saying they used it and the money arrived, plus a fee under about CAD $50 for my small balance.
- Verified reviews from people who moved a property-sale lump sum, a CA I can check independently, and my own Indian bank confirming they accept this paperwork and the partner bank.
- Two or three people in my community WhatsApp group or temple association saying they moved money with you and it arrived, plus proof my Indian bank will not need a branch visit.
- Someone I trust, like a friend or relative who already moved NRO money this way, telling me it worked. A fee I only pay after the money lands, and being able to verify the FINTRAC registration and the named bank.
- A fee under about CAD $60 for 10 lakh, plus proof the partner bank's rate is no worse than what my own bank gives, or my relative being unable to handle it.
- If my relative could no longer do it, or if the tax paperwork (Form 145/146) became too complex or risky for him to handle, and I could verify the company through someone I know who has used it.
- A person in my community, or my own accountant, who has used it and tells me it went through without trouble. Or a clear step-by-step on what happens if the CA rejects something while my money is already moving.
- My Canadian accountant and my Indian bank's NRI desk both confirming this route is fine, plus a named big bank handling the funds and a way to check the FINTRAC registration myself.

Buyers say they would buy **1.0 times** in the first month on average.

100 buyers gave all four price answers. Run founder-pricing's van_westendorp.py on the answers folder.

## Pricing

Inputs: `pricing-curve-v1.md` (20 buyers, original pitch), `pricing-curve.md` (100 buyers, offer v2), `competitors.md`, `numbers.json` / `cfo.md`. All price answers are **the total CAD fee a buyer would pay to move ₹10 lakh**. Simulated buyers pick what to test; they are not proof.

### What buyers said

| | v1 panel (20) | v2 panel (100) |
|---|---:|---:|
| Too cheap below (PMC) | $60.80 | $59.31 |
| Least resistance (OPP) | $81.20 | $60.26 |
| Indifference (IPP) | $150.50 | $119.63 |
| Too expensive above (PME) | $300.32 | $249.84 |
| Median "getting expensive" | $250 | $250 |
| Median "too expensive" | $400 | $400 |

The original in-product price for ₹10L (2.00% + $24.99 = **$342**) is **above** the acceptable range. A flat **$199** is **inside** it.

### What competitors charge (same job, ₹10L)
Visible DIY cost ≈ **$50–$260** (bank wire ₹100–₹1,500 + CA certificate ₹2,500–₹15,000), plus the bank's FX markup (unpublished) and the customer's time/branch visit. See `competitors.md`.

### What the business needs (from the CFO tool)
Variable cost per Standard transfer ≈ $94 (bank fee, nostro, CA certificate, pre-check call, guarantee reserve, APIs, payout, support). At a blended $99 the business loses $7 per transfer; at $149 it makes $43; at $199 it makes $93 (`unit_economics.py --price`). **Anything under ~$100 for a CA-certified transfer is below cost.** The panel's least-resistance point ($60) is not a viable price for the Standard tier.

### 1. The price
**Standard (₹5L–₹25L, CA certificate included): CAD $199 flat.** Inside the acceptable range ($59–$250), above the indifference point ($120), below the median "getting expensive" ($250), and it leaves $105 contribution on that tier. It also makes the comparison honest: one price vs "CA + bank + a day off".

### 2. The ladder
| Tier | Amount | Price | Why step up |
|---|---|---:|---|
| Essential | up to ₹5L (no CA certificate needed) | **$79** | — |
| Standard | ₹5L–₹25L | **$199** | CA-certified Form 146 included |
| Lump-Sum Concierge | ₹25L to USD 1M/FY | **$499** | Written tax-position memo from the CA, a named person end-to-end, tranche planning across the financial year |

Test Concierge at $699 too: lump-sum buyers' "too expensive" answers ran to $450–$600 for only ₹10L.

### 3. The opening offer
**Founding 100: Standard at $149**, ends at the 100th completed transfer or 60 days after launch, whichever comes first. Contribution at $149 stays positive (~$55 on Standard). No "was $X" anchors — $199 must be the price actually charged after.

### 4. What to test with real buyers
- **$149 vs $199** for Standard: two landing-page variants, same traffic source (accountant referrals), measure booked CA pre-check calls.
- **$499 vs $699** Concierge: offer on the CA call only to ₹25L+ customers; measure accept rate.

### 5. The panel's top price objections (verbatim, research only — never use in ads)
1. "$199 on ten lakh is about 1.25% before I even see the exchange rate." (P016)
2. "My relative in India can sort this out for free… CAD $149–199 on top of the bank's rate… does not add up for me." (P010)
3. "the 'no extra margin' rate may still be worse than Wise or my own bank, and on a lump sum a rate gap would cost me more than the fee" (P041, paraphrase of objection field)

**The FX rate is now the hidden price objection.** Before launch, show the partner bank's rate next to the mid-market rate and the total landed CAD on every quote.

### Action
The live app and landing page still show two different prices (1.0–2.0% + $24.99 in `outward_fee_tiers`; $8/$12/$15 on `Landing.tsx`). Change both to the ladder above **only after** the AD-bank fee is quoted and the CFO re-run confirms it. (No code was changed in this run.)

### Decision (2026-11-19)
Bhagi delegated the call: **adopt the recommended ladder**: Essential CAD $79 (≤ ₹5L), Standard CAD $199 (₹5L–₹25L, CA certificate included), Lump-Sum Concierge CAD $499 (> ₹25L), plus a Founding 100 offer of Standard at $149. These are fees REPAIHUB charges customers on arrival of funds. Re-check once the AD-bank fee is quoted (CFO re-run). The backend fee tables (`fee_config`, `outward_fee_tiers`) still use the old % model; changing them needs a migration and Bhagi's explicit go-ahead under `.claude/rules.md`.

## The offer

Method: the Offers lens (a summary of the published framework in *$100M Offers*; not anyone's words).

### Problem list (buyer's words; from panel v1 objections, board memos, competitor complaints)
Before buying
1. "I've never heard of them." 2. "Which bank actually holds my money?" 3. "Is this regulated?" 4. "1–2% plus $25 is a lot." 5. "My relative does it free." 6. "My bank charges a few hundred rupees." 7. "I'll do it on my next trip." 8. "I don't know my tax position in India." 9. "What do I report in Canada (T1135)?" 10. "Nobody in my WhatsApp group has used it."
During
11. "My Indian bank will still call me / ask me to come in." 12. "Generic CAs ask for unnecessary documents." 13. "The transfer gets stuck halfway." 14. "Nobody tells me why it's held." 15. "I can't see the real exchange rate." 16. "Time zones — I can't reach anyone in India."
After
17. "What if the CA rejects something?" 18. "Is the paperwork accepted by my bank?" 19. "I need records for my accountant." 20. "I have more to move next year (USD 1M cap)."

### Solutions scored (value 1–5 / cost 1–5, kept if value ≥ 4 and cost ≤ 3)
| Solution | Kills | Value | Cost | Keep |
|---|---|---:|---:|:--:|
| Fee taken only when money arrives | 1, 13 | 5 | 1 | ✅ |
| Named AD Category-I bank + FINTRAC number shown | 2, 3 | 5 | 1 | ✅ |
| Flat banded fee ($79/$199/$499) | 4, 6 | 5 | 2 | ✅ |
| Free 15-min CA pre-check call | 8, 9, 12 | 5 | 2 | ✅ |
| Guarantee: redo rejected paperwork free; fee refunded if not landed in 5 business days after docs accepted | 13, 17, 18 | 4 | 2 | ✅ |
| Named Canadian support person, Canadian hours | 14, 16 | 4 | 3 | ✅ |
| Year-end transfer summary for the Canadian accountant | 19 | 4 | 1 | ✅ |
| Founding 100 price | 7 (real urgency, true limit) | 3 | 2 | ✅ |
| Live rate vs mid-market + total landed CAD on every quote | 15 | 5 | 2 | **add in v3** |
| Small first tranche (e.g. ₹1L) at no fee | 1, 10 | 4 | 3 | **add in v3** |
| Accountant referral programme | 10, 9 | 5 | 2 | **marketing** |
| Written "what your bank will still ask you" per bank | 11 | 4 | 2 | **add in v3** |
| Full tax filing in India | 8 | 3 | 5 | ❌ (cost) |

### The stack (v2, tested)
- **Core:** "Your NRO savings in your Canadian account, without a branch visit — paperwork, CA and transfer handled."
- **Bonuses:** free CA pre-check call · year-end summary for your accountant · named Canadian support person.
- **Guarantee:** paperwork redone free if your bank rejects it; our fee refunded if funds aren't in your account within 5 business days of documents being accepted. Modelled at a 3% claim rate × $187 = $6 per transfer (in `numbers.json`).
- **Urgency (true):** Founding 100 at $149 for Standard.
- **Name:** REPAIHUB Safe Passage.

### Value equation (1–10, before → after)
| | v1 pitch | v2 offer | moved by |
|---|---:|---:|---|
| Dream outcome | 7 | 8 | named outcome + tiers by life event |
| Perceived likelihood | 2 | 6 | named bank, FINTRAC no., pay-on-arrival, guarantee |
| Time to result | 6 | 6 | unchanged (24–48 h; 5-day guarantee) |
| Effort & sacrifice | 5 | 8 | CA pre-check, flat fee, named support |

### Re-test result (same seed 2027, same buyer cards)
| | Pitch v1 (`pitch-v1.md`) | Offer v2 (`pitch.md`) |
|---|---:|---:|
| Buyers answered | 20 | 100 |
| Buy | **0 (0%)** | **20 (20%)** |
| Top pass reason | trust 14/20 ("not FINTRAC-registered yet", "not launched") | trust 31/54 ("never heard of them", "nobody in my group has used it") |

**What moved:** "is it regulated / which bank" mostly dropped out; the remaining trust objection is *social proof*, not regulation. Price objections fell from "2% is too much" to "I can't see the FX rate". Biggest movers by behaviour: busy/pays-for-convenience 67%, tax-anxious 50%. Best segment: lump-sum sellers/inheritors 32%. Near-zero: "trusts only big banks" 0/20, "asks the WhatsApp group first" 0/10, procrastinators 1/12.

**Important caveat:** v2 was tested *as if* the bank partner and FINTRAC registration were in place. They are not. Until they are, the real offer is v1, which converted 0/20.

## The numbers

All figures come from `unit_economics.py` on `numbers.json`, and almost every input is an **ESTIMATE** (see `cfo-sources.md`). The AD-bank fee is the biggest unknown.

- **The margin:** blended price $187 per transfer (mix: 35% Essential $79, 55% Standard $199, 10% Concierge $499). Variable cost $106 → **contribution $81 (43%)**. At plan (2 transfers/day ≈ 60/month) the profit margin is **27%**. Break-even ≈ **23 transfers a month** ($1,880 fixed ÷ $81).
- **Year 1:** 289 transfers (ramp 3 → 50/month) → revenue **$54,080**, operating profit **$865**. After the $20,000 startup spend: **–$19,135**. Startup money is **not** earned back in year 1.
- **Cash needed before it pays for itself: $26,080.**
- **The line to watch: volume.** At half the ramp, year 1 is **–$10,847**; at double, **+$24,290** with payback in month 12; at 4×, **+$71,141**, payback month 8. Price matters less than volume: –10% price costs ~$5.4K in year 1, but –20% volume costs about the same and is far more likely.
- **Old pricing for comparison (`cfo-v1.md`):** percentage pricing at a blended $288 showed year 1 **+$18,217**, but the panel said that price was above the acceptable range and 0/20 buyers bought. A higher price nobody pays is worth $0.

#### Three ways to improve the margin (arithmetic on the tool's inputs; 289 year-1 transfers)
1. **Stop absorbing the ₹1,180 nostro/correspondent charge** (pass it through, disclosed): +$19 per transfer → **+$5,491** year 1.
2. **Negotiate the CA certificate to ₹2,000 bulk** (from ₹3,000 estimate): ≈ +$10 per transfer → **+$2,890** year 1.
3. **Shift the mix toward Concierge** (lump sums; the panel's 24% segment): every 5 points of mix moved from Essential to Concierge adds ≈ $21 blended price → **≈ +$6,000** year 1.

#### Board money conditions (`board.md`)
- Full cost of one transfer known — **NOT MET** (AD-bank fee, CA rate, nostro handling all estimates).
- Guarantee the CFO can afford — **MET on paper** ($6/transfer at a 3% claim rate; verify with real claim data).

Not financial, tax or legal advice. An accountant should check the corporate structure, HST treatment of the fees and payroll before money moves.

---

## Unit economics: REPAIHUB Safe Passage — flat-fee NRO to Canada repatriation (v2 offer; one unit = one completed transfer)

Every number below comes from the input file. Nothing is looked up or guessed.

### One transfer

| line | per transfer |
| --- | ---: |
| Price | $187.00 |
| AD-bank transfer fee ~₹1,000 flat; bank earns its FX spread (ESTIMATE — to be quoted) | -$16.00 |
| Correspondent/nostro charge absorbed ₹1,180 (BookMyForex published figure, proxy) | -$19.00 |
| Partner CA Form 146 ₹3,000 x 65% of transfers (Standard + Concierge) (ESTIMATE) | -$31.00 |
| Free 15-min CA pre-check call ₹800 per transfer (ESTIMATE) | -$13.00 |
| Concierge extra: CA tax-position review ₹5,000 + 1h support, x10% of transfers (ESTIMATE) | -$10.00 |
| Guarantee: fee refund at 3% claim rate x $187 (ESTIMATE) | -$6.00 |
| KYC + PAN + reverse penny drop + bank-link API calls (ESTIMATE) | -$4.00 |
| Canadian payout via Fable EFT (ESTIMATE) | -$2.00 |
| Support / exception handling, outsourced ~$25/h x 12 min (ESTIMATE) | -$5.00 |
| **Contribution** (what each transfer leaves to pay the fixed costs) | **$81.00** (43%) |

### The margin that matters

Fixed costs: $1,880 a month (Hosting: Render + Supabase paid tiers (ESTIMATE) $100, Software, AI tools, email, domain (ESTIMATE) $180, Outsourced AML compliance officer support (ESTIMATE) $500, E&O + cyber insurance (ESTIMATE) $250, Bookkeeping (ESTIMATE) $150, Legal retainer (ESTIMATE) $200, Always-on marketing: content + community sponsorships (ESTIMATE) $500).

- **Break-even: 1 transfers a day.** Below that you lose money every month.
- **Profit margin at your plan** (2 a day): **27%** of every sale, after every cost.
- Capacity: 10 a day.

### Year 1, month by month

| month | transfers a day | revenue | profit | cumulative (after $20,000 startup) |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | $561 | -$1,637 | -$21,637 |
| 2 | 0 | $954 | -$1,467 | -$23,104 |
| 3 | 0 | $1,515 | -$1,224 | -$24,328 |
| 4 | 0 | $2,244 | -$908 | -$25,236 |
| 5 | 1 | $2,973 | -$592 | -$25,828 |
| 6 | 1 | $3,759 | -$252 | -$26,080 |
| 7 | 1 | $4,656 | $137 | -$25,943 |
| 8 | 1 | $5,610 | $550 | -$25,393 |
| 9 | 1 | $6,564 | $963 | -$24,430 |
| 10 | 1 | $7,461 | $1,352 | -$23,078 |
| 11 | 2 | $8,415 | $1,765 | -$21,313 |
| 12 | 2 | $9,369 | $2,178 | -$19,135 |

- **Year 1 operating profit: $865** on $54,080 of revenue.
- After the $20,000 startup spend: -$19,135.
- Startup money earned back: not within year 1.
- Cash you need before it pays for itself: **$26,080**.

### What if

| scenario | margin at plan | break-even a day | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | 27% | 1 | $865 |
| Price -10% | 18% | 2 | -$4,543 |
| Volume -20% | 22% | 1 | -$3,820 |
| Unit costs +15% | 18% | 1 | -$3,733 |

### Red flags

- The startup spend is not earned back within year 1.

## Marketing

Evidence: `panel/results.md` (offer v2, 100 buyers), `competitors.md`, `pricing.md`, `cfo.md`. Panel quotes are research only, never ads.

### Who buys first (panel v2, 100 buyers)
| Behaviour | Buy rate | Read |
|---|---:|---|
| Busy, pays for convenience | 67% (15) | **Primary audience** |
| Tax-anxious | 50% (10) | **Primary audience** |
| Newer immigrant, small balance | 20% (25) | Essential tier |
| Property seller / inheritor | 32% (25) | **Best segment, highest value per customer** |
| Trusts only big banks | 0% (20) | Not reachable in year 1 |
| Procrastinator | 8% (12) | Needs a deadline trigger (property sale, FY-end) |
| Asks the WhatsApp group first | 0% (10) | Reached only via proof from others |

### Positioning (three versions; recommend #1)
1. **For Indian-origin Canadians who are worried about getting the Indian tax paperwork wrong, REPAIHUB Safe Passage is the done-for-you NRO repatriation service that checks your tax position with a Chartered Accountant before a rupee moves, unlike your bank, which hands you the forms and tells you to find a CA.** ← supported by tax-anxious 50% and busy 67% and "free CA call is what gets me past my tax worry" (P021, P030).
2. For busy professionals with money stuck in India, Safe Passage is the flat-fee way to bring it home without a branch visit, unlike a trip to India.
3. For families who just sold a property in India, Safe Passage is the concierge that moves the proceeds legally within the USD 1M limit, unlike informal swaps.

### Channels (pick 3)
| Channel | Why it fits | Rough cost | Signal it works |
|---|---|---|---|
| **Community accountants / tax preparers (referral partners)** | Buyers repeatedly said "if my accountant vouched for it" (P012, P014, P048, P050) | $0 + $40 referral credit per completed transfer | ≥ 3 partners each sending ≥ 2 customers in 60 days |
| **Instagram/YouTube explainers** (reuse founder's content skills) | "I watch NRI finance channels" habit; tax-anxious need education | time only | CA-check bookings per 1,000 views |
| **Google Search** ("NRO to Canada", "15CB Canada", "Form 146 NRI") | High intent, low volume | $300/month test cap | cost per booked CA call < $40 |
| Not now: Facebook/WhatsApp group ads | 0% buy until proof exists | — | — |
| Not now: Indian property lawyers/agents | High value, slow to build; phase 2 | — | — |

### Ten hooks (each answers one objection)
1. "Your NRO money. Your Canadian account. No branch visit." *(branch visit)*
2. "Talk to a Chartered Accountant before a single rupee moves — free." *(tax fear)*
3. "We get paid only when your money lands." *(trust)*
4. "One flat fee: $199. CA certificate included." *(price confusion)*
5. "See the bank's rate next to the real rate before you confirm." *(hidden FX)*
6. "The bank holding your money is named on every quote." *(which bank)*
7. "Sold a flat in India? Here's the legal way to bring it to Canada." *(lump-sum)*
8. "Form 15CB is now Form 146. Here's what changed for NRIs." *(education, timeliness)*
9. "Your accountant gets a year-end summary. You don't chase paperwork." *(Canadian reporting)*
10. "If your bank rejects our paperwork, we redo it free." *(stuck transfer)*

### 30-day launch campaign (L = target launch **Mon 2027-04-05**, contingent on AD-bank + FINTRAC; shift all dates if L moves)
| Date | Channel | What goes out |
|---|---|---|
| Mar 22 (L-14) | Accountant partners | Partner kit email: one-pager, referral terms, sample year-end summary |
| Mar 23 | Instagram | Hook 8 explainer (Form 15CB → 146) |
| Mar 25 | YouTube Short | Hook 2: what a CA pre-check covers |
| Mar 27 | Instagram | Founder story: "I had this problem" (no claims, no testimonials) |
| Mar 29 | Search | Ads live, $10/day, hooks 1/4 |
| Mar 30 | Accountant partners | 15-min walkthrough call #1 |
| Apr 1 | Instagram | Hook 5: rate transparency demo (screen recording of quote screen) |
| Apr 3 | Waitlist email | Founding 100 announced: $149 Standard, ends at #100 or Jun 4 |
| **Apr 5 (L)** | All | Launch post, waitlist email, partners notified |
| Apr 6 | Instagram | Hook 3 (pay on arrival) |
| Apr 8 | YouTube | Hook 7 lump-sum explainer |
| Apr 10 | Email | "What your bank will still ask you" guide (per bank) |
| Apr 13 | Instagram | Behind the scenes: how a transfer is tracked |
| Apr 15 | Accountant partners | First-week numbers + walkthrough call #2 |
| Apr 17 | Instagram | Hook 10 (guarantee) |
| Apr 20 | Email | Founding 100 count update (true number only) |
| Apr 21 (L+16) | Review | Week-2 metrics review (see below) |
When there's nothing new: explain one rule (USD 1M limit, TDS, Form A2), or show one screen of the product.

### Budget and numbers
- Budget (first 60 days): search $600 · referral credits up to $800 (20 × $40) · content $0 → **$1,400**, within the $3,000 launch line in `numbers.json`.
- **Most you can pay to win a customer:** contribution $81 × 1.0 transfer in month one (panel) = **$81**; allowing a second transfer in year 1, ≈ $162. **Cap CAC at $60** until real repeat data exists.
- **Watch weekly:** (1) CA pre-check calls booked — change something if < 5/week by week 3; (2) call → transfer conversion — change something if < 30%; (3) cost per completed transfer — stop a channel above $60.

Rules: no testimonials until real customers consent in writing; no "as seen on"; disclose paid partnerships; no tax-saving or earnings claims.

## Brand

### The finding first
**"REPAIHUB" is heard as "Repair Hub".** Even the founder's own voice-to-text request for this run rendered it "repair project / Repair Hub". Spoken, on a WhatsApp voice note or in a referral from an accountant, the name says *fixing things*, not *repatriation*. Keep **REPAIHUB** as the company/legal brand (the code, domain, logo and FINTRAC filing already use it), but lead every customer touchpoint with a **product name that says what it does** and say the company name the way it's meant: "Re-pai-hub — repatriation hub".

### Name candidates (product line)
| # | Name | Style | Says | Out loud / on an icon | Risk |
|---|---|---|---|---|---|
| 1 | **Safe Passage** (by REPAIHUB) | Evocative | Money moves safely | Clear; works as "Safe Passage transfer" | Generic phrase — trademark may be weak/crowded |
| 2 | **NRO Home** | Descriptive | NRO money comes home | Clear to NRIs, meaningless to others (fine) | "NRO" is a regulatory term; may not be registrable alone |
| 3 | **Ghar Wapsi Money** | Cultural | Coming home | Strong in Hindi belt, political connotation in India | **Avoid** — phrase has a loaded political meaning |
| 4 | **Repatra** | Invented | Repatriation | Short, ownable | Needs explaining |
| 5 | **Maple Bridge** | Place | India → Canada bridge | Friendly | Likely crowded (many "Maple" brands) |
| 6 | **Paperwork Done** | Descriptive | The real benefit | Memorable | Undersells the transfer |
| 7 | **SetuHome** | Cultural ("setu" = bridge) | Bridge home | Nice | **Conflicts with Setu, REPAIHUB's own KYC vendor** — avoid |
| 8 | **NRO2CA** | Descriptive | Route | Reads like a code | Hard to say |
| 9 | **Bhagi & Co. Repatriation** | Founder name | Personal trust | Personal | Doesn't scale, ties brand to one person |
| 10 | **Clearway** | Evocative | Clear path | Clean | Likely crowded |

**Shortlist:** Safe Passage · Repatra · NRO Home.

#### Checks you must run (I can't confirm availability)
- **Trademark (Canada):** CIPO trademark search — https://ised-isde.canada.ca/cipo/trademark-search/srch — search each name in **Nice class 36** (financial services, money transfer) and **class 35** (business administration). Also check REPAIHUB itself if not yet filed.
- **India:** IP India public search (https://tmrsearch.ipindia.gov.in/) class 36, since the brand will appear on Indian bank receipts.
- **Domains:** .com and .ca for each; check, don't assume.
- **Handles:** Instagram, YouTube, X, TikTok.
- **Confusion:** none of the shortlist is close to a competitor in `competitors.md`; "SetuHome" was dropped for vendor confusion.
Only a trademark lawyer confirms; nothing is registered until filed. Not legal advice.

### Promise, tagline, voice
- **Promise:** *"You'll know exactly what you pay, who holds your money, and where it is — every time."*
- **Tagline options:** "Your Indian savings, home in Canada." · "Paperwork done. Money home." · "Checked by a CA before a rupee moves."
- **Voice:**
  - *Calm* — do: "Here's what happens next." Don't: "Hassle-free!!!"
  - *Plain* — do: "Form 146 (it used to be called 15CB)." Don't: "seamless compliance orchestration".
  - *Honest* — do: "The bank's rate is ₹62.80; today's mid-market rate is ₹63.40." Don't: "Best rates guaranteed."
- **Before → after (from `pitch-v1.md`):**
  - Before: "Fee: 1.80% of the amount up to ₹5 lakh, 2.00% from ₹5L-₹10L, 1.75%… plus a CAD $24.99 flat fee (waived on your first transfer and above ₹30L)."
  - After: "Moving ₹10 lakh? One fee: $199, CA certificate included. Paid only when your money arrives."

### The look (brief)
Keep the existing navy/gold system from `Landing.tsx` — it already reads "private bank", which suits lump-sum buyers.
| Colour | Hex | Job | Contrast |
|---|---|---|---|
| Navy | `#0B1C2C` | Background, trust | Cream text on navy **16.0:1** ✅ AA/AAA |
| Gold | `#C9963A` | Accents, CTAs on navy | Gold on navy **6.5:1** ✅ AA · **Gold on cream 2.47:1 ❌** — never use gold text on light backgrounds; use dark gold `#7A5A1F` (**5.9:1** ✅) |
| Cream | `#FAF6F0` | Light surfaces, receipts | Navy on cream 16.0:1 ✅ |
| Slate | `#8BA0B4` | Secondary text on navy | 6.4:1 ✅ |
- **Type:** Cormorant Garamond (display) + DM Sans (text) — both free under the SIL Open Font License via Google Fonts, already in use.
- **Logo brief:** must work at 32 px app icon and on a PDF receipt; one mark, no rupee/maple-leaf clip-art cliché, no flags (avoids implying government affiliation). Concepts generated by an image tool are concepts, not a finished logo.
- **First five touchpoints:** (1) homepage hero: one sentence + the three flat prices + bank name + FINTRAC number; (2) quote screen: rate vs mid-market, total landed CAD; (3) confirmation email: named support person + timeline; (4) first Instagram post: Form 15CB → 146 explainer; (5) reply to first complaint: apology, what happened, what we're doing, by when — signed by a person.

## Operations

v1 scope (per board): **outward NRO → Canada only.** Inward transfers, Express and mobile are paused. Quebec excluded at launch (separate provincial MSB licensing regime — confirm with counsel).

### 1. Daily cycle (★ = customer sees it)
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

### 2. Suppliers (all prices to be quoted — none confirmed)
| Input | Candidates to approach | What to ask |
|---|---|---|
| **AD Category-I bank (critical path)** | Banks with active NRI-remittance/fintech partnership desks — e.g. Federal Bank, IDFC FIRST, Kotak, IndusInd, Yes Bank, South Indian Bank (approach list, not claims of fit) | Per-transfer fee, FX margin over mid-market, mandate flow for NRO accounts held at *other* banks, API vs file-based, white-label/non-compete terms |
| CA firm (Form 146) | 3 firms specialising in NRI taxation; ask for bulk rate | ₹/certificate at 20, 50, 100/month; turnaround SLA; liability cover |
| India KYC/PAN/penny drop | Setu (current) | Published rate card |
| Canada bank link + payout | Flinks, Fable Fintech (current) | Per-link and per-payout fees |
| Hosting/DB | Render, Supabase (current) | Paid tier needed for production uptime |
If any real price differs from `numbers.json`, update it and re-run `/founder-cfo`.

### 3. People
| Role | Who | Hours/week (slow first month) | At plan (60 transfers/mo) |
|---|---|---:|---:|
| Founder (product, partners, escalations) | Founder | 10 | 15 |
| Compliance officer (FINTRAC requires one named) | Founder, with outsourced AML support | 2 | 4 |
| Customer support (Canadian hours) | Outsourced/part-time, $25/h estimate | 3 | 12 |
| CA pre-check + Form 146 | Partner CA firm | per transfer | per transfer |
Founder has a full-time job: **support must be covered 9–5 ET weekdays by someone other than the founder before launch.** Payroll/contractor costs beyond wages: ask the accountant.

### 4. SOPs (one page each, to be written in `docs/ops/`)
1. **Opening sweep (daily 8:00 ET):** check overnight status changes, any transfer > 24 h without movement → open exception.
2. **Core fulfilment:** steps 1–9 above with checklists per bank.
3. **Exception / complaint:** acknowledge < 2 business hours; named owner; root cause; customer update every 24 h; guarantee applied automatically.
4. **Closing (daily 17:00 ET):** reconcile landed CAD vs quotes; fee capture; FINTRAC record completeness.
5. **Weekly:** CA invoice reconciliation, partner-bank statement reconciliation, metrics review.

### 5. Tools (smallest stack)
Existing app (React/Express/Supabase on Render) · scheduling (any booking tool with a free tier) · help desk/shared inbox · bookkeeping (cloud accounting) · password manager + 2FA everywhere. Check each vendor's published price; budgeted at $180/month in `numbers.json`.

### 6. Licences, registrations, insurance (confirm each with the authority or counsel — not legal advice)
- **FINTRAC MSB registration** — submitted, not granted. https://fintrac-canafe.canada.ca/msb-esm/msb-eng
- **FINTRAC compliance program:** compliance officer, written policies, risk assessment, training, two-year effectiveness review. https://fintrac-canafe.canada.ca/guidance-directives/compliance-conformite/Guide4/4-eng
- **Bank of Canada — Retail Payment Activities Act (RPAA) PSP registration:** likely applies if REPAIHUB holds/transfers end-user funds. https://www.bankofcanada.ca/core-functions/retail-payments-supervision/
- **Quebec MSB licence (Revenu Québec)** if serving Quebec residents — excluded at launch.
- **PIPEDA** privacy obligations (document storage is already minimised).
- **India side:** the AD bank carries FEMA/RBI obligations; confirm with Indian counsel whether REPAIHUB or the CA needs any registration for facilitating Form 145/146.
- **Insurance:** E&O + cyber (budgeted $250/month estimate).

### 7. Risk register
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

## Launch plan

### Step 1: test before you spend — the Paperwork-Only Pilot (start now, no bank partner needed)
The money-moving product can't launch until an AD bank signs and FINTRAC registers REPAIHUB. The *demand* can be tested now with a version where **REPAIHUB never touches the money**:

> **"NRO Ready" — $149.** Free CA pre-check call → partner CA prepares Form 146 and we prepare Form 145 + the bank's A2/request letter for *your own* NRO bank → you submit through your bank's NRI channel → we track it with you until it lands.

- Why: tests the exact things the panel was unsure about (will people pay a flat fee for done-for-you paperwork? do accountants refer?) with real money, at near-zero cost.
- **Compliance check first:** have counsel confirm that a paperwork-coordination service that never holds or transmits funds does not itself require MSB registration. Do not run it until confirmed. Not legal advice.
- **Success line (write it now):** in 6 weeks from start — **40 CA pre-check calls booked, 12 paid "NRO Ready" orders at $149, ≥ 3 accountant partners referring.**
- Compare: the v2 panel bought at 20% (an upper bound). If real booked-call → paid conversion is **below 10%**, trust the real buyers: go back to `/founder-offer` / `/founder-pricing` before signing anything with a bank.
- Pilot economics: $149 − CA certificate (~$48) − pre-check (~$13) ≈ **$88 contribution per order**, no transfer risk.

### Step 2: the countdown (owner = Founder unless stated)
Target public launch **Mon 2027-04-05**, *contingent* on the critical path (★). If the AD bank isn't signed by 2027-02-26, slide L by the same amount.

| Week of | Task | Owner | Deadline |
|---|---|---|---|
| 2026-11-23 | ★ Send AD-bank partnership pitch to 6 banks (`ops.md` list) with the one-pager | Founder | Nov 27 |
| 2026-11-23 | Counsel: MSB/RPAA scope + pilot legality opinion | Counsel | Dec 11 |
| 2026-11-30 | Get 3 CA firm quotes; sign one for pilot | Founder | Dec 4 |
| 2026-12-07 | Fix the two-prices problem on the landing page (show "coming soon" + pilot) | Founder | Dec 11 |
| 2026-12-14 | Pilot live: booking page, $149 checkout, 5 accountant intros | Founder | Dec 18 |
| 2027-01-04 | Pilot weeks 1–3; weekly metrics | Founder | Jan 22 |
| 2027-01-25 | **Pilot go/no-go** against success line | Founder | Jan 29 |
| 2027-02-01 | ★ AD-bank term sheet; ★ FINTRAC registration status | Founder | Feb 26 |
| 2027-03-01 | Integrate bank flow; turn AML/PEP screening ON; pen test | Founder + tester | Mar 19 |
| 2027-03-01 | Hire part-time support (Canadian hours); train on SOPs | Founder | Mar 19 |
| 2027-03-22 | Marketing L-14 calendar starts (`marketing.md`) | Founder | — |
| 2027-03-29 | **Soft open:** 5 friendly transfers (pilot customers), real money, real fees | Founder + support | Apr 2 |
| 2027-04-05 | **Public launch** | All | — |
**Critical path:** AD bank → integration → pen test → soft open. FINTRAC registration gates any real transfer.

### Step 3: launch-day run sheet (Mon 2027-04-05, ET)
| Time | Who | What |
|---|---|---|
| 07:30 | Founder | Systems check: test quote, bank API, status emails, AML screening |
| 08:00 | Founder | Launch email to waitlist + pilot customers; Instagram post |
| 08:15 | Founder | Message accountant partners with referral link |
| 09:00–17:00 | Support | Inbox + booking calls; log every question |
| 12:00 | Founder (lunch) | Check bookings, first quotes, any error logs |
| 17:00 | Support → Founder | Handover note: open items, exceptions |
| 20:00 | Founder | Reply to every comment/DM; note top 3 questions for tomorrow's FAQ |
If something breaks: bank API down → pause new quotes, banner "quotes paused, money in transit is safe", email affected customers within 1 h (risk #4); payment stuck → exception SOP; bad review → same-day human reply (risk #10).

### Step 4: the first 30 days
| Metric | Source | Target | Change trigger |
|---|---|---|---|
| Completed transfers / week | app | ≥ 6 by week 4 (break-even ≈ 23/month) | < 3/week by week 3 |
| CA pre-check → transfer conversion | app | ≥ 30% | < 20% |
| Cost per completed transfer | marketing | ≤ $60 | > $60 on any channel → cut it |
| Median time to land | app | ≤ 48 h after docs accepted | > 5 business days on any transfer |
| Exceptions / transfers | ops | < 10% | ≥ 15% |
**Reviews:** Day 7 (what broke? what did people ask?), Day 14 (which channel works?), Day 30 (are we on the CFO ramp of 3 → 5 → 8 transfers/month or above it? keep, change price, or change offer?).

_The panel is simulated buyers and the numbers are projections from your inputs. Confirm demand with real customers and costs with real quotes before you spend. Not financial, legal or tax advice._
