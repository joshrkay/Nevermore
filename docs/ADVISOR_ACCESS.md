# Advisor access

Advisor pages live under `/advisor`. The UI guard (`RequireAdvisor`) only decides what to render;
the database enforces access (`supabase/migrations/20261022090000_advisor_operations.sql`).

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

Revoke it with the matching `DELETE`. Guest (anonymous) sessions never count as advisors.

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
- Change the pipeline status only through `set_submission_status()`, which appends to
  `submission_status_history` (who, when, from, to, note).
- Add internal notes (`advisor_notes`); notes can't be edited or deleted and prospects can't read them.
- Generate Manuscript versions into the private `manuscripts` bucket. A version is recorded only
  for a certified intake, against the latest review state; recorded files can't be overwritten
  or deleted. Prospects can't list or download stored versions.

## The submission queue (`/advisor`)

One row per intake, from `advisor_list_submissions()`: company, contact, state footprint (operating
states plus census work states), employee count, reference (file id), certification date, pipeline
status and completeness. The list carries no census, payroll, DOB, EIN, phone, email or transcript
content; those are on the detail page, behind the same checks.

- **Order**: certified submissions first, newest certification first; intakes not (or no longer)
  certified follow, most recently active first; session id breaks ties so the order never shuffles.
- **Status filter** runs in the database. **Search** (company, contact, reference; every word must
  match) narrows the loaded list in the browser. Both live in the URL (`?status=`, `?q=`).
- A click anywhere on a row opens that submission; the company link works for keyboard and new tabs.
- Loading, empty (none yet / none with this status / no search match) and error states are all shown.

## What prospects see

`prospect_submission_status()` returns the latest status we chose to share, for the caller's own
certified intake only: `submitted`, `under_review`, `information_requested`. Carrier routing,
quotes, outcomes and archiving stay internal (the product tells prospects they send the packet
themselves).

## Tests

`supabase/tests/advisor_operations.sql` runs against a scratch Postgres (it drops `public`,
`auth` and `storage`):

```sh
createdb scratch && psql -d scratch -v ON_ERROR_STOP=1 -f supabase/tests/advisor_operations.sql
```

It has two parts. The first walks the advisor workflow (roles, status, notes, reviews, versions).
The second is an **access matrix**: every protected data type read as each kind of caller
(signed out, guest, prospect A, prospect B, advisor, admin, and an advisor presenting a guest
token), with the exact row count each should see.

| Data type | Prospect | Advisor / admin |
|---|---|---|
| `chamber_sessions`, `chamber_certifications`, `profiles`, `documents`, `documents` bucket | own rows only | all rows, read-only |
| `user_roles` | own roles | own roles (nobody can grant, change or revoke through the API) |
| `submission_workflow`, `submission_status_history`, `advisor_notes`, `advisor_field_reviews`, `advisor_review_events`, `manuscript_versions`, `manuscripts` bucket | nothing | all rows; changed only through the advisor functions |

It also checks that every advisor function refuses non-advisors and is not executable by
signed-out callers, that direct writes to advisor tables are refused for everyone, that nobody
(advisors included) can edit or delete a prospect's own records, and, as a catalogue check, that
**every table in `public` has row security on**, so a new table can't ship unprotected.

When you add a table or storage bucket that holds submission data, add a row to `specs` in the
matrix; when you add an advisor function, add it to the catalogue check.

The browser side (guard, sign-in notices, session states, queue) is covered by `npm test`.
