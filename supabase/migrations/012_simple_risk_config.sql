-- RUN THIS ENTIRE FILE IN SUPABASE SQL EDITOR MANUALLY
-- Migration 012 — Simplified Risk Engine + Audit Enhancements
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT DO NOTHING throughout)
--
-- NOTE: This replaces the weighted risk_rules table with a plain-English
-- config-driven approach. The old tables are left intact for backward
-- compatibility with any existing data. To clean them up after verifying
-- the new system works, run the OPTIONAL DROP statements at the bottom.

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: risk_config
-- Simple key-value config for risk thresholds.
-- Every rule maps directly to a plain-English business rule.
-- Edit values here — no code changes needed.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.risk_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.risk_config (key, value, description) VALUES
  -- Outward (NRO→Canada) risk thresholds
  ('outward_auto_approve_below_inr',    '500000',   'AUTO-APPROVE outward if below this INR amount (15CA Part A)'),
  ('outward_high_risk_first_transfer',  'true',     'First outward transfer always requires CA review (HIGH risk)'),
  ('outward_trusted_after_n_transfers', '3',        'After N clean outward transfers CA reviews in parallel only'),
  ('outward_large_transfer_inr',        '5000000',  'Transfers above this INR are MEDIUM risk regardless of history'),

  -- Inward (CAD→INR) risk thresholds
  ('inward_auto_approve_below_cad',     '3000',     'AUTO-APPROVE inward if below this CAD amount'),
  ('inward_fintrac_threshold_cad',      '10000',    'FINTRAC report required above this CAD amount (HIGH risk)'),
  ('inward_trusted_after_n_transfers',  '2',        'After N clean inward transfers auto-approve up to threshold'),

  -- Blocking rules
  ('block_missing_source_of_funds',     'true',     'Block any transfer with missing source_of_funds'),
  ('block_missing_tds_above_inr',       '500000',   'Block outward above this INR if TDS not declared')
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Extend risk_assessments table with new simplified engine columns
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.risk_assessments
  ADD COLUMN IF NOT EXISTS transfer_type  TEXT DEFAULT 'outward',
  ADD COLUMN IF NOT EXISTS reason         TEXT,
  ADD COLUMN IF NOT EXISTS rules_applied  JSONB DEFAULT '[]';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Extend transfers table with new risk + blocking columns
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS risk_reason    TEXT,
  ADD COLUMN IF NOT EXISTS ca_blocking    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS transfer_type  TEXT DEFAULT 'outward';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Extend audit_logs table to support new auditService schema
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS transfer_id    UUID,
  ADD COLUMN IF NOT EXISTS transfer_type  TEXT DEFAULT 'outward',
  ADD COLUMN IF NOT EXISTS user_id        UUID,
  ADD COLUMN IF NOT EXISTS ip_hash        TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_transfer ON public.audit_logs(transfer_id);
CREATE INDEX IF NOT EXISTS idx_audit_user     ON public.audit_logs(user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Add PENDING_REVIEW to transfers status index for CA dashboard queries
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_transfers_status ON public.transfers(status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- OPTIONAL: Clean up old weighted-risk tables after verifying new system works.
-- Uncomment and run ONLY after the new risk_config system is live and tested.
-- ═══════════════════════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS public.risk_rules;
-- DROP TABLE IF EXISTS public.compliance_rules;
-- DROP TABLE IF EXISTS public.document_requirements;
