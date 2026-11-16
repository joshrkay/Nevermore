import { useState } from "react";
import { Link } from "react-router-dom";
import { Pill, EmptyLine, ListPanel, ListRowsLoading, Rows } from "@/components/accounts/accountLists";
import { activityColumns, opportunityPath } from "@/components/accounts/accountColumns";
import { useAccountActions } from "@/components/accounts/useAccountActions";
import { PanelFailed, RefreshFailed } from "@/components/workspace/states";
import { formatDay, STAGE_LABELS } from "@/data/accountPage";
import type { ContactActivityFilter, ContactPage } from "@/lib/contactPageApi";
import { useContactActivityQuery } from "./useContactQueries";

// What sits beside a contact's details (story CRM-C1.1, screen 18): the opportunities the contact is on and its calls, notes and tasks. The calls, notes and tasks
// are the account's own (the same rows, columns and actions), narrowed to this contact by the database: there is no second set. The emails with the contact and
// the place to write are Epic 6's (D-186).

const linkClass = "text-primary underline underline-offset-2 hover:text-primary/90";

/** "Not on an opportunity yet" or the opportunities the contact is the main contact of, each named, with its stage. A name opens the opportunity's own page (CRM-O1.1b, D-430, which replaced D-187). */
export function ContactOpportunities({ opportunities }: { opportunities: ContactPage["opportunities"] }) {
  return (
    <ListPanel id="contact-opportunities" heading="Opportunities" count={opportunities.count}>
      {opportunities.rows.length === 0 ? (
        <EmptyLine>Not on an opportunity yet</EmptyLine>
      ) : (
        <>
          <ul className="space-y-3">
            {opportunities.rows.map((o) => (
              <li key={o.id} className="text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <Link to={opportunityPath(o.id)} className={linkClass}>{o.name}</Link>
                  <Pill>{STAGE_LABELS[o.stage]}</Pill>
                </span>
                <span className="text-muted-foreground">Main contact{o.targetStart ? ` · target start ${formatDay(o.targetStart)}` : ""}</span>
              </li>
            ))}
          </ul>
          {opportunities.count > opportunities.rows.length && <p className="mt-3 text-sm text-muted-foreground">Showing {opportunities.rows.length} of {opportunities.count}.</p>}
        </>
      )}
    </ListPanel>
  );
}

const FILTERS: { id: ContactActivityFilter; label: string }[] = [
  { id: "all", label: "All" }, { id: "calls", label: "Calls" }, { id: "notes", label: "Notes" }, { id: "tasks", label: "Tasks" },
];
const EMPTY_WORDS: Record<ContactActivityFilter, string> = {
  all: "No calls, notes or tasks yet.", calls: "No calls yet.", notes: "No notes yet.", tasks: "No tasks yet.",
};

/** The contact's calls, notes and tasks, newest first, fifty at a time, with the account's own filters, Add a note and the actions on each entry. */
export function ContactActivity({ firmId, contactId }: { firmId: string; contactId: string }) {
  const [filter, setFilter] = useState<ContactActivityFilter>("all");
  const { query, data } = useContactActivityQuery(firmId, contactId, filter);
  const actions = useAccountActions();
  const addNote = actions?.canAdd ? (
    <button type="button" className="min-h-9 text-sm text-primary underline underline-offset-2 hover:text-primary/90" onClick={() => actions.log("note", contactId)}>Add a note</button>
  ) : undefined;
  // The filter stays while a filter is on its way, so the person can choose another.
  const filters = (
    <div role="group" aria-label="Show" className="mb-3 flex gap-2">
      {FILTERS.map((k) => (
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
  const heading = "Calls, notes and tasks";
  if (!data) {
    return (
      <ListPanel id="contact-activity" heading={heading} seeAll={addNote}>
        {filters}
        {query.isError ? (
          <PanelFailed what="the calls, notes and tasks" error={query.error as Error} onRetry={() => void query.refetch()} />
        ) : query.isPending ? (
          <ListRowsLoading />
        ) : (
          <EmptyLine>This contact isn't available.</EmptyLine>
        )}
      </ListPanel>
    );
  }
  return (
    <ListPanel id="contact-activity" heading={heading} count={data.count} seeAll={addNote}>
      <RefreshFailed what="the calls, notes and tasks" failed={query.isError} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      {filters}
      {data.rows.length === 0 ? <EmptyLine>{EMPTY_WORDS[filter]}</EmptyLine> : <Rows caption="The contact's calls, notes and tasks" columns={activityColumns} rows={data.rows} rowKey={(r) => r.entryKey} />}
      {query.hasNextPage && (
        <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
          <span>Showing {data.rows.length} of {data.count}.</span>
          <button type="button" onClick={() => void query.fetchNextPage()} disabled={query.isFetching} className="min-h-9 text-primary underline underline-offset-2 disabled:opacity-50">Show more</button>
        </div>
      )}
    </ListPanel>
  );
}
