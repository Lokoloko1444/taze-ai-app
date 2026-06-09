import { DomainConfig } from 'lib/domain-config';
import { t, type AppLanguage } from 'lib/i18n';

export type OAuthProvider = 'google' | 'azure' | 'apple';

export type AuthCallbackHashState = {
  accessToken: string;
  refreshToken: string;
  error: string;
  errorDescription: string;
  expiresIn: string;
  tokenType: string;
  state: string;
};

function firstAuthCallbackParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function normalizeOrigin(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/+$/, '');
}

function isExpoPreviewOrigin(value: string | null | undefined) {
  const origin = normalizeOrigin(value);
  if (!origin) return false;

  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return hostname.startsWith(DomainConfig.expoPreviewHostPrefix) && hostname.endsWith(DomainConfig.expoPreviewHostSuffix);
  } catch {
    return false;
  }
}

function appendQueryParam(url: string, key: string, value: string | null | undefined) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(trimmedValue)}`;
}

function resolveWebOrigin(originOverride?: string | null) {
  const override = normalizeOrigin(originOverride);
  if (override) {
    if (isExpoPreviewOrigin(override)) {
      return normalizeOrigin(DomainConfig.appOrigin) || DomainConfig.appOrigin;
    }
    return override;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    const currentOrigin = normalizeOrigin(window.location.origin);
    if (isExpoPreviewOrigin(currentOrigin)) {
      return normalizeOrigin(DomainConfig.appOrigin) || DomainConfig.appOrigin;
    }
    return currentOrigin || DomainConfig.appOrigin;
  }
  return normalizeOrigin(DomainConfig.appOrigin) || DomainConfig.appOrigin;
}

export function buildOAuthCallbackUrl(inviteToken?: string | null, originOverride?: string | null) {
  return appendQueryParam(`${resolveWebOrigin(originOverride)}/auth/callback`, 'invite', inviteToken);
}

export function buildOAuthLoginRequest(
  provider: OAuthProvider,
  inviteToken?: string | null,
  originOverride?: string | null,
  callbackUrlOverride?: string | null
) {
  const redirectTo = callbackUrlOverride?.trim()
    ? callbackUrlOverride.trim()
    : buildOAuthCallbackUrl(inviteToken, originOverride);

  return {
    provider,
    options: {
      redirectTo,
      ...(provider === 'apple' ? {} : { queryParams: { prompt: 'select_account' } }),
    },
  };
}

export function parseAuthCallbackHash(hash: string): AuthCallbackHashState {
  const raw = hash.startsWith('#') || hash.startsWith('?') ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);

  return {
    accessToken: firstAuthCallbackParam(params.get('access_token') ?? ''),
    refreshToken: firstAuthCallbackParam(params.get('refresh_token') ?? ''),
    error: firstAuthCallbackParam(params.get('error') ?? ''),
    errorDescription: firstAuthCallbackParam(params.get('error_description') ?? ''),
    expiresIn: firstAuthCallbackParam(params.get('expires_in') ?? ''),
    tokenType: firstAuthCallbackParam(params.get('token_type') ?? ''),
    state: firstAuthCallbackParam(params.get('state') ?? ''),
  };
}

export function hasAuthCallbackFragment(hash: AuthCallbackHashState) {
  return Boolean(
    hash.accessToken ||
      hash.refreshToken ||
      hash.error ||
      hash.errorDescription ||
      hash.expiresIn ||
      hash.tokenType ||
      hash.state
  );
}

export function hasAuthCallbackSessionData({
  code,
  hash,
  sessionPresent,
}: {
  code: string;
  hash: AuthCallbackHashState;
  sessionPresent: boolean;
}) {
  return Boolean(sessionPresent || code.trim() || (hash.accessToken && hash.refreshToken));
}

export function getAuthCallbackDestination(inviteToken?: string | null) {
  const trimmedInvite = inviteToken?.trim();
  if (!trimmedInvite) return '/account';
  return `/account?invite=${encodeURIComponent(trimmedInvite)}`;
}

export function getMissingAuthCallbackMessage(hasAuthPayload: boolean, language: AppLanguage = 'nl') {
  if (hasAuthPayload) {
    return t('auth.redirect.invalidSession', language);
  }

  return t('auth.redirect.missingCodeOrSession', language);
}
