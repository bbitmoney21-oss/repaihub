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
