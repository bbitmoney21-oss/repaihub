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
