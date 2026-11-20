# Is "no PAN below ₹5 lakh" legally correct? — Legal research note

**Agent:** Legal / Head of Compliance · **Date:** 20 Nov 2026 · **Status:** draft for peer review (Fintech Legal Counsel advisor agent), then founder
**Question from the founder:** "Below ₹5 lakh it should not ask for any PAN details — it should let them pass."

> This is research, not legal advice. A licensed Indian tax practitioner (SriHarsha) and the AD-I partner bank's compliance team must confirm before any product change ships. Nothing here has been filed, sent or deployed.

## Verdict

**Incorrect (only one part of it is right).**

- **Right:** below ₹5 lakh in a tax year, a taxable remittance is reported in **Form 145 Part A**, and **Form 146 (the CA certificate) is not needed**.
- **Wrong:** the ₹5 lakh threshold removes the **CA certificate**, not the **PAN**. Part A itself asks for the remitter's PAN. The AD bank's KYC also requires PAN (or Form No. 60). The portal Form 145 is filed on is logged into with a PAN. The app must still collect and verify PAN below ₹5 lakh.

## How well each point is verified

Network limits in this session: `incometaxindia.gov.in`, `incometax.gov.in` and `egazette.gov.in` **could not be loaded** (DNS blocked). `rbi.org.in` **was loaded and read in full**. Income-tax points below therefore rest on **search-engine extracts of the official pages**, not a direct read. They are marked **"official, extract only"** and must be re-read directly before relying on them (Rule 9). To unblock: allow `www.incometaxindia.gov.in` and `www.incometax.gov.in` in the session's network settings.

| Label | Meaning |
|---|---|
| VERIFIED | Official page fetched and the text read directly |
| OFFICIAL, EXTRACT ONLY | Official URL, but seen only through a search-engine extract |
| UNVERIFIED | No official text seen; must not be relied on |

---

## 1. Does Form 145 Part A (≤ ₹5 lakh) require the remitter's PAN?

**Yes.** *(OFFICIAL, EXTRACT ONLY)*

- **Legal basis.** Form 145 is prescribed by **Rule 220 of the Income-tax Rules, 2026**. It is furnished by "every person responsible for paying to a non-resident (not being a company) or to a foreign company" **before remitting** the payment.
- **What Part A covers.** The Part A heading reads: *"to be filled up if the remittance is taxable under Act and the remittance or the aggregate of such remittances, as the case may be, does not exceed ₹ 5,00,000 rupees during the tax year."*
- **The ₹5 lakh is an aggregate per tax year.** It is not per transaction.
- **Remitter's PAN.** Part A, "Particulars of the Remitter (Sender)", lists **Permanent Account Number** together with TAN, status and residential status. The field is not marked "if available".
- **Remittee's PAN.** For the remittee (recipient), PAN is asked "if available", with a pointer to Note 5. Note 5 reads: *"in case of non-availability of PAN, provisions of section 397(2) of Act shall be applicable."*
- **Remittee without PAN.** The official FAQ says remittee PAN "is not mandatory, however, if the remittee does not have PAN, one has to provide Taxpayer Identification Number (TIN)".
- **Filing needs a PAN login.** The e-Filing portal's Form 145 user manual lists, as a prerequisite, being a "Registered user of the e-Filing portal with valid user ID and password". The login manual says that for password login you "enter your PAN in the User ID textbox".
- **Gap.** I did not find a field-level instruction stating in so many words that the remitter's PAN is **mandatory** in Part A. The form lists it as a field without an "if available" qualifier, unlike the remittee's PAN. *Not yet confirmed from the notified form itself.*

**Note for REPAIHUB.** In NRO repatriation the NRI is both the remitter and the beneficiary (own account abroad). The NRI's PAN therefore sits in the "remitter" block, which is not optional. Whether the NRI or the AD bank technically submits Form 145 in our flow must be agreed with the AD-I bank and SriHarsha (Rule 7: the CA portal stays with him).

Sources:
- Form 145 (Rule 220), official PDF: https://www.incometaxindia.gov.in/documents/20117/16508534/form-no-145.pdf/54fc3676-0983-fd58-028a-9d1548e2ca37?version=1.0&t=1774338441056
- Form 145 text: https://www.incometaxindia.gov.in/documents/d/guest/form-no-145-1
- Form 145 FAQs (earlier 15CA): https://www.incometaxindia.gov.in/documents/d/guest/form-145-faqs
- Form 145 guidance note: https://www.incometaxindia.gov.in/documents/d/guest/fn-145
- FAQs and guidance notes on forms under the Income-tax Rules, 2026: https://www.incometaxindia.gov.in/faqs-and-guidance-notes-on-forms-as-per-income-tax-rules-2026
- e-Filing Form 145 user manual: https://www.incometax.gov.in/iec/foportal/newformpage/forms/form145-UM
- e-Filing login manual: https://www.incometax.gov.in/iec/foportal/help/how-to-log-in-e-filing-portal

**Comparison with the old regime (to 31 Mar 2026).** Under **Rule 37BB of the 1962 Rules / Form 15CA** the structure was the same: Part A for ≤ ₹5 lakh, Part B for an AO order/certificate under s.195(2)/195(3)/197, Part C with a Form 15CB, and Part D for non-taxable remittances. Part A held the remitter, remittee and remittance details. A department advisory told remitters to enter their PAN/TAN as remitter, matching the login used. *(OFFICIAL, EXTRACT ONLY)* So the PAN requirement **is not new**. The ₹5 lakh threshold has never removed PAN; it has only removed the CA certificate.
- Rule 37BB: https://www.incometaxindia.gov.in/w/rule-37bb
- Form 15CA FAQ: https://www.incometax.gov.in/iec/foportal/help/statutory-forms/popular-forms/form-15ca-faq
- Form 15CA user manual: https://www.incometax.gov.in/iec/foportal/help/statutory-forms/popular-forms/form-15ca-um
- CBDT press release on Rule 37BB (17 Dec 2015): https://incometaxindia.gov.in/Lists/Press%20Releases/Attachments/424/Press-release-Rule-37BB-17-12-2015.pdf

## 2. Is Form 146 (CA certificate) needed below ₹5 lakh?

**No.** *(OFFICIAL, EXTRACT ONLY)*

- **Where Form 146 applies.** Form 146 is prescribed under **Rule 220(1)(c)**. It is needed only for **Part C**: taxable remittances above ₹5 lakh in the tax year with no AO certificate. The e-Filing manual's prerequisites say: "CA should have filed Form 146 (for Part - C only)."
- **Other Parts.** Part A (≤ ₹5 lakh), Part B (AO certificate) and Part D (not taxable) need no Form 146.
- **Caveat.** The threshold counts **all such remittances in the tax year**. A customer who sends ₹4 lakh and then ₹3 lakh crosses ₹5 lakh on the second transfer. That transfer needs Part C plus Form 146 (or Part B / Part D as applicable).

Sources: Form 146 PDF https://www.incometaxindia.gov.in/documents/20117/16508534/form-no-146.pdf/866f9201-82ed-1368-2bb2-85136179e5a7?version=1.0&t=1774338441454 · Form 146 FAQs https://www.incometaxindia.gov.in/documents/d/guest/form-146-faqs · Form 145 user manual (above).

## 3. Do AD banks require PAN for NRO repatriation regardless of amount?

**Yes, in practice and under RBI KYC, PAN or Form No. 60 is needed at any amount.** (VERIFIED for the RBI parts.)

**(a) RBI KYC Directions, 2025 (VERIFIED, read on rbi.org.in).** The current directions apply to our shortlist: Commercial Banks for South Indian Bank, Small Finance Banks for Equitas, AU and Jana.

- **CDD for an individual "while establishing an account-based relationship".** Para 23 (Commercial Banks) / para 24 (SFBs) requires, among others: *"(5) PAN or the equivalent e-document thereof or Form No. 60 as defined in Income-tax Rules, 1962"*.
- **Existing customers.** Para 43 (Commercial Banks) / para 44 (SFBs): the bank shall obtain PAN or Form No. 60 by a date the Central Government notifies, "failing which the bank shall temporarily cease operations in the account".
- **Quoting of PAN.** Para 76 (Commercial Banks) / para 77 (SFBs): *"PAN or equivalent e-document thereof of customers shall be obtained and verified while undertaking transactions as per the provisions of Income Tax Rule 114B … Form 60 shall be obtained from persons who do not have PAN."*
- **What this means.** An NRO account holder has already given the bank PAN or Form 60. There is **no ₹5 lakh carve-out** in the KYC Directions.

Sources:
- Commercial Banks – KYC Directions, 2025 (updated 1 Oct 2026): https://rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13141
- Small Finance Banks – KYC Directions, 2025 (updated 1 Oct 2026): https://rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13109
- The text still cites "Form No. 60 as defined in Income-tax Rules, 1962". The 2026-Rules equivalent form number is **UNVERIFIED**.

**(b) FEMA / Remittance of Assets (VERIFIED, read on rbi.org.in).** *Master Direction – Remittance of Assets* (FED MD No. 13/2015-16, updated 29 Jun 2026) says:

- **Para 3.2.** ADs may allow NRIs/PIOs, **"on submission of documentary evidence"**, to remit up to **USD one million per financial year** out of NRO balances, sale proceeds or inherited assets. If the remittance is made in instalments, **all instalments must go through the same AD**. For NRO balances, the AD must obtain the account holder's **undertaking** that the funds arise from "legitimate receivables in India and not by borrowing from any other person or a transfer from any other NRO account".
- **Para 5, Income-tax clearance.** *"The remittances are subject to payment of applicable taxes in India … It shall be mandatory on the part of Authorised Dealers to comply with the requirement of tax laws, as applicable."*
- **Master Direction – Deposits and Accounts (updated 2 Sep 2026), para 6.8.** NRO balances "cannot be repatriated abroad except by NRIs and PIOs up to USD 1 million, subject to conditions specified in [FEMA (Remittance of Assets) Regulations, 2016]".
- **Same Direction, para 6.14.** Remittances "(net of applicable taxes) will be allowed … on production of requisite information in the formats prescribed by the Central Board of Direct Taxes". This is the Form 145/146 hook, with **no amount threshold**.
- Remittance of Assets MD: https://rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=10197
- Deposits and Accounts MD: https://rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=10198
- The older RBI master circular wording ("undertaking by the remitter and certificate by a Chartered Accountant in the formats prescribed by CBDT") appears in the superseded master circulars. The current MD instead defers to tax law generally (above).

**(c) Form 145 filing:** see point 1. Filing needs a PAN-based e-Filing login, and Part A has a remitter-PAN field.

**(d) The "USD 1M certificate".** RBI sets the USD 1M limit **per financial year, across all ADs, tracked per customer**. RBI's text does not itself say "PAN" here. In practice the only reliable cross-bank identifier is PAN, and the AD will need the customer's declaration of earlier remittances in the FY. *Whether a specific AD-I bank requires PAN on its own USD 1M declaration form is **UNVERIFIED**; ask the bank in the term-sheet stage.*

## 4. What if the NRI has no PAN?

- **TDS at a higher rate.** **Section 397(2), Income-tax Act 2025** (successor to old s.206AA) applies, and Form 145 Note 5 points to it. If the deductee does not furnish PAN, TDS is at the **higher of** the rate in the relevant provision, the rates in force, or **20%** (5% in certain listed cases). *(OFFICIAL, EXTRACT ONLY: CBDT "FAQs on higher rate of TDS under section 397")*
  - Secondary sources say certain non-residents may be relieved if they furnish prescribed details (reportedly **Rule 217**: TIN and tax-residency documents). *Not confirmed from official text: **UNVERIFIED**.*
  - Whether the old court rulings (DTAA rate overrides 20% without PAN) carry over to s.397: **UNVERIFIED**.
  - FAQ: https://www.incometaxindia.gov.in/documents/d/guest/faqs-on-higher-rate-of-tds-under-section-397
  - Section page: https://www.incometaxindia.gov.in/w/section-397-6
- **Can they still repatriate?**
  - FEMA does not itself bar a no-PAN repatriation.
  - The AD bank will hold **Form No. 60** in place of PAN under KYC (VERIFIED, para 3(a)).
  - Practical blockers:
    - Filing Form 145 needs a portal login. A no-PAN individual cannot use PAN-based login. *How a no-PAN NRI files is **UNVERIFIED**; possibly the AD files under its TAN.*
    - Higher TDS reduces the net amount.
    - Most NROs that received interest or rent will already have had PAN quoted.
  - **Recommendation:** treat "no PAN" as **out of scope for self-serve**. Route it to manual review with SriHarsha and the AD bank. Suggest the customer obtain a PAN first; NRIs can apply via the NSDL/UTI-ITSL channels (application route not verified here).

## 5. Other checks REPAIHUB still needs below ₹5 lakh

| Check | Applies below ₹5L? | Basis | Status |
|---|---|---|---|
| Customer is NRI/PIO and the remittance goes to **own account abroad** | Yes | RBI MD Remittance of Assets 3.2; MD Deposits & Accounts 6.8 / 6.12 | VERIFIED |
| **Undertaking** that NRO funds come from legitimate receivables, not borrowing or transfer from another NRO | Yes, every NRO-balance remittance | MD Remittance of Assets 3.2 | VERIFIED |
| **Source of funds** / documentary evidence (sale deed, inheritance, rent etc.), verified by partner and not stored by us | Yes | MD 3.2 "on submission of documentary evidence" | VERIFIED (RBI); exact evidence list set by the AD bank |
| **Taxes paid / TDS** (remittance net of applicable taxes) | Yes | MD Remittance of Assets para 5; MD Deposits & Accounts 6.14 | VERIFIED |
| **Form 145**: Part A if taxable and ≤ ₹5L aggregate; Part D if not taxable; Part C + Form 146 above | Yes, a form is filed below ₹5L too | Rule 220, Form 145 | OFFICIAL, EXTRACT ONLY |
| Whether any **Rule 220(3) exemption** (old 37BB(3): individual remittance not needing RBI prior approval / specified purpose codes) covers NRO capital-account repatriation | Must be confirmed | Rule 220(3) text not read | **UNVERIFIED**. Do not assume an exemption. |
| **USD 1M per FY** tracking across all instalments, and **same AD for all instalments** | Yes | MD 3.2 | VERIFIED. Note open defect **D1** (FEMA check fails open) must fail closed. |
| **Running ₹5L aggregate per customer per tax year** to switch Part A to Part C/146 | Yes | Form 145 Part A heading | OFFICIAL, EXTRACT ONLY |
| **Purpose code** (RBI S-codes for repatriation) on the remittance | Yes | Purpose-code list not fetched | **UNVERIFIED**. Confirm with the AD-I bank. |
| FINTRAC KYC/EFTR on the Canadian side (Registered, N300002485) | Yes, independent of the INR amount | FINTRAC rules (not re-researched here) | Out of scope of this note |

## 6. Recommendation for the app (consistent with Rule 12)

**Do not drop PAN below ₹5 lakh.** The ₹5 lakh switch should change **which Form 145 Part and whether a CA certificate (Form 146) is needed**, not whether PAN is collected.

**Every transfer, at any amount:**
1. **PAN is mandatory and verified** through IDfy / DigiLocker (name match with the NRO account holder, status valid). Store **only** the masked PAN (`XXXXXX234F`), its SHA-256 hash, the verification result and the vendor reference. No PAN card image, ever (Rule 12; `noDocumentStorage.ts` already returns 410).
2. Use the PAN hash as the key for **(a)** the running **₹5 lakh tax-year aggregate** and **(b)** the **USD 1M FY counter**. Both must **fail closed** (fix D1).
3. Customer declarations, captured as a click-through and stored as a signed record (not a document):
   - the RBI NRO undertaking (exact wording, MD 3.2);
   - remittances already made this FY through any other AD;
   - taxable / not taxable, and TDS already deducted.
4. Source-of-funds evidence: verified by the partner or AD bank. We keep the result and reference only.
5. Purpose code, plus the "own account abroad" beneficiary check (Canadian account in the customer's own name).

**Cumulative ≤ ₹5 lakh in the tax year (including this transfer):**
- Prepare Form 145 **Part A** (taxable) or **Part D** (not taxable) data for SriHarsha / the AD.
- **No Form 146 / CA fee.**
- PAN is still required.

**Cumulative > ₹5 lakh:**
- Form 145 **Part C plus Form 146** (CA certificate via SriHarsha), or **Part B** if the customer holds an AO certificate under the 2025 Act (equivalent of old s.195/197).
- The underlying data goes to SriHarsha as files (Rule 7).

**No PAN:** hold. Do not proceed (Rule 9). Route to manual review: Form 60 plus higher TDS under s.397(2), AD bank decision.

**Product note.** The pricing tier "Under ₹5L" is **per ticket**, but the Form 145 threshold is **per tax year, aggregate**. The UI and help assistant must not say "no CA certificate under ₹5L" on a per-ticket basis.

## Open items needing direct verification (Rule 9)
1. Read the notified **Form 145 PDF and Rule 220 (incl. 220(3))** directly. Confirm the remitter-PAN field is mandatory in Parts A and D, and whether any exemption covers NRO repatriation.
2. Read the **CBDT s.397 FAQ** and **Rule 217** directly (non-resident relief from higher TDS).
3. Confirm the Income-tax Rules, 2026 equivalent of **Form No. 60**.
4. Ask the AD-I bank (via the founder only; no contact made): its USD 1M declaration format, purpose codes, who files Form 145 (customer login vs bank), and the no-PAN process.
5. Peer review by the Fintech Legal Counsel advisor agent. Confirmation by SriHarsha (licensed CA).

*Rule 1 check: this note is original analysis built from official regulatory texts. No other company's material was used.*
