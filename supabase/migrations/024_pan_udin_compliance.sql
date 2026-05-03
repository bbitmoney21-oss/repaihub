-- Migration 024 — PAN collection + UDIN compliance fields
-- Adds: pan_number to profiles, udin to compliance_requests
-- Safe to run multiple times (IF NOT EXISTS guards).
-- RUN IN SUPABASE SQL EDITOR.

-- ── Add pan_number to profiles ────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pan_number TEXT;

-- ── Add UDIN to compliance_requests ──────────────────────────────────────────
-- UDIN (Unique Document Identification Number) is the 18-digit code issued by
-- the ICAI portal after a CA certifies Form 146. Required for audit trail.
ALTER TABLE public.compliance_requests
  ADD COLUMN IF NOT EXISTS udin TEXT;

-- ── Index on pan_number for fast KYC lookups ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_pan_number
  ON public.profiles (pan_number)
  WHERE pan_number IS NOT NULL;

SELECT
  'Migration 024 complete' AS status,
  (SELECT COUNT(*) FROM public.profiles WHERE pan_number IS NOT NULL) AS profiles_with_pan,
  (SELECT COUNT(*) FROM public.compliance_requests WHERE udin IS NOT NULL) AS requests_with_udin;
