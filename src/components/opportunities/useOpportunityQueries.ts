import { useEffect, useRef } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ACCOUNT_REFRESH_MS, TAB_STEP } from "@/components/accounts/useAccountQueries";
import { getOpportunityOutcome, getOpportunityPage, listOpportunityActivity, type OpportunityActivityFilter, type OpportunityOutcome, type OpportunityPage } from "@/lib/opportunityPageApi";

/** The key every query of one opportunity's page starts with, so everything on it can be asked again together. */
export const opportunityKey = (firmId: string | null, opportunityId: string) => ["opportunity", firmId, opportunityId] as const;

/** A list that failed with nothing to show is not asked again by itself ("Try again" is the way out); one that failed over rows keeps asking quietly. */
const keepsAsking = (query: { state: { status: string; data: unknown } }) => !(query.state.status === "error" && query.state.data === undefined);

/** The opportunity's page. Not asked until the firm is known. Null data is an opportunity that isn't there or isn't theirs. */
export function useOpportunityPageQuery(firmId: string | null, opportunityId: string) {
  return useQuery<OpportunityPage | null>({
    queryKey: [...opportunityKey(firmId, opportunityId), "page"],
    queryFn: () => getOpportunityPage(firmId as string, opportunityId),
    enabled: firmId !== null,
    // No placeholder: the previous opportunity's answer is never shown under another's address (its open form and version would go with it).
    refetchInterval: (q) => (keepsAsking(q) ? ACCOUNT_REFRESH_MS : false),
    refetchOnWindowFocus: (q) => keepsAsking(q),
    refetchOnReconnect: (q) => keepsAsking(q),
    retry: false,
  });
}

/** The opportunity's activity, a page of fifty at a time, each from the row after the last one loaded (D-44). `rows` are every row loaded, each once. */
export function useOpportunityActivityQuery(firmId: string | null, opportunityId: string, filter: OpportunityActivityFilter) {
  const query = useInfiniteQuery({
    queryKey: [...opportunityKey(firmId, opportunityId), "activity", filter],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listOpportunityActivity(firmId as string, opportunityId, { filter, limit: TAB_STEP, offset: pageParam }),
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
  const raw = pages === undefined || gone ? [] : pages.flatMap((page) => page?.rows ?? []);
  const rows = raw.filter((r) => (seen.has(r.entryKey) ? false : (seen.add(r.entryKey), true)));
  const dropped = raw.length - rows.length;
  const data = pages === undefined ? undefined : gone ? null : { count: (pages[pages.length - 1] as { count: number }).count, rows };

  // A row repeated between two pages means the list shifted between the reads, so the pages may add up to the count while an older row was never read. The loaded
  // pages are asked again once, in one go (the rows stay on screen meanwhile); if the list is still moving after that, the rows are shown once each as they are
  // and nothing asks again until a read comes back clean (as the account's tabs and the contact's activity do).
  const asked = useRef(false);
  useEffect(() => {
    if (dropped === 0) asked.current = false;
    else if (!asked.current && !query.isFetching) {
      asked.current = true;
      void query.refetch();
    }
  }, [dropped, query]);
  return { query, data };
}

/** How the opportunity ended and what its win made: the lost reason, the placement with its payments, and each quote's close reason (CRM-O1.3b). */
export function useOpportunityOutcomeQuery(firmId: string | null, opportunityId: string, submissionId: string | null | undefined) {
  return useQuery<OpportunityOutcome>({
    queryKey: [...opportunityKey(firmId, opportunityId), "outcome", submissionId],
    queryFn: () => getOpportunityOutcome(firmId as string, opportunityId, submissionId ?? null),
    // Asked once the page has said which intake it holds (undefined until then), so it is not asked twice.
    enabled: firmId !== null && submissionId !== undefined,
    refetchInterval: (q) => (keepsAsking(q) ? ACCOUNT_REFRESH_MS : false),
    retry: false,
  });
}
