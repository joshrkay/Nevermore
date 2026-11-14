import { useEffect, useState } from "react";
import { PanelFailed, RefreshFailed } from "@/components/workspace/states";
import { ACTIVITY_KINDS, activityIsOfKind, type ActivityKind } from "@/data/accountPage";
import type { AccountFile, AccountListTab, AccountPage, AccountTabRows, TabRows } from "@/lib/accountPageApi";
import { AccountFiles } from "./AccountFiles";
import { activityColumns, contactColumns, EMPTY_WORDS, opportunityColumns, quoteColumns, TAB_LABELS } from "./accountColumns";
import { EmptyLine, ListPanel, ListRowsLoading, Rows } from "./accountLists";
import { TAB_STEP, useAccountTabQuery } from "./useAccountQueries";

const NOUNS = { contacts: "the contacts", opportunities: "the opportunities", quotes: "the quotes", activity: "the activity", files: "the files" } as const;

/**
 * One tab's whole list, asked for when the tab is opened: the rows the Overview shows five of, as many as the tab holds, fifty at a time. It fails on its own:
 * that list says so, with its own "Try again", and the rest of the page is untouched. A refresh that fails over rows leaves the rows and says they may be old.
 * `contactId` puts one contact in view (a contact's page is CRM-C1.1's; its name opens this tab until then).
 */
export function AccountTabPanel({ firmId, accountId, tab, page, contactId }: {
  firmId: string;
  accountId: string;
  tab: AccountListTab | "files";
  page: AccountPage;
  contactId: string | null;
}) {
  const [limit, setLimit] = useState(TAB_STEP);
  const [kind, setKind] = useState<ActivityKind>("all");
  const query = useAccountTabQuery(firmId, accountId, tab, limit);
  const data = query.data;
  const heading = TAB_LABELS[tab];
  const id = `account-${tab}-heading`;

  // A contact named in the address that is further down the list than what is loaded: load on until it is in view.
  const loadedContacts = tab === "contacts" && data ? (data.rows as AccountTabRows["contacts"][]) : null;
  const missing = contactId !== null && loadedContacts !== null && !loadedContacts.some((c) => c.id === contactId) && loadedContacts.length < (data?.count ?? 0);
  useEffect(() => {
    if (missing && !query.isFetching) setLimit((n) => n + TAB_STEP);
  }, [missing, query.isFetching]);

  if (!data) {
    return (
      <ListPanel id={id} heading={heading}>
        {query.isError ? (
          <PanelFailed what={NOUNS[tab]} error={query.error as Error} onRetry={() => void query.refetch()} />
        ) : query.isPending ? (
          <ListRowsLoading />
        ) : (
          <EmptyLine>This account isn't available.</EmptyLine>
        )}
      </ListPanel>
    );
  }

  return (
    <ListPanel id={id} heading={heading} count={data.count}>
      {query.isError && <RefreshFailed what={NOUNS[tab]} onRetry={() => void query.refetch()} retrying={query.isFetching} />}
      {tab === "activity" && (
        <div role="radiogroup" aria-label="Show" className="mb-3 flex gap-2">
          {ACTIVITY_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={kind === k.id}
              onClick={() => setKind(k.id)}
              className={`min-h-9 rounded-full border px-3 text-sm ${kind === k.id ? "border-primary bg-primary/10 font-medium" : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              {k.label}
            </button>
          ))}
        </div>
      )}
      {tabBody(tab, data, kind, contactId, emptyWords(tab, page))}
      {data.rows.length < data.count && (
        <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
          <span>Showing {data.rows.length} of {data.count}.</span>
          <button type="button" onClick={() => setLimit((n) => n + TAB_STEP)} disabled={query.isFetching} className="min-h-9 text-primary underline underline-offset-2 disabled:opacity-50">
            Show more
          </button>
        </div>
      )}
    </ListPanel>
  );
}

function emptyWords(tab: AccountListTab | "files", page: AccountPage): string {
  if (tab === "quotes") return page.tabs.opportunities.count > 0 ? EMPTY_WORDS.quotesNoneSent : EMPTY_WORDS.quotes;
  return EMPTY_WORDS[tab];
}

/** The tab's rows as its own table, or the tab's one line when it has none (after the Activity filter, too). */
function tabBody(tab: AccountListTab | "files", data: TabRows<unknown>, kind: ActivityKind, contactId: string | null, empty: string) {
  if (tab === "activity") {
    const rows = (data as TabRows<AccountTabRows["activity"]>).rows.filter((r) => activityIsOfKind(r, kind));
    return rows.length === 0 ? <EmptyLine>{empty}</EmptyLine> : <Rows caption="The account's history" columns={activityColumns} rows={rows} rowKey={(r) => r.entryKey} />;
  }
  if (data.rows.length === 0) return <EmptyLine>{empty}</EmptyLine>;
  switch (tab) {
    case "contacts":
      return <Rows caption="The account's contacts" columns={contactColumns} rows={(data as TabRows<AccountTabRows["contacts"]>).rows} rowKey={(r) => r.id} highlight={contactId} />;
    case "opportunities":
      return <Rows caption="The account's opportunities" columns={opportunityColumns} rows={(data as TabRows<AccountTabRows["opportunities"]>).rows} rowKey={(r) => r.id} />;
    case "quotes":
      return <Rows caption="The account's quotes" columns={quoteColumns} rows={(data as TabRows<AccountTabRows["quotes"]>).rows} rowKey={(r) => String(r.id)} />;
    default:
      return <AccountFiles files={(data as TabRows<AccountFile>).rows} />;
  }
}
