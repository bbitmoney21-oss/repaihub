-- RUN THIS FILE MANUALLY IN SUPABASE SQL EDITOR
-- Migration 009 — Risk Engine, Compliance Engine, Audit Logging
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT DO NOTHING throughout)

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: risk_rules
-- Stores weights for every risk factor. Change weights here to tune scoring.
-- positive weight = increases risk score, negative = reduces it.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.risk_rules (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  factor      TEXT    UNIQUE NOT NULL,
  weight      INTEGER NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  is_active   BOOLEAN DEFAULT true,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.risk_rules (factor, weight, description) VALUES
  -- Amount factors (exactly one is applied per transfer)
  ('amount_low',            10,  'Amount < ₹5L: low base risk'),
  ('amount_medium',         30,  'Amount ₹5L–₹25L: medium base risk'),
  ('amount_high',           60,  'Amount > ₹25L: high base risk'),

  -- User history factors (may stack)
  ('new_user',              30,  'Fewer than 3 completed transfers'),
  ('no_history',            20,  'Very first transfer (additive with new_user)'),
  ('verified_user',        -20,  'Both Canada + India KYC verified'),

  -- Behavioral factors
  ('high_frequency',        40,  'More than 5 transfers in current calendar month'),
  ('sudden_spike',          30,  'Current amount is >3× user historical average'),
  ('consistent_behavior',  -10,  'Regular transfer history (5+ transfers, no spike)'),

  -- Document completeness factors (exactly one applied)
  ('missing_docs',          50,  'No required documents provided for this source of funds'),
  ('partial_docs',          25,  'Some required documents missing'),
  ('complete_docs',        -20,  'All required documents provided'),

  -- Source of funds factors (exactly one applied)
  ('unknown_source',        40,  'Source is gift or other — hard to independently verify'),
  ('known_source',           5,  'Source is rental/salary/dividend/pension — verifiable'),

  -- Purpose code factors (exactly one applied)
  ('purpose_safe',           5,  'Purpose: NRO repatriation or family maintenance'),
  ('purpose_risky',         30,  'Purpose: investment abroad or other non-standard'),

  -- TDS factors (exactly one applied, or none if TDS not applicable)
  ('tds_valid',            -10,  'TDS deducted and rate is consistent with transfer amount'),
  ('tds_missing',           30,  'TDS expected for this source of funds but not provided'),
  ('tds_mismatch',          50,  'TDS amount appears inconsistent with transfer amount')
ON CONFLICT (factor) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: compliance_rules
-- Determines 15CA/15CB requirements based on amount thresholds.
-- Change min_amount_inr here if RBI threshold changes. No code changes needed.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.compliance_rules (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_of_funds TEXT        NOT NULL DEFAULT 'all',
  requires_15ca   BOOLEAN     NOT NULL DEFAULT false,
  requires_15cb   BOOLEAN     NOT NULL DEFAULT false,
  min_amount_inr  DECIMAL(15,2) NOT NULL DEFAULT 0,
  max_amount_inr  DECIMAL(15,2) DEFAULT NULL,  -- NULL = no upper limit
  description     TEXT        NOT NULL DEFAULT '',
  is_active       BOOLEAN     DEFAULT true
);

INSERT INTO public.compliance_rules
  (source_of_funds, requires_15ca, requires_15cb, min_amount_inr, max_amount_inr, description)
VALUES
  ('all', false, false, 0,      499999.99, 'Below ₹5L: no 15CA/15CB required per FEMA/RBI rules'),
  ('all', true,  true,  500000, NULL,      'At or above ₹5L: 15CA Part C + 15CB mandatory')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: document_requirements
-- Lists required documents per source_of_funds.
-- Add rows here to add new doc requirements for new sources. No code changes.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.document_requirements (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  source_of_funds TEXT    NOT NULL,
  document_name   TEXT    NOT NULL,  -- machine key used in API (e.g. 'rent_agreement')
  doc_label       TEXT    NOT NULL,  -- human display label
  is_required     BOOLEAN DEFAULT true,
  is_active       BOOLEAN DEFAULT true,
  UNIQUE(source_of_funds, document_name)
);

INSERT INTO public.document_requirements
  (source_of_funds, document_name, doc_label, is_required)
VALUES
  -- Rental income
  ('rental_income',      'rent_agreement',  'Rent Agreement',           true),
  ('rental_income',      'form_16a',        'Form 16A (TDS Certificate)',true),
  ('rental_income',      'bank_statement',  'Bank Statement (3 months)', true),

  -- Property sale
  ('property_sale',      'sale_deed',       'Sale / Transfer Deed',     true),
  ('property_sale',      'form_16b',        'Form 16B (TDS Certificate)',true),
  ('property_sale',      'bank_statement',  'Bank Statement (3 months)', true),

  -- Salary arrears
  ('salary_arrears',     'payslips',        'Payslips (3 months)',       true),
  ('salary_arrears',     'form_16',         'Form 16 (Annual TDS)',      true),

  -- Dividend income
  ('dividend_income',    'dividend_warrants','Dividend Warrants / Statements',true),
  ('dividend_income',    'bank_statement',  'Bank Statement (3 months)', true),

  -- Pension
  ('pension',            'pension_slip',    'Pension Order / Slip',      true),
  ('pension',            'bank_statement',  'Bank Statement (3 months)', true),

  -- Matured investment
  ('matured_investment', 'investment_proof','Investment Certificate / Policy',true),
  ('matured_investment', 'bank_statement',  'Bank Statement (3 months)', true),

  -- Gift from relative
  ('gift_from_relative', 'gift_deed',       'Gift Deed / Declaration',  true),
  ('gift_from_relative', 'relationship_proof','Proof of Relationship',  true),
  ('gift_from_relative', 'bank_statement',  'Bank Statement (3 months)', true)
ON CONFLICT (source_of_funds, document_name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: risk_assessments
-- Records every risk evaluation for full auditability.
-- Never update rows — append only.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID    NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  score       INTEGER NOT NULL,
  level       TEXT    NOT NULL CHECK (level IN ('LOW','MEDIUM','HIGH')),
  breakdown   JSONB   NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_transfer ON public.risk_assessments(transfer_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_level    ON public.risk_assessments(level);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: compliance_checks
-- Records every compliance evaluation. Append only.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.compliance_checks (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id         UUID    NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  requires_ca         BOOLEAN NOT NULL DEFAULT false,
  requires_15ca       BOOLEAN NOT NULL DEFAULT false,
  requires_15cb       BOOLEAN NOT NULL DEFAULT false,
  missing_documents   TEXT[]  DEFAULT '{}',
  status              TEXT    NOT NULL DEFAULT 'PENDING',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_checks_transfer ON public.compliance_checks(transfer_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: audit_logs
-- Immutable append-only log of every significant system event.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,           -- 'transfer', 'compliance_request', 'ca_action'
  entity_id   UUID,
  action      TEXT NOT NULL,           -- 'initiated', 'risk_assessed', 'ca_approved', etc.
  actor       TEXT NOT NULL DEFAULT 'system',  -- 'system', 'ca_partner', 'customer'
  actor_id    UUID,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity    ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action    ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created   ON public.audit_logs(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- UPDATE transfers TABLE — add risk + compliance tracking columns
-- (All IF NOT EXISTS — safe to run repeatedly)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.transfers
  -- Risk engine outputs
  ADD COLUMN IF NOT EXISTS risk_score         INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_level         TEXT        DEFAULT 'LOW',
  ADD COLUMN IF NOT EXISTS risk_breakdown     JSONB       DEFAULT '{}',

  -- Decision engine outputs
  ADD COLUMN IF NOT EXISTS compliance_status  TEXT        DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS ca_required        BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS ca_status          TEXT        DEFAULT 'NOT_REQUIRED',

  -- TDS inputs (collected at initiation)
  ADD COLUMN IF NOT EXISTS tds_deducted       BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS tds_amount_inr     DECIMAL(15,2) DEFAULT 0,

  -- CA action fields (if not added by migration 003)
  ADD COLUMN IF NOT EXISTS fifteen_cb_number  TEXT,
  ADD COLUMN IF NOT EXISTS fifteen_ca_number  TEXT,
  ADD COLUMN IF NOT EXISTS ca_remarks         TEXT,
  ADD COLUMN IF NOT EXISTS ca_approved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ca_approved_by     TEXT,

  -- Completion tracking (used in dev auto-progression)
  ADD COLUMN IF NOT EXISTS completed_at       TIMESTAMPTZ;

-- Indexes for CA dashboard queries
CREATE INDEX IF NOT EXISTS idx_transfers_risk_level   ON public.transfers(risk_level);
CREATE INDEX IF NOT EXISTS idx_transfers_ca_required  ON public.transfers(ca_required);
CREATE INDEX IF NOT EXISTS idx_transfers_ca_status    ON public.transfers(ca_status);
