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
| Auth: guest sign-in on, email confirmation on, Site URL and Redirect URLs (below), the sign-up and email-change messages (below), sign-in emails through Resend's SMTP. First, so a later failure can't leave sign-up links broken | Management API `PATCH /v1/projects/{ref}/config/auth` | Authentication → Sign In / Providers, URL Configuration, Emails, SMTP Settings |
| Apply the migrations (tables, row security, storage buckets) | `supabase link`, `supabase db push` | SQL editor, file by file |
| Set function secrets (AI key, `APP_BASE_URL`, email settings) and generate `IP_HASH_SECRET` if missing | `supabase secrets set` from a private temporary file | Edge Functions → Secrets |
| Deploy `chamber-extract`, `document-extract`, `dispatch-outbox` | `supabase functions deploy` | (CLI only) |
| Email schedule: `pg_cron`, `pg_net`, the service-role key in Vault, `dispatch-outbox` every minute | Management API SQL endpoint | SQL editor, `docs/NOTIFICATIONS.md` → Schedule |
| Check all of the above, and that each function boots | SQL counts, the public auth settings, the auth config (Site URL, Redirect URLs, templates), a signed-out call to each function (a deployed one answers its own 401) | |

### Auth URLs and emails

Every link in a sign-up or email-change email goes through Supabase, which then sends the person to
the address the app asked for (`/auth/callback`), but only if that address is allowed. Otherwise it
sends them to the **Site URL**, and a new project's Site URL is `http://localhost:3000`: the person
sees their browser's "can't reach this site" page, although Supabase has already confirmed the
account. The script sets, and `--check` verifies:

- **Site URL** (Authentication → URL Configuration): exactly `APP_BASE_URL`, e.g.
  `https://nevermore-gamma.vercel.app`, with no trailing slash or path. The sign-up email appends
  `/auth/callback` to it.
- **Redirect URLs**: `https://nevermore-gamma.vercel.app/**`. The script keeps entries already there.
  To finish sign-ups on Vercel preview deployments, add `https://nevermore-*-cartboost.vercel.app/**`
  by hand (the team slug is in the preview URL); for local development add `http://localhost:8080/**`.
- **Confirm signup** template (Authentication → Emails): a 6-digit `{{ .Token }}`, which the sign-up
  page accepts, and a link to
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`, which confirms only when the
  person clicks **Confirm my email**. Supabase's default links straight to its verify endpoint and
  works once, so a mail scanner (Microsoft Defender Safe Links, Mimecast, Proofpoint) that opens it
  first uses it up. The script replaces a template that still uses `{{ .ConfirmationURL }}`; the text
  it installs is `SIGNUP_CONFIRM_TEMPLATE` in `scripts/supabase-setup-lib.mjs`, to paste by hand.
- **Change email address** template: the 6-digit `{{ .Token }}` a guest types to certify.

Deploy the front end with `/auth/callback` before installing the sign-up template, or its links land
on the 404 page.

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
  ✓ Email links return to the site: Site URL https://nevermore-gamma.vercel.app, redirects allowed under it
  ✓ Sign-up email survives mail scanners: 6-digit code and a link that confirms on a click
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

`--secrets-file <path>` uses another secrets file; `--yes` skips the confirmation. `--check` reads the
secrets file too when it exists, to compare the Site URL with `APP_BASE_URL`; without it, the check
only rejects a localhost or non-https Site URL.

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
remove redirect URLs or replace an email template that already sends the code (for sign-up: the
code and an app link, with no `{{ .ConfirmationURL }}`).

## If a step fails

- **`supabase link` or `db push`:** usually the database password. A failed `db push` stops
  before anything else changes.
- **Deploying a function asks for Docker:** recent CLIs bundle on Supabase's side; update the CLI,
  or run `supabase functions deploy <name> --use-api --project-ref <ref>` and rerun the script.
- **"Reading the auth settings failed":** the script stops rather than guess, because a patch built
  without the current settings would replace the Redirect URLs list. Nothing was changed.
- **Auth settings or the schedule:** the script calls the Management API endpoints listed above.
  If one is refused, make the same change in the dashboard (the table's last column) and rerun
  with `--check`.
- **"Couldn't read the project's legacy service_role key":** `dispatch-outbox` authenticates the
  schedule with the legacy JWT service-role key. Re-enable legacy API keys (Project Settings → API
  Keys) and rerun.

## If sign-up confirmation links fail

What the person sees after clicking the link tells you which setting is wrong:

- **The browser's "can't reach this site" or "localhost refused to connect" page:** the Site URL is
  still `http://localhost:3000` and the site isn't on Redirect URLs. Supabase did confirm the account,
  so the person can sign in at `/login` with their password now. Fix the URL Configuration above.
- **Another site's home page:** the Site URL points at another domain (an old Lovable preview, say).
  Fix it as above.
- **"This link didn't work" on `/auth/callback`:** the link was used, expired (after an hour by
  default) or replaced by a newer email. With Supabase's default template a mail scanner may have
  used it, which also confirms the account, so signing in usually works; otherwise the page sends a
  new email. Installing the sign-up template above stops scanners using the links up.

`npm run setup:supabase -- --project-ref <ref>` sets all of it; `--check` confirms it.
