export const DISTRIBUTION_STATUSES = [
  'draft',
  'ready_for_departure',
  'driver_assigned',
  'departure_confirmed',
  'in_transit',
  'arrived',
  'customer_confirmed',
  'closed',
  'cancelled',
] as const;

export type DistributionStatus = (typeof DISTRIBUTION_STATUSES)[number];

export interface DistributionOrder {
  id: string;
  companyId: string;
  branchId: string;
  status: DistributionStatus;
  createdByMembershipId: string;
  assignedDriverMembershipId?: string | null;
  readyForDepartureAt?: string | null;
  departedAt?: string | null;
  arrivedAt?: string | null;
  customerConfirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DistributionLine {
  id: string;
  distributionOrderId: string;
  productId?: string | null;
  productLabel: string;
  barcode?: string | null;
  quantity: number;
  unit?: string | null;
  linkedStockMovementId?: string | null;
}

export interface DistributionTraceEvent {
  id: string;
  companyId: string;
  branchId: string;
  distributionOrderId: string;
  eventKind: string;
  actorMembershipId: string;
  fromStatus?: DistributionStatus | null;
  toStatus?: DistributionStatus | null;
  note?: string | null;
  evidenceUri?: string | null;
  createdAt: string;
}

export interface BuildDistributionTraceEventInput {
  id: string;
  companyId: string;
  branchId: string;
  distributionOrderId: string;
  eventKind: string;
  actorMembershipId: string;
  fromStatus?: DistributionStatus | null;
  toStatus?: DistributionStatus | null;
  note?: string | null;
  evidenceUri?: string | null;
  createdAt: string;
}

const DISTRIBUTION_TRANSITIONS: Record<DistributionStatus, readonly DistributionStatus[]> = {
  draft: ['ready_for_departure', 'cancelled'],
  ready_for_departure: ['driver_assigned', 'departure_confirmed', 'cancelled'],
  driver_assigned: ['departure_confirmed', 'cancelled'],
  departure_confirmed: ['in_transit', 'cancelled'],
  in_transit: ['arrived', 'cancelled'],
  arrived: ['customer_confirmed', 'cancelled'],
  customer_confirmed: ['closed', 'cancelled'],
  closed: [],
  cancelled: [],
};

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== 'string') return null;
  return value.trim() ? value : null;
}

export function canTransitionDistributionStatus(from: DistributionStatus, to: DistributionStatus) {
  if (from === to) return false;
  return DISTRIBUTION_TRANSITIONS[from].includes(to);
}

export function isDistributionTerminalStatus(status: DistributionStatus) {
  return status === 'closed' || status === 'cancelled';
}

export function getDistributionStatusLabel(status: DistributionStatus) {
  switch (status) {
    case 'draft':
      return 'Concept';
    case 'ready_for_departure':
      return 'Klaar voor vertrek';
    case 'driver_assigned':
      return 'Chauffeur toegewezen';
    case 'departure_confirmed':
      return 'Vertrek bevestigd';
    case 'in_transit':
      return 'Onderweg';
    case 'arrived':
      return 'Aangekomen';
    case 'customer_confirmed':
      return 'Klant bevestigd';
    case 'closed':
      return 'Gesloten';
    case 'cancelled':
      return 'Geannuleerd';
    default:
      return 'Onbekende status';
  }
}

export function buildDistributionTraceEvent(input: BuildDistributionTraceEventInput): DistributionTraceEvent {
  return {
    id: input.id,
    companyId: input.companyId,
    branchId: input.branchId,
    distributionOrderId: input.distributionOrderId,
    eventKind: input.eventKind,
    actorMembershipId: input.actorMembershipId,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    note: normalizeOptionalText(input.note),
    evidenceUri: normalizeOptionalText(input.evidenceUri),
    createdAt: input.createdAt,
  };
}
