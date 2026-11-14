import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMyColumns, setMyColumns, type WorkspaceTable } from "@/lib/tableSettingsApi";
import type { TableFields } from "@/lib/tableQuery";
import type { TableDefinition } from "./columns";
import { useFirmReady } from "./useTableRows";

/** What is kept: the ids in order, or null for the table's own columns. */
interface Kept {
  columns: string[] | null;
}

/**
 * The columns this person chose for a table (story CRM-S3.1a, D-43), kept in the database per firm, person and table: never in the browser, so
 * the choice is the same on any device. `kept` is the ids in order, or null when none is kept (the table's own columns).
 *
 * Nothing can be changed until the kept choice has arrived (`status` is "ready"): a change made over the usual columns would be kept as "the usual
 * columns minus one" over the person's real choice. After a failed load the usual columns show and stay read-only until `retryLoad` succeeds.
 *
 * `save` keeps a list (or, with null, forgets the choice) and shows it at once. Saves are written one after another, so the database ends on the
 * last one whatever order the answers come in; if the database refuses, the screen goes back to the last choice that WAS kept (an earlier save that
 * fails after a later one was made does not roll the screen back past it), and `saveError` says so. An answer to a question asked before a change
 * (a refresh on focus, each minute) never replaces a choice being kept.
 *
 * Left for CRM-S3.4a: a choice per saved view. The database already keeps one (`my_table_columns` and `set_my_table_columns` take the view's id and
 * answer where the columns came from); S3.4a gives this hook the active view's id and reads that source.
 */
export function useMyColumns<K extends TableFields, Row, Context>(table: TableDefinition<K, Row, Context>) {
  const { firmId } = useFirmReady();
  const client = useQueryClient();
  const [saveError, setSaveError] = useState<string | null>(null);
  // Under the table's key (`["table", firm, table]`) so "Refresh" and a change of firm treat it as the rest of the table's answers.
  const key = ["table", firmId, table.id, "columns"] as const;
  // How many changes have been made, how many are not finished, the last choice the database confirmed, and the end of the line of writes.
  const changes = useRef(0);
  const unfinished = useRef(0);
  const confirmed = useRef<Kept | undefined>(undefined);
  const line = useRef<Promise<void>>(Promise.resolve());

  const query = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Kept> => {
      const before = changes.current;
      const { columns } = await fetchMyColumns(firmId!, table.id as WorkspaceTable, null);
      // A change made while this was on its way is newer than this answer.
      if (before !== changes.current || unfinished.current > 0) return client.getQueryData<Kept>(key) ?? { columns };
      return { columns };
    },
    enabled: firmId !== null,
    retry: false,
  });
  const status = firmId === null ? "no_firm" : query.isSuccess ? "ready" : query.isError ? "failed" : "loading";

  const save = useCallback(
    (columns: string[] | null): Promise<void> => {
      if (firmId === null || client.getQueryState(key)?.status !== "success") return Promise.resolve();
      if (unfinished.current === 0) confirmed.current = client.getQueryData<Kept>(key);
      unfinished.current++;
      changes.current++;
      setSaveError(null);
      client.setQueryData<Kept>(key, { columns });
      const write = async () => {
        try {
          await setMyColumns(firmId, table.id as WorkspaceTable, null, columns);
          confirmed.current = { columns };
        } catch (e) {
          // Only the last change decides what the screen goes back to: a newer one still to be written has its own say.
          if (unfinished.current === 1) {
            client.setQueryData<Kept>(key, confirmed.current);
            setSaveError(e instanceof Error ? e.message : "Couldn't keep your columns. Try again.");
          }
        } finally {
          unfinished.current--;
        }
      };
      line.current = line.current.then(write);
      return line.current;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, firmId, table.id],
  );

  return {
    /** The ids kept, in order, or null for the table's own columns. */
    kept: query.data?.columns ?? null,
    /** Whether the firm is known and the kept choice has arrived: only then can a change be made. */
    status: status as "no_firm" | "loading" | "ready" | "failed",
    /** Asks again for the kept choice after a failed load. */
    retryLoad: () => void query.refetch(),
    saveError,
    save,
  };
}

export type MyColumns = ReturnType<typeof useMyColumns>;
