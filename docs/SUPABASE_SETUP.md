# Setting up a Supabase project

`scripts/supabase-setup.mjs` turns an empty Supabase project into one the app runs on, then checks
it. Every step is safe to run again. Keys stay on your machine: the script reads them from the
Supabase API and your secrets file and never prints them.

The production site (Vercel, `nevermore-gamma.vercel.app`) already points at project
`dvfwrjpkltqdkfudbahe` through the Vercel Supabase integration, so nothing changes on Vercel.

Vercel deploys the front end separately from `supabase db push`, so push first: a front end that
reads a column the database does not have yet cannot load, create or save an intake. For example,
`20261027090000_intake_validation_and_versioning.sql` (`data_version`) must be pushed before the
front end that uses it is deployed.

## What it does

| Step | How | Done by hand instead |
|---|---|---|
| Apply the migrations (tables, row security, storage buckets) | `supabase link`, `supabase db push` | SQL editor, file by file |
| Set function secrets (AI key, `APP_BASE_URL`, email settings) and generate `IP_HASH_SECRET` if missing | `supabase secrets set` from a private temporary file | Edge Functions → Secrets |
| Deploy `chamber-extract`, `document-extract`, `dispatch-outbox` | `supabase functions deploy` | (CLI only) |
| Auth: guest sign-in on, email confirmation on, site URL and redirect, the email-change message carries the 6-digit code, sign-in emails through Resend's SMTP | Management API `PATCH /v1/projects/{ref}/config/auth` | Authentication → Sign In / Providers, URL Configuration, Emails, SMTP Settings |
| Email schedule: `pg_cron`, `pg_net`, the service-role key in Vault, `dispatch-outbox` every minute | Management API SQL endpoint | SQL editor, `docs/NOTIFICATIONS.md` → Schedule |
| Check all of the above, and that each function boots | SQL counts, the public auth settings, a signed-out call to each function (a deployed one answers its own 401) | |

Sign-in emails matter for submissions, not just convenience: a guest certifies only after confirming
an email with a 6-digit code, and Supabase's built-in mailer only delivers to your own team's
addresses. With `RESEND_API_KEY` and `EMAIL_FROM` set, the script routes those emails through
Resend (`smtp.resend.com`). It leaves SMTP alone if another provider is already configured.

## Before you run it

1. **Node 20 or later** and the **Supabase CLI 2.x** (`brew install supabase/tap/supabase`, or see
   the CLI docs for other systems). To use a CLI installed some other way, point
   `SETUP_SUPABASE_BIN` at it.
2. **A personal access token**: Supabase dashboard → Account → Access Tokens. Open the dashboard
   from Vercel (Storage → the Supabase store → Open in Supabase) if you signed up through Vercel.
3. **The database password.** The CLI asks for it when linking. The Vercel integration stored it as
   `POSTGRES_PASSWORD` (Vercel → Project → Settings → Environment Variables); or reset it in the
   Supabase dashboard (Project Settings → Database). Set `SUPABASE_DB_PASSWORD` to skip the prompt.
4. **The secrets file:**

   ```sh
   cp supabase/env.production.example supabase/.env.production
   ```

   Fill it in. `supabase/.env.production` is git-ignored. Required: an AI key (`LOVABLE_API_KEY`, or
   `AI_PROVIDER=anthropic` with `ANTHROPIC_API_KEY`) and `APP_BASE_URL`. Needed to accept
   submissions: the email settings, with `EMAIL_FROM` on a domain verified in Resend.

## Run it

```sh
read -rs SUPABASE_ACCESS_TOKEN && export SUPABASE_ACCESS_TOKEN   # paste the token; it isn't echoed
npm run setup:supabase -- --project-ref dvfwrjpkltqdkfudbahe
```

It shows the project's name and status, asks you to type the project ref back, then runs each step
and prints the checks:

```
  ✓ Migrations applied: N of N   (N = the files in supabase/migrations)
  ✓ Guest (anonymous) sign-in: anonymous_users=true
  ✓ Function chamber-extract: answered 401 from the function itself
  …
  … Advisor accounts: none yet: sign up on the site, then run with --grant-advisor you@example.com
```

`✗` is a failed required check and the exit status is 1; `…` is a to-do that doesn't block. A step
that fails stops the run and names what to fix; run the script again once it's fixed.

Other modes:

```sh
npm run setup:supabase -- --project-ref <ref> --check                          # read only
npm run setup:supabase -- --project-ref <ref> --grant-advisor you@example.com  # after signing up
```

`--secrets-file <path>` uses another secrets file; `--yes` skips the confirmation.

## After it passes

1. **Advisor access.** Sign up at `/login` with the advisor's email and confirm it, then run the
   `--grant-advisor` command above. `docs/ADVISOR_ACCESS.md` has the details.
2. **Try a real intake** on the site: start as a guest, chat, upload a document, verify an email
   with the code, certify, and check the advisor alert and prospect confirmation arrive.
3. **Don't turn on Supabase CAPTCHA yet.** Only guest sign-in sends a Turnstile token. With
   Authentication → Attack Protection → CAPTCHA enabled, password sign-in and sign-up at `/login`
   would be refused, which locks advisors out. `VITE_TURNSTILE_SITE_KEY` on Vercel is harmless on
   its own.
4. **Email volume.** Supabase caps how many sign-in emails it sends an hour (Authentication → Rate
   Limits); raise it if a launch brings many prospects at once.
5. **The plan.** A Free project pauses after a week without activity and has no downloadable
   backups. Move to Pro before relying on it.

## Reruns

A rerun applies new migrations, sets the secrets again (an existing `IP_HASH_SECRET` is kept),
redeploys the functions, re-sends the Resend SMTP settings (so a rotated key is picked up), replaces
the Vault copy of the service-role key and re-creates the schedule under the same name. It doesn't
remove redirect URLs or replace an email template that already sends the code.

## If a step fails

- **`supabase link` or `db push`:** usually the database password. A failed `db push` stops
  before anything else changes.
- **Deploying a function asks for Docker:** recent CLIs bundle on Supabase's side; update the CLI,
  or run `supabase functions deploy <name> --use-api --project-ref <ref>` and rerun the script.
- **Auth settings or the schedule:** the script calls the Management API endpoints listed above.
  If one is refused, make the same change in the dashboard (the table's last column) and rerun
  with `--check`.
- **"Couldn't read the project's legacy service_role key":** `dispatch-outbox` authenticates the
  schedule with the legacy JWT service-role key. Re-enable legacy API keys (Project Settings → API
  Keys) and rerun.
