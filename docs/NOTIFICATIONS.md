# Submission notifications

When a prospect certifies an intake (which submits it), two emails are queued in the same database
transaction and sent by the `dispatch-outbox` edge function:

| Email | To | Contains |
|---|---|---|
| Advisor alert (G-1) | `ADVISORY_NOTIFY_EMAIL` | Company, contact name, contact email and phone (if on file), submission reference, link to the secure advisor review |
| Prospect confirmation (G-2) | The signed-in account's own email | Company, reference, what happens next, expected response time, support address |

Neither email contains census, payroll, benefits or document content. The queue row itself never
holds them: `enqueue_submission_notifications()` copies only named fields, and the email builders
read only named fields back out (`supabase/functions/dispatch-outbox/messages.ts`).

## How it works

```
certify (UPDATE chamber_sessions) ──► chamber_certifications row
                                         └─ trigger ─► outbox_events (one per kind) ◄── same transaction
browser, right after a confirmed submit ─► dispatch-outbox ─┐
schedule, every minute (safety net + retries) ─────────────┘
   claim due events ─► send via provider ─► mark sent │ retry later │ dead after 5 attempts
```

- **A send failure never undoes a submission.** The submission commits first; sending happens later.
  The queueing trigger is itself fenced: if it ever fails, it logs a warning and the submission stands.
- **No uncontrolled duplicates.** Events are unique per kind and per `(session, hash of the certified
  data)`. The client retrying a submit (which records another certification) queues nothing new.
  Certifying *changed* answers again is a new submission: the advisor alert says "Updated intake".
  At send time, the provider also gets an idempotency key (event id plus a fingerprint of the
  message), so a retry after a timeout cannot deliver twice (Resend honours it for 24 hours).
- **Retries:** after failed attempts 1, 2, 3, 4 the event waits 1 min, 5 min, 30 min, 2 h. The 5th
  failure marks it `dead`.
- **The prospect confirmation goes to the account's own address**, never to an address typed into
  the intake. Keep Supabase Auth's "Confirm email" enabled in production. Accounts with no email
  (none can certify today) get the advisor alert only.

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
`delete from public.outbox_events where status = 'pending';`

### Schedule (required)

The browser nudges the function right after a submit, but a closed tab, a provider outage or a retry
all need a scheduler. Run the function every minute with the service-role key (it does nothing when
nothing is due). With `pg_cron` and `pg_net`:

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

Any scheduler that can send that request works. Callers other than the service role must be signed-in,
non-guest users; the function only works the queue and returns counts.

## Operating

Failures are logged by the function (Supabase function logs) and recorded on the row. Alert on these:

| Log line | Meaning | Action |
|---|---|---|
| `OUTBOX_DEAD` | An event used all 5 attempts (or can never succeed) | Find the cause below, fix it, requeue |
| `OUTBOX_SEND_FAILED` | One attempt failed; retry scheduled | None unless it repeats |
| `OUTBOX_CONFIG_MISSING` | A kind is not being sent | Finish setup |
| `OUTBOX_RECORD_FAILED` | Sent or failed, but the database write failed | Check the database; the event retries when its claim lapses |
| `OUTBOX_DISPATCH_ERROR` | The run itself failed | Check logs |

Log lines carry event ids and failure kinds only: no addresses, names or message bodies.
`reason` is `timeout`, `network`, `rate_limited:429`, `auth:401|403` (bad key, or sender domain not
verified), `provider_error:<status>`, `invalid_payload` or `not_configured`.

```sql
-- Queue health
select kind, status, count(*) from public.outbox_events group by 1, 2;
-- What died and why (payload holds recipient details, so it is left out)
select id, kind, session_id, attempts, last_error, created_at
from public.outbox_events where status = 'dead' order by created_at;
-- Requeue one after fixing the cause
update public.outbox_events
set status = 'pending', attempts = 0, next_attempt_at = now(), last_error = null
where id = '<event id>' and status = 'dead';
```

`outbox_events` is service-role only (no client, prospect or advisor access).

## Before public launch (G-2)

- [ ] Sender domain verified with the provider; a test email from `EMAIL_FROM` lands in a real inbox (not spam).
- [ ] `PROSPECT_RESPONSE_TIME` and `SUPPORT_EMAIL` agreed with the advisory lead.
- [ ] Supabase Auth "Confirm email" is on.
- [ ] The schedule above is running.
- [ ] Test submissions removed from `outbox_events`.
- [ ] `OUTBOX_DEAD` has an alert (plan H-4.1).

## Not covered here

- Admin screen to see and retry dead events (plan G-1.3); use the SQL above until it exists.
- Bounce and suppression handling (plan G-2.2).
- Submissions certified before this migration were not queued; nothing is backfilled.
- Queue rows keep the recipient's address after sending. Fold them into the retention rule (D4).

## Tests

- `supabase/tests/submission_outbox.sql` (scratch Postgres; drops `public`):
  `psql -v ON_ERROR_STOP=1 -f supabase/tests/submission_outbox.sql`
- `supabase/functions/dispatch-outbox/*.test.ts` run with `npm test`.
