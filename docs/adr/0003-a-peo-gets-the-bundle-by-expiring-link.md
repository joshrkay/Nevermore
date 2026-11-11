# A PEO gets the submission bundle by an expiring link, not as attachments

When the product sends a submission to a PEO (Epic M, joshrkay/Nevermore#92, gated on QP-D1), the email carries the advisor's cover note and a link to the bundle. It carries no files. Decided 2026-11-11.

The bundle holds the census: every employee's facts, classified Restricted (`docs/DATA_HANDLING.md`). An attached file can't be taken back. It stays in the PEO contact's mailbox after a prospect withdraws that PEO's market authorization, after a newer version is certified, and when the address was mistyped.

## The rule

- The link is unguessable and expires 30 days after it is issued. Anyone holding it can download until then, so a PEO contact can forward it to their underwriter.
- Every download is recorded and shown on the quote request's timeline.
- Sending a newer certified version revokes the old link and issues a new one. Withdrawing the quote request, or the prospect withdrawing that PEO's market authorization, revokes it.
- A reply from the product (M-3.5) sends the intake's documents the same way, not as attachments.
- The message's From shows the advisor's name at one product sending address. Reply-To is the quote request's reply address, so every answer lands on the thread. The advisor's own email address is not in the message.

## Considered Options

- **Attach the files.** What advisors do by hand today, and what a PEO desk expects. Rejected: nothing can be recalled, large bundles reach the email provider's size limit, and `dispatch-outbox` would have to carry files (it sends text and HTML only).
- **A link plus a one-time code emailed to the contact.** Rejected: stronger against a misdirected email, but an underwriter the contact forwards to can't open it.
- **A link with no expiry.** Rejected: old versions and withdrawn submissions would stay downloadable.
- **A link by default, attachments for a PEO that refuses links.** Not chosen now: two mechanisms and a setting per PEO before any PEO has refused.

## Consequences

- A table of download tokens and a function that serves the bundle to whoever holds a live one, with no sign-in. It is the first place the product gives Restricted data to someone without an account, so it needs its own rate limit and a place in `docs/SECURITY_REVIEW.md`.
- The outbox needs no attachment support.
- A PEO desk that won't follow links can't be served. If the pilot shows that, reopen the per-PEO override.
- After 30 days a PEO that is still underwriting has to ask for a new link.
