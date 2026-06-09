export type SuiteCard = {
  title: string;
  description: string;
  tone: 'primary' | 'accent' | 'neutral' | 'warning' | 'success' | 'info';
};

export type RoleCard = {
  title: string;
  subtitle: string;
  description: string;
  tone: 'primary' | 'accent' | 'neutral' | 'warning' | 'success' | 'info';
};

export const PUBLIC_WEBSITE_SUITES: SuiteCard[] = [
  {
    title: 'Taze Identiteit',
    description: 'Aanmelden, accounts, Google/Microsoft/Apple, rollen en rechten.',
    tone: 'primary',
  },
  {
    title: 'Taze Bedrijf',
    description: 'Bedrijven, vestigingen, teams, abonnementen en veilige toegang per bedrijf.',
    tone: 'accent',
  },
  {
    title: 'Taze Voorraad',
    description: 'Voorraad, tellingen, barcode, foto, vervaldata en batch/lot.',
    tone: 'success',
  },
  {
    title: 'Taze Bar',
    description: 'Drankvoorraad, barverbruik, breuk, aanvullen en populaire producten.',
    tone: 'warning',
  },
  {
    title: 'Taze Keuken',
    description: 'Ingrediënten, recepten, mise-en-place, food cost en derving.',
    tone: 'accent',
  },
  {
    title: 'Taze Productie',
    description: 'Grondstoffen omzetten naar afgewerkte producten met batchhistoriek.',
    tone: 'info',
  },
  {
    title: 'Taze Levering',
    description: 'Leveringen, ritten, status, bewijs en distributiebeheer.',
    tone: 'neutral',
  },
];

export const PUBLIC_WEBSITE_ROLES: RoleCard[] = [
  {
    title: 'Baas',
    subtitle: 'Volledige controle',
    description: 'Bepaalt richting, controleert vestigingen, ziet verlies en houdt overzicht over groei.',
    tone: 'primary',
  },
  {
    title: 'Manager',
    subtitle: 'Operationeel beheer',
    description: 'Coördineert voorraad, teams, goedkeuringen en AI-voorstellen binnen zijn vestiging.',
    tone: 'accent',
  },
  {
    title: 'Werkvloer',
    subtitle: 'Uitvoerende taken',
    description: 'Werkt op de vloer, scant, telt, meldt afwijkingen en ziet alleen eigen functiegebied.',
    tone: 'success',
  },
  {
    title: 'Chauffeur',
    subtitle: 'Distributie en levering',
    description: 'Beweegt goederen, bevestigt leveringen, voegt bewijs toe en werkt in distributiecontext.',
    tone: 'warning',
  },
];

export const PUBLIC_WEBSITE_GROUND_RULES = [
  'Mens blijft bronhouder.',
  'AI ondersteunt. De mens beslist.',
  'Feit, interpretatie, besluit en actie blijven gescheiden.',
  'Afwijking is niet automatisch fout.',
  'Bedrijfsdata blijft van het bedrijf.',
  'Kritieke acties gebeuren alleen binnen de beveiligde app.',
];

export const PUBLIC_WEBSITE_CORE_V1 = [
  'Bedrijf, Vestiging, Gebruiker, Lidmaatschap, Rol, Functiegebied en Recht.',
  'Aanmeldaccount van provider, Voorraaditem, Voorraadbeweging, AI-voorstel, Goedkeuring en Auditlog.',
  'Google-, Microsoft- en Apple-login, bedrijfsschakelaar, goedkeuringsregels en menselijke goedkeuring.',
];

export const PUBLIC_WEBSITE_DOMAIN_ROWS = [
  { label: 'taze.to', value: 'Commerciële website' },
  { label: 'demo.taze.to', value: 'Demoruimte inbegrepen' },
  { label: 'app.taze.to', value: 'Bedrijfsplatform' },
  { label: 'api.taze.to', value: 'Achterliggende laag' },
  { label: 'admin.taze.to', value: 'Intern Taze-beheer' },
];
