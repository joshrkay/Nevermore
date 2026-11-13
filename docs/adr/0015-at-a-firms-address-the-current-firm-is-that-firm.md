# At a firm's address the current firm is that firm, whatever other firms the person belongs to

Status: accepted. Narrows one consequence of ADR 0014 ("a person who belongs to several firms is kept out of the console").

## Context

ADR 0014 kept a member of several firms out of the whole console. The guard did so even at a firm's own address, so an owner of Alpha and Beta at Beta's address was refused the owner-only Activity route and the header hid its link, although the Activity page resolves that address to Beta and checks Beta.

## Decision

At a known firm address the current firm is that address's firm. The person must be a current member of it; the role that counts is the one they hold there (a member route asks for a membership, an owner route for the role owner at that firm). `currentFirm()` returns that firm and whether the person belongs to several. The member guard keeps refusing "member of several firms" (the member pages do not filter by the address); only the owner guard, the Activity link and the badge accept it, because the Activity page checks the address's firm itself. On the bare domain there is no address to choose by, so several firms is refused everywhere. `currentFirm()` is the one place that says so.

## Consequences

- The database still narrows each answer to the firms a person belongs to, not to the one an address names (D-18). A member of several firms therefore stays out of the member pages (queue, submission, funnel, outbox, partners) until the workspace shell (Epic 2) makes the database answer for one firm, as ADR 0014 accepted. Owner-only access is decided by the role at the address's firm.
- A person who is an agent at Alpha and an owner at Beta is refused Activity at Alpha's address and is kept out of the member pages as a member of several firms.
