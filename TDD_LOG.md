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
