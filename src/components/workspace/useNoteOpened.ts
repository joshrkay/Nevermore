import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { noteRecentRecord, type SearchKind } from "@/lib/searchApi";

/** The menu search box's recent records; the firm is added to it. */
export const RECENT_RECORDS_KEY = ["recent-records"] as const;

/**
 * Notes a record as opened (story CRM-S1.2a, D-620), so the menu's search box offers it first among the last five opened. A page calls it once its record has
 * loaded, with `found` true; it is asked again only for another record. The database notes only what the person may see (and nothing in a support session or a
 * closing firm), so a refusal or a failure here changes nothing on the page and is not shown: a list of recent records is a convenience, never a reason to
 * interrupt the page that was asked for.
 */
export function useNoteOpened(firmId: string | null, kind: SearchKind, id: string, found: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!firmId || !found || id === "") return;
    let cancelled = false;
    (async () => noteRecentRecord(firmId, kind, id))().then(
      (noted) => { if (noted && !cancelled) void queryClient.invalidateQueries({ queryKey: [...RECENT_RECORDS_KEY, firmId] }); },
      () => undefined,
    );
    return () => { cancelled = true; };
  }, [firmId, kind, id, found, queryClient]);
}
