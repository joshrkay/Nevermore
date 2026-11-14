import { useEffect, useState, type ElementType, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { clearLabelFor, type NarrowedBy } from "./clearLabel";

// The two kinds of empty (story CRM-S2.2), which are never confused:
//   - NOTHING YET: the firm has no records of this kind at all. One sentence saying what belongs here, and one primary action that makes the
//     first one when a person can make one.
//   - NOTHING MATCHES: records may exist, but the view, the search or the filters leave none. It says what is in force, in words, and offers one
//     way back. It never offers to create a record: the person did not ask for a new one, they asked a narrower question.
// Each says its words once, as ONE polite status, and the actions sit outside the status (a link inside a live region is read out with it).
// The status is on the page empty and filled just after its first draw, because a live region that is inserted already holding text is not
// reliably announced (the same rule as `LoadingStatus`).

const BUTTON = "text-sm text-primary underline hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";
const PRIMARY = "inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** A polite status that holds its words from just after its first draw, never in the first draw itself. */
function SpokenOnce({ children, className }: { children: ReactNode; className?: string }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => setDrawn(true), []);
  return <div role="status" aria-live="polite" className={className}>{drawn ? children : null}</div>;
}

/** What a primary action does: go somewhere (`to`) or do something (`onClick`, such as putting focus in the form beside it). */
export interface EmptyAction {
  label: string;
  to?: string;
  onClick?: () => void;
}

const Action = ({ action, className }: { action: EmptyAction; className: string }) =>
  action.to !== undefined ? (
    <Link to={action.to} onClick={action.onClick} className={className}>{action.label}</Link>
  ) : (
    <button type="button" onClick={action.onClick} className={className}>{action.label}</button>
  );

/** How an empty state sits: a block under a table's headers, or one line in a list on a page. */
export type EmptyLayout = "block" | "line";

/**
 * Nothing yet. `sentence` says what belongs here. `primary` is the one action that creates the first record, left out when a person cannot make one
 * yet (the queue: New quote arrives with CRM-Q2.1). `secondary` is a second action, import where import applies (CRM-X4.1 passes it; nothing does today).
 */
export function NothingYet({ sentence, primary, secondary, icon, layout = "block" }: { sentence: string; primary?: EmptyAction; secondary?: ReactNode; icon?: ReactNode; layout?: EmptyLayout }) {
  const line = layout === "line";
  return (
    <div className={cn(line ? "flex flex-wrap items-center gap-x-3 gap-y-2" : "flex min-h-48 flex-col items-center justify-center p-12 text-center")} data-empty="nothing-yet">
      {!line && icon}
      <SpokenOnce className={cn("text-muted-foreground", !line && "font-medium text-foreground")}>
        <p>{sentence}</p>
      </SpokenOnce>
      {(primary || secondary) && (
        <div className={cn("flex flex-wrap items-center gap-3", !line && "mt-4")}>
          {primary && <Action action={primary} className={line ? BUTTON : PRIMARY} />}
          {secondary}
        </div>
      )}
    </div>
  );
}

/**
 * Nothing matches. Says "No <plural> match <this search | these filters | this search and these filters>." and lists, in words, what is in force. The
 * one way back is `onClear`, named by `clearLabelFor`. `headline` and `clearLabel` replace the generic words where a page can say something more exact
 * (the Inbox: "No submissions have new PEO mail"; the outbox: "No notifications are dead"). `hint` is a plain line after a search that found nothing
 * ("Search covers company, contact and File ID."), given by the table.
 */
export function NothingMatches({ plural, by, inForce, onClear, headline, clearLabel, showAll = `Show all ${plural}`, hint, icon }: {
  plural: string;
  by: NarrowedBy;
  inForce: string[];
  onClear: () => void;
  headline?: string;
  clearLabel?: string;
  /** What leaving the tab is called when the tab alone narrows the list ("Show all statuses"). */
  showAll?: string;
  hint?: string;
  icon?: ReactNode;
}) {
  const what = by.search && (by.filters || by.view) ? "this search and these filters" : by.search ? "this search" : "these filters";
  return (
    <div className="flex min-h-48 flex-col items-center justify-center p-12 text-center" data-empty="nothing-matches">
      {icon}
      <SpokenOnce>
        <p className="font-medium">{headline ?? `No ${plural} match ${what}.`}</p>
        {inForce.length > 0 && (
          <ul aria-label="What is in force" className="mt-2 space-y-0.5 text-sm text-muted-foreground">
            {inForce.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}
      </SpokenOnce>
      {by.search && hint && <p className="mt-2 text-sm text-muted-foreground">{hint}</p>}
      <button type="button" onClick={onClear} className={cn(BUTTON, "mt-4")}>
        {clearLabel ?? clearLabelFor(by, showAll)}
      </button>
    </div>
  );
}

/** The body of a table with nothing to list: one cell across every column, under the table's own headers, holding the empty state. The cell's `Cell` is the plain table's own (a `td`, or the shared `TableCell`). */
export function EmptyBody({ columns, children, dimmed, Body = "tbody", Row = "tr", Cell = "td" }: {
  columns: number;
  children: ReactNode;
  /** The words answer a question already left: dimmed (not marked busy: the status inside must stay outside a busy region). */
  dimmed?: boolean;
  Body?: ElementType;
  Row?: ElementType;
  Cell?: ElementType;
}) {
  return (
    <Body className={dimmed ? "opacity-70" : undefined}>
      <Row className="hover:bg-transparent"><Cell colSpan={columns} className="p-0">{children}</Cell></Row>
    </Body>
  );
}
