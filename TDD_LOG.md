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
