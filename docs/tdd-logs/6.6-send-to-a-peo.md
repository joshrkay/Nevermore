# TDD log: slice 6.6, M-2.1 Send to a PEO (#200)

The `tdd` skill was the first tool call of this lane. One test, seen failing for the reason named, then only the code that passes it.

| # | Test | Failing line seen | Result |
|---|---|---|---|
| 1 | `peo_send.sql` 1: a send creates the PEO's quote request with the version sent, records the message queued on its thread, and queues it | `ERROR:  function public.send_to_peo(uuid, text, text[], unknown, unknown) does not exist` | green |
| 2 | `peo_send.sql` 2: the database refuses a send to a PEO the employer hasn't authorized, and records nothing | `FAIL: a PEO never authorized is refused gave ok, expected 22023: The employer hasn't authorized TriNet ...` | green |
| 3 | `peo_send.sql` 3: a closing firm and a support session send nothing | `FAIL: a support session gave 23502: null value in column "provider_message_id" ..., expected PT423: Nevermore support can look, not change` | green |
| 4 | `peo_send.sql` 4: only an advisor of the intake's own firm sends | `FAIL: another firm's intake gave ok, expected PT404: Submission not found` | green |
| 5 | `peo_send.sql` 5: while an answer has changed and isn't certified again, sending waits | `FAIL: answers changed since certifying gave ok, expected 22023: The prospect changed an answer since certifying. ...` | green |
| 6 | `peo_send.sql` 6: an advisor with no connected mailbox sends nothing, and nothing is recorded | `FAIL: no mailbox gave 23502: null value in column "provider_message_id" ..., expected PT412: Connect your mailbox to send from here.` | green |
| 7 | `peo_send.sql` 7: a send is addressed to one to ten people at the PEO, each a bare address | `FAIL: nobody to send to gave ok, expected 22023: Address it to at least one person at Insperity.` | green |
| 8 | `peo_send.sql` 8: the subject and the cover note keep 6.2's limits | `FAIL: a subject of two lines gave ok, expected 22023: A subject is one line.` | green |
| 9 | `peo_send.sql` 9: a send waits for Ready for market | `FAIL: under review gave ok, expected 22023: Move this submission to Ready for market first. It is under review` | green |
| 10 | `peo_send.sql` 10: the send moves Ready for market to Sent to PEOs | `FAIL: Reyes Bakery is Sent to PEOs gave ready_for_market, expected sent_to_carrier` | green |
| 11 | `peo_send.sql` 11: a second send continues the PEO's quote request and its thread | `FAIL: In-Reply-To the message before gave <NULL>, expected <d38d8cb9-...@acme.example>` | green |
| 12 | `peo_send.sql` 12: after the PEO replies, the next send answers the reply | `FAIL: In-Reply-To the PEO's reply gave <5ec174f1-...@acme.example>, expected <r1@insperity.example>` | green |
| 13 | `peo_send.sql` 13: the bundle link joins the message: a fixed block under the note; the stored body never holds the token | `ERROR:  function public.attach_peo_link(bigint, bigint, text) does not exist` | green |
| 14 | `peo_send.sql` 14: only the message's own quote request's live link joins it, by its own token | `FAIL: another link's token gave ok, expected 22023: That bundle link isn't this message's.` | green |
| 15 | `peo_send.sql` 15: only the advisor who wrote the message joins its link, once | `FAIL: another member of the firm gave ok, expected PT404: Message not found` | green |
| 16 | `peo_send.sql` 16: send-mail claims a PEO message only once its link has joined it, with its reply address and the token | `ERROR:  function public.claim_peo_mail(integer, integer, integer) does not exist` | green |
| 17 | `peo_send.sql` 17: a send that went is sent on the thread with the provider's id, and the token leaves the outbox | `ERROR:  function public.complete_peo_mail(uuid, integer, unknown) does not exist` | green |
| 18 | `peo_send.sql` 18: a send that did not go is retried while queued, or final and failed on the thread with its kind and reason | `ERROR:  function public.fail_peo_mail(uuid, integer, unknown, unknown, integer) does not exist` | green |
| 19 | `peo_send.sql` 19: a failed send shows on the Outbox page by company and File ID; its retry puts the message back in the queue | `FAIL: by the company gave <NULL>, expected Reyes Bakery` | green |
| 20 | `peo_send.sql` 20: a worker lost on the last attempt leaves its message failed as uncertain | `FAIL: the message failed gave queued, expected failed` | green |
| 21 | `peo_send.sql` 21: a message whose link never joined it fails after ten minutes, and nothing is sent | `FAIL: its event ends gave pending, expected dead` | green |
| 22 | `peo_send.sql` 22: a message whose link stopped working before it went is never sent | `FAIL: it is not claimed gave t, expected f` | green |
| 23 | `peo_send.sql` 23: the employer withdrawing the PEO after the send was written stops it before it goes | `FAIL: it is not claimed gave t, expected f` | green |
| 24 | `peo_send.sql` 24: what the composer reads: the advisor's mailbox, the PEO's contacts in use, the reply address | `ERROR:  function public.peo_send_context(uuid, unknown) does not exist` | green |
| 25 | `send-mail/handler.test.ts` "a message to a PEO": sent from the advisor's mailbox with the link in place of the marker, Reply-To the quote request's address first, recorded by complete_peo_mail | `Error: Gmail was not asked to send` | green |
| 26 | `send-mail/handler.test.ts` "a message to a PEO with no link": nothing sent, failed for good. (The check was written in cycle 25 ahead of its test; this test was written, the check taken out, the test seen red, the check put back.) | `AssertionError: expected true to be false` (Gmail was asked to send) | green |
| 27 | `schemaSync.test.ts` "knows every kind of email the outbox holds" (existing test, red on the new kind) | `+   "peo_message",` (the database's kinds, not the Outbox page's labels) | green |
| 28 | `schemaSync.test.ts` "puts the legal-wording module's line on every message to a PEO" | `× ... puts the legal-wording module's line on every message to a PEO` (PEO_SEND_NOTICE missing) | green |
| 29 | `close_a_firm.sql` "no function that changes data is left out of the closing's read-only list" (existing test, red on the new writes) | `gave attach_peo_link, send_to_peo, expected <NULL>` | green |
| 30 | `help_from_nevermore.sql` "every function that asks a membership helper is classified" (existing test) | `gave attach_peo_link, peo_send_context, send_to_peo, expected <NULL>` | green |
| 31 | `peo_send.sql` 15 changed: another member of the firm is told only the writer sends it (PT409), so the two-firm probe tells a member from an outsider | `FAIL: another member of the firm gave PT404: Message not found, expected PT409: Only the advisor who wrote this message can send it.` | green |
| 32 | `data_isolation.sql` "privileged functions and the registry disagree" and then "stored secrets are not kept from the API" (existing tests) | `privileged functions not in the registry: attach_peo_link, claim_peo_mail, ...`; then `send_to_peo(...) can be run through the API and names public.broker_mailboxes, which holds a secret` | green |
| 33 | `SendToPeo.test.tsx` "sends to the people picked from the PEO's contacts and typed, with the cover note and the bundle link" | `Error: Failed to resolve import "./SendToPeo"` | green |
| 34 | `SendToPeo.test.tsx` "with no mailbox, says so with a way to connect, sends nothing, and offers to send it from their own mail with the reply address in CC" | `Expected element to have text content: eaa-2026-0042.insperity.0123456789abcdef@` (the address offered had no domain) | green |
| 35 | `PeoThreadPanel.test.tsx` "is marked as sent from the advisor's mailbox, with who it went to and whether it went" | `Unable to find an element with the text: Sent from your mailbox` | green |
| 36 | `AdvisorSubmissionPage.test.tsx` "sends a PEO its bundle from its card, issuing the link from that PEO's plan for the quote request the send made" | `Unable to find an accessible element with the role "button" and name "Send to Justworks"` | green (two existing expectations updated: the card's buttons now end with "Send to Justworks"; issueBundleLink answers the link's id and token) |

After merging `claude/admiring-keller-dd7w1a` twice (6.1 at ab74be46, then 6.4 at 8b919ee5): `peo_send.sql` loads 6.4's two migrations
(`scripts/sqlMigrationOrder.test.ts`, red: "peo_send.sql reaches 20261122140000_peo_send.sql but does not load 20261122130000_conversation_replies.sql",
then green); the composer uses 6.1's `useFirstSend` and `MailboxForWriting` instead of a seam. The page test's "a save that fails" block was given
20 s per test: each renders the whole page (about 2 s alone) and timed out at 5 s under the full parallel run once each PEO card had its Send button.

## Mutations (each rule broken; a test must go red)

| Rule broken | Test that went red |
|---|---|
| send_to_peo without assert_peo_authorized | peo_send 2: `a PEO never authorized is refused gave ok` |
| send_to_peo without assert_firm_writable | peo_send 3: `a support session gave PT412 ..., expected PT423` |
| a superseded certification counts as current | peo_send 5: `answers changed since certifying gave ok` |
| no mailbox check | peo_send 6: `no mailbox gave 23502 ...` |
| no stage check | peo_send 9: `under review gave ok` |
| no thread continued | peo_send 11: `In-Reply-To the message before gave <NULL>` |
| the draft line left out of the block | peo_send 13: `the note, then the fixed block gave ...` |
| any token joins a message | peo_send 14: `another link's token gave ok` |
| another member may join a link | peo_send 15: `another member of the firm gave ok` |
| claim without the link joined | peo_send 16: `a message with no link is not claimed gave t` |
| token kept on the event after sending | peo_send 17: `and no longer holds the token gave t` |
| the Outbox retry leaves the message failed | peo_send 19: `puts the message back in the queue gave failed` |
| a revoked link still sent | peo_send 22: `it is not claimed gave t` |
| a withdrawn PEO still sent | peo_send 23: `it is not claimed gave t` |
| send-mail does not put the link in place of the marker | handler "a message to a PEO" |
| send-mail completes a PEO message on the contacts' queue | handler "a message to a PEO" |
| send-mail sends a PEO message with no token | handler "a message to a PEO with no link" (cycle 26) |

## The gate

`npm run lint` 0 errors (13 warnings, none in this slice's files); `npm run typecheck:functions` clean; `npm test` 281 files, 5904 tests passed;
`npm run build` built; `supabase/tests/run.sh` on port 5435: all 94 SQL tests passed.
