// [GREY] Webhook receiver — handles all Fable/Nium callbacks
// MUST be idempotent. Log every raw webhook first. Never lose an event.
// Always returns 200 — even on error — prevents Fable retrying forever.

import { Router, Request, Response } from 'express';
import { supabaseAdmin, supabaseAdminConfigured } from '../lib/supabaseServer.js';
import { log } from '../services/auditService.js';
import {
  orchestrateOutwardCompletion,
} from '../orchestrator/outwardOrchestrator.js';
import {
  orchestrateInwardPaymentReceived,
  orchestrateInwardCompletion,
} from '../orchestrator/inwardOrchestrator.js';

const router = Router();

// ── POST /webhooks/fable ───────────────────────────────────────────────────────
router.post('/fable', async (req: Request, res: Response) => {
  // Always return 200 immediately
  res.status(200).json({ received: true });

  const payload = req.body as Record<string, unknown>;
  const event = String(payload['event'] ?? '');
  const transferId = String(payload['transferId'] ?? '');
  const providerReference = String(payload['providerReference'] ?? '');
  const provider = String(payload['provider'] ?? 'fable');

  console.log(`[GREY] WEBHOOK_RECEIVED — ${event} | transfer: ${transferId}`);

  // STEP 1 — Log raw payload to provider_events FIRST (never lose an event)
  let eventId: string | null = null;
  if (supabaseAdminConfigured) {
    try {
      const { data: eventRow, error: insertErr } = await supabaseAdmin
        .from('provider_events')
        .insert({
          provider,
          event_type: event,
          transfer_id: transferId || null,
          provider_reference: providerReference || null,
          raw_payload: payload,
          processed: false,
        })
        .select('id')
        .single();

      if (!insertErr && eventRow) {
        eventId = eventRow.id as string;
      }
    } catch (err) {
      // Idempotency: unique constraint violation means already logged
      if (String(err).includes('duplicate') || String(err).includes('unique')) {
        console.log(`[GREY] WEBHOOK_DUPLICATE — ${event} already processed`);
        return;
      }
      console.error('[GREY] Failed to log provider_event (continuing anyway):', err);
    }
  }

  // STEP 2 — Idempotency check
  if (supabaseAdminConfigured && providerReference) {
    try {
      const { data: existing } = await supabaseAdmin
        .from('provider_events')
        .select('processed')
        .eq('provider_reference', providerReference)
        .eq('event_type', event)
        .maybeSingle();

      if (existing?.processed === true) {
        console.log(`[GREY] WEBHOOK_ALREADY_PROCESSED — ${event} ${providerReference}`);
        return;
      }
    } catch { /* non-critical */ }
  }

  // STEP 3 — Route by event type
  try {
    if (!transferId) {
      console.log(`[GREY] WEBHOOK_NO_TRANSFER_ID — ${event}`);
      return;
    }

    switch (event) {
      case 'OUTWARD_COMPLETED':
        await orchestrateOutwardCompletion(transferId, payload);
        break;

      case 'INWARD_PAYMENT_RECEIVED':
        await orchestrateInwardPaymentReceived(transferId, payload);
        break;

      case 'INWARD_PAYOUT_COMPLETED':
        await orchestrateInwardCompletion(transferId, payload);
        break;

      case 'OUTWARD_FAILED':
      case 'INWARD_FAILED':
        await handleTransferFailure(transferId, payload, event);
        break;

      case 'KYC_VERIFIED':
        await handleKYCVerified(payload);
        break;

      case 'FINTRAC_FILED':
        // Fable filed FINTRAC. REPAIHUB logs that it was handled — no action needed.
        console.log(`[GREY] FINTRAC_FILED_BY_FABLE — transfer: ${transferId}`);
        void log('FINTRAC_FILED_BY_FABLE', 'system', {
          transferId,
          metadata: { note: 'Fable Fintech filed FINTRAC report', payload },
        });
        break;

      default:
        console.log(`[GREY] WEBHOOK_UNKNOWN_EVENT — ${event}`);
    }

    // STEP 4 — Mark as processed
    if (supabaseAdminConfigured && eventId) {
      await supabaseAdmin
        .from('provider_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('id', eventId);
    }

  } catch (err) {
    // Log errors but never return 4xx/5xx — Fable must not retry
    console.error(`[GREY] WEBHOOK_PROCESSING_ERROR — ${event}:`, err);
    void log('WEBHOOK_ERROR', 'system', {
      transferId,
      metadata: { event, error: String(err) },
    });
  }
});

// ── POST /webhooks/fable/kyc ──────────────────────────────────────────────────
router.post('/fable/kyc', async (req: Request, res: Response) => {
  res.status(200).json({ received: true });

  const payload = req.body as Record<string, unknown>;
  const userId = String(payload['userId'] ?? '');
  const status = String(payload['status'] ?? '');

  if (!userId || !supabaseAdminConfigured) return;

  try {
    if (status === 'verified') {
      await supabaseAdmin.from('kyc_submissions').upsert({
        user_id: userId,
        canada_verified: true,
        india_verified: true,
        kyc_verified_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      console.log(`[GREY] KYC_VERIFIED — user: ${userId}`);
      void log('KYC_VERIFIED', 'system', { userId, metadata: { source: 'fable_webhook' } });
    } else {
      console.log(`[GREY] KYC_FAILED — user: ${userId}`);
      void log('KYC_FAILED', 'system', { userId, metadata: { status } });
    }
  } catch (err) {
    console.error('[GREY] KYC webhook processing error:', err);
  }
});

// ── Failure handler ───────────────────────────────────────────────────────────

async function handleTransferFailure(
  transferId: string,
  payload: Record<string, unknown>,
  event: string,
): Promise<void> {
  const isInward = event === 'INWARD_FAILED';
  const table = isInward ? 'inward_transfers' : 'transfers';

  try {
    await supabaseAdmin.from(table).update({
      status: 'failed',
      risk_reason: String(payload['reason'] ?? 'Transfer failed via provider'),
    }).eq('id', transferId);
  } catch { /* non-critical */ }

  console.log(`[GREY] TRANSFER_FAILED — ${transferId}: ${payload['reason']}`);
  void log('TRANSFER_FAILED', 'system', {
    transferId,
    transferType: isInward ? 'inward' : 'outward',
    metadata: payload,
  });
}

// ── KYC verification handler ──────────────────────────────────────────────────

async function handleKYCVerified(payload: Record<string, unknown>): Promise<void> {
  const userId = String(payload['userId'] ?? '');
  if (!userId || !supabaseAdminConfigured) return;

  try {
    await supabaseAdmin.from('profiles').update({
      kyc_status: 'verified',
    }).eq('id', userId);
  } catch { /* non-critical */ }

  void log('KYC_VERIFIED', 'system', { userId, metadata: { source: 'fable_outward_webhook' } });
}

export default router;
