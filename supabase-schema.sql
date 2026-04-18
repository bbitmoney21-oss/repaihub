-- ── Profiles ─────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid references auth.users primary key,
  email         text not null,
  full_name     text,
  phone         text,
  address       text,
  residency_status text,
  annual_limit_used  numeric default 0,
  annual_limit_total numeric default 83000,
  created_at    timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "profiles_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- ── Canada bank accounts ──────────────────────────────────────────────────────
create table if not exists public.canada_bank_accounts (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users not null,
  institution  text not null,
  holder_name  text not null,
  account_type text default 'Chequing',
  verified_at  timestamptz default now(),
  created_at   timestamptz default now()
);

alter table public.canada_bank_accounts enable row level security;
create policy "canada_all" on public.canada_bank_accounts for all using (auth.uid() = user_id);

-- ── India NRO accounts ────────────────────────────────────────────────────────
create table if not exists public.india_nro_accounts (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users not null,
  bank_name  text not null,
  branch     text not null,
  verified_at timestamptz default now(),
  created_at  timestamptz default now()
);

alter table public.india_nro_accounts enable row level security;
create policy "india_all" on public.india_nro_accounts for all using (auth.uid() = user_id);

-- ── KYC submissions ───────────────────────────────────────────────────────────
create table if not exists public.kyc_submissions (
  id                 uuid default gen_random_uuid() primary key,
  user_id            uuid references auth.users not null unique,
  canada_verified    boolean default false,
  canada_verified_at timestamptz,
  india_verified     boolean default false,
  india_verified_at  timestamptz,
  expires_at         timestamptz,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

alter table public.kyc_submissions enable row level security;
create policy "kyc_all" on public.kyc_submissions for all using (auth.uid() = user_id);

-- ── Transfers ─────────────────────────────────────────────────────────────────
create table if not exists public.transfers (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users not null,
  amount_inr      numeric not null,
  amount_cad      numeric not null,
  exchange_rate   numeric not null,
  fee_cad         numeric not null,
  speed           text not null default 'standard',
  status          text not null default 'initiated',
  source_of_funds text,
  purpose_code    text,
  fintrac_report  boolean default false,
  reference       text,
  created_at      timestamptz default now(),
  completed_at    timestamptz
);

alter table public.transfers enable row level security;
create policy "transfers_all" on public.transfers for all using (auth.uid() = user_id);

-- ── Transfer events ───────────────────────────────────────────────────────────
create table if not exists public.transfer_events (
  id          uuid default gen_random_uuid() primary key,
  transfer_id uuid references public.transfers not null,
  user_id     uuid references auth.users not null,
  status      text not null,
  note        text,
  created_at  timestamptz default now()
);

alter table public.transfer_events enable row level security;
create policy "events_all" on public.transfer_events for all using (auth.uid() = user_id);

-- ── Notifications ─────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users not null,
  message    text not null,
  type       text not null default 'info',
  read       boolean default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;
create policy "notifications_all" on public.notifications for all using (auth.uid() = user_id);
