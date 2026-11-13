# The console asks for a membership, and the advisor role stays the platform's

Until firms, the console opened for the platform roles `advisor` and `admin`. A person who signs a firm up (CRM-P1.1) or is invited to one (CRM-P1.2) holds neither, and a platform admin, who is no member of any firm (D-16), held a console that showed them nothing. Story P-1.4 makes the console ask what the database already asks of every row: is the caller a current member of a firm.

Two checks change, and one deliberately does not.

- `require_advisor()`, the first line of every console function, now also passes a current member of a firm (past the second factor, D-19). Each of those functions already filters by the row's firm (CRM-P2.1b), so a member with no platform role is let in and sees only their own firm's rows.
- `advisor_needs_second_factor()` is also owed by a current member with no platform role, so the redirect to the second factor reaches them as it reaches a role holder.
- `is_advisor()` is **not** widened. It is what the PEO catalogue, its contacts and its census templates are read through, and what the two referral-partner functions ask until CRM-P2.1c scopes them. Widening it would give the owner of a firm that is still waiting for approval a read of every PEO's contacts. Those stay with the platform role, and the isolation matrix proves a member with no role reads none of them.

The screens ask `my_firms()` (the firms the caller currently belongs to and their role in each) and not a role, and a platform admin who is not a member reaches only the platform's pages.

## Considered Options

- **Widen `is_advisor()` to include a membership.** Rejected: it opens platform-wide data (PEO contacts) to any firm member, including one whose firm no admin has approved. The isolation matrix said the opposite and was left as it was.
- **Grant the `advisor` role to every member when they join.** Rejected for the same reason, and because the role would then outlive the membership.
- **Leave the database alone and change only the screens.** Rejected: a member with no role would pass the screen and be refused by every function behind it, which is the state of every firm founder today.

## Consequences

- A member with no platform role cannot read the PEO catalogue, so the PEOs page and the PEO columns of a submission fall back to what a prospect sees until a later story decides whether a firm's members read the catalogue. That decision is the founder's, not this story's.
- Referral partners stay with the platform role until CRM-P2.1c gives them a firm.
- A person who belongs to several firms is kept out of the console for now: the database answers for every firm they belong to, so the console would show the firms together. The workspace shell (Epic 2) is where one firm at a time is chosen.
