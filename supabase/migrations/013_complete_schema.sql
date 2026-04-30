-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 013 — Complete self-contained schema (run this ONE file)
-- Safe to re-run: every statement uses IF NOT EXISTS / ON CONFLICT DO NOTHING
-- Includes everything from migrations 010, 011, 012 plus new 013 additions
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 010: profiles columns ────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS "residencyType"   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "customerModel"   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "kycProvider"     TEXT DEFAULT 'flinks_digilocker',
  ADD COLUMN IF NOT EXISTS "kycStatus"       TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "kycSessionId"    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "kycVerifiedAt"   TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "kycExpiresAt"    TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "hasNroAccount"   BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "canadaVerified"  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "indiaVerified"   BOOLEAN DEFAULT false;

-- ── 010: kyc_config ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.kyc_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.kyc_config (key, value, description) VALUES
  ('active_canada_kyc',       'flinks',       'KYC for Canadian bank verification: flinks | fable | manual'),
  ('active_india_kyc',        'digilocker',   'KYC for Indian identity: digilocker | fable | manual'),
  ('fable_kyc_enabled',       'false',        'Whether Fable KYC compliance API is active'),
  ('fable_kyc_api_url',       '',             'Fable KYC API base URL when enabled'),
  ('fable_aml_screening',     'false',        'Enable Fable AML/sanctions screening'),
  ('kyc_expiry_days',         '730',          'KYC expires after N days (730 = 2 years)'),
  ('require_nro_for_outward', 'true',         'Require NRO account verification for outward transfers'),
  ('allow_citizen_outward',   'true',         'Allow Canadian citizens to do outward if they have NRO account')
ON CONFLICT (key) DO NOTHING;

-- ── 010: customer_model_config ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.customer_model_config (
  residency_type TEXT PRIMARY KEY,
  can_do_outward BOOLEAN DEFAULT false,
  can_do_inward  BOOLEAN DEFAULT false,
  requires_nro   BOOLEAN DEFAULT false,
  default_model  TEXT NOT NULL,
  description    TEXT NOT NULL
);

INSERT INTO public.customer_model_config VALUES
  ('work_permit',        true,  true,  true,  'p2p_nro',     'WP holders — full NRO outward + inward via Fable/P2P'),
  ('permanent_resident', true,  true,  true,  'p2p_nro',     'PR holders — full NRO outward + inward via Fable/P2P'),
  ('visitor',            false, true,  false, 'inward_only', 'Visitors — inward only, no NRO outward'),
  ('citizen',            true,  true,  false, 'both',        'Citizens — inward primary + outward if NRO verified'),
  ('other',              false, true,  false, 'inward_only', 'Other status — inward only by default')
ON CONFLICT (residency_type) DO NOTHING;


-- ── 011 + 013: payment_rails_config (with who_executes) ───────────────────────

CREATE TABLE IF NOT EXISTS public.payment_rails_config (
  key          TEXT PRIMARY KEY,
  value        TEXT NOT NULL,
  description  TEXT,
  who_executes TEXT NOT NULL DEFAULT 'Unknown',
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Add who_executes if table already existed from 011 (without that column)
ALTER TABLE public.payment_rails_config
  ADD COLUMN IF NOT EXISTS who_executes TEXT NOT NULL DEFAULT 'Unknown';

INSERT INTO public.payment_rails_config (key, value, description, who_executes) VALUES
  ('outward_rail',            'mock', 'NRO/NRE → CAD. AD bank debits Indian account → SWIFT to Canada',      'Fable Fintech (AD bank: Kotak/partner) + SWIFT'),
  ('inward_collection_rail',  'mock', 'Canadian CAD collection via Interac e-Transfer or EFT',               'Fable Fintech (Interac/EFT/wire)'),
  ('inward_payout_rail',      'mock', 'INR delivery to recipient Indian bank via IMPS/NEFT/UPI/RTGS',        'Fable Fintech → Nium (IMPS/NEFT/UPI/RTGS)')
ON CONFLICT (key) DO NOTHING;

-- Legacy keys from 011 (kept for backward compat)
INSERT INTO public.payment_rails_config (key, value, description, who_executes) VALUES
  ('outward_india_rail',       'mock', 'Legacy: NRO→Canada rail',                  'Fable Fintech'),
  ('inward_canada_collection', 'mock', 'Legacy: CAD collection rail',              'Fable Fintech'),
  ('inward_india_payout',      'mock', 'Legacy: INR payout rail',                  'Fable Fintech → Nium'),
  ('nium_enabled',             'false','Whether Nium integration is active',        'N/A'),
  ('swift_enabled',            'true', 'Whether SWIFT is the fallback corridor',    'Fable Fintech + SWIFT')
ON CONFLICT (key) DO NOTHING;


-- ── 011: inward_transfers ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inward_transfers (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL,
  reference               TEXT NOT NULL,

  amount_cad              DECIMAL(15,2) NOT NULL,
  exchange_rate           DECIMAL(10,6) NOT NULL,
  gross_amount_inr        DECIMAL(15,2) NOT NULL,
  fee_cad                 DECIMAL(10,2) DEFAULT 0,
  flat_fee_cad            DECIMAL(10,2) DEFAULT 0,
  commission_cad          DECIMAL(10,2) DEFAULT 0,
  express_surcharge_cad   DECIMAL(10,2) DEFAULT 0,
  total_fees_cad          DECIMAL(10,2) DEFAULT 0,
  net_amount_inr          DECIMAL(15,2) NOT NULL,
  fee_config_snapshot     JSONB DEFAULT '{}',

  speed                   TEXT NOT NULL DEFAULT 'standard',
  status                  TEXT NOT NULL DEFAULT 'initiated',
  priority                TEXT DEFAULT 'standard',

  risk_level              TEXT DEFAULT 'LOW',
  risk_reason             TEXT,
  ca_required             BOOLEAN DEFAULT false,
  ca_blocking             BOOLEAN DEFAULT false,
  fintrac_required        BOOLEAN DEFAULT false,

  recipient_name          TEXT NOT NULL,
  recipient_bank_name     TEXT NOT NULL,
  recipient_account_last4 TEXT,
  recipient_ifsc          TEXT NOT NULL,
  recipient_upi           TEXT,

  collection_method       TEXT DEFAULT 'interac',
  customer_bank_name      TEXT,
  collection_reference    TEXT,
  collection_status       TEXT DEFAULT 'pending',
  collection_provider     TEXT,

  payout_method           TEXT DEFAULT 'imps',
  payout_reference        TEXT,
  payout_status           TEXT DEFAULT 'pending',
  payout_provider         TEXT,

  promo_code_used         TEXT,
  promo_discount_cad      DECIMAL(10,2) DEFAULT 0,
  credit_applied_cad      DECIMAL(10,2) DEFAULT 0,

  compliance_status       TEXT DEFAULT 'pending',
  fintrac_filed           BOOLEAN DEFAULT false,
  fintrac_reference       TEXT,

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  completed_at            TIMESTAMPTZ,
  test_mode               BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_inward_user      ON public.inward_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_inward_status    ON public.inward_transfers(status);
CREATE INDEX IF NOT EXISTS idx_inward_created   ON public.inward_transfers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inward_reference ON public.inward_transfers(reference);

-- ── 011: inward_fee_config ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inward_fee_config (
  key         TEXT PRIMARY KEY,
  value       DECIMAL(12,4) NOT NULL,
  description TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
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
  ('free_above_cad_standard',        500,   'No flat fee for standard transfers at or above this CAD amount')
ON CONFLICT (key) DO NOTHING;

-- ── 011: inward_transfer_events ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inward_transfer_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.inward_transfers(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  status      TEXT NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inward_events_transfer ON public.inward_transfer_events(transfer_id);


-- ── 012: risk_config ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.risk_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.risk_config (key, value, description) VALUES
  ('outward_auto_approve_below_inr',    '500000',  'AUTO-APPROVE outward below this INR amount (15CA Part A)'),
  ('outward_high_risk_first_transfer',  'true',    'First outward transfer always requires CA review (HIGH risk)'),
  ('outward_trusted_after_n_transfers', '3',       'After N clean outward transfers CA reviews in parallel only'),
  ('outward_large_transfer_inr',        '5000000', 'Transfers above this INR are MEDIUM risk regardless of history'),
  ('inward_auto_approve_below_cad',     '3000',    'AUTO-APPROVE inward below this CAD amount'),
  ('inward_fintrac_threshold_cad',      '10000',   'FINTRAC report required above this CAD amount (HIGH risk)'),
  ('inward_trusted_after_n_transfers',  '2',       'After N clean inward transfers auto-approve up to threshold'),
  ('block_missing_source_of_funds',     'true',    'Block any transfer with missing source_of_funds'),
  ('block_missing_tds_above_inr',       '500000',  'Block outward above this INR if TDS not declared')
ON CONFLICT (key) DO NOTHING;

-- ── 012: extend existing tables ───────────────────────────────────────────────

ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS risk_reason   TEXT,
  ADD COLUMN IF NOT EXISTS ca_blocking   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS transfer_type TEXT DEFAULT 'outward';

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS transfer_id   UUID,
  ADD COLUMN IF NOT EXISTS transfer_type TEXT DEFAULT 'outward',
  ADD COLUMN IF NOT EXISTS user_id       UUID,
  ADD COLUMN IF NOT EXISTS ip_hash       TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_transfer   ON public.audit_logs(transfer_id);
CREATE INDEX IF NOT EXISTS idx_audit_user       ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON public.transfers(status);

-- risk_assessments may or may not have these columns
ALTER TABLE public.risk_assessments
  ADD COLUMN IF NOT EXISTS transfer_type TEXT DEFAULT 'outward',
  ADD COLUMN IF NOT EXISTS reason        TEXT,
  ADD COLUMN IF NOT EXISTS rules_applied JSONB DEFAULT '[]';


-- ── 013: provider_events ─────────────────────────────────────────────────────
-- Every inbound webhook logged here first. Never deleted. Idempotency key.

CREATE TABLE IF NOT EXISTS public.provider_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider           TEXT NOT NULL,
  event_type         TEXT NOT NULL,
  transfer_id        UUID,
  provider_reference TEXT,
  raw_payload        JSONB NOT NULL,
  processed          BOOLEAN DEFAULT false,
  processed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_events_idempotency
  ON public.provider_events(provider_reference, event_type)
  WHERE provider_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provider_events_transfer   ON public.provider_events(transfer_id);
CREATE INDEX IF NOT EXISTS idx_provider_events_unprocessed ON public.provider_events(processed) WHERE processed = false;

-- ── 013: payment_adapter_logs ─────────────────────────────────────────────────
-- Every outbound API call logged here. Includes mock calls.

CREATE TABLE IF NOT EXISTS public.payment_adapter_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_name     TEXT NOT NULL,
  who_executes     TEXT,
  method           TEXT NOT NULL,
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

-- ── 013: inward_recipients ────────────────────────────────────────────────────
-- Saved recipients for inward transfers (Remitly model). Never stores full account number.

CREATE TABLE IF NOT EXISTS public.inward_recipients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name      TEXT NOT NULL,
  bank_name      TEXT NOT NULL,
  account_last4  TEXT NOT NULL,
  ifsc_code      TEXT NOT NULL,
  relationship   TEXT NOT NULL DEFAULT 'other',
  is_verified    BOOLEAN DEFAULT false,
  transfer_count INTEGER DEFAULT 0,
  last_used_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inward_recipients_user ON public.inward_recipients(user_id);

-- ── 013: new columns on transfers ────────────────────────────────────────────

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
  ADD COLUMN IF NOT EXISTS residency_type     TEXT;

-- ── 013: new columns on inward_transfers ─────────────────────────────────────

ALTER TABLE public.inward_transfers
  ADD COLUMN IF NOT EXISTS provider_reference TEXT,
  ADD COLUMN IF NOT EXISTS adapter_name       TEXT,
  ADD COLUMN IF NOT EXISTS is_mock            BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS utr                TEXT,
  ADD COLUMN IF NOT EXISTS rail_used          TEXT,
  ADD COLUMN IF NOT EXISTS payment_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_bank_token TEXT,
  ADD COLUMN IF NOT EXISTS purpose            TEXT,
  ADD COLUMN IF NOT EXISTS notes              TEXT;

-- ── 013: backfill transfers ───────────────────────────────────────────────────

UPDATE public.transfers
SET
  customer_model = CASE WHEN account_type = 'NRE' THEN 'citizen_nre' ELSE 'p2p' END,
  is_mock = true
WHERE customer_model IS NULL;

-- ── 013: RLS policies ─────────────────────────────────────────────────────────

ALTER TABLE public.payment_rails_config  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_adapter_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inward_recipients     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inward_transfers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inward_fee_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inward_transfer_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (prevents "already exists" errors)
DROP POLICY IF EXISTS "service_role_payment_rails"  ON public.payment_rails_config;
DROP POLICY IF EXISTS "service_role_provider_events" ON public.provider_events;
DROP POLICY IF EXISTS "service_role_payment_logs"   ON public.payment_adapter_logs;
DROP POLICY IF EXISTS "users_own_recipients"         ON public.inward_recipients;
DROP POLICY IF EXISTS "service_role_inward"         ON public.inward_transfers;
DROP POLICY IF EXISTS "users_own_inward"            ON public.inward_transfers;
DROP POLICY IF EXISTS "service_role_inward_fee"     ON public.inward_fee_config;
DROP POLICY IF EXISTS "service_role_inward_events"  ON public.inward_transfer_events;

CREATE POLICY "service_role_payment_rails"   ON public.payment_rails_config   FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_provider_events" ON public.provider_events         FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_payment_logs"    ON public.payment_adapter_logs    FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_inward"          ON public.inward_transfers        FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_inward_fee"      ON public.inward_fee_config       FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_inward_events"   ON public.inward_transfer_events  FOR ALL TO service_role USING (true);

CREATE POLICY "users_own_recipients" ON public.inward_recipients
  FOR ALL TO authenticated USING (user_id = auth.uid());

CREATE POLICY "users_own_inward" ON public.inward_transfers
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- ── Activate Fable (when sandbox keys arrive) ─────────────────────────────────
-- Run this ONE line to switch from mock to real Fable — no code changes needed:
-- UPDATE public.payment_rails_config SET value = 'fable'
--   WHERE key IN ('outward_rail', 'inward_collection_rail', 'inward_payout_rail');
