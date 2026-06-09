-- Company invite tokens and acceptance flow for multi-tenant auth.

create table if not exists public.company_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  branch_id uuid not null references public.company_branches (id) on delete cascade,
  invited_email text,
  invited_name text,
  invited_by uuid references auth.users (id) on delete set null,
  role text not null,
  permissions text[] not null default '{}'::text[],
  function_areas text[] not null default '{}'::text[],
  token_hash text not null unique,
  token_prefix text not null,
  status text not null default 'PENDING',
  expires_at timestamptz not null,
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role in ('OWNER', 'MANAGER', 'WERKVLOER', 'CHAUFFEUR')),
  check (status in ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'))
);

create index if not exists company_invites_company_idx on public.company_invites (company_id, status, expires_at desc);
create index if not exists company_invites_branch_idx on public.company_invites (branch_id, status, expires_at desc);
create index if not exists company_invites_email_idx on public.company_invites (invited_email, status, expires_at desc);
create index if not exists company_invites_token_hash_idx on public.company_invites (token_hash);
create index if not exists company_invites_created_idx on public.company_invites (created_at desc);

alter table public.company_invites enable row level security;

drop policy if exists "company_invites_select_manage" on public.company_invites;
create policy "company_invites_select_manage"
on public.company_invites for select
using (public.has_company_permission(company_id, 'company.manage_users.invite'));

create or replace function public.create_company_invite(
  target_company_id uuid,
  target_branch_id uuid,
  invited_email text default null,
  invited_name text default null,
  target_role text default 'MANAGER',
  target_permissions text[] default '{}'::text[],
  target_function_areas text[] default '{}'::text[],
  target_expires_at timestamptz default null
)
returns table (
  invite_id uuid,
  company_id uuid,
  branch_id uuid,
  invited_email text,
  invited_name text,
  invited_by uuid,
  role text,
  permissions text[],
  function_areas text[],
  token_prefix text,
  raw_token text,
  status text,
  expires_at timestamptz,
  accepted_by uuid,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := nullif(lower(trim(coalesce(invited_email, ''))), '');
  normalized_name text := nullif(trim(coalesce(invited_name, '')), '');
  normalized_role text := upper(trim(coalesce(target_role, 'MANAGER')));
  normalized_permissions text[] := coalesce(target_permissions, '{}'::text[]);
  normalized_functions text[] := coalesce(target_function_areas, '{}'::text[]);
  expires_at_value timestamptz := coalesce(target_expires_at, now() + interval '7 days');
  raw_token_value text;
  token_hash_value text;
  branch_exists boolean;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.has_company_permission(target_company_id, 'company.manage_users.invite') then
    raise exception 'insufficient_privileges' using errcode = '42501';
  end if;

  if normalized_role not in ('OWNER', 'MANAGER', 'WERKVLOER', 'CHAUFFEUR') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.company_branches b
    where b.id = target_branch_id
      and b.company_id = target_company_id
  ) into branch_exists;

  if not branch_exists then
    raise exception 'branch_not_found' using errcode = '22023';
  end if;

  raw_token_value := encode(gen_random_bytes(32), 'hex');
  token_hash_value := encode(digest(raw_token_value, 'sha256'), 'hex');

  insert into public.company_invites (
    company_id,
    branch_id,
    invited_email,
    invited_name,
    invited_by,
    role,
    permissions,
    function_areas,
    token_hash,
    token_prefix,
    status,
    expires_at
  ) values (
    target_company_id,
    target_branch_id,
    normalized_email,
    normalized_name,
    auth.uid(),
    normalized_role,
    normalized_permissions,
    normalized_functions,
    token_hash_value,
    left(raw_token_value, 8),
    'PENDING',
    expires_at_value
  )
  returning id, company_id, branch_id, invited_email, invited_name, invited_by, role, permissions, function_areas, token_prefix, status, expires_at, accepted_by, accepted_at, revoked_at, created_at, updated_at
  into invite_id, company_id, branch_id, invited_email, invited_name, invited_by, role, permissions, function_areas, token_prefix, status, expires_at, accepted_by, accepted_at, revoked_at, created_at, updated_at;

  raw_token := raw_token_value;
  return next;
end;
$$;

create or replace function public.accept_company_invite(raw_token text)
returns table (
  invite_id uuid,
  company_id uuid,
  branch_id uuid,
  membership_id uuid,
  role text,
  permissions text[],
  function_areas text[],
  token_prefix text,
  status text,
  expires_at timestamptz,
  accepted_by uuid,
  accepted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  token_hash_value text := encode(digest(trim(coalesce(raw_token, '')), 'sha256'), 'hex');
  invite_row public.company_invites%rowtype;
  current_email text := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  membership_id_value uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select *
  into invite_row
  from public.company_invites
  where token_hash = token_hash_value
    and status = 'PENDING'
    and expires_at > now()
  for update;

  if not found then
    raise exception 'invite_not_found' using errcode = '22023';
  end if;

  if invite_row.invited_email is not null then
    if current_email is null then
      raise exception 'invite_email_missing' using errcode = '22023';
    end if;

    if lower(invite_row.invited_email) <> current_email then
      raise exception 'invite_email_mismatch' using errcode = '22023';
    end if;
  end if;

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
    auth.uid(),
    invite_row.company_id,
    invite_row.branch_id,
    invite_row.role,
    invite_row.permissions,
    'ACTIVE',
    false,
    invite_row.invited_by
  )
  on conflict (user_id, company_id, branch_id) do update
    set role = excluded.role,
        permissions = excluded.permissions,
        status = 'ACTIVE',
        invited_by = coalesce(memberships.invited_by, excluded.invited_by),
        updated_at = now()
  returning id into membership_id_value;

  delete from public.membership_functions
  where membership_id = membership_id_value;

  insert into public.membership_functions (membership_id, function_area)
  select membership_id_value, unnest(coalesce(invite_row.function_areas, '{}'::text[]));

  update public.company_invites
  set status = 'ACCEPTED',
      accepted_by = auth.uid(),
      accepted_at = now(),
      updated_at = now()
  where id = invite_row.id;

  invite_id := invite_row.id;
  company_id := invite_row.company_id;
  branch_id := invite_row.branch_id;
  role := invite_row.role;
  permissions := invite_row.permissions;
  function_areas := invite_row.function_areas;
  token_prefix := invite_row.token_prefix;
  status := 'ACCEPTED';
  expires_at := invite_row.expires_at;
  accepted_by := auth.uid();
  accepted_at := now();

  return next;
end;
$$;
