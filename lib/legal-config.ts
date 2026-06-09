import { BrandIdentity } from 'constants/theme';
import { DomainConfig } from 'lib/domain-config';

export const LegalConfig = {
  brandName: BrandIdentity.appName,
  supportEmail: 'lgstudio144@gmail.com',
  cancerFundUrl: 'https://www.uzgent.be/nl/patient/zoek-een-arts-of-dienst/kankercentrum/zorg-en-ondersteuning/wat-het-kankercentrum-voor-jou-doet',
  privacyPolicyUrl: `${DomainConfig.publicOrigin}/privacy`,
  termsUrl: `${DomainConfig.publicOrigin}/terms`,
  supportUrl: `${DomainConfig.publicOrigin}/support`,
  contactUrl: `${DomainConfig.publicOrigin}/contact`,
  privacyRoute: '/privacy',
  termsRoute: '/terms',
  supportRoute: '/support',
  contactRoute: '/contact',
  cancerFundRoute: '/kankerfonds',
  creativeArtistsRoute: '/creatieve-kunstenaars',
} as const;
