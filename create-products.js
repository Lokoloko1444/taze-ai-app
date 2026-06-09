'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Stripe = require('stripe');

const SEED_NAME = 'taze-stripe-seed-v1';

const PLAN_SEEDS = [
  {
    planId: 'business-essential',
    audience: 'Bedrijven',
    title: 'Essential',
    description:
      'Voor kleine bedrijven die per vestiging willen starten en meteen schaalbaar willen blijven met een duidelijke bundelkorting voor extra locaties.',
    onboardingFee: 99,
    prices: {
      month: { envKey: 'STRIPE_PRICE_BUSINESS_ESSENTIAL_MONTH', amountEur: 59 },
      quarter: { envKey: 'STRIPE_PRICE_BUSINESS_ESSENTIAL_QUARTER', amountEur: 168.15 },
      year: { envKey: 'STRIPE_PRICE_BUSINESS_ESSENTIAL_YEAR', amountEur: 590 },
    },
  },
  {
    planId: 'business-growth',
    audience: 'Bedrijven',
    title: 'Growth',
    description:
      'Voor groeiende foodbedrijven die meerdere teams, locaties en financiele inzichten in een flow willen.',
    onboardingFee: 199,
    prices: {
      month: { envKey: 'STRIPE_PRICE_BUSINESS_GROWTH_MONTH', amountEur: 149 },
      quarter: { envKey: 'STRIPE_PRICE_BUSINESS_GROWTH_QUARTER', amountEur: 424.65 },
      year: { envKey: 'STRIPE_PRICE_BUSINESS_GROWTH_YEAR', amountEur: 1490 },
    },
  },
  {
    planId: 'business-scale',
    audience: 'Bedrijven',
    title: 'Scale',
    description:
      'Voor grotere teams en ketens die voorraad, kosten en duurzaamheid per vestiging willen sturen met centrale inkoopvoordelen.',
    onboardingFee: 299,
    prices: {
      month: { envKey: 'STRIPE_PRICE_BUSINESS_SCALE_MONTH', amountEur: 329 },
      quarter: { envKey: 'STRIPE_PRICE_BUSINESS_SCALE_QUARTER', amountEur: 937.65 },
      year: { envKey: 'STRIPE_PRICE_BUSINESS_SCALE_YEAR', amountEur: 3290 },
    },
  },
  {
    planId: 'business-enterprise',
    audience: 'Bedrijven',
    title: 'Enterprise',
    description:
      'Voor organisaties met meerdere divisies of een grote voetafdruk, waar een aankoop over veel vestigingen direct tijd en kosten bespaart.',
    onboardingFee: 749,
    prices: {
      month: { envKey: 'STRIPE_PRICE_BUSINESS_ENTERPRISE_MONTH', amountEur: 799 },
      quarter: { envKey: 'STRIPE_PRICE_BUSINESS_ENTERPRISE_QUARTER', amountEur: 2277.15 },
      year: { envKey: 'STRIPE_PRICE_BUSINESS_ENTERPRISE_YEAR', amountEur: 7990 },
    },
  },
  {
    planId: 'personal-basic',
    audience: 'Particulieren',
    title: 'Basic',
    description: 'Voor thuisgebruikers die slim hun voorraadkast en vervaldagen willen beheren.',
    onboardingFee: 0,
    prices: {
      month: { envKey: 'STRIPE_PRICE_PERSONAL_BASIC_MONTH', amountEur: 6 },
      quarter: { envKey: 'STRIPE_PRICE_PERSONAL_BASIC_QUARTER', amountEur: 17.1 },
      year: { envKey: 'STRIPE_PRICE_PERSONAL_BASIC_YEAR', amountEur: 60 },
    },
  },
  {
    planId: 'personal-plus',
    audience: 'Particulieren',
    title: 'Plus',
    description: 'Voor gezinnen die samen voorraad, shopping en waste willen opvolgen in een app.',
    onboardingFee: 0,
    prices: {
      month: { envKey: 'STRIPE_PRICE_PERSONAL_PLUS_MONTH', amountEur: 12 },
      quarter: { envKey: 'STRIPE_PRICE_PERSONAL_PLUS_QUARTER', amountEur: 34.2 },
      year: { envKey: 'STRIPE_PRICE_PERSONAL_PLUS_YEAR', amountEur: 120 },
    },
  },
  {
    planId: 'personal-premium',
    audience: 'Particulieren',
    title: 'Premium',
    description: 'Voor gebruikers die de meest complete AI-flow willen voor thuisstock, analyse en planning.',
    onboardingFee: 0,
    prices: {
      month: { envKey: 'STRIPE_PRICE_PERSONAL_PREMIUM_MONTH', amountEur: 19 },
      quarter: { envKey: 'STRIPE_PRICE_PERSONAL_PREMIUM_QUARTER', amountEur: 54.15 },
      year: { envKey: 'STRIPE_PRICE_PERSONAL_PREMIUM_YEAR', amountEur: 190 },
    },
  },
];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env = {};
  const contents = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function loadStripeSecretKey() {
  const fromProcess = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (fromProcess) {
    return fromProcess;
  }

  const envPath = path.join(process.cwd(), '.env');
  const parsed = parseEnvFile(envPath);
  const fromFile = String(parsed.STRIPE_SECRET_KEY || '').trim();
  if (fromFile) {
    return fromFile;
  }

  return '';
}

function toCents(amountEur) {
  return Math.round(Number(amountEur) * 100);
}

function recurringForInterval(interval) {
  if (interval === 'quarter') {
    return { interval: 'month', interval_count: 3 };
  }

  if (interval === 'year') {
    return { interval: 'year' };
  }

  return { interval: 'month' };
}

function intervalLabel(interval) {
  if (interval === 'quarter') return 'kwartaal';
  if (interval === 'year') return 'jaar';
  return 'maand';
}

function isPriceMatch(price, expected) {
  const recurring = price.recurring || null;
  const expectedRecurring = recurringForInterval(expected.interval);
  const recurringMatch =
    Boolean(recurring) &&
    recurring.interval === expectedRecurring.interval &&
    Number(recurring.interval_count || 1) === Number(expectedRecurring.interval_count || 1);

  return (
    price.currency === 'eur' &&
    Number(price.unit_amount || 0) === expected.unitAmount &&
    recurringMatch
  );
}

async function listAllProducts(stripe) {
  const products = [];
  let startingAfter = undefined;

  while (true) {
    const page = await stripe.products.list({
      limit: 100,
      starting_after: startingAfter,
    });

    products.push(...page.data);

    if (!page.has_more || page.data.length === 0) {
      break;
    }

    startingAfter = page.data[page.data.length - 1].id;
  }

  return products;
}

async function listProductPrices(stripe, productId) {
  const prices = [];
  let startingAfter = undefined;

  while (true) {
    const page = await stripe.prices.list({
      limit: 100,
      starting_after: startingAfter,
      product: productId,
    });

    prices.push(...page.data);

    if (!page.has_more || page.data.length === 0) {
      break;
    }

    startingAfter = page.data[page.data.length - 1].id;
  }

  return prices;
}

async function ensureProduct(stripe, seed, existingProducts) {
  const metadataSeed = {
    seed: SEED_NAME,
    planId: seed.planId,
    audience: seed.audience,
    onboardingFeeEur: String(seed.onboardingFee),
  };

  let product =
    existingProducts.find((item) => item.metadata?.planId === seed.planId) ||
    existingProducts.find((item) => item.name === seed.title);

  if (!product) {
    product = await stripe.products.create({
      name: seed.title,
      description: seed.description,
      active: true,
      type: 'service',
      metadata: metadataSeed,
    });
    return { product, created: true };
  }

  const needsUpdate =
    product.active === false ||
    product.description !== seed.description ||
    String(product.metadata?.seed || '') !== SEED_NAME ||
    String(product.metadata?.planId || '') !== seed.planId ||
    String(product.metadata?.audience || '') !== seed.audience ||
    String(product.metadata?.onboardingFeeEur || '') !== String(seed.onboardingFee);

  if (needsUpdate) {
    product = await stripe.products.update(product.id, {
      active: true,
      description: seed.description,
      metadata: { ...(product.metadata || {}), ...metadataSeed },
    });
  }

  return { product, created: false };
}

async function ensurePrice(stripe, productId, seed, interval, priceSeed) {
  const lookupKey = priceSeed.envKey;
  const unitAmount = toCents(priceSeed.amountEur);
  const expected = { interval, unitAmount };

  const lookupResult = await stripe.prices.list({
    lookup_keys: [lookupKey],
    limit: 1,
  });
  const lookupPrice = lookupResult.data[0] || null;
  if (lookupPrice) {
    if (isPriceMatch(lookupPrice, expected)) {
      if (lookupPrice.active === false) {
        await stripe.prices.update(lookupPrice.id, { active: true });
      }
      return { price: lookupPrice, created: false, reusedBy: 'lookup_key' };
    }
  }

  const productPrices = await listProductPrices(stripe, productId);
  const existingPrice = productPrices.find((price) => isPriceMatch(price, expected)) || null;
  if (existingPrice) {
    if (existingPrice.active === false) {
      await stripe.prices.update(existingPrice.id, { active: true });
    }
    return { price: existingPrice, created: false, reusedBy: 'product_match' };
  }

  const createdPrice = await stripe.prices.create({
    product: productId,
    currency: 'eur',
    unit_amount: unitAmount,
    recurring: recurringForInterval(interval),
    lookup_key: lookupKey,
    transfer_lookup_key: Boolean(lookupPrice),
    nickname: `${seed.title} ${intervalLabel(interval)}`,
    metadata: {
      seed: SEED_NAME,
      planId: seed.planId,
      audience: seed.audience,
      interval,
      amountEur: String(priceSeed.amountEur),
    },
  });

  return { price: createdPrice, created: true, reusedBy: null };
}

async function main() {
  const secretKey = loadStripeSecretKey();
  if (!secretKey) {
    console.error('STRIPE_SECRET_KEY ontbreekt. Zet hem in .env of in je shell en probeer opnieuw.');
    process.exit(1);
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: '2026-02-25.clover',
  });

  let account = null;
  try {
    account = await stripe.accounts.retrieve();
  } catch (error) {
    const message = String(error?.message ?? error ?? '').trim();
    console.warn(
      message
        ? `Stripe account metadata kon niet worden opgehaald; doorgaan zonder account-details. (${message})`
        : 'Stripe account metadata kon niet worden opgehaald; doorgaan zonder account-details.'
    );
  }
  const existingProducts = await listAllProducts(stripe);
  const rows = [];

  for (const seed of PLAN_SEEDS) {
    const { product, created: productCreated } = await ensureProduct(stripe, seed, existingProducts);
    if (productCreated) {
      existingProducts.push(product);
    }

    const productPrices = await listProductPrices(stripe, product.id);
    const monthlyPrice = await ensurePrice(stripe, product.id, seed, 'month', seed.prices.month);
    const quarterlyPrice = await ensurePrice(stripe, product.id, seed, 'quarter', seed.prices.quarter);
    const yearlyPrice = await ensurePrice(stripe, product.id, seed, 'year', seed.prices.year);

    if (!product.default_price && monthlyPrice.price?.id) {
      await stripe.products.update(product.id, { default_price: monthlyPrice.price.id });
    }

    rows.push(
      ...[
        {
          planId: seed.planId,
          product: seed.title,
          interval: 'month',
          amountEur: seed.prices.month.amountEur,
          envKey: seed.prices.month.envKey,
          priceId: monthlyPrice.price.id,
          productId: product.id,
          status: monthlyPrice.created ? 'created' : `reused (${monthlyPrice.reusedBy})`,
        },
        {
          planId: seed.planId,
          product: seed.title,
          interval: 'quarter',
          amountEur: seed.prices.quarter.amountEur,
          envKey: seed.prices.quarter.envKey,
          priceId: quarterlyPrice.price.id,
          productId: product.id,
          status: quarterlyPrice.created ? 'created' : `reused (${quarterlyPrice.reusedBy})`,
        },
        {
          planId: seed.planId,
          product: seed.title,
          interval: 'year',
          amountEur: seed.prices.year.amountEur,
          envKey: seed.prices.year.envKey,
          priceId: yearlyPrice.price.id,
          productId: product.id,
          status: yearlyPrice.created ? 'created' : `reused (${yearlyPrice.reusedBy})`,
        },
      ]
    );

    if (!productPrices.length && monthlyPrice.created) {
      console.log(`Product created: ${seed.title} (${product.id})`);
    }
  }

  if (account && account.id) {
    console.log('\nStripe account:', account.id);
    console.log('Mode:', account.livemode ? 'live' : 'test');
  } else {
    const inferredMode = /^sk_live_|^rk_live_/i.test(secretKey)
      ? 'live'
      : /^sk_test_|^rk_test_/i.test(secretKey)
        ? 'test'
        : 'unknown';
    console.log('\nStripe account: unavailable');
    console.log('Mode:', inferredMode);
  }
  console.log('\nPrice mapping:\n');
  console.table(rows);

  console.log('\n.env snippet:\n');
  for (const row of rows) {
    console.log(`${row.envKey}=${row.priceId}`);
  }
}

main().catch((error) => {
  console.error('create-products.js failed:');
  console.error(error);
  process.exit(1);
});
