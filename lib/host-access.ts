import { DomainConfig, type HostSurface } from 'lib/domain-config';
import {
  canConfirmTransportBusinessImpact,
  canManageAdminLine,
  canManageInvoiceLine,
  normalizeAppRole,
  roleHasPermission,
  type TenantFunctionArea,
} from 'lib/auth-model';
import { canUseScanWorkspace } from 'lib/scan-shell';
import { t, type AppLanguage } from 'lib/i18n';

export type HostAccessStatus = 'allow' | 'loading' | 'unauthorized' | 'forbidden';

export type HostAccessDecision = {
  status: HostAccessStatus;
  statusCode: 401 | 403 | null;
  title: string;
  message: string;
  reason:
    | 'public'
    | 'unknown'
    | 'account'
    | 'callback'
    | 'login_required'
    | 'membership_required'
    | 'permission_required'
    | 'internal_admin_required'
    | 'ready';
  primaryActionLabel: string | null;
  primaryActionHref: string | null;
  secondaryActionLabel: string | null;
  secondaryActionHref: string | null;
};

const ANONYMOUS_ALLOWED_PATHS = new Set(['/account', '/auth/callback', '/health', '/oauth/consent', '/readiness']);

function normalizePathname(pathname: string) {
  const trimmed = String(pathname ?? '').trim();
  if (!trimmed || trimmed === '/') {
    return '/';
  }

  return trimmed.replace(/\/+$/, '');
}

function buildDecision(
  decision: Omit<HostAccessDecision, 'reason' | 'statusCode' | 'primaryActionLabel' | 'primaryActionHref' | 'secondaryActionLabel' | 'secondaryActionHref'> & {
    reason: HostAccessDecision['reason'];
    statusCode: HostAccessDecision['statusCode'];
    primaryActionLabel?: string | null;
    primaryActionHref?: string | null;
    secondaryActionLabel?: string | null;
    secondaryActionHref?: string | null;
  }
): HostAccessDecision {
  return {
    status: decision.status,
    statusCode: decision.statusCode,
    title: decision.title,
    message: decision.message,
    reason: decision.reason,
    primaryActionLabel: decision.primaryActionLabel ?? null,
    primaryActionHref: decision.primaryActionHref ?? null,
    secondaryActionLabel: decision.secondaryActionLabel ?? null,
    secondaryActionHref: decision.secondaryActionHref ?? null,
  };
}

function loginDecision(hostSurface: HostSurface, language: AppLanguage = 'nl') {
  return buildDecision({
    status: 'unauthorized',
    statusCode: 401,
    reason: 'login_required',
    title:
      hostSurface === 'transport'
        ? 'Transport en levering'
        : hostSurface === 'platform'
          ? t('access.title.platform', language)
        : hostSurface === 'invoice'
          ? 'Facturatielijn'
          : hostSurface === 'ai'
            ? 'RIA / AI advieslijn'
          : t('access.title.required', language),
    message:
      hostSurface === 'platform'
        ? t('access.message.platformLogin', language)
        : hostSurface === 'scan'
        ? 'Log in met je Taze-account om de scanomgeving en bedrijfsinventaris te openen.'
        : hostSurface === 'transport'
          ? 'Log in met je Taze-account om de transportlijn te openen.'
          : hostSurface === 'invoice'
            ? 'Log in met je Taze-account om de facturatielijn te openen.'
            : hostSurface === 'ai'
              ? 'Log in met je Taze-account om de read-only AI/RIA advieslijn te openen. AI ondersteunt, de mens bevestigt.'
              : hostSurface === 'admin'
                ? 'Log in met je Taze-account om de interne beheeromgeving te openen.'
                : 'Log in met je Taze-account om je bedrijfsomgeving te openen.',
    primaryActionLabel: t('access.action.login', language),
    primaryActionHref: `${DomainConfig.appOrigin}/account`,
    secondaryActionLabel: t('access.action.public', language),
    secondaryActionHref: DomainConfig.publicOrigin,
  });
}

function forbiddenDecision(hostSurface: HostSurface, reason: HostAccessDecision['reason'], language: AppLanguage = 'nl') {
  return buildDecision({
    status: 'forbidden',
    statusCode: 403,
    reason,
    title:
      reason === 'internal_admin_required'
        ? t('access.title.noAdmin', language)
        : hostSurface === 'transport'
          ? t('access.title.noTransport', language)
          : hostSurface === 'invoice'
            ? t('access.title.noInvoice', language)
            : hostSurface === 'ai'
              ? t('access.title.noAi', language)
            : t('access.title.noAccess', language),
    message:
      hostSurface === 'admin'
        ? 'Alleen interne Taze beheerders mogen deze omgeving openen.'
        : hostSurface === 'platform'
          ? t('access.message.platformForbidden', language)
        : hostSurface === 'scan'
          ? 'Je account heeft nog geen scan- of functiegebiedsrechten voor deze omgeving.'
          : hostSurface === 'transport'
            ? 'Je bent ingelogd, maar hebt nog geen leverings- of transportrechten voor deze omgeving.'
          : hostSurface === 'invoice'
            ? 'Je bent ingelogd, maar hebt nog geen facturatierechten voor deze lijn.'
            : hostSurface === 'ai'
              ? 'Je bent ingelogd, maar hebt nog geen actieve bedrijfsmembership voor deze AI/RIA advieslijn.'
            : 'Je bent ingelogd, maar hebt nog geen actieve bedrijfsmembership voor deze omgeving.',
    primaryActionLabel: t('access.action.login', language),
    primaryActionHref: `${DomainConfig.appOrigin}/account`,
    secondaryActionLabel: t('access.action.public', language),
    secondaryActionHref: DomainConfig.publicOrigin,
  });
}

function allowedDecision(language: AppLanguage = 'nl'): HostAccessDecision {
  return buildDecision({
    status: 'allow',
    statusCode: null,
    reason: 'ready',
    title: t('access.title.ok', language),
    message: t('access.message.allowed', language),
    primaryActionLabel: null,
    primaryActionHref: null,
    secondaryActionLabel: null,
    secondaryActionHref: null,
  });
}

function loadingDecision(language: AppLanguage = 'nl'): HostAccessDecision {
  return buildDecision({
    status: 'loading',
    statusCode: null,
    reason: 'ready',
    title: t('access.title.required', language),
    message: t('access.message.loading', language),
    primaryActionLabel: null,
    primaryActionHref: null,
    secondaryActionLabel: null,
    secondaryActionHref: null,
  });
}

export function resolveHostAccess(params: {
  hostSurface: HostSurface;
  pathname: string;
  ready: boolean;
  email: string | null;
  role: string | null;
  activeMembershipStatus: string | null;
  permissions: string[];
  functions: TenantFunctionArea[];
  language?: AppLanguage;
}): HostAccessDecision {
  const pathname = normalizePathname(params.pathname);
  const hostSurface = params.hostSurface;
  const language = params.language ?? 'nl';

  if (hostSurface === 'public' || hostSurface === 'demo' || hostSurface === 'api' || hostSurface === 'unknown') {
    return allowedDecision(language);
  }

  if (!params.ready) {
    return loadingDecision(language);
  }

  if (hostSurface === 'app' && ANONYMOUS_ALLOWED_PATHS.has(pathname)) {
    return allowedDecision(language);
  }

  if (!params.email) {
    return loginDecision(hostSurface, language);
  }

  const normalizedRole = normalizeAppRole(params.role);

  if (hostSurface === 'admin') {
    if (canManageAdminLine(normalizedRole, params.permissions)) {
      return allowedDecision(language);
    }

    return forbiddenDecision(hostSurface, 'internal_admin_required', language);
  }

  if (params.activeMembershipStatus !== 'ACTIVE') {
    return forbiddenDecision(hostSurface, 'membership_required', language);
  }

  if (hostSurface === 'transport') {
    const canUseTransportSurface =
      roleHasPermission(normalizedRole, 'delivery.read', params.permissions) ||
      roleHasPermission(normalizedRole, 'delivery.update_status', params.permissions) ||
      roleHasPermission(normalizedRole, 'delivery.confirm', params.permissions) ||
      roleHasPermission(normalizedRole, 'delivery.reject', params.permissions) ||
      canConfirmTransportBusinessImpact(normalizedRole, params.permissions) ||
      params.functions.includes('DISTRIBUTIE');

    if (canUseTransportSurface) {
      return allowedDecision(language);
    }

    return forbiddenDecision(hostSurface, 'permission_required', language);
  }

  if (hostSurface === 'scan') {
    const canUseScanSurface = canUseScanWorkspace({
      role: normalizedRole,
      permissions: params.permissions,
      functions: params.functions,
    });
    if (canUseScanSurface) {
      return allowedDecision(language);
    }

    return forbiddenDecision(hostSurface, 'permission_required', language);
  }

  if (hostSurface === 'invoice') {
    const canUseInvoiceSurface =
      roleHasPermission(normalizedRole, 'finance.read', params.permissions) ||
      roleHasPermission(normalizedRole, 'finance.manage', params.permissions) ||
      roleHasPermission(normalizedRole, 'billing.manage', params.permissions) ||
      canManageInvoiceLine(normalizedRole, params.permissions);

    if (canUseInvoiceSurface) {
      return allowedDecision(language);
    }

    return forbiddenDecision(hostSurface, 'permission_required', language);
  }

  if (hostSurface === 'ai') {
    return allowedDecision(language);
  }

  return allowedDecision(language);
}

export function getHostAccessLabel(hostSurface: HostSurface) {
  switch (hostSurface) {
    case 'platform':
      return 'platform.taze.to';
    case 'app':
      return 'app.taze.to';
    case 'transport':
      return 'transport.taze.to';
    case 'admin':
      return 'admin.taze.to';
    case 'scan':
      return 'scan.taze.to';
    case 'invoice':
      return 'invoice.taze.to';
    case 'ai':
      return 'ai.taze.to';
    case 'public':
      return 'taze.to';
    case 'demo':
      return 'demo.taze.to';
    case 'api':
      return 'api.taze.to';
    default:
      return 'taze.to';
  }
}
