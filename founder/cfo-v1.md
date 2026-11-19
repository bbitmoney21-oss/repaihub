# Unit economics: REPAIHUB — NRO to Canada repatriation (one unit = one completed outward transfer)

Every number below comes from the input file. Nothing is looked up or guessed.

## One transfer

| line | per transfer |
| --- | ---: |
| Price | $288.00 |
| Partner/AD-bank share, 0.5% of avg ₹10.85L transfer (fee_config commission_rate_partner) | -$86.00 |
| Partner CA Form 146 certificate, ₹3,000 bulk rate x 65% of transfers above ₹5L (ESTIMATE) | -$31.00 |
| Correspondent/nostro charge absorbed, ₹1,180 (BookMyForex published NRE figure, proxy) | -$19.00 |
| KYC + PAN + reverse penny drop + bank-link API calls per transfer (ESTIMATE) | -$4.00 |
| Canadian payout via Fable EFT (ESTIMATE) | -$2.00 |
| Support / exception handling time, outsourced at ~$25/h x 12 min (ESTIMATE) | -$5.00 |
| **Contribution** (what each transfer leaves to pay the fixed costs) | **$141.00** (49%) |

## The margin that matters

Fixed costs: $1,880 a month (Hosting: Render + Supabase paid tiers (ESTIMATE) $100, Software, AI tools, email, domain (ESTIMATE) $180, Outsourced AML compliance officer support (ESTIMATE) $500, E&O + cyber insurance (ESTIMATE) $250, Bookkeeping (ESTIMATE) $150, Legal retainer (ESTIMATE) $200, Always-on marketing: content + community sponsorships (ESTIMATE) $500).

- **Break-even: 1 transfers a day.** Below that you lose money every month.
- **Profit margin at your plan** (2 a day): **38%** of every sale, after every cost.
- Capacity: 10 a day.

## Year 1, month by month

| month | transfers a day | revenue | profit | cumulative (after $20,000 startup) |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | $864 | -$1,457 | -$21,457 |
| 2 | 0 | $1,469 | -$1,161 | -$22,618 |
| 3 | 0 | $2,333 | -$738 | -$23,356 |
| 4 | 0 | $3,456 | -$188 | -$23,544 |
| 5 | 1 | $4,579 | $362 | -$23,182 |
| 6 | 1 | $5,789 | $954 | -$22,228 |
| 7 | 1 | $7,171 | $1,631 | -$20,597 |
| 8 | 1 | $8,640 | $2,350 | -$18,247 |
| 9 | 1 | $10,109 | $3,069 | -$15,178 |
| 10 | 1 | $11,491 | $3,746 | -$11,432 |
| 11 | 2 | $12,960 | $4,465 | -$6,967 |
| 12 | 2 | $14,429 | $5,184 | -$1,783 |

- **Year 1 operating profit: $18,217** on $83,290 of revenue.
- After the $20,000 startup spend: -$1,783.
- Startup money earned back: not within year 1.
- Cash you need before it pays for itself: **$23,544**.

## What if

| scenario | margin at plan | break-even a day | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | 38% | 1 | $18,217 |
| Price -10% | 31% | 1 | $9,888 |
| Volume -20% | 35% | 1 | $10,062 |
| Unit costs +15% | 30% | 1 | $11,840 |

## Red flags

- The startup spend is not earned back within year 1.
