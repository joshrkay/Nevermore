import { useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Building2, RefreshCw, SearchX } from "lucide-react";
import { accountsTableWords } from "@/data/accountsPage";
import { countAccountsViews, exportColumnsFor, fetchAccountsPage, useAccountsTable } from "@/components/accounts/accountsTable";
import { NewAccountDialog } from "@/components/accounts/NewAccountDialog";
import { AccountMenu } from "@/components/accounts/AccountMenu";
import { ExportControl } from "@/components/workspace/ExportControl";
import { NothingMatches, NothingYet, LoadFailed } from "@/components/workspace/states";
import {
  ColumnsMenu, FilterRow, SelectionBar, hasHeld, inForceInWords, isNarrowed, queryFor, refusedQueryReason, SearchBox, shownColumns, TableFrame, useFirmReady, useMyColumns, useRefreshTable, useRowSelection,
  useSavedViewsControl, useTableAddress, useTableContextKey, useTableRows, useTableViewCounts, ViewTabs,
} from "@/components/workspace/table";
import type { Json } from "@/integrations/supabase/types";
import { WorkspaceContext } from "@/components/workspace/workspaceContext";
import { browserTimeZone } from "@/lib/accountsApi";
import { accountsCanChange } from "@/lib/accountActionsApi";

// The Accounts page (story CRM-A1.1a, screen 16): the businesses a firm quotes for, on the workspace's table frame as the submissions queue is
// (src/pages/advisor/AdvisorDashboardPage.tsx). The address holds the page, sort, filters, view and search; the database cuts the pages (D-44) and decides
// which accounts the person may see. A name opens the account's page. Each row has its own actions (CRM-A1.1c), shown where the person may change the account; selecting rows (CRM-S3.6) is the checkboxes and the bar over the table.

const NEW_ACCOUNT_BUTTON = "inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const AccountsPage = () => {
  const navigate = useNavigate();
  const { table, names } = useAccountsTable();
  const { firmId } = useFirmReady();
  const location = useTableAddress(table);
  const { address, hrefFor, change } = location;
  const fetchPage = useMemo(() => fetchAccountsPage(firmId), [firmId]);
  const countViews = useMemo(() => countAccountsViews(firmId), [firmId]);
  const data = useTableRows(table, address, fetchPage);
  const counts = useTableViewCounts(table, address, countViews);
  const refresh = useRefreshTable(table);
  // The columns this person chose, kept in the database (CRM-S3.1a); the table and its grey loading rows draw the same list.
  const mine = useMyColumns(table, address.view);
  const columns = useMemo(() => shownColumns(table, mine.kept), [table, mine.kept]);
  const rowsSettled = !hasHeld(address) && !data.isPlaceholder && (data.page !== null || data.error !== null);
  // A view saved now keeps the columns on screen: with no choice kept those are the usual ones, so they are named once the choice has loaded.
  const onScreen = mine.kept ?? (mine.status === "ready" ? columns.map((c) => c.id) : null);
  const savedViews = useSavedViewsControl(table, location, { columns: onScreen, columnsStatus: mine.status, refused: !!data.error && refusedQueryReason(data.error) !== null, rowsSettled });
  const addFilterRef = useRef<HTMLButtonElement>(null);
  // New account (CRM-A1.2): offered to a person of the firm, never to Nevermore support, who can only look. The form opens over the page; saving opens the account.
  const workspace = useContext(WorkspaceContext);
  const [making, setMaking] = useState(false);
  const canMake = !!firmId && !workspace?.isSupport;

  // Row actions only on the accounts the person may change (D-24, level rule D-209): the database says which of the page's rows. Until it has answered, and if it
  // fails, none is offered; the table asks again with Refresh and after an action.
  const rowIds = useMemo(() => (data.page?.rows ?? []).map((r) => r.id), [data.page]);
  const changeKey = useTableContextKey(table, "can-change");
  const canChange = useQuery({
    queryKey: [...changeKey, rowIds],
    queryFn: () => accountsCanChange(firmId as string, rowIds),
    enabled: !!firmId && rowIds.length > 0,
    retry: false,
  });
  const changeable = useMemo(() => new Set(canChange.data ?? []), [canChange.data]);

  // What the Export button asks for: the filters and search in force, as the table's own call takes them (the database applies the person's visibility itself).
  const asked = queryFor(table, address);
  const timeZone = browserTimeZone();
  const exportFilters: Record<string, Json> = { filters: asked.filters as unknown as Json, ...(address.search ? { search: address.search } : {}), time_zone: timeZone };
  // Offered only when there are rows to take (D-223), and only once the rows on screen answer the question on screen: the filters sent are the address's, so the
  // previous question's rows kept while the next loads must not be exported under the new filters.
  const hasRows = rowsSettled && !data.error && !!data.page && data.page.total > 0;

  // Selecting rows (CRM-S3.6). The selection is of the question on screen and ends when the view, a filter or the search changes. The bar offers only what works
  // today (Export); the database's bulk changes and their screens are CRM-S3.7b and CRM-S3.7a.
  const selection = useRowSelection(table, address, data.page, (row) => row.name);
  // Every row that matches goes to a later bulk action as the filters in `exportFilters` (the question), never as a list of ids; a chosen list goes as its ids.
  const selectedFilters: Record<string, Json> = selection.all ? exportFilters : { time_zone: timeZone };

  const toolbar = ({ loading, slowLine }: { loading: boolean; slowLine: ReactNode }) => (
    <>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Accounts</h1>
          {slowLine}
        </div>
        {selection.count === 0 && (
          <div className="flex flex-wrap items-center gap-3">
            {firmId && hasRows && <ExportControl firmId={firmId} table="accounts" columns={exportColumnsFor(columns, timeZone)} filters={exportFilters} />}
            {canMake && <button type="button" onClick={() => setMaking(true)} className={NEW_ACCOUNT_BUTTON}>New account</button>}
          </div>
        )}
      </div>
      <SelectionBar selection={selection} noun={table.noun}>
        {firmId && <ExportControl firmId={firmId} table="accounts" columns={exportColumnsFor(columns, timeZone)} filters={selectedFilters} {...(selection.all ? {} : { ids: selection.ids })} />}
      </SelectionBar>
      {selection.count === 0 && (<>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3 mb-3">
        <SearchBox value={address.search} minChars={table.searchMinChars} placeholder="Search accounts, contacts, emails" onSearch={(term) => change({ search: term })} />
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

  // Nothing yet, or nothing matches (CRM-S2.2): a bare address with no rows means the firm has no accounts; a narrowed one is worded to be true either way.
  // The buttons the story names arrive with the stories that build them (New quote CRM-Q2.1, Import CRM-X4.1): none is shown that does nothing. New account is CRM-A1.2's.
  const empty = (a: typeof address, { focusTable }: { focusTable: () => void }) => {
    if (!isNarrowed(a)) {
      return (
        <NothingYet
          icon={<Building2 className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />}
          sentence={accountsTableWords.nothingYet}
          primary={canMake ? { label: "New account", onClick: () => setMaking(true) } : undefined}
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

  const error = (e: Error, retry: () => void) => <LoadFailed error={e} what="the accounts" onRetry={retry} />;

  return (
    <div className="bg-background">
      <main className="container mx-auto px-6 py-8">
        <TableFrame
          table={table}
          location={location}
          data={data}
          context={undefined}
          columns={columns}
          caption="Accounts"
          toolbar={toolbar}
          views={views}
          empty={empty}
          error={error}
          selection={selection}
          onOpenRow={(row) => navigate(`/accounts/${row.id}`)}
          rowActions={firmId ? (row) => !changeable.has(row.id) ? null : (
            <AccountMenu
              firmId={firmId}
              account={{ id: row.id, name: row.name, archived: row.archived, ownerId: row.owner, openOpportunities: row.open_opportunities }}
              onDone={refresh}
            />
          ) : undefined}
        />
        {making && firmId && (
          <NewAccountDialog
            firmId={firmId}
            person={workspace?.person ?? ""}
            onClose={() => setMaking(false)}
            onCreated={(account, thenContact) => navigate(thenContact ? `/accounts/${account.id}?addContact=1` : `/accounts/${account.id}`)}
          />
        )}
      </main>
    </div>
  );
};

export default AccountsPage;
