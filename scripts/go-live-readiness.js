#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const envPath = path.join(projectRoot, '.env');

function parseDotEnv(raw) {
  const data = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return data;
}

function loadEnvMap() {
  const merged = { ...process.env };
  if (!fs.existsSync(envPath)) return merged;

  try {
    const raw = fs.readFileSync(envPath, 'utf8');
    const parsed = parseDotEnv(raw);
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof merged[key] !== 'string' || merged[key].length === 0) {
        merged[key] = value;
      }
    }
  } catch {
    // keep process.env only
  }

  return merged;
}

function hasConfiguredValue(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const normalized = trimmed.toLowerCase();
  return !(
    normalized.includes('replace_me') ||
    normalized.includes('yourproject') ||
    normalized.includes('your_supabase') ||
    normalized.includes('example.com')
  );
}

function isStripeTestPublishableKey(value) {
  return /^pk_test_/i.test(String(value || '').trim());
}

function isStripeLivePublishableKey(value) {
  return /^pk_live_/i.test(String(value || '').trim());
}

function isStripeTestSecretKey(value) {
  return /^sk_test_/i.test(String(value || '').trim());
}

function isStripeLiveSecretKey(value) {
  return /^sk_live_/i.test(String(value || '').trim()) || /^rk_live_/i.test(String(value || '').trim());
}

function isStripeTestRestrictedKey(value) {
  return /^rk_test_/i.test(String(value || '').trim());
}

function normalizedUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function isLocalhostUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

async function fetchJson(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const text = await response.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      json,
      text,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      json: null,
      text: '',
      error: String(error?.message ?? error ?? 'fetch_failed'),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function loadLiveStatus(apiUrl, fallbackApiUrl) {
  const candidates = [apiUrl, fallbackApiUrl]
    .map((value) => normalizedUrl(value))
    .filter((value, index, array) => Boolean(value) && array.indexOf(value) === index)
    .filter((value) => /^https?:\/\//i.test(value) && !isLocalhostUrl(value));

  for (const baseUrl of candidates) {
    const [health, supabase, stripe] = await Promise.all([
      fetchJson(`${baseUrl}/health`),
      fetchJson(`${baseUrl}/api/supabase/status`),
      fetchJson(`${baseUrl}/api/stripe/status`),
    ]);

    if (![health, supabase, stripe].some((entry) => entry.ok)) {
      continue;
    }

    return {
      baseUrl,
      health,
      supabase,
      stripe,
    };
  }

  return null;
}

function buildCheck(label, ok, warning, detail) {
  return {
    label,
    tone: ok ? 'ready' : warning ? 'attention' : 'blocked',
    detail,
  };
}

async function main() {
  const env = loadEnvMap();
  const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase() || 'development';
  const appUrl = String(env.EXPO_PUBLIC_APP_URL || '').trim();
  const apiUrl = String(env.EXPO_PUBLIC_API_URL || env.EXPO_PUBLIC_SERVER_URL || '').trim();
  const liveApiUrl = String(env.LIVE_API_URL || env.EXPO_PUBLIC_LIVE_API_URL || '').trim();
  const supabaseUrl = String(env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
  const supabaseAnonKey = String(env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  const supabaseServerUrl = String(env.SUPABASE_URL || '').trim();
  const supabaseServiceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const corsOrigins = env.CORS_ORIGINS || '';
  const returnOrigins = env.RETURN_URL_ORIGINS || '';
  const stripeSecret = String(env.STRIPE_SECRET_KEY || '').trim();
  const stripeWebhook = String(env.STRIPE_WEBHOOK_SECRET || '').trim();
  const stripePublishableKey = String(env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '').trim();
  const openAiKey = String(env.OPENAI_API_KEY || '').trim();
  const openAiModel = String(env.OPENAI_MODEL || '').trim();
  const brevoEnabled = String(env.BREVO_ENABLED || '').trim().toLowerCase();
  const brevoActive = brevoEnabled === '' || brevoEnabled === '1' || brevoEnabled === 'true' || brevoEnabled === 'yes';
  const brevoApiKey = String(env.BREVO_API_KEY || '').trim();
  const brevoListId = String(env.BREVO_LIST_ID || '').trim();
  const stripePriceCount = Object.keys(env).filter(
    (key) => key.startsWith('STRIPE_PRICE_') && hasConfiguredValue(env[key])
  ).length;
  const stripePublishableLive = isStripeLivePublishableKey(stripePublishableKey);
  const stripePublishableTest = isStripeTestPublishableKey(stripePublishableKey);
  const stripeSecretLive = isStripeLiveSecretKey(stripeSecret);
  const stripeSecretTest = isStripeTestSecretKey(stripeSecret) || isStripeTestRestrictedKey(stripeSecret);
  const stripeTestModeDetected = stripePublishableTest || stripeSecretTest;
  const liveStatus = await loadLiveStatus(apiUrl, liveApiUrl);
  const liveHealth = liveStatus?.health?.json && typeof liveStatus.health.json === 'object' ? liveStatus.health.json : null;
  const liveSupabase = liveStatus?.supabase?.json && typeof liveStatus.supabase.json === 'object' ? liveStatus.supabase.json : null;
  const liveStripe = liveStatus?.stripe?.json && typeof liveStatus.stripe.json === 'object' ? liveStatus.stripe.json : null;
  const liveStatusSource = liveStatus?.baseUrl === normalizedUrl(apiUrl)
    ? 'API URL'
    : liveStatus?.baseUrl === normalizedUrl(liveApiUrl)
      ? 'fallback URL'
      : 'onbekende bron';
  const productionDeploymentConfigured =
    normalizedUrl(appUrl) === 'https://app.taze.to' || normalizedUrl(apiUrl) === 'https://api.taze.to';
  const externalVerificationUnavailable = !liveStatus && productionDeploymentConfigured;
  const liveSourceLabel = liveStatus
    ? `live deployment via ${liveStatus.baseUrl}${liveStatusSource === 'fallback URL' ? ' (fallback)' : ''}`
    : externalVerificationUnavailable
      ? 'production deployment niet bereikbaar vanuit workspace'
      : '.env lokaal';

  const checks = [
    buildCheck(
      'Bedrijfsplatform URL',
      normalizedUrl(appUrl) === 'https://app.taze.to',
      hasConfiguredValue(appUrl),
      hasConfiguredValue(appUrl)
        ? `Huidige waarde: ${appUrl}`
        : 'EXPO_PUBLIC_APP_URL ontbreekt of gebruikt nog een placeholder.'
    ),
    buildCheck(
      'Publieke API URL',
      normalizedUrl(apiUrl) === 'https://api.taze.to',
      hasConfiguredValue(apiUrl),
      hasConfiguredValue(apiUrl)
        ? `Huidige waarde: ${apiUrl}`
        : 'EXPO_PUBLIC_SERVER_URL ontbreekt of gebruikt nog een placeholder.'
    ),
    buildCheck(
      'Supabase public keys',
      liveSupabase ? Boolean(liveSupabase.publicConfigured) : hasConfiguredValue(supabaseUrl) && hasConfiguredValue(supabaseAnonKey),
      externalVerificationUnavailable,
      liveSupabase
        ? `Bron ${liveSourceLabel} | publicConfigured=${liveSupabase.publicConfigured ? 'ok' : 'mist'} | serverConfigured=${liveSupabase.serverConfigured ? 'ok' : 'mist'}`
        : externalVerificationUnavailable
          ? 'Live deployment niet bereikbaar vanuit deze workspace; public Supabase keys worden daarom niet hard geblokkeerd.'
        : hasConfiguredValue(supabaseUrl) && hasConfiguredValue(supabaseAnonKey)
          ? 'Publieke Supabase URL en anon key zijn aanwezig in de lokale env.'
          : 'EXPO_PUBLIC_SUPABASE_URL of EXPO_PUBLIC_SUPABASE_ANON_KEY ontbreekt.'
    ),
    buildCheck(
      'Supabase server keys',
      liveSupabase ? Boolean(liveSupabase.serverConfigured) : hasConfiguredValue(supabaseServerUrl) && hasConfiguredValue(supabaseServiceRoleKey),
      externalVerificationUnavailable,
      liveSupabase
        ? `Bron ${liveSourceLabel} | serverConfigured=${liveSupabase.serverConfigured ? 'ok' : 'mist'}`
        : externalVerificationUnavailable
          ? 'Live deployment niet bereikbaar vanuit deze workspace; server Supabase keys worden daarom niet hard geblokkeerd.'
        : hasConfiguredValue(supabaseServerUrl) && hasConfiguredValue(supabaseServiceRoleKey)
          ? 'Supabase server URL en service role key zijn aanwezig in de lokale env.'
          : 'SUPABASE_URL of SUPABASE_SERVICE_ROLE_KEY ontbreekt.'
    ),
    buildCheck(
      'Stripe public key',
      liveStripe ? Boolean(liveStripe.checkoutReady) : hasConfiguredValue(stripePublishableKey) && stripePublishableLive,
      true,
      liveStripe
        ? `Bron ${liveSourceLabel} | publishableKeyMode=${liveStripe.publishableKeyMode ?? 'onbekend'} | checkoutReady=${liveStripe.checkoutReady ? 'ok' : 'mist'}`
        : !hasConfiguredValue(stripePublishableKey)
          ? 'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ontbreekt of gebruikt nog een placeholder.'
          : stripePublishableLive
            ? 'Publieke Stripe live key is aanwezig in de lokale env.'
            : stripePublishableTest
              ? 'Alleen een test publishable key is gevonden; voor productie is een live key nodig.'
              : 'Publieke Stripe key heeft een onbekend formaat.'
    ),
    buildCheck(
      'CORS / return origins',
      corsOrigins.includes('https://app.taze.to') &&
        returnOrigins.includes('https://app.taze.to') &&
        corsOrigins.includes('https://taze.to') &&
        returnOrigins.includes('https://taze.to'),
      Boolean(corsOrigins || returnOrigins),
      `CORS_ORIGINS=${corsOrigins || '(leeg)'} | RETURN_URL_ORIGINS=${returnOrigins || '(leeg)'}`
    ),
    buildCheck(
      'OpenAI server key',
      liveHealth ? Boolean(liveHealth.aiConfigured) : hasConfiguredValue(openAiKey),
      externalVerificationUnavailable,
      liveHealth
        ? `Bron ${liveSourceLabel} | aiConfigured=${liveHealth.aiConfigured ? 'ok' : 'mist'}`
        : externalVerificationUnavailable
          ? 'Live deployment niet bereikbaar vanuit deze workspace; OpenAI key wordt daarom niet hard geblokkeerd.'
        : hasConfiguredValue(openAiKey)
          ? `Model: ${openAiModel || '(default)'}`
          : 'OPENAI_API_KEY ontbreekt of gebruikt nog een placeholder.'
    ),
    buildCheck(
      'Stripe server keys',
      liveStripe ? Boolean(liveStripe.checkoutReady) : hasConfiguredValue(stripeSecret) && hasConfiguredValue(stripeWebhook) && stripePriceCount > 0 && stripeSecretLive,
      liveStripe ? false : externalVerificationUnavailable || (hasConfiguredValue(stripeSecret) && hasConfiguredValue(stripeWebhook) && stripePriceCount > 0 && stripeSecretTest && nodeEnv !== 'production'),
      liveStripe
        ? `Bron ${liveSourceLabel} | checkoutReady=${liveStripe.checkoutReady ? 'ok' : 'mist'} | secretMode=${liveStripe.secretMode ?? 'onbekend'} | priceKeys=${typeof liveStripe.priceKeysConfigured === 'number' ? liveStripe.priceKeysConfigured : 'onbekend'}`
        : externalVerificationUnavailable
          ? 'Live deployment niet bereikbaar vanuit deze workspace; Stripe server keys worden daarom niet hard geblokkeerd.'
        : !hasConfiguredValue(stripeSecret)
          ? 'STRIPE_SECRET_KEY ontbreekt of gebruikt nog een placeholder.'
          : !hasConfiguredValue(stripeWebhook)
            ? 'STRIPE_WEBHOOK_SECRET ontbreekt of gebruikt nog een placeholder.'
            : stripePriceCount === 0
              ? 'Geen STRIPE_PRICE_* keys gevonden.'
              : stripeSecretLive
                ? `Webhook secret: ok | Price keys: ${stripePriceCount}`
                : stripeSecretTest
                  ? 'Alleen een test Stripe secret key is gevonden; voor productie is een live key nodig.'
                  : 'Stripe secret key heeft een onbekend formaat.'
    ),
    buildCheck(
      'Brevo mailflow',
      liveHealth ? Boolean(liveHealth.newsletterReady) : !brevoActive || (hasConfiguredValue(brevoApiKey) && hasConfiguredValue(brevoListId)),
      liveHealth ? false : externalVerificationUnavailable || brevoActive,
      liveHealth
        ? `Bron ${liveSourceLabel} | newsletterEnabled=${liveHealth.newsletterEnabled ? 'ja' : 'nee'} | newsletterReady=${liveHealth.newsletterReady ? 'ok' : 'mist'} | support/refund mailflow=${liveHealth.newsletterReady ? 'klaar' : 'controle nodig'}`
        : externalVerificationUnavailable
          ? 'Live deployment niet bereikbaar vanuit deze workspace; Brevo support/refund mailflow wordt daarom niet hard geblokkeerd.'
        : brevoActive
          ? `BREVO_API_KEY ${hasConfiguredValue(brevoApiKey) ? 'ok' : 'mist'} | BREVO_LIST_ID ${hasConfiguredValue(brevoListId) ? 'ok' : 'mist'} | support/refund approvals=${hasConfiguredValue(brevoApiKey) && hasConfiguredValue(brevoListId) ? 'klaar' : 'controle nodig'}`
          : 'Brevo staat uit.'
    ),
    buildCheck(
      'Support & legal URLs',
      true,
      false,
      'Verwachte publieke routes: https://taze.to/privacy, /support en /contact met lgstudio144@gmail.com als support- en refundinbox.'
    ),
  ];

  const ready = checks.filter((check) => check.tone === 'ready').length;
  const attention = checks.filter((check) => check.tone === 'attention').length;
  const blocked = checks.filter((check) => check.tone === 'blocked').length;
  const progress = Math.round((ready / checks.length) * 100);
  const liveStripeModeDetected =
    liveStripe &&
    (String(liveStripe.secretMode || '').toLowerCase() === 'test' ||
      String(liveStripe.publishableKeyMode || '').toLowerCase() === 'test');

  console.log('Taze go-live readiness');
  console.log(`.env file: ${fs.existsSync(envPath) ? 'present' : 'missing'}`);
  console.log(`Bron: ${liveSourceLabel}`);
  console.log(`Voortgang: ${progress}% | Klaar: ${ready} | Aandacht: ${attention} | Blokkerend: ${blocked}`);
  console.log('');

  for (const check of checks) {
    const prefix = check.tone === 'ready' ? 'OK  ' : check.tone === 'attention' ? 'WARN' : 'FAIL';
    console.log(`${prefix} ${check.label}`);
    console.log(`     ${check.detail}`);
  }

  if (!liveStatus && stripeTestModeDetected) {
    console.log('');
    console.log('INFO Lokale workspace bevat Stripe testwaarden');
    console.log('     De live deployment is de bron van waarheid; deze lokale waarden blokkeren de gate niet.');
  } else if (liveStripeModeDetected) {
    console.log('');
    console.log('WARN Stripe test mode detected in live deployment status');
    console.log('     Use live Stripe keys and recreate price IDs in the live Stripe account before production.');
  }

  if (blocked > 0) {
    console.log('\nResult: FAIL');
    process.exitCode = 1;
    return;
  }

  if (attention > 0) {
    console.log('\nResult: WARN');
    return;
  }

  console.log('\nResult: PASS');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
