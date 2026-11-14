import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { TableFields } from "@/lib/tableQuery";
import { addressToSearch, changeAddress, judgeAddress, type TableAddress } from "./address";
import type { TableDefinition } from "./columns";

type Change<K extends TableFields> = Partial<Omit<TableAddress<K>, "held">>;

/**
 * The table's address (CRM-S3.5a, D-43): what the page's search parameters say, read by the one codec, kept clean (an address
 * that held garbage, old parameters or a short search is rewritten in place, so Back never lands on it), with the way to change
 * it: `hrefFor` for a link (a new tab and Back work), `change` for a control. Any change but the page starts at the first page.
 * Parts the table can't judge yet (saved views or custom fields still loading) are kept as written and not rewritten until it can.
 * `notice` is the one plain line to show when a table whose views or fields failed to load had to drop what the address named.
 */
export function useTableAddress<K extends TableFields, Row, Context>(table: TableDefinition<K, Row, Context>) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Written as the address's own text (not through URLSearchParams) so the colons and commas stay readable in the address bar.
  const goTo = useCallback((search: string, replace: boolean) => navigate({ search: search ? `?${search}` : "" }, { replace }), [navigate]);
  const { address, dropped } = useMemo(() => judgeAddress(table, params), [table, params]);
  const clean = addressToSearch(address);
  // Compared as parameters, so only a real difference (not the colons' spelling) rewrites the address.
  const differs = new URLSearchParams(clean).toString() !== params.toString();
  const [notice, setNotice] = useState<string | null>(null);
  const viewFailed = table.viewsStatus === "failed" && dropped.view !== null;
  const fieldFailed = table.fieldsStatus === "failed" && dropped.filterFields.length > 0;
  useEffect(() => {
    if (!differs) return;
    if (viewFailed || fieldFailed) {
      setNotice(
        [
          viewFailed && `That view isn't available, so this shows every ${table.noun.singular}.`,
          fieldFailed && "A filter on a field that isn't available was left out.",
        ].filter(Boolean).join(" "),
      );
    }
    goTo(clean, true);
  }, [differs, clean, goTo, viewFailed, fieldFailed, table.noun.singular]);

  const hrefFor = useCallback(
    (change: Change<K>) => {
      const search = addressToSearch(changeAddress(address, change));
      return search ? `${pathname}?${search}` : pathname;
    },
    [address, pathname],
  );
  /** Moving between pages is a step Back undoes; everything else replaces the entry unless `push` says it is a place to come back to. */
  const change = useCallback(
    (patch: Change<K>, options: { push?: boolean; replace?: boolean } = {}) => {
      const onlyThePage = Object.keys(patch).every((k) => k === "page");
      if (!onlyThePage) setNotice(null);
      goTo(addressToSearch(changeAddress(address, patch)), options.replace ?? !(onlyThePage || options.push));
    },
    [address, goTo],
  );
  return { address, hrefFor, change, notice };
}
