# Held mail and the advisor alert belong to firms

ADR 0004 gave the platform two shared things: a holding list that "an admin sees", and an Advisor Alert, and a new-PEO-mail notice, that go to one distribution list (`ADVISORY_NOTIFY_EMAIL`). With firms (D-5, D-15, D-16, D-18) neither can stay platform-wide. This amends 0004 on those two points only; everything else in it stands.

- **Held mail is addressed to a firm** when its reply address once belonged to one (a revoked address) or one of the firm's own members moved it off a thread. That firm's current members read it, as they read the thread it came from. Mail to an address nobody ever held belongs to no firm and is read by no one. A platform admin is a member of no firm (D-16), so reads none of it: they see which messages wait, why, since when, and the File ID and PEO of the quote request an address belonged to, never a sender, subject, text or file name. They still assign or discard. Held mail addressed to a firm can be assigned only to a quote request of that same firm; mail of no firm can go to any.
- **The advisor alert and the new-PEO-mail notice go to the current members of the firm the intake belongs to**, looked up each time one is built or resent, so a member who leaves stops receiving at once. `ADVISORY_NOTIFY_EMAIL` is no longer who an alert goes to; the bounce webhook still never suppresses those addresses.

## Considered Options

- **Keep the platform list and filter in the mail.** Rejected: every firm's alerts would still reach every platform advisor.
- **Give held mail of unknown address to the first firm.** Rejected: it would show a stranger's mail to a firm it was never addressed to.
- **Make the new-mail mark and the mailbox per firm too.** Rejected: the mark is one for the firm's members, as CRM-H1 says ("clears for everyone who can see it"), and is scoped by its quote request already. A mailbox is one person's own credential (one per person) that works only while its owner is a current member of a firm.

## Consequences

- A firm with no current member that has an email address gets no alert: the event waits and retries (`no_recipients`), and dies visibly on the Outbox page.
- The Held mail page still reads the table directly and so shows a platform admin nothing; the console story (P-1.4) moves it onto `admin_held_mail()` and `admin_assignable_quote_requests()`.
- When records have owners (D-15), who is told follows who can see the record.
