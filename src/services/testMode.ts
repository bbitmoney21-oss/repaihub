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

  // 15s → CA approves: 15CB received + compliance approved
  await delay(15000);
  const cbNumber = `CB-TEST-${Date.now().toString().slice(-4)}`;
  await Promise.all([
    updateTransfer(transferId, {
      status: '15cb_received',
      fifteen_cb_number: cbNumber,
      ca_remarks: 'Test mode — auto-approved. TDS verified in 26AS. DTAA Article 23 applied.',
      ca_approved_at: new Date().toISOString(),
      ca_approved_by: 'CA Partner (Test Mode) — ICAI 123456',
    }),
    updateCompliance(transferId, {
      status: 'approved',
      fifteen_cb_number: cbNumber,
      ca_remarks: 'Test mode — auto-approved. TDS verified in 26AS. DTAA Article 23 applied.',
      ca_reviewed_by: 'CA Partner (Test Mode)',
      ca_reviewed_at: new Date().toISOString(),
    }),
  ]);
  log(`${transferId} → 15cb_received / approved (15CB: ${cbNumber})`);

  // 20s → 15CA filed
  await delay(5000);
  const caNumber = `CA-TEST-${Date.now().toString().slice(-4)}`;
  await Promise.all([
    updateTransfer(transferId, {
      status: '15ca_filed',
      fifteen_ca_number: caNumber,
    }),
    updateCompliance(transferId, { fifteen_ca_number: caNumber }),
  ]);
  log(`${transferId} → 15ca_filed (15CA: ${caNumber})`);

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
