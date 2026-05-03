// NOTE: Under India Income Tax Act 2025 (effective 1 Apr 2026):
// Form 15CA is now Form 145 | Form 15CB is now Form 146
// Section 195 is now Section 397(3)(d)

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { supabaseAdmin, supabaseAdminConfigured } from '../lib/supabaseServer';
import { notifyTransferInitiated } from '../services/notifications';
import { calculateFees, recordPromoCodeUse } from '../services/feeService';
import { processReferralReward, deductUserCredit } from '../services/referralService';
import { assessOutwardRisk, calculateRiskScore, saveRiskAssessment } from '../services/riskService';
import { evaluateCompliance, saveComplianceCheck, applyDecisionEngine } from '../services/complianceService';
import { determineAccountRoute } from '../compliance/accountTypeService';
import { checkFemaLimit, FEMA_MAX_INR } from '../compliance/femaService';
import { orchestrateOutwardTransfer } from '../orchestrator/outwardOrchestrator';
import { log } from '../services/auditService';
import { getRBIRules, getComplianceRequirements, getComplianceSummary, getFYStartDate } from '../config/rbiRules';
import type { RBIPurposeCode, SourceOfFunds } from '../types/compliance';

const router = Router();
const ts = () => new Date().toISOString();

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

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

// Source-of-funds → required supporting doc type + suggested purpose code
const SOURCE_OF_FUNDS_MAP: Record<string, { purposeCode: string; docType: string; label: string }> = {
  rental_income:       { purposeCode: 'P1301', docType: 'bank_statement',  label: 'Rental Income' },
  pension_income:      { purposeCode: 'P1101', docType: 'bank_statement',  label: 'Pension Income' },
  dividend_income:     { purposeCode: 'P0001', docType: 'investment_proof', label: 'Dividend Income' },
  property_sale:       { purposeCode: 'P1301', docType: 'property_deed',   label: 'Property Sale Proceeds' },
  bank_interest:       { purposeCode: 'P1301', docType: 'bank_statement',  label: 'Bank Interest' },
  accumulated_savings: { purposeCode: 'P1301', docType: 'bank_statement',  label: 'Accumulated Savings' },
  business_income:     { purposeCode: 'S0001', docType: 'bank_statement',  label: 'Business Income' },
};

// Query cumulative FY outward transfer total for a user (completed + in-flight, excluding this transfer)
async function getFYOutwardTotal(userId: string): Promise<number> {
  const fyStart = getFYStartDate().toISOString();
  const { data } = await supabaseAdmin
    .from('transfers')
    .select('amount_inr')
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .neq('status', 'failed')
    .gte('created_at', fyStart);
  return (data ?? []).reduce((sum, t) => sum + Number(t.amount_inr ?? 0), 0);
}

// ── GET /transfers/rate ───────────────────────────────────────────────────────
router.get('/rate', authMiddleware, (_req: AuthRequest, res: Response) => {
  const rules = getRBIRules();
  const direction = (_req.query.direction as string) || 'outward';
  const isOutward = direction === 'outward';
  const midmarket = isOutward ? 0.01612 : 62.10;  // TODO: replace with live Fable rate API
  const spread = isOutward ? midmarket * 0.008 : midmarket * 0.008;
  res.json({
    success: true,
    direction,
    pair: isOutward ? 'INR/CAD' : 'CAD/INR',
    midmarket,
    yourRate: isOutward ? parseFloat((midmarket - spread).toFixed(6)) : parseFloat((midmarket - spread).toFixed(4)),
    spread: '0.8%',
    lockDurationSeconds: 1800,
    timestamp: ts(),
    rbiRulesVersion: rules.rulesVersion,
  });
});

// ── GET /transfers/compliance-info ────────────────────────────────────────────
router.get('/compliance-info', authMiddleware, (req: AuthRequest, res: Response) => {
  const amountInr = Number(req.query.amountInr);
  if (!amountInr || isNaN(amountInr) || amountInr <= 0) {
    res.status(400).json({ error: 'amountInr query parameter is required and must be positive', timestamp: ts() });
    return;
  }
  const reqs = getComplianceRequirements(amountInr);
  const summary = getComplianceSummary(amountInr);
  const rules = getRBIRules();
  res.json({
    success: true,
    amountInr,
    ...reqs,
    ...summary,
    fyStart: getFYStartDate().toISOString().split('T')[0],
    annualLimitInr: rules.annualLimitInr,
    timestamp: ts(),
  });
});

// ── GET /transfers/compliance ─────────────────────────────────────────────────
// Returns full compliance determination for a given amount + purpose code,
// including cumulative FY tracking for the authenticated user.
router.get('/compliance', authMiddleware, async (req: AuthRequest, res: Response) => {
  const amountInr = Number(req.query.amountInr);
  const purposeCode = (req.query.purposeCode as string) || undefined;
  if (!amountInr || isNaN(amountInr) || amountInr <= 0) {
    res.status(400).json({ error: 'amountInr query parameter is required and must be positive', timestamp: ts() });
    return;
  }

  let fyOutwardTotalInr = amountInr;
  if (supabaseAdminConfigured) {
    const existing = await getFYOutwardTotal(req.userId!);
    fyOutwardTotalInr = existing + amountInr;
  }

  const reqs = getComplianceRequirements(amountInr, { purposeCode, fyOutwardTotalInr });
  const summary = getComplianceSummary(amountInr);
  const rules = getRBIRules();
  const sofInfo = purposeCode ? null : null;
  void sofInfo;

  res.json({
    success: true,
    amountInr,
    purposeCode: purposeCode ?? null,
    ...reqs,
    ...summary,
    fyTracking: {
      fyStart: getFYStartDate().toISOString().split('T')[0],
      fyOutwardTotalInr,
      annualLimitInr: rules.annualLimitInr,
      remainingAnnualLimitInr: Math.max(0, rules.annualLimitInr - fyOutwardTotalInr),
    },
    caQueueEnabled: true,
    udinRequired: reqs.requiresForm146,
    timestamp: ts(),
  });
});

// ── POST /transfers/initiate ──────────────────────────────────────────────────
router.post('/initiate', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
  // ─── all logic wrapped — Express 4.x does not catch async throws automatically
  const {
    direction = 'outward',
    amountFrom,
    fromAccount: _fromAccount,
    toAccount: _toAccount,
    amountInr: amountInrRaw,
    accountType = 'NRO',
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
    idempotencyKey,
    panNumber,
  } = req.body as {
    direction?: 'outward' | 'inward';
    amountFrom?: number;
    fromAccount?: Record<string, unknown>;  // future use — stored in DB
    toAccount?: Record<string, unknown>;    // future use — stored in DB
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
    idempotencyKey?: string;
    panNumber?: string;
    amountCad?: number; feeCad?: number;
  };

  // ── INWARD TRANSFER (Canada → India) ─────────────────────────────────────
  // When direction is 'inward', route to inward logic immediately
  if (direction === 'inward') {
    const rules = getRBIRules();
    const amountCadIn = amountFrom ?? 0;
    if (!amountCadIn || amountCadIn <= 0) {
      res.status(400).json({ error: 'amountFrom is required for inward transfers', timestamp: ts() });
      return;
    }
    if (!speed) {
      res.status(400).json({ error: 'speed (standard|express) is required', timestamp: ts() });
      return;
    }
    const fintracReport = amountCadIn >= rules.fintracThresholdCad;
    // Inward fee model: user enters the amount they want to convert.
    // The \$1.99 small-transfer fee is charged ON TOP of that amount when
    // it's below \$500. The rail converts the full amountCadIn (=> recipient
    // receives amountCadIn * rate). REPAIHUB collects (amountCadIn + flatFee)
    // from the customer and keeps flatFee as revenue (FX-spread is the rest).
    const SMALL_TXN_FEE_CAD = 1.99;
    const FREE_THRESHOLD_CAD = 500;
    const flatFee = amountCadIn < FREE_THRESHOLD_CAD ? SMALL_TXN_FEE_CAD : 0;
    const expressFee = 0;
    const totalChargedCad = parseFloat((amountCadIn + flatFee).toFixed(2));
    const exchangeRateInward = 60.91;  // TODO: live Fable rate
    const amountInrOut = parseFloat((amountCadIn * exchangeRateInward).toFixed(2));
    const reference = genReference();

    if (!supabaseAdminConfigured) {
      res.json({
        success: true,
        transfer: {
          id: `demo-in-${Date.now()}`, direction: 'inward', reference, status: 'initiated',
          amountCad: amountCadIn, amountInr: amountInrOut, flatFee, expressFee,
          totalChargedCad,
          exchangeRate: exchangeRateInward, speed, fintracReport,
        },
        fintracReport, timestamp: ts(),
      });
      return;
    }

    // Pull recipient details from the user's profile + most-recent India NRO
    // account.  inward_transfers has NOT NULL constraints on recipient_name,
    // recipient_bank_name and recipient_ifsc — without these, every insert
    // 500's with 'null value in column ...'.  The frontend's bothBanksOk
    // gate should already have ensured an India bank exists, but we fall
    // back defensively in case onboarding state drifted.
    const [recipientProfile, recipientIndia] = await Promise.all([
      supabaseAdmin.from('profiles').select('full_name').eq('id', req.userId!).maybeSingle(),
      supabaseAdmin.from('india_nro_accounts')
        .select('bank_name, branch, ifsc_code, account_no')
        .eq('user_id', req.userId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const recipientName     = ((recipientProfile.data?.full_name as string | undefined) ?? req.userEmail ?? 'Account Holder').trim();
    const recipientBankName = ((recipientIndia.data?.bank_name   as string | undefined) ?? 'NRO Account').trim();
    const recipientIfsc     = ((recipientIndia.data?.ifsc_code   as string | undefined) ?? 'PENDING').trim();
    const recipientLast4    = (() => {
      const acct = recipientIndia.data?.account_no as string | undefined;
      return acct ? acct.replace(/\s+/g, '').slice(-4) : null;
    })();

    const { data: inwardTransfer, error: inwardErr } = await supabaseAdmin
      .from('inward_transfers')
      .insert({
        user_id: req.userId!,
        amount_cad: amountCadIn,
        amount_inr: amountInrOut,
        // NOT NULL columns from migration 011:
        gross_amount_inr: amountInrOut,
        net_amount_inr:   amountInrOut,   // fee-on-top: rail converts full amountCAD
        recipient_name:        recipientName,
        recipient_bank_name:   recipientBankName,
        recipient_ifsc:        recipientIfsc,
        recipient_account_last4: recipientLast4,
        exchange_rate: exchangeRateInward,
        flat_fee_cad: flatFee,
        express_surcharge_cad: expressFee,
        total_fees_cad: flatFee + expressFee,
        fee_cad: flatFee + expressFee,
        speed,
        reference,
        status: 'initiated',
        purpose_code: 'INWARD',
        fintrac_report: fintracReport,
        fintrac_required: fintracReport,
      })
      .select()
      .single();

    if (inwardErr) {
      res.status(500).json({ error: inwardErr.message, timestamp: ts() });
      return;
    }
    res.status(201).json({ success: true, transfer: inwardTransfer, fintracReport, timestamp: ts() });
    return;
  }

  // ── OUTWARD TRANSFER (India → Canada) ────────────────────────────────────
  // amountInr may come from amountFrom (new direction API) or amountInr (legacy)
  const amountInr = amountFrom ?? amountInrRaw;

  // ── Idempotency check (prevents duplicate on Render wake-up retry) ─────────
  if (idempotencyKey && supabaseAdminConfigured) {
    const { data: existing } = await supabaseAdmin
      .from('transfers')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .eq('user_id', req.userId!)
      .maybeSingle();

    if (existing) {
      console.log(`[IDEMPOTENCY] Duplicate detected — returning existing transfer ${existing.id}`);
      res.status(200).json({
        transfer: existing,
        idempotent: true,
        message: 'Transfer already created for this idempotency key',
        timestamp: ts(),
      });
      return;
    }
  }

  // ── Input validation ───────────────────────────────────────────────────────
  if (!amountInr || !purposeCode || !speed) {
    res.status(400).json({
      error: 'amountInr (or amountFrom), purposeCode, speed are required for outward transfers',
      timestamp: ts(),
    });
    return;
  }
  if (!exchangeRate) {
    res.status(400).json({
      error: 'amountInr, exchangeRate, purposeCode, speed are required',
      timestamp: ts(),
    });
    return;
  }
  if (accountType === 'NRO' && !sourceOfFunds) {
    res.status(400).json({ error: 'sourceOfFunds is required for NRO transfers', timestamp: ts() });
    return;
  }
  if (!['NRO', 'NRE'].includes(accountType)) {
    res.status(400).json({ error: 'accountType must be NRO or NRE', timestamp: ts() });
    return;
  }
  if (panNumber && !PAN_REGEX.test(panNumber.toUpperCase())) {
    res.status(400).json({ error: 'Invalid PAN format. Expected: AAAAA9999A (5 letters, 4 digits, 1 letter)', timestamp: ts() });
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

  // ── RBI rules validation ───────────────────────────────────────────────────
  const rbiRules = getRBIRules();
  if (amountInr > rbiRules.maxSingleTxInr) {
    res.status(400).json({
      error: `Exceeds single transfer limit of ₹${rbiRules.maxSingleTxInr.toLocaleString('en-IN')}`,
      maxSingleTxInr: rbiRules.maxSingleTxInr,
      timestamp: ts(),
    });
    return;
  }
  if (!rbiRules.purposeCodesEnabled.includes(purposeCode)) {
    res.status(400).json({
      error: `Purpose code ${purposeCode} is not enabled. Allowed: ${rbiRules.purposeCodesEnabled.join(', ')}`,
      timestamp: ts(),
    });
    return;
  }

  // ── Demo mode ─────────────────────────────────────────────────────────────
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
        risk_level: 'LOW', form145_part: isNRE ? 'EXEMPT' : 'A',
        created_at: ts(),
      },
      feeBreakdown: {
        grossAmountCAD: grossCAD, commissionCAD, flatFeeCAD, totalFeesCAD, netAmountCAD,
        breakdown: [`Commission: CAD ${commissionCAD}`, `Flat fee: CAD ${flatFeeCAD}`],
        accountTypeNote: isNRE ? 'NRE: no Form 145/146 required' : 'NRO: standard compliance applies',
      },
      timestamp: ts(),
    });
    return;
  }

  const userId = req.userId!;

  // ── FEMA annual limit check (Challenge 8) ─────────────────────────────────
  if (accountType === 'NRO') {
    const fema = await checkFemaLimit(userId, amountInr);
    if (!fema.allowed) {
      res.status(400).json({
        error: 'FEMA_LIMIT_EXCEEDED',
        message: fema.message,
        remainingLimitINR: fema.remainingINR,
        usedThisYearINR: fema.usedINR,
        maxYearlyLimitINR: fema.maxINR,
        fyResetDate: fema.fyResetDate,
        timestamp: ts(),
      });
      return;
    }
  }

  // ── Parallel data fetch ────────────────────────────────────────────────────
  const [historyRes, kycRes, profileRes, residencyRes] = await Promise.all([
    supabaseAdmin
      .from('transfers')
      .select('id, amount_inr, created_at, status')
      .eq('user_id', userId)
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

  const allTransfers       = historyRes.data ?? [];
  const pastTransfers      = allTransfers.filter(t => (t as Record<string,unknown>).status === 'completed');
  const isFirstTransfer    = pastTransfers.length === 0;
  const transferCount      = pastTransfers.length;
  const monthlyCount       = pastTransfers.filter(t => isWithinCurrentMonth(t.created_at as string)).length;
  const avgAmountINR       = transferCount > 0
    ? pastTransfers.reduce((s, t) => s + Number(t.amount_inr), 0) / transferCount : 0;

  // Cumulative FY outward total (non-failed/cancelled, including this transfer)
  const fyStart            = getFYStartDate();
  const fyExistingTotal    = allTransfers
    .filter(t => {
      const s = String((t as Record<string,unknown>).status ?? '');
      return s !== 'cancelled' && s !== 'failed' && new Date(t.created_at as string) >= fyStart;
    })
    .reduce((sum, t) => sum + Number(t.amount_inr ?? 0), 0);
  const fyOutwardTotalInr  = fyExistingTotal + amountInr;

  // PAN: save to profile if provided and not already stored
  if (panNumber && supabaseAdminConfigured) {
    const pan = panNumber.toUpperCase();
    void supabaseAdmin
      .from('profiles')
      .update({ pan_number: pan })
      .eq('id', userId)
      .is('pan_number', null)
      .then(({ error: panErr }) => {
        if (panErr) console.warn('[PAN] Could not save PAN to profile:', panErr.message);
      });
  }

  // Source-of-funds doc type lookup
  const sofKey    = (sourceOfFunds as string) ?? 'other';
  const sofInfo   = SOURCE_OF_FUNDS_MAP[sofKey] ?? null;
  const isKYCVerified      = (kycRes.data?.canada_verified ?? false) && (kycRes.data?.india_verified ?? false);
  const docsProvided       = documents ?? [];
  const tdsDeductedBool    = tdsDeducted ?? false;
  const tdsAmountInrNum    = tdsAmountInr ?? 0;
  const residencyType      = (residencyRes.data?.residency_type ?? profileRes.data?.residency_type ?? 'work_permit') as string;

  // ── Step 1: Fee calculation ────────────────────────────────────────────────
  const fees = await calculateFees({
    amountINR: amountInr, exchangeRate, speed, isFirstTransfer,
    promoCode: promoCode ?? null, userId,
  });

  // ── Step 2: Account type routing (NRO vs NRE) ─────────────────────────────
  const accountTypeDecision = await determineAccountRoute(residencyType, accountType, amountInr, userId);

  // ── Step 3: Risk assessment ────────────────────────────────────────────────
  const riskResult = await calculateRiskScore({
    userId, amountINR: amountInr, sourceOfFunds: sourceOfFunds ?? '',
    purposeCode, tdsDeducted: tdsDeductedBool, tdsAmountINR: tdsAmountInrNum,
    documents: docsProvided, transferCount, monthlyTransferCount: monthlyCount,
    avgTransferAmountINR: avgAmountINR, isKYCVerified,
  });

  // ── Step 4: Compliance evaluation (with FY-aware Part determination) ──────
  const complianceResult = await evaluateCompliance({
    amountINR: amountInr, sourceOfFunds: (sourceOfFunds ?? 'other') as SourceOfFunds, documents: docsProvided,
  });

  // Override form145Part with FY-aware result from rbiRules
  const fyCompliance = getComplianceRequirements(amountInr, { purposeCode, fyOutwardTotalInr });

  // ── Step 5: Decision engine ────────────────────────────────────────────────
  const decision = applyDecisionEngine(riskResult.level, complianceResult);
  // Use FY-aware Part (escalates to C when cumulative FY > ₹5L or property sale)
  const form145Part = accountTypeDecision.accountType === 'NRE'
    ? accountTypeDecision.form145Part
    : fyCompliance.form145Part;
  const reference    = genReference();

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
      indicative_rate:     exchangeRate,       // Rate at initiation — preserved for transparency
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
      idempotency_key:     idempotencyKey ?? null,
      status:              initialStatus,
      risk_score:          riskResult.score,
      risk_level:          riskResult.level,
      risk_breakdown:      riskResult.breakdown,
      compliance_status:   decision.complianceStatus,
      ca_required:         decision.caRequired,
      ca_status:           decision.caStatus,
      tds_deducted:        tdsDeductedBool,
      tds_amount_inr:      tdsAmountInrNum,
      account_type:        accountType,
      customer_model:      accountTypeDecision.customerModel,
      // Write to both old and new column names during migration 016 window
      form145_part:        form145Part,
      fifteen_ca_part:     form145Part,
      nro_bank_name:       nroBankName ?? null,
      nro_branch_city:     nroBranchCity ?? null,
      residency_type:      residencyType,
      is_mock:             true,
      tax_act_version:     '2025',
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
    metadata: { accountType, customerModel: accountTypeDecision.customerModel, form145Part, risk: riskResult.level },
  });

  void saveRiskAssessment(transfer.id, riskResult).catch(() => {});
  void saveComplianceCheck(transfer.id, complianceResult).catch(() => {});

  supabaseAdmin.from('transfer_events').insert({
    transfer_id: transfer.id,
    user_id:     userId,
    status:      initialStatus,
    note:        `TRANSFER_INITIATED — accountType: ${accountType} | model: ${accountTypeDecision.customerModel} | Form 145 Part ${form145Part} | Risk: ${riskResult.level}`,
  }).then(({ error: evErr }) => {
    if (evErr) console.error('[transfer_events] Insert failed:', evErr.message);
  });

  // compliance_requests: use only columns guaranteed to exist in the table
  // form145_part / form146_required are aliases not yet added — use fifteen_ca_part / fifteen_cb_required
  supabaseAdmin.from('compliance_requests').insert({
    transfer_id:         transfer.id,
    user_id:             userId,
    status:              riskResult.level === 'HIGH' ? 'pending' : decision.caRequired ? 'under_review' : 'approved',
    fifteen_ca_part:     form145Part,
    fifteen_cb_required: complianceResult.requiresForm146 && accountTypeDecision.accountType !== 'NRE',
  }).then(({ error: crErr }) => {
    if (crErr) console.error('[compliance_request] Insert failed:', crErr.message, '— transfer:', transfer.id);
    else console.log('[compliance_request] Created for transfer:', transfer.id, '| Form 146 required:', complianceResult.requiresForm146);
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
  setImmediate(() => {
    orchestrateOutwardTransfer(transfer.id).catch(err =>
      console.error('[Orchestrator] outwardOrchestrator failed (non-critical):', err));
  });

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
        ? 'NRE: fully repatriable — no Form 145/146 required (IT Act 2025)'
        : `NRO: Form 145 Part ${form145Part} applies (IT Act 2025)`,
    },
    accountTypeDecision,
    risk: { score: riskResult.score, level: riskResult.level, breakdown: riskResult.breakdown, missingDocuments: riskResult.missingDocuments },
    compliance: {
      requiresCA:      complianceResult.requiresCA,
      requiresForm145: complianceResult.requiresForm145,
      requiresForm146: fyCompliance.requiresForm146 && accountTypeDecision.accountType !== 'NRE',
      form145Part,
      isPropertySale:  fyCompliance.isPropertySale,
      documentStatus:  complianceResult.documentStatus,
      udinRequired:    fyCompliance.requiresForm146 && accountTypeDecision.accountType !== 'NRE',
    },
    fyTracking: {
      fyStart:                 fyStart.toISOString().split('T')[0],
      fyExistingTotalInr:      fyExistingTotal,
      fyOutwardTotalInr,
      form145Part,
      escalatedDueToFYTotal:   fyOutwardTotalInr > 500_000 && amountInr <= 500_000,
    },
    sourceOfFunds: sofInfo
      ? { docType: sofInfo.docType, label: sofInfo.label, purposeCode: sofInfo.purposeCode }
      : null,
    decision: {
      status:  initialStatus,
      message: accountTypeDecision.accountType === 'NRE'
        ? 'NRE account — no CA approval needed. Fable will execute directly.'
        : decision.customerMessage,
    },
    form145Part,
    reference,
    timestamp: ts(),
  });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('[POST /transfers/initiate] Unhandled error:', msg, err);
    if (!res.headersSent) {
      res.status(500).json({ error: msg, timestamp: ts() });
    }
  }
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

// ── GET /transfers/fema-limit (alias: /fema-status) ──────────────────────────
async function handleFemaLimit(req: AuthRequest, res: Response) {
  if (!supabaseAdminConfigured) {
    res.json({ usedINR: 0, remainingINR: FEMA_MAX_INR, maxINR: FEMA_MAX_INR, maxYearlyLimitINR: FEMA_MAX_INR, timestamp: ts() });
    return;
  }
  const fema = await checkFemaLimit(req.userId!, 0);
  const fyStart = new Date().getMonth() >= 3
    ? `${new Date().getFullYear()}-04-01`
    : `${new Date().getFullYear() - 1}-04-01`;
  const fyEnd = new Date().getMonth() >= 3
    ? `${new Date().getFullYear() + 1}-03-31`
    : `${new Date().getFullYear()}-03-31`;
  res.json({
    maxYearlyLimitINR: FEMA_MAX_INR,
    usedThisYearINR:   fema.usedINR,
    remainingINR:      fema.remainingINR,
    maxINR:            fema.maxINR,
    fyResetDate:       fema.fyResetDate,
    fyStart,
    fyEnd,
    timestamp: ts(),
  });
}
router.get('/fema-limit', authMiddleware, handleFemaLimit);
router.get('/fema-status', authMiddleware, handleFemaLimit);

// ── GET /transfers/:id/status ─────────────────────────────────────────────────
router.get('/:id/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.status(404).json({ error: 'Transfer not found (demo mode)', timestamp: ts() });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('transfers')
    .select('id, status, account_type, customer_model, form145_part, fifteen_ca_part, risk_level, ca_required, ca_blocking, swift_reference, completed_at, provider_reference, adapter_name, is_mock, updated_at, cancelled_at, cancellation_reason')
    .eq('id', req.params.id)
    .eq('user_id', req.userId!)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Transfer not found', timestamp: ts() });
    return;
  }

  res.json({ transfer: data, timestamp: ts() });
});

// ── GET /transfers/:id/certificate ────────────────────────────────────────────
// Returns completed transfer certificate with all compliance document numbers.
router.get('/:id/certificate', authMiddleware, async (req: AuthRequest, res: Response) => {
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

  if (data.status !== 'completed') {
    res.status(400).json({
      error: 'Certificate only available for completed transfers',
      currentStatus: data.status,
      timestamp: ts(),
    });
    return;
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name, email')
    .eq('id', data.user_id)
    .maybeSingle();

  res.json({
    certificate: {
      transferId:       data.id,
      reference:        data.reference,
      completedAt:      data.completed_at,
      amountINR:        Number(data.amount_inr),
      amountCAD:        Number(data.net_amount_cad ?? data.amount_cad),
      exchangeRate:     Number(data.final_execution_rate ?? data.exchange_rate),
      indicativeRate:   Number(data.indicative_rate ?? data.exchange_rate),
      totalFeesCAD:     Number(data.total_fees_cad ?? data.fee_cad),
      // IT Act 2025 form numbers
      form145Number:    data.form145_number ?? data.fifteen_ca_number ?? null,
      form146Number:    data.form146_number ?? data.fifteen_cb_number ?? null,
      swiftReference:   data.swift_reference ?? null,
      caName:           data.ca_approved_by ?? null,
      purpose:          data.purpose_code,
      sourceOfFunds:    data.source_of_funds,
      customerName:     profile?.full_name ?? 'Customer',
      customerEmail:    profile?.email ?? '',
      taxActVersion:    data.tax_act_version ?? '2025',
    },
    timestamp: ts(),
  });
});

// ── POST /transfers/:id/cancel ────────────────────────────────────────────────
// Cancellable only before bank processing starts.
router.post('/:id/cancel', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'DB not configured', timestamp: ts() });
    return;
  }

  const { reason } = req.body as { reason?: string };
  const cancellableStatuses = ['initiated', 'kyc_verified', 'form146_requested', '15cb_requested', 'pending_review', 'INITIATED', 'KYC_VERIFIED', 'FORM146_REQUESTED', 'PENDING_REVIEW'];

  const { data, error } = await supabaseAdmin
    .from('transfers')
    .select('id, status, user_id, amount_inr, amount_cad')
    .eq('id', req.params.id)
    .eq('user_id', req.userId!)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Transfer not found', timestamp: ts() });
    return;
  }

  if (!cancellableStatuses.includes(data.status)) {
    res.status(400).json({
      error: 'CANNOT_CANCEL',
      message: `Transfer cannot be cancelled at status: ${data.status}`,
      tip: ['bank_processing', 'BANK_PROCESSING'].includes(data.status)
        ? 'Transfer is already with the bank. Contact support immediately.'
        : ['completed', 'COMPLETED'].includes(data.status)
          ? 'Transfer has already completed.'
          : 'Contact support for assistance.',
      timestamp: ts(),
    });
    return;
  }

  const { error: updateError } = await supabaseAdmin
    .from('transfers')
    .update({
      status:               'cancelled',
      cancelled_at:         ts(),
      cancellation_reason:  reason || 'Customer requested cancellation',
    })
    .eq('id', req.params.id);

  if (updateError) {
    res.status(500).json({ error: updateError.message, timestamp: ts() });
    return;
  }

  void log('TRANSFER_CANCELLED', 'customer', { transferId: String(req.params.id), metadata: { reason } });
  void supabaseAdmin.from('transfer_events').insert({
    transfer_id: req.params.id,
    user_id:     req.userId!,
    status:      'cancelled',
    note:        `Transfer cancelled by customer. Reason: ${reason || 'Not specified'}`,
  });

  res.json({ message: 'Transfer cancelled successfully', transferId: req.params.id, timestamp: ts() });
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
