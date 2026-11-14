import { useContext, useMemo, useRef } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { COUNTS_FAILING_FOR_MS, createFailureClock } from "@/lib/failureClock";
import type { TableFields, TablePage, ViewCount } from "@/lib/tableQuery";
import { WorkspaceContext } from "../workspaceContext";
import { effectiveFilters, hasHeld, queryFor, type TableAddress, type TableQuery } from "./address";
import { VIEWS_PER_COUNT_CALL, type TableDefinition } from "./columns";

/** Every table's list is asked again this often, and when the window gets focus (D-49). */
export const TABLE_REFRESH_MS = 60_000;

/**
 * The firm the workspace is showing, and whether a request may be made for it yet. Inside the shell the firm is unknown for the first
 * moment: a request made then would be made twice (once for no firm, once for the firm) and the first answer would be shown. A page
 * outside the shell (a test) has no firm to wait for.
 */
export function useFirmReady() {
  const workspace = useContext(WorkspaceContext);
  return { firmId: workspace?.firm?.id ?? null, ready: workspace === null || workspace.firm !== null };
}

/** The key every query of one table starts with, so everything the page shows for it can be asked again together. */
const tableKey = (firmId: string | null, table: { id: string }) => ["table", firmId, table.id] as const;

/**
 * The rows of the table's address, through the query library (D-49). The key is the firm, the table and the decoded address, so a
 * different firm, table, page, sort, filter, view or search is its own answer. The rows on screen stay while the next page or a refresh
 * loads (`isPlaceholder` says they are the previous ones), and the list is asked again on focus and every 60 seconds. Nothing is asked
 * until the firm is known and the address holds nothing the table can't judge yet. A failed load keeps no retry of its own: "Try again"
 * is the retry. `fetchPage` is the table's one call to the database; it receives the effective query (the view's filters and the
 * address's together).
 */
export function useTableRows<K extends TableFields, Row, Context>(
  table: TableDefinition<K, Row, Context>,
  address: TableAddress<K>,
  fetchPage: (query: TableQuery<K>) => Promise<TablePage<Row>>,
) {
  const { firmId, ready } = useFirmReady();
  // Keyed on what is asked (the effective query), not on the address: a saved view whose filters changed under the same id is another question.
  const asked = queryFor(table, address);
  const query = useQuery({
    queryKey: [...tableKey(firmId, table), "rows", asked],
    // What the rows were asked for travels with them, so the range line can say what it counts once they arrive.
    queryFn: async () => ({ page: await fetchPage(asked), search: address.search }),
    enabled: ready && !hasHeld(address),
    placeholderData: keepPreviousData,
    refetchInterval: TABLE_REFRESH_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });
  return {
    page: query.data?.page ?? null,
    /** The search the rows on screen were found for. */
    searchOfRows: query.data?.search ?? "",
    error: query.isError ? (query.error as Error) : null,
    isPlaceholder: query.isPlaceholderData,
    isRefreshing: query.isFetching,
    retry: () => void query.refetch(),
  };
}

/**
 * How many rows each view holds (the number on its tab), under the search and filters on screen. The tab "All" is named "all". The database
 * counts at most 20 views a call, so the views are asked in batches of that many and the answers put together. A failed batch is a failed
 * count for its own views only: they keep their last numbers through the failure and lose them after five minutes of failing, as the menu's
 * do (D-134); the other batches' numbers are shown as they arrive. The key holds each view's effective filters, so a view whose filters
 * changed under the same id is asked again at once.
 */
export function useTableViewCounts<K extends TableFields, Row, Context>(
  table: TableDefinition<K, Row, Context>,
  address: TableAddress<K>,
  countViews: (views: { name: string; filters: TableQuery<K>["filters"] }[], opts: { search: string }) => Promise<ViewCount[]>,
) {
  const { firmId, ready } = useFirmReady();
  // One clock per batch, and the last numbers of the question they answered (a different question's numbers are never shown for this one).
  const clocks = useRef<ReturnType<typeof createFailureClock>[]>([]);
  const last = useRef<{ key: string; totals: Map<string, number> }>({ key: "", totals: new Map() });
  const views = [{ name: "all", filters: effectiveFilters(table, null, address.filters) }, ...table.views.map((v) => ({ name: v.id, filters: effectiveFilters(table, v.id, address.filters) }))];
  const asked = JSON.stringify([views, address.search]);
  const query = useQuery({
    queryKey: [...tableKey(firmId, table), "counts", views, address.search],
    queryFn: async () => {
      if (last.current.key !== asked) last.current = { key: asked, totals: new Map() };
      const batches: (typeof views)[] = [];
      for (let i = 0; i < views.length; i += VIEWS_PER_COUNT_CALL) batches.push(views.slice(i, i + VIEWS_PER_COUNT_CALL));
      const answers = await Promise.allSettled(batches.map((batch) => countViews(batch, { search: address.search })));
      const out: ViewCount[] = [];
      answers.forEach((answer, i) => {
        clocks.current[i] ??= createFailureClock(COUNTS_FAILING_FOR_MS);
        const clock = clocks.current[i];
        if (answer.status === "fulfilled") {
          clock.succeeded();
          for (const c of answer.value) last.current.totals.set(c.name, c.total);
          out.push(...answer.value);
        } else {
          clock.failed(firmId);
          // Keep what this batch last said, unless it has been failing too long to be believed.
          for (const v of batches[i]) {
            if (clock.expired(firmId)) last.current.totals.delete(v.name);
            else if (last.current.totals.has(v.name)) out.push({ name: v.name, total: last.current.totals.get(v.name)! });
          }
        }
      });
      return out;
    },
    enabled: ready && !hasHeld(address),
    placeholderData: keepPreviousData,
    refetchInterval: TABLE_REFRESH_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });
  return useMemo(() => new Map((query.data ?? []).map((c) => [c.name, c.total])), [query.data]);
}

/**
 * Asks again for everything the table's page shows (its rows, its tab counts and anything the page keyed under the table's `context` key).
 * It drops a request still on its way first: a plain refetch of a query with no answer yet (or a stuck request for the next tab with rows
 * on screen) hands back the same stuck request, so Refresh and the slow-load line's "Try again" would do nothing.
 */
export function useRefreshTable<K extends TableFields, Row, Context>(table: TableDefinition<K, Row, Context>) {
  const client = useQueryClient();
  const { firmId } = useFirmReady();
  return () => {
    const filters = { queryKey: tableKey(firmId, table), type: "active" as const };
    void client.cancelQueries(filters).then(() => client.refetchQueries(filters));
  };
}

/** A key for a page's own query that belongs to the table (so "Refresh" asks it again too). */
export function useTableContextKey<K extends TableFields, Row, Context>(table: TableDefinition<K, Row, Context>, name: string) {
  const { firmId } = useFirmReady();
  return [...tableKey(firmId, table), "context", name] as const;
}
