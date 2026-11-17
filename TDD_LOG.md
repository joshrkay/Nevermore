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

# TDD log, slice 5.12 (CRM-Q1.2, what the intake teaches the account)

Skill `mattpocock-skills:tdd` invoked first. One test per cycle, seen red for the right reason, then the least code. SQL cycles run in `supabase/tests/intake_teaches_account.sql`
(`supabase/tests/run.sh intake_teaches_account`, port 5461). Before cycle 1 the test file's load list and an empty migration file (a comment line) were set up and run green.

1. SQL "a certification fills the account's empty industry, and nothing of the intake's private answers" - red: `FAIL: the empty industry is filled from the certified answers (D-1715) gave <NULL>, expected Dental practice` - code: `teach_account_from_intake` (industry only, plain overwrite) called from the restated `chain_at_certification` trigger - green.
2. SQL "a value the account already has is left as the firm has it" - red: `FAIL: the industry the account holds is not changed (D-196) gave Dental practice, expected Law firm` - code: `COALESCE(industry, ...)` - green.
3. SQL "employees" - red: `FAIL: the empty employee count is filled gave <NULL>, expected 12` - code: employees = COALESCE(employees, certified number) - green.
4. SQL "states of operation" - red: `FAIL: the empty list is filled: each once, in the order given gave {}, expected {TX,CA}` (a first draft of the test used a lowercase state the intake itself refuses, `Invalid intake data at states[2]`; fixed the test before any code) - code: states list filled when the account has none, as the chain reads it - green.
5. SQL "current provider" - red: `FAIL: the empty provider is filled gave <NULL>, expected Paychex PEO` - code: current_provider COALESCE, none when in_peo is false - green.
6. SQL "address and website" - red: `FAIL: the empty street is filled gave <NULL>, expected 500 Harbor Street, Suite 300, Austin, TX 78701` - code: street, state, website COALESCE (three one-line fields in one cycle: the test names the three location fields together; noted honestly as the one cycle that is wider than one field) - green.
7. SQL "the certifier becomes a contact" - red: `FAIL: the certifier is now a contact gave 0, expected 1` - code: contact insert from the prospect (profile name else signer, auth email, phone), ON CONFLICT (account_id, prospect_user_id) DO NOTHING - green.
8. SQL "a contact with the certifier's email is not added again" - red: `FAIL: the contact with their email, in another case, is them: no second one gave 2, expected 1` - code: skip when a contact of the account has the email, case ignored - green.
9. SQL "the main contact is never displaced" - red: `FAIL: with no main contact, the certifier is the main one ... gave f, expected t` (the never-displaced half was green by construction of cycle 7's is_main=false; the cycle drives the other half) - code: is_main = no main contact on the account - green.
10. SQL "a certifier who can't be reached is no contact, and an archived account is left alone" (first assertion) - red: `FAIL: a certifier with no email and no phone certifies gave 23514: ... violates check constraint "contacts_reachable"` - code: a contact only with a name and an email or phone, as the chain does - green for that assertion.
11. Same test, next assertion - red: `FAIL: an archived account gets no contact gave 1, expected 0` - code: return early for an archived account (D-222) - green.
12. SQL "where the account differs, the intake says so" - red: `ERROR: function public.account_intake_says(uuid, uuid) does not exist` - code: `account_intake_says` (industry only, latest certification across the account's intakes) - green.
13. SQL "a value that says the same is no suggestion" - red: `FAIL: the same in another case, with spaces: nothing to suggest gave t, expected f` (the exact-same half was green already) - code: compare lower(btrim()) - green.
14. SQL "employees" suggestion - red: `FAIL: the intake says 23 where the account says 40 gave <NULL>, expected 23` - code: employees in `account_intake_says` - green.
15. SQL "states of operation" suggestion - red: `FAIL: the intake says TX, CA where the account says TX, NY gave <NULL>, expected ["TX", "CA"]` - code: `crm_certified_states` (the chain's own list rule, also now used by the filling) and a same-set comparison - green.
16. SQL "name, street and current provider" suggestions - red: `FAIL: the legal name is offered against the account's name gave <NULL>, expected "Teach Seventeen LLC"` - code: name, street, current_provider comparisons (lower/btrim; provider none when in_peo is false) - green.
17. SQL "state and website" suggestions - red: `FAIL: the intake says TX where the account says NY gave <NULL>, expected "TX"` - code: state and website comparisons - green.
18. SQL "Use it is an edit of the account, and the history says who did what" - GREEN ON FIRST RUN, honestly: it pins the composition of existing pieces (the filling's history entry by the record-history trigger, update_account as "Use it", the suggestion gone because the values now match). No code was written for it; it is covered by the mutations at the end.
19. SQL "the next certification changes what the intake says; a withdrawn one says nothing" - red: `FAIL: a withdrawn certification suggests nothing gave {"name": ..., "industry": "Dental practice"}, expected {}` - code: only a certification that is not superseded counts - green (the recertification half was already true: the newest certification is the one read).
20. SQL "only someone who may see the account is told" - red: `FAIL: the employer's prospect, who is not in the firm, is told nothing gave {"name": "Teach Twentyone LLC"}, expected <NULL>` - code: the account page's visibility rule (can_see_firm_record), NULL for the rest - green.
21. SQL "a chain made at the first certification has nothing to suggest, and each later certification teaches it again" (with the ADR 0006 key and text check on the answer) - GREEN ON FIRST RUN, honestly: a guard over behaviour cycles 1-20 built; no code. Covered by mutation.
22. Existing test `chain_at_certification` "certifying again changed nothing in the chain" (run with the migration loaded) - red: `FAIL: certifying again changed nothing in the chain gave {... "updated_at": "...13.26664+00:00" ...}, expected {... "updated_at": "...13.198402+00:00" ...}` (the filling rewrote an account it had nothing to add to) - code: the filling is one UPDATE that runs only if a field it fills would change - green.
23. Existing test `chain_at_certification` "nor a contact on the agent's account" now contradicts D-1715 (the certifier becomes a contact) - red: `FAIL: nor a contact on the agent's account gave 1, expected 0` - test changed to the new rule (one contact, the certifier, as main) - green.
24. Component "says what the intake says beside a field where the account differs" (`src/components/accounts/AccountIntakeSays.test.tsx`, employees) - red: `TestingLibraryElementError: Unable to find an element with the text: The intake says 23` - code: `getIntakeSays` (api, types.ts), `useIntakeSaysQuery`, the line under Employees - green.
25. Component "Use it saves the account with that one field changed, from the version on the page, and the suggestion goes" - red: `TestingLibraryElementError: Unable to find role="button" and name /^Use it/` - code: the `IntakeSays` line with Use it, `useIt` through `updateAccount` + `onSaved` + asking the suggestions again - green.
26. Component "says it but offers no Use it to someone who may not change the account" - green on first run (the gate came with cycle 25); undid the gate to see it red (expected button to be null), restored it, green.
27. Component "says each text field where it differs, and Use it for one changes only that one" (name, website, industry, provider) - red: `Unable to find an element with the text: The intake says Harborview Dental Partners LLC` - code: `line()` under each of those rows, schema and type of the answer - green.
28. Component "says the street, the state and the states of operation, and Use it for the states sends the list" - red: `Unable to find an element with the text: The intake says 500 Harbor Street, Austin` - code: three more lines under Address and States, the list as typed text through the edit's own states parsing - green.
29. Component "says so, and saves nothing, when the account changed since the page was loaded" - green on first run (the conflict branch came with cycle 25, wider than its test); undid it by changing its words to see red, restored, green.
30. Existing test `scripts/sqlMigrationOrder.test.ts` "load their migrations in filename order, and the whole-suite lists load every migration" - red: `expected [ ...(93) ] to deeply equal []` (chain_at_certification.sql and intake_teaches_account.sql reach the newest migration yet loaded a partial list) - code: none in src; both SQL tests now load every migration in order (192 files); both re-run green on 5461 - green.
31. Component "Use it for the website saves the website the intake gave and nothing else" - GREEN ON FIRST RUN, honestly: a gap the mutation run found (a Use it that took the name for the website stayed green). Mutant restored to see red, then green.
32. Api `getIntakeSays` "hands the page the certified states, provider and employees under its own names" - GREEN ON FIRST RUN, honestly: a gap the mutation run found (states dropped in the mapping stayed green). Mutant restored to see red, then green.

## Mutation results (end of slice)
SQL (`mutate.py`, 24 mutants of the migration: trigger call removed, each field overwriting instead of filling, in_peo ignored, write guard removed, archived taught, contact email match case/removed, certifier always main, unreachable certifier, withdrawn certification counts, anyone sees, case/order sensitivity, employees always, FEIN leaked into the answer, FEIN copied into a field): all red.
UI (14 mutants of AccountDetails.tsx / accountPageApi.ts: Use it offered without right, sends one field only, ignores the page version, page not updated, suggestions not re-asked, conflict branch, states / employees / website sent wrongly, street / state / provider lines dropped, states dropped by the api): 12 red at first, 2 green (website Use it, states in the api); cycles 31 and 32 close them, both now red.
# TDD log, slice 5.13 (CRM-P2.5 / P-2.3, the employer ends a firm's access to their intake)

One numbered line per cycle: the test, the failing line seen, then green. Seam: SQL tests in `supabase/tests/employer_ends_access.sql` (and component tests, a server-less page, below).

1. SQL "only the intake's own employer": `FAIL: a member of the firm gave 42883: function public.employer_end_firm_access(unknown) does not exist` -> green (function refuses anyone but the intake's user, 42501)
2. SQL "the employer ends it: the intake leaves the firm": `FAIL: the intake is with no outside firm gave bc5b9759-..., expected 00000000-0000-4000-8000-00000000eaa1` -> green (the function lets the opportunity go, moves the intake to the default firm under a one-update bypass in keep_intake_firm, and makes the default firm's chain)
3. SQL "opportunity back to Qualifying, account stays": GREEN ON FIRST RUN, honestly: cycle 2's key (opportunities_intake_firm) forced the unlink and the rule forced the chain, so this test pins what 2 already did; it is proved red by mutation (see the mutation list in the report)
4. SQL "the ending is recorded for the firm": `ERROR: type "public.intake_access_ends" does not exist` -> green (table with firm, firm name, intake, opportunity, employer; written by the function)
5. SQL "the record is only appended": `FAIL: it can't be changed gave ok, expected 42501` -> green (append-only trigger)
6. SQL "no further send": `FAIL: nor can the firm that holds it now gave ok, expected 22023: The employer ended a firm's access to this intake...` (the firm that lost it already got PT404 from firm scope) -> green (peo_authorized and assert_peo_authorized restated, the one gate every PEO send, follow-up, update and bundle link reads)
7. SQL "live bundle links are revoked": `FAIL: both links are revoked, for that reason gave 0, expected 2` -> green (the reason 'access_ended' in the check and in bundle_link_revoke, called for each quote request)
8. SQL "the firm keeps a note of what was sent, on the opportunity": `FAIL: one note on the opportunity says so gave 0, expected 1` -> green (a note inserted on the opportunity, listing each quote request); the first run of the green code failed on `column q.created_at does not exist` (seen by the test, fixed)
9. SQL "the firm's own notes on the submission are kept with the firm": `FAIL: the firm's note on the submission is on the opportunity gave f, expected t` -> green (advisor_notes copied into the opportunity note, capped at the note's 5000)
10. SQL "nothing to end when no outside firm sees the intake": `FAIL: ended already gave ok, expected 22023: No firm sees this intake...` -> green (refused when the intake is the default firm's)
11. SQL "a closing firm cant stop it": GREEN ON FIRST RUN (the function never asks the closing guard; the exemption is by omission, now pinned, and listed in the close_a_firm exempt list)
12. SQL "a draft nobody has certified leaves with no chain made": GREEN ON FIRST RUN (the chain is asked only where the rule asks one; pinned)
13. SQL "the employer is shown which firm sees each of their intakes": `ERROR: function public.my_intake_firms() does not exist` -> green (my_intake_firms(): the caller own intakes with an outside firm, with its name)
14. SQL "what was already sent, the account, its contacts and the firm notes stay": GREEN ON FIRST RUN (pins the row-keeping; proved red by mutation)
15. SQL (test 13 extended) "my_intake_firms also names each intake company": `ERROR: column f.company does not exist` -> green (a company column)
16. vitest peoAuthorizationsApi "endFirmAccess asks the database to end ... and fails with its words": `TypeError: endFirmAccess is not a function` -> green (endFirmAccess; the rpc entries in types.ts added with it)
17. vitest peoAuthorizationsApi "listMyIntakeFirms reads the firm that sees each intake, by company": `TypeError: listMyIntakeFirms is not a function` -> green
18. vitest MyFirmAccess "names the firm that sees each intake, with End <Firm>'s access": `Failed to resolve import ./MyFirmAccess` -> green (component lists rows and buttons)
19. vitest MyFirmAccess "asks first, in draft wording, then ends that intake and says it is ended": `Unable to find role="alertdialog"` -> green (AlertDialog with endFirmAccessText and the draft notice; endFirmAccessText added to legalWording.ts)
20. vitest MyFirmAccess "shows the databases own words when it refuses": `Unable to find role="alert"` -> green (useSaveFailure and SaveFailed, as PacketRecipients)
21. vitest MyFirmAccess "says when no firm sees any of their intakes": `Unable to find an element with the text: No firm can see your intake.` -> green
22. vitest MyFirmAccess "says when the list could not be loaded": `Unable to find role="alert"` -> green
23. vitest MyFirmAccess "ends nothing when the employer keeps the access": GREEN ON FIRST RUN (the dialog only calls end from its action; pinned, proved red by mutation)
24. vitest ProfilePage "carries which firm sees each intake, with the way to end it": `Unable to find role="region" and name "Who can see my intake"` -> green
25. vitest quoteRequests "describes a bundle link revoked because the employer ended the access": `expected Bundle link revoked: access_ended to be ...the employer ended the firms access` -> green
