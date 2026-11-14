import { useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TableFields, TableFilter, TableSort } from "@/lib/tableQuery";
import { changeSavedView, deleteSavedView, renameSavedView, saveView, shareSavedView, unshareSavedView, type SavedView, type ViewFilter, type WorkspaceTable } from "@/lib/tableSettingsApi";
import { WorkspaceContext } from "../workspaceContext";
import { effectiveFilters, hasHeld, sortFor } from "./address";
import type { TableDefinition, TableView } from "./columns";
import { usePrimeColumnChoice, type TableColumns } from "./useTableColumns";
import type { useTableAddress } from "./useTableAddress";
import { useFirmReady, useTableContextKey } from "./useTableRows";

// What a person does with saved views from the tabs (story CRM-S3.4a): save what is on screen as a view, change one, rename, delete, share. Generic: it
// knows a table only through its definition, its address and the columns shown. The database decides every rule (names, limits, who may do what: supabase/
// tests/table_settings.sql); this keeps the page in step with its answers and says each result in plain words.
//
// The order things happen in is meant to matter, because the address names a view by its id and a view the table doesn't list is dropped from it: a view that
// is made or changed is put into the views the table lists FIRST and the address moves to it second; a view that goes is left in the address FIRST and removed
// from the list second. (Neither order can be told apart by a test: the page reads what the query library holds every time it renders, so the first render after
// the list is written already has the view, however late the library says so. Both were tried, and a wait for the table to list the view was removed.)

/** What a view made from the screen keeps, in the database's shape. */
export interface ViewKeeps<K extends TableFields> {
  filters: TableFilter<K>[];
  sort: TableSort<keyof K & string> | null;
  columns: string[];
}

export interface ViewActions<K extends TableFields> {
  /** What "Save this as a view" would keep: the filters in force (the open view's own first, then the chips), the order on screen and the columns shown. */
  keeps: ViewKeeps<K>;
  /** Why saving can't be used yet, or null when it can (D-143's way: the control stays, says why and ignores the click). */
  unavailable: string | null;
  /** The one polite status's words: what the last action did. The status is put on the page when the first control is used, so it is there, empty, before it has anything to say. */
  said: string;
  armed: boolean;
  arm: () => void;
  /** Saves `keeps` as the person's own view called `name`, and opens it. Throws an Error whose words are for the person. */
  save: (name: string) => Promise<void>;
  /** Keeps `keeps` in the saved view `view` (the person's own): the filters in force, the order and the columns on screen become the view's, and nothing is left over the top of it. */
  saveChanges: (view: TableView<K>) => Promise<void>;
  /** Renames the person's own view. Throws an Error whose words are for the person. */
  rename: (view: TableView<K>, name: string) => Promise<void>;
  /** Shares the person's own view with the firm (an owner). Throws an Error whose words are for the person. */
  share: (view: TableView<K>) => Promise<void>;
  /** Stops sharing a view (an owner): it goes back to being private to whoever saved it, which for a colleague's view means it leaves the person's tabs. */
  unshare: (view: TableView<K>) => Promise<void>;
  /** Deletes the person's own view and leaves it for the table's "all" tab. The submissions are not touched. Throws an Error whose words are for the person. */
  remove: (view: TableView<K>) => Promise<void>;
  /** The tab that should take focus once it is drawn: a view's id, null for the table's "all" tab, or undefined for none. */
  focusWanted: () => string | null | undefined;
  focusDone: () => void;
}

const toApi = <K extends TableFields>(filters: TableFilter<K>[]): ViewFilter[] => filters as unknown as ViewFilter[];

/** The state of the saved-view controls over a table. `null` when there is no firm to keep a view for (a page outside the workspace shell). */
export function useViewActions<K extends TableFields, Row, Context>(
  table: TableDefinition<K, Row, Context>,
  location: ReturnType<typeof useTableAddress<K, Row, Context>>,
  columns: TableColumns<K, Row, Context>,
): ViewActions<K> | null {
  const client = useQueryClient();
  const { firmId } = useFirmReady();
  const workspace = useContext(WorkspaceContext);
  const viewsKey = useTableContextKey(table, "views");
  const primeColumns = usePrimeColumnChoice(table);
  const { address, change } = location;
  const [said, setSaid] = useState("");
  const [armed, setArmed] = useState(false);
  // An action ends after the database has answered, which can be some time after it began: the address it moves is the one of NOW (a person may have typed in the
  // search meanwhile), not the one drawn when the button was pressed.
  const changeNow = useRef(change);
  changeNow.current = change;
  // It may also end after the person has left the queue altogether (opened a row, pressed Back): what an action does to the address belongs to the page they were
  // looking at, and putting it on the address of whatever page they are on now would pull them back (D-253). The list and the caches are still written: they are
  // the firm's, not the page's, and the queue is drawn from them when the person returns.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const moveAddress: typeof change = (patch, options) => { if (mounted.current) changeNow.current(patch, options); };
  const focus = useRef<string | null | undefined>(undefined);
  // No firm, no views to keep (every hook is above this line).
  if (!firmId) return null;

  const keeps: ViewKeeps<K> = {
    filters: effectiveFilters(table, address.view, address.filters),
    sort: sortFor(table, address),
    columns: columns.columns.map((c) => c.id),
  };
  const unavailable = columns.loading ? "Available once your columns have loaded" : hasHeld(address) ? "Available once the table's views and fields have loaded" : null;

  const save = async (name: string) => {
    const id = await saveView({ firmId, table: table.id as WorkspaceTable, name, filters: toApi(keeps.filters), sort: keeps.sort, columns: keeps.columns });
    const made: SavedView = {
      id, name, filters: toApi(keeps.filters), sort: keeps.sort, columns: keeps.columns, shared: false, mine: true, canChange: true,
      canShare: workspace?.isOwner ?? false, canUnshare: false, updatedAt: new Date().toISOString(),
    };
    client.setQueryData<SavedView[]>(viewsKey, (old) => [...(old ?? []), made]);
    primeColumns(id, keeps.columns);
    void client.invalidateQueries({ queryKey: viewsKey });
    setSaid(`Saved the view “${name}”. It is open now.`);
    focus.current = id;
    moveAddress({ view: id, filters: [], sort: null }, { push: true });
  };

  const rename = async (view: TableView<K>, name: string) => {
    await renameSavedView(view.id, name);
    client.setQueryData<SavedView[]>(viewsKey, (old) => (old ?? []).map((v) => (v.id === view.id ? { ...v, name } : v)));
    void client.invalidateQueries({ queryKey: viewsKey });
    setSaid(`Renamed to “${name}”.`);
  };

  const share = async (view: TableView<K>) => {
    await shareSavedView(view.id);
    client.setQueryData<SavedView[]>(viewsKey, (old) => (old ?? []).map((v) => (v.id === view.id ? { ...v, shared: true, canShare: false, canUnshare: true } : v)));
    void client.invalidateQueries({ queryKey: viewsKey });
    setSaid(`“${view.label}” is shared with the firm.`);
  };

  const unshare = async (view: TableView<K>) => {
    await unshareSavedView(view.id);
    if (view.saved?.mine) {
      // Back to its saver's own: only an owner can stop sharing, so the person is the owner of a view that is theirs and may share it again.
      client.setQueryData<SavedView[]>(viewsKey, (old) => (old ?? []).map((v) => (v.id === view.id ? { ...v, shared: false, canShare: true, canUnshare: false } : v)));
      setSaid(`“${view.label}” is no longer shared. Only you can see it.`);
    } else {
      // A colleague's view goes back to being private to them, so it is no longer one the person may open: they leave it first, as for a deleted view.
      setSaid(`Stopped sharing “${view.label}”. It is private to whoever saved it, so it is no longer in your views.`);
      moveAddress({ view: null }, { push: true });
      client.setQueryData<SavedView[]>(viewsKey, (old) => (old ?? []).filter((v) => v.id !== view.id));
    }
    void client.invalidateQueries({ queryKey: viewsKey });
  };

  const remove = async (view: TableView<K>) => {
    await deleteSavedView(view.id);
    setSaid(`Deleted the view “${view.label}”. Showing ${table.allViewLabel.toLowerCase()}.`);
    // The address leaves the view FIRST: a view the table no longer lists is dropped from the address with a line saying it isn't available, which is not
    // what a person who has just deleted it should be told.
    moveAddress({ view: null }, { push: true });
    client.setQueryData<SavedView[]>(viewsKey, (old) => (old ?? []).filter((v) => v.id !== view.id));
    void client.invalidateQueries({ queryKey: viewsKey });
  };

  const saveChanges = async (view: TableView<K>) => {
    await changeSavedView(view.id, { filters: toApi(keeps.filters), sort: keeps.sort, columns: keeps.columns });
    client.setQueryData<SavedView[]>(viewsKey, (old) => (old ?? []).map((v) => (v.id === view.id ? { ...v, filters: toApi(keeps.filters), sort: keeps.sort, columns: keeps.columns } : v)));

    void client.invalidateQueries({ queryKey: viewsKey });
    setSaid(`Saved the changes to “${view.label}”.`);
    // The button that was pressed goes with the change (nothing is left over the view), so focus goes to the view's tab.
    focus.current = view.id;
    moveAddress({ filters: [], sort: null }, { push: true });
  };

  return {
    keeps, unavailable, said, armed, arm: () => setArmed(true), save, saveChanges, rename, remove, share, unshare,
    focusWanted: () => focus.current,
    focusDone: () => { focus.current = undefined; },
  };
}
