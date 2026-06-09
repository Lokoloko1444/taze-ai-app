import { expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DEMO_CONTENT } from 'lib/demo-content';
import { PUBLIC_CONTENT } from 'lib/public-content';

function assetFileForPath(pathname: string) {
  const normalized = pathname.trim();
  if (!normalized || normalized === '/') {
    return 'app.html';
  }

  if (normalized === '/public' || normalized === '/public.html') {
    return 'public.html';
  }

  if (normalized === '/demo' || normalized === '/demo.html') {
    return 'demo.html';
  }

  const clean = normalized.replace(/^\/+/, '');
  if (clean.endsWith('.html')) {
    return clean;
  }

  return `${clean}.html`;
}

function createMockAssets() {
  const distDir = join(process.cwd(), 'dist');

  return {
    async fetch(request: Request) {
      const pathname = new URL(request.url).pathname;
      const assetFile = assetFileForPath(pathname);
      const filePath = join(distDir, assetFile);
      const fallbackFilePath = assetFile === 'app.html' ? join(distDir, 'index.html') : null;

      if (!existsSync(filePath) && (!fallbackFilePath || !existsSync(fallbackFilePath))) {
        return new Response(`missing:${pathname}`, {
          status: 404,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
        });
      }

      const body = readFileSync(existsSync(filePath) ? filePath : fallbackFilePath!, 'utf8');
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    },
  };
}

async function loadWorker() {
  const module = await import('../../cloudflare/worker.mjs');
  return module.default;
}

test('worker reads the host header before routing', async () => {
  const { getRequestHostname } = await import('../../cloudflare/worker.mjs');
  const hostname = getRequestHostname(
    {
      headers: {
        get(name: string) {
          if (name.toLowerCase() === 'host') {
            return 'API.TAZE.TO:443';
          }

          if (name.toLowerCase() === 'x-forwarded-host') {
            return 'demo.taze.to:8443';
          }

          return null;
        },
      },
    } as any,
    new URL('https://ignored.example/')
  );

  expect(hostname).toBe('api.taze.to');
});

test('api host short-circuits to API-only JSON at the worker edge', async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(new Request('https://api.taze.to/'), { ASSETS: createMockAssets() } as any);

  expect(response.headers.get('content-type')).toContain('application/json');
  expect(response.headers.get('x-taze-worker-version')).toBe('edge-dispatch-v5');
  expect(response.headers.get('x-taze-host-dispatch')).toBe('api');
  const body = await response.json();
  expect(body).toMatchObject({
    service: 'Taze API',
    status: 'ok',
    ui: false,
  });
  expect(JSON.stringify(body)).not.toContain('Toegang wordt geladen');
});

test('public host serves the public landing asset at the root', async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(new Request('https://taze.to/'), { ASSETS: createMockAssets() } as any);

  expect(response.headers.get('content-type')).toContain('text/html');
  expect(response.headers.get('x-taze-worker-version')).toBe('edge-dispatch-v5');
  expect(response.headers.get('x-taze-host-dispatch')).toBe('public');
  const body = await response.text();
  expect(body).toContain(PUBLIC_CONTENT.hero.title);
  expect(body).toContain(PUBLIC_CONTENT.hero.primaryCta);
  expect(body).toContain(PUBLIC_CONTENT.blocks[0].title);
  expect(body).not.toContain('Toegang wordt geladen');
});

test('www host serves the public landing asset at the root', async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(new Request('https://www.taze.to/'), { ASSETS: createMockAssets() } as any);

  expect(response.headers.get('content-type')).toContain('text/html');
  expect(response.headers.get('x-taze-worker-version')).toBe('edge-dispatch-v5');
  expect(response.headers.get('x-taze-host-dispatch')).toBe('public');
  const body = await response.text();
  expect(body).toContain(PUBLIC_CONTENT.hero.title);
  expect(body).toContain(PUBLIC_CONTENT.hero.secondaryCta);
  expect(body).toContain(PUBLIC_CONTENT.blocks[1].title);
  expect(body).not.toContain('Toegang wordt geladen');
});

test('demo host serves the proof package landing asset at the root', async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(new Request('https://demo.taze.to/'), { ASSETS: createMockAssets() } as any);

  expect(response.headers.get('content-type')).toContain('text/html');
  expect(response.headers.get('x-taze-worker-version')).toBe('edge-dispatch-v5');
  expect(response.headers.get('x-taze-host-dispatch')).toBe('demo');
  const body = await response.text();
  expect(body).toContain(DEMO_CONTENT.hero.title);
  expect(body).toContain(DEMO_CONTENT.hero.subtitle);
  expect(body).toContain(DEMO_CONTENT.visual.title);
  expect(body).toContain(DEMO_CONTENT.stepper.title);
  expect(body).toContain(DEMO_CONTENT.products[0]);
  expect(body).toContain(DEMO_CONTENT.products[14]);
  expect(body).toContain(DEMO_CONTENT.packageChoice.title);
  expect(body).toContain(DEMO_CONTENT.packageChoice.packages[0].title);
  expect(body).toContain(DEMO_CONTENT.packageChoice.packages[1].title);
  expect(body).toContain(DEMO_CONTENT.packageChoice.packages[2].title);
  expect(body).toContain(DEMO_CONTENT.footer.proof);
  expect(body).toContain(DEMO_CONTENT.footer.safety);
  expect(body).not.toContain('Toegang wordt geladen');
  expect(body).not.toContain('speeltuin');
  expect(body).not.toContain('werkende demo');
});

test('invoice host serves the invoice access boundary at the root', async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(new Request('https://invoice.taze.to/'), { ASSETS: createMockAssets() } as any);

  expect(response.headers.get('content-type')).toContain('text/html');
  expect(response.headers.get('x-taze-worker-version')).toBe('edge-dispatch-v5');
  expect(response.headers.get('x-taze-host-dispatch')).toBe('invoice');
  expect(response.status).toBe(401);
  const body = await response.text();
  expect(body).toContain('invoice.taze.to');
  expect(body).toContain('Facturatielijn');
  expect(body).toContain('401 Facturatie');
  expect(body).toContain('Log in met je Taze-account om de facturatielijn te openen.');
  expect(body).not.toContain('app.taze.to');
});

test('ai host serves the ai access boundary at the root', async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(new Request('https://ai.taze.to/'), { ASSETS: createMockAssets() } as any);

  expect(response.headers.get('content-type')).toContain('text/html');
  expect(response.headers.get('x-taze-worker-version')).toBe('edge-dispatch-v5');
  expect(response.headers.get('x-taze-host-dispatch')).toBe('ai');
  expect(response.status).toBe(401);
  const body = await response.text();
  expect(body).toContain('ai.taze.to');
  expect(body).toContain('RIA / AI advieslijn');
  expect(body).toContain('401 AI');
  expect(body).toContain('Read-only advies binnen bevoegdheid.');
  expect(body).toContain('Menselijke bevestiging vereist.');
  expect(body).toContain('Geen automatische acties');
  expect(body).toContain('Geen datawijzigingen');
  expect(body).not.toContain('scan.taze.to');
  expect(body).not.toContain('transport.taze.to');
  expect(body).not.toContain('invoice.taze.to');
  expect(body).not.toContain('admin.taze.to');
  expect(body).not.toContain('demo.taze.to');
  expect(body).not.toContain('app.taze.to');
});

test('transport host serves the transport access boundary at the root', async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(new Request('https://transport.taze.to/'), { ASSETS: createMockAssets() } as any);

  expect(response.headers.get('content-type')).toContain('text/html');
  expect(response.headers.get('x-taze-worker-version')).toBe('edge-dispatch-v5');
  expect(response.headers.get('x-taze-host-dispatch')).toBe('transport');
  const body = await response.text();
  expect(body).toContain('transport.taze.to');
  expect(body).toContain('Transport en levering');
  expect(body).toContain('Log in met je Taze-account om de transportlijn te openen.');
  expect(body).not.toContain('app.taze.to');
});

test('protected roots no longer render the loading copy at the worker response level', async () => {
  const worker = await loadWorker();
  const appResponse = await worker.fetch(new Request('https://app.taze.to/'), { ASSETS: createMockAssets() } as any);
  const scanResponse = await worker.fetch(new Request('https://scan.taze.to/'), { ASSETS: createMockAssets() } as any);
  const adminResponse = await worker.fetch(new Request('https://admin.taze.to/'), { ASSETS: createMockAssets() } as any);

  const appBody = await appResponse.text();
  const scanBody = await scanResponse.text();
  const adminBody = await adminResponse.text();

  expect(appResponse.headers.get('x-taze-host-dispatch')).toBe('business');
  expect(scanResponse.headers.get('x-taze-host-dispatch')).toBe('scan');
  expect(adminResponse.headers.get('x-taze-host-dispatch')).toBe('admin');
  expect(appResponse.status).toBe(200);
  expect(scanResponse.status).toBe(200);
  expect(adminResponse.status).toBe(403);
  expect(appBody).not.toContain('Toegang wordt geladen');
  expect(scanBody).not.toContain('Toegang wordt geladen');
  expect(adminBody).not.toContain('Toegang wordt geladen');
  expect(appBody).toContain('Toegang vereist');
  expect(appBody).toContain('Ga naar login');
  expect(appBody).toContain('Log in met je Taze-account om je bedrijfsomgeving te openen.');
  expect(scanBody).toContain('Taze | Scan product of barcode');
  expect(scanBody).toContain('Scan producten of barcode');
  expect(scanBody).toContain('content="https://app.taze.to/scan"');
  expect(scanBody).not.toContain('content="https://scan.taze.to/scan"');
  expect(adminBody).toContain('Toegang vereist');
  expect(adminBody).toContain('403 Beheer');
});
