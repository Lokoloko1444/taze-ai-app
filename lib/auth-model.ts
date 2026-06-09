import { t, type AppLanguage, type TranslationKey } from 'lib/i18n';

export const TENANT_ROLES = ['OWNER', 'MANAGER', 'WERKVLOER', 'CHAUFFEUR'] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];

export const LEGACY_ROLES = ['restaurateur', 'manager', 'finance', 'support', 'logistiek', 'medewerker'] as const;
export type LegacyAppRole = (typeof LEGACY_ROLES)[number];

export type AppRole = TenantRole | LegacyAppRole;

export const FUNCTION_AREAS = [
  'BAR',
  'KEUKEN',
  'AFGEWERKT_PRODUCT',
  'DISTRIBUTIE',
  'MAGAZIJN',
  'INKOOP',
  'ADMIN',
] as const;
export type TenantFunctionArea = (typeof FUNCTION_AREAS)[number];

export const TENANT_PERMISSION_KEYS = [
  'company.manage_users.invite',
  'company.manage_users.update_role',
  'branch.manage',
  'company.manage_data',
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
  'transport.confirm_business_impact',
  'ai.suggestion.read',
  'ai.suggestion.create',
  'ai.suggestion.approve',
  'ai.suggestion.reject',
  'ai.settings.manage',
  'finance.read',
  'finance.manage',
  'invoice.manage',
  'reports.read',
  'billing.manage',
  'admin.manage',
] as const;
export type TenantPermission = (typeof TENANT_PERMISSION_KEYS)[number];

export type LegacyPermission = 'manage_finance' | 'manage_security' | 'manage_devtools';
export type AppPermission = TenantPermission | LegacyPermission;

export const ROLE_LABELS: Record<AppRole, string> = {
  OWNER: 'Eigenaar',
  MANAGER: 'Manager',
  WERKVLOER: 'Werkvloer',
  CHAUFFEUR: 'Chauffeur',
  restaurateur: 'Eigenaar',
  manager: 'Manager',
  finance: 'Finance',
  support: 'Support',
  logistiek: 'Logistiek',
  medewerker: 'Medewerker',
};

export const FUNCTION_AREA_LABELS: Record<TenantFunctionArea, string> = {
  BAR: 'Bar',
  KEUKEN: 'Keuken',
  AFGEWERKT_PRODUCT: 'Afgewerkt product',
  DISTRIBUTIE: 'Distributie',
  MAGAZIJN: 'Magazijn',
  INKOOP: 'Inkoop',
  ADMIN: 'Admin',
};

const ROLE_LABEL_KEYS: Record<AppRole, TranslationKey> = {
  OWNER: 'account.role.owner',
  MANAGER: 'account.role.manager',
  WERKVLOER: 'account.role.workfloor',
  CHAUFFEUR: 'account.role.driver',
  restaurateur: 'account.role.owner',
  manager: 'account.role.manager',
  finance: 'account.role.finance',
  support: 'account.role.support',
  logistiek: 'account.role.logistics',
  medewerker: 'account.role.staff',
};

const FUNCTION_AREA_LABEL_KEYS: Record<TenantFunctionArea, TranslationKey> = {
  BAR: 'account.functionArea.bar',
  KEUKEN: 'account.functionArea.kitchen',
  AFGEWERKT_PRODUCT: 'account.functionArea.finishedProduct',
  DISTRIBUTIE: 'account.functionArea.distribution',
  MAGAZIJN: 'account.functionArea.warehouse',
  INKOOP: 'account.functionArea.purchasing',
  ADMIN: 'account.functionArea.admin',
};

function formatMembershipFunctionCount(functionCount: number, language: AppLanguage) {
  return `${functionCount} ${t('account.membership.functionsLabel', language)}`;
}

export const PERMISSION_LABELS: Record<TenantPermission | LegacyPermission, string> = {
  'company.manage_users.invite': 'Gebruikers uitnodigen',
  'company.manage_users.update_role': 'Rollen wijzigen',
  'branch.manage': 'Vestigingen beheren',
  'company.manage_data': 'Bedrijfsdata beheren',
  'inventory.read': 'Voorraad lezen',
  'inventory.create': 'Voorraad toevoegen',
  'inventory.update': 'Voorraad wijzigen',
  'inventory.delete': 'Voorraad verwijderen',
  'inventory.count': 'Voorraad tellen',
  'inventory.correct': 'Voorraad corrigeren',
  'stockmovement.read': 'Verplaatsingen lezen',
  'stockmovement.create': 'Verplaatsingen schrijven',
  'delivery.read': 'Leveringen lezen',
  'delivery.update_status': 'Leveringsstatus wijzigen',
  'delivery.confirm': 'Levering bevestigen',
  'delivery.reject': 'Levering weigeren',
  'transport.confirm_business_impact': 'Transport bedrijfsimpact bevestigen',
  'ai.suggestion.read': 'AI-voorstellen lezen',
  'ai.suggestion.create': 'AI-voorstellen maken',
  'ai.suggestion.approve': 'AI-voorstellen goedkeuren',
  'ai.suggestion.reject': 'AI-voorstellen afwijzen',
  'ai.settings.manage': 'AI-instellingen beheren',
  'finance.read': 'Financiële data lezen',
  'finance.manage': 'Financiële data beheren',
  'invoice.manage': 'Facturatielijn beheren',
  'reports.read': 'Rapporten lezen',
  'billing.manage': 'Facturatie beheren',
  'admin.manage': 'Admin beheren',
  manage_finance: 'Finance beheren',
  manage_security: 'Security beheren',
  manage_devtools: 'Beheerhulpmiddelen beheren',
};

export const TENANT_ROLE_PERMISSION_MAP: Record<TenantRole, readonly TenantPermission[]> = {
  OWNER: [
    'company.manage_users.invite',
    'company.manage_users.update_role',
    'branch.manage',
    'company.manage_data',
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
    'transport.confirm_business_impact',
    'ai.suggestion.read',
    'ai.suggestion.create',
    'ai.suggestion.approve',
    'ai.suggestion.reject',
    'ai.settings.manage',
    'finance.read',
    'finance.manage',
    'invoice.manage',
    'reports.read',
    'billing.manage',
    'admin.manage',
  ],
  MANAGER: [
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
    'transport.confirm_business_impact',
    'ai.suggestion.read',
    'ai.suggestion.create',
    'ai.suggestion.approve',
    'ai.suggestion.reject',
    'finance.read',
    'invoice.manage',
    'reports.read',
  ],
  WERKVLOER: [
    'inventory.read',
    'inventory.create',
    'inventory.update',
    'inventory.count',
    'inventory.correct',
    'stockmovement.read',
    'stockmovement.create',
    'delivery.read',
    'ai.suggestion.read',
    'ai.suggestion.create',
  ],
  CHAUFFEUR: [
    'inventory.read',
    'stockmovement.read',
    'stockmovement.create',
    'delivery.read',
    'delivery.update_status',
    'ai.suggestion.read',
    'ai.suggestion.create',
  ],
};

export const LEGACY_ROLE_PERMISSION_MAP: Record<LegacyAppRole, readonly LegacyPermission[]> = {
  restaurateur: ['manage_finance', 'manage_security', 'manage_devtools'],
  manager: ['manage_finance', 'manage_security'],
  finance: ['manage_finance'],
  support: ['manage_security'],
  logistiek: [],
  medewerker: [],
};

// Central role-pattern helpers keep business decisions, operations and control checks aligned.
export const OWNER_OR_MANAGER_ROLES = new Set<AppRole>(['OWNER', 'MANAGER', 'restaurateur', 'manager']);
export const OPERATIONAL_ROLES = new Set<AppRole>(['WERKVLOER', 'CHAUFFEUR', 'medewerker', 'logistiek']);

export const DEFAULT_FUNCTIONS_BY_ROLE: Record<TenantRole, readonly TenantFunctionArea[]> = {
  OWNER: ['ADMIN', 'INKOOP', 'MAGAZIJN', 'BAR', 'KEUKEN', 'AFGEWERKT_PRODUCT', 'DISTRIBUTIE'],
  MANAGER: ['ADMIN', 'MAGAZIJN', 'BAR', 'KEUKEN', 'AFGEWERKT_PRODUCT', 'DISTRIBUTIE'],
  WERKVLOER: ['BAR', 'KEUKEN', 'AFGEWERKT_PRODUCT', 'MAGAZIJN'],
  CHAUFFEUR: ['DISTRIBUTIE', 'MAGAZIJN'],
};

export type TenantCompanySummary = {
  id: string;
  name: string;
  legalName: string | null;
  slug: string;
  status: string;
};

export type TenantBranchSummary = {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  status: string;
};

export type TenantProviderAccount = {
  provider: string;
  providerAccountId: string;
  providerEmail: string | null;
  emailVerified: boolean;
  lastLoginAt: string | null;
};

export type TenantMembership = {
  id: string;
  userId: string;
  companyId: string;
  branchId: string | null;
  role: TenantRole;
  permissions: string[];
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'PENDING';
  isPrimary: boolean;
  invitedBy: string | null;
  createdAt: string;
  updatedAt: string;
  company: TenantCompanySummary;
  branch: TenantBranchSummary | null;
  functions: TenantFunctionArea[];
};

export type TenantContextSnapshot = {
  userId: string | null;
  email: string | null;
  membershipId: string | null;
  companyId: string | null;
  companyName: string | null;
  companySlug: string | null;
  branchId: string | null;
  branchName: string | null;
  branchCode: string | null;
  role: AppRole | null;
  functions: TenantFunctionArea[];
  permissions: string[];
  memberships: number;
  providers: string[];
};

export function isTenantRole(value: unknown): value is TenantRole {
  return value === 'OWNER' || value === 'MANAGER' || value === 'WERKVLOER' || value === 'CHAUFFEUR';
}

export function isLegacyRole(value: unknown): value is LegacyAppRole {
  return (
    value === 'restaurateur' ||
    value === 'manager' ||
    value === 'finance' ||
    value === 'support' ||
    value === 'logistiek' ||
    value === 'medewerker'
  );
}

export function normalizeAppRole(value: unknown): AppRole | null {
  if (isTenantRole(value) || isLegacyRole(value)) {
    return value;
  }
  return null;
}

export function normalizeFunctionArea(value: unknown): TenantFunctionArea | null {
  return FUNCTION_AREAS.includes(String(value) as TenantFunctionArea) ? (String(value) as TenantFunctionArea) : null;
}

export function normalizePermission(value: unknown): AppPermission | null {
  const candidate = String(value ?? '').trim();
  if (!candidate) return null;
  return candidate in PERMISSION_LABELS ? (candidate as AppPermission) : null;
}

export function getRoleLabel(role: string | null | undefined, language: AppLanguage = 'nl') {
  const normalized = normalizeAppRole(role);
  if (!normalized) return t('account.role.none', language);
  return t(ROLE_LABEL_KEYS[normalized], language);
}

export function getFunctionAreaLabel(area: string | null | undefined, language: AppLanguage = 'nl') {
  const normalized = normalizeFunctionArea(area);
  if (!normalized) return t('account.functionArea.unknown', language);
  return t(FUNCTION_AREA_LABEL_KEYS[normalized], language);
}

export function getPermissionLabel(permission: string | null | undefined) {
  const normalized = normalizePermission(permission);
  if (!normalized) return 'Onbekend';
  return PERMISSION_LABELS[normalized];
}

export function getPermissionsForRole(role: AppRole | null | undefined) {
  const normalized = normalizeAppRole(role);
  if (!normalized) return [] as AppPermission[];
  if (isTenantRole(normalized)) {
    return [...TENANT_ROLE_PERMISSION_MAP[normalized]];
  }
  return [...LEGACY_ROLE_PERMISSION_MAP[normalized]];
}

export function getDefaultFunctionsForRole(role: AppRole | null | undefined) {
  const normalized = normalizeAppRole(role);
  if (normalized && isTenantRole(normalized)) {
    return [...DEFAULT_FUNCTIONS_BY_ROLE[normalized]];
  }
  return [] as TenantFunctionArea[];
}

export function roleHasPermission(role: AppRole | null | undefined, permission: AppPermission, extraPermissions: string[] = []) {
  const normalizedRole = normalizeAppRole(role);
  if (!normalizedRole) return false;
  if (permission === 'manage_devtools') {
    return normalizedRole === 'restaurateur' || normalizedRole === 'OWNER';
  }
  if (permission === 'manage_finance') {
    return normalizedRole === 'restaurateur' || normalizedRole === 'OWNER' || normalizedRole === 'MANAGER' || normalizedRole === 'finance';
  }
  if (permission === 'manage_security') {
    return normalizedRole === 'restaurateur' || normalizedRole === 'OWNER' || normalizedRole === 'MANAGER' || normalizedRole === 'support';
  }

  const permissions = new Set<string>([...getPermissionsForRole(normalizedRole), ...extraPermissions]);
  return permissions.has(permission);
}

export function isOwnerOrManagerRole(role: AppRole | null | undefined) {
  const normalized = normalizeAppRole(role);
  return normalized ? OWNER_OR_MANAGER_ROLES.has(normalized) : false;
}

export function isOperationalRole(role: AppRole | null | undefined) {
  const normalized = normalizeAppRole(role);
  return normalized ? OPERATIONAL_ROLES.has(normalized) : false;
}

export function canManageCompanyData(role: AppRole | null | undefined, extraPermissions: string[] = []) {
  return roleHasPermission(role, 'company.manage_data', extraPermissions);
}

export function canManageInvoiceLine(role: AppRole | null | undefined, extraPermissions: string[] = []) {
  return roleHasPermission(role, 'invoice.manage', extraPermissions);
}

export function canManageAdminLine(role: AppRole | null | undefined, extraPermissions: string[] = []) {
  return roleHasPermission(role, 'admin.manage', extraPermissions) || roleHasPermission(role, 'manage_devtools', extraPermissions);
}

export function canConfirmTransportBusinessImpact(role: AppRole | null | undefined, extraPermissions: string[] = []) {
  return roleHasPermission(role, 'transport.confirm_business_impact', extraPermissions);
}

export function mapTenantRoleToLegacyRole(role: TenantRole | null | undefined): LegacyAppRole | null {
  if (!role) return null;
  if (role === 'OWNER') return 'restaurateur';
  if (role === 'MANAGER') return 'manager';
  if (role === 'WERKVLOER') return 'medewerker';
  if (role === 'CHAUFFEUR') return 'logistiek';
  return null;
}

export function buildMembershipDisplayLabel(membership: Pick<TenantMembership, 'company' | 'branch'>) {
  const company = membership.company.legalName?.trim() || membership.company.name.trim() || 'Bedrijf';
  const branch = membership.branch?.name?.trim() || membership.branch?.code?.trim() || '';
  return branch ? `${company} • ${branch}` : company;
}

export function buildMembershipSummary(membership: TenantMembership, language: AppLanguage = 'nl') {
  const functionCount = membership.functions.length;
  const branchLabel = membership.branch?.name?.trim() || membership.branch?.code?.trim() || 'Geen vestiging';
  return {
    label: buildMembershipDisplayLabel(membership),
    detail: `${getRoleLabel(membership.role, language)}${functionCount > 0 ? ` · ${formatMembershipFunctionCount(functionCount, language)}` : ''}`,
    branchLabel,
  };
}

export function sortMemberships(items: TenantMembership[]) {
  return [...items].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
    const leftCompany = left.company.name.toLowerCase();
    const rightCompany = right.company.name.toLowerCase();
    if (leftCompany !== rightCompany) return leftCompany.localeCompare(rightCompany);
    const leftBranch = left.branch?.name ?? '';
    const rightBranch = right.branch?.name ?? '';
    if (leftBranch !== rightBranch) return leftBranch.localeCompare(rightBranch);
    return left.createdAt.localeCompare(right.createdAt);
  });
}

export function pickPrimaryMembership(items: TenantMembership[], storedMembershipId?: string | null) {
  if (!items.length) return null;
  if (storedMembershipId) {
    const stored = items.find((item) => item.id === storedMembershipId && item.status === 'ACTIVE');
    if (stored) return stored;
  }
  const primary = items.find((item) => item.isPrimary && item.status === 'ACTIVE');
  if (primary) return primary;
  return items.find((item) => item.status === 'ACTIVE') ?? items[0] ?? null;
}

export function getTenantPermissionSet(role: AppRole | null | undefined, extraPermissions: string[] = []) {
  const normalizedRole = normalizeAppRole(role);
  if (!normalizedRole) return [];
  return Array.from(new Set([...getPermissionsForRole(normalizedRole), ...extraPermissions]));
}

export function buildTenantContextSnapshot(params: {
  userId: string | null;
  email: string | null;
  memberships: TenantMembership[];
  activeMembership: TenantMembership | null;
  providerAccounts?: TenantProviderAccount[];
}): TenantContextSnapshot {
  const active = params.activeMembership;
  return {
    userId: params.userId,
    email: params.email,
    membershipId: active?.id ?? null,
    companyId: active?.companyId ?? null,
    companyName: active?.company.name ?? null,
    companySlug: active?.company.slug ?? null,
    branchId: active?.branchId ?? null,
    branchName: active?.branch?.name ?? null,
    branchCode: active?.branch?.code ?? null,
    role: active?.role ?? null,
    functions: active?.functions ?? [],
    permissions: active ? getTenantPermissionSet(active.role, active.permissions) : [],
    memberships: params.memberships.length,
    providers: (params.providerAccounts ?? []).map((item) => item.provider),
  };
}
