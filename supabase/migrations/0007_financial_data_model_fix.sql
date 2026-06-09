-- Financial Data Model Fix V1
-- Add company_id to financial tables for RLS policies
-- Apply after the previous migrations.

-- Add company_id to stripe_checkout_payments (nullable for existing data)
alter table public.stripe_checkout_payments
add column if not exists company_id uuid references public.companies (id) on delete cascade;

-- Add company_id to refund_requests (not null since always created by authenticated users)
alter table public.refund_requests
add column if not exists company_id uuid not null references public.companies (id) on delete cascade;

-- Add index for company-based queries
create index if not exists stripe_checkout_payments_company_idx
  on public.stripe_checkout_payments (company_id, created_at desc);

create index if not exists refund_requests_company_idx
  on public.refund_requests (company_id, status, requested_at desc);

-- ============================================================================
-- Financial Permissions
-- ============================================================================
insert into public.permissions (permission_key, label, description, category)
values
  ('finance.read', 'Financiële data lezen', 'Betalings- en terugbetalingsgegevens bekijken.', 'finance'),
  ('finance.manage', 'Financiële data beheren', 'Betalingen, terugbetalingen en factuurgegevens beheren.', 'finance')
on conflict (permission_key) do nothing;

-- Add financial permissions to OWNER role (if not already assigned)
insert into public.role_permissions (role, permission_key)
values
  ('OWNER', 'finance.read'),
  ('OWNER', 'finance.manage')
on conflict (role, permission_key) do nothing;

-- Add finance.read permission to MANAGER role (requires explicit permission check for manage)
insert into public.role_permissions (role, permission_key)
values
  ('MANAGER', 'finance.read')
on conflict (role, permission_key) do nothing;

-- ============================================================================
-- RLS Policies for stripe_checkout_payments
-- ============================================================================
-- SELECT: Only company members with finance.read permission or OWNER role
drop policy if exists "stripe_checkout_payments_select_finance_read" on public.stripe_checkout_payments;
create policy "stripe_checkout_payments_select_finance_read"
on public.stripe_checkout_payments for select
using (
  public.has_company_permission(company_id, 'finance.read')
);

-- INSERT: Only backend/admin with finance.manage permission (strictly controlled server-side)
-- This policy requires explicit permission, preventing workfloor/chauffeur/unauthorized manager access
drop policy if exists "stripe_checkout_payments_insert_finance_manage" on public.stripe_checkout_payments;
create policy "stripe_checkout_payments_insert_finance_manage"
on public.stripe_checkout_payments for insert
with check (
  public.has_company_permission(company_id, 'finance.manage')
);

-- UPDATE: Only backend/admin with finance.manage permission
drop policy if exists "stripe_checkout_payments_update_finance_manage" on public.stripe_checkout_payments;
create policy "stripe_checkout_payments_update_finance_manage"
on public.stripe_checkout_payments for update
using (
  public.has_company_permission(company_id, 'finance.manage')
)
with check (
  public.has_company_permission(company_id, 'finance.manage')
);

-- DELETE: Only OWNER with finance.manage permission (restrict delete operations)
drop policy if exists "stripe_checkout_payments_delete_owner_only" on public.stripe_checkout_payments;
create policy "stripe_checkout_payments_delete_owner_only"
on public.stripe_checkout_payments for delete
using (
  public.is_company_owner(company_id)
  and public.has_company_permission(company_id, 'finance.manage')
);

-- ============================================================================
-- RLS Policies for refund_requests
-- ============================================================================
-- SELECT: Only company members with finance.read permission or OWNER role
drop policy if exists "refund_requests_select_finance_read" on public.refund_requests;
create policy "refund_requests_select_finance_read"
on public.refund_requests for select
using (
  public.has_company_permission(company_id, 'finance.read')
);

-- INSERT: Only backend/admin with finance.manage permission
drop policy if exists "refund_requests_insert_finance_manage" on public.refund_requests;
create policy "refund_requests_insert_finance_manage"
on public.refund_requests for insert
with check (
  public.has_company_permission(company_id, 'finance.manage')
);

-- UPDATE: Only backend/admin with finance.manage permission (for refund approval workflows)
drop policy if exists "refund_requests_update_finance_manage" on public.refund_requests;
create policy "refund_requests_update_finance_manage"
on public.refund_requests for update
using (
  public.has_company_permission(company_id, 'finance.manage')
)
with check (
  public.has_company_permission(company_id, 'finance.manage')
);

-- DELETE: Only OWNER with finance.manage permission
drop policy if exists "refund_requests_delete_owner_only" on public.refund_requests;
create policy "refund_requests_delete_owner_only"
on public.refund_requests for delete
using (
  public.is_company_owner(company_id)
  and public.has_company_permission(company_id, 'finance.manage')
);