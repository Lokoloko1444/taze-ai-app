import { DomainConfig } from 'lib/domain-config';

const PRODUCTION_APP_HOSTS = new Set([
  DomainConfig.publicHost,
  DomainConfig.wwwHost,
  DomainConfig.appHost,
  DomainConfig.adminHost,
  DomainConfig.scanHost,
]);

const PRODUCTION_APP_ORIGINS = new Set([
  DomainConfig.publicOrigin,
  DomainConfig.wwwOrigin,
  DomainConfig.appOrigin,
  DomainConfig.adminOrigin,
  DomainConfig.scanOrigin,
]);

export function normalizeConfiguredServerBaseUrl(envUrl: string) {
  const trimmed = envUrl.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (PRODUCTION_APP_HOSTS.has(host)) {
      return DomainConfig.apiOrigin;
    }
    return parsed.origin.replace(/\/+$/, '');
  } catch {
    if (PRODUCTION_APP_ORIGINS.has(trimmed)) {
      return DomainConfig.apiOrigin;
    }
    return trimmed.replace(/\/+$/, '');
  }
}

export function resolveNativeServerBaseUrl(hostUri: string | null | undefined) {
  const host = hostUri?.split(':')[0]?.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') {
    return DomainConfig.apiOrigin;
  }

  return DomainConfig.apiOrigin;
}
