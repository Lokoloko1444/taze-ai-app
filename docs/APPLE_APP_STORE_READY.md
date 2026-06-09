# Apple App Store Ready

Deze app is voorbereid als `Taze` voor publicatie naar Apple App Store en TestFlight.

## Branding en identifiers

- Appnaam: `Taze`
- Slug: `taze`
- iOS bundle identifier: `com.davykunst.tazeai`
- URL scheme: `taze`

## Store assets

Gebruik deze bestanden in App Store Connect:

- App icon: `assets/images/icon.png`
- Splash/launch visual: `assets/images/splash-icon.png`
- Screenshots voor iPhone
- Eventueel screenshots voor iPad als je die support wilt aanzetten

## Store copy

Korte beschrijving:

`Koop vandaag voor de toekomst van morgen. Taze brengt voorraad, kosten en duurzaamheid samen in een AI-native mobiele workflow met 15 gratis scans.`

Volledige beschrijving:

`Taze helpt teams in food, retail en distributie om voorraad, kosten en duurzaamheid sneller en slimmer te beheren. Barcodeherkenning, productmatch en voorraadregistratie gebruiken cameratoegang om de workflow te laten werken.`

`De app bundelt scanning, voorraadregistratie, inzichten en meldingen in een professionele omgeving voor dagelijkse operatie. Zo werk je sneller, beperk je waste, hou je grip op voorraadbewegingen tussen locaties en kan de betaalde upgrade na de gratis scans direct worden geactiveerd.`

`Voor bedrijven zijn er schaalpakketten voor 0-20, 20-100, 100-500 en 500-5000 vestigingen, met volumekorting bij meerdere locaties en een centrale aankoop voor lagere operationele kosten.`

## App Store Connect checklist

1. Maak de app aan met bundle identifier `com.davykunst.tazeai`.
2. Bouw via `npx eas-cli build --platform ios --profile production`.
3. Dien in via `npx eas-cli submit --platform ios --profile production --latest --non-interactive` of gebruik `--auto-submit`.
4. Voeg app-privacy details toe.
5. Voeg screenshots en release notes toe.
6. Rond TestFlight en App Review af.

## Support en legal

- Privacy policy: `https://taze.to/privacy`
- Support: `https://taze.to/support`
- Contact: `https://taze.to/contact`
- Supportmail: `lgstudio144@gmail.com`

## Nog handmatig nodig voor echte publicatie

- Apple Developer account correct ingesteld
- Bundle identifier en signing goed geconfigureerd
- Finale screenshots van een echte iPhone-build
- Test op permissies, login, betalingen en camera op fysiek toestel
