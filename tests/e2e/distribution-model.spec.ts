import { expect, test } from '@playwright/test';

import {
  buildDistributionTraceEvent,
  canTransitionDistributionStatus,
  getDistributionStatusLabel,
  isDistributionTerminalStatus,
} from 'lib/distribution-model';

test('distribution contract keeps status transitions and trace metadata separate', () => {
  expect(canTransitionDistributionStatus('draft', 'ready_for_departure')).toBe(true);
  expect(canTransitionDistributionStatus('ready_for_departure', 'departure_confirmed')).toBe(true);
  expect(canTransitionDistributionStatus('departure_confirmed', 'in_transit')).toBe(true);
  expect(canTransitionDistributionStatus('in_transit', 'customer_confirmed')).toBe(false);
  expect(isDistributionTerminalStatus('cancelled')).toBe(true);
  expect(getDistributionStatusLabel('ready_for_departure')).toBe('Klaar voor vertrek');

  const traceEvent = buildDistributionTraceEvent({
    id: 'distribution-trace-001',
    companyId: 'company_456',
    branchId: 'branch_789',
    distributionOrderId: 'distribution-order-001',
    eventKind: 'status_changed',
    actorMembershipId: 'membership_123',
    fromStatus: 'departure_confirmed',
    toStatus: 'in_transit',
    note: 'Klaar voor vertrek',
    evidenceUri: null,
    createdAt: '2026-05-06T12:00:00.000Z',
  });

  expect(traceEvent.companyId).toBe('company_456');
  expect(traceEvent.branchId).toBe('branch_789');
  expect(traceEvent.distributionOrderId).toBe('distribution-order-001');
  expect(traceEvent.fromStatus).toBe('departure_confirmed');
  expect(traceEvent.toStatus).toBe('in_transit');
});
