# Expo Release Flow

Deze gids legt uit hoe je Taze met Expo/EAS klaarzet voor mobiele distributie.
De officiële live web/API-route loopt via Cloudflare; Expo/EAS is voor Android/iOS builds.

## Wat Expo wel doet

- Android en iOS binaries bouwen met EAS Build.
- iOS builds indienen met EAS Submit als App Store Connect klaarstaat.
- Een build direct doorzetten met `--auto-submit` naar de actieve mobiele releaseflow.

## Wat Expo niet doet

- Expo is niet de officiële live web/API-deploymentroute.
- Microsoft Store submissions.
- Store listing metadata beheren voor Microsoft.

## Eerste keer instellen

1. Log in op Expo:

```bash
npx eas-cli login
```

2. Koppel de release-instellingen als dat nog niet is gedaan: 


```bash
npx eas-cli build:configure
```

3. Controleer of `eas.json` de `production` build- en submit-profielen heeft.

## Google Play (geparkeerd)

Google Play blijft geparkeerd totdat developer verification is afgerond.

- Houd de Android-assets, screenshots, privacy policy en Data safety klaar voor later.
- Doe geen Google Play submit of auto-submit totdat de verificatie groen is.

## Apple App Store via Expo

Voor Apple kun je dezelfde flow gebruiken:

```bash
npx eas-cli build --platform ios --profile production --auto-submit
```

Of los:

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production --latest --non-interactive
```

Belangrijk:

- EAS Submit zet een build in App Store Connect of TestFlight.
- De uiteindelijke App Store review moet je nog in App Store Connect afronden.

## Microsoft Store

Microsoft loopt niet via Expo Submit.

Gebruik daarvoor de `.msixupload` in Microsoft Partner Center en vul daar de store listing, pricing, screenshots en review-instellingen in.

## Live web en API

De live web- en API-route loopt via Cloudflare.

- Cloudflare is de officiële live route voor de publieke web- en API-laag.
- Expo/EAS blijft voor Android/iOS builds, niet voor de live web/API-release.

## Partner-veilig werken

Als meerdere mensen meewerken aan Taze, hou dan deze regels aan:

- Bewaar secrets alleen in deployment secret stores.
- Houd `main` beschermd met pull requests en review.
- Geef partners alleen de toegang die ze echt nodig hebben.
- Laat geen service keys, webhooks of private store-credentials in GitHub staan.
- Houd release-artifacts apart van broncode als dat veiliger is voor jullie team.

## Snelle checklist:

- `app.json` klopt voor package name, bundle id en Microsoft metadata.
- `eas.json` heeft production build- en submit-profielen.
- Google Play assets en policy-links staan klaar.
- Apple App Store metadata staat klaar.
- Microsoft `.msixupload` en Partner Center-gegevens staan klaar.
