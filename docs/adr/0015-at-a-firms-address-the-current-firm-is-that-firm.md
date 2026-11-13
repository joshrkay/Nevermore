# At a firm's address the current firm is that firm, whatever other firms the person belongs to

Status: accepted. Narrows one consequence of ADR 0014 ("a person who belongs to several firms is kept out of the console").

## Context

ADR 0014 kept a member of several firms out of the whole console. The guard did so even at a firm's own address, so an owner of Alpha and Beta at Beta's address was refused the owner-only Activity route and the header hid its link, although the Activity page resolves that address to Beta and checks Beta.

## Decision

At a known firm address the current firm is that address's firm. The person must be a current member of it; the role that counts is the one they hold there (a member route asks for a membership, an owner route for the role owner at that firm). The refusal "member of several firms" now applies only where there is no firm address to choose by, the bare domain. `currentFirm()` is the one place that says so, and the guards, the header's links and the badge all ask it.

## Consequences

- The database still narrows each answer to the firms a person belongs to, not to the one an address names (D-18). A member of two firms at one firm's address therefore has pages that may list the other firm's records too until the workspace shell (Epic 2) makes the database answer for one firm. Owner-only access is not affected: it is decided by the role at the address's firm.
- A person who is an agent at Alpha and an owner at Beta is refused Activity at Alpha's address and reaches Alpha's member pages.
