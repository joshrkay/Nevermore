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
