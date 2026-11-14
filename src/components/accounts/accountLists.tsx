import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PlaceholderLine, PlaceholderLines } from "@/components/workspace/states";

// The parts an account's lists are drawn with (story CRM-A2.1b): a table that scrolls sideways, a titled panel, a one-line empty state and the grey rows of a
// list on its way. What each list's columns are is in accountColumns.tsx.

export type Column<R> = { header: string; cell: (row: R) => ReactNode; className?: string };

/** A list as a table, scrolling sideways on a narrow screen. A row named by `highlight` is marked as the current one and scrolled into view. */
export function Rows<R>({ caption, columns, rows, rowKey, highlight }: {
  caption: string;
  columns: Column<R>[];
  rows: R[];
  rowKey: (row: R) => string;
  highlight?: string | null;
}) {
  const marked = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    marked.current?.scrollIntoView?.({ block: "center" });
  }, [highlight, rows.length]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b border-border">
            {columns.map((c) => <th key={c.header} scope="col" className="py-2 pr-4 font-normal whitespace-nowrap">{c.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const current = highlight === key;
            return (
              <tr key={key} ref={current ? marked : undefined} aria-current={current ? "true" : undefined} className={`border-b border-border/60 align-top ${current ? "bg-primary/5" : ""}`}>
                {columns.map((c) => <td key={c.header} className={`py-2 pr-4 ${c.className ?? ""}`}>{c.cell(row)}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** A short label (a status, a stage): a span, so it sits inside a line of text. */
export const Pill = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground whitespace-nowrap">{children}</span>
);

// ---------- the words of an empty list (the page's states table) ----------

export const EmptyLine = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted-foreground py-2">{children}</p>;

// ---------- a list while it loads ----------

/** The grey rows of a list that is on its way. Hidden from assistive technology: the page says once that it is loading. */
export const ListRowsLoading = ({ rows = 3 }: { rows?: number }) => (
  <div aria-hidden="true" aria-busy="true" className="space-y-3 py-1">
    <PlaceholderLine width="full" className="h-3" />
    <PlaceholderLines count={rows} />
  </div>
);

/** A section of the Overview or a tab: its heading with its count, "See all" when it has rows, and its body. */
export function ListPanel({ id, heading, count, seeAll, children }: { id: string; heading: string; count?: number; seeAll?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border border-border rounded-xl p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id={id} className="font-display text-lg font-bold">
          {heading}
          {count !== undefined && <span className="ml-2 text-base font-normal text-muted-foreground">{count}</span>}
        </h2>
        {seeAll}
      </div>
      {children}
    </section>
  );
}

export const SeeAll = ({ to, noun }: { to: string; noun: string }) => (
  <Link to={to} className="text-sm text-primary underline underline-offset-2 hover:text-primary/90">
    See all<span className="sr-only"> {noun}</span>
  </Link>
);
