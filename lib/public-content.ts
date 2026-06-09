export type PublicBlock = {
  title: string;
  description: string;
  tone: 'primary' | 'accent' | 'success';
};

export const PUBLIC_CONTENT = {
  seo: {
    title: 'Taze | Scan, transport, facturatie, data en metrics',
    description:
      'Taze helpt bedrijven met scan, transport, facturatie, rollen/bevoegdheden, bewijs, rapportage, data en metrics. AI/RIA adviseert binnen bevoegdheid; mensen bevestigen de actie.',
  },
  hero: {
    badge: 'Taze B2B-platform',
    title: 'Taze brengt scan, transport, facturatie en data in één duidelijke bedrijfsflow.',
    subtitle: 'Van werkvloer tot management: observaties, bewijs, metrics en AI/RIA-advies binnen bevoegdheid.',
    primaryCta: 'Bekijk de demo',
    secondaryCta: 'Plan gecontroleerde demo',
  },
  blocks: [
    {
      title: 'Van scan tot rapport',
      description: 'Leg observaties vast, volg transport op en bereid facturatie voor zonder dat data versnipperd raakt.',
      tone: 'primary',
    },
    {
      title: 'Data en metrics',
      description: 'Zie voortgang, risico en impact per rol. Taze houdt cijfers, signalen en rapportage klaar voor groei.',
      tone: 'accent',
    },
    {
      title: 'AI/RIA als advieslaag',
      description: 'AI kijkt mee, waarschuwt en adviseert binnen bevoegdheid. De mens bevestigt.',
      tone: 'success',
    },
  ] satisfies PublicBlock[],
  support: {
    title: 'Waarom Google, teams en groei dit begrijpen',
    body:
      'De publieke homepage legt uit wat Taze doet, hoe het data en metrics helder houdt en welke legale routes publiek beschikbaar zijn.',
    bullets: [
      'Taze is een B2B-platform voor scan, transport, facturatie, data, metrics en beheer.',
      'Privacy en voorwaarden staan publiek op de homepage.',
      'Menselijke bevestiging en rolrechten blijven leidend.',
    ],
  },
} as const;
