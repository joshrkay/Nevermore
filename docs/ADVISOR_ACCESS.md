# Advisor access

Advisor pages live under `/advisor`: the Advisor Console, which is the team's operating workflow
(no CRM; its field mapping and ownership rules are in `docs/ADVISOR_CONSOLE.md`). The UI guard
(`RequireAdvisor`) only decides what to render; the database enforces access
(`supabase/migrations/20261022090000_advisor_operations.sql`).

| Route | Audience | Enforced by |
|---|---|---|
| `/advisor` | Advisor or admin | `advisor_list_submissions()` refuses non-advisors (42501) |
| `/advisor/submissions/:id` | Advisor or admin | Row security on every table it reads; advisor-only functions for every write |

## Roles

Roles are `advisor` and `admin` (admin includes advisor access), stored in `public.user_roles`.
Nobody can grant themselves a role: the table has no write policy or grant for app users.

Grant a role from the Supabase SQL editor (service role):

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'advisor' FROM auth.users WHERE email = 'advisor@example.com';
```

Or, once the account has signed up and confirmed its email:
`npm run setup:supabase -- --project-ref <ref> --grant-advisor advisor@example.com`
(`docs/SUPABASE_SETUP.md`). Revoke it with the matching `DELETE`. Guest (anonymous) sessions never count as advisors.

## Sign-in, sign-out and session states

Every way into an advisor page ends somewhere that says what happened:

| Situation | What the advisor sees |
|---|---|
| Signed out, or only a guest session | Redirect to the advisor sign-in, which returns them to the page they asked for |
| Signed out on purpose | Sign-in page with "You've been signed out." The page is *not* remembered: the next person to sign in may be someone else, and lands on the queue |
| Session ended on its own (refresh token expired, or sign-out in another tab) | Sign-in page with "Your session expired. Sign in again to continue." and a return to the same page |
| The server rejects the token mid-use (`PGRST301`-`303`, "JWT expired") | "Your session has expired." The app ends the session and takes them to sign-in as above |
| Signed in but not an advisor | "Advisor access required", with a way home or to another account |
| Role revoked while signed in (database refuses with `42501`) | "You no longer have advisor access.", no retry offered |
| Anything else (network, timeout) | "We couldn't load …" with the reason and Try again |

`useAuth().sessionEnded` is `"signed_out"` or `"expired"`; Supabase reports both as `SIGNED_OUT`, so
a sign-out the app asked for is remembered until the event arrives.

## What advisors can and can't do

- Read every intake, certification, profile and uploaded document. They cannot change a
  prospect's answers; corrections are stored in `advisor_field_reviews` beside them, and every
  review change is appended to `advisor_review_events`.
- A review belongs to the answer it was made on. `review_submission_field()` takes the answer the
  advisor's page shows and refuses (`PT409`, HTTP 409) if the intake now says something else; the page then
  reloads. When the prospect changes a reviewed answer (editing after certifying, or certifying
  different answers), a trigger resets that field's review to unreviewed, keeps any correction as an
  unapproved proposal, marks the field "the prospect changed this answer (it was …)" until an advisor
  reviews it again, and appends an `answer_changed` event naming the prospect and both answers. Reviews
  of unchanged answers are kept. Reviews recorded before migration `20261104110000` weren't checked
  against the answer they were made on.
- Change the pipeline status only through `set_submission_status()`, which appends to
  `submission_status_history` (who, when, from, to, note). An intake the prospect has never certified
  can only be archived. What the prospect does is in the history whatever status an advisor set:
  every certification and every withdrawn certification is a row (a re-certification sent as one
  update too). A prospect who certifies while the status is `information_requested` has answered it,
  so it returns to `submitted`; a first certification enters as `submitted` even from `archived`. Any
  other advisor-set status stays as it is (migration `20261104111000`).
- The pipeline moves one step at a time (migration `20261104122000`). `set_submission_status()` refuses
  (22023, naming the stages it can move to) any move that `pipeline_next_statuses()` doesn't list for the
  current stage, and the Status panel offers only those:

  | From | An advisor can move it to |
  |---|---|
  | `draft` | `archived` (until the prospect certifies) |
  | `submitted` | `under_review`, `information_requested`, `lost`, `archived` |
  | `under_review` | `information_requested`, `ready_for_market`, `lost`, `archived` |
  | `information_requested` | `under_review`, `lost`, `archived` |
  | `ready_for_market` | `under_review`, `information_requested`, `sent_to_carrier`, `lost`, `archived` |
  | `sent_to_carrier` | `information_requested`, `quoted`, `lost`, `archived` |
  | `quoted` | `sent_to_carrier`, `won`, `lost`, `archived` |
  | `won`, `lost` | `archived` |
  | `archived` | `submitted` (reopen; not for an intake the prospect never certified) |

  So an archived file is reopened as `submitted` and reviewed again, never sent straight back to
  `under_review`, and information that arrives after a request is reviewed again before the file goes
  to market. The prospect's own moves above (certifying, withdrawing) are not limited by this list.
  `ready_for_market` is internal, like every stage after it: the prospect keeps the last status we share.
- Review the evidence as certified. Certifying stamps a copy of the transcript and of the document
  list (name, category, size, storage path, SHA-256) into the submission; the detail page shows that
  transcript (and says if the prospect's conversation changed since) and marks documents removed,
  added, renamed or re-categorised after certification. Every document change is appended to
  `document_events` (who, when; advisors only, nobody can change it). While an intake is certified,
  a certified document's stored file stays when the prospect removes the document, so it can still
  be opened; the prospect's screen still shows it removed (migration `20261104112000`). A document
  counts as the certified one only while it has the certified file: a row re-created under the same id
  with another file shows as the certified one removed and a new one added. Once the certification
  moves on (the prospect withdraws or certifies again), a kept file is no longer listed in the app;
  its `removed` event records its path, and purging such files is retention's job (H-1.2).
- "Certified at least once" (which unlocks every move but archiving, and decides whether a certification is the
  intake's first) means a certification row or a history row that reached `submitted`, so intakes
  certified before certification rows existed count (migration `20261104115000`).
- Add internal notes (`advisor_notes`); notes can't be edited or deleted and prospects can't read them.
- Read `intake_lifecycle_events`: every draft that expired, was archived by its prospect ("Start
  over") or was revoked, with who and why. The queue lists those intakes with their intake status
  (`expired`, `archived`, `revoked`).
- Admins only: revoke a draft that was never certified with
  `select public.revoke_chamber_session('<session id>', '<reason>');` run as the admin (an admin's
  JWT through the API; there is no screen yet). The prospect loses all access to it and its
  documents, and the revocation is recorded with the reason. See `docs/intake-schema.md` →
  "Session lifecycle".
- Read every intake consent record (`intake_consents`) and every deletion record (`intake_deletions`), and list
  submitted records past their retention window (`retention_review_due()`).
- Admins only: ask for an intake to be deleted, rows and stored files
  (`request_intake_deletion('<session id>', '<reason>')`), put a failed deletion back in the queue
  (`retry_intake_deletion('<deletion id>')`), and read operational monitoring (`ops_events`, `ops_alerts`,
  `admin_ops_summary(hours)`). No screen yet; `docs/DATA_HANDLING.md` and `docs/RUNBOOK.md` have the recipes.
  Advisors can't read monitoring data or the AI rate-limit tables.
- Generate Manuscript versions into the private `manuscripts` bucket. A version is recorded only
  for a certified intake, against the latest review state and the certification it was built from:
  `record_manuscript_version()` requires the certification's `data_sha256` and `certified_at` as the
  page loaded them, and refuses (`PT409`) if the prospect has certified again since, so a version never
  claims a certification its PDF doesn't show. Recorded files can't be overwritten or deleted.
  The latest version, while it was built from the prospect's current certification, is their **final
  Manuscript**: `prospect_final_manuscript()` offers it to them (their own intake only) and a storage
  policy lets them read that one file. Correction reasons are printed in it, so they're
  prospect-visible. The panel marks the shared version and any built from an earlier certification
  (migration `20261104113000`).

## The submission queue (`/advisor`)

One row per intake, from `advisor_list_submissions()`: company, contact, state footprint (operating
states plus census work states), employee count, File ID, certification date, pipeline
status and completeness. The list carries no census, payroll, DOB, EIN, phone, email or transcript
content; those are on the detail page, behind the same checks.

- **Order**: certified submissions first, newest certification first; intakes not (or no longer)
  certified follow, most recently active first; session id breaks ties so the order never shuffles.
- **Status filter**, **search** (company, contact, File ID; every word must match, any case) and
  **paging** (25 a page, with the total) all run in the database; the function reads as its owner
  after its advisor check, so a large table doesn't run the row-security check per row. Search starts
  once typing pauses. All three live in the URL (`?status=`, `?q=`, `?page=`); changing the filter
  or the search returns to the first page.
- **Completeness** describes what the advisor reviews: a certified intake is described from its
  certified copy, a required item supplied by a verified advisor correction isn't missing, and only
  fields an advisor can review count as unconfirmed (migration `20261104114000`).
- A click anywhere on a row opens that submission; the company link works for keyboard and new tabs.
- Loading, empty (none yet / none with this status / no search match / past the last page) and error
  states are all shown.

## What prospects see

`prospect_submission_status()` returns the latest status we chose to share, for the caller's own
certified intake only: `submitted`, `under_review`, `information_requested`. Carrier routing,
quotes, outcomes and archiving stay internal (the product tells prospects they send the packet
themselves). `information_requested` is shown only while it is the status: once the advisor moves
on, the prospect is told an advisor is reviewing their submission, never left being asked to act.

Once an advisor has generated a version from the prospect's current certification, the Manuscript
page offers it as the final Manuscript to send. Their own copy, built in the browser, is labelled
"As certified, before advisor review" on screen and in its PDF.

## Tests

`supabase/tests/advisor_operations.sql` runs against a scratch Postgres (it drops `public`,
`auth` and `storage`). `supabase/tests/run.sh` gives every SQL test its own throwaway database and
is what CI runs (the `sql-tests` check):

```sh
PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh advisor_operations
```

The first part walks the advisor workflow (roles, status, notes, reviews, versions); later blocks
cover the pipeline following the prospect, the certified evidence, the final Manuscript, and queue
completeness, search and paging. One part is an **access matrix**: every protected data type read as each kind of caller
(signed out, guest, prospect A, prospect B, advisor, admin, and an advisor presenting a guest
token), with the exact row count each should see.

| Data type | Prospect | Advisor / admin |
|---|---|---|
| `chamber_sessions`, `chamber_certifications`, `profiles`, `documents`, `documents` bucket | own rows only | all rows, read-only |
| `user_roles` | own roles | own roles (nobody can grant, change or revoke through the API) |
| `submission_workflow`, `submission_status_history`, `advisor_notes`, `advisor_field_reviews`, `advisor_review_events`, `document_events`, `manuscript_versions` | nothing | all rows; changed only through the advisor functions and triggers |
| `manuscripts` bucket | their final Manuscript's file only | all files; added only by advisors, never changed |

It also checks that every advisor function refuses non-advisors and is not executable by
signed-out callers, that direct writes to advisor tables are refused for everyone, that nobody
(advisors included) can edit or delete a prospect's own records, and, as a catalogue check, that
**every table in `public` has row security on**, so a new table can't ship unprotected.

When you add a table or storage bucket that holds submission data, add a row to `specs` in the
matrix; when you add an advisor function, add it to the catalogue check.

The browser side (guard, sign-in notices, session states, queue) is covered by `npm test`.
