import { useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, SearchX, UserPlus } from "lucide-react";
import { leadsTableWords } from "@/data/leads";
import { countLeadsViews, fetchLeadsPage, useLeadsTable } from "@/components/leads/leadsTable";
import { NewLeadDialog } from "@/components/leads/NewLeadDialog";
import { NothingMatches, NothingYet, LoadFailed } from "@/components/workspace/states";
import {
  ColumnsMenu, FilterRow, hasHeld, inForceInWords, isNarrowed, refusedQueryReason, SearchBox, shownColumns, TableFrame, useFirmReady, useMyColumns, useRefreshTable,
  useSavedViewsControl, useTableAddress, useTableRows, useTableViewCounts, ViewTabs,
} from "@/components/workspace/table";
import { WorkspaceContext } from "@/components/workspace/workspaceContext";

// The Leads page (story CRM-L1.1a, slice 8.3, screen 14): the people a firm isn't quoting yet, on the workspace's table frame as the Accounts page is
// (src/pages/accounts/AccountsPage.tsx). The address holds the page, sort, filters, view and search; the database cuts the pages (D-44) and decides which leads
// the person may see (D-809). New lead (CRM-L1.2a) opens over the page.
//
// Not here, and where it goes: selecting rows, bulk changes, the bin and export (slice 8.4), a lead's page (8.5) and Convert (8.6), Import (Epic 9).

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

  const toolbar = ({ loading, slowLine }: { loading: boolean; slowLine: ReactNode }) => (
    <>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Leads</h1>
          {slowLine}
        </div>
        {canMake && <button type="button" onClick={() => setMaking(true)} className={NEW_LEAD_BUTTON}>New lead</button>}
      </div>
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
        />
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
