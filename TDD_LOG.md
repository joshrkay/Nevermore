# TDD log: slice 5.1, N-1.2 and the database half of CRM-Q3.1 (quote statuses)

The `tdd` skill was the first tool call. One test, seen red, then only its code, seen green. Seams (D-13): (1) SQL tests in `supabase/tests`
(`quote_statuses.sql`), (2) component tests. Branch `lane/5.1-build` (the name `lane/5.1` is held by another worktree at an older commit).

| # | Test | Red (the failing line seen) | Green |
|---|---|---|---|
| 1 | quote_statuses.sql 1: the database holds the two new statuses | `ERROR:  new row for relation "quote_requests" violates check constraint "quote_requests_status_check"` | green |
| 2 | quote_statuses.sql 2: an agent records acknowledged, question open, and back to sent | `ERROR:  function public.advisor_set_quote_request_status(bigint, text) does not exist` | green |
| 3 | quote_statuses.sql 3: only an advisor of the quote request's own firm records a status | `FAIL: another firm's agent gave ok, expected PT404: Quote request not found` | green |
| 4 | quote_statuses.sql 4: a closing firm and a support session record nothing | `FAIL: a support session gave ok, expected PT423: Nevermore support can look, not change` | green |
| 5 | quote_statuses.sql 5: only the three open statuses are recorded here | `FAIL: quoted is recorded elsewhere gave ok, expected 22023: This records Sent, Acknowledged or Question open...` | green |
| 6 | quote_statuses.sql 6: a quote, a decline and a close are not undone here | `FAIL: Paychex is not open any more gave ok, expected 22023` | green |
| 7 | quote_statuses.sql 7: setting the status it already has is refused | `FAIL: Sent again gave ok, expected 22023: TriNet is already Sent.` | green |
| 8 | quote_statuses.sql 8: every change records who and when, immutably | none: green at once (the existing log_quote_request_change and append-only triggers already do this); proven by mutation at the end (the trigger dropped: `FAIL: ... gave <NULL>`) | green |
| 9 | quote_statuses.sql 9: the stage is In market with Sent/Acknowledged/Question open and none Quoted, Quoted once one is | none: green at once (the stage is the submission's, moved only by a send and a quote, ADR 0026; no restatement needed, D-1735); proven by mutation at the end | green |
| 10 | quote_statuses.sql 10: sending again returns Question open to Sent; Acknowledged stays | `FAIL: sending again returns Question open to Sent gave question_open, expected sent` | green |
| 11 | quote_statuses.sql 11: an arriving email never changes a status | none: green at once (nothing reads mail into a status); proven by mutation at the end | green |
| 12 | quote_statuses.sql 12: recording a send made outside the product returns Question open to Sent | `FAIL: Question open returns to Sent gave question_open, expected sent` | green (advisor_record_quote_send restated from 20261122100000) |
| 13 | quote_statuses.sql 13: the menu's Quotes count follows the new statuses | `FAIL: Acknowledged and Question open still count gave 0, expected 2` | green (menu_counts restated from 20261122150000) |
| 14 | quote_statuses.sql 14: the queue's Waiting on a PEO filter and flag follow the new statuses | `FAIL: the filter lists Cleo Co (Acknowledged) and Reyes Bakery (Sent) gave ["Reyes Bakery"]` | green (advisor_list_submissions, queue_rows, queue_page_fast restated) |
| 15 | quote_statuses.sql 15: the wait keeps counting while Acknowledged or Question open | `FAIL: Acknowledged: waiting since the day it was sent gave <NULL>, expected 2026-11-07` then (two assertions, two cycles in the file) `FAIL: and a PEO holding an older version is flagged gave f, expected t` | green |
| 16 | quote_statuses.sql 16: the accounts table's Waiting on a PEO follows the new statuses | `FAIL: ... gave ["Reyes Bakery"], expected ["Cleo Co", "Reyes Bakery"]` | green (accounts_rows restated from 20261120111000) |
| 17 | quote_statuses.sql 17: archiving a submission closes every open quote, the new statuses too | `FAIL: archived: Gusto is closed gave acknowledged, expected closed` | green (set_submission_status restated from 20261122200500) |
| 18 | quote_statuses.sql 18: closing with a withdrawal tells Acknowledged and Question open PEOs | `FAIL: a note to each of the two gave 0, expected 2` | green (close_submission_and_withdraw restated from 20261122190000) |
| 19 | quote_statuses.sql 19: the opportunity's activity shows an acknowledgement and a question, with who | `FAIL: the send, the acknowledgement and the question gave {sent}` | green (opportunity_activity restated from 20261120120000) |
| 20 | quote_statuses.sql 20: from Acknowledged or Question open a PEO still quotes, declines or is closed | none: green at once (advisor_update_quote_request refuses only a closed one); proven by mutation at the end | green |
| 21 | quote_statuses.sql 21: a quote's expiry moves nothing | none: green at once (nothing in the database expires a quote); proven by mutation at the end | green |
| 22 | schemaSync.test.ts "holds the same quote request statuses" (existing; red once the migration lists six) | `+   "acknowledged", +   "question_open",` (the list in src/data/quoteRequests.ts had four) | green (QUOTE_REQUEST_STATUSES and QUOTE_REQUEST_LABELS) |
| 23 | quoteRequests.test.ts: an update is offered to a PEO that acknowledged or has a question open | `AssertionError: expected null to be 1` | green (OPEN_QUOTE_REQUEST_STATUSES, isOpenQuoteRequest, updateFrom) |
| 24 | quoteRequests.test.ts: the older-version note shows for Acknowledged and Question open | `AssertionError: expected null to be 'Sent v1, current v2'` | green (olderVersionNote) |
| 25 | quoteRequests.test.ts: the change log names the new statuses in words | none: green at once (the labels of cycle 22 already carry them); proven by mutation at the end | green |
| 26 | opportunityPageApi.test.ts: reads a quote request's acknowledgement and question as events | a failing case of 43 (`OpportunityError`: the event was not one of the four old words) | green |
| 27 | opportunityPage.test.ts: a quote request's event as a sentence, for all six | `expected 'Insperity's quote closed' to be 'Insperity acknowledged it has the packet'` | green (quoteEventWords) |
| 28 | opportunityPage.test.ts: the status counts its days while Sent, Acknowledged or Question open | `expected 'Acknowledged' to be 'Acknowledged · 3 days'` | green (quoteStatusWords) |
| 29 | OpportunityPage.test.tsx: Won lists a PEO that acknowledged or has a question open among the open quotes it closes | `Unable to find an element with the text: PEO D's open quote is closed.` | green (CloseOpportunityDialog) |
| 30 | AdvisorSubmissionPage.test.tsx: Follow up and Withdraw stay on a PEO that acknowledged or has a question open | `Unable to find an accessible element with the role "button" and name "Follow up with Justworks"` | green (PeoNeedsPanel) |
| 31 | StatusPanel.test.tsx: the withdrawal offered with Archived includes a PEO that acknowledged or has a question open | `Unable to find an accessible element with the role "checkbox" and name "Send a withdrawal to TriNet and Insperity"` | green (StatusPanel) |
| 32 | RecordSendPrompt.test.tsx: recording a send again is offered while Sent, Acknowledged or Question open | `Unable to find an accessible element with the role "button" and name "Record it again as sent today"` | green (RecordSendPrompt) |
| 33 | advisorApi.test.ts: setQuoteRequestStatus calls advisor_set_quote_request_status and says why when refused | `TypeError: setQuoteRequestStatus is not a function` | green (advisorApi.ts, types.ts) |
| 34 | QuoteRequestsPanel.test.tsx: one click records acknowledged or question open and tells the page | \`Unable to find an accessible element with the role "button" and name "Mark TriNet acknowledged"\` | green (OpenStatusButtons) |
| 35 | QuoteRequestsPanel.test.tsx: each open status but the one it is in is offered | DEVIATION: written in the same batch as 34 and 36, so not seen red before the code; the code was then checked by mutation (the filter on the current status removed: red) | green |
| 36 | QuoteRequestsPanel.test.tsx: none offered on a quoted, declined or closed request | DEVIATION: written with 34 and 35; green at once by nature (nothing was offered before); proven by mutation (offered on every request: red) | green |
| 37 | QuoteRequestsPanel.test.tsx: a status that wasn't recorded is said, and the page is not told it changed | none: green at once (the code of cycle 34 already handled it, written ahead of its test: DEVIATION); proven by mutation (the failure not shown: \`× says a status that wasn't recorded\`) | green |
| 38 | quote_statuses.sql 16b: the queue's other path (sorted by company) flags "waiting on a PEO" the same way | none: green at once (queue_rows was restated in cycle 14); a gap found by mutation M16 (queue_rows back to Sent only: STILL GREEN) and closed by this test, then M16 red: \`FAIL: Cleo Co (Acknowledged), sorted by company: waiting gave f, expected t\` | green |

## Mutation results (SQL, on a copy of the migration, quote_statuses.sql run against each)

All 25 mutations went red: M01 CHECK without acknowledged; M02 no assert_firm_writable; M03 no firm scope; M04 any status accepted; M05 a quoted or declined request moved; M06 a closed one moved; M07 same status accepted; M08 the status log trigger dropped; M09 an acknowledgement moves the opportunity to Quoted; M10 sending does not answer a question; M11 arriving mail acknowledges; M12 a send recorded by hand leaves the question open; M13 a send also returns Acknowledged to Sent; M14 menu count only Sent; M15 queue filter only Sent; M16 queue_rows flag only Sent (STILL GREEN until test 16b); M17 queue_page_fast flag only Sent; M18 waiting-since only Sent; M19 older-version only Sent and Quoted; M20 accounts waiting only Sent; M21 archiving leaves the new statuses open; M22 the withdrawal skips the new statuses; M23 the activity skips the new events; M24 a quote refused from a new status; M25 an expired quote closes itself.

TypeScript mutations: the cycles 34 to 37 mutations are in their rows; the other TypeScript cycles were each seen red before their code (cycles 22 to 33).
