# One firm at a time, chosen by the address

ADR 0014 (the console asks for a membership, not the advisor role) left one consequence open: a person who belongs to several firms was kept out, because every table and function answered them for all their firms at once and the console would have shown the firms' records mixed together. D-40 settles it, and this reverses that "kept out" consequence of 0014.

At a firm's address the browser sends the address with every request to the database, in the header `x-firm-address` (set once, where the Supabase client is made). PostgREST hands request headers to the database as `request.headers`; `request_firm_address()` reads the address from it and `address_admits_firm()` says whether a firm is the one holding it (a refused firm holds no address, D-31). `firm_role()`, which `is_firm_member()`, `can_see_firm_record()` and every firm rule are built on, now also asks `address_admits_firm()`. So at a firm's address a member of several firms reads, counts, changes and writes that firm's rows only, and a function that acts for "the caller's firm" (`firm_to_act_for`) acts for that firm.

The address only narrows. Membership stays the lock (D-18): a header can be sent by anyone who can make a request, so it must never grant anything, and it doesn't, because it can only remove firms from the ones the person already belongs to. A request with no address behaves exactly as before.

## Considered Options

- **Put the chosen firm in the session or the token.** Rejected: a sign-in already belongs to one address (D-27), the token is the sign-in provider's, and a claim we mint would need its own refresh and revocation. The address the page is served at is already the choice.
- **Pass the firm to every function as an argument.** Rejected: row security on the tables can't take an argument, so every table read would still mix firms, and every function's signature would change.
- **Keep members of several firms out.** Rejected by D-40: brokers who run two firms are a real case, and the workspace shell (Epic 2) is where firms are chosen.

## Consequences

- On the bare domain a member of several firms is sent to "Choose a firm" (`/choose-firm`), a list of links to each firm's address, where they sign in. At a firm's address they are let in when they are a current member of it.
- Two functions answer about the person, not a firm's rows, and are not narrowed: `my_firms()` (the person's own firms) and `is_member_of_firm_address()`. `require_advisor()` and `advisor_needs_second_factor()` are not narrowed either; every row behind them is.
- A check that refuses because the caller IS a member must not ask the narrowed helper, or another firm's address turns the refusal off. `admin_decide_firm()` ("an admin does not decide on a firm they belong to") now asks the caller's memberships directly. A later story that writes such a check does the same.
- `my_owner_firms()` is narrowed, so a page at an address offers only that firm's record of who did what.
- Only requests to the database carry the header. Server functions (invite-member, held-mail, mailbox) are called without it and so answer as on the bare domain; each acts on a firm it is given or on the caller's own data, and membership is still asked. Storage requests don't carry it either, so a signed file link is still checked by membership alone. A later story that wants either narrowed passes the header on and adds it to that function's allowed CORS headers.
- Headers that are not JSON make a firm read fail rather than be read as "no address".
