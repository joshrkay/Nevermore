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
# TDD log, slice 5.3 (P-2.2, P-2.4)

One numbered line per cycle: the test, the failing line seen, and "green" once it passed. SQL cycles are sections of `supabase/tests/broker_intake.sql` (run with
`supabase/tests/run.sh broker_intake`); the others are Vitest files named in the line.

1. SQL "a broker starts an intake on an opportunity of their firm" . red: `ERROR:  function public.start_broker_intake(uuid) does not exist` . green (the first pass of the function
   also carried refusals and a started_by guard that no test had asked for; they were taken out again and come back below, each after its own red test).
2. SQL "an opportunity of another firm, or one that does not exist, is not available" . red: `FAIL: another firm's opportunity is not available gave 23503, expected PT404` . green
3. SQL "a broker who may not see the account can't start its intake" . red: `FAIL: an agent who may not see the account is told it is not available gave ok, expected PT404` . green
4. SQL "an opportunity holds one intake" . red: `FAIL: a second start on the same opportunity is refused gave ok, expected PT409` . green
5. SQL "an archived account takes no intake" . red: `FAIL: an archived account takes no intake gave ok, expected 55000` . green
6. SQL "a closing firm starts no intake" . red: `FAIL: a closing firm starts no intake gave ok, expected PT423` . green
7. SQL "the browser never sets who started an intake" . red: `FAIL: a browser insert names no starter gave 90d857cb-..., expected <NULL>` . green
8. SQL "what a broker types is saved with its own source" . red: `ERROR:  function public.broker_enter_answers(uuid, unknown) does not exist` . green (after the alphabetical order of the answer was settled: a first red on the order of `written`, a test expectation that depended on key order, fixed in the function)
9. SQL "only a member of the intake's firm may enter answers" . red: `FAIL: another firm's member can't enter answers gave ok, expected PT404` . green
10. SQL "an employer's own intake takes no broker entries" . red: `FAIL: an employer's own intake takes no broker entries gave ok, expected PT404` . green
11. SQL "the FEIN is refused" . red: `FAIL: the FEIN is refused gave ok, expected 42501` . green
12. SQL "a broker never overwrites what the employer answered" . red: `FAIL: the employer's typed answer stands gave Monthly, expected Weekly` . green
13. SQL "an archived intake takes no entries" . red: `FAIL: an archived intake takes no entries gave ok, expected 55000` . green
14. SQL "a closing firm takes no entries" . red: `FAIL: a closing firm takes no entries gave ok, expected PT423` . green
15. SQL "a list is not a set of answers" . green with no new code (Postgres refuses jsonb_object_keys on a list: 22023); kept as a pin.
16. SQL "nothing to enter is refused" . red: `FAIL: nothing to enter is refused, not answered as a success gave ok, expected 22023` . green
17. SQL "a value the intake's validation refuses is refused" . green with no new code (validate_chamber_data already refuses it); kept as a pin.
18. SQL "required items read a broker entry as unconfirmed" . red: `FAIL: a company name a broker entered is unconfirmed gave settled, expected unconfirmed` . green (provenance_source_is_valid restated with broker_entry)
19. SQL "a broker invites the client: 14 days, hash only" . red: `ERROR:  function public.invite_intake_client(uuid, unknown, unknown, text) does not exist` . green
20. SQL "only a member of the intake's firm invites, only for a broker-started intake" . red: `FAIL: another firm's member can't invite gave 23505, expected PT404` . green
21. SQL "an intake has one live invitation" . red: `FAIL: a second invitation is refused gave 23505, expected PT409` . green
22. SQL "a malformed address is refused in words" . red: `FAIL: a malformed address is refused in words gave 23514, expected 22023` . green
23. SQL "a closing firm invites no one" . red: `FAIL: a closing firm invites no one gave ok, expected PT423` . green
24. SQL "a closed intake is not invited about" . red: `FAIL: a closed intake is not invited about gave ok, expected 55000` . green
25. SQL "an intake that has its employer is not invited about" . red: `FAIL: an intake that has its employer is not invited about gave ok, expected 55000` . green
26. SQL "Remind sends a fresh link and revokes the old one" . red: `ERROR:  function public.remind_intake_invite(uuid, text) does not exist` . green
27. SQL "an intake never invited about has nothing to remind" . red: `FAIL: an intake never invited about has nothing to remind gave 23502, expected PT404` . green
28. SQL "a closing firm sends no reminder" . red: `FAIL: a closing firm sends no reminder gave ok, expected PT423` . green
29. SQL "opening the link shows the firm and records last opened" . red: `ERROR:  function public.peek_intake_invite(text, unknown) does not exist` . green
30. SQL "a hash nobody holds is not a link; another firm's address is refused" (opening) . red: `FAIL: a hash nobody holds is not a link gave ok, expected PT404` . green (the second assertion, PT422, was written in the same cycle and never seen red on its own)
31. SQL "a replaced link and an expired link say so on opening" . red: `FAIL: the old link says it was replaced gave ok, expected PT410` . green
32. SQL "accepting makes the intake the person's" . red: `ERROR:  function public.accept_intake_invite(text, unknown) does not exist` . green
33. SQL "another address can't accept" . red: `FAIL: another address can't accept gave ok, expected PT403` . green
34. SQL "an unverified address can't accept" . red: `FAIL: an unverified address can't accept gave ok, expected 42501` . green
35. SQL "a hash nobody holds / another firm's address (accepting)" . red: `FAIL: a hash nobody holds is not a link gave ok, expected PT404` . green (PT422 in the same cycle, not seen red alone)
36. SQL "a used, replaced or expired link is refused" . red: `FAIL: a used link is refused gave ok, expected PT410` . green
37. SQL "a member of the firm can't accept" . red: `FAIL: a member of the firm can't accept gave ok, expected PT403` . green
38. SQL "a person with an open intake is told so" . red: `FAIL: a person with an open intake is told so gave ok, expected PT409` . green (this also surfaced a fixture clash in test 7, fixed in the test by archiving that intake)
39. SQL "the broker's step reads where the invitation stands" . red: `ERROR:  function public.intake_invite_status(uuid) does not exist` . green
40. SQL "the delivery result is recorded against the current link, service role only" . red: `ERROR:  function public.record_intake_invite_delivery(uuid, text, unknown, unknown) does not exist` . green
41. SQL "a member of the firm can't certify" . red: `FAIL: a member of the firm can't certify gave ok, expected 42501` . green
42. SQL "the employer certifies a broker-started intake and no second chain is made" . green with no new code (make_intake_chain finds the opportunity the broker started it on); kept as a pin of ADR 0025.
43. SQL "certifying confirms the broker's entries" . red: `FAIL: a broker's entry is confirmed by the certification gave inferred, expected confirmed` . green
44. SQL "the employer can't give an answer a broker's source; a changed answer stays theirs" . red: `FAIL: the employer can't give an answer a broker's source gave ok, expected 42501` . green (the changed-answer assertions were green with no new code)

Cycles 45-49 (SQL, written before the redirection below, all kept): 45. a malformed intake id etc. is covered by the earlier lines; the shared broker-entry cases run through the database (green with no new code, a pin of provenance_source_is_valid; the browser side, below, was red on the missing cases file); 46. `broker_may_enter_intake` . red: `ERROR:  function public.broker_may_enter_intake(uuid) does not exist` . green; 47. Remind says an intake is closed first . red: `FAIL: a closed intake is not reminded about gave 23505, expected 55000` . green; 48. an intake nobody was invited about reads none (green with no new code, a pin).

**Redirection (the founder's direction, received mid-slice): a broker works the chamber we already have; no parallel answer-writing function.** Cycles 8-17 and 47 above, written against `broker_enter_answers`, were rewritten against the chamber's own save (an update of the intake as the member's browser writes it, `pg_temp.chamber_save`) and the function was removed. Each behaviour was run red against the new path before its code was written:

50. SQL "a member saves a broker-started intake through the chamber's own save and it is marked as a broker entry" . red: `FAIL: the member's save goes through gave rows:0, expected rows:1` . green (policy and trigger)
51. SQL "another firm's member, a stranger, a missing intake, an employer's own intake and a closed intake change nothing" . green with no new code (row security shows them no row): a pin
52. SQL "the FEIN is refused" . red: `FAIL: the FEIN is refused gave rows:1, expected 42501` . green
53. SQL "a broker never overwrites what the employer answered" . red: `FAIL: the employer's typed answer stands gave Monthly, expected Weekly` . green
54. SQL "a closing firm takes no save" . red: `FAIL: a closing firm takes no save gave rows:1, expected PT423` . green
55. SQL "a member's save can't change the employer or the PEO choice" . red: `FAIL: the employer can't be set by the member gave 56591946-..., expected <NULL>` . green
56. SQL "what the chamber writes from a message keeps its message and quote in the broker entry" . red: `FAIL: the message is kept gave <NULL>, expected m9` . green
57. Vitest provenance "marking what a broker enters in the chamber" (markBrokerEntries) . red: `expected 'Acme' to be 'Acme Co'` after the first run failed on the missing function (`markBrokerEntries is not a function`) . green (one of its tests had a wrong fixture, fixed: an answer with no provenance is the employer's)
58. Vitest useChamberSession "a member of the firm working an intake the firm started" (4 tests) . red: `expected true to be false` / `expected undefined to be false` . green
59. Vitest LiveWorkspace "leaves out Certify & sign" . red: `expect(element).not.toBeInTheDocument()` . green
60. Vitest ProvenanceField "the FEIN in a broker's chamber" . red: `Failed to resolve import "./BrokerEntryContext"` . green
61. Vitest ChamberPage "opens the intake it is given" and "is the client's intake" . red: `expected '?session=firm-intake' to be ''` and `Unable to find an element with the text: Your client's intake` . green
62. Vitest seo.guard "covers every route" for `/client-intake/:intakeId` . red: `/client-intake/:intakeId: expected 'Page not found | Nevermore' not to be ...` . green
63. Earlier, written as one batch (a deviation from one test per cycle, honestly): `src/lib/brokerIntake.test.ts`, `src/pages/IntakeInvitePage.test.tsx`, `supabase/functions/invite-client/handler.test.ts` (in three chunks: the invite; Remind; the refusals before anything is made; the database's refusals and the sending), `src/data/requiredItems.brokerCases.json` run by the browser (red: ENOENT) and the database, `seo.guard` for `/intake-invite` (red: `/intake-invite: expected 'Page not found | Nevermore' not to be ...`), `dataPolicy` for `intake_invitations` (red: `intake_invitations is stored but belongs to no data class`). The registries (data_isolation, help_from_nevermore, close_a_firm) were driven by their own existing tests, red first: close_a_firm `no function that changes data is left out of the closing's read-only list`, data_isolation `public.intake_invitations is not in the registry`, `closing a firm and the registry disagree`, `privileged functions and the registry disagree`, help_from_nevermore `every function that asks a membership helper is classified`.

## 5.3b

Lane 5.3b redoes three things in slice 5.3 (the tdd skill's one-test-per-cycle rule). Part A rebuilds the three files whose tests had been written as a batch (cycle 63 above), test-first, from their behaviour and not from their text: `src/lib/brokerIntake.ts`, `src/pages/IntakeInvitePage.tsx` and `supabase/functions/invite-client/handler.ts`, each deleted with its test (commit "5.3b: remove the batched modules to rebuild them test-first"). Part B redoes the two refusal cycles (30 and 35 above) whose second assertion was never red alone. Part C closes the hole D-1759 records (a broker's direct update of `extra_answers`). Every cycle: one test, run, the failing line seen, then the least code, then green. The failing line below is the one the run printed. Vitest files are run with `npx vitest run <file>`.

### A1. `src/lib/brokerIntake.test.ts` (Vitest, `supabase` faked at the client boundary)

1. startBrokerIntake "asks the database for the intake of an opportunity and answers its id" . red: `Failed to resolve import "./brokerIntake" from "src/lib/brokerIntake.test.ts"` . green
2. "says an opportunity that is not available is not available (PT404)" . red: `got 'Cannot read properties of null (readi…'` . green
3. "an opportunity that already has an intake (PT409)" . red: `got 'That opportunity isn't available.'` . green
4. "an archived account takes nothing (55000)" . red: `got 'That opportunity isn't available.'` . green (the refusals became a switch)
5. "a closing firm can't be changed (PT423)" . red: `got 'That opportunity isn't available.'` . green
6. "a caller who is no member of a firm (42501)" . red: `got 'That opportunity isn't available.'` . green
7. "a member of more than one firm is asked to say which (22023)" . red: `got 'That opportunity isn't available.'` . green
8. "tells the broker to try again for a failure it has no words for" . red: `got 'That opportunity isn't available.'` . green (PT404 got its own case)
9. "never reports a start that answered no intake as a success" . red: `got 'Cannot read properties of null (readi…'` . green
10. inviteClient "asks the server function to invite and says whether the email went" . red: `TypeError: api.inviteClient is not a function` . green
11. A test "leaves the name out of the request when none was given" was written next and was green on first run with no new code: `toEqual` ignores an `undefined` key, and a JSON body drops one anyway, so it could never be red. It was deleted, not kept (it proved nothing).
12. remindClient "asks the server function to remind about the intake" . red: `TypeError: api.remindClient is not a function` . green (inviteClient and remindClient share `callServer`)
13. "never reports a delivery it was not told of as sent" . red: `expected undefined to be 'unknown'` . green
14. "tells a refused send as failed" . red: `expected 'unknown' to be 'failed'` . green
15. "gives the reason the server gave when it refuses" . red: `got 'Cannot read properties of null (readi…'` . green
16. "tells the broker to try again when the server's reason can't be read" . red: `got ''` . green
17. "never reports an answer with no invitation as a success" . red: `promise resolved "{ invitationId: undefined, …(1) }" instead of rejecting` . green
18. fetchIntakeInviteStatus "answers none for an intake nobody was invited about" . red: `TypeError: api.fetchIntakeInviteStatus is not a function` . green
19. "answers a waiting invitation with its dates as dates" . red: `expected { state: 'none' } to deeply equal { state: 'waiting', …(8) }` . green
20. "answers an accepted invitation as accepted, with when" . red: `expected { state: 'waiting', …(8) } to match object { state: 'accepted', …(2) }` . green
21. "answers an expired invitation as expired" . red: `expected { state: 'waiting', …(8) } to match object { state: 'expired' }` . green
22. "answers no delivery for a link whose send was not recorded" . NOT red first: green on first run with no new code (a null outcome passed straight through). Kept as a pin; proven by mutation below.
23. "answers no delivery for an outcome it does not know" . red: `expected { state: 'waiting', …(8) } to match object { delivery: null }` . green
24. "says an intake that is not available is not available (PT404)" . red: `got 'Cannot read properties of null (readi…'` . green
25. "tells the broker to try again for any other failure" . red: `got 'That intake isn't available.'` . green
26. "answers none when the database answers nothing" . red: `TypeError: Cannot read properties of null (reading 'state')` . green
27. peekIntakeInvite "peeks at the link and answers the firm's name and who it is for" . red: `TypeError: api.peekIntakeInvite is not a function` . green
28. "gives the database the token's SHA-256 and never the token" . red: `expected 'abc' to be 'ba7816bf8f01…'` (the literal is the standard SHA-256 of "abc") . green
29. "says a link that is not valid is not valid (PT404)" . red: `got 'Cannot read properties of null (readi…'` . green
30. "says a replaced link was replaced (PT410)" . red: `got ''` . green
31. "says an expired link has expired (PT410)" . red: `got 'This link was replaced by a newer one…'` . green
32. "says a used link was already used (PT410)" . red: `got 'This invitation has expired. Ask your…'` . green
33. "says a withdrawn link was withdrawn (PT410)" . red: `got 'This invitation has already been used.'` . green
34. "a link at another firm's address (PT422)" . red: `got ''` . green
35. "tells the employer to try again for a failure it has no words for" . red: `got ''` . green
36. "never reports an empty peek as an invitation" . red: `got 'Cannot read properties of undefined (…'` . green
37. "answers no name when the invitation had none" . red: `expected { firmName: 'Acme Brokers', …(1) } to deeply equal { firmName: 'Acme Brokers', …(1) }` . green (the next test, "reads a single row as well as a list", was also typed into the file before this one passed, so two were red at once; it was taken out again before any code was written and put back as the next cycle)
38. "reads a single row as well as a list" . red: `Error: Couldn't open the invitation. Try again.` . green
39. acceptIntakeInvite "accepts at the firm's address and answers the intake that is now theirs" . red: `TypeError: api.acceptIntakeInvite is not a function` . green
40. "gives the database the token's SHA-256 and never the token" (accept) . red: `expected 'abc' to be 'ba7816bf8f01…'` . green
41. "an invitation sent to another email address (PT403)" . red: `got 'Cannot read properties of null (readi…'` . green
42. "a member of the firm can't take the client's place (PT403)" . red: `got 'This invitation was sent to a differe…'` . green
43. "a person with an intake in progress must finish it first (PT409)" . red: `got 'Couldn't open the invitation. Try ag…'` . green
44. "an unverified sign-in must verify its email (42501)" . red: `got 'Couldn't open the invitation. Try ag…'` . green
45. "never reports an accept that answered no intake as a success" . red: `got 'Cannot read properties of null (readi…'` . green

### A2. `src/pages/IntakeInvitePage.test.tsx` (component test; `useAuth`, `useFirmAddress` and `@/lib/brokerIntake` faked)

46. "tells a visitor who invited them, and records that the link was opened" . red: `Failed to resolve import "./IntakeInvitePage" from "src/pages/IntakeInvitePage.test.tsx"` . green
47. "says who the invitation is for" . red: `Unable to find an element with the text: /started this PEO intake for Lucia/` . green
48. "asks a signed-out visitor to sign in or create an account with the address it was sent to, and does not take the intake" . red: `Unable to find an element with the text: /sign in or create your account with the email address this invitation was sent to/i` . green
49. "sends them to sign in and brings them back to this page" . red: `Unable to find an element with the text: Sign-in page, back to /intake-invite` . green
50. "takes the secret out of the address bar as soon as it has read it, and never shows it" . NOT red first: green on first run, because the page reads the token with the existing `takeInvitationToken`, which already clears the address bar. Proven by mutation (reading `window.location.hash` directly): `expected '#token=the-token' to be ''`.
51. "offers a signed-in person to open the intake, and says which account that is" . red: `Unable to find role="button" and name "Open your intake"` . green
52. "takes over the intake with the secret from the link when they press the button, and opens it" . red: `expected "spy" to be called with arguments: [ 'the-token', 'acme-brokers' ]` . green
53. "forgets the secret once the intake is theirs" . red: `expected 1 to be +0` . green
54. "shows the reason for a refused acceptance and stays on the page" . red: `Unable to find role="alert"` . green
55. "offers to sign out after a refused acceptance" . red: `Unable to find role="button" and name "Sign out"` . green
56. "keeps the secret after a refused acceptance, so the right account can use the same link" . NOT red first: green on first run (the forget comes after the accept). Proven by mutation (forget before the accept): `expected +0 to be 1`.
57. "says why a link can't be used" . red: `Unable to find role="alert"` . green
58. "offers nothing to do for a link that can't be used" . NOT red first: green on first run (the alert branch returns alone). Proven by mutation (a button added to the alert): `expected document not to contain element, found <button>`.
59. "asks the person to use the link from their email when the page is opened with no secret" . red: `Unable to find an element with the text: /link is incomplete/i` . green. The test also asserts the database was not asked; the guard in the effect (`!token`) was written in the same green step as the message, so that second assertion was never red on its own. Proven by mutation (guard removed): `expected "spy" to not be called at all, but actually been called 1 times`.
60. "asks the person to open it at their broker's address when the page is not at a firm's" . red: `Unable to find an element with the text: /opens at your broker's own address/i` . green (a second test, "asks the database nothing at an address that is not a firm's", was typed into the file at the same time and also went red; it was taken out before any code and re-added next)
61. "asks the database nothing at an address that is not a firm's" . NOT red first: green on first run (the `!address` guard already stood). Proven by mutation (guard removed, address defaulted to ""): `expected "spy" to not be called at all, but actually been called 1 times`.
62. "shows a wait, not a button, while the sign-in is checked" . red: `Unable to find an accessible element with the role "status" and name "Checking your sign-in"` . green
63. "shows a wait while the firm's address is checked, not the 'open it at your broker's address' notice" . red: `Unable to find an accessible element with the role "status" and name "Checking your sign-in"` . green
64. "treats an anonymous session as signed out" . red: `Unable to find role="button" and name "Sign in or create an account"` . green
65. "shows a wait while the link is opened" . red: `Unable to find an accessible element with the role "status" and name "Opening your invitation"` . green
66. "won't take the intake twice while the first press is still working" . red: `expected "spy" to be called 1 times, but got 2 times` . green
67. "lets them press the button again after a refusal" . NOT red first: green on first run, because the `setBusy(false)` on failure was written in cycle 66's green step with no test asking for it. Proven by mutation (line removed): `expect(element).toBeEnabled()`.
68. The existing `src/copy.guard.test.ts` ("src/pages/IntakeInvitePage.tsx links to the Privacy Policy and Terms of Use") . red: `expected 'import { useEffect, useState } from "…' to match /<LegalLinks\b|<LegalPageLayout\b/` . green (the page's shell: brand mark, card, legal links). The classes and layout of the shell and buttons (the brand mark, the card, `min-h-11` buttons) are presentation no test in this seam observes; they were written after cycle 68 without a test, the same as the page they replace.

### A3. `supabase/functions/invite-client/handler.test.ts` (server function through request and response; the database as caller and as service role, and the mail provider, faked)

69. "makes the invitation, emails it and answers its id and that it was sent" . red: `Failed to resolve import "./handler" from "supabase/functions/invite-client/handler.test.ts"` . green
70. "asks the database as the caller, with the token's hash and the address in the form the database keeps" . red: `expected { …(4) } to deeply equal { …(4) }` . green
71. "emails the address the database kept a link at the firm's address, with the secret after the #" . red: `expected 'TOKEN-made-by-the-function-0123456789…' to contain 'https://acme-brokers.nevermorepeo.com…'` . green
72. Remind "makes a new token and asks the database as the caller to replace the old link" . red: `TypeError: Cannot read properties of undefined (reading 'trim')` . green
73. "emails the new link under a subject that says it is a reminder" . red: `expected 'Your PEO intake' to match /^Reminder: /` . green
74. "names the firm in the subject of an invitation" . red: `expected 'Your PEO intake' to be 'Acme <Brokers> asked you to finish your PEO intake'` . green
75. "greets the contact by name" . red: `expected false to be true` . green
76. "greets plainly when the invitation has no name" . NOT red first: green on first run (the no-name branch was written in cycle 75's green step). Proven by mutation (the branch made to print "Hello null,"): `expected false to be true`.
77. "says the link works once and until the day the database gave" . red: `expected 'Hello Lucia Perez,\n\n\nhttps://acme-…' to contain 'The link works once, and until 2026-1…'` . green
78. "names the firm in the html with its name escaped" . red: `expected '<p>Hello Lucia Perez,</p><p><a href="…' to contain 'Acme &lt;Brokers&gt;'` . green
79. "escapes the contact's name in the html" . red: `expected '<p>Hello Lucia <img src=x>,</p><p><st…' to contain 'Hello Lucia &lt;img src=x&gt;,'` . green
80. "comes from \"<Firm> via Nevermore\" at Nevermore's own sender address, with the firm's name cleaned" . red: `expected 'Nevermore <hello@mail.nevermorepeo.co…' to be 'Acme Brokers via Nevermore <hello@mai…'` . green
81. "keeps a firm name with a line break on one line in the sender" . red: `expected 'Acme\r\nBcc: x@y.test via Nevermore <…' not to match /[\r\n]/` . green
82. "records a refused send, as the service role, against this link" . red: `TypeError: Cannot read properties of undefined (reading 'as')` . green
83. "records a send that went as sent, with no error" . NOT red first: green on first run (cycle 82's code recorded every outcome). Proven by mutation (`p_error` made a constant): three tests red, among them this one: `records a send that went as sent, with no error`.
84. "tries once more after an unclear answer, with the same message and key" . red: `expected { ok: true, …(2) } to match object { delivery: 'sent' }` . green
85. "says unknown, and records unknown, when both attempts were unclear" . red: `expected { ok: true, …(2) } to match object { ok: true, delivery: 'unknown' }` . green
86. "does not try again after a refusal that proves nothing was sent" . NOT red first: green on first run (the retry was gated on `ambiguous` in cycle 84). Proven by mutation (retry on any failure): `expected [ { …(3) }, { …(3) } ] to have a length of 1 but got 2`.
87. "refuses a call with no login (401) and makes and sends nothing" . red: `expected 200 to be 401`. The test also asserts no database call and no mail; the one early return satisfies all three, so the last two were never red alone. Proven by mutation (login checked only after the database was asked): this test red.
88. "refuses an intake id that isn't one (400)" . red: `expected 200 to be 400` . green
89. "refuses an address that could never be emailed (400) before anything is made" . red: `expected 200 to be 400` . green
90. "refuses a request with no action (400)" . red: `expected 200 to be 400` . green
91. "refuses a body that isn't JSON (400)" . red: `SyntaxError: Unexpected token 'o', "not json" is not valid JSON` . green
92. "refuses a remind with no intake (400)" . NOT red first: green on first run (the intake-id check covers it). Proven by mutation (id check removed): two tests red, this one among them.
93. "makes nothing when the mail provider isn't set up (503)" . red: `Error: no mail` . green
94. "logs what is missing when it can't send" . red: `expected '' to contain 'INVITE_CLIENT_CONFIG_MISSING'` . green
95. "makes nothing when the app's address isn't set (503)" . red: `TypeError: Invalid URL: undefined` . green
96. "makes nothing when the sender address isn't set or isn't an address (503)" . red: `expected 200 to be 503` . green
97. "makes nothing when the service-role key isn't set (503)" . red: `expected 200 to be 503` . green
98. "answers 503 when the project's address isn't set" . red: `expected 200 to be 503` . green
99. "answers 503 when the anon key isn't set" . red: `expected 200 to be 503` . green
100. "answers PT404 as 404, in words, and emails nothing" . red: `TypeError: Cannot read properties of null (reading 'firm_address')` . green
101. "answers PT409 as 409 and says to remind them instead" . red: `expected 404 to be 409` . green
102. "answers 55000 as 409 …" . red: `expected 404 to be 409` . green
103. "answers PT423 as 423 …" . red: `expected 404 to be 423` . green
104. "answers 42501 as 403 …" . red: `expected 404 to be 403` . green
105. "answers 22023 as 400 …" . red: `expected 404 to be 400` . green
106. "answers 23514 as 400 …" . red: `expected 404 to be 400` . green
107. "answers anything else as a 500 to try again" . red: `expected 404 to be 500` . green
108. "logs the action and the code of a refusal and nothing the database said" . red: `expected [] to deeply equal [ Array(1) ]` . green
109. "answers 500 and sends nothing when the database's answer is missing what the email needs" . red: `TypeError: Cannot read properties of undefined (reading 'slice')` . green
110. and 111. "answers 500 and sends nothing when the address the database kept can't be emailed" and "logs that it could not read the database's answer, with no address in it": both written in one edit (a second deviation from one test per cycle), both green on first run, because cycle 109's green step already carried the address check and the log line. Proven by mutation (each removed in turn): each test red alone (`answers 500 and sends nothing when the address the database kept can't be emailed`; `logs that it could not read the database's answer, with no address in it`).
112. "answers a browser's preflight with the headers it needs" . red: `expected 401 to be 200` . green
113. "lets the page read its answers" . red: `expected null to be '*'` . green
114. "refuses any method but POST (405)" . red: `expected 400 to be 405` . green
115. "asks the database with the caller's own login and the anon key, never the service key" . NOT red first: green on first run. Proven by mutation (the caller's client made with the service key): three tests red, this one among them.
116. "never returns or logs the token" . NOT red first: green on first run (nothing logged the token). Proven by mutation (a log line carrying the token): this test red.
117. "sends each link under its own key, made from the link's hash and never from the token" . red: `expected 'intake-invitation:22222222-2222-4222-…' to be 'intake-invitation:22222222-2222-4222-…'` . green
118. "gives the database the contact's name on one line and capped" . red: `expected false to be true` . green
119. "refuses an address longer than 254 characters (400)" . red: `expected 200 to be 400` . green
120. "refuses an address that isn't text (400)" . NOT red first: green on first run (cycle 119's green step read the address through a `typeof` guard). Proven by mutation (the guard replaced by a bare `.trim()`): `refuses an address that isn't text (400)` red.

### B. The two refusal cycles whose second assertion was never red alone (old cycles 30 and 35: a link at another firm's address, PT422)

The old cycles asserted "a hash nobody holds" (PT404) and "a link at another firm's address" (PT422) in one section each; the PT422 assertion was written in the same cycle and never seen red by itself. The PT422 assertion of each is now its own section of `supabase/tests/broker_intake.sql`. The code stays (the guard is in the migration for both functions and was not untested behaviour to remove: the test exists, so it was proven by mutation).

121. SQL 29a "a link opened at another firm's address is refused (PT422)" (peek) . NOT red first: green on the split with no code change. Proven by mutation (the PT422 guard removed from `peek_intake_invite`): `ERROR:  FAIL: a link opened at another firm's address is refused gave ok, expected PT422` (and the PT404 assertion, now alone in 29, stays green under that mutation).
122. SQL 34a "a link accepted at another firm's address is refused (PT422)" (accept) . NOT red first: green on the split. Proven by mutation (the guard removed from `accept_intake_invite`): `ERROR:  FAIL: a link accepted at another firm's address is refused gave PT409, expected PT422`.
123. SQL 29b "a replaced link opened at another firm's address says nothing of its state" (PT422 before PT410: the claim in the old comment, "checked first, so it learns nothing of the link's state", had no assertion) . NOT red first: green on first run (the guard comes first). Proven by mutation (the address checked only for a waiting link): `ERROR:  FAIL: a replaced link opened at another firm's address says nothing of its state gave PT410, expected PT422`.
124. SQL 34b, the same for accepting . NOT red first: green on first run. Proven by mutation: `ERROR:  FAIL: a replaced link accepted at another firm's address says nothing of its state gave PT410, expected PT422`.

### C. The hole D-1759 records (`extra_answers` writable by a member's crafted direct update), D-1759a

All in `supabase/tests/broker_intake.sql` (sections 51 to 62), run with `supabase/tests/run.sh broker_intake`; the code is the new migration `supabase/migrations/20261123120100_broker_intake_columns.sql` (the trigger function restated from 20261123120000 with every line kept, plus one check).

125. SQL 51 "a member's update of the extra answers is refused" . red: `ERROR:  FAIL: a member's update of the extra answers is refused gave ok, expected 42501` . green (the migration: first an explicit check on `extra_answers`)
126. SQL 52 "the chamber's own save still goes through" (it sends the answers, provenance, conversation, PEO choice and extra answers as they stand) . NOT red first: green on first run (nothing yet refused an unchanged value). A guard against over-refusal; every mutation that refuses all saves also fails earlier tests (`a member's save of intake1 goes through gave 42501, expected rows:1`), so it is not proven alone.
127. SQL 53 "a member's update of the submission is refused" . red: `ERROR:  FAIL: a member's update of the submission is refused gave ok, expected 42501` . green (a second explicit check)
128. SQL 54 "a member's update of the expiry is refused" . red: `ERROR:  FAIL: a member's update of the expiry is refused gave ok, expected 42501` . green: here the two explicit checks became one comparison of the whole row but the five columns the save sends (`chamber_data`, `field_provenance`, `transcript`, `user_id`, `chosen_peo`), because a third column was red the same way and a list of names fails open for the next column added.
129. to 136. SQL 55 firm, 56 starter (`started_by`), 57 consent link, 58 referral code, 59 File ID, 60 schema version, 61 status, 62 version (`data_version`): each written after the comparison existed, so each NOT red first (green on first run); each proven by mutation (the column added to the comparison's exclusion list), red with `a member's update of the firm is refused gave ok, expected 42501`, `... the starter ... gave ok`, `... the consent is refused gave 23503, expected 42501`, `... the referral code ... gave ok`, `... the File ID ... gave ok`, `... the schema version is refused gave 23514, expected 42501`, `... the version is refused gave ok`. Also proven by the same mutation for 51, 53 and 54. The status test (61) stays green under that mutation: the policy's `WITH CHECK` (status must stay `in_progress`) refuses it too (42501), so it has a second lock; it is kept as a pin.
# TDD log, slice 5.7 (CRM-Q2.4, New quote step 3)

Skill `mattpocock-skills:tdd` was the first tool call. One test per cycle; "red" is the failing line seen before any code for it.

1. NewQuoteDialog.test: "opens the existing certified view of the opportunity's certified intake, the submission page itself" — red: `Unable to find an element by: [data-testid="submission-page"]` — code: OpportunitySaved renders AdvisorSubmissionPage (submissionId, embedded) when the page has an intake — green.
2. NewQuoteDialog.test: "does not open the certified view for an intake that is not certified, and keeps the saved summary with Save and close" — red: `Unable to find an element with the text: Harborview Dental Group` (stand-in shown for a draft) — code: condition `page.intake?.certifiedAt` — green.
3. NewQuoteDialog.test: "shows Save and close beside the certified view, and it closes on the opportunity" — red: `Unable to find an accessible element with the role "button" and name "Save and close"` — code: Save and close button above the embedded page — green.
4. NewQuoteDialog.test: "goes back to the saved account, contact and opportunity from the certified view" — red: `Unable to find an accessible element with the role "button" and name "Back to New quote"` — code: backToFlow state and button — green.
5. NewQuoteDialog.test: "reopens the certified view from the saved summary of a certified opportunity" — red: `Unable to find an accessible element with the role "button" and name "Certified answers"` — code: Certified answers button on the summary — green.
6. newQuote.test: "shows for a certified intake and for no other state" (certifiedViewShows) — red: `certifiedViewShows is not a function` — code: `certifiedViewShows` in src/data/newQuote.ts, then OpportunitySaved asks it instead of reading certifiedAt itself (component tests stayed green) — green. DEVIATION: I first wrote a second test (quotes sent still shows the view) in the same step and saw both red; I deleted the second before writing any code, because the minimal code for the first would pass it on first run (a characterization, not a cycle). Only one test was driven by code.
7. AdvisorSubmissionPage.test: "shows the submission it is given by prop, with no address naming one" — red: `expected "spy" to be called with arguments: [ 's7', true ]` (it asked for the empty address id) — code: `submissionId` prop beats the route param — green.
8. AdvisorSubmissionPage.test: "embedded in New quote, shows no link back to all submissions, while loading and loaded" — red: `expect(element).not.toBeInTheDocument()` (link present) — code: link hidden when `embedded` — green.
9. AdvisorSubmissionPage.test: "names the certified version on the certified line" — red: `Unable to find an element with the text: /Certified by Jo Doe, CEO · .* · version 2/` — code: ` · version N` after the certification time — green.
10. AdvisorSubmissionPage.test: "shows the submission it is given even when the address names another" — NOT red-first: added after the mutation `params.id ?? submissionId` survived (cycle 7 had no :id in its address). Green on first run against the real code; red (1 failed) under that mutation.

Mutation pass (9 mutations of what was built; each must turn a test red): certifiedViewShows true for any intake, Back removed, Certified answers removed, wrong submission id, Save and close removed, prop/param precedence swapped, embedded link kept, version dropped. 8 of 9 red at once; the precedence swap survived until cycle 10, then red.
# TDD log, slice 5.8 (CRM-Q2.5, CRM-Q2.6)

Seam 2 (D-13): component tests. One test per cycle, seen red for the right reason, then the least code, then green.

1. says a PEO's fit can't be told yet, with the reason. Red: `Expected element to have text content: Can't tell yet · Justworks's minimum headcount isn't checked yet.` (the row had none). Green: a fit line in the choosing step (outcome words + first check that says so). Cycle 1's code was general (every outcome), so the next test would pass at once; see cycle 2.
2. says a PEO doesn't fit, with the reason. NOT red-first on the real code (cycle 1's code already handled every outcome); I undid it to unknown-only, saw red: `Expected element to have text content: Doesn't meet · TriNet takes groups of 20 or more employees; this employer has 12.`, restored the general line, green.
3. says, for each PEO, whether the employer authorized it. Red: `Expected element to have text content: Not authorized` (row had none). Green: state line from the authorizations the component already reads (STATE_WORDS exported from PacketRecipientsPanel, reused).
4. doesn't let a PEO the employer hasn't authorized be ticked, even one that is ready. Red: `expect(element).toBeDisabled()` on Oasis. Green: checkbox disabled when the employer's say is read and isn't authorized; ticks dropped when it arrives. The older 'stops a PEO the employer hasn't authorized' test still passes (it clicks before the read lands; the stop in the review/send stays as the guard for that race).
5. sends the employer an information request to add a PEO they haven't authorized. Red: `Unable to find role="button" and name "Ask Lucia to add TriNet"`. Green: an Ask button on each not-authorized PEO calling advisorApi.requestInformation with PacketRecipientsPanel's askToAddPeo wording (exported, reused); employer = certifier's first name.
6. says the employer was asked, and offers the ask once. Red: `expect(element).toHaveTextContent() ... Asked Lucia to add TriNet.`. Green: an asked list; the button is replaced by the sentence.
7. says why an ask was refused, in the database's words, and keeps the ask on offer. Red: `toHaveTextContent ... Your firm is closing` plus an unhandled rejection. Green: the ask caught; failureWords shown on the row.
8. names the firm's contact at each PEO while choosing. Red: `toHaveTextContent ... Contact: Omar Diaz, Ruth Kim (Sales)`. Green: contact line from the contacts the component already reads.
9. with no PEO authorized, disables Review and says the employer hasn't authorized one yet. Red: `Unable to find an element with the text: Lucia hasn't authorized a PEO yet.`. Green: noneAuthorized disables Review (Review is step 4's Continue) and says it.
10. with no PEO authorized, 'Ask Lucia' sends one information request naming the listed PEOs. Red: `Unable to find role="button" and name "Ask Lucia"`. Green: Ask <employer> beside the notice, same ask function, askToAddAnyPeo wording added beside askToAddPeo.
11. with no PEOs listed, says so and who to ask. Red: `Unable to find an element with the text: No PEOs are listed yet...`. Green: the choosing step is that sentence alone for an empty catalog (no Review, no employer blame).
12. offers Try again on a PEO whose send failed, which sends that PEO alone. Red: `Unable to find role="button" and name "Try again with Justworks"`. Green: sendOne extracted from send, an outcome flagged retry, Try again through beforeSend. Side effect: the older refused-send test's `result` helper read the whole li text, which now carries the button, so it reads the li's first text node (helper change, same assertions).
13. opens the existing choose-and-send at once for a certified intake with nothing sent (New quote dialog on an opportunity). Red: `Unable to find role="region" and name "Send to several PEOs"`. Green: OpportunitySaved reads stepToOpenAt(progressOf(page)) and, at 4, places ChoosePeos (new prop startChosen) with useStillNeeds.
14. draws no choosing for no intake / an intake not certified. NOT red-first on the real code (cycle 13 already read stepToOpenAt); I undid it to `atChoosing = !!page`, saw red: `expect(element).not.toBeInTheDocument()` x2, restored, green.
15. reads the opportunity again once a send has gone. My cycle-13 code had a refetch with no test (code before test); I replaced it with a no-op, saw red: `expected "spy" to be called 2 times, but got 1 times`, restored it, green.
(Refactor after cycle 12, no new behaviour: STATE_WORDS, askToAddPeo and askToAddAnyPeo moved from PacketRecipientsPanel to src/data/peoAuthorizationWords.ts to keep the component file free of non-component exports; tests unchanged and green. Two older tests, AdvisorSubmissionPage's "offers to send several PEOs at once" and OpportunityPage's "opens Send to several PEOs on the quotes panel", now give the employer's authorization of the PEOs they expect ticked, because an unauthorized PEO is no longer ticked, D-1784.)

Mutation round (each of 28 rules of the new code broken, a test must go red). Five survived; each got a test, and each of these cycles was seen red against the mutant (the real code was already right, so none was red-first on real code, and they are logged as mutation-driven):
16. gives the reason from the check that says so, not from the first check. Mutant `checks[0]?.sentence`: red (`Received:` the wrong sentence). Real code: green.
17. doesn't let a PEO the employer withdrew be ticked, and says it was withdrawn. Mutant `=== "not_asked"` on the disabled test: red. Real code: green.
18. tries again with the PEO whose line it is on, not the first one. Mutant `chosen[0]`: red. Real code: green.
19. tells the page when a send goes on Try again, after none had. Mutant with onSent removed from retry: red. Real code: green.
20. checks the mailbox again on Try again, and offers to connect one that has gone. Mutant calling retry without beforeSend: red. Real code: green.
# TDD log, slice 5.9 (CRM-Q3.2, a quote's page)

tdd skill invoked first (yes). One test per cycle: test written, run red, least code, run green. Each line: test, the failing output seen, green.

1. quotePageApi: getQuotePage is none when the quote request is not one the person can read. RED: Failed to resolve import "./quotePageApi" (module missing). Code: module that reads the row and answers null. green.
2. quotePageApi: gives the quote request with its submission and its opportunity's page (read, not opened). RED: AssertionError: expected undefined to be 'TriNet'. Code: the three reads put together. green.
3. quotePageApi: none when its submission is on no opportunity the person can see, and nothing more is read. RED: TypeError: Cannot read properties of null (reading 'id'). Code: return null when no opportunity. green.
4. quotePageApi: none, with nothing asked, for an address that is not a quote request's number. RED: expected [ ...(14) ] to deeply equal []. Code: digits check. green.
5. quotePageApi: none when the submission, the opportunity or the request is missing from what the reads give. RED: expected { request: undefined, ...(2) } to be null. Code: the three guards. green.
6. QuotePage: shows the page's frame in grey while it loads, and says once that it is loading. RED: Failed to resolve import "./QuotePage". Code: the page with its loading frame (and the query hook, which this test did not yet need: a little more than the least). green.
7. QuotePage: says the quote isn't available, with the way back, when the database shows none. RED: Unable to find role="heading" and name "This quote isn't available.". Code: NotAvailable for null. green.
8. QuotePage: says the page failed, with Try again. Process slip: I wrote the code in the same step as the test; I undid it, ran the test and saw RED (Unable to find an element with the text: /We couldn.t load this quote/), then re-added the code. green.
9. QuotePage: the trail leads back: Accounts, the account, the opportunity, the PEO as where you are. RED: Unable to find role="navigation" and name "Breadcrumb". Code: the trail. green.
10. QuotePage: the header names the PEO, the status with days waiting, and when it was sent and from which version. RED: Unable to find role="heading" and name "TriNet". Code: QuoteHeader (reusing Pill, quoteStatusWords). green.
11. PeoThreadPanel: for one named quote request (a quote's page) opens that thread at once, with no chooser, and marks it read. RED: expected document not to contain element (the chooser group was drawn). Code: ofRequest prop (initial selection, effect that opens it, chooser hidden, early return moved below the hooks). green.
12. QuotePage: shows the emails with this PEO, newest first, and only this PEO's. RED: Unable to find role="region" and name "Emails". Code: PeoThreadPanel (ofRequest) on the page, headed Emails. (Fixture lacked the thread arrays once: fixed in the test, not a behaviour.) green.
13. QuotePage: shows what was sent and says No reply yet with the days waiting while a sent quote has no email back. RED: Unable to find an element with the text: No reply yet · waiting 5 days. Code: noReplyWords (src/data/quotePage.ts), PeoThreadPanel footer slot. green.
14. QuotePage: does not say No reply yet once the PEO has written back. Cycle 13's code already had this guard (too big); I took it out, saw RED (expected document not to contain element, found <p), put it back. green.
15. QuotePage: no reply-yet line for a quote that is quoted, declined or closed; it keeps counting for acknowledged and question open. RED: expected document not to contain element, found <p. Code: the open-status guard (isOpenQuoteRequest). green.
16. QuotePage: says the send was recorded by hand, with the reply address to copy, when the product sent nothing. RED: Unable to find an element with the text: /Sent outside the product/. Code: outside-the-product line and the exported ReplyAddress. (Fixture lacked quoteRequestAddresses once: fixed in the test.) green.
17. QuotePage: says nothing of it when the product sent the packet, or nothing was sent. Not red first: the guard was already in cycle 16's code (too big); I set outside = true, saw RED (expected document not to contain element, found <p), restored the guard. green.
18. QuotePage: the details list the PEO contact, status, sent, version, what it still needs and the reply address. RED: Unable to find role="region" and name "Details". Code: QuoteDetails, peoContactWords (sent-message addresses only), useStillNeeds reused. green.
19. QuotePage: the PEO contact is the person who last wrote from the PEO when the product sent nothing. RED: expect(element).toHaveTextContent() (it read Not known). Code: fallback to the newest received message. green.
20. QuotePage: the Quote panel shows what was quoted: admin fee, received, expires, proposed start. RED: Unable to find role="region" and name "Quote". Code: QuoteFigures. green.
21. QuotePage: the Quote panel reads Not yet on each line while no quote is recorded. RED: toHaveTextContent (the lines were empty). Code: null reads Not yet. green.
22. QuotePage: What was sent says which version of the packet and when, and warns when a newer one is certified. RED: Unable to find role="region" and name "What was sent". Code: WhatWasSent, olderVersionNote reused. green.
23. QuotePage: What was sent lists each email the product sent: when, to whom, subject, link to the packet, the update's earlier version. RED: Unable to find an accessible element with the role "list" and name "Emails sent". Code: the list in WhatWasSent. green.
24. QuotePage: Close closes the quote request with the agent's reason through updateQuoteRequest(closed) and reads the page again. RED: Unable to find role="button" and name "Close". Code: CloseQuote (existing advisor_update_quote_request, no new SQL), header actions slot. green.
25. QuotePage: Close is offered on an open quote request the person may change, and nowhere else (quoted, declined, closed, archived account, cannot change, support session). RED: expected true to be false. Code: canAct and canClose. green.
26. QuotePage: a Close that does not go through says so in words, keeps the form and what was typed. Not red first: the failure handling was already in cycle 24's component (too big); I replaced it with nothing, saw RED (Unable to find role="alert"), restored it. green.
27. QuotePage: a closed quote shows a banner with why (the withdrawal's reason and the note). RED: Unable to find role="note" and name "This quote is closed". Code: ClosedBanner. green.
28. QuotePage: a quote closed by the opportunity's won or lost says why (the search ended / the employer went elsewhere). RED: expect(element).toHaveTextContent() (banner had no reason). Code: useOpportunityOutcomeQuery reused, quoteCloseWords. green.
29. QuotePage: sets Acknowledged / Question open / Back to Sent with the submission page's own OpenStatusButtons, then reads the page again. RED: Unable to find role="button" and name "Mark TriNet question open". Code: OpenStatusButtons exported and placed in the header. green.
30. QuotePage: offers Follow up and Withdraw (FollowUpOrWithdraw, 6.9) on an open quote request the product has written to. RED: Unable to find role="button" and name "Withdraw from TriNet". Code: QuoteSendActions builds its props from useStillNeeds' certified version, catalog and submission, as PeoNeedsPanel's card does. (Fixture lacked detail.data once: fixed in the test.) green.
31. QuotePage: Follow up or Withdraw is not offered on a closed or declined quote request, one the product never wrote to, an archived account or a support session. Not red first: the guards were already in cycle 30's component (too big); I removed the lastSent and status guards, saw RED (expected true to be false), restored them. green.
32. QuotePage: offers Send again on a closed quote, the submission page's own SendToPeo (opens its form, reads the PEO's contacts). RED: Unable to find role="button" and name "Send again". Code: SendToPeo label prop; QuoteSendActions' closed branch (with RecordSendPrompt for the send-it-yourself path, so no dead button). (Test defaults for the mailbox and send context added to the shared beforeEach once the earlier follow-up form needed them.) green.
33. QuotePage: has no Record the quote or Record a decline, whatever the status (D-1706). NOT red first, by design: a pin on a feature that must stay absent; nothing to write. green on first run.
34. OpportunityPage: the quotes panel opens the quote's page from each PEO (the earlier test, 'opens the submission's page from each PEO', rewritten first). RED: Expected the element to have attribute href /quotes/1 (it was /advisor/submissions/i1). Code: quotePath, panel link. green.
35. AccountPage: a quote's PEO on the account's Quotes tab opens the quote's page (the earlier assertion rewritten first). RED: Expected the element to have attribute href /quotes/1. Code: quoteColumns link uses quotePath. green.
36. QuoteRequestsPanel (the submission page's quote requests): each links to its own quote page. RED: Unable to find an accessible element with the role "link" and name "Open TriNet's quote page". Code: the Link (the panel's test renders were first wrapped in a MemoryRouter: infrastructure, no behaviour). green.
37. seo.guard: names a quote's page privately (Quote | Nevermore, not indexed, in PRIVATE_PATH_EXAMPLES). RED: expected 'Page not found | Nevermore' to be 'Quote | Nevermore'. Code: seo.ts route entry and example. green.
38. seo.guard X-Robots-Tag: tells crawlers not to index /quotes/123 (the existing vercel test loops PRIVATE_PATH_EXAMPLES; cycle 37's example made it fail). RED: /quotes/123: expected false to be true. Code: quotes/.* in vercel.json's noindex source. green.
39. MenuSearch: a quote hit opens the quote's page (the earlier assertion rewritten first). RED: expected '/advisor/submissions/i1' to be '/quotes/7'. Code: hitPath. green.
40. WorkspaceShell: the menu marks Quotes as current at /quotes/7. RED: expected [] to deeply equal [ 'Quotes' ]. Code: menu.ts isCurrent. green.
41. brokerAuth: brokerNext keeps a quote's page by its number (so a mailbox connected from Follow up or Send again comes back to it). RED: /quotes/7: expected '/advisor' to be '/quotes/7'. Code: NEXT_PATTERN. green.
42. App.tsx: the route /quotes/:quoteRequestId (lazy QuotePage). Wiring only, no test of its own (the page's tests mount it directly; seo.guard's every-route check and the vercel rule cover the route's name and noindex, cycles 37 and 38). Not red first, by design.
43. Mutation gaps closed (each test written while the mutant was in place, seen RED, then the code restored): brokerNext accepts /quotes/ with no number; PeoThreadPanel ofRequest's initial selection (no mail yet); QuoteSendActions' cantTell guard (no Follow up or Withdraw from a version that cannot say what it held). RED: brokerNext('/quotes/') kept; 'Choose a PEO' text shown; Withdraw button present. Code: none new (the code was right; the tests were missing). green.
44. Gate catch, not a new behaviour: QuoteRequestsPanel.test.tsx (cycle 36's tests) failed to load on its own (`supabaseUrl is required`): the panel imported quotePath from accountColumns, which pulls in the Supabase client the test does not mock. It passed in the lane only where an env gave the client a URL. The test was already red for the right reason; least fix: quotePath moved to src/data/quotePage.ts (pure), imported by accountColumns, QuotesPanel and QuoteRequestsPanel. green; a test that loads with no Supabase env is the guard.
