import { supabase } from 'lib/supabase';
import { buildInviteLink } from 'lib/invite-links';
import { getDefaultFunctionsForRole, normalizeFunctionArea, type TenantBranchSummary, type TenantFunctionArea, type TenantMembership, type TenantRole } from 'lib/auth-model';

export const COMPANY_INVITE_STATUSES = ['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'] as const;
export type CompanyInviteStatus = (typeof COMPANY_INVITE_STATUSES)[number];

export type CompanyInvite = {
  id: string;
  companyId: string;
  branchId: string;
  invitedEmail: string | null;
  invitedName: string | null;
  invitedBy: string | null;
  role: TenantRole;
  permissions: string[];
  functionAreas: TenantFunctionArea[];
  tokenPrefix: string;
  status: CompanyInviteStatus;
  expiresAt: string;
  acceptedBy: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompanyInviteBranch = TenantBranchSummary;

type CompanyInviteRow = {
  id: string;
  company_id: string;
  branch_id: string;
  invited_email: string | null;
  invited_name: string | null;
  invited_by: string | null;
  role: string;
  permissions: string[] | null;
  function_areas: string[] | null;
  token_prefix: string;
  status: string;
  expires_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

type CompanyBranchRow = {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  status: string;
};

export type CreateCompanyInviteInput = {
  companyId: string;
  branchId: string;
  role: TenantRole;
  invitedEmail?: string | null;
  invitedName?: string | null;
  permissions?: string[];
  functionAreas?: TenantFunctionArea[];
  expiresInDays?: number;
};

export type CreateCompanyInviteResult = {
  invite: CompanyInvite;
  rawToken: string;
  inviteLink: string;
};

export type AcceptCompanyInviteResult = {
  invite: CompanyInvite;
  membershipId: string;
};

function normalizeStatus(value: unknown): CompanyInviteStatus {
  const normalized = String(value ?? '').trim().toUpperCase();
  return COMPANY_INVITE_STATUSES.includes(normalized as CompanyInviteStatus) ? (normalized as CompanyInviteStatus) : 'PENDING';
}

function normalizeRole(value: unknown): TenantRole {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'OWNER' || normalized === 'MANAGER' || normalized === 'WERKVLOER' || normalized === 'CHAUFFEUR') {
    return normalized;
  }
  return 'MANAGER';
}

function normalizeFunctions(value: unknown): TenantFunctionArea[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => normalizeFunctionArea(item))
        .filter(Boolean) as TenantFunctionArea[]
    )
  );
}

function normalizeInviteRow(row: CompanyInviteRow): CompanyInvite {
  return {
    id: row.id,
    companyId: row.company_id,
    branchId: row.branch_id,
    invitedEmail: row.invited_email,
    invitedName: row.invited_name,
    invitedBy: row.invited_by,
    role: normalizeRole(row.role),
    permissions: Array.from(new Set((row.permissions ?? []).map((item) => String(item ?? '').trim()).filter(Boolean))),
    functionAreas: normalizeFunctions(row.function_areas),
    tokenPrefix: row.token_prefix,
    status: normalizeStatus(row.status),
    expiresAt: row.expires_at,
    acceptedBy: row.accepted_by,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeBranchRow(row: CompanyBranchRow): CompanyInviteBranch {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    code: row.code,
    status: row.status,
  };
}

function getInviteExpiresAt(expiresInDays: number | undefined) {
  const days = Number.isFinite(expiresInDays) && (expiresInDays ?? 0) > 0 ? Math.min(30, Math.max(1, Math.floor(expiresInDays ?? 7))) : 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export async function loadCompanyBranches(companyId: string) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('company_branches')
    .select('id,name,slug,code,status')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true });

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.map((row) => normalizeBranchRow(row as CompanyBranchRow));
}

export async function loadCompanyInvites(companyId: string) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('company_invites')
    .select('id,company_id,branch_id,invited_email,invited_name,invited_by,role,permissions,function_areas,token_prefix,status,expires_at,accepted_by,accepted_at,revoked_at,created_at,updated_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.map((row) => normalizeInviteRow(row as CompanyInviteRow));
}

export async function createCompanyInvite(input: CreateCompanyInviteInput): Promise<CreateCompanyInviteResult> {
  if (!supabase) {
    throw new Error('Supabase is niet gekoppeld.');
  }

  const expiresAt = getInviteExpiresAt(input.expiresInDays);
  const role = normalizeRole(input.role);
  const normalizedFunctions = Array.from(
    new Set(
      (input.functionAreas && input.functionAreas.length ? input.functionAreas : getDefaultFunctionsForRole(role))
        .map((item) => normalizeFunctionArea(item))
        .filter(Boolean) as TenantFunctionArea[]
    )
  );

  const { data, error } = await supabase.rpc('create_company_invite', {
    target_company_id: input.companyId,
    target_branch_id: input.branchId,
    invited_email: input.invitedEmail?.trim() || null,
    invited_name: input.invitedName?.trim() || null,
    target_role: role,
    target_permissions: Array.from(new Set((input.permissions ?? []).map((item) => String(item ?? '').trim()).filter(Boolean))),
    target_function_areas: normalizedFunctions,
    target_expires_at: expiresAt,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') {
    throw new Error('Uitnodiging kon niet worden aangemaakt.');
  }

  const rawToken = String((row as Record<string, unknown>).raw_token ?? '').trim();
  if (!rawToken) {
    throw new Error('Uitnodigingstoken ontbreekt.');
  }

  return {
    invite: normalizeInviteRow(row as CompanyInviteRow),
    rawToken,
    inviteLink: buildInviteLink(rawToken),
  };
}

export async function acceptCompanyInvite(rawToken: string): Promise<AcceptCompanyInviteResult> {
  if (!supabase) {
    throw new Error('Supabase is niet gekoppeld.');
  }

  const token = rawToken.trim();
  if (!token) {
    throw new Error('Uitnodigingstoken ontbreekt.');
  }

  const { data, error } = await supabase.rpc('accept_company_invite', {
    raw_token: token,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') {
    throw new Error('Uitnodiging kon niet worden geaccepteerd.');
  }

  const expiresAt = (row as Record<string, unknown>).expires_at ? String((row as Record<string, unknown>).expires_at) : new Date().toISOString();
  const invite = normalizeInviteRow(
    {
      id: String((row as Record<string, unknown>).invite_id ?? (row as Record<string, unknown>).id ?? ''),
      company_id: String((row as Record<string, unknown>).company_id ?? ''),
      branch_id: String((row as Record<string, unknown>).branch_id ?? ''),
      invited_email: (row as Record<string, unknown>).invited_email ? String((row as Record<string, unknown>).invited_email) : null,
      invited_name: (row as Record<string, unknown>).invited_name ? String((row as Record<string, unknown>).invited_name) : null,
      invited_by: (row as Record<string, unknown>).invited_by ? String((row as Record<string, unknown>).invited_by) : null,
      role: String((row as Record<string, unknown>).role ?? 'MANAGER'),
      permissions: Array.isArray((row as Record<string, unknown>).permissions) ? ((row as Record<string, unknown>).permissions as string[]) : [],
      function_areas: Array.isArray((row as Record<string, unknown>).function_areas) ? ((row as Record<string, unknown>).function_areas as string[]) : [],
      token_prefix: String((row as Record<string, unknown>).token_prefix ?? ''),
      status: String((row as Record<string, unknown>).status ?? 'ACCEPTED'),
      expires_at: expiresAt,
      accepted_by: (row as Record<string, unknown>).accepted_by ? String((row as Record<string, unknown>).accepted_by) : null,
      accepted_at: (row as Record<string, unknown>).accepted_at ? String((row as Record<string, unknown>).accepted_at) : null,
      revoked_at: (row as Record<string, unknown>).revoked_at ? String((row as Record<string, unknown>).revoked_at) : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as CompanyInviteRow
  );

  const membershipId = String((row as Record<string, unknown>).membership_id ?? '');
  if (!membershipId) {
    throw new Error('Membership kon niet worden geaccepteerd.');
  }

  return { invite, membershipId };
}
