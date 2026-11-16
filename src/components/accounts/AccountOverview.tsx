import type { AccountFields, AccountPage } from "@/lib/accountPageApi";
import { AccountDetailsPanel } from "./AccountDetails";
import { AddContactButton, ContactsEmpty } from "./ActivityEntry";
import { activityColumns, contactColumns, EMPTY_WORDS, opportunityColumns, quoteColumns, tabAddress } from "./accountColumns";
import { EmptyLine, ListPanel, Rows, SeeAll } from "./accountLists";
import { RenewalsPanel } from "./AccountRenewals";

/**
 * The Overview (screen 17): the account's details down one side and, beside them, the first five rows of its contacts, opportunities and quotes and its recent
 * activity, each with "See all", which opens its tab. The Renewals panel (D-454) shows the first five and reads its own list; the Files list is its own tab. The rows are the page's own: one read.
 */
export function AccountOverview({ firmId, page, onSaved }: { firmId: string; page: AccountPage; onSaved: (fields: AccountFields) => void }) {
  const { account, canChange, tabs } = page;
  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] items-start">
      <AccountDetailsPanel key={account.id} firmId={firmId} account={account} canChange={canChange} onSaved={onSaved} />
      <div className="space-y-6 min-w-0">
        <ListPanel id="overview-contacts" heading="Contacts" count={tabs.contacts.count} seeAll={<span className="flex items-center gap-3">{tabs.contacts.count > 0 && <SeeAll to={tabAddress("contacts")} noun="contacts" />}<AddContactButton /></span>}>
          {tabs.contacts.rows.length === 0 ? <ContactsEmpty words={EMPTY_WORDS.contacts} /> : <Rows caption="The first contacts" columns={contactColumns} rows={tabs.contacts.rows} rowKey={(r) => r.id} />}
        </ListPanel>
        <ListPanel id="overview-opportunities" heading="Opportunities" count={tabs.opportunities.count} seeAll={tabs.opportunities.count > 0 ? <SeeAll to={tabAddress("opportunities")} noun="opportunities" /> : undefined}>
          {tabs.opportunities.rows.length === 0 ? <EmptyLine>{EMPTY_WORDS.opportunities}</EmptyLine> : <Rows caption="The first opportunities" columns={opportunityColumns} rows={tabs.opportunities.rows} rowKey={(r) => r.id} />}
        </ListPanel>
        <ListPanel id="overview-quotes" heading="Quotes" count={tabs.quotes.count} seeAll={tabs.quotes.count > 0 ? <SeeAll to={tabAddress("quotes")} noun="quotes" /> : undefined}>
          {tabs.quotes.rows.length === 0
            ? <EmptyLine>{tabs.opportunities.count > 0 ? EMPTY_WORDS.quotesNoneSent : EMPTY_WORDS.quotes}</EmptyLine>
            : <Rows caption="The latest quotes" columns={quoteColumns} rows={tabs.quotes.rows} rowKey={(r) => String(r.id)} />}
        </ListPanel>
        <RenewalsPanel key={account.id} firmId={firmId} accountId={account.id} first />
        <ListPanel id="overview-activity" heading="Recent activity" count={tabs.activity.count} seeAll={tabs.activity.count > 0 ? <SeeAll to={tabAddress("activity")} noun="activity" /> : undefined}>
          {tabs.activity.rows.length === 0 ? <EmptyLine>{EMPTY_WORDS.activity}</EmptyLine> : <Rows caption="Recent activity" columns={activityColumns} rows={tabs.activity.rows} rowKey={(r) => r.entryKey} />}
        </ListPanel>
      </div>
    </div>
  );
}
