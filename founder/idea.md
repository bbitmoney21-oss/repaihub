# REPAIHUB

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
