import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  changeSavedView, deleteSavedView, listSavedViews, renameSavedView, saveView, shareSavedView, unshareSavedView,
  type SavedView, type ViewFilter, type WorkspaceTable,
} from "@/lib/tableSettingsApi";
import type { TableFields } from "@/lib/tableQuery";
import { effectiveFilters, viewSort, type TableAddress } from "./address";
import type { Readiness, TableDefinition } from "./columns";
import type { useTableAddress } from "./useTableAddress";
import { TABLE_REFRESH_MS, useFirmReady } from "./useTableRows";

/** The key of a table's saved views: under the table's own key, so "Refresh" and a change of firm treat it as the rest of the table's answers. */
export const savedViewsKey = (firmId: string | null, tableId: string) => ["table", firmId, tableId, "saved-views"] as const;

/**
 * The saved views of a table the person may open (story CRM-S3.4a): their own and the firm's shared ones, asked again on focus and every 60 seconds
 * like the rows (D-49), so a colleague's shared view appears and a deleted one goes. It follows the contract for what a definition is built from
 * (D-141): `loading` only before the first answer, `failed` only when there is none to keep (a failed ask again keeps the last list and says nothing),
 * and outside the shell, where there is no firm, no views and ready.
 */
export function useSavedViewList(tableId: string) {
  const { firmId, ready } = useFirmReady();
  const query = useQuery({
    queryKey: savedViewsKey(firmId, tableId),
    queryFn: () => listSavedViews(firmId!, tableId as WorkspaceTable),
    enabled: firmId !== null,
    refetchInterval: TABLE_REFRESH_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const saved: SavedView[] | undefined = query.data;
  const status: Readiness = saved ? "ready" : !ready || (firmId !== null && !query.isError) ? "loading" : query.isError ? "failed" : "ready";
  return { saved: saved ?? EMPTY, status, retry: () => void query.refetch() };
}

const EMPTY: SavedView[] = [];

// ---- what a person does with the views (CRM-S3.4a) ----

/** What the tabs ask of the page: keep the screen as a view, and rename, delete, share, stop sharing or update one. Each rejects with the words to show. */
export interface SavedViewsControl {
  /** The views couldn't be loaded and there is no list to keep. */
  failed: boolean;
  retry: () => void;
  /** Keeps the filters in force, the sort and the person's columns as their own new view of this name, and opens it. */
  save: (name: string) => Promise<void>;
  rename: (viewId: string, name: string) => Promise<void>;
  /** Deletes the person's own view; when it is the one open, the table goes to its own "All". */
  remove: (viewId: string) => Promise<void>;
  share: (viewId: string) => Promise<void>;
  unshare: (viewId: string) => Promise<void>;
  /** Keeps what the screen shows (the view's filters and the chips over them, the sort, the columns) as the view's own. */
  update: (viewId: string) => Promise<void>;
}

/** What the screen shows as a view's content: the filters in force (the view's own and the chips', as the database is asked), the sort the rows are in, and the columns. */
function screenAsView<K extends TableFields, Row, Context>(table: TableDefinition<K, Row, Context>, address: TableAddress<K>, columns: string[] | null) {
  const filters = effectiveFilters(table, address.view, address.filters).map((f) => {
    const { field, op, value } = f as { field: string; op: string; value?: unknown };
    return (value === undefined ? { field, op } : { field, op, value }) as ViewFilter;
  });
  return { filters, sort: address.sort ?? viewSort(table, address.view), columns };
}

/**
 * The tabs' saving, renaming, deleting and sharing. Each is the one database call, then the list asked again before anything moves (the address may
 * name a view only once the table lists it, or it is dropped), and then, for a save and a delete, the table goes to the tab that is now right. The
 * database's own rules and words come back as the error (a name taken, the ceiling, a closing firm, a support session): this never rewords them.
 * `columns` is the person's columns as shown now (null when they have kept none), which a new or updated view keeps with it.
 */
export function useSavedViewsControl<K extends TableFields, Row, Context>(
  table: TableDefinition<K, Row, Context>,
  location: Pick<ReturnType<typeof useTableAddress<K, Row, Context>>, "address" | "change">,
  columns: string[] | null,
): SavedViewsControl {
  const client = useQueryClient();
  const { firmId } = useFirmReady();
  const list = useSavedViewList(table.id);
  const { address, change } = location;
  const key = savedViewsKey(firmId, table.id);
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const listed = (id: string) => !!client.getQueryData<SavedView[]>(key)?.some((v) => v.id === id);
  const kind = table.id as WorkspaceTable;
  return {
    failed: table.viewsStatus === "failed",
    retry: list.retry,
    async save(name) {
      if (firmId === null) throw new Error("Available once your firm's details have loaded.");
      const id = await saveView({ firmId, table: kind, name, ...screenAsView(table, address, columns) });
      await refresh();
      // The chips and the sort are the new view's own now, so the address holds none of them. A view the list doesn't hold yet would be dropped.
      if (listed(id)) change({ view: id, filters: [], sort: null }, { push: true });
    },
    async rename(viewId, name) {
      await renameSavedView(viewId, name);
      await refresh();
    },
    async remove(viewId) {
      await deleteSavedView(viewId);
      if (address.view === viewId) change({ view: null }, { replace: true });
      await refresh();
    },
    async share(viewId) {
      await shareSavedView(viewId);
      await refresh();
    },
    async unshare(viewId) {
      await unshareSavedView(viewId);
      await refresh();
    },
    async update(viewId) {
      await changeSavedView(viewId, screenAsView(table, address, columns));
      await refresh();
      if (address.view === viewId) change({ filters: [], sort: null }, { replace: true });
    },
  };
}
