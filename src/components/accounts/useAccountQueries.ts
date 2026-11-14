import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
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

/** How many rows a page of a tab holds. The database allows 100 at most, and the screen asks for fifty (D-44), each page starting after the rows already loaded. */
export const TAB_STEP = 50;

type TabAnswer<T extends AccountListTab | "files"> = TabRows<T extends AccountListTab ? AccountTabRows[T] : AccountFile> | null;

/**
 * One tab's list, a page of fifty at a time: the first page from the first row, and each next page from the row after the last one loaded (never the whole list
 * again with a longer limit, which the database refuses past a hundred rows). Asked only while the tab is open. `rows` is every row loaded so far and `count` how
 * many the tab holds in all; `null` rows say the account is not there or not theirs. A refresh asks the loaded pages again, and the rows stay while it does.
 */
export function useAccountTabQuery<T extends AccountListTab | "files">(firmId: string | null, accountId: string, tab: T) {
  const query = useInfiniteQuery({
    queryKey: [...accountKey(firmId, accountId), "tab", tab],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<TabAnswer<T>> => (tab === "files"
      ? await listAccountFiles(firmId as string, accountId, { limit: TAB_STEP, offset: pageParam })
      : await listAccountTab(firmId as string, accountId, tab as AccountListTab, { limit: TAB_STEP, offset: pageParam })) as TabAnswer<T>,
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
  const data = pages === undefined ? undefined : pages[0] === null ? null : { count: pages[pages.length - 1]!.count, rows: pages.flatMap((page) => page?.rows ?? []) as TabRows<T extends AccountListTab ? AccountTabRows[T] : AccountFile>["rows"] };
  return { query, data };
}
