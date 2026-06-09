import type { HostSurface } from 'lib/domain-config';

export const PUBLIC_INFO_ROUTES = new Set([
  '/privacy',
  '/terms',
  '/support',
  '/contact',
  '/newsletter',
  '/partners',
  '/services',
  '/confirm-delivery',
]);
export const PUBLIC_LANDING_ROUTE = '/public';
export const DEMO_LANDING_ROUTE = '/demo';

export type RootLayoutSurface =
  | 'public-website'
  | 'demo-website'
  | 'public-info'
  | 'platform-protected'
  | 'app-protected'
  | 'transport-protected'
  | 'invoice-protected'
  | 'ai-protected'
  | 'scan-protected'
  | 'admin-protected'
  | 'api-only'
  | 'blocked';

export function normalizePathname(pathname: string) {
  if (!pathname) {
    return '/';
  }

  const trimmed = pathname.trim();
  if (!trimmed || trimmed === '/') {
    return '/';
  }

  return trimmed.replace(/\/+$/, '');
}

export function isPublicInfoRoute(pathname: string) {
  return PUBLIC_INFO_ROUTES.has(normalizePathname(pathname));
}

export function isLocalDevelopmentHost(hostname: string | null | undefined) {
  const host = String(hostname ?? '').trim().toLowerCase();
  if (!host) {
    return false;
  }

  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local');
}

export function resolveRootLayoutSurface(params: {
  hostSurface: HostSurface;
  pathname: string;
  hostname: string | null | undefined;
}): RootLayoutSurface {
  const normalizedPathname = normalizePathname(params.pathname);

  if (normalizedPathname === DEMO_LANDING_ROUTE) {
    return 'demo-website';
  }

  if (normalizedPathname === PUBLIC_LANDING_ROUTE) {
    return 'public-website';
  }

  if (params.hostSurface === 'demo') {
    return 'demo-website';
  }

  if (isPublicInfoRoute(normalizedPathname)) {
    return 'public-info';
  }

  if (params.hostSurface === 'api') {
    return 'api-only';
  }

  if (params.hostSurface === 'public') {
    return isPublicInfoRoute(normalizedPathname) ? 'public-info' : 'public-website';
  }

  if (params.hostSurface === 'platform') {
    return 'platform-protected';
  }

  if (params.hostSurface === 'app') {
    return 'app-protected';
  }

  if (params.hostSurface === 'transport') {
    return 'transport-protected';
  }

  if (params.hostSurface === 'invoice') {
    return 'invoice-protected';
  }

  if (params.hostSurface === 'ai') {
    return 'ai-protected';
  }

  if (params.hostSurface === 'scan') {
    return 'scan-protected';
  }

  if (params.hostSurface === 'admin') {
    return 'admin-protected';
  }

  if (params.hostSurface === 'unknown' && isLocalDevelopmentHost(params.hostname)) {
    return 'app-protected';
  }

  if (params.hostSurface === 'unknown') {
    return 'blocked';
  }

  return 'public-website';
}
