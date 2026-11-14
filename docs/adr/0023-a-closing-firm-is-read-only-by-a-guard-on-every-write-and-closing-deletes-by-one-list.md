# A closing firm is read-only by a guard on every write path, and closing deletes by one list

Status: accepted. Builds on ADR 0021 (a suspended firm) and D-18 (the database is the lock). Settles CRM-P1.7.

## Context

An owner asks to close the firm and for 30 days it must be read-only: members still sign in and read, and nothing of the firm's can be changed, added, sent or deleted by a member, at the database and not only by hiding buttons. Suspending a firm already stops its members by changing the one membership question every policy and function asks (`firm_role`). That cannot be reused: a closing firm's members must still be members, because they read.

Writes to a firm's data are not table policies. Apart from one policy (a note on an intake), every write by a member is a SECURITY DEFINER function, and each of them calls its own authorisation helper, which reads and writes share. No helper is asked by writes alone.

## Decision

A new question, `firm_is_read_only(firm)`, and one guard, `assert_firm_writable(firm)`, which refuses a current member of a closing firm with "This firm is closing and can't be changed" (PT423) and does nothing for anyone else, so nobody learns from it that a firm is closing. Every function that changes a firm's data calls the guard first, with the firm it is about. A trigger does the same for the one table policy (a note on an intake). `supabase/tests/close_a_firm.sql` tries each path as the person who would use it, and also fails when a function the API roles can run that inserts, updates or deletes is in neither its list of guarded functions nor its list of exemptions with a reason, or when a guarded function's source stops asking the guard (a later restatement from an older definition would otherwise drop it silently, D-104).

What closing deletes is one list, `firm_closing_plan()`: every table registered as a firm's data in `data_isolation.sql` is either deleted (with its firm column and order) or kept, with the reason. The closing reads the list and deletes exactly what it names. A story that adds a firm table adds one line and the isolation test fails until it does.

Closing ends memberships with the one mechanism every other ending uses (`end_membership_now`). Two triggers keep their rules (a firm keeps one current owner; a membership is never changed) with one exception each, which exists only while `close_firm_now` runs for a firm whose request is open and past its 30 days.

## Consequences

- A suspended firm still closes when its 30 days pass (the clock keeps running), and its owners cannot withdraw, because they get nothing while it is suspended.
- A firm's address is held for 12 months from the day it closed. The firm's row stays for good, so `sign_up_firm` releases the address, by giving the old row a placeholder address, only when a new firm asks for it after the 12 months.
- Closing writes nothing to the firm's own record: no owner is left to read it, and the platform's record (`firm_closures`) holds when, by whom and a count per table, without content.
- After closing, the address looks like one no firm holds (D-27). This is the rule D-27 and ADR 0021 left for closed firms.
