import { expect, test } from '@playwright/test';

import { RIA_AI_BOUNDARY } from 'lib/ai-boundary';
import {
  buildTenantContextSnapshot,
  canConfirmTransportBusinessImpact,
  canManageAdminLine,
  canManageInvoiceLine,
  getDefaultFunctionsForRole,
  isOperationalRole,
  isOwnerOrManagerRole,
  roleHasPermission,
  type TenantFunctionArea,
  type TenantMembership,
  type TenantProviderAccount,
} from 'lib/auth-model';
import { mergeSessionProviderAccounts } from 'lib/tenant-auth';
import { getRealAiUnavailableMessage, isRealAiDisabledError } from 'lib/ai-availability';
import { buildTenantAwareAiContext } from 'lib/ai-tenant-context';
import { buildInviteLink } from 'lib/invite-links';
import { hasPermission, getPermissionMessage } from 'lib/role-permissions';
import {
  assignInvoiceNumber,
  canAssignInvoiceNumber,
  canPrepareInvoicePaymentStatus,
  canQueueInvoiceCustomerMail,
  canRunFinalInvoiceControl,
  createInvoiceConcept,
  prepareInvoicePaymentStatus,
  queueInvoiceCustomerMail,
  runFinalInvoiceControl,
  reviewInvoiceConcept,
} from 'lib/invoice-model';
import { getRiaDataAccessDecision, getRiaDeniedMessage, getRiaPermissionDecision } from 'lib/ria-permissions';
import {
  applyInventoryMutation,
  buildInventoryMovement,
  buildInventoryMutationTraceEvent,
  canMutateInventory,
  getInventoryMutationMovementType,
  getInventoryMutationSource,
  validateMutationPreconditions,
  type InventoryMutationContext,
} from 'lib/inventory-mutation';
import { resolveHostAccess } from 'lib/host-access';
import { buildInventoryPolicyDecision, canApplyInventoryMutation, getInventoryActionRiskLevel } from 'lib/inventory-policy';
import { getPageSeo, getPageSeoUrl } from 'lib/page-seo';
import { buildScanShellSuggestions, canUseScanWorkspace } from 'lib/scan-shell';
import {
  buildPendingScanAction,
  buildScanObservation,
  buildScanRecognitionResult,
  buildScanShellAvailability,
  buildScanTraceEvent,
  canCreateScanObservation,
  getPendingScanActionStatusLabel,
  toTraceEventRecord,
} from 'lib/scan-flow';
import { isPublicInfoRoute, normalizePathname, resolveRootLayoutSurface } from 'lib/root-layout-routing';

const membershipFixture: TenantMembership = {
  id: 'membership_123',
  userId: 'user_123',
  companyId: 'company_456',
  branchId: 'branch_789',
  role: 'MANAGER',
  permissions: ['inventory.update', 'ai.suggestion.read', 'ai.suggestion.create'],
  status: 'ACTIVE',
  isPrimary: true,
  invitedBy: null,
  createdAt: '2026-04-29T00:00:00.000Z',
  updatedAt: '2026-04-29T00:00:00.000Z',
  company: {
    id: 'company_456',
    name: 'Taze BV',
    legalName: 'Taze Business Ventures',
    slug: 'taze-bv',
    status: 'ACTIVE',
  },
  branch: {
    id: 'branch_789',
    name: 'Hoofdvestiging',
    slug: 'hoofdvestiging',
    code: 'HFD',
    status: 'ACTIVE',
  },
  functions: ['BAR', 'KEUKEN'],
};

const providerFixture: TenantProviderAccount[] = [
  {
    provider: 'google',
    providerAccountId: 'google_abc123',
    providerEmail: 'manager@taze.to',
    emailVerified: true,
    lastLoginAt: '2026-04-29T00:00:00.000Z',
  },
];

function makeMembership(params: {
  role: TenantMembership['role'];
  permissions?: string[];
  functions?: TenantFunctionArea[];
  status?: TenantMembership['status'];
  branchId?: string | null;
  companyId?: string;
  companyName?: string;
  branchName?: string | null;
}): TenantMembership {
  const companyId = params.companyId ?? 'company_456';
  const branchId = params.branchId ?? 'branch_789';
  return {
    id: `${params.role.toLowerCase()}_membership`,
    userId: 'user_123',
    companyId,
    branchId,
    role: params.role,
    permissions: params.permissions ?? ['inventory.read'],
    status: params.status ?? 'ACTIVE',
    isPrimary: true,
    invitedBy: null,
    createdAt: '2026-04-29T00:00:00.000Z',
    updatedAt: '2026-04-29T00:00:00.000Z',
    company: {
      id: companyId,
      name: params.companyName ?? 'Taze BV',
      legalName: 'Taze Business Ventures',
      slug: 'taze-bv',
      status: 'ACTIVE',
    },
    branch:
      branchId && params.branchName !== null
        ? {
            id: branchId,
            name: params.branchName ?? 'Hoofdvestiging',
            slug: 'hoofdvestiging',
            code: 'HFD',
            status: 'ACTIVE',
          }
        : null,
    functions: params.functions ?? getDefaultFunctionsForRole(params.role),
  };
}

function makeMutationContext(membership: TenantMembership, overrides: Partial<InventoryMutationContext['actor']> = {}): InventoryMutationContext {
  return {
    actor: {
      companyId: membership.companyId,
      branchId: membership.branchId,
      membershipId: membership.id,
      membershipStatus: membership.status,
      role: membership.role,
      permissions: membership.permissions,
      functions: membership.functions,
      userId: membership.userId,
      ...overrides,
    },
    target: {
      companyId: membership.companyId,
      branchId: membership.branchId,
    },
  };
}

function makeMutationTraceEvent(context: InventoryMutationContext, action: ReturnType<typeof buildPendingScanAction>) {
  return buildInventoryMutationTraceEvent(
    context,
    action,
    getInventoryMutationMovementType(action.actionType),
    action.status,
    'applied',
    getInventoryMutationSource(context.actor.role, action.actionType, context.actor.actorKind)
  );
}

test('tenant permissions and context snapshot stay company-aware', () => {
  const snapshot = buildTenantContextSnapshot({
    userId: 'user_123',
    email: 'manager@taze.to',
    memberships: [membershipFixture],
    activeMembership: membershipFixture,
    providerAccounts: providerFixture,
  });

  expect(snapshot.companyId).toBe('company_456');
  expect(snapshot.branchId).toBe('branch_789');
  expect(snapshot.role).toBe('MANAGER');
  expect(snapshot.functions).toEqual(['BAR', 'KEUKEN']);
  expect(snapshot.permissions).toEqual(expect.arrayContaining(['inventory.update', 'ai.suggestion.read', 'ai.suggestion.create']));
  expect(snapshot.providers).toEqual(['google']);
  expect(roleHasPermission('OWNER', 'billing.manage')).toBe(true);
  expect(roleHasPermission('OWNER', 'invoice.manage')).toBe(true);
  expect(roleHasPermission('OWNER', 'admin.manage')).toBe(true);
  expect(roleHasPermission('OWNER', 'company.manage_data')).toBe(true);
  expect(roleHasPermission('OWNER', 'delivery.confirm')).toBe(true);
  expect(roleHasPermission('OWNER', 'transport.confirm_business_impact')).toBe(true);
  expect(roleHasPermission('MANAGER', 'invoice.manage')).toBe(true);
  expect(roleHasPermission('MANAGER', 'admin.manage')).toBe(false);
  expect(roleHasPermission('MANAGER', 'company.manage_data')).toBe(false);
  expect(roleHasPermission('MANAGER', 'delivery.confirm')).toBe(true);
  expect(roleHasPermission('MANAGER', 'transport.confirm_business_impact')).toBe(true);
  expect(isOwnerOrManagerRole('OWNER')).toBe(true);
  expect(isOwnerOrManagerRole('MANAGER')).toBe(true);
  expect(isOwnerOrManagerRole('WERKVLOER')).toBe(false);
  expect(isOwnerOrManagerRole('CHAUFFEUR')).toBe(false);
  expect(isOperationalRole('WERKVLOER')).toBe(true);
  expect(isOperationalRole('CHAUFFEUR')).toBe(true);
  expect(canManageInvoiceLine('MANAGER', ['invoice.manage'])).toBe(true);
  expect(canManageAdminLine('OWNER', ['admin.manage'])).toBe(true);
  expect(canConfirmTransportBusinessImpact('MANAGER', ['transport.confirm_business_impact'])).toBe(true);
  expect(roleHasPermission('WERKVLOER', 'invoice.manage')).toBe(false);
  expect(roleHasPermission('WERKVLOER', 'admin.manage')).toBe(false);
  expect(roleHasPermission('WERKVLOER', 'company.manage_data')).toBe(false);
  expect(roleHasPermission('WERKVLOER', 'transport.confirm_business_impact')).toBe(false);
  expect(roleHasPermission('CHAUFFEUR', 'invoice.manage')).toBe(false);
  expect(roleHasPermission('CHAUFFEUR', 'admin.manage')).toBe(false);
  expect(roleHasPermission('CHAUFFEUR', 'company.manage_data')).toBe(false);
  expect(roleHasPermission('CHAUFFEUR', 'delivery.update_status')).toBe(true);
  expect(roleHasPermission('CHAUFFEUR', 'delivery.confirm')).toBe(false);
  expect(roleHasPermission('CHAUFFEUR', 'transport.confirm_business_impact')).toBe(false);
  expect(getPermissionMessage('company.manage_data')).toContain('bedrijfsdata');
  expect(roleHasPermission('WERKVLOER', 'finance.read')).toBe(false);
  expect(getDefaultFunctionsForRole('CHAUFFEUR')).toEqual(expect.arrayContaining(['DISTRIBUTIE']));
});

test('session google provider is surfaced as a linked identity without changing membership data', () => {
  const merged = mergeSessionProviderAccounts([], {
    userId: 'user_123',
    email: 'lgstudio144@gmail.com',
    sessionProvider: 'google',
    lastLoginAt: '2026-05-09T00:00:00.000Z',
  });

  expect(merged).toHaveLength(1);
  expect(merged[0]).toEqual(
    expect.objectContaining({
      provider: 'google',
      providerAccountId: 'user_123:google',
      providerEmail: 'lgstudio144@gmail.com',
      emailVerified: true,
      lastLoginAt: '2026-05-09T00:00:00.000Z',
    })
  );
});

test('company data management stays separate from operational permissions', () => {
  expect(
    hasPermission({
      permission: 'invoice.manage',
      role: 'CHAUFFEUR',
      email: 'driver@taze.to',
      configured: true,
      permissions: ['company.manage_data'],
    })
  ).toBe(false);

  expect(
    hasPermission({
      permission: 'transport.confirm_business_impact',
      role: 'CHAUFFEUR',
      email: 'driver@taze.to',
      configured: true,
      permissions: ['company.manage_data'],
    })
  ).toBe(false);

  expect(
    hasPermission({
      permission: 'inventory.correct',
      role: 'CHAUFFEUR',
      email: 'driver@taze.to',
      configured: true,
      permissions: ['company.manage_data'],
    })
  ).toBe(false);

  expect(
    hasPermission({
      permission: 'admin.manage',
      role: 'CHAUFFEUR',
      email: 'driver@taze.to',
      configured: true,
      permissions: ['company.manage_data'],
    })
  ).toBe(false);
});

test('ai context builder keeps the ria boundary advisory-only and forwards tenant context', () => {
  const snapshot = buildTenantContextSnapshot({
    userId: 'user_123',
    email: 'manager@taze.to',
    memberships: [membershipFixture],
    activeMembership: membershipFixture,
    providerAccounts: providerFixture,
  });

  const merged = buildTenantAwareAiContext({
    context: {
      screen: 'explore',
      question: 'Wat is de volgende actie voor de keuken?',
      riaBoundary: {
        mode: 'decision-only',
        allowedCapabilities: ['decide'],
        blockedCapabilities: [],
      },
    },
    tenantContext: snapshot,
    transportGlobal: { transport: { region: 'West-Europa' } },
  });

  expect(merged).toMatchObject({
    screen: 'explore',
    question: 'Wat is de volgende actie voor de keuken?',
    tenantContext: snapshot,
    transportGlobal: { transport: { region: 'West-Europa' } },
    riaBoundary: RIA_AI_BOUNDARY,
  });
  expect(merged.riaBoundary).toEqual(RIA_AI_BOUNDARY);
});

test('invite links point at the live app origin with the invite token', () => {
  expect(buildInviteLink('invite-token-123')).toBe('https://app.taze.to/account?invite=invite-token-123');
});

test('ria permission helper keeps advice inside the right line and role', () => {
  expect(
    getRiaPermissionDecision({
      line: 'scan',
      role: 'WERKVLOER',
      permissions: ['inventory.read'],
      functionAreas: ['BAR'],
    })
  ).toBe('allowed');

  expect(
    getRiaPermissionDecision({
      line: 'scan',
      role: 'CHAUFFEUR',
      permissions: ['inventory.read'],
      functionAreas: ['DISTRIBUTIE'],
    })
  ).toBe('denied');

  expect(
    getRiaPermissionDecision({
      line: 'invoice',
      role: 'WERKVLOER',
      permissions: ['inventory.read'],
      functionAreas: ['BAR'],
    })
  ).toBe('denied');

  expect(
    getRiaPermissionDecision({
      line: 'transport',
      role: 'CHAUFFEUR',
      permissions: ['delivery.update_status'],
      functionAreas: ['DISTRIBUTIE'],
    })
  ).toBe('allowed');

  expect(
    getRiaPermissionDecision({
      line: 'transport',
      role: 'CHAUFFEUR',
      permissions: ['transport.confirm_business_impact'],
      functionAreas: ['DISTRIBUTIE'],
    })
  ).toBe('denied');

  expect(
    getRiaPermissionDecision({
      line: 'transport',
      role: 'CHAUFFEUR',
      permissions: ['delivery.read'],
      functionAreas: ['DISTRIBUTIE'],
    })
  ).toBe('denied');

  expect(
    getRiaPermissionDecision({
      line: 'transport',
      role: 'MANAGER',
      permissions: ['transport.confirm_business_impact'],
      functionAreas: ['DISTRIBUTIE'],
    })
  ).toBe('allowed');

  expect(
    getRiaPermissionDecision({
      line: 'invoice',
      role: 'MANAGER',
      permissions: ['invoice.manage'],
      functionAreas: ['ADMIN'],
    })
  ).toBe('allowed');

  expect(
    getRiaPermissionDecision({
      line: 'admin',
      role: 'MANAGER',
      permissions: ['invoice.manage'],
      functionAreas: ['ADMIN'],
    })
  ).toBe('denied');

  expect(
    getRiaPermissionDecision({
      line: 'admin',
      role: 'OWNER',
      permissions: ['admin.manage'],
      functionAreas: ['ADMIN'],
    })
  ).toBe('allowed');

  expect(
    getRiaPermissionDecision({
      line: 'ai',
      role: 'MANAGER',
      permissions: ['invoice.manage'],
      functionAreas: ['ADMIN'],
    })
  ).toBe('allowed');

  expect(
    getRiaPermissionDecision({
      line: 'demo',
      role: 'CHAUFFEUR',
      permissions: [],
      functionAreas: [],
    })
  ).toBe('allowed');

  expect(
    getRiaPermissionDecision({
      line: 'api',
      role: 'OWNER',
      permissions: ['admin.manage'],
      functionAreas: ['ADMIN'],
    })
  ).toBe('denied');

  expect(getRiaDeniedMessage('invoice')).toBe('Dit valt buiten je bevoegdheid. Vraag een bevoegde persoon.');
  expect(getRiaDeniedMessage('admin')).toBe('Dit valt buiten je bevoegdheid. Vraag een bevoegde persoon.');
  expect(getRiaDeniedMessage('transport')).toBe('Dit valt buiten je bevoegdheid. Vraag een bevoegde persoon.');
  expect(getRiaDeniedMessage('ai', 'mutate')).toBe('AI/RIA mag alleen adviseren en niets wijzigen.');
});

test('ria data access helper stays read-only and blocks mutate or execute', () => {
  expect(
    getRiaDataAccessDecision({
      line: 'scan',
      role: 'WERKVLOER',
      permissions: ['inventory.read'],
      functionAreas: ['BAR'],
      accessMode: 'read',
    })
  ).toBe('allowed');

  expect(
    getRiaDataAccessDecision({
      line: 'scan',
      role: 'WERKVLOER',
      permissions: ['inventory.read'],
      functionAreas: ['BAR'],
      accessMode: 'advise',
    })
  ).toBe('allowed');

  expect(
    getRiaDataAccessDecision({
      line: 'scan',
      role: 'WERKVLOER',
      permissions: ['inventory.read'],
      functionAreas: ['BAR'],
      accessMode: 'mutate',
    })
  ).toBe('denied');

  expect(
    getRiaDataAccessDecision({
      line: 'transport',
      role: 'CHAUFFEUR',
      permissions: ['delivery.update_status'],
      functionAreas: ['DISTRIBUTIE'],
      accessMode: 'read',
    })
  ).toBe('allowed');

  expect(
    getRiaDataAccessDecision({
      line: 'transport',
      role: 'CHAUFFEUR',
      permissions: ['delivery.update_status'],
      functionAreas: ['DISTRIBUTIE'],
      accessMode: 'execute',
    })
  ).toBe('denied');

  expect(
    getRiaDataAccessDecision({
      line: 'transport',
      role: 'CHAUFFEUR',
      permissions: ['delivery.update_status'],
      functionAreas: ['DISTRIBUTIE'],
      accessMode: 'advise',
    })
  ).toBe('allowed');

  expect(
    getRiaDataAccessDecision({
      line: 'invoice',
      role: 'MANAGER',
      permissions: ['invoice.manage'],
      functionAreas: ['ADMIN'],
      accessMode: 'read',
    })
  ).toBe('allowed');

  expect(
    getRiaDataAccessDecision({
      line: 'invoice',
      role: 'MANAGER',
      permissions: ['invoice.manage'],
      functionAreas: ['ADMIN'],
      accessMode: 'mutate',
    })
  ).toBe('denied');

  expect(
    getRiaDataAccessDecision({
      line: 'ai',
      role: 'MANAGER',
      permissions: ['invoice.manage'],
      functionAreas: ['ADMIN'],
      accessMode: 'read',
    })
  ).toBe('allowed');

  expect(
    getRiaDataAccessDecision({
      line: 'ai',
      role: 'MANAGER',
      permissions: ['invoice.manage'],
      functionAreas: ['ADMIN'],
      accessMode: 'mutate',
    })
  ).toBe('denied');

  expect(
    getRiaDataAccessDecision({
      line: 'admin',
      role: 'OWNER',
      permissions: ['admin.manage'],
      functionAreas: ['ADMIN'],
      accessMode: 'advise',
    })
  ).toBe('allowed');

  expect(
    getRiaDataAccessDecision({
      line: 'admin',
      role: 'OWNER',
      permissions: ['admin.manage'],
      functionAreas: ['ADMIN'],
      accessMode: 'execute',
    })
  ).toBe('denied');

  expect(getRiaDeniedMessage('scan', 'mutate')).toBe('AI/RIA mag alleen adviseren en niets wijzigen.');
  expect(getRiaDeniedMessage('transport', 'execute')).toBe('AI/RIA mag alleen adviseren en niets wijzigen.');
  expect(getRiaDeniedMessage('invoice')).toBe('Dit valt buiten je bevoegdheid. Vraag een bevoegde persoon.');
});

test('invoice concept review keeps payment, mail and invoice number untouched', () => {
  const draft = createInvoiceConcept('FC-2026-001');

  expect(draft.reference).toBe('FC-2026-001');
  expect(draft.customerLabel).toBe('wacht op bedrijfscontrole');
  expect(draft.sourceLabel).toBe('transportbevestiging');
  expect(draft.statusLabel).toBe('concept');
  expect(draft.amountLabel).toBe('nog te bepalen');
  expect(draft.paymentStatusLabel).toBe('niet gestart');
  expect(draft.mailStatusLabel).toBe('nog niet verzonden');
  expect(draft.controlStatusLabel).toBe('vereist');
  expect(draft.invoiceNumberStatusLabel).toBe('nog niet toegewezen');

  const reviewed = reviewInvoiceConcept(draft);

  expect(reviewed.statusLabel).toBe('gecontroleerd');
  expect(reviewed.controlStatusLabel).toBe('bevestigd');
  expect(reviewed.paymentStatusLabel).toBe('niet gestart');
  expect(reviewed.mailStatusLabel).toBe('nog niet verzonden');
  expect(reviewed.invoiceNumberStatusLabel).toBe('nog niet toegewezen');
});

test('invoice number can only be assigned after concept review', () => {
  const draft = createInvoiceConcept('FC-2026-001');

  expect(canAssignInvoiceNumber(draft)).toBe(false);
  const blocked = assignInvoiceNumber(draft);
  expect(blocked.invoiceNumberStatusLabel).toBe('nog niet toegewezen');
  expect(blocked.invoiceNumberLabel).toBe('nog niet toegewezen');
  expect(blocked.paymentStatusLabel).toBe('niet gestart');
  expect(blocked.mailStatusLabel).toBe('nog niet verzonden');

  const reviewed = reviewInvoiceConcept(draft);
  expect(canAssignInvoiceNumber(reviewed)).toBe(true);

  const assigned = assignInvoiceNumber(reviewed);
  expect(assigned.invoiceNumberStatusLabel).toBe('toegewezen');
  expect(assigned.invoiceNumberLabel).toBe('TAZE-CONCEPT-0001');
  expect(assigned.paymentStatusLabel).toBe('niet gestart');
  expect(assigned.mailStatusLabel).toBe('nog niet verzonden');
});

test('invoice payment and mail prep unlock only after invoice number assignment', () => {
  const draft = createInvoiceConcept('FC-2026-001');
  const reviewed = reviewInvoiceConcept(draft);
  const assigned = assignInvoiceNumber(reviewed);

  expect(canPrepareInvoicePaymentStatus(draft)).toBe(false);
  expect(canPrepareInvoicePaymentStatus(reviewed)).toBe(false);
  expect(canPrepareInvoicePaymentStatus(assigned)).toBe(true);

  const paymentBlocked = prepareInvoicePaymentStatus(reviewed);
  expect(paymentBlocked.paymentStatusLabel).toBe('niet gestart');
  expect(paymentBlocked.stripeStatusLabel).toBe('Stripe nog niet gekoppeld');
  expect(paymentBlocked.mailStatusLabel).toBe('nog niet verzonden');

  const paymentPrepared = prepareInvoicePaymentStatus(assigned);
  expect(paymentPrepared.paymentStatusLabel).toBe('Klaar voor betaling');
  expect(paymentPrepared.stripeStatusLabel).toBe('Stripe nog niet gekoppeld');
  expect(paymentPrepared.mailStatusLabel).toBe('nog niet verzonden');

  expect(canQueueInvoiceCustomerMail(reviewed)).toBe(false);
  expect(canQueueInvoiceCustomerMail(assigned)).toBe(false);
  expect(canQueueInvoiceCustomerMail(paymentPrepared)).toBe(true);

  const mailBlocked = queueInvoiceCustomerMail(assigned);
  expect(mailBlocked.mailStatusLabel).toBe('nog niet verzonden');
  expect(mailBlocked.paymentStatusLabel).toBe('niet gestart');

  const mailQueued = queueInvoiceCustomerMail(paymentPrepared);
  expect(mailQueued.mailStatusLabel).toBe('Klaar voor verzending');
  expect(mailQueued.paymentStatusLabel).toBe('Klaar voor betaling');
  expect(mailQueued.stripeStatusLabel).toBe('Stripe nog niet gekoppeld');
});

test('final invoice control unlocks only after all preparation steps', () => {
  const draft = createInvoiceConcept('FC-2026-001');
  expect(canRunFinalInvoiceControl(draft)).toBe(false);

  const reviewed = reviewInvoiceConcept(draft);
  expect(canRunFinalInvoiceControl(reviewed)).toBe(false);

  const assigned = assignInvoiceNumber(reviewed);
  expect(canRunFinalInvoiceControl(assigned)).toBe(false);

  const paymentPrepared = prepareInvoicePaymentStatus(assigned);
  expect(canRunFinalInvoiceControl(paymentPrepared)).toBe(false);

  const mailQueuedTooEarly = queueInvoiceCustomerMail(assigned);
  expect(canRunFinalInvoiceControl(mailQueuedTooEarly)).toBe(false);

  const mailQueued = queueInvoiceCustomerMail(paymentPrepared);
  expect(canRunFinalInvoiceControl(mailQueued)).toBe(true);

  const finalBlocked = runFinalInvoiceControl(assigned);
  expect(finalBlocked.executionStatusLabel).toBe('nog niet klaar');
  expect(finalBlocked.lastControlStatusLabel).toBe('nog niet uitgevoerd');

  const finalReady = runFinalInvoiceControl(mailQueued);
  expect(finalReady.executionStatusLabel).toBe('klaar voor uitvoering');
  expect(finalReady.lastControlStatusLabel).toBe('uitgevoerd');
  expect(finalReady.paymentStatusLabel).toBe('Klaar voor betaling');
  expect(finalReady.invoiceNumberLabel).toBe('TAZE-CONCEPT-0001');
  expect(finalReady.stripeStatusLabel).toBe('Stripe nog niet gekoppeld');
  expect(finalReady.mailStatusLabel).toBe('Klaar voor verzending');
  expect(finalReady.dispatchStatusLabel).toBe('nog niet uitgevoerd');
});

test('host access rules keep public, app, invoice, scan and admin surfaces separated', () => {
  expect(
    resolveHostAccess({
      hostSurface: 'public',
      pathname: '/',
      ready: true,
      email: null,
      role: null,
      activeMembershipStatus: null,
      permissions: [],
      functions: [],
    }).status
  ).toBe('allow');

  expect(
    resolveHostAccess({
      hostSurface: 'app',
      pathname: '/',
      ready: true,
      email: null,
      role: null,
      activeMembershipStatus: null,
      permissions: [],
      functions: [],
    })
  ).toMatchObject({
    status: 'unauthorized',
    statusCode: 401,
    reason: 'login_required',
  });

  expect(
    resolveHostAccess({
      hostSurface: 'app',
      pathname: '/account',
      ready: true,
      email: null,
      role: null,
      activeMembershipStatus: null,
      permissions: [],
      functions: [],
  }).status
  ).toBe('allow');

  expect(
    resolveHostAccess({
      hostSurface: 'app',
      pathname: '/oauth/consent',
      ready: true,
      email: null,
      role: null,
      activeMembershipStatus: null,
      permissions: [],
      functions: [],
    }).status
  ).toBe('allow');

  expect(
    resolveHostAccess({
      hostSurface: 'invoice',
      pathname: '/',
      ready: true,
      email: null,
      role: null,
      activeMembershipStatus: null,
      permissions: [],
      functions: [],
    })
  ).toMatchObject({
    status: 'unauthorized',
    statusCode: 401,
    reason: 'login_required',
  });

  expect(
    resolveHostAccess({
      hostSurface: 'invoice',
      pathname: '/',
      ready: true,
      email: 'manager@taze.to',
      role: 'MANAGER',
      activeMembershipStatus: 'ACTIVE',
      permissions: ['invoice.manage'],
      functions: [],
    }).status
  ).toBe('allow');

  expect(
    resolveHostAccess({
      hostSurface: 'invoice',
      pathname: '/',
      ready: true,
      email: 'crew@taze.to',
      role: 'WERKVLOER',
      activeMembershipStatus: 'ACTIVE',
      permissions: [],
      functions: [],
    })
  ).toMatchObject({
    status: 'forbidden',
    statusCode: 403,
    reason: 'permission_required',
  });

  expect(
    resolveHostAccess({
      hostSurface: 'invoice',
      pathname: '/',
      ready: true,
      email: 'driver@taze.to',
      role: 'CHAUFFEUR',
      activeMembershipStatus: 'ACTIVE',
      permissions: ['delivery.update_status'],
      functions: ['DISTRIBUTIE'],
    })
  ).toMatchObject({
    status: 'forbidden',
    statusCode: 403,
    reason: 'permission_required',
  });

  expect(
    resolveHostAccess({
      hostSurface: 'transport',
      pathname: '/',
      ready: true,
      email: 'driver@taze.to',
      role: 'CHAUFFEUR',
      activeMembershipStatus: 'ACTIVE',
      permissions: ['delivery.update_status'],
      functions: ['DISTRIBUTIE'],
    }).status
  ).toBe('allow');

  expect(
    resolveHostAccess({
      hostSurface: 'transport',
      pathname: '/',
      ready: true,
      email: 'manager@taze.to',
      role: 'MANAGER',
      activeMembershipStatus: 'ACTIVE',
      permissions: ['transport.confirm_business_impact'],
      functions: ['DISTRIBUTIE'],
    }).status
  ).toBe('allow');

  expect(
    resolveHostAccess({
      hostSurface: 'transport',
      pathname: '/',
      ready: true,
      email: 'crew@taze.to',
      role: 'support',
      activeMembershipStatus: 'ACTIVE',
      permissions: [],
      functions: [],
    })
  ).toMatchObject({
    status: 'forbidden',
    statusCode: 403,
    reason: 'permission_required',
  });

  expect(
    resolveHostAccess({
      hostSurface: 'app',
      pathname: '/',
      ready: true,
      email: 'manager@taze.to',
      role: 'MANAGER',
      activeMembershipStatus: 'ACTIVE',
      permissions: ['inventory.read'],
      functions: [],
    }).status
  ).toBe('allow');

  expect(
    resolveHostAccess({
      hostSurface: 'app',
      pathname: '/',
      ready: true,
      email: 'manager@taze.to',
      role: 'MANAGER',
      activeMembershipStatus: 'INVITED',
      permissions: ['inventory.read'],
      functions: [],
    })
  ).toMatchObject({
    status: 'forbidden',
    statusCode: 403,
    reason: 'membership_required',
  });

  expect(
    resolveHostAccess({
      hostSurface: 'scan',
      pathname: '/',
      ready: true,
      email: 'crew@taze.to',
      role: 'support',
      activeMembershipStatus: 'ACTIVE',
      permissions: [],
      functions: [],
    })
  ).toMatchObject({
    status: 'forbidden',
    statusCode: 403,
    reason: 'permission_required',
  });

  expect(
    resolveHostAccess({
      hostSurface: 'scan',
      pathname: '/',
      ready: true,
      email: 'owner@taze.to',
      role: 'OWNER',
      activeMembershipStatus: 'ACTIVE',
      permissions: [],
      functions: [],
    }).status
  ).toBe('allow');

  expect(
    resolveHostAccess({
      hostSurface: 'scan',
      pathname: '/',
      ready: true,
      email: 'crew@taze.to',
      role: 'WERKVLOER',
      activeMembershipStatus: 'ACTIVE',
      permissions: ['inventory.read'],
      functions: [],
    }).status
  ).toBe('allow');

  expect(
    resolveHostAccess({
      hostSurface: 'scan',
      pathname: '/',
      ready: true,
      email: 'crew@taze.to',
      role: 'WERKVLOER',
      activeMembershipStatus: 'ACTIVE',
      permissions: [],
      functions: ['BAR'],
    }).status
  ).toBe('allow');

  expect(
    resolveHostAccess({
      hostSurface: 'admin',
      pathname: '/',
      ready: true,
      email: 'manager@taze.to',
      role: 'MANAGER',
      activeMembershipStatus: 'ACTIVE',
      permissions: [],
      functions: [],
    })
  ).toMatchObject({
    status: 'forbidden',
    statusCode: 403,
    reason: 'internal_admin_required',
  });

  expect(
    resolveHostAccess({
      hostSurface: 'admin',
      pathname: '/',
      ready: true,
      email: 'owner@taze.to',
      role: 'OWNER',
      activeMembershipStatus: 'ACTIVE',
      permissions: ['manage_devtools'],
      functions: ['ADMIN'],
    }).status
  ).toBe('allow');

  expect(
    resolveHostAccess({
      hostSurface: 'admin',
      pathname: '/',
      ready: true,
      email: 'owner@taze.to',
      role: 'OWNER',
      activeMembershipStatus: 'ACTIVE',
      permissions: ['admin.manage'],
      functions: ['ADMIN'],
    }).status
  ).toBe('allow');
});

test('scan shell helpers enforce permission and function-area access', () => {
  expect(canUseScanWorkspace({ permissions: ['inventory.read'], functions: [] })).toBe(true);
  expect(canUseScanWorkspace({ permissions: [], functions: ['BAR'] })).toBe(true);
  expect(canUseScanWorkspace({ permissions: [], functions: [] })).toBe(false);

  const barSuggestions = buildScanShellSuggestions(['BAR']);
  expect(barSuggestions[0]?.title).toBe('Barvoorstel');
  expect(barSuggestions[0]?.label).toBe('Interpretatie');
});

test('scan shell flow keeps manual entry available when camera or AI is unavailable', () => {
  const availability = buildScanShellAvailability({
    cameraAvailable: false,
    cameraPermissionGranted: false,
    aiAvailable: false,
  });

  expect(availability.manualEntryAvailable).toBe(true);
  expect(availability.cameraLabel).toContain('niet beschikbaar');
  expect(availability.aiLabel).toBe('AI niet beschikbaar');
});

test('scan observation stays draft until confirmed and missing company context blocks scanning', () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  expect(observation.status).toBe('draft');
  expect(observation.rawValue).toBe('8710400131474');
  expect(canCreateScanObservation({ companyId: null, branchId: 'branch_789', hasScanAccess: true })).toBe(false);
  expect(canCreateScanObservation({ companyId: 'company_456', branchId: null, hasScanAccess: true })).toBe(false);
});

test('ai unavailable still allows manual confirmation flow', () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'manual',
    rawValue: 'Halfvolle melk',
  });

  const recognition = buildScanRecognitionResult({
    observation,
    recognition: null,
    manualName: 'Halfvolle melk',
    aiUnavailableMessage: 'AI niet beschikbaar',
  });

  expect(recognition.provider).toBe('manual');
  expect(recognition.sourceLabel).toBe('AI niet beschikbaar');
  expect(recognition.error).toBe('AI niet beschikbaar');
});

test('ai recognition is labeled as a suggestion and not as fact', () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const recognition = buildScanRecognitionResult({
    observation,
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

  expect(recognition.sourceLabel).toMatch(/suggestie|voorstel|interpretatie/i);
  expect(recognition.provider).toBe('barcode');
});

test('workfloor scan creates pending approval for stock correction', () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const workfloorMembership = makeMembership({
    role: 'WERKVLOER',
    permissions: ['inventory.read', 'inventory.count', 'inventory.correct'],
    functions: ['BAR', 'KEUKEN'],
  });

  const action = buildPendingScanAction({
    observation,
    actionType: 'stock_correction',
    role: workfloorMembership.role,
    permissions: workfloorMembership.permissions,
    companyId: workfloorMembership.companyId,
    branchId: workfloorMembership.branchId,
    membershipId: workfloorMembership.id,
    functions: workfloorMembership.functions,
    sourceObservationLabel: 'Barcode · 8710400131474',
    recognitionLabel: 'Barcode-suggestie',
    observationStatus: 'confirmed',
  });

  const policy = buildInventoryPolicyDecision({
    actor: {
      companyId: workfloorMembership.companyId,
      branchId: workfloorMembership.branchId,
      membershipId: workfloorMembership.id,
      membershipStatus: workfloorMembership.status,
      role: workfloorMembership.role,
      permissions: workfloorMembership.permissions,
      functions: workfloorMembership.functions,
    },
    target: {
      companyId: observation.companyId,
      branchId: observation.branchId,
    },
    actionType: 'stock_correction',
    observationConfirmed: true,
    traceEventRecorded: false,
  });

  expect(action.status).toBe('pending_approval');
  expect(action.requiresApproval).toBe(true);
  expect(action.riskLevel).toBe('high');
  expect(getInventoryActionRiskLevel('stock_correction')).toBe('high');
  expect(getInventoryActionRiskLevel('manual_product_entry')).toBe('low');
  expect(getPendingScanActionStatusLabel(action.status)).toBe('Needs manager approval');
  expect(policy.requiresManagerApproval).toBe(true);
  expect(policy.canApprove).toBe(false);
});

test('low risk manual product entry can be applied immediately after trace', () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'manual',
    rawValue: 'Handmatige productinvoer',
  });

  const policy = buildInventoryPolicyDecision({
    actor: {
      companyId: 'company_456',
      branchId: 'branch_789',
      membershipId: 'membership_123',
      membershipStatus: 'ACTIVE',
      role: 'WERKVLOER',
      permissions: ['inventory.read', 'inventory.create'],
      functions: ['MAGAZIJN'],
    },
    target: {
      companyId: observation.companyId,
      branchId: observation.branchId,
    },
    actionType: 'manual_product_entry',
    observationConfirmed: true,
    traceEventRecorded: true,
  });

  expect(policy.riskLevel).toBe('low');
  expect(policy.canApplyImmediately).toBe(true);
  expect(policy.requiresManagerApproval).toBe(false);
  expect(
    canApplyInventoryMutation({
      decision: policy,
      observationConfirmed: true,
      traceEventRecorded: true,
      approvalStatus: 'pending_confirmation',
    })
  ).toBe(true);
});

test('manager can approve branch-scoped pending action', () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const managerMembership = makeMembership({
    role: 'MANAGER',
    permissions: ['inventory.update', 'inventory.correct', 'delivery.confirm', 'ai.suggestion.approve'],
    functions: ['BAR', 'KEUKEN', 'MAGAZIJN'],
  });

  const policy = buildInventoryPolicyDecision({
    actor: {
      companyId: managerMembership.companyId,
      branchId: managerMembership.branchId,
      membershipId: managerMembership.id,
      membershipStatus: managerMembership.status,
      role: managerMembership.role,
      permissions: managerMembership.permissions,
      functions: managerMembership.functions,
    },
    target: {
      companyId: observation.companyId,
      branchId: observation.branchId,
    },
    actionType: 'count_stock',
    observationConfirmed: true,
    traceEventRecorded: true,
  });

  expect(policy.requiresManagerApproval).toBe(true);
  expect(policy.canApprove).toBe(true);
  expect(policy.canReject).toBe(true);
  expect(policy.canRequestMoreContext).toBe(true);
});

test('manager cannot approve action outside branch or function scope', () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_999',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const managerMembership = makeMembership({
    role: 'MANAGER',
    permissions: ['inventory.update', 'inventory.correct'],
    functions: ['BAR'],
    branchId: 'branch_789',
  });

  const policy = buildInventoryPolicyDecision({
    actor: {
      companyId: managerMembership.companyId,
      branchId: managerMembership.branchId,
      membershipId: managerMembership.id,
      membershipStatus: managerMembership.status,
      role: managerMembership.role,
      permissions: managerMembership.permissions,
      functions: managerMembership.functions,
    },
    target: {
      companyId: observation.companyId,
      branchId: observation.branchId,
    },
    actionType: 'stock_correction',
    observationConfirmed: true,
    traceEventRecorded: true,
  });

  expect(policy.canApprove).toBe(false);
  expect(policy.canReject).toBe(false);
  expect(policy.reason).toMatch(/scope|functie/i);
});

test('owner can approve company-scoped pending action', () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const ownerMembership = makeMembership({
    role: 'OWNER',
    permissions: ['inventory.update', 'inventory.correct', 'inventory.delete', 'delivery.confirm', 'billing.manage'],
    functions: ['ADMIN', 'BAR', 'KEUKEN', 'MAGAZIJN', 'DISTRIBUTIE'],
  });

  const policy = buildInventoryPolicyDecision({
    actor: {
      companyId: ownerMembership.companyId,
      branchId: ownerMembership.branchId,
      membershipId: ownerMembership.id,
      membershipStatus: ownerMembership.status,
      role: ownerMembership.role,
      permissions: ownerMembership.permissions,
      functions: ownerMembership.functions,
    },
    target: {
      companyId: observation.companyId,
      branchId: observation.branchId,
    },
    actionType: 'receive_delivery',
    observationConfirmed: true,
    traceEventRecorded: true,
  });

  expect(policy.requiresManagerApproval).toBe(true);
  expect(policy.canApprove).toBe(true);
  expect(policy.canReject).toBe(true);
});

test('chauffeur can report delivery status but cannot alter kitchen stock', () => {
  const deliveryMembership = makeMembership({
    role: 'CHAUFFEUR',
    permissions: ['inventory.read', 'delivery.update_status'],
    functions: ['DISTRIBUTIE'],
  });

  const deliveryPolicy = buildInventoryPolicyDecision({
    actor: {
      companyId: deliveryMembership.companyId,
      branchId: deliveryMembership.branchId,
      membershipId: deliveryMembership.id,
      membershipStatus: deliveryMembership.status,
      role: deliveryMembership.role,
      permissions: deliveryMembership.permissions,
      functions: deliveryMembership.functions,
    },
    target: {
      companyId: deliveryMembership.companyId,
      branchId: deliveryMembership.branchId,
    },
    actionType: 'receive_delivery',
    observationConfirmed: true,
    traceEventRecorded: true,
  });

  const kitchenPolicy = buildInventoryPolicyDecision({
    actor: {
      companyId: deliveryMembership.companyId,
      branchId: deliveryMembership.branchId,
      membershipId: deliveryMembership.id,
      membershipStatus: deliveryMembership.status,
      role: deliveryMembership.role,
      permissions: deliveryMembership.permissions,
      functions: deliveryMembership.functions,
    },
    target: {
      companyId: deliveryMembership.companyId,
      branchId: deliveryMembership.branchId,
    },
    actionType: 'stock_correction',
    observationConfirmed: true,
    traceEventRecorded: true,
  });

  expect(deliveryPolicy.canApprove).toBe(false);
  expect(deliveryPolicy.requiresManagerApproval).toBe(true);
  expect(kitchenPolicy.canApprove).toBe(false);
  expect(kitchenPolicy.requiresManagerApproval).toBe(true);
});

test('ai cannot approve or apply inventory actions', () => {
  const aiPolicy = buildInventoryPolicyDecision({
    actor: {
      companyId: 'company_456',
      branchId: 'branch_789',
      membershipId: 'membership_123',
      membershipStatus: 'ACTIVE',
      role: 'MANAGER',
      permissions: ['inventory.update'],
      functions: ['BAR'],
      actorKind: 'ai',
    },
    target: {
      companyId: 'company_456',
      branchId: 'branch_789',
    },
    actionType: 'stock_correction',
    observationConfirmed: true,
    traceEventRecorded: true,
  });

  expect(aiPolicy.canApprove).toBe(false);
  expect(aiPolicy.canApplyImmediately).toBe(false);
  expect(aiPolicy.reason).toMatch(/AI/);
});

test('internal taze roles cannot bypass customer policy without support mode', () => {
  const internalPolicy = buildInventoryPolicyDecision({
    actor: {
      companyId: 'company_456',
      branchId: 'branch_789',
      membershipId: 'membership_123',
      membershipStatus: 'ACTIVE',
      role: 'support',
      permissions: ['manage_devtools', 'inventory.update'],
      functions: ['ADMIN'],
      actorKind: 'internal',
      supportMode: false,
    },
    target: {
      companyId: 'company_456',
      branchId: 'branch_789',
    },
    actionType: 'stock_correction',
    observationConfirmed: true,
    traceEventRecorded: true,
  });

  expect(internalPolicy.canApprove).toBe(false);
  expect(internalPolicy.reason).toMatch(/support mode/i);
});

test('internal taze roles can approve in logged support mode', () => {
  const internalPolicy = buildInventoryPolicyDecision({
    actor: {
      companyId: 'company_456',
      branchId: 'branch_789',
      membershipId: 'membership_123',
      membershipStatus: 'ACTIVE',
      role: 'support',
      permissions: ['manage_devtools', 'inventory.correct'],
      functions: ['BAR'],
      actorKind: 'internal',
      supportMode: true,
    },
    target: {
      companyId: 'company_456',
      branchId: 'branch_789',
    },
    actionType: 'stock_correction',
    observationConfirmed: true,
    traceEventRecorded: true,
  });

  expect(internalPolicy.canApprove).toBe(true);
  expect(internalPolicy.canReject).toBe(true);
  expect(internalPolicy.reason).toMatch(/Support mode/i);
});

test('inventory mutation fails without confirmed observation', () => {
  const policy = buildInventoryPolicyDecision({
    actor: {
      companyId: 'company_456',
      branchId: 'branch_789',
      membershipId: 'membership_123',
      membershipStatus: 'ACTIVE',
      role: 'MANAGER',
      permissions: ['inventory.update', 'inventory.correct'],
      functions: ['BAR', 'KEUKEN'],
    },
    target: {
      companyId: 'company_456',
      branchId: 'branch_789',
    },
    actionType: 'stock_correction',
    observationConfirmed: true,
    traceEventRecorded: true,
  });

  expect(
    canApplyInventoryMutation({
      decision: policy,
      observationConfirmed: false,
      traceEventRecorded: true,
      approvalStatus: 'approved',
    })
  ).toBe(false);
});

test('inventory mutation fails without trace event', () => {
  const policy = buildInventoryPolicyDecision({
    actor: {
      companyId: 'company_456',
      branchId: 'branch_789',
      membershipId: 'membership_123',
      membershipStatus: 'ACTIVE',
      role: 'MANAGER',
      permissions: ['inventory.update', 'inventory.correct'],
      functions: ['BAR', 'KEUKEN'],
    },
    target: {
      companyId: 'company_456',
      branchId: 'branch_789',
    },
    actionType: 'stock_correction',
    observationConfirmed: true,
    traceEventRecorded: true,
  });

  expect(
    canApplyInventoryMutation({
      decision: policy,
      observationConfirmed: true,
      traceEventRecorded: false,
      approvalStatus: 'approved',
    })
  ).toBe(false);
});

test('cross-company pending action approval is blocked', () => {
  const policy = buildInventoryPolicyDecision({
    actor: {
      companyId: 'company_456',
      branchId: 'branch_789',
      membershipId: 'membership_123',
      membershipStatus: 'ACTIVE',
      role: 'OWNER',
      permissions: ['inventory.update', 'inventory.correct'],
      functions: ['ADMIN', 'BAR', 'KEUKEN'],
    },
    target: {
      companyId: 'company_other',
      branchId: 'branch_other',
    },
    actionType: 'stock_correction',
    observationConfirmed: true,
    traceEventRecorded: true,
  });

  expect(policy.canApprove).toBe(false);
  expect(policy.reason).toMatch(/Cross-company/i);
});

test('rejection appends a trace event', () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const recognition = buildScanRecognitionResult({
    observation,
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

  const action = buildPendingScanAction({
    observation,
    actionType: 'stock_correction',
    role: 'MANAGER',
    permissions: ['inventory.update', 'inventory.correct'],
    companyId: observation.companyId,
    branchId: observation.branchId,
    membershipId: observation.membershipId,
    functions: ['BAR', 'KEUKEN'],
    sourceObservationLabel: 'Barcode · 8710400131474',
    recognitionLabel: 'Barcode-suggestie',
    observationStatus: 'confirmed',
  });

  const traceEvent = buildScanTraceEvent({
    observation,
    recognition,
    pendingAction: { ...action, status: 'rejected' },
    companyId: observation.companyId,
    branchId: observation.branchId,
    userId: observation.userId,
    membershipId: observation.membershipId,
    state: 'action_rejected',
    note: 'Actie afgewezen door manager.',
  });

  const record = toTraceEventRecord(traceEvent);

  expect(record.note).toContain('action_rejected');
  expect(record.note).toContain('Actie afgewezen');
});

test('request-more-context appends a trace event', () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const recognition = buildScanRecognitionResult({
    observation,
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

  const action = buildPendingScanAction({
    observation,
    actionType: 'stock_correction',
    role: 'MANAGER',
    permissions: ['inventory.update', 'inventory.correct'],
    companyId: observation.companyId,
    branchId: observation.branchId,
    membershipId: observation.membershipId,
    functions: ['BAR', 'KEUKEN'],
    sourceObservationLabel: 'Barcode · 8710400131474',
    recognitionLabel: 'Barcode-suggestie',
    observationStatus: 'confirmed',
  });

  const traceEvent = buildScanTraceEvent({
    observation,
    recognition,
    pendingAction: action,
    companyId: observation.companyId,
    branchId: observation.branchId,
    userId: observation.userId,
    membershipId: observation.membershipId,
    state: 'action_context_requested',
    note: 'Meer context gevraagd door manager.',
  });

  const record = toTraceEventRecord(traceEvent);

  expect(record.note).toContain('action_context_requested');
  expect(record.note).toContain('Meer context gevraagd');
});

test('approved manager action creates stock movement and trace reference', async () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const managerMembership = makeMembership({
    role: 'MANAGER',
    permissions: ['inventory.update', 'inventory.correct', 'stockmovement.create'],
    functions: ['BAR', 'KEUKEN'],
  });

  const pendingAction = buildPendingScanAction({
    observation,
    actionType: 'stock_correction',
    role: managerMembership.role,
    permissions: managerMembership.permissions,
    companyId: managerMembership.companyId,
    branchId: managerMembership.branchId,
    membershipId: managerMembership.id,
    functions: managerMembership.functions,
    sourceObservationLabel: 'Barcode · 8710400131474',
    recognitionLabel: 'Barcode-suggestie',
    observationStatus: 'confirmed',
  });

  const action = { ...pendingAction, status: 'approved' as const };
  const context = makeMutationContext(managerMembership);
  const traceEvent = makeMutationTraceEvent(context, action);
  const validation = validateMutationPreconditions(context, action, { traceEvent, requireTraceEvent: true });
  const result = await applyInventoryMutation(context, action, traceEvent);

  expect(validation.ok).toBe(true);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.safeMessage);
  }

  expect(result.appliedAction.status).toBe('applied');
  expect(result.movement.traceEventId).toBe(traceEvent.id);
  expect(result.movement.movementType).toBe('count_adjustment');
  expect(result.movement.source).toBe('manager_approval');
  expect(result.movement.companyId).toBe(managerMembership.companyId);
  expect(result.movement.branchId).toBe(managerMembership.branchId);
  expect(buildInventoryMovement(context, action, traceEvent).traceEventId).toBe(traceEvent.id);
});

test('workfloor high-risk action cannot apply directly', async () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const workfloorMembership = makeMembership({
    role: 'WERKVLOER',
    permissions: ['inventory.read', 'inventory.correct', 'inventory.count'],
    functions: ['BAR'],
  });

  const action = buildPendingScanAction({
    observation,
    actionType: 'stock_correction',
    role: workfloorMembership.role,
    permissions: workfloorMembership.permissions,
    companyId: workfloorMembership.companyId,
    branchId: workfloorMembership.branchId,
    membershipId: workfloorMembership.id,
    functions: workfloorMembership.functions,
    sourceObservationLabel: 'Barcode · 8710400131474',
    recognitionLabel: 'Barcode-suggestie',
    observationStatus: 'confirmed',
  });

  const context = makeMutationContext(workfloorMembership);
  const traceEvent = makeMutationTraceEvent(context, { ...action, status: 'pending_approval' as const });
  const result = await applyInventoryMutation(context, action, traceEvent);

  expect(canMutateInventory(context, action)).toBe(false);
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error('Expected workfloor high-risk mutation to be blocked');
  }
  expect(result.errorCode).toBe('missing_approval');
});

test('owner can apply company-scoped approved action', async () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const ownerMembership = makeMembership({
    role: 'OWNER',
    permissions: ['inventory.update', 'inventory.correct', 'inventory.delete', 'stockmovement.create'],
    functions: ['ADMIN', 'BAR', 'KEUKEN', 'MAGAZIJN', 'DISTRIBUTIE'],
  });

  const pendingAction = buildPendingScanAction({
    observation,
    actionType: 'stock_correction',
    role: ownerMembership.role,
    permissions: ownerMembership.permissions,
    companyId: ownerMembership.companyId,
    branchId: ownerMembership.branchId,
    membershipId: ownerMembership.id,
    functions: ownerMembership.functions,
    sourceObservationLabel: 'Barcode · 8710400131474',
    recognitionLabel: 'Barcode-suggestie',
    observationStatus: 'confirmed',
  });

  const action = { ...pendingAction, status: 'approved' as const };
  const context = makeMutationContext(ownerMembership);
  const traceEvent = makeMutationTraceEvent(context, action);
  const result = await applyInventoryMutation(context, action, traceEvent);

  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.safeMessage);
  }

  expect(result.movement.source).toBe('owner_approval');
  expect(result.appliedAction.status).toBe('applied');
});

test('chauffeur cannot apply kitchen stock mutation', async () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const chauffeurMembership = makeMembership({
    role: 'CHAUFFEUR',
    permissions: ['inventory.read', 'delivery.update_status'],
    functions: ['DISTRIBUTIE'],
  });

  const action = buildPendingScanAction({
    observation,
    actionType: 'stock_correction',
    role: chauffeurMembership.role,
    permissions: chauffeurMembership.permissions,
    companyId: chauffeurMembership.companyId,
    branchId: chauffeurMembership.branchId,
    membershipId: chauffeurMembership.id,
    functions: chauffeurMembership.functions,
    sourceObservationLabel: 'Barcode · 8710400131474',
    recognitionLabel: 'Barcode-suggestie',
    observationStatus: 'confirmed',
  });

  const context = makeMutationContext(chauffeurMembership);
  const traceEvent = makeMutationTraceEvent(context, { ...action, status: 'approved' as const });
  const result = await applyInventoryMutation(context, action, traceEvent);

  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error('Expected chauffeur kitchen mutation to be blocked');
  }
  expect(result.errorCode).toBe('missing_permission');
  expect(result.safeMessage).toMatch(/permissie/i);
});

test('manager can apply approved delivery-related mutation inside delivery scope', async () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const managerMembership = makeMembership({
    role: 'MANAGER',
    permissions: ['inventory.read', 'delivery.confirm'],
    functions: ['DISTRIBUTIE', 'MAGAZIJN'],
  });

  const pendingAction = buildPendingScanAction({
    observation,
    actionType: 'receive_delivery',
    role: managerMembership.role,
    permissions: managerMembership.permissions,
    companyId: managerMembership.companyId,
    branchId: managerMembership.branchId,
    membershipId: managerMembership.id,
    functions: managerMembership.functions,
    sourceObservationLabel: 'Leveringsobservatie',
    recognitionLabel: 'Leveringssuggestie',
    observationStatus: 'confirmed',
  });

  const action = { ...pendingAction, status: 'approved' as const };
  const context = makeMutationContext(managerMembership);
  const traceEvent = makeMutationTraceEvent(context, action);
  const result = await applyInventoryMutation(context, action, traceEvent);

  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.safeMessage);
  }

  expect(result.movement.movementType).toBe('delivery_receive');
  expect(result.movement.source).toBe('manager_approval');
  expect(result.appliedAction.status).toBe('applied');
});

test('ai cannot apply inventory mutation', async () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const managerMembership = makeMembership({
    role: 'MANAGER',
    permissions: ['inventory.update', 'inventory.correct'],
    functions: ['BAR'],
  });

  const action = buildPendingScanAction({
    observation,
    actionType: 'stock_correction',
    role: managerMembership.role,
    permissions: managerMembership.permissions,
    companyId: managerMembership.companyId,
    branchId: managerMembership.branchId,
    membershipId: managerMembership.id,
    functions: managerMembership.functions,
    sourceObservationLabel: 'Barcode · 8710400131474',
    recognitionLabel: 'Barcode-suggestie',
    observationStatus: 'confirmed',
  });

  const context = makeMutationContext(managerMembership, { actorKind: 'ai' });
  const traceEvent = makeMutationTraceEvent(context, { ...action, status: 'approved' as const });
  const result = await applyInventoryMutation(context, action, traceEvent);

  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error('Expected AI mutation to be blocked');
  }
  expect(result.errorCode).toBe('ai_blocked');
});

test('mutation fails without confirmed observation', async () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const managerMembership = makeMembership({
    role: 'MANAGER',
    permissions: ['inventory.update', 'inventory.correct'],
    functions: ['BAR', 'KEUKEN'],
  });

  const pendingAction = buildPendingScanAction({
    observation,
    actionType: 'stock_correction',
    role: managerMembership.role,
    permissions: managerMembership.permissions,
    companyId: managerMembership.companyId,
    branchId: managerMembership.branchId,
    membershipId: managerMembership.id,
    functions: managerMembership.functions,
    sourceObservationLabel: 'Barcode · 8710400131474',
    recognitionLabel: 'Barcode-suggestie',
    observationStatus: 'draft',
  });

  const action = { ...pendingAction, status: 'approved' as const, observationStatus: 'draft' as const };
  const context = makeMutationContext(managerMembership);
  const traceEvent = makeMutationTraceEvent(context, action);
  const result = await applyInventoryMutation(context, action, traceEvent);

  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error('Expected missing observation confirmation to block mutation');
  }
  expect(result.errorCode).toBe('missing_confirmed_observation');
});

test('mutation fails without approval for medium or high risk', async () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const managerMembership = makeMembership({
    role: 'MANAGER',
    permissions: ['inventory.update', 'inventory.correct'],
    functions: ['BAR', 'KEUKEN'],
  });

  const pendingAction = buildPendingScanAction({
    observation,
    actionType: 'stock_correction',
    role: managerMembership.role,
    permissions: managerMembership.permissions,
    companyId: managerMembership.companyId,
    branchId: managerMembership.branchId,
    membershipId: managerMembership.id,
    functions: managerMembership.functions,
    sourceObservationLabel: 'Barcode · 8710400131474',
    recognitionLabel: 'Barcode-suggestie',
    observationStatus: 'confirmed',
  });

  const context = makeMutationContext(managerMembership);
  const traceEvent = makeMutationTraceEvent(context, { ...pendingAction, status: 'pending_approval' as const });
  const result = await applyInventoryMutation(context, pendingAction, traceEvent);

  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error('Expected unapproved high-risk action to be blocked');
  }
  expect(result.errorCode).toBe('missing_approval');
});

test('mutation fails without trace event', async () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const managerMembership = makeMembership({
    role: 'MANAGER',
    permissions: ['inventory.update', 'inventory.correct'],
    functions: ['BAR', 'KEUKEN'],
  });

  const pendingAction = buildPendingScanAction({
    observation,
    actionType: 'stock_correction',
    role: managerMembership.role,
    permissions: managerMembership.permissions,
    companyId: managerMembership.companyId,
    branchId: managerMembership.branchId,
    membershipId: managerMembership.id,
    functions: managerMembership.functions,
    sourceObservationLabel: 'Barcode · 8710400131474',
    recognitionLabel: 'Barcode-suggestie',
    observationStatus: 'confirmed',
  });

  const action = { ...pendingAction, status: 'approved' as const };
  const context = makeMutationContext(managerMembership);
  const result = await applyInventoryMutation(context, action, null);

  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error('Expected mutation without trace event to fail');
  }
  expect(result.errorCode).toBe('missing_trace_event');
});

test('cross-company mutation is blocked', async () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const managerMembership = makeMembership({
    role: 'MANAGER',
    permissions: ['inventory.update', 'inventory.correct'],
    functions: ['BAR', 'KEUKEN'],
  });

  const action = {
    ...buildPendingScanAction({
      observation,
      actionType: 'stock_correction',
      role: managerMembership.role,
      permissions: managerMembership.permissions,
      companyId: managerMembership.companyId,
      branchId: managerMembership.branchId,
      membershipId: managerMembership.id,
      functions: managerMembership.functions,
      sourceObservationLabel: 'Barcode · 8710400131474',
      recognitionLabel: 'Barcode-suggestie',
      observationStatus: 'confirmed',
    }),
    companyId: 'company_other',
    status: 'approved' as const,
  };

  const context = makeMutationContext(managerMembership);
  const traceEvent = makeMutationTraceEvent(context, action);
  const result = await applyInventoryMutation(context, action, traceEvent);

  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error('Expected cross-company mutation to be blocked');
  }
  expect(result.errorCode).toBe('wrong_company_scope');
});

test('duplicate mutation is blocked after first application', async () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const ownerMembership = makeMembership({
    role: 'OWNER',
    permissions: ['inventory.update', 'inventory.correct', 'inventory.delete', 'stockmovement.create'],
    functions: ['ADMIN', 'BAR', 'KEUKEN'],
  });

  const pendingAction = buildPendingScanAction({
    observation,
    actionType: 'stock_correction',
    role: ownerMembership.role,
    permissions: ownerMembership.permissions,
    companyId: ownerMembership.companyId,
    branchId: ownerMembership.branchId,
    membershipId: ownerMembership.id,
    functions: ownerMembership.functions,
    sourceObservationLabel: 'Barcode · 8710400131474',
    recognitionLabel: 'Barcode-suggestie',
    observationStatus: 'confirmed',
  });

  const action = { ...pendingAction, status: 'approved' as const };
  const context = makeMutationContext(ownerMembership);
  const firstTraceEvent = makeMutationTraceEvent(context, action);
  const firstResult = await applyInventoryMutation(context, action, firstTraceEvent);

  expect(firstResult.ok).toBe(true);
  if (!firstResult.ok) {
    throw new Error(firstResult.safeMessage);
  }

  const duplicateTraceEvent = makeMutationTraceEvent(context, action);
  const duplicateResult = await applyInventoryMutation(context, action, duplicateTraceEvent);

  expect(duplicateResult.ok).toBe(false);
  if (duplicateResult.ok) {
    throw new Error('Expected duplicate mutation to be blocked');
  }
  expect(duplicateResult.errorCode).toBe('already_applied');
});

test('insufficient permission returns a safe error', async () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const limitedMembership = makeMembership({
    role: 'MANAGER',
    permissions: ['inventory.read'],
    functions: ['BAR', 'KEUKEN'],
  });

  const pendingAction = buildPendingScanAction({
    observation,
    actionType: 'remove_inventory',
    role: limitedMembership.role,
    permissions: limitedMembership.permissions,
    companyId: limitedMembership.companyId,
    branchId: limitedMembership.branchId,
    membershipId: limitedMembership.id,
    functions: ['DISTRIBUTIE'],
    sourceObservationLabel: 'Barcode · 8710400131474',
    recognitionLabel: 'Barcode-suggestie',
    observationStatus: 'confirmed',
  });

  const action = { ...pendingAction, status: 'approved' as const };
  const context = makeMutationContext(limitedMembership);
  const traceEvent = makeMutationTraceEvent(context, action);
  const result = await applyInventoryMutation(context, action, traceEvent);

  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error('Expected missing permission to block mutation');
  }
  expect(result.errorCode).toBe('missing_permission');
  expect(result.safeMessage).toMatch(/permissie/i);
});

test('confirmed scan creates a trace event with company and branch context', () => {
  const observation = buildScanObservation({
    companyId: 'company_456',
    branchId: 'branch_789',
    userId: 'user_123',
    membershipId: 'membership_123',
    source: 'barcode',
    rawValue: '8710400131474',
  });

  const recognition = buildScanRecognitionResult({
    observation,
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

  const action = buildPendingScanAction({
    observation,
    actionType: 'count_stock',
    role: 'MANAGER',
    permissions: ['inventory.update'],
  });

  const traceEvent = buildScanTraceEvent({
    observation,
    recognition,
    pendingAction: action,
    companyId: observation.companyId,
    branchId: observation.branchId,
    userId: observation.userId,
    membershipId: observation.membershipId,
    state: 'observation_confirmed',
    note: 'Observatie bevestigd door manager.',
  });

  const record = toTraceEventRecord(traceEvent);

  expect(record.location).toBe('branch_789');
  expect(record.toLocation).toBe('branch_789');
  expect(record.source).toBe('scan-shell');
  expect(record.itemName).toBe('Cola 33cl');
  expect(record.note).toContain('company=company_456');
  expect(record.note).toContain('observation=');
  expect(record.note).toContain('action=');
});

test('ai availability helper returns safe fallback copy for disabled modes', () => {
  expect(isRealAiDisabledError('openai_not_configured')).toBe(true);
  expect(isRealAiDisabledError('openai_auth_error')).toBe(true);
  expect(isRealAiDisabledError('openai_rate_limited')).toBe(false);
  expect(getRealAiUnavailableMessage('openai_not_configured')).toContain('niet bereikbaar');
  expect(getRealAiUnavailableMessage('openai_auth_error')).toContain('niet beschikbaar');
  expect(getRealAiUnavailableMessage('openai_unavailable')).toContain('scan- en routingflows');
});

test('root layout routing keeps api separated and normalizes public trailing slashes', () => {
  expect(normalizePathname('/privacy/')).toBe('/privacy');
  expect(normalizePathname('/privacy///')).toBe('/privacy');
  expect(normalizePathname('/')).toBe('/');

  expect(isPublicInfoRoute('/privacy/')).toBe(true);
  expect(isPublicInfoRoute('/support')).toBe(true);
  expect(isPublicInfoRoute('/scan')).toBe(false);

  expect(
    resolveRootLayoutSurface({
      hostSurface: 'api',
      pathname: '/',
      hostname: 'api.taze.to',
    })
  ).toBe('api-only');

  expect(
    resolveRootLayoutSurface({
      hostSurface: 'app',
      pathname: '/',
      hostname: 'app.taze.to',
    })
  ).toBe('app-protected');

  expect(
    resolveRootLayoutSurface({
      hostSurface: 'invoice',
      pathname: '/',
      hostname: 'invoice.taze.to',
    })
  ).toBe('invoice-protected');

  expect(
    resolveRootLayoutSurface({
      hostSurface: 'scan',
      pathname: '/',
      hostname: 'scan.taze.to',
    })
  ).toBe('scan-protected');

  expect(
    resolveRootLayoutSurface({
      hostSurface: 'transport',
      pathname: '/',
      hostname: 'transport.taze.to',
    })
  ).toBe('transport-protected');

  const scanSeo = getPageSeo('/', 'scan', null);
  expect(scanSeo.robots).toBe('noindex,nofollow');

  const transportSeo = getPageSeo('/', 'transport', null);
  expect(transportSeo.title).toBe('Taze | Transport en levering');
  expect(transportSeo.robots).toBe('noindex,nofollow');
  expect(getPageSeoUrl('/', 'transport', null)).toBe('https://transport.taze.to/');

  const invoiceSeo = getPageSeo('/', 'invoice', null);
  expect(invoiceSeo.title).toBe('Taze | Facturatielijn');
  expect(invoiceSeo.robots).toBe('noindex,nofollow');
  expect(getPageSeoUrl('/', 'invoice', null)).toBe('https://invoice.taze.to/');

  expect(
    resolveRootLayoutSurface({
      hostSurface: 'admin',
      pathname: '/',
      hostname: 'admin.taze.to',
    })
  ).toBe('admin-protected');

  expect(
    resolveRootLayoutSurface({
      hostSurface: 'public',
      pathname: '/privacy/',
      hostname: 'taze.to',
    })
  ).toBe('public-info');

  const privacySeo = getPageSeo('/privacy/', 'public', null);
  expect(privacySeo.title).toBe('Taze | Privacy en gegevens');
  expect(privacySeo.robots).toBe('index,follow');

  expect(
    resolveRootLayoutSurface({
      hostSurface: 'unknown',
      pathname: '/',
      hostname: 'localhost',
    })
  ).toBe('app-protected');

  expect(
    resolveRootLayoutSurface({
      hostSurface: 'unknown',
      pathname: '/',
      hostname: 'random.example.com',
    })
  ).toBe('blocked');

  const apiSeo = getPageSeo('/', 'api', null);
  expect(apiSeo.title).toBe('Taze | API endpoint');
  expect(apiSeo.robots).toBe('noindex,nofollow');
});
