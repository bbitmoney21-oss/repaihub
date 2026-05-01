// [GREEN] Dev tools — 404 in production, NODE_ENV check on every endpoint

import { Router, Request, Response } from 'express';
import { supabaseAdmin, supabaseAdminConfigured } from '../lib/supabaseServer';
import { autoProgressTestTransfer } from '../services/testMode';
import { getAdapterStatus } from '../paymentRails/paymentRailsService';

const router = Router();
const ts = () => new Date().toISOString();

function devOnly(res: Response): boolean {
  if (process.env.NODE_ENV !== 'development') {
    res.status(404).json({ error: 'Dev tools only available in development mode' });
    return true;
  }
  return false;
}

// ── GET /dev/adapter-status ───────────────────────────────────────────────────
router.get('/adapter-status', async (_req: Request, res: Response) => {
  if (devOnly(res)) return;
  const status = await getAdapterStatus();
  res.json({
    mode: 'development',
    note: 'To activate real Fable: set FABLE_API_KEY and UPDATE payment_rails_config SET value=\'fable\'',
    rails: status,
    timestamp: ts(),
  });
});

// ── POST /dev/seed-test-outward-transfer ──────────────────────────────────────
// Creates a test NRO/P2P transfer in '15cb_requested' — visible in CA dashboard
router.post('/seed-test-outward-transfer', async (_req: Request, res: Response) => {
  if (devOnly(res)) return;
  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  const { data: profiles } = await supabaseAdmin
    .from('profiles').select('id, email, full_name').limit(1);

  if (!profiles || profiles.length === 0) {
    res.status(400).json({ error: 'No users found — register a user first' });
    return;
  }

  const user = profiles[0];
  const amountInr = 1800000;
  const exchangeRate = 62.5;
  const grossCAD = Math.round((amountInr / exchangeRate) * 100) / 100;
  const commissionCAD = Math.round(grossCAD * 0.018 * 100) / 100;
  const flatFeeCAD = 25;
  const totalFeesCAD = Math.round((commissionCAD + flatFeeCAD) * 100) / 100;
  const netAmountCAD = Math.round((grossCAD - totalFeesCAD) * 100) / 100;
  const rand = Math.floor(Math.random() * 900000 + 100000);
  const reference = `RH-TEST-${new Date().getFullYear()}-${rand}`;

  const { data: transfer, error: tErr } = await supabaseAdmin
    .from('transfers')
    .insert({
      user_id:            user.id,
      amount_inr:         amountInr,
      amount_cad:         grossCAD,
      exchange_rate:      exchangeRate,
      fee_cad:            totalFeesCAD,
      commission_cad:     commissionCAD,
      flat_fee_cad:       flatFeeCAD,
      total_fees_cad:     totalFeesCAD,
      net_amount_cad:     netAmountCAD,
      purpose_code:       'P1301',
      source_of_funds:    'rental_income',
      speed:              'standard',
      priority:           'standard',
      reference,
      status:             '15cb_requested',
      risk_level:         'HIGH',
      ca_required:        true,
      ca_blocking:        true,
      fifteen_ca_part:    'C',
      account_type:       'NRO',
      customer_model:     'p2p',
      nro_bank_name:      'HDFC Bank',
      nro_branch_city:    'Pune',
      tds_deducted:       true,
      tds_amount_inr:     540000,
      is_mock:            true,
      test_mode:          true,
    })
    .select().single();

  if (tErr || !transfer) {
    res.status(500).json({ error: tErr?.message || 'Failed to create test transfer' });
    return;
  }

  void supabaseAdmin.from('compliance_requests').insert({
    transfer_id:         transfer.id,
    user_id:             user.id,
    status:              'pending',
    fifteen_ca_part:     'C',
    fifteen_cb_required: true,
  });

  res.status(201).json({
    message: `[TEST] NRO/P2P transfer seeded for ${user.email}. Open CA dashboard to approve.`,
    transfer,
    feeBreakdown: { grossCAD, commissionCAD, flatFeeCAD, totalFeesCAD, netAmountCAD },
  });
});

// ── POST /dev/seed-test-nre-transfer ─────────────────────────────────────────
// Creates an NRE transfer that bypasses the CA portal entirely
router.post('/seed-test-nre-transfer', async (_req: Request, res: Response) => {
  if (devOnly(res)) return;
  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  const { data: profiles } = await supabaseAdmin
    .from('profiles').select('id, email, full_name').limit(1);

  if (!profiles || profiles.length === 0) {
    res.status(400).json({ error: 'No users found' });
    return;
  }

  const user = profiles[0];
  const amountInr = 1000000;
  const exchangeRate = 62.5;
  const grossCAD = Math.round((amountInr / exchangeRate) * 100) / 100;
  const reference = `RH-NRE-TEST-${Date.now()}`;

  const { data: transfer, error } = await supabaseAdmin
    .from('transfers')
    .insert({
      user_id:         user.id,
      amount_inr:      amountInr,
      amount_cad:      grossCAD,
      exchange_rate:   exchangeRate,
      fee_cad:         25,
      total_fees_cad:  25,
      net_amount_cad:  grossCAD - 25,
      purpose_code:    'P1302',
      source_of_funds: null,
      speed:           'express',
      reference,
      status:          'processing',
      risk_level:      'LOW',
      ca_required:     false,
      ca_blocking:     false,
      fifteen_ca_part: 'EXEMPT',
      account_type:    'NRE',
      customer_model:  'citizen_nre',
      is_mock:         true,
      test_mode:       true,
    })
    .select().single();

  if (error || !transfer) {
    res.status(500).json({ error: error?.message || 'Failed' });
    return;
  }

  res.status(201).json({
    message: `[TEST] NRE transfer seeded — skips CA dashboard (NRE is EXEMPT from 15CA/15CB)`,
    transfer,
    note: 'This transfer will go directly to BANK_PROCESSING without CA approval',
  });
});

// ── POST /dev/seed-test-inward-transfer ──────────────────────────────────────
// Creates an inward transfer (Remitly model) in PAYMENT_RECEIVED state
router.post('/seed-test-inward-transfer', async (_req: Request, res: Response) => {
  if (devOnly(res)) return;
  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  const { data: profiles } = await supabaseAdmin
    .from('profiles').select('id, email, full_name').limit(1);

  if (!profiles || profiles.length === 0) {
    res.status(400).json({ error: 'No users found' });
    return;
  }

  const user = profiles[0];
  const amountCAD = 500;
  const exchangeRate = 62.5;
  const grossINR = Math.round(amountCAD * exchangeRate);
  const reference = `RH-IN-TEST-${Date.now()}`;

  const { data: transfer, error } = await supabaseAdmin
    .from('inward_transfers')
    .insert({
      user_id:                user.id,
      reference,
      amount_cad:             amountCAD,
      exchange_rate:          exchangeRate,
      gross_amount_inr:       grossINR,
      net_amount_inr:         grossINR,
      fee_cad:                0,
      flat_fee_cad:           0,
      total_fees_cad:         0,
      speed:                  'standard',
      status:                 'payment_received',
      risk_level:             'LOW',
      fintrac_required:       false,
      recipient_name:         'Test Recipient',
      recipient_bank_name:    'State Bank of India',
      recipient_account_last4: '1234',
      recipient_ifsc:         'SBIN0001234',
      collection_method:      'interac',
      customer_bank_name:     'RBC',
      is_mock:                true,
      payment_received_at:    new Date().toISOString(),
    })
    .select().single();

  if (error || !transfer) {
    res.status(500).json({ error: error?.message || 'Failed' });
    return;
  }

  res.status(201).json({
    message: `[TEST] Inward transfer seeded (Remitly model) — PAYMENT_RECEIVED state`,
    transfer,
    note: 'Fable collected CAD. Next: Fable→Nium delivers INR. Status: payment_received.',
  });
});

// ── POST /dev/fire-fable-webhook ──────────────────────────────────────────────
// Simulates any Fable webhook event for testing without waiting
router.post('/fire-fable-webhook', async (req: Request, res: Response) => {
  if (devOnly(res)) return;

  const { event, transferId, extra = {} } = req.body as {
    event?: string;
    transferId?: string;
    extra?: Record<string, unknown>;
  };

  if (!event || !transferId) {
    res.status(400).json({ error: 'event and transferId required', timestamp: ts() });
    return;
  }

  const port = process.env.PORT || '3000';
  const webhookUrl = `http://localhost:${port}/webhooks/fable`;

  const payload = {
    event,
    transferId,
    providerReference: `MANUAL-${Date.now()}`,
    swiftReference: `SWIFT-MANUAL-${Date.now()}`,
    utr: `UTR${Date.now()}`,
    amountCAD: 500,
    amountINR: 31250,
    railUsed: 'IMPS',
    collectedAt: new Date().toISOString(),
    deliveredAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    provider: 'mock_fable',
    ...extra,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    res.json({
      message: `Webhook fired: ${event}`,
      webhookUrl,
      payload,
      webhookStatus: response.status,
      timestamp: ts(),
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to fire webhook: ${String(err)}`, timestamp: ts() });
  }
});

// ── POST /dev/seed-test-transfer (backward compat) ────────────────────────────
router.post('/seed-test-transfer', async (_req: Request, res: Response) => {
  if (devOnly(res)) return;
  res.json({ message: 'Use POST /dev/seed-test-outward-transfer instead', timestamp: ts() });
});

// ── POST /dev/auto-progress/:id ───────────────────────────────────────────────
router.post('/auto-progress/:id', async (req: Request, res: Response) => {
  if (devOnly(res)) return;
  const id = String(req.params.id);
  res.json({ message: `Auto-progression started for ${id}`, transferId: id, timestamp: ts() });
  autoProgressTestTransfer(id).catch((e: unknown) => console.error('[TEST MODE]', e));
});

// ── POST /dev/backfill-compliance ─────────────────────────────────────────────
router.post('/backfill-compliance', async (_req: Request, res: Response) => {
  if (devOnly(res)) return;
  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  const { data: transfers } = await supabaseAdmin.from('transfers').select('id, user_id, amount_inr');
  if (!transfers || transfers.length === 0) {
    res.json({ message: 'No transfers found', created: 0 });
    return;
  }

  const { data: existing } = await supabaseAdmin.from('compliance_requests').select('transfer_id');
  const existingIds = new Set((existing ?? []).map((r: { transfer_id: string }) => String(r.transfer_id)));
  const orphans = transfers.filter(t => !existingIds.has(t.id));

  if (orphans.length === 0) {
    res.json({ message: 'All transfers already have compliance requests', created: 0 });
    return;
  }

  const inserts = orphans.map(t => ({
    transfer_id:         t.id,
    user_id:             t.user_id,
    status:              'pending',
    fifteen_ca_part:     Number(t.amount_inr) <= 500000 ? 'A' : 'C',
    fifteen_cb_required: Number(t.amount_inr) > 500000,
  }));

  const { error } = await supabaseAdmin.from('compliance_requests').insert(inserts);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ message: `Created ${orphans.length} compliance request(s)`, created: orphans.length });
});

// ── GET /dev/status ───────────────────────────────────────────────────────────
router.get('/status', (_req: Request, res: Response) => {
  if (process.env.NODE_ENV !== 'development') {
    res.status(404).json({ error: 'Dev tools only available in development mode' });
    return;
  }
  res.json({
    mode: 'development',
    endpoints: [
      'GET  /dev/adapter-status                    — show active adapter for each rail',
      'POST /dev/seed-test-outward-transfer        — create NRO/P2P transfer in CA queue',
      'POST /dev/seed-test-nre-transfer            — create NRE transfer (skips CA)',
      'POST /dev/seed-test-inward-transfer         — create inward transfer (Remitly model)',
      'POST /dev/fire-fable-webhook                — simulate any Fable webhook event',
      'POST /dev/auto-progress/:id                 — trigger auto-progression',
      'POST /dev/backfill-compliance               — create compliance_requests for orphaned transfers',
      'GET  /dev/status                            — this page',
    ],
    timestamp: ts(),
  });
});

export default router;
