# The console asks for a membership, and the advisor role stays the platform's

Until firms, the console opened for the platform roles `advisor` and `admin`. A person who signs a firm up (CRM-P1.1) or is invited to one (CRM-P1.2) holds neither, and a platform admin, who is no member of any firm (D-16), held a console that showed them nothing. Story P-1.4 makes the console ask what the database already asks of every row: is the caller a current member of a firm.

Two checks change, and one deliberately does not.

- `require_advisor()`, the first line of every console function, now also passes a current member of a firm (past the second factor, D-19). Each of those functions already filters by the row's firm (CRM-P2.1b), so a member with no platform role is let in and sees only their own firm's rows.
- `advisor_needs_second_factor()` is also owed by a current member with no platform role, so the redirect to the second factor reaches them as it reaches a role holder.
- `is_advisor()` is **not** widened. It is what the PEO catalogue, its contacts and its census templates are read through. Widening it would give the owner of a firm that is still waiting for approval a read of every PEO's contacts. Those stay with the platform role, and the isolation matrix proves a member with no role reads none of them.

The screens ask `my_firms()` (the firms the caller currently belongs to and their role in each) and not a role, and a platform admin who is not a member reaches only the platform's pages.

## Considered Options

- **Widen `is_advisor()` to include a membership.** Rejected: it opens platform-wide data (PEO contacts) to any firm member, including one whose firm no admin has approved. The isolation matrix said the opposite and was left as it was.
- **Grant the `advisor` role to every member when they join.** Rejected for the same reason, and because the role would then outlive the membership.
- **Leave the database alone and change only the screens.** Rejected: a member with no role would pass the screen and be refused by every function behind it, which is the state of every firm founder today.

## Consequences

- A member with no platform role cannot read the PEO tables, so the PEOs page loads the prospect-safe catalogue through `peo_catalog()` (ADR 0010): the version in use of each PEO, no draft, history or contact. The table-backed directory and the editor stay for the platform roles. The PEO columns of a submission still read what a prospect sees.
- Referral partners are a firm's own since CRM-P2.1c (20261116200000): a member with no platform role lists, adds and edits their firm's partners through `require_advisor()` and nothing else. The partners page's choice of which firm it acts for is CRM-P2.1c's follow-up.
- A person who belongs to several firms is kept out of the console for now: the database answers for every firm they belong to, so the console would show the firms together. The workspace shell (Epic 2) is where one firm at a time is chosen. Narrowed by ADR 0015: at a firm's own address the current firm is that address's firm, and only the bare domain keeps a member of several out. Reversed by ADR 0016: at a firm's address the database answers for that firm alone, so a member of several firms is let into every page there; on the bare domain they choose a firm.

- A broker's mailbox is a current member's: `mailbox_store()` asks for a current membership and no longer for a platform role, and the mailbox function asks `my_firms()` (membership and second factor) rather than `is_advisor()`. Deleting a stored mailbox when the person's last membership ends is CRM-P1.5.
- Owner access is the caller's role at the console's current firm (`currentFirm()` in `src/lib/currentFirm.ts`, the same rule as the member guard), not ownership of any firm: the guard, the Activity link and the Activity page agree, and the Activity page offers no firm selector at a firm's address.
- Removing a platform role deletes the stored mailbox only when the person is also no current member of a firm (20261116210600 replaces `drop_mailbox_without_role()`).
