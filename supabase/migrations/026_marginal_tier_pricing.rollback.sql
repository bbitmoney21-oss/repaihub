-- Rollback for 026 — restores the flat CAD 79 / 199 / 499 tiers (2026-11-19) and the CAD 24 express surcharge.
UPDATE public.outward_fee_tiers SET is_active = false, updated_at = NOW()
 WHERE is_active = true AND express_flat_fee_cad IS NOT NULL;
UPDATE public.outward_fee_tiers SET is_active = true, updated_at = NOW()
 WHERE id IN (
   SELECT DISTINCT ON (slab_min_inr) id FROM public.outward_fee_tiers
    WHERE express_flat_fee_cad IS NULL AND commission_rate = 0
    ORDER BY slab_min_inr, updated_at DESC);
UPDATE public.fee_config SET value = 24, updated_at = NOW(), updated_by = 'rollback-026' WHERE key = 'express_surcharge_cad';
-- The added columns are left in place (nullable, harmless).
