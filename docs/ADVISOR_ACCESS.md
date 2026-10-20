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

## What prospects see

`prospect_submission_status()` returns the latest status we chose to share, for the caller's own
certified intake only: `submitted`, `under_review`, `information_requested`. Carrier routing,
quotes, outcomes and archiving stay internal (the product tells prospects they send the packet
themselves).

## Tests

`supabase/tests/advisor_operations.sql` checks each resource as signed out, guest, prospect and
advisor. Run it against a scratch Postgres (it drops `public`):

```sh
psql -v ON_ERROR_STOP=1 -f supabase/tests/advisor_operations.sql
```
