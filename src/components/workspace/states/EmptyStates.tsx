import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

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

/** Which of the two things narrowing the list is in force, which decides the words ("this search", "these filters") and what the way back is called. */
export interface NarrowedBy {
  search: boolean;
  /** Filters, or a view (a tab is a filter with a name). */
  filters: boolean;
}

/**
 * Nothing matches. Says "No <plural> match <this search | these filters | this search and these filters>." and lists, in words, what is in force. The
 * one way back is `onClear`, whose label says what it clears ("Clear filters", "Clear filters and search"). `headline` and `clearLabel` replace the
 * generic words where a page can say something more exact (the Inbox: "No submissions have new PEO mail"; the outbox: "No notifications are dead").
 */
export function NothingMatches({ plural, by, inForce, onClear, headline, clearLabel, icon }: {
  plural: string;
  by: NarrowedBy;
  inForce: string[];
  onClear: () => void;
  headline?: string;
  clearLabel?: string;
  icon?: ReactNode;
}) {
  const what = by.search && by.filters ? "this search and these filters" : by.search ? "this search" : "these filters";
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
      <button type="button" onClick={onClear} className={cn(BUTTON, "mt-4")}>
        {clearLabel ?? (by.search ? "Clear filters and search" : "Clear filters")}
      </button>
    </div>
  );
}
