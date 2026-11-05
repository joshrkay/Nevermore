# Setting up a Supabase project

`scripts/supabase-setup.mjs` turns an empty Supabase project into one the app runs on, then checks
it. Every step is safe to run again. Keys stay on your machine: the script reads them from the
Supabase API and your secrets file and never prints them.

The production site is `https://nevermorepeo.com`. Its Vercel project takes the Supabase URL and
publishable key of project `dvfwrjpkltqdkfudbahe` from the Vercel Supabase integration, so nothing
changes on Vercel while that connection stays. If you move to another domain or Vercel project, see
"Moving to a new domain or Vercel project" below.

Vercel deploys the front end separately from `supabase db push`, so push first: a front end that
reads a column the database does not have yet cannot load, create or save an intake. For example,
`20261027090000_intake_validation_and_versioning.sql` (`data_version`) must be pushed before the
front end that uses it is deployed.

## What it does

| Step | How | Done by hand instead |
|---|---|---|
| Check this machine and the secrets file before anything changes: the secrets (a key with a space or text after it stops the run), the Supabase CLI and its version, Docker running, and `RESEND_API_KEY` tried on Resend (below). A missing piece stops the run here, not partway | The secrets file, `supabase --version`, `docker info`, `POST https://api.resend.com/emails` with an empty email | |
| Auth: guest sign-in on, email confirmation on, Site URL and Redirect URLs (below), the sign-up, email-change and sign-in (magic-link) messages (below), sign-in emails through Resend's SMTP with `RESEND_API_KEY` as the password (it says whether the stored password matched, when Supabase shows it). First, so a later failure can't leave sign-up links broken | Management API `PATCH /v1/projects/{ref}/config/auth` | Authentication → Sign In / Providers, URL Configuration, Emails, SMTP Settings |
| Apply the migrations (tables, row security, storage buckets) | `supabase link`, `supabase db push --remote --yes` (CLI 3; CLI 2: `supabase db push`) | SQL editor, file by file |
| Set function secrets (AI key, `APP_BASE_URL`, email settings) and generate `IP_HASH_SECRET` if missing | `supabase secrets set --remote=<ref> --yes` from a private temporary file | Edge Functions → Secrets |
| Deploy `chamber-extract`, `document-upload`, `document-extract`, `document-scan`, `dispatch-outbox`, `resend-webhook`, `purge-intakes`, `ops-monitor` | `supabase functions deploy <name> --remote=<ref> --yes`, bundled with Docker | (CLI only) |
| Schedules: `pg_cron`, `pg_net`, the service-role key in Vault, and the five jobs in "Schedules" below | Management API SQL endpoint | SQL editor: the statements in "Schedules" below |
| Print a summary: the migrations applied (by file), the secrets set (names only, never values) and the functions deployed. A step that fails prints what was done before it | | |
| Check all of the above, and that each function boots | SQL counts, the public auth settings, the auth config (Site URL, Redirect URLs, templates), a signed-out call to each function (a deployed one answers its own 401) | |

### Schedules

The database runs five jobs. The migrations create each one when `pg_cron` (and, for the three that
call a function, `pg_net`) exist as they run; the script schedules them again after it enables the
extensions, so a project that gets them only from the script is covered too. The three function jobs
send the service-role key from Vault (`service_role_key`); each function refuses any other caller with
its own 401.

| Job | When | What it does | Without it |
|---|---|---|---|
| `dispatch-outbox` | every minute | Sends and retries the submission emails (`docs/NOTIFICATIONS.md`) | Emails go out only when a browser nudges right after a submission; no retries |
| `purge-intakes` | hourly, at :23 | Carries out intake deletions: removes the stored files through the Storage API, then the rows (`docs/DATA_HANDLING.md`) | Requested deletions and expired drafts are never deleted |
| `ops-monitor` | every five minutes | Alerts when errors, failed uploads, AI failures, refused access, failed deletions, malware detections or failed scans cross their thresholds (`docs/RUNBOOK.md`) | Failures are recorded, nobody is told |
| `document-scan` | every five minutes | Scans uploads that weren't settled when they arrived (the scanner was down or not set up, and every file uploaded before scanning existed), moves clean ones out of quarantine and removes quarantined files whose document is gone (`docs/RUNBOOK.md`, "Scan failed") | Those uploads stay unreadable |
| `expire-idle-intakes` | hourly, at :17 | Expires uncertified drafts idle for 30 days | Idle drafts never expire |
| `remind-idle-intakes` | hourly, at :29 | Queues the draft reminder a week before an uncertified draft closes, for owners who asked for it (`docs/NOTIFICATIONS.md`) | No reminders |
| `run-retention` | daily, 03:41 UTC | Queues closed drafts for deletion 30 days after they closed; prunes monitoring events (90 days), email delivery events (365 days), AI rate-limit records (1 day) and the funnel's milestones (365 days from each intake's start) | Nothing is queued for deletion or pruned |

To schedule one by hand (SQL editor), with your project ref in the URL:

```sql
select cron.schedule('purge-intakes', '23 * * * *', $job$
  select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/purge-intakes',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
$job$);
-- The same for ops-monitor and document-scan ('*/5 * * * *') and dispatch-outbox ('* * * * *').
select cron.schedule('expire-idle-intakes', '17 * * * *', 'select public.expire_idle_intakes();');
select cron.schedule('remind-idle-intakes', '29 * * * *', 'select public.queue_draft_expiry_reminders();');
select cron.schedule('run-retention', '41 3 * * *', 'select public.run_retention();');
```

Check them with `select jobname, schedule, active from cron.job order by 1;` (six rows) and recent runs
with `select j.jobname, d.status, d.start_time from cron.job_run_details d join cron.job j using (jobid)
order by d.start_time desc limit 20;`. A function job's run only says the request was sent: the
function's own answer is in Edge Functions → Logs (`DELETION_*`, `OPS_ALERT`, `OUTBOX_*`, `SCAN_*` lines) and in
`select status_code, created from net._http_response order by created desc limit 20;`.

### Engineering alerts

`ENGINEERING_ALERT_WEBHOOK_URL` (a Slack or Teams incoming webhook, or anything that takes a JSON POST
with a `text` field) is optional but should be set before launch. These functions use it:

- `dispatch-outbox`: a notification email that gave up (`OUTBOX_DEAD`).
- `purge-intakes`: a deletion that ran out of attempts (`DELETION_FAILED`).
- `document-upload`, `document-scan`: an upload that matched a malware signature (`MALWARE_DETECTED`), and
  one that couldn't be scanned after every attempt (`SCAN_FAILED`).
- `ops-monitor`: a failure kind over its threshold (`OPS_ALERT`), with the runbook playbook to follow.

Alerts carry ids, kinds, counts and failure codes, never names, addresses, file names or intake
content, so a shared channel is fine. Unset, each alert is only logged, and `--check` lists
"Engineering alerts" as a to-do. Set it in the secrets file with the others, or with
`supabase secrets set ENGINEERING_ALERT_WEBHOOK_URL=https://hooks.slack.com/services/... --project-ref <ref>`.
It must be https (http only for localhost).

### Malware scanning

Every upload goes through `document-upload`, which checks the file's bytes, scans it, and stores it: in the
`documents` bucket once the scan passed, in the private `quarantine` bucket otherwise. Nobody signed in can
read a quarantined file, and Lenore and advisors can open a file only once its scan passed. The scanner is
chosen by the `MALWARE_SCANNER` secret. Production uses Scanii (decision D13):

| `MALWARE_SCANNER` | Also set | Use |
|---|---|---|
| `scanii` (production) | `SCANII_API_KEY`, `SCANII_API_SECRET`; `SCANII_API_URL` only for a region other than the US | Scanii's hosted API. In the Scanii dashboard, create an API key in the US region (`api-us1`) and set its key and secret here; the secret is shown once. Files are scanned in Virginia and their contents deleted after the scan. Sign Scanii's DPA before real prospects' files go through it |
| `clamav` | `CLAMAV_HOST`, and `CLAMAV_PORT` if not 3310 | A clamd daemon reachable from Supabase's edge functions over TLS (clamd itself speaks plain TCP, so put stunnel or a TLS proxy in front). Raise clamd's `StreamMaxLength` to at least 21 MB |
| `http` | `MALWARE_SCANNER_URL` (https), `MALWARE_SCANNER_TOKEN` | Any scanning service, or a thin wrapper around one, that takes the file as `POST` `application/octet-stream` with `Authorization: Bearer <token>` and answers `{"verdict":"clean"}` or `{"verdict":"infected","signature":"<name>"}` |
| `none` | `APP_ENV=development`, `demo` or `staging` | No scanning: every file is recorded `skipped` and is readable. Only on a project that isn't production: with `APP_ENV` unset or anything else, `none` counts as unset |
| unset | | Uploads are refused: `document-upload` stores nothing, logs `SCAN_CONFIG_MISSING` naming the setting, and the prospect is told uploads are paused while virus checking is set up. `document-scan` answers 503 on every run and records a `scan_failed` event, so `ops-monitor` alerts within five minutes, then hourly |

The rule and why are in `docs/adr/0002-uploads-need-a-scanner-in-production.md`. `APP_ENV` names the
environment: leave it unset on production (unset means production), and set `demo`, `staging` or
`development` only on a project that holds no real prospects' files. Files held while no scanner was set
are scanned, and the clean ones released, on `document-scan`'s first run after one is set (within five
minutes).

A clean file is readable as soon as its upload finishes when the scanner answers at upload (one scan, at
most 60 seconds). If the scanner can't answer then, the file waits in quarantine and `document-scan` tries
again 10 minutes after the upload (so within 15 minutes), then backs off; after six attempts it is marked
`failed` and alerted.

`scripts/supabase-setup.mjs` applies the same rule before it changes anything: `MALWARE_SCANNER=none`
without a non-production `APP_ENV`, an `APP_ENV` that isn't one of `development`, `demo`, `staging` or
`production`, or `scanii` without `SCANII_API_KEY` and `SCANII_API_SECRET`, stops it. An unset
`MALWARE_SCANNER` is a warning, not a stop, so the rest of the setup isn't held up while Scanii's account is
opened; production refuses uploads, the census included, until it is set.

Scanii sees every uploaded file, census and payroll included: it needs the same data-processing terms as the
AI provider (`docs/LEGAL_REVIEW.md`). After setting it, run the EICAR check in `docs/RUNBOOK.md` ("Malware
detected").

The `documents` and `quarantine` buckets take only `application/octet-stream` up to 20 MB: every document is
stored with that type, so a browser always downloads it rather than showing it (the type its bytes showed is in
`documents.mime_type`). Confirm on the project that a 20 MB upload goes through `document-upload` (Supabase's
gateway limits a function's request body; the function refuses anything larger itself).

### Auth URLs and emails

Supabase builds the links in sign-up and email-change emails from the address the app asked for
(`/auth/callback`), but only if that address is on the Site URL's own host or on the Redirect URLs
list. Otherwise it uses the **Site URL**, and a new project's Site URL is `http://localhost:3000`:
the person sees their browser's "can't reach this site" page. The script sets, and `--check`
verifies:

- **Site URL** (Authentication → URL Configuration): `APP_BASE_URL`, e.g.
  `https://nevermorepeo.com`. Supabase falls back to it when the address the app asked for
  isn't allowed.
- **Redirect URLs**: `https://nevermorepeo.com/**` (the script adds it; with the Site URL
  right it isn't strictly needed, and `--check` asks for it only when the Site URL is wrong). The
  script keeps entries already there.
  Every entry is a place Supabase will send sign-in tokens, so list only hosts you control. Don't add
  a wildcard such as `https://nevermore-*.vercel.app/**`: anyone can name a Vercel project to match
  it. A sign-up on a preview deployment needs no entry: its 6-digit code works there, and its link
  confirms on the production site instead.
- **Confirm signup** template (Authentication → Emails): a 6-digit `{{ .Token }}`, which the sign-up
  page accepts, and a link to `{{ .RedirectTo }}#token_hash={{ .TokenHash }}&type=email`, which
  confirms only when the person clicks **Confirm my email**. `{{ .RedirectTo }}` is the callback
  address the app asked for when Supabase allows it (otherwise the Site URL), so the link keeps where
  the person was headed. The token rides in the fragment, which never reaches a server. Supabase's
  default links straight to its verify endpoint and works once, so a mail scanner (Microsoft
  Defender Safe Links, Mimecast, Proofpoint) that opens it first uses it up. The script replaces a
  template that still uses `{{ .ConfirmationURL }}`; the text it installs is
  `SIGNUP_CONFIRM_TEMPLATE` in `scripts/supabase-setup-lib.mjs`, to paste by hand.
- **Change email address** template: the 6-digit `{{ .Token }}` a guest types to certify.
- **Magic link** template: the 6-digit `{{ .Token }}` a returning prospect types to get back to an intake
  from another browser (`RecoverIntake`). The text the script installs is `SIGN_IN_CODE_TEMPLATE`.

Deploy the front end with `/auth/callback` before installing the sign-up template: an older
front end ignores the token in the link.

### The Resend key

A wrong `RESEND_API_KEY` breaks every email at once: Supabase Auth answers a code request with 500
("Error sending email change email", the 2026-11-05 QA outage), and the advisor alerts and
confirmations fail in `dispatch-outbox`. So before changing anything the script sends Resend an
empty email with the key. Resend refuses an empty email only after reading the key, so nothing is
sent: 422 (or 400) means the key works; 401 or 403 means Resend refused it, and the run stops with
nothing changed. Anything else (no answer, a rate limit) is printed as a warning and the run goes on.
`--check` tries the key in the secrets file the same way ("Resend key").

The same key is Supabase Auth's SMTP password, so the script sets it there on every run (Supabase
doesn't return the stored password to compare; when it does, the script says whether it matched).
If it can't set it (no `EMAIL_FROM`), it reminds you the SMTP password must be the same key. After
rotating the key in Resend, rerun the script so both copies change together.

A value with a space in it stops the run before anything else: the file has no comments after a
value, so `RESEND_API_KEY=re_... # prod` would be stored whole and refused on every call. The same
goes for any other `*_API_KEY`, `*_SECRET` or `*_TOKEN`.

Sign-in emails matter for submissions, not just convenience: a guest certifies only after confirming
an email with a 6-digit code, a returning prospect on another browser signs back in with one (the
magic-link template), and Supabase's built-in mailer only delivers to your own team's
addresses. With `RESEND_API_KEY` and `EMAIL_FROM` set, the script routes those emails through
Resend (`smtp.resend.com`). It leaves SMTP alone if another provider is already configured.

## Before you run it

1. **Node 20 or later** and the **Supabase CLI 3.x** (`brew install supabase/tap/supabase`, or see
   the CLI docs for other systems; 2.x still works). To use a CLI installed some other way, point
   `SETUP_SUPABASE_BIN` at it. The script reads the version and uses the flags that version needs:
   CLI 3 pushes to the local database unless told `--remote`, and refuses a change to a hosted
   project in a non-interactive run without `--yes`. The script asks once (the project ref typed
   back, or its own `--yes`), then passes `--yes` to each CLI call, so the run finishes unattended.
2. **Docker, running.** `supabase functions deploy` bundles the functions with it. Without Docker the
   CLI falls back to Supabase's server-side bundler, which can't fetch `document-extract`'s SheetJS
   import from `cdn.sheetjs.com`, so the script checks `docker info` first and stops, with nothing
   changed, if Docker isn't running. (Vendoring SheetJS into `supabase/functions/document-extract`
   would remove the need: the exact `xlsx-0.20.3` build checked in, and `read.ts` pointed at it. Not
   done yet.) To use a Docker installed some other way, point `SETUP_DOCKER_BIN` at it.
3. **A personal access token**: Supabase dashboard → Account → Access Tokens. Open the dashboard
   from Vercel (Storage → the Supabase store → Open in Supabase) if you signed up through Vercel.
4. **The database password.** The CLI may ask for it when linking or pushing. The Vercel integration stored it as
   `POSTGRES_PASSWORD` (Vercel → Project → Settings → Environment Variables); or reset it in the
   Supabase dashboard (Project Settings → Database). Set `SUPABASE_DB_PASSWORD` to skip the prompt.
5. **The secrets file:**

   ```sh
   cp supabase/env.production.example supabase/.env.production
   ```

   Fill it in. `supabase/.env.production` is git-ignored. Required: `ANTHROPIC_API_KEY` (Anthropic
   is the only AI provider, decision D11; `AI_PROVIDER` may stay empty or say `anthropic`, and
   anything else stops the setup) and `APP_BASE_URL`. Needed to accept submissions: the email
   settings, with `EMAIL_FROM` on a domain verified in Resend. A `LOVABLE_API_KEY` left in the file
   from before is unused: the setup warns, and you can delete it here and from the project
   (`supabase secrets unset LOVABLE_API_KEY`). `--check` fails a project whose secrets don't hold
   `ANTHROPIC_API_KEY`, so a project still set up for the old Lovable gateway is caught before
   Lenore and document reading go unavailable.

## Run it

```sh
read -rs SUPABASE_ACCESS_TOKEN && export SUPABASE_ACCESS_TOKEN   # paste the token; it isn't echoed
npm run setup:supabase -- --project-ref dvfwrjpkltqdkfudbahe
```

It shows the project's name and status, the CLI version and whether Resend accepted the key, asks you
to type the project ref back, then runs each step, prints a summary and the checks:

```
→ Summary
  Migrations applied: 2 (20261104133000_queue_hides_empty_guest_drafts.sql, ...)
  Secrets set (names only): 9 (ADVISORY_NOTIFY_EMAIL, APP_BASE_URL, EMAIL_FROM, ...)
  Functions deployed: 8 (chamber-extract, document-upload, document-extract, ...)

→ Checking the project
  ✓ Migrations applied: N of N   (N = the files in supabase/migrations)
  ✓ Guest (anonymous) sign-in: anonymous_users=true
  ✓ Email links return to the site: Site URL https://nevermorepeo.com, redirects allowed under it
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
4. **Email volume.** Supabase caps how many auth emails the whole project sends an hour
   (Authentication → Rate Limits): every sign-up confirmation, sign-in or certify code and resend counts,
   and every prospect shares it. With custom SMTP the script raises it to at least 100 an hour
   (`MIN_AUTH_EMAILS_PER_HOUR` in `scripts/supabase-setup-lib.mjs`) and never lowers a higher figure you
   set; `--check` lists "Sign-in email limit" as a to-do while it is lower. Raise it further there if a
   launch brings many prospects at once. On Supabase's built-in mailer the script leaves it alone, so set
   up SMTP first. The Resend plan has its own quota, which these emails and the notification emails share.
5. **The plan.** A Free project pauses after a week without activity and has no downloadable
   backups. Move to Pro before relying on it.

## Moving to a new domain or Vercel project

The front end reads the site's address from the browser (`window.location.origin`), so no code changes.
The settings around it do, and a new Vercel project starts with none of the old project's environment
variables.

1. **Vercel environment variables.** The new project needs the Supabase URL and publishable key for
   Production and Preview: connect the Supabase integration to it (it sets `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, which `vite.config.ts` falls back to), or set
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` by hand. Without them a site is a blank page:
   `src/integrations/supabase/client.ts` throws `supabaseUrl is required.` when it loads. A Vercel build
   without them stops with a message naming what is missing (`vite.config.ts`, `scripts/buildEnv.ts`), so
   it never replaces a working deployment; a build elsewhere (CI, your machine) still succeeds. Vite reads
   the values at build time, so redeploy after setting them.
2. **Deployment Protection.** Settings → Deployment Protection. Vercel Authentication puts a Vercel
   sign-in in front of every address it covers, and prospects have no Vercel account. Open the production
   domain in a private window and confirm the site loads.
3. **`APP_BASE_URL`** in `supabase/.env.production`: the new origin, no path. It builds the link in the
   advisor alert email, so until it changes the alert links to the old address.
4. **Auth Site URL and Redirect URLs.** Rerun `npm run setup:supabase -- --project-ref <ref>`: it sets the
   Site URL to `APP_BASE_URL`, adds `<origin>/**` to the Redirect URLs, and re-sets the function secrets.
   `--check` compares the Site URL with `APP_BASE_URL`. Until it is done, sign-up and sign-in emails link
   to the old address. The script keeps entries already on the Redirect URLs list, so remove the old
   address there yourself once nothing uses it.
5. **Try a real intake** on the new address (see "After it passes"): the sign-up email, the 6-digit code
   and the advisor alert should all point at the new domain.

Sessions are stored per address, so anyone signed in on the old address signs in again on the new one.

## Reruns

A rerun applies new migrations (the summary names only those), sets the secrets again (an existing `IP_HASH_SECRET` is kept),
redeploys the functions, re-sends the Resend SMTP settings (so a rotated key is picked up), replaces
the Vault copy of the service-role key and re-creates each schedule under the same name. It doesn't
remove redirect URLs or replace an email template that already sends the code (for sign-up: the
code and an app link, with no `{{ .ConfirmationURL }}`). A project set up
before the sign-in code existed fails `--check` on "Sign-in code message" until a rerun (or the
dashboard) puts `{{ .Token }}` in the magic-link template.

## Migration versions

`supabase db push` records each migration by the number before the first underscore in its file name.
Two files with one number can't both be applied: the push applies the first, fails on the second, and
applies nothing after it. Every file therefore has its own number, and `src/data/migrations.test.ts`
fails CI when two share one.

Two pairs once shared a number. The second file of each was renumbered (2026-11-03), keeping the order
they always ran in:

| Was | Now |
| --- | --- |
| `20261027090000_outbox_operations.sql` | `20261027090001_outbox_operations.sql` |
| `20261103110000_document_storage_path.sql` | `20261103110001_document_storage_path.sql` |

A project pushed with the old names has the first file of each pair recorded under the shared number and
the second never applied, along with everything after it. Before pushing again, list what is recorded:

```sh
supabase migration list --linked
```

- `20261027090001` and `20261103110001` show as not applied, and the project was only ever updated with
  `supabase db push` (this script): push. They run now, followed by everything the failed push left out.
- Either was applied some other way (the SQL editor, for example): neither is safe to run twice, so mark
  it applied before pushing. `outbox_operations` ran if the index `public.outbox_events_status_created_idx`
  exists; `document_storage_path` ran if the policy "Users can insert documents into their own sessions"
  on `public.documents` checks `storage_path`.

  ```sh
  supabase migration repair --status applied 20261027090001 --linked
  supabase migration repair --status applied 20261103110001 --linked
  ```

Two fixes renumbered the same two files at once, the other choosing `20261027090100` and
`20261103110100`. For a few minutes on 2026-11-03 `main` held both copies of each, and a push from then
applied `20261027090001`, then stopped on the second copy (`column "claimed_at" of relation "outbox_events"
already exists`). Two later fixes each removed a different copy, which left neither in the folder until the
`…0001` copies were put back (2026-11-04). So:

- A project pushed from `main` before that gap has `20261027090001` and `20261103110001` recorded: push.
- A project first pushed during the gap has later migrations recorded and not these two, and `supabase db push`
  won't apply a file older than the last one recorded unless asked. Neither has run there, so push once with
  `supabase db push --include-all --linked`.
- Only a project pushed from the branch that used the other numbers has `20261027090100` or `20261103110100`
  in `supabase migration list --linked`. Record it under the number that stays, then push:

```sh
supabase migration repair --status reverted 20261027090100 --linked
supabase migration repair --status applied 20261027090001 --linked
```

and the same for `20261103110100` and `20261103110001`.

`20261104100000` was also shared for a time (2026-11-04), by `certification_conflicts` and
`required_items`; `required_items` is now `20261104103000`, after `one_open_draft`. A project that recorded
`20261104100000` ran only one of the two. Check which before pushing: `certification_conflicts` ran if the
function `public.intake_conflicting_required` exists, `required_items` if `public.intake_required_items`
exists. If `required_items` ran, mark it applied (`supabase migration repair --status applied 20261104103000
--linked`), then push. If `certification_conflicts` didn't run, apply that file in the SQL editor before
pushing (`20261104100000` stays recorded); it only replaces functions, so it is safe to run.

`src/data/migrations.test.ts` fails CI when two files share a number, or when a migration is in the folder
twice, under one name or with the same SQL.

## If a step fails

- **`supabase link` or `db push`:** usually the database password. A failed `db push` stops
  before anything else changes.
- **`db push` stops with `duplicate key value violates unique constraint "schema_migrations_pkey"`:**
  two migration files share a version, the number before the first `_`. The CLI records a migration
  by that number, so the second file is never applied. Give it a later, unused version that keeps its
  place in the order, then run the script again: what was applied stays applied and the rest goes in.
  `src/data/migrations.test.ts` fails on a shared version, so `npm test` catches one before it merges.
- **Deploying a function asks for Docker:** recent CLIs bundle on Supabase's side; update the CLI,
  or run `supabase functions deploy <name> --use-api --project-ref <ref>` and rerun the script.
- **"Reading the auth settings failed":** the script stops rather than guess, because a patch built
  without the current settings would replace the Redirect URLs list. Nothing was changed.
- **Auth settings or the schedule:** the script calls the Management API endpoints listed above.
  If one is refused, make the same change in the dashboard (the table's last column) and rerun
  with `--check`.
- **"Couldn't read the project's legacy service_role key":** `dispatch-outbox`, `purge-intakes` and
  `ops-monitor` authenticate the schedule with the legacy JWT service-role key. Re-enable legacy API
  keys (Project Settings → API Keys) and rerun.

## If sign-up confirmation links fail

What the person sees after clicking the link tells you which setting is wrong:

- **The browser's "can't reach this site" or "localhost refused to connect" page:** the Site URL is
  still `http://localhost:3000` and the site isn't on Redirect URLs. Fix the URL Configuration above.
  With Supabase's default email, Supabase confirmed the account before redirecting, so the person can
  sign in at `/login` with their password now. With the sign-up template above installed, nothing
  was confirmed: the person signs in at `/login` and enters the 6-digit code from the email.
- **Another site's home page:** the Site URL points at another domain (an old Lovable preview, say).
  Fix it as above.
- **"This link didn't work" on `/auth/callback`:** the link was used, expired (after an hour by
  default) or replaced by a newer email. With Supabase's default email a mail scanner may have used
  it, which also confirms the account, so signing in usually works; otherwise the page sends a new
  email. Installing the sign-up template above stops scanners using the links up.

`npm run setup:supabase -- --project-ref <ref>` sets all of it; `--check` confirms it.

## If sign-up or a sign-in code answers 429

A `429 Too Many Requests` from `/auth/v1/signup`, `/auth/v1/user` (certify code) or `/auth/v1/otp` (sign-in
code) is Supabase Auth refusing the request, not Resend. Open the failed request's response (or Logs →
Auth in the dashboard) and read `error_code`:

- **`over_email_send_rate_limit`, "email rate limit exceeded":** the project's hourly cap on auth emails
  is used up, for everyone. Raise it (Authentication → Rate Limits), or run the setup again to bring it to
  the floor above. On Supabase's built-in mailer the cap is tiny and only your team's addresses get
  emails: set up custom SMTP first (`--check` shows "Sign-in emails reach prospects").
- **`over_email_send_rate_limit`, "you can only request this after 60 seconds":** that one address was
  emailed a moment ago. It clears itself; the app tells the person to wait a minute.
- **`over_request_rate_limit`, "Request rate limit reached":** too many sign-ups or sign-ins from one
  network (repeated testing, or a whole office behind one address). Wait a few minutes, or raise the
  per-IP limits on the same page.

The app words each of these differently (`src/data/authRateLimit.ts`), so a person is never told to
"check the address" for a limit. If email is going out but Resend refuses it, that is a different path:
the notification outbox shows `rate_limited:429` on the event (docs/NOTIFICATIONS.md).
