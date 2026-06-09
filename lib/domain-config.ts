export type HostSurface =
  | 'public'
  | 'demo'
  | 'platform'
  | 'app'
  | 'transport'
  | 'invoice'
  | 'admin'
  | 'scan'
  | 'ai'
  | 'api'
  | 'unknown';

export const DomainConfig = {
  publicHost: 'taze.to',
  publicOrigin: 'https://taze.to',
  wwwHost: 'www.taze.to',
  wwwOrigin: 'https://www.taze.to',
  demoHost: 'demo.taze.to',
  demoOrigin: 'https://demo.taze.to',
  appHost: 'app.taze.to',
  appOrigin: 'https://app.taze.to',
  platformHost: 'platform.taze.to',
  platformOrigin: 'https://platform.taze.to',
  transportHost: 'transport.taze.to',
  transportOrigin: 'https://transport.taze.to',
  invoiceHost: 'invoice.taze.to',
  invoiceOrigin: 'https://invoice.taze.to',
  aiHost: 'ai.taze.to',
  aiOrigin: 'https://ai.taze.to',
  apiHost: 'api.taze.to',
  apiOrigin: 'https://api.taze.to',
  adminHost: 'admin.taze.to',
  adminOrigin: 'https://admin.taze.to',
  scanHost: 'scan.taze.to',
  scanOrigin: 'https://scan.taze.to',
  expoPreviewHostPrefix: 'taze-app',
  expoPreviewHostSuffix: '.expo.app',
  // Legacy aliases kept so older imports still compile while the new host split rolls out.
  appGatewayHost: 'app.taze.to',
  appGatewayOrigin: 'https://app.taze.to',
  transportGatewayHost: 'transport.taze.to',
  transportGatewayOrigin: 'https://transport.taze.to',
  scanGatewayHost: 'scan.taze.to',
  scanGatewayOrigin: 'https://scan.taze.to',
  aiGatewayHost: 'ai.taze.to',
  aiGatewayOrigin: 'https://ai.taze.to',
} as const;

export function getHostSurface(hostname: string | null | undefined): HostSurface {
  const host = (hostname ?? '').trim().toLowerCase();

  if (host.startsWith(DomainConfig.expoPreviewHostPrefix) && host.endsWith(DomainConfig.expoPreviewHostSuffix)) {
    return 'app';
  }

  if (host === DomainConfig.publicHost || host === DomainConfig.wwwHost) {
    return 'public';
  }

  if (host === DomainConfig.demoHost) {
    return 'demo';
  }

  if (host === DomainConfig.platformHost) {
    return 'platform';
  }

  if (host === DomainConfig.appHost || host === DomainConfig.appGatewayHost) {
    return 'app';
  }

  if (host === DomainConfig.transportHost || host === DomainConfig.transportGatewayHost) {
    return 'transport';
  }

  if (host === DomainConfig.invoiceHost) {
    return 'invoice';
  }

  if (host === DomainConfig.aiHost || host === DomainConfig.aiGatewayHost) {
    return 'ai';
  }

  if (host === DomainConfig.adminHost) {
    return 'admin';
  }

  if (host === DomainConfig.scanHost || host === DomainConfig.scanGatewayHost) {
    return 'scan';
  }

  if (host === DomainConfig.apiHost) {
    return 'api';
  }

  return 'unknown';
}

export function getOriginForHostSurface(surface: HostSurface) {
  switch (surface) {
    case 'public':
      return DomainConfig.publicOrigin;
    case 'demo':
      return DomainConfig.demoOrigin;
    case 'platform':
      return DomainConfig.platformOrigin;
    case 'app':
      return DomainConfig.appOrigin;
    case 'transport':
      return DomainConfig.transportOrigin;
    case 'invoice':
      return DomainConfig.invoiceOrigin;
    case 'ai':
      return DomainConfig.aiOrigin;
    case 'admin':
      return DomainConfig.adminOrigin;
    case 'scan':
      return DomainConfig.scanOrigin;
    case 'api':
      return DomainConfig.apiOrigin;
    default:
      return DomainConfig.appOrigin;
  }
}
