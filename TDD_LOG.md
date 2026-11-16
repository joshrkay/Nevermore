# TDD log: slice 6.1, CRM-E1.1 (#195)

The `tdd` skill was the first tool call. Seams (D-13): (2) component tests of the place to write's mailbox line, the first-send choice and the menus;
the return address after sign-in through `brokerNext` (its existing unit seam). One failing test, seen red, then only the code that passes it.

| # | Test (the break it catches) | Red: the failing line seen | Green |
|---|---|---|---|
| 1 | brokerAuth: keeps a contact's page and the Leads page, with their query (a mailbox connected from a place to write returns there) | `AssertionError: /contacts/5f1c2a9e-0000-4000-8000-000000000003: expected '/advisor' to be '/contacts/5f1c2a9e-0000-4000-8000-000…'` | green |
| 2 | MailboxForWriting: with no mailbox, asks to connect one from here, with Google and Microsoft (a place to write with no way to connect) | `Error: Failed to resolve import "./MailboxForWriting" from "src/components/mailbox/MailboxForWriting.test.tsx". Does the file exist?` | green |
| 3 | MailboxForWriting: connects through the existing send-only sign-in and comes back to the place to write | `AssertionError: expected "spy" to be called with arguments: [ 'microsoft', '/contacts/c1' ]` | green |
| 4 | MailboxForWriting: when connected, shows the address it sends from and Connected, and offers no Connect | `Error: expect(element).toHaveTextContent()` (the line still asked to connect) | green |
| 5 | MailboxForWriting: after the provider took the permission back, says so with Reconnect (D-634) | `Error: expect(element).toHaveTextContent()` (no "no longer lets Nevermore send as you") | green |
| 6 | MailboxForWriting: still connected but the last send was refused for a mailbox reason: the address, says so, Reconnect (D-651) | `Error: expect(element).toHaveTextContent()` (showed a healthy Connected) | green |
| 7 | MailboxForWriting: says so when connecting can't start | `AssertionError: expected "spy" to be called with arguments: [ StringContaining "Google" ]` | green |
| 8 | MailboxForWriting: says when the mailbox couldn't be checked, and tries again | `TestingLibraryElementError: Unable to find an element with the text: /couldn't load your mailbox/.` | green |
| 9 | useFirstSend: with a mailbox connected, sends straight away and asks nothing | `Error: Failed to resolve import "./useFirstSend" from "src/components/mailbox/useFirstSend.test.tsx". Does the file exist?` | green |
| 10 | useFirstSend: with no mailbox, sends nothing and offers to connect Google or Microsoft, coming back to the place to write (the Connect buttons became one `ConnectButtons`, shared with the line, in this cycle's green step) | `TestingLibraryElementError: Unable to find role="dialog"` | green |
| 11 | useFirstSend: on a PEO send, also offers sending from your own mail with the reply address in CC (and never on a contact's or a lead's send) | `Error: expect(element).toHaveTextContent()` (the dialog had no reply address) | green |
| 12 | useFirstSend: when the mailbox can't be checked, sends nothing and says so | `AssertionError: expected "spy" to be called with arguments: [ 'Couldn\'t check your mailbox.' ]` (the check's rejection went unhandled; the expected words were then widened to also say nothing was sent, still red, before the code) | green |
| 13 | Settings: describes the Mailbox as the one you write from, which Nevermore only sends from (the menu said "read replies in") | `Error: expect(element).toHaveTextContent()`; then, after a first wording with "never reads", `Error: expect(element).not.toHaveTextContent()` | green |
