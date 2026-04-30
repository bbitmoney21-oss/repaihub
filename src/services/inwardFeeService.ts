import { supabaseAdmin } from '../lib/supabaseServer';

// ── Config cache ─────────────────────────────────────────────────────────────

interface InwardFeeConfig {
  flatFeeCAD: number;
  commissionRateTotal: number;
  expressSurchargeCAD: number;
  firstTransferFlatFeeWaived: boolean;
  dailyLimitCAD: number;
  monthlyLimitCAD: number;
  minTransferCAD: number;
  maxTransferCAD: number;
}

let feeConfigCache: InwardFeeConfig | null = null;
let feeConfigCachedAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

export async function getInwardFeeConfig(): Promise<InwardFeeConfig> {
  if (feeConfigCache && Date.now() - feeConfigCachedAt < CACHE_TTL) {
    return feeConfigCache;
  }

  let cfg: Record<string, number> = {};
  try {
    const { data } = await supabaseAdmin
      .from('inward_fee_config')
      .select('key, value')
      .eq('is_active', true);
    (data ?? []).forEach((r: { key: string; value: unknown }) => {
      cfg[r.key] = Number(r.value);
    });
  } catch {
    cfg = {};
  }

  feeConfigCache = {
    flatFeeCAD:                 cfg['flat_fee_cad']                  ?? 15,
    commissionRateTotal:        cfg['commission_rate_total']           ?? 1.5,
    expressSurchargeCAD:        cfg['express_surcharge_cad']           ?? 20,
    firstTransferFlatFeeWaived: (cfg['first_transfer_flat_fee_waived'] ?? 1) === 1,
    dailyLimitCAD:              cfg['daily_limit_cad']                 ?? 5000,
    monthlyLimitCAD:            cfg['monthly_limit_cad']               ?? 20000,
    minTransferCAD:             cfg['min_transfer_cad']                ?? 50,
    maxTransferCAD:             cfg['max_transfer_cad']                ?? 10000,
  };
  feeConfigCachedAt = Date.now();
  return feeConfigCache;
}

export function clearInwardFeeConfigCache(): void {
  feeConfigCache = null;
  feeConfigCachedAt = 0;
}

// ── Public types ─────────────────────────────────────────────────────────────

export interface InwardFeeInput {
  amountCAD: number;
  exchangeRate: number;   // CAD per INR (e.g. 0.016 means 1 INR = CAD 0.016)
  speed: 'standard' | 'express';
  isFirstTransfer: boolean;
  userId: string;
}

export interface InwardFeeResult {
  amountCAD: number;
  exchangeRate: number;
  grossAmountINR: number;
  commissionCAD: number;
  flatFeeCAD: number;
  expressSurchargeCAD: number;
  totalFeesCAD: number;
  netAmountINR: number;
  feeConfigSnapshot: Record<string, unknown>;
  breakdown: string[];
}

// ── Main calculation ─────────────────────────────────────────────────────────
export async function calculateInwardFees(input: InwardFeeInput): Promise<InwardFeeResult> {
  const cfg = await getInwardFeeConfig();
  const { amountCAD, exchangeRate, speed, isFirstTransfer } = input;

  // Gross INR = CAD amount / (CAD per INR rate)
  const grossAmountINR = Math.round((amountCAD / exchangeRate) * 100) / 100;

  // Commission on CAD amount
  const commissionCAD = Math.round(amountCAD * (cfg.commissionRateTotal / 100) * 100) / 100;

  // Flat fee (waived for first inward transfer)
  let flatFeeCAD = cfg.flatFeeCAD;
  let flatFeeWaived = false;
  if (isFirstTransfer && cfg.firstTransferFlatFeeWaived) {
    flatFeeCAD = 0;
    flatFeeWaived = true;
  }

  // Express surcharge
  const expressSurchargeCAD = speed === 'express' ? cfg.expressSurchargeCAD : 0;

  // Total fees
  const totalFeesCAD = Math.round((commissionCAD + flatFeeCAD + expressSurchargeCAD) * 100) / 100;

  // Net INR = (CAD - fees) / rate
  const netCAD = Math.max(0, amountCAD - totalFeesCAD);
  const netAmountINR = Math.round((netCAD / exchangeRate) * 100) / 100;

  const feeConfigSnapshot: Record<string, unknown> = {
    flatFeeCAD:          cfg.flatFeeCAD,
    commissionRateTotal: cfg.commissionRateTotal,
    expressSurchargeCAD: cfg.expressSurchargeCAD,
    capturedAt:          new Date().toISOString(),
  };

  const breakdown: string[] = [
    `Transfer amount: CAD ${amountCAD.toFixed(2)} = ₹${grossAmountINR.toLocaleString('en-IN')} gross`,
    `Commission ${cfg.commissionRateTotal}%: CAD ${commissionCAD.toFixed(2)}`,
    flatFeeWaived
      ? `Flat fee: CAD 0.00 (waived — first inward transfer)`
      : `Flat fee: CAD ${flatFeeCAD.toFixed(2)}`,
    ...(expressSurchargeCAD > 0 ? [`Express surcharge: CAD ${expressSurchargeCAD.toFixed(2)}`] : []),
    `Total fees: CAD ${totalFeesCAD.toFixed(2)}`,
    `Recipient receives: ₹${netAmountINR.toLocaleString('en-IN')}`,
  ];

  return {
    amountCAD,
    exchangeRate,
    grossAmountINR,
    commissionCAD,
    flatFeeCAD,
    expressSurchargeCAD,
    totalFeesCAD,
    netAmountINR,
    feeConfigSnapshot,
    breakdown,
  };
}

// ── Limit checks ─────────────────────────────────────────────────────────────
export async function checkInwardLimits(
  userId: string,
  amountCAD: number,
): Promise<{ allowed: boolean; reason?: string }> {
  const cfg = await getInwardFeeConfig();

  if (amountCAD < cfg.minTransferCAD) {
    return { allowed: false, reason: `Minimum inward transfer is CAD ${cfg.minTransferCAD}` };
  }
  if (amountCAD > cfg.maxTransferCAD) {
    return { allowed: false, reason: `Maximum single inward transfer is CAD ${cfg.maxTransferCAD}` };
  }

  // Check daily limit
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  try {
    const { data: todayTransfers } = await supabaseAdmin
      .from('inward_transfers')
      .select('amount_cad')
      .eq('user_id', userId)
      .neq('status', 'failed')
      .gte('created_at', todayStart.toISOString());

    const todayTotal = (todayTransfers ?? []).reduce(
      (sum: number, t: { amount_cad: unknown }) => sum + Number(t.amount_cad), 0,
    );

    if (todayTotal + amountCAD > cfg.dailyLimitCAD) {
      return {
        allowed: false,
        reason: `Daily limit of CAD ${cfg.dailyLimitCAD} would be exceeded (used: CAD ${todayTotal.toFixed(2)})`,
      };
    }
  } catch {
    // If table doesn't exist yet, allow the transfer
  }

  return { allowed: true };
}
