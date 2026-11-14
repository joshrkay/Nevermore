import { Link } from "react-router-dom";
import type { TableFields } from "@/lib/tableQuery";
import type { TableAddress } from "./address";
import type { TableDefinition } from "./columns";

interface Props<K extends TableFields, Row, Context> {
  table: TableDefinition<K, Row, Context>;
  address: TableAddress<K>;
  hrefFor: (change: { view: string | null }) => string;
  /** How many rows each view holds, by the view's id ("all" for the tab that is no view), when known. */
  counts: Map<string, number>;
}

/**
 * The tabs over a table: "All" and each of the definition's views, each with its count and the current one marked. Each is a real
 * link to the address with that view (a new tab and Back work), and changing the view starts at the first page. CRM-S3.4a adds saving,
 * renaming and sharing here.
 */
export function ViewTabs<K extends TableFields, Row, Context>({ table, address, hrefFor, counts }: Props<K, Row, Context>) {
  const tabs = [{ id: null as string | null, key: "all", label: table.allViewLabel }, ...table.views.map((v) => ({ id: v.id as string | null, key: v.id, label: v.label }))];
  return (
    <nav aria-label="Views" className="mb-4 flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const current = address.view === tab.id;
        const count = counts.get(tab.key);
        return (
          <Link
            key={tab.key}
            to={hrefFor({ view: tab.id })}
            aria-current={current ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${current ? "border-primary bg-accent font-semibold text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {tab.label}
            {count !== undefined && <span className="text-xs text-muted-foreground">{count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
