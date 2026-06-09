# Production Checklist

Deze checklist helpt je om Taze veilig en netjes live te zetten.

## 1) Data en backend

- Run `supabase/migrations/0001_init.sql` in de Supabase SQL editor.
- Run `supabase/migrations/0002_invoice_and_trace_sync.sql` voor `invoice_history`, `invoice_event_log` en `trace_events`.
- Run `supabase/migrations/0003_transport_preferences.sql` voor `transport_preferences`.
- Run `supabase/migrations/0004_refund_approvals.sql` voor Stripe payment opslag en refund approvals.
- Create users via de app (`/account`) of via Supabase Auth.
- Zie ook `docs/SUPABASE_SETUP.md` voor de volledige Supabase-koppeling.
- Zet de server secrets live:
  - `npx wrangler secret put SUPABASE_URL`
  - `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`
- Server secrets blijven in Cloudflare secret stores; zet alle runtime secrets daar en niet in de repo.
- Check daarna `/api/supabase/status` of de serverkant echt klaar staat.

## 2) Cloudflare live deploy en env

- Cloudflare is de officiële live web/API-deployroute.
- Gebruik `https://demo.taze.to` als gescheiden demo-ervaring, `https://app.taze.to` als app-entry, `https://api.taze.to` als API-origine en `https://scan.taze.to` als directe scan-ingang.
- Bouw de web-export met `npm run build:web`.
- Run `npm run cf:deploy` om de web-export en Worker via Cloudflare uit te rollen.
- Configureer de omgevingsvariabelen op basis van `.env.example`.
- Gebruik `EXPO_PUBLIC_APP_URL=https://app.taze.to` als canonieke bedrijfsplatform-URL.
- Live recognition gebruikt de Supabase session `access_token` voor `Authorization`.
- Zorg dat `CORS_ORIGINS` en `RETURN_URL_ORIGINS` `https://taze.to`, `https://www.taze.to`, `https://demo.taze.to`, `https://app.taze.to`, `https://admin.taze.to` en `https://scan.taze.to` bevatten.
- Houd `demo.taze.to`, `app.taze.to`, `admin.taze.to` en `scan.taze.to` als publieke frontend-hosts aan; de live web/API-route blijft op Cloudflare.
- Run `npm run security:check` en daarna `npm run check:readiness`.
- Gebruik `docs/QA_RUNBOOK.md` voor de volledige handmatige end-to-end controle.

## 3) Stripe

- Volg eerst [docs/STRIPE_SETUP.md](./STRIPE_SETUP.md).
- Maak Products + Prices aan in Stripe.
- Vul de `STRIPE_PRICE_*` env-waarden op je productiehost of in Cloudflare Workers.
- Zet de server secrets live:
  - `npx wrangler secret put STRIPE_SECRET_KEY`
  - `npx wrangler secret put STRIPE_WEBHOOK_SECRET`
- Zet de webhook op:
  - URL: `https://api.taze.to/api/stripe/webhook`
  - Event: `checkout.session.completed`
- Controleer daarna `https://api.taze.to/api/stripe/status`:
  - `webhookConfigured` hoort `true` te zijn.
  - `checkoutReady` hoort `true` te zijn zodra alle Stripe-waarden aanwezig zijn.
  - Controleer daarna `https://api.taze.to/api/stripe/status` voor de live API-kant.

## 4) Expo / EAS

- Configureer EAS env-waarden voor `EXPO_PUBLIC_APP_URL`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL` en `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Gebruik Expo/EAS voor Android/iOS builds; de web-export wordt via Cloudflare uitgerold.
- Bouw Android en iOS met `npx eas-cli build --platform <android|ios> --profile production`.
- Gebruik `--auto-submit` als je de build meteen naar App Store Connect wilt laten doorzetten.
- Gebruik `npx eas-cli submit --platform ios --profile production --latest --non-interactive` als je de iOS-build apart wilt indienen.
- Microsoft Store loopt niet via Expo Submit; gebruik daarvoor de `.msixupload` in Partner Center.

## 5) Google Play (geparkeerd)

Google Play blijft geparkeerd totdat developer verification is afgerond.

- Houd package name, Android-assets, privacy policy, support/contact, Data safety en screenshots klaar voor later.
- Doe geen Google Play upload of submit totdat de verificatie groen is.

## 6) Apple App Store

- Bouw met `npx eas-cli build --platform ios --profile production`.
- Dien in via `npx eas-cli submit --platform ios --profile production --latest --non-interactive` of `--auto-submit`.
- Rond metadata, screenshots, privacy details en App Review af in App Store Connect.

## 7) Microsoft Store

- Upload de `.msixupload` handmatig in Microsoft Partner Center.
- Vul daar de store listing, pricing, screenshots en release-review in.

## 8) Support

- Privacy policy: `https://taze.to/privacy`
- Support page: `https://taze.to/support`
- Contact page: `https://taze.to/contact`
- Support email: `lgstudio144@gmail.com`

## 9) Security

- Check of Dependabot alerts zijn opgepakt of bewust getriageerd.
- Check of CodeQL en de secret-scan workflow groen zijn.
- Bewaar live API-keys, service-role keys en webhook secrets alleen in deployment secret stores.

