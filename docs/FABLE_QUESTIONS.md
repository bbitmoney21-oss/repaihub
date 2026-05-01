# Questions for Fable Fintech — Pre-Integration Meeting

These three questions determine whether we can replace Setu DigiLocker, Flinks, and/or Setu PAN
verification with Fable endpoints. Until confirmed, all three capabilities remain **disabled**
(`fable_india_kyc_enabled=false`, `fable_canada_kyc_enabled=false`, `fable_pan_enabled=false`
in the `kyc_config` Supabase table).

**Switching is one SQL UPDATE — zero code changes required.**

---

## Q1 — India Identity KYC

> Does Fable provide a DigiLocker-equivalent identity verification API for Indian NRIs?
> Specifically: can Fable issue a session URL that redirects the customer to verify their
> Aadhaar / PAN / passport via a government-linked identity provider, and callback to our
> webhook on completion?

**Why it matters:**
We currently use Setu's DigiLocker OAuth flow for India identity KYC. If Fable covers this,
we can consolidate to a single vendor. If not, Setu stays as the India KYC provider.

**What we need from Fable if YES:**
- Endpoint to initiate a KYC session (POST body shape, auth headers)
- Redirect URL or widget embed mechanism
- Webhook event name and payload shape on completion
- Whether they verify PAN as part of the same flow or separately (see Q3)

---

## Q2 — Canada Bank KYC

> Does Fable provide a bank-linking / open-banking API for Canadian customers?
> Specifically: can Fable verify a customer's Canadian bank account ownership (institution,
> transit, account number) via Interac / Open Banking, and return a token we store
> in `kyc_submissions.canada_verified`?

**Why it matters:**
We currently use Flinks widget for Canada bank KYC. Fable already handles Interac/EFT
collection — if they also handle the KYC step, we can eliminate Flinks entirely.

**What we need from Fable if YES:**
- Endpoint or widget SDK for Canada bank linking
- Whether the bank token from KYC can be reused for Interac EFT collection
  (i.e., customer links once → both KYC + future transfers use same token)
- Webhook shape on completion

---

## Q3 — PAN Verification

> Does Fable provide a PAN verification API?
> Specifically: given a PAN number, can Fable return `{ valid: boolean, name: string }`
> as confirmed by NSDL/UTI?

**Why it matters:**
We use Setu for PAN verification today. If Fable provides an equivalent, we can simplify
the vendor surface area. **Note:** regardless of which vendor verifies PAN, we always store
a SHA-256 hash of the PAN in `profiles.pan_hash` for Form 145 compliance — this is
non-negotiable and happens in REPAIHUB backend code, not the vendor.

**What we need from Fable if YES:**
- Endpoint for PAN verification (POST body shape, auth headers)
- Whether it's included in the India KYC flow (Q1) or a standalone call
- Rate limits and pricing

---

## Absolute constraint — Reverse Penny Drop

**Setu Reverse Penny Drop is MANDATORY regardless of answers above.**

For inward transfers, we must verify the Indian recipient's bank account (account number +
IFSC) using Setu's Reverse Penny Drop API. This is a regulatory requirement for outward
remittance recipients and Fable has confirmed they do not provide this service.

`src/services/kycService.ts → verifyInwardRecipientBank()` always routes to SetuAdapter.
This is NOT configurable via `kyc_config` and is not subject to change.

---

## Current routing (pre-meeting defaults)

| Capability             | Active provider     | Switch to change        |
|------------------------|---------------------|-------------------------|
| India identity KYC     | Setu DigiLocker     | `fable_india_kyc_enabled=true`  |
| Canada bank KYC        | Flinks              | `fable_canada_kyc_enabled=true` |
| PAN verification       | Setu                | `fable_pan_enabled=true`        |
| Reverse Penny Drop     | Setu (MANDATORY)    | Not configurable                |
| AML/PEP screening      | Skipped (mock)      | `fable_aml_screening=true`      |
