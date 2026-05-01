-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 016 — Form 15CA/15CB renamed to Form 145/146
-- RUN IN SUPABASE SQL EDITOR MANUALLY
-- ═══════════════════════════════════════════════════════════════════════════
-- LEGAL: India Income Tax Act 2025 came into force on 1 April 2026.
-- Form 15CA → Form 145 (same purpose: remitter self-declaration)
-- Form 15CB → Form 146 (same purpose: CA certificate)
-- Section 195 → Section 397(3)(d)
-- Thresholds unchanged: Part A below ₹5L, Part C above ₹5L
-- DTAA applicability unchanged.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── TABLE: transfers ─────────────────────────────────────────────────────────

-- Add new columns (old columns kept for backward compat during transition)
ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS form145_part        TEXT,
  ADD COLUMN IF NOT EXISTS form146_required    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS form146_number      TEXT,
  ADD COLUMN IF NOT EXISTS form145_number      TEXT,
  ADD COLUMN IF NOT EXISTS indicative_rate     NUMERIC(20, 8),
  ADD COLUMN IF NOT EXISTS final_execution_rate NUMERIC(20, 8),
  ADD COLUMN IF NOT EXISTS idempotency_key     TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS tax_act_version     TEXT DEFAULT '2025';

-- Unique constraint on idempotency_key per user (prevents duplicate transfers)
CREATE UNIQUE INDEX IF NOT EXISTS transfers_idempotency_key_user_id_idx
  ON public.transfers (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Copy old column values into new columns
UPDATE public.transfers
  SET form145_part     = fifteen_ca_part,
      form146_required = (fifteen_ca_part = 'C'),
      form146_number   = fifteen_cb_number,
      form145_number   = fifteen_ca_number,
      indicative_rate  = exchange_rate,
      tax_act_version  = CASE
        WHEN created_at >= '2026-04-01' THEN '2025'
        ELSE '1961'
      END
  WHERE form145_part IS NULL;

-- Update status values from old to new naming
UPDATE public.transfers
  SET status = 'form146_requested'
  WHERE status = '15cb_requested';

UPDATE public.transfers
  SET status = 'form146_received'
  WHERE status = '15cb_received';

UPDATE public.transfers
  SET status = 'form145_filed'
  WHERE status = '15ca_filed';

-- ── TABLE: compliance_requests ────────────────────────────────────────────────

ALTER TABLE public.compliance_requests
  ADD COLUMN IF NOT EXISTS form145_part     TEXT,
  ADD COLUMN IF NOT EXISTS form146_required BOOLEAN DEFAULT false;

UPDATE public.compliance_requests
  SET form145_part     = fifteen_ca_part,
      form146_required = COALESCE(fifteen_cb_required, false)
  WHERE form145_part IS NULL;

-- ── TABLE: transfer_events ────────────────────────────────────────────────────

UPDATE public.transfer_events
  SET status = 'form146_requested'
  WHERE status = '15cb_requested';

UPDATE public.transfer_events
  SET status = 'form146_received'
  WHERE status = '15cb_received';

UPDATE public.transfer_events
  SET status = 'form145_filed'
  WHERE status = '15ca_filed';

-- ── Confirmation ──────────────────────────────────────────────────────────────
SELECT
  'Migration 016 complete' AS status,
  COUNT(*) FILTER (WHERE status = 'form146_requested') AS form146_requested_count,
  COUNT(*) FILTER (WHERE status = 'form146_received')  AS form146_received_count,
  COUNT(*) FILTER (WHERE status = 'form145_filed')     AS form145_filed_count,
  COUNT(*) FILTER (WHERE tax_act_version = '2025')     AS act_2025_transfers,
  COUNT(*) FILTER (WHERE tax_act_version = '1961')     AS act_1961_transfers
FROM public.transfers;
