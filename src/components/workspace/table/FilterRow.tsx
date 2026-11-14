import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Plus, X } from "lucide-react";
import type { TableFields, TableFilter } from "@/lib/tableQuery";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { viewFilters, writeFilter } from "./address";
import { TABLE_FILTER_LIMIT, type FieldDefinition, type TableDefinition } from "./columns";
import { FilterEditor } from "./FilterEditor";
import { has } from "./has";
import type { useTableAddress } from "./useTableAddress";
import { filterInWords, type NamePeople } from "./words";

// The filter row (story CRM-S3.3a): the row above the table where a person narrows it. Generic: it knows a table only through its definition.
//
//   [Needs advisor action] [Waiting on a PEO] ... [Add filter]   [Status is Won (x)] [Employees is more than 50 (x)]   Clear filters
//
// What it holds, and the rules it keeps (each is a D-row in docs/BROKER_CRM_BUILD.md):
//  - The table's LISTED filters are buttons always in the row, ready to set. "Add filter" offers every other field. A field carries one filter in
//    the row: once it has a chip, its button (or place in "Add filter") is gone and the chip is its control (click it to change it). An address
//    that carries two on one field (written by hand) still shows two chips, each changeable and removable.
//  - A chip per filter the ADDRESS holds, worded by `filterInWords`. A filter that belongs to the current tab is not in the address, so it is not
//    a chip: the tab is its control. A filter held for a field that has not loaded yet is a quiet chip with its text as written, removable.
//  - Applying, removing and clearing write the address through `change` and PUSH a history entry, as "Clear filters" does: each is a question a person
//    may want Back to undo (only the search's keystrokes replace). They start at page 1 (the writer does that).
//  - Nothing is announced by the row itself. The range line and the empty state already say, once, what the new filters left; and focus goes to
//    the chip that was made or changed, which a screen reader reads in the same words.
//  - Focus: opening an editor puts it in the editor's first control; Escape or a click away closes it and focus goes back to what opened it; applying
//    puts focus on the chip made or changed; removing puts it on the next chip, else the one before, else "Add filter"; "Clear filters" puts it on "Add filter".

/** The most filters a table takes, said when "Add filter" is not available for it. */
const LIMIT_REASON = `A table takes up to ${TABLE_FILTER_LIMIT} filters.`;
const LOADING_REASON = "More filters are available once the table's fields have loaded.";

const BUTTON = "inline-flex min-h-9 items-center gap-1 rounded-md border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

interface Props<K extends TableFields, Row, Context> {
  table: TableDefinition<K, Row, Context>;
  location: ReturnType<typeof useTableAddress<K, Row, Context>>;
  /** The words for the people of a person field (CRM-A1.1); an id is never shown. */
  names?: NamePeople;
  /** Given the "Add filter" button, so the page's own "Clear filters" (in the empty state) can send focus to the same place the row's does (D-170). */
  addFilterRef?: RefObject<HTMLButtonElement>;
}

/** What opened an editor: a chip (by its filter's text), a listed field's button, or the "Add filter" popover. */
type Open = { kind: "chip"; key: string } | { kind: "listed"; field: string } | { kind: "add" } | null;

/** One filter's text as the address writes it: its key, and how two are told apart. */
const keyOf = <K extends TableFields>(filter: TableFilter<K>): string => writeFilter(filter as { field: string; op: string });

export function FilterRow<K extends TableFields, Row, Context>({ table, location, names, addFilterRef }: Props<K, Row, Context>) {
  const { address, change } = location;
  const [open, setOpen] = useState<Open>(null);
  // For "Add filter": the field chosen from its list, which turns the same popover into that field's editor.
  const [adding, setAdding] = useState<string | null>(null);
  const [pickSearch, setPickSearch] = useState("");
  // The chip (or "add") that takes focus once the address has changed. A ref read by an effect, so it is used exactly once.
  const focusNext = useRef<string | null>(null);
  const row = useRef<HTMLDivElement>(null);
  const reasonId = useId();
  // The last control in the row that had focus, so a chip that goes away under it (Back) can hand focus to "Add filter" instead of the page.
  const lastFocus = useRef<HTMLElement | null>(null);
  const addButton = useRef<HTMLButtonElement | null>(null);

  const fields = table.fields as Record<string, FieldDefinition>;
  const loading = table.fieldsStatus === "loading";
  const held = address.held.filters;
  const inRow = address.filters.length + held.length;
  const atLimit = viewFilters(table, address.view).length + inRow >= TABLE_FILTER_LIMIT;
  const filteredFields = new Set(address.filters.map((f) => (f as { field: string }).field));
  const listed = table.listedFilters.filter((id) => has(fields, id) && !filteredFields.has(id));
  const offered = (Object.keys(fields) as string[])
    .filter((id) => !table.listedFilters.includes(id as never) && !filteredFields.has(id))
    .sort((a, b) => fields[a].label.localeCompare(fields[b].label));
  const unavailable = loading ? LOADING_REASON : atLimit ? LIMIT_REASON : null;

  // The address changed: put focus where the last action said, once the chips it names are on screen.
  useEffect(() => {
    const key = focusNext.current;
    if (key === null) {
      // No action here said where focus goes. If the control that had it is gone (Back took its chip away), "Add filter" takes it, not the page (D-170).
      const gone = lastFocus.current;
      if (gone && !gone.isConnected && (document.activeElement === document.body || document.activeElement === null)) {
        lastFocus.current = null;
        addButton.current?.focus();
      }
      return;
    }
    const target = [...(row.current?.querySelectorAll<HTMLElement>("[data-filter-key]") ?? [])].find((el) => el.dataset.filterKey === key);
    if (target) {
      focusNext.current = null;
      target.focus();
    }
  }, [address.filters, address.held.filters]);

  const write = (filters: TableFilter<K>[], heldFilters: string[], focusKey: string) => {
    focusNext.current = focusKey;
    change({ filters, heldFilters }, { push: true });
  };
  const closeAll = () => { setOpen(null); setAdding(null); setPickSearch(""); };
  const apply = (filter: TableFilter<K>, replacing?: TableFilter<K>) => {
    const next = replacing ? address.filters.map((f) => (f === replacing ? filter : f)) : [...address.filters, filter];
    closeAll();
    // Applying what is already there changes nothing: no second history entry, and focus goes back to what opened the editor (the popover does it).
    const texts = (list: TableFilter<K>[]) => [...new Set(list.map(keyOf))].sort().join("\n");
    if (texts(next) === texts(address.filters)) return;
    write(next, held, keyOf(filter));
  };
  const remove = (filter: TableFilter<K>) => {
    const index = address.filters.indexOf(filter);
    const rest = address.filters.filter((f) => f !== filter);
    // Next chip, else the one before, else "Add filter".
    const neighbour = rest[index] ?? rest[rest.length - 1];
    write(rest, held, neighbour ? keyOf(neighbour) : held[0] ? `held:${held[0]}` : "add");
  };
  const removeHeld = (text: string) => {
    const rest = held.filter((h) => h !== text);
    write(address.filters, rest, address.filters[0] ? keyOf(address.filters[0]) : rest[0] ? `held:${rest[0]}` : "add");
  };
  const clear = () => write([], [], "add");

  const describedBy = unavailable ? reasonId : undefined;
  // Closing an editor returns focus to what opened it, unless an apply or a removal has said where focus goes.
  const keepFocusWhereSaid = (e: Event) => { if (focusNext.current !== null) e.preventDefault(); };

  return (
    <div
      ref={row}
      role="group"
      aria-label="Filters"
      className="mb-4 flex flex-wrap items-center gap-2"
      // Only the row's own controls count (an editor's fields are drawn elsewhere in the page but their events reach here).
      onFocusCapture={(e) => { if (row.current?.contains(e.target as Node)) lastFocus.current = e.target as HTMLElement; }}
      // Focus that moves to another control forgets the old one; focus that leaves with nowhere to go (the element was removed) keeps it.
      onBlurCapture={(e) => { if (e.relatedTarget) lastFocus.current = null; }}
    >
      {listed.map((id) => (
        <Popover
          key={id}
          open={open?.kind === "listed" && open.field === id}
          onOpenChange={(o) => { if (!o) closeAll(); else if (!unavailable) setOpen({ kind: "listed", field: id }); }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              data-filter-key={`listed:${id}`}
              // Named "Filter by Submitted", not "Submitted", so it is never the same name as the column header's sort button.
              aria-label={`Filter by ${fields[id].label}`}
              aria-disabled={unavailable ? true : undefined}
              aria-describedby={describedBy}
              onClick={unavailable ? (e) => e.preventDefault() : undefined}
              className={cn(BUTTON, "border-dashed border-border text-muted-foreground", unavailable ? "opacity-50" : "hover:text-foreground")}
            >
              {fields[id].label}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80" aria-label={`Filter on ${fields[id].label}`} onCloseAutoFocus={keepFocusWhereSaid}>
            <FilterEditor<K> fieldId={id} field={fields[id]} onApply={(f) => apply(f)} onCancel={closeAll} />
          </PopoverContent>
        </Popover>
      ))}

      <Popover
        open={open?.kind === "add"}
        onOpenChange={(o) => { if (!o) closeAll(); else if (!unavailable) setOpen({ kind: "add" }); }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            data-filter-key="add"
            ref={(el) => { addButton.current = el; if (addFilterRef) (addFilterRef as { current: HTMLButtonElement | null }).current = el; }}
            aria-disabled={unavailable ? true : undefined}
            aria-describedby={describedBy}
            onClick={unavailable ? (e) => e.preventDefault() : undefined}
            className={cn(BUTTON, "border-border text-foreground", unavailable ? "opacity-50" : "hover:bg-accent")}
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add filter
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80" aria-label={adding ? `Filter on ${fields[adding].label}` : "Add filter"} onCloseAutoFocus={keepFocusWhereSaid}>
          {adding ? (
            <FilterEditor<K> fieldId={adding} field={fields[adding]} onApply={(f) => apply(f)} onCancel={closeAll} />
          ) : (
            <div className="space-y-2">
              <input
                type="search"
                aria-label="Search fields"
                placeholder="Search fields"
                value={pickSearch}
                onChange={(e) => setPickSearch(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
              <ul aria-label="Fields to filter by" className="max-h-64 overflow-y-auto">
                {offered.filter((id) => fields[id].label.toLowerCase().includes(pickSearch.trim().toLowerCase())).map((id) => (
                  <li key={id}>
                    <button type="button" onClick={() => setAdding(id)} className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">
                      {fields[id].label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {unavailable && <span id={reasonId} className="text-xs text-muted-foreground">{unavailable}</span>}

      {address.filters.length > 0 && (
        <ul aria-label="Filters in force" className="contents">
          {address.filters.map((filter) => {
            const key = keyOf(filter);
            const words = filterInWords(table.fields, filter, names);
            const field = fields[(filter as { field: string }).field];
            return (
              <li key={key} className="inline-flex items-center rounded-md border border-border bg-accent text-sm">
                <Popover open={open?.kind === "chip" && open.key === key} onOpenChange={(o) => (o ? setOpen({ kind: "chip", key }) : closeAll())}>
                  <PopoverTrigger asChild>
                    <button type="button" data-filter-key={key} className="min-h-9 rounded-l-md px-3 hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{words}</button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-80" aria-label={`Change filter: ${words}`} onCloseAutoFocus={keepFocusWhereSaid}>
                    <FilterEditor<K> fieldId={(filter as { field: string }).field} field={field} initial={filter} onApply={(f) => apply(f, filter)} onCancel={closeAll} />
                  </PopoverContent>
                </Popover>
                <button type="button" aria-label={`Remove filter: ${words}`} onClick={() => remove(filter)} className="flex min-h-9 items-center rounded-r-md px-2 text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {held.length > 0 && (
        <ul aria-label="Filters waiting for their fields" className="contents">
          {held.map((text) => (
            <li key={text} className="inline-flex items-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
              <span data-filter-key={`held:${text}`} tabIndex={-1} className="px-3">{text}</span>
              <button type="button" aria-label={`Remove filter: ${text}`} onClick={() => removeHeld(text)} className="flex min-h-9 items-center rounded-r-md px-2 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {inRow > 0 && (
        <button type="button" onClick={clear} className="text-sm text-primary underline hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Clear filters</button>
      )}
    </div>
  );
}
