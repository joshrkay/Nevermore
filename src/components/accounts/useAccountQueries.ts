import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getAccountPage, listAccountFiles, listAccountTab, type AccountFile, type AccountListTab, type AccountPage, type AccountTabRows, type TabRows } from "@/lib/accountPageApi";

/** An account's page and its lists are asked again this often, and when the window gets focus (D-49). */
export const ACCOUNT_REFRESH_MS = 60_000;

/** The key every query of one account starts with, so everything on its page can be asked again together. */
export const accountKey = (firmId: string | null, accountId: string) => ["account", firmId, accountId] as const;

/** A list that failed with nothing to show is not asked again by itself ("Try again" is the way out); one that failed over rows keeps asking quietly. */
const keepsAsking = (query: { state: { status: string; data: unknown } }) => !(query.state.status === "error" && query.state.data === undefined);

/** The account's page: its details and each tab's count and first five rows. Not asked until the firm is known. Null data is an account that isn't there or isn't theirs. */
export function useAccountPageQuery(firmId: string | null, accountId: string) {
  return useQuery<AccountPage | null>({
    queryKey: [...accountKey(firmId, accountId), "page"],
    queryFn: () => getAccountPage(firmId as string, accountId),
    enabled: firmId !== null,
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (keepsAsking(q) ? ACCOUNT_REFRESH_MS : false),
    refetchOnWindowFocus: (q) => keepsAsking(q),
    refetchOnReconnect: (q) => keepsAsking(q),
    retry: false,
  });
}

/** How many rows a tab asks for at first, and how many more "Show more" adds. */
export const TAB_STEP = 50;

type TabAnswer<T extends AccountListTab | "files"> = TabRows<T extends AccountListTab ? AccountTabRows[T] : AccountFile> | null;

/**
 * One tab's rows, the first `limit` of them (the tab's own list, so what "see all" opens is the whole list and not the page's first five). Asked only while
 * the tab is open. The rows on screen stay while a longer list or a refresh loads.
 */
export function useAccountTabQuery<T extends AccountListTab | "files">(firmId: string | null, accountId: string, tab: T, limit: number) {
  return useQuery<TabAnswer<T>>({
    queryKey: [...accountKey(firmId, accountId), "tab", tab, limit],
    queryFn: async () => (tab === "files"
      ? await listAccountFiles(firmId as string, accountId, { limit })
      : await listAccountTab(firmId as string, accountId, tab as AccountListTab, { limit })) as TabAnswer<T>,
    enabled: firmId !== null,
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (keepsAsking(q) ? ACCOUNT_REFRESH_MS : false),
    refetchOnWindowFocus: (q) => keepsAsking(q),
    refetchOnReconnect: (q) => keepsAsking(q),
    retry: false,
  });
}
