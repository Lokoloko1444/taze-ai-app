Partner Guardrails

Deze repo is opgezet voor teamwork: jij en ik werken samen aan Taze, maar zonder onnodig risico op diefstal, misbruik of per ongeluk publiceren van secrets.

## Kort

1. Owner regelt release, billing, secrets en publicatie.
2. Partner helpt met code, content, tests en docs.
3. Reviewer keurt release-, security- en pricingwijzigingen goed of af.

## Basisregels

- Deel nooit service keys, webhook secrets of private store-credentials in GitHub.
- Gebruik alleen deployment secret stores voor echte credentials.
- Geef partners alleen de toegang die ze nodig hebben.
- Laat releasebestanden en pricing altijd reviewen voordat je publiceert.

## Rollen

### 1. Owner

- Mag release, billing, store submissions en secrets beheren.
- Mag beslissen wat wel en niet live gaat.
- Mag toegang geven of intrekken voor teamleden.

### 2. Partner

- Mag werken aan content, features, tests en verbeteringen.
- Mag geen secrets, upload-credentials of private store-toegang krijgen.
- Mag wel PR's openen en voorstellen doen.

### 3. Reviewer

- Controleert release-, security- en payments-wijzigingen.
- Keurt alleen goed als de checklist klopt.
- Blokkeert wijzigingen die risico geven voor geld, toegang of publicatie.

## Wie mag wat

| Onderdeel | Owner | Partner | Reviewer |
| --- | --- | --- | --- |
| Code wijzigen | Ja | Ja | Nee |
| PR openen | Ja | Ja | Nee |
| PR goedkeuren | Ja | Nee | Ja |
| Secrets beheren | Ja | Nee | Nee |
| Releases publiceren | Ja | Nee | Nee |
| Store submissions doen | Ja | Nee | Nee |
| Pricing aanpassen | Ja | Voorstel | Ja |
| Security-checks beoordelen | Ja | Nee | Ja |

## Wat veilig is om te delen

- Normale code
- Copy en storeteksten
- Screenshots en mockups
- Testresultaten
- PR-feedback

## Veilig releaseproces

1. Maak een branch voor wijzigingen.
2. Laat minimaal een review meelezen op release- of securitybestanden.
3. Check `docs/PRODUCTION.md`, `docs/EXPO_RELEASE.md` en `docs/BRANCH_PROTECTION.md`.
4. Bouw via EAS.
5. Dien Google Play en App Store in via Expo.
6. Upload Microsoft apart via Partner Center met `.msixupload`.

## Wat altijd apart houden

- Stripe secret keys
- Supabase service-role keys
- Microsoft Partner Center credentials
- Google Play service account JSON
- Apple App Store Connect API keys

## Snelle toets

Als een wijziging geld, toegang of publicatie beinvloedt, behandel die als release-critical.
