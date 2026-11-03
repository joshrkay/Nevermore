# Operations runbook

How Edgar Allan Advisory notices problems, who it calls, and what it does about them (US-6.4, plan H-4.1 to
H-4.3): what is monitored and how alerts arrive, escalation contacts, severity and response steps, playbooks
for each kind of failure, backup and recovery expectations, and the production access review.

Related: `docs/NOTIFICATIONS.md` (the email outbox, its own alerts and recovery SQL), `docs/DATA_HANDLING.md`
(retention and deletion), `docs/SECURITY_REVIEW.md` (authorization testing and accepted findings),
`docs/SUPABASE_SETUP.md` (secrets, deploys and schedules).

## Escalation contacts

Fill in every row before launch, and check them at each quarterly access review. An alert with nobody on the
other end is not monitoring.

| Role | Responsible for | Name | How to reach (in order) | Backup |
|---|---|---|---|---|
| Incident lead | Runs every SEV-1 and SEV-2: decides severity, owns the incident log, calls in the others | _to fill_ | _phone, then chat_ | _to fill_ |
| Engineering on call | Alerts, diagnosis, fixes, deploys and rollbacks, restores | _to fill_ | _phone, then chat_ | _to fill_ |
| Advisory lead | Advisor access, prospect communication, pausing intake work | _to fill_ | _to fill_ | _to fill_ |
| Privacy and legal counsel | Whether an incident is a reportable breach, notices to prospects and regulators | _to fill_ | _to fill_ | _to fill_ |
| Supabase | Database, storage, auth, edge functions | Support ticket from the dashboard (plan-dependent priority) | status.supabase.com | |
| Vercel | Web hosting | Support from the dashboard | vercel-status.com | |
| Resend | Email delivery | Support from the dashboard | resend-status.com | |
| AI model provider (D11) | Lenore and document reading | _the chosen provider's support_ | _its status page_ | |
| ElevenLabs | Voice (opt-in beta) | Support from the dashboard | status.elevenlabs.io | |

## What is monitored

Failures are recorded in `public.ops_events` (`supabase/migrations/20261104091000_ops_monitoring.sql`): a
kind, a short code, a redacted one-line detail, the page's path and the intake's id. Never contents: no
answers, file names, messages, addresses or links.

| Kind | Recorded by | Codes you will see |
|---|---|---|
| `app_error` | The browser: the error boundary (`render_error`), uncaught errors (`window_error`), unhandled rejections (`unhandled_rejection`) | |
| `upload_failed` | The browser: storage refusing a file (`storage_upload:<status>`), the document row not saving (`record_insert:<sqlstate>`), a stored file or row not deleting (`storage_remove`, `record_delete:<sqlstate>`), `document-extract` never answering (`document_read_unreachable`, `document_read:<status>`) | |
| `ai_failed` | `chamber-extract` and `document-extract` when the provider fails (`<kind>:<status or ->`: `timeout:-`, `network:-`, `provider_error:503`, `rate_limited:429`, `credits:402`, `invalid_response:-`) or isn't configured (`config_missing`); the browser when `chamber-extract` never answers (`chat_unreachable`, `chat:<status>`) | |
| `auth_denied` | The browser: a signed-in non-advisor on an advisor page (`advisor_route`), the database refusing an advisor read (`advisor_forbidden`) | |
| `deletion_failed` | `fail_intake_deletion` when a deletion has used every attempt | `storage_remove:<status>`, `files_remain:<n>`, `rpc_files:<code>`, `rpc_complete:<code>`, `unexpected` |

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

Alerts that come from elsewhere:

| Alert | From | Playbook |
|---|---|---|
| `OUTBOX_DEAD` (webhook and log) | `dispatch-outbox`, when a notification email gives up | `docs/NOTIFICATIONS.md`, "Operating" |
| `DELETION_FAILED` (webhook and log) | `purge-intakes`, when a deletion gives up. The same failure also raises `OPS_ALERT kind=deletion_failed` within five minutes, so expect both | [Deletion failed](#deletion-failed) |

Log lines to know (fixed fields only, never names, paths, messages or provider text):

| Line | From | Means |
|---|---|---|
| `OPS_ALERT kind=… count=… window=…m threshold=… codes=…` | `ops-monitor` | A kind crossed its threshold; `OPS_ALERT_UNDELIVERED kind=…` if the webhook refused it |
| `OPS_CONFIG_MISSING: …` | `ops-monitor` | The webhook is unset or not an https URL, so alerts are only logged |
| `OPS_MONITOR_ERROR: …` | `ops-monitor` | It couldn't claim alerts (`rpc_claim:<code>`) or failed unexpectedly |
| `OPS_EVENT_NOT_RECORDED kind=… source=… reason=…` | `chamber-extract`, `document-extract` | An AI failure couldn't be recorded (the prospect's answer was not affected) |
| `DELETION_DONE deletion=… intake=… files=… rows=…` | `purge-intakes` | A deletion finished. Keep these: "After a restore" needs them |
| `DELETION_RETRY deletion=… intake=… attempt=… reason=… retry_in=…s` | `purge-intakes` | An attempt failed; tried again after 5 minutes, 30 minutes, 2 hours, then 6 hours |
| `DELETION_FAILED deletion=… intake=… attempts=… reason=…` | `purge-intakes` | Out of attempts: an operator is needed |
| `DELETION_ERROR …` | `purge-intakes` | A failure couldn't even be recorded; the claim lapses after 10 minutes and is retried |
| `PURGE_CONFIG_MISSING: …`, `PURGE_ERROR: …` | `purge-intakes` | Missing secrets, or the run stopped early (`rpc_claim:<code>`, `unexpected`) |
| `AI_CALL_FAILED`, `AI_CONFIG_MISSING`, `AI_UNEXPECTED_ERROR` | `chamber-extract`, `document-extract` | Provider failures, as recorded in `ops_events` |

### How alerts reach people

- **The webhook.** Set `ENGINEERING_ALERT_WEBHOOK_URL` (a Slack or Teams incoming webhook, https) in the
  function secrets. `dispatch-outbox`, `purge-intakes` and `ops-monitor` all post to it. Without it, alerts
  are only log lines, and `ops-monitor` logs `OPS_CONFIG_MISSING` to say so.
- **The log lines.** Every alert is also a fixed-field log line (`OPS_ALERT`, `OUTBOX_DEAD`, `DELETION_FAILED`).
  As a second path, set up a Supabase log alert or a log drain on them, so a broken webhook doesn't silence
  everything.
- **What it can't see.** Refusals that never reach the browser or a function (PostgREST 401/403 answers to
  direct API calls, failed sign-ins, Auth rate limits) are in Supabase's API and Auth logs, not in
  `ops_events`. Check them in every authorization incident, and weekly until launch (Logs Explorer: API logs
  filtered on status 401 and 403; Auth logs filtered on failed sign-in).
- **Uptime.** Add an external uptime check on the site's home page and `/start`. Nothing in the repository
  does this.

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
-- expect dispatch-outbox (every minute), ops-monitor (*/5), purge-intakes (:23 hourly),
-- expire-idle-intakes (:17 hourly) and run-retention (03:41 daily)
select jobname, status, return_message, start_time
from cron.job_run_details join cron.job using (jobid)
order by start_time desc limit 20;
select status_code, created from net._http_response order by created desc limit 20;  -- the HTTP-calling jobs
```

The HTTP-calling jobs do nothing until Vault holds `project_url` and `service_role_key`
(`docs/SUPABASE_SETUP.md`). Once a month, record one test event and watch the alert arrive:

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

1. By code: `storage_upload:413` or `:415` means the bucket refused a size or type the browser allowed: check
   the bucket limits (`select id, file_size_limit, allowed_mime_types from storage.buckets`) against
   `src/lib/uploadCheck.ts`. `storage_upload:5xx` or `storage_remove`: Supabase Storage, check its status.
   `record_insert:<sqlstate>`: the documents table refused the row (a migration or policy change).
   `document_read_unreachable`: `document-extract` not deployed or crashing (function logs).
2. Prospects keep their files in their own hands: nothing is lost by a failed upload. Ask affected prospects
   (by intake id) to try again once fixed.

### AI failures

`OPS_ALERT kind=ai_failed`, and `AI_CALL_FAILED` / `AI_CONFIG_MISSING` lines in the `chamber-extract` and
`document-extract` logs.

1. By code: `timeout`, `provider_error:5xx`: the provider is down or slow (its status page). `rate_limited`,
   `credits`: our account's limits or billing. `config_missing`: `AI_PROVIDER` or the provider key is unset
   or wrong (`docs/SUPABASE_SETUP.md`). `chat_unreachable`: the function itself isn't answering.
2. If the provider is down for long, switch `AI_PROVIDER` to the other supported provider and set its key
   (`docs/SUPABASE_SETUP.md`). Both functions read the one setting, so no code change is needed.
3. Prospects can always fill the workspace by hand ("Continue manually"); say so if advisors are asked.

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
