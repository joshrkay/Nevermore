# TDD log: slice 6.8, M-2.3 (send an update, #202)

The `tdd` skill was invoked first. One test per cycle: the test written, run and seen failing for the right reason, then only the code that passes it.
(The lane's first working copy was lost to a usage limit before any cycle was logged; this log starts from a fresh copy of the build line.)

1. `peo_update.sql` 1, an update is queued on the PEO's own thread. Red: `ERROR:  function public.send_peo_update(uuid, text, text[], unknown, unknown) does not exist`. Green.
2. `peo_update.sql` 2, the update says what changed: fields by label, census by count, never a value. Red: `FAIL: the note, then what changed gave Dana, the employer certified again., expected ...`. Green (the test's own value check first matched "changed" against `Ed\M` case-blind; the check was made case-sensitive and word-bounded, then green).
3. `schemaSync.test.ts` "names what changed in an update by the labels the field review shows". Not red on its first run: the SQL label list it guards was generated from `FIELD_LABELS` for cycle 2. Seen red by mutation (`'Pay frequency'` changed to `'Pay cadence'` in the migration: `+ "Pay cadence"`), restored, green.
4. `peo_update.sql` 3, a PEO that already holds the latest certified version has no update. Red: `FAIL: the latest version, already sent gave ok, expected PT409: Insperity already has version 2, the latest certified.` Green.
5. `peo_update.sql` 4, a PEO never sent to has no update. Red: `FAIL: never sent to gave ok, expected PT409: Nothing was sent to Oasis yet, so there is no update. Send it the bundle.` Green.
6. `peo_update.sql` 5, only a PEO still open (sent or quoted) gets an update; declined or closed does not. Red: `FAIL: declined gave ok, expected PT409: Oasis declined, so there is no update to send. Send it the bundle to ask again.` Green.
7. `peo_update.sql` 6, the new version's link revokes the old one as newer_version; a second link for the same version still replaces it. Red: `FAIL: the version 1 link is revoked as newer_version gave replaced, expected newer_version`. Green (issue_bundle_link restated from 20261122110000 with every line kept and the reason chosen by version).
8. `peo_update.sql` 7, the queue's "older version sent" clears once every PEO holding an older version has the newer one. Not red on its first run: the queue (`advisor_list_submissions`, 20261118140500) already reads `sent_version` of the open quote requests, which the update moves. Seen red by mutation (the update leaving TriNet's `sent_version` at 1: `FAIL: every PEO has version 2: the flag clears gave t, expected f`), restored, green. No code was written for it.
9. `peo_update.sql` 8, a quoted request stays quoted after the update, its quote marked as given on version 1. Red: `ERROR:  column "quoted_version" does not exist`. Green (the column, a BEFORE trigger setting it when a request becomes quoted, existing quotes backfilled unlogged).
10. `peo_update.sql` 9, a new answer marks the quote as given on the version sent; a note alone does not. Red: `FAIL: a new answer: given on version 2 gave 1, expected 2`. Green.
11. `peo_update.sql` 10, an update is refused as a send is: support session, closing firm, another firm, the prospect, no mailbox, answers changed, the employer withdrew the PEO; nothing recorded. Not red on its first run: the guard and the delegation to `send_to_peo` were written in cycle 1 as the function's skeleton (that guard line came before its test; recorded here honestly). Seen red by mutation (`send_peo_update` without its own `assert_firm_writable`: `FAIL: a support session, on a PEO with no update gave PT409: Insperity already has version 2, the latest certified., expected PT423 ...`), restored, green.
12. `SendToPeo.test.tsx` "offers a PEO holding an older version the update, and sends nothing until the advisor sends it". Red: `Unable to find an element with the text: Insperity has version 2. Version 3 is certified.` Green (`updateFrom` prop; the offer line, the button and form named "Send version 3 to Insperity", the preview line, `update: true` on the send).
13. `peoSendApi.test.ts` "sends an update through send_peo_update, then issues the link and joins it as a send does". Red: `AssertionError: expected [ 'send_to_peo', …(1) ] to deeply equal [ 'send_peo_update', …(1) ]`. Green.
14. `quoteRequests.test.ts` "is the version a PEO still open on the submission holds, when it is older than the latest certified". Red: `TypeError: updateFrom is not a function`. Green (`updateFrom` in `src/data/quoteRequests.ts`).
15. `AdvisorSubmissionPage.test.tsx` "offers the update on the card of a PEO holding an older version, and a plain send where it holds the latest". (The card's wiring had been typed with cycle 14; it was taken out before this test was run.) Red: `Unable to find an element with the text: Justworks has version 1. Version 2 is certified.` Green (`PeoNeedsPanel` passes `updateFrom(sent, certified.version)`).
16. `data_isolation.sql`, `help_from_nevermore.sql`, `close_a_firm.sql` (existing registry tests) on the new `send_peo_update`. Red: `FAIL: privileged functions and the registry disagree`; `FAIL: every function that asks a membership helper is classified ... gave send_peo_update`; `FAIL: no function that changes data is left out of the closing's read-only list ... gave send_peo_update`. Green (registered beside `send_to_peo` in all three: advisor, firm-scoped probe, secret read; a write; guarded). `peo_update_changes` was made no definer, so no registry needs it.
17. `QuoteRequestsPanel.test.tsx` "marks a quote as given on the older version until the advisor records a new answer". Red: `Unable to find an element with the text: Quote given on version 1; version 2 sent since`. Green (`quotedOnOlderNote` in `src/data/quoteRequests.ts`, shown under the quote).
18. `quoteRequests.test.ts` "the version a quote was given on, in the change log, is named in words". Red: `Expected: "Quote given on version: 1 → 2" Received: "quoted_version: 1 → 2"`. Green.
19. The gate: `queue_query.sql` (existing) went red on the new column's check: `ERROR:  new row for relation "quote_requests" violates check constraint "quote_requests_quoted_version_check"` (a quoted fixture with `sent_version` 0). The two new columns copy `sent_version`, which is unchecked, so their `> 0` checks were dropped. Green. And `AdvisorSubmissionPage.test.tsx` cycle 15's test, run with the whole file, saw the earlier send test's call on the shared mock (`expected "spy" to not be called at all`); it clears the mock first. Green.

## Mutations (each rule broken in turn; a test must go red)

| Mutation | Test that went red |
|---|---|
| `updateFrom` offers a declined or closed PEO | `quoteRequests.test.ts` "is the version a PEO still open ... holds" |
| "Quote given on version" shown when the quote answered the version sent | `QuoteRequestsPanel.test.tsx` "marks a quote as given on the older version ..." |
| `SendToPeo` sends an update without `update: true` | `SendToPeo.test.tsx` "offers a PEO holding an older version the update ..." |
| `PeoNeedsPanel` does not pass `updateFrom` | `AdvisorSubmissionPage.test.tsx` "offers the update on the card ..." |
| `sendToPeo` always calls `send_to_peo` | `peoSendApi.test.ts` (cycle 13's red) |
| SQL label list differs from `FIELD_LABELS` | `schemaSync.test.ts` (cycle 3) |
| `send_peo_update` keeps no `update_from_version` | `peo_update.sql` 1: `the version the PEO held gave <NULL>, expected 1` |
| the summary carries each changed answer's value | `peo_update.sql` 2: `the note, then what changed gave ...` |
| the census's changed people not counted | `peo_update.sql` 2 |
| no refusal for a declined PEO | `peo_update.sql` 5: `declined gave ok` |
| no refusal for a closed quote request | `peo_update.sql` 5: `closed gave ok` |
| no refusal when the PEO already has the latest | `peo_update.sql` 3: `the latest version, already sent gave ok` |
| no refusal for a PEO never sent to | `peo_update.sql` 4: `never sent to gave ok` |
| `issue_bundle_link` always revokes as `replaced` | `peo_update.sql` 6: `revoked as newer_version gave replaced` |
| `issue_bundle_link` always revokes as `newer_version` | `peo_update.sql` 6: `a second link for version 2 replaces the first gave newer_version` |
| `quoted_version` follows `sent_version` on every write | `peo_update.sql` 8: `the quote marked as given on version 1 gave 2` |
| `quoted_version` set only when a request becomes quoted | `peo_update.sql` 9: `a new answer: given on version 2 gave 1` |
| `send_peo_update` without its own closing and support guard | `peo_update.sql` 10: `a support session, on a PEO with no update gave PT409` |
| the update leaves TriNet's `sent_version` behind | `peo_update.sql` 7 (cycle 8) |

Every mutation went red; none was left green.

## The gate (after merging `claude/admiring-keller-dd7w1a`, with 6.7, into `lane/6.8`)

- `npm run lint`: 0 errors, 13 warnings (none in this slice's files).
- `npm run typecheck:functions`: clean.
- `npm test`: 285 files, 5942 tests; 5941 passed and one failed, `AdvisorPeosPage.test.tsx` "closes the history when a version is published ...", a file this slice does not touch, while the SQL suite ran beside it; run alone twice, 60 of 60 passed.
- `npm run build`: built.
- `supabase/tests/run.sh` on port 5436: all 96 SQL tests passed.
