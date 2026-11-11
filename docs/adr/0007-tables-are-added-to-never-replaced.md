# What is heard or read of a table is added to it, never traded for it

Every other field follows "the better source wins, and two answers from equal sources are a conflict". A **table** (owners and officers, loss history, medical plans, unemployment rates, legal entities) can't: a prospect who says "and Sam is our secretary" has not contradicted the owner Lenore already heard about, and a loss run for 2025 says nothing about 2024. So rows that arrive from the conversation or a document are merged into the table.

A row is matched to one already listed by the table's key column (a person's name, a policy year, a plan's name, a state), ignoring case. A matched row fills in what the listed row lacked; an unmatched one is added at the end, up to the table's cap. A value a row already holds changes only when a better source says otherwise: a document the prospect applied over something heard in conversation, or the prospect correcting it in conversation ("actually Dana owns 55%"). A row the prospect typed on its tab is never changed by either; what was heard only fills its blanks. After a merge from conversation the whole table is "please confirm" again.

## Considered Options

- **Last answer wins.** Rejected: one sentence about one owner would erase the rest of the table.
- **Treat a differing table as a conflict**, as two differing values are. Rejected: the prospect would be asked to choose between two whole tables that differ in one cell.
- **Never capture tables from conversation.** Rejected: a prospect who volunteers their owners would have to type them again.

## Consequences

- Chat can't remove a row. A row is removed on its tab.
- Lenore never asks for a table row by row; her prompt names each open table with its tab.
