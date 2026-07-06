// [GREEN] Dev tools — 404 in production, NODE_ENV check on every endpoint

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
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

function requiresSupabase(res: Response): boolean {
  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'Supabase not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY' });
    return true;
  }
  return false;
}

async function getFirstProfile(res: Response): Promise<{ id: string; email: string; full_name: string } | null> {
  const { data: profiles } = await supabaseAdmin
    .from('profiles').select('id, email, full_name').limit(1);
  if (!profiles || profiles.length === 0) {
    res.status(400).json({ error: 'No users found — register a user first via POST /auth/register' });
    return null;
  }
  return profiles[0] as { id: string; email: string; full_name: string };
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

// ── POST /dev/reset-test-data ─────────────────────────────────────────────────
// Deletes all rows where is_mock=true or test_mode=true. Safe to run repeatedly.
router.post('/reset-test-data', async (_req: Request, res: Response) => {
  if (devOnly(res)) return;
  if (requiresSupabase(res)) return;

  const { count: inwardDeleted } = await supabaseAdmin
    .from('inward_transfers')
    .delete({ count: 'exact' })
    .or('is_mock.eq.true,test_mode.eq.true');

  const { count: transfersDeleted } = await supabaseAdmin
    .from('transfers')
    .delete({ count: 'exact' })
    .or('is_mock.eq.true,test_mode.eq.true');

  res.json({
    message: 'Test data deleted (compliance_requests, transfer_events, risk_assessments cascade from transfers)',
    deleted: { outward_transfers: transfersDeleted ?? 0, inward_transfers: inwardDeleted ?? 0 },
    timestamp: ts(),
  });
});

// ── POST /dev/seed-outward-nro-high-risk ─────────────────────────────────────
// HIGH risk NRO transfer → FORM146_REQUESTED (visible in CA dashboard for approval)
router.post('/seed-outward-nro-high-risk', async (_req: Request, res: Response) => {
  if (devOnly(res)) return;
  if (requiresSupabase(res)) return;

  const user = await getFirstProfile(res);
  if (!user) return;

  const amountInr    = 1800000;
  const exchangeRate = 62.5;
  const grossCAD     = Math.round((amountInr / exchangeRate) * 100) / 100;
  const commissionCAD = Math.round(grossCAD * 0.018 * 100) / 100;
  const flatFeeCAD   = 25;
  const totalFeesCAD = Math.round((commissionCAD + flatFeeCAD) * 100) / 100;
  const netAmountCAD = Math.round((grossCAD - totalFeesCAD) * 100) / 100;
  const reference    = `RH-TEST-HIGH-${Date.now()}`;

  const { data: transfer, error: tErr } = await supabaseAdmin
    .from('transfers')
    .insert({
      user_id:          user.id,
      amount_inr:       amountInr,
      amount_cad:       grossCAD,
      exchange_rate:    exchangeRate,
      fee_cad:          totalFeesCAD,
      commission_cad:   commissionCAD,
      flat_fee_cad:     flatFeeCAD,
      total_fees_cad:   totalFeesCAD,
      net_amount_cad:   netAmountCAD,
      purpose_code:     'S0014',
      source_of_funds:  'rental_income',
      speed:            'standard',
      priority:         'standard',
      reference,
      status:           'form146_requested',
      risk_level:       'HIGH',
      ca_required:      true,
      ca_blocking:      true,
      form145_part:     'C',
      fifteen_ca_part:  'C',
      form146_required: true,
      account_type:     'NRO',
      customer_model:   'p2p',
      nro_bank_name:    'HDFC Bank',
      nro_branch_city:  'Pune',
      tds_deducted:     true,
      tds_amount_inr:   540000,
      indicative_rate:  exchangeRate,
      tax_act_version:  '2025',
      is_mock:          true,
      test_mode:        true,
    })
    .select().single();

  if (tErr || !transfer) {
    res.status(500).json({ error: tErr?.message ?? 'Failed to create transfer' });
    return;
  }

  await supabaseAdmin.from('compliance_requests').insert({
    transfer_id:      transfer.id,
    user_id:          user.id,
    status:           'pending',
    form145_part:     'C',
    fifteen_ca_part:  'C',
    form146_required: true,
    fifteen_cb_required: true,
  });

  res.status(201).json({
    message: `[TEST] HIGH-risk NRO transfer seeded for ${user.email}. Open CA dashboard → approve.`,
    transfer,
    feeBreakdown: { grossCAD, commissionCAD, flatFeeCAD, totalFeesCAD, netAmountCAD },
  });
});

// ── POST /dev/seed-outward-nro-low-risk ──────────────────────────────────────
// LOW risk NRO transfer Part A (< ₹5L) → auto-files without CA approval
router.post('/seed-outward-nro-low-risk', async (_req: Request, res: Response) => {
  if (devOnly(res)) return;
  if (requiresSupabase(res)) return;

  const user = await getFirstProfile(res);
  if (!user) return;

  const amountInr    = 300000;
  const exchangeRate = 62.5;
  const grossCAD     = Math.round((amountInr / exchangeRate) * 100) / 100;
  const flatFeeCAD   = 25;
  const netAmountCAD = Math.round((grossCAD - flatFeeCAD) * 100) / 100;
  const reference    = `RH-TEST-LOW-${Date.now()}`;

  const { data: transfer, error } = await supabaseAdmin
    .from('transfers')
    .insert({
      user_id:          user.id,
      amount_inr:       amountInr,
      amount_cad:       grossCAD,
      exchange_rate:    exchangeRate,
      fee_cad:          flatFeeCAD,
      flat_fee_cad:     flatFeeCAD,
      total_fees_cad:   flatFeeCAD,
      net_amount_cad:   netAmountCAD,
      purpose_code:     'S0014',
      source_of_funds:  'pension',
      speed:            'standard',
      reference,
      status:           'bank_processing',
      risk_level:       'LOW',
      ca_required:      false,
      ca_blocking:      false,
      form145_part:     'A',
      fifteen_ca_part:  'A',
      form146_required: false,
      account_type:     'NRO',
      customer_model:   'p2p',
      nro_bank_name:    'SBI',
      nro_branch_city:  'Mumbai',
      tds_deducted:     false,
      indicative_rate:  exchangeRate,
      tax_act_version:  '2025',
      is_mock:          true,
      test_mode:        true,
    })
    .select().single();

  if (error || !transfer) {
    res.status(500).json({ error: error?.message ?? 'Failed' });
    return;
  }

  res.status(201).json({
    message: `[TEST] LOW-risk NRO Part A transfer seeded — auto-files without CA review`,
    transfer,
    note: 'Part A (below ₹5L): no Form 146 required. Goes directly to BANK_PROCESSING.',
  });
});

// ── POST /dev/seed-outward-nre ────────────────────────────────────────────────
// NRE transfer → EXEMPT from Form 145/146 (NRE funds already taxed in Canada)
router.post('/seed-outward-nre', async (_req: Request, res: Response) => {
  if (devOnly(res)) return;
  if (requiresSupabase(res)) return;

  const user = await getFirstProfile(res);
  if (!user) return;

  const amountInr    = 1000000;
  const exchangeRate = 62.5;
  const grossCAD     = Math.round((amountInr / exchangeRate) * 100) / 100;
  const reference    = `RH-TEST-NRE-${Date.now()}`;

  const { data: transfer, error } = await supabaseAdmin
    .from('transfers')
    .insert({
      user_id:          user.id,
      amount_inr:       amountInr,
      amount_cad:       grossCAD,
      exchange_rate:    exchangeRate,
      fee_cad:          25,
      total_fees_cad:   25,
      net_amount_cad:   grossCAD - 25,
      purpose_code:     'P1302',
      source_of_funds:  null,
      speed:            'express',
      reference,
      status:           'bank_processing',
      risk_level:       'LOW',
      ca_required:      false,
      ca_blocking:      false,
      form145_part:     'EXEMPT',
      fifteen_ca_part:  'EXEMPT',
      form146_required: false,
      account_type:     'NRE',
      customer_model:   'citizen_nre',
      indicative_rate:  exchangeRate,
      tax_act_version:  '2025',
      is_mock:          true,
      test_mode:        true,
    })
    .select().single();

  if (error || !transfer) {
    res.status(500).json({ error: error?.message ?? 'Failed' });
    return;
  }

  res.status(201).json({
    message: `[TEST] NRE transfer seeded — EXEMPT from Form 145/146 (NRE funds: no Indian tax)`,
    transfer,
    note: 'NRE accounts hold post-tax CAD funds. No 15CA/15CB or Form 145/146 required.',
  });
});

// ── POST /dev/seed-inward-standard ───────────────────────────────────────────
// Inward: CAD 500 economy (flat fee waived at ≥ CAD 500)
router.post('/seed-inward-standard', async (_req: Request, res: Response) => {
  if (devOnly(res)) return;
  if (requiresSupabase(res)) return;

  const user = await getFirstProfile(res);
  if (!user) return;

  const amountCAD    = 500;
  const exchangeRate = 62.5;
  const grossINR     = Math.round(amountCAD * exchangeRate);
  const reference    = `RH-IN-STD-${Date.now()}`;

  const { data: transfer, error } = await supabaseAdmin
    .from('inward_transfers')
    .insert({
      user_id:                  user.id,
      reference,
      amount_cad:               amountCAD,
      exchange_rate:            exchangeRate,
      gross_amount_inr:         grossINR,
      net_amount_inr:           grossINR,
      fee_cad:                  0,
      flat_fee_cad:             0,
      total_fees_cad:           0,
      speed:                    'standard',
      status:                   'payment_received',
      risk_level:               'LOW',
      fintrac_required:         false,
      recipient_name:           'Test Recipient INR',
      recipient_bank_name:      'State Bank of India',
      recipient_account_last4:  '1234',
      recipient_ifsc:           'SBIN0001234',
      collection_method:        'interac',
      customer_bank_name:       'RBC',
      is_mock:                  true,
      payment_received_at:      new Date().toISOString(),
    })
    .select().single();

  if (error || !transfer) {
    res.status(500).json({ error: error?.message ?? 'Failed' });
    return;
  }

  res.status(201).json({
    message: `[TEST] Inward standard transfer seeded — CAD ${amountCAD} economy, flat fee waived (≥CAD 500)`,
    transfer,
    feeNote: 'Flat fee: $0 (waived — amount ≥ CAD 500). Recipient gets ₹' + grossINR.toLocaleString('en-IN'),
  });
});

// ── POST /dev/seed-inward-express ─────────────────────────────────────────────
// Inward: CAD 200 express (flat fee + express surcharge applies)
router.post('/seed-inward-express', async (_req: Request, res: Response) => {
  if (devOnly(res)) return;
  if (requiresSupabase(res)) return;

  const user = await getFirstProfile(res);
  if (!user) return;

  const amountCAD    = 200;
  const exchangeRate = 62.5;
  const flatFee      = 1.99;
  const expressFee   = 9.99;
  const totalFees    = flatFee + expressFee;
  const netCAD       = amountCAD - totalFees;
  const grossINR     = Math.round(netCAD * exchangeRate);
  const reference    = `RH-IN-EXP-${Date.now()}`;

  const { data: transfer, error } = await supabaseAdmin
    .from('inward_transfers')
    .insert({
      user_id:                  user.id,
      reference,
      amount_cad:               amountCAD,
      exchange_rate:            exchangeRate,
      gross_amount_inr:         Math.round(amountCAD * exchangeRate),
      net_amount_inr:           grossINR,
      fee_cad:                  totalFees,
      flat_fee_cad:             flatFee,
      total_fees_cad:           totalFees,
      speed:                    'express',
      status:                   'payment_received',
      risk_level:               'LOW',
      fintrac_required:         false,
      recipient_name:           'Test Recipient Express',
      recipient_bank_name:      'HDFC Bank',
      recipient_account_last4:  '5678',
      recipient_ifsc:           'HDFC0001234',
      collection_method:        'interac',
      customer_bank_name:       'TD',
      is_mock:                  true,
      payment_received_at:      new Date().toISOString(),
    })
    .select().single();

  if (error || !transfer) {
    res.status(500).json({ error: error?.message ?? 'Failed' });
    return;
  }

  res.status(201).json({
    message: `[TEST] Inward express transfer seeded — CAD ${amountCAD} express`,
    transfer,
    feeNote: `Flat fee: $${flatFee} + Express: $${expressFee} = $${totalFees}. Recipient gets ₹${grossINR.toLocaleString('en-IN')}`,
  });
});

// ── POST /dev/seed-full-ca-workflow ───────────────────────────────────────────
// Full CA workflow: HIGH risk NRO with all WISEMAN / Form 145/146 fields populated
router.post('/seed-full-ca-workflow', async (_req: Request, res: Response) => {
  if (devOnly(res)) return;
  if (requiresSupabase(res)) return;

  const user = await getFirstProfile(res);
  if (!user) return;

  const testPAN      = 'ABCDE1234F';
  const panHash      = crypto.createHash('sha256').update(testPAN.toUpperCase().trim()).digest('hex');
  const panLast4     = testPAN.slice(-4);
  const amountInr    = 2500000;
  const exchangeRate = 62.5;
  const grossCAD     = Math.round((amountInr / exchangeRate) * 100) / 100;
  const commissionCAD = Math.round(grossCAD * 0.018 * 100) / 100;
  const flatFeeCAD   = 25;
  const totalFeesCAD = Math.round((commissionCAD + flatFeeCAD) * 100) / 100;
  const netAmountCAD = Math.round((grossCAD - totalFeesCAD) * 100) / 100;
  const reference    = `RH-TEST-WISEMAN-${Date.now()}`;

  const { data: transfer, error: tErr } = await supabaseAdmin
    .from('transfers')
    .insert({
      user_id:                user.id,
      amount_inr:             amountInr,
      amount_cad:             grossCAD,
      exchange_rate:          exchangeRate,
      fee_cad:                totalFeesCAD,
      commission_cad:         commissionCAD,
      flat_fee_cad:           flatFeeCAD,
      total_fees_cad:         totalFeesCAD,
      net_amount_cad:         netAmountCAD,
      purpose_code:           'P1301',
      source_of_funds:        'rental_income',
      speed:                  'standard',
      priority:               'standard',
      reference,
      status:                 'form146_requested',
      risk_level:             'HIGH',
      risk_score:             72,
      ca_required:            true,
      ca_blocking:            true,
      form145_part:           'C',
      fifteen_ca_part:        'C',
      form146_required:       true,
      account_type:           'NRO',
      customer_model:         'p2p',
      nro_bank_name:          'HDFC Bank',
      nro_branch_city:        'Pune',
      tds_deducted:           true,
      tds_amount_inr:         750000,
      pan_hash:               panHash,
      pan_last4:              panLast4,
      ad_bank_name:           'RBC Royal Bank',
      canadian_bank_name:     'RBC Royal Bank',
      indicative_rate:        exchangeRate,
      tax_act_version:        '2025',
      financial_year_cumulative_inr: amountInr,
      is_mock:                true,
      test_mode:              true,
    })
    .select().single();

  if (tErr || !transfer) {
    res.status(500).json({ error: tErr?.message ?? 'Failed to create transfer' });
    return;
  }

  await supabaseAdmin.from('compliance_requests').insert({
    transfer_id:         transfer.id,
    user_id:             user.id,
    status:              'pending',
    form145_part:        'C',
    fifteen_ca_part:     'C',
    form146_required:    true,
    fifteen_cb_required: true,
  });

  res.status(201).json({
    message: `[TEST] Full CA workflow transfer seeded — all WISEMAN fields populated for ${user.email}`,
    transfer,
    panDetails: { panHash, panLast4, note: 'Test PAN: ABCDE1234F — SHA-256 hashed, never stored raw' },
    feeBreakdown: { grossCAD, commissionCAD, flatFeeCAD, totalFeesCAD, netAmountCAD },
    nextSteps: [
      'GET /ca/transfers/pending — should appear in CA queue',
      'POST /ca/transfers/:id/approve — CA approves and issues Form 146 number',
      'POST /dev/fire-webhook with event=PAYMENT_COLLECTED — advances to next state',
    ],
  });
});

// ── POST /dev/fire-webhook ────────────────────────────────────────────────────
// Alias for /dev/fire-fable-webhook (shorter name for E2E tests)
// ── POST /dev/fire-fable-webhook ─────────────────────────────────────────────
// Simulates any Fable webhook event for testing without waiting
async function fireFableWebhook(req: Request, res: Response): Promise<void> {
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

  const port = process.env.PORT || '3001';
  const webhookUrl = `http://localhost:${port}/webhooks/fable`;

  const payload = {
    event,
    transferId,
    providerReference: `MANUAL-${Date.now()}`,
    swiftReference:    `SWIFT-MANUAL-${Date.now()}`,
    utr:               `UTR${Date.now()}`,
    amountCAD:         500,
    amountINR:         31250,
    railUsed:          'IMPS',
    collectedAt:       new Date().toISOString(),
    deliveredAt:       new Date().toISOString(),
    completedAt:       new Date().toISOString(),
    provider:          'mock_fable',
    ...extra,
  };

  try {
    const response = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    res.json({
      message:       `Webhook fired: ${event}`,
      webhookUrl,
      payload,
      webhookStatus: response.status,
      timestamp:     ts(),
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to fire webhook: ${String(err)}`, timestamp: ts() });
  }
}

router.post('/fire-webhook',       fireFableWebhook);
router.post('/fire-fable-webhook', fireFableWebhook);

// ── POST /dev/seed-test-outward-transfer ─────────────────────────────────────
// Legacy alias — use /dev/seed-outward-nro-high-risk instead
router.post('/seed-test-outward-transfer', async (_req: Request, res: Response) => {
  if (devOnly(res)) return;
  if (requiresSupabase(res)) return;

  const user = await getFirstProfile(res);
  if (!user) return;

  const amountInr    = 1800000;
  const exchangeRate = 62.5;
  const grossCAD     = Math.round((amountInr / exchangeRate) * 100) / 100;
  const commissionCAD = Math.round(grossCAD * 0.018 * 100) / 100;
  const flatFeeCAD   = 25;
  const totalFeesCAD = Math.round((commissionCAD + flatFeeCAD) * 100) / 100;
  const netAmountCAD = Math.round((grossCAD - totalFeesCAD) * 100) / 100;
  const reference    = `RH-TEST-${Date.now()}`;

  const { data: transfer, error: tErr } = await supabaseAdmin
    .from('transfers')
    .insert({
      user_id:          user.id,
      amount_inr:       amountInr,
      amount_cad:       grossCAD,
      exchange_rate:    exchangeRate,
      fee_cad:          totalFeesCAD,
      commission_cad:   commissionCAD,
      flat_fee_cad:     flatFeeCAD,
      total_fees_cad:   totalFeesCAD,
      net_amount_cad:   netAmountCAD,
      purpose_code:     'S0014',
      source_of_funds:  'rental_income',
      speed:            'standard',
      priority:         'standard',
      reference,
      status:           'form146_requested',
      risk_level:       'HIGH',
      ca_required:      true,
      ca_blocking:      true,
      form145_part:     'C',
      fifteen_ca_part:  'C',
      form146_required: true,
      account_type:     'NRO',
      customer_model:   'p2p',
      nro_bank_name:    'HDFC Bank',
      nro_branch_city:  'Pune',
      tds_deducted:     true,
      tds_amount_inr:   540000,
      indicative_rate:  exchangeRate,
      tax_act_version:  '2025',
      is_mock:          true,
      test_mode:        true,
    })
    .select().single();

  if (tErr || !transfer) {
    res.status(500).json({ error: tErr?.message ?? 'Failed' });
    return;
  }

  await supabaseAdmin.from('compliance_requests').insert({
    transfer_id:         transfer.id,
    user_id:             user.id,
    status:              'pending',
    form145_part:        'C',
    fifteen_ca_part:     'C',
    form146_required:    true,
    fifteen_cb_required: true,
  });

  res.status(201).json({
    message: `[TEST] NRO/HIGH transfer seeded for ${user.email}. Open CA dashboard to approve.`,
    transfer,
    feeBreakdown: { grossCAD, commissionCAD, flatFeeCAD, totalFeesCAD, netAmountCAD },
  });
});

// ── POST /dev/seed-test-nre-transfer ─────────────────────────────────────────
// Legacy alias — use /dev/seed-outward-nre instead
router.post('/seed-test-nre-transfer', async (_req: Request, res: Response) => {
  if (devOnly(res)) return;
  if (requiresSupabase(res)) return;

  const user = await getFirstProfile(res);
  if (!user) return;

  const amountInr    = 1000000;
  const exchangeRate = 62.5;
  const grossCAD     = Math.round((amountInr / exchangeRate) * 100) / 100;
  const reference    = `RH-NRE-TEST-${Date.now()}`;

  const { data: transfer, error } = await supabaseAdmin
    .from('transfers')
    .insert({
      user_id:          user.id,
      amount_inr:       amountInr,
      amount_cad:       grossCAD,
      exchange_rate:    exchangeRate,
      fee_cad:          25,
      total_fees_cad:   25,
      net_amount_cad:   grossCAD - 25,
      purpose_code:     'P1302',
      source_of_funds:  null,
      speed:            'express',
      reference,
      status:           'bank_processing',
      risk_level:       'LOW',
      ca_required:      false,
      ca_blocking:      false,
      form145_part:     'EXEMPT',
      fifteen_ca_part:  'EXEMPT',
      form146_required: false,
      account_type:     'NRE',
      customer_model:   'citizen_nre',
      indicative_rate:  exchangeRate,
      tax_act_version:  '2025',
      is_mock:          true,
      test_mode:        true,
    })
    .select().single();

  if (error || !transfer) {
    res.status(500).json({ error: error?.message ?? 'Failed' });
    return;
  }

  res.status(201).json({
    message: '[TEST] NRE transfer seeded — skips CA dashboard (NRE is EXEMPT from Form 145/146)',
    transfer,
    note: 'NRE transfers go directly to BANK_PROCESSING without CA approval.',
  });
});

// ── POST /dev/seed-test-inward-transfer ──────────────────────────────────────
// Legacy alias — use /dev/seed-inward-standard instead
router.post('/seed-test-inward-transfer', async (_req: Request, res: Response) => {
  if (devOnly(res)) return;
  if (requiresSupabase(res)) return;

  const user = await getFirstProfile(res);
  if (!user) return;

  const amountCAD    = 500;
  const exchangeRate = 62.5;
  const grossINR     = Math.round(amountCAD * exchangeRate);
  const reference    = `RH-IN-TEST-${Date.now()}`;

  const { data: transfer, error } = await supabaseAdmin
    .from('inward_transfers')
    .insert({
      user_id:                  user.id,
      reference,
      amount_cad:               amountCAD,
      exchange_rate:            exchangeRate,
      gross_amount_inr:         grossINR,
      net_amount_inr:           grossINR,
      fee_cad:                  0,
      flat_fee_cad:             0,
      total_fees_cad:           0,
      speed:                    'standard',
      status:                   'payment_received',
      risk_level:               'LOW',
      fintrac_required:         false,
      recipient_name:           'Test Recipient',
      recipient_bank_name:      'State Bank of India',
      recipient_account_last4:  '1234',
      recipient_ifsc:           'SBIN0001234',
      collection_method:        'interac',
      customer_bank_name:       'RBC',
      is_mock:                  true,
      payment_received_at:      new Date().toISOString(),
    })
    .select().single();

  if (error || !transfer) {
    res.status(500).json({ error: error?.message ?? 'Failed' });
    return;
  }

  res.status(201).json({
    message: '[TEST] Inward transfer seeded (economy, flat fee waived) — PAYMENT_RECEIVED',
    transfer,
    note: 'Fable collected CAD. Next: Fable→Nium delivers INR.',
  });
});

// ── POST /dev/seed-test-transfer (backward compat) ───────────────────────────
router.post('/seed-test-transfer', async (_req: Request, res: Response) => {
  if (devOnly(res)) return;
  res.json({ message: 'Use POST /dev/seed-outward-nro-high-risk instead', timestamp: ts() });
});

// ── POST /dev/auto-progress/:id ──────────────────────────────────────────────
router.post('/auto-progress/:id', async (req: Request, res: Response) => {
  if (devOnly(res)) return;
  const id = String(req.params.id);
  res.json({ message: `Auto-progression started for ${id}`, transferId: id, timestamp: ts() });
  autoProgressTestTransfer(id).catch((e: unknown) => console.error('[TEST MODE]', e));
});

// ── POST /dev/backfill-compliance ─────────────────────────────────────────────
router.post('/backfill-compliance', async (_req: Request, res: Response) => {
  if (devOnly(res)) return;
  if (requiresSupabase(res)) return;

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
    form145_part:        Number(t.amount_inr) <= 500000 ? 'A' : 'C',
    fifteen_ca_part:     Number(t.amount_inr) <= 500000 ? 'A' : 'C',
    form146_required:    Number(t.amount_inr) > 500000,
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
      'GET  /dev/adapter-status              — show active adapter for each payment rail',
      'GET  /dev/status                      — this page',
      'POST /dev/reset-test-data             — delete all is_mock=true transfers (outward + inward)',
      'POST /dev/seed-outward-nro-high-risk  — HIGH risk NRO ₹18L → FORM146_REQUESTED in CA queue',
      'POST /dev/seed-outward-nro-low-risk   — LOW risk NRO ₹3L Part A → BANK_PROCESSING (auto)',
      'POST /dev/seed-outward-nre            — NRE transfer EXEMPT from Form 145/146',
      'POST /dev/seed-inward-standard        — CAD 500 economy, flat fee waived',
      'POST /dev/seed-inward-express         — CAD 200 express, flat + express fees',
      'POST /dev/seed-full-ca-workflow       — HIGH risk with all WISEMAN/Form 145/146 fields',
      'POST /dev/fire-webhook                — simulate any Fable webhook (event + transferId)',
      'POST /dev/fire-fable-webhook          — alias for /dev/fire-webhook',
      'POST /dev/auto-progress/:id           — trigger auto-progression on a transfer',
      'POST /dev/backfill-compliance         — create compliance_requests for orphaned transfers',
      '--- Legacy aliases (kept for backward compat) ---',
      'POST /dev/seed-test-outward-transfer  — alias: seed-outward-nro-high-risk',
      'POST /dev/seed-test-nre-transfer      — alias: seed-outward-nre',
      'POST /dev/seed-test-inward-transfer   — alias: seed-inward-standard',
    ],
    timestamp: ts(),
  });
});

export default router;
