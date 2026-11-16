# TDD log, lane 5.fix

1. LandingPage.contact.test: Get a quote link to /start at a firm's address. Red: no such link. Green: GetAQuote in the hero in place of Start chatting.
2. LandingPage.contact.test: no Start chatting anywhere at a firm's address, two on the bare domain. Red: the closing section still had it. Green: closing section the same switch.
3. NewQuoteDialog.test: max-w-2xl, not w-screen / h-[100dvh], max-h-[90vh] overflow-y-auto. Red: full-window classes. Green: sized by content.
4. CloseOpportunityDialog.test: body scrolls inside the window, Cancel and Mark lost outside the scrolling region. Red: dialog itself scrolled. Green: flex column, fields in a scroller, actions below.
5. QuoteRequestsPanel.test: the sent status reads "Sent" (changed the pinned "Waiting"). Red: label said Waiting. Green: QUOTE_REQUEST_LABELS.sent = "Sent". Then three more tests pinning "Waiting" as the status word (PeoThreadPanel, quoteRequests, QuoteRequestsPanel history line) were updated to match; they were red until the label changed.

Cycle 5 note: the other pinned tests were edited together with the first, then seen to pass after the one-line label change; only the first was run red on its own.
