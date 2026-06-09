# QA Checklist

## Automated checks
- `npm run qa:baseline`
- `npm run smoke:server` na het starten van de server
- `npm run qa:web` voor Chromium browser-e2e tegen de prod-sim of een opgegeven `PLAYWRIGHT_BASE_URL` na `npm run build:web`
- Losse checks: `npm run lint`, `npm run security:check`, `npm run check:readiness`, `npm run build:web`
- GitHub Actions draait dezelfde baseline + smoke automatisch op push en pull request via `.github/workflows/qa.yml`
- De browser-E2E job hergebruikt het geüploade `dist/`-artifact van de baseline-job

## Smoke checks
- `/` opens the dashboard
- `/scan` opens the scanner flow
- `/payments` opens the payment screen
- `/newsletter` opens the subscription screen
- `/security` opens settings without a lock dead-end on web
- `https://demo.taze.to` opens the separate read-only demo preview, not the production app

## Manual runbook
- Voor exacte stappen per platform en per scherm: `docs/QA_RUNBOOK.md`

## Production checks
- `EXPO_PUBLIC_APP_URL` points to `https://app.taze.to`
- `EXPO_PUBLIC_API_URL` points to `https://api.taze.to`
- Stripe, Supabase and Brevo env values are present
- `https://api.taze.to/api/stripe/status` reports `webhookConfigured: true` and `checkoutReady: true`
- `/api/supabase/status` reports public and server Supabase as ready
- `CORS_ORIGINS` and `RETURN_URL_ORIGINS` include `https://taze.to`, `https://demo.taze.to`, `https://app.taze.to` and `https://admin.taze.to`
- No real secrets are committed to `.env.example`, docs, or source files
- GitHub CodeQL, Dependabot and secret-scan workflows are green
