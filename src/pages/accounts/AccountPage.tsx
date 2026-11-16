import { useCallback, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Archive } from "lucide-react";
import { ACCOUNTS_TABLE } from "@/components/accounts/accountsTable";
import { AccountMenu } from "@/components/accounts/AccountMenu";
import { restoreWithWords } from "@/components/accounts/restoreWithWords";
import { Button } from "@/components/ui/button";
import { AccountHeader, AccountHeaderLoading } from "@/components/accounts/AccountHeader";
import { AccountOverview } from "@/components/accounts/AccountOverview";
import { AccountTabPanel } from "@/components/accounts/AccountTabPanel";
import { TAB_IDS, TAB_LABELS, type TabId } from "@/components/accounts/accountColumns";
import { AccountActionsProvider } from "@/components/accounts/accountActions";
import { RenewalsPanel } from "@/components/accounts/AccountRenewals";
import { accountKey, useAccountPageQuery, useAccountRenewalsQuery } from "@/components/accounts/useAccountQueries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadFailed, NotAvailable, PlaceholderPanel, PlaceholderLines, RecordLoading, SlowLoadLine, useSlowLoad } from "@/components/workspace/states";
import { useWorkspace } from "@/components/workspace/useWorkspace";
import { useNoteOpened } from "@/components/workspace/useNoteOpened";
import { useAuth } from "@/hooks/useAuth";
import type { AccountFields, AccountPage as Page } from "@/lib/accountPageApi";

const isTab = (v: string | null): v is TabId => (TAB_IDS as readonly string[]).includes(v ?? "");

/**
 * An account's page (story CRM-A2.1b, screen 17; D-37: `/accounts/:id` inside the workspace layout). The database decides who may see the account and who may
 * change it; this draws what it answers. The tab is in the address (`?tab=contacts`), so "See all" and a contact's name open a tab the way a link does, and Back
 * returns to where the person was.
 */
const AccountPage = () => {
  const { id = "" } = useParams();
  const workspace = useWorkspace();
  const { firm, isSupport } = workspace;
  const { user } = useAuth();
  const firmId = firm?.id ?? null;
  const [params, setParams] = useSearchParams();
  const tab: TabId = isTab(params.get("tab")) ? (params.get("tab") as TabId) : "overview";
  const contactId = tab === "contacts" ? params.get("contact") : null;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const query = useAccountPageQuery(firmId, id);
  // The Renewals tab's count: the page's own read has no renewals (their list is asked for with the tab and shared with the Overview's first five).
  const renewals = useAccountRenewalsQuery(firmId, id);
  const retry = useCallback(() => void query.refetch(), [query]);
  const waiting = firmId === null || (query.data === undefined && !query.isError);
  const slow = useSlowLoad(waiting, retry);
  // An address that finds no account may be one that was merged away (CRM-S4.3a, D-203): the database says where it leads, if the person may see that.
  const merged = useMergedAddress(firmId, "account", id, query.data === null);
  // Merging this account with the one the banner names (CRM-S4.3a): the other account's id while the dialog is open.
  const [merging, setMerging] = useState<string | null>(null);
  // The account is now among the menu search's recent records (CRM-S1.2a): noted once its page has loaded.
  useNoteOpened(firmId, "account", id, query.data?.account.id === id);

  // The saved fields go on the page at once (the reload that follows confirms them); every list of the account is asked again, since a save adds to its history.
  const saved = useCallback((fields: AccountFields) => {
    queryClient.setQueryData<Page | null>([...accountKey(firmId, id), "page"], (old) => (old ? { ...old, account: { ...old.account, ...fields } } : old));
    void queryClient.invalidateQueries({ queryKey: accountKey(firmId, id) });
  }, [queryClient, firmId, id]);

  const go = (next: string) => {
    // Replaced, not pushed: each arrow key in the tab list chooses a tab, and Back would step through every one it passed.
    setParams(next === "overview" ? {} : { tab: next }, { replace: true });
  };

  // Only the answer for this address is drawn: what is held for another account (or firm) is not shown under it.
  const answered = query.data === null || query.data === undefined || query.data.account.id === id;
  if (waiting || !answered) return <Frame><AccountLoading slow={slow.slow} onTryAgain={slow.tryAgain} /></Frame>;

  if (query.isError && query.data === undefined) {
    // An address whose id is no id at all (the database refuses it, 22P02) is an account that isn't there, not a load that could work next time.
    if ((query.error as { code?: string }).code === "22P02") return <Frame><NotAvailable noun="account" backTo="/accounts" backLabel="Back to all accounts" /></Frame>;
    return <Frame><LoadFailed error={query.error as Error} what="this account" onRetry={retry} /></Frame>;
  }
  const page = query.data;
  // The same answer for an account that is gone, another firm's, or one the person's level does not reach.
  if (!page) {
    if (merged.isLoading) return <Frame><AccountLoading slow={slow.slow} onTryAgain={slow.tryAgain} /></Frame>;
    if (merged.data) return <GoToKept record={merged.data} />;
    return <Frame><NotAvailable noun="account" backTo="/accounts" backLabel="Back to all accounts" /></Frame>;
  }

  const { account, tabs } = page;
  const actionAccount = {
    id: account.id,
    name: account.name,
    archived: account.archivedAt !== null,
    ownerId: account.owner?.id ?? null,
    // The page holds only the first five opportunities: when it holds them all, the open ones are counted; otherwise it is not known.
    openOpportunities: tabs.opportunities.count <= tabs.opportunities.rows.length ? tabs.opportunities.rows.filter((o) => o.stage !== "won" && o.stage !== "lost").length : null,
  };
  // What a change to the whole account does to the page: a deleted account is left for the list; anything else reloads it (its history gained an entry).
  const done = (what: "archived" | "restored" | "deleted" | "owner") => {
    if (what === "deleted") navigate("/accounts", { replace: true });
    else void queryClient.invalidateQueries({ queryKey: accountKey(firmId, id) });
  };
  const count: Record<TabId, number | null> = {
    overview: null, contacts: tabs.contacts.count, opportunities: tabs.opportunities.count, quotes: tabs.quotes.count, renewals: renewals.data?.count ?? null, activity: tabs.activity.count, files: tabs.files.count,
  };
  // Calls, notes and tasks can be acted on only where the database will take them: not during a Nevermore support session (ADR 0024). On an archived account
  // nothing can be added (D-222: the database refuses a new call, note, task or addition), but an existing call or task can still be changed and a task marked done.
  const canAct = firmId !== null && !isSupport;
  const archived = account.archivedAt !== null;
  const body = (
    <>
      <MergedNote />
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted-foreground">
        <Link to="/accounts" className="text-primary hover:underline">Accounts</Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{account.name}</span>
      </nav>
      {account.archivedAt !== null && (
        <div role="note" className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <Archive className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="flex-1"><strong className="font-medium">This account is archived.</strong> Nothing can be added to it.</p>
          {page.canChange && firmId && (
            <Button variant="outline" size="sm" onClick={() => void restoreWithWords(firmId, actionAccount).then((ok) => ok && done("restored"))}>Restore</Button>
          )}
        </div>
      )}
      {account.possibleDuplicateOf && firmId && (
        <DuplicateBanner
          firmId={firmId}
          accountId={account.id}
          mark={account.possibleDuplicateOf}
          canAct={page.canChange && !isSupport}
          onMerge={setMerging}
          onKeptSeparate={() => void queryClient.invalidateQueries({ queryKey: accountKey(firmId, id) })}
        />
      )}
      <AccountHeader account={account} menu={page.canChange && firmId ? <AccountMenu firmId={firmId} account={actionAccount} onDone={done} label="More actions for this account" /> : undefined} />
      <Tabs value={tab} onValueChange={go}>
        <TabsList aria-label="The account" className="mb-6 h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
          {TAB_IDS.map((t) => (
            <TabsTrigger key={t} value={t} className="rounded-none border-b-2 border-transparent px-3 py-2.5 data-[state=active]:border-primary data-[state=active]:shadow-none">
              {TAB_LABELS[t]}
              {count[t] !== null && <span className="ml-1.5 font-normal text-muted-foreground">{count[t]}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="mt-0">
          {firmId && <AccountOverview key={account.id} firmId={firmId} page={page} onSaved={saved} />}
        </TabsContent>
        <TabsContent value="renewals" className="mt-0">
          {firmId && <RenewalsPanel key={account.id} firmId={firmId} accountId={id} />}
        </TabsContent>
        {TAB_IDS.filter((t) => t !== "overview" && t !== "renewals").map((t) => (
          <TabsContent key={t} value={t} className="mt-0">
            {firmId && <AccountTabPanel key={`${account.id}-${t}`} firmId={firmId} accountId={id} tab={t as Exclude<TabId, "overview" | "renewals">} page={page} contactId={contactId} />}
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
  const dialog = merging && firmId ? (
    <MergeDialog
      firmId={firmId}
      kind="account"
      keptId={merging}
      removedId={account.id}
      onClose={() => setMerging(null)}
      onMerged={({ kept, removed }) => {
        setMerging(null);
        void queryClient.invalidateQueries({ queryKey: accountKey(firmId, kept.id) });
        void queryClient.invalidateQueries({ queryKey: accountKey(firmId, removed.id) });
        // The Accounts table still lists the removed account.
        void queryClient.invalidateQueries({ queryKey: ["table", firmId, ACCOUNTS_TABLE.id] });
        // This page's account is gone when it was the one removed: the kept account's page takes its place.
        if (removed.id === account.id) navigate(`/accounts/${kept.id}`, { replace: true });
      }}
    />
  ) : null;
  return (
    <Frame>
      {dialog}
      {canAct ? <AccountActionsProvider
          firmId={firmId}
          accountId={id}
          accountName={account.name}
          userId={user?.id ?? null}
          person={workspace.person}
          canAdd={!archived}
          canMove={page.canChange}
          canMerge={page.canChange}
          startWithContactForm={params.get("addContact") === "1"}
          onStarted={() => setParams((p) => { const next = new URLSearchParams(p); next.delete("addContact"); return next; }, { replace: true })}
        >{body}</AccountActionsProvider> : body}
    </Frame>
  );
};

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background">
    <main className="container mx-auto px-6 py-8">{children}</main>
  </div>
);

/** What the page shows while the account is on its way: the header and the tabs, and the Overview's panels each under its own heading with grey rows. */
const AccountLoading = ({ slow, onTryAgain }: { slow: boolean; onTryAgain: () => void }) => (
  <RecordLoading name="account">
    <AccountHeaderLoading />
    <SlowLoadLine loading slow={slow} onTryAgain={onTryAgain} />
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] items-start">
      <PlaceholderPanel heading="Details"><PlaceholderLines count={8} /></PlaceholderPanel>
      <div className="space-y-6 min-w-0">
        <PlaceholderPanel heading="Contacts"><PlaceholderLines count={3} /></PlaceholderPanel>
        <PlaceholderPanel heading="Opportunities"><PlaceholderLines count={3} /></PlaceholderPanel>
        <PlaceholderPanel heading="Quotes"><PlaceholderLines count={3} /></PlaceholderPanel>
        <PlaceholderPanel heading="Recent activity"><PlaceholderLines count={4} /></PlaceholderPanel>
      </div>
    </div>
  </RecordLoading>
);

export default AccountPage;
