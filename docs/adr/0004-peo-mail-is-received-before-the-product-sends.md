# The product receives PEO mail before it may send any

Epic M (joshrkay/Nevermore#92) is gated on QP-D1: whether the product may send a submission to a PEO, which counsel has not answered. On 2026-11-11 we decided that receiving doesn't wait. Each quote request gets a reply address and a thread, built on the email provider already in use, while D9 and D44's "the product sends nothing to a PEO" stays true.

## Update: counsel answered QP-D1

Later on 2026-11-11 the founder reported counsel's answer: yes, the product may send, with no conditions beyond supplying the wording. Receiving still comes first, now for a different reason: it depends on nothing else, while sending waits on the market authorization (M-1.1), the bundle (L-3.4) and counsel's wording for the authorization, the new intake consent, the Terms and the line every message to a PEO carries. Where this record says "before counsel answers", read "before sending is built". Counsel's yes was about sending; storing PEO mail is still unreviewed, so the setting that switches receiving off stays.

## Status

Receiving (M-3.2) is built, and ships switched off: the `receive-mail` function answers 503 until `PEO_MAIL_RECEIVING` is `on` (`docs/RUNBOOK.md`, "PEO mail not arriving"). A message to an address that is revoked, was never issued, or names two quote requests is stored as held rather than dropped. An attachment that can't be scanned yet stays pending and unreadable. The thread view (M-3.4) is built: the PEO threads panel on the submission page, with the team-wide "new PEO mail" mark and the combined timeline. The holding list (M-3.3) is built: an admin sees held mail at `/advisor/held` and assigns or discards it, an advisor can move a message off a thread, a message nobody places is deleted 30 days after it was held, and one ops alert is raised when the list stops being empty. The `held-mail` function moves a message's files with it, and removes them before the rows of a discarded or expired message.

## The rule

Built before counsel answers: quote request notes (M-2.5), the reply address (M-3.1), receiving mail (M-3.2), the holding list (M-3.3), the thread on the submission page (M-3.4) and the email telling advisors that mail arrived (M-3.6). Everything that sends to a PEO waits: M-1.1, M-1.2, M-2.1 to M-2.4 and M-3.5.

How mail gets onto a thread until the product sends:

1. The advisor records the send on the quote request, as today. That creates the quote request and its reply address. There is no status for a quote request that hasn't been sent.
2. The advisor copies the address and sends the packet from their own mail client with the address in CC.
3. Their message arrives at the address and is stored as sent by hand. The PEO's reply-all arrives there too.

A message to a live address joins its thread whoever sent it, because an underwriter usually answers from another address than the sales contact's. A sender not seen on that thread before is marked as new, and an advisor can move a message to the holding list. A message to a revoked or unknown address goes to the holding list and is never attached by guesswork; one nobody assigns is deleted after 30 days. Any advisor can revoke and reissue an address.

An arriving message changes nothing but the thread: the advisor still records a quote or a decline. It sends one email to the Advisor Alert recipients with the File ID, the PEO's name and a link that needs sign-in, and none of the message's content.

Thread messages and their attachments are kept as long as the intake and deleted with it.

## The details

Settled story by story on 2026-11-11:

- **The address.** File ID, the PEO's short name and an unguessable part, on a subdomain of nevermorepeo.com, so an advisor can see it is the right one before pasting it. It keeps receiving after the quote request closes, until the intake is deleted or an advisor revokes it.
- **What is shown.** The plain-text body, with earlier quoted messages collapsed. No HTML from outside is rendered.
- **Attachments.** The upload rules apply: the same file types, up to 20 MB, scanned first. Another type, or a larger file, is listed by name and size as not kept. A file that fails its scan is blocked; the message and its clean attachments stay readable.
- **The holding list.** Mail to a never-issued address is held like mail to a revoked one. Only admins assign or discard. One ops alert is raised when the list stops being empty. No sender gets a reply.
- **Knowing mail arrived.** Mail a person at the PEO wrote sends the email to the Advisor Alert recipients and sets a "new PEO mail" mark on the quote request and on its submission in the queue, until any advisor opens the thread. The mark is one for the team. An automatic reply and an advisor's own copied-in message do neither.
- **The timeline.** Messages, attachments, sends, status changes and quote request notes. Corrections to a quote request's fields stay in its change log. A combined timeline shows every PEO's entries for one submission, each labelled with its PEO.
- **Quote request notes.** A note never records a send or changes a status, can be corrected with the change logged, and can be added to a closed quote request.

## The provider (QP-D9)

Resend, which already sends. It receives mail for a subdomain and signs an `email.received` webhook. The webhook carries metadata only, so the function fetches the body, headers and attachments with a second call. Inbound mail gets its own subdomain, so the sending domain's mail routing is untouched.

## Considered Options

- **Wait for counsel with the whole epic.** Rejected: receiving sends nothing, and until it exists a PEO's reply sits in one advisor's mailbox where the team can't see it.
- **Only quote request notes before counsel.** Rejected for the same reason.
- **Capture only replies, through Reply-To.** Rejected: the thread would hold answers without what they answer, and setting Reply-To by hand is awkward in most mail clients.
- **BCC the address.** Rejected: the PEO never sees it, so replies miss the thread.
- **A "preparing" status, so the address exists before a send is recorded.** Rejected: a new status in the queue and the glossary to avoid a quote request reading "sent" for the minute before the email goes.
- **Hold mail from senders who aren't a known contact.** Rejected: most underwriters' replies would wait on an admin.

## Consequences

- Counsel has not reviewed the product storing PEO mail. If counsel objects, receiving is switched off and the stored mail deleted, so it ships behind one setting.
- D44 said a quote holds no attachment. Quote documents now arrive on threads as attachments, scanned before anyone can open them (D13, ADR 0002), which changes D44 before counsel answers on sending.
- Resend now receives mail that can hold an employer's details and a PEO's pricing. `docs/DATA_HANDLING.md`, `src/data/dataPolicy.ts`, the service provider list and a new Privacy Policy line (we keep correspondence with PEOs about a submission) say so in the same release. The Privacy Policy line is put to counsel as its own question, apart from QP-D1.
- The address in CC is visible to the PEO, and anyone it is forwarded to can write to the thread. That is why it can be revoked and why a new sender is marked.
- Until the product sends, a thread is only as complete as the advisor's habit of copying the address in.
