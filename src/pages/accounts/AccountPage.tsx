import { useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Archive } from "lucide-react";
import { AccountHeader, AccountHeaderLoading } from "@/components/accounts/AccountHeader";
import { AccountOverview } from "@/components/accounts/AccountOverview";
import { AccountTabPanel } from "@/components/accounts/AccountTabPanel";
import { TAB_IDS, TAB_LABELS, type TabId } from "@/components/accounts/accountColumns";
import { accountKey, useAccountPageQuery } from "@/components/accounts/useAccountQueries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadFailed, NotAvailable, PlaceholderPanel, PlaceholderLines, RecordLoading, SlowLoadLine, useSlowLoad } from "@/components/workspace/states";
import { useWorkspace } from "@/components/workspace/useWorkspace";
import type { AccountFields, AccountPage as Page } from "@/lib/accountPageApi";

const isTab = (v: string | null): v is TabId => (TAB_IDS as readonly string[]).includes(v ?? "");

/**
 * An account's page (story CRM-A2.1b, screen 17; D-37: `/accounts/:id` inside the workspace layout). The database decides who may see the account and who may
 * change it; this draws what it answers. The tab is in the address (`?tab=contacts`), so "See all" and a contact's name open a tab the way a link does, and Back
 * returns to where the person was.
 */
const AccountPage = () => {
  const { id = "" } = useParams();
  const { firm } = useWorkspace();
  const firmId = firm?.id ?? null;
  const [params, setParams] = useSearchParams();
  const tab: TabId = isTab(params.get("tab")) ? (params.get("tab") as TabId) : "overview";
  const contactId = tab === "contacts" ? params.get("contact") : null;
  const queryClient = useQueryClient();
  const query = useAccountPageQuery(firmId, id);
  const retry = useCallback(() => void query.refetch(), [query]);
  const waiting = firmId === null || (query.data === undefined && !query.isError);
  const slow = useSlowLoad(waiting, retry);

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
    if ((query.error as { code?: string }).code === "22P02") return <Frame><NotAvailable noun="account" backTo="/advisor" backLabel="Back to all submissions" /></Frame>;
    return <Frame><LoadFailed error={query.error as Error} what="this account" onRetry={retry} /></Frame>;
  }
  const page = query.data;
  // The same answer for an account that is gone, another firm's, or one the person's level does not reach.
  if (!page) return <Frame><NotAvailable noun="account" backTo="/advisor" backLabel="Back to all submissions" /></Frame>;

  const { account, tabs } = page;
  const count: Record<TabId, number | null> = {
    overview: null, contacts: tabs.contacts.count, opportunities: tabs.opportunities.count, quotes: tabs.quotes.count, activity: tabs.activity.count, files: tabs.files.count,
  };
  return (
    <Frame>
      {account.archivedAt !== null && (
        // A Restore button comes with CRM-A1.1c; until then the account says it is archived and nothing can be added.
        <div role="note" className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <Archive className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p><strong className="font-medium">This account is archived.</strong> Nothing can be added to it.</p>
        </div>
      )}
      <AccountHeader account={account} />
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
        {TAB_IDS.filter((t) => t !== "overview").map((t) => (
          <TabsContent key={t} value={t} className="mt-0">
            {firmId && <AccountTabPanel key={`${account.id}-${t}`} firmId={firmId} accountId={id} tab={t as Exclude<TabId, "overview">} page={page} contactId={contactId} />}
          </TabsContent>
        ))}
      </Tabs>
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
