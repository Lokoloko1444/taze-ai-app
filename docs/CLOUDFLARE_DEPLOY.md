# Cloudflare deploy

Deze repo is voorbereid om de backend/API via Cloudflare te publiceren:

- `https://api.taze.to` voor de backend/API

De web-UI loopt via Expo Hosting en de officiële Taze-hosts.

De configuratie staat in `wrangler.jsonc` en `cloudflare/worker.mjs`.

## Wat dit doet

- Draait de API native in dezelfde Cloudflare Worker op `api.taze.to`
- Houdt de backend apart van de Expo-web-UI
- Laat de web-hosts via Expo Hosting lopen

## Voor je deployt

1. Zorg dat `taze.to` als actieve zone in jouw Cloudflare-account staat.
2. Houd de web-hosts uit de Worker-routeconfig.
3. Laat alleen `api.taze.to` naar de Worker wijzen.

## Deploy via Wrangler

Installeer Wrangler als dat nog niet gebeurd is:

```powershell
npm install -D wrangler
```

Login:

```powershell
npx wrangler login
```

Deploy:

```powershell
npx wrangler deploy
```

Cloudflare maakt daarna zelf de Custom Domain-koppeling en SSL-certificaten aan voor `api.taze.to`.

## Secrets instellen

Deze waarden moet je als Cloudflare secrets zetten:

```powershell
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put BREVO_API_KEY
npx wrangler secret put BREVO_LIST_ID
```

Zie ook [docs/STRIPE_SETUP.md](./STRIPE_SETUP.md) voor de Stripe-key mapping en price-ID checklist.

`NODE_ENV`, `CORS_ORIGINS`, `RETURN_URL_ORIGINS` en `BREVO_ENABLED` staan al in `wrangler.jsonc`.

## Wat nu native draait

Deze Worker bedient nu:

- API routes op `api.taze.to`

## Belangrijke envs voor productie

Voor de frontend:

- `EXPO_PUBLIC_APP_URL=https://app.taze.to`
- `EXPO_PUBLIC_API_URL=https://api.taze.to`

Voor je backend:

- `CORS_ORIGINS=https://taze.to,https://www.taze.to,https://demo.taze.to,https://app.taze.to,https://admin.taze.to,https://scan.taze.to`
- `RETURN_URL_ORIGINS=https://taze.to,https://www.taze.to,https://demo.taze.to,https://app.taze.to,https://admin.taze.to,https://scan.taze.to`

## Belangrijk

De backend draait nu native in Cloudflare Workers met `nodejs_compat`.

Eén bewuste beperking blijft:

- zonder Brevo-config gebruikt de newsletter-route op Cloudflare geen lokale bestandsopslag meer

Dat is expres, omdat lokale file-opslag op Workers niet persistent is. Voor productie moet nieuwsbrief-opslag dus via Brevo lopen.
