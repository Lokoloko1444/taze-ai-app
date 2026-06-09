import { type TenantFunctionArea } from 'lib/auth-model';
import {
  buildInventoryPolicyDecision,
  type InventoryActionType,
  type InventoryRiskLevel,
} from 'lib/inventory-policy';
import type { RecognitionResult } from 'lib/recognition';

export type ScanObservationSource = 'camera' | 'barcode' | 'manual';

export type ScanObservationStatus = 'draft' | 'confirmed' | 'rejected';

export type ScanRecognitionProvider = 'barcode' | 'ai' | 'manual';

export type PendingScanActionType =
  | 'count_stock'
  | 'stock_correction'
  | 'report_damage'
  | 'report_expiry'
  | 'receive_delivery'
  | 'manual_product_entry'
  | 'transfer_inventory'
  | 'remove_inventory';

export type PendingScanActionStatus =
  | 'pending_confirmation'
  | 'pending_approval'
  | 'context_requested'
  | 'approved'
  | 'rejected'
  | 'applied';

export type ScanObservation = {
  id: string;
  companyId: string;
  branchId: string;
  userId: string;
  membershipId: string;
  source: ScanObservationSource;
  rawValue: string;
  imageRef: string | null;
  createdAt: string;
  status: ScanObservationStatus;
};

export type ScanRecognitionResult = {
  observationId: string;
  provider: ScanRecognitionProvider;
  suggestedProductId: string | null;
  suggestedName: string | null;
  confidence: number | null;
  sourceLabel: string;
  error: string | null;
};

export type PendingScanAction = {
  id: string;
  observationId: string;
  actionType: PendingScanActionType;
  status: PendingScanActionStatus;
  requiresApproval: boolean;
  createdAt: string;
  companyId?: string | null;
  branchId?: string | null;
  membershipId?: string | null;
  riskLevel?: InventoryRiskLevel;
  sourceObservationLabel?: string | null;
  recognitionLabel?: string | null;
  observationStatus?: ScanObservationStatus | null;
  policyReason?: string | null;
};

export type ScanTraceEvent = {
  companyId: string;
  branchId: string | null;
  userId: string;
  membershipId: string;
  observationId: string;
  pendingActionId: string;
  actionType: PendingScanActionType;
  state:
    | 'observation_confirmed'
    | 'action_pending'
    | 'action_approved'
    | 'action_applied'
    | 'action_rejected'
    | 'action_context_requested'
    | 'observation_rejected';
  itemName: string;
  rawValue: string;
  barcode: string | null;
  sourceLabel: string;
  confidence: number | null;
  note: string;
};

export type ScanTraceEventRecordInput = {
  eventKind: 'scan_saved';
  itemId: null;
  itemName: string;
  location: string | null;
  fromLocation: null;
  toLocation: string | null;
  quantity: number;
  source: string;
  barcode: string | null;
  batchCode: null;
  lotNumber: null;
  confidence: number | null;
  expiryDays: null;
  note: string;
};

const ACTION_LABELS: Record<PendingScanActionType, string> = {
  count_stock: 'Voorraad tellen',
  stock_correction: 'Voorraadcorrectie',
  report_damage: 'Schade melden',
  report_expiry: 'Verval melden',
  receive_delivery: 'Levering ontvangen',
  manual_product_entry: 'Handmatige productinvoer',
  transfer_inventory: 'Voorraad verplaatsen',
  remove_inventory: 'Voorraad verwijderen',
};

const ACTION_DESCRIPTIONS: Record<PendingScanActionType, string> = {
  count_stock: 'Observatie voorbereiden voor telling of voorraadcontrole.',
  stock_correction: 'Corrigeer een afwijking na bevestigde observatie en auditlog.',
  report_damage: 'Registratie klaarzetten voor schade, breuk of waste.',
  report_expiry: 'Observatie voorbereiden voor verval of houdbaarheidscontrole.',
  receive_delivery: 'Leveringsobservatie klaarzetten voor ontvangst of weigering.',
  manual_product_entry: 'Handmatige invoer klaarzetten als gecontroleerde observatie.',
  transfer_inventory: 'Voorraad verplaatsen tussen vestigingen of opslaglocaties.',
  remove_inventory: 'Voorraad definitief verwijderen of afboeken na controle.',
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeRawValue(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function canCreateScanObservation(params: {
  companyId: string | null;
  branchId: string | null;
  hasScanAccess: boolean;
}) {
  return Boolean(params.hasScanAccess && params.companyId && params.branchId);
}

export function buildScanObservation(params: {
  companyId: string;
  branchId: string;
  userId: string;
  membershipId: string;
  source: ScanObservationSource;
  rawValue: string;
  imageRef?: string | null;
}): ScanObservation {
  return {
    id: createId('scan-observation'),
    companyId: params.companyId,
    branchId: params.branchId,
    userId: params.userId,
    membershipId: params.membershipId,
    source: params.source,
    rawValue: normalizeRawValue(params.rawValue),
    imageRef: params.imageRef ?? null,
    createdAt: new Date().toISOString(),
    status: 'draft',
  };
}

function classifyRecognitionProvider(source: string | null | undefined, fallback: ScanObservationSource): ScanRecognitionProvider {
  const normalized = String(source ?? '').trim().toLowerCase();
  if (normalized.includes('manual')) {
    return 'manual';
  }
  if (normalized.includes('barcode') || normalized.includes('override') || normalized.includes('pattern') || normalized.includes('lookup')) {
    return 'barcode';
  }
  if (normalized.includes('ai') || normalized.includes('live') || normalized.includes('vision') || normalized.includes('openai')) {
    return 'ai';
  }

  return fallback === 'manual' ? 'manual' : fallback === 'barcode' ? 'barcode' : 'ai';
}

export function getRecognitionProviderLabel(provider: ScanRecognitionProvider) {
  switch (provider) {
    case 'barcode':
      return 'Barcode-suggestie';
    case 'manual':
      return 'Handmatige interpretatie';
    case 'ai':
    default:
      return 'AI-voorstel';
  }
}

export function buildScanRecognitionResult(params: {
  observation: ScanObservation;
  recognition?: RecognitionResult | null;
  manualName?: string | null;
  aiUnavailableMessage?: string | null;
}): ScanRecognitionResult {
  const recognition = params.recognition ?? null;

  if (recognition) {
    const provider = classifyRecognitionProvider(recognition.source, params.observation.source);
    return {
      observationId: params.observation.id,
      provider,
      suggestedProductId: recognition.barcode ?? null,
      suggestedName: recognition.name?.trim() || params.manualName?.trim() || params.observation.rawValue || null,
      confidence: typeof recognition.confidence === 'number' && Number.isFinite(recognition.confidence) ? recognition.confidence : null,
      sourceLabel: getRecognitionProviderLabel(provider),
      error: null,
    };
  }

  return {
    observationId: params.observation.id,
    provider: 'manual',
    suggestedProductId: null,
    suggestedName: params.manualName?.trim() || params.observation.rawValue || null,
    confidence: null,
    sourceLabel: params.aiUnavailableMessage ? 'AI niet beschikbaar' : getRecognitionProviderLabel('manual'),
    error: params.aiUnavailableMessage ?? null,
  };
}

export function getScanActionLabel(actionType: PendingScanActionType) {
  return ACTION_LABELS[actionType];
}

export function getScanActionDescription(actionType: PendingScanActionType) {
  return ACTION_DESCRIPTIONS[actionType];
}

export function requiresManagerApproval(params: {
  role: string | null;
  permissions: string[];
  actionType: PendingScanActionType;
}) {
  const policy = buildInventoryPolicyDecision({
    actor: {
      companyId: 'policy-check',
      branchId: 'policy-check',
      membershipId: 'policy-check',
      role: params.role,
      permissions: params.permissions,
      functions: [],
    },
    target: {
      companyId: 'policy-check',
      branchId: 'policy-check',
    },
    actionType: params.actionType as InventoryActionType,
    observationConfirmed: true,
    traceEventRecorded: false,
  });

  return policy.requiresManagerApproval;
}

export function buildPendingScanAction(params: {
  observation: ScanObservation;
  actionType: PendingScanActionType;
  role: string | null;
  permissions: string[];
  companyId?: string | null;
  branchId?: string | null;
  membershipId?: string | null;
  functions?: TenantFunctionArea[];
  sourceObservationLabel?: string | null;
  recognitionLabel?: string | null;
  observationStatus?: ScanObservationStatus | null;
  supportMode?: boolean;
}): PendingScanAction {
  const policy = buildInventoryPolicyDecision({
    actor: {
      companyId: params.companyId ?? params.observation.companyId,
      branchId: params.branchId ?? params.observation.branchId,
      membershipId: params.membershipId ?? params.observation.membershipId,
      membershipStatus: 'ACTIVE',
      role: params.role,
      permissions: params.permissions,
      functions: params.functions ?? [],
      supportMode: params.supportMode ?? false,
    },
    target: {
      companyId: params.observation.companyId,
      branchId: params.observation.branchId,
    },
    actionType: params.actionType as InventoryActionType,
    observationConfirmed: true,
    traceEventRecorded: false,
    observationStatus: params.observationStatus ?? params.observation.status,
  });

  return {
    id: createId('scan-action'),
    observationId: params.observation.id,
    actionType: params.actionType,
    status: policy.requiresManagerApproval ? 'pending_approval' : 'pending_confirmation',
    requiresApproval: policy.requiresManagerApproval,
    createdAt: new Date().toISOString(),
    companyId: params.companyId ?? params.observation.companyId,
    branchId: params.branchId ?? params.observation.branchId,
    membershipId: params.membershipId ?? params.observation.membershipId,
    riskLevel: policy.riskLevel,
    sourceObservationLabel: params.sourceObservationLabel ?? null,
    recognitionLabel: params.recognitionLabel ?? null,
    observationStatus: params.observationStatus ?? params.observation.status,
    policyReason: policy.reason,
  };
}

export function getPendingScanActionStatusLabel(status: PendingScanActionStatus) {
  switch (status) {
    case 'pending_confirmation':
      return 'Needs confirmation';
    case 'pending_approval':
      return 'Needs manager approval';
    case 'context_requested':
      return 'Needs more context';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'applied':
      return 'Applied';
    default:
      return 'Pending';
  }
}

export function buildScanTraceEvent(params: {
  observation: ScanObservation;
  recognition: ScanRecognitionResult;
  pendingAction: PendingScanAction;
  companyId: string;
  branchId: string | null;
  userId: string;
  membershipId: string;
  state: ScanTraceEvent['state'];
  note: string;
}): ScanTraceEvent {
  return {
    companyId: params.companyId,
    branchId: params.branchId,
    userId: params.userId,
    membershipId: params.membershipId,
    observationId: params.observation.id,
    pendingActionId: params.pendingAction.id,
    actionType: params.pendingAction.actionType,
    state: params.state,
    itemName: params.recognition.suggestedName ?? params.observation.rawValue,
    rawValue: params.observation.rawValue,
    barcode: params.recognition.suggestedProductId,
    sourceLabel: params.recognition.sourceLabel,
    confidence: params.recognition.confidence,
    note: params.note,
  };
}

export function toTraceEventRecord(event: ScanTraceEvent): ScanTraceEventRecordInput {
  return {
    eventKind: 'scan_saved',
    itemId: null,
    itemName: event.itemName,
    location: event.branchId ?? event.companyId,
    fromLocation: null,
    toLocation: event.branchId ?? event.companyId,
    quantity: 1,
    source: 'scan-shell',
    barcode: event.barcode,
    batchCode: null,
    lotNumber: null,
    confidence: event.confidence,
    expiryDays: null,
    note: `[${event.state}] company=${event.companyId} membership=${event.membershipId} observation=${event.observationId} action=${event.pendingActionId} source=${event.sourceLabel} ${event.note}`,
  };
}

export async function appendScanTraceEvent(event: ScanTraceEvent) {
  const { appendTraceEvent: appendPersistenceTraceEvent } = await import('lib/taze-persistence');
  return appendPersistenceTraceEvent(
    {
      companyId: event.companyId,
      branchId: event.branchId,
      userId: event.userId,
      membershipId: event.membershipId,
      membershipStatus: 'ACTIVE',
      role: null,
      permissions: [],
      functionAreas: [],
      supportMode: false,
    },
    {
      eventType:
        event.state === 'observation_confirmed'
          ? 'scan_observation_confirmed'
          : event.state === 'observation_rejected'
            ? 'scan_observation_rejected'
            : event.state === 'action_pending'
              ? 'pending_action_created'
              : event.state === 'action_approved'
                ? 'pending_action_approved'
                : event.state === 'action_rejected'
                  ? 'pending_action_rejected'
                  : event.state === 'action_context_requested'
                    ? 'pending_action_context_requested'
                    : 'inventory_mutation',
      companyId: event.companyId,
      branchId: event.branchId,
      userId: event.userId,
      membershipId: event.membershipId,
      observationId: event.observationId,
      pendingActionId: event.pendingActionId,
      previousStatus:
        event.state === 'observation_rejected'
          ? 'draft'
          : event.state === 'observation_confirmed'
            ? 'draft'
            : event.state === 'action_pending'
              ? 'draft'
              : event.state === 'action_approved'
                ? 'pending_approval'
                : event.state === 'action_context_requested'
                  ? 'pending_approval'
                  : event.state === 'action_rejected'
                    ? 'pending_approval'
                    : 'approved',
      newStatus:
        event.state === 'observation_rejected'
          ? 'rejected'
          : event.state === 'action_rejected'
            ? 'rejected'
            : event.state === 'action_context_requested'
              ? 'context_requested'
              : event.state === 'action_approved'
                ? 'approved'
                : event.state === 'action_applied'
                  ? 'applied'
                  : 'confirmed',
      movementType: null,
      productId: event.barcode ?? null,
      itemName: event.itemName,
      rawValue: event.rawValue,
      sourceLabel: event.sourceLabel,
      confidence: event.confidence,
      note: event.note,
    }
  );
}

export function buildScanShellAvailability(params: {
  cameraAvailable: boolean | null;
  cameraPermissionGranted: boolean | null;
  aiAvailable: boolean;
}) {
  const cameraLabel =
    params.cameraAvailable === false
      ? 'Camera niet beschikbaar op dit apparaat'
      : params.cameraPermissionGranted === false
        ? 'Geef cameratoegang om live te scannen'
        : params.cameraAvailable === null
          ? 'Camera wordt gecontroleerd'
          : 'Camera klaar voor scan';

  return {
    cameraAvailable: params.cameraAvailable,
    manualEntryAvailable: true,
    cameraLabel,
    aiLabel: params.aiAvailable ? 'AI beschikbaar' : 'AI niet beschikbaar',
    aiAvailable: params.aiAvailable,
  };
}
