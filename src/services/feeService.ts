import { supabaseAdmin } from '../lib/supabaseServer';

// ── Fee config types ──────────────────────────────────────────────────────────

interface FeeConfig {
  flatFeeCAD: number;
  commissionRateTotal: number;
  commissionRateRPH: number;
  commissionRatePartner: number;
  expressSurchargeCAD: number;
  firstTransferFlatFeeWaived: boolean;
  referralRewardReferrerCAD: number;
  referralRewardRefereeFlatFeeWaived: boolean;
  minTransferINR: number;
  maxTransferINR: number;
}

// ── 5-minute cache — avoids hitting DB on every transfer ──────────────────────

let feeConfigCache: FeeConfig | null = null;
let feeConfigCachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getFeeConfig(): Promise<FeeConfig> {
  const now = Date.now();
  if (feeConfigCache && (now - feeConfigCachedAt) < CACHE_TTL_MS) {
    return feeConfigCache;
  }

  let cfg: Record<string, number> = {};
  try {
    const { data, error } = await supabaseAdmin
      .from('fee_config')
      .select('key, value')
      .eq('is_active', true);

    if (!error) {
      (data ?? []).forEach((row: { key: string; value: unknown }) => {
        cfg[row.key] = Number(row.value);
      });
    } else {
      console.warn('[FeeService] fee_config table unavailable — using defaults:', error.message);
    }
  } catch (err) {
    console.warn('[FeeService] fee_config query failed — using defaults:', err);
  }

  // Fallback defaults match migration 008 seed values
  feeConfigCache = {
    flatFeeCAD:                          cfg['flat_fee_cad']                          ?? 25,
    commissionRateTotal:                 cfg['commission_rate_total']                  ?? 1.8,
    commissionRateRPH:                   cfg['commission_rate_rph']                    ?? 1.3,
    commissionRatePartner:               cfg['commission_rate_partner']                ?? 0.5,
    expressSurchargeCAD:                 cfg['express_surcharge_cad']                  ?? 24,
    firstTransferFlatFeeWaived:          (cfg['first_transfer_flat_fee_waived']        ?? 1) === 1,
    referralRewardReferrerCAD:           cfg['referral_reward_referrer_cad']           ?? 25,
    referralRewardRefereeFlatFeeWaived:  (cfg['referral_reward_referee_flat_fee_waived'] ?? 1) === 1,
    minTransferINR:                      cfg['min_transfer_inr']                       ?? 500000,
    maxTransferINR:                      cfg['max_transfer_inr']                       ?? 83000000,
  };

  feeConfigCachedAt = now;
  return feeConfigCache;
}

// Call this from PUT /admin/fees/:key after any update so next transfer picks up the change
export function clearFeeConfigCache(): void {
  feeConfigCache = null;
  feeConfigCachedAt = 0;
}

// ── Public interfaces ─────────────────────────────────────────────────────────

export interface FeeCalculationInput {
  amountINR: number;
  exchangeRate: number;  // INR per CAD (e.g. 64.5 means 1 CAD = ₹64.5)
  speed: 'standard' | 'express';
  isFirstTransfer: boolean;
  promoCode?: string | null;
  userId: string;
}

export interface FeeCalculationResult {
  amountINR: number;
  exchangeRate: number;
  grossAmountCAD: number;
  commissionCAD: number;
  repaihubCommissionCAD: number;
  partnerCommissionCAD: number;
  flatFeeCAD: number;
  expressSurchargeCAD: number;
  promoDiscountCAD: number;
  promoCodeApplied: string | null;
  promoCodeId: string | null;
  promoDescription: string | null;
  promoError: string | null;
  creditAppliedCAD: number;
  totalFeesCAD: number;
  netAmountCAD: number;
  feeConfigSnapshot: Record<string, unknown>;
  breakdown: string[];
}

// ── Main calculation ──────────────────────────────────────────────────────────

export async function calculateFees(input: FeeCalculationInput): Promise<FeeCalculationResult> {
  const cfg = await getFeeConfig();
  const { amountINR, exchangeRate, speed, isFirstTransfer, promoCode, userId } = input;

  // Step 1 — Gross CAD (rate is INR per CAD, so divide)
  const grossAmountCAD = Math.round((amountINR / exchangeRate) * 100) / 100;

  // Step 2 — Commission components
  const commissionCAD         = Math.round(grossAmountCAD * (cfg.commissionRateTotal   / 100) * 100) / 100;
  const repaihubCommissionCAD = Math.round(grossAmountCAD * (cfg.commissionRateRPH     / 100) * 100) / 100;
  const partnerCommissionCAD  = Math.round(grossAmountCAD * (cfg.commissionRatePartner / 100) * 100) / 100;

  // Step 3 — Flat fee (waived for first transfer if config says so)
  let flatFeeCAD = cfg.flatFeeCAD;
  let flatFeeWaived = false;
  if (isFirstTransfer && cfg.firstTransferFlatFeeWaived) {
    flatFeeCAD = 0;
    flatFeeWaived = true;
  }

  // Step 4 — Express surcharge
  const expressSurchargeCAD = speed === 'express' ? cfg.expressSurchargeCAD : 0;

  // Step 5 — Promo code discount
  let promoDiscountCAD: number = 0;
  let promoCodeApplied: string | null = null;
  let promoCodeId: string | null = null;
  let promoDescription: string | null = null;
  let promoError: string | null = null;

  if (promoCode) {
    const promoResult = await applyPromoCode({
      code: promoCode,
      userId,
      amountINR,
      grossAmountCAD,
      isFirstTransfer,
      flatFeeAlreadyWaived: flatFeeWaived,
      cfg,
    });

    if (promoResult.valid) {
      promoDiscountCAD = promoResult.discountCAD;
      promoCodeApplied = promoCode.toUpperCase();
      promoCodeId      = promoResult.promoCodeId;
      promoDescription = promoResult.description;
      if (promoResult.wavesFlatFee && !flatFeeWaived) {
        flatFeeCAD    = 0;
        flatFeeWaived = true;
      }
    } else {
      promoError = promoResult.error ?? 'Invalid promo code';
    }
  }

  // Step 6 — User credits (referral rewards balance auto-applied)
  let creditAppliedCAD = 0;
  const { data: creditData } = await supabaseAdmin
    .from('user_credits')
    .select('balance_cad')
    .eq('user_id', userId)
    .maybeSingle();

  if (creditData && Number(creditData.balance_cad) > 0) {
    const feesBeforeCredit = commissionCAD + flatFeeCAD + expressSurchargeCAD - promoDiscountCAD;
    creditAppliedCAD = Math.min(Number(creditData.balance_cad), Math.max(0, feesBeforeCredit));
    creditAppliedCAD = Math.round(creditAppliedCAD * 100) / 100;
  }

  // Step 7 — Totals
  const totalFeesCAD = Math.max(
    0,
    Math.round((commissionCAD + flatFeeCAD + expressSurchargeCAD - promoDiscountCAD - creditAppliedCAD) * 100) / 100,
  );
  const netAmountCAD = Math.round((grossAmountCAD - totalFeesCAD) * 100) / 100;

  // Step 8 — Config snapshot (preserves rates at time of transfer; history never changes)
  const feeConfigSnapshot: Record<string, unknown> = {
    flatFeeCAD:           cfg.flatFeeCAD,
    commissionRateTotal:  cfg.commissionRateTotal,
    commissionRateRPH:    cfg.commissionRateRPH,
    commissionRatePartner: cfg.commissionRatePartner,
    expressSurchargeCAD:  cfg.expressSurchargeCAD,
    capturedAt:           new Date().toISOString(),
  };

  // Step 9 — Human-readable breakdown for UI display
  const breakdown: string[] = [
    `Transfer amount: ₹${amountINR.toLocaleString('en-IN')} = CAD ${grossAmountCAD.toFixed(2)} gross`,
    `Commission ${cfg.commissionRateTotal}%: CAD ${commissionCAD.toFixed(2)}`,
    flatFeeWaived
      ? `Flat fee: CAD 0.00 (waived${isFirstTransfer ? ' — first transfer' : promoDescription ? ` — ${promoDescription}` : ''})`
      : `Flat fee: CAD ${flatFeeCAD.toFixed(2)}`,
    ...(expressSurchargeCAD > 0 ? [`Express surcharge: CAD ${expressSurchargeCAD.toFixed(2)}`] : []),
    ...(promoDiscountCAD > 0 ? [`Promo ${promoCodeApplied}: -CAD ${promoDiscountCAD.toFixed(2)}`] : []),
    ...(creditAppliedCAD > 0 ? [`Referral credit: -CAD ${creditAppliedCAD.toFixed(2)}`] : []),
    `Total fees: CAD ${totalFeesCAD.toFixed(2)}`,
    `You receive: CAD ${netAmountCAD.toFixed(2)}`,
  ];

  return {
    amountINR, exchangeRate, grossAmountCAD,
    commissionCAD, repaihubCommissionCAD, partnerCommissionCAD,
    flatFeeCAD, expressSurchargeCAD,
    promoDiscountCAD, promoCodeApplied, promoCodeId, promoDescription, promoError,
    creditAppliedCAD,
    totalFeesCAD, netAmountCAD,
    feeConfigSnapshot,
    breakdown,
  };
}

// ── Promo code validation ─────────────────────────────────────────────────────

interface PromoValidationInput {
  code: string;
  userId: string;
  amountINR: number;
  grossAmountCAD: number;
  isFirstTransfer: boolean;
  flatFeeAlreadyWaived: boolean;
  cfg: FeeConfig;
}

interface PromoValidationResult {
  valid: boolean;
  discountCAD: number;
  wavesFlatFee: boolean;
  promoCodeId: string | null;
  description: string | null;
  error?: string;
}

export async function applyPromoCode(input: PromoValidationInput): Promise<PromoValidationResult> {
  const { code, userId, amountINR, grossAmountCAD, cfg } = input;

  const invalid = (error: string): PromoValidationResult =>
    ({ valid: false, discountCAD: 0, wavesFlatFee: false, promoCodeId: null, description: null, error });

  const { data: promo } = await supabaseAdmin
    .from('promo_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .maybeSingle();

  if (!promo) return invalid('Invalid promo code');

  if (promo.valid_until && new Date(promo.valid_until) < new Date())
    return invalid('This promo code has expired');

  if (new Date(promo.valid_from) > new Date())
    return invalid('This promo code is not yet active');

  if (promo.max_uses_total !== null && promo.uses_count >= promo.max_uses_total)
    return invalid('This promo code has reached its usage limit');

  if (Number(promo.min_amount_inr) > 0 && amountINR < Number(promo.min_amount_inr))
    return invalid(`Minimum transfer of ₹${Number(promo.min_amount_inr).toLocaleString('en-IN')} required`);

  const { count } = await supabaseAdmin
    .from('promo_code_uses')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('promo_code_id', promo.id);

  if ((count ?? 0) >= promo.max_uses_per_user)
    return invalid('You have already used this promo code');

  if (promo.applies_to === 'first_transfer' && !input.isFirstTransfer)
    return invalid('This promo code is only valid on your first transfer');

  let discountCAD = 0;
  let wavesFlatFee = false;

  switch (promo.discount_type) {
    case 'flat_fee_waiver':
    case 'first_transfer_free':
      wavesFlatFee = true;
      discountCAD  = input.flatFeeAlreadyWaived ? 0 : cfg.flatFeeCAD;
      break;
    case 'fixed_cad':
      discountCAD = Math.min(Number(promo.discount_value), grossAmountCAD * 0.5);
      break;
    case 'commission_discount': {
      const commCAD = grossAmountCAD * (cfg.commissionRateTotal / 100);
      discountCAD = Math.round(commCAD * (Number(promo.discount_value) / 100) * 100) / 100;
      break;
    }
  }

  return {
    valid: true,
    discountCAD:  Math.round(discountCAD * 100) / 100,
    wavesFlatFee,
    promoCodeId:  promo.id as string,
    description:  promo.description as string,
  };
}

// ── Post-transfer: record promo use ──────────────────────────────────────────
// Call AFTER transfer is created. Increments use count and writes audit row.

export async function recordPromoCodeUse(
  userId: string,
  promoCodeId: string,
  transferId: string,
  discountApplied: number,
): Promise<void> {
  const { data: promo } = await supabaseAdmin
    .from('promo_codes')
    .select('uses_count')
    .eq('id', promoCodeId)
    .maybeSingle();

  await Promise.all([
    supabaseAdmin.from('promo_code_uses').insert({
      user_id:          userId,
      promo_code_id:    promoCodeId,
      transfer_id:      transferId,
      discount_applied: discountApplied,
    }),
    supabaseAdmin.from('promo_codes').update({
      uses_count: (promo?.uses_count ?? 0) + 1,
    }).eq('id', promoCodeId),
  ]);
}
