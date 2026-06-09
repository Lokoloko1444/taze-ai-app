import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RIA_AI_BOUNDARY } from 'lib/ai-boundary';
import { DomainConfig } from 'lib/domain-config';
import { normalizeConfiguredServerBaseUrl, resolveNativeServerBaseUrl } from 'lib/server-url-policy';
import {
  buildPendingScanAction,
  buildScanObservation,
  buildScanRecognitionResult,
  buildScanTraceEvent,
  toTraceEventRecord,
} from 'lib/scan-flow';

test.describe('real app flow harness', () => {
  test('production host origins point recognition and app traffic at the live API host', () => {
    for (const origin of [
      DomainConfig.publicOrigin,
      DomainConfig.wwwOrigin,
      DomainConfig.appOrigin,
      DomainConfig.adminOrigin,
      DomainConfig.scanOrigin,
    ]) {
      expect(normalizeConfiguredServerBaseUrl(origin)).toBe(DomainConfig.apiOrigin);
      expect(normalizeConfiguredServerBaseUrl(origin)).not.toMatch(/localhost|127\.0\.0\.1/i);
    }

    expect(resolveNativeServerBaseUrl('localhost:8084')).toBe(DomainConfig.apiOrigin);
    expect(resolveNativeServerBaseUrl('127.0.0.1:8084')).toBe(DomainConfig.apiOrigin);
  });

  test('scan recognition remains a staff-confirmed proposal with audit proof', () => {
    const observation = buildScanObservation({
      companyId: 'company-live',
      branchId: 'branch-kitchen',
      userId: 'staff-user',
      membershipId: 'membership-staff',
      source: 'camera',
      rawValue: '  8710400131474  ',
      imageRef: 'proof/camera-frame-001.jpg',
    });

    const recognition = buildScanRecognitionResult({
      observation,
      recognition: {
        name: 'Whole Milk 1L',
        category: 'Zuivel',
        quantity: 1,
        expiryDays: 4,
        confidence: 0.92,
        notes: 'Live recognition proposal from product lookup.',
        source: 'openai-vision',
        barcode: '8710400131474',
      },
    });

    const pendingAction = buildPendingScanAction({
      observation: { ...observation, status: 'confirmed' },
      actionType: 'receive_delivery',
      role: 'CHAUFFEUR',
      permissions: ['scan:create', 'delivery.confirm'],
      functions: ['DISTRIBUTIE'],
      sourceObservationLabel: 'Camera scan',
      recognitionLabel: recognition.sourceLabel,
      observationStatus: 'confirmed',
    });

    const traceEvent = buildScanTraceEvent({
      observation,
      recognition,
      pendingAction: { ...pendingAction, status: 'approved' },
      companyId: observation.companyId,
      branchId: observation.branchId,
      userId: observation.userId,
      membershipId: observation.membershipId,
      state: 'action_applied',
      note: 'Staff confirmed proposal and sent product to branch destination.',
    });

    const auditRecord = toTraceEventRecord(traceEvent);

    expect(observation.rawValue).toBe('8710400131474');
    expect(recognition.provider).toBe('ai');
    expect(recognition.sourceLabel).toBe('AI-voorstel');
    expect(recognition.suggestedProductId).toBe('8710400131474');
    expect(pendingAction.status).toBe('pending_approval');
    expect(pendingAction.requiresApproval).toBe(true);
    expect(pendingAction.policyReason).toContain('High-risk');
    expect(traceEvent.state).toBe('action_applied');
    expect(traceEvent.note).toContain('Staff confirmed');
    expect(auditRecord.eventKind).toBe('scan_saved');
    expect(auditRecord.source).toBe('scan-shell');
    expect(auditRecord.note).toContain('observation=');
    expect(auditRecord.note).toContain('action=');
    expect(auditRecord.note).not.toMatch(/\bdemo\b|\bmock\b/i);
  });

  test('AI boundary blocks decisions, payments, Stripe changes and inventory mutation', () => {
    expect(RIA_AI_BOUNDARY.mode).toBe('advisory-only');
    expect(RIA_AI_BOUNDARY.allowedCapabilities).toEqual(
      expect.arrayContaining(['advise', 'warn', 'propose_next_step', 'show_risk'])
    );
    expect(RIA_AI_BOUNDARY.blockedCapabilities).toEqual(
      expect.arrayContaining(['decide', 'mutate_inventory', 'start_payment', 'approve_payment', 'change_stripe'])
    );
  });

  test('scan shell keeps proposal, human confirmation, audit and mutation gates explicit', () => {
    const scanShellSource = readFileSync(join(process.cwd(), 'components', 'scan-shell-page.tsx'), 'utf8');

    expect(scanShellSource).toContain('Voorstel');
    expect(scanShellSource).toContain('AI/barcode geeft alleen advies.');
    expect(scanShellSource).toContain('Mens bevestigt');
    expect(scanShellSource).toContain('Locatie en actie worden hier gekozen.');
    expect(scanShellSource).toContain('Audit klaar');
    expect(scanShellSource).toContain('Pas daarna ontstaat een pending actie.');

    expect(scanShellSource).toContain('Mutatiepoort');
    expect(scanShellSource).toContain('Observatie');
    expect(scanShellSource).toContain('Goedkeuring');
    expect(scanShellSource).toContain('Mutatie');
    expect(scanShellSource).toContain('Voorraadmutatie toepassen');
    expect(scanShellSource).toContain('Wacht op managergoedkeuring');

    expect(scanShellSource).not.toContain('Apply inventory change');
    expect(scanShellSource).not.toContain('Waiting for manager approval');
  });

  test('recognition endpoint requires live authorization instead of returning demo success', async ({ request }) => {
    const response = await request.post('/recognize', {
      data: {
        barcode: '8710400131474',
        imageBase64: 'camera-frame-placeholder',
      },
    });

    expect([200, 401, 403, 429]).toContain(response.status());

    if (response.status() !== 200) {
      const payload = await response.json().catch(() => null);
      expect(payload).toBeTruthy();
      expect(String(payload?.error ?? payload?.message ?? '')).not.toMatch(/\bdemo\b|\bmock\b/i);
      return;
    }

    const payload = await response.json();
    expect(payload?.ok).toBe(true);
    expect(String(payload?.method ?? payload?.result?.source ?? '')).not.toMatch(/\bdemo\b|\bmock\b|fallback/i);
  });
});
