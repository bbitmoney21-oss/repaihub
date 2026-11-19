# REPAIHUB — project status (2026-11-19)

## Where we are, in one line
Canada registration is **done** (FINTRAC MSB **N300002485**). The product is built and runs in demo/mock mode. **The one thing blocking launch is an Indian AD-I partner bank.**

## Done
| Area | Status | Where |
|---|---|---|
| Company | REPAIHUB Remittance Inc., federal corp 1807192-6 (2026-07-07) | FINTRAC registry |
| Regulation (Canada) | FINTRAC MSB **Registered**, N300002485, 2026-11-02 → 2029-07-31, Money Transferring | Official FINTRAC registry CSV |
| Product | Web app (customer + CA portal), Express/Supabase backend, Form 145/146 flow, KYC routing (Setu DigiLocker/PAN, Flinks), fee engine; live at repaihub.com in mock mode (Fable/Flinks MOCK) | repo |
| CA portal | Exists, with a separate team | `src/pages/ca` |
| Founder pack (11 skills) | Installed; full run done: board 3× FUND IF, panel 0/20 → 20/100 with the new offer, CFO, marketing, brand, ops, launch, plan (verdict "Not yet") | `founder/` |
| Market and competitors | Niche but real; Aspora is the main threat; US needs separate licensing | `founder/market-assessment.md` |
| Website beta fixes | False/unverifiable claims removed, real MSB number shown, legal name fixed, hosting disclosed, TCS→TDS corrected, security headers | PR #3 (not merged) |
| Bank outreach kit | Emails, reply templates, demo brief, signature, tracker with official bank channels | `founder/outreach/` |

## Waiting on Bhagi
1. ~~Go live~~ done: PR #3 and #4 merged to dev, dev merged to main 2026-11-19; repaihub.com shows MSB N300002485 and the /property page.
2. ~~Approve pricing~~ done: $79/$199/$499 adopted (backend fee tables still need a migration and your OK).
3. ~~Connect founder@repaihub.com~~ done (Outlook connected as founder@repaihub.com, 2026-11-19).
4. **Waitlist count** from Formspree.
5. ~~Property placeholder~~ done: `/property` (Phase 2, partner unnamed until signed).

## Next (in order)
1. Bank outreach: Federal Bank NRI Division email; IDFC FIRST Symphony application; find a named contact at IndusInd (Indus Fast Remit).
2. Counsel questions: RPAA (Bank of Canada PSP) registration; the paperwork-only pilot; Quebec.
3. Before any real transfer: switch AML/PEP screening from mock to live; apply migration 025 to production (the fee-tier table is empty in prod); pen test.
4. Finish the last 31 simulated buyers; then run a real pilot to test demand.

## Known gaps / risks
- No AD-I bank: no live transfers.
- Aspora (well-funded) could launch the same corridor.
- Indian PR inflows to Canada are falling.
- US expansion needs state money-transmitter licensing or a licensed partner.
