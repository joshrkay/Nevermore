import { useContext, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { FileText, SearchX } from "lucide-react";
import { useNewQuoteAction } from "@/components/newquote/useNewQuoteAction";
import { countQuotesViews, fetchQuotesPage, useQuotesTable } from "@/components/quotes/quotesTable";
import { LoadFailed, NothingMatches, NothingYet } from "@/components/workspace/states";
import { WorkspaceContext } from "@/components/workspace/workspaceContext";
import { ColumnsMenu, FilterRow, inForceInWords, isNarrowed, SearchBox, shownColumns, TableFrame, useFirmReady, useMyColumns, useTableAddress, useTableRows, useTableViewCounts, ViewTabs } from "@/components/workspace/table";

// The Quotes page (story CRM-Q4.1, slice 5.11, screen 2): every quote across accounts, one row for each PEO of each opportunity and one for each New quote
// left half done, on the workspace's table frame as the Leads and Accounts pages are.

const QuotesPage = () => {
  const { table, names } = useQuotesTable();
  const { firmId } = useFirmReady();
  const location = useTableAddress(table);
  const { address, hrefFor, change } = location;
  const fetchPage = useMemo(() => fetchQuotesPage(firmId), [firmId]);
  const countViews = useMemo(() => countQuotesViews(firmId), [firmId]);
  const data = useTableRows(table, address, fetchPage);
  const counts = useTableViewCounts(table, address, countViews);
  const mine = useMyColumns(table, address.view);
  const columns = useMemo(() => shownColumns(table, mine.kept), [table, mine.kept]);

  const addFilterRef = useRef<HTMLButtonElement>(null);
  // New quote (CRM-Q2.1) is the way to the first quote: offered to a person of the firm, never to Nevermore support, who can only look (ADR 0024).
  const workspace = useContext(WorkspaceContext);
  const newQuote = useNewQuoteAction();
  const canMake = !!firmId && !workspace?.isSupport;

  // Nothing yet, or nothing matches (CRM-S2.2): a bare address with no rows means the firm has no quotes; a narrowed one is worded to be true either way.
  const empty = (a: typeof address, { focusTable }: { focusTable: () => void }) => {
    if (!isNarrowed(a)) {
      return (
        <NothingYet
          icon={<FileText className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />}
          sentence="Your quotes will be listed here"
          primary={canMake ? newQuote : undefined}
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

  const toolbar = ({ slowLine }: { slowLine: React.ReactNode }) => (
    <>
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Quotes</h1>
        {slowLine}
      </div>
      {/* The queue the menu's Quotes opened until this page (D-1707): it stays until it is retired. */}
      <Link to="/advisor" className="text-sm text-primary underline underline-offset-2 hover:text-foreground">Submissions</Link>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3 mb-3">
      <SearchBox value={address.search} minChars={table.searchMinChars} placeholder="Search accounts, PEOs, File IDs" onSearch={(term) => change({ search: term })} />
      <ColumnsMenu table={table} mine={mine} />
    </div>
    <FilterRow table={table} location={location} names={names} addFilterRef={addFilterRef} />
    </>
  );

  const views = <ViewTabs table={table} address={address} hrefFor={hrefFor} counts={counts} />;

  return (
    <div className="bg-background">
      <main className="container mx-auto px-6 py-8">
        <TableFrame
          table={table}
          location={location}
          data={data}
          context={undefined}
          columns={columns}
          caption="Quotes"
          toolbar={toolbar}
          views={views}
          empty={empty}
          error={(e, retry) => <LoadFailed error={e} what="the quotes" onRetry={retry} />}
        />
      </main>
    </div>
  );
};

export default QuotesPage;
