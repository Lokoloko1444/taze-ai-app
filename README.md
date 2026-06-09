# Taze

Taze is een mensgericht, AI-ondersteund B2B-platform voor bedrijven die voorraad, mensen, leveringen en operationele beslissingen willen verbinden in één levende workflow. De app combineert camerascans, barcodeherkenning, contextbewuste AI en audit logging zodat het bedrijf leert van wat er echt gebeurt.

## Manifest

Taze wordt gebouwd vanuit de zin, niet vanuit macht.

Taze ontstaat uit een driehoek van uitvoering:

- Mens: bronhouder, visie, grens en correctie.
- AI: denkpartner, vertaler, criticus en structuurmaker.
- Codex: bouwer, uitvoerder en codegenerator binnen regels.

Er is geen rang in de betekenis. Er is wel verantwoordelijkheid in de uitvoering.

De keten is:

- Filosofie -> principes
- Principes -> productregels
- Productregels -> code
- Code -> controle
- Controle -> vertrouwen
- Vertrouwen -> verkoop

Taze verkoopt dus geen belofte. Taze bouwt eerst betekenis, dan regels, dan code, dan bewijs, dan vertrouwen.

## AI in Taze

AI is geen macht. AI is geen rechter. AI is geen baas. AI is geen absolute waarheid.

AI is:

- ondersteuning
- vertaling
- voorstel
- waarschuwing
- spiegel
- verbinding
- tweede paar ogen

AI mag voorstellen doen, patronen tonen, signalen geven, helpen herinneren en context ordenen.

AI mag niet zonder mens:

- voorraad definitief corrigeren
- bestellingen plaatsen
- betalingen goedkeuren
- rollen wijzigen
- mensen beoordelen
- gebruikers blokkeren
- gevoelige acties uitvoeren

Elke AI-output moet onderscheid maken tussen:

- feit
- interpretatie
- voorstel
- menselijk besluit
- uitgevoerde actie
- auditlog

Geen bron = geen besluit.
Geen menselijke goedkeuring = geen gevoelige actie.

## Taze-grondregels

1. Mens blijft bronhouder.
2. AI ondersteunt, maar overheerst niet.
3. Feit, interpretatie, besluit en actie blijven gescheiden.
4. Afwijking is niet automatisch fout.
5. Technologie moet ontvankelijk meegroeien met werkelijkheid.
6. Bedrijfsdata blijft van het bedrijf.
7. Werkvloer wordt geholpen, niet bespioneerd.
8. Kritieke acties gebeuren alleen binnen de beveiligde Taze-app.
9. E-mail en push mogen melden, maar niet beslissen.
10. Macht wordt begrensd door rollen, rechten, goedkeuring en auditlog.
11. Taze groeit door vertrouwen, niet door afhankelijkheid.
12. Rust is een productwaarde.

## Taze Core V1

Taze Kern moet eerst goed staan:

- Bedrijf
- Vestiging
- Gebruiker
- Lidmaatschap
- Rol
- Functiegebied
- Recht
- Aanmeldaccount van provider
- Voorraaditem
- Voorraadbeweging
- AI-voorstel
- Goedkeuring
- Auditlog

Met:

- Google-login
- Microsoft-login
- Apple-login
- bedrijfsschakelaar
- rollen en functies
- goedkeuringsregels
- AI-voorstelworkflow
- menselijke goedkeuring
- auditlog
- veilige meldingen
- geen kritieke acties via externe links

## Controlecheck

Voor elke release:

- Is AI ondersteuning, geen macht?
- Is menselijke goedkeuring nodig bij gevoelige acties?
- Is de bron zichtbaar?
- Is onzekerheid zichtbaar?
- Is auditlog aanwezig?
- Zijn feit, AI-voorstel, besluit en actie gescheiden?
- Is companyId/branchId overal gecontroleerd?
- Kan werkvloer dit simpel gebruiken?
- Voelt dit als hulp, niet als controle?
- Kan data geexporteerd worden?
- Wordt er niets beslist via phishinggevoelige links?
- Bouwt dit vertrouwen vóór verkoop?

## Kern

- Router
- React Native / React 19
- Mobile builds
- Supabase
- Stripe

## Platformmodules

- Taze Identiteit
- Taze Bedrijf
- Taze Voorraad
- Taze Bar
- Taze Keuken
- Taze Productie
- Taze Levering
- Taze AI

## Snel starten

```bash
npm install
npm run start
```

Voor lokaal op telefoon:

```bash
npm run start:go
```

## Handige scripts

- `npm run qa:baseline`
- `npm run lint`
- `npm run security:check`
- `npm run build:web`
- `npm run check:env`
- `npm run smoke:server`
- `npm run qa:web` - browser-e2e; build `dist/` first or point `PLAYWRIGHT_BASE_URL` to a live/staging URL
- `npm run start:prod-sim`

## Assets

Brand assets genereren:

```bash
powershell -ExecutionPolicy Bypass -File .\scripts\generate-brand-assets.ps1
```

Belangrijkste outputs:

- `assets/images/icon.png`
- `assets/images/splash-icon.png`
- `assets/images/android-icon-foreground.png`
- `assets/store/google-play-icon-512.png`
- `assets/store/google-play-feature-graphic.png`

## Release

Canonieke domeinen:

- public website: `https://taze.to`
- demo: `https://demo.taze.to` (read-only preview, included in the total package)
- bedrijfsplatform: `https://app.taze.to`
- api: `https://api.taze.to`
- intern beheer: `https://admin.taze.to`

Support:

- support: `lgstudio144@gmail.com`
- privacy: `https://taze.to/privacy`
- support page: `https://taze.to/support`
- contact: `https://taze.to/contact`

Checklist:

- [Production checklist](docs/PRODUCTION.md)
- [Release flow](docs/EXPO_RELEASE.md)
- [Branch protection checklist](docs/BRANCH_PROTECTION.md)
- [Partner guardrails](docs/PARTNER_GUARDRAILS.md)
- [Partner onboarding](docs/PARTNER_ONBOARDING.md)
- [Open / Niet Open](docs/OPEN_NOT_OPEN.md)
- [QA checklist](docs/QA_CHECKLIST.md)
- [QA runbook](docs/QA_RUNBOOK.md)
- GitHub Actions QA: `.github/workflows/qa.yml`
- [Security guide](docs/SECURITY.md)
- [Release security](docs/RELEASE_SECURITY.md)
- [Google Play release checklist](docs/GOOGLE_PLAY_READY.md)
- [Apple App Store release checklist](docs/APPLE_APP_STORE_READY.md)
- [Microsoft Store metadata](docs/MICROSOFT_STORE.md)

## Security

- Dependabot bewaakt dependency-updates.
- CodeQL scant de codebase op push, pull request en via planning.
- Secret scanning controleert op per ongeluk gelekte secrets.
- `npm run security:check` draait lint plus `npm audit`.
- Taze vraagt alleen cameratoegang voor scanflows en productfoto's. Barcodeherkenning, productmatch en voorraadregistratie gebruiken die ene permissie om de workflow te laten werken.
- Bewaar echte secrets alleen in deployment-secretstores, nooit in de repo.
