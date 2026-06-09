-- Idempotent auth core tables for Google login profile lookup and app_state sync.
-- Safe to run in Supabase SQL editor if earlier migrations were skipped or partially applied.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.profiles
  add column if not exists role text not null default 'restaurateur',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_state (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.app_state
  add column if not exists state jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles enable row level security;
alter table public.app_state enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = user_id);

drop policy if exists "profiles_upsert_own" on public.profiles;
create policy "profiles_upsert_own"
on public.profiles for insert
with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "app_state_select_own" on public.app_state;
create policy "app_state_select_own"
on public.app_state for select
using (auth.uid() = user_id);

drop policy if exists "app_state_upsert_own" on public.app_state;
create policy "app_state_upsert_own"
on public.app_state for insert
with check (auth.uid() = user_id);

drop policy if exists "app_state_update_own" on public.app_state;
create policy "app_state_update_own"
on public.app_state for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.app_state to authenticated;
