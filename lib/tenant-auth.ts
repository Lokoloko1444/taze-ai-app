import { getItem, removeItem, setItem } from 'lib/app-storage';
import {
    buildMembershipDisplayLabel,
    buildMembershipSummary,
    buildTenantContextSnapshot,
    DEFAULT_FUNCTIONS_BY_ROLE,
    FUNCTION_AREAS,
    getDefaultFunctionsForRole,
    mapTenantRoleToLegacyRole,
    normalizeAppRole,
    normalizeFunctionArea,
    sortMemberships,
    TENANT_ROLES,
    type AppRole,
    type TenantBranchSummary,
    type TenantContextSnapshot,
    type TenantFunctionArea,
    type TenantMembership,
    type TenantProviderAccount,
    type TenantRole,
} from 'lib/auth-model';
import { type AppLanguage } from 'lib/i18n';
import { supabase } from 'lib/supabase';

const ACTIVE_MEMBERSHIP_STORAGE_KEY = 'taze-active-membership-v1';
const TENANT_CONTEXT_STORAGE_KEY = 'taze-tenant-context-v1';

let cachedTenantContext: TenantContextSnapshot | null = null;

type MembershipViewRow = {
  membership_id: string;
  user_id: string;
  company_id: string;
  branch_id: string | null;
  role: string;
  permissions: string[] | null;
  status: string;
  is_primary: boolean | null;
  invited_by: string | null;
  membership_created_at: string;
  membership_updated_at: string;
  company_name: string;
  company_legal_name: string | null;
  company_slug: string;
  company_status: string;
  branch_name: string | null;
  branch_code: string | null;
  branch_slug: string | null;
  branch_status: string | null;
};

type MembershipFunctionRow = {
  membership_id: string;
  function_area: string;
};

type AuthIdentity = {
  id?: string;
  provider?: string;
  identity_data?: Record<string, unknown> | null;
  provider_id?: string;
  user_id?: string;
};

type ProviderAccountRow = {
  provider: string;
  provider_account_id: string;
  provider_email: string | null;
  email_verified: boolean;
  last_login_at: string | null;
};

type BootstrapCompanyRpcResult = {
  company?: {
    id?: string;
    name?: string;
    legalName?: string | null;
    slug?: string;
    status?: string;
  } | null;
  branch?: {
    id?: string | null;
    name?: string | null;
    slug?: string | null;
    code?: string | null;
    status?: string | null;
  } | null;
  membershipId?: string;
};

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function normalizeStatus(value: unknown): 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'PENDING' {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized === 'ACTIVE' || normalized === 'INVITED' || normalized === 'SUSPENDED' || normalized === 'PENDING'
    ? normalized
    : 'PENDING';
}

function normalizeRole(value: unknown): TenantRole {
  const normalized = normalizeAppRole(value);
  if (normalized && TENANT_ROLES.includes(normalized as TenantRole)) {
    return normalized as TenantRole;
  }
  return 'MANAGER';
}

function normalizeFunctions(value: unknown): TenantFunctionArea[] {
  if (!Array.isArray(value)) return [];
  const items = value.map((item) => normalizeFunctionArea(item)).filter(Boolean) as TenantFunctionArea[];
  return Array.from(new Set(items));
}

function normalizePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? '').trim())
        .filter(Boolean)
    )
  );
}

function normalizeMembershipRow(row: MembershipViewRow): TenantMembership {
  const role = normalizeRole(row.role);
  const branch: TenantBranchSummary | null =
    row.branch_id && row.branch_name
      ? {
          id: row.branch_id,
          name: row.branch_name,
          slug: row.branch_slug ?? slugify(row.branch_name),
          code: row.branch_code ?? null,
          status: row.branch_status ?? 'ACTIVE',
        }
      : null;

  return {
    id: row.membership_id,
    userId: row.user_id,
    companyId: row.company_id,
    branchId: row.branch_id,
    role,
    permissions: normalizePermissions(row.permissions),
    status: normalizeStatus(row.status),
    isPrimary: Boolean(row.is_primary),
    invitedBy: row.invited_by ?? null,
    createdAt: row.membership_created_at,
    updatedAt: row.membership_updated_at,
    company: {
      id: row.company_id,
      name: row.company_name,
      legalName: row.company_legal_name,
      slug: row.company_slug,
      status: row.company_status,
    },
    branch,
    functions: [],
  };
}

function normalizeProviderRow(row: ProviderAccountRow): TenantProviderAccount {
  return {
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    providerEmail: row.provider_email,
    emailVerified: Boolean(row.email_verified),
    lastLoginAt: row.last_login_at,
  };
}

export async function loadStoredActiveMembershipId() {
  try {
    const value = await getItem(ACTIVE_MEMBERSHIP_STORAGE_KEY);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

export async function saveStoredActiveMembershipId(value: string | null) {
  if (!value) {
    await removeItem(ACTIVE_MEMBERSHIP_STORAGE_KEY);
    return;
  }
  await setItem(ACTIVE_MEMBERSHIP_STORAGE_KEY, value);
}

export function getCachedTenantContext() {
  return cachedTenantContext;
}

export async function saveCachedTenantContext(snapshot: TenantContextSnapshot | null) {
  cachedTenantContext = snapshot;
  if (!snapshot) {
    await removeItem(TENANT_CONTEXT_STORAGE_KEY);
    return;
  }
  await setItem(TENANT_CONTEXT_STORAGE_KEY, JSON.stringify(snapshot));
}

export async function loadCachedTenantContext() {
  if (cachedTenantContext) return cachedTenantContext;
  try {
    const raw = await getItem(TENANT_CONTEXT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TenantContextSnapshot;
    cachedTenantContext = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export function buildTenantContext(params: {
  userId: string | null;
  email: string | null;
  memberships: TenantMembership[];
  activeMembership: TenantMembership | null;
  providerAccounts?: TenantProviderAccount[];
}) {
  return buildTenantContextSnapshot(params);
}

export async function loadUserMemberships(userId: string) {
  if (!supabase) return [];

  const { data: membershipRows, error: membershipsError } = await supabase
    .from('user_company_branch')
    .select('*')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('membership_created_at', { ascending: true });

  if (membershipsError || !Array.isArray(membershipRows)) {
    return [];
  }

  const normalizedMemberships = membershipRows.map((row) => normalizeMembershipRow(row as MembershipViewRow));
  const membershipIds = normalizedMemberships.map((item) => item.id);
  if (!membershipIds.length) return normalizedMemberships;

  const { data: functionRows } = await supabase
    .from('membership_functions')
    .select('membership_id,function_area')
    .in('membership_id', membershipIds);

  const functionMap = new Map<string, TenantFunctionArea[]>();
  for (const row of (functionRows ?? []) as MembershipFunctionRow[]) {
    const area = normalizeFunctionArea(row.function_area);
    if (!area) continue;
    const current = functionMap.get(row.membership_id) ?? [];
    current.push(area);
    functionMap.set(row.membership_id, current);
  }

  return sortMemberships(
    normalizedMemberships.map((membership) => ({
      ...membership,
      functions: Array.from(new Set(functionMap.get(membership.id) ?? getDefaultFunctionsForRole(membership.role))),
    }))
  );
}

export async function loadUserProviderAccounts(userId: string) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('auth_provider_accounts')
    .select('provider,provider_account_id,provider_email,email_verified,last_login_at')
    .eq('user_id', userId)
    .order('last_login_at', { ascending: false });

  if (error || !Array.isArray(data)) return [];
  return data.map((row) => normalizeProviderRow(row as ProviderAccountRow));
}

export async function syncUserProviderAccounts(userId: string) {
  if (!supabase) return [];

  try {
    const { data } = await supabase.auth.getUserIdentities();
    const identities = Array.isArray(data?.identities) ? (data.identities as AuthIdentity[]) : [];
    if (!identities.length) {
      return loadUserProviderAccounts(userId);
    }

    const rows = identities
      .map((identity) => {
        const provider = String(identity.provider ?? '').trim();
        const providerAccountId = String(identity.id ?? identity.provider_id ?? '').trim();
        if (!provider || !providerAccountId) return null;

        const identityData = identity.identity_data ?? {};
        const providerEmail = String(identityData.email ?? identityData.email_address ?? '').trim() || null;
        const emailVerified = Boolean(identityData.email_verified ?? identityData.verified ?? identityData.is_verified);
        return {
          user_id: userId,
          provider,
          provider_account_id: providerAccountId,
          provider_email: providerEmail,
          email_verified: emailVerified,
          last_login_at: new Date().toISOString(),
        };
      })
      .filter(Boolean);

    if (rows.length) {
      await supabase.from('auth_provider_accounts').upsert(rows, { onConflict: 'provider,provider_account_id' });
    }
  } catch {
    // Keep auth flow resilient if identity sync fails.
  }

  return loadUserProviderAccounts(userId);
}

export function mergeSessionProviderAccounts(
  providerAccounts: TenantProviderAccount[],
  params: {
    userId: string;
    email: string | null;
    sessionProvider: string | null;
    lastLoginAt?: string;
  }
) {
  const normalizedProvider = String(params.sessionProvider ?? '').trim().toLowerCase();
  if (!normalizedProvider) {
    return providerAccounts;
  }

  const hasProvider = providerAccounts.some((item) => String(item.provider ?? '').trim().toLowerCase() === normalizedProvider);
  if (hasProvider) {
    return providerAccounts;
  }

  return [
    {
      provider: normalizedProvider,
      providerAccountId: `${params.userId}:${normalizedProvider}`,
      providerEmail: params.email,
      emailVerified: Boolean(params.email),
      lastLoginAt: params.lastLoginAt ?? new Date().toISOString(),
    },
    ...providerAccounts,
  ];
}

export async function selectActiveMembership(membershipId: string | null) {
  await saveStoredActiveMembershipId(membershipId);
}

export async function saveMembershipFunctions(membershipId: string, selectedFunctions: TenantFunctionArea[]) {
  if (!supabase) {
    throw new Error('Supabase is niet gekoppeld.');
  }

  const normalized = Array.from(new Set(selectedFunctions.map((item) => normalizeFunctionArea(item)).filter(Boolean) as TenantFunctionArea[]));
  const { data: currentRows, error: currentError } = await supabase
    .from('membership_functions')
    .select('function_area')
    .eq('membership_id', membershipId);

  if (currentError) {
    throw currentError;
  }

  const current = new Set(
    (currentRows ?? []).map((row) => normalizeFunctionArea((row as MembershipFunctionRow).function_area)).filter(Boolean) as TenantFunctionArea[]
  );
  const desired = new Set(normalized);

  const toAdd = normalized.filter((item) => !current.has(item));
  const toRemove = Array.from(current).filter((item) => !desired.has(item));

  if (toAdd.length) {
    const { error } = await supabase.from('membership_functions').insert(
      toAdd.map((function_area) => ({
        membership_id: membershipId,
        function_area,
      }))
    );
    if (error) throw error;
  }

  for (const functionArea of toRemove) {
    const { error } = await supabase
      .from('membership_functions')
      .delete()
      .eq('membership_id', membershipId)
      .eq('function_area', functionArea);
    if (error) throw error;
  }
}

export async function bootstrapCompanyMembership(input: {
  userId: string;
  companyName: string;
  branchName?: string;
  companyLegalName?: string;
  role?: TenantRole;
  functions?: TenantFunctionArea[];
}) {
  if (!supabase) {
    throw new Error('Supabase is niet gekoppeld.');
  }

  const companyName = input.companyName.trim();
  if (companyName.length < 2) {
    throw new Error('Bedrijfsnaam is te kort.');
  }

  const branchName = (input.branchName ?? 'Hoofdvestiging').trim() || 'Hoofdvestiging';
  const { data, error } = await supabase.rpc('bootstrap_company_for_current_user', {
    company_name: companyName,
    branch_name: branchName,
  });

  if (error) {
    throw error;
  }

  const result = data as BootstrapCompanyRpcResult | null;
  if (!result?.company?.id || !result.membershipId) {
    throw new Error('Bedrijf kon niet worden aangemaakt.');
  }

  const company = result.company;
  const branch = result.branch ?? null;

  return {
    company: {
      id: company.id,
      name: company.name ?? companyName,
      legalName: company.legalName ?? company.name ?? companyName,
      slug: company.slug ?? slugify(company.name ?? companyName),
      status: company.status ?? 'ACTIVE',
    },
    branch: {
      id: branch?.id ?? null,
      name: branch?.name ?? branchName,
      slug: branch?.slug ?? slugify(branch?.name ?? branchName),
      code: branch?.code ?? null,
      status: branch?.status ?? 'ACTIVE',
    },
    membershipId: result.membershipId,
  };
}

export async function syncLegacyProfileRole(userId: string, role: AppRole | null) {
  if (!supabase) return;
  const mappedRole = role ? mapTenantRoleToLegacyRole(normalizeAppRole(role) as TenantRole | null) ?? role : null;
  if (!mappedRole) return;

  await supabase.from('profiles').upsert(
    {
      user_id: userId,
      role: mappedRole,
    },
    { onConflict: 'user_id' }
  );
}

export function buildMembershipPickerLabel(membership: TenantMembership) {
  return buildMembershipDisplayLabel(membership);
}

export function buildMembershipPickerDetail(membership: TenantMembership, language: AppLanguage = 'nl') {
  return buildMembershipSummary(membership, language).detail;
}

export { DEFAULT_FUNCTIONS_BY_ROLE, FUNCTION_AREAS, TENANT_ROLES };

