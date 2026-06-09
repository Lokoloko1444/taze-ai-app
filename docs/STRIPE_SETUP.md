# Stripe setup

Gebruik deze pagina als de officiële checklist voor Stripe in Taze.

## Wat je nodig hebt

- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_*`

## Waar je het vindt in Stripe

| Waarde | Waar in Stripe |
|---|---|
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `Developers` > `API keys` > `Publishable key` |
| `STRIPE_SECRET_KEY` | `Developers` > `API keys` > `Secret key` |
| `STRIPE_WEBHOOK_SECRET` | `Developers` > `Webhooks` > jouw endpoint > `Signing secret` |
| `STRIPE_PRICE_*` | `Product catalog` > product > prijs > `price_...` ID |

## Welke price IDs je moet aanmaken

De app verwacht price IDs per plan en billing cycle. In de huidige code zitten 7 plannen met maand-, kwartaal- en jaarprijzen:

- `STRIPE_PRICE_BUSINESS_ESSENTIAL_MONTH`
- `STRIPE_PRICE_BUSINESS_ESSENTIAL_QUARTER`
- `STRIPE_PRICE_BUSINESS_ESSENTIAL_YEAR`
- `STRIPE_PRICE_BUSINESS_GROWTH_MONTH`
- `STRIPE_PRICE_BUSINESS_GROWTH_QUARTER`
- `STRIPE_PRICE_BUSINESS_GROWTH_YEAR`
- `STRIPE_PRICE_BUSINESS_SCALE_MONTH`
- `STRIPE_PRICE_BUSINESS_SCALE_QUARTER`
- `STRIPE_PRICE_BUSINESS_SCALE_YEAR`
- `STRIPE_PRICE_BUSINESS_ENTERPRISE_MONTH`
- `STRIPE_PRICE_BUSINESS_ENTERPRISE_QUARTER`
- `STRIPE_PRICE_BUSINESS_ENTERPRISE_YEAR`
- `STRIPE_PRICE_PERSONAL_BASIC_MONTH`
- `STRIPE_PRICE_PERSONAL_BASIC_QUARTER`
- `STRIPE_PRICE_PERSONAL_BASIC_YEAR`
- `STRIPE_PRICE_PERSONAL_PLUS_MONTH`
- `STRIPE_PRICE_PERSONAL_PLUS_QUARTER`
- `STRIPE_PRICE_PERSONAL_PLUS_YEAR`
- `STRIPE_PRICE_PERSONAL_PREMIUM_MONTH`
- `STRIPE_PRICE_PERSONAL_PREMIUM_QUARTER`
- `STRIPE_PRICE_PERSONAL_PREMIUM_YEAR`

## Aanpak

1. Maak in Stripe eerst de producten en prijzen aan.
2. Kopieer de `price_...` ID's naar je productieomgeving of `.env`.
3. Zet de `STRIPE_SECRET_KEY` en `STRIPE_WEBHOOK_SECRET` server-side.
4. Voeg de webhook toe op:
   - `https://api.taze.to/api/stripe/webhook`
5. Check daarna:
   - `npm run check:env`
   - `npm run check:readiness`

## Live checklist

- Public key staat in de web-app.
- Server secret staat alleen op de server of Worker.
- Webhook secret is aanwezig.
- Minstens één `STRIPE_PRICE_*` is ingevuld.
- `RETURN_URL_ORIGINS` bevat `https://taze.to`, `https://www.taze.to`, `https://demo.taze.to`, `https://app.taze.to` en `https://admin.taze.to`.
- Controleer `GET /api/stripe/status` en let op:
  - `webhookConfigured` moet `true` zijn.
  - `checkoutReady` wordt pas `true` als secret key, webhook secret, prijs-ID's en return origins allemaal aanwezig zijn.

## Voorbeeld dat past bij Taze

Gebruik dit patroon als je een eigen webpagina wilt laten betalen via de bestaande backend:

```html
<!DOCTYPE html>
<html lang="nl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Taze checkout</title>
  </head>
  <body>
    <main>
      <h1>Business Essential</h1>
      <p>Start met realtime voorraad, AI en scanflows.</p>
      <button id="checkout">Activeer pakket</button>
    </main>

    <script>
      const SERVER_BASE_URL = 'https://api.taze.to';
      const PLAN_ID = 'business-essential';
      const INTERVAL = 'month';

      document.getElementById('checkout').addEventListener('click', async () => {
        const response = await fetch(`${SERVER_BASE_URL}/api/stripe/create-checkout-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: PLAN_ID,
            interval: INTERVAL,
            successUrl: 'https://app.taze.to/payments?checkout=success',
            cancelUrl: 'https://app.taze.to/payments?checkout=cancel',
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.url) {
          alert(data.error || 'Checkout kon niet worden gestart.');
          return;
        }

        window.location.href = data.url;
      });
    </script>
  </body>
</html>
```

Belangrijk:
- Deze flow gebruikt jouw bestaande backendroute.
- De server kiest de juiste `STRIPE_PRICE_*` op basis van `planId` en `interval`.
- Je hoeft dus geen `lookup_key` formulier te gebruiken.

## Demo in de app

Open de losse betaalpagina in de app:

- `/stripe-checkout`

Deze route gebruikt dezelfde backendflow als de live betaalpagina.
