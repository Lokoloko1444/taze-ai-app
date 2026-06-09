#!/usr/bin/env node

const base = process.env.BASE_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const res = await fetch(`${base}${path}`, options);
  const text = await res.text();
  return { status: res.status, text };
}

async function run() {
  const checks = [];
  const routeChecks = ['/', '/scan', '/payments', '/newsletter', '/security'];

  for (const route of routeChecks) {
    checks.push([`GET ${route}`, await request(route)]);
  }

  checks.push(['GET /health', await request('/health')]);
  checks.push(['GET /api/stripe/status', await request('/api/stripe/status')]);
  checks.push([
    'POST /newsletter/subscribe invalid',
    await request('/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid' }),
    }),
  ]);
  checks.push([
    'POST /newsletter/subscribe valid',
    await request('/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'qa.stockai@example.com' }),
    }),
  ]);
  checks.push([
    'POST /recognize',
    await request('/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: '8710400131474', imageBase64: 'abc123' }),
    }),
  ]);
  checks.push([
    'POST /api/stripe/create-checkout-session',
    await request('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: 'business-essential',
        interval: 'month',
        successUrl: `${base}/payments?ok=1`,
        cancelUrl: `${base}/payments?cancel=1`,
        userId: 'qa-user',
        email: 'qa@example.com',
      }),
    }),
  ]);

  console.log(`Smoke test base: ${base}`);
  for (const [name, result] of checks) {
    const body = result.text.length > 160 ? `${result.text.slice(0, 160)}...` : result.text;
    console.log(`${name} -> ${result.status} ${body}`);
  }

  const hasRouteFailures = checks
    .slice(0, routeChecks.length)
    .some((entry) => entry[1].status !== 200);
  const offset = routeChecks.length;
  const okHealth = checks[offset + 0][1].status === 200;
  const okNewsletterInvalid = checks[offset + 2][1].status === 400;
  const okNewsletterValid = checks[offset + 3][1].status === 200 || checks[offset + 3][1].status === 503;
  const okRecognize = checks[offset + 4][1].status === 200;
  const stripeStatus = checks[offset + 5][1].status;
  const okStripeUnavailableOrOk =
    stripeStatus === 200 || stripeStatus === 400 || stripeStatus === 500 || stripeStatus === 503;

  if (!hasRouteFailures && okHealth && okNewsletterInvalid && okNewsletterValid && okRecognize && okStripeUnavailableOrOk) {
    console.log('Result: PASS');
    return;
  }

  console.log('Result: FAIL');
  process.exitCode = 1;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
