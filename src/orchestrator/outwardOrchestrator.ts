// [GREEN] OutwardOrchestrator — full NRO/NRE→CAD pipeline
// Never blocks API response. Every step logged. Non-critical steps non-blocking.
// Fable handles: SWIFT execution, FINTRAC >= CAD 10K, AD bank debit
// REPAIHUB handles: routing decision, compliance tracking, CA portal, audit

import { supabaseAdmin } from '../lib/supabaseServer.js';
import { assessOutwardRisk, storeRiskAssessment } from '../services/riskService.js';
import { determineAccountRoute } from '../compliance/accountTypeService.js';
import { getOutwardAdapter } from '../paymentRails/paymentRailsService.js';
import { log } from '../services/auditService.js';
import type { OutwardInstruction } from '../adapters/IPaymentGateway.js';

// ── Main orchestration entry ──────────────────────────────────────────────────

export async function orchestrateOutwardTransfer(transferId: string): Promise<void> {
  // STEP 1 — Load transfer
  const { data: transfer, error } = await supabaseAdmin
    .from('transfers')
    .select('*')
    .eq('id', transferId)
    .single();

  if (error || !transfer) {
    console.error(`[GREY] ORCHESTRATOR_FAILED — transfer ${transferId} not found`);
    return;
  }

  const currentStatus = (transfer.status ?? '').toLowerCase();
  if (!['initiated', 'kyc_verified'].includes(currentStatus)) {
    console.log(`[GREY] ORCHESTRATOR_SKIPPED — ${transferId} already in status ${currentStatus}`);
    return;
  }

  void log('ORCHESTRATOR_STARTED', 'system', { transferId, metadata: { status: currentStatus } });
  console.log(`[GREY] ORCHESTRATOR_STARTED — ${transferId}`);

  // STEP 2 — Determine account type routing (if not already saved)
  const accountType = (transfer.account_type ?? transfer.accountType ?? 'NRO') as string;
  const residencyType = transfer.residency_type ?? 'work_permit';
  const amountINR = Number(transfer.amount_inr);
  const userId = transfer.user_id as string;

  let accountDecision = {
    customerModel: (transfer.customer_model ?? 'p2p') as string,
    accountType: accountType as 'NRO' | 'NRE',
    requiresForm145146: false,
    form145Part: 'C' as 'A' | 'C' | 'EXEMPT',
    description: '',
  };

  try {
    accountDecision = await determineAccountRoute(residencyType, accountType, amountINR, userId);

    await supabaseAdmin.from('transfers').update({
      customer_model: accountDecision.customerModel,
      // Write to both old and new column names during migration 016 window
      form145_part: accountDecision.form145Part,
      fifteen_ca_part: accountDecision.form145Part,
    }).eq('id', transferId);

    console.log(`[GREY] ACCOUNT_TYPE_DETERMINED — ${accountDecision.description}`);
    void log('ACCOUNT_TYPE_DETERMINED', 'system', {
      transferId,
      metadata: { customerModel: accountDecision.customerModel, part: accountDecision.form145Part },
    });
  } catch (err) {
    console.error('[GREY] Account type determination failed (continuing with defaults):', err);
  }

  // STEP 3 — Risk assessment
  const sourceOfFunds = transfer.source_of_funds ?? null;
  const tdsDeducted = transfer.tds_deducted ?? false;

  const risk = await assessOutwardRisk(amountINR, userId, sourceOfFunds, tdsDeducted);
  void storeRiskAssessment(transferId, 'outward', risk);

  try {
    await supabaseAdmin.from('transfers').update({
      risk_level: risk.level,
      risk_reason: risk.reason,
      ca_required: risk.caRequired,
      ca_blocking: risk.caBlocking,
    }).eq('id', transferId);
  } catch { /* column may not exist yet — non-fatal */ }

  console.log(`[GREY] RISK_ASSESSED — ${risk.level}: ${risk.reason}`);
  void log('RISK_ASSESSED', 'system', { transferId, metadata: { level: risk.level, reason: risk.reason } });

  // STEP 4 — Routing decision (5 paths)

  // PATH A — NRE account: skip CA, execute immediately
  if (accountDecision.accountType === 'NRE' || accountDecision.form145Part === 'EXEMPT') {
    await supabaseAdmin.from('transfers').update({ status: 'processing' }).eq('id', transferId);
    console.log('[GREY] NRE_ROUTE — skipping CA workflow, executing via Fable');
    void log('NRE_ROUTE', 'system', { transferId });
    await executeViaFable(transferId, transfer, accountDecision);
    return;
  }

  // PATH B — NRO + Part A (below ₹5L cumulative, low risk, no blocking)
  if (accountDecision.form145Part === 'A' && !risk.caBlocking) {
    await supabaseAdmin.from('transfers').update({ status: 'processing' }).eq('id', transferId);
    console.log('[GREY] PART_A_AUTO_APPROVED — no CA required');
    void log('PART_A_AUTO_APPROVED', 'system', { transferId });
    await executeViaFable(transferId, transfer, accountDecision);
    return;
  }

  // PATH E — Any blocking compliance issue (non-risk blocker, e.g. missing docs)
  if (risk.caBlocking && risk.level !== 'HIGH') {
    await supabaseAdmin.from('transfers').update({ status: 'pending_review' }).eq('id', transferId);
    console.log('[GREY] PENDING_MANUAL_REVIEW — blocking compliance issue');
    void log('PENDING_MANUAL_REVIEW', 'system', { transferId, metadata: { reason: risk.reason } });
    return;
  }

  // PATH C — NRO + Part C + HIGH risk: BLOCKING — await CA approval
  if (risk.level === 'HIGH' && risk.caBlocking) {
    await supabaseAdmin.from('transfers').update({
      status: 'form146_requested',
      ca_required: true,
      ca_blocking: true,
    }).eq('id', transferId);
    // Notify CAs (non-blocking)
    void notifyCAPortal(transferId, transfer, accountDecision, 'blocking');
    console.log('[GREY] CA_WEBHOOK_FIRED — BLOCKING — awaiting Form 146 certification');
    void log('CA_WEBHOOK_FIRED', 'system', {
      transferId,
      metadata: { blocking: true, level: risk.level, reason: risk.reason },
    });
    // RETURN — resumes when CA approves via POST /ca/transfers/:id/approve
    return;
  }

  // PATH D — NRO + Part C + MEDIUM risk: Non-blocking, CA reviews in parallel
  if (accountDecision.form145Part === 'C' && risk.caRequired && !risk.caBlocking) {
    await supabaseAdmin.from('transfers').update({
      status: 'form146_requested',
      ca_required: true,
      ca_blocking: false,
    }).eq('id', transferId);
    // Notify CAs in background — non-blocking
    void notifyCAPortal(transferId, transfer, accountDecision, 'parallel');
    console.log('[GREY] CA_WEBHOOK_FIRED_PARALLEL — Form 146 review in parallel, transfer proceeding');
    void log('CA_WEBHOOK_FIRED_PARALLEL', 'system', { transferId });

    await supabaseAdmin.from('transfers').update({ status: 'processing_with_compliance' }).eq('id', transferId);
    await executeViaFable(transferId, transfer, accountDecision);
    return;
  }

  // Fallback — any LOW risk with Part C (shouldn't normally reach here)
  await supabaseAdmin.from('transfers').update({ status: 'processing' }).eq('id', transferId);
  await executeViaFable(transferId, transfer, accountDecision);
}

// ── STEP 6 — Execute via Fable adapter ───────────────────────────────────────

async function executeViaFable(
  transferId: string,
  transfer: Record<string, unknown>,
  accountDecision: { customerModel: string; accountType: 'NRO' | 'NRE'; form145Part: string },
): Promise<void> {
  try {
    const adapter = await getOutwardAdapter();

    // Fetch Canadian bank details for beneficiary
    const { data: canadaBank } = await supabaseAdmin
      .from('canada_bank_accounts')
      .select('institution, transit_number, institution_number, account_owner_name')
      .eq('user_id', transfer.user_id)
      .maybeSingle();

    const instruction: OutwardInstruction = {
      transferId,
      customerType: accountDecision.customerModel as 'p2p' | 'citizen_nro' | 'citizen_nre',
      accountType: accountDecision.accountType,
      amountINR: Number(transfer.amount_inr),
      nroBankName: (transfer.nro_bank_name ?? transfer.nroBankName ?? 'HDFC Bank') as string,
      nroBranchCity: (transfer.nro_branch_city ?? transfer.nroBranchCity ?? 'Mumbai') as string,
      fifteenCANumber: (transfer.form145_number ?? transfer.fifteen_ca_number ?? '') as string,
      fifteenCBNumber: (transfer.form146_number ?? transfer.fifteen_cb_number ?? '') as string,
      purposeCode: (transfer.purpose_code ?? 'P1301') as string,
      exchangeRate: Number(transfer.exchange_rate ?? 0.0160),
      beneficiaryCAD: {
        bankName: (canadaBank?.institution ?? 'RBC') as string,
        transitNumber: (canadaBank?.transit_number ?? '') as string,
        institutionNumber: (canadaBank?.institution_number ?? '') as string,
        accountNumber: '[fetched-from-flinks-at-runtime]', // never stored
        accountOwnerName: (canadaBank?.account_owner_name ?? '') as string,
      },
    };

    const result = await adapter.executeOutward(instruction);

    console.log(`[ORANGE] FABLE_CALLED — ${adapter.getProviderName()} — isMock: ${adapter.isMock()}`);
    void log('FABLE_OUTWARD_CALLED', 'system', {
      transferId,
      metadata: {
        provider: adapter.getProviderName(),
        isMock: adapter.isMock(),
        providerReference: result.providerReference,
      },
    });

    await supabaseAdmin.from('transfers').update({
      status: 'bank_processing',
      provider_reference: result.providerReference,
      adapter_name: adapter.getProviderName(),
      is_mock: adapter.isMock(),
    }).eq('id', transferId);

    // Log to payment_adapter_logs
    void supabaseAdmin.from('payment_adapter_logs').insert({
      adapter_name: adapter.getProviderName(),
      method: 'executeOutward',
      transfer_id: transferId,
      request_payload: { customerType: instruction.customerType, accountType: instruction.accountType },
      response_payload: result,
      success: true,
      is_mock: adapter.isMock(),
    });

  } catch (err) {
    console.error(`[ORANGE] FABLE_OUTWARD_FAILED — ${transferId}:`, err);
    void supabaseAdmin.from('transfers').update({
      status: 'failed',
      risk_reason: `Fable execution failed: ${String(err)}`,
    }).eq('id', transferId);
  }
}

// ── CA Portal notification ────────────────────────────────────────────────────

async function notifyCAPortal(
  transferId: string,
  transfer: Record<string, unknown>,
  accountDecision: { customerModel: string; form145Part: string },
  mode: 'blocking' | 'parallel',
): Promise<void> {
  // In production this would also email/push-notify the CA partner
  void supabaseAdmin.from('transfer_events').insert({
    transfer_id: transferId,
    user_id: transfer.user_id,
    status: 'form146_requested',
    note: `[GREEN] Form 146 certification required (${mode}). Model: ${accountDecision.customerModel}, Form 145 Part ${accountDecision.form145Part}. Awaiting CA action.`,
  });
}

// ── Completion handler (called by webhook handler) ────────────────────────────

export async function orchestrateOutwardCompletion(
  transferId: string,
  webhookData: Record<string, unknown>,
): Promise<void> {
  await supabaseAdmin.from('transfers').update({
    status: 'completed',
    swift_reference: webhookData['swiftReference'] ?? null,
    completed_at: webhookData['completedAt'] ?? new Date().toISOString(),
  }).eq('id', transferId);

  // Check if this is the first completed transfer (for referral reward)
  try {
    const { count } = await supabaseAdmin
      .from('transfers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', '')
      .eq('status', 'completed');

    if ((count ?? 0) <= 1) {
      // First transfer — fire referral reward non-blocking
      const { data: xfer } = await supabaseAdmin
        .from('transfers').select('user_id').eq('id', transferId).single();
      if (xfer) {
        import('../services/referralService.js').then(({ processReferralReward }) => {
          void processReferralReward(xfer.user_id, transferId).catch(() => {});
        }).catch(() => {});
      }
    }
  } catch { /* non-critical */ }

  // Notifications non-blocking
  void sendCompletionNotification(transferId);

  // NOTE: FINTRAC reporting handled by Fable. REPAIHUB does NOT file FINTRAC.
  void log('OUTWARD_COMPLETED', 'system', {
    transferId,
    metadata: {
      swiftReference: webhookData['swiftReference'],
      note: 'FINTRAC handled by Fable Fintech if applicable',
    },
  });
  console.log(`[GREY] OUTWARD_COMPLETED — ${transferId} | SWIFT: ${webhookData['swiftReference']}`);
}

async function sendCompletionNotification(transferId: string): Promise<void> {
  try {
    const { data: xfer } = await supabaseAdmin
      .from('transfers').select('user_id, amount_inr, net_amount_cad').eq('id', transferId).single();
    if (!xfer) return;
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('email, full_name').eq('id', xfer.user_id).single();
    if (!profile) return;
    const { notifyTransferStatusChange } = await import('../services/notifications.js');
    await notifyTransferStatusChange({
      customerEmail: profile.email ?? '',
      customerName: profile.full_name ?? 'Customer',
      transferId,
      amountINR: Number(xfer.amount_inr ?? 0),
      amountCAD: Number(xfer.net_amount_cad ?? 0),
      status: 'COMPLETED',
    });
  } catch { /* non-critical */ }
}

// ── CA approval triggers Fable execution ─────────────────────────────────────

export async function orchestrateAfterCAApproval(transferId: string): Promise<void> {
  const { data: transfer } = await supabaseAdmin
    .from('transfers').select('*').eq('id', transferId).single();
  if (!transfer) return;

  const accountType = (transfer.account_type ?? transfer.accountType ?? 'NRO') as string;
  const customerModel = (transfer.customer_model ?? 'p2p') as string;

  const accountDecision = {
    customerModel,
    accountType: accountType as 'NRO' | 'NRE',
    form145Part: (transfer.form145_part ?? transfer.fifteen_ca_part ?? 'C') as string,
  };

  console.log(`[GREY] CA_APPROVED — ${transferId} — executing via Fable`);
  void log('CA_APPROVED_EXECUTING', 'system', { transferId });

  await executeViaFable(transferId, transfer as Record<string, unknown>, accountDecision);
}
