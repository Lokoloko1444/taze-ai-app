import { DomainConfig } from 'lib/domain-config';

export type PublicGatewayVariant = 'scan' | 'admin';

export type PublicGatewayCopy = {
  hostLabel: string;
  title: string;
  subtitle: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  fallbackLabel: string;
  fallbackHref: string;
  helper: string;
};

const scanGatewayCopy: PublicGatewayCopy = {
  hostLabel: DomainConfig.scanOrigin,
  title: 'Open scanner',
  subtitle: 'Camera en barcode',
  description: 'Ga direct naar de scanflow om camera, barcode en herkenning te testen.',
  primaryLabel: 'Open scanner',
  primaryHref: `${DomainConfig.appOrigin}/scan`,
  fallbackLabel: 'Open scan direct',
  fallbackHref: `${DomainConfig.appOrigin}/scan`,
  helper: 'Gebruik de scannerroute direct in het bedrijfsplatform als je browser lastig doet.',
};

const adminGatewayCopy: PublicGatewayCopy = {
  hostLabel: DomainConfig.adminOrigin,
  title: 'Open beheer',
  subtitle: 'Intern Taze beheer',
  description: 'Beheer rollen, audits, instellingen en interne toegang voor het bedrijfsplatform.',
  primaryLabel: 'Open beheer',
  primaryHref: `${DomainConfig.appOrigin}/security`,
  fallbackLabel: 'Open dashboard',
  fallbackHref: DomainConfig.appOrigin,
  helper: 'Dit beheerportaal is intern en blijft apart van de commerciële website.',
};

export const PublicGatewayConfig: Record<PublicGatewayVariant, PublicGatewayCopy> = {
  scan: scanGatewayCopy,
  admin: adminGatewayCopy,
};

export function getPublicGatewayVariant(hostname: string | null | undefined, pathname: string): PublicGatewayVariant | null {
  if (pathname !== '/') {
    return null;
  }

  const host = (hostname ?? '').trim().toLowerCase();
  if (host === DomainConfig.scanGatewayHost) {
    return 'scan';
  }

  if (host === DomainConfig.adminHost) {
    return 'admin';
  }

  return null;
}

