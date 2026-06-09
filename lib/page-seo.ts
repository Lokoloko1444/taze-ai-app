import { DomainConfig } from 'lib/domain-config';
import { DEMO_CONTENT } from 'lib/demo-content';
import { PUBLIC_CONTENT } from 'lib/public-content';
import { DEMO_LANDING_ROUTE, PUBLIC_LANDING_ROUTE, isPublicInfoRoute, normalizePathname } from 'lib/root-layout-routing';
import { PublicGatewayConfig, type PublicGatewayVariant } from 'lib/public-host';

export type PageSeo = {
  title: string;
  description: string;
  robots?: string;
  ogType?: 'website' | 'article';
};

type SeoEntry = PageSeo & {
  noIndex?: boolean;
};

const defaultSeo: SeoEntry = {
  title: 'Taze | Slim bedrijfsplatform met AI',
  description:
    'Taze combineert camera, barcode, voorraad, levering en facturatie in een live bedrijfsplatform. AI stelt voor, de mens beslist.',
  ogType: 'website',
};

const publicLandingSeo: SeoEntry = {
  title: PUBLIC_CONTENT.seo.title,
  description: PUBLIC_CONTENT.seo.description,
  ogType: 'website',
};

const demoLandingSeo: SeoEntry = {
  title: DEMO_CONTENT.seo.title,
  description: DEMO_CONTENT.seo.description,
  ogType: 'website',
  noIndex: true,
};

const routeSeo: Record<string, SeoEntry> = {
  '/': {
    title: PUBLIC_CONTENT.seo.title,
    description: PUBLIC_CONTENT.seo.description,
    ogType: 'website',
  },
  '/scan': {
    title: 'Taze | Scan product of barcode',
    description: 'Scan producten en optimaliseer je workflow met Taze. Log in om direct aan de slag te gaan in jouw beveiligde omgeving.',
    ogType: 'website',
  },
  '/explore': {
    title: 'Taze | Voorraad en inzichten',
    description: 'Bekijk voorraad, lage aantallen, vervaldruk en slimme opvolging in een overzicht.',
    ogType: 'website',
  },
  '/hub': {
    title: 'Taze | Bedrijfsdashboard',
    description: 'Bekijk live voorraad, acties, teams en operationele inzichten in een dashboard.',
    ogType: 'website',
  },
  '/food-chain': {
    title: 'Taze AI: From Delivery to Audit Proof',
    description: 'One product. One scan. One controlled decision.',
    ogType: 'website',
  },
  '/account': {
    title: 'Taze | Account en login',
    description: 'Log in met Google, Microsoft, Apple of e-mail en beheer rollen en toegang.',
    ogType: 'website',
  },
  '/alerts': {
    title: 'Taze | Meldingen en vervaldruk',
    description: 'Zie welke producten, taken of vestigingen vandaag aandacht vragen.',
    ogType: 'website',
  },
  '/audit': {
    title: 'Taze | Audit en controle',
    description: 'Bekijk juridische, operationele en AI-auditcontext voor controle en verantwoording.',
    ogType: 'website',
    noIndex: true,
  },
  '/contact': {
    title: 'Taze | Contact opnemen',
    description: 'Neem contact op met Taze voor support, onboarding of bedrijfsvragen.',
    ogType: 'website',
  },
  '/creatieve-kunstenaars': {
    title: 'Taze | Creatieve route',
    description: 'Route voor creatieve teams, ondersteuning en publieke zichtbaarheid.',
    ogType: 'website',
    noIndex: true,
  },
  '/devtools': {
    title: 'Taze | Interne tools',
    description: 'Interne ontwikkeltools voor diagnose en testcontext.',
    ogType: 'website',
    noIndex: true,
  },
  '/health': {
    title: 'Taze | Systeemstatus',
    description: 'Controleer of AI, Stripe, Supabase en de web-UI live beschikbaar zijn.',
    ogType: 'website',
    noIndex: true,
  },
  '/helpdesk': {
    title: 'Taze | Ria hulp en advies',
    description: 'Ria helpt je direct met de juiste route, actie of uitleg.',
    ogType: 'website',
  },
  '/kankerfonds': {
    title: 'Taze | Steunroute Kankerfonds',
    description: 'Steunroute en partnerschapspagina rond Kankerfonds UZ Gent.',
    ogType: 'website',
    noIndex: true,
  },
  '/modal': {
    title: 'Taze | Informatie',
    description: 'Taze informatie- en hulpscherm.',
    ogType: 'website',
    noIndex: true,
  },
  '/newsletter': {
    title: 'Taze | Nieuwsbrief',
    description: 'Nieuwsbrief, updates en contactmomenten binnen Taze.',
    ogType: 'website',
  },
  '/partners': {
    title: 'Taze | Partners en integraties',
    description: 'Bekijk partners, integraties en samenwerkingsroutes.',
    ogType: 'website',
  },
  '/payments': {
    title: 'Taze | Betalingen en pakketten',
    description: 'Beheer pakketten, prijzen, betalingen en facturatie in een scherm.',
    ogType: 'website',
  },
  '/privacy': {
    title: 'Taze | Privacy en gegevens',
    description: 'Lees hoe Taze omgaat met account, camera, scans, support, data en metrics.',
    ogType: 'website',
  },
  '/terms': {
    title: 'Taze | Algemene voorwaarden',
    description: 'Lees de publieke voorwaarden voor Taze, rollen, AI/RIA, bewijs, data en metrics.',
    ogType: 'website',
  },
  '/readiness': {
    title: 'Taze | Live readiness',
    description: 'Controleer of de live uitrol en systeemchecks klaar zijn.',
    ogType: 'website',
    noIndex: true,
  },
  '/security': {
    title: 'Taze | Veiligheid en toegang',
    description: 'Beheer toegang, veiligheid en rolafspraken binnen Taze.',
    ogType: 'website',
    noIndex: true,
  },
  '/services': {
    title: 'Taze | Services en workflows',
    description: 'Ontdek services en workflows voor voorraad, transport en bedrijfscontrole.',
    ogType: 'website',
  },
  '/stripe-checkout': {
    title: 'Taze | Stripe checkout',
    description: 'Test de Stripe checkout en betaalflow van Taze.',
    ogType: 'website',
    noIndex: true,
  },
  '/support': {
    title: 'Taze | Support en contact',
    description: 'Vind support, contact en snelle hulp voor je Taze-omgeving.',
    ogType: 'website',
  },
  '/trace': {
    title: 'Taze | Producthistorie en trace',
    description: 'Volg producthistorie, herkomst en verplaatsingen door de keten.',
    ogType: 'website',
  },
  '/translate': {
    title: 'Taze | Vertalen en taal',
    description: 'Vertaal scan- en werkvloertermen naar de juiste taal voor support en teams.',
    ogType: 'website',
  },
  '/transport': {
    title: 'Taze | Transport en levering',
    description: 'Volg leveringen, voertuigen en transportstatus vanuit dezelfde live data.',
    ogType: 'website',
  },
  '/updates': {
    title: 'Taze | Updates en release-notes',
    description: 'Bekijk productupdates, releases en verbeteringen aan Taze.',
    ogType: 'website',
  },
  '/auth/callback': {
    title: 'Taze | Inloggen bevestigen',
    description: 'Bevestig login en keer veilig terug naar Taze.',
    ogType: 'website',
    noIndex: true,
  },
  '/oauth/consent': {
    title: 'Taze | Supabase toestemming',
    description: 'Bevestig de Supabase-login- en toestemmingsstap voor je Taze-account.',
    ogType: 'website',
    noIndex: true,
  },
};

export function getPageSeo(
  pathname: string,
  hostSurface: 'public' | 'demo' | 'platform' | 'app' | 'transport' | 'invoice' | 'admin' | 'scan' | 'ai' | 'api' | 'unknown',
  gatewayVariant: PublicGatewayVariant | null
): PageSeo {
  if (hostSurface === 'api') {
    return {
      title: 'Taze | API endpoint',
      description: 'Taze API endpoint. No web UI is served here.',
      robots: 'noindex,nofollow',
      ogType: 'website',
    };
  }

  const normalizedPathname = normalizePathname(pathname);

  if (normalizedPathname === PUBLIC_LANDING_ROUTE) {
    return {
      title: publicLandingSeo.title,
      description: publicLandingSeo.description,
      robots: 'index,follow',
      ogType: 'website',
    };
  }

  if (normalizedPathname === DEMO_LANDING_ROUTE) {
    return {
      title: demoLandingSeo.title,
      description: demoLandingSeo.description,
      robots: 'noindex,nofollow',
      ogType: 'website',
    };
  }

  if (hostSurface === 'admin') {
    return {
      title: 'Taze | Intern Taze beheer',
      description: 'Beheer rollen, audits en interne toegang binnen de veilige Taze-beheerlaag.',
      robots: 'noindex,nofollow',
      ogType: 'website',
    };
  }

  if (hostSurface === 'platform') {
    return {
      title: 'Taze | B2B platform',
      description: 'Open het B2B control center voor bedrijf, rollen, rechten en operationele lijnen.',
      robots: 'noindex,nofollow',
      ogType: 'website',
    };
  }

  if (hostSurface === 'invoice') {
    return {
      title: 'Taze | Facturatielijn',
      description: 'Beheer factuurconcept, controle, factuurnummer en voorbereidende betaal- en mailstatus.',
      robots: 'noindex,nofollow',
      ogType: 'website',
    };
  }

  if (hostSurface === 'ai') {
    return {
      title: 'Taze | RIA / AI advieslijn',
      description: 'Read-only advies binnen bevoegdheid. Menselijke bevestiging blijft vereist.',
      robots: 'noindex,nofollow',
      ogType: 'website',
    };
  }

  if (hostSurface === 'transport') {
    const entry = routeSeo['/transport'];
    return {
      title: entry.title,
      description: entry.description,
      robots: 'noindex,nofollow',
      ogType: entry.ogType ?? 'website',
    };
  }

  if (hostSurface === 'demo') {
    return {
      title: demoLandingSeo.title,
      description: demoLandingSeo.description,
      robots: 'noindex,nofollow',
      ogType: 'website',
    };
  }

  if (gatewayVariant) {
    const copy = PublicGatewayConfig[gatewayVariant];
    return {
      title: `Taze | ${copy.title}`,
      description: copy.description,
      robots: 'noindex,nofollow',
      ogType: 'website',
    };
  }

  if (hostSurface === 'public' && !isPublicInfoRoute(normalizedPathname)) {
    return {
      title: publicLandingSeo.title,
      description: publicLandingSeo.description,
      robots: 'index,follow',
      ogType: 'website',
    };
  }

  if (normalizedPathname.startsWith('/invoice/')) {
    const invoiceId = normalizedPathname.split('/').filter(Boolean).at(-1) ?? 'factuur';
    return {
      title: `Taze | Factuur ${invoiceId}`,
      description: 'Bekijk factuurdetails, status en betaalactie.',
      robots: hostSurface === 'public' ? 'index,follow' : 'noindex,nofollow',
      ogType: 'article',
    };
  }

  const entry = routeSeo[normalizedPathname] ?? defaultSeo;
  return {
    title: entry.title,
    description: entry.description,
    robots: hostSurface === 'public' && !entry.noIndex ? 'index,follow' : 'noindex,nofollow',
    ogType: entry.ogType ?? 'website',
  };
}

export function getPageSeoUrl(
  pathname: string,
  hostSurface: 'public' | 'demo' | 'platform' | 'app' | 'transport' | 'invoice' | 'admin' | 'scan' | 'ai' | 'api' | 'unknown',
  gatewayVariant: PublicGatewayVariant | null
) {
  if (gatewayVariant) {
    return gatewayVariant === 'admin' ? DomainConfig.adminOrigin : DomainConfig.appOrigin;
  }

  const normalizedPathname = normalizePathname(pathname);
  if (normalizedPathname === PUBLIC_LANDING_ROUTE) {
    return `${DomainConfig.publicOrigin}/`;
  }

  if (normalizedPathname === DEMO_LANDING_ROUTE) {
    return `${DomainConfig.demoOrigin}/`;
  }

  if (hostSurface === 'public' && !isPublicInfoRoute(normalizedPathname)) {
    return DomainConfig.publicOrigin;
  }
  const baseOrigin =
    hostSurface === 'public'
      ? DomainConfig.publicOrigin
      : hostSurface === 'demo'
        ? DomainConfig.demoOrigin
        : hostSurface === 'platform'
          ? DomainConfig.platformOrigin
          : hostSurface === 'transport'
            ? DomainConfig.transportOrigin
            : hostSurface === 'invoice'
              ? DomainConfig.invoiceOrigin
            : hostSurface === 'ai'
              ? DomainConfig.aiOrigin
              : hostSurface === 'admin'
                ? DomainConfig.adminOrigin
                : hostSurface === 'scan'
                  ? DomainConfig.scanOrigin
                  : hostSurface === 'api'
                    ? DomainConfig.apiOrigin
                    : DomainConfig.appOrigin;

  return `${baseOrigin}${normalizedPathname === '/' ? '/' : normalizedPathname}`;
}
