import { useCallback, useEffect, useMemo, useState } from "react";
import type { TableFields } from "@/lib/tableQuery";
import { hasHeld, queryFor, type TableAddress } from "./address";
import type { TableDefinition } from "./columns";
import { useFirmReady } from "./useTableRows";

/**
 * What a table's row selection holds (CRM-S3.6): either the keys of rows (`ids`) or "every row that matches" (`all`), which holds no ids at all.
 * A later bulk action takes the second as the table's filters in force (`filters`, `search`, as the query asks for them), never as a list of
 * ids: a selection of 10,000 rows is the question that found them, and the database counts them again when the action runs.
 */
export interface RowSelection<Row> {
  /** How many rows are selected: the ids held, or, for every row that matches, how many match now. */
  count: number;
  /** Every row that matches the filters in force is selected (no ids are held). */
  all: boolean;
  /** The keys held; empty when `all`. */
  ids: string[];
  /** How many rows match the filters in force now, as the table last said. */
  total: number;
  /** How many rows the page on screen holds. */
  rowsOnPage: number;
  isSelected: (row: Row) => boolean;
  toggle: (row: Row) => void;
  /** Whether none, some or all of the rows on the page are selected (the header's checkbox). */
  pageState: "none" | "some" | "all";
  /** The header's checkbox: selects the page, or, when it is all selected, leaves it out. */
  togglePage: () => void;
  /** "Select all N that match". */
  selectAllMatching: () => void;
  clear: () => void;
  /** Names a row's checkbox for a screen reader. */
  rowLabel: (row: Row) => string;
}

interface Held {
  /** The question the selection was made under (view, filters, search); a different one ends it. Null until a question has been judged. */
  scope: string | null;
  all: boolean;
  ids: string[];
}
const NOTHING: Held = { scope: null, all: false, ids: [] };

const storageKey = (firmId: string | null, tableId: string) => `nevermore:selection:${firmId ?? "none"}:${tableId}`;

// A selection survives a refresh of the browser's page, for as long as the tab is open (sessionStorage); where the browser refuses storage it is simply not kept.
function readStored(key: string): Held {
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? "null");
    if (parsed && typeof parsed === "object") {
      const { scope, all, ids } = parsed as Record<string, unknown>;
      if ((typeof scope === "string" || scope === null) && typeof all === "boolean" && Array.isArray(ids) && ids.every((i) => typeof i === "string")) return { scope: scope as string | null, all, ids: ids as string[] };
    }
  } catch { /* nothing kept */ }
  return NOTHING;
}
function writeStored(key: string, held: Held) {
  try {
    if (held.all || held.ids.length > 0) window.sessionStorage.setItem(key, JSON.stringify(held));
    else window.sessionStorage.removeItem(key);
  } catch { /* not kept */ }
}

/**
 * The selection of one table's rows (CRM-S3.6). It belongs to the question on screen (the view, the filters and the search) and is ended by changing any of
 * them; sorting, paging and the table's own refreshes leave it alone, so it holds across pages. `rows` are the rows on the page now and `total` how many
 * match; `rowLabel` is the row's name for a screen reader.
 */
export function useRowSelection<K extends TableFields, Row, Context>(
  table: TableDefinition<K, Row, Context>,
  address: TableAddress<K>,
  page: { rows: Row[]; total: number } | null,
  rowLabel: (row: Row) => string,
): RowSelection<Row> {
  const { firmId } = useFirmReady();
  const key = storageKey(firmId, table.id);
  const [held, setHeld] = useState<{ key: string; value: Held }>(() => ({ key, value: readStored(key) }));
  // The firm becomes known after the first render inside the shell: read what that firm's tab kept.
  if (held.key !== key) setHeld({ key, value: readStored(key) });
  const value = held.key === key ? held.value : readStored(key);

  // What the selection is about. Nothing is judged while the address holds what the table can't read yet (its views are still loading): ending a kept selection then would lose it.
  const scope = hasHeld(address) ? null : JSON.stringify([address.view, queryFor(table, address).filters, address.search]);
  const stale = scope !== null && value.scope !== null && value.scope !== scope;
  const live = stale ? NOTHING : value;
  const set = useCallback((next: Held) => setHeld({ key, value: next }), [key]);
  useEffect(() => {
    if (stale) set({ ...NOTHING, scope });
    else if (scope !== null && value.scope === null && (value.all || value.ids.length > 0)) set({ ...value, scope });
  }, [stale, scope, value, set]);
  useEffect(() => writeStored(key, live), [key, live]);

  const rows = useMemo(() => page?.rows ?? [], [page]);
  const total = page?.total ?? 0;
  const keys = useMemo(() => rows.map((r) => table.rowKey(r)), [rows, table]);
  const chosen = useMemo(() => new Set(live.ids), [live.ids]);
  const onPage = live.all ? keys.length : keys.filter((k) => chosen.has(k)).length;
  const pageState = keys.length === 0 || onPage === 0 ? "none" : onPage === keys.length ? "all" : "some";
  const under = scope ?? live.scope;

  return {
    count: live.all ? total : live.ids.length,
    all: live.all,
    ids: live.ids,
    total,
    rowsOnPage: keys.length,
    rowLabel,
    isSelected: (row) => live.all || chosen.has(table.rowKey(row)),
    // Leaving one row out of "every row that matches" leaves the rest of the page selected (there is no list of exceptions to carry to the database).
    toggle: (row) => {
      const k = table.rowKey(row);
      if (live.all) set({ scope: under, all: false, ids: keys.filter((other) => other !== k) });
      else set({ scope: under, all: false, ids: chosen.has(k) ? live.ids.filter((i) => i !== k) : [...live.ids, k] });
    },
    pageState,
    togglePage: () => {
      if (live.all) set({ scope: under, all: false, ids: [] });
      else if (pageState === "all") set({ scope: under, all: false, ids: live.ids.filter((i) => !keys.includes(i)) });
      else set({ scope: under, all: false, ids: [...live.ids, ...keys.filter((k) => !chosen.has(k))] });
    },
    selectAllMatching: () => set({ scope: under, all: true, ids: [] }),
    clear: () => set({ scope: under, all: false, ids: [] }),
  };
}
