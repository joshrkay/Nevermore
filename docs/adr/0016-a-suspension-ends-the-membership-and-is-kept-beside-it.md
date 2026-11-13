# A suspension ends the membership and is kept beside it

CRM-P1.5 says suspending "does the same except that the membership is kept and can be restored". Every rule built so far (about forty table policies and functions, and the stories running beside this one) asks one question, `membership_is_current(valid_from, valid_until)`, of a row of `firm_memberships`. A suspended person has to be refused by all of them, at once, and by the ones other stories add before this one is merged.

The membership row is therefore **ended** when a person is suspended, as removing does, and `firm_member_suspensions` keeps the suspension beside it: who, the membership it ended, the role and team to give back, who suspended and when. Lifting closes the suspension and begins a new membership from that moment with the same role and team. The person is on the owner's list as suspended while a suspension is open, and a person with an open suspension cannot be given a new membership any other way (an invitation accepted, an insert): only lifting does.

This changes the story's wording in two places, and nothing else of it:

- "the membership is kept": the dated history is kept, as always, but the suspended person's row is the ended one and a later one begins on lifting, so the history reads as the person being out between the two dates, which is true.
- "withdraws their pending invitations" (removing): the invitations the person sent **stay valid**. An invitation is the firm's offer, made by an owner on its behalf; it does not lapse when the owner who typed it leaves, and withdrawing a colleague's offers would silently undo the firm's own hiring. The person can no longer list, resend or withdraw them, since those need a current owner of the firm; another owner can.

## Considered Options

- **A `suspended_at` column on the membership, and every rule told to ask for it.** Rejected: every one of the existing calls would have to be rewritten in this migration, and a policy or function another story adds after reading `membership_is_current` would let a suspended person in. A rule that has to be remembered at every call site is the one that gets forgotten.
- **A view of the current members.** Rejected: the memberships table is written by triggers, an exclusion constraint and the activity record; hiding it behind a view moves all of them.
- **Delete the suspended person's mailbox with the membership.** Rejected: a suspension is meant to be lifted, and the person would have to connect again for no reason. The mailbox stays stored and unusable (it is read only for a current member) and goes when the person's last membership of any kind ends.

## Consequences

- A suspended owner is not a current owner, so "a firm keeps at least one current owner" (`keep_firm_owner`, 20261116090000, which locks the firm row before it counts) already covers suspending the last one, and two owners suspending or removing each other at once cannot leave none.
- `firm_activity` gains the kinds `member_suspended` and `member_restored`. Removing writes the existing, until now unused, `member_removed`; the generic `member_ended` and `owner_added` that the membership trigger writes are held back for the functions of this story only.
- The mailbox is deleted by a trigger on the end of a membership, so leaving a firm (CRM-P1.6) inherits it.
