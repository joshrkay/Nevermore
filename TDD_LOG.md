# TDD log, lane 5.fix

1. LandingPage.contact.test: Get a quote link to /start at a firm's address. Red: no such link. Green: GetAQuote in the hero in place of Start chatting.
2. LandingPage.contact.test: no Start chatting anywhere at a firm's address, two on the bare domain. Red: the closing section still had it. Green: closing section the same switch.
3. NewQuoteDialog.test: max-w-2xl, not w-screen / h-[100dvh], max-h-[90vh] overflow-y-auto. Red: full-window classes. Green: sized by content.
4. CloseOpportunityDialog.test: body scrolls inside the window, Cancel and Mark lost outside the scrolling region. Red: dialog itself scrolled. Green: flex column, fields in a scroller, actions below.
5. QuoteRequestsPanel.test: the sent status reads "Sent" (changed the pinned "Waiting"). Red: label said Waiting. Green: QUOTE_REQUEST_LABELS.sent = "Sent". Then three more tests pinning "Waiting" as the status word (PeoThreadPanel, quoteRequests, QuoteRequestsPanel history line) were updated to match; they were red until the label changed.

Cycle 5 note: the other pinned tests were edited together with the first, then seen to pass after the one-line label change; only the first was run red on its own.

## home-auth

1. Navbar.test: Sign in links to /login. Red: no such link. Green: a Sign in link in the desktop header.
2. Navbar.test: Sign up your firm links to /firms/new. Red: no such link. Green: the link beside Sign in.
3. Navbar.test: a signed-in person sees Your workspace (/advisor) and neither Sign in nor Sign up your firm. Red: no workspace link. Green: switch on `user`.
4. Navbar.test: a guest session is a visitor. Red: guest had no Sign in. Green: switch on `user && !isAnonymous`.
5. Navbar.test: at a firm's address Sign in stays, Sign up your firm is gone. Red: link still shown. Green: shown only when useFirmAddress is none.
6. Navbar.test: the phone-width menu carries the same links. Red: menu had none. Green: same switch in the mobile menu.

Setup of cycle 1 changed the existing test file (mocks for useAuth and useFirmAddress, a renderNavbar helper) before the first red; the existing menu test stayed green.
7. AuthPage.test: someone sent from /firms/new is told "Sign up your firm" and not "Start your intake" or "chat with Lenore". Red: old heading. Green: `forFirm` from the `from` path in the heading and the line under it.
8. AuthPage.test: from /firms/new, sign-up, the resent link and the emailed code all return to /firms/new. Green on first run (behaviour already there); shown red by pointing the code path at /start, then restored.
9. Navbar.test: signed in with no firm (`[]`) sees Sign up your firm beside Your workspace. Red: no link. Green: `canSignUpFirm`, shared by header and phone menu.
10. Navbar.test: a firm's owner sees Your firm, not Sign up your firm or Your workspace. Red: label was Your workspace. Green: `workspaceLabel`.
11. Navbar.test: the same in the phone-width menu. Green on first run (cycle 9's code is shared); shown red by pointing the menu link at the wrong path, then restored.
12. LandingPage.contact.test: footer links Sign up your firm to /firms/new on the bare domain, not at a firm's address. Red: no link. Green: footer link when `firm.status === "none"`.

