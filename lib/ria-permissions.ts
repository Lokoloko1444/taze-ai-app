import {
  canConfirmTransportBusinessImpact,
  canManageAdminLine,
  canManageInvoiceLine,
  isOwnerOrManagerRole,
  normalizeAppRole,
  roleHasPermission,
  type AppPermission,
  type AppRole,
  type TenantFunctionArea,
} from 'lib/auth-model';

export type RiaLine = 'scan' | 'transport' | 'invoice' | 'admin' | 'ai' | 'demo' | 'api';
export type RiaAccessMode = 'read' | 'advise' | 'mutate' | 'execute';

export type RiaDecision = 'allowed' | 'denied';

export type GetRiaPermissionDecisionParams = {
  line: RiaLine;
  role: string | null | undefined;
  permissions?: string[] | null;
  functionAreas?: TenantFunctionArea[] | null;
};

export type GetRiaDataAccessDecisionParams = GetRiaPermissionDecisionParams & {
  accessMode: RiaAccessMode;
};

const SCAN_FUNCTION_AREAS: readonly TenantFunctionArea[] = ['BAR', 'KEUKEN', 'AFGEWERKT_PRODUCT', 'MAGAZIJN'];
const TRANSPORT_FUNCTION_AREAS: readonly TenantFunctionArea[] = ['DISTRIBUTIE'];

const SCAN_ROLES = new Set<AppRole>(['OWNER', 'MANAGER', 'WERKVLOER', 'restaurateur', 'manager', 'medewerker']);
const TRANSPORT_DRIVER_ROLES = new Set<AppRole>(['CHAUFFEUR', 'logistiek']);

function hasAnyFunctionArea(functionAreas: readonly TenantFunctionArea[], allowedAreas: readonly TenantFunctionArea[]) {
  return functionAreas.some((area) => allowedAreas.includes(area));
}

function hasAnyPermission(role: AppRole, permissions: string[], allowedPermissions: readonly AppPermission[]) {
  return allowedPermissions.some((permission) => roleHasPermission(role, permission, permissions));
}

function canAskScanAdvice(role: AppRole, permissions: string[], functionAreas: readonly TenantFunctionArea[]) {
  return SCAN_ROLES.has(role) && hasAnyFunctionArea(functionAreas, SCAN_FUNCTION_AREAS) && hasAnyPermission(role, permissions, ['inventory.read', 'inventory.create', 'inventory.update', 'inventory.correct']);
}

function canAskTransportAdvice(role: AppRole, permissions: string[], functionAreas: readonly TenantFunctionArea[]) {
  if (!hasAnyFunctionArea(functionAreas, TRANSPORT_FUNCTION_AREAS)) {
    return false;
  }

  if (TRANSPORT_DRIVER_ROLES.has(role)) {
    return permissions.includes('delivery.update_status');
  }

  if (isOwnerOrManagerRole(role)) {
    return hasAnyPermission(role, permissions, ['delivery.confirm', 'delivery.reject', 'delivery.read', 'delivery.update_status']) || canConfirmTransportBusinessImpact(role, permissions);
  }

  return false;
}

function canReadDemoOrApi(accessMode: RiaAccessMode) {
  return accessMode === 'read' || accessMode === 'advise';
}

export function getRiaDataAccessDecision({
  line,
  role,
  permissions = [],
  functionAreas = [],
  accessMode,
}: GetRiaDataAccessDecisionParams): RiaDecision {
  if (accessMode === 'mutate' || accessMode === 'execute') {
    return 'denied';
  }

  if (!canReadDemoOrApi(accessMode) || line === 'api') {
    return line === 'demo' ? 'allowed' : 'denied';
  }

  const normalizedRole = normalizeAppRole(role);
  if (!normalizedRole) {
    return 'denied';
  }

  if (line === 'demo') {
    return 'allowed';
  }

  if (line === 'scan') {
    return canAskScanAdvice(normalizedRole, permissions, functionAreas) ? 'allowed' : 'denied';
  }

  if (line === 'transport') {
    return canAskTransportAdvice(normalizedRole, permissions, functionAreas) ? 'allowed' : 'denied';
  }

  if (line === 'invoice') {
    return canManageInvoiceLine(normalizedRole, permissions) ? 'allowed' : 'denied';
  }

  if (line === 'admin') {
    return canManageAdminLine(normalizedRole, permissions) ? 'allowed' : 'denied';
  }

  if (line === 'ai') {
    return canAskScanAdvice(normalizedRole, permissions, functionAreas) ||
      canAskTransportAdvice(normalizedRole, permissions, functionAreas) ||
      canManageInvoiceLine(normalizedRole, permissions) ||
      canManageAdminLine(normalizedRole, permissions)
      ? 'allowed'
      : 'denied';
  }

  return 'denied';
}

export function getRiaPermissionDecision(params: GetRiaPermissionDecisionParams): RiaDecision {
  return getRiaDataAccessDecision({
    ...params,
    accessMode: 'advise',
  });
}

export function getRiaDeniedMessage(line: RiaLine, accessMode?: RiaAccessMode) {
  if (accessMode === 'mutate' || accessMode === 'execute') {
    return 'AI/RIA mag alleen adviseren en niets wijzigen.';
  }

  void line;
  return 'Dit valt buiten je bevoegdheid. Vraag een bevoegde persoon.';
}
