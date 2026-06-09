import { expect, test } from '@playwright/test';

import { buildInventoryMovement, buildInventoryMutationTraceEvent, type InventoryMutationContext, type InventoryMutationTraceEvent } from 'lib/inventory-mutation';
import {
  buildPendingScanAction,
  buildScanObservation,
  buildScanRecognitionResult,
} from 'lib/scan-flow';
import {
  clearTazePersistenceForTests,
  createPendingScanAction,
  createScanObservation,
  createStockMovement,
  getPendingActionsForBranch,
  getPendingActionsForMembership,
  getTraceEventsForAction,
  hasActionBeenApplied,
  resetTazePersistenceCacheForTests,
  saveRecognitionResult,
  setTazePersistenceStorageModeForTests,
  updatePendingScanActionStatus,
  updateScanObservationStatus,
  type PersistenceContext,
  type TraceEventInput,
} from 'lib/taze-persistence';

test.describe.configure({ mode: 'serial' });

const baseContext: PersistenceContext = {
  companyId: 'company_456',
  branchId: 'branch_789',
  userId: 'user_123',
  membershipId: 'membership_123',
  membershipStatus: 'ACTIVE',
  role: 'MANAGER',
  permissions: ['inventory.read', 'inventory.update', 'inventory.count', 'inventory.correct', 'stockmovement.create', 'ai.suggestion.read'],
  functionAreas: ['BAR', 'KEUKEN', 'MAGAZIJN'],
  supportMode: false,
  actorKind: 'user',
};

function makeContext(overrides: Partial<PersistenceContext> = {}): PersistenceContext {
  return {
    ...baseContext,
    ...overrides,
    permissions: overrides.permissions ?? baseContext.permissions,
    functionAreas: overrides.functionAreas ?? baseContext.functionAreas,
  };
}

function buildTraceInput(traceEvent: InventoryMutationTraceEvent, actionLabel: string): TraceEventInput {
  return {
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
    itemName: actionLabel,
    rawValue: actionLabel,
    sourceLabel: traceEvent.source,
    confidence: null,
    note: traceEvent.note,
  };
}

async function seedObservedAction(context: PersistenceContext, actionType = 'stock_correction') {
  const observation = buildScanObservation({
    companyId: context.companyId ?? 'company_456',
    branchId: context.branchId ?? 'branch_789',
    userId: context.userId ?? 'user_123',
    membershipId: context.membershipId ?? 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const createdObservation = await createScanObservation(context, observation);
  expect(createdObservation.ok).toBe(true);
  if (createdObservation.ok === false) throw new Error(createdObservation.safeMessage);

  const confirmedObservation = await updateScanObservationStatus(context, createdObservation.value.id, 'confirmed');
  expect(confirmedObservation.ok).toBe(true);
  if (confirmedObservation.ok === false) throw new Error(confirmedObservation.safeMessage);

  const recognition = buildScanRecognitionResult({
    observation: confirmedObservation.value,
    recognition: {
      name: 'Cola 33cl',
      category: 'Drank',
      quantity: 1,
      expiryDays: 4,
      confidence: 0.91,
      notes: 'Barcode match',
      source: 'barcode-lookup',
      barcode: '8710400131474',
    } as any,
    manualName: null,
  });

  const storedRecognition = await saveRecognitionResult(context, recognition);
  expect(storedRecognition.ok).toBe(true);
  if (storedRecognition.ok === false) throw new Error(storedRecognition.safeMessage);

  const pendingAction = buildPendingScanAction({
    observation: confirmedObservation.value,
    actionType: actionType as any,
    role: context.role,
    permissions: context.permissions,
    companyId: context.companyId,
    branchId: context.branchId,
    membershipId: context.membershipId,
    functions: context.functionAreas,
    sourceObservationLabel: 'Barcode · 8710400131474',
    recognitionLabel: storedRecognition.value.sourceLabel,
    observationStatus: confirmedObservation.value.status,
  });

  const storedAction = await createPendingScanAction(context, pendingAction);
  expect(storedAction.ok).toBe(true);
  if (storedAction.ok === false) throw new Error(storedAction.safeMessage);

  return {
    observation: confirmedObservation.value,
    recognition: storedRecognition.value,
    pendingAction: storedAction.value,
  };
}

function buildInventoryMutationContext(context: PersistenceContext): InventoryMutationContext {
  const actorKind = context.actorKind === 'system' ? 'internal' : context.actorKind;

  return {
    actor: {
      companyId: context.companyId,
      branchId: context.branchId,
      membershipId: context.membershipId,
      membershipStatus: context.membershipStatus,
      role: context.role,
      permissions: context.permissions,
      functions: context.functionAreas,
      userId: context.userId,
      supportMode: context.supportMode,
      actorKind,
    },
    target: {
      companyId: context.companyId,
      branchId: context.branchId,
    },
  };
}

test.beforeEach(async () => {
  await clearTazePersistenceForTests();
  setTazePersistenceStorageModeForTests('memory-only');
  await resetTazePersistenceCacheForTests();
});

test.afterEach(async () => {
  await clearTazePersistenceForTests();
});

test('create observation with tenant context', async () => {
  const result = await createScanObservation(
    makeContext(),
    buildScanObservation({
      companyId: baseContext.companyId ?? 'company_456',
      branchId: baseContext.branchId ?? 'branch_789',
      userId: baseContext.userId ?? 'user_123',
      membershipId: baseContext.membershipId ?? 'membership_123',
      source: 'barcode',
      rawValue: '8710400131474',
    })
  );

  expect(result.ok).toBe(true);
  if (result.ok === false) throw new Error(result.safeMessage);
  expect(result.value.status).toBe('draft');
  expect(result.value.traceEventId).toBeTruthy();
});

test('reject scan observation creation without companyId', async () => {
  const result = await createScanObservation(
    makeContext({ companyId: null }),
    buildScanObservation({
      companyId: baseContext.companyId ?? 'company_456',
      branchId: baseContext.branchId ?? 'branch_789',
      userId: baseContext.userId ?? 'user_123',
      membershipId: baseContext.membershipId ?? 'membership_123',
      source: 'barcode',
      rawValue: '8710400131474',
    })
  );

  expect(result.ok).toBe(false);
  if (result.ok === true) throw new Error('Expected failure');
  expect(result.errorCode).toBe('missing_company_id');
});

test('reject scan observation creation without membershipId', async () => {
  const result = await createScanObservation(
    makeContext({ membershipId: null }),
    buildScanObservation({
      companyId: baseContext.companyId ?? 'company_456',
      branchId: baseContext.branchId ?? 'branch_789',
      userId: baseContext.userId ?? 'user_123',
      membershipId: baseContext.membershipId ?? 'membership_123',
      source: 'barcode',
      rawValue: '8710400131474',
    })
  );

  expect(result.ok).toBe(false);
  if (result.ok === true) throw new Error('Expected failure');
  expect(result.errorCode).toBe('missing_membership_id');
});

test('reject branch-scoped write without branchId', async () => {
  const result = await createScanObservation(
    makeContext({ branchId: null }),
    buildScanObservation({
      companyId: baseContext.companyId ?? 'company_456',
      branchId: baseContext.branchId ?? 'branch_789',
      userId: baseContext.userId ?? 'user_123',
      membershipId: baseContext.membershipId ?? 'membership_123',
      source: 'barcode',
      rawValue: '8710400131474',
    })
  );

  expect(result.ok).toBe(false);
  if (result.ok === true) throw new Error('Expected failure');
  expect(result.errorCode).toBe('missing_branch_id');
});

test('block cross-company pending action read', async () => {
  const seeded = await seedObservedAction(makeContext());
  const otherContext = makeContext({
    companyId: 'company_other',
    branchId: 'branch_other',
    membershipId: 'membership_other',
    userId: 'user_other',
  });

  const result = await getPendingActionsForMembership(otherContext);
  expect(result.ok).toBe(true);
  if (result.ok === false) throw new Error(result.safeMessage);
  expect(result.value).toHaveLength(0);

  const traceResult = await getTraceEventsForAction(otherContext, seeded.pendingAction.id);
  expect(traceResult.ok).toBe(false);
  if (traceResult.ok === true) throw new Error('Expected failure');
  const traceFailure = traceResult;
  expect(traceFailure.errorCode).toBe('cross_company_scope');
});

test('block cross-branch pending action read', async () => {
  await seedObservedAction(makeContext());
  const otherBranchContext = makeContext({ branchId: 'branch_other' });

  const result = await getPendingActionsForBranch(otherBranchContext);
  expect(result.ok).toBe(true);
  if (result.ok === false) throw new Error(result.safeMessage);
  expect(result.value).toHaveLength(0);
});

test('persist pending action status changes', async () => {
  const seeded = await seedObservedAction(makeContext());

  const updated = await updatePendingScanActionStatus(makeContext(), seeded.pendingAction.id, 'context_requested', 'Meer context nodig.');
  expect(updated.ok).toBe(true);
  if (updated.ok === false) throw new Error(updated.safeMessage);
  expect(updated.value.status).toBe('context_requested');

  await resetTazePersistenceCacheForTests();
  const afterReload = await getPendingActionsForBranch(makeContext());
  expect(afterReload.ok).toBe(true);
  if (afterReload.ok === false) throw new Error(afterReload.safeMessage);
  expect(afterReload.value.find((entry) => entry.id === seeded.pendingAction.id)?.status).toBe('context_requested');
});

test('trace event must exist before stock movement', async () => {
  const seeded = await seedObservedAction(makeContext(), 'stock_correction');
  const approved = await updatePendingScanActionStatus(makeContext(), seeded.pendingAction.id, 'approved', 'Goedgekeurd.');
  expect(approved.ok).toBe(true);
  if (approved.ok === false) throw new Error(approved.safeMessage);

  const mutationContext = buildInventoryMutationContext(makeContext());
  const traceEvent = buildInventoryMutationTraceEvent(
    mutationContext,
    approved.value,
    'count_adjustment',
    approved.value.status,
    'applied',
    'manager_approval'
  );
  const movement = buildInventoryMovement(mutationContext, approved.value, traceEvent);

  const result = await createStockMovement(makeContext(), {
    movement,
    traceEvent: null,
  });

  expect(result.ok).toBe(false);
  if (result.ok === true) throw new Error('Expected failure');
  expect(result.errorCode).toBe('missing_trace_event');
});

test('stock movement references trace event', async () => {
  const seeded = await seedObservedAction(makeContext(), 'stock_correction');
  const approved = await updatePendingScanActionStatus(makeContext(), seeded.pendingAction.id, 'approved', 'Goedgekeurd.');
  expect(approved.ok).toBe(true);
  if (approved.ok === false) throw new Error(approved.safeMessage);

  const mutationContext = buildInventoryMutationContext(makeContext());
  const traceEvent = buildInventoryMutationTraceEvent(
    mutationContext,
    approved.value,
    'count_adjustment',
    approved.value.status,
    'applied',
    'manager_approval'
  );
  const movement = buildInventoryMovement(mutationContext, approved.value, traceEvent);

  const result = await createStockMovement(makeContext(), {
    movement,
    traceEvent: buildTraceInput(traceEvent, approved.value.recognitionLabel ?? approved.value.actionType),
  });

  expect(result.ok).toBe(true);
  if (result.ok === false) throw new Error(result.safeMessage);
  expect(result.value.movement.traceEventId).toBeTruthy();
  expect(result.value.traceEvent.id).toBeTruthy();

  const traceResult = await getTraceEventsForAction(makeContext(), seeded.pendingAction.id);
  expect(traceResult.ok).toBe(true);
  if (traceResult.ok === false) throw new Error(traceResult.safeMessage);
  expect(traceResult.value[0]?.id).toBe(result.value.traceEvent.id);
});

test('duplicate stock movement for same pendingActionId is blocked', async () => {
  const seeded = await seedObservedAction(makeContext(), 'stock_correction');
  const approved = await updatePendingScanActionStatus(makeContext(), seeded.pendingAction.id, 'approved', 'Goedgekeurd.');
  expect(approved.ok).toBe(true);
  if (approved.ok === false) throw new Error(approved.safeMessage);

  const mutationContext = buildInventoryMutationContext(makeContext());
  const traceEvent = buildInventoryMutationTraceEvent(
    mutationContext,
    approved.value,
    'count_adjustment',
    approved.value.status,
    'applied',
    'manager_approval'
  );
  const movement = buildInventoryMovement(mutationContext, approved.value, traceEvent);

  const first = await createStockMovement(makeContext(), {
    movement,
    traceEvent: buildTraceInput(traceEvent, approved.value.recognitionLabel ?? approved.value.actionType),
  });
  expect(first.ok).toBe(true);
  if (first.ok === false) throw new Error(first.safeMessage);

  await resetTazePersistenceCacheForTests();
  const second = await createStockMovement(makeContext(), {
    movement,
    traceEvent: buildTraceInput(traceEvent, approved.value.recognitionLabel ?? approved.value.actionType),
  });

  expect(second.ok).toBe(false);
  if (second.ok === true) throw new Error('Expected failure');
  const secondFailure = second;
  expect(secondFailure.errorCode).toBe('already_applied');
});

test('applied action stays applied after reload/mock reload', async () => {
  const seeded = await seedObservedAction(makeContext(), 'stock_correction');
  const approved = await updatePendingScanActionStatus(makeContext(), seeded.pendingAction.id, 'approved', 'Goedgekeurd.');
  expect(approved.ok).toBe(true);
  if (approved.ok === false) throw new Error(approved.safeMessage);

  const mutationContext = buildInventoryMutationContext(makeContext());
  const traceEvent = buildInventoryMutationTraceEvent(
    mutationContext,
    approved.value,
    'count_adjustment',
    approved.value.status,
    'applied',
    'manager_approval'
  );
  const movement = buildInventoryMovement(mutationContext, approved.value, traceEvent);

  const applied = await createStockMovement(makeContext(), {
    movement,
    traceEvent: buildTraceInput(traceEvent, approved.value.recognitionLabel ?? approved.value.actionType),
  });
  expect(applied.ok).toBe(true);
  if (applied.ok === false) throw new Error(applied.safeMessage);

  await resetTazePersistenceCacheForTests();

  const appliedCheck = await hasActionBeenApplied(makeContext(), seeded.pendingAction.id);
  expect(appliedCheck.ok).toBe(true);
  if (appliedCheck.ok === false) throw new Error(appliedCheck.safeMessage);
  expect(appliedCheck.value).toBe(true);

  const branchResult = await getPendingActionsForBranch(makeContext());
  expect(branchResult.ok).toBe(true);
  if (branchResult.ok === false) throw new Error(branchResult.safeMessage);
  expect(branchResult.value.find((entry) => entry.id === seeded.pendingAction.id)?.status).toBe('applied');
});

test('recognition result is stored as suggestion, not fact', async () => {
  const observationInput = buildScanObservation({
    companyId: baseContext.companyId ?? 'company_456',
    branchId: baseContext.branchId ?? 'branch_789',
    userId: baseContext.userId ?? 'user_123',
    membershipId: baseContext.membershipId ?? 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const observationResult = await createScanObservation(makeContext(), observationInput);
  expect(observationResult.ok).toBe(true);
  if (observationResult.ok === false) throw new Error(observationResult.safeMessage);

  const recognitionResult = await saveRecognitionResult(
    makeContext(),
    buildScanRecognitionResult({
      observation: observationResult.value,
      recognition: {
        name: 'Cola 33cl',
        category: 'Drank',
        quantity: 1,
        expiryDays: 4,
        confidence: 0.91,
        notes: 'Barcode match',
        source: 'barcode-lookup',
        barcode: '8710400131474',
      } as any,
      manualName: null,
    })
  );

  expect(recognitionResult.ok).toBe(true);
  if (recognitionResult.ok === false) throw new Error(recognitionResult.safeMessage);
  expect(recognitionResult.value.sourceLabel).toMatch(/suggestie|voorstel|interpretatie/i);
  expect(recognitionResult.value.provider).toBe('barcode');
  expect(observationResult.value.status).toBe('draft');
});

test('pending action keeps chosen location in its context text', async () => {
  const context = makeContext();
  const seeded = await seedObservedAction(context, 'stock_correction');
  const pendingActionWithLocation = {
    ...seeded.pendingAction,
    recognitionLabel: `${seeded.recognition.sourceLabel} · Locatie: Keuken`,
  };

  const storedAction = await createPendingScanAction(context, pendingActionWithLocation);
  expect(storedAction.ok).toBe(true);
  if (storedAction.ok === false) throw new Error(storedAction.safeMessage);
  expect(storedAction.value.recognitionLabel).toContain('Keuken');

  await resetTazePersistenceCacheForTests();
  const afterReload = await getPendingActionsForBranch(context);
  expect(afterReload.ok).toBe(true);
  if (afterReload.ok === false) throw new Error(afterReload.safeMessage);
  expect(afterReload.value.find((entry) => entry.id === storedAction.value.id)?.recognitionLabel).toContain('Keuken');
});

test('safe error returned for invalid tenant scope', async () => {
  const result = await getPendingActionsForMembership({
    companyId: null,
    branchId: null,
    userId: null,
    membershipId: null,
    membershipStatus: null,
    role: null,
    permissions: [],
    functionAreas: [],
    supportMode: false,
    actorKind: 'user',
  });

  expect(result.ok).toBe(false);
  if (result.ok === true) throw new Error('Expected failure');
  expect(result.errorCode).toBe('missing_user_id');
});

test('local/dev fallback still works', async () => {
  const seeded = await seedObservedAction(makeContext());
  await resetTazePersistenceCacheForTests();

  const result = await getPendingActionsForBranch(makeContext());
  expect(result.ok).toBe(true);
  if (result.ok === false) throw new Error(result.safeMessage);
  expect(result.value.some((entry) => entry.id === seeded.pendingAction.id)).toBe(true);
});

test('no public or unauthenticated read of business event data', async () => {
  const result = await getPendingActionsForMembership({
    companyId: null,
    branchId: null,
    userId: null,
    membershipId: null,
    membershipStatus: null,
    role: null,
    permissions: [],
    functionAreas: [],
    supportMode: false,
    actorKind: 'user',
  });

  expect(result.ok).toBe(false);
  if (result.ok === true) throw new Error('Expected failure');
  expect(['missing_user_id', 'missing_company_id']).toContain(result.errorCode);
});
