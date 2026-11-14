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
  const open = viewId === null ? undefined : table.views.find((v) => v.id === viewId && v.saved);
  const savedViewId = open?.id ?? null;
  // The view's revision is part of what is asked: a shared view whose own columns changed (its definition moves with the next refresh of the views)
  // is another question, so the cached answer for the old definition is never shown under the new filters.
  const revision = open?.saved?.updatedAt ?? null;
  const [saveError, setSaveError] = useState<{ view: string | null; text: string } | null>(null);
  // Under the table's key (`["table", firm, table]`) so "Refresh" and a change of firm treat it as the rest of the table's answers.
  const keyFor = (view: string | null, rev: string | null) => ["table", firmId, table.id, "columns", view, rev] as const;
  const key = keyFor(savedViewId, revision);
  // What a view's writes are, per firm, table and view (a person can write on one view while another's write is still on its way): how many changes
  // have been made, how many are not finished, and the end of its line of writes. The last choice the database confirmed is kept per FULL key, view
  // and revision, beside the unfinished writes under that key: a view's revisions are different answers, so one's baseline is never another's.
  const writes = useRef(new Map<string, { changes: number; unfinished: number; line: Promise<void>; keys: Map<string, { unfinished: number; confirmed: Kept | undefined }> }>());
  const writesOf = (view: string | null) => {
    const id = JSON.stringify([firmId, table.id, view]);
    let w = writes.current.get(id);
    if (!w) writes.current.set(id, (w = { changes: 0, unfinished: 0, line: Promise.resolve(), keys: new Map() }));
    return w;
  };

  const query = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Kept> => {
      const mine = writesOf(savedViewId);
      const before = mine.changes;
      const answer = await fetchMyColumns(firmId!, table.id as WorkspaceTable, savedViewId);
      // A change made while this was on its way is newer than this answer.
      if (before !== mine.changes || mine.unfinished > 0) return client.getQueryData<Kept>(key) ?? answer;
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
      const view = savedViewId;
      const mine = writesOf(view);
      const fullKey = JSON.stringify(key);
      let slot = mine.keys.get(fullKey);
      if (!slot) mine.keys.set(fullKey, (slot = { unfinished: 0, confirmed: undefined }));
      if (slot.unfinished === 0) slot.confirmed = client.getQueryData<Kept>(key);
      slot.unfinished++;
      mine.unfinished++;
      mine.changes++;
      setSaveError(null);
      // On a view, forgetting leaves what applies next (the view's columns, or the person's choice for the table) to the database: nothing is guessed.
      const forgettingOnAView = columns === null && view !== null;
      const nowKept: Kept = { columns, source: columns === null ? "default" : view ? "mine_for_view" : "mine" };
      if (!forgettingOnAView) client.setQueryData<Kept>(key, nowKept);
      const write = async () => {
        let kept = false;
        try {
          await setMyColumns(firmId, table.id as WorkspaceTable, view, columns);
          if (!forgettingOnAView) slot.confirmed = nowKept;
          kept = true;
        } catch (e) {
          // Only the last change under this key decides what the screen goes back to: a newer one still to be written has its own say.
          if (slot.unfinished === 1) {
            client.setQueryData<Kept>(key, slot.confirmed);
            setSaveError({ view, text: e instanceof Error ? e.message : "Couldn't keep your columns. Try again." });
          }
        } finally {
          slot.unfinished--;
          mine.unfinished--;
        }
        // Whichever revision of the view is on screen by now, its answer may have been asked before this write landed: when a write settles, every answer
        // kept for this firm, table and view (any revision) is asked for again. The key the write began under already holds what the database confirmed
        // (or what it was rolled back to), so it is left alone, except after forgetting, where what applies next is the database's to say.
        const prefix = keyFor(view, null).slice(0, 5);
        const own = fullKey;
        await client.invalidateQueries({ queryKey: prefix, predicate: (q) => (kept && forgettingOnAView) || JSON.stringify(q.queryKey) !== own });
      };
      mine.line = mine.line.then(write);
      return mine.line;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, firmId, table.id, savedViewId, revision],
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
