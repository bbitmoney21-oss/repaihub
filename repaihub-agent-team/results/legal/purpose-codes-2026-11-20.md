# RBI purpose codes (FETERS): correct mapping for REPAIHUB, with a change list

**From:** Legal / Head of Compliance agent
**Date:** 2026-11-20
**Status:** DRAFT. Needs the founder's OK. The AD-I bank must also confirm the codes before go-live (Rule 2, Rule 4).
**Scope:** Research only. No code was edited, nothing was committed, no database was queried and no one was contacted.

---

## 1. Sources and how far each was verified (Rule 9)

| Tag | Source | What it is | Access result |
|---|---|---|---|
| **RBI-A2** | https://www.rbi.org.in/upload/notification/pdfs/52220.pdf | RBI, Annexure II, "New Purpose Codes for Reporting Forex Transactions: **Receipt** Purposes" | Downloaded from rbi.org.in and the text was read directly. |
| **RBI-A3** | https://rbi.org.in/upload/notification/pdfs/52221.pdf | RBI, Annexure III, "New Purpose Codes for Reporting Forex Transactions: **Payment** Purposes" | Downloaded from rbi.org.in and the text was read directly. |
| **RBI-MD-DA** | rbi.org.in, Master Direction – Deposits and Accounts (RBI/FED/2015-16/9), "Updated as on September 02, 2026" | Rules for running NRO and NRE accounts | Downloaded from rbi.org.in and the text was read directly. |
| **RBI-2012** | A.P. (DIR Series) Circular No. 84 dated 29 Feb 2012, Annex (`ASAP840212A.pdf`). This is the **revised** purpose-code list, in force from the first fortnight of April 2012. | The current base list | **Could not be loaded.** The file sits on `rbidocs.rbi.org.in`, and this session's network reset or refused that connection. `website.rbi.org.in` links redirect to the rbi.org.in home page. Its wording is known only from search extracts. |
| **Bank/secondary** | IDFC First Bank purpose-code documentation sheet; HDFC, ICICI, SBI and IndusInd lists; Razorpay, Skydo and XFlow pages | Secondary confirmation only | Search-result extracts only. The bank hosts were blocked in this session (403 or DNS failure). |

**An important caveat about RBI-A2 and RBI-A3.** These two PDFs are watermarked **"Withdrawn"**. They are the pre-2012 list, which the 2012 revision replaced. They prove what each code meant in RBI's own words. They do not prove the current (2012-onwards) wording. Each code below is therefore graded as follows:

- **Verified (RBI, pre-2012 text)**: the code and its description were read directly on rbi.org.in, from the withdrawn annex.
- **Search-extract only**: the code was seen only in search snippets of the 2012 list or of bank or secondary pages.
- **AD-bank practice**: the code is how banks apply it to NRO accounts. RBI's own description does not say this explicitly.

To raise everything to "verified against the current list", allow `rbidocs.rbi.org.in` in the session network and re-run the check against `ASAP840212A.pdf`. The AD-I bank partner can confirm the codes in writing instead.

The prefix rule comes from RBI-A2 and RBI-A3. **P-codes are receipts (inward to India). S-codes are payments (outward from India).** An outward remittance from an NRO or NRE account must never carry a P-code.

---

## 2. Outward corridor (India → Canada, PRIMARY): the correct S-codes

| App purpose | Correct code | Official description (verbatim) | Source | Verification level |
|---|---|---|---|---|
| Repatriation of savings (NRO balances) | **S0014** | "Repatriation of Non-Resident Deposits (FCNRB/NRERA etc)". In the 2012 list: "Repatriation of Non-Resident Deposits (FCNR(B)/NR(E)RA etc)" | RBI-A3 (group 00, Capital Account); 2012 wording from search extract | Verified (RBI, pre-2012 text). Using it for **NRO** is AD-bank practice: the description says "etc" and does not name NRO. The IDFC First sheet (search extract) lists "S0014 Remittance of Current Income from NRO account". |
| Rental income (from NRO) | **S0014** | as above | RBI-A3 + IDFC First extract | Verified code. NRO current-income use is AD-bank practice (search extract). RBI-MD-DA says an NRO "can be debited for ... remittance of current income abroad". |
| Pension / salary (credited to NRO) | **S0014** | as above | RBI-A3 + IDFC First extract | Verified code, AD-bank practice. *Not S1401* ("Compensation of employees", RBI-A3): S1401 is for an employer paying an employee abroad, not for an NRI moving their own NRO balance. |
| Property sale proceeds (from NRO) | **S0014** | as above | RBI-A3; RBI-MD-DA ("The amount repatriated abroad should not exceed USD one million per financial year") | Verified code, AD-bank practice. *Not S0005* ("Indian investment abroad - in real estate"), which is for a resident buying property abroad. |
| Investment returns (dividends / interest, from NRO) | **S0014** | as above | RBI-A3 | Verified code, AD-bank practice. The alternatives are S1402 ("Remittance towards interest on Non-Resident deposits (FCNRB/NRERA/NRNRD/NRSR etc.)", RBI-A3) and S1407 ("Payment/ repatriation of dividends", RBI-A3). Those apply when the **payer** (the bank or the company) remits directly. They do not apply to a customer repatriating an NRO balance. Search extracts also suggest that the 2012 list moved dividends to S1409/S1412, so S1407 is not confirmed as current. |
| Family maintenance | **S1301** | "Remittance by non-residents towards family maintenance and savings". In the 2012 list: "Remittance for family maintenance and savings" | RBI-A3 (group 13, Transfers); 2012 wording from search extract | Verified (RBI, pre-2012 text). In REPAIHUB's primary corridor the beneficiary is the customer's **own** Canadian account, so the app should ask whether this really is family maintenance. If the money is the customer's own NRO savings, S0014 is the better fit. |
| Other | **No safe default. Hold for review.** | — | Rule 9 (fail closed) | Today the app silently sends S0014. Recommendation: S0014 only when the source really is an NRO or NRE balance (always true in this corridor). Otherwise route the transfer to manual compliance review, where the AD bank assigns the code. |
| **NRE repatriation** (any purpose) | **S0014** | as above. The description names "NR(E)RA" explicitly. | RBI-A3 | **Verified (RBI, pre-2012 text).** This is the best-supported mapping in this note. |

---

## 3. Inward corridor (Canada → India, SECONDARY): the correct P-codes

| App purpose | Correct code | Official description (verbatim) | Source | Verification level |
|---|---|---|---|---|
| Family maintenance or savings sent to family | **P1301** | "Inward remittance from Indian nonresidents towards family maintenance and savings" | RBI-A2 (group 13, Transfers); search extracts show the same wording today | Verified (RBI, pre-2012 text) and matched by search extract. The sender must be an Indian non-resident. For a Canadian sender who is not of Indian origin, the AD bank should confirm (P1302 may be used). |
| NRI depositing into own NRE (or FCNR) account | **P0014** | "Receipts o/a Non-Resident deposits (FCNRB/NRERA etc.) ADs should report these even if funds are not 'swapped' into Rupees." | RBI-A2 (group 00, Capital Account; the code is OCR'd as "POOH" on the same row as this text) | Verified (RBI, pre-2012 text). For credits to an **NRO** account, banks often use P1301 instead, because the description names only FCNRB and NRERA. This is AD-bank practice to confirm. |
| Gifts | **P1302** | "Personal gifts and donations" | RBI-A2 | Verified (RBI, pre-2012 text). Search extracts show the same meaning today. |
| Other | **No safe default. Hold for review.** | — | Rule 9 | The withdrawn list had P1590 ("Receipts below $10,000 (say Rs 5,00,000)"). It is **not** confirmed in the 2012 list, so do not use it. |

---

## 4. Codes now in the app or allow-list that are wrong

| Code | Where it is used | What RBI says it actually is (verbatim) | Verdict |
|---|---|---|---|
| **P1302** | NRE **outward** repatriation | Receipt: "Personal gifts and donations" (RBI-A2) | **Wrong.** It is a receipt code, and its meaning is unrelated. Use S0014. |
| **P0001** | "Investment returns" outward; dividend_income | Receipt: "Repatriation of Indian investment abroad in equity capital (shares)" (RBI-A2) | **Wrong.** Use S0014. |
| **P1101** | "Family maintenance" outward; pension_income | Receipt: "Audio-visual and related services" (RBI-A2) | **Wrong.** Use S1301 for family maintenance and S0014 for pension. |
| **S0001** | allow-list, labelled "Software services"; business_income | Payment: "Indian investment abroad - in equity capital (shares)" (RBI-A3) | **Wrong label and wrong use.** Remove it. |
| **P1301** | devTools seed for outward; `.env.example` as "NRO repatriation" | Receipt: "Inward remittance from Indian nonresidents towards family maintenance and savings" (RBI-A2) | **Wrong for outward.** It is correct only for **inward** family maintenance. |
| **P1004** | `.env.example`; `rbiRules.ts:75` uses it to detect a property sale | Receipt: "Legal services" (RBI-A2) | **Wrong.** As a side effect, the property-sale check (forcing Form 145 Part C plus Form 146) **never fires** for outward transfers, which send S0014. |
| `'INWARD'` | inward transfers (`transfers.ts:310`, DB default) | Not an RBI code | **Placeholder.** Inward transfers are stored without a reportable P-code. |
| `'S0014'` sent for inward | `NewTransfer.tsx:262` and `:1016` (the `: 'S0014'` branch when not outward) | Payment code | **Wrong direction** for inward, although the server currently overwrites it with `'INWARD'`. |

**Why S0014 was rejected (finding, not verified in production).** The code default (`rbiRules.ts:45`) and `render.yaml:86/172` both include S0014. A rejection at `transfers.ts:396` therefore means the **live** `RBI_PURPOSE_CODES_ENABLED` value on Render differs from `render.yaml`. The most likely cause is that it was set from `.env.example:57` (`P1301,P1302,P0001,S0001,P1101,P1004`), which contains no S0014. The rejection message printed "Allowed: …", and that list would confirm this. I did not read the Render dashboard or the database. The founder or DevOps needs to check it.

---

## 5. Change list

These changes are for engineering to make **after** the founder's OK. Line numbers are as of commit `9fc4859` plus the current working tree on 2026-11-20. Line numbers in `NewTransfer.tsx` moved while this research was running (for example, 794 became 805), so re-grep before editing.

### 5a. App (front end)

| File:line | Old | New |
|---|---|---|
| `src/pages/app/NewTransfer.tsx:48` | `'Investment returns': 'P0001'` | `'Investment returns': 'S0014'` |
| `src/pages/app/NewTransfer.tsx:49` | `'Family maintenance': 'P1101'` | `'Family maintenance': 'S1301'` |
| `src/pages/app/NewTransfer.tsx:50` | `'Other': 'S0014'` | Keep S0014 **only** for NRO and NRE balances. Also flag the transfer for compliance review, or require a free-text purpose (fail closed). |
| `src/pages/app/NewTransfer.tsx:44-47` | S0014 | No change (correct) |
| `src/pages/app/NewTransfer.tsx:41-42` (comment) | "P1302 used for NRE path" | "S0014 for both NRO and NRE repatriation; P-codes are receipts only" |
| `src/pages/app/NewTransfer.tsx:262` | `accountType === 'NRE' ? 'P1302' : … ) : 'S0014'` | `accountType === 'NRE' ? 'S0014' : … ) : <inward P-code chosen by the user: P1301 / P0014 / P1302>` |
| `src/pages/app/NewTransfer.tsx:1016` | same expression as line 262 | same fix as line 262 |
| `src/pages/app/NewTransfer.tsx` (inward step) | no purpose selector for inward | Add an inward purpose selector: "Family maintenance / savings" → P1301; "Deposit to my own NRE account" → P0014; "Gift" → P1302; "Other" → hold for review |
| `src/public/customer-dashboard.html:391` | `<option value="P1302">P1302 — Repatriation of NRE Funds` | Remove it. NRE uses `S0014`, so relabel line 390: "S0014 — Repatriation of Non-Resident Deposits (NRO/NRE)" |
| `src/public/customer-dashboard.html:392` | `P1101 — Family Maintenance` | `S1301 — Remittance for family maintenance and savings` |
| `src/public/customer-dashboard.html:393` | `P0001 — Indian Investment Abroad` | Remove it. Investment returns use S0014. |
| `src/public/customer-dashboard.html:915` | `value = 'P1302'` | `value = 'S0014'` |

### 5b. Server, types and allow-list

| File:line | Old | New |
|---|---|---|
| `src/config/rbiRules.ts:45` (default allow-list) | `'S0014,P1302,P0001,S0001,P1101'` | `'S0014,S1301'` (outward). Inward codes `P1301,P0014,P1302` belong in a **separate** inward allow-list (for example `RBI_INWARD_PURPOSE_CODES_ENABLED`), checked on the inward route. |
| `src/config/rbiRules.ts:41` (comment) | P1302 / P0001 / S0001 / P1101 meanings | Replace with the verbatim RBI descriptions from sections 2 and 3 |
| `src/config/rbiRules.ts:63,75` | `isPropertySale = purposeCode === 'P1004'` | Key on `sourceOfFunds === 'property_sale'`. No purpose code distinguishes a property sale for NRO repatriation. |
| `render.yaml:86` and `render.yaml:172` | `"S0014,P1302,P0001,S0001,P1101"` | `"S0014,S1301"`, plus the new inward variable `"P1301,P0014,P1302"` |
| **Live Render env** (dev and prod), `RBI_PURPOSE_CODES_ENABLED` | Unknown, probably `.env.example`'s value | Set it to `S0014,S1301` on **both** services (Rule 6). This is the actual fix for the S0014 rejection. |
| `.env.example:54-57` | `P1301,P1302,P0001,S0001,P1101,P1004` and its comments | `RBI_PURPOSE_CODES_ENABLED=S0014,S1301`, with corrected comments |
| `src/types/compliance.ts:40-45` (`RBIPurposeCode`) | `'S0014' \| 'P1302' \| 'P0001' \| 'S0001' \| 'P1101'` | Split it into `OutwardPurposeCode = 'S0014' \| 'S1301'` and `InwardPurposeCode = 'P1301' \| 'P0014' \| 'P1302'`, and fix the comments |
| `src/routes/transfers.ts:42` | `pension_income: 'P1101'` | `'S0014'` |
| `src/routes/transfers.ts:43` | `dividend_income: 'P0001'` | `'S0014'` |
| `src/routes/transfers.ts:47` | `business_income: 'S0001'` | `'S0014'` (repatriation of an NRO balance). Business income needs AD-bank confirmation. |
| `src/routes/transfers.ts:310` | `purpose_code: 'INWARD'` | The P-code from the request (P1301 / P0014 / P1302), validated against the inward allow-list. Fail closed if it is missing. |
| `supabase/migrations/021_…sql:143` | `DEFAULT 'INWARD'` | New migration: drop the default (NULL), or keep it but block reporting while it is `'INWARD'`. **Do not** edit the applied migration in place. |
| `src/routes/caPortal.ts:42-46` (`PURPOSE_DESCRIPTIONS`) | S0014 "Repatriation of NRO deposits…", P1302 "Repatriation of NRE funds", S0001 "Software services", P1101 "Family maintenance", P0001 | Use RBI's verbatim text: S0014 "Repatriation of Non-Resident Deposits (FCNR(B)/NR(E)RA etc)" and S1301 "Remittance for family maintenance and savings". Remove P1302, P0001, S0001 and P1101. |
| `src/adapters/IPaymentGateway.ts:30` (comment) | "P1302 for NRE" | "S0014 for NRO and NRE" |
| `src/routes/devTools.ts:236`, `:629` | `'P1302'` (NRE outward test data) | `'S0014'` |
| `src/routes/devTools.ts:411` | `'P1301'` (outward test data) | `'S0014'` |

### 5c. Regression (Rule 8)

After the change, regression-check the outward corridor end to end: the orchestrator (`outwardOrchestrator.ts:183` defaults to S0014, which is fine), the Form 145/146 data (`fifteenCBService.ts:50`), the CA-portal hand-off (`CaDashboard.tsx:86`, `caPortal.ts:269`), and the FINTRAC EFTR fields that read `purpose_code`.

---

## 6. Open items

1. **Founder:** approve the mapping in sections 2 and 3 and the change list in section 5.
2. **AD-I bank partner** (through the founder, once that relationship exists): confirm in writing which codes it applies to (a) NRO current-income repatriation (S0014), (b) credits to NRO for inward transfers (P1301 or P0014), and (c) "Other" purposes.
3. **DevOps:** read the live `RBI_PURPOSE_CODES_ENABLED` on both Render services and align them (Rule 6).
4. **Network:** allow `rbidocs.rbi.org.in` so this note can be re-verified against the current 2012 annex (`ASAP840212A.pdf`). Until then, the 2012 wording is graded "search-extract only".
