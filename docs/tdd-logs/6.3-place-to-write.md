# TDD log: slice 6.3, CRM-E1.2b (#197)

The `tdd` skill was the first tool call. Seams (D-13): (1) SQL tests in `supabase/tests`; (2) component tests of the place to write, the contact's
page and the account's Email; (4) the send-mail and message-file functions through request and response, the provider faked. One failing test, seen
red, then only the code that passes it.

| # | Test (the break it catches) | Red: the failing line seen | Green |
|---|---|---|---|
| 1 | PlaceToWrite: with no emails yet, says so and offers the place to write (an empty conversation as a blank panel) | `Error: Failed to resolve import "./PlaceToWrite" from "src/components/conversations/PlaceToWrite.test.tsx". Does the file exist?` | green |
| 2 | PlaceToWrite: while loading, shows the heading with grey lines and no place to write yet (a first message written over mail not yet shown) | `TestingLibraryElementError: Unable to find an accessible element with the role "status" and name "Loading emails"` | green |
| 3 | PlaceToWrite: with no mailbox, the place to write is replaced by "Connect your email to write from here" with the connect buttons | `TestingLibraryElementError: Unable to find an element with the text: Connect your email to write from here.` | green |
| 4 | PlaceToWrite: for a contact marked Do not email, says so and offers nothing to write or connect | `TestingLibraryElementError: Unable to find an element with the text: This contact is marked Do not email, so nothing can be written to them from here..` | green |
| 5 | PlaceToWrite: for a contact with no email address, says to add one and offers nothing to write (CRM-C1.1) | `TestingLibraryElementError: Unable to find an element with the text: No email address on file. Add one to write from here..` | green |
| 6 | PlaceToWrite: lists the messages newest first, sent and received, each with who, the subject and what was said | `TestingLibraryElementError: Unable to find role="list" and name "Emails with Elena Marsh"` | green |
| 7 | PlaceToWrite: sends the subject and message through send_conversation_message, showing Sending while it goes (a send around the first-send check, or pressed twice) | `TestingLibraryElementError: Unable to find role="button" and name "Sending…"` | green |
| 8 | PlaceToWrite: once recorded, empties the boxes, works the queue and shows the message on its way (sent twice, or waiting for the schedule, or not shown) | `TestingLibraryElementError: Unable to find role="list" and name "Emails with Elena Marsh"` (a second test written with it, "a message that went shows Sent", passed at once and was deleted unrun-red: one test per cycle) | green |
| 9 | PlaceToWrite: a message that didn't go says so with its reason, and the mailbox line offers Reconnect (D-632, D-651) | `Error: expect(element).toHaveTextContent()` (the failed message read "Sent") | green |
| 10 | PlaceToWrite: a send the database refuses says why in its words and keeps what was written | `TestingLibraryElementError: Unable to find an element with the text: This contact is marked Do not email..` | green |
| 11 | PlaceToWrite: replying to a message names it, and the send carries it as the message answered (a reply sent as a new thread, D-635) | `TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Reply"` | green |
| 12 | PlaceToWrite: keeps what was written when the page is left and come back to, and forgets it once sent (the draft lost on the trip to connect, D-653) | `Error: expect(element).toHaveValue(Your renewal)` | green |
| 13 | PlaceToWrite: offers the account's files, each to go as an expiring link, and sends the ones ticked (D-605: an attachment, a file from elsewhere, a ticked file dropped) | `TestingLibraryElementError: Unable to find role="group" and name "Files from the account"` | green |
| 14 | ContactPage: shows the emails with the contact and a place to write, for this contact, coming back here after connecting (CRM-E1.2: a contact's page with no place to write) | `TestingLibraryElementError: Unable to find role="region" and name "Emails"` | green |
| 15 | EmailAContact: asks which contact, the main contact first, then opens the place to write for the one chosen (an Email to nobody in particular, or the wrong contact) | `Error: Failed to resolve import "./EmailAContact" from "src/components/conversations/EmailAContact.test.tsx". Does the file exist?` (the first green carried the opportunity's first-contact rule unasked; it was taken out, still green, before cycle 16's test) | green |
| 16 | EmailAContact: on an opportunity, lists the opportunity's main contact first | `Error: expect(element).toHaveTextContent()` (Elena Marsh, the account's main contact, was first) | green |
| 17 | AccountPage: Email asks which of the account's contacts, then opens the place to write for the one chosen (the header test that pinned "no Email", D-186, now leaves Email out of what must be gone) | `TestingLibraryElementError: Unable to find role="button" and name "Email"` | green |
| 18 | AccountPage: back from connecting a mailbox, opens the place to write for the contact being written to (D-653) | `TestingLibraryElementError: Unable to find role="dialog" and name "Write to Elena Marsh"` | green |
| 19 | SQL conversation_files 1: the files a message to a contact may carry (a file still being checked, another account's census, or the list to someone who may not see the contact) | `ERROR:  function public.conversation_files_for(p_contact_id => uuid, p_firm_id => uuid) does not exist` | green |
| 20 | SQL conversation_files 2: a message carries the files chosen, each a link to issue when it is sent (a file chosen and dropped; a token kept from the start) | `ERROR:  function public.send_conversation_message(p_contact_id => uuid, p_subject => unknown, p_body => unknown, p_firm_id => uuid, p_document_ids => uuid[]) does not exist` | green |
| 21 | SQL conversation_files 3: a file a message may not carry is refused and nothing is recorded (a file still being checked; another employer's census; another firm's file; a file to a lead) | `ERROR:  FAIL: a file still being checked gave ok, expected 22023: That file can't go with this message. ...` | green |
| 22 | SQL conversation_files 4: the links are issued when the message is built, each time it is tried, only their hashes kept, 30 days (a token kept; a link that never stops; an earlier attempt's link still opening) | `ERROR:  FAIL: a token of 32 random bytes in URL-safe base64 gave <NULL>, expected t` | green |
| 23 | SQL conversation_files 5: opening a link gives the file where the intake keeps it, each download logged (a link opening after 30 days or revoked; a file that failed a later check; a download not logged; a guess not counted) | `ERROR:  function public.conversation_file_open(text, text) does not exist` | green |
| 24 | SQL conversation_files 6: the place to write reads each message's state and files through conversation_for (a failed message shown with no reason; files not named; a token shown). The fields had been restated with cycle 20's green ahead of their test; they were taken out to see this red, then put back | `ERROR:  FAIL: with its reason gave <NULL>, expected Google or Microsoft refused this message.` | green |
| 25 | send-mail: lists each file with its own link, the token after #, and says the links stop working after 30 days; nothing is attached (D-605; the token kept out of the host's log) | `AssertionError: expected 'Hi Lucia,\r\nShall we talk?' to be 'Hi Lucia,\r\nShall we talk?\r\n\r\nFi…'` | green |
| 26 | send-mail: sends nothing and tries again later when a message has files and the app's address isn't set (a message promising files sent without links) | `AssertionError: expected { claimed: 1, sent: 1, …(2) } to deeply equal { claimed: 1, sent: +0, …(2) }` | green |
| 27 | message-file: passes on a live link's file as a download under its name, asking the database with hashes only and signing for 60 seconds (a token sent as it is; a path or lasting link handed out) | `Error: Failed to resolve import "./handler" from "supabase/functions/message-file/handler.test.ts". Does the file exist?` | green |
| 28 | message-file: answers gone for a malformed token without asking, for a link that opens nothing, and takes no GET | not seen red: cycle 27's green copied bundle-link's refusals with its download, ahead of this test (a deviation; the mutations M below show this test goes red when each refusal is broken) | green |
| 29 | FileLinkPage: downloads the file with the token from the link (after #), under its name; a link that no longer works says so | `Error: Failed to resolve import "./FileLinkPage" from "src/pages/FileLinkPage.test.tsx". Does the file exist?` | green |
| 30 | seo.guard: tells crawlers not to index the private routes, now with the file link page /f (and the router, the title table and vercel.json's no-referrer, no-store for it) | `AssertionError: /f: expected false to be true` | green |
| 31 | dataPolicy: classifies the tables conversation_message_files and conversation_file_downloads (a stored table with no data class) | `AssertionError: conversation_message_files is stored but belongs to no data class: expected [] to not deeply equal []` | green |
| 32 | PlaceToWrite: clears the conversation's new-mail mark through the newest message shown (6.4's open_conversation, merged during this slice: a reply read on the contact's page left new for the firm) | `AssertionError: expected "spy" to be called with arguments: [ 'f1', 'v1', …(1) ]` | green |
| 33 | AccountPage: shows the emails with the account's contacts on its Overview, newest first, each naming its contact (6.4's account_conversation_messages: one message on every record it belongs to) | `TestingLibraryElementError: Unable to find role="list" and name "Emails with the account's contacts"` | green |
| 34 | SQL conversation_files 7: emailing a lead makes it Working; Not a fit stays (D-808, D-639: a lead written to left New) | `ERROR:  FAIL: a New lead written to is Working gave new, expected working` | green |
| 35 | SQL conversation_files 8: at most 10 files on one message, said in words (an eleventh file refused in a constraint's words) | `ERROR:  FAIL: an eleventh file gave 22023: That file can't go with this message. ..., expected 22023: At most 10 files can go with one message.` | green |

## Mutations (each change made, its tests run, then put back)

| # | Mutation | Result |
|---|---|---|
| M1 | Do not email no longer hides the place to write | red |
| M2 | the place to write offered with no mailbox | red |
| M3 | a failed message reads Sent | red |
| M4 | a reply sent with no In-Reply-To | red |
| M5 | the draft not kept across the trip | red |
| M6 | ticked files dropped from the send | red |
| M7 | the opportunity's main contact not first | red |
| M8 | the new-mail mark never cleared | red |
| M9 | Email gone from the account's page | red |
| M10 | a file still being checked allowed | red |
| M11 | another employer's census allowed | red |
| M12 | the send never checks its files | red |
| M13 | the token kept instead of its hash | red |
| M14 | a link that never runs out | red |
| M15 | a download not logged | red |
| M16 | a guess not counted | red |
| M17 | a lead written to stays New | red |
| M18 | the message carries no links | red |
| M19 | a message with files sent without the app's address | red |
| M20 | a malformed token sent to the database | red |
| M21 | a link that opens nothing answered as a file | red |
| M22 | the file page asks with no token | red |
| M23 | eleven files allowed | red |

Deviations, said plainly: cycle 8 had a second test that passed at once and was deleted; cycle 15's first green carried cycle 16's rule and it was taken out before cycle 16's test; cycle 24's fields had gone in with cycle 20's green and were taken out to see the red; cycle 28's test was never red (cycle 27's green copied bundle-link's refusals), and M20 and M21 show it catches them. Registry updates that existing tests asked for (data_isolation, help_from_nevermore, close_a_firm, fileLinks, the deploy list, seo, dataPolicy, the closing plan) were made when those tests went red.
