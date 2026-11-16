import { useState } from "react";
import { EmptyLine, ListPanel, ListRowsLoading, Rows, type Column } from "@/components/accounts/accountLists";
import { ActivityActions, ActivityWhat } from "@/components/accounts/ActivityEntry";
import { useAccountActions } from "@/components/accounts/useAccountActions";
import { PanelFailed, RefreshFailed } from "@/components/workspace/states";
import { ACTIVITY_FILTERS_SHOWN, formatDay, formatWhen, KIND_LABELS } from "@/data/accountPage";
import { historyWords, quoteEventWords } from "@/data/opportunityPage";
import type { OpportunityActivityFilter, OpportunityActivityRow } from "@/lib/opportunityPageApi";
import { useOpportunityActivityQuery } from "./useOpportunityQueries";

// The opportunity's activity (screen 19, D-427, D-212): its calls, notes and tasks (the account's own rows, columns and actions, narrowed to this opportunity by the
// database: there is no second set), its history with its stage changes (D-413) and its quote requests' events, newest first, filtered as the account's is.
// Add a note and Add a task open the account's form about this opportunity. The emails with the contact are Epic 6's.

const EMPTY_WORDS: Record<OpportunityActivityFilter, string> = {
  all: "No activity yet.", calls: "No calls yet.", notes: "No notes yet.", tasks: "No tasks yet.", changes: "No changes yet.",
};

const GONE = "Someone who has left";

const columns: Column<OpportunityActivityRow>[] = [
  { header: "When", cell: (a) => (a.type === "change" || a.type === "quote" ? formatDay(a.at) : formatWhen(a.at)), className: "whitespace-nowrap text-muted-foreground" },
  { header: "Kind", cell: (a) => <span className="font-medium">{a.type === "quote" ? "Quote" : KIND_LABELS[a.type]}</span> },
  {
    header: "What happened",
    cell: (a) => (a.type === "change" ? historyWords(a) : a.type === "quote" ? quoteEventWords(a) : <ActivityWhat row={a} />),
  },
  { header: "By", cell: (a) => <span className="break-all">{a.who ?? GONE}</span> },
  { header: "Actions", cell: (a) => (a.type === "change" || a.type === "quote" ? null : <ActivityActions row={a} />) },
];

const button = "min-h-9 text-sm text-primary underline underline-offset-2 hover:text-primary/90";

export function OpportunityActivity({ firmId, opportunityId }: { firmId: string; opportunityId: string }) {
  const [filter, setFilter] = useState<OpportunityActivityFilter>("all");
  const { query, data } = useOpportunityActivityQuery(firmId, opportunityId, filter);
  const actions = useAccountActions();
  const add = actions?.canAdd ? (
    <span className="flex gap-4">
      <button type="button" className={button} onClick={() => actions.log("note", null, opportunityId)}>Add a note</button>
      <button type="button" className={button} onClick={() => actions.log("task", null, opportunityId)}>Add a task</button>
    </span>
  ) : undefined;
  // The filter stays while a filter is on its way, so the person can choose another.
  const filters = (
    <div role="group" aria-label="Show" className="mb-3 flex flex-wrap gap-2">
      {ACTIVITY_FILTERS_SHOWN.map((k) => (
        <button
          key={k.id}
          type="button"
          aria-pressed={filter === k.id}
          onClick={() => setFilter(k.id)}
          className={`min-h-9 rounded-full border px-3 text-sm ${filter === k.id ? "border-primary bg-primary/10 font-medium" : "border-border text-muted-foreground hover:bg-muted"}`}
        >
          {k.label}
        </button>
      ))}
    </div>
  );
  if (!data) {
    return (
      <ListPanel id="opportunity-activity" heading="Activity" seeAll={add}>
        {filters}
        {query.isError ? (
          <PanelFailed what="the activity" error={query.error as Error} onRetry={() => void query.refetch()} />
        ) : query.isPending ? (
          <ListRowsLoading />
        ) : (
          <EmptyLine>This opportunity isn't available.</EmptyLine>
        )}
      </ListPanel>
    );
  }
  return (
    <ListPanel id="opportunity-activity" heading="Activity" count={data.count} seeAll={add}>
      <RefreshFailed what="the activity" failed={query.isError} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      {filters}
      {data.rows.length === 0 ? <EmptyLine>{EMPTY_WORDS[filter]}</EmptyLine> : <Rows caption="The opportunity's activity" columns={columns} rows={data.rows} rowKey={(r) => r.entryKey} />}
      {query.hasNextPage && (
        <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
          <span>Showing {data.rows.length} of {data.count}.</span>
          <button type="button" onClick={() => void query.fetchNextPage()} disabled={query.isFetching} className="min-h-9 text-primary underline underline-offset-2 disabled:opacity-50">Show more</button>
        </div>
      )}
    </ListPanel>
  );
}
