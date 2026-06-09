# Microsoft Store Metadata

Gebruik deze gegevens voor de Windows/Microsoft Store release van Taze.

## Korte storeboodschap

`Koop vandaag voor de toekomst van morgen. Taze brengt voorraad, kosten en duurzaamheid samen in een AI-native mobiele workflow.`

## Package Identity

- `Package/Identity/Name`: `lGo.LGoStudio`
- `Package/Identity/Publisher`: `CN=443D6BAF-7CF1-4C39-AEC9-EF9ACF221AEB`
- `Package/Properties/PublisherDisplayName`: `@lGo`

## Identifiers

- `Package Family Name (PFN)`: `lGo.LGoStudio_19mdze79sbjmg`
- `Package SID`: `S-1-15-2-1325558380-2750973165-2032309436-3002806408-3957052134-27167366-954167889`
- `Store ID`: `9PD2T1FWJHH2`

## Links

- `Store deep link`: beschikbaar zodra het product live staat
- `Web Store URL`: Microsoft Store-link nog niet actief. Voorlopig blijft Cloudflare de live web/API-bron en Expo de Android-buildlijn. Microsoft Store wordt alleen voorbereid als extra distributiekanaal.
## Partner Center Notities

Gebruik deze notities als handoff zodra de Microsoft listing live gaat.

- Controleer eerst of `Package/Identity/Name`, `Package/Identity/Publisher` en `PublisherDisplayName` exact gelijk zijn aan de waarden in Partner Center.
- Upload de `.msixupload` in Microsoft Partner Center.
- Vul screenshots, pricing, leeftijdsclassificatie, privacy policy, support contact en release notes in.
- Plak de live `Store deep link` terug in `app.json` onder `extra.microsoft.storeDeepLink`.
- Plak de publieke `Web Store URL` terug in `app.json` onder `extra.microsoft.webStoreUrl`.
- Laat beide URL-velden leeg zolang de listing nog niet live is.

## Release Checklist

- Bevestig dat de package identity waarden in `app.json` overeenkomen met Partner Center.
- Bevestig dat de Store ID nog steeds `9PD2T1FWJHH2` is.
- Controleer of de release build een `.msixupload` oplevert.
- Voeg de live deep link toe zodra Partner Center die toont.
- Voeg de publieke store URL toe zodra de Microsoft Store pagina live is.
- Bewaar de release-notities in Partner Center voor de volgende update.

## Upload

- Bestandstype: `.msixupload`
- Microsoft Store submissions lopen handmatig via Partner Center, niet via Expo.

## Storecopy

- Taze helpt bedrijven met 0-20, 20-100, 100-500 en 500-5000 vestigingen om voorraad, kosten en duurzaamheid centraal te beheren.
- Een aankoop kan meerdere vestigingen bedienen, met volumekorting voor grotere organisaties.
- De eerste 15 scans zijn gratis, daarna blijft de workflow actief via betaling.

## Notitie

Deze waarden staan ook in `app.json` onder `extra.microsoft` zodat de release-gegevens centraal terug te vinden zijn.
