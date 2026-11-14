import { useContext, useMemo, useRef } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { COUNTS_FAILING_FOR_MS, createFailureClock } from "@/lib/failureClock";
import type { TableFields, TablePage, ViewCount } from "@/lib/tableQuery";
import { WorkspaceContext } from "../workspaceContext";
import { effectiveFilters, hasHeld, queryFor, type TableAddress, type TableQuery } from "./address";
import type { TableDefinition } from "./columns";

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
  const query = useQuery({
    queryKey: [...tableKey(firmId, table), "rows", address],
    // What the rows were asked for travels with them, so the range line can say what it counts once they arrive.
    queryFn: async () => ({ page: await fetchPage(queryFor(table, address)), search: address.search }),
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
 * How many rows each view holds (the number on its tab), under the search and filters on screen, from one call. The tab "All" is named
 * "all". A failed refresh keeps the last numbers, and they go only once refreshes have been failing for five minutes, as the menu's do (D-134).
 */
export function useTableViewCounts<K extends TableFields, Row, Context>(
  table: TableDefinition<K, Row, Context>,
  address: TableAddress<K>,
  countViews: (views: { name: string; filters: TableQuery<K>["filters"] }[], opts: { search: string }) => Promise<ViewCount[]>,
) {
  const { firmId, ready } = useFirmReady();
  const clock = useRef(createFailureClock(COUNTS_FAILING_FOR_MS)).current;
  const query = useQuery({
    queryKey: [...tableKey(firmId, table), "counts", address.filters, address.search, table.views.map((v) => v.id)],
    queryFn: async () => {
      try {
        const views = [{ name: "all", filters: effectiveFilters(table, null, address.filters) }, ...table.views.map((v) => ({ name: v.id, filters: effectiveFilters(table, v.id, address.filters) }))];
        const counts = await countViews(views, { search: address.search });
        clock.succeeded();
        return counts;
      } catch (error) {
        clock.failed(firmId);
        throw error;
      }
    },
    enabled: ready && !hasHeld(address),
    placeholderData: keepPreviousData,
    refetchInterval: TABLE_REFRESH_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });
  // Read so that each failure draws the page again: the five minutes are noticed when they pass.
  void query.errorUpdatedAt;
  const expired = clock.expired(firmId);
  return useMemo(() => new Map(expired ? [] : (query.data ?? []).map((c) => [c.name, c.total])), [query.data, expired]);
}

/** Asks again for everything the table's page shows (its rows, its tab counts and anything the page keyed under the table's `context` key). */
export function useRefreshTable<K extends TableFields, Row, Context>(table: TableDefinition<K, Row, Context>) {
  const client = useQueryClient();
  const { firmId } = useFirmReady();
  return () => void client.refetchQueries({ queryKey: tableKey(firmId, table), type: "active" });
}

/** A key for a page's own query that belongs to the table (so "Refresh" asks it again too). */
export function useTableContextKey<K extends TableFields, Row, Context>(table: TableDefinition<K, Row, Context>, name: string) {
  const { firmId } = useFirmReady();
  return [...tableKey(firmId, table), "context", name] as const;
}
