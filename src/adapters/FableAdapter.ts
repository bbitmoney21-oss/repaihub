// [ORANGE] FableAdapter — real Fable API (stubbed until sandbox keys provided)
// When FABLE_API_KEY is set: calls real Fable endpoints
// When key missing or dev mode: delegates to MockFableAdapter

import { supabaseAdmin } from '../lib/supabaseServer.js';
import { MockFableAdapter } from './MockFableAdapter.js';
import type {
  IPaymentGateway,
  RateResult,
  LockedRate,
  OutwardInstruction,
  InwardCollectionInstruction,
  InwardPayoutInstruction,
  TransferResult,
} from './IPaymentGateway.js';
import type { KYCInitiateResult, PANVerifyResult } from './SetuAdapter.js';

const mock = new MockFableAdapter();

async function logAdapterCall(
  method: string,
  transferId: string | undefined,
  request: object,
  response: object,
  durationMs: number,
  success: boolean,
  errorMsg?: string,
): Promise<void> {
  try {
    await supabaseAdmin.from('payment_adapter_logs').insert({
      adapter_name: process.env.FABLE_API_KEY ? 'FableFintech' : 'MockFable',
      method,
      transfer_id: transferId || null,
      request_payload: request,
      response_payload: response,
      duration_ms: durationMs,
      success,
      error_message: errorMsg || null,
      is_mock: !process.env.FABLE_API_KEY,
    });
  } catch {
    // Non-critical logging — never throws
  }
}

async function fablePost(endpoint: string, body: object): Promise<unknown> {
  const baseUrl = process.env.FABLE_API_URL || 'https://api.fablefintech.com/v1';
  const resp = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.FABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Fable API ${endpoint} → ${resp.status}`);
  return resp.json();
}

async function fableGet(endpoint: string): Promise<unknown> {
  const baseUrl = process.env.FABLE_API_URL || 'https://api.fablefintech.com/v1';
  const resp = await fetch(`${baseUrl}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${process.env.FABLE_API_KEY}` },
  });
  if (!resp.ok) throw new Error(`Fable API ${endpoint} → ${resp.status}`);
  return resp.json();
}

export class FableAdapter implements IPaymentGateway {
  async getRate(fromCurrency: string, toCurrency: string): Promise<RateResult> {
    if (!process.env.FABLE_API_KEY) {
      console.log('[ORANGE] FableAdapter — no API key, using mock');
      return mock.getRate(fromCurrency, toCurrency);
    }
    const t0 = Date.now();
    try {
      // TODO: Implement when Fable sandbox credentials received
      // GET {FABLE_API_URL}/v1/rates/inr-cad
      const data = await fableGet(`/rates/${fromCurrency.toLowerCase()}-${toCurrency.toLowerCase()}`) as Record<string, unknown>;
      const result: RateResult = {
        rate: data['rate'] as number,
        rateId: data['rateId'] as string,
        validForSeconds: (data['validForSeconds'] as number) ?? 1800,
        source: 'live',
        provider: 'fable',
      };
      await logAdapterCall('getRate', undefined, { fromCurrency, toCurrency }, result, Date.now() - t0, true);
      return result;
    } catch (err) {
      await logAdapterCall('getRate', undefined, { fromCurrency, toCurrency }, {}, Date.now() - t0, false, String(err));
      console.error('[ORANGE] FableAdapter.getRate failed, falling back to mock:', err);
      return mock.getRate(fromCurrency, toCurrency);
    }
  }

  async lockRate(rateId: string, amount: number): Promise<LockedRate> {
    if (!process.env.FABLE_API_KEY) {
      console.log('[ORANGE] FableAdapter — no API key, using mock');
      return mock.lockRate(rateId, amount);
    }
    const t0 = Date.now();
    try {
      // TODO: POST {FABLE_API_URL}/v1/rates/lock
      const data = await fablePost('/rates/lock', { rateId, amount }) as Record<string, unknown>;
      const result: LockedRate = {
        lockedRate: data['lockedRate'] as number,
        lockId: data['lockId'] as string,
        lockedAt: data['lockedAt'] as string,
        lockedUntil: data['lockedUntil'] as string,
        provider: 'fable',
      };
      await logAdapterCall('lockRate', undefined, { rateId, amount }, result, Date.now() - t0, true);
      return result;
    } catch (err) {
      await logAdapterCall('lockRate', undefined, { rateId, amount }, {}, Date.now() - t0, false, String(err));
      return mock.lockRate(rateId, amount);
    }
  }

  async executeOutward(instruction: OutwardInstruction): Promise<TransferResult> {
    if (!process.env.FABLE_API_KEY) {
      console.log('[ORANGE] FableAdapter — no API key, using mock');
      return mock.executeOutward(instruction);
    }
    const t0 = Date.now();
    try {
      // TODO: POST {FABLE_API_URL}/v1/transfers/outward
      const data = await fablePost('/transfers/outward', instruction) as Record<string, unknown>;
      const result: TransferResult = {
        providerReference: data['providerReference'] as string,
        status: data['status'] as TransferResult['status'],
        estimatedCompletionAt: data['estimatedCompletionAt'] as string,
        providerName: 'FableFintech',
        isMock: false,
      };
      await logAdapterCall('executeOutward', instruction.transferId, instruction, result, Date.now() - t0, true);
      return result;
    } catch (err) {
      await logAdapterCall('executeOutward', instruction.transferId, instruction, {}, Date.now() - t0, false, String(err));
      console.error('[ORANGE] FableAdapter.executeOutward failed, falling back to mock:', err);
      return mock.executeOutward(instruction);
    }
  }

  async collectCAD(instruction: InwardCollectionInstruction): Promise<TransferResult> {
    if (!process.env.FABLE_API_KEY) {
      console.log('[ORANGE] FableAdapter — no API key, using mock');
      return mock.collectCAD(instruction);
    }
    const t0 = Date.now();
    try {
      // TODO: POST {FABLE_API_URL}/v1/inward/collect
      const data = await fablePost('/inward/collect', instruction) as Record<string, unknown>;
      const result: TransferResult = {
        providerReference: data['providerReference'] as string,
        status: data['status'] as TransferResult['status'],
        estimatedCompletionAt: data['estimatedCompletionAt'] as string,
        providerName: 'FableFintech',
        isMock: false,
      };
      await logAdapterCall('collectCAD', instruction.transferId, instruction, result, Date.now() - t0, true);
      return result;
    } catch (err) {
      await logAdapterCall('collectCAD', instruction.transferId, instruction, {}, Date.now() - t0, false, String(err));
      return mock.collectCAD(instruction);
    }
  }

  async payoutINR(instruction: InwardPayoutInstruction): Promise<TransferResult> {
    if (!process.env.FABLE_API_KEY) {
      console.log('[ORANGE] FableAdapter — no API key, using mock');
      return mock.payoutINR(instruction);
    }
    const t0 = Date.now();
    try {
      // TODO: POST {FABLE_API_URL}/v1/inward/payout
      const data = await fablePost('/inward/payout', instruction) as Record<string, unknown>;
      const result: TransferResult = {
        providerReference: data['providerReference'] as string,
        status: data['status'] as TransferResult['status'],
        estimatedCompletionAt: data['estimatedCompletionAt'] as string,
        providerName: 'FableFintech',
        isMock: false,
      };
      await logAdapterCall('payoutINR', instruction.transferId, instruction, result, Date.now() - t0, true);
      return result;
    } catch (err) {
      await logAdapterCall('payoutINR', instruction.transferId, instruction, {}, Date.now() - t0, false, String(err));
      return mock.payoutINR(instruction);
    }
  }

  async getTransferStatus(providerReference: string): Promise<{ status: string; updatedAt: string; details: object }> {
    if (!process.env.FABLE_API_KEY) return mock.getTransferStatus(providerReference);
    try {
      const data = await fableGet(`/transfers/${providerReference}/status`) as Record<string, unknown>;
      return {
        status: data['status'] as string,
        updatedAt: data['updatedAt'] as string,
        details: (data['details'] as object) || {},
      };
    } catch {
      return mock.getTransferStatus(providerReference);
    }
  }

  // ── KYC stubs — unconfirmed with Fable, throw when key set ─────────────────
  // Once Fable confirms KYC capability, replace throw with real fablePost() call.
  async initiateIndiaKYC(userId: string): Promise<KYCInitiateResult> {
    if (!process.env.FABLE_API_KEY) return mock.initiateIndiaKYC(userId);
    // DO NOT call in production until Fable KYC confirmed in meeting
    throw new Error('[FABLE-UNCONFIRMED] Fable India KYC endpoint not yet confirmed — see docs/FABLE_QUESTIONS.md');
  }

  async initiateCanadaKYC(userId: string): Promise<KYCInitiateResult> {
    if (!process.env.FABLE_API_KEY) return mock.initiateCanadaKYC(userId);
    throw new Error('[FABLE-UNCONFIRMED] Fable Canada KYC endpoint not yet confirmed — see docs/FABLE_QUESTIONS.md');
  }

  async verifyPAN(panNumber: string): Promise<PANVerifyResult> {
    if (!process.env.FABLE_API_KEY) return mock.verifyPAN(panNumber);
    throw new Error('[FABLE-UNCONFIRMED] Fable PAN verification endpoint not yet confirmed — see docs/FABLE_QUESTIONS.md');
  }

  getProviderName(): string { return 'FableFintech'; }
  isMock(): boolean { return !process.env.FABLE_API_KEY; }
}
