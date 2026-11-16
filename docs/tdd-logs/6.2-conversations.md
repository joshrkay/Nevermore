# TDD log: slice 6.2, CRM-E1.2a (#196)

The `tdd` skill was the first tool call. Seams (D-13): (1) SQL tests in `supabase/tests/conversations.sql`; (4) the `send-mail` function through its
request and response, with Google and Microsoft faked at `fetch`. One failing test, seen red, then only the code that passes it.

| # | Test (the break it catches) | Red: the failing line seen | Green |
|---|---|---|---|
| 1 | conversations 1: a conversation is with exactly one contact or one lead | `FAIL: a conversation with neither a contact nor a lead gave 42P01, expected 23514` | green |
| 2 | conversations 2: one conversation per contact and one per lead | `FAIL: a second conversation with a contact gave rows:1, expected 23505` | green |
| 3 | conversations 3: its contact or lead is of its own firm | `FAIL: Acme's conversation with Zenith's contact gave rows:1, expected 23503` | green |
| 4 | conversations 4: deleted with its account (through the contact) and with its lead | `ERROR: update or delete on table "contacts" violates foreign key constraint "conversations_contact_fkey"` | green |
| 5 | conversations 5: a reply address names one conversation | `FAIL: a second conversation with the same address gave rows:1, expected 23505` | green |
| 6 | conversations 6: a reply address reads c.<name>.<16 hex>, lower case | `FAIL: the address eaa-2026-1.bay.00000000000000a1 gave rows:1, expected 23514` | green |
| 7 | conversations 7: a message is on a conversation of its own firm | `FAIL: Zenith's message on Acme's conversation gave 42P01, expected 23503` | green |
| 8 | conversations 8: a message starts queued and is only queued, sent or failed | `ERROR: column "status" does not exist` | green |
| 9 | conversations 9: a failed message carries a known kind and a reason in words, and only a failed one | `FAIL: failed with no kind or reason gave rows:1, expected 23514` | green |
| 10 | conversations 10: a provider id names one message | `ERROR: column "provider_message_id" of relation "conversation_messages" does not exist` | green |
| 11 | conversations 11: a Message-ID names one message | `FAIL: a second message with the same Message-ID gave rows:1, expected 23505` | green |
| 12 | conversations 12: conversations and messages are read by the level rule; a guest reads none | `FAIL: acme_agent1 reads conversations gave 2, expected 1` | green |
| 13 | conversations 13: no API role writes a conversation or a message | passed at once (cycle 12's grants already did it), so it was seen red by granting UPDATE: `FAIL: an owner: UPDATE public.conversation_messages SET  gave rows:0, expected 42501`; no code written for it | green |
| 14 | conversations 14: an agent writes to their contact; recorded queued, from their mailbox, to the contact | `ERROR: function public.send_conversation_message(p_contact_id => uuid, p_subject => unknown, p_body => text) does not exist` | green |
| 15 | conversations 15: the first message issues the conversation and its c.<account>.<hex> address; the next reuses them | passed at once: the address function had to exist in cycle 14 because the column is NOT NULL. Seen red by naming every address `x`: `FAIL: the address names the account, shortened: c.x.de586d02ffe899a4 gave f, expected t` | green |
| 16 | conversations 16: a message's Message-ID is <its id@the From domain>, and it says when it was recorded | `FAIL: the Message-ID gave <a4bba504-…@acme.example>, expected <d41f35b0-…@acme.example>` | green |
| 17 | conversations 17: each message is queued on the outbox with its id alone | `FAIL: the first message's event, its id alone gave 0, expected 1` | green |
| 18 | conversations 18: only to a record the caller may see; any other is PT404 and records nothing | `FAIL: a colleague's contact gave ok, expected PT404` | green |
| 19 | conversations 19: an agent writes to their lead, on the lead's conversation, its address naming the business; a colleague gets PT404 | `ERROR: That contact or lead isn't one you can see.` | green |
| 20 | conversations 20: a lead in the bin or converted is refused (PT409), and one in the bin is PT404 to an agent who no longer sees it | `FAIL: a lead in the bin, even for an owner who sees the bin gave ok, expected PT409: …` | green |
| 21 | conversations 21: Do not email, a contact with no email and a lead with no email are refused, recording nothing | `FAIL: a contact marked Do not email gave ok, expected PT409: This contact is marked Do not email.` | green |
| 22 | conversations 22: a blank subject or body is refused in words (22023) | `FAIL: a blank subject gave ok, expected 22023: Enter a subject.` | green |
| 23 | conversations 23: a subject is one line of at most 300 characters; a body at most 50,000 | `FAIL: a subject with a line break gave ok, expected 22023: A subject is one line.` | green |
| 24 | conversations 24: at most 10 in CC, each a bare address by the one rule; the CC is recorded trimmed | `FAIL: eleven in CC gave 42883: function public.send_conversation_message(… p_cc => unknown) does not exist, expected 22023: At most 10 people in CC.` | green |
| 25 | conversations 25: a contact's or lead's own address must pass the same rule (PT409) | `FAIL: a contact whose address the rule refuses gave ok, expected PT409: …` (the lead half was added with the code, symmetric, and is mutation-checked below) | green |
| 26 | conversations 26: a sender with no mailbox is told to connect one (PT412) and nothing is recorded | `FAIL: an agent with no mailbox gave 23502: null value in column "from_address" …, expected PT412: Connect your mailbox to send from here.` | green |
| 27 | conversations 27: In-Reply-To and References only when the writer names a message of this conversation | `ERROR: column m.in_reply_to does not exist` | green |
| 28 | conversations 28: conversation_for gives the conversation newest first to whoever may see the record, PT404 to anyone else | `ERROR: function public.conversation_for(p_contact_id => uuid) does not exist` | green |
| 30 | conversations 30: conversation_for says whether the caller has a mailbox and whether their newest send failed for a mailbox reason | `FAIL: an agent with a mailbox whose sends have not failed gave <NULL>, expected {"connected": true, "last_send_failed": false}` | green |
| 31 | conversations 31: the send-mail function alone claims queued messages, oldest first, with sender, Message-ID and reply address, under a lease | `FAIL: an owner claims mail gave 42883, expected 42501` | green |
| 32 | conversations 32: completing marks the message sent with the provider id and when, only for the attempt holding the claim, once | `FAIL: an owner completes a send gave 42883, expected 42501` (then `column "sent_at" … does not exist`) | green |
| 33 | conversations 33: a failure is retried later with the message still queued, or is final with the message failed, its kind and reason; fenced to the claim | `ERROR: function public.fail_conversation_mail(uuid, integer, unknown, unknown, integer) does not exist` | green |
| 34 | conversations 34: a worker lost on the last attempt leaves its message failed as uncertain, with what to do | `FAIL: the message of a lost worker's last attempt gave <NULL>, expected failed uncertain` | green |
| 35 | conversations 35: a queued message whose record was deleted is never sent; its event ends and the claim takes the next | `FAIL: its event ends gave <NULL>, expected suppressed cancelled: the message is gone` | green |
| 36 | conversations 36: who may send at all: no former member, stranger or guest (42501), no support session or closing firm (PT423); support reads | passed at once: the guards came with cycle 14 in the required order. Seen red by removing assert_firm_writable: `FAIL: a support session gave PT412: …, expected PT423: Nevermore support can look, not change` | green |
| 37 | data_isolation (existing, D-28): every table is in the registry with its two-firm probe | `FAIL: the firms are not kept apart: public.conversation_messages is not in the registry …` | green, see 37 below |
| 38 | help_from_nevermore (existing, ADR 0024): every function asking a membership helper is classified | `FAIL: every function that asks a membership helper is classified … gave conversation_for, send_conversation_message, expected <NULL>` | green, see below |
| 39 | close_a_firm (existing, ADR 0023): every function that changes data is guarded or exempt | `FAIL: no function that changes data is left out of the closing's read-only list … gave send_conversation_message, expected <NULL>` | green, see below |
| 40 | schemaSync (existing): the browser names every kind of email the outbox holds | `AssertionError: expected [ 'advisor_notification', …(8) ] to deeply equal [ … (7) ]` (+ "conversation_message") | green |
| 41 | schemaSync: the database and the message builder hold the same address rule | `Error: Failed to resolve import "../../supabase/functions/_shared/mailAddress"` | green |
| 42 | send-mail: answers preflights; refuses other methods, no login, a guest; works for the service role and a signed-in person | `Error: Failed to resolve import "./handler"` | green |
| 43 | send-mail: one RFC 5322 message through Gmail from the agent's address, Reply-To the conversation then the agent, its own Message-ID, marked sent with Gmail's id | `Error: Gmail was not asked to send` | green |
| 44 | send-mail: a Microsoft agent's message goes through Graph sendMail and is marked sent with our own Message-ID | `AssertionError: expected undefined to be 'https://graph.microsoft.com/v1.0/me/s…'` | green |
| 45 | send-mail: carries the CC, and In-Reply-To and References only when the writer named the message answered | `AssertionError: expected undefined to be 'sam@reyes.example, tom@reyes.example'` | green |
| 46 | send-mail: a subject that is not short ASCII goes as folded RFC 2047 UTF-8 words; no header line passes 78 characters (address lists fold too) | `AssertionError: expected 91 to be less than or equal to 78` | green |
| 47 | send-mail: an address failing the one rule sends nothing and fails the message for good, refused, saying why | `AssertionError: expected true to be false` (Gmail was asked to send) | green |
| 48 | send-mail: a mailbox that is gone or taken back fails for good, kind mailbox, in plain words; a sign-in service not answering is tried again (two its written together in one step, both seen red) | `AssertionError: expected undefined to match object { p_kind: 'mailbox', …(2) }` | green |
| 49 | send-mail: a busy or failing provider (429, 5xx) is tried again after dispatch-outbox's delays, final after the last attempt | `AssertionError: expected undefined to match object { p_kind: 'unavailable', …(1) }` | green |
| 50 | send-mail: a refusal is final, refused for the message (the provider's words not kept) or mailbox for 401/403 | `AssertionError: expected undefined to match object { p_kind: 'refused', …(1) }` | green |
| 51 | send-mail: a send whose answer was lost is never retried (no idempotency key): final, uncertain, Sent folder; the send carries a cut-off signal | `TypeError: connection reset` (uncaught) | green |
| 52 | send-mail: a connected mailbox that is not the message's From sends nothing; final, kind mailbox | `AssertionError: expected true to be false` (Gmail was asked to send) | green |
| 53 | send-mail: asks Google and Microsoft for no scope on any request | passed at once (the shared refresh already asks none). Seen red by adding `scope` to the refresh: `AssertionError: expected [ 'client_id', 'client_secret', …(3) ] to not include 'scope'`; kept as M-4.3's guard on the send path | green |
| 54 | send-mail: claims nothing and names the missing setting (reply domain, mailbox key) without its value | passed at once (the gate came with cycle 43, where the reply address needed the domain). Seen red by dropping the domain check: `AssertionError: expected 200 to be 503` | green |
| 55 | send-mail: a Gmail answer with no readable id still marks the message sent, with our Message-ID | `SyntaxError: Unexpected token 'o', "ok" is not valid JSON` | green |
| 56 | dataPolicy (existing): every table has a data class | `× data classification against the schema > classifies the table conversation_messages` (and conversations) | green |

After the merge of 6.6a: its `20261122100000` sorts after this slice's migration and restated `firm_closing_plan()` from before 6.2, so
data_isolation and close_a_firm would have lost the conversations' lines; `20261122100500_conversations_closing.sql` restates the list with both (D-639).

## Mutations (each rule broken by hand, the test run, the code put back)

Killed, 19 of 19. SQL (`conversations.sql`): Do not email allowed; a lead in the bin written to; a converted lead written to; a subject with a line
break; eleven in CC; no outbox event; a colleague's contact written to; completion without the attempt fence; a gone message's event left waiting;
any failure read as Reconnect; a retry marking the message failed; References without the answered message's own. send-mail: Reply-To with the
writer first; In-Reply-To on every message; a changed mailbox still sending; a lost answer retried; 401 read as a refused message; the address rule
skipped. Earlier, inside cycles 13, 15, 36, 53 and 54: grants widened, every address named `x`, the write guard removed, a scope added to the refresh,
the reply-domain check removed.

## Not test-driven (no seam sees them)

The minute schedule of send-mail in the migration (pg_cron and pg_net are absent from the test database: it logs a notice there), the four indexes and
the table comments, `index.ts` (Deno wiring), `types.ts`, the glossary, the build doc and the env example.
