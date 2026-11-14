import type { TableFields, TableFilter, TableSort } from "@/lib/tableQuery";
import type { SavedView } from "@/lib/tableSettingsApi";
import type { TableView } from "./columns";

// A saved view as the frame's view of a table (story CRM-S3.4a). The database keeps a view's filters, sort and columns as plain data; the table's
// own fields judge them when the view is used (a field the table no longer has is refused with its reason, never dropped, D-44).

/** The tab a saved view is: its name, filters, own order and own columns, and what the person may do with it. */
export function viewFromSaved<K extends TableFields>(saved: SavedView): TableView<K> {
  return {
    id: saved.id,
    label: saved.name,
    filters: saved.filters as unknown as TableFilter<K>[],
    ...(saved.sort ? { sort: saved.sort as TableSort<keyof K & string> } : {}),
    ...(saved.columns ? { columns: saved.columns } : {}),
    saved: { shared: saved.shared, mine: saved.mine, canChange: saved.canChange, canShare: saved.canShare, canUnshare: saved.canUnshare },
  };
}
