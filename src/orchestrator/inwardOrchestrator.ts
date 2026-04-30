// [GREEN] InwardOrchestrator — CAD→INR pipeline following Remitly model
// Fable collects CAD. Fable → Nium delivers INR. No 15CA/15CB. No CA.
// Fable also handles FINTRAC >= CAD 10K. REPAIHUB does not file FINTRAC.
//
// How Remitly works (this model):
// 1. Customer enters CAD amount + recipient India bank details
// 2. Fee: flat fee waived above threshold + FX margin in rate
// 3. Payment: Interac e-Transfer or EFT (collected by Fable)
// 4. Fable converts CAD → INR at locked rate
// 5. Fable → Nium delivers to recipient Indian bank (IMPS instant / NEFT)
// 6. Customer receives confirmation with UTR reference

import { supabaseAdmin } from '../lib/supabaseServer.js';
import { assessInwardRisk, storeRiskAssessment } from '../services/riskService.js';
import { getInwardCollectionAdapter, getInwardPayoutAdapter } from '../paymentRails/paymentRailsService.js';
import { log } from '../services/auditService.js';
import type { InwardCollectionInstruction, InwardPayoutInstruction } from '../adapters/IPaymentGateway.js';

// ── Main orchestration entry ──────────────────────────────────────────────────

export async function orchestrateInwardTransfer(transferId: string): Promise<void> {
  // STEP 1 — Load inward transfer
  const { data: transfer, error } = await supabaseAdmin
    .from('inward_transfers')
    .select('*')
    .eq('id', transferId)
    .single();

  if (error || !transfer) {
    console.error(`[GREY] INWARD_ORCHESTRATOR_FAILED — ${transferId} not found`);
    return;
  }

  console.log(`[GREY] INWARD_ORCHESTRATOR_STARTED — ${transferId}`);
  void log('INWARD_ORCHESTRATOR_STARTED', 'system', { transferId, transferType: 'inward' });

  // STEP 2 — Risk assessment (inward rules from risk_config)
  const amountCAD = Number(transfer.amount_cad);
  const userId = transfer.user_id as string;
  const recipientAccount = transfer.recipient_account_last4 ?? '';

  const risk = await assessInwardRisk(amountCAD, userId);
  void storeRiskAssessment(transferId, 'inward', risk);

  console.log(`[GREY] INWARD_RISK_ASSESSED — ${risk.level}: ${risk.reason}`);
  void log('INWARD_RISK_ASSESSED', 'system', { transferId, transferType: 'inward', metadata: { level: risk.level } });

  // FINTRAC threshold — hold for manual review
  // Note: Fable handles FINTRAC report for >= CAD 10K. We just flag it.
  if (risk.caBlocking) {
    await supabaseAdmin.from('inward_transfers').update({
      status: 'pending_review',
      risk_level: risk.level,
      risk_reason: risk.reason,
    }).eq('id', transferId);
    console.log(`[GREY] INWARD_FINTRAC_FLAG — ${transferId} held for review (Fable will file FINTRAC)`);
    return;
  }

  // Update risk fields
  await supabaseAdmin.from('inward_transfers').update({
    risk_level: risk.level,
    risk_reason: risk.reason,
  }).eq('id', transferId);

  // STEP 3 — Initiate CAD collection via Fable
  const adapter = await getInwardCollectionAdapter();
  const speed = (transfer.speed ?? 'standard') as 'standard' | 'express';

  // Express → Interac (instant), Standard → EFT (1 business day)
  const collectionMethod: 'interac' | 'eft' = speed === 'express' ? 'interac' : 'eft';
  const bankName = (transfer.customer_bank_name ?? 'Unknown Bank') as string;
  const netAmountCAD = Number(transfer.net_amount_inr > 0 ? transfer.amount_cad : transfer.amount_cad) -
    Number(transfer.total_fees_cad ?? 0);

  const collectInstruction: InwardCollectionInstruction = {
    transferId,
    amountCAD,
    netAmountCAD: Math.max(netAmountCAD, amountCAD * 0.98), // at least 98% of gross
    customerFlinksToken: (transfer.customer_bank_token ?? '') as string,
    customerBankName: bankName,
    collectionMethod,
    speed,
  };

  try {
    const result = await adapter.collectCAD(collectInstruction);
    console.log(`[ORANGE] FABLE_COLLECT_CAD_INITIATED — ${collectionMethod} from ${bankName}`);
    void log('FABLE_COLLECT_CAD_INITIATED', 'system', {
      transferId, transferType: 'inward',
      metadata: { method: collectionMethod, provider: adapter.getProviderName(), isMock: adapter.isMock() },
    });

    await supabaseAdmin.from('inward_transfers').update({
      status: 'collection_initiated',
      collection_reference: result.providerReference,
      collection_status: 'pending',
      collection_provider: adapter.getProviderName(),
      collection_method: collectionMethod,
      is_mock: adapter.isMock(),
      adapter_name: adapter.getProviderName(),
    }).eq('id', transferId);

  } catch (err) {
    console.error(`[ORANGE] FABLE_COLLECT_FAILED — ${transferId}:`, err);
    await supabaseAdmin.from('inward_transfers').update({ status: 'failed' }).eq('id', transferId);
  }

  // RETURN — webhook fires when Fable confirms collection
}

// ── Payment received from Fable (webhook callback) ────────────────────────────

export async function orchestrateInwardPaymentReceived(
  transferId: string,
  webhookData: Record<string, unknown>,
): Promise<void> {
  // [ORANGE] Fable confirmed CAD collected
  await supabaseAdmin.from('inward_transfers').update({
    status: 'payment_received',
    payment_received_at: webhookData['collectedAt'] ?? new Date().toISOString(),
  }).eq('id', transferId);

  console.log(`[GREY] INWARD_PAYMENT_RECEIVED — ${transferId}`);
  void log('INWARD_PAYMENT_RECEIVED', 'system', { transferId, transferType: 'inward' });

  // Load transfer to get recipient details
  const { data: transfer } = await supabaseAdmin
    .from('inward_transfers')
    .select('*')
    .eq('id', transferId)
    .single();

  if (!transfer) return;

  const amountINR = Number(transfer.net_amount_inr ?? transfer.gross_amount_inr ?? 0);
  const speed = (transfer.speed ?? 'standard') as 'standard' | 'express';

  // Determine INR payout rail
  let preferredRail: 'IMPS' | 'NEFT' | 'UPI' | 'RTGS' = 'IMPS';
  if (amountINR > 500000) {
    preferredRail = 'NEFT'; // large amounts
  } else if (speed === 'express') {
    preferredRail = 'IMPS'; // instant
  }

  const payoutAdapter = await getInwardPayoutAdapter();
  const payoutInstruction: InwardPayoutInstruction = {
    transferId,
    amountINR,
    recipientName: (transfer.recipient_name ?? '') as string,
    recipientBankName: (transfer.recipient_bank_name ?? '') as string,
    recipientAccountNo: (transfer.recipient_account_last4 ?? 'XXXX') as string, // decrypted at payout only
    recipientIFSC: (transfer.recipient_ifsc ?? '') as string,
    preferredRail,
  };

  try {
    const result = await payoutAdapter.payoutINR(payoutInstruction);
    console.log(`[PURPLE] NIUM_PAYOUT_INITIATED — ${preferredRail} to ${transfer.recipient_bank_name}`);
    void log('NIUM_PAYOUT_INITIATED', 'system', {
      transferId, transferType: 'inward',
      metadata: { rail: preferredRail, provider: payoutAdapter.getProviderName() },
    });

    await supabaseAdmin.from('inward_transfers').update({
      status: 'payout_initiated',
      payout_reference: result.providerReference,
      rail_used: preferredRail,
    }).eq('id', transferId);

  } catch (err) {
    console.error(`[PURPLE] NIUM_PAYOUT_FAILED — ${transferId}:`, err);
  }
}

// ── Payout completed (Nium delivered INR) ─────────────────────────────────────

export async function orchestrateInwardCompletion(
  transferId: string,
  webhookData: Record<string, unknown>,
): Promise<void> {
  // [PURPLE] Nium confirmed INR delivered
  await supabaseAdmin.from('inward_transfers').update({
    status: 'completed',
    completed_at: webhookData['deliveredAt'] ?? new Date().toISOString(),
    utr: webhookData['utr'] ?? null,
    rail_used: webhookData['railUsed'] ?? null,
  }).eq('id', transferId);

  const utr = webhookData['utr'];
  console.log(`[GREY] INWARD_COMPLETED — ${transferId} | UTR: ${utr}`);

  // Note: Fable filed FINTRAC if applicable. REPAIHUB logs that it was handled.
  void log('INWARD_COMPLETED', 'system', {
    transferId, transferType: 'inward',
    metadata: {
      utr,
      note: 'FINTRAC handled by Fable Fintech if applicable (>= CAD 10K)',
    },
  });

  // Referral reward — check if this is first inward transfer (non-blocking)
  try {
    const { data: transfer } = await supabaseAdmin
      .from('inward_transfers').select('user_id').eq('id', transferId).single();
    if (transfer) {
      const { count } = await supabaseAdmin
        .from('inward_transfers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', transfer.user_id)
        .eq('status', 'completed');
      if ((count ?? 0) <= 1) {
        import('../services/referralService.js').then(({ processReferralReward }) => {
          void processReferralReward(transfer.user_id, transferId).catch(() => {});
        }).catch(() => {});
      }
    }
  } catch { /* non-critical */ }

  // Notifications (non-blocking) — show UTR to customer
  void sendInwardCompletionNotification(transferId, String(utr ?? ''));
}

async function sendInwardCompletionNotification(transferId: string, _utr: string): Promise<void> {
  try {
    const { data: xfer } = await supabaseAdmin
      .from('inward_transfers').select('user_id, amount_cad, net_amount_inr').eq('id', transferId).single();
    if (!xfer) return;
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('email, full_name').eq('id', xfer.user_id).single();
    if (!profile) return;
    const { notifyTransferStatusChange } = await import('../services/notifications.js');
    await notifyTransferStatusChange({
      customerEmail: profile.email ?? '',
      customerName: profile.full_name ?? 'Customer',
      transferId,
      amountINR: Number(xfer.net_amount_inr ?? 0),
      amountCAD: Number(xfer.amount_cad ?? 0),
      status: 'COMPLETED',
    });
  } catch { /* non-critical */ }
}
