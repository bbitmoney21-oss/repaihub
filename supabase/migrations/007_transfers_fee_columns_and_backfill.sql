-- Migration 007 — Fee columns on transfers + backfill compliance_requests
-- Run in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS / ON CONFLICT).

-- ── 1. Fee columns on transfers ───────────────────────────────────────────────
ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS commission_cad      DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS repaihub_commission DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS partner_commission  DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS flat_fee_cad        DECIMAL(12,2) DEFAULT 25.00,
  ADD COLUMN IF NOT EXISTS total_fees_cad      DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS net_amount_cad      DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS test_mode           BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Backfill compliance_requests for transfers that don't have one ─────────
-- This fixes all transfers initiated before migration 005 was run,
-- or before the auto-create code was deployed.
INSERT INTO public.compliance_requests (
  transfer_id,
  user_id,
  status,
  fifteen_ca_part,
  fifteen_cb_required
)
SELECT
  t.id,
  t.user_id,
  'pending',
  CASE WHEN t.amount_inr <= 500000 THEN 'A' ELSE 'C' END,
  CASE WHEN t.amount_inr > 500000 THEN TRUE ELSE FALSE END
FROM public.transfers t
WHERE NOT EXISTS (
  SELECT 1 FROM public.compliance_requests cr WHERE cr.transfer_id = t.id
)
ON CONFLICT (transfer_id) DO NOTHING;
