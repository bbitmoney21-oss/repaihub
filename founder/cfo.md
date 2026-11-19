# CFO's note — REPAIHUB Safe Passage (v2 flat-fee offer)

All figures come from `unit_economics.py` on `numbers.json`, and almost every input is an **ESTIMATE** (see `cfo-sources.md`). The AD-bank fee is the biggest unknown.

- **The margin:** blended price $187 per transfer (mix: 35% Essential $79, 55% Standard $199, 10% Concierge $499). Variable cost $106 → **contribution $81 (43%)**. At plan (2 transfers/day ≈ 60/month) the profit margin is **27%**. Break-even ≈ **23 transfers a month** ($1,880 fixed ÷ $81).
- **Year 1:** 289 transfers (ramp 3 → 50/month) → revenue **$54,080**, operating profit **$865**. After the $20,000 startup spend: **–$19,135**. Startup money is **not** earned back in year 1.
- **Cash needed before it pays for itself: $26,080.**
- **The line to watch: volume.** At half the ramp, year 1 is **–$10,847**; at double, **+$24,290** with payback in month 12; at 4×, **+$71,141**, payback month 8. Price matters less than volume: –10% price costs ~$5.4K in year 1, but –20% volume costs about the same and is far more likely.
- **Old pricing for comparison (`cfo-v1.md`):** percentage pricing at a blended $288 showed year 1 **+$18,217**, but the panel said that price was above the acceptable range and 0/20 buyers bought. A higher price nobody pays is worth $0.

### Three ways to improve the margin (arithmetic on the tool's inputs; 289 year-1 transfers)
1. **Stop absorbing the ₹1,180 nostro/correspondent charge** (pass it through, disclosed): +$19 per transfer → **+$5,491** year 1.
2. **Negotiate the CA certificate to ₹2,000 bulk** (from ₹3,000 estimate): ≈ +$10 per transfer → **+$2,890** year 1.
3. **Shift the mix toward Concierge** (lump sums; the panel's 24% segment): every 5 points of mix moved from Essential to Concierge adds ≈ $21 blended price → **≈ +$6,000** year 1.

### Board money conditions (`board.md`)
- Full cost of one transfer known — **NOT MET** (AD-bank fee, CA rate, nostro handling all estimates).
- Guarantee the CFO can afford — **MET on paper** ($6/transfer at a 3% claim rate; verify with real claim data).

Not financial, tax or legal advice. An accountant should check the corporate structure, HST treatment of the fees and payroll before money moves.

---

# Unit economics: REPAIHUB Safe Passage — flat-fee NRO to Canada repatriation (v2 offer; one unit = one completed transfer)

Every number below comes from the input file. Nothing is looked up or guessed.

## One transfer

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

## The margin that matters

Fixed costs: $1,880 a month (Hosting: Render + Supabase paid tiers (ESTIMATE) $100, Software, AI tools, email, domain (ESTIMATE) $180, Outsourced AML compliance officer support (ESTIMATE) $500, E&O + cyber insurance (ESTIMATE) $250, Bookkeeping (ESTIMATE) $150, Legal retainer (ESTIMATE) $200, Always-on marketing: content + community sponsorships (ESTIMATE) $500).

- **Break-even: 1 transfers a day.** Below that you lose money every month.
- **Profit margin at your plan** (2 a day): **27%** of every sale, after every cost.
- Capacity: 10 a day.

## Year 1, month by month

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

## What if

| scenario | margin at plan | break-even a day | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | 27% | 1 | $865 |
| Price -10% | 18% | 2 | -$4,543 |
| Volume -20% | 22% | 1 | -$3,820 |
| Unit costs +15% | 18% | 1 | -$3,733 |

## Red flags

- The startup spend is not earned back within year 1.
