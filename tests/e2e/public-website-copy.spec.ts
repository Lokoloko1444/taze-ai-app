import { expect, test } from '@playwright/test';

import { PUBLIC_CONTENT } from 'lib/public-content';

test('public website content stays Dutch and business first', () => {
  expect(PUBLIC_CONTENT.hero.title).toBe('Taze brengt scan, transport, facturatie en data in één duidelijke bedrijfsflow.');
  expect(PUBLIC_CONTENT.hero.subtitle).toContain('observaties, bewijs, metrics');
  expect(PUBLIC_CONTENT.hero.primaryCta).toBe('Bekijk de demo');
  expect(PUBLIC_CONTENT.hero.secondaryCta).toBe('Plan gecontroleerde demo');
  expect(PUBLIC_CONTENT.blocks).toHaveLength(3);
  expect(PUBLIC_CONTENT.blocks.map((block) => block.title)).toEqual([
    'Van scan tot rapport',
    'Data en metrics',
    'AI/RIA als advieslaag',
  ]);
  expect(PUBLIC_CONTENT.support.title).toBe('Waarom Google, teams en groei dit begrijpen');
  expect(PUBLIC_CONTENT.support.body).toContain('publieke');
  expect(PUBLIC_CONTENT.support.bullets).toContain('Taze is een B2B-platform voor scan, transport, facturatie, data, metrics en beheer.');
  expect(PUBLIC_CONTENT.support.bullets).toContain('Privacy en voorwaarden staan publiek op de homepage.');
  expect(PUBLIC_CONTENT.support.bullets).toContain('Menselijke bevestiging en rolrechten blijven leidend.');

  const allText = JSON.stringify(PUBLIC_CONTENT).toLowerCase();
  expect(allText).not.toContain('Ãƒ');
  expect(allText).not.toContain('multi-tenant');
  expect(allText).not.toContain('policy engine');
  expect(allText).not.toContain('identity');
  expect(allText).not.toContain('company');
});
