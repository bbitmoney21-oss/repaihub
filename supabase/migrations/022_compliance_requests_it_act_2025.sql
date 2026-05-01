-- Migration 022 — compliance_requests: IT Act 2025 column aliases + backfill
-- Safe to run multiple times (IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- RUN IN SUPABASE SQL EDITOR.

-- ── Add missing columns to compliance_requests ────────────────────────────────
ALTER TABLE public.compliance_requests
  ADD COLUMN IF NOT EXISTS form145_part        TEXT,
  ADD COLUMN IF NOT EXISTS form146_required    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS form145_number      TEXT,
  ADD COLUMN IF NOT EXISTS form146_number      TEXT;

-- ── Backfill from existing fifteen_ca_* columns ───────────────────────────────
UPDATE public.compliance_requests
SET
  form145_part     = fifteen_ca_part,
  form146_required = COALESCE(fifteen_cb_required, false),
  form145_number   = fifteen_ca_number,
  form146_number   = fifteen_cb_number
WHERE form145_part IS NULL;

-- ── Auto-create compliance_request for the ₹6L transfer that missed it ────────
-- Insert any transfer that has no matching compliance_request yet.
INSERT INTO public.compliance_requests (transfer_id, user_id, status, fifteen_ca_part, fifteen_cb_required, form145_part, form146_required)
SELECT
  t.id,
  t.user_id,
  CASE
    WHEN t.risk_level = 'HIGH' THEN 'pending'
    WHEN t.ca_required = true  THEN 'under_review'
    ELSE 'approved'
  END,
  COALESCE(t.form145_part, t.fifteen_ca_part, 'C'),
  t.amount_inr >= 500000,
  COALESCE(t.form145_part, t.fifteen_ca_part, 'C'),
  t.amount_inr >= 500000
FROM public.transfers t
WHERE NOT EXISTS (
  SELECT 1 FROM public.compliance_requests cr WHERE cr.transfer_id = t.id
)
AND t.amount_inr IS NOT NULL;

SELECT
  'Migration 022 complete' AS status,
  COUNT(*) AS compliance_requests_total
FROM public.compliance_requests;
