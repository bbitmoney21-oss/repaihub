-- RUN THIS ENTIRE FILE IN SUPABASE SQL EDITOR MANUALLY
-- Migration 011 — Payment Rails Configuration + Inward Transfers
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT DO NOTHING throughout)

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: payment_rails_config
-- Abstracts all payment execution — switch providers by changing value column.
-- Routes call paymentRailsService which reads this table.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.payment_rails_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.payment_rails_config VALUES
  ('outward_india_rail',       'fable',         'Rails for NRO→Canada: fable | nium | manual'),
  ('inward_canada_collection', 'fable_interac', 'How we collect CAD: fable_interac | fable_eft | stripe | manual'),
  ('inward_india_payout',      'fable_nium',    'How we pay INR in India: fable_nium | fable_imps | manual'),
  ('nium_enabled',             'false',         'Whether Nium integration is active'),
  ('nium_api_url',             '',              'Nium API base URL'),
  ('interac_enabled',          'false',         'Whether Interac e-Transfer is active'),
  ('eft_enabled',              'false',         'Whether EFT (Canadian bank transfer) is active'),
  ('swift_enabled',            'true',          'Whether SWIFT is the fallback for all corridors')
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: inward_transfers
-- CAD → INR transfers (Canada → India).
-- Separate from outward (NRO → Canada) transfers table.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.inward_transfers (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL,
  reference               TEXT NOT NULL,

  -- Amounts
  amount_cad              DECIMAL(15,2) NOT NULL,
  exchange_rate           DECIMAL(10,6) NOT NULL,  -- CAD per INR
  gross_amount_inr        DECIMAL(15,2) NOT NULL,
  fee_cad                 DECIMAL(10,2) DEFAULT 0,
  flat_fee_cad            DECIMAL(10,2) DEFAULT 0,
  commission_cad          DECIMAL(10,2) DEFAULT 0,
  express_surcharge_cad   DECIMAL(10,2) DEFAULT 0,
  total_fees_cad          DECIMAL(10,2) DEFAULT 0,
  net_amount_inr          DECIMAL(15,2) NOT NULL,
  fee_config_snapshot     JSONB DEFAULT '{}',

  -- Speed and status
  speed                   TEXT NOT NULL DEFAULT 'standard',  -- 'standard' | 'express'
  status                  TEXT NOT NULL DEFAULT 'initiated', -- initiated | collection_initiated | fx_converted | payout_initiated | completed | failed | fintrac_review
  priority                TEXT DEFAULT 'standard',

  -- Risk
  risk_level              TEXT DEFAULT 'LOW',     -- 'LOW' | 'MEDIUM' | 'HIGH'
  risk_reason             TEXT,
  ca_required             BOOLEAN DEFAULT false,
  ca_blocking             BOOLEAN DEFAULT false,
  fintrac_required        BOOLEAN DEFAULT false,  -- true if >= CAD 10,000

  -- Recipient (India side)
  recipient_name          TEXT NOT NULL,
  recipient_bank_name     TEXT NOT NULL,
  recipient_account_last4 TEXT,    -- last 4 digits only — never full account
  recipient_ifsc          TEXT NOT NULL,
  recipient_upi           TEXT,    -- optional UPI ID

  -- Collection (Canada side)
  collection_method       TEXT DEFAULT 'interac', -- 'interac' | 'eft' | 'wire'
  customer_bank_name      TEXT,
  collection_reference    TEXT,    -- reference from payment gateway
  collection_status       TEXT DEFAULT 'pending',

  -- Payout (India side)
  payout_method           TEXT DEFAULT 'imps',   -- 'imps' | 'neft' | 'rtgs' | 'upi'
  payout_reference        TEXT,
  payout_status           TEXT DEFAULT 'pending',

  -- Promo / credits
  promo_code_used         TEXT,
  promo_discount_cad      DECIMAL(10,2) DEFAULT 0,
  credit_applied_cad      DECIMAL(10,2) DEFAULT 0,

  -- Compliance
  compliance_status       TEXT DEFAULT 'pending',
  fintrac_filed           BOOLEAN DEFAULT false,
  fintrac_reference       TEXT,

  -- Provider tracking
  collection_provider     TEXT,
  payout_provider         TEXT,

  -- Timestamps
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  completed_at            TIMESTAMPTZ,
  test_mode               BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_inward_user       ON public.inward_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_inward_status     ON public.inward_transfers(status);
CREATE INDEX IF NOT EXISTS idx_inward_created    ON public.inward_transfers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inward_reference  ON public.inward_transfers(reference);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: inward_fee_config
-- Configures fees for inward (CAD→INR) transfers separately from outward fees.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.inward_fee_config (
  key         TEXT PRIMARY KEY,
  value       DECIMAL(12,4) NOT NULL,
  description TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.inward_fee_config (key, value, description) VALUES
  ('flat_fee_cad',                      15,    'Flat fee per inward transfer in CAD'),
  ('commission_rate_total',              1.5,   'Total commission rate % for inward transfers'),
  ('express_surcharge_cad',             20,    'Express speed surcharge in CAD'),
  ('first_transfer_flat_fee_waived',     1,    '1=true: waive flat fee for first inward transfer'),
  ('daily_limit_cad',                5000,    'Maximum CAD per day per customer'),
  ('monthly_limit_cad',             20000,    'Maximum CAD per month per customer'),
  ('min_transfer_cad',                  50,    'Minimum inward transfer amount in CAD'),
  ('max_transfer_cad',               10000,    'Maximum single inward transfer in CAD')
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: inward_transfer_events
-- Append-only status event log for inward transfers.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.inward_transfer_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.inward_transfers(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  status      TEXT NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inward_events_transfer ON public.inward_transfer_events(transfer_id);
