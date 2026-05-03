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
//
// PRODUCT RULE (May 2026):
//   Inward profit comes from the FX spread, not from explicit fees.
//   We charge a $1.99 small-transfer fee ONLY when amountCAD < $500.
//   Above $500: no fee at all.
//   Express vs Standard does NOT change the price (no surcharge).
//   Commission is zero — the FX spread is the sole revenue line.
//
// The legacy `inward_fee_config` row in Supabase is still loaded (we keep
// it for limit values like daily/monthly/min/max transfer caps), but its
// flatFee/commission/expressSurcharge fields are intentionally ignored for
// fee math. This keeps fees deterministic regardless of how that table
// drifted historically.
export async function calculateInwardFees(input: InwardFeeInput): Promise<InwardFeeResult> {
  const cfg = await getInwardFeeConfig();
  const { amountCAD, exchangeRate, speed, isFirstTransfer } = input;
  void speed;  // intentionally not used — express has no price impact

  const SMALL_TXN_FEE_CAD = 1.99;
  const FREE_THRESHOLD_CAD = 500;

  const grossAmountINR = Math.round((amountCAD / exchangeRate) * 100) / 100;

  // Single small-transfer fee, waived above the threshold OR on first transfer
  let flatFeeCAD = amountCAD < FREE_THRESHOLD_CAD ? SMALL_TXN_FEE_CAD : 0;
  let flatFeeWaived = false;
  if (isFirstTransfer && cfg.firstTransferFlatFeeWaived) {
    flatFeeCAD = 0;
    flatFeeWaived = true;
  }

  const commissionCAD = 0;
  const expressSurchargeCAD = 0;
  const totalFeesCAD = Math.round(flatFeeCAD * 100) / 100;

  const netCAD = Math.max(0, amountCAD - totalFeesCAD);
  const netAmountINR = Math.round((netCAD / exchangeRate) * 100) / 100;

  const feeConfigSnapshot: Record<string, unknown> = {
    model: 'inward_v2_small_txn_only',
    smallTxnFeeCAD:    SMALL_TXN_FEE_CAD,
    freeThresholdCAD:  FREE_THRESHOLD_CAD,
    capturedAt:        new Date().toISOString(),
  };

  const breakdown: string[] = [
    `Transfer amount: CAD ${amountCAD.toFixed(2)} = ₹${grossAmountINR.toLocaleString('en-IN')} gross`,
    flatFeeWaived
      ? `Fee: CAD 0.00 (waived — first inward transfer)`
      : amountCAD < FREE_THRESHOLD_CAD
        ? `Small-transfer fee: CAD ${flatFeeCAD.toFixed(2)} (amount under CAD ${FREE_THRESHOLD_CAD})`
        : `Fee: CAD 0.00 (no fee for transfers of CAD ${FREE_THRESHOLD_CAD}+)`,
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
