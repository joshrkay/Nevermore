# Brokers send through their own Google or Microsoft mailbox, with send-only permission

When the product sends a submission to a PEO (Epic M, joshrkay/Nevermore#92; ADR 0003), the message goes out through the broker's own **connected mailbox** (GLOSSARY.md), so it is from their real address. Decided 2026-11-11, on the founder's direction. It replaces the sender rule in ADR 0003 (the advisor's name at one product address).

A PEO desk deals with people it knows. A message from a Nevermore address reads as bulk mail, and the broker's own Sent folder never shows what went out in their name.

## The rule

- **Send only.** The product asks Google for the `gmail.send` permission and Microsoft for the equivalent send permission, and nothing that reads a mailbox. It never reads, lists or searches a broker's mail.
- **Replies reach the thread by the reply address.** Because the product can't read the mailbox, every message sets Reply-To to the quote request's reply address first and the broker's own address second (ADR 0004). A plain Reply goes to both. Some older mail systems honour only the first address, which is why the thread's comes first.
- **Connecting happens at sign-in.** A new broker sign-in page (not the prospect's) carries "Sign in with Google" and "Sign in with Microsoft", and asks for send permission with the sign-in. A broker who declines the permission still gets an account, and sends by hand from their own mail with the reply address in CC, as Part A already supports. The prospect sign-in page is unchanged: no employer is ever asked to let the product send as them.
- **Existing advisors.** Signing in with Google or Microsoft with the same verified email links to their existing account. The password still works, so a locked Google or Microsoft account is not a lock-out.
- **The advisor role by domain.** A person who signs up on the broker page gets the advisor role without an admin only if their organisation is on an allowed list; otherwise the account waits for an admin, as today. The list is matched on what the provider vouches for, not on the email text, because a Microsoft tenant's administrator can put any address in a token: Google by its verified hosted domain, Microsoft by its tenant ID. A free-mail domain such as gmail.com can never be on the list.
- **The token is kept server-side and is disposable.** The product stores the refresh token that lets it send, encrypted, readable only by the sending function and never by the browser. It refreshes access tokens itself (Supabase does not store or refresh a provider's tokens). Disconnecting, the broker leaving, or Google or Microsoft revoking the permission deletes it, and a send then fails with a plain message and falls back to sending by hand.
- **A send through the mailbox is recorded as one.** The product has the provider's message id but no delivery events: a bounce arrives as an email in the broker's own inbox. The thread shows a send as sent, never as delivered or bounced. Delivery and bounce marks (M-3.4) apply to mail the product sends itself, such as the notification to advisors.

## Status

Sign-in (M-4.1) and keeping and refreshing the permission (M-4.3) are built. The `mailbox` function connects, checks and
disconnects a broker's mailbox, and `getMailboxAccess` (`supabase/functions/_shared/mailbox.ts`) is what the sending story
(M-2.1) will call for an access token; it deletes a token the provider took back and says plainly why a send can't go
through. Nothing sends through the mailbox yet, and no Google or Microsoft app is configured. The allowed-organisation rule
(M-4.2) is built: an admin's list at `/advisor/organisations`, matched on Google's verified domain or Microsoft's tenant ID and never on the
email text, granting `advisor` only and logging every grant. The claim names Supabase keeps for each provider have not been
observed; the rule grants nothing if they differ.

_Note, 2026-11-18:_ story CRM-P1.4 retired that platform-wide list, its page `/advisor/organisations` and the function `claim_advisor_role_by_organisation`. Each firm now lists its own organisations and an owner approves each person who asks to join from one (the match on Google's verified domain or Microsoft's tenant ID is unchanged). The paragraph above is kept as the record of what was decided then.

## Considered Options

- **The product sends from a Nevermore address in the broker's name** (ADR 0003's earlier rule). Kept only as what a broker with no connected mailbox falls back to by hand. Rejected as the main path: it isn't their address.
- **Send from the broker's own domain through Resend.** Works for the advisory's own domain with a one-time DNS change, but not for a free-mail address, and the message isn't in the broker's Sent folder. A reasonable fallback if connecting mailboxes proves too heavy; not chosen.
- **Send and read.** The product would read replies out of the inbox and need no reply address. Rejected: it asks for access to a broker's whole mailbox, Google treats it as a restricted permission that needs a yearly security assessment, and the reply address is already built.
- **Ask for send permission later, when the broker first sends.** Rejected by the founder: one step at sign-in.
- **Grant the role to anyone who signs up.** Rejected: the console shows every submission to every advisor, so it would show every employer's data to anyone.

## Consequences

- **Google's app status.** I believe an app left in Google's "testing" status has its mailbox permission expire after seven days. It needs either an "internal" app limited to the advisory's own Google Workspace (no review, own team only) or Google's verification, which a send-only app needs but without the security assessment (`gmail.send` is a sensitive, not restricted, permission; Google exempts apps with under 100 accounts). Outside brokers (Epic P) need verification. This has not been confirmed against Google's current rules and has to be before anything is released.
- **Microsoft.** The sign-in app has to be registered with the right account types, and a tenant's administrator may have to approve the send permission. Not yet researched.
- **A new kind of data.** A token that can send email as a person. It needs its own entry in `docs/DATA_HANDLING.md` and `src/data/dataPolicy.ts`, and Google requires the Privacy Policy to say how that access is used, so counsel's list gains a line (`docs/LEGAL_REVIEW.md`).
- **No delivery events for these sends**, so an advisor learns of a bounce from their own inbox. M-3.4's bounce marks shrink to the product's own mail.
- **The sending path is built once**, through the connected mailbox. A broker without one sends by hand, so the product does not also need a Nevermore-address sender.
- **Three stories are added to Epic M**: broker sign-in with Google and Microsoft, the allowed-organisation rule, and storing and refreshing mailbox tokens. They are new work, not yet sized or designed beyond this record.
