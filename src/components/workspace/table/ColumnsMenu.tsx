import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Columns3 } from "lucide-react";
import type { TableFields } from "@/lib/tableQuery";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { columnIdsShown, hideColumn, moveColumn, showColumn, shownColumns } from "./columnChoice";
import type { TableDefinition } from "./columns";
import type { MyColumns } from "./useMyColumns";

// The Columns control (story CRM-S3.1a): "Columns" opens one list of the table's columns. A box shows or hides each, a pair of buttons moves a
// shown one earlier or later (a keyboard has no drag), and "Show the usual columns" forgets the person's choice. Every change is kept at once, with no
// Apply, because the table behind it changes at once. The name column is always shown and always first.
//   Nothing can be changed until the person's kept choice has arrived (a change over the usual columns would be kept over their real choice); after a
//   failed load the usual columns show, read-only, with "Try again".
//   Left for later stories: a saved view's own columns (CRM-S3.4a gives `useMyColumns` the view); the firm's custom fields (CRM-X3.1 lists them in the
//   table's `columns` once loaded, and this list offers them with no change).

const LOADING_REASON = "More columns are available once the table's fields have loaded.";
const NO_FIRM_REASON = "Available once your firm's details have loaded.";
const LOADING_CHOICE_REASON = "Available once your columns have loaded.";
const LOAD_FAILED_REASON = "Couldn't load your columns, so this shows the usual ones.";
const NAME_NOTE = "Always shown";

const BUTTON = "inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-3 text-sm hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const MOVE = "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

interface Props<K extends TableFields, Row, Context> {
  table: TableDefinition<K, Row, Context>;
  /** The person's kept choice (`useMyColumns`), which the page also reads to draw the table. */
  mine: MyColumns;
}

export function ColumnsMenu<K extends TableFields, Row, Context>({ table, mine }: Props<K, Row, Context>) {
  const reasonId = useId();
  const [said, setSaid] = useState("");
  // The move button that was pressed: its row moves, and focus goes back to the same button once it is in its new place.
  const refocus = useRef<string | null>(null);
  const list = useRef<HTMLUListElement>(null);

  const all = table.columns;
  const shown = columnIdsShown(shownColumns(table, mine.kept));
  const hidden = all.filter((c) => !shown.includes(c.id));
  const byId = new Map(all.map((c) => [c.id, c]));
  // Why nothing can be changed yet, in words; the controls stay in the tab order and ignore the click (a disabled one would drop focus).
  const reason =
    table.fieldsStatus === "loading" ? LOADING_REASON
    : mine.status === "no_firm" ? NO_FIRM_REASON
    : mine.status === "loading" ? LOADING_CHOICE_REASON
    : mine.status === "failed" ? LOAD_FAILED_REASON
    : null;

  const order = shown.join("\n");
  useEffect(() => {
    const target = refocus.current;
    if (target === null) return;
    refocus.current = null;
    list.current?.querySelector<HTMLElement>(`[data-move="${target}"]`)?.focus();
  }, [order]);

  const keep = (next: string[]) => void mine.save(next);
  const toggle = (id: string, on: boolean) => {
    if (reason) return;
    keep(on ? showColumn(table, shown, id) : hideColumn(table, shown, id));
  };
  const move = (id: string, by: -1 | 1) => {
    if (reason) return;
    const next = moveColumn(table, shown, id, by);
    if (next.join("\n") === order) return;
    refocus.current = `${id}:${by}`;
    // The place it moved to, so the same move twice is not the same words (a live region says nothing for words that did not change).
    setSaid(`${byId.get(id)?.header ?? id} moved to ${next.indexOf(id) + 1} of ${next.length}.`);
    keep(next);
  };
  const forget = () => {
    if (reason || mine.kept === null) return;
    setSaid("");
    void mine.save(null);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={BUTTON}>
          <Columns3 className="h-4 w-4" aria-hidden="true" />
          Columns
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80" aria-label="Columns">
        <p className="mb-2 text-sm text-muted-foreground">Choose the columns this table shows you. Your choice is kept for you on any device.</p>
        {reason && (
          <p id={reasonId} className="mb-2 text-sm text-muted-foreground">
            {reason}
            {mine.status === "failed" && <> <button type="button" onClick={mine.retryLoad} className="text-primary underline">Try again</button></>}
          </p>
        )}
        {mine.saveError && <p role="alert" className="mb-2 text-sm text-destructive">{mine.saveError}</p>}
        <ul ref={list} className="space-y-1">
          {[...shown.map((id) => byId.get(id)!), ...hidden].filter(Boolean).map((column) => {
            const on = shown.includes(column.id);
            const isName = !!column.isName;
            const position = shown.indexOf(column.id);
            const noteId = `${reasonId}-${column.id}`;
            const firstMovable = position <= (shown[0] !== undefined && byId.get(shown[0])?.isName ? 1 : 0);
            return (
              <li key={column.id} className="flex items-center gap-2">
                <input
                  id={noteId + "-box"}
                  type="checkbox"
                  checked={on}
                  aria-disabled={isName || reason ? true : undefined}
                  aria-describedby={isName ? noteId : reason ? reasonId : undefined}
                  onChange={(e) => (isName ? undefined : toggle(column.id, e.target.checked))}
                  className="h-4 w-4"
                />
                <label htmlFor={noteId + "-box"} className="flex-1 text-sm">{column.header}</label>
                {isName && <span id={noteId} className="text-xs text-muted-foreground">{NAME_NOTE}</span>}
                {on && !isName && (
                  <>
                    <button
                      type="button"
                      data-move={`${column.id}:-1`}
                      aria-label={`Move ${column.header} earlier`}
                      aria-describedby={reason ? reasonId : undefined}
                      aria-disabled={firstMovable || reason ? true : undefined}
                      onClick={() => (firstMovable ? undefined : move(column.id, -1))}
                      className={cn(MOVE, (firstMovable || reason) && "opacity-50")}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      data-move={`${column.id}:1`}
                      aria-label={`Move ${column.header} later`}
                      aria-describedby={reason ? reasonId : undefined}
                      aria-disabled={position === shown.length - 1 || reason ? true : undefined}
                      onClick={() => (position === shown.length - 1 ? undefined : move(column.id, 1))}
                      className={cn(MOVE, (position === shown.length - 1 || reason) && "opacity-50")}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={forget}
            aria-describedby={reason ? reasonId : undefined}
            aria-disabled={mine.kept === null || reason ? true : undefined}
            className={cn(BUTTON, (mine.kept === null || reason) && "opacity-50")}
          >
            Show the usual columns
          </button>
        </div>
        <p role="status" className="sr-only">{said}</p>
      </PopoverContent>
    </Popover>
  );
}
