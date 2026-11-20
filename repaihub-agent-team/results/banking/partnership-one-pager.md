> **DRAFT — not for sharing.** Terms require the founder's decision (Rule 2). Approval row: Q-007 in `queue/needs-founder-ok.md`. Full workings: `results/banking/partnership-economics.md`.

# REPAIHUB × [Partner Bank] — NRO repatriation corridor, India → Canada

**REPAIHUB Remittance Inc.** · Federal corporation, Canada · FINTRAC Money Services Business: **Registered, N300002485**

## The proposition
Indian-origin residents of Canada hold rupee savings in NRO accounts (rent, matured deposits, property-sale proceeds, inheritance) and find that moving them home means paperwork, a Chartered Accountant and often a branch visit. REPAIHUB prepares each request end to end in Canada and hands your bank a **complete, pre-verified instruction**: the customer's identity confirmed through DigiLocker and IDfy, PAN verified (required at every amount), Form 145 filed, and above ₹5 lakh in the tax year a Form 146 certificate issued by our partner Chartered Accountant. Your bank keeps every Authorised Dealer decision and executes the remittance. REPAIHUB never stores customer documents: we keep only verification results and reference numbers.

## Who does what
| Area | Partner bank (AD Category-I) | REPAIHUB | Partner CA (India) |
|---|---|---|---|
| FEMA / AD duties | Final AD decision; checks the instruction, Form 145 acknowledgement and Form 146 UDIN; executes the SWIFT remittance | Prepares the complete request; tracks the USD 1M per financial year limit and holds any transfer it cannot verify | — |
| Tax forms | Verifies acknowledgement and certificate | Prepares Form 145 data | Files Form 145; issues Form 146 above ₹5 lakh (UDIN) |
| KYC / AML | Own CDD on the account holder; decides the extent of reliance under its own policy | DigiLocker + IDfy (India), Persona (Canada); passes results and references, never documents | Source-of-funds review for certified transfers |
| Money | Holds the NRO funds; converts INR → CAD; pays to the customer's Canadian account | Never holds customer money in India | — |
| Canada / FINTRAC | — | MSB obligations and FINTRAC reporting (EFTR) | — |
| Reporting | Its own RBI / FEMA reporting | Per-transfer audit trail and a monthly reconciliation file for the bank | Certificate register |
| Customer support | Account servicing | First-line support in Canadian hours | Tax queries on certified transfers |

## What the bank could earn — ESTIMATES only
Assumptions (all to be replaced by your figures): 0.20% processing fee per transfer; FX margin as agreed (illustrated at 0.25% / 0.50% / 0.75%); short-term balances while funds are in transit; average transfer ₹10 lakh; ₹63.42 per CAD. Volumes are REPAIHUB's own projections, not commitments.

| Scenario | Year 1 | Year 3 |
|---|---:|---:|
| Low | ₹6.9 lakh · CAD 10.9K | ₹23.9 lakh · CAD 37.6K |
| Base | ₹21.9 lakh · CAD 34.5K | ₹75.8 lakh · CAD 119.4K |
| High | ₹60.6 lakh · CAD 95.6K | ₹2.10 crore · CAD 330.7K |

Plus new NRI relationships: an estimated 56–400 new accounts in year 1 (base ≈ 156), and any balances customers keep with the bank afterwards (not counted above).

## Proposed pilot
- **Scope:** up to 50 transfers or ₹5 crore in total, whichever comes first, over about 90 days; each transfer within the customer's FEMA limit.
- **Sequence:** agreement → onboarding and due diligence → integration and user testing on a test environment → pilot → review → wider launch. No customer money moves before the agreement is signed.
- **What we need from you:** a named partnership owner and an operations contact; your fee and FX margin in writing; an instruction format (API or file) and how payment confirmations come back to us; your due-diligence checklist; your process for verifying Form 145/146; a test environment.

## Compliance and controls
- FINTRAC MSB **Registered, N300002485** (Money Transferring).
- FEMA: year-to-date tracking against the USD 1M per financial-year NRO limit; a transfer is held, not sent, whenever the limit cannot be confirmed. This control is required to pass before any pilot transfer.
- PAN on every transfer; Form 146 above ₹5 lakh aggregate in the tax year; real income-tax acknowledgement numbers only.
- Data minimisation: no identity documents, PAN cards or statements stored by REPAIHUB; PAN kept masked and hashed.
- Audit trail: every check, result reference and status change is time-stamped and available to the bank on request.
- Sanctions and PEP screening go live before the pilot and will be aligned with your AML policy.

*All revenue figures are illustrative estimates for discussion, not forecasts or offers. Commercial terms are subject to a signed agreement.*

---

## Internal — cover paragraph for the founder's email (not part of the one-pager)

> Dear [Name],
>
> Thank you for considering a conversation with us. REPAIHUB Remittance Inc. is a FINTRAC-registered money services business (N300002485) based in Ontario, Canada. We help Indian-origin residents of Canada move their NRO savings home, and we prepare each request in full (identity, PAN, Form 145 and, where needed, a CA-issued Form 146) so that your bank receives a complete, ready-to-review instruction. We are seeking one Authorised Dealer Category-I bank as our partner for this corridor, and I have attached a one-page summary of how the partnership could work and what it could mean for [Bank]. I would be grateful for 30 minutes with you or the right colleague, at a time that suits you. [Beta link: insert only after the QA Lead confirms it ready, per Rule 5.]
>
> With warm regards,
> Venkateswarlu Bhagi, Founder & CEO, REPAIHUB Remittance Inc. · founder@repaihub.com
