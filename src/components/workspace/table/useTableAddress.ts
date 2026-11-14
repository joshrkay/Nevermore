import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { TableFields } from "@/lib/tableQuery";
import { addressToSearch, changeAddress, readAddress, type TableAddress } from "./address";
import type { TableDefinition } from "./columns";

/**
 * The table's address (CRM-S3.5a, D-43): what the page's search parameters say, read by the one codec, kept clean (an address
 * that held garbage, old parameters or a short search is rewritten in place, so Back never lands on it), with the way to change
 * it: `hrefFor` for a link (a new tab and Back work), `change` for a control. Any change but the page starts at the first page.
 */
export function useTableAddress<K extends TableFields, Row>(table: TableDefinition<K, Row>) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // Written as the address's own text (not through URLSearchParams) so the colons and commas stay readable in the address bar.
  const goTo = useCallback((search: string, replace: boolean) => navigate({ search: search ? `?${search}` : "" }, { replace }), [navigate]);
  const { pathname } = useLocation();
  const address = useMemo(() => readAddress(table, params), [table, params]);
  const clean = addressToSearch(address);
  // Compared as parameters, so only a real difference (not the colons' spelling) rewrites the address.
  const differs = new URLSearchParams(clean).toString() !== params.toString();
  useEffect(() => {
    if (differs) goTo(clean, true);
  }, [differs, clean, goTo]);

  const hrefFor = useCallback(
    (change: Partial<TableAddress<K>>) => {
      const search = addressToSearch(changeAddress(address, change));
      return search ? `${pathname}?${search}` : pathname;
    },
    [address, pathname],
  );
  /** Moving between pages is a step Back undoes; everything else replaces the entry unless `push` says it is a place to come back to. */
  const change = useCallback(
    (patch: Partial<TableAddress<K>>, options: { push?: boolean; replace?: boolean } = {}) => {
      const onlyThePage = Object.keys(patch).every((k) => k === "page");
      goTo(addressToSearch(changeAddress(address, patch)), options.replace ?? !(onlyThePage || options.push));
    },
    [address, goTo],
  );
  return { address, hrefFor, change };
}
