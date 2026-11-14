import type { SavedView } from "@/lib/tableSettingsApi";
import type { TableFields, TableFilter } from "@/lib/tableQuery";
import { has } from "./has";
import { readStoredFilter } from "./address";
import type { Readiness, TableDefinition, TableView } from "./columns";

/** A saved view as the table's own kind of view, or null when the table can't read it (a field it no longer has, an operator its kind doesn't take). */
function tableViewOf<K extends TableFields>(table: TableDefinition<K, never, never>, view: SavedView): TableView<K> | null {
  const filters: TableFilter<K>[] = [];
  for (const f of view.filters) {
    const read = readStoredFilter(table, f);
    if (!read) return null;
    filters.push(read);
  }
  if (view.sort && !has(table.fields, view.sort.field)) return null;
  return {
    id: view.id,
    label: view.name,
    filters,
    sort: view.sort ? { field: view.sort.field as keyof K & string, direction: view.sort.direction } : null,
    columns: view.columns,
    saved: { mine: view.mine, shared: view.shared, canChange: view.canChange, canShare: view.canShare, canUnshare: view.canUnshare },
  };
}

/**
 * The table's definition with the firm's saved views after its built-in ones (CRM-S3.4a, D-141). A saved view the table can't read is left out: its
 * tab would ask the database for a field it refuses, and the counts of every tab asked with it would fail. `status` is the views' own readiness.
 */
export function withSavedViews<K extends TableFields, Row, Context>(table: TableDefinition<K, Row, Context>, saved: SavedView[], status: Readiness): TableDefinition<K, Row, Context> {
  const own = saved.map((v) => tableViewOf(table, v)).filter((v): v is TableView<K> => v !== null);
  return { ...table, views: [...table.views, ...own], viewsStatus: status };
}
