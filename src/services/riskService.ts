import { supabaseAdmin } from '../lib/supabaseServer';

// ── Config cache (5-min TTL) ─────────────────────────────────────────────────

let riskConfigCache: Record<string, string> | null = null;
let riskConfigCachedAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getRiskConfig(): Promise<Record<string, string>> {
  if (riskConfigCache && Date.now() - riskConfigCachedAt < CACHE_TTL) {
    return riskConfigCache;
  }
  const { data } = await supabaseAdmin.from('risk_config').select('key, value');
  riskConfigCache = Object.fromEntries(
    (data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]),
  );
  riskConfigCachedAt = Date.now();
  return riskConfigCache;
}

// Exported for admin cache-clear endpoint
export function clearRiskCache(): void {
  riskConfigCache = null;
  riskConfigCachedAt = 0;
}

// ── Public types ─────────────────────────────────────────────────────────────

export interface RiskResult {
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
  caRequired: boolean;
  caBlocking: boolean;        // true = transfer BLOCKED until CA approves
  rulesApplied: string[];
  // Backward-compat fields used by existing code
  score: number;
  breakdown: Record<string, number>;
  missingDocuments: string[];
}

// ── OUTWARD RISK ASSESSMENT (NRO → Canada) ───────────────────────────────────
export async function assessOutwardRisk(
  amountINR: number,
  userId: string,
  sourceOfFunds: string | null,
  tdsDeducted: boolean,
): Promise<RiskResult> {
  let cfg: Record<string, string>;
  try {
    cfg = await getRiskConfig();
  } catch {
    // Fallback defaults if risk_config table not yet created
    cfg = {};
  }

  const rules: string[] = [];

  // BLOCKING: Missing source of funds
  if (cfg['block_missing_source_of_funds'] !== 'false' && !sourceOfFunds) {
    return {
      level: 'HIGH',
      reason: 'Source of funds not declared — required for all transfers',
      caRequired: true,
      caBlocking: true,
      rulesApplied: ['block_missing_source_of_funds'],
      score: 100, breakdown: {}, missingDocuments: [],
    };
  }

  // BLOCKING: Missing TDS declaration on large transfer
  const tdsBlockThreshold = Number(cfg['block_missing_tds_above_inr'] ?? 500000);
  if (amountINR > tdsBlockThreshold && !tdsDeducted) {
    return {
      level: 'HIGH',
      reason: `TDS declaration required for transfers above ₹${tdsBlockThreshold.toLocaleString('en-IN')}`,
      caRequired: true,
      caBlocking: true,
      rulesApplied: ['block_missing_tds_above_inr'],
      score: 100, breakdown: {}, missingDocuments: [],
    };
  }

  // LOW: Below 15CA Part A auto-approve threshold
  const autoApproveBelow = Number(cfg['outward_auto_approve_below_inr'] ?? 500000);
  if (amountINR <= autoApproveBelow) {
    rules.push('outward_auto_approve_below_inr');
    return {
      level: 'LOW',
      reason: `Transfer below ₹${autoApproveBelow.toLocaleString('en-IN')} — 15CA Part A, no CA required`,
      caRequired: false,
      caBlocking: false,
      rulesApplied: rules,
      score: 10, breakdown: {}, missingDocuments: [],
    };
  }

  // Fetch completed transfer count for this user
  let completedCount = 0;
  try {
    const { count } = await supabaseAdmin
      .from('transfers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed');
    completedCount = count ?? 0;
  } catch {
    completedCount = 0;
  }

  // HIGH: First transfer ever
  if (completedCount === 0 && cfg['outward_high_risk_first_transfer'] !== 'false') {
    rules.push('outward_high_risk_first_transfer');
    return {
      level: 'HIGH',
      reason: 'First transfer — CA review required before processing',
      caRequired: true,
      caBlocking: true,
      rulesApplied: rules,
      score: 80, breakdown: {}, missingDocuments: [],
    };
  }

  // MEDIUM: Large transfer regardless of history (NON-BLOCKING)
  const largeThreshold = Number(cfg['outward_large_transfer_inr'] ?? 5000000);
  if (amountINR > largeThreshold) {
    rules.push('outward_large_transfer_inr');
    return {
      level: 'MEDIUM',
      reason: `Transfer above ₹${largeThreshold.toLocaleString('en-IN')} — CA reviews in parallel, transfer proceeds`,
      caRequired: true,
      caBlocking: false,
      rulesApplied: rules,
      score: 50, breakdown: {}, missingDocuments: [],
    };
  }

  // MEDIUM: Has some history but below trusted threshold (NON-BLOCKING)
  const trustedAfter = Number(cfg['outward_trusted_after_n_transfers'] ?? 3);
  if (completedCount < trustedAfter) {
    rules.push('outward_trusted_after_n_transfers');
    return {
      level: 'MEDIUM',
      reason: `${completedCount} completed transfer(s) — CA reviews in parallel, transfer proceeds`,
      caRequired: true,
      caBlocking: false,
      rulesApplied: rules,
      score: 40, breakdown: {}, missingDocuments: [],
    };
  }

  // LOW: Trusted customer with clean history
  rules.push('trusted_customer');
  return {
    level: 'LOW',
    reason: `Trusted customer with ${completedCount} clean transfers — auto-approved`,
    caRequired: false,
    caBlocking: false,
    rulesApplied: rules,
    score: 15, breakdown: {}, missingDocuments: [],
  };
}

// ── INWARD RISK ASSESSMENT (CAD → INR) ──────────────────────────────────────
export async function assessInwardRisk(
  amountCAD: number,
  userId: string,
): Promise<RiskResult> {
  let cfg: Record<string, string>;
  try {
    cfg = await getRiskConfig();
  } catch {
    cfg = {};
  }

  const rules: string[] = [];

  // HIGH: Above FINTRAC threshold — hold + flag for compliance review
  const fintracThreshold = Number(cfg['inward_fintrac_threshold_cad'] ?? 10000);
  if (amountCAD >= fintracThreshold) {
    rules.push('inward_fintrac_threshold_cad');
    return {
      level: 'HIGH',
      reason: `Transfer at or above CAD ${fintracThreshold.toLocaleString()} — FINTRAC reporting required, manual review`,
      caRequired: false,
      caBlocking: true,
      rulesApplied: rules,
      score: 90, breakdown: {}, missingDocuments: [],
    };
  }

  // Get inward completed count for this customer
  let completedInward = 0;
  try {
    const { count } = await supabaseAdmin
      .from('inward_transfers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed');
    completedInward = count ?? 0;
  } catch {
    completedInward = 0;
  }

  // LOW: Below auto-approve threshold
  const autoApprove = Number(cfg['inward_auto_approve_below_cad'] ?? 3000);
  if (amountCAD <= autoApprove) {
    rules.push('inward_auto_approve_below_cad');
    return {
      level: 'LOW',
      reason: `Amount below CAD ${autoApprove} auto-approve threshold`,
      caRequired: false,
      caBlocking: false,
      rulesApplied: rules,
      score: 10, breakdown: {}, missingDocuments: [],
    };
  }

  // LOW: Trusted inward customer above auto-approve threshold
  const trustedAfterInward = Number(cfg['inward_trusted_after_n_transfers'] ?? 2);
  if (completedInward >= trustedAfterInward) {
    rules.push('trusted_inward_customer');
    return {
      level: 'LOW',
      reason: `Trusted customer with ${completedInward} completed inward transfers`,
      caRequired: false,
      caBlocking: false,
      rulesApplied: rules,
      score: 15, breakdown: {}, missingDocuments: [],
    };
  }

  // MEDIUM: Everything else
  rules.push('default_medium');
  return {
    level: 'MEDIUM',
    reason: `CAD ${amountCAD} transfer — standard compliance check, proceeds immediately`,
    caRequired: false,
    caBlocking: false,
    rulesApplied: rules,
    score: 35, breakdown: {}, missingDocuments: [],
  };
}

// ── STORE RISK ASSESSMENT ────────────────────────────────────────────────────
export async function storeRiskAssessment(
  transferId: string,
  transferType: 'outward' | 'inward',
  result: RiskResult,
): Promise<void> {
  try {
    await supabaseAdmin.from('risk_assessments').insert({
      transfer_id:   transferId,
      transfer_type: transferType,
      level:         result.level,
      reason:        result.reason,
      rules_applied: result.rulesApplied,
      score:         result.score,
      breakdown:     result.breakdown,
    });
  } catch (err) {
    console.error('[Risk] Failed to store assessment:', err);
  }
}

// Backward-compat alias used by existing admin route + transfers.ts
export async function saveRiskAssessment(
  transferId: string,
  result: RiskResult,
): Promise<void> {
  return storeRiskAssessment(transferId, 'outward', result);
}

// ── BACKWARD-COMPAT ALIAS ─────────────────────────────────────────────────────
// Used by the existing transfers.ts route which was built before orchestrators.
// Wraps assessOutwardRisk so both old and new callers work without changes.
export async function calculateRiskScore(input: {
  userId: string;
  amountINR: number;
  sourceOfFunds: string;
  purposeCode?: string;
  tdsDeducted: boolean;
  tdsAmountINR?: number;
  documents?: string[];
  transferCount?: number;
  monthlyTransferCount?: number;
  avgTransferAmountINR?: number;
  isKYCVerified?: boolean;
}): Promise<RiskResult> {
  return assessOutwardRisk(
    input.amountINR,
    input.userId,
    input.sourceOfFunds,
    input.tdsDeducted,
  );
}

// ── DETERMINE TRANSFER STATUS ────────────────────────────────────────────────
// Translates risk result + 15CB requirement into a concrete transfer status string.
export function determineTransferStatus(
  risk: RiskResult,
  requires15CB: boolean,
): string {
  if (risk.caBlocking) {
    return risk.level === 'HIGH' && requires15CB
      ? '15CB_REQUESTED'      // Blocked — CA must certify before proceeding
      : 'PENDING_REVIEW';     // Blocked — general hold for review
  }
  if (requires15CB) {
    return '15CB_REQUESTED';  // Non-blocking — CA reviews in parallel
  }
  return 'KYC_VERIFIED';      // LOW risk — no CA needed
}
