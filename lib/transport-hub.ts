export type TransportRegion =
  | 'Alle'
  | 'Wereldwijd'
  | 'Europa'
  | 'Noord-Amerika'
  | 'Azie'
  | 'India'
  | 'Afrika'
  | 'LatAm'
  | 'Oceanie';

export type TransportUseCase =
  | 'Alle'
  | 'Budget'
  | 'Zakelijk'
  | 'Wereldwijd'
  | 'Last-mile'
  | 'Ride'
  | 'Delivery'
  | 'Logistiek';

export type TransportApp = {
  id: string;
  label: string;
  url: string;
  regions: TransportRegion[];
  category: 'Ride' | 'Delivery' | 'Logistiek';
  useCases: TransportUseCase[];
  detail: string;
  tone: string;
  surface: string;
};

export type TransportAppHighlight = {
  id: string;
  rank: string;
  market: string;
  note: string;
  tone: string;
  surface: string;
};

export const transportRegions: TransportRegion[] = [
  'Alle',
  'Wereldwijd',
  'Europa',
  'Noord-Amerika',
  'Azie',
  'India',
  'Afrika',
  'LatAm',
  'Oceanie',
];

export const transportUseCases: TransportUseCase[] = [
  'Alle',
  'Budget',
  'Zakelijk',
  'Wereldwijd',
  'Last-mile',
  'Ride',
  'Delivery',
  'Logistiek',
];

export const transportApps: TransportApp[] = [
  {
    id: 'uber',
    label: 'Uber',
    url: 'https://www.uber.com',
    regions: ['Wereldwijd', 'Europa', 'Noord-Amerika', 'LatAm', 'Azie', 'Afrika', 'Oceanie'],
    category: 'Ride',
    useCases: ['Wereldwijd', 'Zakelijk', 'Ride'],
    detail: 'Sterke internationale mobiliteitsapp voor ritten, zakelijke verplaatsingen en brede stedelijke dekking.',
    tone: '#111827',
    surface: '#f3f4f6',
  },
  {
    id: 'bolt',
    label: 'Bolt',
    url: 'https://bolt.eu',
    regions: ['Europa', 'Afrika'],
    category: 'Ride',
    useCases: ['Budget', 'Ride', 'Last-mile'],
    detail: 'Scherpe prijspositionering en sterke dekking in Europa en delen van Afrika.',
    tone: '#0f766e',
    surface: '#ecfeff',
  },
  {
    id: 'lyft',
    label: 'Lyft',
    url: 'https://www.lyft.com',
    regions: ['Noord-Amerika'],
    category: 'Ride',
    useCases: ['Ride', 'Zakelijk'],
    detail: 'Belangrijk alternatief voor de VS en Canada met focus op stedelijke mobiliteit.',
    tone: '#db2777',
    surface: '#fdf2f8',
  },
  {
    id: 'didi',
    label: 'DiDi',
    url: 'https://www.didiglobal.com',
    regions: ['Azie', 'LatAm'],
    category: 'Ride',
    useCases: ['Budget', 'Ride'],
    detail: 'Grote schaal in groeimarkten en sterke aanwezigheid in meerdere Aziatische en Latijns-Amerikaanse steden.',
    tone: '#1d4ed8',
    surface: '#eff6ff',
  },
  {
    id: 'ola',
    label: 'Ola',
    url: 'https://www.olacabs.com',
    regions: ['India'],
    category: 'Ride',
    useCases: ['Budget', 'Ride'],
    detail: 'Regionale topspeler voor India met grote mobiliteitsdekking.',
    tone: '#b45309',
    surface: '#fffbeb',
  },
  {
    id: 'rapido',
    label: 'Rapido',
    url: 'https://www.rapido.bike',
    regions: ['India'],
    category: 'Delivery',
    useCases: ['Delivery', 'Last-mile', 'Budget'],
    detail: 'Snelle bike- en last-mile flow in India, interessant voor lokale dispatch.',
    tone: '#7c3aed',
    surface: '#f5f3ff',
  },
  {
    id: 'gocatch',
    label: 'GoCatch',
    url: 'https://www.gocatch.com.au',
    regions: ['Oceanie'],
    category: 'Ride',
    useCases: ['Ride', 'Budget'],
    detail: 'Australische mobiliteitsoptie voor lokale rit- en taxiflows.',
    tone: '#0369a1',
    surface: '#f0f9ff',
  },
  {
    id: 'parcelcraft',
    label: 'Parcelcraft',
    url: 'https://parcelcraft.com',
    regions: ['Wereldwijd'],
    category: 'Logistiek',
    useCases: ['Logistiek', 'Last-mile', 'Zakelijk', 'Wereldwijd'],
    detail: 'Logistieke en shippingflow voor zendingen, fulfilment en dispatch.',
    tone: '#6d28d9',
    surface: '#f5f3ff',
  },
];

export const topTransportAppHighlights: TransportAppHighlight[] = [
  {
    id: 'uber',
    rank: 'Top 1',
    market: 'Wereldwijd bereik',
    note: 'Sterke internationale dekking voor ritten, zakelijke mobiliteit en brede stedenmix.',
    tone: '#111827',
    surface: '#f3f4f6',
  },
  {
    id: 'bolt',
    rank: 'Top 2',
    market: 'Europa en Afrika',
    note: 'Grote aanwezigheid in steden met scherpe prijspositionering en snelle lokale beschikbaarheid.',
    tone: '#0f766e',
    surface: '#ecfeff',
  },
  {
    id: 'didi',
    rank: 'Top 3',
    market: 'Azie en LatAm',
    note: 'Sterke schaal in groeimarkten en interessant voor brede regionale dekking.',
    tone: '#1d4ed8',
    surface: '#eff6ff',
  },
  {
    id: 'lyft',
    rank: 'Top 4',
    market: 'Noord-Amerika',
    note: 'Belangrijk alternatief in de VS en Canada met sterke stedelijke dekking.',
    tone: '#db2777',
    surface: '#fdf2f8',
  },
  {
    id: 'ola',
    rank: 'Top 5',
    market: 'India en regio',
    note: 'Grote regionale speler voor mobiliteit in India en omliggende markten.',
    tone: '#b45309',
    surface: '#fffbeb',
  },
];

export function matchesTransportFilters(app: TransportApp, region: TransportRegion, useCase: TransportUseCase) {
  const regionMatch = region === 'Alle' || app.regions.includes(region);
  const useCaseMatch = useCase === 'Alle' || app.useCases.includes(useCase);
  return regionMatch && useCaseMatch;
}

export function getTransportRecommendation(
  region: TransportRegion,
  useCase: TransportUseCase
): (TransportApp & { reason: string }) | null {
  const preferredOrder = (() => {
    if (useCase === 'Zakelijk') return ['uber', 'parcelcraft', 'lyft', 'bolt'];
    if (useCase === 'Last-mile') return ['parcelcraft', 'rapido', 'bolt', 'uber'];
    if (useCase === 'Budget') return ['bolt', 'didi', 'ola', 'gocatch', 'rapido'];
    if (useCase === 'Delivery') return ['rapido', 'parcelcraft', 'uber'];
    if (useCase === 'Logistiek') return ['parcelcraft'];
    if (region === 'Europa') return ['bolt', 'uber', 'parcelcraft'];
    if (region === 'Noord-Amerika') return ['lyft', 'uber', 'parcelcraft'];
    if (region === 'India') return ['ola', 'rapido', 'uber'];
    if (region === 'Azie') return ['didi', 'uber', 'parcelcraft'];
    if (region === 'LatAm') return ['didi', 'uber', 'parcelcraft'];
    if (region === 'Afrika') return ['bolt', 'uber'];
    if (region === 'Oceanie') return ['gocatch', 'uber'];
    return ['uber', 'parcelcraft', 'bolt', 'didi'];
  })();

  const candidate =
    preferredOrder
      .map((id) => transportApps.find((app) => app.id === id) ?? null)
      .find((app): app is TransportApp => Boolean(app) && matchesTransportFilters(app, region, useCase)) ??
    transportApps.find((app) => matchesTransportFilters(app, region, useCase)) ??
    null;

  if (!candidate) return null;

  const reason =
    useCase === 'Zakelijk'
      ? `${candidate.label} past het best voor zakelijke flows en betrouwbare operationele dekking.`
      : useCase === 'Last-mile'
        ? `${candidate.label} sluit het best aan op snelle last-mile en dispatch use cases.`
        : useCase === 'Budget'
          ? `${candidate.label} is hier de scherpste budgetkeuze binnen de actieve dekking.`
          : useCase === 'Delivery'
            ? `${candidate.label} is hier de beste deliverygerichte optie.`
            : useCase === 'Logistiek'
              ? `${candidate.label} is hier de logische logistieke partner.`
              : region !== 'Alle'
                ? `${candidate.label} is de sterkste match voor ${region}.`
                : `${candidate.label} is momenteel de beste algemene transportmatch.`;

  return { ...candidate, reason };
}
