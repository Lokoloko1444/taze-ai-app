# Google Play Ready

Deze app is voorbereid als `Taze` voor publicatie naar Google Play.

## Branding en identifiers

- Appnaam: `Taze`
- Slug: `taze`
- Android package: `com.davykunst.tazeai`
- URL scheme: `taze`

## Store assets

Gebruik deze bestanden in de Play Console:

- App icon 512x512: `assets/store/google-play-icon-512.png`
- Feature graphic 1024x500: `assets/store/google-play-feature-graphic.png`

App-build assets in Expo:

- Launcher icon: `assets/images/icon.png`
- Splash image: `assets/images/splash-icon.png`
- Android adaptive foreground: `assets/images/android-icon-foreground.png`
- Android adaptive background: `assets/images/android-icon-background.png`
- Android monochrome icon: `assets/images/android-icon-monochrome.png`

## Store copy

Korte beschrijving:

`Koop vandaag voor de toekomst van morgen. AI-native voorraadbeheer met cameratoegang voor scanflows, barcode, houdbaarheid, realtime alerts en 15 gratis scans.`

Volledige beschrijving:

`Taze helpt teams in food, retail en distributie om voorraad, kosten en duurzaamheid sneller en slimmer te beheren. Taze vraagt alleen cameratoegang voor scanflows en productfoto's. Barcodeherkenning, productmatch en voorraadregistratie gebruiken die ene permissie om de workflow te laten werken.`

`De app bundelt scanning, voorraadregistratie, inzichten en meldingen in een professionele omgeving voor dagelijkse operatie. Zo werk je sneller, beperk je waste, hou je grip op voorraadbewegingen tussen locaties en kan de betaalde upgrade na de gratis scans direct worden geactiveerd.`

`Voor bedrijven zijn er schaalpakketten voor 0-20, 20-100, 100-500 en 500-5000 vestigingen, met volumekorting bij meerdere locaties en een centrale aankoop voor lagere operationele kosten.`

## Play Console checklist

1. Maak in Google Play Console een app aan met pakketnaam `com.davykunst.tazeai`.
2. Upload een `AAB` uit `npx eas-cli build --platform android --profile production`.
3. Voeg app-icon en feature graphic uit `assets/store/` toe.
4. Voeg minimaal telefoon-screenshots toe van dashboard, scanner, inzichten en meldingen.
5. Voeg `https://taze.to/privacy` toe als privacy policy URL.
6. Vul Data safety in voor cameratoegang, accountgegevens, betalingen en cloud-sync indien gebruikt.
7. Start met `Internal testing` voordat je naar `Closed testing` of `Production` gaat.

## Aanbevolen screenshots

- Dashboard met KPI's en snelle acties
- Scanner met live camera-overlay voor scanflows en productfoto's
- Inzichten/rapportage
- Meldingen of houdbaarheidswaarschuwingen
- Betalingen of account/cloud-sync als dat onderdeel is van je aanbod

## Support en legal

- Privacy policy: `https://taze.to/privacy`
- Support: `https://taze.to/support`
- Contact: `https://taze.to/contact`
- Supportmail: `lgstudio144@gmail.com`

## Nog handmatig nodig voor echte publicatie

- Productie-API en env vars correct ingesteld
- Finale screenshots van een echte Android-build
- Test op permissies, login, betalingen en camera op fysiek toestel
