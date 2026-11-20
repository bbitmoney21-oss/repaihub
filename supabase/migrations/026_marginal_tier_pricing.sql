-- ═══════════════════════════════════════════════════════════════════════════
-- 026 — Marginal tier pricing with Express tiers (decided 2026-11-20)
-- ═══════════════════════════════════════════════════════════════════════════
-- Decision: repaihub-agent-team/results/finance/pricing-decision-2026-11-20.md
--   Standard (5 days):  ≤₹5L CAD 9.99 + 1.05% · ₹5–25L CAD 14.99 + 1.20% · >₹25L CAD 24.99 + 1.22%
--   Express  (3 days):  ≤₹5L CAD 10.99 + 1.17% · ₹5–25L CAD 15.99 + 1.22% · >₹25L CAD 29.99 + 1.18%
-- Markups are MARGINAL (each rate applies only to the part of the amount in
-- its band). Base fee = the base of the band the amount falls in.
-- Calculated by src/lib/outwardPricing.ts via src/services/feeService.ts.
--
-- Non-destructive: adds two nullable columns, deactivates (does not delete)
-- the previous tier rows, and inserts the new ones. Express is priced in the
-- tiers, so the separate express surcharge is set to 0.
-- Rollback: 026_marginal_tier_pricing.rollback.sql
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.outward_fee_tiers
  ADD COLUMN IF NOT EXISTS express_commission_rate DECIMAL(6,4),
  ADD COLUMN IF NOT EXISTS express_flat_fee_cad    DECIMAL(10,2);

UPDATE public.outward_fee_tiers SET is_active = false, updated_at = NOW() WHERE is_active = true;

INSERT INTO public.outward_fee_tiers
  (slab_min_inr, slab_max_inr, commission_rate, flat_fee_cad, express_commission_rate, express_flat_fee_cad, waive_flat_fee, flat_fee_waive_above_inr, label, is_active)
VALUES
  (0,       500000,  0.0105,  9.99, 0.0117, 10.99, false, NULL, 'Up to ₹5 lakh',       true),
  (500001,  2500000, 0.0120, 14.99, 0.0122, 15.99, false, NULL, '₹5 lakh – ₹25 lakh',  true),
  (2500001, NULL,    0.0122, 24.99, 0.0118, 29.99, false, NULL, 'Above ₹25 lakh',      true);

UPDATE public.fee_config SET value = 0, updated_at = NOW(), updated_by = 'pricing-decision-2026-11-20'
 WHERE key = 'express_surcharge_cad';
