import { useEffect, useRef } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getAccountRenewals, type AccountRenewals } from "@/lib/renewalsApi";
import { getAccountPage, listAccountFiles, listAccountTab, type AccountFile, type ActivityFilter, type AccountListTab, type AccountPage, type AccountTabRows, type TabRows } from "@/lib/accountPageApi";

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
    // No placeholder: the previous account's answer is never shown under another account's address (its open form and version would go with it).
    refetchInterval: (q) => (keepsAsking(q) ? ACCOUNT_REFRESH_MS : false),
    refetchOnWindowFocus: (q) => keepsAsking(q),
    refetchOnReconnect: (q) => keepsAsking(q),
    retry: false,
  });
}

/** How many rows a page of a tab holds. The database allows 100 at most, and the screen asks for fifty (D-44), each page starting after the rows already loaded. */
export const TAB_STEP = 50;

/** A row's own key: an entry of the history has an `entryKey`, every other row an `id`. */
const keyOf = (row: unknown) => String((row as { entryKey?: string; id?: string | number }).entryKey ?? (row as { id: string | number }).id);

/** The rows once each, the first time they appear: rows that shifted between two pages' reads are not shown twice. */
const distinct = <R,>(rows: R[]): R[] => {
  const seen = new Set<string>();
  return rows.filter((row) => (seen.has(keyOf(row)) ? false : (seen.add(keyOf(row)), true)));
};

type TabAnswer<T extends AccountListTab | "files"> = TabRows<T extends AccountListTab ? AccountTabRows[T] : AccountFile> | null;

/**
 * One tab's list, a page of fifty at a time: the first page from the first row, and each next page from the row after the last one loaded (never the whole list
 * again with a longer limit, which the database refuses past a hundred rows). Asked only while the tab is open. `rows` is every row loaded so far and `count` how
 * many the tab holds in all; `null` rows say the account is not there or not theirs. A refresh asks the loaded pages again, and the rows stay while it does.
 */
export function useAccountTabQuery<T extends AccountListTab | "files">(firmId: string | null, accountId: string, tab: T, filter: ActivityFilter = "all") {
  const query = useInfiniteQuery({
    queryKey: [...accountKey(firmId, accountId), "tab", tab, filter],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<TabAnswer<T>> => (tab === "files"
      ? await listAccountFiles(firmId as string, accountId, { limit: TAB_STEP, offset: pageParam })
      : await listAccountTab(firmId as string, accountId, tab as AccountListTab, { limit: TAB_STEP, offset: pageParam, ...(tab === "activity" ? { filter } : {}) })) as TabAnswer<T>,
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
  // Any page that comes back null says the account is gone, or not theirs any more, since the first page was read: the whole answer is null.
  const gone = pages !== undefined && pages.some((page) => page === null);
  const raw = pages === undefined || gone ? [] : pages.flatMap((page) => page?.rows ?? []);
  const rows = distinct(raw);
  const dropped = raw.length - rows.length;
  const data = pages === undefined ? undefined : gone ? null : { count: (pages[pages.length - 1] as { count: number }).count, rows: rows as TabRows<T extends AccountListTab ? AccountTabRows[T] : AccountFile>["rows"] };

  // A row repeated between two pages means the list shifted between the reads, so the pages may add up to the count while one row was never read. The loaded
  // pages are asked again once, in one go (the rows stay on screen meanwhile), so they come from one ordering. If the list is still moving after that, the
  // rows are shown once each as they are and nothing asks again until a read comes back clean.
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

/** The account's renewals (the Renewals tab, its count, and the Overview's first five): asked again with everything else of the account. Null data: not there or not theirs. */
export function useAccountRenewalsQuery(firmId: string | null, accountId: string) {
  return useQuery<AccountRenewals | null>({
    queryKey: [...accountKey(firmId, accountId), "renewals"],
    queryFn: () => getAccountRenewals(firmId as string, accountId),
    enabled: firmId !== null,
    refetchInterval: (q) => (keepsAsking(q) ? ACCOUNT_REFRESH_MS : false),
    refetchOnWindowFocus: (q) => keepsAsking(q),
    refetchOnReconnect: (q) => keepsAsking(q),
    retry: false,
  });
}
