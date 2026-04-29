import { Router, Request, Response } from 'express';
import { supabaseAdmin, supabaseAdminConfigured } from '../lib/supabaseServer';
import { autoProgressTestTransfer } from '../services/testMode';

const router = Router();
const ts = () => new Date().toISOString();

// All routes in this file only work in development.
// server.ts mounts this router only when NODE_ENV=development.

// ── POST /dev/seed-test-transfer ──────────────────────────────────────────────
// Creates a realistic test transfer + compliance_request in 'pending' status
// so the CA dashboard always has something to review.
router.post('/seed-test-transfer', async (_req: Request, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  // Find the first registered user to attach the transfer to
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name')
    .limit(1);

  if (!profiles || profiles.length === 0) {
    res.status(400).json({ error: 'No users found — register a user first.' });
    return;
  }

  const user = profiles[0];
  const amountInr = 1800000;
  const exchangeRate = 64.5;            // INR per CAD
  const grossCAD = Math.round((amountInr / exchangeRate) * 100) / 100;
  const commissionCAD = Math.round(grossCAD * 0.018 * 100) / 100;
  const repaihubCommission = Math.round(grossCAD * 0.013 * 100) / 100;
  const partnerCommission = Math.round(grossCAD * 0.005 * 100) / 100;
  const flatFeeCAD = 25;
  const totalFeesCAD = Math.round((commissionCAD + flatFeeCAD) * 100) / 100;
  const netAmountCAD = Math.round((grossCAD - totalFeesCAD) * 100) / 100;
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 900000 + 100000);
  const reference = `RH-TEST-${year}-${rand}`;

  const { data: transfer, error: tErr } = await supabaseAdmin
    .from('transfers')
    .insert({
      user_id:            user.id,
      amount_inr:         amountInr,
      amount_cad:         grossCAD,
      exchange_rate:      exchangeRate,
      fee_cad:            totalFeesCAD,
      commission_cad:     commissionCAD,
      repaihub_commission: repaihubCommission,
      partner_commission: partnerCommission,
      flat_fee_cad:       flatFeeCAD,
      total_fees_cad:     totalFeesCAD,
      net_amount_cad:     netAmountCAD,
      purpose_code:       'P1301',
      source_of_funds:    'rental_income',
      speed:              'standard',
      priority:           'standard',
      reference,
      status:             'initiated',
      test_mode:          true,
    })
    .select()
    .single();

  if (tErr || !transfer) {
    res.status(500).json({ error: tErr?.message || 'Failed to create transfer' });
    return;
  }

  // Create the compliance request
  const { error: cErr } = await supabaseAdmin.from('compliance_requests').insert({
    transfer_id:        transfer.id,
    user_id:            user.id,
    status:             'pending',
    fifteen_ca_part:    'C',
    fifteen_cb_required: true,
  });

  if (cErr) {
    res.status(500).json({ error: `Transfer created but compliance_request failed: ${cErr.message}`, transfer });
    return;
  }

  // Log a transfer event
  void supabaseAdmin.from('transfer_events').insert({
    transfer_id: transfer.id,
    user_id:     user.id,
    status:      'initiated',
    note:        `[TEST] Seeded via /dev/seed-test-transfer for ${user.email}`,
  });

  res.status(201).json({
    message: `Test transfer created for ${user.email}. Check CA dashboard now.`,
    transfer,
    feeBreakdown: { grossCAD, commissionCAD, flatFeeCAD, totalFeesCAD, netAmountCAD },
  });
});

// ── POST /dev/auto-progress/:id ───────────────────────────────────────────────
// Manually trigger auto-progression on an existing transfer.
router.post('/auto-progress/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  res.json({ message: `Auto-progression started for transfer ${id}`, transferId: id, timestamp: ts() });
  autoProgressTestTransfer(id).catch((e: unknown) => console.error('[TEST MODE] auto-progress failed:', e));
});

// ── POST /dev/backfill-compliance ─────────────────────────────────────────────
// Creates compliance_requests for all transfers that don't have one.
// Same as the SQL migration but callable via API (useful when SQL access isn't easy).
router.post('/backfill-compliance', async (_req: Request, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  const { data: transfers } = await supabaseAdmin
    .from('transfers')
    .select('id, user_id, amount_inr');

  if (!transfers || transfers.length === 0) {
    res.json({ message: 'No transfers found', created: 0, timestamp: ts() });
    return;
  }

  const { data: existing } = await supabaseAdmin
    .from('compliance_requests')
    .select('transfer_id');

  const existingIds = new Set((existing ?? []).map((r: { transfer_id: string }) => String(r.transfer_id)));
  const orphans = transfers.filter(t => !existingIds.has(t.id));

  if (orphans.length === 0) {
    res.json({ message: 'All transfers already have compliance requests', created: 0, timestamp: ts() });
    return;
  }

  const inserts = orphans.map(t => ({
    transfer_id:        t.id,
    user_id:            t.user_id,
    status:             'pending',
    fifteen_ca_part:    Number(t.amount_inr) <= 500000 ? 'A' : 'C',
    fifteen_cb_required: Number(t.amount_inr) > 500000,
  }));

  const { error } = await supabaseAdmin
    .from('compliance_requests')
    .insert(inserts);

  if (error) {
    res.status(500).json({ error: error.message, timestamp: ts() });
    return;
  }

  res.json({ message: `Created ${orphans.length} compliance request(s)`, created: orphans.length, timestamp: ts() });
});

// ── GET /dev/status ───────────────────────────────────────────────────────────
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    mode: 'development',
    endpoints: [
      'POST /dev/seed-test-transfer    — create a test transfer + compliance request',
      'POST /dev/auto-progress/:id     — trigger auto-progression on a transfer',
      'POST /dev/backfill-compliance   — create compliance_requests for orphaned transfers',
      'GET  /dev/status                — this page',
    ],
    timestamp: ts(),
  });
});

export default router;
