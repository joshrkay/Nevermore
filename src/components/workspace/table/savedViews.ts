import type { SavedView } from "@/lib/tableSettingsApi";
import type { TableFields, TableFilter } from "@/lib/tableQuery";
import { has } from "./has";
import { readStoredFilter } from "./address";
import type { Readiness, TableDefinition, TableView, UnavailableView } from "./columns";

/** Why the table can't open a saved view, or null when it can: a field it doesn't have, an operator or value it won't read, a choice the field doesn't list. */
function whyUnavailable<K extends TableFields>(table: TableDefinition<K, never, never>, view: SavedView): string | null {
  for (const f of view.filters) {
    if (!has(table.fields, f.field)) return "This view uses a field this table no longer has.";
    if (!readStoredFilter(table, f)) return "This view uses a filter this table no longer takes.";
    // The database refuses a choice a field doesn't list, for the whole question; it trims and lowercases a value before it compares, so this does too.
    const choices = table.fields[f.field as keyof K & string].choices;
    const named = (v: unknown) => String(v).trim().toLowerCase();
    if (choices && Array.isArray(f.value) && f.value.some((v) => !choices.some((c) => named(c.value) === named(v)))) return "This view uses a choice its field no longer lists.";
  }
  if (view.sort && !has(table.fields, view.sort.field)) return "This view is sorted by a field this table no longer has.";
  return null;
}

/** A saved view the table can open, as the table's own kind of view. */
function tableViewOf<K extends TableFields>(table: TableDefinition<K, never, never>, view: SavedView): TableView<K> {
  return {
    id: view.id,
    label: view.name,
    filters: view.filters.map((f) => readStoredFilter(table, f)!),
    sort: view.sort ? { field: view.sort.field as keyof K & string, direction: view.sort.direction } : null,
    columns: view.columns,
    saved: rightsOf(view),
  };
}

const rightsOf = (view: SavedView) => ({ mine: view.mine, shared: view.shared, canChange: view.canChange, canShare: view.canShare, canUnshare: view.canUnshare, updatedAt: view.updatedAt });

/**
 * The table's definition with the firm's saved views after its built-in ones (CRM-S3.4a, D-141). A saved view the table can't open is not one of its
 * views (its tab would make the database refuse the counts of every tab asked with it, and an address naming it would open every row): it is listed in
 * `unavailableViews`, so its tab is drawn with the reason and its owner can still delete or stop sharing it. `status` is the views' own readiness.
 */
export function withSavedViews<K extends TableFields, Row, Context>(table: TableDefinition<K, Row, Context>, saved: SavedView[], status: Readiness): TableDefinition<K, Row, Context> {
  const views: TableView<K>[] = [];
  const unavailableViews: UnavailableView[] = [];
  for (const v of saved) {
    const reason = whyUnavailable(table, v);
    if (reason === null) views.push(tableViewOf(table, v));
    else unavailableViews.push({ id: v.id, label: v.name, reason, saved: rightsOf(v) });
  }
  return { ...table, views: [...table.views, ...views], viewsStatus: status, unavailableViews };
}
