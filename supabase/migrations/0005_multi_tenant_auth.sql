-- Multi-tenant auth, company membership and AI governance
-- Apply after the previous migrations.

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  legal_name text,
  slug text not null unique,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_branches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  slug text not null,
  code text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, slug)
);

create table if not exists public.auth_provider_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  provider_account_id text not null,
  provider_email text,
  email_verified boolean not null default false,
  access_token_encrypted text,
  refresh_token_encrypted text,
  scopes text[] not null default '{}'::text[],
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_account_id),
  unique (user_id, provider)
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  branch_id uuid references public.company_branches (id) on delete set null,
  role text not null,
  permissions text[] not null default '{}'::text[],
  status text not null default 'ACTIVE',
  is_primary boolean not null default false,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role in ('OWNER', 'MANAGER', 'WERKVLOER', 'CHAUFFEUR')),
  check (status in ('ACTIVE', 'INVITED', 'SUSPENDED', 'PENDING')),
  unique (user_id, company_id, branch_id)
);

create table if not exists public.membership_functions (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships (id) on delete cascade,
  function_area text not null,
  created_at timestamptz not null default now(),
  unique (membership_id, function_area),
  check (function_area in ('BAR', 'KEUKEN', 'AFGEWERKT_PRODUCT', 'DISTRIBUTIE', 'MAGAZIJN', 'INKOOP', 'ADMIN'))
);

create table if not exists public.permissions (
  permission_key text primary key,
  label text not null,
  description text not null default '',
  category text not null default 'general',
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  permission_key text not null references public.permissions (permission_key) on delete cascade,
  created_at timestamptz not null default now(),
  unique (role, permission_key),
  check (role in ('OWNER', 'MANAGER', 'WERKVLOER', 'CHAUFFEUR'))
);

create table if not exists public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  branch_id uuid references public.company_branches (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_for_role text not null,
  created_for_function text not null,
  suggestion_type text not null,
  status text not null default 'PENDING',
  suggested_action text not null,
  confidence numeric not null default 0,
  source_screen text,
  model text,
  context jsonb not null default '{}'::jsonb,
  approved_by uuid references auth.users (id) on delete set null,
  rejected_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  rejected_at timestamptz,
  executed_at timestamptz,
  execution_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (created_for_role in ('OWNER', 'MANAGER', 'WERKVLOER', 'CHAUFFEUR')),
  check (created_for_function in ('BAR', 'KEUKEN', 'AFGEWERKT_PRODUCT', 'DISTRIBUTIE', 'MAGAZIJN', 'INKOOP', 'ADMIN')),
  check (status in ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED'))
);

create table if not exists public.ai_action_logs (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid references public.ai_suggestions (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  branch_id uuid references public.company_branches (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_role text,
  actor_function text,
  action text not null,
  outcome text not null,
  detail text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  branch_id uuid references public.company_branches (id) on delete set null,
  name text not null,
  category text not null default 'Algemeen',
  barcode text,
  unit text not null default 'st',
  quantity numeric not null default 0,
  expiry_days integer,
  status text not null default 'ACTIVE',
  confidence numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  branch_id uuid references public.company_branches (id) on delete set null,
  inventory_item_id uuid references public.inventory_items (id) on delete set null,
  movement_type text not null,
  quantity numeric not null default 1,
  reason text not null default '',
  source text not null default 'manual',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  branch_id uuid references public.company_branches (id) on delete set null,
  assigned_to uuid references auth.users (id) on delete set null,
  status text not null default 'PLANNED',
  route jsonb not null default '{}'::jsonb,
  proof jsonb not null default '{}'::jsonb,
  notes text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('PLANNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'REJECTED', 'DAMAGED'))
);

create index if not exists companies_owner_idx on public.companies (owner_user_id, created_at desc);
create index if not exists companies_slug_idx on public.companies (slug);
create index if not exists company_branches_company_idx on public.company_branches (company_id, created_at desc);
create index if not exists company_branches_slug_idx on public.company_branches (company_id, slug);
create index if not exists auth_provider_accounts_user_idx on public.auth_provider_accounts (user_id, created_at desc);
create index if not exists auth_provider_accounts_provider_idx on public.auth_provider_accounts (provider, provider_account_id);
create index if not exists memberships_company_idx on public.memberships (company_id, branch_id, user_id, role, status, created_at desc);
create index if not exists memberships_user_idx on public.memberships (user_id, status, created_at desc);
create index if not exists memberships_role_idx on public.memberships (role, status);
create index if not exists membership_functions_membership_idx on public.membership_functions (membership_id, function_area);
create index if not exists permissions_category_idx on public.permissions (category, permission_key);
create index if not exists role_permissions_role_idx on public.role_permissions (role, permission_key);
create index if not exists ai_suggestions_company_idx on public.ai_suggestions (company_id, branch_id, status, created_at desc);
create index if not exists ai_action_logs_company_idx on public.ai_action_logs (company_id, created_at desc);
create index if not exists inventory_items_company_idx on public.inventory_items (company_id, branch_id, barcode, status, created_at desc);
create index if not exists stock_movements_company_idx on public.stock_movements (company_id, branch_id, created_at desc);
create index if not exists delivery_tasks_company_idx on public.delivery_tasks (company_id, branch_id, status, created_at desc);

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.company_id = target_company_id
      and m.user_id = auth.uid()
      and m.status = 'ACTIVE'
  );
$$;

create or replace function public.is_company_owner(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.company_id = target_company_id
      and m.user_id = auth.uid()
      and m.status = 'ACTIVE'
      and m.role = 'OWNER'
  );
$$;

create or replace function public.has_company_permission(target_company_id uuid, required_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.company_id = target_company_id
      and m.user_id = auth.uid()
      and m.status = 'ACTIVE'
      and (
        m.role = 'OWNER'
        or required_permission = any(coalesce(m.permissions, '{}'::text[]))
        or exists (
          select 1
          from public.role_permissions rp
          where rp.role = m.role
            and rp.permission_key = required_permission
        )
      )
  );
$$;

create or replace function public.is_branch_member(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.branch_id = target_branch_id
      and m.user_id = auth.uid()
      and m.status = 'ACTIVE'
  );
$$;

create or replace view public.user_company_branch as
select
  m.id as membership_id,
  m.user_id,
  m.company_id,
  m.branch_id,
  m.role,
  m.permissions,
  m.status,
  m.is_primary,
  m.created_at as membership_created_at,
  m.updated_at as membership_updated_at,
  c.name as company_name,
  c.legal_name as company_legal_name,
  c.slug as company_slug,
  c.status as company_status,
  b.name as branch_name,
  b.code as branch_code,
  b.slug as branch_slug,
  b.status as branch_status
from public.memberships m
join public.companies c on c.id = m.company_id
left join public.company_branches b on b.id = m.branch_id;

alter table public.companies enable row level security;
alter table public.company_branches enable row level security;
alter table public.auth_provider_accounts enable row level security;
alter table public.memberships enable row level security;
alter table public.membership_functions enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.ai_suggestions enable row level security;
alter table public.ai_action_logs enable row level security;
alter table public.inventory_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.delivery_tasks enable row level security;

drop policy if exists "companies_select_member" on public.companies;
create policy "companies_select_member"
on public.companies for select
using (public.is_company_member(id));

drop policy if exists "companies_insert_owner" on public.companies;
create policy "companies_insert_owner"
on public.companies for insert
with check (auth.uid() = owner_user_id);

drop policy if exists "companies_update_owner" on public.companies;
create policy "companies_update_owner"
on public.companies for update
using (public.is_company_owner(id))
with check (public.is_company_owner(id));

drop policy if exists "companies_delete_owner" on public.companies;
create policy "companies_delete_owner"
on public.companies for delete
using (public.is_company_owner(id));

drop policy if exists "company_branches_select_member" on public.company_branches;
create policy "company_branches_select_member"
on public.company_branches for select
using (public.is_company_member(company_id));

drop policy if exists "company_branches_insert_manage" on public.company_branches;
create policy "company_branches_insert_manage"
on public.company_branches for insert
with check (public.has_company_permission(company_id, 'branch.manage'));

drop policy if exists "company_branches_update_manage" on public.company_branches;
create policy "company_branches_update_manage"
on public.company_branches for update
using (public.has_company_permission(company_id, 'branch.manage'))
with check (public.has_company_permission(company_id, 'branch.manage'));

drop policy if exists "company_branches_delete_manage" on public.company_branches;
create policy "company_branches_delete_manage"
on public.company_branches for delete
using (public.has_company_permission(company_id, 'branch.manage'));

drop policy if exists "auth_provider_accounts_select_own" on public.auth_provider_accounts;
create policy "auth_provider_accounts_select_own"
on public.auth_provider_accounts for select
using (auth.uid() = user_id);

drop policy if exists "auth_provider_accounts_insert_own" on public.auth_provider_accounts;
create policy "auth_provider_accounts_insert_own"
on public.auth_provider_accounts for insert
with check (auth.uid() = user_id);

drop policy if exists "auth_provider_accounts_update_own" on public.auth_provider_accounts;
create policy "auth_provider_accounts_update_own"
on public.auth_provider_accounts for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "auth_provider_accounts_delete_own" on public.auth_provider_accounts;
create policy "auth_provider_accounts_delete_own"
on public.auth_provider_accounts for delete
using (auth.uid() = user_id);

drop policy if exists "memberships_select_visible" on public.memberships;
create policy "memberships_select_visible"
on public.memberships for select
using (auth.uid() = user_id or public.is_company_member(company_id));

drop policy if exists "memberships_insert_manage" on public.memberships;
create policy "memberships_insert_manage"
on public.memberships for insert
with check (
  auth.uid() = user_id
  or public.has_company_permission(company_id, 'company.manage_users.invite')
);

drop policy if exists "memberships_update_manage" on public.memberships;
create policy "memberships_update_manage"
on public.memberships for update
using (
  auth.uid() = user_id
  or public.has_company_permission(company_id, 'company.manage_users.update_role')
)
with check (
  auth.uid() = user_id
  or public.has_company_permission(company_id, 'company.manage_users.update_role')
);

drop policy if exists "memberships_delete_manage" on public.memberships;
create policy "memberships_delete_manage"
on public.memberships for delete
using (public.has_company_permission(company_id, 'company.manage_users.update_role'));

drop policy if exists "membership_functions_select_visible" on public.membership_functions;
create policy "membership_functions_select_visible"
on public.membership_functions for select
using (
  exists (
    select 1
    from public.memberships m
    where m.id = membership_id
      and (m.user_id = auth.uid() or public.is_company_member(m.company_id))
  )
);

drop policy if exists "membership_functions_manage" on public.membership_functions;
create policy "membership_functions_manage"
on public.membership_functions for insert
with check (
  exists (
    select 1
    from public.memberships m
    where m.id = membership_id
      and public.has_company_permission(m.company_id, 'company.manage_users.update_role')
  )
);

drop policy if exists "membership_functions_delete_manage" on public.membership_functions;
create policy "membership_functions_delete_manage"
on public.membership_functions for delete
using (
  exists (
    select 1
    from public.memberships m
    where m.id = membership_id
      and public.has_company_permission(m.company_id, 'company.manage_users.update_role')
  )
);

drop policy if exists "permissions_select_auth" on public.permissions;
create policy "permissions_select_auth"
on public.permissions for select
using (auth.role() = 'authenticated');

drop policy if exists "role_permissions_select_auth" on public.role_permissions;
create policy "role_permissions_select_auth"
on public.role_permissions for select
using (auth.role() = 'authenticated');

drop policy if exists "ai_suggestions_select_company_member" on public.ai_suggestions;
create policy "ai_suggestions_select_company_member"
on public.ai_suggestions for select
using (public.is_company_member(company_id));

drop policy if exists "ai_suggestions_insert_company_member" on public.ai_suggestions;
create policy "ai_suggestions_insert_company_member"
on public.ai_suggestions for insert
with check (
  public.has_company_permission(company_id, 'ai.suggestion.create')
);

drop policy if exists "ai_suggestions_update_company_member" on public.ai_suggestions;
create policy "ai_suggestions_update_company_member"
on public.ai_suggestions for update
using (
  public.has_company_permission(company_id, 'ai.suggestion.approve')
  or public.has_company_permission(company_id, 'ai.suggestion.reject')
)
with check (
  public.has_company_permission(company_id, 'ai.suggestion.approve')
  or public.has_company_permission(company_id, 'ai.suggestion.reject')
);

drop policy if exists "ai_action_logs_select_company_member" on public.ai_action_logs;
create policy "ai_action_logs_select_company_member"
on public.ai_action_logs for select
using (public.is_company_member(company_id));

drop policy if exists "ai_action_logs_insert_company_member" on public.ai_action_logs;
create policy "ai_action_logs_insert_company_member"
on public.ai_action_logs for insert
with check (public.is_company_member(company_id));

drop policy if exists "inventory_items_select_company_member" on public.inventory_items;
create policy "inventory_items_select_company_member"
on public.inventory_items for select
using (public.is_company_member(company_id));

drop policy if exists "inventory_items_insert_company_member" on public.inventory_items;
create policy "inventory_items_insert_company_member"
on public.inventory_items for insert
with check (public.has_company_permission(company_id, 'inventory.create'));

drop policy if exists "inventory_items_update_company_member" on public.inventory_items;
create policy "inventory_items_update_company_member"
on public.inventory_items for update
using (
  public.has_company_permission(company_id, 'inventory.update')
  or public.has_company_permission(company_id, 'inventory.correct')
)
with check (
  public.has_company_permission(company_id, 'inventory.update')
  or public.has_company_permission(company_id, 'inventory.correct')
);

drop policy if exists "inventory_items_delete_company_member" on public.inventory_items;
create policy "inventory_items_delete_company_member"
on public.inventory_items for delete
using (public.has_company_permission(company_id, 'inventory.delete'));

drop policy if exists "stock_movements_select_company_member" on public.stock_movements;
create policy "stock_movements_select_company_member"
on public.stock_movements for select
using (public.is_company_member(company_id));

drop policy if exists "stock_movements_insert_company_member" on public.stock_movements;
create policy "stock_movements_insert_company_member"
on public.stock_movements for insert
with check (public.has_company_permission(company_id, 'stockmovement.create'));

drop policy if exists "stock_movements_update_company_member" on public.stock_movements;
create policy "stock_movements_update_company_member"
on public.stock_movements for update
using (public.has_company_permission(company_id, 'stockmovement.create'))
with check (public.has_company_permission(company_id, 'stockmovement.create'));

drop policy if exists "stock_movements_delete_company_member" on public.stock_movements;
create policy "stock_movements_delete_company_member"
on public.stock_movements for delete
using (public.has_company_permission(company_id, 'stockmovement.create'));

drop policy if exists "delivery_tasks_select_company_member" on public.delivery_tasks;
create policy "delivery_tasks_select_company_member"
on public.delivery_tasks for select
using (public.is_company_member(company_id));

drop policy if exists "delivery_tasks_insert_company_member" on public.delivery_tasks;
create policy "delivery_tasks_insert_company_member"
on public.delivery_tasks for insert
with check (public.has_company_permission(company_id, 'delivery.read'));

drop policy if exists "delivery_tasks_update_company_member" on public.delivery_tasks;
create policy "delivery_tasks_update_company_member"
on public.delivery_tasks for update
using (
  public.has_company_permission(company_id, 'delivery.update_status')
  or public.has_company_permission(company_id, 'delivery.confirm')
  or public.has_company_permission(company_id, 'delivery.reject')
)
with check (
  public.has_company_permission(company_id, 'delivery.update_status')
  or public.has_company_permission(company_id, 'delivery.confirm')
  or public.has_company_permission(company_id, 'delivery.reject')
);

drop policy if exists "delivery_tasks_delete_company_member" on public.delivery_tasks;
create policy "delivery_tasks_delete_company_member"
on public.delivery_tasks for delete
using (public.has_company_permission(company_id, 'delivery.update_status'));

insert into public.permissions (permission_key, label, description, category)
values
  ('company.manage_users.invite', 'Gebruikers uitnodigen', 'Nieuwe leden aan een bedrijf koppelen.', 'company'),
  ('company.manage_users.update_role', 'Rollen wijzigen', 'Rollen en functies aanpassen binnen een bedrijf.', 'company'),
  ('branch.manage', 'Vestigingen beheren', 'Vestigingen aanmaken en bijwerken.', 'company'),
  ('inventory.read', 'Voorraad lezen', 'Voorraad en productstatus bekijken.', 'inventory'),
  ('inventory.create', 'Voorraad toevoegen', 'Nieuwe producten en voorraadregels toevoegen.', 'inventory'),
  ('inventory.update', 'Voorraad wijzigen', 'Productdetails en hoeveelheden aanpassen.', 'inventory'),
  ('inventory.delete', 'Voorraad verwijderen', 'Producten verwijderen uit de voorraad.', 'inventory'),
  ('inventory.count', 'Voorraad tellen', 'Tellingen en countflows uitvoeren.', 'inventory'),
  ('inventory.correct', 'Voorraad corrigeren', 'Voorraadverschillen handmatig rechtzetten.', 'inventory'),
  ('stockmovement.read', 'Verplaatsingen lezen', 'Stockbewegingen bekijken.', 'inventory'),
  ('stockmovement.create', 'Verplaatsingen schrijven', 'Stockbewegingen registreren.', 'inventory'),
  ('delivery.read', 'Leveringen lezen', 'Leveringen en ritten bekijken.', 'delivery'),
  ('delivery.update_status', 'Leveringsstatus wijzigen', 'Status van een levering aanpassen.', 'delivery'),
  ('delivery.confirm', 'Levering bevestigen', 'Levering als ontvangen of geleverd bevestigen.', 'delivery'),
  ('delivery.reject', 'Levering weigeren', 'Levering afwijzen of markeren als beschadigd.', 'delivery'),
  ('ai.suggestion.read', 'AI voorstellen lezen', 'AI-voorstellen bekijken.', 'ai'),
  ('ai.suggestion.create', 'AI voorstellen maken', 'AI-voorstellen genereren of opslaan.', 'ai'),
  ('ai.suggestion.approve', 'AI voorstellen goedkeuren', 'AI-voorstellen laten uitvoeren.', 'ai'),
  ('ai.suggestion.reject', 'AI voorstellen afwijzen', 'AI-voorstellen weigeren.', 'ai'),
  ('ai.settings.manage', 'AI instellingen beheren', 'AI-voorkeuren en systeemgedrag beheren.', 'ai'),
  ('finance.read', 'Financieele data lezen', 'Omzet, kosten en marges bekijken.', 'finance'),
  ('reports.read', 'Rapporten lezen', 'Rapportages en exports bekijken.', 'reports'),
  ('billing.manage', 'Facturatie beheren', 'Abonnementen, checkout en facturatie beheren.', 'billing')
on conflict (permission_key) do update
set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category;

insert into public.role_permissions (role, permission_key)
select role_name, permission_key
from (
  values
    ('OWNER', array[
      'company.manage_users.invite',
      'company.manage_users.update_role',
      'branch.manage',
      'inventory.read',
      'inventory.create',
      'inventory.update',
      'inventory.delete',
      'inventory.count',
      'inventory.correct',
      'stockmovement.read',
      'stockmovement.create',
      'delivery.read',
      'delivery.update_status',
      'delivery.confirm',
      'delivery.reject',
      'ai.suggestion.read',
      'ai.suggestion.create',
      'ai.suggestion.approve',
      'ai.suggestion.reject',
      'ai.settings.manage',
      'finance.read',
      'reports.read',
      'billing.manage'
    ]::text[]),
    ('MANAGER', array[
      'company.manage_users.invite',
      'company.manage_users.update_role',
      'branch.manage',
      'inventory.read',
      'inventory.create',
      'inventory.update',
      'inventory.count',
      'inventory.correct',
      'stockmovement.read',
      'stockmovement.create',
      'delivery.read',
      'delivery.update_status',
      'delivery.confirm',
      'delivery.reject',
      'ai.suggestion.read',
      'ai.suggestion.create',
      'ai.suggestion.approve',
      'ai.suggestion.reject',
      'finance.read',
      'reports.read'
    ]::text[]),
    ('WERKVLOER', array[
      'inventory.read',
      'inventory.create',
      'inventory.update',
      'inventory.count',
      'inventory.correct',
      'stockmovement.read',
      'stockmovement.create',
      'delivery.read',
      'ai.suggestion.read',
      'ai.suggestion.create'
    ]::text[]),
    ('CHAUFFEUR', array[
      'inventory.read',
      'stockmovement.read',
      'stockmovement.create',
      'delivery.read',
      'delivery.update_status',
      'delivery.confirm',
      'delivery.reject',
      'ai.suggestion.read',
      'ai.suggestion.create'
    ]::text[])
) as permissions_by_role(role_name, permission_keys)
cross join unnest(permissions_by_role.permission_keys) as permission_key
on conflict (role, permission_key) do nothing;
