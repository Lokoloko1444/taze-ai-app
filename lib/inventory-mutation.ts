import { normalizeAppRole, roleHasPermission } from 'lib/auth-model';
import { getCachedTraceEvents, loadTraceEvents } from 'lib/trace-event-log';
import {
  buildInventoryPolicyDecision,
  getInventoryActionRiskLevel,
  type InventoryPolicyActor,
  type InventoryPolicyDecision,
  type InventoryPolicyTarget,
} from 'lib/inventory-policy';
import { appendTraceEvent as appendPersistenceTraceEvent } from 'lib/taze-persistence';
import type { PendingScanAction, PendingScanActionStatus, PendingScanActionType } from 'lib/scan-flow';

export type InventoryMutationSource = 'scan_observation' | 'manager_approval' | 'owner_approval';

export type StockMovementType =
  | 'count_adjustment'
  | 'damage_writeoff'
  | 'expiry_writeoff'
  | 'delivery_receive'
  | 'branch_transfer'
  | 'manual_note';

export type StockMovement = {
  id: string;
  companyId: string;
  branchId: string | null;
  productId: string | null;
  observationId: string;
  pendingActionId: string;
  movementType: StockMovementType;
  quantityDelta: number | null;
  unit: string | null;
  reason: string;
  source: InventoryMutationSource;
  createdByUserId: string;
  approvedByUserId: string | null;
  createdAt: string;
  traceEventId: string;
};

export type InventoryMutationTraceEvent = {
  id: string;
  createdAt: string;
  companyId: string;
  branchId: string | null;
  userId: string;
  membershipId: string;
  pendingActionId: string;
  observationId: string;
  previousStatus: PendingScanActionStatus;
  newStatus: PendingScanActionStatus;
  movementType: StockMovementType;
  source: InventoryMutationSource;
  note: string;
};

export type InventoryMutationErrorCode =
  | 'not_authenticated'
  | 'missing_membership'
  | 'inactive_membership'
  | 'wrong_company_scope'
  | 'wrong_branch_scope'
  | 'missing_confirmed_observation'
  | 'missing_approval'
  | 'missing_permission'
  | 'missing_trace_event'
  | 'already_applied'
  | 'rejected'
  | 'waiting_more_context'
  | 'ai_blocked'
  | 'internal_support_required';

export type InventoryMutationValidation = {
  ok: boolean;
  canMutate: boolean;
  policy: InventoryPolicyDecision;
  errorCode: InventoryMutationErrorCode | null;
  safeMessage: string;
};

export type InventoryMutationContext = {
  actor: InventoryPolicyActor & { userId: string | null };
  target: InventoryPolicyTarget;
};

export type InventoryMutationResult =
  | {
      ok: true;
      movement: StockMovement;
      traceEvent: InventoryMutationTraceEvent;
      appliedAction: PendingScanAction & { status: 'applied' };
      policy: InventoryPolicyDecision;
      errorCode: null;
      safeMessage: '';
    }
  | {
      ok: false;
      errorCode: InventoryMutationErrorCode;
      safeMessage: string;
      policy: InventoryPolicyDecision;
    };

const MUTATION_ERROR_MESSAGES: Record<InventoryMutationErrorCode, string> = {
  not_authenticated: 'Je moet ingelogd zijn om deze voorraadmutatie uit te voeren.',
  missing_membership: 'Een actieve membership is nodig voor deze voorraadmutatie.',
  inactive_membership: 'Deze membership is niet actief genoeg om voorraad te muteren.',
  wrong_company_scope: 'Deze voorraadmutatie hoort bij een andere company.',
  wrong_branch_scope: 'Deze voorraadmutatie hoort bij een andere vestiging.',
  missing_confirmed_observation: 'Een bevestigde observatie is nodig voordat voorraad kan wijzigen.',
  missing_approval: 'Deze actie wacht nog op de juiste goedkeuring.',
  missing_permission: 'Je mist de juiste permissie voor deze voorraadmutatie.',
  missing_trace_event: 'Er moet eerst een trace-event zijn voordat de voorraad wijzigt.',
  already_applied: 'Deze pending actie is al toegepast.',
  rejected: 'Een afgewezen actie kan niet opnieuw worden toegepast.',
  waiting_more_context: 'Deze actie wacht nog op extra context.',
  ai_blocked: 'AI mag geen voorraadmutatie uitvoeren.',
  internal_support_required: 'Interne Taze-acties mogen alleen in gelogde support mode lopen.',
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeActionType(actionType: PendingScanActionType) {
  return actionType;
}

export function getInventoryMutationMovementType(actionType: PendingScanActionType): StockMovementType {
  switch (actionType) {
    case 'count_stock':
    case 'stock_correction':
      return 'count_adjustment';
    case 'report_damage':
      return 'damage_writeoff';
    case 'report_expiry':
      return 'expiry_writeoff';
    case 'receive_delivery':
      return 'delivery_receive';
    case 'transfer_inventory':
      return 'branch_transfer';
    case 'manual_product_entry':
    default:
      return 'manual_note';
  }
}

function getSafeMessage(code: InventoryMutationErrorCode) {
  return MUTATION_ERROR_MESSAGES[code];
}

function buildBlockedValidation(policy: InventoryPolicyDecision, errorCode: InventoryMutationErrorCode): InventoryMutationValidation {
  return {
    ok: false,
    canMutate: false,
    policy,
    errorCode,
    safeMessage: getSafeMessage(errorCode),
  };
}

function buildAllowedValidation(policy: InventoryPolicyDecision): InventoryMutationValidation {
  return {
    ok: true,
    canMutate: true,
    policy,
    errorCode: null,
    safeMessage: '',
  };
}

function getActiveMembershipStatus(actor: InventoryMutationContext['actor']) {
  const membershipStatus = actor.membershipStatus ?? null;
  if (membershipStatus) {
    return membershipStatus;
  }
  return actor.membershipId ? 'ACTIVE' : null;
}

function buildMutationPolicy(context: InventoryMutationContext, pendingAction: PendingScanAction, traceEventRecorded: boolean) {
  return buildInventoryPolicyDecision({
    actor: context.actor,
    target: context.target,
    actionType: normalizeActionType(pendingAction.actionType),
    riskLevel: pendingAction.riskLevel ?? getInventoryActionRiskLevel(pendingAction.actionType),
    observationConfirmed: pendingAction.observationStatus === 'confirmed',
    traceEventRecorded,
    observationStatus: pendingAction.observationStatus,
  });
}

function hasTraceEventReady(traceEvent?: InventoryMutationTraceEvent | null) {
  return Boolean(traceEvent && traceEvent.id && traceEvent.createdAt);
}

function hasAppliedMutationTrace(entries: { eventKind: string; note: string }[], pendingActionId: string) {
  return entries.some(
    (entry) =>
      entry.eventKind === 'inventory_mutation' &&
      entry.note.includes(`pendingAction=${pendingActionId}`) &&
      entry.note.includes('new=applied')
  );
}

function getApprovalStatusReason(policy: InventoryPolicyDecision, action: PendingScanAction): InventoryMutationErrorCode | null {
  if (action.status === 'rejected') {
    return 'rejected';
  }

  if (action.status === 'context_requested') {
    return 'waiting_more_context';
  }

  if (action.status === 'applied') {
    return 'already_applied';
  }

  if (!policy.canApplyImmediately && action.status !== 'approved') {
    return 'missing_approval';
  }

  return null;
}

export function validateMutationPreconditions(
  context: InventoryMutationContext,
  pendingAction: PendingScanAction,
  options: { traceEvent?: InventoryMutationTraceEvent | null; requireTraceEvent?: boolean } = {}
): InventoryMutationValidation {
  const actor = context.actor;
  const normalizedRole = normalizeAppRole(actor.role);
  const membershipStatus = getActiveMembershipStatus(actor);
  const policy = buildMutationPolicy(context, pendingAction, hasTraceEventReady(options.traceEvent));

  if (!actor.userId) {
    return buildBlockedValidation(policy, 'not_authenticated');
  }

  if (!actor.companyId || !context.target.companyId) {
    return buildBlockedValidation(policy, 'missing_membership');
  }

  if (!actor.branchId || !context.target.branchId) {
    return buildBlockedValidation(policy, 'missing_membership');
  }

  if (!actor.membershipId) {
    return buildBlockedValidation(policy, 'missing_membership');
  }

  if (membershipStatus !== 'ACTIVE') {
    return buildBlockedValidation(policy, 'inactive_membership');
  }

  if (actor.actorKind === 'ai') {
    return buildBlockedValidation(policy, 'ai_blocked');
  }

  if (actor.actorKind === 'internal' && !actor.supportMode) {
    return buildBlockedValidation(policy, 'internal_support_required');
  }

  if (context.target.companyId !== actor.companyId || pendingAction.companyId !== actor.companyId) {
    return buildBlockedValidation(policy, 'wrong_company_scope');
  }

  if (normalizedRole !== 'OWNER' && context.target.branchId !== actor.branchId) {
    return buildBlockedValidation(policy, 'wrong_branch_scope');
  }

  if (normalizedRole !== 'OWNER' && pendingAction.branchId && pendingAction.branchId !== actor.branchId) {
    return buildBlockedValidation(policy, 'wrong_branch_scope');
  }

  if (pendingAction.status === 'rejected') {
    return buildBlockedValidation(policy, 'rejected');
  }

  if (pendingAction.status === 'applied') {
    return buildBlockedValidation(policy, 'already_applied');
  }

  if (hasAppliedMutationTrace(getCachedTraceEvents(), pendingAction.id)) {
    return buildBlockedValidation(policy, 'already_applied');
  }

  if (!pendingAction.observationStatus || pendingAction.observationStatus !== 'confirmed') {
    return buildBlockedValidation(policy, 'missing_confirmed_observation');
  }

  if (!policy.requiredPermission || !roleHasPermission(normalizedRole, policy.requiredPermission, actor.permissions)) {
    return buildBlockedValidation(policy, 'missing_permission');
  }

  const approvalReason = getApprovalStatusReason(policy, pendingAction);
  if (approvalReason) {
    return buildBlockedValidation(policy, approvalReason);
  }

  if (options.requireTraceEvent && !hasTraceEventReady(options.traceEvent)) {
    return buildBlockedValidation(policy, 'missing_trace_event');
  }

  return buildAllowedValidation(policy);
}

export function canMutateInventory(context: InventoryMutationContext, pendingAction: PendingScanAction) {
  return validateMutationPreconditions(context, pendingAction, { requireTraceEvent: false }).canMutate;
}

export function getInventoryMutationSource(
  role: string | null,
  actionType: PendingScanActionType,
  actorKind?: InventoryPolicyActor['actorKind']
) {
  const normalizedRole = normalizeAppRole(role);
  if (normalizedRole === 'OWNER' || actorKind === 'internal') {
    return 'owner_approval' as const;
  }
  if (normalizedRole === 'MANAGER') {
    return 'manager_approval' as const;
  }
  return actionType === 'receive_delivery' ? 'manager_approval' : 'scan_observation';
}

export function buildInventoryMutationTraceEvent(
  context: InventoryMutationContext,
  pendingAction: PendingScanAction,
  movementType: StockMovementType,
  previousStatus: PendingScanActionStatus,
  newStatus: PendingScanActionStatus,
  source: InventoryMutationSource
): InventoryMutationTraceEvent {
  const createdAt = new Date().toISOString();
  return {
    id: createId('inventory-mutation-trace'),
    createdAt,
    companyId: context.actor.companyId ?? context.target.companyId ?? pendingAction.companyId ?? 'unknown-company',
    branchId: context.target.branchId ?? pendingAction.branchId ?? context.actor.branchId ?? null,
    userId: context.actor.userId ?? 'unknown-user',
    membershipId: context.actor.membershipId ?? 'unknown-membership',
    pendingActionId: pendingAction.id,
    observationId: pendingAction.observationId,
    previousStatus,
    newStatus,
    movementType,
    source,
    note: `previous=${previousStatus} new=${newStatus} movementType=${movementType} action=${pendingAction.actionType} risk=${pendingAction.riskLevel ?? getInventoryActionRiskLevel(pendingAction.actionType)}`,
  };
}

function getMovementQuantityDelta(actionType: PendingScanActionType) {
  switch (actionType) {
    case 'receive_delivery':
      return 0;
    case 'manual_product_entry':
      return null;
    case 'count_stock':
    case 'stock_correction':
    case 'report_damage':
    case 'report_expiry':
    case 'transfer_inventory':
    case 'remove_inventory':
    default:
      return null;
  }
}

function getMovementReason(pendingAction: PendingScanAction, policy: InventoryPolicyDecision, movementType: StockMovementType) {
  const base = pendingAction.policyReason ?? policy.reason;
  return `${pendingAction.actionType} -> ${movementType}. ${base}`;
}

export function buildInventoryMovement(
  context: InventoryMutationContext,
  pendingAction: PendingScanAction,
  traceEvent: InventoryMutationTraceEvent
): StockMovement {
  const policy = buildMutationPolicy(context, pendingAction, true);
  const movementType = traceEvent.movementType;
  const source = traceEvent.source;
  const approvedByUserId = context.actor.userId ?? null;

  return {
    id: createId('stock-movement'),
    companyId: context.actor.companyId ?? pendingAction.companyId ?? context.target.companyId ?? 'unknown-company',
    branchId: context.target.branchId ?? pendingAction.branchId ?? context.actor.branchId ?? null,
    productId: null,
    observationId: pendingAction.observationId,
    pendingActionId: pendingAction.id,
    movementType,
    quantityDelta: getMovementQuantityDelta(pendingAction.actionType),
    unit: null,
    reason: getMovementReason(pendingAction, policy, movementType),
    source,
    createdByUserId: context.actor.userId ?? 'unknown-user',
    approvedByUserId,
    createdAt: traceEvent.createdAt,
    traceEventId: traceEvent.id,
  };
}

async function appendInventoryMutationTraceEvent(
  context: InventoryMutationContext,
  pendingAction: PendingScanAction,
  traceEvent: InventoryMutationTraceEvent
) {
  await appendPersistenceTraceEvent(
    {
      companyId: traceEvent.companyId,
      branchId: traceEvent.branchId,
      userId: traceEvent.userId,
      membershipId: traceEvent.membershipId,
      membershipStatus: 'ACTIVE',
      role: normalizeAppRole(context.actor.role),
      permissions: context.actor.permissions,
      functionAreas: context.actor.functions,
      supportMode: context.actor.supportMode ?? false,
      actorKind: context.actor.actorKind ?? 'user',
    },
    {
      id: traceEvent.id,
      createdAt: traceEvent.createdAt,
      eventType: 'inventory_mutation',
      companyId: traceEvent.companyId,
      branchId: traceEvent.branchId,
      userId: traceEvent.userId,
      membershipId: traceEvent.membershipId,
      observationId: traceEvent.observationId,
      pendingActionId: traceEvent.pendingActionId,
      previousStatus: traceEvent.previousStatus,
      newStatus: traceEvent.newStatus,
      movementType: traceEvent.movementType,
      productId: null,
      itemName: pendingAction.recognitionLabel ?? pendingAction.sourceObservationLabel ?? pendingAction.actionType,
      rawValue: pendingAction.recognitionLabel ?? pendingAction.sourceObservationLabel ?? pendingAction.actionType,
      sourceLabel: traceEvent.source,
      confidence: null,
      note: `[inventory_mutation] user=${context.actor.userId ?? 'unknown'} company=${traceEvent.companyId} branch=${traceEvent.branchId ?? 'unknown'} membership=${traceEvent.membershipId} pendingAction=${traceEvent.pendingActionId} observation=${traceEvent.observationId} previous=${traceEvent.previousStatus} new=${traceEvent.newStatus} movementType=${traceEvent.movementType} source=${traceEvent.source} ${traceEvent.note}`,
    }
  );
}

export async function applyInventoryMutation(
  context: InventoryMutationContext,
  pendingAction: PendingScanAction,
  traceEvent: InventoryMutationTraceEvent | null
): Promise<InventoryMutationResult> {
  const validation = validateMutationPreconditions(context, pendingAction, { traceEvent, requireTraceEvent: true });

  if (!validation.ok || !traceEvent) {
    return {
      ok: false,
      errorCode: validation.errorCode ?? 'missing_trace_event',
      safeMessage: validation.safeMessage || getSafeMessage(validation.errorCode ?? 'missing_trace_event'),
      policy: validation.policy,
    };
  }

  const existingTraceEvents = getCachedTraceEvents().length ? getCachedTraceEvents() : await loadTraceEvents();
  if (hasAppliedMutationTrace(existingTraceEvents, pendingAction.id)) {
    return {
      ok: false,
      errorCode: 'already_applied',
      safeMessage: getSafeMessage('already_applied'),
      policy: validation.policy,
    };
  }

  try {
    await appendInventoryMutationTraceEvent(context, pendingAction, traceEvent);
  } catch {
    return {
      ok: false,
      errorCode: 'missing_trace_event',
      safeMessage: getSafeMessage('missing_trace_event'),
      policy: validation.policy,
    };
  }

  const movement = buildInventoryMovement(context, pendingAction, traceEvent);

  return {
    ok: true,
    movement,
    traceEvent,
    appliedAction: {
      ...pendingAction,
      status: 'applied',
    },
    policy: validation.policy,
    errorCode: null,
    safeMessage: '',
  };
}
