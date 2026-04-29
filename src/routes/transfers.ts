import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { supabaseAdmin, supabaseAdminConfigured } from '../lib/supabaseServer';
import { notifyTransferInitiated } from '../services/notifications';
import type { RBIPurposeCode, SourceOfFunds } from '../types/compliance';

const router = Router();
const ts = () => new Date().toISOString();

// ── Fee constants ─────────────────────────────────────────────────────────────
const FLAT_FEE_CAD     = 25;
const COMMISSION_RATE  = 0.018;   // 1.8% total
const REPAIHUB_RATE    = 0.013;   // 1.3% Repaihub share
const PARTNER_RATE     = 0.005;   // 0.5% partner share

function calcFees(amountInr: number, exchangeRate: number) {
  const grossCAD         = Math.round((amountInr / exchangeRate) * 100) / 100;
  const commissionCAD    = Math.round(grossCAD * COMMISSION_RATE * 100) / 100;
  const repaihubCommission = Math.round(grossCAD * REPAIHUB_RATE * 100) / 100;
  const partnerCommission  = Math.round(grossCAD * PARTNER_RATE  * 100) / 100;
  const totalFeesCAD     = Math.round((commissionCAD + FLAT_FEE_CAD) * 100) / 100;
  const netAmountCAD     = Math.round((grossCAD - totalFeesCAD) * 100) / 100;
  return { grossCAD, commissionCAD, repaihubCommission, partnerCommission, totalFeesCAD, netAmountCAD };
}

function calcFifteenCAPart(amountINR: number): 'A' | 'C' {
  return amountINR <= 500000 ? 'A' : 'C';
}

function genReference(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 900000 + 100000);
  return `RH-${year}-${rand}`;
}

// ── POST /transfers/initiate ──────────────────────────────────────────────────
router.post('/initiate', authMiddleware, async (req: AuthRequest, res: Response) => {
  const {
    amountInr, exchangeRate,
    purposeCode, sourceOfFunds, speed,
  } = req.body as {
    amountInr?: number; exchangeRate?: number;
    purposeCode?: RBIPurposeCode; sourceOfFunds?: SourceOfFunds; speed?: 'standard' | 'express';
    // amountCad and feeCad accepted from client but ignored — computed server-side
    amountCad?: number; feeCad?: number;
  };

  if (!amountInr || !exchangeRate || !purposeCode || !sourceOfFunds || !speed) {
    res.status(400).json({
      error: 'amountInr, exchangeRate, purposeCode, sourceOfFunds, speed are required',
      timestamp: ts(),
    });
    return;
  }

  if (amountInr < 1000) {
    res.status(400).json({ error: 'Minimum transfer amount is ₹1,000', timestamp: ts() });
    return;
  }

  if (exchangeRate <= 0) {
    res.status(400).json({ error: 'exchangeRate must be positive', timestamp: ts() });
    return;
  }

  const fees = calcFees(amountInr, exchangeRate);
  const fifteenCAPart = calcFifteenCAPart(amountInr);
  const reference = genReference();

  const feeBreakdown = {
    grossCAD:       fees.grossCAD,
    commissionCAD:  fees.commissionCAD,
    flatFeeCAD:     FLAT_FEE_CAD,
    totalFeesCAD:   fees.totalFeesCAD,
    netAmountCAD:   fees.netAmountCAD,
    commissionRate: '1.8%',
    flatFee:        'CAD 25',
  };

  if (!supabaseAdminConfigured) {
    res.status(201).json({
      transfer: {
        id: `demo-${Date.now()}`,
        user_id: req.userId,
        amount_inr: amountInr,
        amount_cad: fees.grossCAD,
        exchange_rate: exchangeRate,
        fee_cad: fees.totalFeesCAD,
        commission_cad: fees.commissionCAD,
        repaihub_commission: fees.repaihubCommission,
        partner_commission: fees.partnerCommission,
        flat_fee_cad: FLAT_FEE_CAD,
        total_fees_cad: fees.totalFeesCAD,
        net_amount_cad: fees.netAmountCAD,
        purpose_code: purposeCode,
        source_of_funds: sourceOfFunds,
        speed,
        reference,
        status: 'initiated',
        fifteen_ca_part: fifteenCAPart,
        created_at: ts(),
      },
      feeBreakdown,
      fifteenCAPart,
      reference,
      timestamp: ts(),
    });
    return;
  }

  const { data: transfer, error } = await supabaseAdmin
    .from('transfers')
    .insert({
      user_id:             req.userId,
      amount_inr:          amountInr,
      amount_cad:          fees.grossCAD,
      exchange_rate:       exchangeRate,
      fee_cad:             fees.totalFeesCAD,
      commission_cad:      fees.commissionCAD,
      repaihub_commission: fees.repaihubCommission,
      partner_commission:  fees.partnerCommission,
      flat_fee_cad:        FLAT_FEE_CAD,
      total_fees_cad:      fees.totalFeesCAD,
      net_amount_cad:      fees.netAmountCAD,
      purpose_code:        purposeCode,
      source_of_funds:     sourceOfFunds,
      speed,
      reference,
      status:              'initiated',
      priority:            speed,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message, timestamp: ts() });
    return;
  }

  // Log the initiation event
  void supabaseAdmin.from('transfer_events').insert({
    transfer_id: transfer.id,
    user_id: req.userId,
    status: 'initiated',
    note: 'Transfer initiated via API',
  });

  // Auto-create compliance request (fire-and-forget)
  void supabaseAdmin.from('compliance_requests').insert({
    transfer_id:        transfer.id,
    user_id:            req.userId,
    status:             'pending',
    fifteen_ca_part:    fifteenCAPart,
    fifteen_cb_required: true,
  });

  // Notify (fire-and-forget)
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name, email')
    .eq('id', req.userId!)
    .single();

  if (profile) {
    notifyTransferInitiated({
      customerEmail: profile.email ?? req.userEmail ?? '',
      customerName:  profile.full_name ?? 'Customer',
      transferId:    transfer.id,
      amountINR:     amountInr,
      amountCAD:     fees.grossCAD,
      status:        'initiated',
    }).catch(() => {});
  }

  // Auto-progress in development (background, never blocks response)
  if (process.env.NODE_ENV === 'development') {
    import('../services/testMode').then(({ autoProgressTestTransfer }) => {
      autoProgressTestTransfer(transfer.id).catch(console.error);
    });
  }

  res.status(201).json({
    transfer,
    feeBreakdown,
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
