-- Temperature logs for cold-chain scan proof.
-- Safe to run after trace_events exists.

create table if not exists public.temperature_logs (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  trace_event_id text references public.trace_events (id) on delete set null,
  location text not null,
  temperature_celsius numeric not null,
  temperature_source text not null default 'manual',
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  note text not null default ''
);

create index if not exists temperature_logs_user_recorded_idx
  on public.temperature_logs (user_id, recorded_at desc);

create index if not exists temperature_logs_trace_event_idx
  on public.temperature_logs (trace_event_id);

create index if not exists temperature_logs_location_recorded_idx
  on public.temperature_logs (user_id, location, recorded_at desc);

alter table public.temperature_logs enable row level security;

drop policy if exists "temperature_logs_select_own" on public.temperature_logs;
create policy "temperature_logs_select_own"
on public.temperature_logs for select
using (auth.uid() = user_id);

drop policy if exists "temperature_logs_insert_own" on public.temperature_logs;
create policy "temperature_logs_insert_own"
on public.temperature_logs for insert
with check (auth.uid() = user_id);

drop policy if exists "temperature_logs_update_own" on public.temperature_logs;
create policy "temperature_logs_update_own"
on public.temperature_logs for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update on public.temperature_logs to authenticated;
