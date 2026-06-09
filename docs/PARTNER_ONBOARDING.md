# Partner Onboarding

Deze pagina helpt een nieuwe partner veilig aan boord te komen bij Taze.

## Doel

Partners helpen mee aan content, design, features, tests en documentatie, zonder toegang te krijgen tot secrets of store-credentials.

## 1. Toegang

- Geef alleen toegang tot de repo die nodig is.
- Geef geen toegang tot secrets, Partner Center, Google Play Console of App Store Connect tenzij dat echt moet.
- Gebruik waar mogelijk alleen PR-rechten en geen brede write-toegang.

## 2. Wat de partner wel mag

- Code voorstellen via branches of pull requests
- Copy en storeteksten verbeteren
- UI en UX verbeteren
- Bugfixes en tests meedoen
- Feedback geven op releases en pricing

## 3. Wat de partner niet mag

- API keys of private tokens zien
- Release-submissions doen zonder review
- Secrets opslaan in GitHub
- Pricing of publicatie aanpassen zonder owner-approval

## 4. Eerste dag checklist

1. Lees `docs/PARTNER_GUARDRAILS.md`
2. Lees `docs/RELEASE_SECURITY.md`
3. Lees `docs/PRODUCTION.md`
4. Lees `docs/EXPO_RELEASE.md`
5. Check `docs/BRANCH_PROTECTION.md`
6. Gebruik de PR-template uit `.github/pull_request_template.md`

## 5. Werkafspraak

- Release-critical changes gaan altijd via PR.
- Secrets blijven altijd in deployment secret stores.
- Microsoft uploads blijven handmatig in Partner Center.
- Google Play en Apple submissions lopen via Expo/EAS of hun eigen console.
- Gebruik `docs/OPEN_NOT_OPEN.md` als snelle grenslijst voor wat wel en niet open staat.

## 6. Handige teamregel

Als iemand een wijziging voorstelt die geld, toegang of publicatie raakt, laat de owner die eerst beoordelen.
