import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Columns3 } from "lucide-react";
import type { TableFields } from "@/lib/tableQuery";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { movedIds } from "./columnChoice";
import type { TableDefinition } from "./columns";
import type { TableColumns } from "./useTableColumns";

// The Columns menu (story CRM-S3.1a): a button over the table that opens a small panel where a person shows, hides and reorders the table's columns. Generic:
// it knows a table only through its definition and the choice `useTableColumns` keeps. Every change applies at once and is kept; nothing is applied by a button.
//
//   Company ........................ Always shown        the table's name column: never hidden, never moved, pinned to the left
//   [x] Contact ................... [up] [down]          a shown column: clear the box to hide it, the arrows to move it
//   NOT SHOWN
//   [ ] Employees                                        a hidden column: set the box to show it again, at the end
//
// Keyboard and screen reader (D-170's way): every control is a real checkbox or button in the tab order; opening puts focus in the panel, Escape closes it
// and returns focus to the button; after each change focus stays on the control that was used, wherever its row went; and one polite status in the panel
// says what the change did (the buttons keep their names and places, so nothing else would). A control that can't be used is `aria-disabled` with the reason as
// its description, not `disabled` (D-143).

interface Props<K extends TableFields, Row, Context> {
  table: TableDefinition<K, Row, Context>;
  columns: TableColumns<K, Row, Context>;
}

const MOVE_BUTTON = "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

const shownWords = (count: number) => `${count} ${count === 1 ? "column" : "columns"} shown`;

export function ColumnsMenu<K extends TableFields, Row, Context>({ table, columns }: Props<K, Row, Context>) {
  const limitId = useId();
  const defaultId = useId();
  const loadingId = useId();
  // What the last change did, in words, for a screen reader.
  const [said, setSaid] = useState("");
  // The control to put focus on once the change is drawn: a row that moves to the other list is a new element, and one that moves within its list may
  // be moved by the browser, and either would drop focus to the page.
  const content = useRef<HTMLDivElement>(null);
  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    const key = focusNext.current;
    if (key === null) return;
    focusNext.current = null;
    [...(content.current?.querySelectorAll<HTMLElement>("[data-column-control]") ?? [])].find((el) => el.dataset.columnControl === key)?.focus();
  });
  const shown = columns.columns.map((c) => c.id);
  // The table's name column is its first (CRM-S3.1a: `columnsFor` keeps it there), and the one thing here that can't be changed.
  const [name, ...reorderable] = columns.columns;
  const hidden = table.columns.filter((c) => !shown.includes(c.id));
  const move = (id: string, header: string, by: -1 | 1) => {
    const next = movedIds(shown, id, by);
    focusNext.current = `${by < 0 ? "up" : "down"}:${id}`;
    columns.choose(next);
    setSaid(`${header} is now column ${next.indexOf(id) + 1} of ${next.length}.`);
  };
  const hide = (id: string, header: string) => {
    focusNext.current = `check:${id}`;
    columns.choose(shown.filter((s) => s !== id));
    setSaid(`${header} hidden. ${shownWords(shown.length - 1)}.`);
  };
  const show = (id: string, header: string) => {
    focusNext.current = `check:${id}`;
    columns.choose([...shown, id]);
    setSaid(`${header} shown as column ${shown.length + 1} of ${shown.length + 1}.`);
  };
  const back = () => {
    columns.choose(null);
    setSaid(`Default columns restored. ${shownWords(table.columns.length)}.`);
  };
  return (
    <>
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          // Not usable until the choice it would change is known: in the tab order, says why, and the click is ignored (D-143's way).
          aria-disabled={columns.loading || undefined}
          aria-describedby={columns.loading ? loadingId : undefined}
          onClick={columns.loading ? (e) => e.preventDefault() : undefined}
          className={cn("inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-3 text-sm text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring", columns.loading ? "opacity-50" : "hover:text-foreground")}
        >
          <Columns3 className="h-4 w-4" aria-hidden="true" /> Columns
        </button>
      </PopoverTrigger>
      {columns.loading && <span id={loadingId} className="sr-only">Available once your columns have loaded</span>}
      <PopoverContent ref={content} align="end" className="w-80" aria-label="Columns">
        <p className="mb-2 text-sm text-muted-foreground">Choose which columns the table shows, and their order. {name.header} is always shown first.</p>
        <span id={limitId} className="sr-only">It can't move any further.</span>
        <div className="max-h-80 overflow-y-auto pr-1">
          <ul aria-label="Shown columns" className="space-y-1">
            <li className="flex min-h-8 items-center justify-between gap-2 text-sm">
              <span className="font-medium">{name.header}</span>
              <span className="text-xs text-muted-foreground">Always shown</span>
            </li>
            {reorderable.map((column, i) => {
              const first = i === 0;
              const last = i === reorderable.length - 1;
              return (
                <li key={column.id} className="flex items-center gap-2">
                  <label className="flex min-h-8 flex-1 cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" className="accent-primary" data-column-control={`check:${column.id}`} checked onChange={() => hide(column.id, column.header)} />
                    <span>{column.header}</span>
                  </label>
                  <button
                    type="button"
                    data-column-control={`up:${column.id}`}
                    aria-label={`Move ${column.header} up`}
                    aria-disabled={first || undefined}
                    aria-describedby={first ? limitId : undefined}
                    onClick={first ? undefined : () => move(column.id, column.header, -1)}
                    className={cn(MOVE_BUTTON, first && "opacity-50")}
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    data-column-control={`down:${column.id}`}
                    aria-label={`Move ${column.header} down`}
                    aria-disabled={last || undefined}
                    aria-describedby={last ? limitId : undefined}
                    onClick={last ? undefined : () => move(column.id, column.header, 1)}
                    className={cn(MOVE_BUTTON, last && "opacity-50")}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
          {hidden.length > 0 && (
            <>
              <p aria-hidden="true" className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Not shown</p>
              <ul aria-label="Columns not shown" className="space-y-1">
                {hidden.map((column) => (
                  <li key={column.id}>
                    <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-primary" data-column-control={`check:${column.id}`} checked={false} onChange={() => show(column.id, column.header)} />
                      <span>{column.header}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <button
          type="button"
          aria-disabled={columns.isDefault || undefined}
          aria-describedby={columns.isDefault ? defaultId : undefined}
          onClick={columns.isDefault ? undefined : back}
          className={cn("mt-3 text-sm text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring", columns.isDefault && "opacity-50")}
        >
          Back to default columns
        </button>
        <span id={defaultId} className="sr-only">These are the default columns already.</span>
        <p role="status" aria-live="polite" className="sr-only">{said}</p>
      </PopoverContent>
    </Popover>
    {columns.notKept && <p role="alert" className="max-w-xs text-sm text-destructive">{columns.notKept}</p>}
    {columns.loadFailed && (
      <p role="status" className="max-w-xs text-sm text-muted-foreground">
        Your columns couldn't be loaded, so the default columns are shown.{" "}
        <button type="button" onClick={columns.retry} className="text-primary underline">Try again</button>
      </p>
    )}
    </>
  );
}
