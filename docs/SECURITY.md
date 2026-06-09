# Security

This repo uses a few layers of security checks:

- GitHub Dependabot for dependency alerts
- GitHub CodeQL for code scanning
- GitHub Actions secret scanning with Gitleaks
- `npm run security:check` for local lint and audit gating

## Secrets policy

- Keep real secrets out of the repo.
- Use `.env` locally.
- Use deployment secret stores for GitHub, Cloudflare, Render, Stripe, Supabase and similar services.
- Treat store credentials, upload artifacts and partner-center tokens as secrets.
- Keep release-critical changes behind pull requests and code-owner review.

## Release hardening

- Protect `main` with required reviews.
- Require lint, readiness and security checks before merge.
- Use the PR template in `.github/pull_request_template.md` for every release-affecting change.
- Keep Microsoft submissions separate from Expo submissions.

## Readiness lint note

`app/readiness.tsx` is a very large generated-style screen and currently has a targeted ESLint exception for `react-hooks/rules-of-hooks`.
That is an intentional stopgap so the repo stays lintable and the security checks can pass.
The long-term fix is to split that screen into smaller modules when there is time for a proper refactor.
