import { normalizeAppRole, roleHasPermission, type AppPermission, type TenantFunctionArea } from 'lib/auth-model';
import type { PendingScanActionStatus, PendingScanActionType, ScanObservationStatus } from 'lib/scan-flow';

export type InventoryRiskLevel = 'low' | 'medium' | 'high';

export type InventoryActionType =
  | PendingScanActionType
  | 'stock_correction'
  | 'remove_inventory'
  | 'transfer_inventory';

export type InventoryPolicyActor = {
  companyId: string | null;
  branchId: string | null;
  membershipId: string | null;
  membershipStatus?: string | null;
  role: string | null;
  permissions: string[];
  functions: TenantFunctionArea[];
  actorKind?: 'user' | 'ai' | 'internal';
  supportMode?: boolean;
};

export type InventoryPolicyTarget = {
  companyId: string | null;
  branchId: string | null;
};

export type InventoryPolicyContext = {
  actor: InventoryPolicyActor;
  target: InventoryPolicyTarget;
  actionType: InventoryActionType;
  riskLevel?: InventoryRiskLevel;
  observationConfirmed?: boolean;
  traceEventRecorded?: boolean;
  observationStatus?: ScanObservationStatus | null;
};

export type InventoryPolicyDecision = {
  actionType: InventoryActionType;
  riskLevel: InventoryRiskLevel;
  requiredPermission: AppPermission | null;
  requiredFunctionAreas: TenantFunctionArea[];
  canApplyImmediately: boolean;
  requiresManagerApproval: boolean;
  canApprove: boolean;
  canReject: boolean;
  canRequestMoreContext: boolean;
  traceEventRequired: boolean;
  reason: string;
};

const LOW_RISK_ACTIONS = new Set<InventoryActionType>(['manual_product_entry']);
const MEDIUM_RISK_ACTIONS = new Set<InventoryActionType>(['count_stock', 'report_damage', 'report_expiry']);
const HIGH_RISK_ACTIONS = new Set<InventoryActionType>(['receive_delivery', 'stock_correction', 'remove_inventory', 'transfer_inventory']);

const BAR_AND_KITCHEN_FUNCTIONS: readonly TenantFunctionArea[] = ['BAR', 'KEUKEN', 'AFGEWERKT_PRODUCT', 'MAGAZIJN', 'INKOOP'];
const DELIVERY_FUNCTIONS: readonly TenantFunctionArea[] = ['DISTRIBUTIE', 'MAGAZIJN', 'INKOOP'];

function toSet(values: readonly TenantFunctionArea[]) {
  return new Set(values);
}

function hasAnyFunction(actorFunctions: TenantFunctionArea[], requiredFunctions: readonly TenantFunctionArea[]) {
  if (!requiredFunctions.length) {
    return true;
  }

  const functionSet = toSet(actorFunctions);
  return requiredFunctions.some((item) => functionSet.has(item));
}

function asTenantFunctionAreas(values: readonly TenantFunctionArea[]): TenantFunctionArea[] {
  return [...values];
}

function getRequiredPermission(actionType: InventoryActionType): AppPermission {
  switch (actionType) {
    case 'count_stock':
      return 'inventory.count';
    case 'report_damage':
    case 'report_expiry':
    case 'stock_correction':
      return 'inventory.correct';
    case 'receive_delivery':
      return 'delivery.confirm';
    case 'remove_inventory':
      return 'inventory.delete';
    case 'transfer_inventory':
      return 'stockmovement.create';
    case 'manual_product_entry':
    default:
      return 'inventory.create';
  }
}

export function getInventoryActionRiskLevel(actionType: InventoryActionType): InventoryRiskLevel {
  if (LOW_RISK_ACTIONS.has(actionType)) {
    return 'low';
  }

  if (MEDIUM_RISK_ACTIONS.has(actionType)) {
    return 'medium';
  }

  if (HIGH_RISK_ACTIONS.has(actionType)) {
    return 'high';
  }

  return 'medium';
}

export function getInventoryActionFunctionAreas(actionType: InventoryActionType): TenantFunctionArea[] {
  switch (actionType) {
    case 'receive_delivery':
    case 'transfer_inventory':
    case 'remove_inventory':
      return asTenantFunctionAreas(DELIVERY_FUNCTIONS);
    case 'count_stock':
    case 'report_damage':
    case 'report_expiry':
    case 'stock_correction':
      return asTenantFunctionAreas(BAR_AND_KITCHEN_FUNCTIONS);
    case 'manual_product_entry':
    default:
      return [...BAR_AND_KITCHEN_FUNCTIONS, 'DISTRIBUTIE'];
  }
}

function buildBlockedDecision(actionType: InventoryActionType, riskLevel: InventoryRiskLevel, reason: string): InventoryPolicyDecision {
  return {
    actionType,
    riskLevel,
    requiredPermission: null,
    requiredFunctionAreas: getInventoryActionFunctionAreas(actionType),
    canApplyImmediately: false,
    requiresManagerApproval: true,
    canApprove: false,
    canReject: false,
    canRequestMoreContext: false,
    traceEventRequired: true,
    reason,
  };
}

function buildAllowedDecision(params: {
  actionType: InventoryActionType;
  riskLevel: InventoryRiskLevel;
  requiredPermission: AppPermission;
  requiredFunctionAreas: readonly TenantFunctionArea[];
  canApplyImmediately: boolean;
  requiresManagerApproval: boolean;
  canApprove: boolean;
  reason: string;
}): InventoryPolicyDecision {
  return {
    actionType: params.actionType,
    riskLevel: params.riskLevel,
    requiredPermission: params.requiredPermission,
    requiredFunctionAreas: [...params.requiredFunctionAreas],
    canApplyImmediately: params.canApplyImmediately,
    requiresManagerApproval: params.requiresManagerApproval,
    canApprove: params.canApprove,
    canReject: params.canApprove,
    canRequestMoreContext: params.canApprove,
    traceEventRequired: true,
    reason: params.reason,
  };
}

export function buildInventoryPolicyDecision(params: InventoryPolicyContext): InventoryPolicyDecision {
  const riskLevel = params.riskLevel ?? getInventoryActionRiskLevel(params.actionType);
  const requiredPermission = getRequiredPermission(params.actionType);
  const requiredFunctionAreas = getInventoryActionFunctionAreas(params.actionType);
  const actor = params.actor;
  const normalizedRole = normalizeAppRole(actor.role);
  const activeMembership = actor.membershipStatus ? actor.membershipStatus === 'ACTIVE' : Boolean(actor.membershipId);
  const actorKind = actor.actorKind ?? 'user';

  if (!params.target.companyId || !params.target.branchId) {
    return buildBlockedDecision(params.actionType, riskLevel, 'Company en vestiging zijn nodig voor een veilige inventory policy.');
  }

  if (!actor.companyId || !actor.branchId || !actor.membershipId || !activeMembership) {
    return buildBlockedDecision(params.actionType, riskLevel, 'Een actieve membership met company- en branchcontext is vereist.');
  }

  if (params.target.companyId !== actor.companyId) {
    return buildBlockedDecision(params.actionType, riskLevel, 'Cross-company inventoryacties zijn geblokkeerd.');
  }

  if (actorKind === 'ai') {
    return buildBlockedDecision(params.actionType, riskLevel, 'AI mag geen voorraadactie goedkeuren of toepassen.');
  }

  if (actorKind === 'internal' && !actor.supportMode) {
    return buildBlockedDecision(params.actionType, riskLevel, 'Interne Taze-rollen mogen klantdata alleen via support mode behandelen.');
  }

  if (
    actorKind === 'internal' &&
    actor.supportMode &&
    (actor.permissions.includes('manage_devtools') || roleHasPermission(normalizedRole, 'manage_devtools', actor.permissions))
  ) {
    return buildAllowedDecision({
      actionType: params.actionType,
      riskLevel,
      requiredPermission,
      requiredFunctionAreas,
      canApplyImmediately: false,
      requiresManagerApproval: true,
      canApprove: true,
      reason: 'Support mode geeft een gelogde interne reviewmogelijkheid, maar geen directe voorraadmutatie.',
    });
  }

  const scopeRole = normalizedRole === 'OWNER' || normalizedRole === 'MANAGER';
  const branchScoped = normalizedRole === 'OWNER' || actor.branchId === params.target.branchId;
  const hasFunctionAccess = hasAnyFunction(actor.functions, requiredFunctionAreas);

  if (!scopeRole && !hasFunctionAccess) {
    return buildBlockedDecision(params.actionType, riskLevel, 'Deze functiegebieden geven geen toegang tot deze inventoryactie.');
  }

  if (normalizedRole === 'MANAGER' && !branchScoped) {
    return buildBlockedDecision(params.actionType, riskLevel, 'Deze branchscope geeft geen toegang tot deze inventoryactie.');
  }

  if (normalizedRole === 'MANAGER' && !hasFunctionAccess) {
    return buildBlockedDecision(params.actionType, riskLevel, 'Deze functiegebieden geven geen toegang tot deze inventoryactie.');
  }

  const hasPermission = roleHasPermission(normalizedRole, requiredPermission, actor.permissions);
  if (!hasPermission) {
    return buildBlockedDecision(params.actionType, riskLevel, `Recht ${requiredPermission} is nodig voor deze actie.`);
  }

  if (riskLevel === 'low') {
    return buildAllowedDecision({
      actionType: params.actionType,
      riskLevel,
      requiredPermission,
      requiredFunctionAreas,
      canApplyImmediately: true,
      requiresManagerApproval: false,
      canApprove: false,
      reason: 'Low-risk observaties kunnen direct bevestigd worden zonder managergoedkeuring.',
    });
  }

  const canApprove = normalizedRole === 'OWNER' ? branchScoped : normalizedRole === 'MANAGER' ? branchScoped && hasFunctionAccess : false;

  if (riskLevel === 'medium') {
    return buildAllowedDecision({
      actionType: params.actionType,
      riskLevel,
      requiredPermission,
      requiredFunctionAreas,
      canApplyImmediately: false,
      requiresManagerApproval: true,
      canApprove,
      reason: canApprove
        ? 'Manager- of ownergoedkeuring is vereist voordat de voorraad kan wijzigen.'
        : 'Middelzware acties wachten op manager- of ownergoedkeuring.',
    });
  }

  return buildAllowedDecision({
    actionType: params.actionType,
    riskLevel,
    requiredPermission,
    requiredFunctionAreas,
    canApplyImmediately: false,
    requiresManagerApproval: true,
    canApprove,
    reason: canApprove
      ? 'High-risk acties kunnen alleen na branch- of companyscope goedkeuring verder.'
      : 'High-risk inventoryacties wachten op manager- of ownergoedkeuring.',
  });
}

export function canApplyInventoryMutation(params: {
  decision: InventoryPolicyDecision;
  observationConfirmed: boolean;
  traceEventRecorded: boolean;
  approvalStatus: PendingScanActionStatus;
}) {
  if (!params.observationConfirmed || !params.traceEventRecorded) {
    return false;
  }

  if (params.decision.requiresManagerApproval) {
    return params.approvalStatus === 'approved';
  }

  return params.decision.canApplyImmediately && params.approvalStatus !== 'rejected';
}
