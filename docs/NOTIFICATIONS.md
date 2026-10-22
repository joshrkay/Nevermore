# Submission notifications

When a prospect certifies an intake (which submits it), two emails are queued in the same database
transaction and sent by the `dispatch-outbox` edge function:

| Email | To | Contains |
|---|---|---|
| Advisor alert (G-1) | `ADVISORY_NOTIFY_EMAIL` | Company, contact name, contact email and phone (if on file), submission reference, link to the secure advisor review |
| Prospect confirmation (G-2) | The signed-in account's own email | Company, reference, what happens next, expected response time, support address |

Neither email contains census, payroll, benefits or document content. The queue row itself never
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
   scheduled runs only: reap lost claims ─► queue what the trigger missed
   claim due events ─► freeze the email ─► send via provider ─► mark sent │ retry later │ dead after 5 attempts
```

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
  failure marks it `dead`.
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

A kind whose settings are incomplete is **not sent**: its events stay queued, no attempts are spent,
and `OUTBOX_CONFIG_MISSING` is logged naming the missing setting (never its value). Completing the
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
that spends its fifth attempt that way stays `sending` until the new function's first scheduled run
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

### Schedule (required)

The browser nudges the function right after a submit, but a closed tab, a provider outage or a retry
all need a scheduler, and so does healing: **only scheduled runs queue what the trigger missed and
reap lost claims**, never a browser's nudge. Run the function every minute with the service-role key
(a run with nothing to do is a few cheap queries). With `pg_cron` and `pg_net`:

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

Any scheduler that can send that request works, and overlapping runs are safe. Callers other than the
service role must be signed-in, non-guest users; they get the queue worked (sends and retries) and
counts back, nothing more. A scheduled run's response also carries `reconciled`
(`healed`, `failed`, `unqueued`) and `reaped`.

## Operating

Failures are logged by the function (Supabase function logs) and recorded on the row. Only
`OUTBOX_SENT` is logged at info level and `OUTBOX_RECONCILED` as a warning; everything else is an
error line. Alert on these:

| Log line | Meaning | Action |
|---|---|---|
| `OUTBOX_DEAD` | An event is out of attempts or can never succeed, or its worker was lost with every attempt used (`reason=worker_lost`: no email had been frozen yet; `worker_lost_maybe_sent`: one was frozen and may have gone out) | Find the cause below, fix it, requeue |
| `OUTBOX_ENQUEUE_FAILED` | `unqueued=K oldest_age_s=S last_sqlstate=X`: K active certifications have no notifications. Logged on every scheduled run until they are queued. One line that is gone on the next run is benign: a run that overlaps another queueing that certification at that moment can report it | See "A certification that was never queued" |
| `OUTBOX_RECONCILED` | The run queued notifications for certifications the trigger had failed to queue (a warning, not a failure) | Find out why the trigger failed |
| `OUTBOX_SEND_FAILED` | One attempt failed; retry scheduled | None unless it repeats |
| `OUTBOX_CONFIG_MISSING` | A kind is not being sent | Finish setup |
| `OUTBOX_RECORD_FAILED` | Sent or failed, but the database write failed | Check the database; the event retries when its claim lapses, with the same frozen message |
| `OUTBOX_RECONCILE_ERROR`, `OUTBOX_REAP_ERROR` | The housekeeping call at the start of a scheduled run failed or took over 10 seconds; sending went on. Followed by a short code: a PostgREST one, `timeout`, `unknown` or `malformed_result` | Check the database; `PGRST202` means the migration is not applied |
| `OUTBOX_DISPATCH_ERROR` | The run itself failed | Check logs |

Log lines carry event ids, counters and failure kinds only: no addresses, names or message bodies,
and the housekeeping lines carry a code, never database error text. `reason` is `timeout`, `network`,
`rate_limited:429`, `auth:401|403` (bad key, or sender domain not verified), `provider_error:<status>`,
`invalid_payload`, `not_configured` or `freeze_failed` (the email could not be written to the event,
so nothing was sent).

```sql
-- Queue health
select kind, status, count(*) from public.outbox_events group by 1, 2;

-- Stuck work. oldest_due_wait keeps growing when nothing is working the queue (the schedule is down,
-- or a kind's settings are incomplete). lapsed_claims are sends whose worker died; those with
-- awaiting_reap are out of attempts and stay `sending` until a scheduled run reaps them.
select (select now() - min(next_attempt_at) from public.outbox_events
        where status = 'pending' and next_attempt_at <= now()) as oldest_due_wait,
       count(*) filter (where status = 'sending' and locked_until < now()) as lapsed_claims,
       count(*) filter (where status = 'sending' and locked_until < now() and attempts >= 5) as awaiting_reap
from public.outbox_events;
```

`outbox_events` is service-role only (no client, prospect or advisor access).

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

-- Requeue after fixing the cause. Same email, same key: the provider de-duplicates it if it was
-- delivered, but only if frozen_at (above) is under 20 hours old. An older freeze is rebuilt from the
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
- [ ] The schedule above is running: it sends retries, queues what the trigger missed and reaps lost claims.
- [ ] The unqueued-certifications query above returns no rows.
- [ ] Test submissions removed from `outbox_events`.
- [ ] `OUTBOX_DEAD`, `OUTBOX_ENQUEUE_FAILED`, `OUTBOX_RECONCILE_ERROR` and `OUTBOX_REAP_ERROR` have an
  alert (plan H-4.1). The last two matter most: when the sweep itself fails, a scheduled run's
  response still shows `reaped: 0` and `reconciled` all zeros, and `OUTBOX_ENQUEUE_FAILED` is never
  logged, so only those lines say that unqueued certifications are going unreported.

## Not covered here

- Admin screen to see and retry dead events (plan G-1.3); use the SQL above until it exists. Its
  retry button will call `requeue_outbox_event`.
- Bounce and suppression handling (plan G-2.2).
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
- `supabase/functions/dispatch-outbox/*.test.ts` run with `npm test`.
- `.claude/skills/verify` runs the whole pipeline for real (Postgres, PostgREST, the function under
  Deno, a fake provider).
