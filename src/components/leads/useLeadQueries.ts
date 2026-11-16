import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ACCOUNT_REFRESH_MS, TAB_STEP } from "@/components/accounts/useAccountQueries";
import { getLeadPage, listLeadActivity, type LeadActivityFilter, type LeadPage } from "@/lib/leadPageApi";

/** The key every query of one lead's page starts with, so everything on it can be asked again together. */
export const leadKey = (firmId: string | null, leadId: string) => ["lead", firmId, leadId] as const;

/** A list that failed with nothing to show is not asked again by itself ("Try again" is the way out); one that failed over rows keeps asking quietly. */
export const keepsAsking = (query: { state: { status: string; data: unknown } }) => !(query.state.status === "error" && query.state.data === undefined);

/** The lead's page. Not asked until the firm is known. Null data is a lead that isn't there or isn't theirs to see. */
export function useLeadPageQuery(firmId: string | null, leadId: string) {
  return useQuery<LeadPage | null>({
    queryKey: [...leadKey(firmId, leadId), "page"],
    queryFn: () => getLeadPage(firmId as string, leadId),
    enabled: firmId !== null,
    refetchInterval: (q) => (keepsAsking(q) ? ACCOUNT_REFRESH_MS : false),
    refetchOnWindowFocus: (q) => keepsAsking(q),
    refetchOnReconnect: (q) => keepsAsking(q),
    retry: false,
  });
}

/** The lead's calls, notes and tasks, a page of fifty at a time, each from the row after the last one loaded (D-44). `rows` are every row loaded, each once. */
export function useLeadActivityQuery(firmId: string | null, leadId: string, filter: LeadActivityFilter) {
  const query = useInfiniteQuery({
    queryKey: [...leadKey(firmId, leadId), "activity", filter],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listLeadActivity(firmId as string, leadId, { filter, limit: TAB_STEP, offset: pageParam }),
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
  const rows = (pages === undefined || gone ? [] : pages.flatMap((page) => page?.rows ?? []))
    .filter((r) => (seen.has(r.entryKey) ? false : (seen.add(r.entryKey), true)));
  const data = pages === undefined ? undefined : gone ? null : { count: (pages[pages.length - 1] as { count: number }).count, rows };
  return { query, data };
}
