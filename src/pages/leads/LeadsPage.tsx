import { useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, SearchX, Trash2, UserPlus } from "lucide-react";
import { leadsTableWords } from "@/data/leads";
import { countLeadsViews, fetchLeadsPage, leadExportColumnsFor, useLeadsTable } from "@/components/leads/leadsTable";
import { NewLeadDialog } from "@/components/leads/NewLeadDialog";
import { LEAD_BULK_KINDS, LEAD_BULK_TITLES, type LeadBulkKind } from "@/components/leads/leadBulkWords";
import { LeadBulkDialog, type LeadBulkMade } from "@/components/leads/LeadBulkDialog";
import { LeadBulkResultBar } from "@/components/leads/LeadBulkResultBar";
import { LeadBinDialog } from "@/components/leads/LeadBinDialog";
import { ExportControl } from "@/components/workspace/ExportControl";
import { NothingMatches, NothingYet, LoadFailed } from "@/components/workspace/states";
import {
  ColumnsMenu, FilterRow, SelectionBar, hasHeld, inForceInWords, isNarrowed, queryFor, refusedQueryReason, SearchBox, shownColumns, TableFrame, useFirmReady, useMyColumns,
  useRefreshTable, useRowSelection, useSavedViewsControl, useTableAddress, useTableRows, useTableViewCounts, ViewTabs,
} from "@/components/workspace/table";
import { WorkspaceContext } from "@/components/workspace/workspaceContext";
import type { Json } from "@/integrations/supabase/types";
import { browserTimeZone } from "@/lib/accountsApi";
import type { BulkSelection } from "@/lib/bulkChangeApi";

// The Leads page (story CRM-L1.1a, slice 8.3, screen 14): the people a firm isn't quoting yet, on the workspace's table frame as the Accounts page is
// (src/pages/accounts/AccountsPage.tsx). The address holds the page, sort, filters, view and search; the database cuts the pages (D-44) and decides which leads
// the person may see (D-809). New lead (CRM-L1.2a) opens over the page.
//
// Selecting rows, the bulk bar (D-811), Undo, the bin with Restore (an owner's, D-806) and export are CRM-L1.1b's (slice 8.4, D-1641 to D-1649).
// Not here, and where it goes: a lead's page (8.5) and Convert (8.6), the Label column and filter (D-1648), Import (Epic 9).

const NEW_LEAD_BUTTON = "inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const LeadsPage = () => {
  const { table, names } = useLeadsTable();
  const { firmId } = useFirmReady();
  const location = useTableAddress(table);
  const { address, hrefFor, change } = location;
  const fetchPage = useMemo(() => fetchLeadsPage(firmId), [firmId]);
  const countViews = useMemo(() => countLeadsViews(firmId), [firmId]);
  const data = useTableRows(table, address, fetchPage);
  const counts = useTableViewCounts(table, address, countViews);
  const refresh = useRefreshTable(table);
  const mine = useMyColumns(table, address.view);
  const columns = useMemo(() => shownColumns(table, mine.kept), [table, mine.kept]);
  const rowsSettled = !hasHeld(address) && !data.isPlaceholder && (data.page !== null || data.error !== null);
  const onScreen = mine.kept ?? (mine.status === "ready" ? columns.map((c) => c.id) : null);
  const savedViews = useSavedViewsControl(table, location, { columns: onScreen, columnsStatus: mine.status, refused: !!data.error && refusedQueryReason(data.error) !== null, rowsSettled });
  const addFilterRef = useRef<HTMLButtonElement>(null);
  // New lead (CRM-L1.2a): offered to a person of the firm, never to Nevermore support, who can only look (ADR 0024).
  const workspace = useContext(WorkspaceContext);
  const [making, setMaking] = useState(false);
  const canMake = !!firmId && !workspace?.isSupport;
  const queryClient = useQueryClient();

  // What Export and "all that match" ask for: the filters and search in force, as the table's own call takes them (the database applies the visibility).
  const asked = queryFor(table, address);
  const timeZone = browserTimeZone();
  const exportFilters: Record<string, Json> = { filters: asked.filters as unknown as Json, ...(address.search ? { search: address.search } : {}), time_zone: timeZone };
  const hasRows = rowsSettled && !data.error && !!data.page && data.page.total > 0;

  // Selecting rows (CRM-S3.6) and the leads' bulk actions (D-811), as the Accounts page has them. Nevermore support is offered none of the changes (ADR 0024).
  const selection = useRowSelection(table, address, data.page, (row) => row.name);
  const selectedFilters: Record<string, Json> = selection.all ? exportFilters : { time_zone: timeZone };
  const canBulk = !!firmId && !workspace?.isSupport;
  // After a change the selection is cleared (those rows are done; Undo is the way back) and the line over the table says what happened.
  const [asking, setAsking] = useState<{ kind: LeadBulkKind; selected: BulkSelection; count: number } | null>(null);
  const [made, setMade] = useState<{ seq: number; made: LeadBulkMade } | null>(null);
  // The bin (D-806): the Deleted view is the firm's owners' (the database refuses anyone else).
  const canSeeBin = !!firmId && !!workspace?.isOwner;
  const [binOpen, setBinOpen] = useState(false);
  const ask = (kind: LeadBulkKind) => setAsking({
    kind,
    count: selection.count,
    selected: selection.all ? { filters: exportFilters as unknown as Extract<BulkSelection, { filters: unknown }>["filters"] } : { ids: selection.ids },
  });

  const toolbar = ({ loading, slowLine }: { loading: boolean; slowLine: ReactNode }) => (
    <>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Leads</h1>
          {slowLine}
        </div>
        {selection.count === 0 && (
          <div className="flex flex-wrap items-center gap-3">
            {canSeeBin && (
              <button type="button" onClick={() => setBinOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm hover:bg-muted">
                <Trash2 className="h-4 w-4" aria-hidden="true" />Deleted
              </button>
            )}
            {firmId && hasRows && <ExportControl firmId={firmId} table="leads" columns={leadExportColumnsFor(columns, timeZone)} filters={exportFilters} />}
            {canMake && <button type="button" onClick={() => setMaking(true)} className={NEW_LEAD_BUTTON}>New lead</button>}
          </div>
        )}
      </div>
      <SelectionBar selection={selection} noun={table.noun}>
        {canBulk && LEAD_BULK_KINDS.map((kind) => (
          <button key={kind} type="button" onClick={() => ask(kind)} className="min-h-11 rounded-md border border-border bg-background px-4 text-sm hover:bg-muted">
            {LEAD_BULK_TITLES[kind]}
          </button>
        ))}
        {firmId && <ExportControl firmId={firmId} table="leads" columns={leadExportColumnsFor(columns, timeZone)} filters={selectedFilters} {...(selection.all ? {} : { ids: selection.ids })} />}
      </SelectionBar>
      {selection.count === 0 && (<>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3 mb-3">
        <SearchBox value={address.search} minChars={table.searchMinChars} placeholder="Search names, businesses, emails, phones" onSearch={(term) => change({ search: term })} />
        <div className="flex items-center gap-3">
          <button
            onClick={loading ? undefined : refresh}
            aria-disabled={loading || undefined}
            aria-describedby={loading ? "refresh-unavailable" : undefined}
            className={`p-2 rounded-md border border-border text-muted-foreground ${loading ? "opacity-50" : "hover:text-foreground"}`}
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <ColumnsMenu table={table} mine={mine} />
          {loading && <span id="refresh-unavailable" className="sr-only">Available when the list has loaded</span>}
        </div>
      </div>
      <FilterRow table={table} location={location} names={names} addFilterRef={addFilterRef} />
      </>)}
    </>
  );

  const views = <ViewTabs table={table} address={address} hrefFor={hrefFor} counts={counts} saved={savedViews} />;

  // Nothing yet, or nothing matches (CRM-S2.2). Import is the story's second button and arrives with CRM-X4.1: none is shown that does nothing.
  const empty = (a: typeof address, { focusTable }: { focusTable: () => void }) => {
    if (!isNarrowed(a)) {
      return (
        <NothingYet
          icon={<UserPlus className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />}
          sentence={leadsTableWords.nothingYet}
          primary={canMake ? { label: "New lead", onClick: () => setMaking(true) } : undefined}
        />
      );
    }
    const by = { search: a.search !== "", filters: a.filters.length > 0, view: a.view !== null };
    return (
      <NothingMatches
        plural={table.noun.plural}
        by={by}
        inForce={inForceInWords(table, a, names)}
        showAll={`Show ${table.allViewLabel.toLowerCase()}`}
        hint={table.searchHint}
        icon={<SearchX className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />}
        onClear={() => {
          change(by.search || by.filters ? { search: "", filters: [] } : { view: null }, { push: true });
          if (by.filters) addFilterRef.current?.focus();
          else focusTable();
        }}
      />
    );
  };

  const error = (e: Error, retry: () => void) => <LoadFailed error={e} what="the leads" onRetry={retry} />;

  return (
    <div className="bg-background">
      <main className="container mx-auto px-6 py-8">
        {made && firmId && (
          <LeadBulkResultBar
            key={made.seq}
            firmId={firmId}
            made={made.made}
            onUndone={() => {
              refresh();
              void queryClient.invalidateQueries({ queryKey: ["menu-counts"] });
            }}
            onDismiss={() => setMade(null)}
          />
        )}
        <TableFrame
          table={table}
          location={location}
          data={data}
          context={undefined}
          columns={columns}
          caption="Leads"
          toolbar={toolbar}
          views={views}
          empty={empty}
          error={error}
          selection={selection}
        />
        {asking && firmId && (
          <LeadBulkDialog
            firmId={firmId}
            kind={asking.kind}
            selection={asking.selected}
            count={asking.count}
            onClose={() => setAsking(null)}
            onMade={(m) => {
              setAsking(null);
              setMade((previous) => ({ seq: (previous?.seq ?? 0) + 1, made: m }));
              selection.clear();
              refresh();
              void queryClient.invalidateQueries({ queryKey: ["menu-counts"] });
            }}
          />
        )}
        {binOpen && firmId && (
          <LeadBinDialog
            firmId={firmId}
            onClose={() => setBinOpen(false)}
            onRestored={() => {
              refresh();
              void queryClient.invalidateQueries({ queryKey: ["menu-counts"] });
            }}
          />
        )}
        {making && firmId && (
          <NewLeadDialog
            firmId={firmId}
            person={workspace?.person ?? ""}
            onClose={() => setMaking(false)}
            onCreated={(_lead, again) => {
              refresh();
              void queryClient.invalidateQueries({ queryKey: ["menu-counts"] });
              if (!again) setMaking(false);
            }}
          />
        )}
      </main>
    </div>
  );
};

export default LeadsPage;
