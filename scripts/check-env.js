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
  if (fs.existsSync(envPath)) {
    try {
      const raw = fs.readFileSync(envPath, 'utf8');
      const parsed = parseDotEnv(raw);
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof merged[key] !== 'string' || merged[key].length === 0) {
          merged[key] = value;
        }
      }
    } catch {
      // Ignore parse failures, process.env values still apply.
    }
  }
  return merged;
}

function hasValue(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const normalized = trimmed.toLowerCase();
  if (
    normalized.includes('yourproject') ||
    normalized.includes('your_supabase') ||
    normalized.includes('replace_me') ||
    normalized.includes('example.com')
  ) {
    return false;
  }
  return true;
}

function normalizeKeyGroup(keyOrGroup) {
  return Array.isArray(keyOrGroup) ? keyOrGroup : [keyOrGroup];
}

function printGroup(title, keys, envMap) {
  console.log(`\n${title}`);
  for (const key of keys) {
    const group = normalizeKeyGroup(key);
    const ok = group.some((item) => hasValue(envMap[item]));
    console.log(`${ok ? 'OK  ' : 'MISS'} ${group.join(' / ')}`);
  }
}

const envMap = loadEnvMap();
const nodeEnv = String(envMap.NODE_ENV || 'development').toLowerCase();

const appPublicKeys = [
  ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_SERVER_URL'],
  'EXPO_PUBLIC_APP_URL',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY',
];
const serverCoreKeys = ['CORS_ORIGINS', 'RETURN_URL_ORIGINS', 'OPENAI_API_KEY', 'OPENAI_MODEL'];
const supabaseServerKeys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const stripeServerKeys = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'];
const stripePricePrefix = 'STRIPE_PRICE_';
const brevoKeys = ['BREVO_API_KEY', 'BREVO_LIST_ID'];

console.log('Stock AI env check');
console.log(`NODE_ENV=${nodeEnv}`);
console.log(`.env file: ${fs.existsSync(envPath) ? 'present' : 'missing'}`);
console.log('Note: this check inspects the current workspace env only. Use check:readiness for live deployment verification when available.');

printGroup('Public app keys', appPublicKeys, envMap);
printGroup('Server core keys', serverCoreKeys, envMap);
printGroup('Supabase server keys', supabaseServerKeys, envMap);
printGroup('Stripe server keys', stripeServerKeys, envMap);

const stripePriceKeys = Object.keys(envMap).filter((key) => key.startsWith(stripePricePrefix) && hasValue(envMap[key]));
console.log('\nStripe prices');
if (stripePriceKeys.length) {
  console.log(`OK   ${stripePriceKeys.length} configured (${stripePricePrefix}*)`);
} else {
  console.log(`MISS no configured ${stripePricePrefix}* keys`);
}

const brevoEnabled = String(envMap.BREVO_ENABLED ?? '').trim().toLowerCase();
const brevoActive = brevoEnabled === '' || brevoEnabled === '1' || brevoEnabled === 'true' || brevoEnabled === 'yes';
if (brevoActive) {
  printGroup('Brevo keys (enabled)', brevoKeys, envMap);
} else {
  console.log('\nBrevo keys');
  console.log('SKIP BREVO_ENABLED is false/off');
}

const requiredInProduction = [
  ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_SERVER_URL'],
  'EXPO_PUBLIC_APP_URL',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  ...serverCoreKeys,
  ...supabaseServerKeys,
  ...stripeServerKeys,
];
const missingCritical = requiredInProduction.filter((key) => {
  const group = normalizeKeyGroup(key);
  return !group.some((item) => hasValue(envMap[item]));
});
if (stripePriceKeys.length === 0) {
  missingCritical.push(`${stripePricePrefix}*`);
}
if (brevoActive) {
  for (const key of brevoKeys) {
    if (!hasValue(envMap[key])) {
      missingCritical.push(key);
    }
  }
}

if (nodeEnv === 'production' && missingCritical.length > 0) {
  console.log('\nResult: FAIL (production-critical values missing)');
  for (const key of missingCritical) {
    console.log(`- ${key}`);
  }
  process.exitCode = 1;
} else {
  console.log('\nResult: OK (or warnings only for non-production)');
}
