-- Transport preferences sync table
-- Apply after 0002_invoice_and_trace_sync.sql

create table if not exists public.transport_preferences (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  app_id text not null,
  scope_type text not null,
  scope_value text not null,
  kind text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transport_preferences_user_created_idx
  on public.transport_preferences (user_id, created_at desc);

create index if not exists transport_preferences_scope_idx
  on public.transport_preferences (user_id, scope_type, scope_value, kind);

create index if not exists transport_preferences_app_idx
  on public.transport_preferences (user_id, app_id);

alter table public.transport_preferences enable row level security;

drop policy if exists "transport_preferences_select_own" on public.transport_preferences;
create policy "transport_preferences_select_own"
on public.transport_preferences for select
using (auth.uid() = user_id);

drop policy if exists "transport_preferences_insert_own" on public.transport_preferences;
create policy "transport_preferences_insert_own"
on public.transport_preferences for insert
with check (auth.uid() = user_id);

drop policy if exists "transport_preferences_update_own" on public.transport_preferences;
create policy "transport_preferences_update_own"
on public.transport_preferences for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "transport_preferences_delete_own" on public.transport_preferences;
create policy "transport_preferences_delete_own"
on public.transport_preferences for delete
using (auth.uid() = user_id);
