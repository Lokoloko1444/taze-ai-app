# QA Runbook

Gebruik dit runbook om Taze systematisch te testen op web, iOS en Android.
Werk in deze volgorde:

1. Automated baseline
2. Web smoke
3. iOS smoke
4. Android smoke
5. Live deployment checks
6. Failure scenarios

Score per stap:

- `PASS` = werkt zoals verwacht
- `WARN` = werkt, maar met een niet-blokkerend aandachtspunt
- `FAIL` = blokkerend of crashend gedrag

## 0. Vooraf

- Gebruik eerst staging, daarna pas productie.
- Gebruik een testaccount voor login en checkout.
- Gebruik een testkaart of test checkout in staging.
- Test camera en biometrie op een echt toestel, niet alleen in een emulator.
- Voor browser-e2e in Chromium kun je `npm run qa:web` draaien; bouw lokaal eerst `dist/` met `npm run build:web`, of zet `PLAYWRIGHT_BASE_URL` naar een staging- of live URL.
- Open voor server-smoke een tweede terminal met de API/server actief.

## 1. Automated Baseline

Run:

```bash
npm run qa:baseline
```

Als je de commands los wilt draaien:

```bash
npm run check:env
npm run security:check
npm run check:readiness
npm run build:web
```

Expected:

- geen lint errors
- geen security regressies
- readiness geeft hoogstens `WARN`, nooit een onverwachte `FAIL`
- web export bouwt succesvol

## 2. Web Smoke

Test in Chrome of Edge.

Voor geautomatiseerde browser-e2e in Chromium:

```bash
npm run build:web
npm run qa:web
```

1. Open `/`.
2. Open `/hub`.
3. Open `/account`.
4. Open `/security`.
5. Open `/readiness`.
6. Open `/trace`.
7. Open `/transport`.
8. Open `/audit`.
9. Open `/helpdesk`.
10. Open `/translate`.
11. Open `/privacy`, `/support` en `/contact`.
12. Open `/services`, `/partners`, `/kankerfonds` en `/creatieve-kunstenaars`.

Expected:

- geen blank screen
- geen route die vastloopt
- publieke info-pagina's laden zonder auth-bypass
- `/security` geeft op web geen dead-end
- `/readiness` toont duidelijk of je naar live deployment kijkt of naar een workspace snapshot

## 3. Auth Flow

Route: `/account`

1. Open `/account`.
2. Log in met een testaccount.
3. Controleer dat de status verandert naar `Ingelogd`.
4. Herlaad de pagina.
5. Controleer dat sessie, e-mail en rol bewaard blijven.
6. Sla het hoofdaccount op voor dit toestel.
7. Herlaad opnieuw en controleer dat het hoofdaccount gelijk blijft.
8. Meld af met `Uitloggen`.
9. Log opnieuw in.
10. Test desgewenst wachtwoord reset.

Extra negatieve test:

1. Probeer in te loggen met een fout wachtwoord.
2. Probeer een nieuw account te maken met een testmailbox als `example.com`.

Expected:

- foutmelding is duidelijk
- sessie blijft stabiel na refresh
- hoofdaccount geeft geen mismatch tenzij je bewust een ander account koppelt
- geen auth bypass via directe route-openingen

## 4. Security Lock

Route: `/security`

### Web

1. Open `/security`.
2. Controleer dat de pagina opent zonder lock dead-end.

### Native iOS / Android

1. Open `/security`.
2. Vergrendel de app of forceer de native lock.
3. Ontgrendel met biometrie of toestelcode.
4. Heropen de app vanuit achtergrond.

Expected:

- lockscherm toont geen gevoelige data
- ontgrendelen werkt zonder crash
- na unlock keert de app terug naar dezelfde context

## 5. Scanner Flow

Route: `/scan`

### Product mode

1. Open `/scan`.
2. Geef cameratoegang.
3. Zorg dat `Product` actief is.
4. Scan een barcode.
5. Neem een productfoto.
6. Controleer dat de herkenning verschijnt.
7. Kijk naar naam, categorie, confidence en suggestie voor locatie.
8. Druk op `Opslaan in voorraad`.
9. Scan hetzelfde item opnieuw.
10. Controleer dat het wordt samengevoegd en niet dubbel wordt opgeslagen.
11. Neem een bewust slechte foto en controleer dat de foutafhandeling netjes blijft.

### Ticket mode

1. Zet de scanner op `Kassaticket`.
2. Scan of fotografeer een kassabon.
3. Controleer dat de ticketregels verschijnen.
4. Controleer de live kassakoppeling.
5. Druk op `Registreer ticketverkoop`.
6. Test ook `Sla meerdere producten op` wanneer meerdere regels worden herkend.

### Free scan limit

1. Gebruik scans tot de gratis limiet bijna bereikt is.
2. Controleer dat de teller afloopt.
3. Controleer dat de knop naar `Open betalingen` gaat zodra de limiet bereikt is.

Expected:

- camera opent stabiel
- barcode en fotoherkenning werken realtime
- opslag maakt geen duplicaten
- ticketflow boekt verkoop of afboeking correct
- free scan limiet stuurt naar payments zonder crash

## 6. Payments Flow

Route: `/payments`

1. Open `/payments`.
2. Kies een klanttype.
3. Kies een billing cycle.
4. Schakel tussen betaalmethodes.
5. Controleer de Stripe waarschuwing in de checkout box.
6. Druk op `Activeer <pakket>`.
7. Controleer dat checkout start of dat je een duidelijke foutmelding krijgt.
8. Test `Reset`.
9. Open de Stripe betaalroute via `/stripe-checkout`.
10. Test de return paden met `?checkout=success` en `?checkout=cancel`.

Expected:

- verkeerde Stripe config geeft een duidelijke boodschap
- geldig checkoutpad gebruikt de juiste return URL
- invoice status verandert niet dubbel
- cancel pad laat de flow netjes terugvallen

## 7. Newsletter Flow

Route: `/newsletter`

1. Open `/newsletter`.
2. Vul een ongeldig e-mailadres in.
3. Controleer dat de validatie faalt.
4. Vul een geldig testadres in.
5. Druk op `Inschrijven`.
6. Controleer of de live server subscribe accepteert.
7. Test de fallback naar mailto wanneer de provider niet bereikbaar is.
8. Open `Privacybeleid`, `Hulp` en `Contact`.

Expected:

- invalid email wordt geblokkeerd
- valid email wordt opgeslagen
- fallback werkt zonder crash

## 8. Data Layer

Doe deze checks na een scan- of paymentactie:

1. Open `/trace`.
2. Controleer dat er precies een nieuw event is bijgekomen.
3. Refresh de pagina.
4. Controleer dat hetzelfde event niet dubbel verschijnt.
5. Open `/audit`.
6. Controleer dat AI-audit en transportevents consistent blijven.
7. Open `/transport`.
8. Sync een voorkeur of retry een fout.
9. Refresh en controleer dat de status gelijk blijft.

Expected:

- geen dataverlies
- geen dubbele records
- refresh verandert niets onverwachts

## 9. Readiness en Live Checks

Route: `/readiness`

1. Open `/readiness`.
2. Controleer de bronkaart bovenaan.
3. Controleer of de pagina `Live deployment via /health` of `Workspace snapshot` aangeeft.
4. Controleer de live status-kaart.
5. Controleer dat Stripe, Supabase en public origins logisch worden weergegeven.

Server checks:

1. Open `/health`.
2. Open `/api/supabase/status`.
3. Open `/api/stripe/status`.

Expected in production:

- `/health` geeft `ok: true`
- Supabase public en server status zijn klaar
- Stripe webhook en checkout zijn klaar
- readiness is gebaseerd op live deployment, niet alleen op lokale env

## 10. Failure Scenarios

Test bewust deze fouten:

1. Geen camera-permission.
2. Slechte of trage netwerkverbinding.
3. Verlopen sessie.
4. Verkeerd wachtwoord.
5. Dubbele scan op hetzelfde item.
6. Mislukte Stripe checkout.
7. Newsletter provider down.
8. Herladen tijdens verwerking.

Expected:

- foutmelding is duidelijk
- geen crash
- geen oneindige loader
- geen dubbele writes

## 11. Stop Criteria

Je stopt de release als een van deze dingen gebeurt:

- auth bypass
- hardcoded secret zichtbaar in code of docs
- scanflow maakt duplicaten
- checkout loopt naar verkeerde return URL
- live deployment geeft 500 op gezonde config
- native camera of lock crasht
- een route blijft hangen in loading zonder herstel

## 12. Kort Oordeel

Als alle stappen hierboven slagen, dan heb je:

- functionele login
- stabiele scanner
- consistente data layer
- werkende tracking
- gecontroleerde payments
- nette live readiness
