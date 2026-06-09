-- Invoice + trace sync tables for finance and operational history
-- Apply after 0001_init.sql

create table if not exists public.invoice_history (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'concept',
  sync_state text not null default 'local',
  saved_from text not null default 'manual',
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.invoice_event_log (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  invoice_id text not null,
  invoice_number text not null,
  kind text not null,
  label text not null,
  detail text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trace_events (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_kind text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  item_id text,
  item_name text not null,
  location text,
  from_location text,
  to_location text,
  quantity numeric not null default 1,
  source text not null default 'unknown',
  barcode text,
  batch_code text,
  lot_number text,
  confidence numeric,
  expiry_days integer,
  note text not null default ''
);

create index if not exists invoice_history_user_saved_at_idx
  on public.invoice_history (user_id, saved_at desc);

create index if not exists invoice_history_status_idx
  on public.invoice_history (user_id, status);

create index if not exists invoice_history_payload_gin_idx
  on public.invoice_history
  using gin (payload);

create index if not exists invoice_event_log_invoice_created_idx
  on public.invoice_event_log (user_id, invoice_id, created_at desc);

create index if not exists trace_events_user_created_idx
  on public.trace_events (user_id, created_at desc);

create index if not exists trace_events_item_created_idx
  on public.trace_events (user_id, item_name, created_at desc);

alter table public.invoice_history enable row level security;
alter table public.invoice_event_log enable row level security;
alter table public.trace_events enable row level security;

drop policy if exists "invoice_history_select_own" on public.invoice_history;
create policy "invoice_history_select_own"
on public.invoice_history for select
using (auth.uid() = user_id);

drop policy if exists "invoice_history_insert_own" on public.invoice_history;
create policy "invoice_history_insert_own"
on public.invoice_history for insert
with check (auth.uid() = user_id);

drop policy if exists "invoice_history_update_own" on public.invoice_history;
create policy "invoice_history_update_own"
on public.invoice_history for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "invoice_event_log_select_own" on public.invoice_event_log;
create policy "invoice_event_log_select_own"
on public.invoice_event_log for select
using (auth.uid() = user_id);

drop policy if exists "invoice_event_log_insert_own" on public.invoice_event_log;
create policy "invoice_event_log_insert_own"
on public.invoice_event_log for insert
with check (auth.uid() = user_id);

drop policy if exists "invoice_event_log_update_own" on public.invoice_event_log;
create policy "invoice_event_log_update_own"
on public.invoice_event_log for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "trace_events_select_own" on public.trace_events;
create policy "trace_events_select_own"
on public.trace_events for select
using (auth.uid() = user_id);

drop policy if exists "trace_events_insert_own" on public.trace_events;
create policy "trace_events_insert_own"
on public.trace_events for insert
with check (auth.uid() = user_id);

drop policy if exists "trace_events_update_own" on public.trace_events;
create policy "trace_events_update_own"
on public.trace_events for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
