import { expect, test } from '@playwright/test';

import { DEMO_CONTENT, getDemoContent } from 'lib/demo-content';
import { getHostSurface, getOriginForHostSurface } from 'lib/domain-config';
import { getHostAccessLabel, resolveHostAccess } from 'lib/host-access';
import { getPageSeo, getPageSeoUrl } from 'lib/page-seo';
import { resolveRootLayoutSurface } from 'lib/root-layout-routing';

test('demo host gets its own surface and origin', () => {
  expect(getHostSurface('demo.taze.to')).toBe('demo');
  expect(getOriginForHostSurface('demo')).toBe('https://demo.taze.to');
});

test('invoice host gets its own surface and origin', () => {
  expect(getHostSurface('invoice.taze.to')).toBe('invoice');
  expect(getOriginForHostSurface('invoice')).toBe('https://invoice.taze.to');
  expect(getHostAccessLabel('invoice')).toBe('invoice.taze.to');
});

test('demo host resolves to the demo website surface', () => {
  const rootSurface = resolveRootLayoutSurface({
    hostSurface: 'demo',
    pathname: '/',
    hostname: 'demo.taze.to',
  });

  expect(rootSurface).toBe('demo-website');
  expect(rootSurface).not.toBe('app-protected');
  expect(rootSurface).not.toBe('scan-protected');
  expect(rootSurface).not.toBe('admin-protected');
  expect(rootSurface).not.toBe('api-only');

  expect(
    resolveRootLayoutSurface({
      hostSurface: 'demo',
      pathname: '/privacy/',
      hostname: 'demo.taze.to',
    })
  ).toBe('demo-website');

  expect(
    resolveRootLayoutSurface({
      hostSurface: 'app',
      pathname: '/demo',
      hostname: 'app.taze.to',
    })
  ).toBe('demo-website');
});

test('demo host stays public and does not require auth', () => {
  const decision = resolveHostAccess({
    hostSurface: 'demo',
    pathname: '/',
    ready: false,
    email: null,
    role: null,
    activeMembershipStatus: null,
    permissions: [],
    functions: [],
  });

  expect(decision.status).toBe('allow');
  expect(decision.reason).toBe('ready');

  expect(getHostAccessLabel('demo')).toBe('demo.taze.to');
});

test('demo SEO is noindex and points at the demo origin', () => {
  const seo = getPageSeo('/', 'demo', null);
  expect(seo.title).toBe(DEMO_CONTENT.seo.title);
  expect(seo.description).toBe(DEMO_CONTENT.seo.description);
  expect(seo.robots).toBe('noindex,nofollow');

  expect(getPageSeoUrl('/scan/', 'demo', null)).toBe('https://demo.taze.to/scan');
  expect(getPageSeo('/demo', 'demo', null).title).toBe(DEMO_CONTENT.seo.title);
  expect(getPageSeo('/public', 'public', null).title).toBe('Taze | Scan, transport, facturatie, data en metrics');
  expect(getPageSeoUrl('/demo', 'demo', null)).toBe('https://demo.taze.to/');
  expect(getPageSeoUrl('/public', 'public', null)).toBe('https://taze.to/');
});

test('demo is not the same as public landing or protected surfaces', () => {
  expect(
    resolveRootLayoutSurface({
      hostSurface: 'public',
      pathname: '/',
      hostname: 'taze.to',
    })
  ).toBe('public-website');

  expect(
    resolveRootLayoutSurface({
      hostSurface: 'app',
      pathname: '/',
      hostname: 'app.taze.to',
    })
  ).toBe('app-protected');

  expect(
    resolveRootLayoutSurface({
      hostSurface: 'scan',
      pathname: '/',
      hostname: 'scan.taze.to',
    })
  ).toBe('scan-protected');

  expect(
    resolveRootLayoutSurface({
      hostSurface: 'api',
      pathname: '/',
      hostname: 'api.taze.to',
    })
  ).toBe('api-only');
});

test('proof package copy stays focused on 15 products and avoids playground language', () => {
  expect(DEMO_CONTENT.seo.title).toBe('Taze | Proof Pakket');
  expect(DEMO_CONTENT.hero.title).toBe('Taze Proof Pakket');
  expect(DEMO_CONTENT.hero.subtitle).toBe('15 producten, een volledige bedrijfsflow.');
  expect(DEMO_CONTENT.hero.keyLine).toBe('Van scan tot rapport, binnen bevoegdheid en zonder echte impact.');
  expect(DEMO_CONTENT.hero.primaryCta).toBe('Bekijk het proof-pakket');
  expect(DEMO_CONTENT.hero.secondaryCta).toBe('Ontdek de 15-producten flow');
  expect(DEMO_CONTENT.visual.title).toBe('15 proof-producten die de volledige keten laten zien');
  expect(DEMO_CONTENT.visual.caption).toBe('Eén begrensd proof-pakket met 15 producten en dezelfde duidelijke flow voor elk bedrijf.');
  expect(DEMO_CONTENT.visual.alt).toContain('Proof-pakket met 15 producten');
  expect(DEMO_CONTENT.visual.flow).toEqual([
    'Scanwaarde',
    'Transportwaarde',
    'Invoicewaarde',
    'Rollenwaarde',
    'Bewijswaarde',
    'Rapportwaarde',
    'AI/RIA advieswaarde',
  ]);
  expect(DEMO_CONTENT.products).toHaveLength(15);
  expect(DEMO_CONTENT.products).toEqual([
    'Frisdrank krat',
    'Bierbak',
    'Fles wijn',
    'Koffiebonen',
    'Zuivelproduct',
    'Koelproduct',
    'Groenten',
    'Droge voeding',
    'Schoonmaakmiddel',
    'Verbruiksartikel',
    'Breekbaar glaswerk',
    'Promo-artikel',
    'Retourartikel',
    'Product met vervaldatum',
    'Product met schadegevoeligheid',
  ]);
  expect(DEMO_CONTENT.stepper.title).toBe('15 producten in 7 stappen');
  expect(DEMO_CONTENT.stepper.subtitle).toContain('proof-pakket');
  expect(DEMO_CONTENT.stepper.previousCta).toBe('Vorige stap');
  expect(DEMO_CONTENT.stepper.primaryCta).toBe('Volgende stap');
  expect(DEMO_CONTENT.stepper.resetCta).toBe('Opnieuw');
  expect(DEMO_CONTENT.stepper.steps).toHaveLength(7);
  expect(DEMO_CONTENT.stepper.steps.map((scene) => scene.stepLabel)).toEqual([
    'Stap 1 van 7',
    'Stap 2 van 7',
    'Stap 3 van 7',
    'Stap 4 van 7',
    'Stap 5 van 7',
    'Stap 6 van 7',
    'Stap 7 van 7',
  ]);
  expect(DEMO_CONTENT.stepper.steps.map((scene) => scene.title)).toEqual([
    'Scanwaarde',
    'Transportwaarde',
    'Invoicewaarde',
    'Rollenwaarde',
    'Bewijswaarde',
    'Rapportwaarde',
    'AI/RIA advieswaarde',
  ]);
  expect(DEMO_CONTENT.packageChoice.title).toBe('Na het proof-pakket kies je het juiste Taze-pakket.');
  expect(DEMO_CONTENT.packageChoice.ctaLine).toBe('Kies later je Taze-pakket');
  expect(DEMO_CONTENT.packageChoice.primaryCta).toBe('Vraag bedrijfsactivatie aan');
  expect(DEMO_CONTENT.packageChoice.packages.map((item) => item.title)).toEqual([
    'Startpakket',
    'Groeipakket',
    'Bedrijfspakket',
  ]);

  const content = [
    DEMO_CONTENT.seo.title,
    DEMO_CONTENT.hero.title,
    DEMO_CONTENT.hero.subtitle,
    DEMO_CONTENT.hero.keyLine,
    DEMO_CONTENT.visual.title,
    DEMO_CONTENT.visual.caption,
    DEMO_CONTENT.visual.alt,
    ...DEMO_CONTENT.visual.flow,
    ...DEMO_CONTENT.products,
    DEMO_CONTENT.stepper.title,
    DEMO_CONTENT.stepper.subtitle,
    ...DEMO_CONTENT.stepper.steps.flatMap((scene) => [scene.title, scene.subtitle, scene.keyLine, ...scene.details]),
    DEMO_CONTENT.packageChoice.title,
    DEMO_CONTENT.packageChoice.subtitle,
    DEMO_CONTENT.packageChoice.ctaLine,
    DEMO_CONTENT.packageChoice.primaryCta,
    ...DEMO_CONTENT.packageChoice.packages.flatMap((item) => [item.title, item.subtitle, item.detail]),
    DEMO_CONTENT.footer.proof,
    DEMO_CONTENT.footer.safety,
  ]
    .join(' ')
    .toLowerCase();

  const forbiddenTerms = ['speeltuin', 'testdata', 'werkende demo', 'AI beslist', 'automatisch uitgevoerd'];

  for (const term of forbiddenTerms) {
    expect(content).not.toContain(term.toLowerCase());
  }

  expect(content).toContain('scan tot rapport');
  expect(content).toContain('15 producten');
  expect(content).toContain('read-only');
  expect(content).toContain('geen echte impact');
  expect(content).toContain('startpakket');
  expect(content).toContain('groeipakket');
  expect(content).toContain('bedrijfspakket');
});

test('proof package hero supports nl, en, de, es and it', async ({ page }) => {
  const expectedHeroByLanguage = [
    { language: 'nl', title: 'Taze Proof Pakket', primaryCta: 'Bekijk het proof-pakket' },
    { language: 'en', title: 'Taze Proof Package', primaryCta: 'View the proof package' },
    { language: 'de', title: 'Taze Proof Paket', primaryCta: 'Proof Paket ansehen' },
    { language: 'es', title: 'Paquete Proof Taze', primaryCta: 'Ver paquete proof' },
    { language: 'it', title: 'Pacchetto Proof Taze', primaryCta: 'Vedi il pacchetto proof' },
  ] as const;

  for (const expected of expectedHeroByLanguage) {
    const content = getDemoContent(expected.language);
    expect(content.hero.title).toBe(expected.title);
    expect(content.hero.primaryCta).toBe(expected.primaryCta);

    await page.goto(`/demo?lang=${expected.language}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(expected.title, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: expected.primaryCta })).toBeVisible();
  }
});

test('proof package stepper advances, goes back and resets', async ({ page }) => {
  await page.goto('/demo?lang=nl', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Taze Proof Pakket', { exact: true })).toBeVisible();
  await expect(page.getByText('15 producten, een volledige bedrijfsflow.', { exact: true })).toBeVisible();
  await expect(page.getByText('Bekijk het proof-pakket', { exact: true })).toBeVisible();
  await expect(page.getByText('Ontdek de 15-producten flow', { exact: true })).toBeVisible();
  await expect(
    page.getByLabel('Proof-pakket met 15 producten').getByText('15 proof-producten die de volledige keten laten zien', { exact: true })
  ).toBeVisible();
  await expect(page.getByText('Na het proof-pakket kies je het juiste Taze-pakket.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vorige stap' })).toBeDisabled();

  const stepOne = page.getByLabel('Huidige proof stap: Scanwaarde');
  await expect(stepOne).toBeVisible();
  await expect(stepOne).toContainText('Productherkenning als voorstel');
  await expect(stepOne).toContainText('Scan laat direct zien wat er binnenkomt.');

  await page.getByRole('button', { name: 'Volgende stap' }).click();
  const stepTwo = page.getByLabel('Huidige proof stap: Transportwaarde');
  await expect(stepTwo).toBeVisible();
  await expect(stepTwo).toContainText('Klaar voor vertrek');
  await expect(stepTwo).toContainText('Aankomst en rapport naar bedrijf');

  await page.getByRole('button', { name: 'Vorige stap' }).click();
  await expect(stepOne).toBeVisible();
  await expect(stepOne).toContainText('Stap 1 van 7');

  await page.getByRole('button', { name: 'Volgende stap' }).click();
  await page.getByRole('button', { name: 'Volgende stap' }).click();
  const stepThree = page.getByLabel('Huidige proof stap: Invoicewaarde');
  await expect(stepThree).toBeVisible();
  await expect(stepThree).toContainText('Factuurconcept');
  await expect(stepThree).toContainText('Factuurnummer, betaalstatus en mailstatus');

  await page.getByRole('button', { name: 'Opnieuw' }).click();
  await expect(stepOne).toBeVisible();
  await expect(stepOne).toContainText('Stap 1 van 7');
});

test('proof package keeps the 15-product line and safety note visible', async ({ page }) => {
  await page.goto('/demo', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Van scan tot rapport, binnen bevoegdheid en zonder echte data.')).toBeVisible();
  await expect(page.getByText('Geen echte data. Geen echte impact. Klaar om pakket te kiezen.')).toBeVisible();
  await expect(page.getByText('Startpakket', { exact: true })).toBeVisible();
  await expect(page.getByText('Groeipakket', { exact: true })).toBeVisible();
  await expect(page.getByText('Bedrijfspakket', { exact: true })).toBeVisible();
});
