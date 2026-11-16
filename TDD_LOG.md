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
