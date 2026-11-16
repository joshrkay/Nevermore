# TDD log: slice 6.9, M-2.4 (follow up and withdraw, #203)

The `tdd` skill was the first tool call. One test, seen red, then only its code, seen green. Seams (D-13): (1) SQL tests in `supabase/tests`,
(2) component tests, (4) server functions through request and response with the provider faked.

| # | Test | Red (the failing line seen) | Green |
|---|---|---|---|
| 1 | follow_up_and_withdraw.sql 1: a follow-up is recorded queued on the PEO's thread, continuing it | `ERROR:  function public.follow_up_peo(bigint, text[], unknown, unknown) does not exist` | green |
| 2 | follow_up_and_withdraw.sql 2: a closing firm and a support session follow up with nobody | `FAIL: a support session gave 23502: null value in column "provider_message_id" ..., expected PT423: Nevermore support can look, not change` | green |
| 3 | follow_up_and_withdraw.sql 3: only an advisor of the intake's own firm follows up | `FAIL: another firm's quote request gave ok, expected PT404: Quote request not found` | green |
| 4 | follow_up_and_withdraw.sql 4: a follow-up to a PEO the employer withdrew is refused | `FAIL: the employer withdrew it gave ok, expected 22023: The employer withdrew TriNet. Nothing more can be sent to it.` | green |
| 5 | follow_up_and_withdraw.sql 5: no connected mailbox, no follow-up and nothing recorded | `FAIL: no mailbox gave 23502: null value in column "provider_message_id" ..., expected PT412: Connect your mailbox to send from here.` | green |
| 6 | follow_up_and_withdraw.sql 6: a follow-up is addressed to one to ten bare addresses | `FAIL: nobody to send to gave ok, expected 22023: Address it to at least one person at Insperity.` | green |
| 7 | follow_up_and_withdraw.sql 7: the subject and the note keep 6.2's limits | `FAIL: a subject of two lines gave ok, expected 22023: A subject is one line.` | green |
| 8 | follow_up_and_withdraw.sql 8: a closed quote request is not followed up | `FAIL: a closed quote request gave ok, expected 22023: This quote request is closed. Send to Justworks again to reopen it.` | green |
| 9 | follow_up_and_withdraw.sql 9: a follow-up carries a live link to the version already sent | `FAIL: the version already sent gave <NULL>, expected 1` | green |
| 10 | follow_up_and_withdraw.sql 10: a link the advisor revoked stays revoked | `FAIL: revoked by the advisor gave ok, expected 22023: You revoked the link to Justworks, so a follow-up can't carry one. ...` | green |
| 11 | follow_up_and_withdraw.sql 11: a withdrawal closes, revokes (withdrawn), keeps its reason, queued on the thread with no link | `ERROR:  function public.withdraw_from_peo(bigint, text[], unknown, unknown, text) does not exist` | green |
| 12 | follow_up_and_withdraw.sql 12: a closing firm and a support session withdraw nothing | `FAIL: a support session gave 23502: null value in column "provider_message_id" ..., expected PT423: Nevermore support can look, not change` | green |
| 13 | follow_up_and_withdraw.sql 13: only an advisor of the intake's own firm withdraws | `FAIL: another firm's quote request gave ok, expected PT404: Quote request not found` | green |
| 14 | follow_up_and_withdraw.sql 14: no mailbox, nothing withdrawn | `FAIL: no mailbox gave 23502: null value in column "provider_message_id" ..., expected PT412: Connect your mailbox to send from here.` | green |
| 15 | follow_up_and_withdraw.sql 15 (first assertion): a withdrawal names one of the four reasons | `FAIL: an unknown reason gave 23514: ... violates check constraint "quote_requests_withdrawn_reason_check", expected 22023: Choose why: ...` | green |
| 16 | follow_up_and_withdraw.sql 15 (second assertion): a closed quote request is not withdrawn twice | `FAIL: a closed quote request gave ok, expected 22023: TriNet is already closed, so there is nothing to withdraw.` | green |
| 17 | follow_up_and_withdraw.sql 16: a withdrawal is addressed by the one address rule | `FAIL: an address with a comma in it gave ok, expected 22023: Enter each address like name@example.com.` | green |
| 18 | follow_up_and_withdraw.sql 17: a withdrawal's subject and note keep 6.2's limits | `FAIL: a subject of two lines gave ok, expected 22023: A subject is one line.` | green |
| 19 | follow_up_and_withdraw.sql 18: a withdrawal is claimed by send-mail with no link, however long it waited | `FAIL: the withdrawal is claimed gave 0, expected 1` | green |
| 20 | follow_up_and_withdraw.sql 19: marking Lost revokes every PEO's link as submission_closed | `FAIL: no live link is left gave 2, expected 0` | green |
| 21 | follow_up_and_withdraw.sql 20: Won with the withdrawal: one note queued on each open PEO's thread, never the winner's; winner's link kept | `ERROR:  function public.close_submission_and_withdraw(uuid, unknown, unknown, bigint, unknown, unknown) does not exist` | green |
| 22 | follow_up_and_withdraw.sql 21: with no mailbox the closing withdrawal is refused and the submission does not move | `FAIL: no mailbox gave 23502: null value in column "provider_message_id" ..., expected PT412: Connect your mailbox to send from here.` (then a test fix: the count was taken before the set-up) | green |
| 23 | follow_up_and_withdraw.sql 22: the closing withdrawal keeps 6.2's limits, and nothing moves | `FAIL: a subject of two lines gave ok, expected 22023: A subject is one line.` | green |
| 24 | follow_up_and_withdraw.sql 23: sending again reopens a withdrawn PEO and clears its reason | `FAIL: with no reason left gave employer_went_elsewhere, expected <NULL>` | green |
| 25 | close_a_firm.sql "a write path nobody thought about" (existing test, my migration loaded) | `FAIL: no function that changes data is left out of the closing's read-only list ... gave withdraw_from_peo, expected <NULL>` | green (follow_up_peo, withdraw_from_peo, close_submission_and_withdraw listed as guarded) |
| 26 | help_from_nevermore.sql "every function that asks a membership helper is classified" (existing test) | `FAIL: ... gave close_submission_and_withdraw, follow_up_peo, withdraw_from_peo, expected <NULL>` | green (listed as writes, and in its guarded list) |
| 27 | data_isolation.sql function registry (existing test) | `FAIL: privileged functions and the registry disagree: privileged functions not in the registry: close_submission_and_withdraw, follow_up_peo, record_peo_thread_message, withdraw_from_peo` | green (registered in callable, fprobe, fn_class and secret_readers) |
| 28 | data_isolation.sql two-firm probe of close_submission_and_withdraw (the new probe) | `FAIL: platform_admin calling close_submission_and_withdraw on the a firm's row gave PT412, expected a refusal ({42501,PT404,P0002})` | green (the intake's firm is checked before the mailbox) |
