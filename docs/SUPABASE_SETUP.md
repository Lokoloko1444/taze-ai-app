# Supabase Setup

Deze korte gids helpt je om de Supabase-koppeling in Taze goed live te zetten.

## Wat je nodig hebt
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Waar je het vindt
1. Open `https://supabase.com/dashboard`.
2. Kies je project.
3. Ga naar `Settings` > `API`.
4. Kopieer daar:
   - `Project URL`
   - `anon public` key of, in nieuwere dashboards, `publishable` key
   - `service_role` key of, in nieuwere dashboards, `secret` key

## Waar je het invult
- Expo / web:
  - `EXPO_PUBLIC_SUPABASE_URL` = `Project URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = `anon public` key of `publishable` key
- Server / Cloudflare / backend:
  - `SUPABASE_URL` = `Project URL`
  - `SUPABASE_SERVICE_ROLE_KEY` = `service_role` key of `secret` key

## Na het invullen
1. Zet de migraties uit `supabase/migrations/` in Supabase SQL editor:
    - `0001_init.sql`
    - `0002_invoice_and_trace_sync.sql`
    - `0003_transport_preferences.sql`
    - `0004_refund_approvals.sql`
2. Herbouw de web-app zodat de nieuwe env-waarden meegenomen worden.
3. Controleer daarna `/account` en `/readiness`.
4. Check `https://api.taze.to/api/supabase/status` of de server secrets ook live staan.

## Snelle checks
- Open `https://taze.to/account`.
- Controleer of de melding `Supabase niet ingesteld` verdwijnt.
- Controleer of login, account en sync weer werken.
- Open `https://taze.to/readiness` voor de live status.

## Veiligheid
- Bewaar `SUPABASE_SERVICE_ROLE_KEY` nooit in de browser.
- Deel de anon key alleen als publieke client key.
- Draai keys om als je vermoedt dat ze gelekt zijn.
