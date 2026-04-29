import { supabaseAdmin } from '../lib/supabaseServer';
import type { SourceOfFunds } from '../types/compliance';

// ── Cache (5-min TTL) ─────────────────────────────────────────────────────────

interface ComplianceRule {
  source_of_funds: string;
  requires_15ca: boolean;
  requires_15cb: boolean;
  min_amount_inr: number;
  max_amount_inr: number | null;
}

interface DocRequirement {
  source_of_funds: string;
  document_name: string;
  doc_label: string;
  is_required: boolean;
}

let complianceRulesCache: ComplianceRule[] | null = null;
let complianceRulesCachedAt = 0;

let docLabelsCache: DocRequirement[] | null = null;
let docLabelsCachedAt = 0;

const CACHE_TTL_MS = 5 * 60 * 1000;

async function getComplianceRules(): Promise<ComplianceRule[]> {
  const now = Date.now();
  if (complianceRulesCache && (now - complianceRulesCachedAt) < CACHE_TTL_MS) return complianceRulesCache;

  const { data, error } = await supabaseAdmin
    .from('compliance_rules')
    .select('source_of_funds, requires_15ca, requires_15cb, min_amount_inr, max_amount_inr')
    .eq('is_active', true)
    .order('min_amount_inr', { ascending: true });

  if (error) throw new Error('Failed to load compliance rules: ' + error.message);

  complianceRulesCache    = (data ?? []) as ComplianceRule[];
  complianceRulesCachedAt = now;
  return complianceRulesCache;
}

async function getDocLabels(): Promise<DocRequirement[]> {
  const now = Date.now();
  if (docLabelsCache && (now - docLabelsCachedAt) < CACHE_TTL_MS) return docLabelsCache;

  const { data, error } = await supabaseAdmin
    .from('document_requirements')
    .select('source_of_funds, document_name, doc_label, is_required')
    .eq('is_active', true);

  if (error) throw new Error('Failed to load document requirements: ' + error.message);

  docLabelsCache    = (data ?? []) as DocRequirement[];
  docLabelsCachedAt = now;
  return docLabelsCache;
}

export function clearComplianceCache(): void {
  complianceRulesCache    = null;
  complianceRulesCachedAt = 0;
  docLabelsCache          = null;
  docLabelsCachedAt       = 0;
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface ComplianceInput {
  amountINR: number;
  sourceOfFunds: SourceOfFunds;
  documents: string[];   // doc_type keys provided at initiation
}

export interface ComplianceResult {
  requires15CA: boolean;
  requires15CB: boolean;
  requiresCA: boolean;          // true if ANY CA action is needed
  missingDocuments: Array<{ name: string; label: string }>;
  documentStatus: 'COMPLETE' | 'PARTIAL' | 'MISSING' | 'NOT_REQUIRED';
  fifteenCAPart: 'A' | 'C';    // 'A' for < ₹5L, 'C' for >= ₹5L
}

// ── Main compliance evaluation ────────────────────────────────────────────────

export async function evaluateCompliance(input: ComplianceInput): Promise<ComplianceResult> {
  const [rules, docLabels] = await Promise.all([
    getComplianceRules(),
    getDocLabels(),
  ]);

  // Find the applicable compliance rule (match source or 'all', and amount range)
  const applicableRule = rules.find(r => {
    const sourceMatch = r.source_of_funds === 'all' || r.source_of_funds === input.sourceOfFunds;
    const minMatch    = input.amountINR >= Number(r.min_amount_inr);
    const maxMatch    = r.max_amount_inr === null || input.amountINR <= Number(r.max_amount_inr);
    return sourceMatch && minMatch && maxMatch;
  });

  // Default to most conservative if no rule found
  const requires15CA = applicableRule?.requires_15ca ?? (input.amountINR >= 500_000);
  const requires15CB = applicableRule?.requires_15cb ?? (input.amountINR >= 500_000);
  const fifteenCAPart: 'A' | 'C' = input.amountINR < 500_000 ? 'A' : 'C';

  // Check document completeness for this source
  const required = docLabels.filter(
    d => d.source_of_funds === input.sourceOfFunds && d.is_required,
  );

  const provided = new Set(input.documents);
  const missing  = required.filter(d => !provided.has(d.document_name));

  let documentStatus: ComplianceResult['documentStatus'];
  if (required.length === 0) {
    documentStatus = 'NOT_REQUIRED';
  } else if (missing.length === 0) {
    documentStatus = 'COMPLETE';
  } else if (missing.length < required.length) {
    documentStatus = 'PARTIAL';
  } else {
    documentStatus = 'MISSING';
  }

  const requiresCA = requires15CA || requires15CB;

  return {
    requires15CA,
    requires15CB,
    requiresCA,
    missingDocuments: missing.map(d => ({ name: d.document_name, label: d.doc_label })),
    documentStatus,
    fifteenCAPart,
  };
}

// ── Persist compliance check (fire-and-forget) ────────────────────────────────

export async function saveComplianceCheck(
  transferId: string,
  result: ComplianceResult,
): Promise<void> {
  await supabaseAdmin.from('compliance_checks').insert({
    transfer_id:        transferId,
    requires_ca:        result.requiresCA,
    requires_15ca:      result.requires15CA,
    requires_15cb:      result.requires15CB,
    missing_documents:  result.missingDocuments.map(d => d.name),
    status:             result.documentStatus,
  });
}

// ── 3-tier decision engine ────────────────────────────────────────────────────
// Combines risk level + compliance result into a concrete transfer decision.
//
// LOW  risk → PROCESSING           — instant, no CA blocking
// MED  risk → PROCESSING_WITH_COMPLIANCE — transfer proceeds, CA reviews async
// HIGH risk → PENDING_CA_APPROVAL  — blocked, CA must approve first

export interface TransferDecision {
  transferStatus: string;
  caRequired: boolean;
  caStatus: string;
  complianceStatus: string;
  customerMessage: string;
}

export function applyDecisionEngine(
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH',
  complianceResult: ComplianceResult,
): TransferDecision {
  const { requiresCA, requires15CA } = complianceResult;

  if (riskLevel === 'HIGH') {
    return {
      transferStatus:    'pending_ca_approval',
      caRequired:        true,
      caStatus:          'PENDING',
      complianceStatus:  'PENDING_REVIEW',
      customerMessage:
        'Your transfer requires additional verification by our CA partner. ' +
        'We will contact you within 2 business hours. No funds have been debited.',
    };
  }

  if (riskLevel === 'MEDIUM') {
    return {
      transferStatus:    'processing_with_compliance',
      caRequired:        true,
      caStatus:          'IN_REVIEW',
      complianceStatus:  requiresCA ? 'PENDING_REVIEW' : 'NOT_REQUIRED',
      customerMessage:
        'Your transfer is being processed. Our CA partner is conducting a ' +
        'parallel compliance review — this does not delay your transfer.',
    };
  }

  // LOW risk
  if (!requires15CA) {
    // Small amount, no CA needed at all
    return {
      transferStatus:    'processing',
      caRequired:        false,
      caStatus:          'NOT_REQUIRED',
      complianceStatus:  'NOT_REQUIRED',
      customerMessage:
        'Your transfer is being processed instantly. ' +
        'Funds will arrive within 1–2 business days.',
    };
  }

  // LOW risk but large amount — 15CA/15CB still required, CA files async (non-blocking)
  return {
    transferStatus:    'processing',
    caRequired:        true,
    caStatus:          'IN_REVIEW',
    complianceStatus:  'PENDING_REVIEW',
    customerMessage:
      'Your transfer is being processed. Our CA partner will file the required ' +
      '15CA/15CB forms — this does not delay your transfer.',
  };
}
