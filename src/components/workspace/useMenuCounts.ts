import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMenuCounts, MENU_COUNTS_KEY, type MenuCounts } from "@/lib/menuCountsApi";
import { useWorkspace } from "./useWorkspace";

/** How long refreshes may keep failing before the menu stops showing the last numbers. A number nobody can confirm is not worth the trust it asks for. */
export const MENU_COUNTS_FAILING_FOR_MS = 5 * 60_000;

/**
 * The menu's counts (story CRM-S1.1c, D-49): asked again when the window gets focus and every 60 seconds; the old numbers stay on
 * screen while the next arrive (the query keeps its data). A failed refresh keeps the last numbers and says nothing; once refreshes have
 * been failing for five minutes they go, so a stale number is never shown as fresh for ever. Old is not failing: a tab that sat in the
 * background keeps its numbers until the refresh on return answers. Not asked at all while the workspace has no firm to show. The firm is in
 * the key so a different firm never shows the last one's numbers. Null means "show no badge".
 */
export function useMenuCounts(): Partial<MenuCounts> {
  const { firm } = useWorkspace();
  // When the run of failed refreshes began: the first failure after the last good answer, noted where the call is made so it does not
  // depend on the menu having been drawn in between.
  const failingSince = useRef<{ firm: string | null; at: number } | null>(null);
  const firmKey = firm?.id ?? null;
  const query = useQuery({
    queryKey: [...MENU_COUNTS_KEY, firmKey],
    queryFn: async () => {
      try {
        const counts = await fetchMenuCounts();
        failingSince.current = null;
        return counts;
      } catch (error) {
        if (failingSince.current?.firm !== firmKey) failingSince.current = { firm: firmKey, at: Date.now() };
        throw error;
      }
    },
    enabled: !!firm,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    // The next refresh is the retry: a count is not worth a burst of calls.
    retry: false,
  });
  // Read so that each failure draws the menu again: the five minutes are noticed when they pass.
  void query.errorUpdatedAt;
  if (!firm || !query.data) return {};
  if (failingSince.current && failingSince.current.firm === firmKey && Date.now() - failingSince.current.at > MENU_COUNTS_FAILING_FOR_MS) return {};
  return query.data;
}
