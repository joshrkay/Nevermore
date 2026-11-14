import { useQuery } from "@tanstack/react-query";
import { fetchMenuCounts, MENU_COUNTS_KEY, type MenuCounts } from "@/lib/menuCountsApi";
import { useWorkspace } from "./useWorkspace";

/** How old the last good answer may be before the menu stops showing it. A number older than this is not worth the trust it asks for. */
export const MENU_COUNTS_GOOD_FOR_MS = 5 * 60_000;

/**
 * The menu's counts (story CRM-S1.1c, D-49): asked again when the window gets focus and every 60 seconds; the old numbers stay on
 * screen while the next arrive (the query keeps its data). A failed refresh keeps the last numbers and says nothing; once the last good answer is five minutes old
 * they go, so a stale number is never shown as fresh for ever. Not asked at all while the workspace has no firm to show. The firm is in
 * the key so a different firm never shows the last one's numbers. Null means "show no badge".
 */
export function useMenuCounts(): Partial<MenuCounts> {
  const { firm } = useWorkspace();
  const query = useQuery({
    queryKey: [...MENU_COUNTS_KEY, firm?.id ?? null],
    queryFn: fetchMenuCounts,
    enabled: !!firm,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    // The next refresh is the retry: a count is not worth a burst of calls.
    retry: false,
  });
  // Read so that a failed refresh draws the menu again: without it nothing changes on screen, and the five minutes would pass unseen.
  void query.errorUpdatedAt;
  if (!firm || !query.data) return {};
  if (query.dataUpdatedAt > 0 && Date.now() - query.dataUpdatedAt > MENU_COUNTS_GOOD_FOR_MS) return {};
  return query.data;
}
