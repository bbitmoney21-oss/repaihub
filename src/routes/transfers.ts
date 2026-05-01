// [GREEN] Outward transfer routes — NRO/NRE → CAD
// Routes are thin controllers. All business logic in services + orchestrator.

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { supabaseAdmin, supabaseAdminConfigured } from '../lib/supabaseServer';
import { notifyTransferInitiated } from '../services/notifications';
import { calculateFees, recordPromoCodeUse } from '../services/feeService';
import { processReferralReward, deductUserCredit } from '../services/referralService';
import { assessOutwardRisk, calculateRiskScore, saveRiskAssessment } from '../services/riskService';
import { evaluateCompliance, saveComplianceCheck, applyDecisionEngine } from '../services/complianceService';
import { determineAccountRoute } from '../compliance/accountTypeService';
import { orchestrateOutwardTransfer } from '../orchestrator/outwardOrchestrator';
import { log } from '../services/auditService';
import type { RBIPurposeCode, SourceOfFunds } from '../types/compliance';

const router = Router();
const ts = () => new Date().toISOString();

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    accountType = 'NRO',  // NEW — NRO (default) or NRE
    exchangeRate,
    purposeCode,
    sourceOfFunds,
    speed,
    promoCode,
    tdsDeducted,
    tdsAmountInr,
    nroBankName,
    nroBranchCity,
    documents,
    lockId,
  } = req.body as {
    amountInr?: number;
    accountType?: 'NRO' | 'NRE';
    exchangeRate?: number;
    purposeCode?: RBIPurposeCode;
    sourceOfFunds?: SourceOfFunds;
    speed?: 'standard' | 'express';
    promoCode?: string;
    tdsDeducted?: boolean;
    tdsAmountInr?: number;
    nroBankName?: string;
    nroBranchCity?: string;
    documents?: string[];
    lockId?: string;
    amountCad?: number; feeCad?: number; // ignored — computed server-side
  };

  // ── Input validation ───────────────────────────────────────────────────────
  if (!amountInr || !exchangeRate || !purposeCode || !speed) {
    res.status(400).json({
      error: 'amountInr, exchangeRate, purposeCode, speed are required',
      timestamp: ts(),
    });
    return;
  }
  if (accountType === 'NRO' && !sourceOfFunds) {
    res.status(400).json({
      error: 'sourceOfFunds is required for NRO transfers',
      timestamp: ts(),
    });
    return;
  }
  if (!['NRO', 'NRE'].includes(accountType)) {
    res.status(400).json({ error: 'accountType must be NRO or NRE', timestamp: ts() });
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
    const isNRE         = accountType === 'NRE';

    res.status(201).json({
      transfer: {
        id: `demo-${Date.now()}`, user_id: req.userId, amount_inr: amountInr,
        amount_cad: grossCAD, exchange_rate: exchangeRate, fee_cad: totalFeesCAD,
        commission_cad: commissionCAD, flat_fee_cad: flatFeeCAD,
        total_fees_cad: totalFeesCAD, net_amount_cad: netAmountCAD,
        purpose_code: purposeCode, source_of_funds: sourceOfFunds, speed, reference,
        account_type: accountType, customer_model: isNRE ? 'citizen_nre' : 'p2p',
        status: isNRE ? 'processing' : 'kyc_verified',
        risk_level: 'LOW', fifteen_ca_part: isNRE ? 'EXEMPT' : 'A',
        created_at: ts(),
      },
      feeBreakdown: {
        grossAmountCAD: grossCAD, commissionCAD, flatFeeCAD, totalFeesCAD, netAmountCAD,
        breakdown: [`Commission: CAD ${commissionCAD}`, `Flat fee: CAD ${flatFeeCAD}`],
        accountTypeNote: isNRE ? 'NRE: no 15CA/15CB required' : 'NRO: standard compliance applies',
      },
      accountTypeDecision: {
        customerModel: isNRE ? 'citizen_nre' : 'p2p',
        accountType,
        requires15CACB: !isNRE,
        fifteenCAPart: isNRE ? 'EXEMPT' : 'A',
        description: isNRE ? 'NRE account — fully repatriable' : 'Demo mode',
      },
      timestamp: ts(),
    });
    return;
  }

  const userId = req.userId!;

  // ── Parallel data fetch ────────────────────────────────────────────────────
  const [historyRes, kycRes, profileRes, residencyRes] = await Promise.all([
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
      .select('full_name, email, residency_type')
      .eq('id', userId)
      .single(),
    supabaseAdmin
      .from('profiles')
      .select('residency_type')
      .eq('id', userId)
      .maybeSingle(),
  ]);

  const pastTransfers      = historyRes.data ?? [];
  const isFirstTransfer    = pastTransfers.length === 0;
  const transferCount      = pastTransfers.length;
  const monthlyCount       = pastTransfers.filter(t => isWithinCurrentMonth(t.created_at as string)).length;
  const avgAmountINR       = transferCount > 0
    ? pastTransfers.reduce((s, t) => s + Number(t.amount_inr), 0) / transferCount : 0;
  const isKYCVerified      = (kycRes.data?.canada_verified ?? false) && (kycRes.data?.india_verified ?? false);
  const docsProvided       = documents ?? [];
  const tdsDeductedBool    = tdsDeducted ?? false;
  const tdsAmountInrNum    = tdsAmountInr ?? 0;
  const residencyType      = (residencyRes.data?.residency_type ?? profileRes.data?.residency_type ?? 'work_permit') as string;

  // ── Step 1: Fee calculation ────────────────────────────────────────────────
  const fees = await calculateFees({
    amountINR:       amountInr,
    exchangeRate,
    speed,
    isFirstTransfer,
    promoCode:       promoCode ?? null,
    userId,
  });

  // ── Step 2: Account type routing (NRO vs NRE) ─────────────────────────────
  const accountTypeDecision = await determineAccountRoute(
    residencyType,
    accountType,
    amountInr,
    userId,
  );

  // ── Step 3: Risk assessment (for response data) ────────────────────────────
  const riskResult = await calculateRiskScore({
    userId,
    amountINR:           amountInr,
    sourceOfFunds:       sourceOfFunds ?? '',
    purposeCode,
    tdsDeducted:         tdsDeductedBool,
    tdsAmountINR:        tdsAmountInrNum,
    documents:           docsProvided,
    transferCount,
    monthlyTransferCount: monthlyCount,
    avgTransferAmountINR: avgAmountINR,
    isKYCVerified,
  });

  // ── Step 4: Compliance evaluation ─────────────────────────────────────────
  const complianceResult = await evaluateCompliance({
    amountINR:     amountInr,
    sourceOfFunds: (sourceOfFunds ?? 'other') as SourceOfFunds,
    documents:     docsProvided,
  });

  // ── Step 5: Decision engine ────────────────────────────────────────────────
  const decision      = applyDecisionEngine(riskResult.level, complianceResult);
  const fifteenCAPart = accountTypeDecision.fifteenCAPart;
  const reference     = genReference();

  // NRE transfers skip CA queue — always go to processing
  const initialStatus = accountTypeDecision.accountType === 'NRE'
    ? 'initiated'
    : (decision.transferStatus ?? 'initiated');

  // ── Step 6: Create transfer record ────────────────────────────────────────
  const { data: transfer, error } = await supabaseAdmin
    .from('transfers')
    .insert({
      user_id:             userId,
      amount_inr:          amountInr,
      amount_cad:          fees.grossAmountCAD,
      exchange_rate:       exchangeRate,
      fee_cad:             fees.totalFeesCAD,
      commission_cad:      fees.commissionCAD,
      repaihub_commission: fees.repaihubCommissionCAD,
      partner_commission:  fees.partnerCommissionCAD,
      flat_fee_cad:        fees.flatFeeCAD,
      express_surcharge_cad: fees.expressSurchargeCAD,
      total_fees_cad:      fees.totalFeesCAD,
      net_amount_cad:      fees.netAmountCAD,
      promo_discount_cad:  fees.promoDiscountCAD,
      credit_applied_cad:  fees.creditAppliedCAD,
      promo_code_id:       fees.promoCodeId,
      promo_code_used:     fees.promoCodeApplied,
      fee_config_snapshot: fees.feeConfigSnapshot,
      purpose_code:        purposeCode,
      source_of_funds:     sourceOfFunds ?? null,
      speed,
      priority:            speed,
      reference,
      status:              initialStatus,
      risk_score:          riskResult.score,
      risk_level:          riskResult.level,
      risk_breakdown:      riskResult.breakdown,
      compliance_status:   decision.complianceStatus,
      ca_required:         decision.caRequired,
      ca_status:           decision.caStatus,
      tds_deducted:        tdsDeductedBool,
      tds_amount_inr:      tdsAmountInrNum,
      // NEW fields
      account_type:        accountType,
      customer_model:      accountTypeDecision.customerModel,
      fifteen_ca_part:     fifteenCAPart,
      nro_bank_name:       nroBankName ?? null,
      nro_branch_city:     nroBranchCity ?? null,
      residency_type:      residencyType,
      is_mock:             true, // updated by orchestrator when Fable is called
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message, timestamp: ts() });
    return;
  }

  // ── Step 7: Fire-and-forget async side-effects ────────────────────────────
  void log('TRANSFER_INITIATED', 'customer', {
    transferId: transfer.id,
    userId,
    metadata: {
      accountType,
      customerModel: accountTypeDecision.customerModel,
      fifteenCAPart,
      risk: riskResult.level,
    },
  });

  void saveRiskAssessment(transfer.id, riskResult).catch(() => {});
  void saveComplianceCheck(transfer.id, complianceResult).catch(() => {});

  void supabaseAdmin.from('transfer_events').insert({
    transfer_id: transfer.id,
    user_id:     userId,
    status:      initialStatus,
    note:        `[GREEN] TRANSFER_INITIATED — accountType: ${accountType} | model: ${accountTypeDecision.customerModel} | 15CA Part ${fifteenCAPart} | Risk: ${riskResult.level}`,
  });

  // Compliance request (for CA portal visibility)
  void supabaseAdmin.from('compliance_requests').insert({
    transfer_id:         transfer.id,
    user_id:             userId,
    status:              riskResult.level === 'HIGH' ? 'pending' : decision.caRequired ? 'under_review' : 'approved',
    fifteen_ca_part:     fifteenCAPart,
    fifteen_cb_required: complianceResult.requires15CB && accountTypeDecision.accountType !== 'NRE',
  });

  // ── Step 8: Financial side-effects ────────────────────────────────────────
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
      status:        initialStatus,
    }).catch(() => {});
  }

  // ── Step 10: Background orchestration (non-blocking) ─────────────────────
  // Orchestrator handles: account routing, risk, CA workflow, Fable execution
  setImmediate(() => {
    orchestrateOutwardTransfer(transfer.id).catch(err =>
      console.error('[Orchestrator] outwardOrchestrator failed (non-critical):', err));
  });

  // ── Return 201 immediately ────────────────────────────────────────────────
  res.status(201).json({
    transfer,
    feeBreakdown: {
      grossAmountCAD:      fees.grossAmountCAD,
      commissionCAD:       fees.commissionCAD,
      flatFeeCAD:          fees.flatFeeCAD,
      expressSurchargeCAD: fees.expressSurchargeCAD,
      promoDiscountCAD:    fees.promoDiscountCAD,
      creditAppliedCAD:    fees.creditAppliedCAD,
      totalFeesCAD:        fees.totalFeesCAD,
      netAmountCAD:        fees.netAmountCAD,
      breakdown:           fees.breakdown,
      promoCode:           fees.promoCodeApplied,
      promoError:          fees.promoError,
      accountTypeNote:     accountTypeDecision.accountType === 'NRE'
        ? 'NRE: fully repatriable — no 15CA/15CB required'
        : `NRO: 15CA Part ${fifteenCAPart} applies`,
    },
    accountTypeDecision,
    risk: {
      score:            riskResult.score,
      level:            riskResult.level,
      breakdown:        riskResult.breakdown,
      missingDocuments: riskResult.missingDocuments,
    },
    compliance: {
      requiresCA:       complianceResult.requiresCA,
      requires15CA:     complianceResult.requires15CA,
      requires15CB:     complianceResult.requires15CB && accountTypeDecision.accountType !== 'NRE',
      documentStatus:   complianceResult.documentStatus,
    },
    decision: {
      status:  initialStatus,
      message: accountTypeDecision.accountType === 'NRE'
        ? 'NRE account — no CA approval needed. Fable will execute directly.'
        : decision.customerMessage,
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

// ── GET /transfers/:id/status ─────────────────────────────────────────────────
router.get('/:id/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.status(404).json({ error: 'Transfer not found (demo mode)', timestamp: ts() });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('transfers')
    .select('id, status, account_type, customer_model, fifteen_ca_part, risk_level, ca_required, ca_blocking, swift_reference, completed_at, provider_reference, adapter_name, is_mock, updated_at')
    .eq('id', req.params.id)
    .eq('user_id', req.userId!)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Transfer not found', timestamp: ts() });
    return;
  }

  res.json({ transfer: data, timestamp: ts() });
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
