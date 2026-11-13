# A suspended firm shows its members a suspended page; its name and sign-in still show

Status: accepted. Changes one sentence of D-27 ("a suspended or closed firm's address looks the same as one no firm holds") for suspended firms only.

## Context

D-27 said that when firms can be suspended or closed, such a firm's address would look the same as one no firm holds: a plain not-found page. A suspended firm is not gone, though. Its people need to learn why they are shut out and whom to ask, and the suspension is lifted again, so the address stays the firm's. Story CRM-P1.8 asks for a page that says the firm is suspended and to contact Nevermore, with a working sign-out.

## Decision

A suspended firm's address still shows the firm's name and sign-in, as a waiting firm's does. A signed-in current member of a suspended firm sees "<Firm name> is suspended", to contact Nevermore, and a sign-out, and nothing of the firm: no console, no lists, no counts. They learn it through `my_suspended_firm_at_address`, which answers true only for a current member of that firm, so a stranger learns nothing about the firm's state. A person who is not a member still sees "You aren't a member of this firm". A closed firm (CRM-P1.7) keeps D-27's wording: it looks like an address no firm holds. A refused firm still behaves as D-31 says.

Suspension is separate from the approval decision. A firm waiting for approval can be suspended; it stays waiting (still in the approvals list, still decidable) and gains the suspended state, which is the smallest answer. A refused firm can be suspended too, and nothing changes that anyone can see.

The lock is in the database, not the screen: `firm_role`, the one question every table policy and firm-scoped function asks (D-18), answers "not a member" for a suspended firm, and the two functions that list a person's memberships leave it out. The screen only chooses what to show.

## Consequences

- A suspended firm's members, on the bare domain, are told they belong to no firm (their console asks the database for their firms and a suspended one is not among them), not that their firm is suspended. Only the firm's own address says so.
- A platform admin who is also a current member of a firm cannot suspend or lift it (the same rule as deciding on it).
- The platform's record of each suspension (`firm_suspensions`) keeps the reason, which the firm never reads; the firm's own record shows only that Nevermore suspended or lifted (D-33).
