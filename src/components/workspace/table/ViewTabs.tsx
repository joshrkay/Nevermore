import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BookmarkPlus, Users } from "lucide-react";
import type { TableFields } from "@/lib/tableQuery";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { isModifiedView, viewOf, type TableAddress } from "./address";
import type { TableDefinition } from "./columns";
import type { ViewActions } from "./useViewActions";
import { ViewBar } from "./ViewBar";
import { ViewNameForm } from "./ViewNameForm";
import { filterInWords } from "./words";

interface Props<K extends TableFields, Row, Context> {
  table: TableDefinition<K, Row, Context>;
  address: TableAddress<K>;
  /** The address of a tab: its view, and `sort: null` for a view that brings an order of its own. */
  hrefFor: (change: { view: string | null; sort?: null }) => string;
  /** How many rows each view holds, by the view's id ("all" for the tab that is no view), when known. */
  counts: Map<string, number>;
  /** What a person does with saved views from here (CRM-S3.4a). Left out (or null), the tabs only show and open views. */
  manage?: ViewActions<K> | null;
  /** Asks again for what the table shows, for the line that says the saved views couldn't be loaded (the page's own retry: nothing in the address changes). */
  onRetry?: () => void;
}

/** What "Save this as a view" will keep, in one line of plain words, so a person knows what they are naming. */
function keepsInWords<K extends TableFields, Row, Context>(table: TableDefinition<K, Row, Context>, keeps: ViewActions<K>["keeps"]): string {
  const filters = keeps.filters.length === 0 ? "no filters" : keeps.filters.map((f) => filterInWords(table.fields, f)).join("; ");
  const column = keeps.sort ? table.columns.find((c) => c.sortField === keeps.sort!.field) : undefined;
  const sort = keeps.sort ? `sorted by ${column?.header ?? table.fields[keeps.sort.field]?.label ?? keeps.sort.field}, ${keeps.sort.direction === "asc" ? "ascending" : "descending"}` : "in the table's own order";
  return `Keeps ${filters}; ${sort}; ${keeps.columns.length} ${keeps.columns.length === 1 ? "column" : "columns"}. Only you see it until an owner shares it.`;
}

/**
 * The tabs over a table: "All" and each of the definition's views, each with its count and the current one marked. Each is a real
 * link to the address with that view (a new tab and Back work), and changing the view starts at the first page. A saved view the firm shares is marked
 * in words and with an icon. With `manage` (CRM-S3.4a) the tabs also save what is on screen as a view of the person's own, and, for the saved view that
 * is open, change, rename, share and delete it.
 */
export function ViewTabs<K extends TableFields, Row, Context>({ table, address, hrefFor, counts, manage, onRetry }: Props<K, Row, Context>) {
  const root = useRef<HTMLDivElement>(null);
  // The reason "Save this as a view" can't be used is described by an id of its own: a page may hold more than one table.
  const unavailableId = useId();
  const [saving, setSaving] = useState(false);
  const openView = viewOf(table, address.view);
  const tabs = [
    { id: null as string | null, key: "all", label: table.allViewLabel, shared: false, own: false },
    ...table.views.map((v) => ({ id: v.id as string | null, key: v.id, label: v.label, shared: v.saved?.shared ?? false, own: v.sort !== undefined })),
  ];

  // A tab an action asked to have focus (the view just saved): once it is drawn, focus goes to it.
  useEffect(() => {
    const wanted = manage?.focusWanted();
    if (wanted === undefined) return;
    const link = [...(root.current?.querySelectorAll<HTMLElement>("[data-view-tab]") ?? [])].find((el) => el.dataset.viewTab === (wanted ?? "all"));
    if (link) {
      manage?.focusDone();
      // Only while focus is still in the form that asked or nowhere (the button pressed went with the change): a person who has gone on to type in the search box,
      // say, while the database was answering, keeps their focus there.
      const at = document.activeElement;
      if (!at || at === document.body || at.closest("[data-view-controls]")) link.focus();
    }
  });

  return (
    <div ref={root} className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Views" className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const current = address.view === tab.id;
            const count = counts.get(tab.key);
            return (
              <Link
                key={tab.key}
                data-view-tab={tab.id ?? "all"}
                // A view with an order of its own brings it (a sort left in the address would hide it); one without leaves the person's sort alone.
                to={hrefFor({ view: tab.id, ...(tab.own ? { sort: null } : {}) })}
                aria-current={current ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${current ? "border-primary bg-accent font-semibold text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {tab.label}
                {/* A view the firm shares is told apart from one the person saved (a private view may carry a shared one's name): in words, and with a mark. */}
                {tab.shared && (
                  <>
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">(shared with the firm)</span>
                  </>
                )}
                {count !== undefined && <span className="text-xs text-muted-foreground">{count}</span>}
              </Link>
            );
          })}
        </nav>
        {manage && (
          <Popover open={saving} onOpenChange={(open) => { setSaving(open); if (open) manage.arm(); }}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-disabled={manage.unavailable ? true : undefined}
                aria-describedby={manage.unavailable ? unavailableId : undefined}
                onClick={manage.unavailable ? (e) => e.preventDefault() : undefined}
                className={cn("inline-flex min-h-9 items-center gap-1 rounded-md border border-dashed border-border px-3 text-sm text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring", manage.unavailable ? "opacity-50" : "hover:text-foreground")}
              >
                <BookmarkPlus className="h-4 w-4" aria-hidden="true" /> Save this as a view
              </button>
            </PopoverTrigger>
            {manage.unavailable && <span id={unavailableId} className="sr-only">{manage.unavailable}</span>}
            <PopoverContent
              align="start"
              className="w-96"
              aria-label="Save this as a view"
              data-view-controls
            >
              <ViewNameForm
                submitLabel="Save view"
                intro={keepsInWords(table, manage.keeps)}
                onSubmit={async (name) => { await manage.save(name); setSaving(false); }}
                onCancel={() => setSaving(false)}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
      {table.viewsStatus === "failed" && (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          Your saved views couldn't be loaded.{onRetry && <> <button type="button" onClick={onRetry} className="text-primary underline">Try again</button></>}
        </p>
      )}
      {manage && openView?.saved && <ViewBar view={openView} modified={isModifiedView(address)} manage={manage} />}
      {manage?.armed && <p role="status" aria-live="polite" className="sr-only">{manage.said}</p>}
    </div>
  );
}
