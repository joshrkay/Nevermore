# Submission notifications

When a prospect certifies an intake (which submits it), two emails are queued in the same database
transaction and sent by the `dispatch-outbox` edge function:

| Email | To | Contains |
|---|---|---|
| Advisor alert (G-1) | `ADVISORY_NOTIFY_EMAIL` | Company legal name, primary signer, title, work email, phone, employee count, HQ state, submission reference, when it was certified (UTC), link to the secure advisor review. Subject `New Intake Certified: <company> (<reference>)`, or `Updated Intake: ...` when changed answers were certified again |
| Prospect confirmation (G-2) | The signed-in account's own email | Company, reference, what happens next, expected response time, support address |

Neither email contains census, payroll, benefits or document content. Every listed detail is always shown on the advisor alert, as "Not provided" when empty, so a blank is never mistaken for an omission. The email is a complete HTML document (title, phone-width layout, row headers for the details) with a plain-text twin. The queue row itself never
holds them: `enqueue_certification_notifications()` (which the trigger calls) copies only named
fields, and the email builders read only named fields back out
(`supabase/functions/dispatch-outbox/messages.ts`). While an event is being retried it also holds
the email exactly as it will be sent (`pending_send`: the same fields, nothing more); that copy is
cleared once the event is sent.

## How it works

```
certify (UPDATE chamber_sessions) ──► chamber_certifications row
                                         └─ trigger ─► outbox_events (one per kind) + marks the certification queued ◄── same transaction
browser, right after a confirmed submit ─► dispatch-outbox ─┐   (sends and retries only)
schedule, every minute (retries, healing, reaping) ─────────┘
   scheduled runs only: reap lost claims ─► queue what the trigger missed ─► say why a blocked kind is waiting
   claim due events (status claimed, 10 minute lease) ─► freeze the email ─► send via provider ─► mark sent │ retry later │ dead after 5 attempts
                                                                                            dead ─► log OUTBOX_DEAD + push to ENGINEERING_ALERT_WEBHOOK_URL
advisors: /advisor/outbox shows every event and retries a dead one (advisor_requeue_outbox_event)
```

An event is `pending` (waiting to be sent, or waiting out a retry delay), `claimed` (a worker has it: `claimed_at` says since when, `locked_until` is when the claim lapses), `sent`, `dead`, or `suppressed` (not sent: its address bounced for good or reported an email as spam; see "Bounces and complaints"). A claim lasts 10 minutes. A worker that has not recorded an outcome by then is lost: the next claim takes the event over (with its frozen message, so the same idempotency key), and `reap_outbox_events` marks it dead once every attempt is used.

- **A send failure never undoes a submission.** The submission commits first; sending happens later.
  A fault in the queueing code can never block a submission either: the trigger catches it, logs a
  warning and records the failure on the certification. The submission stands and a later scheduled
  run queues the notifications, after a short backoff (2 minutes for the first failure; see "A
  certification that was never queued"). A cancelled query, such as a statement timeout, is not a
  fault the trigger can catch.
- **Delivery is at least once, not exactly once.** See "Delivery guarantee" for how repeats are
  suppressed and when one can still get through.
- **No uncontrolled duplicates.** Events are unique per kind and per `(session, hash of the certified
  data)`. The client retrying a submit (which records another certification) queues nothing new
  while the first one's queue rows exist: delete them and a later retry queues both again, and its
  alert is not flagged as an update. Certifying *changed* answers again is a new submission: the
  advisor alert says "Updated intake".
- **Retries:** after failed attempts 1, 2, 3, 4 the event waits 1 min, 5 min, 30 min, 2 h. The 5th
  failure marks it `dead`. Each failure increments `attempts`, sets `next_attempt_at` and records why in `last_error`: the failure kind (`provider_error:503`, `auth:403`, `timeout`) and, when the provider explained itself, its explanation in brackets, e.g. `auth:403 (validation_error: The mail.example.com domain is not verified.)`. The explanation is the provider's JSON `name` and `message` only, with anything address-shaped replaced by `[email]` and key-like strings by `[redacted]`, capped at 140 characters. The raw response body is never stored, and the explanation is never logged.
- **The prospect confirmation goes to the account's own address**, never to an address typed into
  the intake. Keep Supabase Auth's "Confirm email" enabled in production. Accounts with no email
  (none can certify today) get the advisor alert only.

## Delivery guarantee

Delivery is **at least once**, with best-effort de-duplication by the provider inside its idempotency
window (Resend honours a key for 24 hours).

Before an event's first send, the email and its idempotency key are written to the event
(`pending_send`). Every retry sends that same message under that same key, even if a setting changed
in between, so a retry after a timeout or an error that may have been delivered is recognised by the
provider as a repeat. The frozen message is dropped, and the next attempt rebuilds the email from the
current settings under a new key, only when the provider proves nothing was sent: it answered the
first send with 400, 401, 403, 404, 405, 413, 422 or 429. Every other outcome may follow an accepted
message (a timeout, a network error, a redirect, any 5xx, 408, 409, 425, any other 4xx), so the
message and key stay. A refusal of a later retry does not drop them either: the earlier attempt may
have been delivered.

A duplicate can still get through when the provider cannot recognise the repeat:

- **More than 20 hours after the message was frozen.** An older freeze is rebuilt under a new key,
  because the provider's window is 24 hours.
- **Switching `RESEND_API_KEY` to another provider account** (or another provider) while events with a
  frozen message exist. The new account has never seen the key.
- **A rebuild requeue** (`requeue_outbox_event('<id>', true)`) of an event that may have been
  delivered: it gets a new key.
- **Once, when this change ships.** Events already in flight with attempts above 0 have no frozen
  message; their next attempt freezes a new one under a new key, so an earlier attempt that was
  delivered but not recorded can be sent again. Accepted before launch.

## Setup (function secrets)

Set with `supabase secrets set` or the dashboard. Secrets never go in `VITE_*` variables.

| Secret | Needed for | Notes |
|---|---|---|
| `RESEND_API_KEY` | both | Provider key. `EMAIL_PROVIDER` defaults to `resend`; to switch provider, add an adapter in `providers.ts`. |
| `EMAIL_FROM` | both | e.g. `Edgar Allan Advisory <intake@mail.example.com>`. **Must be on a domain verified with the provider (SPF and DKIM)**; no default on purpose. |
| `ADVISORY_NOTIFY_EMAIL` | advisor alert | The advisory distribution list. Comma-separated for several. |
| `APP_BASE_URL` | advisor alert | e.g. `https://app.example.com`. https only (http allowed for localhost). Builds the `/advisor/submissions/<id>` link. |
| `SUPPORT_EMAIL` | prospect | Shown in the email and used as Reply-To. |
| `PROSPECT_RESPONSE_TIME` | prospect | A phrase that follows "within", e.g. `2 business days`. This is a commitment shown to every prospect, so there is no default. |
| `RESEND_WEBHOOK_SECRET` | bounces | The signing secret (`whsec_...`) of the Resend webhook that points at the `resend-webhook` function (see "Bounces and complaints"). Sending works without it; bounces and complaints are then not processed and a bounced address is mailed again. |
| `ENGINEERING_ALERT_WEBHOOK_URL` | optional | An https URL (Slack-style incoming webhook: it reads a `text` field; the same facts also arrive as JSON fields). Called when an event goes `dead`, with the event id, kind, attempt count and failure kind only: no addresses, names or message content. Unset means log only. One that is set but is not an https URL is logged as `OUTBOX_CONFIG_MISSING`. |

A kind whose settings are incomplete is **not sent**: its events stay queued, no attempts are spent,
and `OUTBOX_CONFIG_MISSING` is logged naming the missing setting (never its value). Each of that kind's pending events also says so itself, in `last_error` (`not_configured: ADVISORY_NOTIFY_EMAIL is not set to valid address(es)`), so an advisor on the Outbox page sees why it is not moving; the scheduled run writes that, a browser's nudge does not, and a send clears it. Completing the
settings releases the queue, including older events, so clear test submissions first:
`delete from public.outbox_events where status = 'pending';` Deleting queue rows only cancels those
emails: the scheduled sweep never queues them again (only a new certification, such as a client
resubmitting the same answers after the rows are gone, does).

### Changing a setting later

An email is built from the settings when its event is first tried, then frozen. A change applies to
events not yet tried, to events whose first send the provider refused outright (the usual wrong
sender: fix `EMAIL_FROM` and the next retry uses it), and to events frozen more than 20 hours ago.
It does not apply to an event that already had an ambiguous attempt: its retries keep the old sender,
recipient and link. Once that event is dead, `select public.requeue_outbox_event('<event id>', true);`
rebuilds it from the current settings (read "Dead events" first: a rebuild uses a new key). In the
log, `msg=frozen` says an attempt reused an earlier message, `msg=fresh` that it was built from the
current settings.

### Deploy order

Apply `supabase/migrations/20261026090000_outbox_reliability.sql` **before** deploying the function.
The migration drops the old three-argument `fail_outbox_event`, so the previous function cannot
record a failure once it is in: until the new function is deployed, failed sends are not recorded
(`OUTBOX_RECORD_FAILED`) and retry when their claim lapses; successful sends still record. An event
that spends its fifth attempt that way stays `sending` (`claimed` once the operations migration below is in) until the new function's first scheduled run
marks it dead (`reason=worker_lost`): requeue it. In the other order nothing is sent: every attempt
fails as `freeze_failed` (the function it calls does not exist yet), and since that failure cannot be
recorded either, each lapsed claim spends an attempt, so events can die. Requeue any that did.
Sending resumes as soon as the migration is applied and PostgREST has reloaded its schema (hosted
Supabase does that by itself; anywhere else run `notify pgrst, 'reload schema'`).

Apply the migration as one transaction (`psql --single-transaction -v ON_ERROR_STOP=1 -f ...`). It
gives up after 3 seconds of waiting for a table lock instead of stalling submissions behind it. If it
stops with `canceling statement due to lock timeout`, a long transaction was holding the table: run it
again once that has finished. Applied statement by statement instead, a failure part-way leaves the
earlier changes in place and a rerun then fails on them.

Then apply `supabase/migrations/20261027095000_outbox_operations.sql`, again before deploying the function (it calls `note_outbox_config_problem`). Either order is safe, because nothing in it blocks sending. The new function against the old schema logs `OUTBOX_NOTE_ERROR` with `PGRST202` each scheduled run and otherwise works, so no waiting event is told why it is blocked until the migration lands. The old function against the new schema works too, with the 10 minute claim lease. The migration renames the status `sending` to `claimed` (existing in-flight rows are converted), adds `claimed_at`, the requeue audit columns, and the advisor functions. Apply it as one transaction, like the reliability one; it also gives up after 3 seconds waiting for a table lock.

Then apply `supabase/migrations/20261028090000_email_delivery_events.sql` (bounces and suppression), before deploying `resend-webhook`. It replaces `claim_outbox_events` (which now holds back suppressed addresses), adds the `suppressed` status and the two tables, and replaces the two advisor outbox functions so they know the new status. `resend-webhook` deployed first answers 500 to every delivery until the migration lands, which makes the provider retry, so nothing is lost either way.

Then apply `supabase/migrations/20261030090000_outbox_census_headcount.sql` and `supabase/migrations/20261030091000_email_delivery_hardening.sql`, in that order. Both only add or replace functions (no table changes, grants carry over), so each is safe to apply with the app running. The first makes the advisor alert's headcount read the census (the intake's roster key since the census work; the older `employees` roster is still the fallback). The second holds back confirmations whose claim has lapsed, refuses a claimed confirmation to a suppressed address at the freeze, adds `lift_email_suppression`, makes `advisor_email_problems()` follow the latest confirmation (with `not_delivered`), and strengthens the stored-detail redaction. Apply each as one transaction, as above.

A note on version numbers: `outbox_operations` is `20261027095000` because `20261027090000` was already taken by `intake_validation_and_versioning`, and two migrations cannot share a version. The file's content is unchanged. If a database ever recorded it under the first version, mark that version reverted and the new one applied with `supabase migration repair` rather than running it a second time.

### Schedule (required)

The browser nudges the function right after a submit, but a closed tab, a provider outage or a retry
all need a scheduler, and so does healing: **only scheduled runs queue what the trigger missed and
reap lost claims**, never a browser's nudge. Run the function every minute with the service-role key
(a run with nothing to do is a few cheap queries). `scripts/supabase-setup.mjs` sets this up
(`docs/SUPABASE_SETUP.md`); by hand, with `pg_cron` and `pg_net`:

```sql
select cron.schedule('dispatch-outbox', '* * * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/dispatch-outbox',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
$$);
```

`supabase/migrations/20261027100000_outbox_schedule.sql` creates the same job for you where `pg_cron` and `pg_net` can be had and no `dispatch-outbox` job exists yet. It reads the project URL and the key from Vault on every run (secrets `project_url`, the project's `https://<ref>.supabase.co`, and `service_role_key`) and does nothing, quietly, until both exist:

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<service role key>', 'service_role_key');
```

An existing job is never replaced by the migration: `scripts/supabase-setup.mjs` schedules one on the project's own URL, and that one stays. Without `pg_cron` the migration logs a notice and does nothing; it never fails the deploy. Check with `select jobname, schedule from cron.job;`.

Any scheduler that can send that request works, and overlapping runs are safe (claims use `FOR UPDATE SKIP LOCKED`). Callers other than the
service role must be signed-in, non-guest users; they get the queue worked (sends and retries) and
counts back, nothing more. A scheduled run's response also carries `reconciled`
(`healed`, `failed`, `unqueued`) and `reaped`.

## Operating

Failures are logged by the function (Supabase function logs) and recorded on the row. Only
`OUTBOX_SENT` is logged at info level and `OUTBOX_RECONCILED` as a warning; everything else is an
error line. Alert on these:

| Log line | Meaning | Action |
|---|---|---|
| `OUTBOX_DEAD` | An event is out of attempts or can never succeed, or its worker was lost with every attempt used (`reason=worker_lost`: no email had been frozen yet; `worker_lost_maybe_sent`: one was frozen and may have gone out). Also pushed to `ENGINEERING_ALERT_WEBHOOK_URL` when set | Find the cause (the event's `last_error` on the Outbox page says what the provider answered), fix it, retry it there |
| `OUTBOX_ALERT_FAILED` | An event died but the alert webhook did not take the push (refused, unreachable, over 5 seconds) | Check the webhook; the `OUTBOX_DEAD` line above it is the alert |
| `WEBHOOK_ADVISOR_BOUNCE` | A notification to the advisory team bounced or was refused. The address is deliberately **not** suppressed (silently dropping the team's alerts would be worse), so a person has to look | Check that mailbox, or fix `ADVISORY_NOTIFY_EMAIL` |
| `WEBHOOK_RECORD_FAILED` | The webhook could not record an event (a PostgREST code follows; `PGRST202` or `42883` means the bounce migration is not applied). It answered 500, so the provider retries | Check the database |
| `WEBHOOK_CONFIG_MISSING` | `RESEND_WEBHOOK_SECRET` is not set, or is not a `whsec_` secret: bounces and complaints are not processed (it answers 503, and the provider retries for a while) | Set it |
| `WEBHOOK_REJECTED`, `WEBHOOK_UNUSABLE` | A request with no valid signature (scanners, a wrong secret, a clock off by 5 minutes), or a signed event with no recipient. Warnings, not alerts | None unless it floods, or `reason=no_match` follows a secret you rotated |
| `OUTBOX_NOTE_ERROR` | Writing why a blocked kind is waiting failed (a PostgREST code follows; `PGRST202` means the operations migration is not applied). Sending went on | Check the database |
| `OUTBOX_ENQUEUE_FAILED` | `unqueued=K oldest_age_s=S last_sqlstate=X`: K active certifications have no notifications. Logged on every scheduled run until they are queued. One line that is gone on the next run is benign: a run that overlaps another queueing that certification at that moment can report it | See "A certification that was never queued" |
| `OUTBOX_RECONCILED` | The run queued notifications for certifications the trigger had failed to queue (a warning, not a failure) | Find out why the trigger failed |
| `OUTBOX_SEND_FAILED` | One attempt failed; retry scheduled | None unless it repeats |
| `OUTBOX_CONFIG_MISSING` | A kind is not being sent | Finish setup |
| `OUTBOX_RECORD_FAILED` | Sent or failed, but the database write failed | Check the database; the event retries when its claim lapses, with the same frozen message |
| `OUTBOX_RECONCILE_ERROR`, `OUTBOX_REAP_ERROR` | The housekeeping call at the start of a scheduled run failed or took over 10 seconds; sending went on. Followed by a short code: a PostgREST one, `timeout`, `unknown` or `malformed_result` | Check the database; `PGRST202` means the migration is not applied |
| `OUTBOX_DISPATCH_ERROR` | The run itself failed | Check logs |

Log lines carry event ids, counters and failure kinds only: no addresses, names or message bodies,
and the housekeeping lines carry a code, never database error text. The provider's own explanation never appears in a log line, only in the event's `last_error`. `reason` is `timeout`, `network`,
`rate_limited:429`, `auth:401|403` (bad key, or sender domain not verified), `provider_error:<status>`,
`invalid_payload`, `not_configured` or `freeze_failed` (the email could not be written to the event,
so nothing was sent).

```sql
-- Queue health
select kind, status, count(*) from public.outbox_events group by 1, 2;

-- Stuck work. oldest_due_wait keeps growing when nothing is working the queue (the schedule is down,
-- or a kind's settings are incomplete). lapsed_claims are sends whose worker died; those with
-- awaiting_reap are out of attempts and stay `claimed` until a scheduled run reaps them.
select (select now() - min(next_attempt_at) from public.outbox_events
        where status = 'pending' and next_attempt_at <= now()) as oldest_due_wait,
       count(*) filter (where status = 'claimed' and locked_until < now()) as lapsed_claims,
       count(*) filter (where status = 'claimed' and locked_until < now() and attempts >= 5) as awaiting_reap
from public.outbox_events;
```

`outbox_events` is service-role only (no client, prospect or advisor access). Advisors reach it only through the functions below, which return a projection (never the payload or the email) and check the role first.

### Outbox & Notifications (advisors, G-1.3)

`/advisor/outbox` (the "Outbox & Notifications" link in the advisor header) lists every event, newest first, with its kind, company and reference, status (`pending`, `claimed`, `sent`, `dead`, `suppressed`), attempts out of 5, when it was or will be sent, and `last_error` with a plain-language reading beside the recorded text. Tabs filter by status and show counts; the filter is in the URL. A banner appears when the longest-waiting due event has waited 10 minutes or more: nothing is working the queue (the schedule is down, or a setting is missing). A claim past its lease is marked "Claim lapsed".

A dead event has **Retry send**: one click puts it back (`attempts = 0`, `status = 'pending'`, `next_attempt_at = now()`) and the next run sends it, the same email under the same idempotency key. When an email had already been written for it (it may have been delivered), a separate **Rebuild and retry…** discards that email and builds a new one from the current settings under a new key; the dialog says it sends a second copy if the first was delivered. Only dead events can be retried; a second click returns false and changes nothing.

The database functions, all for signed-in advisors and admins (`public.is_advisor()`, i.e. `user_roles`); anyone else gets `42501`, which PostgREST sends as HTTP 403:

| Function | |
|---|---|
| `advisor_list_outbox_events(p_status, p_limit)` | The list. `p_status` is one of the five statuses (`pending`, `claimed`, `sent`, `dead`, `suppressed`) or null; `p_limit` 1 to 500, default 100 |
| `advisor_outbox_summary()` | One row per status with its count, and how long the longest-waiting due pending event has waited |
| `advisor_requeue_outbox_event(event_id, rebuild_payload)` | The retry. `rebuild_payload` drops the email already written, so it is rebuilt from the stored payload and the current settings under a new key. The payload is the summary taken when the intake was certified and is deliberately not re-read from live data. Returns whether it requeued |

Who retried, when and how often is recorded on the event (`last_requeued_by`, `last_requeued_at`, `requeue_count`).

### Bounces and complaints (G-2.2)

Resend tells the product what became of a message by webhook. The `resend-webhook` function checks the request's signature, records the event, and, for a bounce that cannot be retried or a spam complaint, stops the product emailing that address again.

**Setup.** In the Resend dashboard add a webhook to `https://<project-ref>.supabase.co/functions/v1/resend-webhook`, subscribed to `email.bounced`, `email.complained`, `email.delivery_delayed`, `email.failed` and `email.suppressed`, and copy its signing secret (`whsec_...`) into the `RESEND_WEBHOOK_SECRET` function secret. The function has the gateway's JWT check turned off (`supabase/config.toml`): Resend holds no Supabase login, and the signature is what proves a request is Resend's. Resend signs through Svix (the setup checks the function with a request that carries no Supabase credentials, as Resend calls it, so a project still rejecting it at the gateway shows as failed): HMAC-SHA256 over `<svix-id>.<svix-timestamp>.<raw body>`, in `svix-signature` as `v1,<base64>` (several, space-separated, while a secret rotates), and a timestamp more than 5 minutes from now is refused.

| Event | What happens |
|---|---|
| `email.bounced`, type `Permanent` | The address is suppressed (`bounced`) |
| `email.complained` | The address is suppressed (`complained`, the stronger reason: a later bounce does not weaken it) |
| `email.suppressed` | Resend already blocks the address: suppressed here too (`provider_suppressed`) |
| `email.bounced`, type `Transient` or `Undetermined`, and `email.failed` | Recorded; the address is **not** suppressed (it may be a full mailbox). If it was the submission's latest confirmation, advisors see "Email not delivered" on it |
| `email.delivery_delayed` | Recorded only: the provider is still trying |
| anything else (delivered, opened, contacts, domains...) | Acknowledged and dropped |

- **Idempotent.** The provider retries a delivery with the same `svix-id`; each is kept once (`email_delivery_events`), and a replay changes nothing. The function answers 200 to a replay, 401 to a bad signature (it never says why), and 500 when the database fails, so the provider retries.
- **A suppressed address is never emailed again.** The claim marks a due confirmation to it `suppressed` instead of handing it to the worker, so a re-certification, a retry or a requeue cannot send to it, and a confirmation already waiting is held back the moment the bounce is recorded. The same holds for a claim whose worker was lost (the next claim would take it over), and a claim in flight when the bounce arrives is refused at `freeze_outbox_message`, before anything is written for sending. The one window left is between an email being written and the provider accepting it: milliseconds, and the provider's own suppression list closes it. The Outbox page has a **Suppressed** tab showing why. Only the prospect's confirmation is held back: the email goes to the account's own address, and nobody else's.
- **A bounce flags the submission.** `advisor_email_problems()` lists the submissions whose confirmation bounced, was reported as spam, is blocked by the provider, or was reported undelivered; the advisor queue shows an "Email bounced" / "Reported as spam" / "Email blocked" / "Email not delivered" badge and the submission page a banner saying to reach the prospect another way. Only the submission's **latest** confirmation counts, so if the prospect changes their address and the new confirmation goes out, the flag clears by itself. It is read beside the queue, so a failure of that check never takes the queue down; the page then says the check did not run, and keeps any flags it already showed.
- **The advisory team is never suppressed.** `ADVISORY_NOTIFY_EMAIL` is protected, and so is any message the queue shows was sent to the team. A bounce on one is recorded as `protected` and logged as `WEBHOOK_ADVISOR_BOUNCE`.
- **Only what was emailed is suppressed.** Resend reports every recipient of a message; for a confirmation (one recipient) only the address the queue sent it to is suppressed. A message that is not in the queue at all (the sign-in codes go through the same Resend account) concerns the recipients as reported: those addresses are suppressed here, which only matters to the confirmations.
- **What is kept.** The event's type, the provider's message id, the recipients, the bounce type and the provider's explanation with every run of text around an `@` replaced (so a quoted or bracketed address goes whole, not just most of it) and key-like strings replaced, capped at 200 characters, and only the first 2,000 characters of the provider's text are looked at. The subject, sender, body and tags the provider sends are never read. Both tables hold email addresses and belong in the retention rule (D4), but not alike: `email_delivery_events` can be purged by age, while `email_suppressions` must **not** be (deleting a row lets that address be emailed again, which for a spam complaint is the one thing that must not happen), so an erasure request for an address needs a deliberate decision.

```sql
-- Who is suppressed, and why
select address, reason, event_count, created_at from public.email_suppressions order by created_at desc;

-- What the provider has told us lately (no message content is kept)
select type, outcome, bounce_type, detail, occurred_at from public.email_delivery_events order by received_at desc limit 50;

-- The prospect fixed their mailbox: let the address be emailed again. The second argument also puts
-- the confirmations that were held back for it back in the queue, due now (leave it false to only lift
-- the suppression: the held-back mail may be old). Returns how many it requeued. A new certification
-- with unchanged answers queues nothing new (the same data is one notification), which is why this exists.
select public.lift_email_suppression('person@example.com', true);
```

The signature scheme and the event fields were taken from the official `svix` and `resend` packages, and the verifier is tested against Svix's own signer. Check one real bounce end to end before launch (the checklist below).

### A certification that was never queued

The trigger that queues the emails is fenced, so a fault in it leaves the submission standing and
nothing queued. Whether a certification was queued is recorded on the certification, never inferred
from `outbox_events`: operators and retention delete those rows, and that must not send anything
again.

- `chamber_certifications.outbox_queued_at` is set in the transaction that queues the emails. An
  active certification (`superseded_at is null`) with it null was never queued.
- `outbox_failures`, `outbox_last_failed_at` and `outbox_last_sqlstate` record failed attempts to queue
  it: a count, a time and an SQLSTATE, never error text. They only pace the retries and name the
  cause; finding unqueued certifications never depends on them. They are readable by the
  certification's owner and by advisors, like the rest of the row.
- Every scheduled run first queues up to 25 unqueued active certifications, and sends what that
  queued in the same run. A certification that keeps failing is retried after 2, 4, 8 ... up to 60
  minutes, so a few bad rows cannot hold up the others. Superseded certifications are never queued:
  the newer certification carries the current data.
- The trigger's own warning, `enqueue_submission_notifications failed for certification <id>`, is in
  the Postgres logs. Its text is a database error message and can quote a fragment of row data.

```sql
-- Active certifications that were never queued (should be empty)
select id, session_id, recorded_at, outbox_failures, outbox_last_failed_at, outbox_last_sqlstate
from public.chamber_certifications
where superseded_at is null and outbox_queued_at is null
order by recorded_at;

-- Why one fails: run the queueing yourself from the SQL editor. It raises the real error; if it
-- succeeds it has queued the emails. Not callable by the service role or any client.
select public.enqueue_certification_notifications('<certification id>');

-- Dismiss one on purpose (no notification wanted)
update public.chamber_certifications set outbox_queued_at = now() where id = '<certification id>';

-- Queue one again: the next scheduled run does it (one that failed recently waits out its backoff).
-- It queues only what is missing: an email whose row still exists, sent or dead, is not queued twice,
-- so delete that row first to have it sent again.
update public.chamber_certifications set outbox_queued_at = null where id = '<certification id>';

-- Audit: active certifications with no queue rows. Expected for those from before the outbox
-- existed and for rows since deleted. It also lists any whose earlier trigger failed silently
-- before the reliability migration: that migration marked every earlier certification handled, so
-- they look the same. Review each before dismissing it, or run this before applying the migration
-- (leaving out `c.outbox_queued_at`) to see them apart.
select c.id, c.session_id, c.recorded_at, c.outbox_queued_at
from public.chamber_certifications c
where c.superseded_at is null
  and not exists (select 1 from public.outbox_events e
                  where e.session_id = c.session_id and e.dedupe_key = c.session_id::text || ':' || c.data_sha256)
order by c.recorded_at;
```

### Dead events

```sql
-- What died and why (payload and the frozen email hold recipient details, so they are left out)
select id, kind, session_id, attempts, last_error, created_at, pending_send is not null as frozen
from public.outbox_events where status = 'dead' order by created_at;
```

This is also the audit for an `OUTBOX_DEAD` line that never appeared. The reaper marks lost claims
dead and returns them in the same statement, so if that run's response was lost (the call timed out
after the database committed) the events are dead, `last_error` starts with `worker_lost`, and
nothing was logged.

A dead event with `frozen` true may already have been delivered: every outcome except a refusal of
its first send leaves the email frozen, and so does `worker_lost_maybe_sent`. Before requeueing it,
look in the provider's log for that message (by recipient and by time around `frozen_at`; the request
carried the key as its `Idempotency-Key`). Never select the whole `pending_send`: it holds names and
addresses.

```sql
select pending_send ->> 'key' as idempotency_key, pending_send ->> 'frozen_at' as frozen_at
from public.outbox_events where id = '<event id>';

-- Requeue after fixing the cause (advisors can do the same from the Outbox page). Same email, same
-- key: the provider de-duplicates it if it was delivered, but only if frozen_at (above) is under
-- 20 hours old. An older freeze is rebuilt from the
-- current settings under a new key, with the same risk of a second copy as the form below.
select public.requeue_outbox_event('<event id>');
-- Or rebuild it from the current settings under a new key (a changed sender, recipient or link).
-- If the old one was delivered, this sends a second copy.
select public.requeue_outbox_event('<event id>', true);
```

It returns true when it requeued and false when the event is not dead, and starts the attempts over.
The first form retries the same email even if the provider now refuses it outright (the frozen
message stays until the second form or 20 hours): use the second once the sender, recipient or link
has changed. Dead events are usually requeued a day or more later, so check `frozen_at` first.

To requeue every dead event that has nothing frozen (the ones whose provider log needs no checking):

```sql
select public.requeue_outbox_event(id) from public.outbox_events where status = 'dead' and pending_send is null;
```

Leave out the frozen ones until each has been checked against the provider's log, `worker_lost_maybe_sent`
included.

## Before public launch (G-2)

- [ ] Sender domain verified with the provider; a test email from `EMAIL_FROM` lands in a real inbox (not spam).
- [ ] `PROSPECT_RESPONSE_TIME` and `SUPPORT_EMAIL` agreed with the advisory lead.
- [ ] Supabase Auth "Confirm email" is on.
- [ ] The migration `20261026090000_outbox_reliability.sql` was applied before the function was deployed.
- [ ] The schedule above is running (`select jobname, schedule from cron.job;`, and both Vault secrets exist): it sends retries, queues what the trigger missed and reaps lost claims.
- [ ] The migration `20261027095000_outbox_operations.sql` was applied, and `ENGINEERING_ALERT_WEBHOOK_URL` points at a channel someone watches (kill the provider key in a test project and check the push arrives).
- [ ] An advisor has opened `/advisor/outbox` and retried a dead test event.
- [ ] The Resend webhook exists, points at `resend-webhook`, and `RESEND_WEBHOOK_SECRET` is set. Send a test confirmation to one of Resend's test addresses that simulates a bounce (their docs list them; this was not checked from the build environment, which cannot reach resend.com) and check that the address appears in `email_suppressions`, the submission shows "Email bounced" in the advisor queue, and a second confirmation to it is held back (`suppressed`).
- [ ] The unqueued-certifications query above returns no rows.
- [ ] Test submissions removed from `outbox_events`.
- [ ] `OUTBOX_DEAD`, `OUTBOX_ENQUEUE_FAILED`, `OUTBOX_RECONCILE_ERROR` and `OUTBOX_REAP_ERROR` have an
  alert (plan H-4.1). The last two matter most: when the sweep itself fails, a scheduled run's
  response still shows `reaped: 0` and `reconciled` all zeros, and `OUTBOX_ENQUEUE_FAILED` is never
  logged, so only those lines say that unqueued certifications are going unreported.

## Not covered here

- Retrying an event that is not dead (a `pending` one waiting out a delay will be tried by the schedule on its own; a `claimed` one is in a worker's hands) and re-reading an event's payload from live data on a retry.
- Lifting a suppression is SQL only (the recipe in "Bounces and complaints"); advisors can see that a prospect is unreachable but not clear it. A prospect who fixes their mailbox does not get the confirmation they missed unless an operator lifts the suppression with the requeue argument: a new certification queues a new confirmation only when the answers changed.
- Bounces of the sign-in codes (Supabase Auth sends them through the same Resend account) are recorded and suppress the address, but nothing tells the prospect or an advisor that the code did not arrive: the advisor flag is for submissions, which exist only after a code was entered.
- Unsubscribe links: these are transactional emails and carry none.
- Exactly-once delivery: see "Delivery guarantee" for the windows where a repeat can get through.
- Certifications from before the outbox existed were not queued; nothing is back-filled. Queue one on
  purpose with the recipe above.
- Queue rows keep the recipient's address after sending, and a dead event keeps its whole frozen
  email. Fold them into the retention rule (D4). Deleting them is safe.

## Tests

- `supabase/tests/submission_outbox.sql` (scratch Postgres only: it drops and recreates the `public`
  and `auth` schemas, which deletes real users, so never point it at a local or dev Supabase
  database or one you care about):
  `psql -v ON_ERROR_STOP=1 -f supabase/tests/submission_outbox.sql`. It loads the original outbox
  migration, certifies under the old trigger, then loads the reliability migration to prove the
  upgrade path, and covers privileges, the sweep, freeze, fail, complete, reap and requeue. Two
  concurrent sessions are needed to test single-flight (`SKIP LOCKED`), the migration's lock
  timeout and the helper's row lock; those were checked by hand and are not in this file.
- `supabase/tests/advisor_outbox.sql` loads the real advisor-role migrations and checks the three advisor functions as signed-out, guest, prospect, advisor and admin callers (403 for all but the last two), the projection, the filter, the retry and its audit, and that the worker then claims what was retried. `supabase/tests/outbox_schedule.sql` runs the schedule migration against stand-ins for `pg_cron`, `pg_net` and Vault, including the job's own SQL.
- `supabase/tests/advisor_outbox.sql` also replays webhook fixtures through `record_email_delivery_event`: a permanent bounce suppresses once and a replay changes nothing, temporary trouble acts on nothing, a complaint outranks a bounce, the advisory team is protected, the claim never hands out a suppressed address, and the advisor flag and its access.
- `supabase/functions/resend-webhook/*.test.ts` check the signature verifier against the vector and verdicts of the official `svix` library, the event parser, the handler's answers (200, 401, 500, 503) and its logs, and that `supabase/config.toml` turns the gateway's JWT check off for it.
- `supabase/functions/dispatch-outbox/*.test.ts`, `src/data/outbox.test.ts`, `src/pages/advisor/AdvisorOutboxPage.test.tsx` and `src/lib/advisorApi.test.ts` run with `npm test`.
- `.claude/skills/verify` runs the whole pipeline for real (Postgres, PostgREST, the function under
  Deno, a fake provider).
