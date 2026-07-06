import dotenv from 'dotenv';
dotenv.config();

/**
 * REPAIHUB — RBI Compliance Rules
 *
 * ALL thresholds are read from environment variables.
 * When RBI updates rules: change the env var in Render dashboard.
 * Zero code deployment needed. Change is immediate.
 *
 * RBI Rule update history:
 * 2026-04-01: Form 15CA/15CB renamed to Form 145/146 (IT Act 2025)
 */
export const getRBIRules = () => ({
  // Annual NRO outward limit — USD 1M = approx Rs. 8.3 crore
  annualLimitInr: Number(process.env.RBI_ANNUAL_LIMIT_INR ?? 83_000_000),

  // Below this: no forms needed — fast track processing
  fastTrackMaxInr: Number(process.env.RBI_FAST_TRACK_MAX_INR ?? 50_000),

  // Above this: Form 145 (formerly 15CA) must be auto-filed
  form145ThresholdInr: Number(process.env.RBI_FORM145_THRESHOLD_INR ?? 50_000),

  // Above this: CA must certify Form 146 (formerly 15CB)
  form146ThresholdInr: Number(process.env.RBI_FORM146_THRESHOLD_INR ?? 500_000),

  // Internal safety cap on single transaction
  maxSingleTxInr: Number(process.env.RBI_MAX_SINGLE_TX_INR ?? 8_300_000),

  // Canadian law: report transfers above this to FINTRAC
  fintracThresholdCad: Number(process.env.RBI_FINTRAC_THRESHOLD_CAD ?? 10_000),

  // TCS threshold for inward remittances
  tcsThresholdInr: Number(process.env.RBI_TCS_THRESHOLD_INR ?? 700_000),

  // Indian financial year start month (3 = April, zero-indexed)
  fyStartMonth: Number(process.env.RBI_FY_START_MONTH ?? 3),

  // Enabled RBI purpose codes for outward transfers (REQ-03)
  // S0014 = NRO repatriation (repatriation of non-resident deposits) — correct RBI AP Dir code
  // P1302 = NRE repatriation | P0001 = Investment abroad | S0001 = Services | P1101 = Family maintenance
  // IMPORTANT: Update RBI_PURPOSE_CODES_ENABLED env var on Render to match this default.
  purposeCodesEnabled: (
    process.env.RBI_PURPOSE_CODES_ENABLED ??
    'S0014,P1302,P0001,S0001,P1101'
  ).split(',').map(c => c.trim()),

  // Date of last RBI rule update — shown in app and audit logs
  rulesVersion: process.env.COMPLIANCE_RULES_VERSION ?? '2026-04-01',
});

export type RBIRules = ReturnType<typeof getRBIRules>;

export interface ComplianceRequirementsOptions {
  purposeCode?: string;
  fyOutwardTotalInr?: number;
}

/**
 * Determine compliance requirements for an outward transfer amount.
 * Always call this fresh — reads env vars on every call.
 *
 * Optional purposeCode: property sale (P1004) always forces Form 145 Part C + Form 146.
 * Optional fyOutwardTotalInr: cumulative FY outward amount (including this transfer).
 * When fyOutwardTotalInr >= form146ThresholdInr the Part escalates to C even if single
 * amount is below the threshold.
 */
export const getComplianceRequirements = (
  amountInr: number,
  opts: ComplianceRequirementsOptions = {},
) => {
  const rules = getRBIRules();
  const { purposeCode, fyOutwardTotalInr } = opts;

  const isPropertySale = purposeCode === 'P1004';
  const fyTotal = fyOutwardTotalInr ?? amountInr;

  // Form 146 required when: single amount > threshold, OR cumulative FY exceeds threshold, OR property sale
  const requiresForm146 =
    amountInr > rules.form146ThresholdInr ||
    fyTotal > rules.form146ThresholdInr ||
    isPropertySale;

  // Form 145 Part C: same conditions as Form 146 requirement
  const form145Part: 'A' | 'C' = requiresForm146 ? 'C' : 'A';

  return {
    isFastTrack: amountInr < rules.fastTrackMaxInr,
    requiresForm145: amountInr >= rules.form145ThresholdInr,
    requiresForm146,
    form145Part,
    isPropertySale,
    fyOutwardTotalInr: fyTotal,
    exceedsMaxSingle: amountInr > rules.maxSingleTxInr,
    rulesVersion: rules.rulesVersion,
    purposeCodeValid: (code: string) =>
      rules.purposeCodesEnabled.includes(code),
  };
};

/**
 * Get the financial year start date for annual limit tracking.
 */
export const getFYStartDate = (): Date => {
  const rules = getRBIRules();
  const now = new Date();
  const fyStart = new Date(now.getFullYear(), rules.fyStartMonth, 1);
  if (now < fyStart) {
    fyStart.setFullYear(fyStart.getFullYear() - 1);
  }
  return fyStart;
};

/**
 * Human-readable compliance summary for display in app and audit logs.
 */
export const getComplianceSummary = (amountInr: number) => {
  const reqs = getComplianceRequirements(amountInr);
  const rules = getRBIRules();
  return {
    form145: reqs.requiresForm145
      ? 'Filed automatically by REPAIHUB'
      : 'Not required (below threshold)',
    form146: reqs.requiresForm146
      ? 'CA partner certifies (2-8 hours)'
      : 'Not required (below threshold)',
    fastTrack: reqs.isFastTrack,
    estimatedTime: reqs.requiresForm146
      ? '8-24 hours'
      : reqs.requiresForm145
      ? '4-8 hours'
      : '2-4 hours',
    rulesVersion: rules.rulesVersion,
  };
};
