-- ═══════════════════════════════════════════════════════════════════════════
-- REPAIHUB — Full bootstrap: base schema + all migrations 006 → 025.
-- Generated: 2026-05-04T22:49:57Z
-- Idempotent: every statement is IF NOT EXISTS / OR REPLACE / DROP IF EXISTS.
-- HOW TO RUN:  Supabase Dashboard → SQL Editor → New query → paste → Run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 0. Base schema (supabase/schema.sql) — creates profiles, transfers,
--    kyc_submissions, canada_bank_accounts, india_nro_accounts,
--    transfer_events, and the on_auth_user_created trigger.
-- ═══════════════════════════════════════════════════════════════════════════
-- REPAIHUB — Complete Supabase schema
-- Run in the Supabase SQL Editor to set up a fresh project from scratch.
-- Order matters: run top to bottom.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. profiles ───────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid        primary key references auth.users on delete cascade,
  email         text        not null,
  full_name     text,
  phone         text,
  residency     text,         -- 'citizen' | 'pr' | 'oci' | 'work_permit'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- ── 2. Auto-create profile on signup ─────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 3. kyc_submissions ────────────────────────────────────────────────────────
create table if not exists public.kyc_submissions (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references auth.users on delete cascade,
  canada_verified       boolean     not null default false,
  canada_verified_at    timestamptz,
  india_verified        boolean     not null default false,
  india_verified_at     timestamptz,
  created_at            timestamptz not null default now(),
  unique (user_id)
);

alter table public.kyc_submissions enable row level security;

create policy "kyc_select_own" on public.kyc_submissions
  for select using (auth.uid() = user_id);

create policy "kyc_insert_own" on public.kyc_submissions
  for insert with check (auth.uid() = user_id);

create policy "kyc_update_own" on public.kyc_submissions
  for update using (auth.uid() = user_id);

-- ── 4. canada_bank_accounts ───────────────────────────────────────────────────
create table if not exists public.canada_bank_accounts (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users on delete cascade,
  institution  text        not null,
  holder_name  text,
  account_type text        not null default 'Chequing',
  created_at   timestamptz not null default now()
);

alter table public.canada_bank_accounts enable row level security;

create policy "canada_bank_select_own" on public.canada_bank_accounts
  for select using (auth.uid() = user_id);

create policy "canada_bank_insert_own" on public.canada_bank_accounts
  for insert with check (auth.uid() = user_id);

-- ── 5. india_nro_accounts ─────────────────────────────────────────────────────
create table if not exists public.india_nro_accounts (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users on delete cascade,
  bank_name  text        not null,
  branch     text,
  created_at timestamptz not null default now()
);

alter table public.india_nro_accounts enable row level security;

create policy "india_nro_select_own" on public.india_nro_accounts
  for select using (auth.uid() = user_id);

create policy "india_nro_insert_own" on public.india_nro_accounts
  for insert with check (auth.uid() = user_id);

-- ── 6. transfers ──────────────────────────────────────────────────────────────
create table if not exists public.transfers (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references auth.users on delete cascade,
  amount_inr          numeric     not null,
  amount_cad          numeric     not null,
  exchange_rate       numeric     not null,
  fee_cad             numeric     not null default 0,
  speed               text        not null default 'standard',  -- 'standard' | 'express'
  priority            text        not null default 'standard',  -- mirrors speed; kept separate for CA portal
  status              text        not null default 'initiated',
  source_of_funds     text,
  purpose_code        text,
  reference           text,
  -- CA compliance fields (populated by the Express CA portal)
  fifteen_cb_number   text,
  fifteen_ca_number   text,
  ca_remarks          text,
  ca_approved_at      timestamptz,
  ca_approved_by      text,
  tds_deducted        boolean     not null default false,
  tds_amount_inr      numeric     not null default 0,
  tds_reference       text,
  -- Timestamps
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  completed_at        timestamptz
);

alter table public.transfers enable row level security;

create policy "transfers_select_own" on public.transfers
  for select using (auth.uid() = user_id);

create policy "transfers_insert_own" on public.transfers
  for insert with check (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists transfers_set_updated_at on public.transfers;
create trigger transfers_set_updated_at
  before update on public.transfers
  for each row execute procedure public.set_updated_at();

-- ── 7. transfer_events ────────────────────────────────────────────────────────
create table if not exists public.transfer_events (
  id          uuid        primary key default gen_random_uuid(),
  transfer_id uuid        not null references public.transfers on delete cascade,
  user_id     uuid        not null references auth.users on delete cascade,
  status      text        not null,
  note        text,
  created_at  timestamptz not null default now()
);

alter table public.transfer_events enable row level security;

create policy "events_select_own" on public.transfer_events
  for select using (auth.uid() = user_id);

create policy "events_insert_own" on public.transfer_events
  for insert with check (auth.uid() = user_id);

-- ── 8. Useful indexes ─────────────────────────────────────────────────────────
create index if not exists transfers_user_id_idx   on public.transfers (user_id);
create index if not exists transfers_status_idx    on public.transfers (status);
create index if not exists transfers_created_at_idx on public.transfers (created_at desc);
create index if not exists events_transfer_id_idx  on public.transfer_events (transfer_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 001_profiles_trigger.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE SQL EDITOR MANUALLY
-- Go to Supabase → SQL Editor → paste and run this entire file
-- This is a one-time setup step (safe to re-run — uses OR REPLACE / DROP IF EXISTS)
--
-- What this does:
--   1. Ensures the trigger function handle_new_user() exists
--   2. Re-attaches the trigger to auth.users so every new signup auto-creates a profile row
--   3. Adds an insert RLS policy on profiles so the client-side fallback upsert
--      in apiRegister() also works (defence-in-depth when email confirmation is disabled)

-- ── Trigger function ──────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ── Trigger on auth.users ─────────────────────────────────────────────────────
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Insert RLS policy for profiles ───────────────────────────────────────────
-- Allows the authenticated user to insert their own profile row.
-- Required for the client-side upsert fallback in apiRegister() to succeed
-- when email confirmation is disabled and a session exists immediately after signUp.
drop policy if exists "profiles_insert" on public.profiles;

create policy "profiles_insert" on public.profiles
  for insert with check (auth.uid() = id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 002_drop_duplicate_transfer_table.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE SQL EDITOR MANUALLY
-- Go to Supabase → SQL Editor → paste and run this entire file
-- Safe to re-run: uses DROP IF EXISTS
--
-- WHY: Two tables existed for transfers data:
--   "Transfer"  (PascalCase) — created by an older Prisma-style schema, NOT used by the app
--   "transfers" (snake_case) — created by supabase-schema.sql, used by all app code
--
-- The app (src/lib/api.ts) exclusively queries public.transfers (lowercase).
-- "Transfer" is dead weight and must be removed to avoid confusion.
--
-- CASCADE drops any foreign keys, views, or policies that reference "Transfer".
-- If any data exists in "Transfer", this will delete it — back up first if needed.

drop table if exists public."Transfer" cascade;

-- ═══════════════════════════════════════════════════════════════════════════
-- 003_add_ca_fields_to_transfers.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE SQL EDITOR MANUALLY
-- Adds CA compliance columns to the transfers table so the Express CA portal
-- can persist approval data back to Supabase instead of losing it on restart.
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS.

alter table public.transfers
  add column if not exists priority         text    not null default 'standard',
  add column if not exists fifteen_cb_number text,
  add column if not exists fifteen_ca_number text,
  add column if not exists ca_remarks        text,
  add column if not exists ca_approved_at    timestamptz,
  add column if not exists ca_approved_by    text,
  add column if not exists tds_deducted      boolean not null default false,
  add column if not exists tds_amount_inr    numeric not null default 0,
  add column if not exists tds_reference     text,
  add column if not exists updated_at        timestamptz not null default now();

-- Backfill priority from speed for existing rows
update public.transfers set priority = speed where priority = 'standard' and speed is not null;

-- Auto-update updated_at on every row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists transfers_set_updated_at on public.transfers;
create trigger transfers_set_updated_at
  before update on public.transfers
  for each row execute procedure public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 004_auth_password_reset.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Add columns required for custom password management
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS password_hash        TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_hash     TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expiry   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until         TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_reset_token_hash
  ON profiles(reset_token_hash)
  WHERE reset_token_hash IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 005_compliance_wallet.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 005 — Compliance Requests + Digital Document Wallet
-- Run in Supabase SQL Editor (top to bottom, safe to re-run with IF NOT EXISTS)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. compliance_requests ────────────────────────────────────────────────────
-- One row per transfer, created the moment a transfer is initiated.
-- The CA sees all rows; customers see only their own.

CREATE TABLE IF NOT EXISTS public.compliance_requests (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id         UUID        NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Workflow status
  status              TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','under_review','approved','rejected')),

  -- 15CA / 15CB metadata
  fifteen_ca_part     TEXT        CHECK (fifteen_ca_part IN ('A','B','C','D')),
  fifteen_cb_required BOOLEAN     NOT NULL DEFAULT FALSE,
  fifteen_cb_number   TEXT,       -- assigned by CA on approval
  fifteen_ca_number   TEXT,       -- assigned after 15CA is filed
  ca_remarks          TEXT,
  ca_reviewed_by      TEXT,       -- CA name
  ca_reviewed_at      TIMESTAMPTZ,
  rejection_reason    TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT compliance_requests_transfer_unique UNIQUE (transfer_id)
);

ALTER TABLE public.compliance_requests ENABLE ROW LEVEL SECURITY;

-- Users: read own rows only
CREATE POLICY "compliance_select_own" ON public.compliance_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Service role (Express admin client) manages inserts + updates — no direct user writes needed.

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER compliance_requests_set_updated_at
  BEFORE UPDATE ON public.compliance_requests
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ── 2. wallet_documents ───────────────────────────────────────────────────────
-- Every document uploaded (by user OR by CA) lives here.
-- token_id is a 64-char hex string, crypto-random, non-guessable.
-- Storage path points to the private Supabase Storage bucket 'wallet-docs'.

CREATE TABLE IF NOT EXISTS public.wallet_documents (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Secure, non-guessable token — acts as the document's external reference
  token_id              TEXT        NOT NULL UNIQUE
                          DEFAULT encode(gen_random_bytes(32), 'hex'),

  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  compliance_request_id UUID        REFERENCES public.compliance_requests(id) ON DELETE SET NULL,
  transfer_id           UUID        REFERENCES public.transfers(id) ON DELETE SET NULL,

  -- Document classification
  doc_type              TEXT        NOT NULL
                          CHECK (doc_type IN (
                            'bank_statement','tds_certificate','pan_card',
                            'aadhaar','property_deed','investment_proof',
                            '15ca_pdf','15cb_pdf','other'
                          )),
  doc_label             TEXT        NOT NULL,  -- human-readable label set by uploader

  -- Storage reference (private bucket — never exposed directly)
  storage_path          TEXT        NOT NULL,  -- e.g. {user_id}/2026/{token_id}_bank.pdf
  bucket_name           TEXT        NOT NULL DEFAULT 'wallet-docs',

  -- File metadata
  file_name             TEXT        NOT NULL,
  file_size_bytes       BIGINT,
  mime_type             TEXT,

  -- Organisation
  year                  INTEGER     NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,
  uploaded_by           TEXT        NOT NULL DEFAULT 'user'
                          CHECK (uploaded_by IN ('user','ca')),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.wallet_documents ENABLE ROW LEVEL SECURITY;

-- Users: read own documents only
CREATE POLICY "wallet_select_own" ON public.wallet_documents
  FOR SELECT USING (auth.uid() = user_id);

-- ── 3. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS compliance_user_id_idx
  ON public.compliance_requests(user_id);
CREATE INDEX IF NOT EXISTS compliance_transfer_id_idx
  ON public.compliance_requests(transfer_id);
CREATE INDEX IF NOT EXISTS compliance_status_idx
  ON public.compliance_requests(status);
CREATE INDEX IF NOT EXISTS compliance_created_idx
  ON public.compliance_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS wallet_user_id_idx
  ON public.wallet_documents(user_id);
CREATE INDEX IF NOT EXISTS wallet_token_id_idx
  ON public.wallet_documents(token_id);
CREATE INDEX IF NOT EXISTS wallet_compliance_id_idx
  ON public.wallet_documents(compliance_request_id);
CREATE INDEX IF NOT EXISTS wallet_year_idx
  ON public.wallet_documents(year);
CREATE INDEX IF NOT EXISTS wallet_doc_type_idx
  ON public.wallet_documents(doc_type);

-- ── 4. Supabase Storage setup instructions ────────────────────────────────────
-- Create ONE private bucket named exactly: wallet-docs
--
-- In Supabase Dashboard → Storage → New bucket:
--   Name: wallet-docs
--   Public: OFF  (all access via signed URLs generated server-side)
--
-- No storage RLS policies needed — all reads/writes go through
-- Express (supabaseAdmin / service role key) which bypasses RLS.
-- Signed URLs expire after 1 hour and are issued per-request.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- 006_profiles_residency.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 006 — Add residency column to profiles
-- Safe to re-run (IF NOT EXISTS).
-- Run in Supabase SQL Editor.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS residency TEXT
    CHECK (residency IN ('citizen','pr','oci','work_permit'));

-- ═══════════════════════════════════════════════════════════════════════════
-- 007_transfers_fee_columns_and_backfill.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 007 — Fee columns on transfers + backfill compliance_requests
-- Run in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS / ON CONFLICT).

-- ── 1. Fee columns on transfers ───────────────────────────────────────────────
ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS commission_cad      DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS repaihub_commission DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS partner_commission  DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS flat_fee_cad        DECIMAL(12,2) DEFAULT 25.00,
  ADD COLUMN IF NOT EXISTS total_fees_cad      DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS net_amount_cad      DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS test_mode           BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Backfill compliance_requests for transfers that don't have one ─────────
-- This fixes all transfers initiated before migration 005 was run,
-- or before the auto-create code was deployed.
INSERT INTO public.compliance_requests (
  transfer_id,
  user_id,
  status,
  fifteen_ca_part,
  fifteen_cb_required
)
SELECT
  t.id,
  t.user_id,
  'pending',
  CASE WHEN t.amount_inr <= 500000 THEN 'A' ELSE 'C' END,
  CASE WHEN t.amount_inr > 500000 THEN TRUE ELSE FALSE END
FROM public.transfers t
WHERE NOT EXISTS (
  SELECT 1 FROM public.compliance_requests cr WHERE cr.transfer_id = t.id
)
ON CONFLICT (transfer_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 008_fee_and_promotions_system.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- RUN THIS ENTIRE FILE IN SUPABASE SQL EDITOR MANUALLY
-- Migration 008 — Configurable fee, promo, and referral system
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT DO NOTHING throughout)

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 1: fee_config
-- Single source of truth for all fees and rates.
-- Edit rows here to change fees — no code deployment needed.
-- ═══════════════════════════════════════════════════════════════════════════════
-- Defensive widen: if a previous (failed) run created fee_config with the
-- old DECIMAL(10,4) precision, widen it now so the seed insert below works.
-- No-op when the table doesn't exist yet (fresh install hits the CREATE TABLE).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'fee_config'
      AND column_name  = 'value'
  ) THEN
    ALTER TABLE public.fee_config ALTER COLUMN value TYPE DECIMAL(20,4);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.fee_config (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        UNIQUE NOT NULL,
  value       DECIMAL(20,4) NOT NULL,   -- widened from (10,4): max_transfer_inr seed of 83,000,000 overflowed DECIMAL(10,4)
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 009_risk_and_compliance_engine.sql
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 010_user_types_and_kyc.sql
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 011_payment_rails.sql
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 012_simple_risk_config.sql
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 013_complete_schema.sql
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 014_profile_signup_complete.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 014: Track signup completion explicitly on profiles.
--
-- WHY: The on_auth_user_created trigger inserts a profile row immediately
-- when a user fills step 1 of signup (email + password), even if they abandon
-- residency selection / KYC / bank linking. The product flagged this as a
-- data-integrity / privacy concern: incomplete profiles look like real users.
--
-- This migration adds a signup_complete boolean. It defaults to FALSE for new
-- profiles and is flipped to TRUE only when the user finishes the final
-- onboarding step (India KYC submission). Existing users are backfilled to
-- TRUE if they already have both bank accounts on file.
--
-- Run this in the Supabase SQL Editor against BOTH dev and prod projects
-- before deploying the matching code change.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_complete BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: any existing user who already has both KYC flags set is treated
-- as fully onboarded. New rows default to FALSE per the column default above.
UPDATE public.profiles p
   SET signup_complete = TRUE
  FROM public.kyc_submissions k
 WHERE k.user_id = p.id
   AND k.canada_verified = TRUE
   AND k.india_verified = TRUE
   AND p.signup_complete = FALSE;

-- Optional: index for admin queries that filter by completion status
CREATE INDEX IF NOT EXISTS idx_profiles_signup_complete
  ON public.profiles (signup_complete)
  WHERE signup_complete = FALSE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 016_form_rename.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 016 — Form 15CA/15CB renamed to Form 145/146
-- RUN IN SUPABASE SQL EDITOR MANUALLY
-- ═══════════════════════════════════════════════════════════════════════════
-- LEGAL: India Income Tax Act 2025 came into force on 1 April 2026.
-- Form 15CA → Form 145 (same purpose: remitter self-declaration)
-- Form 15CB → Form 146 (same purpose: CA certificate)
-- Section 195 → Section 397(3)(d)
-- Thresholds unchanged: Part A below ₹5L, Part C above ₹5L
-- DTAA applicability unchanged.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── TABLE: transfers ─────────────────────────────────────────────────────────

-- Add new columns (old columns kept for backward compat during transition)
ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS form145_part        TEXT,
  ADD COLUMN IF NOT EXISTS form146_required    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS form146_number      TEXT,
  ADD COLUMN IF NOT EXISTS form145_number      TEXT,
  ADD COLUMN IF NOT EXISTS indicative_rate     NUMERIC(20, 8),
  ADD COLUMN IF NOT EXISTS final_execution_rate NUMERIC(20, 8),
  ADD COLUMN IF NOT EXISTS idempotency_key     TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS tax_act_version     TEXT DEFAULT '2025';

-- Unique constraint on idempotency_key per user (prevents duplicate transfers)
CREATE UNIQUE INDEX IF NOT EXISTS transfers_idempotency_key_user_id_idx
  ON public.transfers (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Copy old column values into new columns
UPDATE public.transfers
  SET form145_part     = fifteen_ca_part,
      form146_required = (fifteen_ca_part = 'C'),
      form146_number   = fifteen_cb_number,
      form145_number   = fifteen_ca_number,
      indicative_rate  = exchange_rate,
      tax_act_version  = CASE
        WHEN created_at >= '2026-04-01' THEN '2025'
        ELSE '1961'
      END
  WHERE form145_part IS NULL;

-- Update status values from old to new naming
UPDATE public.transfers
  SET status = 'form146_requested'
  WHERE status = '15cb_requested';

UPDATE public.transfers
  SET status = 'form146_received'
  WHERE status = '15cb_received';

UPDATE public.transfers
  SET status = 'form145_filed'
  WHERE status = '15ca_filed';

-- ── TABLE: compliance_requests ────────────────────────────────────────────────

ALTER TABLE public.compliance_requests
  ADD COLUMN IF NOT EXISTS form145_part     TEXT,
  ADD COLUMN IF NOT EXISTS form146_required BOOLEAN DEFAULT false;

UPDATE public.compliance_requests
  SET form145_part     = fifteen_ca_part,
      form146_required = COALESCE(fifteen_cb_required, false)
  WHERE form145_part IS NULL;

-- ── TABLE: transfer_events ────────────────────────────────────────────────────

UPDATE public.transfer_events
  SET status = 'form146_requested'
  WHERE status = '15cb_requested';

UPDATE public.transfer_events
  SET status = 'form146_received'
  WHERE status = '15cb_received';

UPDATE public.transfer_events
  SET status = 'form145_filed'
  WHERE status = '15ca_filed';

-- ── Confirmation ──────────────────────────────────────────────────────────────
SELECT
  'Migration 016 complete' AS status,
  COUNT(*) FILTER (WHERE status = 'form146_requested') AS form146_requested_count,
  COUNT(*) FILTER (WHERE status = 'form146_received')  AS form146_received_count,
  COUNT(*) FILTER (WHERE status = 'form145_filed')     AS form145_filed_count,
  COUNT(*) FILTER (WHERE tax_act_version = '2025')     AS act_2025_transfers,
  COUNT(*) FILTER (WHERE tax_act_version = '1961')     AS act_1961_transfers
FROM public.transfers;

-- ═══════════════════════════════════════════════════════════════════════════
-- 017_enable_rls.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 017 — Enable Row Level Security on all customer-facing tables
-- RUN IN SUPABASE SQL EDITOR MANUALLY
-- ═══════════════════════════════════════════════════════════════════════════
-- PIPEDA REQUIREMENT: Users must only be able to read their own data.
-- Backend routes use SERVICE_ROLE_KEY which bypasses RLS (intended).
-- Frontend (if it calls Supabase directly) uses ANON_KEY and IS RLS-protected.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── TABLE: transfers ─────────────────────────────────────────────────────────

ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own transfers"   ON public.transfers;
DROP POLICY IF EXISTS "Users insert own transfers" ON public.transfers;
DROP POLICY IF EXISTS "Service role bypasses RLS"  ON public.transfers;

CREATE POLICY "Users see own transfers" ON public.transfers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own transfers" ON public.transfers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role bypasses RLS" ON public.transfers
  FOR ALL USING (auth.role() = 'service_role');

-- ── TABLE: inward_transfers ───────────────────────────────────────────────────

ALTER TABLE public.inward_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own inward transfers" ON public.inward_transfers;
DROP POLICY IF EXISTS "Service role bypasses"          ON public.inward_transfers;

CREATE POLICY "Users see own inward transfers" ON public.inward_transfers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role bypasses" ON public.inward_transfers
  FOR ALL USING (auth.role() = 'service_role');

-- ── TABLE: profiles ───────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own profile"    ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role bypasses"    ON public.profiles;

CREATE POLICY "Users see own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Service role bypasses" ON public.profiles
  FOR ALL USING (auth.role() = 'service_role');

-- ── TABLE: kyc_submissions ────────────────────────────────────────────────────

ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own KYC"     ON public.kyc_submissions;
DROP POLICY IF EXISTS "Service role bypasses" ON public.kyc_submissions;

CREATE POLICY "Users see own KYC" ON public.kyc_submissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role bypasses" ON public.kyc_submissions
  FOR ALL USING (auth.role() = 'service_role');

-- ── TABLE: canada_bank_accounts ───────────────────────────────────────────────

ALTER TABLE public.canada_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own accounts" ON public.canada_bank_accounts;
DROP POLICY IF EXISTS "Service role bypasses"  ON public.canada_bank_accounts;

CREATE POLICY "Users see own accounts" ON public.canada_bank_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role bypasses" ON public.canada_bank_accounts
  FOR ALL USING (auth.role() = 'service_role');

-- ── TABLE: india_nro_accounts ─────────────────────────────────────────────────

ALTER TABLE public.india_nro_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own NRO accounts" ON public.india_nro_accounts;
DROP POLICY IF EXISTS "Service role bypasses"       ON public.india_nro_accounts;

CREATE POLICY "Users see own NRO accounts" ON public.india_nro_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role bypasses" ON public.india_nro_accounts
  FOR ALL USING (auth.role() = 'service_role');

-- ── TABLE: user_credits ───────────────────────────────────────────────────────

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Service role bypasses" ON public.user_credits;

CREATE POLICY "Users see own credits" ON public.user_credits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role bypasses" ON public.user_credits
  FOR ALL USING (auth.role() = 'service_role');

-- ── TABLE: referrals ──────────────────────────────────────────────────────────

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own referrals" ON public.referrals;
DROP POLICY IF EXISTS "Service role bypasses"   ON public.referrals;

CREATE POLICY "Users see own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_user_id OR auth.uid() = referee_user_id);

CREATE POLICY "Service role bypasses" ON public.referrals
  FOR ALL USING (auth.role() = 'service_role');

-- ── Confirmation ──────────────────────────────────────────────────────────────
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'transfers', 'inward_transfers', 'profiles',
    'kyc_submissions', 'canada_bank_accounts',
    'india_nro_accounts', 'user_credits', 'referrals'
  )
ORDER BY tablename;

-- ═══════════════════════════════════════════════════════════════════════════
-- 018_compliance_config.sql
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 019_verify_all_seeds.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 019 — KYC config seeds + missing tables + RLS fixes
-- RUN IN SUPABASE SQL EDITOR MANUALLY
-- ═══════════════════════════════════════════════════════════════════════════
-- Fixes:
--   1. kyc_config seeds — Fable-first routing rows + correct provider names
--   2. profiles.pan_hash column — SHA-256 of PAN for Form 145 compliance
--   3. user_credits table — missing from 013, caused 017 RLS to fail
--   4. referrals table — missing from 013, caused 017 RLS to fail
--   5. RLS policies for user_credits and referrals
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. kyc_config seeds ───────────────────────────────────────────────────────

-- Fix: active_india_kyc was 'digilocker' in 013 seeds — must be 'setu_digilocker'
INSERT INTO public.kyc_config (key, value, description)
VALUES ('active_india_kyc', 'setu_digilocker', 'India KYC provider: setu_digilocker | fable')
ON CONFLICT (key) DO UPDATE
  SET description = EXCLUDED.description;

-- Fable India KYC routing switch (set to true once Fable confirms capability)
INSERT INTO public.kyc_config (key, value, description)
VALUES ('fable_india_kyc_enabled', 'false', 'Route India identity KYC to Fable (unconfirmed — see docs/FABLE_QUESTIONS.md)')
ON CONFLICT (key) DO UPDATE
  SET description = EXCLUDED.description;

-- Fable Canada KYC routing switch (set to true once Fable confirms capability)
INSERT INTO public.kyc_config (key, value, description)
VALUES ('fable_canada_kyc_enabled', 'false', 'Route Canada bank KYC to Fable (unconfirmed — see docs/FABLE_QUESTIONS.md)')
ON CONFLICT (key) DO UPDATE
  SET description = EXCLUDED.description;

-- Fable PAN verification routing switch
INSERT INTO public.kyc_config (key, value, description)
VALUES ('fable_pan_enabled', 'false', 'Route PAN verification to Fable (unconfirmed — see docs/FABLE_QUESTIONS.md)')
ON CONFLICT (key) DO UPDATE
  SET description = EXCLUDED.description;

-- Setu Reverse Penny Drop is MANDATORY — no config switch, always Setu
INSERT INTO public.kyc_config (key, value, description)
VALUES ('reverse_penny_drop_provider', 'setu', 'Inward recipient bank verification provider — always setu, Fable cannot replace')
ON CONFLICT (key) DO UPDATE
  SET description = EXCLUDED.description;

-- KYC expiry in days (2 years = 730)
INSERT INTO public.kyc_config (key, value, description)
VALUES ('kyc_expiry_days', '730', 'KYC session validity in days (PIPEDA + FEMA retention minimum)')
ON CONFLICT (key) DO UPDATE
  SET description = EXCLUDED.description;

-- Fable AML screening switch
INSERT INTO public.kyc_config (key, value, description)
VALUES ('fable_aml_screening', 'false', 'Enable Fable AML/PEP/sanctions screening (requires FABLE_API_KEY)')
ON CONFLICT (key) DO UPDATE
  SET description = EXCLUDED.description;

-- Active Canada KYC provider (flinks while Fable unconfirmed)
INSERT INTO public.kyc_config (key, value, description)
VALUES ('active_canada_kyc', 'flinks', 'Canada KYC provider: flinks | fable')
ON CONFLICT (key) DO UPDATE
  SET description = EXCLUDED.description;

-- ── 2. profiles.pan_hash column ───────────────────────────────────────────────
-- SHA-256 hash of PAN — stored for Form 145 compliance (IT Act 2025 s.397(3)(d))
-- Never store raw PAN. Hash is irreversible.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pan_hash TEXT;

-- ── 3. user_credits table ─────────────────────────────────────────────────────
-- Referenced in 017_enable_rls.sql but never created. Tracks promotional credits.

CREATE TABLE IF NOT EXISTS public.user_credits (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency    TEXT        NOT NULL DEFAULT 'CAD',
  reason      TEXT,       -- 'referral_bonus', 'promo_code', 'manual_adjustment'
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_credits_user_id_idx ON public.user_credits (user_id);

-- ── 4. referrals table ────────────────────────────────────────────────────────
-- Referenced in 017_enable_rls.sql but never created. Tracks referral relationships.

CREATE TABLE IF NOT EXISTS public.referrals (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code    TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending', -- 'pending','credited','expired'
  credited_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referee_user_id) -- one referral per referee
);

CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals (referrer_user_id);
CREATE INDEX IF NOT EXISTS referrals_code_idx     ON public.referrals (referral_code);

-- ── 5. RLS on user_credits and referrals ──────────────────────────────────────
-- (Migration 017 failed because these tables didn't exist — now they do)

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Service role bypasses" ON public.user_credits;

CREATE POLICY "Users see own credits" ON public.user_credits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role bypasses" ON public.user_credits
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own referrals" ON public.referrals;
DROP POLICY IF EXISTS "Service role bypasses"   ON public.referrals;

CREATE POLICY "Users see own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_user_id OR auth.uid() = referee_user_id);

CREATE POLICY "Service role bypasses" ON public.referrals
  FOR ALL USING (auth.role() = 'service_role');

-- ── Confirmation ──────────────────────────────────────────────────────────────
SELECT
  'Migration 019 complete' AS status,
  (SELECT COUNT(*) FROM public.kyc_config)                   AS kyc_config_rows,
  (SELECT value FROM public.kyc_config WHERE key = 'active_india_kyc')   AS active_india_kyc,
  (SELECT value FROM public.kyc_config WHERE key = 'active_canada_kyc')  AS active_canada_kyc,
  (SELECT value FROM public.kyc_config WHERE key = 'fable_india_kyc_enabled')  AS fable_india_kyc_enabled,
  (SELECT value FROM public.kyc_config WHERE key = 'fable_canada_kyc_enabled') AS fable_canada_kyc_enabled,
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'profiles' AND column_name = 'pan_hash') AS pan_hash_col_exists,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_credits') AS user_credits_exists,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referrals')    AS referrals_exists;

-- ═══════════════════════════════════════════════════════════════════════════
-- 020_referral_codes_and_schema_fixes.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 020 — referral_codes + user_credits + referrals (self-contained)
-- RUN IN SUPABASE SQL EDITOR MANUALLY
-- Safe to run even if migration 019 was never applied.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. referral_codes table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.referral_codes (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code              TEXT          NOT NULL UNIQUE,
  total_referrals   INTEGER       NOT NULL DEFAULT 0,
  total_earned_cad  NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS referral_codes_user_id_idx ON public.referral_codes (user_id);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own referral code" ON public.referral_codes;
DROP POLICY IF EXISTS "Service role bypasses RLS"    ON public.referral_codes;

CREATE POLICY "Users see own referral code" ON public.referral_codes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role bypasses RLS" ON public.referral_codes
  FOR ALL USING (auth.role() = 'service_role');

-- ── 2. user_credits table (create if not exists with correct schema) ──────────
-- referralService.ts uses: balance_cad, total_earned, total_spent, user_id

CREATE TABLE IF NOT EXISTS public.user_credits (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_cad   NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_earned  NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_spent   NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- If migration 019 ran first and created user_credits with different columns,
-- add the missing columns now (ADD COLUMN IF NOT EXISTS is idempotent):
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS balance_cad  NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earned NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_spent  NUMERIC(10,2) NOT NULL DEFAULT 0;

-- UNIQUE(user_id) required by upsert in referralService.ts:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'user_credits'
      AND constraint_name = 'user_credits_user_id_key'
  ) THEN
    ALTER TABLE public.user_credits ADD CONSTRAINT user_credits_user_id_key UNIQUE (user_id);
  END IF;
END $$;

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Service role bypasses" ON public.user_credits;

CREATE POLICY "Users see own credits" ON public.user_credits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role bypasses" ON public.user_credits
  FOR ALL USING (auth.role() = 'service_role');

-- ── 3. referrals table (create if not exists) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.referrals (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id     UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_user_id      UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code        TEXT          NOT NULL,
  status               TEXT          NOT NULL DEFAULT 'pending',
  referee_transfer_id  UUID          REFERENCES public.transfers(id),
  referrer_reward_cad  NUMERIC(10,2),
  referee_reward_type  TEXT,
  rewarded_at          TIMESTAMPTZ,
  credited_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Add missing columns if referrals was created by migration 019 without them:
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS referee_transfer_id UUID        REFERENCES public.transfers(id),
  ADD COLUMN IF NOT EXISTS referrer_reward_cad  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS referee_reward_type  TEXT,
  ADD COLUMN IF NOT EXISTS rewarded_at          TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals (referrer_user_id);
CREATE INDEX IF NOT EXISTS referrals_code_idx     ON public.referrals (referral_code);

-- Composite UNIQUE required by upsert on (referrer_user_id, referee_user_id):
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'referrals'
      AND constraint_name = 'referrals_referrer_referee_key'
  ) THEN
    ALTER TABLE public.referrals
      ADD CONSTRAINT referrals_referrer_referee_key UNIQUE (referrer_user_id, referee_user_id);
  END IF;
END $$;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own referrals" ON public.referrals;
DROP POLICY IF EXISTS "Service role bypasses referrals" ON public.referrals;

CREATE POLICY "Users see own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_user_id OR auth.uid() = referee_user_id);

CREATE POLICY "Service role bypasses referrals" ON public.referrals
  FOR ALL USING (auth.role() = 'service_role');

-- ── 4. profiles.pan_hash column ───────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pan_hash TEXT;

-- ── 5. kyc_config seeds ───────────────────────────────────────────────────────

INSERT INTO public.kyc_config (key, value, description)
VALUES
  ('active_india_kyc',          'setu_digilocker', 'India KYC provider: setu_digilocker | fable'),
  ('active_canada_kyc',         'flinks',           'Canada KYC provider: flinks | fable'),
  ('fable_india_kyc_enabled',   'false',            'Route India identity KYC to Fable'),
  ('fable_canada_kyc_enabled',  'false',            'Route Canada bank KYC to Fable'),
  ('fable_pan_enabled',         'false',            'Route PAN verification to Fable'),
  ('fable_aml_screening',       'false',            'Enable Fable AML/PEP screening'),
  ('reverse_penny_drop_provider','setu',            'Inward recipient bank verification — always setu'),
  ('kyc_expiry_days',           '730',              'KYC session validity in days')
ON CONFLICT (key) DO NOTHING;

-- ── Confirmation ──────────────────────────────────────────────────────────────
SELECT
  'Migration 020 complete' AS status,
  EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='referral_codes') AS referral_codes_exists,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_credits' AND column_name='balance_cad') AS user_credits_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='referrals' AND column_name='rewarded_at') AS referrals_ok;

-- ═══════════════════════════════════════════════════════════════════════════
-- 021_missing_columns_and_fee_config.sql
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 022_compliance_requests_it_act_2025.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 022 — compliance_requests: IT Act 2025 column aliases + backfill
-- Safe to run multiple times (IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- RUN IN SUPABASE SQL EDITOR.

-- ── Add missing columns to compliance_requests ────────────────────────────────
ALTER TABLE public.compliance_requests
  ADD COLUMN IF NOT EXISTS form145_part        TEXT,
  ADD COLUMN IF NOT EXISTS form146_required    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS form145_number      TEXT,
  ADD COLUMN IF NOT EXISTS form146_number      TEXT;

-- ── Backfill from existing fifteen_ca_* columns ───────────────────────────────
UPDATE public.compliance_requests
SET
  form145_part     = fifteen_ca_part,
  form146_required = COALESCE(fifteen_cb_required, false),
  form145_number   = fifteen_ca_number,
  form146_number   = fifteen_cb_number
WHERE form145_part IS NULL;

-- ── Auto-create compliance_request for the ₹6L transfer that missed it ────────
-- Insert any transfer that has no matching compliance_request yet.
INSERT INTO public.compliance_requests (transfer_id, user_id, status, fifteen_ca_part, fifteen_cb_required, form145_part, form146_required)
SELECT
  t.id,
  t.user_id,
  CASE
    WHEN t.risk_level = 'HIGH' THEN 'pending'
    WHEN t.ca_required = true  THEN 'under_review'
    ELSE 'approved'
  END,
  COALESCE(t.form145_part, t.fifteen_ca_part, 'C'),
  t.amount_inr >= 500000,
  COALESCE(t.form145_part, t.fifteen_ca_part, 'C'),
  t.amount_inr >= 500000
FROM public.transfers t
WHERE NOT EXISTS (
  SELECT 1 FROM public.compliance_requests cr WHERE cr.transfer_id = t.id
)
AND t.amount_inr IS NOT NULL;

SELECT
  'Migration 022 complete' AS status,
  COUNT(*) AS compliance_requests_total
FROM public.compliance_requests;

-- ═══════════════════════════════════════════════════════════════════════════
-- 023_storage_bucket_and_doc_types.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 023 — Create wallet-docs storage bucket + expand doc_type CHECK
-- RUN IN SUPABASE SQL EDITOR.
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT DO NOTHING).

-- ── 1. Create wallet-docs storage bucket if it doesn't exist ─────────────────
-- The wallet-docs bucket is PRIVATE. All access is via server-side signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wallet-docs',
  'wallet-docs',
  false,
  52428800,   -- 50 MB max file size
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Expand wallet_documents.doc_type CHECK constraint ─────────────────────
-- Original constraint (migration 005) only had 15ca_pdf / 15cb_pdf.
-- Add form145_pdf / form146_pdf for IT Act 2025 naming.
ALTER TABLE public.wallet_documents
  DROP CONSTRAINT IF EXISTS wallet_documents_doc_type_check;

ALTER TABLE public.wallet_documents
  ADD CONSTRAINT wallet_documents_doc_type_check CHECK (
    doc_type IN (
      'bank_statement',
      'tds_certificate',
      'pan_card',
      'aadhaar',
      'property_deed',
      'investment_proof',
      '15ca_pdf',       -- IT Act 1961 legacy (keep for backward compat)
      '15cb_pdf',       -- IT Act 1961 legacy (keep for backward compat)
      'form145_pdf',    -- IT Act 2025 (Form 145 = formerly 15CA)
      'form146_pdf',    -- IT Act 2025 (Form 146 = formerly 15CB)
      'other'
    )
  );

-- ── 3. Storage RLS policies for service-role access ──────────────────────────
-- The Express backend uses SUPABASE_SERVICE_KEY (supabaseAdmin) which bypasses RLS.
-- No additional policies needed for server-side uploads.
-- If you want to block direct public access, ensure bucket public = false (already set above).

SELECT
  'Migration 023 complete' AS status,
  (SELECT COUNT(*) FROM storage.buckets WHERE id = 'wallet-docs') AS wallet_docs_bucket_exists,
  (SELECT COUNT(*) FROM information_schema.table_constraints
   WHERE table_name = 'wallet_documents'
   AND constraint_name = 'wallet_documents_doc_type_check') AS doc_type_constraint_exists;

-- ═══════════════════════════════════════════════════════════════════════════
-- 024_pan_udin_compliance.sql
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 025_outward_fee_tiers.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════════════
-- 025 — Outward fee tiers (NRO repatriation slab pricing)
-- ═══════════════════════════════════════════════════════════════════════════
-- Adds a tier-based commission table for OUTWARD (India -> Canada) transfers.
-- Replaces the single flat 1.8% commission previously read from fee_config
-- with a 5-slab structure that scales with transfer size.
--
-- Future rate changes:
--   UPDATE outward_fee_tiers SET commission_rate = 0.0150 WHERE slab_min_inr = 1000001;
-- The next call to feeService picks up the new value (5-min in-memory cache).
--
-- Tier rationale (Option C — see commit message for full reasoning):
--   0     ->  5L   1.80%    no CA needed (Form 145 Part A)
--   5L    -> 10L   2.00%    Form 146 + CA absorbed
--   10L   -> 20L   1.75%    volume nudge starts
--   20L   -> 50L   1.25%    high-net-worth retention; flat fee waived >= 30L
--   50L+         1.00%    concierge tier, flat fee waived
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.outward_fee_tiers (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  slab_min_inr       BIGINT        NOT NULL,                  -- inclusive
  slab_max_inr       BIGINT,                                  -- inclusive; NULL = unbounded
  commission_rate    DECIMAL(6,4)  NOT NULL,                  -- 0.0180 = 1.80%
  flat_fee_cad       DECIMAL(10,2) NOT NULL DEFAULT 24.99,
  waive_flat_fee     BOOLEAN       NOT NULL DEFAULT false,
  flat_fee_waive_above_inr BIGINT,                            -- waive flat when amount >= this; NULL = never
  label              TEXT          NOT NULL,                  -- 'Below ₹5L', '₹50L+', etc.
  is_active          BOOLEAN       NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CHECK (slab_max_inr IS NULL OR slab_max_inr >= slab_min_inr),
  CHECK (commission_rate >= 0 AND commission_rate <= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_outward_fee_tiers_slab
  ON public.outward_fee_tiers(slab_min_inr)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_outward_fee_tiers_active
  ON public.outward_fee_tiers(is_active, slab_min_inr);

-- Seed Option C tiers ────────────────────────────────────────────────────────
INSERT INTO public.outward_fee_tiers
  (slab_min_inr, slab_max_inr, commission_rate, flat_fee_cad, waive_flat_fee, flat_fee_waive_above_inr, label)
VALUES
  (0,         500000,   0.0180, 24.99, false, NULL,    'Up to ₹5L'),
  (500001,    1000000,  0.0200, 24.99, false, NULL,    '₹5L – ₹10L'),
  (1000001,   2000000,  0.0175, 24.99, false, NULL,    '₹10L – ₹20L'),
  (2000001,   5000000,  0.0125, 24.99, false, 3000000, '₹20L – ₹50L'),
  (5000001,   NULL,     0.0100, 0.00,  true,  NULL,    '₹50L and above')
ON CONFLICT DO NOTHING;

-- RLS — public can read tiers (used by /fees/tiers endpoint), service role manages
ALTER TABLE public.outward_fee_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outward_fee_tiers_public_read"  ON public.outward_fee_tiers;
DROP POLICY IF EXISTS "outward_fee_tiers_service_role" ON public.outward_fee_tiers;

CREATE POLICY "outward_fee_tiers_public_read"
  ON public.outward_fee_tiers
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "outward_fee_tiers_service_role"
  ON public.outward_fee_tiers
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
