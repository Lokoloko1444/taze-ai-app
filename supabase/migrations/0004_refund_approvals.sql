-- Stripe checkout + refund approval ledger
-- Apply after the previous migrations.

create table if not exists public.stripe_checkout_payments (
  checkout_session_id text primary key,
  customer_email text not null,
  plan_id text not null,
  interval text not null,
  amount_total integer not null default 0,
  currency text not null default 'EUR',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  payment_status text not null default 'completed',
  refund_status text not null default 'none',
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.refund_requests (
  id text primary key,
  checkout_session_id text not null references public.stripe_checkout_payments (checkout_session_id) on delete cascade,
  customer_email text not null,
  plan_id text not null,
  interval text not null,
  reason text not null default '',
  requester_email text,
  invoice_number text,
  support_email text not null,
  approval_token_hash text not null,
  approval_expires_at timestamptz not null,
  status text not null default 'pending',
  amount_total integer not null default 0,
  currency text not null default 'EUR',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_refund_id text,
  stripe_refund_error text,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  refunded_at timestamptz,
  rejected_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists stripe_checkout_payments_customer_lookup_idx
  on public.stripe_checkout_payments (customer_email, plan_id, interval, refund_status, created_at desc);

create index if not exists stripe_checkout_payments_subscription_idx
  on public.stripe_checkout_payments (stripe_subscription_id);

create index if not exists refund_requests_token_idx
  on public.refund_requests (approval_token_hash);

create index if not exists refund_requests_payment_idx
  on public.refund_requests (checkout_session_id, status, requested_at desc);

alter table public.stripe_checkout_payments enable row level security;
alter table public.refund_requests enable row level security;
