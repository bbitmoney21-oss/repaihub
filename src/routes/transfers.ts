import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { supabaseAdmin, supabaseAdminConfigured } from '../lib/supabaseServer';
import { notifyTransferInitiated } from '../services/notifications';
import { calculateFees, recordPromoCodeUse } from '../services/feeService';
import { processReferralReward, deductUserCredit } from '../services/referralService';
import { calculateRiskScore, saveRiskAssessment } from '../services/riskService';
import { evaluateCompliance, saveComplianceCheck, applyDecisionEngine } from '../services/complianceService';
import type { RBIPurposeCode, SourceOfFunds } from '../types/compliance';

const router = Router();
const ts = () => new Date().toISOString();

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcFifteenCAPart(amountINR: number): 'A' | 'C' {
  return amountINR < 500_000 ? 'A' : 'C';
}

function genReference(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 900_000 + 100_000);
  return `RH-${year}-${rand}`;
}

function isWithinCurrentMonth(isoDate: string): boolean {
  const d = new Date(isoDate);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

// ── POST /transfers/initiate ──────────────────────────────────────────────────
router.post('/initiate', authMiddleware, async (req: AuthRequest, res: Response) => {
  const {
    amountInr,
    exchangeRate,
    purposeCode,
    sourceOfFunds,
    speed,
    promoCode,
    tdsDeducted,
    tdsAmountInr,
    documents,
  } = req.body as {
    amountInr?: number;
    exchangeRate?: number;
    purposeCode?: RBIPurposeCode;
    sourceOfFunds?: SourceOfFunds;
    speed?: 'standard' | 'express';
    promoCode?: string;
    tdsDeducted?: boolean;
    tdsAmountInr?: number;
    documents?: string[];  // wallet doc_type keys already uploaded
    // Ignored — computed server-side:
    amountCad?: number; feeCad?: number;
  };

  // ── Input validation ───────────────────────────────────────────────────────
  if (!amountInr || !exchangeRate || !purposeCode || !sourceOfFunds || !speed) {
    res.status(400).json({
      error: 'amountInr, exchangeRate, purposeCode, sourceOfFunds, speed are required',
      timestamp: ts(),
    });
    return;
  }
  if (amountInr < 1_000) {
    res.status(400).json({ error: 'Minimum transfer amount is ₹1,000', timestamp: ts() });
    return;
  }
  if (exchangeRate <= 0) {
    res.status(400).json({ error: 'exchangeRate must be positive', timestamp: ts() });
    return;
  }

  // ── Demo mode (Supabase not configured) ───────────────────────────────────
  if (!supabaseAdminConfigured) {
    const grossCAD      = Math.round((amountInr / exchangeRate) * 100) / 100;
    const commissionCAD = Math.round(grossCAD * 0.018 * 100) / 100;
    const flatFeeCAD    = 25;
    const totalFeesCAD  = Math.round((commissionCAD + flatFeeCAD) * 100) / 100;
    const netAmountCAD  = Math.round((grossCAD - totalFeesCAD) * 100) / 100;
    const reference     = genReference();
    const fifteenCAPart = calcFifteenCAPart(amountInr);

    res.status(201).json({
      transfer: {
        id: `demo-${Date.now()}`, user_id: req.userId, amount_inr: amountInr,
        amount_cad: grossCAD, exchange_rate: exchangeRate, fee_cad: totalFeesCAD,
        commission_cad: commissionCAD, flat_fee_cad: flatFeeCAD,
        total_fees_cad: totalFeesCAD, net_amount_cad: netAmountCAD,
        purpose_code: purposeCode, source_of_funds: sourceOfFunds, speed, reference,
        status: 'processing', risk_level: 'LOW', risk_score: 10, ca_required: false,
        fifteen_ca_part: fifteenCAPart, created_at: ts(),
      },
      feeBreakdown: { grossCAD, commissionCAD, flatFeeCAD, totalFeesCAD, netAmountCAD },
      risk: { score: 10, level: 'LOW', breakdown: {} },
      compliance: { requiresCA: false, requires15CA: false, requires15CB: false },
      decision: { status: 'processing', message: 'Demo mode — instant processing.' },
      fifteenCAPart, reference, timestamp: ts(),
    });
    return;
  }

  const userId = req.userId!;

  // ── Step 1: Parallel data fetch — user history + KYC ──────────────────────
  const [historyRes, kycRes, profileRes] = await Promise.all([
    supabaseAdmin
      .from('transfers')
      .select('id, amount_inr, created_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('kyc_submissions')
      .select('canada_verified, india_verified')
      .eq('user_id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single(),
  ]);

  const pastTransfers       = historyRes.data ?? [];
  const isFirstTransfer     = pastTransfers.length === 0;
  const transferCount       = pastTransfers.length;
  const monthlyCount        = pastTransfers.filter(t => isWithinCurrentMonth(t.created_at as string)).length;
  const avgAmountINR        = transferCount > 0
    ? pastTransfers.reduce((s, t) => s + Number(t.amount_inr), 0) / transferCount
    : 0;
  const isKYCVerified       = (kycRes.data?.canada_verified ?? false) &&
                              (kycRes.data?.india_verified   ?? false);
  const docsProvided        = documents ?? [];
  const tdsDeductedBool     = tdsDeducted ?? false;
  const tdsAmountInrNum     = tdsAmountInr ?? 0;

  // ── Step 2: Fee calculation (from fee_config table) ───────────────────────
  const fees = await calculateFees({
    amountINR:       amountInr,
    exchangeRate,
    speed,
    isFirstTransfer,
    promoCode:       promoCode ?? null,
    userId,
  });

  // ── Step 3: Risk scoring (from risk_rules table) ──────────────────────────
  const riskResult = await calculateRiskScore({
    userId,
    amountINR:              amountInr,
    sourceOfFunds,
    purposeCode,
    tdsDeducted:            tdsDeductedBool,
    tdsAmountINR:           tdsAmountInrNum,
    documents:              docsProvided,
    transferCount,
    monthlyTransferCount:   monthlyCount,
    avgTransferAmountINR:   avgAmountINR,
    isKYCVerified,
  });

  // ── Step 4: Compliance evaluation (from compliance_rules table) ────────────
  const complianceResult = await evaluateCompliance({
    amountINR:     amountInr,
    sourceOfFunds,
    documents:     docsProvided,
  });

  // ── Step 5: Decision engine — 3-tier Option C ─────────────────────────────
  const decision     = applyDecisionEngine(riskResult.level, complianceResult);
  const fifteenCAPart = complianceResult.fifteenCAPart;
  const reference    = genReference();

  // ── Step 6: Create transfer record ────────────────────────────────────────
  const { data: transfer, error } = await supabaseAdmin
    .from('transfers')
    .insert({
      user_id:              userId,
      amount_inr:           amountInr,
      amount_cad:           fees.grossAmountCAD,
      exchange_rate:        exchangeRate,
      fee_cad:              fees.totalFeesCAD,
      commission_cad:       fees.commissionCAD,
      repaihub_commission:  fees.repaihubCommissionCAD,
      partner_commission:   fees.partnerCommissionCAD,
      flat_fee_cad:         fees.flatFeeCAD,
      express_surcharge_cad: fees.expressSurchargeCAD,
      total_fees_cad:       fees.totalFeesCAD,
      net_amount_cad:       fees.netAmountCAD,
      promo_discount_cad:   fees.promoDiscountCAD,
      credit_applied_cad:   fees.creditAppliedCAD,
      promo_code_id:        fees.promoCodeId,
      promo_code_used:      fees.promoCodeApplied,
      fee_config_snapshot:  fees.feeConfigSnapshot,
      purpose_code:         purposeCode,
      source_of_funds:      sourceOfFunds,
      speed,
      priority:             speed,
      reference,
      status:               decision.transferStatus,
      risk_score:           riskResult.score,
      risk_level:           riskResult.level,
      risk_breakdown:       riskResult.breakdown,
      compliance_status:    decision.complianceStatus,
      ca_required:          decision.caRequired,
      ca_status:            decision.caStatus,
      tds_deducted:         tdsDeductedBool,
      tds_amount_inr:       tdsAmountInrNum,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message, timestamp: ts() });
    return;
  }

  // ── Step 7: Fire-and-forget async side-effects ────────────────────────────
  // All of these run in the background and never delay the response.

  // Audit logs
  void supabaseAdmin.from('audit_logs').insert({
    entity_type: 'transfer',
    entity_id:   transfer.id,
    action:      'initiated',
    actor:       'system',
    metadata: {
      risk:       { score: riskResult.score, level: riskResult.level },
      compliance: { requires15CA: complianceResult.requires15CA, requiresCA: complianceResult.requiresCA },
      decision:   decision.transferStatus,
    },
  });

  // Risk assessment record
  void saveRiskAssessment(transfer.id, riskResult).catch(e =>
    console.error('[Transfer] saveRiskAssessment failed:', e));

  // Compliance check record
  void saveComplianceCheck(transfer.id, complianceResult).catch(e =>
    console.error('[Transfer] saveComplianceCheck failed:', e));

  // Transfer event log
  void supabaseAdmin.from('transfer_events').insert({
    transfer_id: transfer.id,
    user_id:     userId,
    status:      decision.transferStatus,
    note:        `Risk: ${riskResult.level} (score ${riskResult.score}) | Decision: ${decision.transferStatus}`,
  });

  // Compliance request — always created for full CA visibility
  // Status reflects risk level: 'pending' for HIGH (blocking), 'under_review' for MEDIUM/LOW+CA
  void supabaseAdmin.from('compliance_requests').insert({
    transfer_id:         transfer.id,
    user_id:             userId,
    status:              riskResult.level === 'HIGH' ? 'pending' : decision.caRequired ? 'under_review' : 'approved',
    fifteen_ca_part:     fifteenCAPart,
    fifteen_cb_required: complianceResult.requires15CB,
  });

  // ── Step 8: Post-transfer financial side-effects ───────────────────────────
  // Promo code recording, credit deduction, referral reward — never block response
  try {
    await Promise.all([
      fees.promoCodeId
        ? recordPromoCodeUse(userId, fees.promoCodeId, transfer.id, fees.promoDiscountCAD)
        : Promise.resolve(),
      fees.creditAppliedCAD > 0
        ? deductUserCredit(userId, fees.creditAppliedCAD)
        : Promise.resolve(),
      isFirstTransfer
        ? processReferralReward(userId, transfer.id)
        : Promise.resolve(),
    ]);
  } catch (err) {
    console.error('[Transfer] Post-transfer processing error (non-critical):', err);
  }

  // ── Step 9: Notification ──────────────────────────────────────────────────
  if (profileRes.data) {
    notifyTransferInitiated({
      customerEmail: profileRes.data.email ?? req.userEmail ?? '',
      customerName:  profileRes.data.full_name ?? 'Customer',
      transferId:    transfer.id,
      amountINR:     amountInr,
      amountCAD:     fees.grossAmountCAD,
      status:        decision.transferStatus,
    }).catch(() => {});
  }

  // ── Step 10: Dev auto-progression (LOW + MEDIUM only — HIGH stays blocked) ─
  if (process.env.NODE_ENV === 'development' && riskResult.level !== 'HIGH') {
    import('../services/testMode').then(({ autoProgressTestTransfer }) => {
      autoProgressTestTransfer(transfer.id).catch(console.error);
    });
  }

  // ── Return response ───────────────────────────────────────────────────────
  res.status(201).json({
    transfer,
    feeBreakdown: {
      breakdown:      fees.breakdown,
      grossAmountCAD: fees.grossAmountCAD,
      commissionCAD:  fees.commissionCAD,
      flatFeeCAD:     fees.flatFeeCAD,
      expressSurchargeCAD: fees.expressSurchargeCAD,
      promoDiscount:  fees.promoDiscountCAD,
      promoCode:      fees.promoCodeApplied,
      promoError:     fees.promoError,
      creditApplied:  fees.creditAppliedCAD,
      totalFeesCAD:   fees.totalFeesCAD,
      netAmountCAD:   fees.netAmountCAD,
    },
    risk: {
      score:            riskResult.score,
      level:            riskResult.level,
      breakdown:        riskResult.breakdown,
      missingDocuments: riskResult.missingDocuments,
    },
    compliance: {
      requiresCA:        complianceResult.requiresCA,
      requires15CA:      complianceResult.requires15CA,
      requires15CB:      complianceResult.requires15CB,
      documentStatus:    complianceResult.documentStatus,
      missingDocuments:  complianceResult.missingDocuments,
    },
    decision: {
      status:  decision.transferStatus,
      message: decision.customerMessage,
    },
    fifteenCAPart,
    reference,
    timestamp: ts(),
  });
});

// ── GET /transfers/history ────────────────────────────────────────────────────
router.get('/history', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.json({ transfers: [], count: 0, timestamp: ts() });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('transfers')
    .select('*')
    .eq('user_id', req.userId!)
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message, timestamp: ts() });
    return;
  }

  res.json({ transfers: data ?? [], count: (data ?? []).length, timestamp: ts() });
});

// ── GET /transfers/:id ────────────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.status(404).json({ error: 'Transfer not found (demo mode)', timestamp: ts() });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('transfers')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.userId!)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Transfer not found', timestamp: ts() });
    return;
  }

  res.json({ transfer: data, timestamp: ts() });
});

export default router;
