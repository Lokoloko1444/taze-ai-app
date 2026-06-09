export type DemoVideoScene = {
  id: 'intro' | 'scan' | 'approval' | 'growth';
  label: string;
  title: string;
  subtitle: string;
  keyLine: string;
  screenBullets: string[];
  voiceover: string;
  durationSeconds: number;
  previewMs: number;
};

export type DemoTargetSegment = {
  id: 'horeca' | 'catering' | 'retail';
  label: string;
  title: string;
  description: string;
};

export type DemoGrowthPackage = {
  id: 'start' | 'control' | 'flow' | 'evidence';
  label: string;
  title: string;
  description: string;
};

export type DemoPosterSide = {
  label: string;
  title: string;
  description: string;
};

export type DemoPosterHighlight = {
  label: string;
  value: string;
};

export const DEMO_VIDEO_SCENES: DemoVideoScene[] = [
  {
    id: 'intro',
    label: 'Stap 1',
    title: 'Twee ruimtes, een groeipad',
    subtitle: 'Businessruimte voor je echte werking. Demoruimte om veilig te testen en te leren.',
    keyLine: 'Business is waar je werkt. Demo is waar je veilig leert.',
    screenBullets: ['Businessruimte', 'Demoruimte', 'Veilig leren'],
    voiceover:
      'Taze helpt bedrijven veilig groeien. In de Businessruimte draait je echte bedrijf. In de Demoruimte kun je veilig testen, opleiden en nieuwe functies proberen. Ze zijn gescheiden voor veiligheid, maar groeien samen.',
    durationSeconds: 15,
    previewMs: 6500,
  },
  {
    id: 'scan',
    label: 'Stap 2',
    title: 'AI kijkt mee, maar beslist niet',
    subtitle: 'Scan product, observatie, AI-voorstel, menselijke bevestiging.',
    keyLine: 'Een scan is eerst een observatie. Pas na menselijke bevestiging wordt het een actie.',
    screenBullets: ['Scan product', 'Observatie', 'AI-voorstel', 'Menselijke bevestiging'],
    voiceover:
      'Met Taze scan je een product. Taze maakt eerst een observatie. AI of barcodeherkenning doet een voorstel. De medewerker bevestigt of corrigeert. Zo blijft de mens aan de bron.',
    durationSeconds: 20,
    previewMs: 6500,
  },
  {
    id: 'approval',
    label: 'Stap 3',
    title: 'Beslissen met vertrouwen',
    subtitle: 'Werkvloer scant, openstaande actie, managergoedkeuring, gecontroleerde voorraadwijziging.',
    keyLine: 'AI ondersteunt. De mens beslist.',
    screenBullets: ['Werkvloer scant', 'Openstaande actie', 'Managergoedkeuring', 'Voorraadwijziging'],
    voiceover:
      'Voor gevoelige acties bouwt Taze controle in. De werkvloer scant. Er ontstaat een openstaande actie. De manager keurt goed. Pas daarna verandert de voorraad gecontroleerd.',
    durationSeconds: 20,
    previewMs: 6500,
  },
  {
    id: 'growth',
    label: 'Stap 4',
    title: 'Bewijs en groei',
    subtitle: 'Auditbewijs toont wie zag, bevestigde, goedkeurde en veranderde.',
    keyLine: 'Taze bewijst wat er gebeurde. Start klein. Groei wanneer je klaar bent.',
    screenBullets: ['Auditbewijs', 'Wie zag', 'Wie bevestigde', 'Wat veranderde'],
    voiceover:
      'Taze toont bewijs van wat er gebeurde: wie iets zag, bevestigde, goedkeurde en veranderde. Zo groeit vertrouwen. Bedrijven starten klein en groeien wanneer ze klaar zijn.',
    durationSeconds: 15,
    previewMs: 6500,
  },
];

export const DEMO_VIDEO_TOTAL_SECONDS = DEMO_VIDEO_SCENES.reduce((total, scene) => total + scene.durationSeconds, 0);

export const DEMO_VIDEO_TITLE = 'Zo werkt Taze';
export const DEMO_VIDEO_SUBTITLE = 'Bekijk de demo in 4 stappen. Veilig bekijken zonder invloed op je echte werking.';
export const DEMO_STORYBOARD_BADGE = 'Demo-overzicht';
export const DEMO_STORYBOARD_PRIMARY_CTA = 'Volgende stap';

export const DEMO_POSTER_TITLE = 'Taze groeit mee met je bedrijf';
export const DEMO_POSTER_SUBTITLE =
  'Businessruimte voor je echte werking. Demoruimte om veilig te testen en te leren.';
export const DEMO_POSTER_SLOGAN = 'Business is waar je werkt. Demo is waar je veilig leert.';
export const DEMO_POSTER_BADGE = 'Demo-overzicht';
export const DEMO_POSTER_CTA = 'Bekijk de demo';
export const DEMO_POSTER_SIDES: DemoPosterSide[] = [
  {
    label: 'Businessruimte',
    title: 'Echte bedrijfsdata',
    description: 'Daar draait je echte werking, met echte mensen en echte beslissingen.',
  },
  {
    label: 'Demoruimte',
    title: 'Test- en leerdata',
    description: 'Daar probeer je veilig nieuwe functies, zonder je echte bedrijf te raken.',
  },
];
export const DEMO_POSTER_HIGHLIGHTS: DemoPosterHighlight[] = [
  { label: 'AI', value: 'AI-voorstel' },
  { label: 'Mens', value: 'Menselijke bevestiging' },
  { label: 'Bewijs', value: 'Auditbewijs' },
];

export const DEMO_TARGET_SEGMENTS: DemoTargetSegment[] = [
  {
    id: 'horeca',
    label: 'Belgische demo 1',
    title: 'Horeca met bar en keuken',
    description: 'Voor teams die werken met drank, keuken, service en snelle voorraadwissels.',
  },
  {
    id: 'catering',
    label: 'Belgische demo 2',
    title: 'Catering, grootkeuken en foodservice',
    description: 'Voor productie, planning, uitlevering en overzicht over meerdere momenten van de dag.',
  },
  {
    id: 'retail',
    label: 'Belgische demo 3',
    title: 'Verswinkel, retail en mini-supermarkt',
    description: 'Voor schappen, rotatie, tellingen, bestellingen en een rustige dagelijkse werking.',
  },
];

export const DEMO_GROWTH_PACKAGES: DemoGrowthPackage[] = [
  {
    id: 'start',
    label: 'Taze Start',
    title: 'Scan en observatie',
    description: 'Begin met scannen, zien en veilig registreren.',
  },
  {
    id: 'control',
    label: 'Taze Control',
    title: 'Goedkeuring en voorraadcontrole',
    description: 'Voeg managergoedkeuring en gecontroleerde voorraadwijzigingen toe.',
  },
  {
    id: 'flow',
    label: 'Taze Flow',
    title: 'Rollen, vestigingen en samenwerking',
    description: 'Laat teams, vestigingen en werkgebieden samen bewegen in één lijn.',
  },
  {
    id: 'evidence',
    label: 'Taze Evidence',
    title: 'Audit, rapportage en AI-inzichten',
    description: 'Bewijs wat er gebeurde en groei met heldere inzichten.',
  },
];
