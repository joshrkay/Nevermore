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
