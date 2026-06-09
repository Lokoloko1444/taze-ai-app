-- Atomic first-run company bootstrap for authenticated users.
-- Keeps RLS intact while avoiding fragile client-side multi-step inserts.

create or replace function public.bootstrap_company_for_current_user(
  company_name text,
  branch_name text default 'Main'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_name text := nullif(trim(company_name), '');
  v_branch_name text := coalesce(nullif(trim(branch_name), ''), 'Main');
  v_company_slug text;
  v_branch_slug text;
  v_branch_code text;
  v_company_id uuid;
  v_branch_id uuid;
  v_membership_id uuid;
  v_existing record;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if v_company_name is null or char_length(v_company_name) < 2 then
    raise exception 'company_name_too_short' using errcode = '22023';
  end if;

  select
    m.id as membership_id,
    m.company_id,
    m.branch_id,
    m.role,
    m.status,
    m.is_primary,
    c.name as company_name,
    c.legal_name as company_legal_name,
    c.slug as company_slug,
    c.status as company_status,
    b.name as branch_name,
    b.slug as branch_slug,
    b.code as branch_code,
    b.status as branch_status
  into v_existing
  from public.memberships m
  join public.companies c on c.id = m.company_id
  left join public.company_branches b on b.id = m.branch_id
  where m.user_id = v_user_id
    and m.status = 'ACTIVE'
  order by m.is_primary desc, m.created_at asc
  limit 1;

  if found then
    if v_existing.branch_id is null then
      v_branch_slug :=
        coalesce(
          nullif(
            trim(both '-' from regexp_replace(lower(v_branch_name), '[^a-z0-9]+', '-', 'g')),
            ''
          ),
          'main'
        );
      v_branch_code := upper(substr(v_branch_slug, 1, 8));

      insert into public.company_branches (
        company_id,
        name,
        slug,
        code,
        status
      ) values (
        v_existing.company_id,
        v_branch_name,
        v_branch_slug,
        v_branch_code,
        'ACTIVE'
      )
      on conflict (company_id, slug) do update
        set name = excluded.name,
            code = excluded.code,
            status = excluded.status,
            updated_at = now()
      returning id into v_branch_id;

      update public.memberships
      set branch_id = v_branch_id,
          updated_at = now()
      where id = v_existing.membership_id;

      v_existing.branch_id := v_branch_id;
      v_existing.branch_name := v_branch_name;
      v_existing.branch_slug := v_branch_slug;
      v_existing.branch_code := v_branch_code;
      v_existing.branch_status := 'ACTIVE';
    end if;

    insert into public.membership_functions (membership_id, function_area)
    values
      (v_existing.membership_id, 'ADMIN'),
      (v_existing.membership_id, 'INKOOP'),
      (v_existing.membership_id, 'MAGAZIJN'),
      (v_existing.membership_id, 'BAR'),
      (v_existing.membership_id, 'KEUKEN'),
      (v_existing.membership_id, 'AFGEWERKT_PRODUCT'),
      (v_existing.membership_id, 'DISTRIBUTIE')
    on conflict (membership_id, function_area) do nothing;

    return jsonb_build_object(
      'company', jsonb_build_object(
        'id', v_existing.company_id,
        'name', v_existing.company_name,
        'legalName', coalesce(v_existing.company_legal_name, v_existing.company_name),
        'slug', v_existing.company_slug,
        'status', v_existing.company_status
      ),
      'branch', jsonb_build_object(
        'id', v_existing.branch_id,
        'name', v_existing.branch_name,
        'slug', v_existing.branch_slug,
        'code', v_existing.branch_code,
        'status', v_existing.branch_status
      ),
      'membershipId', v_existing.membership_id,
      'role', v_existing.role,
      'status', v_existing.status,
      'created', false
    );
  end if;

  v_company_slug :=
    coalesce(
      nullif(
        trim(both '-' from regexp_replace(lower(v_company_name), '[^a-z0-9]+', '-', 'g')),
        ''
      ),
      'bedrijf'
    ) || '-' || substr(md5(v_user_id::text || clock_timestamp()::text), 1, 8);

  v_branch_slug :=
    coalesce(
      nullif(
        trim(both '-' from regexp_replace(lower(v_branch_name), '[^a-z0-9]+', '-', 'g')),
        ''
      ),
      'main'
    );
  v_branch_code := upper(substr(v_branch_slug, 1, 8));

  insert into public.companies (
    owner_user_id,
    name,
    legal_name,
    slug,
    status
  ) values (
    v_user_id,
    v_company_name,
    v_company_name,
    v_company_slug,
    'ACTIVE'
  )
  returning id into v_company_id;

  insert into public.company_branches (
    company_id,
    name,
    slug,
    code,
    status
  ) values (
    v_company_id,
    v_branch_name,
    v_branch_slug,
    v_branch_code,
    'ACTIVE'
  )
  returning id into v_branch_id;

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

  return jsonb_build_object(
    'company', jsonb_build_object(
      'id', v_company_id,
      'name', v_company_name,
      'legalName', v_company_name,
      'slug', v_company_slug,
      'status', 'ACTIVE'
    ),
    'branch', jsonb_build_object(
      'id', v_branch_id,
      'name', v_branch_name,
      'slug', v_branch_slug,
      'code', v_branch_code,
      'status', 'ACTIVE'
    ),
    'membershipId', v_membership_id,
    'role', 'OWNER',
    'status', 'ACTIVE',
    'created', true
  );
end;
$$;

revoke all on function public.bootstrap_company_for_current_user(text, text) from public;
grant execute on function public.bootstrap_company_for_current_user(text, text) to authenticated;
