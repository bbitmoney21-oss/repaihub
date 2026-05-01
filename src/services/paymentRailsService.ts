import { supabaseAdmin } from '../lib/supabaseServer';

// ── Config cache ─────────────────────────────────────────────────────────────

let railsConfigCache: Record<string, string> | null = null;
let railsConfigCachedAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getRailsConfig(): Promise<Record<string, string>> {
  if (railsConfigCache && Date.now() - railsConfigCachedAt < CACHE_TTL) {
    return railsConfigCache;
  }
  try {
    const { data } = await supabaseAdmin.from('payment_rails_config').select('key, value');
    railsConfigCache = Object.fromEntries(
      (data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]),
    );
  } catch {
    railsConfigCache = {};
  }
  railsConfigCachedAt = Date.now();
  return railsConfigCache!;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface OutwardTransferInstruction {
  transferId: string;
  amountINR: number;
  nroBankName: string;
  nroBranchCity: string;
  form145Number: string;    // IT Act 2025 (was fifteenCANumber)
  form146Number: string;    // IT Act 2025 (was fifteenCBNumber)
  purposeCode: string;
  beneficiaryCADDetails: {
    bankName: string;
    transitNumber: string;
    institutionNumber: string;
    accountNumber: string;
    accountOwnerName: string;
  };
  exchangeRate: number;
}

export interface InwardCollectionInstruction {
  transferId: string;
  amountCAD: number;
  customerBankToken: string;
  customerBankName: string;
  speed: 'standard' | 'express';
}

export interface InwardPayoutInstruction {
  transferId: string;
  amountINR: number;
  recipientName: string;
  recipientBankName: string;
  recipientAccountLast4: string;
  recipientIFSC: string;
  speed: 'standard' | 'express';
}

// ── OUTWARD TRANSFER EXECUTION (NRO → Canada) ────────────────────────────────
export async function executeOutwardTransfer(
  instruction: OutwardTransferInstruction,
): Promise<{ reference: string; status: string; provider: string }> {
  const cfg = await getRailsConfig();
  const rail = cfg['outward_india_rail'] ?? 'manual';

  if (process.env.NODE_ENV === 'development') {
    return {
      reference: `DEV-OUT-${Date.now()}`,
      status: 'initiated',
      provider: 'dev_mock',
    };
  }

  if (rail === 'fable' && process.env.FABLE_API_KEY) {
    try {
      const response = await fetch(`${process.env.FABLE_API_URL || 'https://api.fablefintech.com/v1'}/transfers/outward`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.FABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          externalId:   instruction.transferId,
          amountINR:    instruction.amountINR,
          purposeCode:  instruction.purposeCode,
          nroBank:      instruction.nroBankName,
          nroBranch:    instruction.nroBranchCity,
          form145Number: instruction.form145Number,
          form146Number: instruction.form146Number,
          beneficiary:  instruction.beneficiaryCADDetails,
          exchangeRate: instruction.exchangeRate,
        }),
      });
      const data = await response.json() as { reference: string; status: string };
      return { reference: data.reference, status: data.status, provider: 'fable' };
    } catch (err) {
      console.error('[Rails] Fable outward transfer failed:', err);
    }
  }

  // Manual / fallback
  return {
    reference: `MANUAL-OUT-${instruction.transferId.slice(0, 8)}-${Date.now()}`,
    status: 'manual_processing',
    provider: 'manual',
  };
}

// ── INWARD COLLECTION (CAD from customer) ────────────────────────────────────
export async function initiateInwardCollection(
  instruction: InwardCollectionInstruction,
): Promise<{ reference: string; estimatedSettlement: string; provider: string }> {
  const cfg = await getRailsConfig();
  const method = cfg['inward_canada_collection'] ?? 'manual';

  const settlementDays = instruction.speed === 'express' ? 1 : 3;
  const estimatedSettlement = new Date(
    Date.now() + settlementDays * 24 * 60 * 60 * 1000,
  ).toISOString().split('T')[0];

  if (process.env.NODE_ENV === 'development') {
    return {
      reference: `DEV-COL-${Date.now()}`,
      estimatedSettlement,
      provider: 'dev_mock',
    };
  }

  if ((method === 'fable_interac' || method === 'fable_eft') && process.env.FABLE_API_KEY) {
    try {
      const endpoint = method === 'fable_interac' ? '/payments/interac' : '/payments/eft';
      const response = await fetch(`${process.env.FABLE_API_URL || 'https://api.fablefintech.com/v1'}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.FABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          externalId:  instruction.transferId,
          amountCAD:   instruction.amountCAD,
          bankToken:   instruction.customerBankToken,
          speed:       instruction.speed,
        }),
      });
      const data = await response.json() as { reference: string };
      return { reference: data.reference, estimatedSettlement, provider: method };
    } catch (err) {
      console.error('[Rails] Fable collection failed:', err);
    }
  }

  return {
    reference: `MANUAL-COL-${instruction.transferId.slice(0, 8)}-${Date.now()}`,
    estimatedSettlement,
    provider: 'manual',
  };
}

// ── INWARD PAYOUT (INR to recipient in India) ────────────────────────────────
export async function executeInwardPayout(
  instruction: InwardPayoutInstruction,
): Promise<{ reference: string; status: string; provider: string }> {
  const cfg = await getRailsConfig();
  const method = cfg['inward_india_payout'] ?? 'manual';

  if (process.env.NODE_ENV === 'development') {
    return {
      reference: `DEV-PAY-${Date.now()}`,
      status: 'initiated',
      provider: 'dev_mock',
    };
  }

  if ((method === 'fable_nium' || method === 'fable_imps') && process.env.FABLE_API_KEY) {
    try {
      const response = await fetch(`${process.env.FABLE_API_URL || 'https://api.fablefintech.com/v1'}/payouts/india`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.FABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          externalId:    instruction.transferId,
          amountINR:     instruction.amountINR,
          recipientName: instruction.recipientName,
          bankName:      instruction.recipientBankName,
          accountLast4:  instruction.recipientAccountLast4,
          ifsc:          instruction.recipientIFSC,
          method:        method === 'fable_nium' ? 'nium' : 'imps',
        }),
      });
      const data = await response.json() as { reference: string; status: string };
      return { reference: data.reference, status: data.status, provider: method };
    } catch (err) {
      console.error('[Rails] Fable payout failed:', err);
    }
  }

  return {
    reference: `MANUAL-PAY-${instruction.transferId.slice(0, 8)}-${Date.now()}`,
    status: 'manual_processing',
    provider: 'manual',
  };
}
