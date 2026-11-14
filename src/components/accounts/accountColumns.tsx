import { Link } from "react-router-dom";
import type { ActivityRow, ContactRow, OpportunityRow, QuoteRow } from "@/lib/accountPageApi";
import { activityWords, contactName, formatDay, NOT_GIVEN, quoteStatusLabel, STAGE_LABELS } from "@/data/accountPage";
import { Pill, type Column } from "./accountLists";

// What each of an account's lists shows and where each name goes (story CRM-A2.1b), drawn once for the Overview's first five and for each tab's whole list.
// Every name opens its record (D-187): an opportunity and a quote open their submission's page until the opportunity has a page of its own; a contact's
// own page is CRM-C1.1's, so a contact's name opens the Contacts tab with that contact in view until then.

export const submissionPath = (submissionId: string) => `/advisor/submissions/${submissionId}`;

/** Where the Contacts tab is, with one contact in view when given. */
export const contactsAddress = (contactId?: string) => `?tab=contacts${contactId ? `&contact=${encodeURIComponent(contactId)}` : ""}`;

export const TAB_IDS = ["overview", "contacts", "opportunities", "quotes", "activity", "files"] as const;
export type TabId = (typeof TAB_IDS)[number];
export const TAB_LABELS: Record<TabId, string> = {
  overview: "Overview", contacts: "Contacts", opportunities: "Opportunities", quotes: "Quotes", activity: "Activity", files: "Files",
};
export const tabAddress = (tab: TabId) => (tab === "overview" ? "?" : `?tab=${tab}`);

const muted = (words: string) => <span className="text-muted-foreground">{words}</span>;
const linkClass = "text-primary underline underline-offset-2 hover:text-primary/90";

export const contactColumns: Column<ContactRow>[] = [
  {
    header: "Name",
    cell: (c) => (
      <span className="flex flex-wrap items-center gap-2">
        <Link to={contactsAddress(c.id)} className={linkClass}>{contactName(c)}</Link>
        {c.isMain && <Pill>Main</Pill>}
      </span>
    ),
  },
  { header: "Title", cell: (c) => c.title ?? muted(NOT_GIVEN) },
  { header: "Email", cell: (c) => (c.email ? <span className="break-all">{c.email}</span> : muted(NOT_GIVEN)) },
  { header: "Phone", cell: (c) => c.phone ?? c.mobile ?? muted(NOT_GIVEN), className: "whitespace-nowrap" },
];

export const opportunityColumns: Column<OpportunityRow>[] = [
  {
    header: "Opportunity",
    // The opportunity's own page is Epic 4's (D-187): its submission's page opens until then, and a name with none is plain text.
    cell: (o) => (o.submissionId ? <Link to={submissionPath(o.submissionId)} className={linkClass}>{o.name}</Link> : <span className="font-medium">{o.name}</span>),
  },
  { header: "Stage", cell: (o) => <Pill>{STAGE_LABELS[o.stage]}</Pill> },
  { header: "Target start", cell: (o) => (o.targetStart ? formatDay(o.targetStart) : muted(NOT_GIVEN)), className: "whitespace-nowrap" },
];

const notYet = muted("Not yet");
export const quoteColumns: Column<QuoteRow>[] = [
  { header: "PEO", cell: (q) => <Link to={submissionPath(q.submissionId)} className={linkClass}>{q.peoName}</Link> },
  { header: "Opportunity", cell: (q) => q.opportunityName },
  { header: "Status", cell: (q) => <Pill>{quoteStatusLabel(q.status)}</Pill> },
  { header: "Sent", cell: (q) => (q.sentOn ? formatDay(q.sentOn) : notYet), className: "whitespace-nowrap" },
  { header: "Quote received", cell: (q) => (q.quoteReceivedOn ? formatDay(q.quoteReceivedOn) : notYet), className: "whitespace-nowrap" },
  { header: "Expires", cell: (q) => (q.quoteExpiresOn ? formatDay(q.quoteExpiresOn) : notYet), className: "whitespace-nowrap" },
];

export const activityColumns: Column<ActivityRow>[] = [
  { header: "When", cell: (a) => formatDay(a.at), className: "whitespace-nowrap text-muted-foreground" },
  { header: "Kind", cell: () => <span className="font-medium">Change</span> },
  { header: "What happened", cell: (a) => activityWords(a) },
  { header: "By", cell: (a) => <span className="break-all">{a.who}</span> },
];


/**
 * What a list with nothing in it says, in the story's words. An action that does not exist yet (Add a contact is CRM-A2.2's, New opportunity and New quote
 * are later) is left out and its words kept: "No contacts yet." never "No contacts yet. Add a contact", which would point at nothing.
 */
export const EMPTY_WORDS = {
  contacts: "No contacts yet.",
  opportunities: "No opportunities yet.",
  quotes: "No quotes yet.",
  // Opportunities exist and none has been sent (the "No quotes" state).
  quotesNoneSent: "No quotes yet. Quotes appear when an opportunity is sent to a PEO.",
  activity: "No activity yet.",
  files: "No files yet. Files uploaded with an intake appear here once they pass the virus check.",
} as const;

