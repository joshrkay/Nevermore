import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMyColumns, setMyColumns, type ColumnChoice, type WorkspaceTable } from "@/lib/tableSettingsApi";
import type { TableFields } from "@/lib/tableQuery";
import type { TableDefinition } from "./columns";
import { useFirmReady } from "./useTableRows";

/**
 * The columns this person chose for a table (story CRM-S3.1a, D-43), kept in the database per firm, person and table: never in the browser, so
 * the choice is the same on any device. `kept` is the ids in order, or null when none is kept (the table's own columns). `save` keeps a list
 * (or, with null, forgets the choice) and shows it at once; if the database refuses, the screen goes back to what was kept and `saveError` says so.
 *
 * `viewId` is the saved view the choice is for: the database already keeps a choice per saved view (and a view's own columns), and CRM-S3.4a
 * passes the active saved view's id here. Until saved views are on screen the queue passes none, so the choice is the person's for the table.
 */
export function useMyColumns<K extends TableFields, Row, Context>(table: TableDefinition<K, Row, Context>, viewId: string | null = null) {
  const { firmId } = useFirmReady();
  const client = useQueryClient();
  const [saveError, setSaveError] = useState<string | null>(null);
  // Under the table's key (`["table", firm, table]`) so "Refresh" and a change of firm treat it as the rest of the table's answers.
  const key = ["table", firmId, table.id, "columns", viewId] as const;
  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchMyColumns(firmId!, table.id as WorkspaceTable, viewId),
    enabled: firmId !== null,
    retry: false,
  });

  const save = useCallback(
    async (columns: string[] | null) => {
      if (firmId === null) return;
      const before = client.getQueryData<ColumnChoice>(key);
      setSaveError(null);
      await client.cancelQueries({ queryKey: key });
      client.setQueryData<ColumnChoice>(key, { columns, source: columns ? "mine" : "default" });
      try {
        await setMyColumns(firmId, table.id as WorkspaceTable, viewId, columns);
      } catch (e) {
        if (before) client.setQueryData(key, before);
        else client.removeQueries({ queryKey: key });
        setSaveError(e instanceof Error ? e.message : "Couldn't keep your columns. Try again.");
        return;
      }
      // What applies once a choice is forgotten (a view's own columns, the table's) is the database's to say.
      if (columns === null) await client.invalidateQueries({ queryKey: key });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, firmId, table.id, viewId],
  );

  return {
    /** The ids kept, in order, or null for the table's own columns. */
    kept: query.data?.columns ?? null,
    /** Where the choice came from (a saved view's own columns are not the person's own choice). */
    source: query.data?.source ?? "default",
    /** The firm is known, so a choice can be asked for and kept. */
    canKeep: firmId !== null,
    loadFailed: query.isError,
    saveError,
    save,
  };
}

export type MyColumns = ReturnType<typeof useMyColumns>;
