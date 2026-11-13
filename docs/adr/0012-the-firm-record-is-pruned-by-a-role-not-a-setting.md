# The firm record is pruned by a role, not a setting

The first build of the firm's record of who did what let its one retention delete through when a session setting said pruning was on, refusing only the three API roles. Any other role, the table's owner among them, could set it and delete rows, so "nobody can delete a row" was not true of everyone it was meant to cover. A delete is now allowed only for the role `firm_activity_pruner`, which has no login, belongs to no API role, owns `prune_firm_activity()` and holds nothing but read and delete on this table. The guard reads who is running the statement; nothing a caller sets changes it.

## Considered Options

- **Keep the setting and restrict who may set it.** Rejected: a setting can be set by anyone who can run a statement as a role the database doesn't list, and the list is the thing that went wrong.
- **Remove the delete and let the retention job truncate partitions.** Rejected: the table is not partitioned, and moving a small operational table to partitions for this is more than the risk needs.

## Consequences

- The table's owner can no longer delete from the table directly: a delete by the owner is refused like anyone's. Only a superuser who becomes the retention role, or who drops the guard, can still change it, as for any table.
- Another job that must delete entries gets its own function owned by the retention role, and a test in `supabase/tests/firm_activity.sql`.
