-- Migration 021 — Add missing columns + fee_config table
-- Self-contained: safe to run regardless of whether 007, 008, 016 were applied.
-- All ADD COLUMN IF NOT EXISTS — idempotent.

-- ── fee_config table (migration 008 may not have run) ────────────────────────
CREATE TABLE IF NOT EXISTS public.fee_config (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT          UNIQUE NOT NULL,
  value       NUMERIC(18,4) NOT NULL,
  description TEXT          NOT NULL,
  unit        TEXT          NOT NULL,
  is_active   BOOLEAN       DEFAULT true,
  updated_at  TIMESTAMPTZ   DEFAULT NOW(),
  updated_by  TEXT          DEFAULT 'system'
);

INSERT INTO public.fee_config (key, value, description, unit) VALUES
  ('flat_fee_cad',                           25.00,  'Flat fee per transfer in CAD',                             'CAD'),
  ('commission_rate_total',                   1.80,  'Total FX commission % applied to gross CAD amount',        'percent'),
  ('commission_rate_rph',                     1.30,  'REPAIHUB share of commission %',                           'percent'),
  ('commission_rate_partner',                 0.50,  'Partner share of commission %',                            'percent'),
  ('express_surcharge_cad',                  24.00,  'Extra fee for express transfers',                          'CAD'),
  ('first_transfer_flat_fee_waived',          1,     'Waive flat fee for first transfer (1=yes, 0=no)',          'boolean'),
  ('referral_reward_referrer_cad',           25.00,  'CAD credit given to referrer on successful referral',      'CAD'),
  ('referral_reward_referee_flat_fee_waived', 1,     'Waive flat fee for referee first transfer (1=yes, 0=no)', 'boolean'),
  ('min_transfer_inr',                   500000,     'Minimum transfer amount in INR',                           'INR'),
  ('max_transfer_inr',                 83000000,     'Maximum transfer per year in INR (FEMA USD 1M limit)',      'INR')
ON CONFLICT (key) DO NOTHING;

-- ── promo_codes (migration 008) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT          UNIQUE NOT NULL,
  description      TEXT          NOT NULL,
  discount_type    TEXT          NOT NULL
                     CHECK (discount_type IN ('flat_fee_waiver','commission_discount','fixed_cad','first_transfer_free')),
  discount_value   DECIMAL(10,2) DEFAULT 0,
  applies_to       TEXT          DEFAULT 'first_transfer'
                     CHECK (applies_to IN ('first_transfer','all_transfers','once_per_user')),
  min_amount_inr   DECIMAL(15,2) DEFAULT 0,
  max_uses_total   INTEGER       DEFAULT NULL,
  max_uses_per_user INTEGER      DEFAULT 1,
  uses_count       INTEGER       DEFAULT 0,
  valid_from       TIMESTAMPTZ   DEFAULT NOW(),
  valid_until      TIMESTAMPTZ   DEFAULT NULL,
  is_active        BOOLEAN       DEFAULT true,
  created_at       TIMESTAMPTZ   DEFAULT NOW()
);

INSERT INTO public.promo_codes (code, description, discount_type, discount_value, applies_to, min_amount_inr, max_uses_per_user)
VALUES
  ('WELCOME',     'New customer flat fee waiver',         'flat_fee_waiver',     0,  'first_transfer', 500000, 1),
  ('SAVE15',      'CAD 15 off any transfer',              'fixed_cad',          15,  'once_per_user',       0, 1),
  ('COMMUNITY25', 'Community event — CAD 25 off',         'fixed_cad',          25,  'once_per_user',  500000, 1),
  ('HALFCOMM',    '50% off commission (special promo)',   'commission_discount', 50, 'first_transfer',  500000, 1)
ON CONFLICT (code) DO NOTHING;

-- ── promo_code_uses (migration 008) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.promo_code_uses (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  promo_code_id    UUID          NOT NULL REFERENCES public.promo_codes(id),
  transfer_id      UUID          REFERENCES public.transfers(id) ON DELETE SET NULL,
  discount_applied DECIMAL(10,2) NOT NULL,
  used_at          TIMESTAMPTZ   DEFAULT NOW()
);

-- ── transfers: missing fee columns (migration 007) ─────────────────────────────
ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS commission_cad        DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS repaihub_commission   DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS partner_commission    DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS flat_fee_cad          DECIMAL(12,2)  DEFAULT 25.00,
  ADD COLUMN IF NOT EXISTS total_fees_cad        DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS net_amount_cad        DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS test_mode             BOOLEAN        NOT NULL DEFAULT FALSE;

-- ── transfers: promo/credit columns (migration 008) ───────────────────────────
ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS express_surcharge_cad DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_discount_cad    DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_applied_cad    DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_code_id         UUID          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS promo_code_used       TEXT          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fee_config_snapshot   JSONB         DEFAULT NULL;

-- ── transfers: IT Act 2025 columns (migration 016) ────────────────────────────
ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS form145_part          TEXT,
  ADD COLUMN IF NOT EXISTS form146_required      BOOLEAN       DEFAULT false,
  ADD COLUMN IF NOT EXISTS form146_number        TEXT,
  ADD COLUMN IF NOT EXISTS form145_number        TEXT,
  ADD COLUMN IF NOT EXISTS indicative_rate       NUMERIC(20,8),
  ADD COLUMN IF NOT EXISTS final_execution_rate  NUMERIC(20,8),
  ADD COLUMN IF NOT EXISTS idempotency_key       TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason   TEXT,
  ADD COLUMN IF NOT EXISTS tax_act_version       TEXT          DEFAULT '2025';

-- Unique constraint on idempotency_key per user
CREATE UNIQUE INDEX IF NOT EXISTS transfers_idempotency_key_user_id_idx
  ON public.transfers (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── transfers: other potentially missing columns ───────────────────────────────
ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS priority              TEXT,
  ADD COLUMN IF NOT EXISTS risk_score            INTEGER       DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_level            TEXT          DEFAULT 'LOW',
  ADD COLUMN IF NOT EXISTS risk_breakdown        JSONB         DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS compliance_status     TEXT          DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ca_required           BOOLEAN       DEFAULT false,
  ADD COLUMN IF NOT EXISTS ca_status             TEXT          DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS tds_deducted          BOOLEAN       DEFAULT false,
  ADD COLUMN IF NOT EXISTS tds_amount_inr        DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS account_type          TEXT          DEFAULT 'NRO',
  ADD COLUMN IF NOT EXISTS customer_model        TEXT,
  ADD COLUMN IF NOT EXISTS nro_bank_name         TEXT,
  ADD COLUMN IF NOT EXISTS nro_branch_city       TEXT,
  ADD COLUMN IF NOT EXISTS residency_type        TEXT,
  ADD COLUMN IF NOT EXISTS is_mock               BOOLEAN       DEFAULT false,
  ADD COLUMN IF NOT EXISTS fee_cad               DECIMAL(12,2);

-- Backfill idempotency_key unique index column for form145_part from fifteen_ca_part
UPDATE public.transfers
  SET form145_part    = fifteen_ca_part,
      indicative_rate = exchange_rate,
      tax_act_version = '2025'
  WHERE form145_part IS NULL AND fifteen_ca_part IS NOT NULL;

-- Update old status names to IT Act 2025 names
UPDATE public.transfers SET status = 'form146_requested' WHERE status = '15cb_requested';
UPDATE public.transfers SET status = 'form146_requested' WHERE status = '15CB_REQUESTED';
UPDATE public.transfers SET status = 'form145_filed'     WHERE status = '15ca_filed';
UPDATE public.transfers SET status = 'form145_filed'     WHERE status = '15CA_FILED';

-- ── inward_transfers: missing columns ─────────────────────────────────────────
-- inward_transfers may have been created without some columns
ALTER TABLE public.inward_transfers
  ADD COLUMN IF NOT EXISTS amount_inr            DECIMAL(15,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fintrac_report        BOOLEAN        DEFAULT false,
  ADD COLUMN IF NOT EXISTS reference             TEXT,
  ADD COLUMN IF NOT EXISTS purpose_code          TEXT           DEFAULT 'INWARD',
  ADD COLUMN IF NOT EXISTS express_surcharge_cad DECIMAL(12,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_fees_cad        DECIMAL(12,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_discount_cad    DECIMAL(12,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_applied_cad    DECIMAL(12,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_config_snapshot   JSONB          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key       TEXT,
  ADD COLUMN IF NOT EXISTS provider_reference    TEXT,
  ADD COLUMN IF NOT EXISTS adapter_name          TEXT           DEFAULT 'mock',
  ADD COLUMN IF NOT EXISTS is_mock               BOOLEAN        DEFAULT true;

-- ── profiles: missing columns ─────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status                TEXT           DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS residency_type        TEXT;

-- ── user_credits (migration 019/020) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_credits (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_cad   NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_earned  NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_spent   NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

-- ── referrals (migration 020) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referrals (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code     TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending',
  reward_cad        DECIMAL(10,2) DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── referral_codes (migration 020) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code        TEXT        NOT NULL UNIQUE,
  uses_count  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
