-- Core tables for auth/roles + cloud state sync
-- Apply this in Supabase SQL editor (or migrations).

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'restaurateur',
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.app_state enable row level security;

-- profiles: user can read/write own profile only
create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = user_id);

create policy "profiles_upsert_own"
on public.profiles for insert
with check (auth.uid() = user_id);

create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- app_state: user can read/write own state only
create policy "app_state_select_own"
on public.app_state for select
using (auth.uid() = user_id);

create policy "app_state_upsert_own"
on public.app_state for insert
with check (auth.uid() = user_id);

create policy "app_state_update_own"
on public.app_state for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
