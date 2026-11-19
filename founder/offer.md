# Offer Architect — "REPAIHUB Safe Passage"

Method: the Offers lens (a summary of the published framework in *$100M Offers*; not anyone's words).

## Problem list (buyer's words; from panel v1 objections, board memos, competitor complaints)
Before buying
1. "I've never heard of them." 2. "Which bank actually holds my money?" 3. "Is this regulated?" 4. "1–2% plus $25 is a lot." 5. "My relative does it free." 6. "My bank charges a few hundred rupees." 7. "I'll do it on my next trip." 8. "I don't know my tax position in India." 9. "What do I report in Canada (T1135)?" 10. "Nobody in my WhatsApp group has used it."
During
11. "My Indian bank will still call me / ask me to come in." 12. "Generic CAs ask for unnecessary documents." 13. "The transfer gets stuck halfway." 14. "Nobody tells me why it's held." 15. "I can't see the real exchange rate." 16. "Time zones — I can't reach anyone in India."
After
17. "What if the CA rejects something?" 18. "Is the paperwork accepted by my bank?" 19. "I need records for my accountant." 20. "I have more to move next year (USD 1M cap)."

## Solutions scored (value 1–5 / cost 1–5, kept if value ≥ 4 and cost ≤ 3)
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

## The stack (v2, tested)
- **Core:** "Your NRO savings in your Canadian account, without a branch visit — paperwork, CA and transfer handled."
- **Bonuses:** free CA pre-check call · year-end summary for your accountant · named Canadian support person.
- **Guarantee:** paperwork redone free if your bank rejects it; our fee refunded if funds aren't in your account within 5 business days of documents being accepted. Modelled at a 3% claim rate × $187 = $6 per transfer (in `numbers.json`).
- **Urgency (true):** Founding 100 at $149 for Standard.
- **Name:** REPAIHUB Safe Passage.

## Value equation (1–10, before → after)
| | v1 pitch | v2 offer | moved by |
|---|---:|---:|---|
| Dream outcome | 7 | 8 | named outcome + tiers by life event |
| Perceived likelihood | 2 | 6 | named bank, FINTRAC no., pay-on-arrival, guarantee |
| Time to result | 6 | 6 | unchanged (24–48 h; 5-day guarantee) |
| Effort & sacrifice | 5 | 8 | CA pre-check, flat fee, named support |

## Re-test result (same seed 2027, same buyer cards)
| | Pitch v1 (`pitch-v1.md`) | Offer v2 (`pitch.md`) |
|---|---:|---:|
| Buyers answered | 20 | 69 (31 not run — usage limit) |
| Buy | **0 (0%)** | **15 (22%)** |
| Top pass reason | trust 14/20 ("not FINTRAC-registered yet", "not launched") | trust 31/54 ("never heard of them", "nobody in my group has used it") |

**What moved:** "is it regulated / which bank" mostly dropped out; the remaining trust objection is *social proof*, not regulation. Price objections fell from "2% is too much" to "I can't see the FX rate". Biggest movers by behaviour: tax-anxious 71% (thin), busy/pays-for-convenience 60%. Zero movement: "trusts only big banks" 0/15, procrastinators 0/8, "asks the WhatsApp group first" 0/6.

**Important caveat:** v2 was tested *as if* the bank partner and FINTRAC registration were in place. They are not. Until they are, the real offer is v1, which converted 0/20.
