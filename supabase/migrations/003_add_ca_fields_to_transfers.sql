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
