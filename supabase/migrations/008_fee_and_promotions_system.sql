-- RUN THIS ENTIRE FILE IN SUPABASE SQL EDITOR MANUALLY
-- Migration 008 — Configurable fee, promo, and referral system
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT DO NOTHING throughout)

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 1: fee_config
-- Single source of truth for all fees and rates.
-- Edit rows here to change fees — no code deployment needed.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.fee_config (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        UNIQUE NOT NULL,
  value       DECIMAL(10,4) NOT NULL,
  description TEXT        NOT NULL,
  unit        TEXT        NOT NULL,  -- 'CAD' | 'percent' | 'boolean' | 'INR'
  is_active   BOOLEAN     DEFAULT true,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  TEXT        DEFAULT 'system'
);

INSERT INTO public.fee_config (key, value, description, unit) VALUES
  ('flat_fee_cad',                             25.00,    'Flat fee per transfer in CAD',                              'CAD'),
  ('commission_rate_total',                     1.80,    'Total FX commission % applied to gross CAD amount',         'percent'),
  ('commission_rate_rph',                       1.30,    'REPAIHUB share of commission %',                            'percent'),
  ('commission_rate_partner',                   0.50,    'Partner (Fable) share of commission %',                     'percent'),
  ('express_surcharge_cad',                    24.00,    'Extra fee for express transfers (standard=25, express=49)', 'CAD'),
  ('first_transfer_flat_fee_waived',            1,       'Waive flat fee for first transfer (1=yes, 0=no)',           'boolean'),
  ('referral_reward_referrer_cad',             25.00,    'CAD credit given to referrer on successful referral',       'CAD'),
  ('referral_reward_referee_flat_fee_waived',   1,       'Waive flat fee for referee first transfer (1=yes, 0=no)',   'boolean'),
  ('min_transfer_inr',                     500000,       'Minimum transfer amount in INR',                            'INR'),
  ('max_transfer_inr',                   83000000,       'Maximum transfer per year in INR (FEMA USD 1M limit)',       'INR')
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 2: promo_codes
-- Add rows here to create new promotions. Deactivate with is_active=false.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT        UNIQUE NOT NULL,
  description      TEXT        NOT NULL,
  discount_type    TEXT        NOT NULL
                     CHECK (discount_type IN ('flat_fee_waiver','commission_discount','fixed_cad','first_transfer_free')),
  discount_value   DECIMAL(10,2) DEFAULT 0,
  applies_to       TEXT        DEFAULT 'first_transfer'
                     CHECK (applies_to IN ('first_transfer','all_transfers','once_per_user')),
  min_amount_inr   DECIMAL(15,2) DEFAULT 0,
  max_uses_total   INTEGER     DEFAULT NULL,
  max_uses_per_user INTEGER    DEFAULT 1,
  uses_count       INTEGER     DEFAULT 0,
  valid_from       TIMESTAMPTZ DEFAULT NOW(),
  valid_until      TIMESTAMPTZ DEFAULT NULL,
  is_active        BOOLEAN     DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.promo_codes
  (code, description, discount_type, discount_value, applies_to, min_amount_inr, max_uses_per_user)
VALUES
  ('WELCOME',     'New customer flat fee waiver',         'flat_fee_waiver',     0, 'first_transfer', 500000, 1),
  ('DIWALI2026',  'Diwali 2026 — flat fee waived',        'flat_fee_waiver',     0, 'once_per_user',  500000, 1),
  ('SAVE15',      'CAD 15 off any transfer',              'fixed_cad',          15, 'once_per_user',       0, 1),
  ('COMMUNITY25', 'Community event — CAD 25 off',         'fixed_cad',          25, 'once_per_user',  500000, 1),
  ('HALFCOMM',    '50% off commission (special promo)',   'commission_discount',50, 'first_transfer', 500000, 1)
ON CONFLICT (code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 3: promo_code_uses
-- Permanent audit log of every promo code redemption. Never delete rows.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.promo_code_uses (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  promo_code_id    UUID        NOT NULL REFERENCES public.promo_codes(id),
  transfer_id      UUID        REFERENCES public.transfers(id) ON DELETE SET NULL,
  discount_applied DECIMAL(10,2) NOT NULL,
  used_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 4: referral_codes
-- One row per user, created on signup. Code is the user's shareable link token.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code             TEXT        UNIQUE NOT NULL,
  total_referrals  INTEGER     DEFAULT 0,
  total_earned_cad DECIMAL(10,2) DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 5: referrals
-- Tracks who referred whom and reward status. Never delete rows.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.referrals (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id    UUID        NOT NULL REFERENCES auth.users(id),
  referee_user_id     UUID        NOT NULL REFERENCES auth.users(id),
  referral_code       TEXT        NOT NULL,
  status              TEXT        DEFAULT 'pending'
                        CHECK (status IN ('pending','completed','rewarded','expired')),
  referee_transfer_id UUID        REFERENCES public.transfers(id) ON DELETE SET NULL,
  referrer_reward_cad DECIMAL(10,2) DEFAULT 0,
  referee_reward_type TEXT        DEFAULT 'flat_fee_waiver',
  rewarded_at         TIMESTAMPTZ DEFAULT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (referrer_user_id, referee_user_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 6: user_credits
-- Referral reward wallet per user. Credits auto-applied on next transfer.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_credits (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_cad  DECIMAL(10,2) DEFAULT 0,
  total_earned DECIMAL(10,2) DEFAULT 0,
  total_spent  DECIMAL(10,2) DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Add referral tracking columns to profiles
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by_code  TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS first_transfer_at TIMESTAMPTZ DEFAULT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Add new fee tracking columns to transfers
-- (commission_cad, repaihub_commission, partner_commission, flat_fee_cad,
--  total_fees_cad, net_amount_cad were added in migration 007)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS express_surcharge_cad DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_discount_cad     DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_applied_cad     DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_code_id          UUID          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS promo_code_used        TEXT          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fee_config_snapshot    JSONB         DEFAULT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Indexes for performance
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_fee_config_key       ON public.fee_config(key);
CREATE INDEX IF NOT EXISTS idx_fee_config_active    ON public.fee_config(is_active);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code  ON public.referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referrals_referee    ON public.referrals(referee_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer   ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_promo_uses_user      ON public.promo_code_uses(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_uses_code      ON public.promo_code_uses(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_user    ON public.user_credits(user_id);
