import { useQuery } from "@tanstack/react-query";
import { ACCOUNT_REFRESH_MS } from "@/components/accounts/useAccountQueries";
import { getQuotePage, type QuotePage } from "@/lib/quotePageApi";

/** The key every query of one quote's page starts with, so everything on it can be asked again together. */
export const quoteKey = (firmId: string | null, quoteRequestId: string) => ["quote", firmId, quoteRequestId] as const;

/** A read that failed with nothing to show is not asked again by itself ("Try again" is the way out); one that failed over a page keeps asking quietly. */
const keepsAsking = (query: { state: { status: string; data: unknown } }) => !(query.state.status === "error" && query.state.data === undefined);

/** The quote's page. Not asked until the firm is known. Null data is a quote that isn't there or isn't theirs. */
export function useQuotePageQuery(firmId: string | null, quoteRequestId: string) {
  return useQuery<QuotePage | null>({
    queryKey: [...quoteKey(firmId, quoteRequestId), "page"],
    queryFn: () => getQuotePage(firmId as string, quoteRequestId),
    enabled: firmId !== null,
    // No placeholder: the previous quote's answer is never shown under another's address.
    refetchInterval: (q) => (keepsAsking(q) ? ACCOUNT_REFRESH_MS : false),
    refetchOnWindowFocus: (q) => keepsAsking(q),
    refetchOnReconnect: (q) => keepsAsking(q),
    retry: false,
  });
}
