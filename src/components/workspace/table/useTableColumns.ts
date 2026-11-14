import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMyColumns, setMyColumns, type WorkspaceTable } from "@/lib/tableSettingsApi";
import type { TableFields } from "@/lib/tableQuery";
import type { TableDefinition, TableView } from "./columns";
import { columnsFor } from "./columnChoice";
import { useFirmReady, useTableContextKey } from "./useTableRows";

/**
 * The columns a person shows on a table, and the way to change them (story CRM-S3.1a).
 *
 * `savedView` is the saved view that is open, if one is (CRM-S3.4a's page passes it; a built-in view or no view passes nothing, and its columns are the
 * person's choice for the table). On a saved view the person's own choice is read and kept for that view alone, and until they have one the view's own
 * `columns` show.
 */
export function useTableColumns<K extends TableFields, Row, Context>(table: TableDefinition<K, Row, Context>, savedView: TableView<K> | null = null) {
  const { firmId, ready } = useFirmReady();
  const viewId = savedView?.id ?? null;
  const key = useTableContextKey(table, "columns");
  const kept = useQuery({
    queryKey: [...key, viewId],
    queryFn: () => fetchMyColumns(firmId!, table.id as WorkspaceTable, viewId),
    enabled: ready && firmId !== null,
    staleTime: Infinity,
    retry: false,
  });
  const loading = ready && firmId !== null && kept.isPending;
  // What the person chose on this page, for the view it was chosen on: a list, or `{ ids: null }` for "the default columns". It wins over what was read,
  // which is only what they had kept before.
  const [chosen, setChosen] = useState<{ viewId: string | null; ids: string[] | null } | null>(null);
  const mine = chosen && chosen.viewId === viewId ? chosen : null;
  const [notKept, setNotKept] = useState<string | null>(null);
  // Each save is the whole list, so the last one asked for must be the last one made: they go one after another.
  const saves = useRef<Promise<unknown>>(Promise.resolve());
  const columns = columnsFor(table.columns, mine ? mine.ids : kept.data?.columns ?? savedView?.columns ?? null);
  const isDefault = columns.length === table.columns.length && columns.every((c, i) => c === table.columns[i]);
  const latest = useRef(0);
  /**
   * Keeps a list of column ids, or (null) forgets the person's choice and goes back to the default columns. On a saved view, forgetting lands wherever the
   * database's order says (the view's own columns, else the person's choice for the table, else the defaults), which only the database knows: the view's
   * own columns show at once and the answer is asked for again once the choice is forgotten.
   */
  const choose = (next: string[] | null) => {
    const token = ++latest.current;
    const forgettingOnView = next === null && viewId !== null;
    setChosen({ viewId, ids: forgettingOnView ? (savedView?.columns ? [...savedView.columns] : null) : next });
    if (!firmId) return;
    const save = saves.current.then(() => setMyColumns(firmId, table.id as WorkspaceTable, viewId, next));
    saves.current = save.catch(() => {});
    save.then(
      () => {
        setNotKept(null);
        // Only if nothing has been chosen since: what the person chose after wins over this answer.
        if (forgettingOnView) void kept.refetch().then((r) => { if (r.data && token === latest.current) setChosen({ viewId, ids: r.data.columns }); });
      },
      (e: Error) => setNotKept(e.message),
    );
  };
  return { columns, isDefault, loading, notKept, loadFailed: kept.isError && mine === null, retry: () => void kept.refetch(), choose };
}

export type TableColumns<K extends TableFields, Row, Context> = ReturnType<typeof useTableColumns<K, Row, Context>>;
