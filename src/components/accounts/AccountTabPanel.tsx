import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { PanelFailed, RefreshFailed } from "@/components/workspace/states";
import { ACTIVITY_KINDS, activityIsOfKind, type ActivityKind } from "@/data/accountPage";
import type { AccountFile, AccountListTab, AccountPage, AccountTabRows, TabRows } from "@/lib/accountPageApi";
import { AccountFiles } from "./AccountFiles";
import { activityColumns, contactColumns, EMPTY_WORDS, opportunityColumns, quoteColumns, TAB_LABELS } from "./accountColumns";
import { EmptyLine, ListPanel, ListRowsLoading, Rows } from "./accountLists";
import { useAccountTabQuery } from "./useAccountQueries";

/** Pages (of fifty) the Contacts tab loads by itself looking for the contact named in the address. */
const MAX_PAGES_FOR_A_CONTACT = 10;

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
  const [kind, setKind] = useState<ActivityKind>("all");
  const { query, data } = useAccountTabQuery(firmId, accountId, tab);
  const heading = TAB_LABELS[tab];
  const id = `account-${tab}-heading`;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const location = useLocation();
  // "See all" opened this tab from the Overview: focus goes to the heading, where the person was sent.
  useEffect(() => {
    if ((location.state as { focusHeading?: boolean } | null)?.focusHeading) headingRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the tab opens
  }, []);

  // A contact named in the address that is further down the list than what is loaded: load the next page, and the next, until it is in view. Not after a
  // failed page, which would ask for the same one again for ever.
  const loadedContacts = tab === "contacts" && data ? (data.rows as AccountTabRows["contacts"][]) : null;
  const notLoaded = contactId !== null && loadedContacts !== null && !loadedContacts.some((c) => c.id === contactId);
  // By itself it loads at most ten pages (500 rows): a contact that is not on the account must not make it read the whole list. The person can go on with Show more.
  const pagesLoaded = query.data?.pages.length ?? 0;
  const keepLooking = notLoaded && query.hasNextPage && pagesLoaded < MAX_PAGES_FOR_A_CONTACT;
  useEffect(() => {
    if (keepLooking && !query.isFetching && !query.isError) void query.fetchNextPage();
  }, [keepLooking, query]);
  const contactNote = !notLoaded || query.isFetching || query.isError ? null
    : !query.hasNextPage ? "That contact isn't on this account."
    : pagesLoaded >= MAX_PAGES_FOR_A_CONTACT ? "That contact isn't in the first 500 here."
    : null;

  if (!data) {
    return (
      <ListPanel id={id} heading={heading} headingRef={headingRef}>
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
    <ListPanel id={id} heading={heading} count={data.count} headingRef={headingRef}>
      {query.isError && <RefreshFailed what={NOUNS[tab]} onRetry={() => void query.refetch()} retrying={query.isFetching} />}
      {tab === "activity" && (
        <div role="group" aria-label="Show" className="mb-3 flex gap-2">
          {ACTIVITY_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={kind === k.id}
              onClick={() => setKind(k.id)}
              className={`min-h-9 rounded-full border px-3 text-sm ${kind === k.id ? "border-primary bg-primary/10 font-medium" : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              {k.label}
            </button>
          ))}
        </div>
      )}
      {contactNote && <p role="status" className="mb-3 text-sm text-muted-foreground">{contactNote}</p>}
      {tabBody(tab, data, kind, contactId, emptyWords(tab, page))}
      {query.hasNextPage && (
        <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
          <span>Showing {data.rows.length} of {data.count}.</span>
          <button type="button" onClick={() => void query.fetchNextPage()} disabled={query.isFetching} className="min-h-9 text-primary underline underline-offset-2 disabled:opacity-50">
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
