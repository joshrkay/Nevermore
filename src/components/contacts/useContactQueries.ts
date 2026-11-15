import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ACCOUNT_REFRESH_MS, TAB_STEP } from "@/components/accounts/useAccountQueries";
import { getContactPage, listContactActivity, type ContactActivityFilter, type ContactPage } from "@/lib/contactPageApi";

/** The key every query of one contact's page starts with, so everything on it can be asked again together. */
export const contactKey = (firmId: string | null, contactId: string) => ["contact", firmId, contactId] as const;

/** A list that failed with nothing to show is not asked again by itself ("Try again" is the way out); one that failed over rows keeps asking quietly. */
const keepsAsking = (query: { state: { status: string; data: unknown } }) => !(query.state.status === "error" && query.state.data === undefined);

/** The contact's page. Not asked until the firm is known. Null data is a contact that isn't there or whose account isn't theirs. */
export function useContactPageQuery(firmId: string | null, contactId: string) {
  return useQuery<ContactPage | null>({
    queryKey: [...contactKey(firmId, contactId), "page"],
    queryFn: () => getContactPage(firmId as string, contactId),
    enabled: firmId !== null,
    // No placeholder: the previous contact's answer is never shown under another contact's address (its open form and version would go with it).
    refetchInterval: (q) => (keepsAsking(q) ? ACCOUNT_REFRESH_MS : false),
    refetchOnWindowFocus: (q) => keepsAsking(q),
    refetchOnReconnect: (q) => keepsAsking(q),
    retry: false,
  });
}

/** The contact's calls, notes and tasks, a page of fifty at a time, each from the row after the last one loaded (D-44). `rows` are every row loaded, each once. */
export function useContactActivityQuery(firmId: string | null, contactId: string, filter: ContactActivityFilter) {
  const query = useInfiniteQuery({
    queryKey: [...contactKey(firmId, contactId), "activity", filter],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listContactActivity(firmId as string, contactId, { filter, limit: TAB_STEP, offset: pageParam }),
    getNextPageParam: (last, all) => {
      if (last === null) return undefined;
      const loaded = all.reduce((n, page) => n + (page?.rows.length ?? 0), 0);
      return last.rows.length > 0 && loaded < last.count ? loaded : undefined;
    },
    enabled: firmId !== null,
    refetchInterval: (q) => (keepsAsking(q) ? ACCOUNT_REFRESH_MS : false),
    refetchOnWindowFocus: (q) => keepsAsking(q),
    refetchOnReconnect: (q) => keepsAsking(q),
    retry: false,
  });
  const pages = query.data?.pages;
  const gone = pages !== undefined && pages.some((page) => page === null);
  const seen = new Set<string>();
  const rows = pages === undefined || gone ? [] : pages.flatMap((page) => page?.rows ?? []).filter((r) => (seen.has(r.entryKey) ? false : (seen.add(r.entryKey), true)));
  const data = pages === undefined ? undefined : gone ? null : { count: (pages[pages.length - 1] as { count: number }).count, rows };
  return { query, data };
}
