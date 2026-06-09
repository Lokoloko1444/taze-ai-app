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

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  branch_id uuid references public.company_branches (id) on delete set null,
  role text not null check (role in ('OWNER', 'MANAGER', 'WERKVLOER', 'CHAUFFEUR')),
  permissions text[] not null default '{}'::text[],
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INVITED', 'SUSPENDED', 'PENDING')),
  is_primary boolean not null default false,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, company_id, branch_id)
);

create table if not exists public.membership_functions (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships (id) on delete cascade,
  function_area text not null check (function_area in ('BAR', 'KEUKEN', 'AFGEWERKT_PRODUCT', 'DISTRIBUTIE', 'MAGAZIJN', 'INKOOP', 'ADMIN')),
  created_at timestamptz not null default now(),
  unique (membership_id, function_area)
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
  role text not null check (role in ('OWNER', 'MANAGER', 'WERKVLOER', 'CHAUFFEUR')),
  permission_key text not null references public.permissions (permission_key) on delete cascade,
  created_at timestamptz not null default now(),
  unique (role, permission_key)
);

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
    from public.companies c
    where c.id = target_company_id
      and c.owner_user_id = auth.uid()
  )
  or exists (
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
  m.invited_by,
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
alter table public.memberships enable row level security;
alter table public.membership_functions enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

drop policy if exists "companies_select_member" on public.companies;
create policy "companies_select_member"
on public.companies
for select
using (public.is_company_owner(id) or public.is_company_member(id));

drop policy if exists "companies_insert_owner" on public.companies;
create policy "companies_insert_owner"
on public.companies
for insert
with check (auth.uid() = owner_user_id);

drop policy if exists "companies_update_owner" on public.companies;
create policy "companies_update_owner"
on public.companies
for update
using (public.is_company_owner(id))
with check (public.is_company_owner(id));

drop policy if exists "companies_delete_owner" on public.companies;
create policy "companies_delete_owner"
on public.companies
for delete
using (public.is_company_owner(id));

drop policy if exists "company_branches_select_member" on public.company_branches;
create policy "company_branches_select_member"
on public.company_branches
for select
using (public.is_company_owner(company_id) or public.is_company_member(company_id));

drop policy if exists "company_branches_insert_owner" on public.company_branches;
create policy "company_branches_insert_owner"
on public.company_branches
for insert
with check (public.is_company_owner(company_id));

drop policy if exists "company_branches_update_owner" on public.company_branches;
create policy "company_branches_update_owner"
on public.company_branches
for update
using (public.is_company_owner(company_id))
with check (public.is_company_owner(company_id));

drop policy if exists "company_branches_delete_owner" on public.company_branches;
create policy "company_branches_delete_owner"
on public.company_branches
for delete
using (public.is_company_owner(company_id));

drop policy if exists "memberships_select_visible" on public.memberships;
create policy "memberships_select_visible"
on public.memberships
for select
using (auth.uid() = user_id or public.is_company_owner(company_id));

drop policy if exists "memberships_insert_visible" on public.memberships;
create policy "memberships_insert_visible"
on public.memberships
for insert
with check (auth.uid() = user_id or public.is_company_owner(company_id));

drop policy if exists "memberships_update_visible" on public.memberships;
create policy "memberships_update_visible"
on public.memberships
for update
using (auth.uid() = user_id or public.is_company_owner(company_id))
with check (auth.uid() = user_id or public.is_company_owner(company_id));

drop policy if exists "memberships_delete_visible" on public.memberships;
create policy "memberships_delete_visible"
on public.memberships
for delete
using (auth.uid() = user_id or public.is_company_owner(company_id));

drop policy if exists "membership_functions_select_visible" on public.membership_functions;
create policy "membership_functions_select_visible"
on public.membership_functions
for select
using (
  exists (
    select 1
    from public.memberships m
    where m.id = membership_id
      and (m.user_id = auth.uid() or public.is_company_owner(m.company_id))
  )
);

drop policy if exists "membership_functions_insert_visible" on public.membership_functions;
create policy "membership_functions_insert_visible"
on public.membership_functions
for insert
with check (
  exists (
    select 1
    from public.memberships m
    where m.id = membership_id
      and (m.user_id = auth.uid() or public.is_company_owner(m.company_id))
  )
);

drop policy if exists "membership_functions_delete_visible" on public.membership_functions;
create policy "membership_functions_delete_visible"
on public.membership_functions
for delete
using (
  exists (
    select 1
    from public.memberships m
    where m.id = membership_id
      and (m.user_id = auth.uid() or public.is_company_owner(m.company_id))
  )
);

drop policy if exists "permissions_select_auth" on public.permissions;
create policy "permissions_select_auth"
on public.permissions
for select
using (auth.uid() is not null);

drop policy if exists "role_permissions_select_auth" on public.role_permissions;
create policy "role_permissions_select_auth"
on public.role_permissions
for select
using (auth.uid() is not null);

insert into public.permissions (permission_key, label, description, category)
values
  ('company.manage_users.invite', 'Gebruikers uitnodigen', 'Nieuwe leden aan een bedrijf koppelen.', 'company'),
  ('company.manage_users.update_role', 'Rollen wijzigen', 'Rollen en functies aanpassen binnen een bedrijf.', 'company'),
  ('branch.manage', 'Vestigingen beheren', 'Vestigingen aanmaken en bijwerken.', 'company'),
  ('inventory.read', 'Voorraad lezen', 'Voorraad en productstatus bekijken.', 'inventory'),
  ('inventory.create', 'Voorraad toevoegen', 'Nieuwe producten en voorraadregels toevoegen.', 'inventory'),
  ('inventory.update', 'Voorraad wijzigen', 'Productdetails en hoeveelheden aanpassen.', 'inventory'),
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
  ('finance.read', 'Financiële data lezen', 'Omzet, kosten en marges bekijken.', 'finance'),
  ('reports.read', 'Rapporten lezen', 'Rapportages en exports bekijken.', 'reports'),
  ('billing.manage', 'Facturatie beheren', 'Abonnementen, checkout en facturatie beheren.', 'billing')
on conflict (permission_key) do update
set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  created_at = public.permissions.created_at;

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

do $$
declare
  v_user_id uuid;
  v_company_id uuid;
  v_branch_id uuid;
  v_membership_id uuid;
begin
  select id
  into v_user_id
  from auth.users
  where lower(email) = lower('lgstudio144@gmail.com')
  limit 1;

  if v_user_id is null then
    raise exception 'user_not_found';
  end if;

  insert into public.companies (
    owner_user_id,
    name,
    legal_name,
    slug,
    status
  ) values (
    v_user_id,
    'Taze',
    'Taze',
    'taze-main',
    'ACTIVE'
  )
  on conflict (slug) do update
    set owner_user_id = excluded.owner_user_id,
        name = excluded.name,
        legal_name = excluded.legal_name,
        status = excluded.status,
        updated_at = now()
  returning id into v_company_id;

  insert into public.company_branches (
    company_id,
    name,
    slug,
    code,
    status
  ) values (
    v_company_id,
    'Hoofdvestiging',
    'hoofdvestiging',
    'HOOFDVES',
    'ACTIVE'
  )
  on conflict (company_id, slug) do update
    set name = excluded.name,
        code = excluded.code,
        status = excluded.status,
        updated_at = now()
  returning id into v_branch_id;

  delete from public.membership_functions mf
  using public.memberships m
  where mf.membership_id = m.id
    and m.user_id = v_user_id
    and m.company_id = v_company_id;

  delete from public.memberships
  where user_id = v_user_id
    and company_id = v_company_id;

  insert into public.memberships (
    user_id,
    company_id,
    branch_id,
    role,
    permissions,
    status,
    is_primary,
    invited_by
  ) values (
    v_user_id,
    v_company_id,
    v_branch_id,
    'OWNER',
    '{}'::text[],
    'ACTIVE',
    true,
    null
  )
  returning id into v_membership_id;

  insert into public.membership_functions (membership_id, function_area)
  values
    (v_membership_id, 'ADMIN'),
    (v_membership_id, 'INKOOP'),
    (v_membership_id, 'MAGAZIJN'),
    (v_membership_id, 'BAR'),
    (v_membership_id, 'KEUKEN'),
    (v_membership_id, 'AFGEWERKT_PRODUCT'),
    (v_membership_id, 'DISTRIBUTIE')
  on conflict (membership_id, function_area) do nothing;
end $$;
