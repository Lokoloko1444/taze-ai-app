import { expect, test } from '@playwright/test';

import { PUBLIC_CONTENT } from 'lib/public-content';

const authEmail = process.env.E2E_AUTH_EMAIL?.trim();
const authPassword = process.env.E2E_AUTH_PASSWORD?.trim();

function attachDiagnostics(page) {
  const readinessErrors = [];
  const readinessLogs = [];
  page.on('pageerror', (error) => {
    readinessErrors.push(`pageerror: ${error.message}`);
  });
  page.on('console', (message) => {
    readinessLogs.push(`${message.type()}: ${message.text()}`);
    if (message.type() === 'error') {
      readinessErrors.push(`console:error: ${message.text()}`);
    }
  });
  return { readinessErrors, readinessLogs };
}

test.describe('Taze browser QA', () => {
  test('landing and readiness render in Chromium', async ({ page }) => {
    const { readinessErrors, readinessLogs } = attachDiagnostics(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const landingBody = (await page.locator('body').textContent()) ?? '';
    if (landingBody.includes(PUBLIC_CONTENT.hero.title) || landingBody.includes(PUBLIC_CONTENT.hero.primaryCta)) {
      await expect(page.getByText(PUBLIC_CONTENT.hero.title, { exact: true })).toBeVisible();
      await expect(page.getByText(PUBLIC_CONTENT.hero.primaryCta, { exact: true })).toBeVisible();
      expect(landingBody).toContain(PUBLIC_CONTENT.hero.title);
      expect(landingBody).toContain(PUBLIC_CONTENT.hero.subtitle);
      expect(landingBody).toContain(PUBLIC_CONTENT.blocks[0].title);
      expect(landingBody).toContain(PUBLIC_CONTENT.blocks[1].title);
      expect(landingBody).toContain(PUBLIC_CONTENT.blocks[2].title);
      expect(landingBody).toContain(PUBLIC_CONTENT.support.title);
      expect(landingBody).toContain(PUBLIC_CONTENT.support.bullets[0]);
      expect(landingBody).not.toContain('Taze Identity');
      expect(landingBody).not.toContain('Taze Company');
      expect(landingBody).not.toContain('multi-tenant');
      expect(landingBody).not.toContain('policy engine');
    } else {
      expect(landingBody).toContain('Toegang vereist');
      expect(landingBody).toContain('Terug naar taze.to');
    }

    await page.goto('/readiness', { waitUntil: 'domcontentloaded' });
    if (process.env.PLAYWRIGHT_DEBUG_READINESS === '1') {
      console.log(`READINESS_URL=${page.url()}`);
      await page.screenshot({ path: 'test-results/readiness-debug.png', fullPage: true }).catch(() => {});
      console.log('READINESS_BODY_START');
      try {
        const bodyText = (await page.locator('body').textContent({ timeout: 5000 })) ?? '';
        console.log(bodyText.slice(0, 4000));
      } catch (error) {
        console.log(`READINESS_BODY_ERROR=${error instanceof Error ? error.message : String(error)}`);
      }
      console.log('READINESS_ERRORS_START');
      console.log(readinessErrors.join('\n') || '(none)');
      console.log('READINESS_ERRORS_END');
      console.log('READINESS_LOGS_START');
      console.log(readinessLogs.slice(0, 200).join('\n') || '(none)');
      console.log('READINESS_LOGS_END');
      console.log('READINESS_BODY_END');
    }
    await expect(page.getByText('Go-live readiness', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Bron van deze check', { exact: true })).toBeVisible({ timeout: 30_000 });
  });

  test('scan, newsletter and payments render in Chromium', async ({ page }) => {
    await page.goto('/scan', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Geef cameratoegang|Barcode-invoer|Test zonder camera|Camera wordt voorbereid|Toegang vereist|Geen toegang/i).first()).toBeVisible();
    const openRiaHelpdesk = page.getByRole('button', { name: 'Open Ria helpdesk' });
    if ((await openRiaHelpdesk.count()) > 0) {
      await openRiaHelpdesk.first().click();
      await expect(page).toHaveURL(/\/helpdesk(?:\?|$)/);
    } else {
      await page.goto('/helpdesk', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/helpdesk(?:\?|$)/);
    }

    await page.goto('/newsletter', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Taze Nieuwsbrief|Toegang vereist|Geen toegang/i).first()).toBeVisible();
    if ((await page.getByText('Taze Nieuwsbrief', { exact: true }).count()) > 0) {
      await expect(page.getByPlaceholder('jij@bedrijf.be')).toBeVisible();
      await page.getByRole('button', { name: 'Privacybeleid' }).click();
      await expect(page).toHaveURL(/\/privacy(?:\?|$)/);
    }

    await page.goto('/payments', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Bedrijfspakketten|Slimme betaalcockpit|Toegang vereist|Geen toegang/i).first()).toBeVisible();
  });

  test('food chain demo entry opens the workflow from the dashboard', async ({ page }) => {
    await page.goto('/hub', { waitUntil: 'domcontentloaded' });
    const bodyText = (await page.locator('body').textContent()) ?? '';

    if (bodyText.includes('Toegang vereist')) {
      await expect(page.getByText('Toegang vereist', { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ga naar login' })).toBeVisible();

      if (!authEmail || !authPassword) {
        return;
      }

      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await page.getByPlaceholder('jij@bedrijf.be').fill(authEmail);
      await page.getByPlaceholder('Wachtwoord').fill(authPassword);
      await page.getByRole('button', { name: 'Login' }).click();
      await expect(page.getByRole('button', { name: 'Uitloggen' })).toBeVisible({ timeout: 20_000 });

      await page.goto('/hub', { waitUntil: 'domcontentloaded' });
    }

    await expect(page.getByText('Taze Food Chain Demo', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('From delivery scan to human-confirmed routing and audit proof.', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Open demo' }).click();
    await expect(page).toHaveURL(/\/food-chain(?:\?|$)/);
    await expect(page.getByText('Taze AI: From Delivery to Audit Proof', { exact: true }).first()).toBeVisible();
  });

  test('food chain presentation mode can auto-demo the workflow from the dashboard entry', async ({ page }) => {
    await page.goto('/hub', { waitUntil: 'domcontentloaded' });
    const bodyText = (await page.locator('body').textContent()) ?? '';

    if (bodyText.includes('Toegang vereist')) {
      await expect(page.getByText('Toegang vereist', { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ga naar login' })).toBeVisible();

      if (!authEmail || !authPassword) {
        return;
      }

      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await page.getByPlaceholder('jij@bedrijf.be').fill(authEmail);
      await page.getByPlaceholder('Wachtwoord').fill(authPassword);
      await page.getByRole('button', { name: 'Login' }).click();
      await expect(page.getByRole('button', { name: 'Uitloggen' })).toBeVisible({ timeout: 20_000 });

      await page.goto('/hub', { waitUntil: 'domcontentloaded' });
    }

    await page.getByRole('button', { name: 'Open demo' }).click();
    await expect(page).toHaveURL(/\/food-chain(?:\?|$)/);
    await expect(page.getByText('Taze AI: From Delivery to Audit Proof', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Presentation Mode' }).click();
    await expect(page.getByText('Presentation mode active', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Start Auto Demo' }).click();
    await expect(page.getByText('Auto demo running', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Delivery received. Scan the product next.', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Product scanned. AI suggests Top Bar. Human confirmation is next.', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('AI suggests. Staff decides. Top Bar is approved for routing.', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Routed to Top Bar. Audit proof created and stored.', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Audit Proof Complete', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('100% Traceable Workflow', { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Reset demo' }).last().click();
    await expect(page.getByText('Mark the delivery received to begin.', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Ready to receive', { exact: true }).first()).toBeVisible();
  });

  test('food chain route renders in Chromium', async ({ page }) => {
    await page.goto('/food-chain', { waitUntil: 'domcontentloaded' });
    const bodyText = (await page.locator('body').textContent()) ?? '';

    if (bodyText.includes('Toegang vereist')) {
      await expect(page.getByText('Toegang vereist', { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ga naar login' })).toBeVisible();

      if (!authEmail || !authPassword) {
        return;
      }

      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await page.getByPlaceholder('jij@bedrijf.be').fill(authEmail);
      await page.getByPlaceholder('Wachtwoord').fill(authPassword);
      await page.getByRole('button', { name: 'Login' }).click();
      await expect(page.getByRole('button', { name: 'Uitloggen' })).toBeVisible({ timeout: 20_000 });

      await page.goto('/food-chain', { waitUntil: 'domcontentloaded' });
    }

    await expect(page.getByText('Taze AI: From Delivery to Audit Proof', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('One product. One scan. One controlled decision.', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Delivery to audit proof', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Mark delivery received' }).click();
    await expect(page.getByText('Delivery received. Scan the product next.', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Scan Product' }).click();
    await expect(page.getByText('Product scanned', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Suggested destination', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Top Bar', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('AI suggests Top Bar at 92% confidence', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('100% complete', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText(/AI suggests\. Staff decides\./i).first()).toBeVisible();
    await expect(page.getByText(/Staff confirmed Top Bar with no override\./i).first()).toBeVisible();
    await expect(page.getByTestId('food-chain-summary')).toHaveCount(0);

    await page.getByRole('button', { name: 'Send to destination' }).click();
    await expect(page.getByText('Audit proof created. The record is stored.', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Audit Proof: 100% complete', { exact: true }).first()).toBeVisible();

    const summary = page.getByTestId('food-chain-summary');
    await expect(summary).toBeVisible();
    await expect(summary.getByText('Taze Demo Summary', { exact: true })).toBeVisible();
    await expect(summary.getByText('One product. One scan. One controlled decision. Full audit proof.', { exact: true })).toBeVisible();
    await expect(summary.getByText('Whole Milk 1L', { exact: true })).toBeVisible();
    await expect(summary.getByText('Top Bar', { exact: true }).first()).toBeVisible();
    await expect(summary.getByText('100% traceable', { exact: true })).toBeVisible();
    await expect(summary.getByRole('button', { name: 'Print summary' })).toBeVisible();
    await expect(summary.getByRole('button', { name: 'Copy summary' })).toBeVisible();

    await page.evaluate(() => {
      (window as Window & { __tazePrintCalled?: boolean }).__tazePrintCalled = false;
      window.print = () => {
        (window as Window & { __tazePrintCalled?: boolean }).__tazePrintCalled = true;
      };
    });
    await summary.getByRole('button', { name: 'Print summary' }).click();
    await expect.poll(() => page.evaluate(() => (window as Window & { __tazePrintCalled?: boolean }).__tazePrintCalled)).toBeTruthy();

    await summary.getByRole('button', { name: 'Copy summary' }).click();
    await expect(summary.getByText('Summary copied', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Reset presentation' }).click();
    await expect(page.getByText('Presentation mode off', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Auto demo idle', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Mark the delivery received to begin.', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Ready to receive', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Audit Proof: 100% complete', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('food-chain-summary')).toHaveCount(0);
  });

  test('food chain route records staff destination override before confirmation', async ({ page }) => {
    await page.goto('/food-chain', { waitUntil: 'domcontentloaded' });
    const bodyText = (await page.locator('body').textContent()) ?? '';

    if (bodyText.includes('Toegang vereist')) {
      await expect(page.getByText('Toegang vereist', { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ga naar login' })).toBeVisible();

      if (!authEmail || !authPassword) {
        return;
      }

      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await page.getByPlaceholder('jij@bedrijf.be').fill(authEmail);
      await page.getByPlaceholder('Wachtwoord').fill(authPassword);
      await page.getByRole('button', { name: 'Login' }).click();
      await expect(page.getByRole('button', { name: 'Uitloggen' })).toBeVisible({ timeout: 20_000 });

      await page.goto('/food-chain', { waitUntil: 'domcontentloaded' });
    }

    await page.getByRole('button', { name: 'Mark delivery received' }).click();
    await page.getByRole('button', { name: 'Scan Product' }).click();

    await page.getByRole('button', { name: 'Kitchen' }).click();
    await expect(page.getByText(/Staff changed the AI suggestion to Kitchen\./i).first()).toBeVisible();

    await page.getByRole('button', { name: 'Confirm' }).click();
    await page.getByRole('button', { name: 'Send to destination' }).click();

    await expect(page.getByText(/Staff changed destination/i).first()).toBeVisible();
    await expect(page.getByText(/Staff overrode the AI suggestion: Top Bar -> Kitchen\./i).first()).toBeVisible();
    await expect(page.getByText('Audit Proof: 100% complete', { exact: true }).first()).toBeVisible();
  });
  test('account renders in Chromium', async ({ page }) => {
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('1. Toegang, bedrijf en rol', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Provider-login', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login met Google' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Microsoft later' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apple later' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Microsoft later' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Apple later' })).toBeDisabled();
    await expect(page.getByText('1. E-mail login', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Log in of maak een account met e-mail en wachtwoord/i).first()).toBeVisible();
  });

  test('service and API checks respond from the browser runner', async ({ request }) => {
    const healthResponse = await request.get('/health');
    expect(healthResponse.ok()).toBeTruthy();

    const health = await healthResponse.json();
    expect(health.ok).toBe(true);
    expect(health.runtime).toBe('node');
    expect(health.serveWebUi).toBe(true);
    expect(['live', 'demo']).toContain(health.mode);
    expect(typeof health.demo).toBe('boolean');
    expect(typeof health.apiConnected).toBe('boolean');
    expect(typeof health.databaseConnected).toBe('boolean');
    expect(typeof health.supabaseConfigured).toBe('boolean');
    expect(typeof health.stripeConfigured).toBe('boolean');
    expect(typeof health.newsletterEnabled).toBe('boolean');

    const supabaseResponse = await request.get('/api/supabase/status');
    expect(supabaseResponse.ok()).toBeTruthy();
    const supabase = await supabaseResponse.json();
    expect(typeof supabase.configured).toBe('boolean');
    expect(typeof supabase.publicConfigured).toBe('boolean');
    expect(typeof supabase.serverConfigured).toBe('boolean');

    const stripeResponse = await request.get('/api/stripe/status');
    expect(stripeResponse.ok()).toBeTruthy();
    const stripe = await stripeResponse.json();
    expect(typeof stripe.configured).toBe('boolean');
    expect(typeof stripe.checkoutReady).toBe('boolean');
    expect(typeof stripe.publishableKeyConfigured).toBe('boolean');

    const securityResponse = await request.get('/security');
    expect(securityResponse.ok()).toBeTruthy();

    const recognizeResponse = await request.post('/recognize', {
      data: {
        barcode: '8710400131474',
        imageBase64: 'abc123',
      },
    });
    expect([200, 401, 403, 429]).toContain(recognizeResponse.status());
    if (recognizeResponse.status() !== 200) {
      const recognizeError = await recognizeResponse.json().catch(() => null);
      expect(recognizeError).toBeTruthy();
      expect(typeof recognizeError?.error).toBe('string');
    }

    const newsletterInvalidResponse = await request.post('/newsletter/subscribe', {
      data: {
        email: 'invalid',
      },
    });
    expect(newsletterInvalidResponse.status()).toBe(400);
  });

  test('refund decision endpoints require authentication', async ({ request }) => {
    const approvalResponse = await request.post('/api/refunds/approve', {
      headers: { 'content-type': 'application/json' },
      data: {},
    });
    expect(approvalResponse.status()).toBe(401);

    const rejectionResponse = await request.post('/api/refunds/reject', {
      headers: { 'content-type': 'application/json' },
      data: {},
    });
    expect(rejectionResponse.status()).toBe(401);
  });

  test('recognize rejects oversized requests and webhook rejects missing signatures', async ({ request }) => {
    const recognizeResponse = await request.post('/recognize', {
      data: {
        barcode: 'X'.repeat(129),
      },
    });
    expect(recognizeResponse.status()).toBe(400);

    const webhookResponse = await request.post('/api/stripe/webhook', {
      headers: { 'content-type': 'application/json' },
      data: { dummy: 'payload' },
    });
    expect(webhookResponse.status()).toBe(400);
  });

  test.describe('optional auth flow', () => {
    test.skip(!authEmail || !authPassword, 'Set E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD to run the live login flow.');

    test('can sign in from the account page when credentials are available', async ({ page }) => {
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await page.getByPlaceholder('jij@bedrijf.be').fill(authEmail ?? '');
      await page.getByPlaceholder('Wachtwoord').fill(authPassword ?? '');
      await page.getByRole('button', { name: 'Login' }).click();

      await expect(page.getByRole('button', { name: 'Uitloggen' })).toBeVisible({ timeout: 20_000 });
    });
  });
});


