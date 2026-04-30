-- RUN THIS ENTIRE FILE IN SUPABASE SQL EDITOR MANUALLY
-- Migration 010 — User Type Model + KYC Configuration
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT DO NOTHING throughout)

-- ═══════════════════════════════════════════════════════════════════════════════
-- Add user type and residency columns to profiles table
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS "residencyType"     TEXT DEFAULT NULL,
  -- Values: 'work_permit' | 'permanent_resident' | 'visitor' | 'citizen' | 'other'

  ADD COLUMN IF NOT EXISTS "customerModel"     TEXT DEFAULT NULL,
  -- Values: 'p2p_nro' | 'inward_only' | 'both'
  -- p2p_nro:      WP/PR/Visitor — has NRO account, uses outward + inward
  -- inward_only:  Citizen primarily — sends CAD to India
  -- both:         Has both NRO and wants both directions

  ADD COLUMN IF NOT EXISTS "kycProvider"       TEXT DEFAULT 'flinks_digilocker',
  -- Values: 'flinks_digilocker' | 'fable_kyc' | 'manual'

  ADD COLUMN IF NOT EXISTS "kycStatus"         TEXT DEFAULT 'pending',
  -- Values: 'pending' | 'in_progress' | 'verified' | 'failed' | 'expired'

  ADD COLUMN IF NOT EXISTS "kycSessionId"      TEXT DEFAULT NULL,
  -- External KYC session reference (Fable or Flinks)

  ADD COLUMN IF NOT EXISTS "kycVerifiedAt"     TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "kycExpiresAt"      TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "hasNroAccount"     BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "canadaVerified"    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "indiaVerified"     BOOLEAN DEFAULT false;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: kyc_config
-- Controls which KYC provider is active.
-- Switch providers without touching code — change value column only.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.kyc_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.kyc_config (key, value, description) VALUES
  ('active_canada_kyc',       'flinks',          'KYC for Canadian bank verification: flinks | fable | manual'),
  ('active_india_kyc',        'digilocker',      'KYC for Indian identity: digilocker | fable | manual'),
  ('fable_kyc_enabled',       'false',           'Whether Fable KYC compliance API is active'),
  ('fable_kyc_api_url',       '',                'Fable KYC API base URL when enabled'),
  ('fable_aml_screening',     'false',           'Enable Fable AML/sanctions screening'),
  ('kyc_expiry_days',         '730',             'KYC expires after N days (730 = 2 years)'),
  ('require_nro_for_outward', 'true',            'Require NRO account verification for outward transfers'),
  ('allow_citizen_outward',   'true',            'Allow Canadian citizens to do outward if they have NRO account')
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: customer_model_config
-- Defines what each residency type can access.
-- Edit here to change product access rules — no code changes needed.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.customer_model_config (
  residency_type    TEXT PRIMARY KEY,
  can_do_outward    BOOLEAN DEFAULT false,
  can_do_inward     BOOLEAN DEFAULT false,
  requires_nro      BOOLEAN DEFAULT false,
  default_model     TEXT NOT NULL,
  description       TEXT NOT NULL
);

INSERT INTO public.customer_model_config VALUES
  ('work_permit',        true,  true,  true,  'p2p_nro',      'WP holders — full NRO outward + inward via Fable/P2P'),
  ('permanent_resident', true,  true,  true,  'p2p_nro',      'PR holders — full NRO outward + inward via Fable/P2P'),
  ('visitor',            false, true,  false, 'inward_only',  'Visitors — inward only, no NRO outward'),
  ('citizen',            true,  true,  false, 'both',         'Citizens — inward primary + outward if NRO verified'),
  ('other',              false, true,  false, 'inward_only',  'Other status — inward only by default')
ON CONFLICT (residency_type) DO NOTHING;
