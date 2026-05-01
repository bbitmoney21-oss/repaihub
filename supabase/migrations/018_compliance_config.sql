-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 018 — compliance_config table
-- RUN IN SUPABASE SQL EDITOR MANUALLY
-- ═══════════════════════════════════════════════════════════════════════════
-- Stores IT Act 2025 thresholds and form processing configuration.
-- Referenced by complianceConfigService (future) and compliance engine.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.compliance_config (
  key         TEXT        PRIMARY KEY,
  value       TEXT        NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.compliance_config (key, value, description) VALUES
  ('form145_threshold_inr',     '500000',   'Amount above which Form 145 Part C is required (₹5L — IT Act 2025 s.397(3)(d))'),
  ('form146_required_above',    '500000',   'Amount above which Form 146 (CA certificate) is required from CA partner'),
  ('fema_yearly_limit_usd',     '1000000',  'FEMA annual remittance limit per person (USD 1M = ₹8.3 Cr at Rs 83/USD)'),
  ('fema_yearly_limit_inr',     '83000000', 'FEMA annual remittance limit in INR (USD 1M at Rs 83/USD)'),
  ('swift_processing_days',     '2',        'Typical SWIFT processing time in business days'),
  ('form145_filing_mode',       'online',   'Form 145 filing mode: online | manual'),
  ('ca_approval_timeout_hours', '48',       'Hours before CA approval reminder is sent to CA partner'),
  ('fintrac_threshold_cad',     '10000',    'FINTRAC large cash transaction reporting threshold in CAD'),
  ('nre_exemption_enabled',     'true',     'NRE transfers are exempt from Form 145/146 (funds already taxed in Canada)'),
  ('part_a_auto_file',          'true',     'Part A transfers (below ₹5L) are filed automatically without CA review'),
  ('tax_act_version',           '2025',     'Active Income Tax Act version: 1961 (old) | 2025 (new, effective 1 Apr 2026)')
ON CONFLICT (key) DO NOTHING;

-- ── Confirmation ──────────────────────────────────────────────────────────────
SELECT 'Migration 018 complete' AS status, COUNT(*) AS compliance_config_rows
FROM public.compliance_config;
