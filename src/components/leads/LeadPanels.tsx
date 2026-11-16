import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyLine, ListPanel, ListRowsLoading, Rows } from "@/components/accounts/accountLists";
import { activityColumns } from "@/components/accounts/accountColumns";
import { useAccountActions } from "@/components/accounts/useAccountActions";
import { PanelFailed, RefreshFailed } from "@/components/workspace/states";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/data/accountPage";
import { LEAD_NOT_FIT_REASON_LABELS } from "@/data/leads";
import { convertingMakes } from "@/data/leadPage";
import type { LeadActivityFilter, LeadFields, LeadNotFitReason, LeadPage } from "@/lib/leadPageApi";
import { useLeadActivityQuery } from "./useLeadQueries";

// What sits beside a lead's details (story CRM-L2.1, screen 15): its calls, notes and tasks, drawn with the account's own rows, columns and actions (D-807:
// the same table, the same rows), and what converting would make.

const FILTERS: { id: LeadActivityFilter; label: string }[] = [
  { id: "all", label: "All" }, { id: "calls", label: "Calls" }, { id: "notes", label: "Notes" }, { id: "tasks", label: "Tasks" },
];
const EMPTY_WORDS: Record<LeadActivityFilter, string> = {
  all: "Nothing logged yet", calls: "No calls yet.", notes: "No notes yet.", tasks: "No tasks yet.",
};

/** The lead's calls, notes and tasks, newest first, fifty at a time, with the account's own filters and the actions on each entry. */
export function LeadActivity({ firmId, leadId }: { firmId: string; leadId: string }) {
  const [filter, setFilter] = useState<LeadActivityFilter>("all");
  const { query, data } = useLeadActivityQuery(firmId, leadId, filter);
  const actions = useAccountActions();
  const linkButton = "min-h-9 text-sm text-primary underline underline-offset-2 hover:text-primary/90";
  const addNote = actions?.canAdd ? <button type="button" className={linkButton} onClick={() => actions.log("note")}>Add a note</button> : undefined;
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
      <ListPanel id="lead-activity" heading={heading} seeAll={addNote}>
        {filters}
        {query.isError ? (
          <PanelFailed what="the calls, notes and tasks" error={query.error as Error} onRetry={() => void query.refetch()} />
        ) : query.isPending ? (
          <ListRowsLoading />
        ) : (
          <EmptyLine>This lead isn't available.</EmptyLine>
        )}
      </ListPanel>
    );
  }
  return (
    <ListPanel id="lead-activity" heading={heading} count={data.count} seeAll={data.rows.length > 0 || filter !== "all" ? addNote : undefined}>
      <RefreshFailed what="the calls, notes and tasks" failed={query.isError} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      {filters}
      {data.rows.length === 0 && filter === "all" && actions?.canAdd ? (
        // The No activity state (CRM-L2.1): "Nothing logged yet" with Add a note and Add a task.
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">{EMPTY_WORDS.all}</span>
          <button type="button" className={linkButton} onClick={() => actions.log("note")}>Add a note</button>
          <button type="button" className={linkButton} onClick={() => actions.log("task")}>Add a task</button>
        </div>
      ) : data.rows.length === 0 ? <EmptyLine>{EMPTY_WORDS[filter]}</EmptyLine> : <Rows caption="The lead's calls, notes and tasks" columns={activityColumns} rows={data.rows} rowKey={(r) => r.entryKey} />}
      {query.hasNextPage && (
        <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
          <span>Showing {data.rows.length} of {data.count}.</span>
          <button type="button" onClick={() => void query.fetchNextPage()} disabled={query.isFetching} className="min-h-9 text-primary underline underline-offset-2 disabled:opacity-50">Show more</button>
        </div>
      )}
    </ListPanel>
  );
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[6.5rem_1fr] gap-3 py-1.5 text-sm">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words">{children}</dd>
  </div>
);

/**
 * The Not a fit banner (CRM-L2.1): since when and why, and Reopen where the person may reopen it (the database's `can_reopen`). The page is read, not changed,
 * meanwhile (CRM-L1.1).
 */
export function NotFitBanner({ since, reason, onReopen, reopening }: {
  since: string | null;
  reason: LeadNotFitReason | null;
  onReopen: (() => void) | null;
  reopening: boolean;
}) {
  return (
    <div role="note" aria-labelledby="lead-not-fit-banner" className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
      <p className="flex-1">
        <strong id="lead-not-fit-banner" className="font-medium">Not a fit</strong>
        {since ? ` since ${formatDay(since)}` : ""}{reason ? `: ${LEAD_NOT_FIT_REASON_LABELS[reason]}` : ""}.
      </p>
      {onReopen && <Button type="button" variant="outline" onClick={onReopen} disabled={reopening}>{reopening ? "Reopening…" : "Reopen"}</Button>}
    </div>
  );
}

const bannerLink = "text-primary underline underline-offset-2 hover:text-primary/90";

/**
 * The Converted banner (CRM-L2.1): when, and links to the account, contact and opportunity converting made, each where the person may see it. The opportunity
 * opens its own page, /opportunities/<id> (D-1655, now that it exists). The page is read-only.
 */
export function ConvertedBanner({ on, made }: { on: string | null; made: NonNullable<LeadPage["converted"]> }) {
  const parts = [
    made.account && <Link key="a" to={`/accounts/${made.account.id}`} className={bannerLink}>{made.account.name}</Link>,
    made.contact && <Link key="c" to={`/contacts/${made.contact.id}`} className={bannerLink}>{made.contact.name}</Link>,
    made.opportunity && <Link key="o" to={`/opportunities/${made.opportunity.id}`} className={bannerLink}>{made.opportunity.name}</Link>,
  ].filter(Boolean);
  return (
    <div role="note" aria-labelledby="lead-converted-banner" className="mb-6 rounded-xl border border-border bg-muted/40 p-4 text-sm">
      <p>
        <strong id="lead-converted-banner" className="font-medium">Converted</strong>
        {on ? ` on ${formatDay(on)}` : ""}.{" "}
        {parts.length > 0 ? <>It became {parts.map((p, i) => <span key={i}>{i > 0 ? (i === parts.length - 1 ? " and " : ", ") : ""}{p}</span>)}.</> : "What it became isn't one you can open."}
        {" "}This lead can be read, not changed.
      </p>
    </div>
  );
}

/** "Converting makes": the account, contact and opportunity converting would make (D-810, D-1653). Converting (CRM-L2.2, ConvertLeadDialog) makes the same three: `convertingMakes` and convert_lead agree (D-1653). */
export function ConvertingMakes({ lead }: { lead: Pick<LeadFields, "name" | "business"> }) {
  const made = convertingMakes(lead);
  return (
    <section aria-labelledby="lead-converting-heading" className="border border-border rounded-xl p-5">
      <h2 id="lead-converting-heading" className="mb-3 font-display text-lg font-bold">Converting makes</h2>
      <dl>
        <Row label="Account">{made.account}</Row>
        <Row label="Contact">{made.contact ?? <span className="text-muted-foreground">None: no person is named</span>}</Row>
        <Row label="Opportunity">{made.opportunity}</Row>
      </dl>
    </section>
  );
}
