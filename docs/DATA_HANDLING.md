# Data handling: classification, retention and deletion

How Edgar Allan Advisory classifies the prospect data it holds, how long it keeps each kind, how it deletes
it, and who on the advisory team is responsible for what (US-6.1, plan H-1.1 to H-1.3).

> **Draft (decision D4).** The windows below are recommended defaults. LEGAL confirms them before launch
> (`docs/LEGAL_REVIEW.md`). Until then they are what the product enforces and what the Privacy Policy states.

One policy, kept in step in three places:

| Where | What it is | Kept in step by |
|---|---|---|
| `src/data/dataPolicy.ts` | The policy as the product states it: levels, data classes, retention rules | `src/data/dataPolicy.test.ts` (every table and bucket the migrations create is classified) |
| `/privacy` (`src/pages/PrivacyPage.tsx`) | The policy as prospects read it, rendered from `dataPolicy.ts` | It is rendered from the same module |
| The database | The windows it enforces: `intake_draft_retention()`, `closed_draft_retention()`, `submitted_record_retention()`, `ops_event_retention()`, `email_event_retention()` | `src/data/schemaSync.test.ts` (each function's `sync:` block equals `RETENTION`) |

This document is the same policy written for the advisory team. When they disagree, `dataPolicy.ts` and the
database are what runs. Fix this document to match, or change all three (see "Changing the policy").

## Sensitivity levels

| Level | What belongs here | How it is handled |
|---|---|---|
| **Restricted** | Personal information about the prospect's employees: who they are, dates of birth, pay, benefits, dependents and injuries, and anything that holds it (uploaded files, the conversation with Lenore, the Manuscript). | Only the prospect who provided it and our advisors can open it, and the database enforces that. Never put it in email, chat, tickets, alerts, logs, analytics or a link. Stored only in the private database and private buckets; files open through links that expire after 60 seconds. Dates of birth are masked on the Manuscript unless an advisor reveals them for the task at hand, and a version generated with them revealed is recorded as such. Don't keep downloaded copies; delete a download once the task is done. |
| **Confidential** | Business and contact information about the prospect's company and the people who represent it, and the advisory team's own working records about a submission. | Prospect and advisory team only. Internal notification emails may carry the named contact fields (company, signer, title, work email, phone, headcount, state, reference) and nothing more. Shared outside Edgar Allan Advisory only by the prospect, or with the prospect's permission. |
| **Internal** | Operational records with no intake content: ids, counts, failure codes, timestamps. | Engineering and admins. Safe in a shared engineering channel: it never names a person or quotes an intake. |
| **Public** | Marketing copy, the sample Manuscript (invented data), the sourced PEO catalog. | Anyone. Keep it accurate and free of anything above this level. |

## What we hold

Every table in `public` and every storage bucket belongs to at least one class; the test fails when a new one
doesn't.

| Class | Level | Examples | Stored in | Kept | Deleted by |
|---|---|---|---|---|---|
| Contact details | Confidential | Names, titles, work emails and phones of the people who complete and sign | `chamber_sessions`, `profiles`, `chamber_certifications`, `outbox_events`; Supabase Auth (email); Resend (sent emails) | With the intake; account details until the account is deleted | The deletion process; the account separately, on request |
| Company profile | Confidential | Legal and trade names, industry, addresses, states, headcount, current PEO or benefits arrangement | `chamber_sessions`, `chamber_certifications` (the answers as each certification signed them) | With the intake | The deletion process |
| Employee census | Restricted | Each employee's name, date of birth, job title, pay, employment type, work state, coverage tier, dependents | `chamber_sessions`, `chamber_certifications` (`chamber_data.census`), `documents`, `documents` and `quarantine` buckets | With the intake | The deletion process |
| Payroll | Restricted | Pay frequency, payroll provider, annual payroll, payroll reports | `chamber_sessions`, `chamber_certifications`, `documents`, `documents` and `quarantine` buckets | With the intake | The deletion process |
| Benefits | Restricted | Plans, carriers, contributions, renewal dates, summaries and invoices (which can list employees and premiums) | `chamber_sessions`, `chamber_certifications`, `documents`, `documents` and `quarantine` buckets | With the intake | The deletion process |
| Workers' compensation records | Restricted | Class codes, experience modifier, loss runs, claims history (can describe injuries to named employees) | `chamber_sessions`, `chamber_certifications`, `documents`, `documents` and `quarantine` buckets | With the intake | The deletion process |
| Uploaded documents | Restricted | Every uploaded file and the values read from it | `documents`, `documents` and `quarantine` buckets; the AI provider while a file is read (D11); the malware scanner while a file is checked (D13) | With the intake; the prospect can remove one while the intake is open (while it is certified, the file it was certified with stays for the advisor until the intake is deleted). A file waiting for, or failing, its malware scan is kept in `quarantine`, which only the service reaches; once its document is removed, `document-scan` deletes it within five minutes | The deletion process, file before row (both buckets) |
| Conversation transcripts | Restricted | Everything typed or said to Lenore, her replies, and the evidence quotes behind captured answers | `chamber_sessions` (`transcript`, `field_provenance`), `chamber_certifications` (`field_provenance`); the AI provider per message (D11); ElevenLabs for voice (opt-in beta), which passes a call's transcript to Anthropic for Lenore's spoken replies (D42) | With the intake | The deletion process |
| Generated Manuscript PDFs | Restricted | The packet, which carries the census. The prospect's own copy is made in their browser and never stored by us; the advisor-reviewed final version is stored, and the prospect can download it | `manuscript_versions`, `manuscripts` bucket (advisor versions); the prospect's device | Advisor versions with the submitted record | The deletion process |
| Certification and consent records | Confidential | Who certified, their role, when, the wording agreed to, a fingerprint and a copy of the answers as signed; each agreement to the intake consent | `chamber_certifications`, `intake_consents` | Certifications with the submitted record; consent records until the account is deleted | The deletion process; consent records with the account |
| Advisor review and notes | Confidential | Field reviews and corrections, internal notes, pipeline status and history, the requests for information sent to the prospect (the advisor's message and the answers it names), the quote requests (the PEOs each submission went to, what each quoted or declined, and every change to that), and who changed each uploaded document and when | `advisor_field_reviews`, `advisor_review_events`, `information_requests`, `quote_requests`, `quote_request_events`, `advisor_notes`, `submission_workflow`, `submission_status_history`, `document_events` | With the intake | The deletion process (the only way the append-only history can be removed) |
| Email notifications | Confidential | Queued advisor alert, prospect confirmation, information requests and draft reminders, delivery and bounce events, the do-not-send list | `outbox_events`, `email_delivery_events`, `email_suppressions`; Resend | Queued emails with the intake; delivery events 365 days; suppressions until removed | The deletion process; the retention job; suppressions by hand |
| Accounts and access | Confidential | Accounts (guests included), profiles (including whether, and since when, the account asked for draft reminders), advisor and admin roles | `profiles`, `user_roles`; Supabase Auth | Until the account is deleted; roles reviewed quarterly (`docs/RUNBOOK.md`) | An admin, on request ("Deleting an account") |
| Lifecycle and deletion records | Internal | When a draft expired, was started over or revoked; every deletion with who asked and how much was removed | `intake_lifecycle_events`, `intake_deletions` | Lifecycle records with the intake; deletion records for good (ids and counts only) | Lifecycle records by the deletion process; deletion records are never deleted |
| Operational monitoring and abuse limits | Internal | Failure counts and codes, alerts raised, a record of each AI call (ids, codes and field names, never values), AI rate-limit counters (a one-way hash of the network address, never the address), the per-year counter that numbers File IDs | `ops_events`, `ops_alerts`, `ai_extraction_events`, `ai_request_log`, `ai_ip_log`, `ai_global_usage`, `submission_reference_counters`; Supabase and Vercel logs | Events, AI call records and daily AI totals 90 days; rate-limit records 1 day; alerts for incident review | The retention jobs; AI call records for an intake also with the intake |
| Intake progress (the pilot funnel) | Internal | Which steps each intake reached (started, first answer, a document, a census, ready to certify, a verified email, certified, The Manuscript downloaded), when, and when it started; and the referral code and campaign tags of the link it was started from, as short codes (its intake source); never an answer, a name, an address or a document | `intake_milestones`; the source codes also in `chamber_sessions` | 365 days from the intake's start, a whole start date at once; the codes on the intake itself, with the intake | `run_retention()`; deleting an intake removes its link to these rows, which stay unattached (source codes included) so the funnel still counts it |
| Referral partners | Confidential | The people and firms who refer employers: name, kind of partner, the code in their link, and which advisor added or last changed them | `referral_partners` | While we work with the partner, so past intakes' codes still name them | An admin, on the partner's request or when we stop working with them (below) |

The prospect's browser also keeps a copy of answers whose save hasn't been confirmed, for at most 7 days, in
that browser only (`src/data/intakeBackup.ts`). It also keeps the referral code and campaign tags of the last
tagged link the visitor followed, for at most 30 days, and sends them with the intake when one is started
(`src/data/intakeSource.ts`). Those codes are the same for everyone who follows the same link, so they identify
nobody.

## Retention windows

| Record | Window | Then | Enforced by |
|---|---|---|---|
| Draft (never certified) | 30 days after the last change | Expires: the prospect can no longer open it | `expire_idle_intakes()`, hourly (`expire-idle-intakes` job) |
| Closed draft (expired, "Start over", revoked) | 30 days after it closed | Deleted, rows and files | `run_retention()` daily at 03:41 UTC queues it; `purge-intakes` hourly deletes it |
| Submitted record (certified at least once) | 3 years after the latest certification | Listed for an admin to review, then deleted by request unless a legal obligation requires keeping it | `retention_review_due()`; deletion by request |
| Documents, transcripts, advisor Manuscript versions | As long as their intake | Deleted with the intake | The deletion process |
| Operational events | 90 days | Pruned | `run_retention()` |
| AI call records (`ai_extraction_events`) | 90 days | Pruned | `prune_ai_extraction_events()`, daily (`prune-ai-extraction-events` job) |
| Email delivery events | 365 days | Pruned; a suppression keeps its address | `run_retention()` |
| Intake milestones (`intake_milestones`), with their source codes | 365 days from the intake's start | Pruned, a whole start date at once | `run_retention()` |
| The last tagged link's codes, in the visitor's browser | 30 days, or until a later tagged link replaces them | Removed from the browser | `recalledSource()` in `src/data/intakeSource.ts` |
| AI rate-limit records | 1 day | Pruned | `run_retention()` (and the limiter itself, per caller) |
| Deletion records | For good | Never deleted (no intake content) | — |

A submitted record is never touched by the draft rule: `queue_retention_deletions()` only queues intakes that
were never certified. Deleted data can stay in database backups until those backups expire
(`docs/RUNBOOK.md`, "Backup and recovery").

## The deletion process

Deleting an intake removes its stored files and every row that belongs to it, files first. Files can only be
removed through the Storage API (deleting `storage.objects` rows in SQL would leave the file in the bucket),
so a deletion is a request that the `purge-intakes` edge function carries out
(`supabase/migrations/20261104092000_data_retention_and_deletion.sql`):

```
request_intake_deletion (an admin)     ─┐
queue_retention_deletions (daily job)  ─┴─► intake_deletions row, pending
purge-intakes (hourly, service role):
  claim_intake_deletions ─► intake_deletion_files ─► Storage API remove ─► list again: none left? ─► complete_intake_deletion
                                                                                └─ otherwise: fail_intake_deletion (retry with backoff; after 5 attempts: failed + alert)
```

What it guarantees:

- **Files before rows.** `complete_intake_deletion` refuses (`EA006`) while any of the intake's files is still
  stored, so no row is deleted while its file remains.
- **Only that intake's files.** It removes everything under `{owner}/{session}/` in `documents` and
  `{session}/` in `manuscripts`, nothing else. A document row that points outside its own folder (possible
  only for rows from before `20261103110001_document_storage_path`) is not followed, because that file may be
  someone else's.
- **Every row.** The intake, its documents, certifications, queued emails, pipeline status and history,
  notes, field reviews and review events, Manuscript versions, lifecycle events and AI call records, in one
  transaction.
  Monitoring events stay but no longer point at the intake. The append-only tables refuse every change except
  this function deleting the one intake it names.
- **Nothing new arrives meanwhile.** From the moment a deletion is asked for, the intake takes no new files
  or document rows (`EA007`). `document-upload` and `document-scan` store files with the service role, then
  ask `intake_accepts_files`, which waits for a deletion that is checking the intake's files: if the intake is
  gone or being deleted, the file is taken back; otherwise the deletion sees it and removes it on its next
  attempt. Either way nothing is left behind.
- **A record that it happened.** The `intake_deletions` row is kept: who asked, why, when, and how many files
  and rows of each kind were removed. Never what they contained.
- **Retries, then a person.** A failed attempt is retried after 5 minutes, 30 minutes, 2 hours and 6 hours.
  The fifth failure marks it `failed`, records a `deletion_failed` monitoring event and alerts engineering
  (`docs/RUNBOOK.md`, "Deletion failed"). A worker that is killed or times out on its last attempt is caught
  the same way on the next run (`worker_lost`), so a deletion is never retried for ever.

Not deleted with an intake: the account (Supabase Auth, `profiles`, `intake_consents`) and email delivery
events (they age out). See "Deleting an account".

### Asking for a deletion

1. **Verify the request.** It must come from the account's own email address, or be confirmed from it. Note
   how it was verified; don't record what the intake contained.
2. **Find the intakes.** In the SQL editor:
   ```sql
   select s.id, s.status, s.chamber_data ->> 'company_name' as company, s.last_activity_at
   from public.chamber_sessions s join auth.users u on u.id = s.user_id
   where lower(u.email) = lower('person@example.com')
   order by s.last_activity_at desc;
   ```
3. **Ask for each one to be deleted.** As an admin through the API (an admin's access token; there is no
   screen yet):
   ```sh
   curl -X POST "$SUPABASE_URL/rest/v1/rpc/request_intake_deletion" \
     -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" -H "Content-Type: application/json" \
     -d '{"p_session_id": "<intake id>", "p_reason": "Owner asked by email on 2026-11-04; confirmed from the account address"}'
   ```
   Or from the SQL editor, which runs as `postgres` (`request_intake_deletion` needs an admin's token, so
   insert the request directly):
   ```sql
   insert into public.intake_deletions (session_id, user_id, trigger, reason, requested_by_email)
   select id, user_id, 'request', 'Owner asked by email on 2026-11-04; confirmed from the account address', 'you@edgarallan.example'
   from public.chamber_sessions where id = '<intake id>'
   on conflict (session_id) where status <> 'done' do nothing;
   ```
   Asking again while a deletion is open returns the one already under way.
4. **Check it finished.** Within the hour:
   ```sql
   select status, attempts, last_error, files_deleted, rows_deleted, completed_at
   from public.intake_deletions where session_id = '<intake id>' order by requested_at desc;
   ```
   `done` with `rows_deleted` is finished. `failed` needs a person: fix the cause (`last_error`), then
   `select public.retry_intake_deletion('<deletion id>');` as an admin, or
   `update public.intake_deletions set status = 'pending', attempts = 0, next_attempt_at = now() where id = '<deletion id>';`
   from the SQL editor.
5. **Reply to the person** once every intake is done, and delete the account if they asked for that too.

### Deleting an account

After the account's intakes are deleted (above):

1. Supabase dashboard → Authentication → Users → the account → Delete user. This removes the profile, roles,
   consent records and AI rate-limit rows with it (foreign keys cascade).
2. Storage → `documents` → the folder named with the account's id: delete anything left in it (only files
   from before intakes existed sit directly under it).
3. If they asked, `delete from public.email_suppressions where address = lower('person@example.com');`.
   Delivery events with their address age out within 365 days.

### Removing a referral partner

Advisors can add and rename partners but not remove one, because past intakes carry the partner's code. When a
partner asks to be removed, or the team stops working with them, an admin runs, from the SQL editor:

```sql
delete from public.referral_partners where code = '<code>';
```

Intakes and milestones keep the code, which then shows as unlisted; nothing else names the partner. Tell the
partner their link no longer counts for them.

### Reviewing submitted records

Every quarter, with the access review (`docs/RUNBOOK.md`), an admin lists submitted records past their
window:

```sql
select * from public.retention_review_due();      -- as an advisor or admin through the API
-- or from the SQL editor:
select session_id, max(recorded_at) as last_certified_at, max(recorded_at) + public.submitted_record_retention() as review_due_at
from public.chamber_certifications group by session_id
having max(recorded_at) + public.submitted_record_retention() <= now();
```

For each: keep it (note why, for example an active client relationship or a legal hold, and review it again
next quarter) or ask for it to be deleted as above.

### Other copies

- **Backups.** A database backup holds data that was deleted after it was taken, until the backup expires.
  A restore can bring deleted data back; `docs/RUNBOOK.md` ("After a restore") says how to delete it again.
- **Service providers.** The AI provider (Anthropic, D11), ElevenLabs and Resend keep what they receive under
  their own terms. ElevenLabs passes a voice call's transcript to Anthropic for Lenore's replies (D42), under
  ElevenLabs' terms with Anthropic rather than ours. Their retention is part of the legal review.
- **Downloads.** A prospect's own Manuscript PDF is theirs. An advisor's download is deleted once the task is
  done (below).

## Responsibilities

| Who | Responsible for |
|---|---|
| **Data owner** (the Edgar Allan Advisory principal) | This policy and its windows; approving changes with LEGAL; deciding on submitted-record reviews and deletion requests |
| **Admins** | Carrying out deletion requests and reviews; granting and revoking advisor roles; the quarterly access review |
| **Advisors** | Handling intake data by its level (below); reporting a suspected exposure at once |
| **Engineering on call** | The jobs and functions that enforce retention and deletion; answering `deletion_failed` and other alerts (`docs/RUNBOOK.md`) |
| **LEGAL** | Confirming the windows (D4), the privacy and consent copy, the deletion-request response time and any notification duties |

Every advisor:

- Opens intake data only in the product, only for the submission they are working on. No exports, screenshots
  or copies into email, chat, tickets, spreadsheets or AI tools outside the product.
- Refers to a submission by its File ID (`EAA-…`) or intake id, never by an employee's name, in any channel.
- Reveals dates of birth only when the task needs them, and deletes any downloaded file when the task is done.
  Doesn't download to a personal device.
- Never forwards a prospect's documents to a PEO or carrier. The prospect sends the packet themselves
  (decision D9).
- Signs out on shared machines, and never shares an account.
- Reports a suspected exposure (a file sent to the wrong person, a lost device, a link where it shouldn't be)
  to the incident lead immediately: `docs/RUNBOOK.md`, SEV-1.
- Passes deletion and access requests to an admin the same working day. LEGAL sets the response time; until
  it does, answer within 30 days.

When someone leaves the advisory team, an admin revokes their role the same working day:
`delete from public.user_roles where user_id = (select id from auth.users where email = 'them@example.com');`

## Changing the policy

1. Change `src/data/dataPolicy.ts` and the database function in a new migration (keep the `sync:` block),
   together. `npm test` fails while they differ.
2. Update this document and, if the window appears in the intake consent wording (`src/data/intakeConsent.ts`),
   bump the consent version in both places so everyone is asked again.
3. Get LEGAL's approval and record it in `docs/LEGAL_REVIEW.md`.

A new table or bucket that holds anything about an intake or a person needs a class in `dataPolicy.ts`
(the test says so) and, if it belongs to an intake, a line in `complete_intake_deletion`.
