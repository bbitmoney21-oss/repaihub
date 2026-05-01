// [ORANGE] MockFableAdapter — simulates Fable Fintech behavior
// Used when FABLE_API_KEY is not set (dev mode)
// Fires real webhook callbacks so the full pipeline is testable end-to-end

import { createHash } from 'crypto';
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

const PORT = process.env.PORT || '3000';
const WEBHOOK_URL = `http://localhost:${PORT}/webhooks/fable`;

async function fireWebhook(payload: object): Promise<void> {
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[ORANGE-MOCK] Webhook fire failed (non-critical):', err);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class MockFableAdapter implements IPaymentGateway {
  async getRate(fromCurrency: string, toCurrency: string): Promise<RateResult> {
    if (fromCurrency === 'INR' && toCurrency === 'CAD') {
      return {
        rate: 0.0160,
        rateId: `MOCK-RATE-${Date.now()}`,
        validForSeconds: 1800,
        source: 'mock',
        provider: 'mock_fable',
      };
    }
    // CAD → INR (inward)
    return {
      rate: 62.50,
      rateId: `MOCK-RATE-${Date.now()}`,
      validForSeconds: 900,
      source: 'mock',
      provider: 'mock_fable',
    };
  }

  async lockRate(rateId: string, amount: number): Promise<LockedRate> {
    // Determine direction from rateId prefix (all mocks are valid)
    const isInward = rateId.includes('INR') || amount < 100000;
    const rate = isInward ? 62.50 : 0.0160;
    const validFor = isInward ? 900 : 1800;
    const now = new Date();
    const until = new Date(now.getTime() + validFor * 1000);
    return {
      lockedRate: rate,
      lockId: `MOCK-LOCK-${Date.now()}`,
      lockedAt: now.toISOString(),
      lockedUntil: until.toISOString(),
      provider: 'mock_fable',
    };
  }

  async executeOutward(instruction: OutwardInstruction): Promise<TransferResult> {
    await delay(400); // network simulation

    const providerReference = `FABLE-OUT-${Date.now()}`;

    if (instruction.customerType === 'citizen_nre') {
      console.log(`[ORANGE-MOCK] Fable.executeOutward — NRE route (no 15CA/15CB required)`);
      console.log(`  Fable AD bank debiting NRE account at ${instruction.nroBankName} via Kotak AD bank`);
    } else {
      console.log(`[ORANGE-MOCK] Fable.executeOutward — AD bank debiting ${instruction.nroBankName} account via Kotak AD bank`);
      console.log(`  Route: ${instruction.customerType} | Form145: ${instruction.form145Number || 'N/A'} | Form146: ${instruction.form146Number || 'N/A'}`);
    }

    // Fire webhook after 4 seconds (non-blocking)
    setTimeout(() => {
      void fireWebhook({
        event: 'OUTWARD_COMPLETED',
        transferId: instruction.transferId,
        providerReference,
        swiftReference: `SWIFT-MOCK-${Date.now()}`,
        completedAt: new Date().toISOString(),
        provider: 'mock_fable',
      });
    }, 4000);

    const completionAt = new Date(Date.now() + 4 * 1000).toISOString();
    return {
      providerReference,
      status: 'accepted',
      estimatedCompletionAt: completionAt,
      providerName: 'MockFable',
      isMock: true,
    };
  }

  async collectCAD(instruction: InwardCollectionInstruction): Promise<TransferResult> {
    await delay(300);

    const providerReference = `FABLE-COLLECT-${Date.now()}`;

    console.log(`[ORANGE-MOCK] Fable.collectCAD — ${instruction.collectionMethod} from ${instruction.customerBankName}`);
    console.log(`  Amount: CAD ${instruction.amountCAD} | Net to convert: CAD ${instruction.netAmountCAD}`);

    // Fire webhook after 2 seconds (non-blocking)
    setTimeout(() => {
      void fireWebhook({
        event: 'INWARD_PAYMENT_RECEIVED',
        transferId: instruction.transferId,
        providerReference,
        amountCAD: instruction.amountCAD,
        collectedAt: new Date().toISOString(),
        provider: 'mock_fable',
      });
    }, 2000);

    return {
      providerReference,
      status: 'accepted',
      estimatedCompletionAt: new Date(Date.now() + 2000).toISOString(),
      providerName: 'MockFable',
      isMock: true,
    };
  }

  async payoutINR(instruction: InwardPayoutInstruction): Promise<TransferResult> {
    await delay(500);

    const providerReference = `NIUM-PAYOUT-${Date.now()}`;

    console.log(`[ORANGE+PURPLE-MOCK] Fable→Nium.payoutINR — delivering to ${instruction.recipientBankName} via ${instruction.preferredRail}`);
    console.log(`  Amount: ₹${instruction.amountINR} | IFSC: ${instruction.recipientIFSC}`);

    // Fire webhook after 5 seconds (non-blocking)
    setTimeout(() => {
      void fireWebhook({
        event: 'INWARD_PAYOUT_COMPLETED',
        transferId: instruction.transferId,
        providerReference,
        utr: `UTR${Date.now()}`,
        amountINR: instruction.amountINR,
        railUsed: instruction.preferredRail,
        deliveredAt: new Date().toISOString(),
        provider: 'mock_fable',
      });
    }, 5000);

    return {
      providerReference,
      status: 'accepted',
      estimatedCompletionAt: new Date(Date.now() + 5000).toISOString(),
      providerName: 'MockFable',
      isMock: true,
    };
  }

  async getTransferStatus(providerReference: string): Promise<{ status: string; updatedAt: string; details: object }> {
    return {
      status: 'processing',
      updatedAt: new Date().toISOString(),
      details: { providerReference, source: 'mock' },
    };
  }

  // ── KYC mocks — always return mock data, never throw ─────────────────────────
  async initiateIndiaKYC(userId: string): Promise<KYCInitiateResult> {
    const sessionId = `fable-india-mock-${userId}-${Date.now()}`;
    console.log(`[ORANGE-MOCK] Fable.initiateIndiaKYC — mock session ${sessionId}`);
    return {
      sessionId,
      redirectUrl: `http://localhost:3001/kyc/mock-fable-india?session=${sessionId}`,
      provider: 'fable_india_mock',
      instructions: '[MOCK] Fable India KYC — unconfirmed capability, using mock',
    };
  }

  async initiateCanadaKYC(userId: string): Promise<KYCInitiateResult> {
    const sessionId = `fable-canada-mock-${userId}-${Date.now()}`;
    console.log(`[ORANGE-MOCK] Fable.initiateCanadaKYC — mock session ${sessionId}`);
    return {
      sessionId,
      widgetToken: 'mock-fable-canada-widget-token',
      provider: 'fable_canada_mock',
      instructions: '[MOCK] Fable Canada KYC — unconfirmed capability, using mock',
    };
  }

  async verifyPAN(panNumber: string): Promise<PANVerifyResult> {
    const hash = createHash('sha256').update(panNumber.toUpperCase().trim()).digest('hex');
    console.log(`[ORANGE-MOCK] Fable.verifyPAN — mock valid, hash stored`);
    return {
      valid: true,
      name: 'MOCK PAN HOLDER',
      provider: 'fable_pan_mock',
      panHash: hash,
    };
  }

  getProviderName(): string { return 'MockFable'; }
  isMock(): boolean { return true; }
}
