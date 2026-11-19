# Demo brief — AD-I bank partnership call (30 min)

**Purpose of the call:** get agreement to a next step: a term sheet, a pilot scope, or an introduction to the bank's compliance/product owner. A "yes, interesting" with no next step is a failed call.

## Before the call (checklist)
- [ ] PR #3 merged and deployed; open https://repaihub.com in a private window and check it says "Beta preview" and shows MSB No. N300002485.
- [ ] Demo account ready on the app (mock mode, no real money). Practise the flow twice.
- [ ] One-pager (`founder/one-pager.md`) exported to PDF.
- [ ] Read the bank's NRI remittance page and fees so you can mention them.
- [ ] Have the FINTRAC MSB number to hand: **N300002485** (REPAIHUB Remittance Inc., registered 2026-11-02).
- [ ] Quiet room, camera on, screen share tested.

## Agenda
| Min | What | Who |
|---|---|---|
| 0–3 | Thanks; your one-line story: "I'm a Canadian with an NRO account; the bank told me to visit a branch, so I built this." | Bhagi |
| 3–6 | The problem, with numbers you can defend: 2.6M South Asian Canadians (StatCan 2021); NRO repatriation needs Forms 145/146 and often a branch visit | Bhagi |
| 6–16 | **Live demo:** sign-up → KYC (DigiLocker/PAN) → amount → Form 145/146 flow and CA queue → transfer status. Say "mock mode" at the start. | Bhagi |
| 16–20 | What the bank gets (below) and what we ask of the bank (below) | Bhagi |
| 20–28 | Their questions | Both |
| 28–30 | Agree the next step and who owns it; confirm by email the same day | Bhagi |

## What the bank gets
1. Pre-verified customers: KYC done, PAN checked, source of funds discussed with a CA.
2. Complete paperwork: Form 145 filed, Form 146 certified with UDIN, Form A2 prepared, so less work for the branch.
3. Fee and FX income on every transfer, plus new NRO/NRE relationships with customers who open accounts to complete transfers.
4. A Canada corridor with Canadian customer support, without a Canadian office.

## What we ask of the bank
1. Execute outward remittances from NRO accounts under its AD-I licence.
2. A mandate/API or file-based process for REPAIHUB-prepared requests.
3. A transparent per-transfer fee and FX margin, so we can show the customer the rate before they confirm.
4. A named operations contact for exceptions.

## Questions they will ask, and your answers
| Question | Answer (truthful, short) |
|---|---|
| Are you FINTRAC registered? | "Yes. REPAIHUB Remittance Inc., MSB No. N300002485, on FINTRAC's public registry. No live transfers until our agreement with you is in place." |
| Who holds customer money? | "Never REPAIHUB in India. Funds move from the customer's NRO account through your bank to their Canadian account." |
| AML / sanctions screening? | "KYC through DigiLocker and PAN, plus a CA source-of-funds review. Sanctions and PEP screening goes live before launch; we will align with your AML policy." (In code it's still a mock. Don't claim it's live.) |
| Volumes? | Use reply template E. Projections only. |
| What if the customer's NRO is at another bank? | "Phase 1: customers who hold or open an NRO with you. Phase 2: other-bank NROs via transfer to you. We'd like your view on what's simplest." |
| Tax liability for wrong forms? | "Form 146 is certified by a practising CA with a UDIN; the CA carries professional liability. We'll put this in the agreement." |
| Why not do it yourselves? | "You could. We bring the Canadian customer acquisition, support and paperwork, so you get the volume without building it." |
| Team? | "Founder with 13+ years in enterprise QA and payments-adjacent SAP programs; partner CA firm; outsourced compliance support." |

## Questions to ask them
1. Who owns NRI fintech partnerships, and what is your approval process and typical timeline?
2. What do you need from us before a pilot (documents, audits, NDA)?
3. Do you have an API for outward remittance, or file-based processing?
4. What fee and FX margin would apply per transfer at our volumes?
5. Would you consider other-bank NRO customers, and how?

## After the call (same day)
- Send a thank-you email confirming the agreed next step, the owner and the date.
- Update `tracker.csv` (status, next_step).
- If they asked for documents, send within two working days.
