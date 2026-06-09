# Branch Protection Checklist

Gebruik deze instellingen voor `main` zodat releases en secrets veilig blijven.

## Zo controleer je het in GitHub

Ga naar `Settings` > `Branches` > `Branch protection rules` en zet voor `main` de regels hieronder aan.

## Vereiste instellingen

- Require a pull request before merging
- Require at least 1 approving review
- Require review from Code Owners
- Dismiss stale pull request approvals when new commits are pushed
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Block force pushes
- Block branch deletion

## Aanbevolen status checks

- `npm run lint`
- `npm run security:check`
- `npm run check:readiness`

## Aanbevolen extra's

- Allow merge commits uit of alleen squash merge
- Restrict who can push to matching branches
- Enforce administrators as well if je echt strak wilt houden
- Keep secret scanning, Dependabot en CodeQL actief

## Snelle test

Als iemand zonder review direct naar `main` kan pushen, staat de bescherming nog niet strak genoeg.

## Wat hiermee wordt afgedekt

- Niemand pusht per ongeluk rechtstreeks naar `main`
- Release- en securitywijzigingen krijgen altijd review
- Belangrijke checks moeten groen zijn voor merge
- Ongewenste force-pushes en branch deletion worden geblokkeerd
