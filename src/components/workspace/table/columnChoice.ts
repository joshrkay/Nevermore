import type { ColumnDefinition } from "./columns";

// Which of a table's columns a person shows, and in what order (story CRM-S3.1a). Pure: the hook (useTableColumns) keeps the choice, the menu
// (ColumnsMenu) changes it, and the frame draws what these return.

type Column = Pick<ColumnDefinition<never, string, never>, "id" | "isName">;

/**
 * The columns a list of column ids names, in its order, with the name column (the one marked `isName`) always first. A list is read as far as it
 * can be: an id the table doesn't have (a column since retired) is left out and an id twice is shown once. No list, or one that names no column
 * the table has, is the table's own columns: it is no choice of the person's.
 */
export function columnsFor<C extends Column>(all: C[], ids: readonly string[] | null): C[] {
  if (ids === null) return all;
  const named = [...new Set(ids)].flatMap((id) => all.filter((c) => c.id === id));
  if (named.length === 0) return all;
  const name = all.find((c) => c.isName);
  return name ? [name, ...named.filter((c) => c !== name)] : named;
}

/**
 * The ids with one column swapped with its neighbour, a place earlier (-1) or later (1). The menu only asks for a move there is room for: the name
 * column (the first) has no arrows, and the first column after it can't go up nor the last go down.
 */
export function movedIds(ids: readonly string[], id: string, by: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const next = [...ids];
  [next[from], next[from + by]] = [next[from + by], next[from]];
  return next;
}
