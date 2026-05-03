// [GREEN] Inward transfer routes — Remitly model
// Fable collects CAD. Fable→Nium delivers INR. No CA. No 15CA/15CB.
// Fable handles FINTRAC >= CAD 10K. REPAIHUB does not file FINTRAC.

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { supabaseAdmin, supabaseAdminConfigured } from '../lib/supabaseServer';
import { calculateInwardFees, checkInwardLimits } from '../services/inwardFeeService';
import { assessInwardRisk, storeRiskAssessment } from '../services/riskService';
import { getInwardCollectionAdapter } from '../paymentRails/paymentRailsService';
import { orchestrateInwardTransfer } from '../orchestrator/inwardOrchestrator';
import { log } from '../services/auditService';

const router = Router();
const ts = () => new Date().toISOString();

function genInwardReference(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 900_000 + 100_000);
  return `RH-IN-${year}-${rand}`;
}

// ── GET /inward/rates?amount_cad=500&speed=standard ──────────────────────────
router.get('/rates', async (req, res) => {
  const amountCAD = Number((req.query as Record<string, string>).amount_cad) || 500;
  const speed = ((req.query as Record<string, string>).speed ?? 'standard') as 'standard' | 'express';

  const adapter = await getInwardCollectionAdapter();
  const rateResult = await adapter.getRate('CAD', 'INR');
  const feeConfig = await calculateInwardFees({
    amountCAD,
    exchangeRate: rateResult.rate > 0 ? 1 / rateResult.rate : 1 / 62.5,
    speed,
    isFirstTransfer: false,
    userId: '',
  }).catch(() => null);
  const grossINR = Math.round(amountCAD * rateResult.rate * 100) / 100;

  // Use fee config if available, else fall back to simple logic
  let flatFeeCAD = 0;
  let flatFeeWaived = false;
  let flatFeeWaivedReason = '';
  let expressFeeCAD = 0;
  let totalFeesCAD = 0;

  if (feeConfig) {
    flatFeeCAD = feeConfig.flatFeeCAD;
    flatFeeWaived = feeConfig.flatFeeWaived;
    flatFeeWaivedReason = feeConfig.flatFeeWaivedReason ?? '';
    expressFeeCAD = feeConfig.expressFeeCAD;
    totalFeesCAD = feeConfig.totalFeesCAD;
  } else {
    // Inward fee model: \$1.99 only if amount < \$500. Above \$500: no fee.
    // Express vs Standard does NOT change the price.
    const FREE_THRESHOLD_CAD = 500;
    const SMALL_TXN_FEE_CAD = 1.99;
    flatFeeWaived = amountCAD >= FREE_THRESHOLD_CAD;
    flatFeeCAD = flatFeeWaived ? 0 : SMALL_TXN_FEE_CAD;
    flatFeeWaivedReason = flatFeeWaived ? `No fee for transfers of CAD ${FREE_THRESHOLD_CAD}+` : '';
    expressFeeCAD = 0;
    totalFeesCAD = flatFeeCAD;
  }

  const netCAD = amountCAD - totalFeesCAD;
  const netINR = Math.round(netCAD * rateResult.rate * 100) / 100;
  const totalCustomerPaysCAD = amountCAD + (speed === 'express' ? expressFeeCAD : 0);

  const breakdown: string[] = [
    `You send: CAD ${amountCAD.toFixed(2)}`,
    flatFeeWaived
      ? `Flat fee: CAD 0.00 (${flatFeeWaivedReason || 'waived'})`
      : `Flat fee: CAD ${flatFeeCAD.toFixed(2)}`,
  ];
  if (speed === 'express') breakdown.push(`Express fee: CAD ${expressFeeCAD.toFixed(2)}`);
  breakdown.push(`Exchange rate: 1 CAD = ₹${rateResult.rate}`);
  breakdown.push(`Recipient gets: ₹${netINR.toLocaleString('en-IN')}`);

  res.json({
    rate: rateResult.rate,
    rateId: rateResult.rateId,
    source: rateResult.source,
    provider: rateResult.provider,
    direction: 'CAD_TO_INR',
    estimate: {
      amountCAD,
      amountINR: grossINR,
      netAmountINR: netINR,
      recipientGetsINR: netINR,
      totalFeesCAD,
      flatFeeCAD,
      flatFeeWaived,
      flatFeeWaivedReason,
      expressFeeCAD,
      totalCustomerPaysCAD,
      fxMarginNote: 'FX margin of ~1.5% is built into the exchange rate',
      breakdown,
      note: 'Rate provided by Fable. India payout via Fable→Nium.',
    },
    validForSeconds: rateResult.validForSeconds,
    isMock: adapter.isMock(),
    timestamp: ts(),
  });
});

// ── POST /inward/rates/lock ───────────────────────────────────────────────────
router.post('/rates/lock', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { amountCAD } = req.body as { amountCAD?: number };
  if (!amountCAD) {
    res.status(400).json({ error: 'amountCAD required', timestamp: ts() });
    return;
  }

  const adapter = await getInwardCollectionAdapter();
  const rateResult = await adapter.getRate('CAD', 'INR');
  const locked = await adapter.lockRate(rateResult.rateId, amountCAD);

  res.json({ ...locked, isMock: adapter.isMock(), timestamp: ts() });
});

// ── GET /inward/recipients ────────────────────────────────────────────────────
router.get('/recipients', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.json({ recipients: [], timestamp: ts() });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('inward_recipients')
    .select('id, full_name, bank_name, account_last4, ifsc_code, relationship, is_verified, transfer_count, last_used_at')
    .eq('user_id', req.userId!)
    .order('last_used_at', { ascending: false });

  if (error) {
    res.json({ recipients: [], error: error.message, timestamp: ts() });
    return;
  }

  res.json({ recipients: data ?? [], timestamp: ts() });
});

// ── POST /inward/recipients ───────────────────────────────────────────────────
router.post('/recipients', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.status(201).json({ recipient: { id: `demo-${Date.now()}`, ...req.body }, timestamp: ts() });
    return;
  }

  const { fullName, bankName, accountNumber, ifscCode, relationship } = req.body as {
    fullName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    relationship?: string;
  };

  if (!fullName || !bankName || !accountNumber || !ifscCode) {
    res.status(400).json({ error: 'fullName, bankName, accountNumber, ifscCode required', timestamp: ts() });
    return;
  }

  // Store only last 4 digits of account number — never store plain text
  const accountLast4 = accountNumber.slice(-4);

  const { data, error } = await supabaseAdmin
    .from('inward_recipients')
    .insert({
      user_id:        req.userId!,
      full_name:      fullName,
      bank_name:      bankName,
      account_last4:  accountLast4,
      ifsc_code:      ifscCode,
      relationship:   relationship ?? 'other',
      is_verified:    false,
      transfer_count: 0,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message, timestamp: ts() });
    return;
  }

  res.status(201).json({ recipient: data, timestamp: ts() });
});

// ── GET /inward/limits ────────────────────────────────────────────────────────
router.get('/limits', authMiddleware, async (req: AuthRequest, res: Response) => {
  const limits = await checkInwardLimits(req.userId!, 0);
  res.json({
    limits: {
      minTransferCAD: 50,
      maxTransferCAD: 25000,
      dailyLimitCAD: 5000,
      monthlyLimitCAD: 20000,
      fintracThresholdCAD: 10000,
    },
    remaining: {
      dailyCAD: null,
      monthlyCAD: null,
    },
    note: 'Transfers >= CAD 10,000 require manual review. FINTRAC filed by Fable.',
    timestamp: ts(),
  });
});

// ── POST /inward/initiate ─────────────────────────────────────────────────────
router.post('/initiate', authMiddleware, async (req: AuthRequest, res: Response) => {
  const {
    amountCAD,
    recipientId,
    recipient,
    purpose,
    notes,
    speed = 'standard',
    promoCode,
    lockId,
  } = req.body as {
    amountCAD?: number;
    recipientId?: string;
    recipient?: {
      fullName: string;
      bankName: string;
      accountNumber: string;
      ifscCode: string;
      relationship?: string;
    };
    purpose?: string;
    notes?: string;
    speed?: 'standard' | 'express';
    promoCode?: string;
    lockId?: string;
  };

  // ── Validation ────────────────────────────────────────────────────────────
  if (!amountCAD) {
    res.status(400).json({ error: 'amountCAD is required', timestamp: ts() });
    return;
  }
  if (amountCAD < 50) {
    res.status(400).json({ error: 'Minimum transfer is CAD 50', timestamp: ts() });
    return;
  }
  if (amountCAD > 25000) {
    res.status(400).json({ error: 'Maximum transfer is CAD 25,000 per transaction', timestamp: ts() });
    return;
  }
  if (!recipientId && !recipient) {
    res.status(400).json({ error: 'recipientId or recipient details required', timestamp: ts() });
    return;
  }

  const userId = req.userId!;

  // ── Demo mode ────────────────────────────────────────────────────────────
  if (!supabaseAdminConfigured) {
    const rate = 62.50;
    const flatFee = amountCAD >= 500 && speed === 'standard' ? 0 : 1.99;
    const netCAD = amountCAD - flatFee;
    const grossINR = Math.round(amountCAD * rate);
    const netINR = Math.round(netCAD * rate);
    res.status(201).json({
      transfer: { id: `demo-inward-${Date.now()}`, amount_cad: amountCAD, status: 'initiated', reference: genInwardReference() },
      feeBreakdown: { amountCAD, flatFeeCAD: flatFee, totalFeesCAD: flatFee, grossINR, netAmountINR: netINR },
      note: 'CAD collected by Fable. INR delivered via Nium.',
      timestamp: ts(),
    });
    return;
  }

  // ── Check limits ──────────────────────────────────────────────────────────
  const limitCheck = await checkInwardLimits(userId, amountCAD);
  if (!limitCheck.allowed) {
    res.status(400).json({ error: limitCheck.reason, timestamp: ts() });
    return;
  }

  // ── Resolve recipient ─────────────────────────────────────────────────────
  let resolvedRecipient: {
    id?: string; fullName: string; bankName: string;
    accountLast4: string; ifscCode: string; relationship: string;
  };

  if (recipientId) {
    const { data: savedRecipient, error: rErr } = await supabaseAdmin
      .from('inward_recipients')
      .select('*')
      .eq('id', recipientId)
      .eq('user_id', userId)
      .single();

    if (rErr || !savedRecipient) {
      res.status(404).json({ error: 'Recipient not found', timestamp: ts() });
      return;
    }
    resolvedRecipient = {
      id: savedRecipient.id as string,
      fullName: savedRecipient.full_name as string,
      bankName: savedRecipient.bank_name as string,
      accountLast4: savedRecipient.account_last4 as string,
      ifscCode: savedRecipient.ifsc_code as string,
      relationship: savedRecipient.relationship as string,
    };
  } else {
    resolvedRecipient = {
      fullName: recipient!.fullName,
      bankName: recipient!.bankName,
      accountLast4: recipient!.accountNumber.slice(-4),
      ifscCode: recipient!.ifscCode,
      relationship: recipient!.relationship ?? 'other',
    };
  }

  // ── Is this first inward transfer? ────────────────────────────────────────
  let isFirstTransfer = true;
  try {
    const { count } = await supabaseAdmin
      .from('inward_transfers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    isFirstTransfer = (count ?? 0) === 0;
  } catch { isFirstTransfer = true; }

  // ── Get rate ──────────────────────────────────────────────────────────────
  const adapter = await getInwardCollectionAdapter();
  const rateResult = await adapter.getRate('CAD', 'INR');
  const exchangeRate = rateResult.rate; // 1 CAD = X INR

  // ── Calculate fees (Remitly model) ────────────────────────────────────────
  const fees = await calculateInwardFees({
    amountCAD,
    exchangeRate,
    speed,
    isFirstTransfer,
    userId,
  });

  // ── Risk assessment ───────────────────────────────────────────────────────
  const risk = await assessInwardRisk(amountCAD, userId);
  const fintracRequired = amountCAD >= 10000;
  const transferStatus = risk.caBlocking ? 'pending_review' : 'initiated';
  const reference = genInwardReference();

  // ── Save transfer ─────────────────────────────────────────────────────────
  const { data: transfer, error } = await supabaseAdmin
    .from('inward_transfers')
    .insert({
      user_id:                  userId,
      reference,
      amount_cad:               amountCAD,
      exchange_rate:            exchangeRate,
      gross_amount_inr:         fees.grossAmountINR,
      fee_cad:                  fees.totalFeesCAD,
      flat_fee_cad:             fees.flatFeeCAD,
      commission_cad:           fees.commissionCAD,
      express_surcharge_cad:    fees.expressSurchargeCAD,
      total_fees_cad:           fees.totalFeesCAD,
      net_amount_inr:           fees.netAmountINR,
      fee_config_snapshot:      fees.feeConfigSnapshot,
      speed,
      priority:                 speed,
      status:                   transferStatus,
      risk_level:               risk.level,
      risk_reason:              risk.reason,
      ca_required:              risk.caRequired,
      ca_blocking:              risk.caBlocking,
      fintrac_required:         fintracRequired,
      recipient_name:           resolvedRecipient.fullName,
      recipient_bank_name:      resolvedRecipient.bankName,
      recipient_account_last4:  resolvedRecipient.accountLast4,
      recipient_ifsc:           resolvedRecipient.ifscCode,
      collection_method:        speed === 'express' ? 'interac' : 'eft',
      compliance_status:        'pending',
      purpose:                  purpose ?? 'family_maintenance',
      notes:                    notes ?? null,
      is_mock:                  adapter.isMock(),
    })
    .select()
    .single();

  if (error || !transfer) {
    res.status(500).json({ error: error?.message || 'Failed to create transfer', timestamp: ts() });
    return;
  }

  // ── Async side-effects ────────────────────────────────────────────────────
  void storeRiskAssessment(transfer.id, 'inward', risk);
  void log('INWARD_INITIATED', 'customer', {
    transferId: transfer.id,
    transferType: 'inward',
    userId,
    metadata: {
      amountCAD, risk: risk.level, fintrac: fintracRequired,
      note: 'CAD collected by Fable. INR delivered via Fable→Nium.',
    },
  });

  // ── Background orchestration (non-blocking) ───────────────────────────────
  if (transferStatus !== 'pending_review') {
    setImmediate(() => {
      orchestrateInwardTransfer(transfer.id).catch(err =>
        console.error('[Orchestrator] inwardOrchestrator failed (non-critical):', err));
    });
  }

  // ── Return 201 ────────────────────────────────────────────────────────────
  res.status(201).json({
    transfer,
    feeBreakdown: {
      amountCAD,
      grossAmountINR:      fees.grossAmountINR,
      flatFeeCAD:          fees.flatFeeCAD,
      commissionCAD:       fees.commissionCAD,
      expressSurchargeCAD: fees.expressSurchargeCAD,
      totalFeesCAD:        fees.totalFeesCAD,
      netAmountINR:        fees.netAmountINR,
      exchangeRate,
      breakdown:           fees.breakdown,
      fintracNote:         fintracRequired
        ? 'Transfer >= CAD 10,000 — FINTRAC will be filed by Fable Fintech'
        : undefined,
    },
    recipient: resolvedRecipient,
    risk: { level: risk.level, reason: risk.reason },
    note: 'CAD collected by Fable. INR delivered via Fable→Nium (IMPS/NEFT).',
    reference,
    timestamp: ts(),
  });
});

// ── GET /inward/history ───────────────────────────────────────────────────────
router.get('/history', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.json({ transfers: [], count: 0, timestamp: ts() });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('inward_transfers')
      .select('*')
      .eq('user_id', req.userId!)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message, timestamp: ts() });
      return;
    }
    res.json({ transfers: data ?? [], count: (data ?? []).length, timestamp: ts() });
  } catch {
    res.json({ transfers: [], count: 0, timestamp: ts() });
  }
});

// ── GET /inward/transfers/:id ─────────────────────────────────────────────────
router.get('/transfers/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.status(404).json({ error: 'Transfer not found (demo mode)', timestamp: ts() });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('inward_transfers')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId!)
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Transfer not found', timestamp: ts() });
      return;
    }
    res.json({ transfer: data, timestamp: ts() });
  } catch {
    res.status(404).json({ error: 'Transfer not found', timestamp: ts() });
  }
});

// ── GET /inward/:id (alias) ───────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.status(404).json({ error: 'Transfer not found (demo mode)', timestamp: ts() });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('inward_transfers')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId!)
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Transfer not found', timestamp: ts() });
      return;
    }
    res.json({ transfer: data, timestamp: ts() });
  } catch {
    res.status(404).json({ error: 'Transfer not found', timestamp: ts() });
  }
});

export default router;
