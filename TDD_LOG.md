# TDD log: lane/tenant-admin (creating a firm end to end)

The tdd skill (`mattpocock-skills:tdd`) was the first skill invoked. Each cycle: one test, run, the failing line seen, then only the code that passes it. Where a test passed on its first run it is marked "pinning" (a rule an earlier cycle's code already gave, written to hold it): those do not count as red cycles. SQL tests are in `supabase/tests/firm_signup_emails.sql` (numbered as its sections); TypeScript tests are named by file. Two honest slips are noted where they happened (cycles 3-4 were written in one go; cycles 9 and 10 each needed a fixture fix after the first run).

## The database (`20261124090000_firm_signup_emails.sql`)

1. `firm_signup_emails.sql` 1, signing a firm up queues one `firm_waiting` email about the firm and no intake. Red: `FAIL: one email is queued for the admins gave 0, expected 1`. Green: migration with the kind in `outbox_events_one_target` and `outbox_events_kind_check`, and the trigger `firms_queue_signup_emails` (payload still empty).
2. `firm_signup_emails.sql` 2, the payload is the firm's name, address and the signer's email, keyed by the firm. Red: `FAIL: the payload is the firm's name, its address and who signed it up, and nothing else gave {}, expected {"address": "fresh-benefits", ...}`. Green: the payload in the trigger function.
3. `firm_signup_emails.sql` 3, a firm with no signer (seeded) queues nothing. Pinning (the trigger's WHEN clause). Written in the same edit as cycle 4: a slip against "never batch"; it passed alone, so it hid nothing.
4. `firm_signup_emails.sql` 4, who the admins are: every admin with an address once, no plain advisor, and no signed-in caller can ask. Red: `ERROR:  function public.outbox_admin_recipients() does not exist`. Green: `outbox_admin_recipients()`, service role only.
5. `firm_signup_emails.sql` 5, approving queues one `firm_decision` email about the firm (and nothing before there is a decision). The first run died on my fixture (`permission denied for table fx`, an insert made while signed in as the founder: fixed, not a red). Red: `FAIL: approving queues one email for the founder gave 0, expected 1`. Green: the kind in the two constraints, and the trigger `firms_queue_decision_email` (payload empty).
6. `firm_signup_emails.sql` 6, the approval payload: who it goes to, firm, address, approved, no note; keyed by the firm. Red: `FAIL: the payload is who it goes to, ... gave {}`. Green: the payload.
7. `firm_signup_emails.sql` 7, a refusal says so and carries the admin's note trimmed; a blank note is none. Pinning.
8. `firm_signup_emails.sql` 8, a decision that is refused (decided twice, a plain advisor) queues nothing. Pinning.
9. `firm_signup_emails.sql` 9, a firm whose signer is gone is decided all the same and no email is queued. First run died on my fixture (deleting the account is refused by `keep_firm_owner`; I cleared `signed_up_by`, which is what the deletion does to the column). Pinning.
10. `firm_signup_emails.sql` 10, neither kind is a firm's alert nor a prospect kind, and the dispatcher claims both, even for a suspended firm. First run: my expectation forgot the waiting emails of the two other firms (fixture, not code). Pinning.
11. `data_isolation.sql`, the registries agree with the grants. Red: `FAIL: privileged functions and the registry disagree: privileged functions not in the registry: outbox_admin_recipients, queue_firm_decision_email, queue_firm_signup_emails`. Green: the three functions added to its service-only and trigger lists.

## The dispatcher (`supabase/functions/dispatch-outbox`)

12. `messages.test.ts` "a firm waiting for a decision: reading the payload". Red: `TypeError: parseFirmWaiting is not a function`. Green.
13. `messages.test.ts` "a payload it cannot read" (no name, no address, no signer, a signer that is not an address, not an object). Pinning.
14. `messages.test.ts` "the email" (subject, firm, address, signer, link to the Firms page). Red: `TypeError: renderFirmWaiting is not a function`. Green.
15. `messages.test.ts` the waiting email escapes markup. Pinning.
16. `messages.test.ts` "a firm's decision: reading the payload". Red: `TypeError: parseFirmDecision is not a function`. Green.
17. `messages.test.ts` a decision payload it cannot read (7 cases). Pinning.
18. `messages.test.ts` the approval email (subject, link to the firm's address, invite your team). Red: `TypeError: renderFirmDecision is not a function`. Green (approved branch only).
19. `messages.test.ts` the refusal email (note, support address, no link). Red: `expected 'Fresh Benefits is approved on Nevermo…' to be 'Your request for Fresh Benefits on Ne…'`. Green (refusal branch).
20. `messages.test.ts` a refusal with no note prints no reason. Pinning.
21. `messages.test.ts` the admin's note is escaped. Pinning.
22. `dispatch.test.ts` "dispatching the email about a firm waiting for a decision": goes to the platform admins (asked of `adminRecipients`), never the owners or the intake members, with the product's words and a link to `/advisor/firms`. Red: `AssertionError: expected +0 to be 1`. Green (`buildMessage`, `prepare`'s lookup, `isAdvisorKind`, `sendableKinds`, the `adminRecipients` dependency). The existing `sendableKinds` test then went red (`expected [ 'advisor_notification', …(9) ] to deeply equal [ …(8) ]`) and its literals were updated.
23. `dispatch.test.ts` "the waiting-firm email's settings" (waits with the reason with no app address; never claimed). Red: `expected [ { …(2) }, …(4) ] to deep equally contain { kind: 'firm_waiting', …(1) }`. Green (`kindReadiness`). Four existing tests that list every kind went red and their literals were updated.
24. `dispatch.test.ts` gives up for good on an unreadable waiting payload. Pinning.
25. `dispatch.test.ts` keeps waiting with no admin and when the admins cannot be looked up. Pinning.
26. `dispatch.test.ts` "dispatching the email about a firm's decision": goes to the signer only, reply-to support, link to `https://<address>.<app host>`. Red: `AssertionError: expected +0 to be 1` (the kind was unknown; after the first attempt it was still 0 because I had put the branch after the intake-only check: moved). Green. The existing `sendableKinds` test went red and was updated.
27. `dispatch.test.ts` "the decision email's settings" (waits with both reasons). Red: `expected [ { …(2) }, …(6) ] to deep equally contain { kind: 'firm_decision', …(1) }`. Green (`kindReadiness`); four listing tests updated.
28. `dispatch.test.ts` gives up for good on an unreadable decision payload. Pinning.
29. `messages.test.ts` `firmAddressUrl` (the bare domain, a trailing slash, localhost). Pinning (written with the function in cycle 26).
30. `schemaSync.test.ts` (existing): the outbox kinds in the database equal the client's labels. Red: `expected [ 'advisor_notification', …(12) ] to deeply equal [ …(10) ]`. Green (labels in `src/data/outbox.ts`).

## The first admin without SQL

31. `supabase-setup-lib.test.ts` "grants the platform admin role by email, escaped, and only that role". Red: `TypeError: adminSql is not a function`. Green (`adminSql`, and `advisorSql` now shares `roleGrantSql`).
32. `supabase-setup.test.ts` "grants the platform admin role without needing the secrets file or the CLI". Red: `expected 'Unknown option '--grant-admin'…' to contain 'Granted.'`. Green (the option, `grantAdmin`, `granting`).
33. `supabase-setup.test.ts` "tells the person to sign up first when no account has the email". Pinning.
34. `supabase-setup.test.ts` "says so when the account already is a platform admin, and can grant both roles in one run". Pinning.

## Mutations

Each rule was broken in turn (a throwaway edit, the tests run, the edit undone).

- TypeScript and the setup script, 25 mutants, all killed: the waiting parser accepting no address; the waiting email without its link or its signer; the decision parser accepting a word for a decision or dropping the note; the refusal showing the firm link or losing the support address; the approval losing the "invite your team" step; the note unescaped; `firmAddressUrl` keeping the bare domain; the waiting email going to the owners, to the wrong page, or not looked up as an advisor kind; the decision going to the admins or with no reply-to or sent without its settings; either kind not sendable; the waiting readiness dropping the app address; the client label missing; `adminSql` granting advisor; `advisorSql` granting admin; `--grant-admin` wanting the secrets file, never running, or hiding the no-account case.
- SQL, 14 mutants: 11 killed first time (a firm with no signer announced; the waiting payload without the address; one shared waiting key; advisors counted as admins; the admins' list open to signed-in people; a refusal read as approval; the note lost; the decision sent to the deciding admin; a decision queued with no signer; one shared decision key; the decision kind not about a firm). Three survived: two exposed a gap in test 4: `array_to_string` hid a NULL entry for an admin with no address, and the test never had two accounts that differ only in capitals. Test 4 now compares the array itself and adds the second account; both of those mutants are then killed, and the third is the equivalent one below.
- One SQL mutant is left alive on purpose: dropping `OLD.decision IS NULL` from the decision trigger. The decision key (`firm_decision:<firm id>`) already makes a second decision email for one firm impossible, so the condition only saves a lookup; the behaviour (the founder is told once) is pinned by test 8.
