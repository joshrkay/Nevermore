# TDD log: slice 6.5, CRM-E1.4 (the inbox, #199)

The `tdd` skill was the lane's first tool call. One test per cycle: the failing line seen, then only the code that passes it.

1. `inbox: a contact's reply is a row` (supabase/tests/inbox.sql 1): `ERROR:  function public.inbox_list(uuid, jsonb, unknown, unknown, integer, text) does not exist` (HINT: No function matches) — green
2. `inbox: a lead's message is a row` (inbox.sql 2): `ERROR:  FAIL: the agent's message to the Ortiz lead reads as a sent row on the lead gave ||||, expected sent|Hello|Hi Ana|Person ortiz|t` — green
3. `inbox: PEO mail is a row` (inbox.sql 3): `ERROR:  FAIL: TriNet's reply reads as a PEO row, ... gave ||||||, expected peo|received|TriNet|Rita at TriNet|We need the census.|Reyes Bakery & Sons|t` — green
4. `inbox: who sees what` (inbox.sql 4): passed when first run, because cycles 1 to 3 had already written each branch's visibility test with the branch (more than those cycles needed; said here honestly). Seen red by breaking it: without the account's level rule, `FAIL: agent 2 (Sales): not agent 1's contact or lead ... gave contact:received,contact:sent,peo:received,peo:sent, expected peo:received,peo:sent` — green once restored
5. `inbox: new mail, and opening clears it` (inbox.sql 5): `ERROR:  FAIL: new: Lucia's reply and TriNet's; never a sent message or the automatic reply gave , expected Quote for Reyes,Re: hello` — green
6. `inbox: the views' filters` (inbox.sql 6): `ERROR:  FAIL: New: only the mail that came after the thread was opened gave contact:Away,contact:Hello,...,peo:Re: Quote for Reyes, expected contact:Second reply` — green
7. `inbox: the owner filter` (inbox.sql 7): `ERROR:  The inbox has no field "owner" to filter by` — green
8. `inbox: the account filter` (inbox.sql 8): `ERROR:  The inbox has no field "account" to filter by` — green
9. `inbox: search` (inbox.sql 9): `ERROR:  FAIL: the sender's name gave contact:Away,contact:Hello,...,peo:Re: Quote for Reyes, expected peo:Quote for Reyes` — green
10. `inbox: the views' counts` (inbox.sql 10): `ERROR:  function public.inbox_view_counts(unknown, jsonb) does not exist` — green
11. `inbox: the menu's count` (inbox.sql 11): `ERROR:  FAIL: one conversation with new mail (Lucia's), no PEO thread gave 0, expected 1` — green
12. `listInbox sends the firm, filters, page, search and time zone, and reads the page` (src/lib/inboxApi.test.ts): `Error: Failed to resolve import "./inboxApi" from "src/lib/inboxApi.test.ts"` — green
13. `the inbox's fields agree with the database` (src/lib/inboxApi.test.ts): the row's columns, `TypeError: INBOX_ROW_KEYS is not iterable` — green. Its first half (fields, kinds and directions) passed when first run: cycle 12 had written those lists with listInbox (said honestly); seen red by breaking it (a field `body_text` added to INBOX_FIELDS fails `expect(server).toEqual(INBOX_FIELDS)`) — green once restored
14. `data_isolation: privileged functions and the registry disagree` (supabase/tests/data_isolation.sql, once the migration is loaded in every whole-suite test): `ERROR:  FAIL: privileged functions and the registry disagree: privileged functions not in the registry: inbox_list, inbox_view_counts` — green (both in the callable registry, the firm probe and the classes)
15. `help_from_nevermore: every function that asks a membership helper is classified`: `ERROR:  FAIL: ... gave inbox_list, inbox_view_counts, expected <NULL>` — green (both are reads)
16. `menu_counts: three threads with new mail` (supabase/tests/menu_counts.sql): the old test went red on cycle 11's code, `FAIL: firm A: four sent requests (two on s1), two intakes with new mail (s1, s2) gave {"inbox": 3, ...}, expected {"inbox": 2, ...}`. Restated to the new rule (threads, D-695), its agreement now with the inbox's New view, and the queue's own filter checked unchanged (D-8); then `FAIL: opening s2's thread takes it out of the Inbox gave {"inbox": 2 ...}` until that expectation was the thread count too — green
17. `countInboxViews asks for every view's count in one call and answers in the order asked` (src/lib/inboxApi.test.ts): `TypeError: countInboxViews is not a function` — green
18. `the inbox lists the firm's messages: who, what it is about with its links, the first line, its kind and when` (src/pages/inbox/InboxPage.test.tsx): `Error: Failed to resolve import "./InboxPage"` — green
19. `offers All, New, From PEOs, From contacts and leads and Sent, each with its count` (InboxPage.test.tsx): `TestingLibraryElementError: Unable to find role="link" and name /^All/` — green
20. `shows its heading, its views and eight grey rows while loading` (InboxPage.test.tsx): passed when first run, because the table frame draws the grey rows (CRM-S2.1) and cycle 19 had added the views. Seen red by breaking it (the page without its views: `Unable to find role="link" and name /^From PEOs/`) — green once restored
21. `says what will be listed when there is no mail on any record` (InboxPage.test.tsx): `Unable to find an element with the text: Emails with PEOs, contacts and leads will be listed here` — green
22. `says Nothing new when the New view is empty` (InboxPage.test.tsx): `Unable to find an element with the text: Nothing new` — green. (The next cycle's test was first written with it by slip; it was taken out until this one was green, then put back and seen red on its own.)
23. `says no messages match when another view or a search finds none` (InboxPage.test.tsx): `Unable to find an element with the text: /No messages match/` — green
24. `asks to connect a mailbox, above the mail, when the person has none` (InboxPage.test.tsx): `Unable to find an element with the text: Connect your email to send from here` — green. Its guard, `shows no banner to a person whose mailbox is connected`, was written in the same step by slip and passed at once (nothing showed a banner yet); seen red by breaking the banner's condition (shown whatever the mailbox: `× shows no banner to a person whose mailbox is connected`) — green once restored
25. `keeps the inbox, with its query` (src/lib/brokerAuth.test.ts): `AssertionError: /inbox: expected '/advisor' to be '/inbox'` — green
26. `opens a contact's message on the contact, clearing its conversation's new mark through the newest message shown` (InboxPage.test.tsx): `Unable to find an element with the text: A contact's page` — green
27. `opens a PEO's message on its submission, clearing the PEO thread's new mark` (InboxPage.test.tsx): `Unable to find an element with the text: A submission's page` — green
28. `opens a lead's message on the Leads page, searched to that lead, clearing its conversation's new mark` (InboxPage.test.tsx): `Unable to find an element with the text: The Leads page, ?q=Ana+Ortiz` — green
29. `the workspace menu: Inbox opens /inbox and is marked there; the queue's new-mail filter is Quotes` (src/components/workspace/WorkspaceShell.test.tsx, its two tests changed to the inbox's page): `× makes each item a real link to where it opens until its own epic`, `× marks exactly one section as current at /inbox: Inbox` and three more — green
30. `the route is registered` (src/seo.guard.test.ts `covers every route in src/App.tsx` once /inbox is in App.tsx, and src/securityHeaders.test.ts with /inbox among the private path examples): `/inbox: expected 'Page not found | Nevermore' not to be 'Page not found | Nevermore'` and `/inbox: expected false to be true` (no X-Robots-Tag) — green (seo.ts title, vercel.json)

## Mutation pass

Each rule changed broke at least one test, except two, whose tests were then written (cycles 31, 32), each seen red against the mutant and green against the code.

Frontend (11, all killed): the kind's direction flipped; a lead's message opened as a contact's; a PEO's message opened with the conversation's function; the mark cleared only through the clicked message; Nothing new never said; From PEOs letting in sent mail; the Nothing yet words; the account's link; the search sent untrimmed; brokerNext forgetting /inbox; the menu's Inbox back to the queue.

Database (14): killed: a lead's level rule dropped; a copy sent by hand read as received; automatic replies counted as new; the last opening ignored; the search reading the first line of the body; the search missing the account; a PEO thread with no owner; a lead's business not its account; the menu counting messages, not threads; the menu leaving conversations out; PEO mail of a hidden empty draft listed (menu_counts.sql); a filter on an unknown field let through. Survived, then caught:

31. `inbox: one firm at a time` (inbox.sql 12), against the mutant "the contact branch without its firm test": `ERROR:  FAIL: naming Acme: never Zenith's mail gave 1, expected 0` — green on the code
32. `inbox: an owner who left` (inbox.sql 13), against the mutant "an owner named whose membership ended": `ERROR:  FAIL: no owner, and no name gave 2059003e-...|acme_removed@example.test, expected |` — green on the code
