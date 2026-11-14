import { useCallback, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMyColumns, setMyColumns, type ColumnsSource, type WorkspaceTable } from "@/lib/tableSettingsApi";
import type { TableFields } from "@/lib/tableQuery";
import type { TableDefinition } from "./columns";
import { useFirmReady } from "./useTableRows";

/** What is kept: the ids in order, or null for the table's own columns, and where the database says they came from. */
interface Kept {
  columns: string[] | null;
  source: ColumnsSource;
}

/**
 * The columns this person chose for a table (story CRM-S3.1a, D-43), kept in the database per firm, person and table: never in the browser, so
 * the choice is the same on any device. `kept` is the ids in order, or null when none is kept (the table's own columns).
 *
 * On a saved view (story CRM-S3.4a: `viewId` is the address's view, and only a saved view counts, a built-in one has no columns of its own) the
 * database answers in order: the person's own choice for that view (`source` "mine_for_view"), the view's own columns ("view"), the person's choice
 * for the table ("mine"), none ("default"). A change on a view is the person's own choice for that view; going back to the view's columns
 * (`save(null)`) forgets it and asks again, since what then applies is the database's to say. Moving to another view keeps the last view's
 * columns on screen, with nothing changeable, until the next view's answer arrives, so the table does not jump to the usual columns and back.
 *
 * Nothing can be changed until the kept choice has arrived (`status` is "ready"): a change made over the usual columns would be kept as "the usual
 * columns minus one" over the person's real choice. After a failed load the usual columns show and stay read-only until `retryLoad` succeeds.
 *
 * `save` keeps a list (or, with null, forgets the choice) and shows it at once. Saves are written one after another, so the database ends on the
 * last one whatever order the answers come in; if the database refuses, the screen goes back to the last choice that WAS kept (an earlier save that
 * fails after a later one was made does not roll the screen back past it), and `saveError` says so, in the database's words when it gave them
 * (a closing firm, a support session). An answer to a question asked before a change (a refresh on focus, each minute) never replaces a choice
 * being kept.
 */
export function useMyColumns<K extends TableFields, Row, Context>(table: TableDefinition<K, Row, Context>, viewId: string | null = null) {
  const { firmId } = useFirmReady();
  const client = useQueryClient();
  const savedViewId = viewId !== null && table.views.some((v) => v.id === viewId && v.saved) ? viewId : null;
  const [saveError, setSaveError] = useState<{ view: string | null; text: string } | null>(null);
  // Under the table's key (`["table", firm, table]`) so "Refresh" and a change of firm treat it as the rest of the table's answers.
  const keyFor = (view: string | null) => ["table", firmId, table.id, "columns", view] as const;
  const key = keyFor(savedViewId);
  // How many changes have been made, how many are not finished, the last choice the database confirmed (by view), and the end of the line of writes.
  const changes = useRef(0);
  const unfinished = useRef(0);
  const confirmed = useRef(new Map<string, Kept | undefined>());
  const line = useRef<Promise<void>>(Promise.resolve());

  const query = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Kept> => {
      const before = changes.current;
      const answer = await fetchMyColumns(firmId!, table.id as WorkspaceTable, savedViewId);
      // A change made while this was on its way is newer than this answer.
      if (before !== changes.current || unfinished.current > 0) return client.getQueryData<Kept>(key) ?? answer;
      return answer;
    },
    enabled: firmId !== null,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const status = firmId === null ? "no_firm" : query.isSuccess && !query.isPlaceholderData ? "ready" : query.isError ? "failed" : "loading";

  const save = useCallback(
    (columns: string[] | null): Promise<void> => {
      if (firmId === null || client.getQueryState(key)?.status !== "success") return Promise.resolve();
      const text = JSON.stringify(key);
      const view = savedViewId;
      if (unfinished.current === 0 || !confirmed.current.has(text)) confirmed.current.set(text, client.getQueryData<Kept>(key));
      unfinished.current++;
      changes.current++;
      setSaveError(null);
      // On a view, forgetting leaves what applies next (the view's columns, or the person's choice for the table) to the database: nothing is guessed.
      const forgettingOnAView = columns === null && view !== null;
      if (!forgettingOnAView) client.setQueryData<Kept>(key, { columns, source: columns === null ? "default" : view ? "mine_for_view" : "mine" });
      const write = async () => {
        let kept = false;
        try {
          await setMyColumns(firmId, table.id as WorkspaceTable, view, columns);
          if (!forgettingOnAView) confirmed.current.set(text, { columns, source: columns === null ? "default" : view ? "mine_for_view" : "mine" });
          kept = true;
        } catch (e) {
          // Only the last change decides what the screen goes back to: a newer one still to be written has its own say.
          if (unfinished.current === 1) {
            client.setQueryData<Kept>(key, confirmed.current.get(text));
            setSaveError({ view, text: e instanceof Error ? e.message : "Couldn't keep your columns. Try again." });
          }
        } finally {
          unfinished.current--;
        }
        if (kept && forgettingOnAView) await client.invalidateQueries({ queryKey: key });
      };
      line.current = line.current.then(write);
      return line.current;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, firmId, table.id, savedViewId],
  );

  return {
    /** The ids kept, in order, or null for the table's own columns. */
    kept: query.data?.columns ?? null,
    /** Where they came from: the person's choice for this view, the view's, the person's for the table, or none (the table's own). */
    source: (query.data?.source ?? "default") as ColumnsSource,
    /** The saved view these columns are for, or null for the table (and its built-in views). */
    viewId: savedViewId,
    /** Whether the person has a choice of their own here that "go back" would forget. */
    canForget: query.data?.source === (savedViewId ? "mine_for_view" : "mine"),
    /** Whether the firm is known and the kept choice has arrived: only then can a change be made. */
    status: status as "no_firm" | "loading" | "ready" | "failed",
    /** Asks again for the kept choice after a failed load. */
    retryLoad: () => void query.refetch(),
    saveError: saveError && saveError.view === savedViewId ? saveError.text : null,
    save,
  };
}

export type MyColumns = ReturnType<typeof useMyColumns>;
