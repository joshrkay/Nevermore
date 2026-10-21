---
name: verify
description: Run the Edgar Allan Advisory app in a browser against a local Supabase stand-in whose data calls hit real Postgres, and drive the advisor queue, sign-in states and The Reckoning.
---

# Verifying this app

There is no Supabase project to point at in a sandbox, so use `stub.mjs` (next to this file): a ~70 line
HTTP server on :54321 that fakes only auth tokens and CORS. `advisor_list_submissions`, `is_advisor` and
the `chamber_sessions` read run **real SQL in local Postgres** under the advisor's JWT claims. A runtime
switch makes it behave as an advisor, a non-advisor, or reject the token as expired (PGRST301).

## Recipe (worked end to end)

1. **Database.** Postgres 16 is installed but stopped: `pg_ctlcluster 16 main start`; set a password
   (`su postgres -c "psql -c \"ALTER ROLE postgres PASSWORD 'postgres'\""`). Build a database from the real
   migrations with the repo's own harness, which leaves the queue scenario's rows behind:
   `createdb verify_db && psql -d verify_db -v ON_ERROR_STOP=1 -q -f supabase/tests/advisor_operations.sql`
   (run as the `postgres` OS user). Give the rows display data with `session_replication_role = replica`
   updates (otherwise editing a certified row withdraws its certification, correctly).
2. **Stub.** `ADVISOR_ID=<uuid in user_roles> node .claude/skills/verify/stub.mjs &`
   Switch behaviour: `POST :54321/__mode {"advisor":"ok"|"no"|"expired"}`; `GET /__log` shows what the app sent.
   Kill it by port (`fuser -k 54321/tcp`), never `pkill -f stub.mjs` from a command that contains that name.
3. **App.** `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_PUBLISHABLE_KEY=x npx vite --port 8080 --host localhost &`
4. **Browser.** Playwright is in `node_modules`; Chromium is at `/opt/pw-browsers/chromium-*/chrome-linux/chrome`
   (launch with `executablePath` and `--no-sandbox`, never `playwright install`). Sign in without a login by
   writing the session JSON to `localStorage["sb-localhost-auth-token"]` (key is `sb-<first label of the URL host>-auth-token`)
   with `expires_at` in the future and `user.is_anonymous: false`.

## Flows worth driving

- `/advisor`: row order (certified newest first, then drafts), State/Reference columns, search (no server call
  while typing; kept in `?q=`), status filter (one server call), click a non-link cell vs the company link then Back.
- Session states: stub `expired` then load `/advisor/submissions/<id>` -> `/login` with "Your session expired";
  header Sign out -> "You've been signed out" and sign-in lands on `/advisor`; stub `no` -> "Advisor access required".
- `/start?session=<id>` tab "The Reckoning": certified+unchanged is read-only; a withdrawn or never-certified intake
  shows the form; editing "Business Name" on the Company tab (button "Edit Business Name", then Save) brings the form back.

## Gotchas

- `jsonb_agg`, not `json_agg`, when a command prints one result line per call.
- Seeded UUIDs that share a prefix make every derived reference (`EAA-<year>-<first 8 hex>`) identical; use real UUIDs if reading those.
- A certified row seeded without `signed_at` renders "Invalid Date" in The Reckoning's changed-answers notice.
