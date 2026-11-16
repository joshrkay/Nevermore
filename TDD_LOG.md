# TDD log: slice 8.4, CRM-L1.1b (bulk actions with Undo, the bin with Restore, the 30-day nightly removal)

One test per cycle: the test, the failing line seen, then green. SQL tests run on a private Postgres (port 5436).

1. `leads_bulk.sql` §1 "one lead deleted" (a bulk delete puts the lead in the bin, with a change to undo). Red: `ERROR:  function public.bulk_leads_change(uuid, unknown, unknown, unknown, jsonb) does not exist`. Green.
2. `leads_bulk.sql` §1 "the converted lead is named as skipped" (CRM-L1.1: a converted lead can't be deleted). Red: `ERROR:  A converted lead can't be changed`. Green.
3. `leads_bulk.sql` §1 "another agent's lead is not changed" (D-809: skipped by the level rule, named, in words). Red: `FAIL: another agent's lead is not changed gave 1, expected 0`. Green.
4. `leads_bulk.sql` §1 "a lead the agent does not see is not changed" (D-809, D-28: unseen, other firm's and made-up ids counted as not available, never named). Red: `ERROR:  invalid input syntax for type uuid: "not-an-id"`. Green.
5. `leads_bulk.sql` §2 "one lead put back" (D-202, D-811: Undo of a delete takes the lead out of the bin, by the agent who no longer sees it). Red: `ERROR:  function public.bulk_leads_undo(uuid, uuid) does not exist`. Green.
6. `leads_bulk.sql` §2 "another person can't undo it" (D-202: only the maker, under the membership they made it with). Red: `FAIL: another person can't undo it gave ok, expected PT404`. Green.
7. `leads_bulk.sql` §2 "undone once only" (D-202: a second undo is refused, PT409). Red: `FAIL: undone once only gave ok, expected PT409`. Green.
8. `leads_bulk.sql` §2 "too late to undo" (D-202: ten minutes, PT410). Red: `FAIL: too late to undo gave ok, expected PT410`. Green.
9. `leads_bulk.sql` §2 "nothing put back" (D-202: a lead changed since, here taken out of the bin, is skipped and named). Red: `FAIL: nothing put back gave 1, expected 0`. Green.
10. `leads_bulk.sql` §3 "one will be deleted" (CRM-S3.7: the preview counts, names the skipped and changes nothing). Red: `ERROR:  function public.bulk_leads_preview(uuid, unknown, unknown, unknown, jsonb) does not exist`. Green.
11. `leads_bulk.sql` §4 "to the person chosen" (D-811: Change owner gives the leads to the member chosen, named in the answer). Red: `FAIL: to the person chosen gave cd6a1091-..., expected 129d2f83-...`. Green.
12. `leads_bulk.sql` §4 "the owner put back" (D-202: Undo of an owner change puts the previous owner back). Red: `FAIL: the owner put back gave 9c63..., expected 366d...`. Green.
13. `leads_bulk.sql` §4 "named: the previous owner has left" (D-202: an undo never gives a lead back to a former member). Red: `FAIL: named: the previous owner has left gave <NULL>, expected owner_left`. Green.
14. `leads_bulk.sql` §4 "an owner that is not a person" (CRM-S3.7: what a change asks for is checked, in words: the owner, the action, its keys). Red: `FAIL: an owner that is not a person gave 22P02: invalid input syntax for type uuid: "x", expected 22023: ...`. Green.
15. `leads_bulk.sql` §5 "it is Working" (D-811, D-808: Change status sets New or Working, never Converted). Red: `ERROR:  Choose what to change: the owner, the status, Not a fit, a field, a label or deleting.`. Green.
16. `leads_bulk.sql` §5 "Working again" (D-202: Undo of a status change puts the status back). Red: `FAIL: Working again gave new, expected working`. Green.
17. `leads_bulk.sql` §5 "a reason off the list" (D-811, CRM-L1.3: Not a fit with one reason from the short list; Undo puts the status back). Red: `FAIL: a reason off the list gave 22023: Choose what to change: ..., expected 22023: Choose why they are not a fit: ...`. Green.
18. `leads_bulk.sql` §5 "skipped: it is Not a fit" (CRM-L1.1: a Not a fit lead is read, not changed, but reopened by Change status or deleted). Red: `FAIL: skipped: it is Not a fit gave <NULL>, expected not_fit`. Green.
19. `leads_bulk.sql` §6 "the city set, trimmed" (CRM-S3.7, D-811: Set a field on an optional field, a blank clears it, never the name or the source, the lead's own rules). Red: `ERROR:  Choose what to change: the owner, the status, Not a fit, a field, a label or deleting.`. Green.
20. `leads_bulk.sql` §6 "the old city back" (D-202: Undo of Set a field puts the old value back). Red: `FAIL: the old city back gave Eugene, expected Bend`. Green.
21. `leads_bulk.sql` §7 "one lead labelled" (D-805, D-811: Label puts the firm's word on the leads, made once by typing it, one history entry "labels"). Red: `ERROR:  Choose what to change: the owner, the status, Not a fit, a field, a label or deleting.`. Green.
22. `leads_bulk.sql` §7 "a label the firm does not have" (D-811: taking a label off; one the firm lacks refused in words). Red: `FAIL: a label the firm does not have gave ok, expected 22023: The firm has no label called "Cold".`. Green.
23. `leads_bulk.sql` §7 "the label is off again" (D-202: Undo of adding or taking off a label). Red: `FAIL: the label is off again gave 1, expected 0`. Green.
24. `leads_bulk.sql` §7 "the word stays in the firm's list" (D-805: an accounts' Undo that made a word no longer takes it off the leads that carry it; found while building labels). Red: `FAIL: the word stays in the firm's list gave 0, expected 1`. Green.
25. `leads_bulk.sql` §8 "the two the agent sees that match" (CRM-S3.6, D-44: "all that match" is the table's own filters and search, never ids and filters together). Red: `FAIL: the two the agent sees that match gave 0, expected 2`. Green.
26. `leads_bulk.sql` §8 "the preview says too many" (CRM-S3.7: at most 1,000; the preview says so, the change is refused PT413 in words). Red: `FAIL: the preview says too many gave false, expected true`. Green.
