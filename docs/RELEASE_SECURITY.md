# Release Security

Deze gids scherpt de beveiliging rond releases, partners en store submissions aan.

## Must-have regels

- Gebruik branch protection op `main`.
- Vereis minimaal 1 review voor elke PR.
- Vereis status checks voor lint, security en readiness.
- Sta geen directe pushes toe naar `main`.
- Sta geen force-pushes toe.
- Vereis dat release- en secrets-bestanden altijd expliciet worden goedgekeurd.

## Aanbevolen GitHub-instellingen

- Branch protection voor `main`.
- Code owners inschakelen.
- Required status checks voor:
  - `npm run lint`
  - `npm run security:check`
  - `npm run check:readiness`
- Secret scanning en Dependabot alerts aan laten staan.

## Wat nooit in de repo hoort

- Stripe secret keys
- Supabase service-role keys
- Microsoft Partner Center credentials
- Google Play service account JSON
- Apple App Store Connect API keys
- Private store upload links of tokens

## Teamregels

- Release- en pricingwijzigingen gaan altijd via PR.
- Microsoft Store uploads blijven handmatig in Partner Center.
- Google Play en App Store submissions gaan via Expo/EAS of console, niet via losse chat-informatie.
- Als iets geld, toegang of publicatie beïnvloedt, markeer het als release-critical.
