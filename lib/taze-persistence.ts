import { getItem, removeItem, setItem } from 'lib/app-storage';
import { normalizeAppRole, type AppRole, type TenantFunctionArea } from 'lib/auth-model';
import {
  appendTraceEvent as appendLegacyTraceEvent,
  clearTraceEventsForTests as clearLegacyTraceEventsForTests,
  type TraceEventKind,
} from 'lib/trace-event-log';
import type { PendingScanAction, PendingScanActionStatus, PendingScanActionType, ScanObservation, ScanObservationStatus, ScanRecognitionResult } from 'lib/scan-flow';
import type { StockMovement, StockMovementType } from 'lib/inventory-mutation';

export type PersistenceMembershipStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'PENDING' | null;
export type PersistenceActorKind = 'user' | 'ai' | 'internal' | 'system';
export type PersistenceStorageMode = 'default' | 'memory-only';

export type PersistenceContext = {
  companyId: string | null;
  branchId: string | null;
  userId: string | null;
  membershipId: string | null;
  membershipStatus?: PersistenceMembershipStatus;
  role: AppRole | null;
  permissions: string[];
  functionAreas: TenantFunctionArea[];
  supportMode?: boolean;
  actorKind?: PersistenceActorKind;
};

export type PersistenceErrorCode =
  | 'missing_company_id'
  | 'missing_branch_id'
  | 'missing_user_id'
  | 'missing_membership_id'
  | 'inactive_membership'
  | 'ai_blocked'
  | 'internal_support_required'
  | 'invalid_tenant_scope'
  | 'cross_company_scope'
  | 'cross_branch_scope'
  | 'not_found'
  | 'already_applied'
  | 'missing_trace_event'
  | 'missing_permission'
  | 'rejected'
  | 'waiting_more_context';

export type PersistenceResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      errorCode: PersistenceErrorCode;
      safeMessage: string;
    };

export type ScanObservationRecord = ScanObservation & {
  createdByUserId: string;
  updatedAt: string;
  traceEventId: string | null;
};

export type ScanRecognitionResultRecord = ScanRecognitionResult & {
  companyId: string;
  branchId: string;
  userId: string;
  membershipId: string;
  createdAt: string;
  updatedAt: string;
  traceEventId: string | null;
};

export type PendingScanActionRecord = PendingScanAction & {
  companyId: string;
  branchId: string | null;
  membershipId: string | null;
  createdByUserId: string;
  updatedAt: string;
  decisionByUserId: string | null;
  decisionReason: string | null;
  traceEventId: string | null;
  appliedMovementId: string | null;
};

export type TraceEventType =
  | 'scan_observation_created'
  | 'scan_observation_confirmed'
  | 'scan_observation_rejected'
  | 'recognition_suggestion_saved'
  | 'pending_action_created'
  | 'pending_action_approved'
  | 'pending_action_rejected'
  | 'pending_action_context_requested'
  | 'inventory_mutation';

export type TraceEvent = {
  id: string;
  companyId: string;
  branchId: string | null;
  userId: string;
  membershipId: string;
  observationId: string;
  pendingActionId: string | null;
  eventType: TraceEventType;
  previousStatus: PendingScanActionStatus | ScanObservationStatus | null;
  newStatus: PendingScanActionStatus | ScanObservationStatus | null;
  movementType: StockMovementType | null;
  productId: string | null;
  itemName: string;
  rawValue: string | null;
  sourceLabel: string;
  confidence: number | null;
  note: string;
  createdAt: string;
};

export type TraceEventInput = Omit<TraceEvent, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: string;
};

export type StockMovementRecord = StockMovement & {
  status: 'applied';
  updatedAt: string;
  createdByUserId: string;
};

type PersistenceState = {
  scanObservations: ScanObservationRecord[];
  scanRecognitionResults: ScanRecognitionResultRecord[];
  pendingScanActions: PendingScanActionRecord[];
  traceEvents: TraceEvent[];
  stockMovements: StockMovementRecord[];
};

const STORAGE_KEY = 'taze-persistence-v1';
const MAX_ITEMS = 500;
const DEFAULT_SAFE_MESSAGE = 'Tenantcontext is ongeldig of ontbreekt.';

let cachedState: PersistenceState | null = null;
let fallbackState: PersistenceState = createEmptyState();
let storageMode: PersistenceStorageMode = 'default';

function createEmptyState(): PersistenceState {
  return {
    scanObservations: [],
    scanRecognitionResults: [],
    pendingScanActions: [],
    traceEvents: [],
    stockMovements: [],
  };
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function sortByCreatedAt<T extends { createdAt: string }>(items: T[]) {
  return items
    .slice()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function isActiveMembership(status: PersistenceMembershipStatus) {
  return status === 'ACTIVE' || status === null;
}

function isCompanyWideAccess(context: PersistenceContext) {
  const normalizedRole = normalizeAppRole(context.role);
  return normalizedRole === 'OWNER' || context.supportMode === true;
}

function buildError(errorCode: PersistenceErrorCode, safeMessage: string): PersistenceResult<never> {
  return { ok: false, errorCode, safeMessage };
}

function buildInvalidScopeError(reason = DEFAULT_SAFE_MESSAGE): PersistenceResult<never> {
  return buildError('invalid_tenant_scope', reason);
}

function mapPersistenceError<T>(error: { errorCode: PersistenceErrorCode; safeMessage: string }): PersistenceResult<T> {
  return {
    ok: false,
    errorCode: error.errorCode,
    safeMessage: error.safeMessage,
  };
}

function ensureTenantContext(
  context: PersistenceContext,
  options: { requireBranch: boolean; allowCompanyWideBranchAccess?: boolean } = { requireBranch: true }
) {
  if (context.actorKind === 'ai') {
    return buildError('ai_blocked', 'AI mag deze bedrijfsgegevens niet rechtstreeks wijzigen.');
  }

  if (context.actorKind === 'internal' && !context.supportMode) {
    return buildError('internal_support_required', 'Interne Taze-acties mogen alleen in support mode lopen.');
  }

  if (!context.userId) {
    return buildError('missing_user_id', 'Een ingelogde gebruiker is nodig.');
  }

  if (!context.companyId) {
    return buildError('missing_company_id', 'Een company context is nodig.');
  }

  if (!context.membershipId) {
    return buildError('missing_membership_id', 'Een actieve membership is nodig.');
  }

  if (!isActiveMembership(context.membershipStatus ?? 'ACTIVE')) {
    return buildError('inactive_membership', 'Deze membership is niet actief.');
  }

  if (options.requireBranch && !context.branchId && !options.allowCompanyWideBranchAccess) {
    return buildError('missing_branch_id', 'Een vestigingscontext is nodig.');
  }

  return null;
}

function normalizeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toPersistenceState(raw: unknown): PersistenceState | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<PersistenceState>;

  return {
    scanObservations: Array.isArray(value.scanObservations) ? (value.scanObservations.filter(Boolean) as ScanObservationRecord[]) : [],
    scanRecognitionResults: Array.isArray(value.scanRecognitionResults)
      ? (value.scanRecognitionResults.filter(Boolean) as ScanRecognitionResultRecord[])
      : [],
    pendingScanActions: Array.isArray(value.pendingScanActions) ? (value.pendingScanActions.filter(Boolean) as PendingScanActionRecord[]) : [],
    traceEvents: Array.isArray(value.traceEvents) ? (value.traceEvents.filter(Boolean) as TraceEvent[]) : [],
    stockMovements: Array.isArray(value.stockMovements) ? (value.stockMovements.filter(Boolean) as StockMovementRecord[]) : [],
  };
}

async function readState(): Promise<PersistenceState> {
  if (cachedState) {
    return cachedState;
  }

  if (storageMode !== 'memory-only') {
    try {
      const raw = await getItem(STORAGE_KEY);
      if (raw) {
        const parsed = normalizeState(toPersistenceState(JSON.parse(raw)) ?? createEmptyState());
        if (parsed) {
          cachedState = parsed;
          fallbackState = parsed;
          return parsed;
        }
      }
    } catch {
      // keep fallback state
    }
  }

  cachedState = fallbackState;
  return fallbackState;
}

async function writeState(nextState: PersistenceState) {
  const normalized = {
    scanObservations: sortByCreatedAt(nextState.scanObservations).slice(0, MAX_ITEMS),
    scanRecognitionResults: sortByCreatedAt(nextState.scanRecognitionResults).slice(0, MAX_ITEMS),
    pendingScanActions: sortByCreatedAt(nextState.pendingScanActions).slice(0, MAX_ITEMS),
    traceEvents: sortByCreatedAt(nextState.traceEvents).slice(0, MAX_ITEMS),
    stockMovements: sortByCreatedAt(nextState.stockMovements).slice(0, MAX_ITEMS),
  };

  const sanitized = normalizeState(normalized);
  cachedState = sanitized;
  fallbackState = sanitized;

  if (storageMode === 'memory-only') {
    return;
  }

  try {
    await setItem(STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // keep memory fallback
  }
}

function cloneObservation(value: ScanObservationRecord): ScanObservationRecord {
  return { ...value };
}

function cloneRecognition(value: ScanRecognitionResultRecord): ScanRecognitionResultRecord {
  return { ...value };
}

function clonePendingAction(value: PendingScanActionRecord): PendingScanActionRecord {
  return { ...value };
}

function cloneTraceEvent(value: TraceEvent): TraceEvent {
  return { ...value };
}

function cloneStockMovement(value: StockMovementRecord): StockMovementRecord {
  return { ...value };
}

function findObservation(state: PersistenceState, observationId: string) {
  return state.scanObservations.find((entry) => entry.id === observationId) ?? null;
}

function findRecognition(state: PersistenceState, observationId: string) {
  return state.scanRecognitionResults.find((entry) => entry.observationId === observationId) ?? null;
}

function findPendingAction(state: PersistenceState, actionId: string) {
  return state.pendingScanActions.find((entry) => entry.id === actionId) ?? null;
}

function findTraceEvent(state: PersistenceState, traceEventId: string) {
  return state.traceEvents.find((entry) => entry.id === traceEventId) ?? null;
}

function findMovement(state: PersistenceState, pendingActionId: string) {
  return state.stockMovements.find((entry) => entry.pendingActionId === pendingActionId) ?? null;
}

function assertScopeMatch(context: PersistenceContext, companyId: string, branchId: string | null) {
  if (context.companyId !== companyId) {
    return buildError('cross_company_scope', 'Deze data hoort bij een andere company.');
  }

  if (!isCompanyWideAccess(context) && context.branchId && branchId && context.branchId !== branchId) {
    return buildError('cross_branch_scope', 'Deze data hoort bij een andere vestiging.');
  }

  if (!isCompanyWideAccess(context) && !context.branchId) {
    return buildError('missing_branch_id', 'Een vestigingscontext is nodig.');
  }

  return null;
}

function buildTraceEventNote(event: TraceEvent) {
  return [
    `[${event.eventType}]`,
    `company=${event.companyId}`,
    `branch=${event.branchId ?? 'company-wide'}`,
    `membership=${event.membershipId}`,
    `observation=${event.observationId}`,
    event.pendingActionId ? `pendingAction=${event.pendingActionId}` : null,
    event.previousStatus !== null ? `previous=${event.previousStatus}` : null,
    event.newStatus !== null ? `new=${event.newStatus}` : null,
    event.movementType ? `movementType=${event.movementType}` : null,
    event.productId ? `productId=${event.productId}` : null,
    `source=${event.sourceLabel}`,
    event.note,
  ]
    .filter(Boolean)
    .join(' ');
}

function toLegacyTraceEventRecord(event: TraceEvent) {
  const eventKind: TraceEventKind = event.eventType === 'inventory_mutation' ? 'inventory_mutation' : 'scan_saved';
  return {
    id: event.id,
    createdAt: event.createdAt,
    eventKind,
    itemId: event.productId,
    itemName: event.itemName,
    location: event.branchId ?? event.companyId,
    fromLocation: event.previousStatus ? String(event.previousStatus) : null,
    toLocation: event.newStatus ? String(event.newStatus) : event.branchId ?? event.companyId,
    quantity: 1,
    source: event.sourceLabel,
    barcode: event.rawValue,
    batchCode: null,
    lotNumber: null,
    confidence: event.confidence,
    expiryDays: null,
    note: buildTraceEventNote(event),
  };
}

async function mirrorTraceEventToLegacyLog(event: TraceEvent) {
  try {
    await appendLegacyTraceEvent(toLegacyTraceEventRecord(event));
  } catch {
    // best-effort mirror only
  }
}

function buildTraceEventContextFromInput(context: PersistenceContext, input: TraceEventInput): TraceEvent {
  return {
    id: input.id ?? createId('trace-event'),
    companyId: context.companyId ?? input.companyId,
    branchId: context.branchId ?? input.branchId,
    userId: context.userId ?? input.userId,
    membershipId: context.membershipId ?? input.membershipId,
    observationId: input.observationId,
    pendingActionId: input.pendingActionId ?? null,
    eventType: input.eventType,
    previousStatus: input.previousStatus ?? null,
    newStatus: input.newStatus ?? null,
    movementType: input.movementType ?? null,
    productId: input.productId ?? null,
    itemName: input.itemName,
    rawValue: input.rawValue ?? null,
    sourceLabel: input.sourceLabel,
    confidence: typeof input.confidence === 'number' && Number.isFinite(input.confidence) ? input.confidence : null,
    note: input.note,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

function upsertById<T extends { id: string }>(entries: T[], entry: T) {
  const next = entries.filter((item) => item.id !== entry.id);
  next.push(entry);
  return next;
}

function upsertRecognition(entries: ScanRecognitionResultRecord[], entry: ScanRecognitionResultRecord) {
  return entries.filter((item) => item.observationId !== entry.observationId).concat(entry);
}

function upsertPendingAction(entries: PendingScanActionRecord[], entry: PendingScanActionRecord) {
  return entries.filter((item) => item.id !== entry.id).concat(entry);
}

function upsertStockMovement(entries: StockMovementRecord[], entry: StockMovementRecord) {
  return entries.filter((item) => item.id !== entry.id).concat(entry);
}

function normalizeTraceEventType(value: TraceEventType | string): TraceEventType {
  if (
    value === 'scan_observation_created' ||
    value === 'scan_observation_confirmed' ||
    value === 'scan_observation_rejected' ||
    value === 'recognition_suggestion_saved' ||
    value === 'pending_action_created' ||
    value === 'pending_action_approved' ||
    value === 'pending_action_rejected' ||
    value === 'pending_action_context_requested' ||
    value === 'inventory_mutation'
  ) {
    return value;
  }

  return 'scan_observation_created';
}

function isTraceEventRecord(value: unknown): value is TraceEvent {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<TraceEvent>;
  return (
    typeof record.id === 'string' &&
    typeof record.companyId === 'string' &&
    typeof record.userId === 'string' &&
    typeof record.membershipId === 'string' &&
    typeof record.observationId === 'string' &&
    typeof record.eventType === 'string' &&
    typeof record.itemName === 'string' &&
    typeof record.sourceLabel === 'string' &&
    typeof record.note === 'string' &&
    typeof record.createdAt === 'string'
  );
}

function normalizeTraceEventRecord(value: unknown): TraceEvent | null {
  if (!isTraceEventRecord(value)) return null;
  return {
    id: value.id,
    companyId: value.companyId,
    branchId: typeof value.branchId === 'string' && value.branchId ? value.branchId : null,
    userId: value.userId,
    membershipId: value.membershipId,
    observationId: value.observationId,
    pendingActionId: typeof value.pendingActionId === 'string' && value.pendingActionId ? value.pendingActionId : null,
    eventType: normalizeTraceEventType(value.eventType),
    previousStatus:
      typeof value.previousStatus === 'string' && value.previousStatus
        ? (value.previousStatus as PendingScanActionStatus | ScanObservationStatus)
        : null,
    newStatus:
      typeof value.newStatus === 'string' && value.newStatus
        ? (value.newStatus as PendingScanActionStatus | ScanObservationStatus)
        : null,
    movementType: typeof value.movementType === 'string' && value.movementType ? (value.movementType as StockMovementType) : null,
    productId: typeof value.productId === 'string' && value.productId ? value.productId : null,
    itemName: value.itemName,
    rawValue: typeof value.rawValue === 'string' && value.rawValue ? value.rawValue : null,
    sourceLabel: value.sourceLabel,
    confidence: normalizeNumber(value.confidence),
    note: value.note,
    createdAt: value.createdAt,
  };
}

function normalizeObservationRecord(value: unknown): ScanObservationRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<ScanObservationRecord>;
  if (
    typeof record.id !== 'string' ||
    typeof record.companyId !== 'string' ||
    typeof record.branchId !== 'string' ||
    typeof record.userId !== 'string' ||
    typeof record.membershipId !== 'string' ||
    typeof record.source !== 'string' ||
    typeof record.rawValue !== 'string' ||
    typeof record.createdAt !== 'string' ||
    typeof record.status !== 'string'
  ) {
    return null;
  }

  return {
    id: record.id,
    companyId: record.companyId,
    branchId: record.branchId,
    userId: record.userId,
    membershipId: record.membershipId,
    source:
      record.source === 'camera' || record.source === 'barcode' || record.source === 'manual' ? record.source : 'manual',
    rawValue: record.rawValue,
    imageRef: typeof record.imageRef === 'string' && record.imageRef ? record.imageRef : null,
    createdAt: record.createdAt,
    status: record.status === 'confirmed' || record.status === 'rejected' ? record.status : 'draft',
    createdByUserId: typeof record.createdByUserId === 'string' && record.createdByUserId ? record.createdByUserId : record.userId,
    updatedAt: typeof record.updatedAt === 'string' && record.updatedAt ? record.updatedAt : record.createdAt,
    traceEventId: typeof record.traceEventId === 'string' && record.traceEventId ? record.traceEventId : null,
  };
}

function normalizeRecognitionRecord(value: unknown): ScanRecognitionResultRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<ScanRecognitionResultRecord>;
  if (
    typeof record.observationId !== 'string' ||
    typeof record.provider !== 'string' ||
    typeof record.sourceLabel !== 'string' ||
    typeof record.companyId !== 'string' ||
    typeof record.branchId !== 'string' ||
    typeof record.userId !== 'string' ||
    typeof record.membershipId !== 'string' ||
    typeof record.createdAt !== 'string' ||
    typeof record.updatedAt !== 'string'
  ) {
    return null;
  }

  return {
    observationId: record.observationId,
    provider: record.provider === 'barcode' || record.provider === 'ai' || record.provider === 'manual' ? record.provider : 'manual',
    suggestedProductId: typeof record.suggestedProductId === 'string' && record.suggestedProductId ? record.suggestedProductId : null,
    suggestedName: typeof record.suggestedName === 'string' && record.suggestedName ? record.suggestedName : null,
    confidence: normalizeNumber(record.confidence),
    sourceLabel: record.sourceLabel,
    error: typeof record.error === 'string' && record.error ? record.error : null,
    companyId: record.companyId,
    branchId: record.branchId,
    userId: record.userId,
    membershipId: record.membershipId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    traceEventId: typeof record.traceEventId === 'string' && record.traceEventId ? record.traceEventId : null,
  };
}

function normalizePendingActionRecord(value: unknown): PendingScanActionRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<PendingScanActionRecord>;
  if (
    typeof record.id !== 'string' ||
    typeof record.observationId !== 'string' ||
    typeof record.actionType !== 'string' ||
    typeof record.status !== 'string' ||
    typeof record.createdAt !== 'string' ||
    typeof record.companyId !== 'string'
  ) {
    return null;
  }

  return {
    id: record.id,
    observationId: record.observationId,
    actionType: record.actionType as PendingScanActionType,
    status:
      record.status === 'pending_confirmation' ||
      record.status === 'pending_approval' ||
      record.status === 'approved' ||
      record.status === 'rejected' ||
      record.status === 'context_requested' ||
      record.status === 'applied'
        ? record.status
        : 'pending_confirmation',
    requiresApproval: Boolean(record.requiresApproval),
    createdAt: record.createdAt,
    companyId: record.companyId,
    branchId: typeof record.branchId === 'string' && record.branchId ? record.branchId : null,
    membershipId: typeof record.membershipId === 'string' && record.membershipId ? record.membershipId : null,
    riskLevel:
      record.riskLevel === 'low' || record.riskLevel === 'medium' || record.riskLevel === 'high' ? record.riskLevel : undefined,
    sourceObservationLabel: typeof record.sourceObservationLabel === 'string' && record.sourceObservationLabel ? record.sourceObservationLabel : null,
    recognitionLabel: typeof record.recognitionLabel === 'string' && record.recognitionLabel ? record.recognitionLabel : null,
    observationStatus:
      record.observationStatus === 'draft' || record.observationStatus === 'confirmed' || record.observationStatus === 'rejected'
        ? record.observationStatus
        : null,
    policyReason: typeof record.policyReason === 'string' && record.policyReason ? record.policyReason : null,
    createdByUserId: typeof record.createdByUserId === 'string' && record.createdByUserId ? record.createdByUserId : '',
    updatedAt: typeof record.updatedAt === 'string' && record.updatedAt ? record.updatedAt : record.createdAt,
    decisionByUserId: typeof record.decisionByUserId === 'string' && record.decisionByUserId ? record.decisionByUserId : null,
    decisionReason: typeof record.decisionReason === 'string' && record.decisionReason ? record.decisionReason : null,
    traceEventId: typeof record.traceEventId === 'string' && record.traceEventId ? record.traceEventId : null,
    appliedMovementId: typeof record.appliedMovementId === 'string' && record.appliedMovementId ? record.appliedMovementId : null,
  };
}

function normalizeStockMovementRecord(value: unknown): StockMovementRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<StockMovementRecord>;
  if (
    typeof record.id !== 'string' ||
    typeof record.companyId !== 'string' ||
    typeof record.observationId !== 'string' ||
    typeof record.pendingActionId !== 'string' ||
    typeof record.movementType !== 'string' ||
    typeof record.reason !== 'string' ||
    typeof record.source !== 'string' ||
    typeof record.createdByUserId !== 'string' ||
    typeof record.createdAt !== 'string' ||
    typeof record.traceEventId !== 'string'
  ) {
    return null;
  }

  return {
    id: record.id,
    companyId: record.companyId,
    branchId: typeof record.branchId === 'string' && record.branchId ? record.branchId : null,
    productId: typeof record.productId === 'string' && record.productId ? record.productId : null,
    observationId: record.observationId,
    pendingActionId: record.pendingActionId,
    movementType: record.movementType as StockMovementType,
    quantityDelta: typeof record.quantityDelta === 'number' && Number.isFinite(record.quantityDelta) ? record.quantityDelta : null,
    unit: typeof record.unit === 'string' && record.unit ? record.unit : null,
    reason: record.reason,
    source: record.source as StockMovement['source'],
    createdByUserId: record.createdByUserId,
    approvedByUserId: typeof record.approvedByUserId === 'string' && record.approvedByUserId ? record.approvedByUserId : null,
    createdAt: record.createdAt,
    traceEventId: record.traceEventId,
    status: 'applied',
    updatedAt: typeof record.updatedAt === 'string' && record.updatedAt ? record.updatedAt : record.createdAt,
  };
}

function normalizeState(state: PersistenceState): PersistenceState {
  return {
    scanObservations: state.scanObservations.map((entry) => normalizeObservationRecord(entry)).filter((entry): entry is ScanObservationRecord => Boolean(entry)),
    scanRecognitionResults: state.scanRecognitionResults
      .map((entry) => normalizeRecognitionRecord(entry))
      .filter((entry): entry is ScanRecognitionResultRecord => Boolean(entry)),
    pendingScanActions: state.pendingScanActions
      .map((entry) => normalizePendingActionRecord(entry))
      .filter((entry): entry is PendingScanActionRecord => Boolean(entry)),
    traceEvents: state.traceEvents.map((entry) => normalizeTraceEventRecord(entry)).filter((entry): entry is TraceEvent => Boolean(entry)),
    stockMovements: state.stockMovements
      .map((entry) => normalizeStockMovementRecord(entry))
      .filter((entry): entry is StockMovementRecord => Boolean(entry)),
  };
}

async function persistState(state: PersistenceState) {
  await writeState(state);
}

async function appendTraceEventInternal(context: PersistenceContext, input: TraceEventInput) {
  const validation = ensureTenantContext(context, { requireBranch: true });
  if (validation) {
    return validation;
  }

  const event = buildTraceEventContextFromInput(context, input);
  if (!event.companyId || !event.branchId || !event.userId || !event.membershipId) {
    return buildInvalidScopeError();
  }

  const state = await readState();
  const nextEvent = normalizeTraceEventRecord(event);
  if (!nextEvent) {
    return buildInvalidScopeError();
  }

  const nextState = {
    ...state,
    traceEvents: upsertById(state.traceEvents, nextEvent),
  };
  await persistState(nextState);
  await mirrorTraceEventToLegacyLog(nextEvent);
  return { ok: true, value: cloneTraceEvent(nextEvent) } as const;
}

export async function appendTraceEvent(context: PersistenceContext, input: TraceEventInput): Promise<PersistenceResult<TraceEvent>> {
  return appendTraceEventInternal(context, input);
}

export async function createScanObservation(context: PersistenceContext, input: ScanObservation): Promise<PersistenceResult<ScanObservationRecord>> {
  const validation = ensureTenantContext(context, { requireBranch: true });
  if (validation) return validation;

  if (!input.companyId || !input.branchId || !input.userId || !input.membershipId) {
    return buildInvalidScopeError('Observatie mist tenantcontext.');
  }

  if (input.companyId !== context.companyId) {
    return buildError('cross_company_scope', 'Deze observatie hoort bij een andere company.');
  }

  if (input.branchId !== context.branchId) {
    return buildError('cross_branch_scope', 'Deze observatie hoort bij een andere vestiging.');
  }

  if (input.userId !== context.userId || input.membershipId !== context.membershipId) {
    return buildInvalidScopeError('Observatie kan niet onder een andere membership worden opgeslagen.');
  }

  if (input.status !== 'draft') {
    return buildInvalidScopeError('Een nieuwe observatie start als draft.');
  }

  const state = await readState();
  const existing = findObservation(state, input.id);
  if (existing && (existing.companyId !== input.companyId || existing.branchId !== input.branchId)) {
    return buildError('cross_company_scope', 'Deze observatie-id is al aan een andere company gekoppeld.');
  }

  const traceResult = await appendTraceEvent(context, {
    eventType: 'scan_observation_created',
    companyId: input.companyId,
    branchId: input.branchId,
    userId: input.userId,
    membershipId: input.membershipId,
    observationId: input.id,
    pendingActionId: null,
    previousStatus: null,
    newStatus: 'draft',
    movementType: null,
    productId: null,
    itemName: input.rawValue,
    rawValue: input.rawValue,
    sourceLabel: input.source,
    confidence: null,
    note: 'Observatie aangemaakt.',
  });

  if (traceResult.ok === false) {
    return mapPersistenceError<ScanObservationRecord>(traceResult);
  }

  const latestState = await readState();
  const nextRecord: ScanObservationRecord = {
    ...input,
    createdByUserId: context.userId,
    updatedAt: input.createdAt,
    traceEventId: traceResult.value.id,
  };

  const nextState = {
    ...latestState,
    scanObservations: upsertById(latestState.scanObservations, cloneObservation(nextRecord)),
  };
  await persistState(nextState);
  return { ok: true, value: cloneObservation(nextRecord) };
}

export async function updateScanObservationStatus(
  context: PersistenceContext,
  observationId: string,
  status: ScanObservationStatus
): Promise<PersistenceResult<ScanObservationRecord>> {
  const validation = ensureTenantContext(context, { requireBranch: true });
  if (validation) return validation;

  const state = await readState();
  const observation = findObservation(state, observationId);
  if (!observation) {
    return buildError('not_found', 'Observatie niet gevonden.');
  }

  const scopeError = assertScopeMatch(context, observation.companyId, observation.branchId);
  if (scopeError) return scopeError;

  const traceResult = await appendTraceEvent(context, {
    eventType:
      status === 'confirmed'
        ? 'scan_observation_confirmed'
        : status === 'rejected'
          ? 'scan_observation_rejected'
          : 'scan_observation_created',
    companyId: observation.companyId,
    branchId: observation.branchId,
    userId: context.userId ?? observation.userId,
    membershipId: context.membershipId ?? observation.membershipId,
    observationId: observation.id,
    pendingActionId: null,
    previousStatus: observation.status,
    newStatus: status,
    movementType: null,
    productId: null,
    itemName: observation.rawValue,
    rawValue: observation.rawValue,
    sourceLabel: observation.source,
    confidence: null,
    note: `Observatie-status gewijzigd naar ${status}.`,
  });

  if (traceResult.ok === false) {
    return mapPersistenceError<ScanObservationRecord>(traceResult);
  }

  const latestState = await readState();
  const nextObservation: ScanObservationRecord = {
    ...observation,
    status,
    updatedAt: traceResult.value.createdAt,
    traceEventId: traceResult.value.id,
  };

  const nextState = {
    ...latestState,
    scanObservations: upsertById(latestState.scanObservations, nextObservation),
  };
  await persistState(nextState);
  return { ok: true, value: cloneObservation(nextObservation) };
}

export async function saveRecognitionResult(
  context: PersistenceContext,
  input: ScanRecognitionResult
): Promise<PersistenceResult<ScanRecognitionResultRecord>> {
  const validation = ensureTenantContext(context, { requireBranch: true });
  if (validation) return validation;

  const state = await readState();
  const observation = findObservation(state, input.observationId);
  if (!observation) {
    return buildError('not_found', 'Observatie niet gevonden voor herkenningsvoorstel.');
  }

  const scopeError = assertScopeMatch(context, observation.companyId, observation.branchId);
  if (scopeError) return scopeError;

  const record: ScanRecognitionResultRecord = {
    ...input,
    companyId: observation.companyId,
    branchId: observation.branchId,
    userId: observation.userId,
    membershipId: observation.membershipId,
    createdAt: observation.createdAt,
    updatedAt: new Date().toISOString(),
    traceEventId: null,
  };

  const traceResult = await appendTraceEvent(context, {
    eventType: 'recognition_suggestion_saved',
    companyId: observation.companyId,
    branchId: observation.branchId,
    userId: observation.userId,
    membershipId: observation.membershipId,
    observationId: observation.id,
    pendingActionId: null,
    previousStatus: observation.status,
    newStatus: observation.status,
    movementType: null,
    productId: input.suggestedProductId ?? null,
    itemName: input.suggestedName ?? observation.rawValue,
    rawValue: observation.rawValue,
    sourceLabel: input.sourceLabel,
    confidence: input.confidence ?? null,
    note: input.error ? `Herkenningsvoorstel met fout: ${input.error}` : 'Herkenningsvoorstel opgeslagen.',
  });

  if (traceResult.ok === false) {
    return mapPersistenceError<ScanRecognitionResultRecord>(traceResult);
  }

  const latestState = await readState();
  const nextRecord: ScanRecognitionResultRecord = {
    ...record,
    traceEventId: traceResult.value.id,
  };

  const nextState = {
    ...latestState,
    scanRecognitionResults: upsertRecognition(latestState.scanRecognitionResults, nextRecord),
  };
  await persistState(nextState);
  return { ok: true, value: cloneRecognition(nextRecord) };
}

export async function createPendingScanAction(
  context: PersistenceContext,
  input: PendingScanAction
): Promise<PersistenceResult<PendingScanActionRecord>> {
  const validation = ensureTenantContext(context, { requireBranch: true });
  if (validation) return validation;

  const state = await readState();
  const observation = findObservation(state, input.observationId);
  if (!observation) {
    return buildError('not_found', 'Observatie niet gevonden voor pending actie.');
  }

  const scopeError = assertScopeMatch(context, observation.companyId, observation.branchId);
  if (scopeError) return scopeError;

  if (observation.status !== 'confirmed' && input.observationStatus !== 'confirmed') {
    return buildError('invalid_tenant_scope', 'Alleen bevestigde observaties mogen een pending actie aanmaken.');
  }

  const traceResult = await appendTraceEvent(context, {
    eventType: 'pending_action_created',
    companyId: observation.companyId,
    branchId: observation.branchId,
    userId: context.userId ?? observation.userId,
    membershipId: context.membershipId ?? observation.membershipId,
    observationId: observation.id,
    pendingActionId: input.id,
    previousStatus: observation.status,
    newStatus: input.status,
    movementType: null,
    productId: null,
    itemName: input.recognitionLabel ?? input.sourceObservationLabel ?? observation.rawValue,
    rawValue: observation.rawValue,
    sourceLabel: input.recognitionLabel ?? input.sourceObservationLabel ?? observation.source,
    confidence: null,
    note: input.policyReason ?? 'Pending actie aangemaakt.',
  });

  if (traceResult.ok === false) {
    return mapPersistenceError<PendingScanActionRecord>(traceResult);
  }

  const latestState = await readState();
  const nextAction: PendingScanActionRecord = {
    ...input,
    companyId: observation.companyId,
    branchId: observation.branchId,
    membershipId: observation.membershipId,
    createdByUserId: context.userId,
    updatedAt: traceResult.value.createdAt,
    decisionByUserId: null,
    decisionReason: null,
    traceEventId: traceResult.value.id,
    appliedMovementId: null,
  };

  const nextState = {
    ...latestState,
    pendingScanActions: upsertPendingAction(latestState.pendingScanActions, nextAction),
  };
  await persistState(nextState);
  return { ok: true, value: clonePendingAction(nextAction) };
}

function getDecisionTraceEventType(status: PendingScanActionStatus) {
  switch (status) {
    case 'approved':
      return 'pending_action_approved';
    case 'rejected':
      return 'pending_action_rejected';
    case 'context_requested':
      return 'pending_action_context_requested';
    case 'applied':
      return 'inventory_mutation';
    default:
      return 'pending_action_created';
  }
}

export async function updatePendingScanActionStatus(
  context: PersistenceContext,
  actionId: string,
  status: PendingScanActionStatus,
  reason?: string | null
): Promise<PersistenceResult<PendingScanActionRecord>> {
  const validation = ensureTenantContext(context, { requireBranch: true });
  if (validation) return validation;

  const state = await readState();
  const action = findPendingAction(state, actionId);
  if (!action) {
    return buildError('not_found', 'Pending actie niet gevonden.');
  }

  const observation = findObservation(state, action.observationId);
  if (!observation) {
    return buildError('not_found', 'Observatie niet gevonden voor pending actie.');
  }

  const scopeError = assertScopeMatch(context, action.companyId, action.branchId);
  if (scopeError) return scopeError;

  const traceResult = await appendTraceEvent(context, {
    eventType: getDecisionTraceEventType(status),
    companyId: action.companyId,
    branchId: action.branchId,
    userId: context.userId,
    membershipId: context.membershipId,
    observationId: action.observationId,
    pendingActionId: action.id,
    previousStatus: action.status,
    newStatus: status,
    movementType: null,
    productId: null,
    itemName: action.recognitionLabel ?? action.sourceObservationLabel ?? observation.rawValue,
    rawValue: observation.rawValue,
    sourceLabel: action.recognitionLabel ?? action.sourceObservationLabel ?? observation.source,
    confidence: null,
    note: reason ?? `Pending actie status gewijzigd naar ${status}.`,
  });

  if (traceResult.ok === false) {
    return mapPersistenceError<PendingScanActionRecord>(traceResult);
  }

  const latestState = await readState();
  const nextAction: PendingScanActionRecord = {
    ...action,
    status,
    updatedAt: traceResult.value.createdAt,
    decisionByUserId: context.userId,
    decisionReason: reason ?? null,
    traceEventId: traceResult.value.id,
  };

  const nextState = {
    ...latestState,
    pendingScanActions: upsertPendingAction(latestState.pendingScanActions, nextAction),
  };
  await persistState(nextState);
  return { ok: true, value: clonePendingAction(nextAction) };
}

export async function createStockMovement(
  context: PersistenceContext,
  input: {
    movement: StockMovement;
    traceEvent?: TraceEventInput | null;
  }
): Promise<PersistenceResult<{ movement: StockMovementRecord; appliedAction: PendingScanActionRecord; traceEvent: TraceEvent }>> {
  const validation = ensureTenantContext(context, { requireBranch: true });
  if (validation) return validation;

  const state = await readState();
  const action = findPendingAction(state, input.movement.pendingActionId);
  if (!action) {
    return buildError('not_found', 'Pending actie niet gevonden voor voorraadmutatie.');
  }

  const observation = findObservation(state, action.observationId);
  if (!observation) {
    return buildError('not_found', 'Observatie niet gevonden voor voorraadmutatie.');
  }

  const scopeError = assertScopeMatch(context, action.companyId, action.branchId);
  if (scopeError) return scopeError;

  if (action.status === 'rejected') {
    return buildError('rejected', 'Een afgewezen actie kan niet worden toegepast.');
  }

  if (action.status === 'context_requested') {
    return buildError('waiting_more_context', 'Deze actie wacht nog op extra context.');
  }

  if (action.status === 'applied' || findMovement(state, action.id)) {
    return buildError('already_applied', 'Deze actie is al toegepast.');
  }

  if (action.requiresApproval && action.status !== 'approved') {
    return buildError('invalid_tenant_scope', 'Deze voorraadmutatie mist nog goedkeuring.');
  }

  let ensuredTraceEvent: TraceEvent | null = null;
  if (input.traceEvent) {
    const traceResult = await appendTraceEvent(context, input.traceEvent);
    if (traceResult.ok === false) {
      return mapPersistenceError<{ movement: StockMovementRecord; appliedAction: PendingScanActionRecord; traceEvent: TraceEvent }>(traceResult);
    }
    ensuredTraceEvent = traceResult.value;
  }

  ensuredTraceEvent =
    ensuredTraceEvent ??
    (input.movement.traceEventId ? findTraceEvent(state, input.movement.traceEventId) : null);

  if (!ensuredTraceEvent) {
    return buildError('missing_trace_event', 'Er moet eerst een trace-event zijn voordat voorraad wijzigt.');
  }

  const latestState = await readState();
  const movement: StockMovementRecord = {
    ...input.movement,
    branchId: input.movement.branchId ?? action.branchId,
    companyId: input.movement.companyId ?? action.companyId,
    traceEventId: ensuredTraceEvent.id,
    createdByUserId: input.movement.createdByUserId || context.userId,
    approvedByUserId: input.movement.approvedByUserId ?? null,
    createdAt: input.movement.createdAt ?? ensuredTraceEvent.createdAt,
    status: 'applied',
    updatedAt: ensuredTraceEvent.createdAt,
  };

  const nextAction: PendingScanActionRecord = {
    ...action,
    status: 'applied',
    updatedAt: ensuredTraceEvent.createdAt,
    decisionByUserId: action.decisionByUserId ?? context.userId,
    decisionReason: action.decisionReason ?? 'Voorraadmutatie toegepast.',
    traceEventId: ensuredTraceEvent.id,
    appliedMovementId: movement.id,
  };

  const nextState = {
    ...latestState,
    traceEvents: upsertById(latestState.traceEvents, ensuredTraceEvent),
    stockMovements: upsertStockMovement(latestState.stockMovements, movement),
    pendingScanActions: upsertPendingAction(latestState.pendingScanActions, nextAction),
  };
  await persistState(nextState);

  return {
    ok: true,
    value: {
      movement: cloneStockMovement(movement),
      appliedAction: clonePendingAction(nextAction),
      traceEvent: cloneTraceEvent(ensuredTraceEvent),
    },
  };
}

function validateReadContext(
  context: PersistenceContext,
  options: { allowCompanyWideBranchAccess?: boolean } = {}
): PersistenceResult<never> | null {
  return ensureTenantContext(context, {
    requireBranch: false,
    allowCompanyWideBranchAccess: options.allowCompanyWideBranchAccess ?? false,
  });
}

export async function getPendingActionsForMembership(
  context: PersistenceContext
): Promise<PersistenceResult<PendingScanActionRecord[]>> {
  const validation = validateReadContext(context);
  if (validation) return validation;

  if (!context.companyId || !context.membershipId || !context.userId) {
    return buildInvalidScopeError();
  }

  const state = await readState();
  const companyWide = isCompanyWideAccess(context);
  if (!companyWide && !context.branchId) {
    return buildError('missing_branch_id', 'Een vestigingscontext is nodig.');
  }

  const records = state.pendingScanActions.filter((entry) => entry.companyId === context.companyId && (companyWide || entry.branchId === context.branchId));
  return { ok: true, value: records.map(clonePendingAction) };
}

export async function getPendingActionsForBranch(context: PersistenceContext): Promise<PersistenceResult<PendingScanActionRecord[]>> {
  const validation = validateReadContext(context);
  if (validation) return validation;

  if (!context.companyId || !context.membershipId || !context.userId) {
    return buildInvalidScopeError();
  }

  if (!context.branchId) {
    return buildError('missing_branch_id', 'Een vestigingscontext is nodig.');
  }

  const state = await readState();
  const records = state.pendingScanActions.filter((entry) => entry.companyId === context.companyId && entry.branchId === context.branchId);
  return { ok: true, value: records.map(clonePendingAction) };
}

export async function getTraceEventsForAction(
  context: PersistenceContext,
  pendingActionId: string
): Promise<PersistenceResult<TraceEvent[]>> {
  const validation = validateReadContext(context, { allowCompanyWideBranchAccess: true });
  if (validation) return validation;

  const state = await readState();
  const action = findPendingAction(state, pendingActionId);
  if (!action) {
    return buildError('not_found', 'Pending actie niet gevonden.');
  }

  const scopeError = assertScopeMatch(context, action.companyId, action.branchId);
  if (scopeError) return scopeError;

  const records = state.traceEvents.filter(
    (entry) => entry.companyId === action.companyId && entry.pendingActionId === pendingActionId && (isCompanyWideAccess(context) || entry.branchId === action.branchId)
  );
  return { ok: true, value: records.map(cloneTraceEvent) };
}

export async function hasActionBeenApplied(context: PersistenceContext, pendingActionId: string): Promise<PersistenceResult<boolean>> {
  const validation = validateReadContext(context, { allowCompanyWideBranchAccess: true });
  if (validation) return validation;

  const state = await readState();
  const action = findPendingAction(state, pendingActionId);
  if (!action) {
    return buildError('not_found', 'Pending actie niet gevonden.');
  }

  const scopeError = assertScopeMatch(context, action.companyId, action.branchId);
  if (scopeError) return scopeError;

  const applied = action.status === 'applied' || Boolean(findMovement(state, pendingActionId));
  return { ok: true, value: applied };
}

export async function updateScanObservationStatusForTrace(
  context: PersistenceContext,
  observationId: string,
  status: ScanObservationStatus
) {
  return updateScanObservationStatus(context, observationId, status);
}

export async function createTraceEvent(context: PersistenceContext, input: TraceEventInput) {
  return appendTraceEvent(context, input);
}

export function setTazePersistenceStorageModeForTests(mode: PersistenceStorageMode) {
  storageMode = mode;
}

export async function resetTazePersistenceCacheForTests() {
  cachedState = null;
}

export async function clearTazePersistenceForTests() {
  cachedState = null;
  fallbackState = createEmptyState();
  storageMode = 'default';
  await removeItem(STORAGE_KEY).catch(() => {});
  await clearLegacyTraceEventsForTests().catch(() => {});
}
