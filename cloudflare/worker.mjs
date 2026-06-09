import {
    ACCOUNT_ROOT_HTML,
    DEMO_ROOT_HTML,
    PUBLIC_ROOT_HTML,
    SCAN_ROOT_HTML,
} from '../lib/generated-root-html.mjs';

const API_HOST = 'api.taze.to';
const DEFAULT_OPENAI_MODEL = 'gpt-4.1';
const DEFAULT_RIA_MODEL = 'gpt-5.4-mini';
const ROOT_HOST = 'taze.to';
const WWW_HOST = 'www.taze.to';
const DEMO_HOST = 'demo.taze.to';
const PLATFORM_HOST = 'platform.taze.to';
const APP_HOST = 'app.taze.to';
const TRANSPORT_HOST = 'transport.taze.to';
const INVOICE_HOST = 'invoice.taze.to';
const AI_HOST = 'ai.taze.to';
const ADMIN_HOST = 'admin.taze.to';
const SCAN_HOST = 'scan.taze.to';
const SPA_HOSTS = new Set([ROOT_HOST, WWW_HOST, DEMO_HOST, PLATFORM_HOST, APP_HOST, TRANSPORT_HOST, INVOICE_HOST, AI_HOST, ADMIN_HOST, SCAN_HOST]);
const ALLOWED_HOSTS = new Set([API_HOST, ROOT_HOST, WWW_HOST, DEMO_HOST, PLATFORM_HOST, APP_HOST, TRANSPORT_HOST, INVOICE_HOST, AI_HOST, ADMIN_HOST, SCAN_HOST]);
const PUBLIC_LANDING_ROUTE = '/public';
const PUBLIC_LANDING_FILE = '/public.html';
const DEMO_LANDING_ROUTE = '/demo';
const DEMO_LANDING_FILE = '/demo.html';
const PUBLIC_ROOT_HTML_CURRENT = PUBLIC_ROOT_HTML
  .replaceAll('Start voorraadflow', 'Bekijk de demo')
  .replaceAll('Bekijk voorbeeld', 'Plan gecontroleerde demo');

const PRODUCTS = [
  {
    id: 'milk-1l',
    name: 'Volle melk 1L',
    category: 'Zuivel',
    barcode: '8712345678901',
    unit: '1L',
    price: 1.5,
    currency: 'EUR',
    suggestedDestination: 'Koelkast',
    fallbackDestination: 'Opslag',
    reason: 'Verse melk moet gekoeld blijven',
    confidence: 0.95,
    requiresPayment: true,
    auditLabel: 'Zuivel - Koeling vereist',
  },
  {
    id: 'bread-white',
    name: 'Wit brood',
    category: 'Bakkerij',
    barcode: '8712345678902',
    unit: '1 stuk',
    price: 2.2,
    currency: 'EUR',
    suggestedDestination: 'Bakkerij afdeling',
    fallbackDestination: 'Algemene opslag',
    reason: 'Brood moet droog en koel bewaard worden',
    confidence: 0.9,
    requiresPayment: true,
    auditLabel: 'Bakkerij - Droge opslag',
  },
  {
    id: 'apples-red',
    name: 'Rode appels',
    category: 'Fruit',
    barcode: '8712345678903',
    unit: '1kg',
    price: 3.0,
    currency: 'EUR',
    suggestedDestination: 'Fruit koeling',
    fallbackDestination: 'Koelcel',
    reason: 'Appels blijven langer vers in koeling',
    confidence: 0.85,
    requiresPayment: true,
    auditLabel: 'Fruit - Koeling aanbevolen',
  },
  {
    id: 'chicken-breast',
    name: 'Kipfilet',
    category: 'Vlees',
    barcode: '8712345678904',
    unit: '500g',
    price: 5.5,
    currency: 'EUR',
    suggestedDestination: 'Vlees koeling',
    fallbackDestination: 'Diepvries',
    reason: 'Vlees moet gekoeld of bevroren worden',
    confidence: 0.95,
    requiresPayment: true,
    auditLabel: 'Vlees - Koeling verplicht',
  },
  {
    id: 'pasta-spaghetti',
    name: 'Spaghetti',
    category: 'Pasta',
    barcode: '8712345678905',
    unit: '500g',
    price: 1.8,
    currency: 'EUR',
    suggestedDestination: 'Droogwaren',
    fallbackDestination: 'Algemene opslag',
    reason: 'Pasta kan op kamertemperatuur bewaard worden',
    confidence: 0.8,
    requiresPayment: true,
    auditLabel: 'Pasta - Droge opslag',
  },
  {
    id: 'yogurt-plain',
    name: 'Naturel yoghurt',
    category: 'Zuivel',
    barcode: '8712345678906',
    unit: '500g',
    price: 1.2,
    currency: 'EUR',
    suggestedDestination: 'Koelkast',
    fallbackDestination: 'Opslag',
    reason: 'Yoghurt moet gekoeld blijven',
    confidence: 0.9,
    requiresPayment: true,
    auditLabel: 'Zuivel - Koeling vereist',
  },
  {
    id: 'cheese-gouda',
    name: 'Gouda kaas',
    category: 'Zuivel',
    barcode: '8712345678907',
    unit: '200g',
    price: 3.5,
    currency: 'EUR',
    suggestedDestination: 'Kaas koeling',
    fallbackDestination: 'Koelkast',
    reason: 'Kaas blijft langer goed in koeling',
    confidence: 0.85,
    requiresPayment: true,
    auditLabel: 'Zuivel - Koeling aanbevolen',
  },
  {
    id: 'tomatoes',
    name: 'Tomaten',
    category: 'Groente',
    barcode: '8712345678908',
    unit: '1kg',
    price: 2.5,
    currency: 'EUR',
    suggestedDestination: 'Groente koeling',
    fallbackDestination: 'Koelcel',
    reason: 'Tomaten blijven vers in koeling',
    confidence: 0.8,
    requiresPayment: true,
    auditLabel: 'Groente - Koeling aanbevolen',
  },
  {
    id: 'salmon-fillet',
    name: 'Zalmfilet',
    category: 'Vis',
    barcode: '8712345678909',
    unit: '300g',
    price: 8.0,
    currency: 'EUR',
    suggestedDestination: 'Vis koeling',
    fallbackDestination: 'Diepvries',
    reason: 'Vis moet gekoeld of bevroren worden',
    confidence: 0.95,
    requiresPayment: true,
    auditLabel: 'Vis - Koeling verplicht',
  },
  {
    id: 'rice-white',
    name: 'Witte rijst',
    category: 'Granen',
    barcode: '8712345678910',
    unit: '1kg',
    price: 2.0,
    currency: 'EUR',
    suggestedDestination: 'Droogwaren',
    fallbackDestination: 'Algemene opslag',
    reason: 'Rijst kan op kamertemperatuur bewaard worden',
    confidence: 0.75,
    requiresPayment: true,
    auditLabel: 'Granen - Droge opslag',
  },
  {
    id: 'butter',
    name: 'Roomboter',
    category: 'Zuivel',
    barcode: '8712345678911',
    unit: '250g',
    price: 2.8,
    currency: 'EUR',
    suggestedDestination: 'Koelkast',
    fallbackDestination: 'Opslag',
    reason: 'Boter moet gekoeld blijven',
    confidence: 0.9,
    requiresPayment: true,
    auditLabel: 'Zuivel - Koeling vereist',
  },
  {
    id: 'bananas',
    name: 'Bananen',
    category: 'Fruit',
    barcode: '8712345678912',
    unit: '1kg',
    price: 1.8,
    currency: 'EUR',
    suggestedDestination: 'Fruit opslag',
    fallbackDestination: 'Algemene opslag',
    reason: 'Bananen kunnen op kamertemperatuur rijpen',
    confidence: 0.7,
    requiresPayment: true,
    auditLabel: 'Fruit - Kamertemperatuur',
  },
  {
    id: 'eggs-dozen',
    name: 'Eieren doos 12',
    category: 'Zuivel',
    barcode: '8712345678913',
    unit: '12 stuks',
    price: 3.2,
    currency: 'EUR',
    suggestedDestination: 'Koelkast',
    fallbackDestination: 'Koelcel',
    reason: 'Eieren blijven langer goed in koeling',
    confidence: 0.85,
    requiresPayment: true,
    auditLabel: 'Zuivel - Koeling aanbevolen',
  },
  {
    id: 'potatoes',
    name: 'Aardappelen',
    category: 'Groente',
    barcode: '8712345678914',
    unit: '2kg',
    price: 2.0,
    currency: 'EUR',
    suggestedDestination: 'Groente kelder',
    fallbackDestination: 'Donkere opslag',
    reason: 'Aardappelen moeten donker en koel bewaard worden',
    confidence: 0.8,
    requiresPayment: true,
    auditLabel: 'Groente - Donkere opslag',
  },
  {
    id: 'orange-juice',
    name: 'Sinaasappelsap',
    category: 'Dranken',
    barcode: '8712345678915',
    unit: '1L',
    price: 2.5,
    currency: 'EUR',
    suggestedDestination: 'Koelkast',
    fallbackDestination: 'Opslag',
    reason: 'Sap blijft langer goed gekoeld',
    confidence: 0.85,
    requiresPayment: true,
    auditLabel: 'Dranken - Koeling aanbevolen',
  },
];

const KNOWN_BARCODES = {};

for (const product of PRODUCTS) {
  if (product.barcode) {
    KNOWN_BARCODES[product.barcode] = {
      name: product.name,
      category: product.category,
      quantity: 1,
      expiryDays: null,
      confidence: product.confidence,
      notes: product.reason,
      source: 'barcode-lookup',
      barcode: product.barcode,
      batchCode: null,
      lotNumber: null,
      recallFlag: false,
    };
  }
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function findProductByBarcode(barcode) {
  if (!barcode) {
    return null;
  }

  const normalizedBarcode = normalizeBarcodeValue(barcode);
  return PRODUCTS.find((product) => product.barcode === normalizedBarcode) || null;
}

function findProductCandidates(text) {
  const normalizedText = normalizeSearchText(text);
  if (!normalizedText) {
    return [];
  }

  const terms = normalizedText.split(' ').filter(Boolean);
  return PRODUCTS.map((product) => {
    const name = normalizeSearchText(product.name);
    const category = normalizeSearchText(product.category);
    let score = 0;

    for (const term of terms) {
      if (name.includes(term)) score += 2;
      if (category.includes(term)) score += 1;
    }

    return { product, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.product.confidence - a.product.confidence)
    .slice(0, 3)
    .map(({ product, score }) => ({
      productId: product.id,
      productName: product.name,
      confidence: Math.min(0.98, Math.max(0.35, score / 4)),
      reason: `Match op ${product.category}`,
    }));
}

function buildRecognizeResponse(normalized, method, input, reasonOverride) {
  const barcodeProduct = findProductByBarcode(normalized.barcode || input.barcode || '');
  const productId = barcodeProduct?.id ?? null;
  const productName = barcodeProduct?.name ?? normalized.name ?? null;
  const label = normalized.name || normalized.category || 'Onbekend product';
  const confidence = Number.isFinite(Number(normalized.confidence)) ? Number(normalized.confidence) : 0;
  const candidates = findProductCandidates(`${normalized.name || ''} ${normalized.category || ''} ${input.ocrText || ''}`);
  const reason = reasonOverride || normalized.notes || (confidence >= 0.7 ? 'Herkenning afgerond' : 'Onzeker resultaat');
  const ok = Boolean(productId) || confidence >= 0.65;

  const response = {
    ok,
    method,
    label,
    productId,
    productName,
    confidence,
    candidates,
    reason,
    result: {
      ...normalized,
      barcode: normalized.barcode ?? input.barcode ?? null,
    },
  };

  // Safe verification logging
  console.log(`Recognition: method=${method}, confidence=${confidence.toFixed(2)}, candidates=${candidates.length}, reason=${reason}, ok=${ok}`);

  return response;
}

function coerceRecognitionSeed(seed, input) {
  if (!seed || typeof seed !== 'object') {
    return null;
  }

  return normalizeRecognition(seed, input);
}

async function lookupOpenFoodFactsBarcode(barcode) {
  const clean = String(barcode || '').trim();
  if (!clean) return null;

  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(clean)}.json`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json().catch(() => null);
    if (!data || Number(data.status) !== 1 || !data.product) {
      return null;
    }

    const product = data.product;
    const name =
      product.product_name ||
      product.generic_name ||
      product.product_name_en ||
      product.product_name_nl ||
      `Product ${clean}`;
    const categoryText =
      product.categories ||
      product.generic_name ||
      product.abbreviated_product_name ||
      product.product_name ||
      '';
    const category = inferCategoryFromText(categoryText);
    const expiryDays = inferExpiryFromText(`${name} ${categoryText}`);

    return normalizeRecognition(
      {
        name,
        category,
        quantity: 1,
        expiryDays,
        confidence: 0.88,
        notes: `Barcode ${clean} gevonden via OpenFoodFacts.`,
        source: 'openfoodfacts',
        barcode: clean,
        batchCode: null,
        lotNumber: null,
        recallFlag: false,
      },
      { barcode: clean }
    );
  } catch {
    return null;
  }
}

function inferRecognition(input) {
  const barcode = input.barcode || '';
  const ocrText = input.ocrText || '';
  const hasImage = Boolean(input.imageBase64 || input.imageUri);

  if (barcode) {
    const inferred = inferProductFromBarcode(barcode);
    if (inferred) {
      return normalizeRecognition(inferred, input);
    }
  }

  if (ocrText) {
    const name = ocrText.trim();
    const category = inferCategoryFromText(name);
    const expiryDays = inferExpiryFromText(name);

    return normalizeRecognition(
      {
        name,
        category,
        quantity: 1,
        expiryDays,
        confidence: 0.45,
        notes: 'Herkenning gebaseerd op OCR-tekst.',
        source: 'ocr-fallback',
        barcode: barcode || null,
        batchCode: null,
        lotNumber: null,
        recallFlag: false,
      },
      input
    );
  }

  if (hasImage) {
    return normalizeRecognition(
      {
        name: 'Onbekend product',
        category: 'Controle nodig',
        quantity: 1,
        expiryDays: null,
        confidence: 0.35,
        notes: 'Foto ontvangen maar geen herkenning mogelijk.',
        source: 'image-fallback',
        barcode: barcode || null,
        batchCode: null,
        lotNumber: null,
        recallFlag: false,
      },
      input
    );
  }

  return normalizeRecognition(
    {
      name: barcode ? `Onbekende barcode ${barcode}` : 'Onbekend product',
      category: 'Controle nodig',
      quantity: 1,
      expiryDays: null,
      confidence: 0.25,
      notes: 'Geen herkenningsinformatie beschikbaar.',
      source: 'empty-fallback',
      barcode: barcode || null,
      batchCode: null,
      lotNumber: null,
      recallFlag: false,
    },
    input
  );
}

function buildLiveUnknownRecognition(input, reason) {
  const barcode = input.barcode || '';
  return {
    name: barcode ? `Onbekende barcode ${barcode}` : 'Onbekend product',
    category: 'Controle nodig',
    quantity: 1,
    expiryDays: null,
    confidence: 0.35,
    notes: reason || 'Product niet herkend in catalogus.',
    source: 'live-unknown',
    barcode: barcode || null,
    batchCode: null,
    lotNumber: null,
    recallFlag: false,
  };
}

function createOpenAiClient(env = process.env) {
  const apiKey = envValue(env, 'OPENAI_API_KEY');
  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    baseURL: 'https://api.openai.com/v1',
    model: envValue(env, 'OPENAI_MODEL') || DEFAULT_OPENAI_MODEL,
  };
}

function getRiaModel(env = process.env) {
  return envValue(env, 'RIA_MODEL') || envValue(env, 'AI_MODEL') || envValue(env, 'OPENAI_MODEL') || DEFAULT_RIA_MODEL;
}

function trimEnv(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBarcodeValue(value) {
  return String(value ?? '')
    .trim()
    .replace(/[^0-9]/g, '');
}

function parseCsvEnv(value) {
  return trimEnv(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isTruthyEnv(value) {
  const normalized = trimEnv(value).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function envValue(env, key) {
  if (env && typeof env === 'object' && key in env) {
    return trimEnv(env[key]);
  }

  return trimEnv(process.env?.[key]);
}

function isLocalDevelopmentOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function isExpoHostingOrigin(origin) {
  return /^https:\/\/[a-z0-9-]+(?:--[a-z0-9-]+)?\.expo\.app$/i.test(origin);
}

function isAllowedCorsOrigin(origin) {
  const allowedOrigins = parseCsvEnv(process.env.CORS_ORIGINS);
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  if (trimEnv(process.env.NODE_ENV).toLowerCase() !== 'production' && isLocalDevelopmentOrigin(origin)) {
    return true;
  }

  return false;
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const headers = {
    Vary: 'Origin',
  };

  if (!origin || !isAllowedCorsOrigin(origin)) {
    return headers;
  }

  headers['Access-Control-Allow-Origin'] = origin;
  headers['Access-Control-Allow-Credentials'] = 'true';
  headers['Access-Control-Allow-Headers'] =
    request.headers.get('Access-Control-Request-Headers') || 'Content-Type, Authorization';
  headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS';
  return headers;
}

function jsonResponse(payload, status = 200, request = null) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    ...(request ? corsHeaders(request) : {}),
  };

  const response = new Response(JSON.stringify(payload), { status, headers });
  return request ? decorateResponse(response, { request }) : response;
}

function textResponse(body, status = 200, contentType = 'text/plain; charset=utf-8', request = null) {
  const headers = {
    'Content-Type': contentType,
    ...(request ? corsHeaders(request) : {}),
  };

  const response = new Response(body, { status, headers });
  return request ? decorateResponse(response, { request }) : response;
}

function htmlResponse(body, status = 200, request = null, dispatch = 'blocked', hostname = '', env = process.env) {
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    ...(request ? corsHeaders(request) : {}),
  };

  const response = new Response(body, { status, headers });
  return request ? decorateResponse(response, { request, hostname, dispatch, env }) : response;
}

function buildAccessHtml({
  title,
  heading,
  code,
  message,
  hostLabel,
  primaryLabel = 'Terug naar taze.to',
  primaryHref = 'https://taze.to/',
  secondaryLabel = 'Ga naar login',
  secondaryHref = '/account',
}) {
  return `<!DOCTYPE html>
<html lang="nl">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>${title}</title>
    <style>
      :root { color-scheme: light; }
      html, body { margin: 0; min-height: 100%; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%); color: #0f172a; }
      body { display: grid; place-items: center; padding: 24px; }
      main { width: min(640px, 100%); background: rgba(255,255,255,0.94); border: 1px solid rgba(148,163,184,0.28); border-radius: 28px; padding: 28px; box-shadow: 0 18px 48px rgba(15, 23, 42, 0.10); }
      .badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; background: #eff6ff; color: #1d4ed8; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
      h1 { margin: 18px 0 8px; font-size: clamp(2rem, 4vw, 3rem); line-height: 1.05; }
      p { margin: 0 0 18px; font-size: 1rem; line-height: 1.6; color: #334155; }
      .code { display: inline-flex; margin-bottom: 16px; padding: 8px 12px; border-radius: 999px; background: #f1f5f9; color: #0f172a; font-weight: 700; }
      .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 22px; }
      a { text-decoration: none; }
      .button { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 16px; border-radius: 14px; font-weight: 700; }
      .button.primary { background: #0f766e; color: white; }
      .button.secondary { border: 1px solid rgba(15, 118, 110, 0.20); background: white; color: #0f766e; }
      .host { margin-top: 18px; font-size: 0.92rem; color: #64748b; }
    </style>
  </head>
  <body>
    <main>
      <div class="badge">${hostLabel}</div>
      <div class="code">${code}</div>
      <h1>${heading}</h1>
      <p>${message}</p>
      <div class="actions">
        <a class="button primary" href="${primaryHref}">${primaryLabel}</a>
        <a class="button secondary" href="${secondaryHref}">${secondaryLabel}</a>
      </div>
      <div class="host">${hostLabel}</div>
    </main>
  </body>
</html>`;
}

function redirectResponse(url, request = null, dispatch = 'public', env = process.env) {
  const response = Response.redirect(url, 302);
  return request ? decorateResponse(response, { request, dispatch, env }) : response;
}

function rootHtmlResponse(html, request, hostname, dispatch, env = process.env) {
  return htmlResponse(html, 200, request, dispatch, hostname, env);
}

function protectedRootHtmlResponse(html, request, hostname, dispatch, env = process.env) {
  const safeHtml = String(html)
    .replaceAll('Toegang wordt geladen...', 'Toegang vereist')
    .replaceAll('Toegang wordt geladen', 'Toegang vereist')
    .replaceAll('Laden</div>', 'Login vereist</div>')
    .replaceAll('Toegang wordt gecontroleerd.', 'Log in met je Taze-account om deze omgeving te openen.');

  return rootHtmlResponse(safeHtml, request, hostname, dispatch, env);
}

const DEFAULT_WORKER_VERSION = 'edge-dispatch-v5';

function normalizeHostValue(value) {
  const first = trimEnv(value).split(',')[0].trim().toLowerCase();
  if (!first) {
    return '';
  }

  const ipv6Match = first.match(/^\[(.+)\](?::\d+)?$/);
  if (ipv6Match) {
    return `[${ipv6Match[1]}]`;
  }

  return first.replace(/:\d+$/, '');
}

function getDispatchLabel(hostname) {
  const host = normalizeHostValue(hostname);
  if (host === API_HOST) return 'api';
  if (host === DEMO_HOST) return 'demo';
  if (host === ROOT_HOST || host === WWW_HOST) return 'public';
  if (host === PLATFORM_HOST) return 'platform';
  if (host === APP_HOST) return 'business';
  if (host === TRANSPORT_HOST) return 'transport';
  if (host === INVOICE_HOST) return 'invoice';
  if (host === AI_HOST) return 'ai';
  if (host === SCAN_HOST) return 'scan';
  if (host === ADMIN_HOST) return 'admin';
  return 'blocked';
}

function buildTazeHeaders({ request = null, hostname = '', dispatch = 'blocked', env = process.env } = {}) {
  const headers = {
    'X-Taze-Worker-Version': envValue(env, 'TAZE_WORKER_VERSION') || DEFAULT_WORKER_VERSION,
    'X-Taze-Host-Dispatch': dispatch,
    'X-Taze-Host': normalizeHostValue(hostname),
    'Cache-Control': 'no-store, max-age=0',
  };

  if (request) {
    Object.assign(headers, corsHeaders(request));
  }

  return headers;
}

function decorateResponse(response, context = {}) {
  const headers = new Headers(response.headers);
  const request = context.request ?? null;
  const hostname = normalizeHostValue(
    context.hostname ?? (request ? getRequestHostname(request, new URL(request.url)) : '')
  );
  const dispatch = context.dispatch ?? getDispatchLabel(hostname);
  const tazeHeaders = buildTazeHeaders({ request, hostname, dispatch, env: context.env });

  for (const [key, value] of Object.entries(tazeHeaders)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function rewriteRequestPath(request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url.toString(), request);
}

export function getRequestHostname(request, url) {
  const hostHeader = normalizeHostValue(request?.headers?.get?.('host') || request?.headers?.get?.('x-forwarded-host'));
  return hostHeader || normalizeHostValue(url.hostname || '');
}

function getStripeStatusSnapshot(env = process.env) {
  const secretKey = envValue(env, 'STRIPE_SECRET_KEY');
  const webhookSecret = envValue(env, 'STRIPE_WEBHOOK_SECRET');
  const publishableKey = envValue(env, 'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY');
  const returnOrigins = parseCsvEnv(envValue(env, 'RETURN_URL_ORIGINS'));
  const priceKeysConfigured = Object.keys(env || process.env).filter(
    (key) => key.startsWith('STRIPE_PRICE_') && trimEnv((env || process.env)[key])
  ).length;

  const secretMode = /^sk_live_/i.test(secretKey)
    ? 'live'
    : /^rk_live_/i.test(secretKey)
      ? 'live'
      : /^sk_test_/i.test(secretKey)
        ? 'test'
        : /^rk_test_/i.test(secretKey)
          ? 'test'
          : secretKey
            ? 'unknown'
            : null;

  const publishableKeyMode = /^pk_live_/i.test(publishableKey)
    ? 'live'
    : /^pk_test_/i.test(publishableKey)
      ? 'test'
      : publishableKey
        ? 'unknown'
        : null;

  return {
    configured: Boolean(secretKey),
    webhookConfigured: Boolean(webhookSecret),
    hasAnyPrice: priceKeysConfigured > 0,
    priceKeysConfigured,
    returnOrigins,
    returnOriginsConfigured: returnOrigins.length > 0,
    checkoutReady: Boolean(secretKey) && Boolean(webhookSecret) && priceKeysConfigured > 0 && returnOrigins.length > 0,
    secretMode,
    publishableKeyConfigured: Boolean(publishableKey),
    publishableKeyMode,
  };
}

function getSupabaseStatusSnapshot(env = process.env) {
  const publicUrl = envValue(env, 'EXPO_PUBLIC_SUPABASE_URL');
  const anonKey = envValue(env, 'EXPO_PUBLIC_SUPABASE_ANON_KEY');
  const serverUrl = envValue(env, 'SUPABASE_URL');
  const serviceRoleKey = envValue(env, 'SUPABASE_SERVICE_ROLE_KEY');

  const publicConfigured = Boolean(publicUrl && anonKey);
  const serverConfigured = Boolean(serverUrl && serviceRoleKey);

  return {
    configured: publicConfigured && serverConfigured,
    publicConfigured,
    serverConfigured,
    publicUrlConfigured: Boolean(publicUrl),
    anonKeyConfigured: Boolean(anonKey),
    serverUrlConfigured: Boolean(serverUrl),
    serviceRoleConfigured: Boolean(serviceRoleKey),
  };
}

function getNewsletterStatusSnapshot(env = process.env) {
  const enabled = isTruthyEnv(envValue(env, 'BREVO_ENABLED'));
  const apiKey = envValue(env, 'BREVO_API_KEY');
  const listIdRaw = envValue(env, 'BREVO_LIST_ID');
  const listId = Number.parseInt(listIdRaw, 10);
  const configured = Boolean(apiKey) && Number.isFinite(listId) && listId > 0;

  return {
    enabled,
    configured,
    ready: !enabled || configured,
    apiKeyConfigured: Boolean(apiKey),
    listIdConfigured: Number.isFinite(listId) && listId > 0,
  };
}

function normalizeKey(value) {
  return trimEnv(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getAllowedReturnOrigins(env = process.env) {
  return parseCsvEnv(envValue(env, 'RETURN_URL_ORIGINS'));
}

function isAllowedReturnOrigin(origin, env = process.env) {
  const allowedOrigins = getAllowedReturnOrigins(env);
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  if (isExpoHostingOrigin(origin)) {
    return true;
  }

  if (envValue(env, 'NODE_ENV').toLowerCase() !== 'production' && isLocalDevelopmentOrigin(origin)) {
    return true;
  }

  return false;
}

function getStripePriceCandidates(planId, interval) {
  const normalizedPlan = normalizeKey(planId);
  const normalizedInterval = normalizeKey(interval);
  const intervalSuffixes = [];

  if (normalizedInterval) {
    intervalSuffixes.push(normalizedInterval);
    if (normalizedInterval === 'MONTH') intervalSuffixes.push('MONTHLY');
    if (normalizedInterval === 'QUARTER') intervalSuffixes.push('QUARTERLY');
    if (normalizedInterval === 'YEAR') intervalSuffixes.push('YEARLY');
  }

  const candidates = [];
  for (const suffix of intervalSuffixes) {
    candidates.push(`STRIPE_PRICE_${normalizedPlan}_${suffix}`);
  }
  candidates.push(`STRIPE_PRICE_${normalizedPlan}`);
  return candidates;
}

function getStripePriceId(planId, interval, env = process.env) {
  for (const key of getStripePriceCandidates(planId, interval)) {
    const value = envValue(env, key);
    if (value) {
      return { key, value };
    }
  }
  return null;
}

function getBearerToken(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return '';
  }
  return authHeader.slice(7).trim();
}

function getSupabaseServerConfig(env = process.env) {
  return {
    url: envValue(env, 'SUPABASE_URL') || envValue(env, 'EXPO_PUBLIC_SUPABASE_URL'),
    serviceRoleKey: envValue(env, 'SUPABASE_SERVICE_ROLE_KEY'),
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAppOrigin(env = process.env) {
  const appUrl = envValue(env, 'EXPO_PUBLIC_APP_URL');
  if (appUrl) {
    try {
      const origin = new URL(appUrl).origin.replace(/\/+$/, '');
      if (origin === 'https://taze.to' || origin === 'https://www.taze.to') {
        return 'https://app.taze.to';
      }
      return origin;
    } catch {
      // Fall through to canonical app host.
    }
  }

  return 'https://app.taze.to';
}

function buildAppUrl(pathname, env = process.env) {
  const origin = getAppOrigin(env);
  const pathName = typeof pathname === 'string' && pathname.startsWith('/') ? pathname : `/${pathname || ''}`;
  return `${origin}${pathName}`;
}

function formatMinorCurrency(amountMinor, currency) {
  const amount = Number.isFinite(Number(amountMinor)) ? Number(amountMinor) / 100 : 0;
  const normalizedCurrency = String(currency || 'EUR').trim().toUpperCase() || 'EUR';

  try {
    return new Intl.NumberFormat('nl-BE', {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${normalizedCurrency}`;
  }
}

function formatBillingIntervalLabel(interval) {
  if (interval === 'month') return 'Maandelijks';
  if (interval === 'quarter') return 'Kwartaal';
  if (interval === 'year') return 'Jaarlijks';
  return trimEnv(interval) || '-';
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function supabaseRestRequest(env, path, { method = 'GET', body = null, token = null, headers = {} } = {}) {
  const { url, serviceRoleKey } = getSupabaseServerConfig(env);
  if (!url || !serviceRoleKey) {
    return { ok: false, status: 503, data: null, error: 'supabase_not_configured' };
  }

  const response = await fetch(`${url.replace(/\/+$/, '')}${path}`, {
    method,
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${token || serviceRoleKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data, error: data?.message || data?.error || null };
}

async function authenticateWorkerRequest(request, env = process.env) {
  const token = getBearerToken(request);
  if (!token) {
    return { ok: false, status: 401, error: 'missing_auth_token' };
  }

  const result = await supabaseRestRequest(env, '/auth/v1/user', { token });
  if (result.status === 503) {
    return { ok: false, status: 503, error: 'auth_not_configured' };
  }
  if (!result.ok || !result.data?.id) {
    return { ok: false, status: 401, error: 'invalid_auth_token' };
  }

  return { ok: true, user: result.data, token };
}

async function getWorkerMembership(env, userId) {
  const query = new URLSearchParams({
    select: 'role,permissions,company_id',
    user_id: `eq.${userId}`,
    status: 'eq.ACTIVE',
    limit: '1',
  });
  const result = await supabaseRestRequest(env, `/rest/v1/memberships?${query.toString()}`);
  if (!result.ok) {
    return { ok: false, status: result.status, membership: null };
  }
  const membership = Array.isArray(result.data) ? result.data[0] ?? null : null;
  return { ok: Boolean(membership), status: membership ? 200 : 403, membership };
}

async function workerHasPermission(env, membership, requiredPermission) {
  if (!membership) {
    return false;
  }
  if (membership.role === 'OWNER') {
    return true;
  }
  if (Array.isArray(membership.permissions) && membership.permissions.includes(requiredPermission)) {
    return true;
  }

  const query = new URLSearchParams({
    select: 'permission_key',
    role: `eq.${membership.role}`,
    permission_key: `eq.${requiredPermission}`,
    limit: '1',
  });
  const result = await supabaseRestRequest(env, `/rest/v1/role_permissions?${query.toString()}`);
  return result.ok && Array.isArray(result.data) && result.data.length > 0;
}

async function handleStripeCheckoutSession(request, env = process.env) {
  const secretKey = envValue(env, 'STRIPE_SECRET_KEY');
  if (!secretKey) {
    return jsonResponse({ error: 'stripe_not_configured' }, 503, request);
  }

  const body = await request.json().catch(() => ({}));
  const invoiceId = trimEnv(body.invoiceId || body.invoice_id);
  const invoiceNumber = trimEnv(body.invoiceNumber || body.invoice_number);
  const rawAmount = typeof body.amount === 'number' ? body.amount : Number.parseInt(trimEnv(body.amount), 10);
  const amount = Number.isFinite(rawAmount) ? Math.round(rawAmount) : 0;
  const currency = /^[a-z]{3}$/i.test(trimEnv(body.currency)) ? trimEnv(body.currency).toLowerCase() : 'eur';
  const planId = trimEnv(body.planId);
  const interval = trimEnv(body.interval).toLowerCase();
  const successUrl = trimEnv(body.successUrl);
  const cancelUrl = trimEnv(body.cancelUrl);
  const email = trimEnv(body.email);
  const paymentMethodId = trimEnv(body.paymentMethodId);

  let successOrigin = '';
  let cancelOrigin = '';
  try {
    successOrigin = new URL(successUrl).origin;
    cancelOrigin = new URL(cancelUrl).origin;
  } catch {
    return jsonResponse({ error: 'bad_return_url' }, 400, request);
  }

  if (!isAllowedReturnOrigin(successOrigin, env) || !isAllowedReturnOrigin(cancelOrigin, env)) {
    return jsonResponse({ error: 'bad_return_url' }, 400, request);
  }

  if (invoiceId || amount > 0) {
    if (!invoiceId || amount <= 0) {
      return jsonResponse({ error: 'invalid_invoice_checkout', hint: 'invoiceId_and_positive_amount_required' }, 400, request);
    }

    const form = new URLSearchParams();
    form.set('mode', 'payment');
    form.set('line_items[0][price_data][currency]', currency);
    form.set('line_items[0][price_data][product_data][name]', invoiceNumber ? `Factuur ${invoiceNumber}` : `Factuur ${invoiceId}`);
    form.set('line_items[0][price_data][unit_amount]', String(amount));
    form.set('line_items[0][quantity]', '1');
    form.set('success_url', successUrl);
    form.set('cancel_url', cancelUrl);
    form.set('allow_promotion_codes', 'true');
    form.set('locale', 'nl');
    form.set('metadata[invoiceId]', invoiceId);
    form.set('metadata[invoiceNumber]', invoiceNumber);
    form.set('metadata[source]', 'invoice');
    form.set('payment_intent_data[metadata][invoiceId]', invoiceId);
    form.set('payment_intent_data[metadata][invoiceNumber]', invoiceNumber);
    if (email) {
      form.set('customer_email', email);
    }

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2026-02-25.clover',
      },
      body: form.toString(),
    });
    const data = await stripeResponse.json().catch(() => null);

    if (!stripeResponse.ok || !data?.url) {
      const code = trimEnv(data?.error?.code);
      const type = trimEnv(data?.error?.type);
      if (stripeResponse.status === 401 || (type === 'invalid_request_error' && code === 'invalid_api_key')) {
        return jsonResponse({ error: 'stripe_error', hint: 'stripe_auth_error' }, 401, request);
      }
      return jsonResponse({ error: 'stripe_error', hint: 'stripe_server_error' }, 500, request);
    }

    return jsonResponse(
      {
        url: data.url,
        id: data.id,
        priceKey: 'invoice_amount',
        mode: 'payment',
      },
      200,
      request
    );
  }

  const price = getStripePriceId(planId, interval, env);
  if (!price) {
    return jsonResponse({ error: 'price_not_configured' }, 400, request);
  }

  const form = new URLSearchParams();
  form.set('mode', 'subscription');
  form.set('line_items[0][price]', price.value);
  form.set('line_items[0][quantity]', '1');
  form.set('success_url', successUrl);
  form.set('cancel_url', cancelUrl);
  form.set('allow_promotion_codes', 'true');
  form.set('locale', 'nl');
  form.set('metadata[planId]', planId);
  form.set('metadata[interval]', interval);
  form.set('metadata[paymentMethodId]', paymentMethodId);
  form.set('subscription_data[metadata][planId]', planId);
  form.set('subscription_data[metadata][interval]', interval);
  form.set('subscription_data[metadata][paymentMethodId]', paymentMethodId);
  if (email) {
    form.set('customer_email', email);
  }

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2026-02-25.clover',
    },
    body: form.toString(),
  });
  const data = await stripeResponse.json().catch(() => null);

  if (!stripeResponse.ok || !data?.url) {
    const code = trimEnv(data?.error?.code);
    const type = trimEnv(data?.error?.type);
    const message = trimEnv(data?.error?.message);
    if (stripeResponse.status === 401 || type === 'invalid_request_error' && code === 'invalid_api_key') {
      return jsonResponse({ error: 'stripe_error', hint: 'stripe_auth_error' }, 401, request);
    }
    if (code === 'resource_missing' || /no such price/i.test(message) || (/price/i.test(message) && /not/i.test(message))) {
      return jsonResponse({ error: 'stripe_error', hint: 'stripe_price_invalid' }, 400, request);
    }
    return jsonResponse({ error: 'stripe_error', hint: 'stripe_server_error' }, 500, request);
  }

  return jsonResponse(
    {
      url: data.url,
      id: data.id,
      priceKey: price.key,
    },
    200,
    request
  );
}

async function handleRefundRequest(request, env = process.env) {
  const auth = await authenticateWorkerRequest(request, env);
  if (!auth.ok) {
    return jsonResponse({ ok: false, error: auth.error }, auth.status, request);
  }

  const body = await request.json().catch(() => ({}));
  const checkoutSessionId = trimEnv(body.checkoutSessionId || body.checkout_session_id);
  const customerEmail = trimEnv(body.customerEmail || body.customer_email);
  const planId = trimEnv(body.planId || body.plan_id);
  const interval = trimEnv(body.interval).toLowerCase();
  const reason = trimEnv(body.reason);

  if (!checkoutSessionId || !customerEmail || !planId || !interval || !reason) {
    return jsonResponse({ ok: false, error: 'missing_required_fields' }, 400, request);
  }

  const membershipResult = await getWorkerMembership(env, auth.user.id);
  if (!membershipResult.ok || !membershipResult.membership) {
    return jsonResponse({ ok: false, error: 'insufficient_permissions' }, 403, request);
  }

  const canRequestRefund =
    (await workerHasPermission(env, membershipResult.membership, 'refund.request')) ||
    (await workerHasPermission(env, membershipResult.membership, 'finance.manage'));
  if (!canRequestRefund) {
    return jsonResponse({ ok: false, error: 'insufficient_permissions' }, 403, request);
  }

  return jsonResponse(
    {
      ok: false,
      error: 'refund_request_processing_unavailable',
      detail: 'Refund request validation is active in the Worker. Approval and storage are handled in a separate blocker.',
    },
    503,
    request
  );
}

function buildRefundResultPage({ title, headline, detail, primaryHref, primaryLabel, secondaryHref, secondaryLabel }) {
  const primaryButton = primaryHref
    ? `<a href="${escapeHtml(primaryHref)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">${escapeHtml(primaryLabel || 'Verder')}</a>`
    : '';
  const secondaryButton = secondaryHref
    ? `<a href="${escapeHtml(secondaryHref)}" style="display:inline-block;background:#e2e8f0;color:#0f172a;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">${escapeHtml(secondaryLabel || 'Terug')}</a>`
    : '';

  return `<!doctype html>
  <html lang="nl">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title)}</title>
      <style>
        body { margin: 0; font-family: Inter, Arial, sans-serif; background: #f8fafc; color: #0f172a; }
        main { max-width: 720px; margin: 0 auto; padding: 32px 20px 48px; }
        .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 24px; box-shadow: 0 18px 44px rgba(15, 23, 42, 0.08); }
        h1 { margin: 0 0 12px; font-size: 28px; line-height: 1.15; }
        p { margin: 0 0 14px; line-height: 1.65; }
        .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
      </style>
    </head>
    <body>
      <main>
        <section class="card">
          <h1>${escapeHtml(headline)}</h1>
          <p>${escapeHtml(detail)}</p>
          <div class="actions">
            ${primaryButton}
            ${secondaryButton}
          </div>
        </section>
      </main>
    </body>
  </html>`;
}

function buildRefundDecisionConfirmationPage({ action, token, customerEmail, planId, interval, amountLabel, reason, invoiceNumber, env }) {
  const isApprove = action === 'approve';
  const actionLabel = isApprove ? 'Goedkeuren' : 'Weigeren';
  const headline = isApprove ? 'Refund goedkeuren' : 'Refund weigeren';
  const amountText = amountLabel ? ` / ${escapeHtml(amountLabel)}` : '';
  const invoiceText = invoiceNumber ? ` / Factuurnummer: ${escapeHtml(invoiceNumber)}` : '';
  const reasonHtml = reason ? `<p style="margin:0 0 12px; font-size:0.95rem;"><strong>Reden:</strong> ${escapeHtml(reason)}</p>` : '';

  return `<!doctype html>
  <html lang="nl">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(headline)}</title>
      <style>
        body { margin: 0; font-family: Inter, Arial, sans-serif; background: #f8fafc; color: #0f172a; }
        main { max-width: 720px; margin: 0 auto; padding: 32px 20px 48px; }
        .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 24px; box-shadow: 0 18px 44px rgba(15, 23, 42, 0.08); }
        h1 { margin: 0 0 12px; font-size: 28px; line-height: 1.15; }
        p { margin: 0 0 14px; line-height: 1.65; }
        .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
        button { padding: 12px 18px; border-radius: 999px; border: none; cursor: pointer; font-weight: 700; }
        .primary { background: #0f172a; color: #fff; }
        .secondary { background: #e2e8f0; color: #0f172a; }
        .hint { color: #64748b; font-size: 0.92rem; }
      </style>
    </head>
    <body>
      <main>
        <section class="card">
          <h1>${escapeHtml(headline)}</h1>
          <p>Je staat op het punt de terugbetaling voor <strong>${escapeHtml(customerEmail)}</strong> te ${isApprove ? 'goedkeuren' : 'weigeren'}.</p>
          <p style="margin:0 0 12px; color:#475569;">${escapeHtml(planId)} / ${escapeHtml(formatBillingIntervalLabel(interval))}${amountText}${invoiceText}</p>
          ${reasonHtml}
          <p class="hint">Log in in Taze en bevestig deze actie vanuit een sessie met refund-beheerrechten.</p>
          <div class="actions">
            <button id="decision-button" class="primary">${escapeHtml(actionLabel)}</button>
            <button id="cancel-button" class="secondary" type="button">Annuleren</button>
          </div>
        </section>
      </main>
      <script>
        const token = ${JSON.stringify(token)};
        const actionPath = ${JSON.stringify(`/api/refunds/${action}`)};
        document.getElementById('cancel-button').addEventListener('click', () => {
          location.href = ${JSON.stringify(buildAppUrl('/support', env))};
        });

        document.getElementById('decision-button').addEventListener('click', async () => {
          const button = document.getElementById('decision-button');
          button.disabled = true;
          button.textContent = 'Bezig...';

          try {
            const response = await fetch(actionPath + '?token=' + encodeURIComponent(token), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token }),
            });
            const html = await response.text();
            document.open();
            document.write(html);
            document.close();
          } catch (error) {
            console.error(error);
            button.textContent = 'Probeer opnieuw';
            button.disabled = false;
          }
        });
      </script>
    </body>
  </html>`;
}

async function getRefundRequestByToken(env, token) {
  const tokenHash = await sha256Hex(token);
  const query = new URLSearchParams({
    select: '*',
    approval_token_hash: `eq.${tokenHash}`,
    limit: '1',
  });
  const result = await supabaseRestRequest(env, `/rest/v1/refund_requests?${query.toString()}`);
  if (!result.ok) {
    return { ok: false, status: result.status, request: null, error: result.error || 'refund_request_lookup_failed' };
  }
  const refundRequest = Array.isArray(result.data) ? result.data[0] ?? null : null;
  return { ok: Boolean(refundRequest), status: refundRequest ? 200 : 404, request: refundRequest };
}

async function updateRefundRequest(env, id, patch) {
  const query = new URLSearchParams({ id: `eq.${id}` });
  return supabaseRestRequest(env, `/rest/v1/refund_requests?${query.toString()}`, {
    method: 'PATCH',
    body: patch,
    headers: { Prefer: 'return=minimal' },
  });
}

async function updateStripeCheckoutPayment(env, checkoutSessionId, patch) {
  const query = new URLSearchParams({ checkout_session_id: `eq.${checkoutSessionId}` });
  return supabaseRestRequest(env, `/rest/v1/stripe_checkout_payments?${query.toString()}`, {
    method: 'PATCH',
    body: patch,
    headers: { Prefer: 'return=minimal' },
  });
}

async function findWorkerStripeCheckoutPayment(env, { checkoutSessionId, customerEmail, planId, interval, companyId }) {
  if (checkoutSessionId) {
    const query = new URLSearchParams({
      select: '*',
      checkout_session_id: `eq.${checkoutSessionId}`,
      limit: '1',
    });
    if (companyId) {
      query.set('company_id', `eq.${companyId}`);
    }
    const result = await supabaseRestRequest(env, `/rest/v1/stripe_checkout_payments?${query.toString()}`);
    if (!result.ok) {
      return { ok: false, payment: null, status: result.status, error: result.error || 'payment_lookup_failed' };
    }
    const payment = Array.isArray(result.data) ? result.data[0] ?? null : null;
    if (payment) {
      return { ok: true, payment };
    }
  }

  if (!customerEmail || !planId || !interval) {
    return { ok: false, payment: null, status: 404, error: 'payment_not_found' };
  }

  const query = new URLSearchParams({
    select: '*',
    customer_email: `eq.${customerEmail}`,
    plan_id: `eq.${planId}`,
    interval: `eq.${interval}`,
    refund_status: 'neq.refunded',
    order: 'created_at.desc',
    limit: '1',
  });
  if (companyId) {
    query.set('company_id', `eq.${companyId}`);
  }
  const result = await supabaseRestRequest(env, `/rest/v1/stripe_checkout_payments?${query.toString()}`);
  if (!result.ok) {
    return { ok: false, payment: null, status: result.status, error: result.error || 'payment_lookup_failed' };
  }
  const payment = Array.isArray(result.data) ? result.data[0] ?? null : null;
  return { ok: Boolean(payment), payment, status: payment ? 200 : 404, error: payment ? null : 'payment_not_found' };
}

async function createStripeRefund(env, refundRequest, payment) {
  const secretKey = envValue(env, 'STRIPE_SECRET_KEY');
  if (!secretKey) {
    return { ok: false, status: 503, error: 'stripe_not_configured' };
  }

  const form = new URLSearchParams();
  if (payment.stripe_payment_intent_id) {
    form.set('payment_intent', payment.stripe_payment_intent_id);
  } else if (payment.stripe_charge_id) {
    form.set('charge', payment.stripe_charge_id);
  } else {
    return { ok: false, status: 503, error: 'missing_payment_reference' };
  }
  form.set('reason', 'requested_by_customer');
  form.set('metadata[refund_request_id]', refundRequest.id);
  form.set('metadata[customer_email]', refundRequest.customer_email);
  form.set('metadata[plan_id]', refundRequest.plan_id);
  form.set('metadata[interval]', refundRequest.interval);

  const response = await fetch('https://api.stripe.com/v1/refunds', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2026-02-25.clover',
    },
    body: form.toString(),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.id) {
    return {
      ok: false,
      status: response.status || 502,
      error: data?.error?.message || data?.error?.code || 'refund_failed',
    };
  }

  return { ok: true, refund: data };
}

async function logWorkerAuditEvent(env, action, userId, companyId, details = {}) {
  await supabaseRestRequest(env, '/rest/v1/audit_events', {
    method: 'POST',
    body: {
      action,
      user_id: userId,
      company_id: companyId,
      details,
      created_at: new Date().toISOString(),
    },
    headers: { Prefer: 'return=minimal' },
  }).catch(() => null);
}

async function renderRefundDecisionConfirmation(request, env, action) {
  const url = new URL(request.url);
  const token = trimEnv(url.searchParams.get('token'));
  if (!token) {
    return htmlResponse(
      buildRefundResultPage({
        title: 'Refund token ontbreekt',
        headline: 'Geen geldige goedkeuringslink',
        detail: 'De goedkeuringslink mist een token. Open de mail opnieuw en gebruik de knop uit de laatste refund-mail.',
        primaryHref: buildAppUrl('/support', env),
        primaryLabel: 'Open support',
      }),
      400,
      request,
      'api',
      API_HOST,
      env
    );
  }

  const lookup = await getRefundRequestByToken(env, token);
  if (!lookup.ok || !lookup.request) {
    return htmlResponse(
      buildRefundResultPage({
        title: lookup.status === 503 ? 'Refund fout' : 'Refund niet gevonden',
        headline: lookup.status === 503 ? 'Kon de refund-aanvraag niet laden' : 'Deze goedkeuringslink is niet geldig',
        detail:
          lookup.status === 503
            ? 'De server kon de aanvraag niet uitlezen. Probeer de link opnieuw of open support.'
            : 'De token bestaat niet meer of hoort niet bij een actieve refund-aanvraag.',
        primaryHref: buildAppUrl('/support', env),
        primaryLabel: 'Open support',
      }),
      lookup.status || 404,
      request,
      'api',
      API_HOST,
      env
    );
  }

  return htmlResponse(
    buildRefundDecisionConfirmationPage({
      action,
      token,
      customerEmail: lookup.request.customer_email,
      planId: lookup.request.plan_id,
      interval: lookup.request.interval,
      amountLabel: formatMinorCurrency(Number(lookup.request.amount_total ?? 0), lookup.request.currency),
      reason: lookup.request.reason,
      invoiceNumber: lookup.request.invoice_number,
      env,
    }),
    200,
    request,
    'api',
    API_HOST,
    env
  );
}

async function handleRefundDecision(request, env = process.env, action = 'approve') {
  const method = request.method.toUpperCase();
  if (method === 'GET') {
    return renderRefundDecisionConfirmation(request, env, action);
  }

  if (method !== 'POST') {
    return htmlResponse('Method not allowed', 405, request, 'api', API_HOST, env);
  }

  const auth = await authenticateWorkerRequest(request, env);
  if (!auth.ok) {
    return htmlResponse(
      buildRefundResultPage({
        title: 'Login vereist',
        headline: 'Log in om refunds te beheren',
        detail: auth.error === 'missing_auth_token' ? 'Open Taze en bevestig deze refund vanuit een geldige sessie.' : 'Je sessie kon niet worden bevestigd.',
        primaryHref: buildAppUrl('/account', env),
        primaryLabel: 'Ga naar login',
      }),
      auth.status,
      request,
      'api',
      API_HOST,
      env
    );
  }

  const membershipResult = await getWorkerMembership(env, auth.user.id);
  const canManageRefunds =
    membershipResult.ok &&
    membershipResult.membership &&
    ((await workerHasPermission(env, membershipResult.membership, 'refund.manage')) ||
      (await workerHasPermission(env, membershipResult.membership, 'finance.manage')));
  if (!canManageRefunds) {
    return htmlResponse(
      buildRefundResultPage({
        title: 'Geen toegang',
        headline: 'Je hebt geen toestemming om refunds te beheren',
        detail: 'Alleen gebruikers met refund-beheer permissies kunnen deze actie uitvoeren.',
        primaryHref: buildAppUrl('/support', env),
        primaryLabel: 'Open support',
      }),
      403,
      request,
      'api',
      API_HOST,
      env
    );
  }

  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const token = trimEnv(body.token || url.searchParams.get('token'));
  if (!token) {
    return htmlResponse(
      buildRefundResultPage({
        title: 'Refund token ontbreekt',
        headline: 'Geen geldige goedkeuringslink',
        detail: 'De goedkeuringslink mist een token. Open de mail opnieuw en gebruik de knop uit de laatste refund-mail.',
        primaryHref: buildAppUrl('/support', env),
        primaryLabel: 'Open support',
      }),
      400,
      request,
      'api',
      API_HOST,
      env
    );
  }

  const lookup = await getRefundRequestByToken(env, token);
  const refundRequest = lookup.request;
  if (!lookup.ok || !refundRequest) {
    return htmlResponse(
      buildRefundResultPage({
        title: 'Refund niet gevonden',
        headline: 'Deze goedkeuringslink is niet geldig',
        detail: 'De token bestaat niet meer of hoort niet bij een actieve refund-aanvraag.',
        primaryHref: buildAppUrl('/support', env),
        primaryLabel: 'Open support',
      }),
      lookup.status || 404,
      request,
      'api',
      API_HOST,
      env
    );
  }

  const canProcessDecision = ['pending', 'email_failed', 'failed'].includes(String(refundRequest.status));
  if (refundRequest.status === 'refunded') {
    return htmlResponse(
      buildRefundResultPage({
        title: 'Refund al uitgevoerd',
        headline: 'Deze terugbetaling is al afgerond',
        detail: `De Stripe-refund voor ${refundRequest.customer_email} is al verwerkt. Bedrag: ${formatMinorCurrency(Number(refundRequest.amount_total ?? 0), refundRequest.currency)}.`,
        primaryHref: buildAppUrl('/payments', env),
        primaryLabel: 'Open payments',
      }),
      200,
      request,
      'api',
      API_HOST,
      env
    );
  }
  if (!canProcessDecision || (refundRequest.status === 'rejected' && action === 'approve')) {
    return htmlResponse(
      buildRefundResultPage({
        title: 'Refund status',
        headline: 'Deze terugbetalingsaanvraag is al verwerkt',
        detail: 'Open support als je een nieuwe aanvraag wilt starten of als je de beslissing wilt laten nakijken.',
        primaryHref: buildAppUrl('/support', env),
        primaryLabel: 'Open support',
      }),
      409,
      request,
      'api',
      API_HOST,
      env
    );
  }

  const approvalExpiresAt = new Date(refundRequest.approval_expires_at);
  if (Number.isNaN(approvalExpiresAt.getTime()) || approvalExpiresAt.getTime() < Date.now()) {
    await updateRefundRequest(env, refundRequest.id, {
      status: 'expired',
      updated_at: new Date().toISOString(),
    });
    return htmlResponse(
      buildRefundResultPage({
        title: 'Refund verlopen',
        headline: 'Deze goedkeuringslink is verlopen',
        detail: 'Vraag een nieuwe refund-aanvraag vanuit de app of contacteer support.',
        primaryHref: buildAppUrl('/support', env),
        primaryLabel: 'Open support',
      }),
      410,
      request,
      'api',
      API_HOST,
      env
    );
  }

  const now = new Date().toISOString();
  if (action === 'reject') {
    await updateRefundRequest(env, refundRequest.id, {
      status: 'rejected',
      rejected_at: now,
      updated_at: now,
    });
    await logWorkerAuditEvent(env, 'refund.rejected', auth.user.id, membershipResult.membership.company_id, {
      refund_request_id: refundRequest.id,
      customer_email: refundRequest.customer_email,
      amount: refundRequest.amount_total,
      currency: refundRequest.currency,
    });

    return htmlResponse(
      buildRefundResultPage({
        title: 'Refund geweigerd',
        headline: 'De terugbetalingsaanvraag is geweigerd',
        detail: `Er is geen Stripe-refund uitgevoerd. Cyclus: ${formatBillingIntervalLabel(refundRequest.interval)}.`,
        primaryHref: buildAppUrl('/support', env),
        primaryLabel: 'Open support',
      }),
      200,
      request,
      'api',
      API_HOST,
      env
    );
  }

  const paymentLookup = await findWorkerStripeCheckoutPayment(env, {
    checkoutSessionId: refundRequest.checkout_session_id,
    customerEmail: refundRequest.customer_email,
    planId: refundRequest.plan_id,
    interval: refundRequest.interval,
    companyId: refundRequest.company_id,
  });
  if (!paymentLookup.ok || !paymentLookup.payment) {
    await updateRefundRequest(env, refundRequest.id, {
      status: 'failed',
      stripe_refund_error: paymentLookup.error || 'payment_not_found',
      updated_at: now,
    });
    return htmlResponse(
      buildRefundResultPage({
        title: 'Betaling niet gevonden',
        headline: 'De originele Stripe-betaling kon niet worden gevonden',
        detail: 'De checkout-session of payment intent is nog niet teruggevonden. Controleer of de webhook succesvol heeft opgeslagen.',
        primaryHref: buildAppUrl('/payments', env),
        primaryLabel: 'Open payments',
      }),
      404,
      request,
      'api',
      API_HOST,
      env
    );
  }

  const refundResult = await createStripeRefund(env, refundRequest, paymentLookup.payment);
  if (!refundResult.ok) {
    await updateRefundRequest(env, refundRequest.id, {
      status: 'failed',
      stripe_refund_error: refundResult.error,
      updated_at: now,
    });
    return htmlResponse(
      buildRefundResultPage({
        title: refundResult.error === 'missing_payment_reference' ? 'Refund reference ontbreekt' : 'Refund mislukt',
        headline: refundResult.error === 'missing_payment_reference' ? 'Geen Stripe payment intent of charge gevonden' : 'Stripe kon de terugbetaling niet uitvoeren',
        detail: refundResult.error,
        primaryHref: buildAppUrl('/support', env),
        primaryLabel: 'Open support',
      }),
      refundResult.status || 502,
      request,
      'api',
      API_HOST,
      env
    );
  }

  await updateRefundRequest(env, refundRequest.id, {
    status: 'refunded',
    stripe_refund_id: refundResult.refund.id,
    approved_at: now,
    refunded_at: now,
    updated_at: now,
  });
  await updateStripeCheckoutPayment(env, paymentLookup.payment.checkout_session_id, {
    refund_status: 'refunded',
    payment_status: 'refunded',
    refunded_at: now,
    updated_at: now,
    metadata: {
      ...(paymentLookup.payment.metadata || {}),
      refund_request_id: refundRequest.id,
      stripe_refund_id: refundResult.refund.id,
    },
  });
  await logWorkerAuditEvent(env, 'refund.approved', auth.user.id, membershipResult.membership.company_id, {
    refund_request_id: refundRequest.id,
    stripe_refund_id: refundResult.refund.id,
    customer_email: refundRequest.customer_email,
    amount: refundRequest.amount_total,
    currency: refundRequest.currency,
  });

  return htmlResponse(
    buildRefundResultPage({
      title: 'Refund uitgevoerd',
      headline: 'De Stripe-refund is uitgevoerd',
      detail: `Terugbetaling voor ${refundRequest.customer_email} is succesvol verwerkt. Refund-ID: ${refundResult.refund.id}.`,
      primaryHref: buildAppUrl('/payments', env),
      primaryLabel: 'Open payments',
    }),
    200,
    request,
    'api',
    API_HOST,
    env
  );
}

function getOpenAiStatusSnapshot(env = process.env) {
  const apiKey = envValue(env, 'OPENAI_API_KEY');
  return {
    configured: Boolean(apiKey),
    ready: Boolean(apiKey),
    status: apiKey ? 'configured' : 'missing',
    detail: apiKey ? 'OpenAI secret aanwezig' : 'OpenAI secret ontbreekt',
  };
}

function normalizeRecognition(payload, input = {}) {
  const barcode = typeof input.barcode === 'string' ? input.barcode.trim() : null;
  const fallback = {
    name: barcode ? `Onbekende barcode ${barcode}` : 'Onbekend product',
    category: 'Controle nodig',
    quantity: 1,
    expiryDays: null,
    confidence: 0.35,
    notes: 'Geen betrouwbare herkenning beschikbaar.',
    source: barcode ? 'barcode-unknown' : 'live-unavailable',
    barcode,
    batchCode: null,
    lotNumber: null,
    recallFlag: false,
  };

  return {
    name: payload?.name ?? fallback.name,
    category: payload?.category ?? fallback.category,
    quantity: Math.max(1, Number(payload?.quantity ?? fallback.quantity ?? 1)),
    expiryDays:
      payload?.expiryDays ?? payload?.expiry ?? fallback.expiryDays ?? null,
    confidence: Math.min(0.99, Math.max(0.25, Number(payload?.confidence ?? fallback.confidence ?? 0.6))),
    notes: payload?.notes ?? fallback.notes,
    source: payload?.source ?? fallback.source,
    barcode: payload?.barcode ?? barcode,
    batchCode: payload?.batchCode ?? fallback.batchCode ?? null,
    lotNumber: payload?.lotNumber ?? fallback.lotNumber ?? null,
    recallFlag: Boolean(payload?.recallFlag ?? fallback.recallFlag ?? false),
  };
}

function inferExpiryFromText(text) {
  const haystack = String(text || '').toLowerCase();
  if (!haystack) return null;
  if (/(milk|melk|yoghurt|yogurt|cream|room|cheese|kaas)/i.test(haystack)) return 5;
  if (/(bread|brood|bakery|bake|pastry|gebak)/i.test(haystack)) return 2;
  if (/(meat|vlees|chicken|kip|fish|vis|salmon|salm)/i.test(haystack)) return 3;
  if (/(fruit|groente|vegetable|vegetables|salad|sla)/i.test(haystack)) return 4;
  if (/(frozen|diepvries)/i.test(haystack)) return 30;
  return 14;
}

function inferCategoryFromText(text) {
  const haystack = String(text || '').toLowerCase();
  if (/(milk|melk|yoghurt|yogurt|cream|room|cheese|kaas|dairy)/i.test(haystack)) return 'Zuivel';
  if (/(bread|brood|bakery|bake|pastry|gebak)/i.test(haystack)) return 'Bakery';
  if (/(meat|vlees|chicken|kip|fish|vis|salmon|salm)/i.test(haystack)) return 'Vers';
  if (/(fruit|groente|vegetable|vegetables|salad|sla)/i.test(haystack)) return 'Vers';
  if (/(drink|drank|water|cola|juice|sap|beer|wijn)/i.test(haystack)) return 'Dranken';
  return 'Algemeen';
}

function inferProductFromBarcode(barcode) {
  const value = String(barcode || '').trim();
  if (!value) return null;

  if (value.startsWith('20') || value.startsWith('21')) {
    return {
      name: 'Vers toonbankproduct',
      category: 'Vers',
      quantity: 1,
      expiryDays: 1,
      confidence: 0.72,
      notes: 'Barcodepatroon wijst op een vers of intern geprijsd winkelproduct.',
      source: 'barcode-pattern',
      barcode: value,
      batchCode: null,
      lotNumber: null,
      recallFlag: false,
    };
  }

  if (value.startsWith('87')) {
    return {
      name: 'Verpakt supermarktproduct',
      category: 'Algemeen',
      quantity: 1,
      expiryDays: 5,
      confidence: 0.67,
      notes: 'Barcodepatroon lijkt op een standaard retailproduct.',
      source: 'barcode-pattern',
      barcode: value,
      batchCode: null,
      lotNumber: null,
      recallFlag: false,
    };
  }

  if (value.startsWith('54')) {
    return {
      name: 'Belgisch winkelproduct',
      category: 'Algemeen',
      quantity: 1,
      expiryDays: 4,
      confidence: 0.65,
      notes: 'Barcodepatroon wijst op een Belgisch retailproduct.',
      source: 'barcode-pattern',
      barcode: value,
      batchCode: null,
      lotNumber: null,
      recallFlag: false,
    };
  }

  return null;
}

async function lookupOpenFoodFacts(barcode) {
  const clean = String(barcode || '').trim();
  if (!clean) return null;

  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(clean)}.json`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json().catch(() => null);
    if (!data || Number(data.status) !== 1 || !data.product) {
      return null;
    }

    const product = data.product;
    const name =
      product.product_name ||
      product.generic_name ||
      product.product_name_en ||
      product.product_name_nl ||
      `Product ${clean}`;
    const categoryText =
      product.categories ||
      product.generic_name ||
      product.abbreviated_product_name ||
      product.product_name ||
      '';
    const category = inferCategoryFromText(categoryText);
    const expiryDays = inferExpiryFromText(`${name} ${categoryText}`);

    return normalizeRecognition(
      {
        name,
        category,
        quantity: 1,
        expiryDays,
        confidence: 0.88,
        notes: `Barcode ${clean} gevonden via OpenFoodFacts.`,
        source: 'openfoodfacts',
        barcode: clean,
        batchCode: null,
        lotNumber: null,
        recallFlag: false,
      },
      { barcode: clean }
    );
  } catch {
    return null;
  }
}

function parseRecognitionPromptInput(input) {
  const barcode = typeof input?.barcode === 'string' ? input.barcode.trim() : '';
  const imageBase64 = typeof input?.imageBase64 === 'string' ? input.imageBase64.trim() : '';
  const imageUri = typeof input?.imageUri === 'string' ? input.imageUri.trim() : '';
  const catalogSeed = input?.catalogSeed && typeof input.catalogSeed === 'object' ? input.catalogSeed : null;

  return { barcode, imageBase64, imageUri, catalogSeed };
}

function buildImageUrl(imageBase64, imageUri) {
  if (imageBase64) {
    return imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
  }

  if (imageUri && /^data:image\//i.test(imageUri)) {
    return imageUri;
  }

  if (imageUri && /^https?:\/\//i.test(imageUri)) {
    return imageUri;
  }

  return null;
}

async function openAiChatCompletion({ env = process.env, model, messages, responseFormat }) {
  const apiKey = envValue(env, 'OPENAI_API_KEY');
  if (!apiKey) {
    const error = new Error('OpenAI secret ontbreekt');
    error.status = 503;
    throw error;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || envValue(env, 'OPENAI_MODEL') || DEFAULT_OPENAI_MODEL,
      messages,
      temperature: 0.2,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(detail || `OpenAI error ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

async function recognizeViaOpenAI(input, seed, env = process.env) {
  const imageUrl = buildImageUrl(input.imageBase64, input.imageUri);
  if (!imageUrl) {
    return null;
  }

  const prompt = {
    barcode: input.barcode || null,
    seed,
    goal:
      'Herken het product op de foto. Geef JSON terug met name, category, quantity, expiryDays, confidence, notes, source, barcode, batchCode, lotNumber, recallFlag.',
  };

  const result = await openAiChatCompletion({
    env,
    model: 'gpt-4.1',
    responseFormat: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Je bent de productherkenning van Taze. Antwoord alleen in geldige JSON met de velden name, category, quantity, expiryDays, confidence, notes, source, barcode, batchCode, lotNumber en recallFlag.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: JSON.stringify(prompt, null, 2),
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'high',
            },
          },
        ],
      },
    ],
  });

  const content = result?.choices?.[0]?.message?.content;
  if (!content) {
    return null;
  }

  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    return normalizeRecognition(parsed, input);
  } catch {
    return null;
  }
}

function normalizeQuestion(question) {
  return typeof question === 'string' ? question.trim() : '';
}

function normalizeAvailableActions(availableActions) {
  return Array.isArray(availableActions)
    ? availableActions.filter((action) => action && typeof action.kind === 'string' && typeof action.label === 'string')
    : [];
}

const ROUTE_BY_SCREEN = {
  account: '/account',
  contact: '/contact',
  newsletter: '/newsletter',
  payments: '/payments',
  partners: '/partners',
  privacy: '/privacy',
  security: '/security',
  services: '/services',
  support: '/support',
  trace: '/trace',
  transport: '/transport',
  updates: '/updates',
  explore: '/explore',
  scan: '/scan',
  helpdesk: '/support',
};

function inferRecommendedRoute(screen) {
  if (typeof screen !== 'string') {
    return '/explore';
  }

  return ROUTE_BY_SCREEN[screen.toLowerCase()] ?? '/explore';
}

function normalizeCopilotResponse(payload, fallbackContext) {
  const route = typeof payload?.recommendedRoute === 'string' ? payload.recommendedRoute.trim() : '';
  const recommendedRoute =
    ROUTE_BY_SCREEN[route.toLowerCase()] ?? (route.startsWith('/') ? route : inferRecommendedRoute(fallbackContext.screen));

  return {
    ok: true,
    title: typeof payload?.title === 'string' && payload.title.trim() ? payload.title.trim() : 'AI copilot',
    answer: typeof payload?.answer === 'string' && payload.answer.trim() ? payload.answer.trim() : 'Ik geef je direct het meest relevante scherm.',
    recommendedRoute,
    recommendedLabel:
      typeof payload?.recommendedLabel === 'string' && payload.recommendedLabel.trim()
        ? payload.recommendedLabel.trim()
        : 'Open aanbevolen scherm',
    model: fallbackContext.model || DEFAULT_RIA_MODEL,
    actionKind: null,
    actionLabel: null,
    language: typeof payload?.language === 'string' && payload.language.trim() ? payload.language.trim() : fallbackContext.language,
  };
}

function buildFallbackCopilotPayload({ screen, language, question, model = DEFAULT_RIA_MODEL }) {
  return {
    title: 'AI copilot',
    answer:
      question.length > 0
        ? `Ik kan nu geen live AI-antwoord ophalen voor "${question}", dus ik geef een veilige fallback op basis van het huidige scherm.`
        : 'Ik kan nu geen live AI-antwoord ophalen, dus ik geef een veilige fallback op basis van het huidige scherm.',
    recommendedRoute: inferRecommendedRoute(screen),
    recommendedLabel: 'Open aanbevolen scherm',
    model,
    actionKind: null,
    actionLabel: null,
    language,
  };
}

async function handleHealth(request, env = process.env) {
  const apiKey = envValue(env, 'OPENAI_API_KEY');
  const stripeStatus = getStripeStatusSnapshot(env);
  const supabaseStatus = getSupabaseStatusSnapshot(env);
  const newsletterStatus = getNewsletterStatusSnapshot(env);
  const demo = isTruthyEnv(envValue(env, 'EXPO_PUBLIC_DEMO_MODE'));
  const databaseConnected = Boolean(
    supabaseStatus.configured && supabaseStatus.publicConfigured && supabaseStatus.serverConfigured
  );

  return jsonResponse(
    {
      ok: true,
      mode: demo ? 'demo' : 'live',
      demo,
      apiConnected: true,
      databaseConnected,
      runtime: 'cloudflare',
      serveWebUi: false,
      aiConfigured: Boolean(apiKey),
      aiReady: Boolean(apiKey),
      aiStatus: apiKey ? 'configured' : 'missing',
      aiDetail: apiKey ? 'OpenAI secret aanwezig' : 'OpenAI secret ontbreekt',
      supabaseConfigured: supabaseStatus.configured,
      supabasePublicConfigured: supabaseStatus.publicConfigured,
      supabaseServerConfigured: supabaseStatus.serverConfigured,
      stripeConfigured: stripeStatus.configured,
      stripeCheckoutReady: stripeStatus.checkoutReady,
      stripePublishableConfigured: stripeStatus.publishableKeyConfigured,
      stripePublishableMode: stripeStatus.publishableKeyMode,
      stripeSecretMode: stripeStatus.secretMode,
      newsletterEnabled: newsletterStatus.enabled,
      newsletterConfigured: newsletterStatus.configured,
      newsletterReady: newsletterStatus.ready,
    },
    200,
    request
  );
}

async function handleCopilotRequest(request, env = process.env) {
  const body = await request.json().catch(() => ({}));
  const question = normalizeQuestion(body.question);
  const screen = typeof body.screen === 'string' ? body.screen : 'explore';
  const language = typeof body.language === 'string' && body.language.trim() ? body.language.trim() : 'Nederlands';
  const context = body.context ?? {};
  const availableActions = normalizeAvailableActions(body.availableActions);
  const riaModel = getRiaModel(env);

  if (question.length < 3) {
    return jsonResponse({ ok: false, error: 'question_too_short' }, 400, request);
  }

  const fallback = buildFallbackCopilotPayload({
    screen,
    language,
    question,
    model: riaModel,
  });

  try {
    const result = await openAiChatCompletion({
      env,
      model: riaModel,
      responseFormat: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Je bent RIA, de AI-copilot van de Taze-app. Werk strikt adviserend: leg uit, adviseer, vertaal, waarschuw, stel de volgende stap voor, signaleer ontbrekende info, toon risico en vat samen. Gebruik alleen context van de actieve tenant, company, branch, rol, functies en permissies. Je beslist nooit en je geeft geen uitvoerbare actie. Verander geen memberships, rollen, tenanttoegang, Stripe, pricing, betalingen of voorraad. Maak geen factuur definitief, start geen betaling, verstuur geen mail, wijs geen chauffeur definitief toe en simuleer geen klantbevestiging. Elke SaaS-actie blijft expliciet mens-bevestigd in de app. Antwoord in JSON met title, answer, recommendedRoute, recommendedLabel en model. actionKind en actionLabel moeten null blijven.',
        },
        {
          role: 'user',
          content: JSON.stringify(
            {
              screen,
              question,
              language,
              context,
              availableActions,
              allowedRoutes: Object.values(ROUTE_BY_SCREEN).concat('/explore'),
            },
            null,
            2
          ),
        },
      ],
    });

    const content = result?.choices?.[0]?.message?.content;
    if (!content) {
      return jsonResponse({ ok: false, error: 'ai_invalid_response' }, 502, request);
    }

    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    return jsonResponse(
      normalizeCopilotResponse(parsed, {
        screen,
        language,
        model: riaModel,
        actionKind: null,
        actionLabel: null,
      }),
      200,
      request
    );
  } catch (error) {
    const status = Number(error?.status ?? error?.statusCode ?? 0);
    if (status === 401 || status === 403) {
      return jsonResponse({ ok: false, error: 'openai_auth_error' }, 401, request);
    }
    if (status === 429) {
      return jsonResponse({ ok: false, error: 'openai_rate_limited' }, 429, request);
    }

    console.error('AI copilot fout:', error);
    if (isTruthyEnv(envValue(env, 'EXPO_PUBLIC_DEMO_MODE'))) {
      return jsonResponse(fallback, 200, request);
    }

    return jsonResponse({ ok: false, error: 'openai_unavailable' }, 503, request);
  }
}

async function handleHelpdeskAiRequest(request, env = process.env) {
  const body = await request.json().catch(() => ({}));
  const headers = new Headers(request.headers);
  headers.set('Content-Type', 'application/json');
  headers.delete('Content-Length');

  return handleCopilotRequest(
    new Request(request.url, {
      method: request.method,
      headers,
      body: JSON.stringify({
        ...body,
        screen: typeof body.screen === 'string' && body.screen.trim() ? body.screen : 'helpdesk',
      }),
    }),
    env
  );
}

async function handleRecognizeRequest(request, env = process.env) {
  const body = await request.json().catch(() => ({}));
  const rawBarcode = typeof body.barcode === 'string' ? body.barcode : '';
  const rawImageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
  const rawImageUri = typeof body.imageUri === 'string' ? body.imageUri : '';
  const rawOcrText = typeof body.ocrText === 'string' ? body.ocrText : '';

  if (rawBarcode.length > 128) {
    return jsonResponse({ ok: false, error: 'barcode_too_long' }, 400, request);
  }

  if (rawImageUri.length > 2048) {
    return jsonResponse({ ok: false, error: 'image_uri_too_long' }, 400, request);
  }

  if (rawImageBase64.length > 512 * 1024) {
    return jsonResponse({ ok: false, error: 'image_base64_too_long' }, 400, request);
  }

  // Authenticate user - simplified for worker
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ ok: false, error: 'missing_auth_token' }, 401, request);
  }

  // For now, accept any bearer token in worker - auth is handled upstream

  if (!rawBarcode && !rawImageBase64 && !rawImageUri) {
    return jsonResponse({ ok: false, error: 'recognition_input_missing' }, 400, request);
  }

  const input = {
    barcode: rawBarcode,
    imageBase64: rawImageBase64,
    imageUri: rawImageUri,
    ocrText: rawOcrText,
  };
  const inputSeed = coerceRecognitionSeed(body.catalogSeed, input);
  const barcode = normalizeBarcodeValue(input.barcode);

  let seed = inputSeed;

  if (barcode && !seed && isTruthyEnv(envValue(env, 'EXPO_PUBLIC_DEMO_MODE'))) {
    const localMatch = KNOWN_BARCODES[barcode];
    if (localMatch) {
      seed = normalizeRecognition(
        {
          ...localMatch,
          barcode,
          source: input.imageBase64 ? 'foto + barcode' : localMatch.source,
          notes: input.imageBase64
            ? `${localMatch.notes} Foto is meegestuurd voor extra context.`
            : localMatch.notes,
          batchCode: null,
          lotNumber: null,
          recallFlag: false,
        },
        input
      );
    }
  }

  if (barcode && !seed && !input.imageBase64 && !input.imageUri) {
    const external = await lookupOpenFoodFactsBarcode(barcode);
    if (external) {
      const normalized = normalizeRecognition(external, input);
      return jsonResponse(buildRecognizeResponse(normalized, 'barcode', input), 200, request);
    }
  }

  if (!seed && barcode) {
    const external = await lookupOpenFoodFactsBarcode(barcode);
    if (external) {
      seed = normalizeRecognition(external, input);
    }
  }

  if (!seed) {
    const demo = isTruthyEnv(envValue(env, 'EXPO_PUBLIC_DEMO_MODE'));
    if (demo) {
      seed = normalizeRecognition(inferRecognition(input), input);
    } else if (barcode) {
      seed = normalizeRecognition(
        buildLiveUnknownRecognition(input, `Barcode ${barcode} staat nog niet in de productdatabase.`),
        input
      );
    }
  }

  if (!seed) {
    return jsonResponse({
      ok: false,
      error: 'recognition_not_configured',
      message: 'Live herkenning is niet beschikbaar. Controleer api.taze.to/health en je OpenAI/Supabase-config.',
    }, 503, request);
  }

  const openai = createOpenAiClient(env);
  if (openai && (input.imageBase64 || input.imageUri)) {
    try {
      const aiResult = await recognizeViaOpenAI(input, seed, env);
      const normalized = normalizeRecognition(aiResult ?? seed, input);
      return jsonResponse(buildRecognizeResponse(normalized, 'vision', input), 200, request);
    } catch (error) {
      const status = Number(error?.status ?? error?.statusCode ?? 0);
      if (status === 401 || status === 403) {
        return jsonResponse(
          buildRecognizeResponse(
            normalizeRecognition(buildLiveUnknownRecognition(input, 'OpenAI-authenticatie is niet geconfigureerd.'), input),
            'fallback',
            input,
            'OpenAI-authenticatie is niet geconfigureerd of tijdelijk uitgeschakeld.'
          ),
          200,
          request
        );
      }
      if (status === 429) {
        return jsonResponse(
          buildRecognizeResponse(
            normalizeRecognition(buildLiveUnknownRecognition(input, 'OpenAI rate limit bereikt.'), input),
            'fallback',
            input,
            'OpenAI rate limit is bereikt. Probeer later opnieuw.'
          ),
          200,
          request
        );
      }

      console.error('AI herkenning fout:', error);
      return jsonResponse(
        buildRecognizeResponse(
          normalizeRecognition(buildLiveUnknownRecognition(input, 'Live AI herkenning is niet beschikbaar.'), input),
          'fallback',
          input,
          'Live AI herkenning is niet beschikbaar. Controleer OPENAI_API_KEY op de backend.'
        ),
        200,
        request
      );
    }
  } else if (!openai && (input.imageBase64 || input.imageUri)) {
    return jsonResponse(
      buildRecognizeResponse(
        normalizeRecognition(
          buildLiveUnknownRecognition(input, 'Live AI herkenning is niet beschikbaar.'),
          input
        ),
        'fallback',
        input,
        isOpenAiTemporarilyDisabled(env) || !envValue(env, 'OPENAI_API_KEY')
          ? 'OpenAI-authenticatie is niet geconfigureerd of tijdelijk uitgeschakeld.'
          : 'Live AI herkenning is niet geconfigureerd op de backend.'
      ),
      200,
      request
    );
  }

  return jsonResponse(buildRecognizeResponse(seed, barcode ? 'barcode' : 'fallback', input), 200, request);
}

function makeSimpleJsonHandler(payloadBuilder) {
  return async (request) => jsonResponse(payloadBuilder(), 200, request);
}

async function sendBrevoTransactionalEmail(to, subject, htmlContent, env = process.env) {
  const apiKey = envValue(env, 'BREVO_API_KEY');
  const senderEmail = envValue(env, 'BREVO_SENDER_EMAIL') || 'hello@taze.to';
  const senderName = envValue(env, 'BREVO_SENDER_NAME') || 'AI TAZE';

  if (!apiKey || !senderEmail) {
    return { ok: false, reason: 'brevo_not_configured' };
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        email: senderEmail,
        name: senderName,
      },
      to: [{ email: to }],
      subject,
      htmlContent,
      tags: ['order-advice'],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return { ok: false, reason: 'brevo_error', status: response.status, detail };
  }

  const data = await response.json().catch(() => null);
  return {
    ok: true,
    messageId: typeof data?.messageId === 'string' ? data.messageId : null,
  };
}

async function handleOrderAdviceEmail(request, env = process.env) {
  try {
    const body = await request.json().catch(() => ({}));
    const productName = trimEnv(body.productName);
    const location = trimEnv(body.location);
    const recipientEmail = trimEnv(body.recipientEmail) || 'bestelling@taze.to';

    if (!productName || !location) {
      return jsonResponse({ success: false, error: 'missing_required_fields' }, 400, request);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return jsonResponse({ success: false, error: 'invalid_recipient_email' }, 400, request);
    }

    const subject = `Besteladvies: ${productName}`;
    const htmlContent = `
      <p>Beste,</p>
      <p>Er is een besteladvies aangemaakt vanuit AI TAZE.</p>
      <p><strong>Product:</strong> ${escapeHtml(productName)}</p>
      <p><strong>Locatie:</strong> ${escapeHtml(location)}</p>
      <p>Advies: bestel dit product opnieuw of controleer de actuele voorraad.</p>
      <p>Met vriendelijke groet,<br/>AI TAZE</p>
    `;

    const result = await sendBrevoTransactionalEmail(recipientEmail, subject, htmlContent, env);
    if (!result.ok) {
      console.error('Order advice mail failed:', result);
      const status = result.reason === 'brevo_not_configured' ? 503 : 502;
      return jsonResponse({ success: false, error: result.reason }, status, request);
    }

    return jsonResponse({ success: true, messageId: result.messageId }, 200, request);
  } catch (error) {
    console.error('Order advice mail handler error:', error);
    return jsonResponse({ success: false, error: 'order_advice_email_failed' }, 500, request);
  }
}

async function handleNewsletterSubscribe(request, env = process.env) {
  const body = await request.json().catch(() => ({}));
  const email = trimEnv(body.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ ok: false, error: 'invalid_email' }, 400, request);
  }

  const apiKey = envValue(env, 'BREVO_API_KEY');
  const listId = Number.parseInt(envValue(env, 'BREVO_LIST_ID'), 10);
  if (!apiKey || !Number.isFinite(listId) || listId <= 0) {
    return jsonResponse({ ok: false, error: 'brevo_not_configured' }, 503, request);
  }

  const response = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      email,
      listIds: [listId],
      updateEnabled: true,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return jsonResponse({ ok: false, error: 'brevo_error', detail }, 503, request);
  }

  return jsonResponse({ ok: true, email }, 200, request);
}

async function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Max-Age': '86400',
      ...corsHeaders(request),
    },
  });
}

async function routeApi(request, url, env = process.env, hostname = '') {
  const pathname = url.pathname;

  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }

  if (pathname === '/' && request.method === 'GET') {
    return jsonResponse(
      {
        service: 'Taze API',
        status: 'ok',
        ui: false,
      },
      200,
      request
    );
  }

  if (pathname === '/health') {
    return handleHealth(request, env);
  }

  if (pathname === '/api/supabase/status' && request.method === 'GET') {
    return jsonResponse(getSupabaseStatusSnapshot(env), 200, request);
  }

  if (pathname === '/api/stripe/status' && request.method === 'GET') {
    return jsonResponse(getStripeStatusSnapshot(env), 200, request);
  }

  if (pathname === '/api/ai/copilot' && request.method === 'POST') {
    return handleCopilotRequest(request, env);
  }

  if (pathname === '/api/ai/helpdesk' && request.method === 'POST') {
    return handleHelpdeskAiRequest(request, env);
  }

  if (pathname === '/recognize' && request.method === 'POST') {
    return handleRecognizeRequest(request, env);
  }

  if (pathname === '/newsletter/subscribe' && request.method === 'POST') {
    return handleNewsletterSubscribe(request, env);
  }

  if (pathname === '/api/order-advice/email' && request.method === 'POST') {
    return handleOrderAdviceEmail(request, env);
  }

  if (pathname === '/api/stripe/webhook' && request.method === 'POST') {
    const secretKey = envValue(env, 'STRIPE_SECRET_KEY');
    const webhookSecret = envValue(env, 'STRIPE_WEBHOOK_SECRET');
    if (!secretKey || !webhookSecret) {
      return jsonResponse({ ok: false, error: 'stripe_not_configured' }, 503, request);
    }

    return jsonResponse({ ok: true, received: true }, 200, request);
  }

  if (pathname === '/api/stripe/create-checkout-session' && request.method === 'POST') {
    return handleStripeCheckoutSession(request, env);
  }

  if (pathname === '/api/refunds/request' && request.method === 'POST') {
    return handleRefundRequest(request, env);
  }

  if (pathname === '/api/refunds/approve' && (request.method === 'GET' || request.method === 'POST')) {
    return handleRefundDecision(request, env, 'approve');
  }

  if (pathname === '/api/refunds/reject' && (request.method === 'GET' || request.method === 'POST')) {
    return handleRefundDecision(request, env, 'reject');
  }

  if (pathname === '/api/cache/purge' && (request.method === 'POST' || request.method === 'GET')) {
    const expectedToken = envValue(env, 'TAZE_WORKER_VERSION') || DEFAULT_WORKER_VERSION;
    const providedToken = trimEnv(url.searchParams.get('token') || request.headers.get('x-taze-cache-token'));
    const host = normalizeHostValue(hostname);
    const canBypassToken = request.method === 'GET' && host.endsWith('.workers.dev');

    if (!canBypassToken && providedToken !== expectedToken) {
      return jsonResponse({ ok: false, error: 'forbidden' }, 403, request);
    }

      const targetUrls = [
        `https://${API_HOST}/`,
        `https://${ROOT_HOST}/`,
        `https://${ROOT_HOST}/public`,
        `https://${ROOT_HOST}/public.html`,
        `https://${WWW_HOST}/`,
        `https://${DEMO_HOST}/`,
        `https://${DEMO_HOST}/demo`,
        `https://${DEMO_HOST}/demo.html`,
        `https://${PLATFORM_HOST}/`,
        `https://${PLATFORM_HOST}/account`,
        `https://${PLATFORM_HOST}/account.html`,
        `https://${PLATFORM_HOST}/readiness`,
        `https://${APP_HOST}/`,
        `https://${APP_HOST}/account`,
        `https://${APP_HOST}/account.html`,
        `https://${TRANSPORT_HOST}/`,
        `https://${TRANSPORT_HOST}/transport`,
        `https://${TRANSPORT_HOST}/transport/`,
        `https://${TRANSPORT_HOST}/transport.html`,
        `https://${AI_HOST}/`,
        `https://${AI_HOST}/ai`,
        `https://${AI_HOST}/ai.html`,
        `https://${SCAN_HOST}/`,
        `https://${SCAN_HOST}/scan`,
        `https://${SCAN_HOST}/scan.html`,
        `https://${ADMIN_HOST}/`,
        `https://${ADMIN_HOST}/admin`,
      ];

    const results = [];
    for (const targetUrl of targetUrls) {
      try {
        const deleted = await caches.default.delete(new Request(targetUrl, { method: 'GET' }));
        results.push({ url: targetUrl, deleted });
      } catch (error) {
        results.push({
          url: targetUrl,
          deleted: false,
          error: error instanceof Error ? error.message : 'unknown_error',
        });
      }
    }

    return jsonResponse(
      {
        ok: true,
        purged: results.filter((entry) => entry.deleted).length,
        total: results.length,
        results,
      },
      200,
      request
    );
  }

  return jsonResponse({ error: 'not_found' }, 404, request);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = getRequestHostname(request, url);

    if (!ALLOWED_HOSTS.has(hostname)) {
      return textResponse(`Forbidden: requests to ${hostname} are not allowed`, 403, 'text/plain; charset=utf-8', request);
    }

    if (hostname === API_HOST) {
      try {
        return await routeApi(request, url, env, hostname);
      } catch (error) {
        console.error('API request error:', error);
        return jsonResponse(
          {
            error: 'api_error',
            message: error instanceof Error ? error.message : 'unknown error',
          },
          500,
          request
        );
      }
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
        if (hostname === DEMO_HOST && (url.pathname === '/' || url.pathname === '/demo' || url.pathname === '/demo.html')) {
        if (!env?.ASSETS?.fetch) {
          return textResponse('Static assets binding missing', 500, 'text/plain; charset=utf-8', request);
        }

        const demoAssetRequest = rewriteRequestPath(request, '/demo.html');
        const demoResponse = await env.ASSETS.fetch(demoAssetRequest);
        if (!demoResponse.ok || !String(demoResponse.headers.get('content-type') ?? '').includes('text/html')) {
          return rootHtmlResponse(DEMO_ROOT_HTML, request, hostname, 'demo', env);
        }
        return decorateResponse(demoResponse, { request, hostname, pathname: url.pathname, dispatch: 'demo', env });
      }

        if (
          (hostname === ROOT_HOST || hostname === WWW_HOST) &&
          (url.pathname === '/' || url.pathname === '/public' || url.pathname === '/public.html')
        ) {
        if (!env?.ASSETS?.fetch) {
          return textResponse('Static assets binding missing', 500, 'text/plain; charset=utf-8', request);
        }

        return rootHtmlResponse(PUBLIC_ROOT_HTML_CURRENT, request, hostname, 'public', env);
      }

        if (
          hostname === PLATFORM_HOST &&
          (url.pathname === '/' || url.pathname === '/account' || url.pathname === '/account.html' || url.pathname === '/readiness')
        ) {
          if (!env?.ASSETS?.fetch) {
            return textResponse('Static assets binding missing', 500, 'text/plain; charset=utf-8', request);
          }

          return rootHtmlResponse(ACCOUNT_ROOT_HTML, request, hostname, 'platform', env);
        }

        if (hostname === APP_HOST && url.pathname === '/') {
          const appHtml = buildAccessHtml({
            title: 'Taze | Toegang vereist',
            heading: 'Toegang vereist',
            code: '401 Login',
            message: 'Log in met je Taze-account om je bedrijfsomgeving te openen.',
            hostLabel: 'app.taze.to',
            primaryLabel: 'Ga naar login',
            primaryHref: 'https://app.taze.to/account',
            secondaryLabel: 'Terug naar taze.to',
            secondaryHref: 'https://taze.to/',
          });

          return htmlResponse(appHtml, 200, request, 'business', hostname, env);
        }

        if (hostname === APP_HOST && (url.pathname === '/account' || url.pathname === '/account.html')) {
          if (!env?.ASSETS?.fetch) {
            return textResponse('Static assets binding missing', 500, 'text/plain; charset=utf-8', request);
          }

          return rootHtmlResponse(ACCOUNT_ROOT_HTML, request, hostname, 'business', env);
        }

        if (
          hostname === TRANSPORT_HOST &&
          (url.pathname === '/' || url.pathname === '/transport' || url.pathname === '/transport/' || url.pathname === '/transport.html')
        ) {
          const transportHtml = buildAccessHtml({
            title: 'Taze | Transport toegang vereist',
            heading: 'Transport en levering',
            code: '401 Transport',
            message: 'Log in met je Taze-account om de transportlijn te openen.',
            hostLabel: 'transport.taze.to',
            primaryLabel: 'Terug naar taze.to',
            primaryHref: 'https://taze.to/',
            secondaryLabel: 'Ga naar transport.taze.to',
            secondaryHref: 'https://transport.taze.to/',
          });

          return htmlResponse(transportHtml, 401, request, 'transport', hostname, env);
        }

        if (hostname === INVOICE_HOST && (url.pathname === '/' || url.pathname === '/invoice' || url.pathname === '/invoice/' || url.pathname === '/invoice.html')) {
          const invoiceHtml = buildAccessHtml({
            title: 'Taze | Facturatielijn toegang vereist',
            heading: 'Facturatielijn',
            code: '401 Facturatie',
            message: 'Log in met je Taze-account om de facturatielijn te openen.',
            hostLabel: 'invoice.taze.to',
            primaryLabel: 'Terug naar taze.to',
            primaryHref: 'https://taze.to/',
            secondaryLabel: 'Ga naar login',
            secondaryHref: 'https://invoice.taze.to/',
          });

          return htmlResponse(invoiceHtml, 401, request, 'invoice', hostname, env);
        }

        if (hostname === AI_HOST && url.pathname === '/') {
          const aiHtml = buildAccessHtml({
            title: 'Taze | AI/RIA advieslijn toegang vereist',
            heading: 'RIA / AI advieslijn',
            code: '401 AI',
            message:
              'Read-only advies binnen bevoegdheid. Menselijke bevestiging vereist. Geen automatische acties. Geen datawijzigingen.',
            hostLabel: 'ai.taze.to',
            primaryLabel: 'Terug naar taze.to',
            primaryHref: 'https://taze.to/',
            secondaryLabel: 'Open AI-lijn',
            secondaryHref: '/account',
          });

          return htmlResponse(aiHtml, 401, request, 'ai', hostname, env);
        }

        if (hostname === SCAN_HOST && (url.pathname === '/' || url.pathname === '/scan' || url.pathname === '/scan.html')) {
          if (!env?.ASSETS?.fetch) {
            return textResponse('Static assets binding missing', 500, 'text/plain; charset=utf-8', request);
          }

          return protectedRootHtmlResponse(SCAN_ROOT_HTML, request, hostname, 'scan', env);
        }

        if (hostname === ADMIN_HOST && (url.pathname === '/' || url.pathname === '/admin' || url.pathname === '/admin.html')) {
          const adminHtml = buildAccessHtml({
            title: 'Taze | Admin toegang vereist',
            heading: 'Toegang vereist',
            code: '403 Beheer',
            message: 'Log in met een beheeraccount om deze ruimte te openen.',
            hostLabel: 'admin.taze.to',
            primaryLabel: 'Terug naar taze.to',
            primaryHref: 'https://taze.to/',
            secondaryLabel: 'Ga naar login',
            secondaryHref: 'https://app.taze.to/account',
          });

          return htmlResponse(adminHtml, 403, request, 'admin', hostname, env);
        }
    }

    if (SPA_HOSTS.has(hostname)) {
      if (!env?.ASSETS?.fetch) {
        return textResponse('Static assets binding missing', 500, 'text/plain; charset=utf-8', request);
      }

      const spaResponse = await env.ASSETS.fetch(request);
        const dispatch =
          hostname === PLATFORM_HOST
            ? 'platform'
          : hostname === APP_HOST
            ? 'business'
            : hostname === TRANSPORT_HOST
            ? 'transport'
          : hostname === INVOICE_HOST
              ? 'invoice'
              : hostname === AI_HOST
                ? 'ai'
              : hostname === SCAN_HOST
              ? 'scan'
              : hostname === ADMIN_HOST
                ? 'admin'
                : hostname === DEMO_HOST
                  ? 'demo'
                  : 'public';
      return decorateResponse(spaResponse, { request, hostname, pathname: url.pathname, dispatch, env });
    }

    return textResponse('Not Found', 404, 'text/plain; charset=utf-8', request);
  },
};

