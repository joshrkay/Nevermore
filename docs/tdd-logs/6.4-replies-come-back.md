# TDD log: slice 6.4, CRM-E1.3 (replies come back to their conversation)

The `tdd` skill was invoked first. One test, seen red for the right reason, then only the code that passes it, then green.
SQL tests: `supabase/tests/conversation_replies.sql` on the lane's Postgres (port 5436). Function tests: `supabase/functions/receive-mail/handler.test.ts` (Vitest).

| # | Test | Red (the failing line seen) | Green |
|---|---|---|---|
| 1 | conversation_replies 1: a reply to a conversation's address joins that conversation as a received message | `FAIL: a reply to a conversation's address is not held gave true, expected false` | green |
| 2 | conversation_replies 2: a replayed delivery records nothing new (idempotent on the provider's id) | `ERROR:  duplicate key value violates unique constraint "conversation_messages_message_id_key"` | green |
| 3 | conversation_replies 3: an automatic reply is marked as one | `ERROR:  column m.is_automatic does not exist` | green |
| 4 | conversation_replies 4: the firm's own person copying the conversation in is "sent by hand" | `FAIL: who counts as the firm's own gave re_by_agent2=inbound,re_by_mailbox=inbound,... expected re_by_agent2=sent_by_hand,re_by_mailbox=sent_by_hand,...` | green |
| 5 | conversation_replies 5: a sender not seen on the conversation before is marked new (not the contact, not a CC'd person, not automatic, not the firm's own) | `ERROR:  column m.new_sender does not exist` | green |
| 6 | conversation_replies 6: mail to a c. address that belongs to no record goes to the platform's holding list | none: passed at once, as the criterion says "as today" (record_inbound_mail already held an address nobody holds). A characterization test, not a red one; its mutation is in the mutation table below | green (at once) |
| 7 | conversation_replies 7: a message to two conversations' addresses is held as ambiguous, for their firm or the platform | `FAIL: two of one firm's conversations: held as ambiguous gave true\|unknown_address, expected true\|ambiguous_address` | green |
| 8 | conversation_replies 8: the conversation's read (conversation_for) shows a received message, who sent it by name, new or automatic | `FAIL: a received message as the conversation's read shows it gave inbound\|received\|books@reyes.example\|\|\|, expected ...\|Pat Books\|true\|false` | green |
| 9 | conversation_replies 9: a new sender on a contact's conversation is offered as a contact on that account; a lead's offers nothing; one already a contact is not offered | `FAIL: the new senders on a contact's conversation, and which are offered gave <NULL>, expected ...` | green |
| 10 | conversation_replies 10: an agent adds the offered sender as a contact on that account, through add_contact | `ERROR:  function public.add_sender_as_contact(p_message_id => uuid, ...) does not exist` | green |
| 11 | conversation_replies 11: only an offered sender is added, and only by someone who may see the conversation (lead's PT409, not offered PT409, unseen PT404) | `FAIL: a sender already added gave ok, expected PT409: This sender isn't one to add: ...` | green |
| 12 | conversation_replies 12: a conversation with mail from a person since it was last opened is marked new; own sends, automatic replies and the firm's own copy are not | `FAIL: a conversation with a reply is new gave <NULL>, expected true` | green |
| 13 | conversation_replies 13: opening a conversation clears its mark for the whole firm, through what the page showed, never backwards; PT404 for one not seen | `ERROR:  function public.open_conversation(p_conversation_id => uuid, p_seen_through => timestamp with time zone) does not exist` | green |
| 14 | help_from_nevermore: a conversation opened by a support session stays new for the firm, and no admin is left as who opened it | `FAIL: a support session opens a conversation and marks nothing gave 2026-11-16T03:39:05.862693+00:00, expected <NULL>` | green |
| 15 | conversation_replies 15: an account's page and an opportunity's page read the messages of their contacts' conversations, stored once; PT404 by the level rule | `ERROR:  function public.account_conversation_messages(p_account_id => uuid) does not exist` | green |
| 16 | conversation_replies 16: a received message keeps its own Message-ID and what it answers, so the agent's answer threads; a repeated Message-ID gets one of its own | `FAIL: its Message-ID and In-Reply-To are kept gave <re_threaded@inbound.invalid>\|, expected <CAx1@mail.reyes.example>\|true` | green |
| 17 | conversation_replies 17: a received message's attachments are recorded and each settled by its own scan; a failed scan blocks only that file | `ERROR:  function public.record_conversation_attachment(uuid, unknown, unknown, unknown, integer) does not exist` | green |
| 18 | conversation_replies 18: a received file is read only by whoever reads its conversation, and only once stored after a clean scan | `ERROR:  insert or update on table "objects" violates foreign key constraint "objects_bucket_id_fkey"` (no contact-mail bucket, no policy) | green |
| 19 | handler.test: a reply to a conversation's address is recorded on the conversation the database names, and answered 200 | `AssertionError: expected 500 to be 200` | green |
| 20 | handler.test: a conversation's attachments are scanned and stored by PEO mail's rules in the contact-mail bucket; a failed scan blocks only that file | `AssertionError: expected { stored: +0, blocked: +0, …(3) } to deeply equal { stored: 1, blocked: 1, …(3) }` | green |
| 21 | handler.test: a conversation reply's address, subject, file names and text never reach a log | none: passed at once (a guard over cycle 19 and 20's code, which logs ids and counts only); mutated below | green (at once) |
| 22 | handler.test: a scanner that was reached but can't answer has the provider retry a conversation's reply | none: passed at once (cycle 20's code kept PEO mail's retry); mutated below | green (at once) |
| 23 | conversation_replies 19 (from the mutation pass): opening with an older moment never moves the mark back | seen red against mutant M10 (the forward-only guard removed): `FAIL: a later open through an older moment leaves it read gave true, expected false`; the code already held the rule | green |
| 24 | conversation_replies 20 (from the mutation pass): an opportunity's mail needs the opportunity itself to be one the caller may see | seen red against mutant M13 (the opportunity's own level check removed): `FAIL: an opportunity the agent may not see, on an account they may gave ok, expected PT404 ...`; the code already held the rule | green |

The registries the brief requires (data_isolation's matrix, probe and three function lists, help_from_nevermore's and close_a_firm's lists, the closing plan, the data class, the bucket list) were driven by those existing tests going red as each piece was added: `public.conversation_message_attachments is not in the registry`, `privileged functions not in the registry: account_conversation_messages, ...`, `closing a firm and the registry disagree`, `every function that asks a membership helper is classified ... gave add_sender_as_contact, open_conversation`, `a count per table of what was deleted gave {... "conversation_message_attachments": 0}`, dataPolicy.test's bucket list.

## Mutations (each rule broken on purpose; the suite named must go red)

| # | Mutation | Test run | Result |
|---|---|---|---|
| M1 | a message naming two conversations joins one (`= 1` to `>= 1`) | conversation_replies | red (7) |
| M2 | the conversation replay check removed | conversation_replies | survived: equivalent. The insert's `ON CONFLICT (provider_message_id) DO NOTHING` and its re-read answer the same duplicate, so the early check only saves work |
| M3 | is_automatic not kept | conversation_replies | red (3) |
| M4 | a former member's copy counted as the firm's own | conversation_replies | red (4) |
| M5 | a CC'd person counted as new | conversation_replies | red (5) |
| M6 | mail to an unknown c. address held as revoked | conversation_replies | red (6) |
| M7 | someone already a contact on the account offered again | conversation_replies | red (9) (first run mutated a definition that a later one replaced, and survived; the dead definition was removed and the mutation rerun) |
| M8 | a sender not offered is added | conversation_replies | red (11) |
| M9 | an automatic reply counted as new mail | conversation_replies | red (12) |
| M10 | the mark may move backwards | conversation_replies | survived, then test 19 added (cycle 23): red |
| M11 | a support session clears the mark | help_from_nevermore | red |
| M12 | an account's read takes every account's mail | conversation_replies | red (15) |
| M13 | an opportunity read without its own level | conversation_replies | survived, then test 20 added (cycle 24): red |
| M14 | a repeated Message-ID reused | conversation_replies | red (16) |
| M15 | the bucket policy's `status = 'stored'` removed | conversation_replies | survived: equivalent. The table's check allows a path only on a stored row, so the policy's path match already implies it |
| M16 | the files' rows left out of the closing | close_a_firm | red |
| M17 | an attachment's rows readable by anyone signed in | conversation_replies | red (18) |
| M18 | the lead check gone from add_sender_as_contact | conversation_replies | red (11) |
| H1 | the handler ignores a conversation's answer | handler.test | red (19, 20) |
| H2 | a conversation's files kept in peo-mail | handler.test | red (20) |
| H3 | no retry for a conversation's pending file | handler.test | red (22) |
| H4 | the sender's address in the log | handler.test | red (19, 21) |
| H5 | a conversation's files recorded as PEO mail's | handler.test | red (20) |
