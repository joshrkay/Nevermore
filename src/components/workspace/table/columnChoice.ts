// The columns a person sees on a table (story CRM-S3.1a, D-43): the definition's own list, or the person's kept choice of it. The choice is
// the ids of the columns shown, in order, kept in the database per firm, person and table (`my_table_columns`, src/lib/tableSettingsApi.ts).
// These are the rules about it, with no screen and no database in them.
//   - The name column (`isName`) is always shown and always first. A kept list that leaves it out or puts it later still has it first.
//   - A kept id the table doesn't have (a column renamed or removed since, or a custom field that has not loaded: CRM-X3.1) is not drawn.
//     A choice with none of its ids known is not a choice any more, so the table's own columns show.

type Defined = { columns: readonly { id: string; isName?: boolean }[] };

/** The column that names the row, or undefined for a table that has none. */
const nameOf = (table: Defined) => table.columns.find((c) => c.isName);

/** The columns to draw: the kept choice, or every column of the table when nothing is kept (or nothing kept is known). */
export function shownColumns<C extends { id: string; isName?: boolean }>(table: { columns: C[] }, kept: readonly string[] | null): C[] {
  if (!kept) return table.columns;
  const byId = new Map(table.columns.map((c) => [c.id, c]));
  const name = table.columns.find((c) => c.isName);
  const chosen = [...new Set(kept)].map((id) => byId.get(id)).filter((c): c is C => !!c && c !== name);
  const known = chosen.length > 0 || (name !== undefined && kept.includes(name.id));
  if (!known) return table.columns;
  return name ? [name, ...chosen] : chosen;
}

/** The ids of the columns drawn, in order: what is kept. */
export const columnIdsShown = (columns: readonly { id: string }[]): string[] => columns.map((c) => c.id);

/** The list with the column hidden. The name column cannot be. */
export function hideColumn(table: Defined, shown: readonly string[], id: string): string[] {
  return id === nameOf(table)?.id ? [...shown] : shown.filter((s) => s !== id);
}

/** The list with a hidden column added at the end. An id the table doesn't have changes nothing. */
export function showColumn(table: Defined, shown: readonly string[], id: string): string[] {
  return shown.includes(id) || !table.columns.some((c) => c.id === id) ? [...shown] : [...shown, id];
}

/** The list with a column one place earlier (-1) or later (1). It stays inside the list and never goes before the name column. */
export function moveColumn(table: Defined, shown: readonly string[], id: string, by: -1 | 1): string[] {
  const from = shown.indexOf(id);
  const to = from + by;
  const floor = shown[0] !== undefined && shown[0] === nameOf(table)?.id ? 1 : 0;
  if (from < floor || to < floor || to >= shown.length) return [...shown];
  const next = [...shown];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
