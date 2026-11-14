import { useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  changeSavedView, deleteSavedView, listSavedViews, renameSavedView, saveView, shareSavedView, unshareSavedView,
  type SavedView, type ViewFilter, type WorkspaceTable,
} from "@/lib/tableSettingsApi";
import type { TableFields } from "@/lib/tableQuery";
import { effectiveFilters, sameAddress, viewSort, type TableAddress } from "./address";
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
  /** Why the screen can't be kept as a new view right now (columns not loaded, a query the database refuses), in words; null when it can. */
  saveBlocked: string | null;
  /** Why the open view can't be given what is on screen right now (a query the database refuses), in words; null when it can. */
  keepBlocked: string | null;
  /** Keeps the filters in force, the sort and the person's columns as their own new view of this name, and opens it. */
  save: (name: string) => Promise<void>;
  rename: (viewId: string, name: string) => Promise<void>;
  /** Deletes the person's own view; when it is the one open, the table goes to its own "All". */
  remove: (viewId: string) => Promise<void>;
  share: (viewId: string) => Promise<void>;
  /** Stops sharing; a colleague's view that is open goes private to its saver, so the table goes to its own "All" first. */
  unshare: (viewId: string) => Promise<void>;
  /** Keeps what the screen shows (the view's filters and the chips over them, the sort) as the view's own. Its columns stay the view's. */
  update: (viewId: string) => Promise<void>;
}

/** What the screen shows as a view's content: the filters in force (the view's own and the chips', as the database is asked) and the sort the rows are in. */
function screenAsView<K extends TableFields, Row, Context>(table: TableDefinition<K, Row, Context>, address: TableAddress<K>) {
  const filters = effectiveFilters(table, address.view, address.filters).map((f) => {
    const { field, op, value } = f as { field: string; op: string; value?: unknown };
    return (value === undefined ? { field, op } : { field, op, value }) as ViewFilter;
  });
  return { filters, sort: address.sort ?? viewSort(table, address.view) };
}

/** What the page knows that decides whether the screen can be kept: the person's columns, and whether the database refuses the question on screen. */
export interface SavedViewsScreen {
  /** The columns the person sees now: null when they have kept no choice (a resolved answer), which is only believed once `columnsStatus` is "ready". */
  columns: string[] | null;
  columnsStatus: "no_firm" | "loading" | "ready" | "failed";
  /** The database refuses the query on screen (a choice a field doesn't list): what it asks is not worth keeping. */
  refused: boolean;
}

/**
 * The tabs' saving, renaming, deleting and sharing. Each is the one database call, then the list asked again before anything moves (the address may
 * name a view only once the table lists it, or it is dropped), and then, for a save, a delete or a stop sharing, the table goes to the tab that is now
 * right, if the person is still where they were: whatever finishes later reads the address as it is THEN, never the one it was started from, so a tab
 * or a filter chosen meanwhile is not overwritten. The database's own rules and words come back as the error (a name taken, the ceiling, a closing
 * firm, a support session): this never rewords them.
 *
 * A new view keeps the columns the person sees now, so it is not offered until those have arrived (a person whose columns failed to load, or are
 * still on their way, would save a view with none). Keeping changes to an open view leaves its columns as they are: a person's own choice on a view is
 * theirs alone, and a shared view is the firm's, not one person's columns.
 */
export function useSavedViewsControl<K extends TableFields, Row, Context>(
  table: TableDefinition<K, Row, Context>,
  location: Pick<ReturnType<typeof useTableAddress<K, Row, Context>>, "address" | "change">,
  current: SavedViewsScreen,
): SavedViewsControl {
  const client = useQueryClient();
  const { firmId } = useFirmReady();
  const list = useSavedViewList(table.id);
  const latest = useRef(location);
  latest.current = location;
  const key = savedViewsKey(firmId, table.id);
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const listed = (id: string) => !!client.getQueryData<SavedView[]>(key)?.some((v) => v.id === id);
  const kind = table.id as WorkspaceTable;
  const refusedWords = `This view of the ${table.noun.plural} can't be shown, so it can't be saved.`;
  const columnsWords =
    current.columnsStatus === "ready" ? null
    : current.columnsStatus === "failed" ? "Couldn't load your columns, so a view can't be saved yet."
    : current.columnsStatus === "no_firm" ? "Available once your firm's details have loaded."
    : "Available once your columns have loaded.";
  /** Goes to the table's own "All", if the person is still on this view. */
  const leave = (viewId: string) => {
    if (latest.current.address.view === viewId) latest.current.change({ view: null }, { replace: true });
  };
  return {
    failed: table.viewsStatus === "failed",
    retry: list.retry,
    saveBlocked: current.refused ? refusedWords : columnsWords,
    keepBlocked: current.refused ? refusedWords : null,
    async save(name) {
      if (firmId === null) throw new Error("Available once your firm's details have loaded.");
      if (current.refused || columnsWords) throw new Error(current.refused ? refusedWords : columnsWords!);
      const from = location.address;
      const id = await saveView({ firmId, table: kind, name, ...screenAsView(table, from), columns: current.columns });
      await refresh();
      // The chips and the sort are the new view's own now, so the address holds none of them. A view the list doesn't hold yet would be dropped, and a
      // person who has gone somewhere else meanwhile is left there.
      const now = latest.current;
      if (listed(id) && sameAddress(table, from, now.address)) now.change({ view: id, filters: [], sort: null }, { push: true });
    },
    async rename(viewId, name) {
      await renameSavedView(viewId, name);
      await refresh();
    },
    async remove(viewId) {
      await deleteSavedView(viewId);
      leave(viewId);
      await refresh();
    },
    async share(viewId) {
      await shareSavedView(viewId);
      await refresh();
    },
    async unshare(viewId) {
      await unshareSavedView(viewId);
      // A colleague's view is its saver's private view once it is not shared, so the list will no longer hold it; the person's own stays theirs.
      if (!table.views.find((v) => v.id === viewId)?.saved?.mine) leave(viewId);
      await refresh();
    },
    async update(viewId) {
      if (current.refused) throw new Error(refusedWords);
      const from = location.address;
      await changeSavedView(viewId, { ...screenAsView(table, from), columns: table.views.find((v) => v.id === viewId)?.columns ?? null });
      await refresh();
      const now = latest.current;
      if (now.address.view === viewId && sameAddress(table, from, now.address)) now.change({ filters: [], sort: null }, { replace: true });
    },
  };
}
