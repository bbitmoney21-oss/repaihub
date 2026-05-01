-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 013 — DEFINITIVE SELF-CONTAINED SCHEMA
-- Run this ONE file. Safe to re-run. No prior migrations required.
-- Every CREATE uses IF NOT EXISTS. Every INSERT uses ON CONFLICT DO NOTHING.
-- Every ALTER ADD COLUMN uses IF NOT EXISTS.
-- ══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION A: From migration 009 — Risk Engine + Audit Logs
-- (included here because audit_logs and risk_assessments are ALTERed below)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.risk_rules (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  factor      TEXT    UNIQUE NOT NULL,
  weight      INTEGER NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  is_active   BOOLEAN DEFAULT true,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.risk_rules (factor, weight, description) VALUES
  ('amount_low',           10,  'Amount < ₹5L: low base risk'),
  ('amount_medium',        30,  'Amount ₹5L–₹25L: medium base risk'),
  ('amount_high',          60,  'Amount > ₹25L: high base risk'),
  ('new_user',             30,  'Fewer than 3 completed transfers'),
  ('no_history',           20,  'Very first transfer'),
  ('verified_user',       -20,  'Both Canada + India KYC verified'),
  ('high_frequency',       40,  'More than 5 transfers in current calendar month'),
  ('sudden_spike',         30,  'Current amount is >3× user historical average'),
  ('consistent_behavior', -10,  'Regular transfer history (5+ transfers, no spike)'),
  ('missing_docs',         50,  'No required documents provided for this source of funds'),
  ('partial_docs',         25,  'Some required documents missing'),
  ('complete_docs',       -20,  'All required documents provided'),
  ('unknown_source',       40,  'Source is gift or other'),
  ('known_source',          5,  'Source is rental/salary/dividend/pension'),
  ('purpose_safe',          5,  'Purpose: NRO repatriation or family maintenance'),
  ('purpose_risky',        30,  'Purpose: investment abroad or other non-standard'),
  ('tds_valid',           -10,  'TDS deducted and rate is consistent'),
  ('tds_missing',          30,  'TDS expected but not provided'),
  ('tds_mismatch',         50,  'TDS amount inconsistent with transfer amount')
ON CONFLICT (factor) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.compliance_rules (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  source_of_funds TEXT          NOT NULL DEFAULT 'all',
  requires_15ca   BOOLEAN       NOT NULL DEFAULT false,
  requires_15cb   BOOLEAN       NOT NULL DEFAULT false,
  min_amount_inr  DECIMAL(15,2) NOT NULL DEFAULT 0,
  max_amount_inr  DECIMAL(15,2) DEFAULT NULL,
  description     TEXT          NOT NULL DEFAULT '',
  is_active       BOOLEAN       DEFAULT true
);

INSERT INTO public.compliance_rules
  (source_of_funds, requires_15ca, requires_15cb, min_amount_inr, max_amount_inr, description)
VALUES
  ('all', false, false, 0,      499999.99, 'Below ₹5L: no 15CA/15CB required'),
  ('all', true,  true,  500000, NULL,      'At or above ₹5L: 15CA Part C + 15CB mandatory')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.document_requirements (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  source_of_funds TEXT    NOT NULL,
  document_name   TEXT    NOT NULL,
  doc_label       TEXT    NOT NULL,
  is_required     BOOLEAN DEFAULT true,
  is_active       BOOLEAN DEFAULT true,
  UNIQUE(source_of_funds, document_name)
);

INSERT INTO public.document_requirements (source_of_funds, document_name, doc_label) VALUES
  ('rental_income',      'rent_agreement',   'Rent Agreement'),
  ('rental_income',      'form_16a',         'Form 16A (TDS Certificate)'),
  ('rental_income',      'bank_statement',   'Bank Statement (3 months)'),
  ('property_sale',      'sale_deed',        'Sale / Transfer Deed'),
  ('property_sale',      'form_16b',         'Form 16B (TDS Certificate)'),
  ('property_sale',      'bank_statement',   'Bank Statement (3 months)'),
  ('salary_arrears',     'payslips',         'Payslips (3 months)'),
  ('salary_arrears',     'form_16',          'Form 16 (Annual TDS)'),
  ('dividend_income',    'dividend_warrants','Dividend Warrants / Statements'),
  ('dividend_income',    'bank_statement',   'Bank Statement (3 months)'),
  ('pension',            'pension_slip',     'Pension Order / Slip'),
  ('pension',            'bank_statement',   'Bank Statement (3 months)'),
  ('matured_investment', 'investment_proof', 'Investment Certificate / Policy'),
  ('matured_investment', 'bank_statement',   'Bank Statement (3 months)'),
  ('gift_from_relative', 'gift_deed',        'Gift Deed / Declaration'),
  ('gift_from_relative', 'relationship_proof','Proof of Relationship'),
  ('gift_from_relative', 'bank_statement',   'Bank Statement (3 months)')
ON CONFLICT (source_of_funds, document_name) DO NOTHING;

-- risk_assessments: created with ALL columns (009 base + 012 additions)
CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id   UUID    NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  score         INTEGER NOT NULL DEFAULT 0,
  level         TEXT    NOT NULL DEFAULT 'LOW',
  breakdown     JSONB   NOT NULL DEFAULT '{}',
  transfer_type TEXT    DEFAULT 'outward',
  reason        TEXT,
  rules_applied JSONB   DEFAULT '[]',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_transfer ON public.risk_assessments(transfer_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_level    ON public.risk_assessments(level);

CREATE TABLE IF NOT EXISTS public.compliance_checks (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id       UUID    NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  requires_ca       BOOLEAN NOT NULL DEFAULT false,
  requires_15ca     BOOLEAN NOT NULL DEFAULT false,
  requires_15cb     BOOLEAN NOT NULL DEFAULT false,
  missing_documents TEXT[]  DEFAULT '{}',
  status            TEXT    NOT NULL DEFAULT 'PENDING',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_checks_transfer ON public.compliance_checks(transfer_id);

-- audit_logs: created with ALL columns (009 base + 012 additions)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT NOT NULL DEFAULT 'transfer',
  entity_id     UUID,
  action        TEXT NOT NULL,
  actor         TEXT NOT NULL DEFAULT 'system',
  actor_id      UUID,
  metadata      JSONB DEFAULT '{}',
  transfer_id   UUID,
  transfer_type TEXT DEFAULT 'outward',
  user_id       UUID,
  ip_hash       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity  ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action  ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_transfer     ON public.audit_logs(transfer_id);
CREATE INDEX IF NOT EXISTS idx_audit_user         ON public.audit_logs(user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION B: From migration 009 — transfers table risk columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS risk_score        INTEGER       DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_level        TEXT          DEFAULT 'LOW',
  ADD COLUMN IF NOT EXISTS risk_breakdown    JSONB         DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS compliance_status TEXT          DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS ca_required       BOOLEAN       DEFAULT false,
  ADD COLUMN IF NOT EXISTS ca_status         TEXT          DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS tds_deducted      BOOLEAN       DEFAULT false,
  ADD COLUMN IF NOT EXISTS tds_amount_inr    DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fifteen_cb_number TEXT,
  ADD COLUMN IF NOT EXISTS fifteen_ca_number TEXT,
  ADD COLUMN IF NOT EXISTS ca_remarks        TEXT,
  ADD COLUMN IF NOT EXISTS ca_approved_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ca_approved_by    TEXT;

CREATE INDEX IF NOT EXISTS idx_transfers_risk_level  ON public.transfers(risk_level);
CREATE INDEX IF NOT EXISTS idx_transfers_ca_required ON public.transfers(ca_required);
CREATE INDEX IF NOT EXISTS idx_transfers_ca_status   ON public.transfers(ca_status);
CREATE INDEX IF NOT EXISTS idx_transfers_status      ON public.transfers(status);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION C: From migration 010 — KYC config tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS "residencyType"  TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "customerModel"  TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "kycProvider"    TEXT    DEFAULT 'flinks_digilocker',
  ADD COLUMN IF NOT EXISTS "kycStatus"      TEXT    DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "kycSessionId"   TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "kycVerifiedAt"  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "kycExpiresAt"   TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "hasNroAccount"  BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "canadaVerified" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "indiaVerified"  BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.kyc_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.kyc_config (key, value, description) VALUES
  ('active_canada_kyc',       'flinks',     'KYC for Canadian bank: flinks | fable | manual'),
  ('active_india_kyc',        'digilocker', 'KYC for Indian identity: digilocker | fable | manual'),
  ('fable_kyc_enabled',       'false',      'Whether Fable KYC API is active'),
  ('fable_kyc_api_url',       '',           'Fable KYC API base URL'),
  ('fable_aml_screening',     'false',      'Enable Fable AML/sanctions screening'),
  ('kyc_expiry_days',         '730',        'KYC expires after N days'),
  ('require_nro_for_outward', 'true',       'Require NRO account for outward transfers'),
  ('allow_citizen_outward',   'true',       'Allow citizens to do outward if NRO verified')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.customer_model_config (
  residency_type TEXT    PRIMARY KEY,
  can_do_outward BOOLEAN DEFAULT false,
  can_do_inward  BOOLEAN DEFAULT false,
  requires_nro   BOOLEAN DEFAULT false,
  default_model  TEXT    NOT NULL,
  description    TEXT    NOT NULL
);

INSERT INTO public.customer_model_config VALUES
  ('work_permit',        true,  true,  true,  'p2p_nro',     'WP holders — NRO outward + inward'),
  ('permanent_resident', true,  true,  true,  'p2p_nro',     'PR holders — NRO outward + inward'),
  ('visitor',            false, true,  false, 'inward_only', 'Visitors — inward only'),
  ('citizen',            true,  true,  false, 'both',        'Citizens — inward primary + outward if NRO verified'),
  ('other',              false, true,  false, 'inward_only', 'Other status — inward only')
ON CONFLICT (residency_type) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION D: From migration 011 — payment_rails_config + inward tables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_rails_config (
  key          TEXT PRIMARY KEY,
  value        TEXT NOT NULL,
  description  TEXT,
  who_executes TEXT NOT NULL DEFAULT 'Unknown',
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Add who_executes if table existed from a prior partial run without it
ALTER TABLE public.payment_rails_config
  ADD COLUMN IF NOT EXISTS who_executes TEXT NOT NULL DEFAULT 'Unknown';

INSERT INTO public.payment_rails_config (key, value, description, who_executes) VALUES
  ('outward_rail',           'mock', 'NRO/NRE → CAD via AD bank + SWIFT',                        'Fable Fintech (AD bank: Kotak/partner) + SWIFT'),
  ('inward_collection_rail', 'mock', 'CAD collection via Interac e-Transfer or EFT',              'Fable Fintech (Interac/EFT/wire)'),
  ('inward_payout_rail',     'mock', 'INR delivery to Indian bank via IMPS/NEFT/UPI/RTGS',        'Fable Fintech → Nium (IMPS/NEFT/UPI/RTGS)'),
  ('outward_india_rail',     'mock', 'Legacy key — NRO→Canada rail',                              'Fable Fintech'),
  ('inward_canada_collection','mock','Legacy key — CAD collection rail',                           'Fable Fintech'),
  ('inward_india_payout',    'mock', 'Legacy key — INR payout rail',                              'Fable Fintech → Nium'),
  ('nium_enabled',           'false','Whether Nium integration is active',                         'N/A'),
  ('swift_enabled',          'true', 'Whether SWIFT is the fallback corridor',                     'Fable Fintech + SWIFT')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.inward_transfers (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID          NOT NULL,
  reference               TEXT          NOT NULL,
  amount_cad              DECIMAL(15,2) NOT NULL,
  exchange_rate           DECIMAL(10,6) NOT NULL,
  gross_amount_inr        DECIMAL(15,2) NOT NULL,
  fee_cad                 DECIMAL(10,2) DEFAULT 0,
  flat_fee_cad            DECIMAL(10,2) DEFAULT 0,
  commission_cad          DECIMAL(10,2) DEFAULT 0,
  express_surcharge_cad   DECIMAL(10,2) DEFAULT 0,
  total_fees_cad          DECIMAL(10,2) DEFAULT 0,
  net_amount_inr          DECIMAL(15,2) NOT NULL,
  fee_config_snapshot     JSONB         DEFAULT '{}',
  speed                   TEXT          NOT NULL DEFAULT 'standard',
  status                  TEXT          NOT NULL DEFAULT 'initiated',
  priority                TEXT          DEFAULT 'standard',
  risk_level              TEXT          DEFAULT 'LOW',
  risk_reason             TEXT,
  ca_required             BOOLEAN       DEFAULT false,
  ca_blocking             BOOLEAN       DEFAULT false,
  fintrac_required        BOOLEAN       DEFAULT false,
  recipient_name          TEXT          NOT NULL,
  recipient_bank_name     TEXT          NOT NULL,
  recipient_account_last4 TEXT,
  recipient_ifsc          TEXT          NOT NULL,
  recipient_upi           TEXT,
  collection_method       TEXT          DEFAULT 'interac',
  customer_bank_name      TEXT,
  collection_reference    TEXT,
  collection_status       TEXT          DEFAULT 'pending',
  collection_provider     TEXT,
  payout_method           TEXT          DEFAULT 'imps',
  payout_reference        TEXT,
  payout_status           TEXT          DEFAULT 'pending',
  payout_provider         TEXT,
  promo_code_used         TEXT,
  promo_discount_cad      DECIMAL(10,2) DEFAULT 0,
  credit_applied_cad      DECIMAL(10,2) DEFAULT 0,
  compliance_status       TEXT          DEFAULT 'pending',
  fintrac_filed           BOOLEAN       DEFAULT false,
  fintrac_reference       TEXT,
  -- 013 columns included directly
  provider_reference      TEXT,
  adapter_name            TEXT,
  is_mock                 BOOLEAN       DEFAULT true,
  utr                     TEXT,
  rail_used               TEXT,
  payment_received_at     TIMESTAMPTZ,
  customer_bank_token     TEXT,
  purpose                 TEXT,
  notes                   TEXT,
  created_at              TIMESTAMPTZ   DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   DEFAULT NOW(),
  completed_at            TIMESTAMPTZ,
  test_mode               BOOLEAN       DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_inward_user      ON public.inward_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_inward_status    ON public.inward_transfers(status);
CREATE INDEX IF NOT EXISTS idx_inward_created   ON public.inward_transfers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inward_reference ON public.inward_transfers(reference);

CREATE TABLE IF NOT EXISTS public.inward_fee_config (
  key         TEXT          PRIMARY KEY,
  value       DECIMAL(12,4) NOT NULL,
  description TEXT          NOT NULL,
  is_active   BOOLEAN       DEFAULT true,
  updated_at  TIMESTAMPTZ   DEFAULT NOW()
);

INSERT INTO public.inward_fee_config (key, value, description) VALUES
  ('flat_fee_cad',                   1.99,  'Flat fee per inward transfer in CAD (waived >= CAD 500 standard)'),
  ('commission_rate_total',          0,     'FX margin embedded in rate — no separate commission'),
  ('express_surcharge_cad',          1.99,  'Express speed surcharge in CAD'),
  ('first_transfer_flat_fee_waived', 1,     '1=true: waive flat fee for first inward transfer'),
  ('daily_limit_cad',                5000,  'Maximum CAD per day per customer'),
  ('monthly_limit_cad',              20000, 'Maximum CAD per month per customer'),
  ('min_transfer_cad',               50,    'Minimum inward transfer amount in CAD'),
  ('max_transfer_cad',               25000, 'Maximum single inward transfer in CAD'),
  ('free_above_cad_standard',        500,   'No flat fee for standard transfers >= this CAD amount')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.inward_transfer_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.inward_transfers(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  status      TEXT NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inward_events_transfer ON public.inward_transfer_events(transfer_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION E: From migration 012 — risk_config + column additions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.risk_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.risk_config (key, value, description) VALUES
  ('outward_auto_approve_below_inr',    '500000',  'AUTO-APPROVE outward below this INR (15CA Part A)'),
  ('outward_high_risk_first_transfer',  'true',    'First outward transfer always requires CA review'),
  ('outward_trusted_after_n_transfers', '3',       'After N clean transfers CA reviews in parallel only'),
  ('outward_large_transfer_inr',        '5000000', 'Above this INR = MEDIUM risk regardless of history'),
  ('inward_auto_approve_below_cad',     '3000',    'AUTO-APPROVE inward below this CAD amount'),
  ('inward_fintrac_threshold_cad',      '10000',   'FINTRAC required above this CAD (HIGH risk)'),
  ('inward_trusted_after_n_transfers',  '2',       'After N clean inward transfers auto-approve to threshold'),
  ('block_missing_source_of_funds',     'true',    'Block any transfer with missing source_of_funds'),
  ('block_missing_tds_above_inr',       '500000',  'Block outward above this INR if TDS not declared')
ON CONFLICT (key) DO NOTHING;

-- Add 012 columns to risk_assessments (no-op if already created with them above)
ALTER TABLE public.risk_assessments
  ADD COLUMN IF NOT EXISTS transfer_type TEXT  DEFAULT 'outward',
  ADD COLUMN IF NOT EXISTS reason        TEXT,
  ADD COLUMN IF NOT EXISTS rules_applied JSONB DEFAULT '[]';

-- Add 012 columns to audit_logs (no-op if already created with them above)
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS transfer_id   UUID,
  ADD COLUMN IF NOT EXISTS transfer_type TEXT DEFAULT 'outward',
  ADD COLUMN IF NOT EXISTS user_id       UUID,
  ADD COLUMN IF NOT EXISTS ip_hash       TEXT;

-- Add 012 columns to transfers
ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS risk_reason   TEXT,
  ADD COLUMN IF NOT EXISTS ca_blocking   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS transfer_type TEXT    DEFAULT 'outward';


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION F: New in 013 — provider_events, payment_adapter_logs, inward_recipients
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.provider_events (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  provider           TEXT    NOT NULL,
  event_type         TEXT    NOT NULL,
  transfer_id        UUID,
  provider_reference TEXT,
  raw_payload        JSONB   NOT NULL,
  processed          BOOLEAN DEFAULT false,
  processed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_events_idempotency
  ON public.provider_events(provider_reference, event_type)
  WHERE provider_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provider_events_transfer    ON public.provider_events(transfer_id);
CREATE INDEX IF NOT EXISTS idx_provider_events_unprocessed ON public.provider_events(processed) WHERE processed = false;

CREATE TABLE IF NOT EXISTS public.payment_adapter_logs (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_name     TEXT    NOT NULL,
  who_executes     TEXT,
  method           TEXT    NOT NULL,
  transfer_id      UUID,
  request_payload  JSONB,
  response_payload JSONB,
  duration_ms      INTEGER,
  success          BOOLEAN,
  error_message    TEXT,
  is_mock          BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_adapter_logs_transfer ON public.payment_adapter_logs(transfer_id);
CREATE INDEX IF NOT EXISTS idx_payment_adapter_logs_adapter  ON public.payment_adapter_logs(adapter_name);

CREATE TABLE IF NOT EXISTS public.inward_recipients (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name      TEXT    NOT NULL,
  bank_name      TEXT    NOT NULL,
  account_last4  TEXT    NOT NULL,
  ifsc_code      TEXT    NOT NULL,
  relationship   TEXT    NOT NULL DEFAULT 'other',
  is_verified    BOOLEAN DEFAULT false,
  transfer_count INTEGER DEFAULT 0,
  last_used_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inward_recipients_user ON public.inward_recipients(user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION G: New 013 columns on transfers + inward_transfers
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS customer_model     TEXT,
  ADD COLUMN IF NOT EXISTS account_type       TEXT,
  ADD COLUMN IF NOT EXISTS provider_reference TEXT,
  ADD COLUMN IF NOT EXISTS adapter_name       TEXT,
  ADD COLUMN IF NOT EXISTS is_mock            BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS swift_reference    TEXT,
  ADD COLUMN IF NOT EXISTS completed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nro_bank_name      TEXT,
  ADD COLUMN IF NOT EXISTS nro_branch_city    TEXT,
  ADD COLUMN IF NOT EXISTS residency_type     TEXT,
  ADD COLUMN IF NOT EXISTS fifteen_ca_part    TEXT;

-- New 013 columns on inward_transfers (no-op for columns already in CREATE TABLE above)
ALTER TABLE public.inward_transfers
  ADD COLUMN IF NOT EXISTS provider_reference  TEXT,
  ADD COLUMN IF NOT EXISTS adapter_name        TEXT,
  ADD COLUMN IF NOT EXISTS is_mock             BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS utr                 TEXT,
  ADD COLUMN IF NOT EXISTS rail_used           TEXT,
  ADD COLUMN IF NOT EXISTS payment_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_bank_token TEXT,
  ADD COLUMN IF NOT EXISTS purpose             TEXT,
  ADD COLUMN IF NOT EXISTS notes               TEXT;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION H: Backfill
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.transfers
SET
  customer_model = CASE WHEN account_type = 'NRE' THEN 'citizen_nre' ELSE 'p2p' END,
  is_mock = true
WHERE customer_model IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION I: RLS — enable + policies
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.payment_rails_config   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_adapter_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inward_recipients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inward_transfers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inward_fee_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inward_transfer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_config            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_config             ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_payment_rails"    ON public.payment_rails_config;
DROP POLICY IF EXISTS "service_role_provider_events"  ON public.provider_events;
DROP POLICY IF EXISTS "service_role_payment_logs"     ON public.payment_adapter_logs;
DROP POLICY IF EXISTS "service_role_inward"           ON public.inward_transfers;
DROP POLICY IF EXISTS "users_own_inward"              ON public.inward_transfers;
DROP POLICY IF EXISTS "service_role_inward_fee"       ON public.inward_fee_config;
DROP POLICY IF EXISTS "service_role_inward_events"    ON public.inward_transfer_events;
DROP POLICY IF EXISTS "users_own_recipients"          ON public.inward_recipients;
DROP POLICY IF EXISTS "service_role_risk_config"      ON public.risk_config;
DROP POLICY IF EXISTS "service_role_kyc_config"       ON public.kyc_config;

CREATE POLICY "service_role_payment_rails"   ON public.payment_rails_config   FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_provider_events" ON public.provider_events         FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_payment_logs"    ON public.payment_adapter_logs    FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_inward"          ON public.inward_transfers        FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_inward_fee"      ON public.inward_fee_config       FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_inward_events"   ON public.inward_transfer_events  FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_risk_config"     ON public.risk_config             FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_kyc_config"      ON public.kyc_config              FOR ALL TO service_role USING (true);

CREATE POLICY "users_own_recipients" ON public.inward_recipients
  FOR ALL TO authenticated USING (user_id = auth.uid());

CREATE POLICY "users_own_inward" ON public.inward_transfers
  FOR ALL TO authenticated USING (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION J: Auth support tables + missing profiles columns
-- Required by src/routes/auth.ts for login, lockout, KYC, and bank accounts
-- ─────────────────────────────────────────────────────────────────────────────

-- Profiles: lockout + password + residency columns used by auth.ts
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_hash          TEXT,
  ADD COLUMN IF NOT EXISTS failed_login_attempts  INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS referred_by_code       TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_hash       TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expiry     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS residency              TEXT;

-- kyc_submissions: used by auth login + /auth/me to return verification status
CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canada_verified BOOLEAN DEFAULT false,
  india_verified  BOOLEAN DEFAULT false,
  kyc_verified_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user ON public.kyc_submissions(user_id);

-- canada_bank_accounts: Canadian bank linked by customer (institution, holder, type)
CREATE TABLE IF NOT EXISTS public.canada_bank_accounts (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution  TEXT    NOT NULL,
  holder_name  TEXT    NOT NULL,
  account_type TEXT    NOT NULL DEFAULT 'chequing',
  is_verified  BOOLEAN DEFAULT false,
  is_primary   BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canada_bank_user ON public.canada_bank_accounts(user_id);

-- india_nro_accounts: Indian NRO account linked by customer
CREATE TABLE IF NOT EXISTS public.india_nro_accounts (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name   TEXT    NOT NULL,
  branch      TEXT,
  account_no  TEXT,
  ifsc_code   TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_primary  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_india_nro_user ON public.india_nro_accounts(user_id);

-- RLS for auth support tables
ALTER TABLE public.kyc_submissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canada_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.india_nro_accounts   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_kyc_submissions"      ON public.kyc_submissions;
DROP POLICY IF EXISTS "service_role_canada_bank_accounts" ON public.canada_bank_accounts;
DROP POLICY IF EXISTS "service_role_india_nro_accounts"   ON public.india_nro_accounts;
DROP POLICY IF EXISTS "users_own_kyc"                     ON public.kyc_submissions;
DROP POLICY IF EXISTS "users_own_canada_bank"             ON public.canada_bank_accounts;
DROP POLICY IF EXISTS "users_own_india_nro"               ON public.india_nro_accounts;

CREATE POLICY "service_role_kyc_submissions"      ON public.kyc_submissions      FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_canada_bank_accounts" ON public.canada_bank_accounts FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_india_nro_accounts"   ON public.india_nro_accounts   FOR ALL TO service_role USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- DONE. To activate real Fable when API keys arrive (zero code changes):
-- UPDATE public.payment_rails_config SET value = 'fable'
--   WHERE key IN ('outward_rail', 'inward_collection_rail', 'inward_payout_rail');
-- ─────────────────────────────────────────────────────────────────────────────
