# TDD log: slice 8.4, CRM-L1.1b (bulk actions with Undo, the bin with Restore, the 30-day nightly removal)

One test per cycle: the test, the failing line seen, then green. SQL tests run on a private Postgres (port 5436).

1. `leads_bulk.sql` §1 "one lead deleted" (a bulk delete puts the lead in the bin, with a change to undo). Red: `ERROR:  function public.bulk_leads_change(uuid, unknown, unknown, unknown, jsonb) does not exist`. Green.
2. `leads_bulk.sql` §1 "the converted lead is named as skipped" (CRM-L1.1: a converted lead can't be deleted). Red: `ERROR:  A converted lead can't be changed`. Green.
3. `leads_bulk.sql` §1 "another agent's lead is not changed" (D-809: skipped by the level rule, named, in words). Red: `FAIL: another agent's lead is not changed gave 1, expected 0`. Green.
4. `leads_bulk.sql` §1 "a lead the agent does not see is not changed" (D-809, D-28: unseen, other firm's and made-up ids counted as not available, never named). Red: `ERROR:  invalid input syntax for type uuid: "not-an-id"`. Green.
