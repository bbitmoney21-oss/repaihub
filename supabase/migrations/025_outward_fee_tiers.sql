-- ═══════════════════════════════════════════════════════════════════════════
-- 025 — Outward fee tiers (NRO repatriation slab pricing)
-- ═══════════════════════════════════════════════════════════════════════════
-- Adds a tier-based commission table for OUTWARD (India -> Canada) transfers.
-- Replaces the single flat 1.8% commission previously read from fee_config
-- with a 5-slab structure that scales with transfer size.
--
-- Future rate changes:
--   UPDATE outward_fee_tiers SET commission_rate = 0.0150 WHERE slab_min_inr = 1000001;
-- The next call to feeService picks up the new value (5-min in-memory cache).
--
-- Tier rationale (Option C — see commit message for full reasoning):
--   0     ->  5L   1.80%    no CA needed (Form 145 Part A)
--   5L    -> 10L   2.00%    Form 146 + CA absorbed
--   10L   -> 20L   1.75%    volume nudge starts
--   20L   -> 50L   1.25%    high-net-worth retention; flat fee waived >= 30L
--   50L+         1.00%    concierge tier, flat fee waived
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.outward_fee_tiers (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  slab_min_inr       BIGINT        NOT NULL,                  -- inclusive
  slab_max_inr       BIGINT,                                  -- inclusive; NULL = unbounded
  commission_rate    DECIMAL(6,4)  NOT NULL,                  -- 0.0180 = 1.80%
  flat_fee_cad       DECIMAL(10,2) NOT NULL DEFAULT 24.99,
  waive_flat_fee     BOOLEAN       NOT NULL DEFAULT false,
  flat_fee_waive_above_inr BIGINT,                            -- waive flat when amount >= this; NULL = never
  label              TEXT          NOT NULL,                  -- 'Below ₹5L', '₹50L+', etc.
  is_active          BOOLEAN       NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CHECK (slab_max_inr IS NULL OR slab_max_inr >= slab_min_inr),
  CHECK (commission_rate >= 0 AND commission_rate <= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_outward_fee_tiers_slab
  ON public.outward_fee_tiers(slab_min_inr)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_outward_fee_tiers_active
  ON public.outward_fee_tiers(is_active, slab_min_inr);

-- Seed Option C tiers ────────────────────────────────────────────────────────
INSERT INTO public.outward_fee_tiers
  (slab_min_inr, slab_max_inr, commission_rate, flat_fee_cad, waive_flat_fee, flat_fee_waive_above_inr, label)
VALUES
  (0,         500000,   0.0180, 24.99, false, NULL,    'Up to ₹5L'),
  (500001,    1000000,  0.0200, 24.99, false, NULL,    '₹5L – ₹10L'),
  (1000001,   2000000,  0.0175, 24.99, false, NULL,    '₹10L – ₹20L'),
  (2000001,   5000000,  0.0125, 24.99, false, 3000000, '₹20L – ₹50L'),
  (5000001,   NULL,     0.0100, 0.00,  true,  NULL,    '₹50L and above')
ON CONFLICT DO NOTHING;

-- RLS — public can read tiers (used by /fees/tiers endpoint), service role manages
ALTER TABLE public.outward_fee_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outward_fee_tiers_public_read"  ON public.outward_fee_tiers;
DROP POLICY IF EXISTS "outward_fee_tiers_service_role" ON public.outward_fee_tiers;

CREATE POLICY "outward_fee_tiers_public_read"
  ON public.outward_fee_tiers
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "outward_fee_tiers_service_role"
  ON public.outward_fee_tiers
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
