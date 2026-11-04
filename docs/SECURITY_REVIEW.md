# Authorization and data-isolation review (US-6.3)

What was tested, at which layer, what it found, and what was done about each finding. Every finding is
either fixed or formally accepted below; nothing is left open. Re-run everything with the commands at the end.

## Scope and method

| Layer | What runs | Where |
|---|---|---|
| Database (the access control itself) | Stock PostgreSQL 16 with Supabase's roles, `auth` and `storage` schemas mirrored by `e2e/stack/bootstrap.sql`, then **every** migration, unmodified. Each caller is the real API role (`anon`, `authenticated`, `service_role`) with its JWT claims, so row security, grants, triggers and function privileges are the ones production runs. | `supabase/tests/data_isolation.sql` |
| HTTP | The requests the browser's Supabase client sends, through the gateway's stand-ins for Supabase Auth and PostgREST, against the same database. | `e2e/data-isolation.spec.ts` |
| Code | Static checks that private files are only reached through short-lived signed links. | `src/lib/fileLinks.test.ts` |

Callers: signed out (`anon`), two guests (anonymous auth), two email-verified prospects, an advisor, an admin, the
advisor's own account presenting a guest token, and the service role. Each guest and prospect has real data:
an agreement to the intake consent, intakes in every status (open, certified, expired, archived by "Start over",
revoked), documents with stored files, certifications and their outbox emails; the advisor has worked one
submission (status change, note, field review, a stored Manuscript version); there are monitoring events and an
alert, a pending deletion request, an email bounce, and AI rate-limit records.

**Not covered here** (see SR-9 and SR-10): real Supabase Auth, PostgREST and Storage. In particular a signed
link's expiry is enforced by the Storage server, which isn't in this stack. The launch checks below cover it on
the real project.

## What the tests prove

### Guests cannot access other guest sessions

For each of three intakes (two guests' and a prospect's), every other caller, knowing the intake's id, with
their own token or none:

- reads nothing of it: the row (answers, conversation, provenance), its documents, its stored files (which is
  what Storage checks before it signs a link), its certification, its owner's consent and profile;
- changes nothing: answers, conversation, owner, documents, file names, certification, profile; deletes nothing;
- attaches nothing: no document row in their own name or the owner's, no stored file in their own folder or the
  owner's, no consent recorded for the owner;
- learns nothing from the functions that take an intake id: archiving answers `PT404` (as for an id that doesn't
  exist), the shared status and the consent lookup answer null.

The owner can do each of these (positive controls, rolled back), so the refusals are row security at work. A file
planted in one guest's folder under another guest's intake is readable by neither. Over HTTP, guest B reading,
changing or deleting guest A's intake by id gets `[]`, attaching a document gets 403, archiving gets 404, and a
forged token gets 401; A's intake is unchanged afterwards.

Closed intakes, from their owner: an archived or revoked intake, its documents and its files are no longer
readable or changeable, and nothing can be added. An expired one is readable (so the Chamber can say it expired)
but its answers, status and document rows can't change and nothing can be added; its documents can still be
removed (SR-14).

### Prospects cannot access advisor records or documents

Prospects and guests see none of: advisor notes, field reviews, review events, pipeline status and history,
stored Manuscript versions (rows or files), lifecycle events, outbox emails, email delivery events and
suppressions, monitoring events and alerts, deletion requests, AI rate-limit records, or anyone else's roles. They
can't write any of them. Every advisor-only and admin-only function refuses them with `42501`. The one thing they
are meant to see, the shared status of their own submission, they do.

### Advisors access only authorized operational data

Advisors read every intake, certification, document, consent and the advisor-side records (decision D16,
SR-7), and nothing beyond: not monitoring events or alerts (admin only), not the AI rate-limit tables, not other
people's roles. They can't change a prospect's answers, conversation, documents, files, profile, certification
or consent; can't delete anything, including their own notes, history and recorded Manuscripts; can't grant,
change or revoke roles; can't revoke intakes, ask for deletions or read monitoring (admin only); and can't run any
service-only function. The advisor's account presenting a guest token is treated as a guest.

### Private file links can't be reused indefinitely or shared as permanent public URLs

- All three buckets (`documents`, `manuscripts`, `quarantine`) are private, no migration creates or flips one to
  public, and no API caller can change or add a bucket. `quarantine` has no policies at all: no signed-in caller
  can read, list, sign a link to, store or delete anything in it.
- Nothing in the app or the edge functions asks for a public URL.
- Links are signed in exactly one place (`signedUrl` in `src/lib/advisorApi.ts`) with `SIGNED_URL_SECONDS` = 60.
  Storage signs a link only for a caller whose row security lets them read the file, which the matrix above
  checks for every caller.
- The two places that open a link (`DocumentsPanel`, `ManuscriptPanel`) hand it straight to the browser to
  download. It is never stored (local or session storage, IndexedDB), put in the app's own URL or router state,
  or logged.
- Every link asks for `Content-Disposition: attachment` under a cleaned name (`downloadName`), so the browser
  saves the file instead of showing it. Storage doesn't sign that request, so it could be stripped from a link;
  every document is therefore also stored as `application/octet-stream`, which a browser downloads whatever the
  link says. `fileLinks.test.ts` holds both.
- A document's file is readable only once its malware scan passed (`scan_verdict` clean or skipped, written by the
  service role only): until then it is in `quarantine`, or, for an upload from before scanning, withheld by the
  `documents` read policies (`is_withheld_document_file`). `document_scanning.sql` covers both, and that a prospect
  can't store a file directly or record a verdict.

### The checks can't quietly fall behind

`data_isolation.sql` fails when:

- `supabase/migrations` holds a migration the test doesn't load;
- a public table lacks row security, or isn't in the matrix;
- a function the API roles can execute isn't in the allowlist (with its audience and reason), or the allowlist
  names one that's gone; signed-out callers can run anything beyond the `anyone` functions; the SECURITY DEFINER
  functions they can run are anything but `has_role`, `is_advisor` and `report_client_event`;
- a trigger function is executable by an API role;
- a bucket is public, or there's a third bucket;
- an API role holds TRUNCATE, REFERENCES or TRIGGER on a public table, or any privilege on the AI rate-limit
  tables, including on a table created after the fixes;
- a SECURITY DEFINER function doesn't pin its `search_path`.

It was checked against deliberate breakage, each of which it caught: a permissive SELECT policy on intakes; an
advisor-readable policy on monitoring events; a storage policy that drops the intake check; a permissive UPDATE
policy; `run_retention` granted to signed-in users; an unlisted table; a public bucket; a trigger function
re-granted to `anon`; TRUNCATE re-granted; the AI tables re-granted; a new SECURITY DEFINER function; and the fix
migration left out. The HTTP spec fails with a permissive SELECT policy. `fileLinks.test.ts` fails with a 3600 s
expiry.

## Access matrix (rows each caller sees)

`own` is the caller's own rows; `all` is every row; blank is none.

| Data | Guest / prospect | Advisor | Admin | Service role |
|---|---|---|---|---|
| Intakes (`chamber_sessions`), not archived or revoked | own | all | all | all |
| Certifications, documents, `documents` bucket (a file only once its scan passed) | own | all | all | all |
| `quarantine` bucket | | | | all |
| Profiles | own | all | all | all |
| Roles (`user_roles`) | own | own | own | all |
| Intake consents | own | all | all | all |
| Pipeline status and history, notes, field reviews, review events, Manuscript versions, `manuscripts` bucket | | all | all | all |
| Lifecycle events, deletion requests | | all | all | all |
| Monitoring events and alerts | | | all | all |
| Outbox, email delivery events and suppressions, AI rate-limit records | | | | all |
| Storage buckets (the list) | | | | all |

## Findings

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| SR-1 | Low | Every trigger function in `public` was executable by `anon` and `authenticated` (Supabase grants EXECUTE on new functions by default), including the SECURITY DEFINER `handle_new_user`. Not exploitable: Postgres refuses to call a trigger function outside a trigger, and PostgREST doesn't expose them. | **Fixed** in `20261104093000_security_review_fixes.sql`: EXECUTE revoked from PUBLIC and the API roles on every trigger function. A trigger fires regardless of its function's EXECUTE privilege; the test shows a new account still gets its profile and prospects' writes still fire every trigger. |
| SR-2 | Low | `require_advisor()` was executable by signed-out callers. It only raises, so nothing leaked. | **Fixed** in the same migration: revoked from `anon`; kept for `authenticated`, because `advisor_list_submissions` ran as the caller and called it. `20261104114000_paged_advisor_queue` made that function run as its owner and revoked it from `authenticated` too: every caller is now SECURITY DEFINER. |
| SR-3 | Medium | `anon` and `authenticated` held TRUNCATE, REFERENCES and TRIGGER on public tables. TRUNCATE ignores row security entirely. PostgREST can't issue TRUNCATE, so it wasn't reachable, but any future raw-SQL path would have been a total loss. | **Fixed** in the same migration: revoked on every table, and from the default privileges for tables created later. The test checks both. |
| SR-4 | Low | The AI rate-limit tables (`ai_request_log`, `ai_ip_log`, `ai_global_usage`) granted SELECT, INSERT, UPDATE, DELETE and TRUNCATE to the API roles, refused only by row security with no policy. | **Fixed** in the same migration: every privilege revoked from the API roles. Only SECURITY DEFINER functions touch them. |
| SR-5 | Low | A prospect could still change their document rows (category, status, extraction) on an expired intake, which the lifecycle migration says can no longer change. | **Fixed** in the same migration: the documents UPDATE policy needs an open intake (in progress or submitted), as uploads already did. |
| SR-6 | Low | `consume_ai_quota(per_minute, per_day)` is callable directly by any signed-in user with limits of their choosing. It only ever spends the caller's own allowance (the AI functions call it with fixed limits), so the effect is a caller adding rows to their own rate-limit log. | **Accepted** (BE). The rows are the caller's own and are pruned daily for everyone by `run_retention()` (`20261104092000`). Revisit at M3 if the AI functions move to a service-role budget. |
| SR-7 | Medium | Every advisor sees every intake, certification, document and consent (decision D16). Least privilege would scope an advisor to assigned submissions. | **Accepted for the pilot** (PM). Small named advisory team, read-only access, access reviewed quarterly (`docs/RUNBOOK.md`). Revisit before M3. |
| SR-8 | Medium | A prospect can write `documents.status`, `category` and `extraction` on their own open intake (plan E-4.3): `document-extract` writes them with the prospect's token, so the policy must allow it. A status therefore can't carry a malware-scan verdict, and the extraction an advisor sees is only as trustworthy as the prospect. | **Accepted, tracked as E-4.3** (BE). The values are the prospect's own data, and the prospect confirms every applied value anyway. Fix with E-4.3: move `document-extract`'s writes to the service role, then restrict the prospect's UPDATE to `category` and the applied-fields marker with column privileges. |
| SR-9 | Low | The tests run on stock Postgres with Supabase's `auth` and `storage` schemas mirrored (`e2e/stack/bootstrap.sql`) and a gateway standing in for PostgREST and GoTrue, not on Supabase itself. A difference between the mirror and Supabase (a storage policy helper, a default grant) would not show here. | **Accepted** (QA). The policies, grants and triggers under test are the migrations' own; the mirror follows Supabase's images. Mitigated by the launch checks below on the real project. |
| SR-10 | Medium | A signed link's 60-second expiry is enforced by Supabase Storage, which isn't in the test stack. The code always asks for 60 seconds (`fileLinks.test.ts`), but expiry itself is untested. The link is opened by navigating to it, so it can appear in the browser's download list until it expires. | **Accepted until the launch check passes** (OPS, M2): expiry confirmed on the real project, below. A link that expired is worthless, and only advisors can obtain one. |
| SR-11 | Low | Anyone, signed-out visitors included, can send browser failure reports (`report_client_event`). An abuser can raise false alerts, or use up the hourly caps (30 per account, 200 shared by signed-out visitors, 2,000 overall) so real browser reports are dropped for up to an hour. Reports are redacted and capped, so nothing can be stored through it. | **Accepted** (OPS). Edge-function reports (AI failures, deletions) don't go through it and are unaffected; the runbook says to check `source = 'browser' AND user_id IS NULL` first when an alert looks wrong. Revisit at M3 with a per-address cap. |
| SR-12 | Low | `anon` keeps Supabase's default SELECT, INSERT, UPDATE and DELETE grants on `chamber_sessions`, `documents` and `profiles`; only row security (policies for `authenticated`) refuses it. | **Accepted** (BE). The matrix and the HTTP spec show a signed-out caller reads and changes nothing. Revoking would turn the `[]` the app gets for a signed-out read into a 401 and needs the pages checked first; revisit with SR-7. |
| SR-13 | Low | Advisors can upload any file to the `manuscripts` bucket under any intake's folder. Only a call to `record_manuscript_version` (which checks the path and the certification) makes it a version; an unrecorded upload can be removed by advisors. | **Accepted** (PM). Advisors are trusted staff; prospects never read that bucket. |
| SR-14 | Info | The owner can still remove documents (rows and files) from their expired draft. | **Accepted by design**: it only removes the prospect's own data ahead of the retention deletion (US-6.1). |
| SR-15 | Medium | A file upload could pass its policy check while an intake existed, commit after `complete_intake_deletion` had checked for files, and be left stored with no intake to delete it again. Nothing stopped new uploads once a deletion was asked for, in either bucket. (Pull request review.) | **Fixed** in `20261104092000_data_retention_and_deletion.sql`: both upload policies call `intake_accepts_files`, which refuses once a deletion is open and holds a share lock on the intake row until the upload commits; the deletion's `FOR UPDATE` waits for it, then sees the file (`EA006`, retried). A document row is refused too (`EA007`). `data_retention.sql` covers the refusals; the two-session interleaving was checked by hand (the deletion waits on an open upload, then refuses while its file remains). |
| SR-16 | Low | Intake consent was required for the document row but not for the file, which the browser stores first: a tab opened before the consent change, or a direct Storage call, could store a file with no agreement and no row. (Pull request review.) | **Fixed**: the documents upload policy requires an agreement to the version in force (`20261104090000_intake_consent.sql`, kept in `20261104092000`). `intake_consent.sql` covers it. |
| SR-17 | Low | A deletion whose worker was killed or timed out on every attempt was reclaimed for ever: only `fail_intake_deletion` enforced the attempt limit and raised the alert. (Pull request review.) | **Fixed**: `claim_intake_deletions` first moves lapsed claims with every attempt used to `failed` (`worker_lost`) and records a `deletion_failed` event, so ops-monitor alerts. `data_retention.sql` covers it. |

No finding is open. Re-test evidence for each fixed finding is the catalogue and closed-intake checks in
`data_isolation.sql`, which fail with the fix migration left out.

## Launch checks on the real project (M2)

Run once on the production project, and again after any change to storage or auth settings; record the result
and date here.

1. **Signed link expiry (SR-10).** Sign in as an advisor, open a submission and click **Open** on a document.
   Copy the download address from the browser's download list, wait 70 seconds and request it again
   (`curl -i '<link>'`). Expect an error (Storage answers 400 with an expired-token message), not the file.
2. **Buckets.** Storage → Buckets: `documents`, `manuscripts` and `quarantine` all show as private, and
   `documents` and `quarantine` allow only `application/octet-stream`, up to 20 MB.
3. **Cross-account read over the real API.** With two real guest sessions, guest B's
   `GET /rest/v1/chamber_sessions?id=eq.<guest A's intake id>` answers `[]`, and with only the anon key it
   answers `[]`.
4. **Supabase's security advisor.** Database → Advisors → Security shows no table without row security and no
   function with a mutable search path.
5. **Uploads go through the check.** With a guest's token, `POST /storage/v1/object/documents/<their user
   id>/<their intake id>/x.pdf` with any file is refused (403); `document-upload` refuses a program renamed
   `.pdf` (415, `executable`) and quarantines the EICAR test file (`docs/RUNBOOK.md`, "Malware detected").
   Strip `&download=...` from a document link an advisor opens: the browser still downloads the file.

| Check | Date | By | Result |
|---|---|---|---|
| 1. Signed link expiry | | | |
| 2. Buckets private | | | |
| 3. Cross-account read | | | |
| 4. Security advisor | | | |
| 5. Upload checks | | | |

## Re-running

```bash
PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh data_isolation
```

```bash
npx vitest run src/lib/fileLinks.test.ts
```

```bash
npm run test:e2e -- e2e/data-isolation.spec.ts
```

CI runs all three: the `sql-tests` job runs every file in `supabase/tests`, `verify` runs `npm test`, and `e2e`
runs every spec.

When you add a migration, add it to the list at the top of `data_isolation.sql` and bump the count after it.
When you add a table or bucket, add a row to its `matrix`; when you add a function the API roles can execute, add
it to `callable` with its audience and reason (and, for an advisor or admin function, a call that must be
refused).
