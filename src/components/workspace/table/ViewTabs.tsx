import { useRef } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import type { TableFields } from "@/lib/tableQuery";
import { sameAddress, viewOf, type TableAddress } from "./address";
import type { TableDefinition, TableView } from "./columns";
import { KeepChanges } from "./KeepChanges";
import { SaveViewButton } from "./SaveViewButton";
import { ViewMenu } from "./ViewMenu";
import type { SavedViewsControl } from "./useSavedViews";

interface Props<K extends TableFields, Row, Context> {
  table: TableDefinition<K, Row, Context>;
  address: TableAddress<K>;
  hrefFor: (change: { view: string | null; sort?: null }) => string;
  /** How many rows each view holds, by the view's id ("all" for the tab that is no view), when known. */
  counts: Map<string, number>;
  /** Saving, renaming and sharing (CRM-S3.4a). Left out, the tabs are links and nothing more. */
  saved?: SavedViewsControl;
}

/**
 * The tabs over a table: "All" and each of the definition's views (the built-in ones, then the saved ones), each with its count and the current one
 * marked. Each is a real link to the address with that view (a new tab and Back work), and changing the view starts at the first page. A view with an
 * order of its own opens in it, so a sort a person clicked on another tab is not carried over it. With `saved` (CRM-S3.4a) the bar also saves the
 * screen as a new view, gives each saved view its options (`ViewMenu`), says when the open saved view has been changed on screen and, for the person
 * who may change it, keeps the change.
 */
export function ViewTabs<K extends TableFields, Row, Context>({ table, address, hrefFor, counts, saved }: Props<K, Row, Context>) {
  const tabs = [
    { id: null as string | null, key: "all", label: table.allViewLabel, view: undefined as TableView<K> | undefined },
    ...table.views.map((v) => ({ id: v.id as string | null, key: v.id, label: v.label, view: v as TableView<K> | undefined })),
  ];
  const open = viewOf(table, address.view);
  // A deleted view's tab takes the focus it had with it: the first tab is where a keyboard person lands, once the dialog has given focus back.
  const nav = useRef<HTMLElement>(null);
  const remove = saved
    ? async (viewId: string) => {
        await saved.remove(viewId);
        setTimeout(() => nav.current?.querySelector("a")?.focus(), 0);
      }
    : undefined;
  // Changed on screen: the address holds more than the view does (chips over it, a sort of its own), not counting the search or the page.
  const changedOnScreen =
    !!open?.saved &&
    !sameAddress(table, { ...address, search: "", page: 1 }, { ...address, search: "", page: 1, filters: [], sort: null, held: { ...address.held, filters: [], sort: null } });
  return (
    <>
    <nav ref={nav} aria-label="Views" className="mb-4 flex flex-wrap items-center gap-2">
      {tabs.map((tab) => {
        const current = address.view === tab.id;
        const count = counts.get(tab.key);
        const link = (
          <Link
            key={tab.key}
            data-view={tab.key}
            to={hrefFor({ view: tab.id, ...(tab.view?.sort ? { sort: null } : {}) })}
            aria-current={current ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${current ? "border-primary bg-accent font-semibold text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {tab.label}
            {tab.view?.saved?.shared && <><Users className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">Shared with the firm</span></>}
            {count !== undefined && <span className="text-xs text-muted-foreground">{count}</span>}
          </Link>
        );
        const saveable = saved && tab.view?.saved;
        return saveable ? (
          <span key={tab.key} className="inline-flex items-center gap-1">
            {link}
            <ViewMenu view={tab.view as never} control={{ ...saved, remove: remove! }} />
          </span>
        ) : link;
      })}
      {(table.unavailableViews ?? []).map((v) => (
        <span key={v.id} className="inline-flex items-center gap-1">
          <span
            aria-disabled="true"
            aria-describedby={`${v.id}-reason`}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground"
          >
            {v.label}
            {v.saved.shared && <><Users className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">Shared with the firm</span></>}
          </span>
          <span id={`${v.id}-reason`} className="text-xs text-muted-foreground">{v.reason}</span>
          {saved && <ViewMenu view={v} control={{ ...saved, remove: remove! }} />}
        </span>
      ))}
      {saved && <SaveViewButton onSave={saved.save} blocked={saved.saveBlocked} />}
      {saved?.failed && (
        <p className="text-sm text-muted-foreground">
          Your saved views couldn't be loaded. <button type="button" onClick={saved.retry} className="text-primary underline">Try again</button>
        </p>
      )}
    </nav>
    {saved && open?.saved && changedOnScreen && (
      <KeepChanges
        view={open}
        blocked={saved.keepBlocked}
        onKeep={async () => {
          await saved.update(open.id);
          // The line (and the button that had focus) goes with the change; the open view's tab is where a keyboard person lands, unless they have gone
          // elsewhere meanwhile (another view, or a control they moved focus to): focus is theirs then.
          setTimeout(() => {
            const here = document.activeElement;
            if (here && here !== document.body && !(here instanceof HTMLElement && here.dataset.keepChanges !== undefined)) return;
            nav.current?.querySelector<HTMLElement>(`a[data-view="${open.id}"][aria-current="page"]`)?.focus();
          }, 0);
        }}
      />
    )}
    </>
  );
}
