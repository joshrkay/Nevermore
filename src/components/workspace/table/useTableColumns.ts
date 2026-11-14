import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMyColumns, setMyColumns, type ColumnChoice, type WorkspaceTable } from "@/lib/tableSettingsApi";
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
  const client = useQueryClient();
  const kept = useQuery({
    queryKey: [...key, viewId],
    queryFn: () => fetchMyColumns(firmId!, table.id as WorkspaceTable, viewId),
    enabled: ready && firmId !== null,
    staleTime: Infinity,
    retry: false,
  });
  // Not usable until the firm is known and the person's choice has been read (D-190, D-197): before the firm is known nothing can be kept, and a change made then
  // would be drawn over what the database holds once the firm arrives.
  const loading = !ready || (firmId !== null && kept.isPending);
  // What the person chose on this page, for the view it was chosen on: a list, or `{ ids: null }` for "the default columns" (`own` says whether it is a choice of
  // theirs or the forgetting of one). It wins over what was read, which is only what they had kept before.
  const [chosen, setChosen] = useState<{ viewId: string | null; ids: string[] | null; own: boolean } | null>(null);
  const mine = chosen && chosen.viewId === viewId ? chosen : null;
  const [notKept, setNotKept] = useState<string | null>(null);
  // Each save is the whole list, so the last one asked for must be the last one made: they go one after another.
  const saves = useRef<Promise<unknown>>(Promise.resolve());
  const columns = columnsFor(table.columns, mine ? mine.ids : kept.data?.columns ?? savedView?.columns ?? null);
  // Whether the person keeps a choice of their own here (D-198): what "Back to default columns" would forget. It is not whether what is drawn equals the default
  // order: a kept list that happens to be the default order is still a kept list, and a column the table gains later would stay hidden for that person.
  const hasChoice = mine ? mine.own : kept.data?.source === "mine" || kept.data?.source === "mine_for_view";
  const latest = useRef(0);
  /**
   * Keeps a list of column ids, or (null) forgets the person's choice and goes back to the default columns. On a saved view, forgetting lands wherever the
   * database's order says (the view's own columns, else the person's choice for the table, else the defaults), which only the database knows: the view's
   * own columns show at once and the answer is asked for again once the choice is forgotten.
   */
  const choose = (next: string[] | null) => {
    const token = ++latest.current;
    const forgettingOnView = next === null && viewId !== null;
    const shown = forgettingOnView ? (savedView?.columns ? [...savedView.columns] : null) : next;
    setChosen({ viewId, ids: shown, own: next !== null });
    // The query library keeps what was read and asks again for nothing (`staleTime`): leaving the table and coming back, or choosing another view and coming back to
    // this one, would draw that answer from BEFORE this change. So what the person chose is what it holds (D-196), in the shape a read answers with.
    client.setQueryData<ColumnChoice>([...key, viewId], { columns: shown, source: next ? (viewId ? "mine_for_view" : "mine") : shown ? "view" : "default" });
    if (!firmId) return;
    const save = saves.current.then(() => setMyColumns(firmId, table.id as WorkspaceTable, viewId, next));
    saves.current = save.catch(() => {});
    save.then(
      () => {
        setNotKept(null);
        // Only if nothing has been chosen since: what the person chose after wins over this answer.
        if (forgettingOnView) void kept.refetch().then((r) => { if (r.data && token === latest.current) setChosen({ viewId, ids: r.data.columns, own: false }); });
      },
      (e: Error) => setNotKept(e.message),
    );
  };
  return { columns, hasChoice, loading, notKept, loadFailed: kept.isError && mine === null, retry: () => void kept.refetch(), choose };
}

export type TableColumns<K extends TableFields, Row, Context> = ReturnType<typeof useTableColumns<K, Row, Context>>;
