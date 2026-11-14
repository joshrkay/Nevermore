import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listSavedViews, type WorkspaceTable } from "@/lib/tableSettingsApi";
import type { TableFields } from "@/lib/tableQuery";
import type { Readiness, TableView } from "./columns";
import { viewFromSaved } from "./savedViews";
import { keepsAsking, TABLE_REFRESH_MS, useFirmReady, useTableContextKey } from "./useTableRows";

/**
 * The firm's saved views of a table that the person may open (their own and the shared ones), as the frame's views, for the table's definition
 * hook to add to its built-in ones (story CRM-S3.4a; D-141's contract). They are read once the firm is known and asked again on focus and every
 * 60 seconds with the rows (D-49), so a view a colleague shares appears without a reload and one that is deleted goes. The last list is kept
 * while the next is asked for, and `status` is "loading" only before the first answer and "failed" only when there is none to keep. Outside the
 * workspace shell there is no firm to ask for, so there are none.
 */
export function useSavedViews<K extends TableFields>(table: { id: string }): { views: TableView<K>[]; status: Readiness } {
  const { firmId, ready } = useFirmReady();
  const query = useQuery({
    queryKey: useTableContextKey(table, "views"),
    queryFn: () => listSavedViews(firmId!, table.id as WorkspaceTable),
    enabled: ready && firmId !== null,
    refetchInterval: (q) => (keepsAsking(q) ? TABLE_REFRESH_MS : false),
    refetchOnWindowFocus: (q) => keepsAsking(q),
    refetchOnReconnect: (q) => keepsAsking(q),
    retry: false,
  });
  const views = useMemo(() => (query.data ?? []).map((v) => viewFromSaved<K>(v)), [query.data]);
  const status: Readiness = !ready ? "loading" : firmId === null || query.data !== undefined ? "ready" : query.isError ? "failed" : "loading";
  return { views, status };
}
