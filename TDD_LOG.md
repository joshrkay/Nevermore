# TDD log: slice 8.5, CRM-L2.1 (a lead's page)

The `tdd` skill was the first tool call. One test, seen red, then only its code, seen green. Seams (D-13): (1) SQL tests in `supabase/tests`,
(2) component tests of pages and forms.

| # | Test | Red (the failing line seen) | Green |
|---|---|---|---|
| 1 | lead_page.sql 1: the page answers the lead's own fields, its owner, and whether the caller may change it | `ERROR:  function public.lead_page(uuid, uuid) does not exist` | green |
| 2 | lead_page.sql 2: who sees the page: the level rule, the bin and the firm | `FAIL: another agent's lead gave {"lead": {...}, "can_change": false}, expected <NULL>` | green |
| 3 | lead_page.sql 3: the status bar: when New, Working and Converted each began | `FAIL: New began when it was made gave <NULL>, expected 2026-11-16 15:29:16.281255+00` | green |
| 4 | lead_page.sql 4: a converted lead names the account, contact and opportunity it made | `FAIL: the account it made gave <NULL>, expected 3f188dec-...` | green |
| 5 | lead_page.sql 5: the details saved in place from a version; a New lead becomes Working | `ERROR:  function public.update_lead(p_lead_id => uuid, ...) does not exist` | green |
| 6 | lead_page.sql 6: who may save: the level rule on the lead's owner | `FAIL: another agent's lead is not there gave ok, expected PT404` | green |
| 7 | lead_page.sql 7: someone saved first: nothing saved, what is there now answered | `FAIL: a conflict gave f, expected t` | green |
| 8 | lead_page.sql 8: what is wrong with a field or the version is said in words | `FAIL: Enter a name (code) gave 23502, expected 22023` | green |
| 9 | lead_page.sql 9: Converted, Not a fit and the bin are read, not changed | `FAIL: nofit: no Edit gave t, expected f` | green |
| 10 | lead_page.sql Z: a support session and a closing firm change nothing | `FAIL: support saves nothing gave 42501, expected PT423` | green |
| 11 | lead_page.sql 10: the owner changed in place by the level rule; left out, it stays | `FAIL: a lead gives it to someone on a team under theirs gave f71a1ab9-..., expected 351d2507-...` | green |
| 12 | lead_page.sql 11: a save that changes nothing leaves a New lead New | `FAIL: nothing changed: still New gave working, expected new` | green |
| 13 | lead_page.sql 12: Not a fit, with a reason from the short list | `FAIL: no reason gave 42883, expected 22023` (no such function) | green |
| 14 | lead_page.sql 13: Reopen: Working again, its reason cleared | `FAIL: a lead that is not Not a fit gave 42883, expected 55000` (no such function) | green |
| 15 | lead_page.sql 14: a call logged on a New lead makes it Working; a note or a task does not | `ERROR:  function public.log_lead_activity(p_kind => unknown, p_lead_id => uuid, p_body => unknown) does not exist` | green |
| 16 | lead_page.sql 15: nothing logged on a lead not seen, or one read, not changed | `FAIL: another agent's lead gave ok, expected PT404` | green |
| 17 | lead_page.sql 16: what is wrong with a call, a note or a task is said in the account's own words | `FAIL: Choose a call, a note or a task (code) gave 23514, expected 22023` | green |
| 18 | lead_page.sql 17: the lead's calls, notes and tasks, newest first, filtered and paged | `ERROR:  function public.lead_activity(uuid, uuid) does not exist` | green |
| 19 | lead_page.sql 18: a lead's call changed, note added to, task done, as an account's are | `ERROR:  That isn't available` (update_activity read only the account) | green |
| 20 | lead_page.sql 19: nothing on a lead that is read, not changed, is changed | Passed when first run: its guard lines were written in cycle 19 ahead of their test (a slip). Removed them, saw `FAIL: no row offered as editable gave t, expected f`, put them back | green |
| 21 | lead_page.sql 20: what the log form offers on a lead | `ERROR:  function public.lead_activity_options(uuid, uuid) does not exist` | green |
| 22 | lead_page.sql Z: support and a closing firm log, mark and reopen nothing | `FAIL: support logs nothing gave ok, expected PT423` | green |
| 23 | data_isolation.sql, help_from_nevermore.sql, close_a_firm.sql: every new definer and write is in the three registries, the support and closing lists | `FAIL: privileged functions and the registry disagree: ... lead_activity, lead_page, ... update_lead` and `... gave log_lead_activity, mark_lead_not_fit, reopen_lead, update_lead, expected <NULL>` | green |
| 24 | lead_page.sql 21: whether anything can be logged on the lead, and whether it is in the bin | `FAIL: a Working lead takes calls, notes and tasks gave <NULL>, expected t` | green |
| 25 | LeadPage.test: the header shows the name, status, business, location, employees, source and owner, with Email, Log a call and Not a fit, no Convert | `Error: Failed to resolve import "./LeadPage" from "src/pages/leads/LeadPage.test.tsx". Does the file exist?` | green |
| 26 | LeadPage.test: the status bar shows New, Working and Converted with the date each began | `Unable to find role="list" and name "Status"` | green |
| 27 | LeadPage.test: the details shown and saved in place from the version started from | `Unable to find role="region" and name "Details"` | green |
| 28 | LeadPage.test: Converting makes names the account, contact and opportunity (two cases of the one naming rule, written together) | `Unable to find role="region" and name "Converting makes"` (both) | green |
| 29 | LeadPage.test: the lead's calls, notes and tasks listed newest first | `Unable to find role="region" and name /Calls, notes and tasks/` | green |
| 30 | LeadPage.test: Nothing logged yet with Add a note and Add a task; a note logged on the lead | `Unable to find an accessible element with the role "button" and name "Add a task"` | green |
| 31 | LeadPage.test: Log a call from the header logs on the lead and reads the lead again | `Unable to find role="dialog" and name "Log a call"` | green |
| 32 | LeadPage.test: Not a fit asks a reason from the short list and marks the lead | `Unable to find role="dialog" and name "Not a fit"` | green |
| 33 | lead_page.sql 22: whether the caller may reopen the lead | `FAIL: its owner reopens a Not a fit lead gave <NULL>, expected t` | green |
| 34 | LeadPage.test: the Not a fit banner shows the reason with Reopen; nothing to change; Reopen reopens | `Unable to find role="note" and name "Not a fit"` | green |
| 35 | LeadPage.test: the Converted banner links to the account, contact and opportunity; the page is read-only | `Unable to find role="note" and name "Converted"` | green |
| 36 | LeadPage.test: No emails yet and the place to write writes to the lead | `Unable to find role="region" and name "Emails"` | green |
| 37 | brokerAuth.test: connecting a mailbox from a lead's page comes back to the lead | `/leads/5f1c...: expected '/advisor' to be '/leads/5f1c...'` | green |
| 38 | seo.guard.test: the route /leads/:id has its own title | `/leads/:id: expected 'Page not found \| Nevermore' not to be ...` | green |
| 39 | LeadsPage.test: each lead's name links to its page | `Unable to find role="link" and name "Lucia Reyes"` | green |
| 40 | InboxPage.test: a lead's message opens the lead's page | `Unable to find an element with the text: A lead's page, /leads/l5` | green |
| 41 | LeadPage.test: the Loading state: the header and each panel's heading with grey lines | `Unable to find an accessible element with the role "heading" and name "Details"` | green |
| 42 | LeadPage.test: This lead isn't available, with the way back to Leads | `Unable to find an element with the text: /This lead isn't available/i` | green |
| 43 | LeadPage.test: the page failed to load, with Try again | `Unable to find role="button" and name /Try again/` | green |
| 44 | LeadPage.test: a support session reads the page and is offered nothing to change | Passed when first run (the guard came with cycle 30's provider). Checked by mutation: with support allowed to act, `expected <button> to be null` | green |
| 45 | lead_page.sql 23 (from mutation): Working's date is when it became Working, not a later status change | Mutant "status began: any status change" survived; with the test, killed | green |
| 46 | lead_page.sql 24 (from mutation): a converted lead links only to what the caller may see | Mutant "converted links: no sight of account" survived; with the test, killed | green |
| 47 | lead_page.sql 25 (from mutation): a lead's rows are as hidden as the lead, and its owner changes a call someone else logged | Mutants "activity seen: lead always seen" and "can_edit: no lead level rule" survived; with the test (one test for the two), both killed | green |
| 48 | LeadPage.test (from mutation): no Reopen for someone who may only read the lead | Mutant "page: Reopen to anyone acting" survived; with the test, killed | green |
| 49 | LeadPage.test (from mutation): a Not a fit lead's status bar marks no step | Mutant "status bar: Not a fit marks Working" survived; with the test, killed | green |
