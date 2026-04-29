import { supabaseAdmin } from '../lib/supabaseServer';
import type { SourceOfFunds, RBIPurposeCode } from '../types/compliance';

// ── Cache (5-min TTL, matches fee_config cache pattern) ──────────────────────

let riskRulesCache: Record<string, number> | null = null;
let riskRulesCachedAt = 0;

let docReqCache: Array<{ source_of_funds: string; document_name: string; is_required: boolean }> | null = null;
let docReqCachedAt = 0;

const CACHE_TTL_MS = 5 * 60 * 1000;

async function getRiskRules(): Promise<Record<string, number>> {
  const now = Date.now();
  if (riskRulesCache && (now - riskRulesCachedAt) < CACHE_TTL_MS) return riskRulesCache;

  const { data, error } = await supabaseAdmin
    .from('risk_rules')
    .select('factor, weight')
    .eq('is_active', true);

  if (error) throw new Error('Failed to load risk rules: ' + error.message);

  const rules: Record<string, number> = {};
  (data ?? []).forEach((r: { factor: string; weight: number }) => { rules[r.factor] = r.weight; });

  riskRulesCache    = rules;
  riskRulesCachedAt = now;
  return rules;
}

async function getDocRequirements(): Promise<Array<{ source_of_funds: string; document_name: string; is_required: boolean }>> {
  const now = Date.now();
  if (docReqCache && (now - docReqCachedAt) < CACHE_TTL_MS) return docReqCache;

  const { data, error } = await supabaseAdmin
    .from('document_requirements')
    .select('source_of_funds, document_name, is_required')
    .eq('is_active', true);

  if (error) throw new Error('Failed to load document requirements: ' + error.message);

  docReqCache    = (data ?? []) as Array<{ source_of_funds: string; document_name: string; is_required: boolean }>;
  docReqCachedAt = now;
  return docReqCache;
}

export function clearRiskCache(): void {
  riskRulesCache    = null;
  riskRulesCachedAt = 0;
  docReqCache       = null;
  docReqCachedAt    = 0;
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface RiskInput {
  userId: string;
  amountINR: number;
  sourceOfFunds: SourceOfFunds;
  purposeCode: RBIPurposeCode;
  tdsDeducted: boolean;
  tdsAmountINR: number;
  documents: string[];          // doc_type keys already in wallet (e.g. ['rent_agreement','form_16a'])
  transferCount: number;        // total historical transfers for this user
  monthlyTransferCount: number; // transfers in current calendar month
  avgTransferAmountINR: number; // historical average (0 if no history)
  isKYCVerified: boolean;       // both Canada + India KYC complete
}

export interface RiskResult {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  breakdown: Record<string, number>;   // factor → weight applied
  missingDocuments: string[];          // required but not provided
}

// ── Main scoring function ─────────────────────────────────────────────────────
// Thresholds: 0–30 = LOW, 31–70 = MEDIUM, 71+ = HIGH

export async function calculateRiskScore(input: RiskInput): Promise<RiskResult> {
  const [rules, docRequirements] = await Promise.all([
    getRiskRules(),
    getDocRequirements(),
  ]);

  const breakdown: Record<string, number> = {};
  let raw = 0;

  function apply(factor: string): void {
    const w = rules[factor] ?? 0;
    if (w === 0) return;
    breakdown[factor] = w;
    raw += w;
  }

  // ── 1. Amount factor (exactly one) ────────────────────────────────────────
  if (input.amountINR < 500_000) {
    apply('amount_low');
  } else if (input.amountINR <= 2_500_000) {
    apply('amount_medium');
  } else {
    apply('amount_high');
  }

  // ── 2. User history factors (may stack) ───────────────────────────────────
  if (input.transferCount === 0) {
    apply('no_history');
    apply('new_user');
  } else if (input.transferCount < 3) {
    apply('new_user');
  }

  if (input.isKYCVerified) {
    apply('verified_user');  // negative weight
  }

  // ── 3. Behavioral factors ─────────────────────────────────────────────────
  if (input.monthlyTransferCount > 5) {
    apply('high_frequency');
  }

  const isSpike =
    input.transferCount > 0 &&
    input.avgTransferAmountINR > 0 &&
    input.amountINR > input.avgTransferAmountINR * 3;

  if (isSpike) {
    apply('sudden_spike');
  } else if (input.transferCount >= 5) {
    apply('consistent_behavior');  // negative weight
  }

  // ── 4. Source of funds factor (exactly one) ───────────────────────────────
  const unknownSources: SourceOfFunds[] = ['gift_from_relative', 'other'];
  if (unknownSources.includes(input.sourceOfFunds)) {
    apply('unknown_source');
  } else {
    apply('known_source');
  }

  // ── 5. Purpose code factor (exactly one) ─────────────────────────────────
  const riskyPurposes: RBIPurposeCode[] = ['P0001'];  // investment abroad
  if (riskyPurposes.includes(input.purposeCode)) {
    apply('purpose_risky');
  } else {
    apply('purpose_safe');
  }

  // ── 6. Document completeness (exactly one) ────────────────────────────────
  const requiredDocs = docRequirements
    .filter(d => d.source_of_funds === input.sourceOfFunds && d.is_required)
    .map(d => d.document_name);

  const provided     = new Set(input.documents);
  const missingDocs  = requiredDocs.filter(d => !provided.has(d));
  const presentCount = requiredDocs.length - missingDocs.length;

  if (requiredDocs.length === 0 || presentCount === requiredDocs.length) {
    apply('complete_docs');  // negative weight
  } else if (presentCount === 0) {
    apply('missing_docs');
  } else {
    apply('partial_docs');
  }

  // ── 7. TDS factor (at most one) ───────────────────────────────────────────
  const tdsExpectedSources: SourceOfFunds[] = [
    'rental_income', 'dividend_income', 'salary_arrears', 'property_sale',
  ];

  if (!input.tdsDeducted) {
    if (tdsExpectedSources.includes(input.sourceOfFunds)) {
      apply('tds_missing');
    }
    // For pension/gift/matured_investment/other — TDS not expected, no penalty
  } else if (input.tdsAmountINR > 0) {
    const rate = input.tdsAmountINR / input.amountINR;
    if (rate >= 0.01 && rate <= 0.35) {
      apply('tds_valid');   // negative weight
    } else {
      apply('tds_mismatch'); // suspicious rate
    }
  }

  // ── Final score (clamped to 0) ────────────────────────────────────────────
  const score = Math.max(0, raw);
  const level: RiskResult['level'] = score <= 30 ? 'LOW' : score <= 70 ? 'MEDIUM' : 'HIGH';

  return { score, level, breakdown, missingDocuments: missingDocs };
}

// ── Persist to risk_assessments (fire-and-forget) ────────────────────────────

export async function saveRiskAssessment(
  transferId: string,
  result: RiskResult,
): Promise<void> {
  await supabaseAdmin.from('risk_assessments').insert({
    transfer_id: transferId,
    score:       result.score,
    level:       result.level,
    breakdown:   result.breakdown,
  });
}
