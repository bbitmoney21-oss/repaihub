// NOTE: Under India Income Tax Act 2025 (effective 1 Apr 2026):
// Form 15CA is now Form 145 | Form 15CB is now Form 146

import { supabaseAdmin } from '../lib/supabaseServer';

const log = (msg: string) => console.log(`[TEST MODE] ${msg}`);

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateTransfer(id: string, fields: Record<string, unknown>) {
  await supabaseAdmin.from('transfers').update(fields).eq('id', id);
}

async function updateCompliance(transferId: string, fields: Record<string, unknown>) {
  await supabaseAdmin
    .from('compliance_requests')
    .update(fields)
    .eq('transfer_id', transferId);
}

export async function autoProgressTestTransfer(transferId: string): Promise<void> {
  if (process.env.NODE_ENV !== 'development') return;

  log(`Auto-progressing transfer ${transferId}`);

  // 5s → KYC verified + compliance under review
  await delay(5000);
  await Promise.all([
    updateTransfer(transferId, { status: 'kyc_verified' }),
    updateCompliance(transferId, { status: 'under_review' }),
  ]);
  log(`${transferId} → kyc_verified / under_review`);

  // 15s → CA approves: Form 146 received + compliance approved
  await delay(15000);
  const cbNumber = `F146-TEST-${Date.now().toString().slice(-4)}`;
  await Promise.all([
    updateTransfer(transferId, {
      status: 'form146_received',
      // Write to both old and new column names during migration 016 window
      form146_number: cbNumber,
      fifteen_cb_number: cbNumber,
      ca_remarks: 'Test mode — Form 146 auto-approved. TDS verified in 26AS. DTAA Article 23 [India-Canada] applied. Section 397(3)(d) IT Act 2025.',
      ca_approved_at: new Date().toISOString(),
      ca_approved_by: 'CA Partner (Test Mode) — ICAI 123456',
    }),
    updateCompliance(transferId, {
      status: 'approved',
      fifteen_cb_number: cbNumber,
      ca_remarks: 'Test mode — Form 146 auto-approved (IT Act 2025). TDS verified in 26AS.',
      ca_reviewed_by: 'CA Partner (Test Mode)',
      ca_reviewed_at: new Date().toISOString(),
    }),
  ]);
  log(`${transferId} → form146_received / approved (Form 146: ${cbNumber})`);

  // 20s → Form 145 filed
  await delay(5000);
  const caNumber = `F145-TEST-${Date.now().toString().slice(-4)}`;
  await Promise.all([
    updateTransfer(transferId, {
      status: 'form145_filed',
      form145_number: caNumber,
      fifteen_ca_number: caNumber, // backward compat
    }),
    updateCompliance(transferId, { fifteen_ca_number: caNumber }),
  ]);
  log(`${transferId} → form145_filed (Form 145: ${caNumber})`);

  // 25s → Bank processing
  await delay(5000);
  await updateTransfer(transferId, { status: 'bank_processing' });
  log(`${transferId} → bank_processing`);

  // 35s → Completed
  await delay(10000);
  await updateTransfer(transferId, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  });
  log(`${transferId} → COMPLETED ✓`);
}

// ── Auto-progression for inward transfers (dev only) ─────────────────────────
export async function autoProgressInwardTransfer(transferId: string): Promise<void> {
  if (process.env.NODE_ENV !== 'development') return;

  log(`Auto-progressing inward transfer ${transferId}`);

  const updateInward = async (fields: Record<string, unknown>) => {
    await supabaseAdmin.from('inward_transfers').update(fields).eq('id', transferId);
  };

  // 5s → collection initiated
  await delay(5000);
  await updateInward({ status: 'collection_initiated', collection_status: 'pending' });
  log(`${transferId} [inward] → collection_initiated`);

  // 10s → FX converted
  await delay(10000);
  await updateInward({ status: 'fx_converted', collection_status: 'settled' });
  log(`${transferId} [inward] → fx_converted`);

  // 8s → payout initiated
  await delay(8000);
  const payoutRef = `PAY-TEST-${Date.now().toString().slice(-6)}`;
  await updateInward({ status: 'payout_initiated', payout_reference: payoutRef, payout_status: 'sent' });
  log(`${transferId} [inward] → payout_initiated (${payoutRef})`);

  // 10s → completed
  await delay(10000);
  await updateInward({ status: 'completed', completed_at: new Date().toISOString(), payout_status: 'completed' });
  log(`${transferId} [inward] → COMPLETED ✓`);
}
