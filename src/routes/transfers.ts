import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { supabaseAdmin, supabaseAdminConfigured } from '../lib/supabaseServer';
import { notifyTransferInitiated } from '../services/notifications';
import type { RBIPurposeCode, SourceOfFunds } from '../types/compliance';

const router = Router();
const ts = () => new Date().toISOString();

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
    amountInr, amountCad, exchangeRate, feeCad,
    purposeCode, sourceOfFunds, speed,
  } = req.body as {
    amountInr?: number; amountCad?: number; exchangeRate?: number; feeCad?: number;
    purposeCode?: RBIPurposeCode; sourceOfFunds?: SourceOfFunds; speed?: 'standard' | 'express';
  };

  if (!amountInr || !amountCad || !exchangeRate || !feeCad || !purposeCode || !sourceOfFunds || !speed) {
    res.status(400).json({
      error: 'amountInr, amountCad, exchangeRate, feeCad, purposeCode, sourceOfFunds, speed are all required',
      timestamp: ts(),
    });
    return;
  }

  if (amountInr < 1000) {
    res.status(400).json({ error: 'Minimum transfer amount is ₹1,000', timestamp: ts() });
    return;
  }

  const fifteenCAPart = calcFifteenCAPart(amountInr);
  const reference = genReference();

  if (!supabaseAdminConfigured) {
    // Demo mode — return a mock transfer without persisting
    res.status(201).json({
      transfer: {
        id: `demo-${Date.now()}`,
        user_id: req.userId,
        amount_inr: amountInr,
        amount_cad: amountCad,
        exchange_rate: exchangeRate,
        fee_cad: feeCad,
        purpose_code: purposeCode,
        source_of_funds: sourceOfFunds,
        speed,
        reference,
        status: 'initiated',
        fifteen_ca_part: fifteenCAPart,
        created_at: ts(),
      },
      fifteenCAPart,
      reference,
      timestamp: ts(),
    });
    return;
  }

  const { data: transfer, error } = await supabaseAdmin
    .from('transfers')
    .insert({
      user_id: req.userId,
      amount_inr: amountInr,
      amount_cad: amountCad,
      exchange_rate: exchangeRate,
      fee_cad: feeCad,
      purpose_code: purposeCode,
      source_of_funds: sourceOfFunds,
      speed,
      reference,
      status: 'initiated',
      priority: speed,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message, timestamp: ts() });
    return;
  }

  // Log the initiation event
  await supabaseAdmin.from('transfer_events').insert({
    transfer_id: transfer.id,
    user_id: req.userId,
    status: 'initiated',
    note: 'Transfer initiated via API',
  });

  // Get profile for notification
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name, email')
    .eq('id', req.userId!)
    .single();

  if (profile) {
    notifyTransferInitiated({
      customerEmail: profile.email ?? req.userEmail ?? '',
      customerName: profile.full_name ?? 'Customer',
      transferId: transfer.id,
      amountINR: amountInr,
      amountCAD: amountCad,
      status: 'initiated',
    }).catch(() => {});
  }

  res.status(201).json({
    transfer,
    fifteenCAPart,
    reference,
    timestamp: ts(),
  });
});

// ── GET /transfers/history ────────────────────────────────────────────────────
// Must be before /transfers/:id
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
    .eq('user_id', req.userId!)  // Ensure user can only see their own transfers
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Transfer not found', timestamp: ts() });
    return;
  }

  res.json({ transfer: data, timestamp: ts() });
});

export default router;
