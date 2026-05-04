import { Router } from 'express';
import { getOutwardFeeTiers, getFeeConfig } from '../services/feeService';

/**
 * Public fee-rate endpoints.  No auth — these power the marketing /app/fees
 * page and the live tier preview inside the New Transfer flow, both of which
 * may render before a user is signed in (e.g. in a pre-signup landing).
 *
 * The data is read-only here; admins update rates by editing
 * `outward_fee_tiers` directly in Supabase.  See migration 025 for the
 * SQL UPDATE pattern.
 */
const router = Router();
const ts = () => new Date().toISOString();

// ── GET /fees/tiers ───────────────────────────────────────────────────────────
router.get('/tiers', async (_req, res) => {
  try {
    const tiers = await getOutwardFeeTiers();
    const cfg   = await getFeeConfig();

    res.json({
      direction: 'outward',
      currency:  'INR',
      tiers: tiers.map(t => ({
        slabMinInr:           t.slabMinInr,
        slabMaxInr:           t.slabMaxInr,        // null = unbounded (top tier)
        commissionRate:       t.commissionRate,    // fraction, 0.018 = 1.8%
        commissionPct:        Math.round(t.commissionRate * 10000) / 100, // 1.80
        flatFeeCAD:           t.flatFeeCAD,
        waiveFlatFee:         t.waiveFlatFee,
        flatFeeWaiveAboveInr: t.flatFeeWaiveAboveInr,
        label:                t.label,
      })),
      // Surcharge applied on top of any tier when speed='express'.  Sourced
      // from fee_config so admins keep one place to edit it.
      expressSurchargeCAD:    cfg.expressSurchargeCAD,
      // Inward (Canada -> India) is a flat-rule, not slab-based — surface it
      // here too so the public /fees page can render it inline.
      inward: {
        smallTransferFeeCAD: 1.99,
        freeAboveCAD:        500,
        note:                'Inward profit comes from FX spread; \\$1.99 charged ON TOP only when amount < CAD 500.',
      },
      timestamp: ts(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to load fee tiers';
    console.error('[GET /fees/tiers] error:', msg);
    res.status(500).json({ error: msg, timestamp: ts() });
  }
});

export default router;
