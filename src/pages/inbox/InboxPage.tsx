import { useMemo, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, RefreshCw, SearchX } from "lucide-react";
import { countInboxTabs, fetchInboxPage, INBOX_WORDS, recordPath, useInboxTable } from "@/components/inbox/inboxTable";
import NoMailboxBanner from "@/components/mailbox/NoMailboxBanner";
import { INBOX_PATH } from "@/components/workspace/menu";
import { LoadFailed, NothingMatches, NothingYet } from "@/components/workspace/states";
import { openConversation, type InboxRow } from "@/lib/inboxApi";
import { MENU_COUNTS_KEY } from "@/lib/menuCountsApi";
import { openQuoteRequestThread } from "@/lib/advisorApi";
import { FilterRow, inForceInWords, isNarrowed, SearchBox, TableFrame, useFirmReady, useRefreshTable, useTableAddress, useTableRows, useTableViewCounts, ViewTabs } from "@/components/workspace/table";

// The inbox (story CRM-E1.4, slice 6.5): every message on the PEO threads and the conversations with contacts and leads the person may see, newest first, on
// the workspace's table frame as the Leads page is (src/pages/leads/LeadsPage.tsx). The address holds the page, filters, view and search; the database cuts
// the pages and decides which messages the person may see. A view of the product's own threads: it never shows, reads or searches the agent's mailbox.

const InboxPage = () => {
  const { table, names } = useInboxTable();
  const { firmId } = useFirmReady();
  const location = useTableAddress(table);
  const { address, hrefFor, change } = location;
  const fetchPage = useMemo(() => fetchInboxPage(firmId), [firmId]);
  const countViews = useMemo(() => countInboxTabs(firmId), [firmId]);
  const data = useTableRows(table, address, fetchPage);
  const counts = useTableViewCounts(table, address, countViews);
  const refresh = useRefreshTable(table);
  const addFilterRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Opening a message opens it on its record, and first clears its thread's "new" mark for everyone who can see it (6.4's and the PEO thread's own open
  // functions), through the newest message of that thread on this page. A failed mark is no reason not to go: the thread stays new, and the record shows it.
  const openRow = async (row: InboxRow) => {
    const shown = data.page?.rows ?? [];
    const through = shown.filter((r) => r.kind === row.kind && r.thread_id === row.thread_id).reduce((at, r) => (r.at > at ? r.at : at), row.at);
    try {
      if (row.kind === "peo") await openQuoteRequestThread(Number(row.thread_id), through);
      else await openConversation(firmId, row.thread_id, through);
      void queryClient.invalidateQueries({ queryKey: MENU_COUNTS_KEY });
    } catch {
      // The mark stays; opening it on its record still works.
    }
    navigate(recordPath(row));
  };

  const toolbar = ({ loading, slowLine }: { loading: boolean; slowLine: ReactNode }) => (
    <>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Inbox</h1>
        {slowLine}
      </div>
      <NoMailboxBanner returnTo={INBOX_PATH} />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3 mb-3">
        <SearchBox value={address.search} minChars={table.searchMinChars} placeholder="Search senders, subjects, accounts" onSearch={(term) => change({ search: term })} />
        <button
          onClick={loading ? undefined : refresh}
          aria-disabled={loading || undefined}
          className={`p-2 rounded-md border border-border text-muted-foreground ${loading ? "opacity-50" : "hover:text-foreground"}`}
          aria-label="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      <FilterRow table={table} location={location} names={names} addFilterRef={addFilterRef} />
    </>
  );

  const views = <ViewTabs table={table} address={address} hrefFor={hrefFor} counts={counts} />;

  // The story's states for an empty answer: no mail on any record yet.
  const empty = (a: typeof address, { focusTable }: { focusTable: () => void }) => {
    if (!isNarrowed(a)) return <NothingYet icon={<Mail className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />} sentence={INBOX_WORDS.nothingYet} />;
    // The New view with nothing in it, and nothing else narrowing it: everything has been read.
    if (a.view === "new" && a.search === "" && a.filters.length === 0) return <NothingYet sentence={INBOX_WORDS.nothingNew} />;
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

  const error = (e: Error, retry: () => void) => <LoadFailed error={e} what="the inbox" onRetry={retry} />;

  return (
    <div className="bg-background">
      <main className="container mx-auto px-6 py-8">
        <TableFrame table={table} location={location} data={data} context={undefined} caption="Inbox" toolbar={toolbar} views={views} empty={empty} error={error} onOpenRow={openRow} />
      </main>
    </div>
  );
};

export default InboxPage;
