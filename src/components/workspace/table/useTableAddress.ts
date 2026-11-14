import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { TableFields } from "@/lib/tableQuery";
import { addressToSearch, changeAddress, judgeAddress, type AddressChange, type TableAddress } from "./address";
import type { TableDefinition } from "./columns";

type Change<K extends TableFields> = AddressChange<K>;

/**
 * The table's address (CRM-S3.5a, D-43): what the page's search parameters say, read by the one codec, kept clean (an address
 * that held garbage, old parameters or a short search is rewritten in place, so Back never lands on it), with the way to change
 * it: `hrefFor` for a link (a new tab and Back work), `change` for a control. Any change but the page starts at the first page.
 * Parts the table can't judge yet (saved views or custom fields still loading) are kept as written and not rewritten until it can.
 * `notice` is the one plain line to show when the address named a view or a field the table doesn't have and it was dropped.
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
  // The one plain line to say when the address named a view or a field the table doesn't have (a shared link to a deleted saved view, a
  // filter on a custom field that was removed, a table whose views failed to load). It belongs to the address it was said for, so it is gone
  // as soon as the address changes.
  const [said, setSaid] = useState<{ text: string; for: string } | null>(null);
  const viewDropped = dropped.view !== null;
  const fieldDropped = dropped.filterFields.length > 0;
  useEffect(() => {
    if (!differs) return;
    if (viewDropped || fieldDropped) {
      setSaid({
        text: [
          viewDropped && `That view isn't available, so this shows ${table.allViewLabel.toLowerCase()}.`,
          fieldDropped && "A filter on a field that isn't available was left out.",
        ].filter(Boolean).join(" "),
        for: clean,
      });
    }
    goTo(clean, true);
  }, [differs, clean, goTo, viewDropped, fieldDropped, table.allViewLabel]);
  const notice = said && said.for === clean ? said.text : null;

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
      goTo(addressToSearch(changeAddress(address, patch)), options.replace ?? !(onlyThePage || options.push));
    },
    [address, goTo],
  );
  /** The table's bare address: no page, sort, filters, view or search. The way back from anything the database refuses. */
  const bareHref = pathname;
  return { address, hrefFor, bareHref, change, notice };
}
