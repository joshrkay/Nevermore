# An owner may end a future-dated membership sooner

`keep_membership_history` (20261116160000) refused every change to a membership row except setting an open end date, so "a membership is never changed" held with no exception. `keep_firm_owner` allows a membership to carry a future end date, and CRM-P1.5 says such a membership can be removed or suspended now. Under the old rule the update raised a permission error, which the members page showed as "you are not an owner".

20261116220000 replaces the function. The identity of the row (id, firm, person, role, team, start) still never changes, and a membership that has already ended is never touched. The one new allowance: a membership whose end date is still in the future may have that date moved earlier, to no earlier than now. History is only ever shortened to the present, never rewritten into the past, so who could see what on a given day is still answerable.

## Considered Options

- **Leave the rule and end such a membership by deleting it and adding another.** Rejected: a membership is never deleted.
- **Let removal write the end date from a function that bypasses the trigger.** Rejected: a second route past the history rule is one more thing to keep in step.

## Consequences

- `remove_member` and `suspend_member` also answer "not a member" (PT404) when someone else ended the membership between the call starting and its row lock, not a permission error.
- Two more changes of this story, recorded here because they follow from the same rule that a stored credential and a sent alert must follow membership: the people an alert was first prepared for are stored on the outbox row (`first_recipients`), never cleared, and every retry goes to those who are still members (D-35); when none is, to the current members under a new key (D-102). A stored mailbox is guarded by one lock per person and an hourly cleanup deletes those of people whose last membership ran out by date alone.
