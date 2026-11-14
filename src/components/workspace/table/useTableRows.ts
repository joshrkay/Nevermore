import { useContext } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { TableFields, TablePage } from "@/lib/tableQuery";
import { WorkspaceContext } from "../workspaceContext";
import type { TableAddress } from "./address";
import type { TableDefinition } from "./columns";

/** Every table's list is asked again this often, and when the window gets focus (D-49). */
export const TABLE_REFRESH_MS = 60_000;

/**
 * The rows of the table's address, through the query library (D-49). The query's key is the firm, the table and the decoded address, so
 * a different firm, table, page, sort, filter, view or search is its own answer. The rows on screen stay while the next page or a
 * refresh loads (`isPlaceholder` says the rows are the previous ones), and the list is asked again on focus and every 60 seconds.
 * A failed load keeps no retry of its own: "Try again" is the retry. `fetchPage` is the table's one call to the database.
 */
export function useTableRows<K extends TableFields, Row>(
  table: TableDefinition<K, Row>,
  address: TableAddress<K>,
  fetchPage: (address: TableAddress<K>) => Promise<TablePage<Row>>,
  extraKey: readonly unknown[] = [],
) {
  const firmId = useContext(WorkspaceContext)?.firm?.id ?? null;
  const query = useQuery({
    queryKey: ["table", firmId, table.id, address, ...extraKey],
    queryFn: () => fetchPage(address),
    placeholderData: keepPreviousData,
    refetchInterval: TABLE_REFRESH_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });
  return {
    page: query.data ?? null,
    error: query.isError ? (query.error as Error) : null,
    isPlaceholder: query.isPlaceholderData,
    isRefreshing: query.isFetching,
    retry: () => void query.refetch(),
  };
}
