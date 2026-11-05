# Operations runbook

How Edgar Allan Advisory notices problems, who it calls, and what it does about them (US-6.4, plan H-4.1 to
H-4.3): what is monitored and how alerts arrive, escalation contacts, severity and response steps, playbooks
for each kind of failure, backup and recovery expectations, and the production access review.

Related: `docs/NOTIFICATIONS.md` (the email outbox, its own alerts and recovery SQL), `docs/DATA_HANDLING.md`
(retention and deletion), `docs/SECURITY_REVIEW.md` (authorization testing and accepted findings),
`docs/SUPABASE_SETUP.md` (secrets, deploys and schedules).

## Escalation contacts

Fill in every row before launch, and check them at each quarterly access review. An alert with nobody on the
other end is not monitoring. For now the owner holds the incident lead, engineering on call and engineering backup
roles (decided 2026-11-05); name someone else in a row as soon as there is someone, so a page has a second person to
go to.

| Role | Responsible for | Name | How to reach (in order) | Backup |
|---|---|---|---|---|
| Incident lead | Runs every SEV-1 and SEV-2: decides severity, owns the incident log, calls in the others | The owner | _owner's phone, then chat: to fill_ | The owner (no second person yet) |
| Engineering on call | Alerts, diagnosis, fixes, deploys and rollbacks, restores | The owner | _owner's phone, then chat: to fill_ | The owner (engineering backup, until someone else is named) |
| Advisory lead | Advisor access, prospect communication, pausing intake work | _to fill_ | _to fill_ | _to fill_ |
| Privacy and legal counsel | Whether an incident is a reportable breach, notices to prospects and regulators | _to fill_ | _to fill_ | _to fill_ |
| Supabase | Database, storage, auth, edge functions | Support ticket from the dashboard (plan-dependent priority) | status.supabase.com | |
| Vercel | Web hosting | Support from the dashboard | vercel-status.com | |
| Resend | Email delivery | Support from the dashboard | resend-status.com | |
| Anthropic (D11) | Lenore and document reading | Support from the Anthropic Console | status.anthropic.com | |
| Scanii (D13) | Malware scanning of every upload | Support from the Scanii dashboard | _Scanii's status page: to fill_ | |
| ElevenLabs | Voice (opt-in beta) | Support from the dashboard | status.elevenlabs.io | |

## What is monitored

Failures are recorded in `public.ops_events` (`supabase/migrations/20261104091000_ops_monitoring.sql`): a
kind, a short code, a redacted one-line detail, the page's path and the intake's id. Never contents: no
answers, file names, messages, addresses or links.

| Kind | Recorded by | Codes you will see |
|---|---|---|
| `app_error` | The browser: the error boundary (`render_error`), uncaught errors (`window_error`), unhandled rejections (`unhandled_rejection`) | |
| `upload_failed` | The browser: `document-upload` failing to store a file (`document_upload:<code>`: `storage`, `internal`, `unavailable`, or `document_upload:<status>` / `document_upload:unreachable` when it never answered), a stored file or row not deleting (`storage_remove`, `record_delete:<sqlstate>`), `document-extract` never answering (`document_read_unreachable`, `document_read:<status>`). A refused file (wrong contents, a program, too large, a duplicate, the 25-file limit) or a closed intake is not a failure and isn't reported | |
| `ai_failed` | Counted from `ai_extraction_events`, the record `chamber-extract` and `document-extract` keep of every call (US-2.4a, `docs/AI_OPERATIONS.md`), when the call failed on our side or the provider's (`<function>:<code>`: `chamber-extract:timeout`, `document-extract:provider_error`, `…:unavailable` for a provider that isn't set up or is out of credit, `…:invalid_response`, `…:internal`). Refusals (bad request, signed out, rate limit, daily cap) are not failures. Plus the browser when `chamber-extract` never answered (`chat_timeout`, `chat_unreachable`, `chat:<5xx>`) | |
| `auth_denied` | The browser: a signed-in non-advisor on an advisor page (`advisor_route`), the database refusing an advisor read (`advisor_forbidden`) | |
| `deletion_failed` | `fail_intake_deletion` when a deletion has used every attempt, and `claim_intake_deletions` when a worker died on the last one | `storage_remove:<status>`, `files_remain:<n>`, `rpc_files:<code>`, `rpc_complete:<code>`, `unexpected`, `worker_lost` |
| `voice_failed` | The browser, when a voice call with Lenore (ElevenLabs) fails on our side or the service's (`src/hooks/useLenoreVoice.ts`, `docs/VOICE_ISSUES.md`). A microphone the prospect blocked or doesn't have is shown to them and not reported | `voice_connect_timeout` (no connection 15 seconds after the microphone was ready), `voice_connect_failed` (the connection was refused), `voice_dropped:<close code>` (a call under way closed with an error), `voice_error` (the service reported an error during a call that carried on) |
| `malware_detected` | `record_document_scan` (from `document-upload` or `document-scan`) when the scanner names a signature in an upload | `malware:<signature>` |
| `scan_failed` | `fail_document_scan` when an upload couldn't be scanned after every attempt, `claim_document_scans` when a worker died on the last one, and, while no scanner is set up (or `none` on production), `document-scan` on every run (`document-upload` only logs each upload it refuses) | `config_missing`, `unreachable`, `timeout`, `scanii:<status>`, `http:<status>`, `invalid_response`, `clamd_error`, `clamd_size_limit`, `clamd_no_reply`, `file_missing`, `storage_download:<code>`, `storage_release:<code>`, `rpc_record:<code>`, `worker_lost` |

The browser's reports go through `public.report_client_event`, which drops reports past 30 an hour per
account, 200 an hour for all signed-out visitors together and 2,000 an hour overall, so a broken page or
someone abusing the endpoint can't flood the table. Anyone can send one, so an alert built from browser reports
can be false (finding SR-11 in `docs/SECURITY_REVIEW.md`): when one looks wrong, first check how many came from
signed-out callers (`where source = 'browser' and user_id is null`) and from how many accounts.

### Alert thresholds

`public.ops_alert_rules()` decides when each kind alerts; `src/data/schemaSync.test.ts` keeps this table equal
to it. `ops-monitor` runs every five minutes, raises each kind at most once per cooldown, and posts to
`ENGINEERING_ALERT_WEBHOOK_URL`.

| Kind | Alerts at | Within | Cooldown | Playbook |
|---|---|---|---|---|
| `app_error` | 10 events | 15 minutes | 60 minutes | [Application errors](#application-errors) |
| `upload_failed` | 5 events | 15 minutes | 60 minutes | [Failed uploads](#failed-uploads) |
| `ai_failed` | 5 events | 15 minutes | 60 minutes | [AI failures](#ai-failures) |
| `auth_denied` | 20 events | 15 minutes | 60 minutes | [Authorization failures](#authorization-failures) |
| `deletion_failed` | 1 event | 60 minutes | 60 minutes | [Deletion failed](#deletion-failed) |
| `voice_failed` | 5 events | 15 minutes | 60 minutes | [Voice failures](#voice-failures) |
| `malware_detected` | 1 event | 60 minutes | 60 minutes | [Malware detected](#malware-detected) |
| `scan_failed` | 1 event | 60 minutes | 60 minutes | [Scan failed](#scan-failed) |

Alerts that come from elsewhere:

| Alert | From | Playbook |
|---|---|---|
| `OUTBOX_DEAD` (webhook and log) | `dispatch-outbox`, when a notification email gives up | `docs/NOTIFICATIONS.md`, "Operating" |
| `DELETION_FAILED` (webhook and log) | `purge-intakes`, when a deletion gives up. The same failure also raises `OPS_ALERT kind=deletion_failed` within five minutes, so expect both | [Deletion failed](#deletion-failed) |
| `MALWARE_DETECTED` (webhook and log) | `document-upload` or `document-scan`, at once, for every detection. The first in an hour also raises `OPS_ALERT kind=malware_detected`, so expect both | [Malware detected](#malware-detected) |
| `SCAN_FAILED` (webhook and log) | `document-scan`, when an upload gives up after six attempts. Also raises `OPS_ALERT kind=scan_failed` | [Scan failed](#scan-failed) |

Log lines to know (fixed fields only, never names, paths, messages or provider text):

| Line | From | Means |
|---|---|---|
| `OPS_ALERT kind=… count=… window=…m threshold=… codes=…` | `ops-monitor` | A kind crossed its threshold; `OPS_ALERT_UNDELIVERED kind=…` if the webhook refused it |
| `OPS_CONFIG_MISSING: …` | `ops-monitor` | The webhook is unset or not an https URL, so alerts are only logged. Logged on every run (every five minutes) until it is fixed |
| `OPS_TEST delivered`, `OPS_TEST_UNDELIVERED` | `ops-monitor` | Someone sent a test alert ([Sending a test alert](#sending-a-test-alert)); the receiver took it, or refused it |
| `OPS_MONITOR_ERROR: …` | `ops-monitor` | It couldn't claim alerts (`rpc_claim:<code>`) or failed unexpectedly |
| `DELETION_DONE deletion=… intake=… files=… rows=…` | `purge-intakes` | A deletion finished. Keep these: "After a restore" needs them |
| `DELETION_RETRY deletion=… intake=… attempt=… reason=… retry_in=…s` | `purge-intakes` | An attempt failed; tried again after 5 minutes, 30 minutes, 2 hours, then 6 hours |
| `DELETION_FAILED deletion=… intake=… attempts=… reason=…` | `purge-intakes` | Out of attempts: an operator is needed |
| `DELETION_ERROR …` | `purge-intakes` | A failure couldn't even be recorded; the claim lapses after 10 minutes and is retried |
| `PURGE_CONFIG_MISSING: …`, `PURGE_ERROR: …` | `purge-intakes` | Missing secrets, or the run stopped early (`rpc_claim:<code>`, `unexpected`) |
| `AI_CALL_FAILED`, `AI_CONFIG_MISSING`, `AI_UNEXPECTED_ERROR` | `chamber-extract`, `document-extract` | Provider failures and misconfiguration; each call is also in `ai_extraction_events` by its request id (`docs/AI_OPERATIONS.md`) |
| `UPLOAD_REFUSED request=… user=… reason=…` | `document-upload` | A file refused before anything was stored: `executable` (a program, whatever its name), `mismatch` (contents don't match the name), `unsupported`, `empty`, `too_large`, `duplicate`, `limit`, `closed`, `consent`, `not_found`. Many `executable` lines from one user are worth a look |
| `UPLOAD_RECORD_FAILED …`, `UPLOAD_STORE_FAILED …`, `UPLOAD_ERROR …`, `UPLOAD_CONFIG_MISSING: …` | `document-upload` | The row or the file couldn't be saved (`code=<sqlstate or status>`); a stored file's row is removed again (`undo=` if that failed too) |
| `SCAN_DEFERRED document=… engine=… reason=…` | `document-upload` | The scanner gave no verdict at upload; the file waits in quarantine and `document-scan` retries it |
| `SCAN_RETRY document=… attempt=… reason=… retry_in=…s` | `document-scan` | A scan didn't settle; tried again after 5 minutes, 15 minutes, 1 hour, 4 hours, then 12 hours |
| `SCAN_CONFIG_MISSING: …` | `document-upload`, `document-scan` | `MALWARE_SCANNER` (or its settings) is unset or unusable, or is `none` on production: uploads are refused (`UPLOAD_REFUSED … reason=scanner_missing`) and files already held stay unreadable. The line names the setting to fix ([Scan failed](#scan-failed)) |
| `SCAN_NOT_RECORDED …`, `SCAN_ERROR …`, `SCAN_QUARANTINE_NOT_REMOVED …`, `SCAN_QUARANTINE_MOVE_FAILED …`, `SCAN_ORPHANS_ERROR …`, `SCAN_RUN_ERROR: …` | `document-upload`, `document-scan` | A step after the scan failed; the file stays unreadable and the next run settles it |

### How alerts reach people

- **The webhook.** Set `ENGINEERING_ALERT_WEBHOOK_URL` (a Slack or Teams incoming webhook, https) in the
  function secrets. `dispatch-outbox`, `purge-intakes`, `document-upload`, `document-scan` and `ops-monitor`
  all post to it. Without it, alerts are only log lines: `ops-monitor` logs `OPS_CONFIG_MISSING` on every run
  (every five minutes) and answers `"webhook": "missing"` (or `"invalid"`) to its schedule, which
  `select status_code, content from net._http_response order by created desc limit 5;` shows. After setting
  it, [send a test alert](#sending-a-test-alert).
- **The log lines.** Every alert is also a fixed-field log line (`OPS_ALERT`, `OUTBOX_DEAD`, `DELETION_FAILED`).
  As a second path, set up a Supabase log alert or a log drain on them, so a broken webhook doesn't silence
  everything.
- **What it can't see.** Refusals that never reach the browser or a function (PostgREST 401/403 answers to
  direct API calls, failed sign-ins, Auth rate limits) are in Supabase's API and Auth logs, not in
  `ops_events`. Check them in every authorization incident, and weekly until launch (Logs Explorer: API logs
  filtered on status 401 and 403; Auth logs filtered on failed sign-in).
- **Uptime.** Nothing inside the project can say the project is down, so an outside monitor watches it
  ([Uptime check](#uptime-check)).

### Who gets paged

The alert channel is the page. Every webhook alert lands in one channel (for example Slack `#eaa-alerts`), and
the uptime monitor pages by its own app or text message. There is no paging service yet; if one is added
(PagerDuty, Opsgenie), point the uptime monitor and the channel at it and update this table.

| Alert | Start at | Paged | If nobody acknowledges |
|---|---|---|---|
| Uptime check down (site or function) | SEV-1 | Engineering on call (the monitor's push and text), and the channel | Engineering backup after 15 minutes, then the incident lead |
| `MALWARE_DETECTED`, `OPS_ALERT kind=malware_detected` | SEV-2 | Engineering on call (channel), who calls the incident lead | Engineering backup after 1 hour in working hours |
| `OPS_ALERT kind=auth_denied` | SEV-2 (SEV-1 if data was read) | Engineering on call and the incident lead (channel) | Engineering backup after 1 hour |
| `DELETION_FAILED`, `OUTBOX_DEAD`, `SCAN_FAILED`, and `OPS_ALERT` for `deletion_failed`, `scan_failed`, `upload_failed`, `ai_failed`, `voice_failed` or `app_error` | SEV-2, or SEV-3 if it is one prospect | Engineering on call (channel) | Engineering backup the next working morning |
| `OPS_TEST` | none | Nobody: it is a test | |

What that needs from people, before launch:

- The names and numbers in [Escalation contacts](#escalation-contacts) are filled in.
- Engineering on call (and the backup) set the alert channel to notify on every new message, on their phones
  too, and leave it unmuted. Muting the channel silences every alert, not just the noisy one; silence one
  alert as below instead.
- Whoever takes an alert says so in the channel ([Responding to an incident](#responding-to-an-incident),
  step 1), so the others can stand down.

### Sending a test alert

`ops-monitor` sends one test message when asked, without claiming any real alert. Do it after setting or
changing the webhook, after rotating the service-role key, and once a month. Use the service-role key
(Supabase: Settings → API Keys) from a terminal, in an environment variable; don't paste it into chat.

```bash
curl -sS -X POST "https://<project-ref>.supabase.co/functions/v1/ops-monitor" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json" -d '{"test": true}'
```

| Answer | Means |
|---|---|
| `200 {"test":true,"webhook":"set","delivered":true}` | The receiver took it. `OPS_TEST: a test alert from ops-monitor…` should be in the channel within a minute; if it isn't, the webhook points at another channel |
| `503 {"test":true,"webhook":"missing","delivered":false}` (or `"invalid"`) | `ENGINEERING_ALERT_WEBHOOK_URL` is unset, or not an https URL |
| `502 {"test":true,"webhook":"set","delivered":false}` | The receiver refused it (a revoked Slack webhook answers 403 or 404): make a new webhook and set it |
| `401` | Wrong key |

To test the whole path, from an event to the channel, record a test event as well
([Checking the monitoring itself](#checking-the-monitoring-itself)).

### Silencing an alert

Fix the cause if you can. Silence only to stop repeats while someone is already working on it, and say so in
the channel.

- **An `OPS_ALERT` kind.** It repeats at most once per cooldown (an hour). To keep one kind quiet longer, record
  a placeholder alert dated ahead, as the service role in the SQL editor. The kind stays quiet until the
  placeholder's time plus its cooldown; every other kind still alerts.

  ```sql
  -- Quiet OPS_ALERT kind=scan_failed for about four hours (three, plus its one-hour cooldown).
  insert into public.ops_alerts (kind, event_count, window_minutes, threshold, top_codes, raised_at)
  values ('scan_failed', 0, 0, 0, 'silenced: <incident id or reason>', now() + interval '3 hours');

  -- Lift it early.
  delete from public.ops_alerts where kind = 'scan_failed' and top_codes like 'silenced:%';
  ```

  To change when a kind alerts for good, change `public.ops_alert_rules()` in a migration and the
  [thresholds table](#alert-thresholds) with it (`src/data/schemaSync.test.ts` checks they agree).
- **`MALWARE_DETECTED`, `SCAN_FAILED`, `DELETION_FAILED`, `OUTBOX_DEAD`.** One message per event, and each needs
  someone to act, so there is no switch for them. If one source floods the channel, fix or contain it (requeue,
  revoke the intake, rotate the key) rather than muting.
- **`OPS_CONFIG_MISSING` and `SCAN_CONFIG_MISSING`.** These are log lines, not channel messages; they stop once
  the setting is fixed.
- **The uptime monitor.** Pause it in its own dashboard for planned maintenance, and unpause it after.

### Uptime check

An outside monitor (any hosted uptime service: Better Stack, UptimeRobot, Checkly or similar) watches two
URLs from more than one region, and pages as in [Who gets paged](#who-gets-paged) after two failed checks in a
row. The account belongs to the team, not to one person, and its contacts are the engineering on-call rows.

| Check | Request | Healthy when | Every |
|---|---|---|---|
| The site | `GET https://nevermorepeo.com/` | Status 200 | 1 minute |
| An edge function (Lenore's) | `POST https://dvfwrjpkltqdkfudbahe.supabase.co/functions/v1/chamber-extract`, headers `apikey: <anon key>` and `Authorization: Bearer <anon key>`, body `{}` | Status 401 and the body contains `"code":"unauthorized"` | 5 minutes |

The function check uses the anon key, which is public by design (it ships in the site's JavaScript). The
function answers it itself: it finds no signed-in prospect and refuses before recording anything or calling the
AI provider, so the check costs nothing and spends no quota. A 401 *without* `"code":"unauthorized"` in the
body is the gateway refusing the key, not the function answering, so the check fails, as it should. The
project ref is production's (`docs/SUPABASE_SETUP.md`); change it if the project changes.

### Looking at the numbers

```sql
-- As an admin through the API: counts by kind, source and code over the last 24 hours.
select * from public.admin_ops_summary(24);

-- From the SQL editor.
select kind, source, code, count(*), max(created_at) as last_at
from public.ops_events where created_at > now() - interval '1 hour'
group by 1, 2, 3 order by 4 desc;

select * from public.ops_alerts order by raised_at desc limit 20;
```

### Checking the monitoring itself

```sql
select jobname, schedule, active from cron.job order by jobname;
-- expect dispatch-outbox (every minute), ops-monitor (*/5), document-scan (*/5), purge-intakes (:23 hourly),
-- expire-idle-intakes (:17 hourly) and run-retention (03:41 daily)
select jobname, status, return_message, start_time
from cron.job_run_details join cron.job using (jobid)
order by start_time desc limit 20;
select status_code, created from net._http_response order by created desc limit 20;  -- the HTTP-calling jobs
```

The HTTP-calling jobs do nothing until Vault holds `project_url` and `service_role_key`
(`docs/SUPABASE_SETUP.md`). Once a month, [send a test alert](#sending-a-test-alert), then record one test
event and watch the alert arrive, which tests the whole path from an event to the channel:

```sql
select public.record_ops_event('deletion_failed', 'runbook-test', 'test');   -- as the service role (SQL editor)
-- within five minutes the channel shows an OPS_ALERT for deletion_failed; then:
delete from public.ops_events where source = 'runbook-test';
```

## Severity

| Level | Means | Examples | Respond within | Who |
|---|---|---|---|---|
| **SEV-1** | Restricted data exposed or likely exposed, or the service is down for everyone | A census file reachable by the wrong person; a leaked service-role key; the database unreachable | 1 hour, any time | Incident lead, engineering, advisory lead, counsel |
| **SEV-2** | A core path is broken for many prospects, or a control has failed without known exposure | Lenore failing for everyone; uploads failing; notifications dead; deletions failing; advisor access wrongly granted | 4 working hours | Incident lead, engineering |
| **SEV-3** | Degraded or limited to a few | One provider slow; a single prospect's upload failing; an alert that is noise | Next working day | Engineering |

When in doubt, start higher and step down.

## Responding to an incident

1. **Acknowledge.** Say in the alert channel who has it. Open an incident log entry (below) and note the time.
2. **Triage.** Decide the severity. Look at `admin_ops_summary`, the function logs, `cron.job_run_details` and
   the providers' status pages. For anything touching restricted data, call the incident lead now.
3. **Contain.** Stop it getting worse before fixing it: roll back the last deploy, turn a feature off, revoke a
   role, rotate a key. The playbooks below list the levers.
4. **Fix.** Make the smallest change that resolves it. Deploy through the normal checks when there is time;
   note it when there isn't.
5. **Recover.** Re-run what failed (requeue emails, retry deletions, ask affected prospects to retry). Confirm
   the alert has cleared and the numbers are back to normal.
6. **Communicate.** Advisory lead tells affected prospects what happened and what to do. For SEV-1, counsel
   decides on notices and their deadlines before anything goes out.
7. **Review.** Within five working days of a SEV-1 or SEV-2: what happened, why, what changes. Blameless. File
   the follow-ups as stories.

Incident log entry (keep them in the team's incident folder, never with restricted data in them; use intake
ids and File IDs):

```
Incident <date>-<n>   Severity: SEV-?   Lead: <name>
Detected: <time, how>   Resolved: <time>
What happened:
Impact (who, how many, which data classes):
Timeline:
Containment and fix:
Notices sent (by counsel's decision):
Follow-ups:
```

## Playbooks

### Application errors

`OPS_ALERT kind=app_error`. Usually a deploy.

1. `admin_ops_summary(1)`: which code and which pages (`route`)? A single `render_error` route points at one
   component.
2. Did a front-end deploy just go out? Roll it back in Vercel (Deployments → previous → Promote) and confirm
   the count drops.
3. Reproduce from the route, fix, redeploy through CI.

### Failed uploads

`OPS_ALERT kind=upload_failed`.

1. By code: `document_upload:storage`: `document-upload` couldn't store a file (`UPLOAD_STORE_FAILED` in its
   logs: Supabase Storage, or the bucket limits, which take only `application/octet-stream` up to 20 MB:
   `select id, file_size_limit, allowed_mime_types from storage.buckets`). `document_upload:internal`: the
   documents table refused the row for a reason the function doesn't know (`UPLOAD_RECORD_FAILED`, a
   migration or policy change). `document_upload:unavailable`: the function's Supabase secrets are missing.
   `document_upload:unreachable` or `:<5xx>`: the function isn't deployed or is crashing (function logs).
   `storage_remove`: Supabase Storage, check its status. `document_read_unreachable`: `document-extract` not
   deployed or crashing (function logs).
2. Prospects keep their files in their own hands: nothing is lost by a failed upload. Ask affected prospects
   (by intake id) to try again once fixed.

### AI failures

`OPS_ALERT kind=ai_failed`, and `AI_CALL_FAILED` / `AI_CONFIG_MISSING` lines in the `chamber-extract` and
`document-extract` logs.

1. By code: `…:timeout`, `…:provider_error`: the provider is down or slow (its status page). `…:unavailable`:
   `AI_PROVIDER` or the provider key is unset or wrong (`AI_CONFIG_MISSING` in the logs;
   `docs/SUPABASE_SETUP.md`), or our provider account is out of credit. `…:invalid_response`: the model
   answered without the tool call (a prompt or provider change). `…:internal`: a bug in the function.
   `chat_unreachable`, `chat:<5xx>`: the function itself isn't answering (not deployed, or crashing before its
   handler). `chat_timeout`: the browser gave up after 45 seconds. Find individual calls by request id or
   intake in `ai_extraction_events` (`docs/AI_OPERATIONS.md`).
2. If the provider is down for long, switch `AI_PROVIDER` to the other supported provider and set its key
   (`docs/SUPABASE_SETUP.md`). Both functions read the one setting, so no code change is needed.
3. Prospects can always fill the workspace by hand ("Continue manually" opens Review, where every answer can be added); say so if advisors are asked.

### Authorization failures

`OPS_ALERT kind=auth_denied`.

1. `advisor_route` from many accounts: someone is probing `/advisor`, or a link to it was shared. Check
   Supabase's API logs for 401/403 bursts from one address.
2. `advisor_forbidden` from one account: an advisor whose role was revoked is still trying (expected after
   offboarding), or a role was removed by mistake (`select * from public.user_roles`).
3. A burst of PostgREST 401/403s with no matching browser reports is direct API probing. The database refuses
   it (`docs/SECURITY_REVIEW.md`); block the address in Supabase's network restrictions or Vercel's firewall
   if it persists.
4. If anything suggests data was read that shouldn't have been, it is a SEV-1: go to
   [Suspected data exposure](#suspected-data-exposure).

### Voice failures

`OPS_ALERT kind=voice_failed`. Voice is an opt-in beta: text always works, and every failure tells the prospect
so with a "Continue in text" button, so this is never a SEV-1 on its own.

1. By code: many `voice_connect_timeout` or `voice_connect_failed`: ElevenLabs is down or refusing the agent
   (status.elevenlabs.io; the agent still exists and `VITE_ELEVENLABS_AGENT_ID` names it; the account has
   credit). `voice_dropped:1006` from many accounts: connections are being cut (the service, or a network path
   between it and prospects); from one account, that prospect's network (1006 is a connection cut with no
   goodbye). Any other close code: the service closed the call itself, and the conversation's history in the
   ElevenLabs dashboard says why. `voice_dropped` with no code: the service ended the call with an error
   message rather than a close (the SDK does this when a call reaches its maximum duration). `voice_error`:
   errors the service reported during calls that carried on.
2. The detail and the intake id are in `ops_events`. Each cause found, and its fix, goes in
   `docs/VOICE_ISSUES.md`.
3. If voice stays broken, unset `VITE_ELEVENLABS_AGENT_ID` and redeploy: the "Speak with Lenore" button goes
   and the Chamber is text only, with nothing else changed.

### Deletion failed

`OPS_ALERT kind=deletion_failed` or `DELETION_FAILED`.

1. `select id, session_id, attempts, last_error from public.intake_deletions where status = 'failed';`
2. `storage_remove:<status>`: Storage refused (service-role key wrong or rotated, or Storage down).
   `files_remain:<n>`: files were added while it ran, or removal silently did nothing: re-run once.
   `rpc_files:<code>`, `rpc_complete:<code>`: a database error (function logs). `unexpected`: a bug in the
   function (its logs, then a fix).
3. Fix the cause, then `select public.retry_intake_deletion('<id>');` as an admin, or set it back to pending
   from the SQL editor (`docs/DATA_HANDLING.md`, "Asking for a deletion"). A retention deletion that waits a
   day is not urgent; a deletion someone asked for is, because we told them it would happen.

### Malware detected

`OPS_ALERT kind=malware_detected` or `MALWARE_DETECTED`. An upload matched a malware signature. It is already
quarantined: its file is in the `quarantine` bucket (or, for an upload from before scanning, withheld in
`documents`), which nobody signed in can read, list or sign a link to, and Lenore never read it. This is a
SEV-2 until step 2 says otherwise.

1. Which one: `select id, user_id, session_id, scan_signature, scanned_at, file_sha256 from public.documents
   where scan_verdict = 'infected' order by scanned_at desc;` The alert names the document and intake ids;
   look the intake up in the advisor console for who it is.
2. Is it real? A signature naming EICAR (Scanii reports a `content.malicious.…` finding; clamd says
   `Win.Test.EICAR_HDB-1`) is the standard test file (someone testing the scanner, see below). For anything else, the SHA-256 identifies the sample: look it up in your threat
   intelligence source. Treat a real detection from a prospect as a compromised machine on their side, not
   an attack on us: the advisory lead tells the prospect, without forwarding the file, that a file they sent
   was flagged and set aside, and asks them to send a clean copy.
3. Leave the file where it is unless you need it: it is removed with the intake (retention), or at the next
   `document-scan` run after the prospect removes it. To examine it, download it with the service role into an
   isolated machine, never a work laptop.
4. A false positive (confirmed with the scanner's vendor): `select public.requeue_document_scan('<document id>');`
   as the service role. It is scanned again within five minutes, and stays unreadable until a scan passes.
5. Many detections from one account, or `UPLOAD_REFUSED … reason=executable` lines from the same user: someone
   is probing the upload. Revoke the intake (`revoke_chamber_session`) and treat it under
   [Authorization failures](#authorization-failures).

Testing it (once a month, after changing the scanner or its keys, and once Scanii is first set up): upload
the EICAR test file (the 68-character string from eicar.org, saved as `eicar.csv`) to a test intake. Within
seconds the Upload tab says "Blocked", the channel shows `MALWARE_DETECTED` with Scanii's
`content.malicious.…` finding as the signature, and `OPS_ALERT kind=malware_detected` follows within five
minutes. Then upload any ordinary CSV: it should be readable as soon as the upload finishes. A
`SCAN_DEFERRED … engine=scanii reason=scanii:401` log line instead means Scanii refused the key and secret.

### Scan failed

`OPS_ALERT kind=scan_failed` or `SCAN_FAILED`. Uploads are not being scanned: either they are held
(prospects see "Checking for viruses" and nobody can open their files), or, with no scanner set up at all,
refused (prospects are told uploads are paused). Nothing unsafe is exposed; this is a SEV-2 because uploads
are stuck.

1. By code: `config_missing`: `MALWARE_SCANNER` (or `SCANII_API_KEY`, `SCANII_API_SECRET`, `SCANII_API_URL`,
   `CLAMAV_HOST`, `MALWARE_SCANNER_URL`, `MALWARE_SCANNER_TOKEN`) is unset or wrong in the function secrets,
   or is `none` on a project whose `APP_ENV` isn't `development`, `demo` or `staging`
   (`docs/SUPABASE_SETUP.md`, "Malware scanning"; `docs/adr/0002-uploads-need-a-scanner-in-production.md`).
   `document-scan` records it on every run; the `SCAN_CONFIG_MISSING` log line names which setting.
   Meanwhile uploads are refused (prospects are told uploads are paused) rather than held; files held before
   are scanned on `document-scan`'s first run after the setting is fixed, within five minutes. Until Scanii's
   secrets are set, silence the repeats as in [Silencing an alert](#silencing-an-alert).
   `unreachable`, `timeout`, `scanii:<status>`, `http:<status>`, `clamd_*`: the scanner is down, refusing us,
   or rejecting the file (`scanii:401` or `scanii:403`: Scanii refused the key and secret, so check them in
   the Scanii dashboard; `clamd_size_limit`: raise clamd's `StreamMaxLength` above 20 MB). `file_missing`: the document has no
   stored file (its upload failed half way); the prospect should remove it and upload again.
   `storage_*`, `rpc_*`: Supabase Storage or the database (function logs). `worker_lost`: the function was
   stopped mid-scan on its last attempt.
2. What is waiting: `select scan_verdict, scan_error, count(*) from public.documents where scan_verdict in
   ('pending', 'failed') group by 1, 2;`
3. Fix the cause. Pending documents are retried on their own; failed ones are requeued with
   `select public.requeue_document_scan(id) from public.documents where scan_verdict = 'failed';` as the
   service role.

### Notification emails

`OUTBOX_DEAD`, `OUTBOX_CONFIG_MISSING`, `OUTBOX_ENQUEUE_FAILED`: `docs/NOTIFICATIONS.md`, "Operating". Advisors
can retry dead emails at `/advisor/outbox`.

### Suspected data exposure

SEV-1, always. The incident lead and counsel are called first.

1. **Contain.**
   - A wrong person has access: revoke their role (`delete from public.user_roles where user_id = ...`), and
     in Supabase Authentication → Users, sign them out of all sessions or ban the user.
   - A key or secret leaked (service-role key, AI or Resend key, webhook): rotate it now (Supabase: Settings →
     API → roll the key; then update Vault's `service_role_key` and every function secret that used it;
     providers: their dashboards). The anon key is public by design and is not a secret.
   - A broken control (a policy or function letting data through): roll back the migration's effect with a new
     migration, or, if that will take time, turn the path off (revoke the grant, undeploy the function).
   - A file sent to the wrong recipient by a person: ask them to delete it and confirm in writing.
2. **Preserve evidence.** Export the relevant Supabase API, Auth, Storage and function logs for the window
   before they roll over, and note the times. Don't change data you may need to examine; copy it first.
3. **Scope.** Which intakes, which data classes, which people, over what time. Use ids, not contents, in the
   log. `intake_deletions`, `intake_lifecycle_events`, `submission_status_history` and `manuscript_versions`
   say who did what and when.
4. **Decide on notices.** Counsel decides whether it is a reportable breach and what notices are due, to whom
   and by when (state breach laws set deadlines). The advisory lead sends them as counsel words them.
5. **Review** as above, including whether `docs/SECURITY_REVIEW.md` needs a new finding.

## Backup and recovery

Expectations, to confirm against the production project's plan before launch (J-1.1, J-1.2):

| What | How it is protected | Recovery point | Recovery time |
|---|---|---|---|
| Database (intakes, documents' rows, certifications, advisor records, outbox) | Supabase daily backups (7 days on Pro); turn on Point-in-Time Recovery for production | 24 hours with daily backups; about 2 minutes with PITR | 4 hours |
| Stored files (`documents`, `manuscripts` buckets) | Supabase Storage's durable storage. **Not in database backups**, and a deleted file can't be restored | Files are not restorable after deletion; prospects keep their own originals | Re-upload by the prospect |
| Edge functions, migrations, front end | Git. Vercel keeps previous deployments | The last commit | Minutes (Vercel promote; `supabase functions deploy`) |
| Secrets (function secrets, Vault, provider keys) | The providers' dashboards; a copy in the team's password manager | | Minutes |

Restore drill, every quarter, on staging (J-1.1) and never on production: restore the latest backup to a new
project, apply any newer migrations, point a staging front end at it, open one intake and one document as an
advisor, and record it below. Plan decision H-4.3 stays open until the first drill is recorded.

| Date | Backup restored (time) | Restored into | Checks passed | Time taken | By |
|---|---|---|---|---|---|
| | | | | | |

### After a restore

A restore brings back whatever the backup held, including intakes deleted since it was taken, and their
deletion records are gone with the rest of the newer data. Before reopening:

1. From the function logs, list `DELETION_DONE` lines (they carry the deletion and intake ids) since the
   backup's time, and the `intake_deletions` rows from a pre-restore export if one exists.
2. Ask for each of those intakes to be deleted again (`docs/DATA_HANDLING.md`) and let `purge-intakes` run.
3. Run `select public.run_retention();` and `select public.expire_idle_intakes();` once.
4. Check the cron jobs are present and active (above).

## Production access review

Every quarter, when someone leaves, and after every SEV-1. The admin who runs it records it below.

| Where | What to check | How |
|---|---|---|
| Advisor and admin roles | Every row is a current team member who still needs it; admins are as few as possible | `select u.email, r.role, r.granted_at, u.last_sign_in_at from public.user_roles r join auth.users u on u.id = r.user_id order by r.role, u.email;` Revoke with the matching `delete`. An advisor who hasn't signed in for 90 days loses the role until they need it again |
| Supabase organization and project | Members and their roles; no shared logins | Dashboard → Organization → Team |
| Vercel team | Members; who can promote to production | Dashboard → Team → Members |
| GitHub repository | Who can push and merge to `main`; branch protection and required checks (`verify`, `sql-tests`, `e2e`) on | Repository → Settings → Collaborators and Branches |
| Secrets | Each function secret is still needed; keys of people who left are rotated | `supabase secrets list`, Vault, provider dashboards |
| Providers (Resend, the AI provider, ElevenLabs, Cloudflare) | Members and API keys | Their dashboards |
| Alert channel and escalation contacts | The webhook still posts to a watched channel; the contacts above are current | The monthly test event; this document |
| Submitted records past retention | `docs/DATA_HANDLING.md`, "Reviewing submitted records" | `retention_review_due()` |

| Date | Reviewer | Scope | Changes made |
|---|---|---|---|
| | | | |
