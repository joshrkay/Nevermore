# A closing firm is read-only by a guard on every write path, and closing deletes by one list

Status: accepted. Builds on ADR 0021 (a suspended firm) and D-18 (the database is the lock). Settles CRM-P1.7.

## Context

An owner asks to close the firm and for 30 days it must be read-only: members still sign in and read, and nothing of the firm's can be changed, added, sent or deleted by a member, at the database and not only by hiding buttons. Suspending a firm already stops its members by changing the one membership question every policy and function asks (`firm_role`). That cannot be reused: a closing firm's members must still be members, because they read.

Almost every write by a member is a SECURITY DEFINER function, and each of them calls its own authorisation helper, which reads and writes share. No helper is asked by writes alone. Three writes are not functions: a note on an intake (a table policy) and storing or removing a generated manuscript (two policies on `storage.objects`). The first review of this story missed the two storage policies and treated `record_manuscript_version` and three intake functions (`request_intake_deletion`, `retry_intake_deletion`, `revoke_chamber_session`) as not a member's, though each is used by a member (and by an admin who is also a member). They are guarded now.

## Decision

A new question, `firm_is_read_only(firm)`, and one guard, `assert_firm_writable(firm)`, which refuses a current member of a closing firm with "This firm is closing and can't be changed" (PT423) and does nothing for anyone else, so nobody learns from it that a firm is closing. Every function that changes a firm's data calls the guard first, with the firm it is about. A trigger does the same for the one table policy (a note on an intake). `supabase/tests/close_a_firm.sql` tries each function path, and the two storage policies, as the person who would use it. It also lists every write policy of the public schema and of `storage.objects`, each either carrying the read-only condition, guarded by the notes trigger, or exempt with a reason (the employer's own rows, a person's own profile, the retention role). It fails when a function the API roles can run that inserts, updates or deletes is in neither its list of guarded functions nor its list of exemptions with a reason, or when a guarded function's source stops asking the guard (a later restatement from an older definition would otherwise drop it silently, D-104).

What closing deletes is one list, `firm_closing_plan()`: every table registered as a firm's data in `data_isolation.sql` is either deleted (with its firm column and order) or kept, with the reason. The closing reads the list and deletes exactly what it names. A story that adds a firm table adds one line and the isolation test fails until it does.

Closing ends memberships with the one mechanism every other ending uses (`end_membership_now`). Two triggers keep their rules (a firm keeps one current owner; a membership is never changed) with one exception each, which exists only while `close_firm_now` runs for a firm whose request is open and past its 30 days.

## Consequences

- A suspended firm still closes when its 30 days pass (the clock keeps running), and its owners cannot withdraw, because they get nothing while it is suspended.
- A firm's address is held for 12 months from the day it closed. The firm's row stays for good, so `sign_up_firm` releases the address, by giving the old row a placeholder address, only when a new firm asks for it after the 12 months.
- Closing writes nothing to the firm's own record: no owner is left to read it, and the platform's record (`firm_closures`) holds when, by whom and a count per table, without content.
- After closing, the address looks like one no firm holds (D-27). This is the rule D-27 and ADR 0021 left for closed firms.

## Added by the review (CRM-P1.7 fixes)

- The default firm (Edgar Allan Advisory) can't be asked to close and `close_firm_now` refuses it: every intake is stamped with it until an intake can belong to another firm (D-101). New quote (Epic 5) must revisit this (D-121). The database tells the page whether it may offer "Close this firm" (`my_firm_closure.can_ask`).
- A suspended firm is not closed. Lifting a suspension of a firm with an open request moves its closing date to the later of the old one and seven days from the lift. A platform admin can stop a closing with a reason (`admin_stop_firm_closure`), which is a withdrawal with no person, recorded as Nevermore's (D-33). An admin still can't ask or withdraw.
- A closed firm's address is released by renaming the old row to `x.<id>`, which the table's check accepts and no sign-up can ask for (`sign_up_firm` takes ordinary addresses only), so the release can never collide with a new firm.
- The firm-row locks in asking, withdrawing and closing are gone. The closure row's lock and the time conditions order a withdrawal against the closing (a two-session test proves it), and the unique index orders two requests.
- `firm_closures` keeps who asked, withdrew or stopped as bare ids with no foreign key, so deleting an account neither erases nor blocks it.

## Added by the second review (CRM-P1.7 fixes 2): the firm's row orders everything (D-122)

Removing the firm-row locks let a request to close overtake a member's write that had already passed the guard, let a suspension land while the closing was deleting (a closed firm with an open suspension), and let an owner of a waiting firm ask while the refusal was committing. The firm's row is now the one lock that orders them:

- Every guarded write takes the row `FOR KEY SHARE` inside `assert_firm_writable` (a volatile function, so it can lock and reads a fresh snapshot), after checking the caller is a member, so a stranger neither waits nor learns anything. The notes trigger calls it. The two manuscript storage policies call `intake_folder_firm_read_only`, which takes the same lock for the caller's own firm.
- Asking takes the row `FOR UPDATE` before reading anything about the firm, so it waits for writes in flight, and a write that starts after it waits and is then refused. Closing, suspending, lifting a suspension, withdrawing and stopping take it `FOR UPDATE` before they check anything; refusing a firm already did.
- `FOR KEY SHARE` conflicts only with `FOR UPDATE`. Two members' writes never wait for each other, and a write that goes on to take `FOR NO KEY UPDATE` (inviting, the last-owner trigger) is not blocked by another write's key share, so ordinary writes cannot deadlock; a request that is waiting does not block a holder from upgrading (tested). The functions that take `FOR UPDATE` take it before any other lock and hold nothing else while they wait.
- Known limit: the file bytes a storage insert refers to are written by the storage service outside the database transaction, so a file already on its way when the request commits can still land. The lock orders the row that shows it to the firm.
- `supabase/tests/close_a_firm_races.sql` has a two-session test for each use of the lock, and each fails without its lock. `claim_outbox_events` also ends a due alert of a closed firm itself, since an alert queued during the closing's own transaction can see the firm as not yet closed.
- `my_firm_closure` says why an owner can't ask (`default_firm`, `refused`, `closing`, `not_owner`), and a failed load is shown as a failed load. A repair, run once by the migration, ends any request to close the default firm made before it was refused.
