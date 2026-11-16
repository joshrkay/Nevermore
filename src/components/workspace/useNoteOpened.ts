import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { noteRecentRecord, type SearchKind } from "@/lib/searchApi";
import { signedInUser } from "@/lib/signedInUser";

/** The menu search box's recent records; the firm and the person are added to it, so one person's list is never another's in the same tab. */
export const RECENT_RECORDS_KEY = ["recent-records"] as const;

let queue: Promise<void> = Promise.resolve();

/**
 * Notes a record as opened (story CRM-S1.2a, D-620), so the menu's search box offers it first among the last five opened. A page calls it once its record has
 * loaded, with `found` true; it is asked again only for another record. The database notes only what the person may see (and nothing in a support session or a
 * closing firm), so a refusal or a failure here changes nothing on the page and is not shown: a list of recent records is a convenience, never a reason to
 * interrupt the page that was asked for.
 */
export function useNoteOpened(firmId: string | null, kind: SearchKind, id: string, found: boolean) {
  const queryClient = useQueryClient();
  const userId = useAuth().user?.id ?? null;
  useEffect(() => {
    if (!firmId || !userId || !found || id === "") return;
    let cancelled = false;
    // Notes go to the database one after another, in the order the pages were opened, so a slow earlier note can't land after a later one. A note that waited
    // while the person signed out and another signed in is dropped, not sent: it would go into the new person's list.
    const noting = queue.then(() => (signedInUser() === userId ? noteRecentRecord(firmId, kind, id) : false));
    queue = noting.then(() => undefined, () => undefined);
    noting.then(
      (noted) => { if (noted && !cancelled) void queryClient.invalidateQueries({ queryKey: [...RECENT_RECORDS_KEY, firmId, userId] }); },
      () => undefined,
    );
    return () => { cancelled = true; };
  }, [firmId, userId, kind, id, found, queryClient]);
}
