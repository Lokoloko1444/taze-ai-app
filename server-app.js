const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const OpenAI = require('openai');
const Stripe = require('stripe');
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
const { PRODUCTS: SERVER_PRODUCTS } = require('./lib/products-server');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Buffer } = require('buffer');
const DEFAULT_MODEL = 'gpt-4.1';
const DEFAULT_RIA_MODEL = 'gpt-5.4-mini';
const DEFAULT_ROUTE = '/explore';
const DEFAULT_SUPPORT_EMAIL = 'lgstudio144@gmail.com';
const DEFAULT_SUPPORT_NAME = 'Taze';
const OPENAI_AUTH_COOLDOWN_MS = 15 * 60 * 1000;
const BARCODE_CACHE_TTL_MS = 10 * 60 * 1000;
const BARCODE_CACHE_MAX = 200;
const RUNTIME_ENV_KEYS = [
  'NODE_ENV',
  'PORT',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'AI_MODEL',
  'RIA_MODEL',
  'EXPO_PUBLIC_APP_URL',
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_SERVER_URL',
  'EXPO_PUBLIC_DEMO_MODE',
  'EXPO_PUBLIC_ENABLE_INTERNAL_TOOLS',
  'EXPO_PUBLIC_REQUIRE_LOGIN',
  'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'BREVO_ENABLED',
  'BREVO_API_KEY',
  'BREVO_LIST_ID',
  'BREVO_SENDER_EMAIL',
  'BREVO_SENDER_NAME',
  'CORS_ORIGINS',
  'RETURN_URL_ORIGINS',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
];
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
  helpdesk: '/support',
  trace: '/trace',
  transport: '/transport',
  updates: '/updates',
};

const newsletterMemorySubscribers = new Set();
const barcodeCache = new Map();

function applyRuntimeEnv(env) {
  if (!env || typeof env !== 'object') {
    return;
  }

  const keys = new Set([
    ...Object.keys(env),
    ...Reflect.ownKeys(env).filter((key) => typeof key === 'string'),
    ...RUNTIME_ENV_KEYS,
  ]);

  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string') {
      process.env[key] = value;
    }
  }
}

function trimEnv(value) {
  return typeof value === 'string' ? value.trim() : '';
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

const DEMO_MODE_ENABLED = isTruthyEnv(process.env.EXPO_PUBLIC_DEMO_MODE);
const KNOWN_BARCODES = {};

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
  return SERVER_PRODUCTS.find((product) => product.barcode === normalizedBarcode) || null;
}

function findProductCandidates(text) {
  const normalizedText = normalizeSearchText(text);
  if (!normalizedText) {
    return [];
  }

  const terms = normalizedText.split(' ').filter(Boolean);
  return SERVER_PRODUCTS.map((product) => {
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

function sendRecognitionUnavailable(res, status, error, message, details = {}) {
  return res.status(status).json({
    ok: false,
    error,
    message,
    ...details,
  });
}

for (const product of SERVER_PRODUCTS) {
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

const MAX_RECOGNITION_BARCODE_LENGTH = 128;
const MAX_RECOGNITION_IMAGE_URI_LENGTH = 2048;
const MAX_RECOGNITION_IMAGE_BASE64_LENGTH = 512 * 1024;

const ALLOWED_STRIPE_WEBHOOK_EVENT_TYPES = new Set(['checkout.session.completed']);

const RECOGNITION_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RECOGNITION_RATE_LIMIT_MAX_REQUESTS = 10;
const recognitionRateLimit = new Map();

async function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'missing_auth_token' });
  }

  const token = authHeader.substring(7);
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return res.status(503).json({ ok: false, error: 'auth_not_configured' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ ok: false, error: 'invalid_auth_token' });
    }

    req.user = user;
    req.userId = user.id;
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(401).json({ ok: false, error: 'auth_verification_failed' });
  }
}

async function checkUserPermission(req, res, requiredPermission) {
  const supabase = createSupabaseAdminClient();
  if (!supabase || !req.userId) {
    return false;
  }

  try {
    const { data: membership, error } = await supabase
      .from('memberships')
      .select('role, permissions, company_id')
      .eq('user_id', req.userId)
      .eq('status', 'ACTIVE')
      .single();

    if (error || !membership) {
      return false;
    }

    req.companyId = membership.company_id;

    // Owner has all permissions
    if (membership.role === 'OWNER') {
      return true;
    }

    // Check explicit permissions
    if (membership.permissions && membership.permissions.includes(requiredPermission)) {
      return true;
    }

    // Check role-based permissions
    const { data: rolePerms } = await supabase
      .from('role_permissions')
      .select('permission_key')
      .eq('role', membership.role);

    return rolePerms?.some(rp => rp.permission_key === requiredPermission) || false;
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}

function checkRecognitionRateLimit(userId) {
  const now = Date.now();
  const userKey = `recognition_${userId}`;
  const windowStart = now - RECOGNITION_RATE_LIMIT_WINDOW_MS;

  // Clean up old entries
  for (const [key, timestamps] of recognitionRateLimit.entries()) {
    recognitionRateLimit.set(key, timestamps.filter(ts => ts > windowStart));
    if (recognitionRateLimit.get(key).length === 0) {
      recognitionRateLimit.delete(key);
    }
  }

  const userTimestamps = recognitionRateLimit.get(userKey) || [];
  if (userTimestamps.length >= RECOGNITION_RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  userTimestamps.push(now);
  recognitionRateLimit.set(userKey, userTimestamps);
  return true;
}

async function logAuditEvent(action, userId, companyId, details = {}) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.warn('Cannot log audit event: Supabase not configured');
    return;
  }

  try {
    await supabase.from('audit_events').insert({
      action,
      user_id: userId,
      company_id: companyId,
      details,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

function getSupportInboxEmail() {
  return trimEnv(process.env.EXPO_PUBLIC_SUPPORT_EMAIL) || DEFAULT_SUPPORT_EMAIL;
}

function getAppOrigin() {
  const appUrl = trimEnv(process.env.EXPO_PUBLIC_APP_URL);
  if (appUrl) {
    try {
      const origin = new URL(appUrl).origin.replace(/\/+$/, '');
      if (origin === 'https://taze.to' || origin === 'https://www.taze.to') {
        return 'https://app.taze.to';
      }
      return origin;
    } catch {
      // ignore invalid public origin and fall back below
    }
  }

  return 'https://app.taze.to';
}

function buildAppUrl(pathname) {
  const origin = getAppOrigin().replace(/\/+$/g, '');
  const pathName = typeof pathname === 'string' && pathname.startsWith('/') ? pathname : `/${pathname || ''}`;
  return `${origin}${pathName}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMinorCurrency(amountMinor, currency) {
  const amount = Number.isFinite(amountMinor) ? Number(amountMinor) / 100 : 0;
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

function normalizeBillingInterval(value) {
  const normalized = trimEnv(value).toLowerCase();
  return normalized === 'month' || normalized === 'quarter' || normalized === 'year' ? normalized : '';
}

function formatBillingIntervalLabel(interval) {
  if (interval === 'month') return 'Maandelijks';
  if (interval === 'quarter') return 'Kwartaal';
  if (interval === 'year') return 'Jaarlijks';
  return interval;
}

function createApprovalToken() {
  return crypto.randomBytes(24).toString('hex');
}

function hashApprovalToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

let supabaseAdminClient = null;
let openAiDisabledUntil = 0;

function markOpenAiAuthDisabled() {
  openAiDisabledUntil = Date.now() + OPENAI_AUTH_COOLDOWN_MS;
}

function isOpenAiTemporarilyDisabled() {
  return openAiDisabledUntil > Date.now();
}

function createSupabaseAdminClient() {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const url = trimEnv(process.env.SUPABASE_URL);
  const serviceRoleKey = trimEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !serviceRoleKey) {
    return null;
  }

  supabaseAdminClient = createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdminClient;
}

async function sendBrevoTransactionalEmail({
  toEmail,
  toName,
  subject,
  htmlContent,
  textContent,
  replyToEmail,
  tags = [],
}) {
  const apiKey = trimEnv(process.env.BREVO_API_KEY);
  const senderEmail = trimEnv(process.env.BREVO_SENDER_EMAIL) || 'hello@taze.to';
  const senderName = trimEnv(process.env.BREVO_SENDER_NAME) || DEFAULT_SUPPORT_NAME;

  if (!apiKey || !senderEmail) {
    return { ok: false, reason: 'brevo_not_configured' };
  }

  const payload = {
    sender: {
      email: senderEmail,
      name: senderName,
    },
    to: [
      {
        email: toEmail,
        ...(toName ? { name: toName } : {}),
      },
    ],
    subject,
  };

  if (typeof htmlContent === 'string' && htmlContent.trim()) {
    payload.htmlContent = htmlContent;
  } else if (typeof textContent === 'string' && textContent.trim()) {
    payload.textContent = textContent;
  }

  if (replyToEmail) {
    payload.replyTo = { email: replyToEmail };
  }

  if (Array.isArray(tags) && tags.length) {
    payload.tags = tags.filter((tag) => typeof tag === 'string' && tag.trim()).map((tag) => tag.trim());
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return { ok: false, reason: 'brevo_error', detail };
  }

  const data = await response.json().catch(() => null);
  return {
    ok: true,
    messageId: typeof data?.messageId === 'string' ? data.messageId : null,
  };
}

function normalizeKey(value) {
  return trimEnv(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+/g, '')
    .replace(/_+$/g, '');
}

function isLocalDevelopmentOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function isExpoHostingOrigin(origin) {
  return /^https:\/\/[a-z0-9-]+(?:--[a-z0-9-]+)?\.expo\.app$/i.test(origin);
}

function isExistingFile(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function isExistingDirectory(dirPath) {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function isPathWithinDirectory(baseDir, candidatePath) {
  const relative = path.relative(baseDir, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function normalizeWebPath(value) {
  const rawValue = typeof value === 'string' ? value : '/';
  const withoutQuery = rawValue.split('?')[0].split('#')[0].trim();
  if (!withoutQuery) {
    return '/';
  }

  let normalized = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  normalized = normalized.replace(/\/{2,}/g, '/');

  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/g, '');
  }

  return normalized || '/';
}

function listHtmlFiles(rootDir, relativeDir = '') {
  const absoluteDir = relativeDir ? path.join(rootDir, relativeDir) : rootDir;
  if (!isExistingDirectory(absoluteDir)) {
    return [];
  }

  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const nextRelative = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
    const nextAbsolute = path.join(rootDir, nextRelative);

    if (entry.isDirectory()) {
      files.push(...listHtmlFiles(rootDir, nextRelative));
      continue;
    }

    if (entry.isFile() && nextRelative.toLowerCase().endsWith('.html')) {
      files.push(nextAbsolute);
    }
  }

  return files;
}

function routeMatchesHtmlFile(requestPath, htmlFilePath) {
  const normalizedRequest = normalizeWebPath(requestPath);
  const requestSegments = normalizedRequest.split('/').filter(Boolean);
  const routeRelative = path
    .relative(path.join(process.cwd(), 'dist'), htmlFilePath)
    .replace(/\\/g, '/')
    .replace(/\.html$/i, '');
  const routeSegments = routeRelative
    .split('/')
    .filter(Boolean)
    .filter((segment) => !/^\(.+\)$/.test(segment));

  if (requestSegments.length === 0) {
    return routeSegments.length === 1 && routeSegments[0] === 'index';
  }

  if (requestSegments.length !== routeSegments.length) {
    return false;
  }

  for (let i = 0; i < routeSegments.length; i += 1) {
    const routeSegment = routeSegments[i];
    const requestSegment = requestSegments[i];

    if (/^\[[^\]]+\]$/.test(routeSegment)) {
      continue;
    }

    if (routeSegment !== requestSegment) {
      return false;
    }
  }

  return true;
}

function resolveWebUiFile(requestPath) {
  const distDir = path.join(process.cwd(), 'dist');
  if (!isExistingDirectory(distDir)) {
    return null;
  }

  const normalized = normalizeWebPath(requestPath);
  const cleaned = normalized === '/' ? '' : normalized.slice(1);
  const pathSegments = cleaned.split('/').filter(Boolean);
  if (pathSegments.some((segment) => segment === '.' || segment === '..')) {
    return null;
  }
  const safeRelativePath = pathSegments.join('/');
  const directCandidates = normalized === '/'
    ? [path.resolve(distDir, 'index.html')]
    : [
        path.resolve(distDir, `${safeRelativePath}.html`),
        path.resolve(distDir, safeRelativePath, 'index.html'),
        path.resolve(distDir, safeRelativePath),
      ];

  for (const candidate of directCandidates) {
    if (isPathWithinDirectory(distDir, candidate) && isExistingFile(candidate)) {
      return candidate;
    }
  }

  for (const htmlFile of listHtmlFiles(distDir)) {
    if (routeMatchesHtmlFile(normalized, htmlFile)) {
      return htmlFile;
    }
  }

  return null;
}

function getAllowedReturnOrigins() {
  return parseCsvEnv(process.env.RETURN_URL_ORIGINS);
}

function isAllowedReturnOrigin(origin) {
  const allowedOrigins = getAllowedReturnOrigins();
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  if (isExpoHostingOrigin(origin)) {
    return true;
  }

  if (trimEnv(process.env.NODE_ENV).toLowerCase() !== 'production' && isLocalDevelopmentOrigin(origin)) {
    return isLocalDevelopmentOrigin(origin);
  }

  return false;
}

function getAllowedCorsOrigins() {
  return parseCsvEnv(process.env.CORS_ORIGINS);
}

function isAllowedCorsOrigin(origin) {
  const allowedOrigins = getAllowedCorsOrigins();
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  if (isExpoHostingOrigin(origin)) {
    return true;
  }

  if (trimEnv(process.env.NODE_ENV).toLowerCase() !== 'production' && isLocalDevelopmentOrigin(origin)) {
    return isLocalDevelopmentOrigin(origin);
  }

  return false;
}

function getStripeStatusSnapshot() {
  const secretKey = trimEnv(process.env.STRIPE_SECRET_KEY);
  const webhookSecret = trimEnv(process.env.STRIPE_WEBHOOK_SECRET);
  const publishableKey = trimEnv(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const returnOrigins = getAllowedReturnOrigins();
  const priceKeysConfigured = Object.keys(process.env).filter(
    (key) => key.startsWith('STRIPE_PRICE_') && trimEnv(process.env[key])
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

function getSupabaseStatusSnapshot() {
  const publicUrl = trimEnv(process.env.EXPO_PUBLIC_SUPABASE_URL);
  const anonKey = trimEnv(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  const serverUrl = trimEnv(process.env.SUPABASE_URL);
  const serviceRoleKey = trimEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

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

function getNewsletterStatusSnapshot() {
  const enabled = isTruthyEnv(process.env.BREVO_ENABLED);
  const apiKey = trimEnv(process.env.BREVO_API_KEY);
  const listIdRaw = trimEnv(process.env.BREVO_LIST_ID);
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

function getStripePriceId(planId, interval) {
  for (const key of getStripePriceCandidates(planId, interval)) {
    const value = trimEnv(process.env[key]);
    if (value) {
      return { key, value };
    }
  }
  return null;
}

function createOpenAiClient() {
  if (isOpenAiTemporarilyDisabled()) {
    return null;
  }

  const apiKey = trimEnv(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    return null;
  }

  return new OpenAI({ apiKey });
}

function getOpenAiModel() {
  return trimEnv(process.env.OPENAI_MODEL) || DEFAULT_MODEL;
}

function getRiaModel() {
  return trimEnv(process.env.RIA_MODEL) || trimEnv(process.env.AI_MODEL) || trimEnv(process.env.OPENAI_MODEL) || DEFAULT_RIA_MODEL;
}

let openAiHealthCache = {
  expiresAt: 0,
  value: null,
};

async function getOpenAiHealthSnapshot() {
  const now = Date.now();
  if (openAiHealthCache.expiresAt > now && openAiHealthCache.value) {
    return openAiHealthCache.value;
  }

  const apiKey = trimEnv(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    const value = {
      configured: false,
      ready: false,
      status: 'missing',
      detail: 'OpenAI secret ontbreekt',
    };
    openAiHealthCache = {
      expiresAt: now + 60 * 1000,
      value,
    };
    return value;
  }

  if (isOpenAiTemporarilyDisabled()) {
    const value = {
      configured: true,
      ready: false,
      status: 'auth_error',
      detail: 'OpenAI key ongeldig',
    };
    openAiHealthCache = {
      expiresAt: now + 60 * 1000,
      value,
    };
    return value;
  }

  const client = createOpenAiClient();
  if (!client) {
    const value = {
      configured: false,
      ready: false,
      status: 'missing',
      detail: 'OpenAI secret ontbreekt',
    };
    openAiHealthCache = {
      expiresAt: now + 60 * 1000,
      value,
    };
    return value;
  }

  const controller = new AbortController();
  const timeoutMs = 5000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await Promise.race([
      client.models.list({ signal: controller.signal }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OpenAI health check timed out')), timeoutMs);
      }),
    ]);
    const value = {
      configured: true,
      ready: true,
      status: 'ready',
      detail: 'OpenAI key werkt',
    };
    openAiHealthCache = {
      expiresAt: now + 5 * 60 * 1000,
      value,
    };
    return value;
  } catch (error) {
    const status = Number(error?.status ?? error?.statusCode ?? 0);
    let detail = 'OpenAI is niet bereikbaar';
    let state = 'unavailable';

    if (error?.name === 'AbortError' || /timed out/i.test(String(error?.message ?? ''))) {
      detail = 'OpenAI health check timed out';
      state = 'timeout';
    } else
    if (status === 401 || status === 403) {
      detail = 'OpenAI key ongeldig';
      state = 'auth_error';
    } else if (status === 429) {
      detail = 'OpenAI rate limited';
      state = 'rate_limited';
    } else if (status === 401 || status === 403) {
      markOpenAiAuthDisabled();
      detail = 'OpenAI key ongeldig';
      state = 'auth_error';
    }

    const value = {
      configured: true,
      ready: false,
      status: state,
      detail,
    };
    openAiHealthCache = {
      expiresAt: now + 60 * 1000,
      value,
    };
    return value;
  } finally {
    clearTimeout(timeout);
  }
}

function createStripeClient() {
  const apiKey = trimEnv(process.env.STRIPE_SECRET_KEY);
  if (!apiKey) {
    return null;
  }

  return new Stripe(apiKey, {
    apiVersion: '2026-02-25.clover',
  });
}

function normalizeQuestion(question) {
  return typeof question === 'string' ? question.trim() : '';
}

function normalizeAvailableActions(availableActions) {
  return Array.isArray(availableActions)
    ? availableActions.filter((action) => action && typeof action.kind === 'string' && typeof action.label === 'string')
    : [];
}

function inferRecommendedRoute(screen) {
  if (typeof screen !== 'string') {
    return DEFAULT_ROUTE;
  }

  return ROUTE_BY_SCREEN[screen.toLowerCase()] ?? DEFAULT_ROUTE;
}

function buildFallbackCopilotPayload({ screen, availableActions, language, question }) {
  void availableActions;
  const route = inferRecommendedRoute(screen);
  const trimmedQuestion = normalizeQuestion(question);

  return {
    title: 'AI copilot',
    answer:
      trimmedQuestion.length > 0
        ? `Ik kan nu geen live AI-antwoord ophalen voor "${trimmedQuestion}", dus ik geef een veilige fallback op basis van het huidige scherm.`
        : 'Ik kan nu geen live AI-antwoord ophalen, dus ik geef een veilige fallback op basis van het huidige scherm.',
    recommendedRoute: route,
    recommendedLabel: 'Open aanbevolen scherm',
    model: getRiaModel(),
    actionKind: null,
    actionLabel: null,
    language,
  };
}

function extractJsonObject(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeCopilotResponse(payload, fallbackContext) {
  const route = typeof payload?.recommendedRoute === 'string' ? payload.recommendedRoute.trim() : '';
  const recommendedRoute =
    ROUTE_BY_SCREEN[route.toLowerCase()] ?? (route.startsWith('/') ? route : inferRecommendedRoute(fallbackContext.screen));
  return {
    ok: true,
    title: typeof payload?.title === 'string' && payload.title.trim() ? payload.title.trim() : 'AI copilot',
    answer: typeof payload?.answer === 'string' && payload.answer.trim() ? payload.answer.trim() : fallbackContext.answer,
    recommendedRoute: recommendedRoute || fallbackContext.recommendedRoute,
    recommendedLabel:
      typeof payload?.recommendedLabel === 'string' && payload.recommendedLabel.trim()
        ? payload.recommendedLabel.trim()
        : 'Open aanbevolen scherm',
    model: fallbackContext.model || getRiaModel(),
    actionKind: null,
    actionLabel: null,
  };
}

function inferFromBarcodePattern(barcode) {
  if (!barcode) {
    return null;
  }

  if (barcode.startsWith('20') || barcode.startsWith('21')) {
    return {
      name: 'Vers toonbankproduct',
      category: 'Vers',
      quantity: 1,
      expiryDays: 1,
      confidence: 0.72,
      notes: 'Barcodepatroon wijst op een vers of intern geprijsd winkelproduct.',
      source: 'barcode-pattern',
    };
  }

  if (barcode.startsWith('87')) {
    return {
      name: 'Verpakt supermarktproduct',
      category: 'Algemeen',
      quantity: 1,
      expiryDays: 5,
      confidence: 0.67,
      notes: 'Barcodepatroon lijkt op een standaard retailproduct uit een supermarktflow.',
      source: 'barcode-pattern',
    };
  }

  if (barcode.startsWith('54')) {
    return {
      name: 'Belgisch winkelproduct',
      category: 'Algemeen',
      quantity: 1,
      expiryDays: 4,
      confidence: 0.65,
      notes: 'Barcodepatroon wijst op een Belgisch retailproduct. Controleer naam en categorie.',
      source: 'barcode-pattern',
    };
  }

  return null;
}

function inferFromImage(imageBase64) {
  const size = imageBase64?.length ?? 0;

  return {
    name: 'Onbekend product',
    category: 'Controle nodig',
    quantity: 1,
    expiryDays: null,
    confidence: 0.35,
    notes: 'Geen live herkenning beschikbaar. Gebruik barcode, foto of handmatige invoer om het product te bepalen.',
    source: 'live-fallback',
  };
}

function buildLiveUnknownRecognition(input, reason) {
  const barcode = normalizeBarcodeValue(input.barcode);

  return {
    name: barcode ? `Onbekende barcode ${barcode}` : 'Onbekend product',
    category: 'Controle nodig',
    quantity: 1,
    expiryDays: null,
    confidence: 0.2,
    notes: reason || 'Live herkenning is niet beschikbaar.',
    source: barcode ? 'barcode-unknown' : 'live-unavailable',
    barcode: barcode || null,
    batchCode: null,
    lotNumber: null,
    recallFlag: false,
  };
}

function inferRecognition(input) {
  if (!DEMO_MODE_ENABLED) {
    return buildLiveUnknownRecognition(
      input,
      'Live herkenning is niet beschikbaar. Controleer api.taze.to/health en je backendconfig.'
    );
  }

  const barcode = input.barcode?.trim() || null;
  const barcodeMatch = barcode ? KNOWN_BARCODES[barcode] : undefined;
  const barcodePatternMatch = barcode ? inferFromBarcodePattern(barcode) : null;

  if (barcodeMatch) {
    return {
      ...barcodeMatch,
      barcode,
      source: input.imageBase64 ? 'foto + barcode' : barcodeMatch.source,
      notes: input.imageBase64
        ? `${barcodeMatch.notes} Foto is meegestuurd voor extra context.`
        : barcodeMatch.notes,
      batchCode: null,
      lotNumber: null,
      recallFlag: false,
    };
  }

  const visualMatch = inferFromImage(input.imageBase64);

  if (barcode) {
    const mergedBase = barcodePatternMatch ?? visualMatch;
    const combinedConfidence = input.imageBase64
      ? Math.min(0.9, Math.max(mergedBase.confidence, visualMatch.confidence) + 0.08)
      : mergedBase.confidence;

    return {
      ...mergedBase,
      barcode,
      source: input.imageBase64 ? 'foto + barcode' : mergedBase.source,
      confidence: combinedConfidence,
      notes: input.imageBase64
        ? `Onbekende barcode ${barcode}. Barcode en foto samen geven deze inschatting. ${mergedBase.notes}`
        : `Onbekende barcode ${barcode}. ${mergedBase.notes}`,
      batchCode: null,
      lotNumber: null,
      recallFlag: false,
    };
  }

  return {
    ...visualMatch,
    barcode: null,
    batchCode: null,
    lotNumber: null,
    recallFlag: false,
  };
}

function normalizeRecognition(data, input) {
  const fallback = inferRecognition(input);

  return {
    name: data.name ?? fallback.name,
    category: data.category ?? fallback.category,
    quantity: Math.max(1, Number(data.quantity ?? fallback.quantity ?? 1)),
    expiryDays: data.expiryDays ?? data.expiry ?? fallback.expiryDays ?? null,
    confidence: Math.min(0.99, Math.max(0.25, Number(data.confidence ?? fallback.confidence ?? 0.6))),
    notes: data.notes ?? fallback.notes,
    source: data.source ?? fallback.source,
    barcode: data.barcode ?? input.barcode ?? fallback.barcode,
    batchCode: data.batchCode ?? fallback.batchCode ?? null,
    lotNumber: data.lotNumber ?? fallback.lotNumber ?? null,
    recallFlag: data.recallFlag ?? fallback.recallFlag ?? false,
  };
}

function coerceRecognitionSeed(seed, input) {
  if (!seed || typeof seed !== 'object') {
    return null;
  }

  const payload = {};

  if (typeof seed.name === 'string' && seed.name.trim()) payload.name = seed.name.trim();
  if (typeof seed.category === 'string' && seed.category.trim()) payload.category = seed.category.trim();
  if (seed.quantity !== undefined && Number.isFinite(Number(seed.quantity))) payload.quantity = Number(seed.quantity);
  if (seed.expiryDays !== undefined) payload.expiryDays = seed.expiryDays;
  if (seed.expiry !== undefined) payload.expiry = seed.expiry;
  if (seed.confidence !== undefined && Number.isFinite(Number(seed.confidence))) {
    payload.confidence = Number(seed.confidence);
  }
  if (typeof seed.notes === 'string' && seed.notes.trim()) payload.notes = seed.notes.trim();
  if (typeof seed.source === 'string' && seed.source.trim()) payload.source = seed.source.trim();
  if (typeof seed.barcode === 'string' && seed.barcode.trim()) payload.barcode = seed.barcode.trim();
  if (typeof seed.batchCode === 'string' && seed.batchCode.trim()) payload.batchCode = seed.batchCode.trim();
  if (typeof seed.lotNumber === 'string' && seed.lotNumber.trim()) payload.lotNumber = seed.lotNumber.trim();
  if (typeof seed.recallFlag === 'boolean') payload.recallFlag = seed.recallFlag;

  if (Object.keys(payload).length === 0) {
    return null;
  }

  return normalizeRecognition(payload, input);
}

function normalizeBarcodeValue(value) {
  return trimEnv(value).replace(/\s+/g, '').replace(/[^0-9A-Za-z]/g, '');
}

function getCachedBarcodeRecognition(barcode) {
  const now = Date.now();
  const entry = barcodeCache.get(barcode);
  if (!entry) {
    return undefined;
  }
  if (entry.expiresAt <= now) {
    barcodeCache.delete(barcode);
    return undefined;
  }
  return entry.result;
}

function setCachedBarcodeRecognition(barcode, result) {
  barcodeCache.set(barcode, {
    result,
    expiresAt: Date.now() + BARCODE_CACHE_TTL_MS,
  });

  if (barcodeCache.size > BARCODE_CACHE_MAX) {
    const oldest = barcodeCache.keys().next().value;
    if (oldest) {
      barcodeCache.delete(oldest);
    }
  }
}

function pickText(...values) {
  for (const value of values) {
    const trimmed = trimEnv(value);
    if (trimmed) {
      return trimmed;
    }
  }
  return '';
}

function deriveCategoryFromText(text) {
  const value = trimEnv(text).toLowerCase();

  if (value.includes('zuivel') || value.includes('milk') || value.includes('yoghurt') || value.includes('cheese')) {
    return 'Zuivel';
  }
  if (value.includes('brood') || value.includes('bread') || value.includes('bakery') || value.includes('croissant')) {
    return 'Bakkerij';
  }
  if (value.includes('drank') || value.includes('drink') || value.includes('water') || value.includes('juice') || value.includes('cola')) {
    return 'Dranken';
  }
  if (value.includes('fruit') || value.includes('groente') || value.includes('vegetable') || value.includes('salade')) {
    return 'Groente & fruit';
  }
  if (value.includes('vlees') || value.includes('fish') || value.includes('kip') || value.includes('meat')) {
    return 'Vers';
  }
  if (value.includes('diepvries') || value.includes('frozen')) {
    return 'Diepvries';
  }
  if (value.includes('pasta') || value.includes('rijst') || value.includes('dry') || value.includes('blik')) {
    return 'Droogwaren';
  }

  return 'Algemeen';
}

function estimateExpiryDaysFromText(text) {
  const value = trimEnv(text).toLowerCase();

  if (
    value.includes('melk') ||
    value.includes('yoghurt') ||
    value.includes('kaas') ||
    value.includes('room') ||
    value.includes('boter') ||
    value.includes('zuivel')
  ) {
    return 5;
  }

  if (
    value.includes('brood') ||
    value.includes('bakker') ||
    value.includes('croissant') ||
    value.includes('brioche') ||
    value.includes('baguette') ||
    value.includes('gebak')
  ) {
    return 1;
  }

  if (
    value.includes('salade') ||
    value.includes('sla') ||
    value.includes('fruit') ||
    value.includes('groente') ||
    value.includes('groenten') ||
    value.includes('bessen') ||
    value.includes('vers')
  ) {
    return 3;
  }

  if (
    value.includes('vlees') ||
    value.includes('kip') ||
    value.includes('rund') ||
    value.includes('vis') ||
    value.includes('zalm') ||
    value.includes('tonijn')
  ) {
    return 2;
  }

  if (
    value.includes('drank') ||
    value.includes('water') ||
    value.includes('sap') ||
    value.includes('cola') ||
    value.includes('fris') ||
    value.includes('koffie') ||
    value.includes('thee')
  ) {
    return 7;
  }

  if (value.includes('diepvries') || value.includes('frozen') || value.includes('vries')) {
    return 30;
  }

  if (value.includes('pasta') || value.includes('rijst') || value.includes('droog') || value.includes('blik')) {
    return 90;
  }

  return 7;
}

function buildRecognitionSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string' },
      category: { type: 'string' },
      quantity: { type: 'number' },
      expiryDays: {
        anyOf: [{ type: 'number' }, { type: 'null' }],
      },
      confidence: { type: 'number' },
      notes: { type: 'string' },
      source: { type: 'string' },
      barcode: {
        anyOf: [{ type: 'string' }, { type: 'null' }],
      },
      batchCode: {
        anyOf: [{ type: 'string' }, { type: 'null' }],
      },
      lotNumber: {
        anyOf: [{ type: 'string' }, { type: 'null' }],
      },
      recallFlag: { type: 'boolean' },
    },
    required: ['name', 'category', 'quantity', 'expiryDays', 'confidence', 'notes', 'source', 'barcode', 'batchCode', 'lotNumber', 'recallFlag'],
  };
}

function getRecognitionImageDataUri(input) {
  const base64 = trimEnv(input.imageBase64);
  if (base64) {
    return /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(base64) ? base64 : `data:image/jpeg;base64,${base64}`;
  }

  const uri = trimEnv(input.imageUri);
  if (/^https?:\/\//i.test(uri) || /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(uri)) {
    return uri;
  }

  return '';
}

async function lookupOpenFoodFactsBarcode(barcode) {
  const normalized = normalizeBarcodeValue(barcode);
  if (!normalized || !/^\d{8,14}$/.test(normalized)) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(normalized)}.json?fields=product_name,product_name_en,product_name_nl,generic_name,generic_name_en,generic_name_nl,brands,categories`,
      {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    if (!payload || payload.status !== 1 || !payload.product) {
      return null;
    }

    const product = payload.product;
    const name = pickText(
      product.product_name_nl,
      product.product_name,
      product.product_name_en,
      product.generic_name_nl,
      product.generic_name,
      product.generic_name_en,
      product.brands
    );
    const categoryText = pickText(product.categories, product.product_name, product.generic_name, product.brands);
    const category = deriveCategoryFromText(categoryText || name || normalized);
    const expiryDays = estimateExpiryDaysFromText(`${name} ${categoryText}`);

    return {
      name: name || `Barcode ${normalized}`,
      category,
      quantity: 1,
      expiryDays,
      confidence: name ? 0.92 : 0.78,
      notes: 'Barcode herkend via Open Food Facts.',
      source: 'open-food-facts',
      barcode: normalized,
      batchCode: null,
      lotNumber: null,
      recallFlag: false,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function recognizeWithOpenAi(openai, input, seed) {
  const imageDataUri = getRecognitionImageDataUri(input);
  if (!imageDataUri) {
    return null;
  }

  const promptContext = {
    barcode: trimEnv(input.barcode) || null,
    seed: seed
      ? {
          name: seed.name,
          category: seed.category,
          quantity: seed.quantity,
          expiryDays: seed.expiryDays,
          confidence: seed.confidence,
          notes: seed.notes,
          source: seed.source,
          barcode: seed.barcode,
        }
      : null,
    task: 'Herken het product op de foto voor voorraadbeheer. Gebruik barcode en seed als context. Geef een strak JSON-resultaat terug.',
  };

  const response = await openai.responses.create({
    model: getOpenAiModel(),
    text: {
      format: {
        type: 'json_schema',
        name: 'taze_product_recognition',
        strict: true,
        description: 'Taze productherkenning voor scan en voorraad',
        schema: buildRecognitionSchema(),
      },
    },
    input: [
      {
        role: 'system',
        content:
          'Je bent Taze productherkenning. Je leest camera- en barcode-input voor voorraadbeheer. Geef alleen het gevraagde JSON-resultaat terug. Wees precies, praktisch en voorzichtig met houdbaarheid.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: JSON.stringify(promptContext, null, 2),
          },
          {
            type: 'input_image',
            image_url: imageDataUri,
            detail: 'high',
          },
        ],
      },
    ],
  });

  const parsed = extractJsonObject(typeof response.output_text === 'string' ? response.output_text : '');
  if (!parsed) {
    return null;
  }

  return normalizeRecognition(parsed, input);
}

async function handleCopilotRequest(req, res) {
  const body = req.body ?? {};
  const question = normalizeQuestion(body.question);
  const screen = typeof body.screen === 'string' ? body.screen : 'explore';
  const language = typeof body.language === 'string' && body.language.trim() ? body.language.trim() : 'Nederlands';
  const context = body.context ?? {};
  const availableActions = normalizeAvailableActions(body.availableActions);
  const tenantContext =
    context && typeof context === 'object' && !Array.isArray(context)
      ? context.tenantContext ?? null
      : null;

  if (question.length < 3) {
    return res.status(400).json({ ok: false, error: 'question_too_short' });
  }

  const openai = createOpenAiClient();
  if (!openai) {
    return res.status(isOpenAiTemporarilyDisabled() ? 401 : 503).json({
      ok: false,
      error: isOpenAiTemporarilyDisabled() ? 'openai_auth_error' : 'openai_not_configured',
    });
  }

  const fallback = DEMO_MODE_ENABLED
    ? buildFallbackCopilotPayload({
        screen,
        availableActions,
        language,
        question,
      })
    : {
        title: 'AI copilot',
        answer: 'Live AI-antwoord is niet beschikbaar. Controleer api.taze.to/health.',
        recommendedRoute: inferRecommendedRoute(screen),
        recommendedLabel: 'Open aanbevolen scherm',
        model: getRiaModel(),
        actionKind: null,
        actionLabel: null,
        language,
      };

  try {
    const response = await openai.responses.create({
      model: getRiaModel(),
      input: [
        {
          role: 'system',
          content: [
            'Je bent RIA, de AI-copilot van Taze.',
            'Antwoord strikt in JSON met de velden title, answer, recommendedRoute, recommendedLabel, model, actionKind en actionLabel.',
            'Houd het antwoord kort, praktisch en in dezelfde taal als de gebruiker. Ondersteun uitleg, vertaling, samenvatting, waarschuwing en volgende-stap advies.',
            'Gebruik alleen context die hoort bij de actieve company, branch, role, functions en permissions.',
            'Geef nooit advies dat data, acties of inzichten van een andere company of branch raakt.',
            'Als tenantContext ontbreekt of leeg is, blijf conservatief en stel geen gevoelige actie voor.',
            'RIA is advisory-only: adviseer, leg uit, vertaal, vat samen en suggereer alleen.',
            'RIA mag nooit memberships, rollen, Stripe, pricing, betalingen, tenanttoegang of voorraad muteren of goedkeuren.',
            'Voorraad, betalingen en SaaS-beslissingen vereisen altijd expliciete menselijke bevestiging in de app.',
            'actionKind en actionLabel moeten altijd null zijn.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify(
            {
              screen,
              question,
              language,
              context,
              tenantContext,
              availableActions,
              allowedRoutes: Object.values(ROUTE_BY_SCREEN).concat(DEFAULT_ROUTE),
            },
            null,
            2
          ),
        },
      ],
    });

    const parsed = extractJsonObject(typeof response.output_text === 'string' ? response.output_text : '');
    if (!parsed) {
      if (DEMO_MODE_ENABLED) {
        return res.json(fallback);
      }

      return res.status(502).json({ ok: false, error: 'ai_invalid_response' });
    }

    return res.json(normalizeCopilotResponse(parsed, fallback));
  } catch (error) {
    const status = Number(error?.status ?? error?.statusCode ?? 0);
    if (status === 401 || status === 403) {
      markOpenAiAuthDisabled();
      return res.status(401).json({ ok: false, error: 'openai_auth_error' });
    }
    if (status === 429) {
      return res.status(429).json({ ok: false, error: 'openai_rate_limited' });
    }

    console.error('AI copilot fout:', error);
    if (DEMO_MODE_ENABLED) {
      return res.json(fallback);
    }

    return res.status(503).json({ ok: false, error: 'openai_unavailable' });
  }
}

async function handleHelpdeskAiRequest(req, res) {
  if (!req.body || typeof req.body !== 'object') {
    req.body = {};
  }

  req.body.screen = typeof req.body.screen === 'string' && req.body.screen.trim() ? req.body.screen : 'helpdesk';
  return handleCopilotRequest(req, res);
}

async function handleRecognizeRequest(req, res) {
  const body = req.body ?? {};
  const rawBarcode = typeof body.barcode === 'string' ? body.barcode : '';
  const rawImageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
  const rawImageUri = typeof body.imageUri === 'string' ? body.imageUri : '';
  const rawOcrText = typeof body.ocrText === 'string' ? body.ocrText : '';

  if (rawBarcode.length > MAX_RECOGNITION_BARCODE_LENGTH) {
    return res.status(400).json({ ok: false, error: 'barcode_too_long' });
  }

  if (rawImageUri.length > MAX_RECOGNITION_IMAGE_URI_LENGTH) {
    return res.status(400).json({ ok: false, error: 'image_uri_too_long' });
  }

  if (rawImageBase64.length > MAX_RECOGNITION_IMAGE_BASE64_LENGTH) {
    return res.status(400).json({ ok: false, error: 'image_base64_too_long' });
  }

  // Authenticate user
  if (process.env.NODE_ENV !== 'development' || req.headers.authorization) {
    await new Promise((resolve) => authenticateRequest(req, res, resolve));
    if (res.headersSent) return; // Auth failed
  } else {
    // Development bypass
    req.userId = 'test-user';
    req.companyId = 'test-company';
  }

  // Check rate limit
  const rateLimitResult = await checkRecognitionRateLimit(req.userId, req.companyId);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      ok: false,
      error: 'rate_limit_exceeded',
      retryAfter: rateLimitResult.retryAfter,
    });
  }

  // Check AI kill switch
  if (process.env.AI_KILL_SWITCH === 'true') {
    return res.status(503).json({
      ok: false,
      error: 'ai_service_unavailable',
      message: 'AI recognition is temporarily disabled',
    });
  }

  if (!rawBarcode && !rawImageBase64 && !rawImageUri) {
    return res.status(400).json({ ok: false, error: 'recognition_input_missing' });
  }

  const input = {
    barcode: rawBarcode,
    imageBase64: rawImageBase64,
    imageUri: rawImageUri,
    ocrText: rawOcrText,
  };
  const inputSeed = coerceRecognitionSeed(body.catalogSeed, input);
  const barcode = normalizeBarcodeValue(input.barcode);
  const cachedBarcode = barcode ? getCachedBarcodeRecognition(barcode) : undefined;

  if (cachedBarcode !== undefined) {
    // Log audit event for cached recognition
    await logAuditEvent('recognition.cached', req.userId, req.companyId, {
      barcode: barcode,
      has_image: Boolean(rawImageBase64 || rawImageUri),
    });
    return res.json(buildRecognizeResponse(cachedBarcode, cachedBarcode?.source || 'barcode', input));
  }

  let seed = inputSeed;

  if (barcode && !seed) {
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
      setCachedBarcodeRecognition(barcode, normalized);
      return res.json(buildRecognizeResponse(normalized, 'barcode', input));
    }
  }

  if (!seed && barcode) {
    const external = await lookupOpenFoodFactsBarcode(barcode);
    if (external) {
      seed = normalizeRecognition(external, input);
    }
  }

  if (!seed) {
    if (DEMO_MODE_ENABLED) {
      seed = normalizeRecognition(inferRecognition(input), input);
    }
  }

  if (!seed) {
    if (barcode && !input.imageBase64 && !input.imageUri) {
      return sendRecognitionUnavailable(
        res,
        404,
        'product_lookup_not_found',
        `Barcode ${barcode} staat nog niet in de productdatabase.`,
        { barcode }
      );
    }

    if (!createOpenAiClient() && (input.imageBase64 || input.imageUri)) {
      return sendRecognitionUnavailable(
        res,
        isOpenAiTemporarilyDisabled() ? 401 : 503,
        isOpenAiTemporarilyDisabled() ? 'openai_auth_error' : 'openai_not_configured',
        isOpenAiTemporarilyDisabled()
          ? 'OpenAI-authenticatie is niet geconfigureerd of tijdelijk uitgeschakeld.'
          : 'Live AI herkenning is niet geconfigureerd op de backend.'
      );
    }
  }

  const openai = createOpenAiClient();
  if (openai && (input.imageBase64 || input.imageUri)) {
    try {
      const aiResult = await recognizeWithOpenAi(openai, input, seed);
      const normalized = normalizeRecognition(aiResult ?? seed, input);
      if (barcode) {
        setCachedBarcodeRecognition(barcode, normalized);
      }
      // Log audit event for AI recognition
      await logAuditEvent('recognition.ai', req.userId, req.companyId, {
        barcode: barcode,
        has_image: Boolean(rawImageBase64 || rawImageUri),
        ai_used: true,
      });
      return res.json(buildRecognizeResponse(normalized, 'vision', input));
    } catch (error) {
      const status = Number(error?.status ?? error?.statusCode ?? 0);
      if (status === 401 || status === 403) {
        markOpenAiAuthDisabled();
      }
      if (status === 429) {
        return sendRecognitionUnavailable(
          res,
          429,
          'openai_rate_limited',
          'OpenAI rate limit is bereikt. Probeer later opnieuw.'
        );
      }

      console.error('AI herkenning fout:', error);
      return sendRecognitionUnavailable(
        res,
        503,
        'openai_unavailable',
        'Live AI herkenning is niet beschikbaar. Controleer OPENAI_API_KEY op de backend.'
      );
    }
  } else if (!openai && !seed && (input.imageBase64 || input.imageUri)) {
    return sendRecognitionUnavailable(
      res,
      isOpenAiTemporarilyDisabled() ? 401 : 503,
      isOpenAiTemporarilyDisabled() ? 'openai_auth_error' : 'openai_not_configured',
      isOpenAiTemporarilyDisabled()
        ? 'OpenAI-authenticatie is niet geconfigureerd of tijdelijk uitgeschakeld.'
        : 'Live AI herkenning is niet geconfigureerd op de backend.'
    );
  }

  if (!seed) {
    return sendRecognitionUnavailable(
      res,
      503,
      'recognition_not_configured',
      'Live herkenning is niet beschikbaar. Controleer api.taze.to/health en je OpenAI/Supabase-config.'
    );
  }

  if (barcode) {
    setCachedBarcodeRecognition(barcode, seed);
  }

  await logAuditEvent('recognition.lookup', req.userId, req.companyId, {
    barcode: barcode,
    has_image: Boolean(rawImageBase64 || rawImageUri),
    ai_used: false,
  });

  return res.json(buildRecognizeResponse(seed, 'barcode', input));
}

function isProbablyEmail(value) {
  const trimmed = trimEnv(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(trimmed);
}

async function sendBrevoSubscription(email) {
  const apiKey = trimEnv(process.env.BREVO_API_KEY);
  const listIdRaw = trimEnv(process.env.BREVO_LIST_ID);
  const listId = Number.parseInt(listIdRaw, 10);

  if (!apiKey || !Number.isFinite(listId) || listId <= 0) {
    return { ok: false, reason: 'newsletter_not_configured' };
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
      updateEnabled: true,
      listIds: [listId],
    }),
  });

  if (response.ok || response.status === 204 || response.status === 409) {
    return { ok: true, mode: 'brevo' };
  }

  const detail = await response.text().catch(() => '');
  return { ok: false, reason: 'newsletter_error', detail };
}

async function persistStripeCheckoutPayment(stripe, session) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, reason: 'supabase_not_configured' };
  }

  const customerEmail = trimEnv(session.customer_email ?? session.customer_details?.email);
  const planId = trimEnv(session.metadata?.planId);
  const interval = normalizeBillingInterval(session.metadata?.interval);
  const companyId = trimEnv(session.metadata?.companyId || session.metadata?.company_id);
  if (!customerEmail || !planId || !interval) {
    return { ok: false, reason: 'stripe_payment_metadata_missing' };
  }

  let stripeCustomerId = typeof session.customer === 'string' ? trimEnv(session.customer) : '';
  let stripeSubscriptionId = typeof session.subscription === 'string' ? trimEnv(session.subscription) : '';
  let stripeInvoiceId = typeof session.invoice === 'string' ? trimEnv(session.invoice) : '';
  let stripePaymentIntentId = typeof session.payment_intent === 'string' ? trimEnv(session.payment_intent) : '';
  let stripeChargeId = '';
  let amountTotal = Number.isFinite(session.amount_total) ? Number(session.amount_total) : 0;
  let currency = trimEnv(session.currency) || 'EUR';
  const metadata = {
    planId,
    interval,
    paymentMethodId: trimEnv(session.metadata?.paymentMethodId),
    clientReferenceId: trimEnv(session.client_reference_id),
  };

  try {
    if (stripeSubscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
        expand: ['latest_invoice'],
      });
      stripeCustomerId = typeof subscription.customer === 'string' ? trimEnv(subscription.customer) : stripeCustomerId;

      const latestInvoice = subscription.latest_invoice && typeof subscription.latest_invoice === 'object' ? subscription.latest_invoice : null;
      if (latestInvoice) {
        stripeInvoiceId = typeof latestInvoice.id === 'string' ? trimEnv(latestInvoice.id) : stripeInvoiceId;
        amountTotal = Number.isFinite(latestInvoice.amount_paid) ? Number(latestInvoice.amount_paid) : amountTotal;
        currency = trimEnv(latestInvoice.currency) || currency;

        const paymentIntentRef = latestInvoice.payment_intent;
        const paymentIntentId =
          typeof paymentIntentRef === 'string'
            ? trimEnv(paymentIntentRef)
            : paymentIntentRef && typeof paymentIntentRef === 'object' && typeof paymentIntentRef.id === 'string'
              ? trimEnv(paymentIntentRef.id)
              : '';

        if (paymentIntentId) {
          stripePaymentIntentId = paymentIntentId;
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
            expand: ['latest_charge'],
          });

          amountTotal = Number.isFinite(paymentIntent.amount_received) ? Number(paymentIntent.amount_received) : amountTotal;
          currency = trimEnv(paymentIntent.currency) || currency;
          const latestCharge = paymentIntent.latest_charge;
          stripeChargeId =
            typeof latestCharge === 'string'
              ? trimEnv(latestCharge)
              : latestCharge && typeof latestCharge === 'object' && typeof latestCharge.id === 'string'
                ? trimEnv(latestCharge.id)
                : stripeChargeId;
        }
      }
    } else if (stripePaymentIntentId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId, {
        expand: ['latest_charge'],
      });

      amountTotal = Number.isFinite(paymentIntent.amount_received) ? Number(paymentIntent.amount_received) : amountTotal;
      currency = trimEnv(paymentIntent.currency) || currency;
      const latestCharge = paymentIntent.latest_charge;
      stripeChargeId =
        typeof latestCharge === 'string'
          ? trimEnv(latestCharge)
          : latestCharge && typeof latestCharge === 'object' && typeof latestCharge.id === 'string'
            ? trimEnv(latestCharge.id)
            : stripeChargeId;
    }
  } catch (error) {
    console.error('Stripe checkout payment details ophalen mislukt:', error);
    return { ok: false, reason: 'stripe_lookup_failed' };
  }

  const now = new Date().toISOString();
  const payload = {
    checkout_session_id: trimEnv(session.id),
    customer_email: customerEmail,
    plan_id: planId,
    interval,
    amount_total: amountTotal,
    currency,
    stripe_customer_id: stripeCustomerId || null,
    stripe_subscription_id: stripeSubscriptionId || null,
    stripe_invoice_id: stripeInvoiceId || null,
    stripe_payment_intent_id: stripePaymentIntentId || null,
    stripe_charge_id: stripeChargeId || null,
    company_id: companyId || null,
    payment_status: trimEnv(session.payment_status) || 'paid',
    refund_status: 'none',
    refunded_at: null,
    created_at: now,
    updated_at: now,
    metadata,
  };

  const { error } = await supabase.from('stripe_checkout_payments').upsert(payload, {
    onConflict: 'checkout_session_id',
  });

  if (error) {
    return { ok: false, reason: 'stripe_payment_store_failed', detail: error.message };
  }

  return {
    ok: true,
    payment: payload,
  };
}

async function findStripeCheckoutPayment({ checkoutSessionId, customerEmail, planId, interval, companyId }) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, reason: 'supabase_not_configured' };
  }

  if (checkoutSessionId) {
    let query = supabase
      .from('stripe_checkout_payments')
      .select('*')
      .eq('checkout_session_id', checkoutSessionId);

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return { ok: false, reason: 'payment_lookup_failed', detail: error.message };
    }

    if (data) {
      return { ok: true, payment: data };
    }
  }

  if (!customerEmail || !planId || !interval) {
    return { ok: false, reason: 'payment_not_found' };
  }

  let query = supabase
    .from('stripe_checkout_payments')
    .select('*')
    .eq('customer_email', customerEmail)
    .eq('plan_id', planId)
    .eq('interval', interval)
    .neq('refund_status', 'refunded');

  if (companyId) {
    query = query.eq('company_id', companyId);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(1);

  if (error) {
    return { ok: false, reason: 'payment_lookup_failed', detail: error.message };
  }

  const payment = Array.isArray(data) ? data[0] ?? null : null;
  if (!payment) {
    return { ok: false, reason: 'payment_not_found' };
  }

  return { ok: true, payment };
}

async function handleRefundRequest(req, res) {
  // Authenticate user
  await new Promise((resolve) => authenticateRequest(req, res, resolve));
  if (res.headersSent) return; // Auth failed

  // Check permission
  const hasPermission = await checkUserPermission(req, res, 'refund.request');
  if (!hasPermission) {
    return res.status(403).json({ ok: false, error: 'insufficient_permissions' });
  }

  const body = req.body ?? {};
  const checkoutSessionId = trimEnv(body.checkout_session_id);
  const customerEmail = trimEnv(body.customer_email);
  const planId = trimEnv(body.plan_id);
  const interval = trimEnv(body.interval);
  const reason = trimEnv(body.reason);
  const requesterEmail = trimEnv(body.requester_email) || req.userEmail;
  const invoiceNumber = trimEnv(body.invoice_number);

  if (!checkoutSessionId || !customerEmail || !planId || !interval || !reason) {
    return res.status(400).json({ ok: false, error: 'missing_required_fields' });
  }

  const paymentLookup = await findStripeCheckoutPayment({
    checkoutSessionId,
    customerEmail,
    planId,
    interval,
    companyId: req.companyId,
  });

  if (!paymentLookup.ok || !paymentLookup.payment) {
    return res.status(404).json({ ok: false, error: 'payment_not_found' });
  }

  const refundRequest = await createRefundRequestRecord({
    checkoutSessionId,
    customerEmail,
    planId,
    interval,
    reason,
    requesterEmail,
    invoiceNumber,
    supportEmail: getSupportInboxEmail(),
    payment: paymentLookup.payment,
    companyId: req.companyId,
  });

  if (!refundRequest.ok) {
    return res.status(500).json({ ok: false, error: refundRequest.reason });
  }

  // Log audit event
  await logAuditEvent('refund.requested', req.userId, req.companyId, {
    refund_request_id: refundRequest.request.id,
    customer_email: customerEmail,
    plan_id: planId,
    interval,
    amount: refundRequest.request.amount_total,
    currency: refundRequest.request.currency,
  });

  const approvalEmail = buildRefundApprovalEmail({
    supportEmail: getSupportInboxEmail(),
    customerEmail,
    planId,
    interval,
    amount: formatMinorCurrency(Number(refundRequest.request.amount_total), refundRequest.request.currency),
    reason,
    approvalUrl: buildAppUrl(`/api/refunds/approve?token=${refundRequest.approvalToken}`),
    rejectUrl: buildAppUrl(`/api/refunds/reject?token=${refundRequest.approvalToken}`),
    invoiceNumber,
  });

  const emailResult = await sendEmail(approvalEmail);
  if (!emailResult.ok) {
    await supabase
      .from('refund_requests')
      .update({
        status: 'email_failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', refundRequest.request.id);
  }

  res.json({ ok: true, request_id: refundRequest.request.id });
}

async function createRefundRequestRecord({
  checkoutSessionId,
  customerEmail,
  planId,
  interval,
  reason,
  requesterEmail,
  invoiceNumber,
  supportEmail,
  payment,
  companyId,
}) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, reason: 'supabase_not_configured' };
  }

  const approvalToken = createApprovalToken();
  const approvalTokenHash = hashApprovalToken(approvalToken);
  const requestId = `refund_${crypto.randomBytes(8).toString('hex')}`;
  const now = new Date().toISOString();
  const approvalExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  const requestPayload = {
    id: requestId,
    checkout_session_id: checkoutSessionId,
    customer_email: customerEmail,
    plan_id: planId,
    interval,
    reason,
    requester_email: requesterEmail || null,
    invoice_number: invoiceNumber || null,
    support_email: supportEmail,
    approval_token_hash: approvalTokenHash,
    approval_expires_at: approvalExpiresAt,
    status: 'pending',
    amount_total: Number(payment?.amount_total ?? 0),
    currency: trimEnv(payment?.currency) || 'EUR',
    stripe_customer_id: payment?.stripe_customer_id || null,
    stripe_subscription_id: payment?.stripe_subscription_id || null,
    stripe_invoice_id: payment?.stripe_invoice_id || null,
    stripe_payment_intent_id: payment?.stripe_payment_intent_id || null,
    stripe_charge_id: payment?.stripe_charge_id || null,
    company_id: companyId,
    created_at: now,
    updated_at: now,
  };

  const { error } = await supabase.from('refund_requests').insert(requestPayload);
  if (error) {
    return { ok: false, reason: 'refund_request_store_failed', detail: error.message };
  }

  return {
    ok: true,
    request: requestPayload,
    approvalToken,
  };
}

function buildRefundApprovalEmail({ supportEmail, customerEmail, planId, interval, amount, reason, approvalUrl, rejectUrl, invoiceNumber }) {
  const title = 'Terugbetalingsverzoek in afwachting';
  const subject = `[Refund] ${customerEmail} - ${planId} (${formatBillingIntervalLabel(interval)})`;
  const safeReason = escapeHtml(reason);
  const safeAmount = escapeHtml(amount);
  const safeCustomer = escapeHtml(customerEmail);
  const safePlan = escapeHtml(planId);
  const safeInterval = escapeHtml(formatBillingIntervalLabel(interval));
  const safeInvoice = invoiceNumber ? escapeHtml(invoiceNumber) : 'Niet gekoppeld';
  const safeApprovalUrl = escapeHtml(approvalUrl);
  const safeRejectUrl = escapeHtml(rejectUrl);
  const safeSupportEmail = escapeHtml(supportEmail);
  const htmlContent = `
    <div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:24px">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#64748b;margin-bottom:8px">Taze refund approval</div>
        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.2">Terugbetaling klaar voor goedkeuring</h1>
        <p style="margin:0 0 16px;line-height:1.6">De klant vraagt duidelijk om geld terug. Klik op <strong>Approve refund</strong> om in Stripe de terugbetaling direct uit te voeren.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:16px;margin:20px 0">
          <p style="margin:0 0 8px"><strong>Klant:</strong> ${safeCustomer}</p>
          <p style="margin:0 0 8px"><strong>Pakket:</strong> ${safePlan}</p>
          <p style="margin:0 0 8px"><strong>Cyclus:</strong> ${safeInterval}</p>
          <p style="margin:0 0 8px"><strong>Bedrag:</strong> ${safeAmount}</p>
          <p style="margin:0 0 8px"><strong>Factuur:</strong> ${safeInvoice}</p>
          <p style="margin:0"><strong>Reden:</strong> ${safeReason}</p>
        </div>
        <p style="margin:0 0 20px;line-height:1.6">Support inbox: ${safeSupportEmail}. De Stripe-refund wordt automatisch gemaakt op de originele betaling zodra je goedkeurt.</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <a href="${safeApprovalUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">Approve refund</a>
          <a href="${safeRejectUrl}" style="display:inline-block;background:#e2e8f0;color:#0f172a;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">Reject</a>
        </div>
      </div>
    </div>
  `;

  const textContent = [
    title,
    `Klant: ${customerEmail}`,
    `Pakket: ${planId}`,
    `Cyclus: ${interval}`,
    `Bedrag: ${amount}`,
    `Factuur: ${invoiceNumber || 'Niet gekoppeld'}`,
    `Reden: ${reason}`,
    `Approve: ${approvalUrl}`,
    `Reject: ${rejectUrl}`,
  ].join('\n');

  return {
    subject,
    htmlContent,
    textContent,
  };
}

function buildRefundConfirmationEmail({ customerEmail, planId, interval, amount, refundId, supportEmail }) {
  const subject = `Je terugbetaling is bevestigd - ${planId}`;
  const htmlContent = `
    <div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:24px">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#64748b;margin-bottom:8px">Taze refund bevestigd</div>
        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.2">Je geld terug is in gang gezet</h1>
        <p style="margin:0 0 16px;line-height:1.6">De terugbetaling voor <strong>${escapeHtml(planId)}</strong> is bevestigd en via Stripe uitgevoerd.</p>
        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:16px;padding:16px;margin:20px 0">
          <p style="margin:0 0 8px"><strong>Klant:</strong> ${escapeHtml(customerEmail)}</p>
          <p style="margin:0 0 8px"><strong>Cyclus:</strong> ${escapeHtml(formatBillingIntervalLabel(interval))}</p>
          <p style="margin:0 0 8px"><strong>Bedrag:</strong> ${escapeHtml(amount)}</p>
          <p style="margin:0"><strong>Stripe refund:</strong> ${escapeHtml(refundId)}</p>
        </div>
        <p style="margin:0;line-height:1.6">Je bank of kaartuitgever verwerkt de terugbetaling verder. Vragen? Mail ${escapeHtml(supportEmail)}.</p>
      </div>
    </div>
  `;

  const textContent = [
    'Je terugbetaling is bevestigd.',
    `Klant: ${customerEmail}`,
    `Pakket: ${planId}`,
    `Cyclus: ${formatBillingIntervalLabel(interval)}`,
    `Bedrag: ${amount}`,
    `Stripe refund: ${refundId}`,
    `Support: ${supportEmail}`,
  ].join('\n');

  return { subject, htmlContent, textContent };
}

async function handleNewsletterSubscribe(req, res, runtime) {
  const body = req.body ?? {};
  const email = trimEnv(body.email);
  const isProduction = trimEnv(process.env.NODE_ENV).toLowerCase() === 'production';

  if (!isProbablyEmail(email)) {
    return res.status(400).json({ ok: false, error: 'invalid_email' });
  }

  const brevoEnabled = trimEnv(process.env.BREVO_ENABLED);
  const brevoActive = brevoEnabled === '' || brevoEnabled === '1' || brevoEnabled === 'true' || brevoEnabled === 'yes';

  if (brevoActive) {
    try {
      const result = await sendBrevoSubscription(email);
      if (result.ok) {
        newsletterMemorySubscribers.add(email.toLowerCase());
        return res.json({ ok: true, mode: result.mode ?? 'brevo' });
      }

      if (runtime === 'cloudflare' || isProduction) {
        return res.status(503).json({ ok: false, error: result.reason ?? 'newsletter_not_configured' });
      }
    } catch (error) {
      console.error('Newsletter subscribe fout:', error);
      if (runtime === 'cloudflare' || isProduction) {
        return res.status(503).json({ ok: false, error: 'newsletter_error' });
      }
    }
  }

  if (runtime === 'cloudflare' || isProduction) {
    return res.status(503).json({ ok: false, error: 'newsletter_not_configured' });
  }

  newsletterMemorySubscribers.add(email.toLowerCase());
  return res.json({ ok: true, mode: 'memory' });
}

function buildStripeWebhookHandler() {
  const processedEvents = new Set();

  return async (req, res) => {
    const secret = trimEnv(process.env.STRIPE_WEBHOOK_SECRET);
    const stripe = createStripeClient();

    if (!secret || !stripe) {
      return res.status(503).json({ ok: false, error: 'stripe_not_configured' });
    }

    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ ok: false, error: 'stripe_signature_missing' });
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (error) {
      console.error('Stripe webhook signature fout:', error);
      return res.status(400).json({ ok: false, error: 'stripe_signature_invalid' });
    }

    // Check for duplicate event processing
    if (processedEvents.has(event.id)) {
      console.log('Stripe webhook duplicate event ignored:', event.id);
      return res.json({ ok: true, received: false, duplicate: true });
    }

    if (!ALLOWED_STRIPE_WEBHOOK_EVENT_TYPES.has(event.type)) {
      console.warn('Stripe webhook event type ignored:', event.type);
      return res.json({ ok: true, received: false, ignored: true });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object ?? {};
      const persistedPayment = await persistStripeCheckoutPayment(stripe, session);
      if (!persistedPayment.ok) {
        console.error('Stripe checkout session kon niet worden opgeslagen:', persistedPayment);
        return res.status(503).json({ ok: false, error: persistedPayment.reason ?? 'stripe_payment_store_failed' });
      }

      console.log('Stripe checkout.session.completed', {
        id: session.id,
        customer_email: session.customer_email ?? null,
        client_reference_id: session.client_reference_id ?? null,
        plan_id: session.metadata?.planId ?? null,
        interval: session.metadata?.interval ?? null,
      });
    }

    processedEvents.add(event.id);
    // Clean up old events to prevent memory leak
    if (processedEvents.size > 1000) {
      const oldest = processedEvents.values().next().value;
      processedEvents.delete(oldest);
    }

    return res.json({ ok: true, received: true });
  };
}

async function handleStripeStatus(req, res) {
  void req;
  return res.json(getStripeStatusSnapshot());
}

async function handleSupabaseStatus(req, res) {
  void req;
  return res.json(getSupabaseStatusSnapshot());
}

async function handleStripeCheckoutSession(req, res) {
  const body = req.body ?? {};
  const secret = trimEnv(process.env.STRIPE_SECRET_KEY);
  const stripe = createStripeClient();

  if (!secret || !stripe) {
    return res.status(503).json({ error: 'stripe_not_configured' });
  }

  const planId = trimEnv(body.planId);
  const interval = trimEnv(body.interval).toLowerCase();
  const successUrl = trimEnv(body.successUrl);
  const cancelUrl = trimEnv(body.cancelUrl);
  const email = trimEnv(body.email);
  const paymentMethodId = trimEnv(body.paymentMethodId);

  let successOrigin = null;
  let cancelOrigin = null;
  try {
    successOrigin = new URL(successUrl).origin;
    cancelOrigin = new URL(cancelUrl).origin;
  } catch {
    return res.status(400).json({ error: 'bad_return_url' });
  }

  if (!isAllowedReturnOrigin(successOrigin) || !isAllowedReturnOrigin(cancelOrigin)) {
    return res.status(400).json({ error: 'bad_return_url' });
  }

  const price = getStripePriceId(planId, interval);
  if (!price) {
    return res.status(400).json({ error: 'price_not_configured' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: price.value, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: email || undefined,
      allow_promotion_codes: true,
      locale: 'nl',
      metadata: {
        planId,
        interval,
        paymentMethodId: paymentMethodId || '',
      },
      subscription_data: {
        metadata: {
          planId,
          interval,
          paymentMethodId: paymentMethodId || '',
        },
      },
    });

    if (!session.url) {
      return res.status(500).json({ error: 'stripe_error' });
    }

    return res.json({
      url: session.url,
      id: session.id,
      priceKey: price.key,
    });
  } catch (error) {
    const status = Number(error?.statusCode ?? error?.status ?? 0);
    const code = String(error?.code ?? '');
    const type = String(error?.type ?? '');
    const message = String(error?.message ?? '');

    if (status === 401 || type === 'StripeAuthenticationError' || code === 'invalid_api_key') {
      return res.status(401).json({ error: 'stripe_error', hint: 'stripe_auth_error' });
    }

    if (code === 'resource_missing' || (/no such price/i.test(message)) || (/price/i.test(message) && /not/i.test(message))) {
      return res.status(400).json({ error: 'stripe_error', hint: 'stripe_price_invalid' });
    }

    console.error('Stripe checkout fout:', error);
    return res.status(500).json({ error: 'stripe_error', hint: 'stripe_server_error' });
  }
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

function buildRefundDecisionConfirmationPage({ action, token, customerEmail, planId, interval, amountLabel, reason, invoiceNumber }) {
  const isApprove = action === 'approve';
  const actionLabel = isApprove ? 'Goedkeuren' : 'Weigeren';
  const headline = isApprove ? 'Refund goedkeuren' : 'Refund weigeren';
  const amountText = amountLabel ? ` / ${amountLabel}` : '';
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
      </style>
    </head>
    <body>
      <main>
        <section class="card">
          <h1>${escapeHtml(headline)}</h1>
          <p>Je staat op het punt de terugbetaling voor <strong>${escapeHtml(customerEmail)}</strong> te ${isApprove ? 'goedkeuren' : 'weigeren'}.</p>
          <p style="margin:0 0 12px; color:#475569;">${escapeHtml(planId)} / ${escapeHtml(formatBillingIntervalLabel(interval))}${amountText}${invoiceText}</p>
          ${reasonHtml}
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
          location.href = ${JSON.stringify(buildAppUrl('/support'))};
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

async function handleRefundDecision(req, res, action) {
  const method = String(req.method).toUpperCase();
  if (method === 'GET') {
    return renderRefundDecisionConfirmation(req, res, action);
  }

  if (method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  if (!req.is('application/json')) {
    return res.status(400).send(
      buildRefundResultPage({
        title: 'Ongeldige aanvraag',
        headline: 'De refund-aanvraag moet met JSON worden verzonden',
        detail: 'Gebruik de goedkeuringspagina om de actie te bevestigen.',
        primaryHref: buildAppUrl('/support'),
        primaryLabel: 'Open support',
      })
    );
  }

  // Authenticate user
  await new Promise((resolve) => authenticateRequest(req, res, resolve));
  if (res.headersSent) return; // Auth failed

  // Check permission
  const hasPermission = await checkUserPermission(req, res, 'refund.manage');
  if (!hasPermission) {
    return res.status(403).send(
      buildRefundResultPage({
        title: 'Geen toegang',
        headline: 'Je hebt geen toestemming om refunds te beheren',
        detail: 'Alleen gebruikers met refund-beheer permissies kunnen deze actie uitvoeren.',
        primaryHref: buildAppUrl('/support'),
        primaryLabel: 'Open support',
      })
    );
  }

  const token = trimEnv(req.body?.token);
  if (!token) {
    return res.status(400).send(
      buildRefundResultPage({
        title: 'Refund token ontbreekt',
        headline: 'Geen geldige goedkeuringslink',
        detail: 'De goedkeuringslink mist een token. Open de mail opnieuw en gebruik de knop uit de laatste refund-mail.',
        primaryHref: buildAppUrl('/support'),
        primaryLabel: 'Open support',
        secondaryHref: buildAppUrl('/contact'),
        secondaryLabel: 'Open contact',
      })
    );
  }

  const secretKey = trimEnv(process.env.STRIPE_SECRET_KEY);
  const stripe = createStripeClient();
  const supabase = createSupabaseAdminClient();

  if (!secretKey || !stripe || !supabase) {
    return res.status(503).send(
      buildRefundResultPage({
        title: 'Refund niet beschikbaar',
        headline: 'Refund flow is nog niet volledig geconfigureerd',
        detail: 'Stripe of Supabase is nog niet klaar om de terugbetaling uit te voeren. Controleer de server secrets en probeer opnieuw.',
        primaryHref: buildAppUrl('/support'),
        primaryLabel: 'Open support',
        secondaryHref: buildAppUrl('/payments'),
        secondaryLabel: 'Open payments',
      })
    );
  }

  const tokenHash = hashApprovalToken(token);
  const { data: refundRequest, error: refundRequestError } = await supabase
    .from('refund_requests')
    .select('*')
    .eq('approval_token_hash', tokenHash)
    .maybeSingle();

  if (refundRequestError) {
    return res.status(503).send(
      buildRefundResultPage({
        title: 'Refund fout',
        headline: 'Kon de refund-aanvraag niet laden',
        detail: 'De server kon de aanvraag niet uitlezen. Probeer de link opnieuw of open support.',
        primaryHref: buildAppUrl('/support'),
        primaryLabel: 'Open support',
        secondaryHref: buildAppUrl('/contact'),
        secondaryLabel: 'Open contact',
      })
    );
  }

  if (!refundRequest) {
    return res.status(404).send(
      buildRefundResultPage({
        title: 'Refund niet gevonden',
        headline: 'Deze goedkeuringslink is niet geldig',
        detail: 'De token bestaat niet meer of hoort niet bij een actieve refund-aanvraag.',
        primaryHref: buildAppUrl('/support'),
        primaryLabel: 'Open support',
        secondaryHref: buildAppUrl('/contact'),
        secondaryLabel: 'Open contact',
      })
    );
  }

  const canProcessDecision = ['pending', 'email_failed', 'failed'].includes(String(refundRequest.status));
  if (refundRequest.status === 'refunded') {
    return res.status(200).send(
      buildRefundResultPage({
        title: 'Refund al uitgevoerd',
        headline: 'Deze terugbetaling is al afgerond',
        detail: `De Stripe-refund voor ${refundRequest.customer_email} is al verwerkt. Bedrag: ${formatMinorCurrency(Number(refundRequest.amount_total ?? 0), refundRequest.currency)}. Cyclus: ${formatBillingIntervalLabel(refundRequest.interval)}.`,
        primaryHref: buildAppUrl('/payments'),
        primaryLabel: 'Open payments',
        secondaryHref: buildAppUrl('/support'),
        secondaryLabel: 'Open support',
      })
    );
  }

  if (refundRequest.status === 'rejected' && action === 'approve') {
    return res.status(409).send(
      buildRefundResultPage({
        title: 'Refund geweigerd',
        headline: 'Deze terugbetalingsaanvraag is al geweigerd',
        detail: `Er is geen Stripe-refund uitgevoerd. Cyclus: ${formatBillingIntervalLabel(refundRequest.interval)}. Vraag een nieuwe aanvraag aan als je alsnog wilt doorgaan.`,
        primaryHref: buildAppUrl('/support'),
        primaryLabel: 'Open support',
        secondaryHref: buildAppUrl('/payments'),
        secondaryLabel: 'Open payments',
      })
    );
  }

  if (refundRequest.status === 'rejected' && action === 'reject') {
    return res.status(200).send(
      buildRefundResultPage({
        title: 'Refund geweigerd',
        headline: 'Deze terugbetalingsaanvraag was al geweigerd',
        detail: `Er is niets meer om te wijzigen. Cyclus: ${formatBillingIntervalLabel(refundRequest.interval)}. Open support als je dit opnieuw wilt bekijken.`,
        primaryHref: buildAppUrl('/support'),
        primaryLabel: 'Open support',
        secondaryHref: buildAppUrl('/payments'),
        secondaryLabel: 'Open payments',
      })
    );
  }

  const approvalExpiresAt = new Date(refundRequest.approval_expires_at);
  if (Number.isNaN(approvalExpiresAt.getTime()) || approvalExpiresAt.getTime() < Date.now()) {
    await supabase
      .from('refund_requests')
      .update({
        status: 'expired',
        updated_at: new Date().toISOString(),
      })
      .eq('id', refundRequest.id);

    return res.status(410).send(
      buildRefundResultPage({
        title: 'Refund verlopen',
        headline: 'Deze goedkeuringslink is verlopen',
        detail: 'Vraag een nieuwe refund-aanvraag aan vanuit de app of contacteer support.',
        primaryHref: buildAppUrl('/support'),
        primaryLabel: 'Open support',
        secondaryHref: buildAppUrl('/payments'),
        secondaryLabel: 'Open payments',
      })
    );
  }

  if (!canProcessDecision) {
    return res.status(409).send(
      buildRefundResultPage({
        title: 'Refund status',
        headline: 'Deze terugbetalingsaanvraag is al verwerkt',
        detail: 'Open support als je een nieuwe aanvraag wilt starten of als je de beslissing wilt laten nakijken.',
        primaryHref: buildAppUrl('/support'),
        primaryLabel: 'Open support',
        secondaryHref: buildAppUrl('/payments'),
        secondaryLabel: 'Open payments',
      })
    );
  }

  // Idempotency check: prevent duplicate processing
  const idempotencyKey = `refund_${refundRequest.id}_${action}`;
  if (processedRefunds.has(idempotencyKey)) {
    return res.status(409).send(
      buildRefundResultPage({
        title: 'Refund al verwerkt',
        headline: 'Deze actie is al uitgevoerd',
        detail: 'De refund-aanvraag is al verwerkt om dubbele uitvoering te voorkomen.',
        primaryHref: buildAppUrl('/support'),
        primaryLabel: 'Open support',
      })
    );
  }
  processedRefunds.add(idempotencyKey);

  if (action === 'reject') {
    await supabase
      .from('refund_requests')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', refundRequest.id);

    // Log audit event
    await logAuditEvent('refund.rejected', req.userId, req.companyId, {
      refund_request_id: refundRequest.id,
      customer_email: refundRequest.customer_email,
      amount: refundRequest.amount_total,
      currency: refundRequest.currency,
    });

    return res.status(200).send(
      buildRefundResultPage({
        title: 'Refund geweigerd',
        headline: 'De terugbetalingsaanvraag is geweigerd',
        detail: `Er is geen Stripe-refund uitgevoerd. Cyclus: ${formatBillingIntervalLabel(refundRequest.interval)}. Open support als je dit later alsnog wilt behandelen.`,
        primaryHref: buildAppUrl('/support'),
        primaryLabel: 'Open support',
        secondaryHref: buildAppUrl('/contact'),
        secondaryLabel: 'Open contact',
      })
    );
  }

  // Idempotency check for approve action
  const approveIdempotencyKey = `refund_${refundRequest.id}_approve`;
  if (processedRefunds.has(approveIdempotencyKey)) {
    return res.status(409).send(
      buildRefundResultPage({
        title: 'Refund al verwerkt',
        headline: 'Deze actie is al uitgevoerd',
        detail: 'De refund-aanvraag is al verwerkt om dubbele uitvoering te voorkomen.',
        primaryHref: buildAppUrl('/support'),
        primaryLabel: 'Open support',
      })
    );
  }
  processedRefunds.add(approveIdempotencyKey);

  const paymentLookup = await findStripeCheckoutPayment({
    checkoutSessionId: refundRequest.checkout_session_id,
    customerEmail: refundRequest.customer_email,
    planId: refundRequest.plan_id,
    interval: refundRequest.interval,
    companyId: refundRequest.company_id,
  });

  if (!paymentLookup.ok || !paymentLookup.payment) {
    await supabase
      .from('refund_requests')
      .update({
        status: 'failed',
        stripe_refund_error: paymentLookup.detail || paymentLookup.reason || 'payment_not_found',
        updated_at: new Date().toISOString(),
      })
      .eq('id', refundRequest.id);

    return res.status(404).send(
      buildRefundResultPage({
        title: 'Betaling niet gevonden',
        headline: 'De originele Stripe-betaling kon niet worden gevonden',
        detail: 'De checkout-session of payment intent is nog niet teruggevonden. Controleer of de webhook succesvol heeft opgeslagen.',
        primaryHref: buildAppUrl('/payments'),
        primaryLabel: 'Open payments',
        secondaryHref: buildAppUrl('/support'),
        secondaryLabel: 'Open support',
      })
    );
  }

  let payment = paymentLookup.payment;
  if (!payment.stripe_payment_intent_id && !payment.stripe_charge_id) {
    try {
      const stripeSession = await stripe.checkout.sessions.retrieve(payment.checkout_session_id, {
        expand: ['subscription'],
      });
      const hydrated = await persistStripeCheckoutPayment(stripe, stripeSession);
      if (hydrated.ok && hydrated.payment) {
        payment = hydrated.payment;
      }
    } catch (error) {
      const detail = String(error?.message ?? error ?? 'payment_refresh_failed');
      await supabase
        .from('refund_requests')
        .update({
          status: 'failed',
          stripe_refund_error: detail,
          updated_at: new Date().toISOString(),
        })
        .eq('id', refundRequest.id);

      return res.status(502).send(
        buildRefundResultPage({
          title: 'Refund sync mislukt',
          headline: 'Stripe kon de payment reference niet opnieuw ophalen',
          detail,
          primaryHref: buildAppUrl('/support'),
          primaryLabel: 'Open support',
          secondaryHref: buildAppUrl('/payments'),
          secondaryLabel: 'Open payments',
        })
      );
    }
  }

  const refundParams = payment.stripe_payment_intent_id
    ? {
        payment_intent: payment.stripe_payment_intent_id,
        reason: 'requested_by_customer',
        metadata: {
          refund_request_id: refundRequest.id,
          customer_email: refundRequest.customer_email,
          plan_id: refundRequest.plan_id,
          interval: refundRequest.interval,
        },
      }
    : payment.stripe_charge_id
      ? {
          charge: payment.stripe_charge_id,
          reason: 'requested_by_customer',
          metadata: {
            refund_request_id: refundRequest.id,
            customer_email: refundRequest.customer_email,
            plan_id: refundRequest.plan_id,
            interval: refundRequest.interval,
          },
        }
      : null;

  if (!refundParams) {
    await supabase
      .from('refund_requests')
      .update({
        status: 'failed',
        stripe_refund_error: 'missing_payment_reference',
        updated_at: new Date().toISOString(),
      })
      .eq('id', refundRequest.id);

    return res.status(503).send(
      buildRefundResultPage({
        title: 'Refund reference ontbreekt',
        headline: 'Geen Stripe payment intent of charge gevonden',
        detail: 'De betaling is nog niet volledig gesynchroniseerd. Probeer opnieuw nadat de checkout-webhook is verwerkt.',
        primaryHref: buildAppUrl('/support'),
        primaryLabel: 'Open support',
        secondaryHref: buildAppUrl('/payments'),
        secondaryLabel: 'Open payments',
      })
    );
  }

  let refund;
  try {
    refund = await stripe.refunds.create(refundParams);
  } catch (error) {
    const detail = String(error?.message ?? error ?? 'refund_failed');
    await supabase
      .from('refund_requests')
      .update({
        status: 'failed',
        stripe_refund_error: detail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', refundRequest.id);

    return res.status(502).send(
      buildRefundResultPage({
        title: 'Refund mislukt',
        headline: 'Stripe kon de terugbetaling niet uitvoeren',
        detail,
        primaryHref: buildAppUrl('/support'),
        primaryLabel: 'Open support',
        secondaryHref: buildAppUrl('/payments'),
        secondaryLabel: 'Open payments',
      })
    );
  }

  const now = new Date().toISOString();
  await supabase
    .from('refund_requests')
    .update({
      status: 'refunded',
      stripe_refund_id: refund.id,
      approved_at: now,
      refunded_at: now,
      updated_at: now,
    })
    .eq('id', refundRequest.id);

  await supabase
    .from('stripe_checkout_payments')
    .update({
      refund_status: 'refunded',
      payment_status: 'refunded',
      refunded_at: now,
      updated_at: now,
      metadata: {
        ...(payment.metadata || {}),
        refund_request_id: refundRequest.id,
        stripe_refund_id: refund.id,
      },
    })
    .eq('checkout_session_id', payment.checkout_session_id);

  // Log audit event
  await logAuditEvent('refund.approved', req.userId, req.companyId, {
    refund_request_id: refundRequest.id,
    stripe_refund_id: refund.id,
    customer_email: refundRequest.customer_email,
    amount: refundRequest.amount_total,
    currency: refundRequest.currency,
  });

  const confirmationEmail = buildRefundConfirmationEmail({
    customerEmail: refundRequest.customer_email,
    planId: refundRequest.plan_id,
    interval: refundRequest.interval,
    amount: formatMinorCurrency(Number(refundRequest.amount_total ?? payment.amount_total ?? 0), refundRequest.currency || payment.currency),
    refundId: refund.id,
    supportEmail: getSupportInboxEmail(),
  });

  const emailResult = await sendBrevoTransactionalEmail({
    toEmail: refundRequest.customer_email,
    subject: confirmationEmail.subject,
    htmlContent: confirmationEmail.htmlContent,
    textContent: confirmationEmail.textContent,
    replyToEmail: getSupportInboxEmail(),
    tags: ['refund', 'confirmed'],
  });

  if (!emailResult.ok) {
    console.error('Refund bevestigingsmail kon niet worden verzonden:', emailResult);
  }

  return res.status(200).send(
    buildRefundResultPage({
      title: 'Refund uitgevoerd',
      headline: 'De Stripe-refund is uitgevoerd',
      detail: `Terugbetaling voor ${refundRequest.customer_email} is succesvol verwerkt. Refund-ID: ${refund.id}.`,
      primaryHref: buildAppUrl('/payments'),
      primaryLabel: 'Open payments',
      secondaryHref: buildAppUrl('/support'),
      secondaryLabel: 'Open support',
    })
  );
}

function createApp({ runtime = 'node', serveWebUi = true } = {}) {
  const app = express();
  const distDir = path.join(process.cwd(), 'dist');
  const webUiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const recognizeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.disable('x-powered-by');
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }

        callback(null, isAllowedCorsOrigin(origin));
      },
      credentials: true,
    })
  );

  app.get('/health', async (req, res) => {
    void req;
    const supabaseStatus = getSupabaseStatusSnapshot();
    const stripeStatus = getStripeStatusSnapshot();
    const newsletterStatus = getNewsletterStatusSnapshot();
    const databaseConnected =
      Boolean(supabaseStatus.configured && supabaseStatus.publicConfigured && supabaseStatus.serverConfigured);
    const openAiStatus = await getOpenAiHealthSnapshot();
    res.json({
      ok: true,
      mode: DEMO_MODE_ENABLED ? 'demo' : 'live',
      demo: DEMO_MODE_ENABLED,
      apiConnected: true,
      databaseConnected,
      runtime,
      serveWebUi: Boolean(serveWebUi),
      aiConfigured: Boolean(trimEnv(process.env.OPENAI_API_KEY)),
      aiReady: Boolean(openAiStatus.ready),
      aiStatus: openAiStatus.status,
      aiDetail: openAiStatus.detail,
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
    });
  });

  app.get('/ai-test', (req, res) => {
    void req;
    return res.status(503).json({ ok: false, error: 'ai_temporarily_disabled' });
  });

  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), buildStripeWebhookHandler());

  app.use(express.json({ limit: '1mb' }));

  if (serveWebUi) {
    app.use(express.static(distDir, { extensions: ['html'] }));

    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }

      if (req.path.startsWith('/api/')) {
        next();
        return;
      }

      webUiLimiter(req, res, (rateLimitError) => {
        if (rateLimitError) {
          next(rateLimitError);
          return;
        }

        const webUiFile = resolveWebUiFile(req.path);
        if (!webUiFile) {
          next();
          return;
        }

        res.sendFile(webUiFile, (error) => {
          if (error) {
            next(error);
          }
        });
      });
    });
  }

  app.post('/api/ai/copilot', aiLimiter, handleCopilotRequest);
  app.post('/api/ai/helpdesk', aiLimiter, handleHelpdeskAiRequest);

  app.post('/recognize', recognizeLimiter, handleRecognizeRequest);
  app.post('/newsletter/subscribe', async (req, res) => {
    await handleNewsletterSubscribe(req, res, runtime);
  });
  app.get('/api/supabase/status', handleSupabaseStatus);
  app.get('/api/stripe/status', handleStripeStatus);
  app.post('/api/stripe/create-checkout-session', handleStripeCheckoutSession);
  app.post('/api/refunds/request', handleRefundRequest);
  app.get('/api/refunds/approve', (req, res) => {
    void handleRefundDecision(req, res, 'approve').catch((error) => {
      console.error('Refund approve handler fout:', error);
      if (!res.headersSent) {
        res.status(500).send('Refund approval failed');
      }
    });
  });
  app.post('/api/refunds/approve', (req, res) => {
    void handleRefundDecision(req, res, 'approve').catch((error) => {
      console.error('Refund approve handler fout:', error);
      if (!res.headersSent) {
        res.status(500).send('Refund approval failed');
      }
    });
  });
  app.get('/api/refunds/reject', (req, res) => {
    void handleRefundDecision(req, res, 'reject').catch((error) => {
      console.error('Refund reject handler fout:', error);
      if (!res.headersSent) {
        res.status(500).send('Refund rejection failed');
      }
    });
  });
  app.post('/api/refunds/reject', (req, res) => {
    void handleRefundDecision(req, res, 'reject').catch((error) => {
      console.error('Refund reject handler fout:', error);
      if (!res.headersSent) {
        res.status(500).send('Refund rejection failed');
      }
    });
  });

  return app;
}

function startNodeServer() {
  const app = createApp({ runtime: 'node', serveWebUi: true });
  const port = Number(process.env.PORT || 3000);

  app.listen(port, () => {
    console.log(`Server draait op http://localhost:${port}`);
  });
}

module.exports = {
  applyRuntimeEnv,
  createApp,
  getNewsletterStatusSnapshot,
  getOpenAiHealthSnapshot,
  getStripeStatusSnapshot,
  getSupabaseStatusSnapshot,
  buildStripeWebhookHandler,
  handleCopilotRequest,
  handleHelpdeskAiRequest,
  handleNewsletterSubscribe,
  handleRecognizeRequest,
  handleRefundRequest,
  handleRefundDecision,
  handleStripeCheckoutSession,
  handleStripeStatus,
  handleSupabaseStatus,
  startNodeServer,
};
