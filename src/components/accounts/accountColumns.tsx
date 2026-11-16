import { Link } from "react-router-dom";
import type { ActivityRow, ContactRow, OpportunityRow, QuoteRow } from "@/lib/accountPageApi";
import { contactName, formatDay, formatWhen, KIND_LABELS, NOT_GIVEN, quoteStatusLabel, STAGE_LABELS } from "@/data/accountPage";
import { ActivityActions, ActivityWhat, ContactActions } from "./ActivityEntry";
import { Pill, type Column } from "./accountLists";

// What each of an account's lists shows and where each name goes (story CRM-A2.1b), drawn once for the Overview's first five and for each tab's whole list.
// Every name opens its record: an opportunity's name opens its own page (CRM-O1.1b, `/opportunities/:id`, D-430, which replaces D-187); a quote's PEO opens its
// submission's page until the quote has a page of its own (Epic 5); a contact's name opens the contact's page (CRM-C1.1, `/contacts/:id`).

export const submissionPath = (submissionId: string) => `/advisor/submissions/${submissionId}`;

/** An opportunity's own page (CRM-O1.1b). */
export const opportunityPath = (opportunityId: string) => `/opportunities/${encodeURIComponent(opportunityId)}`;

/** A contact's own page (CRM-C1.1). */
export const contactPath = (contactId: string) => `/contacts/${encodeURIComponent(contactId)}`;

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
        <Link to={contactPath(c.id)} className={linkClass}>{contactName(c)}</Link>
        {c.isMain && <Pill>Main</Pill>}
      </span>
    ),
  },
  { header: "Title", cell: (c) => c.title ?? muted(NOT_GIVEN) },
  { header: "Email", cell: (c) => (c.email ? <span className="break-all">{c.email}</span> : muted(NOT_GIVEN)) },
  { header: "Phone", cell: (c) => c.phone ?? c.mobile ?? muted(NOT_GIVEN), className: "whitespace-nowrap" },
  { header: "Actions", cell: (c) => <ContactActions contact={c} /> },
];

export const opportunityColumns: Column<OpportunityRow>[] = [
  {
    header: "Opportunity",
    cell: (o) => <Link to={opportunityPath(o.id)} className={linkClass}>{o.name}</Link>,
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
  { header: "When", cell: (a) => (a.type === "change" ? formatDay(a.at) : formatWhen(a.at)), className: "whitespace-nowrap text-muted-foreground" },
  { header: "Kind", cell: (a) => <span className="font-medium">{KIND_LABELS[a.type]}</span> },
  { header: "What happened", cell: (a) => <ActivityWhat row={a} /> },
  { header: "By", cell: (a) => <span className="break-all">{a.who ?? "Someone who has left"}</span> },
  { header: "Actions", cell: (a) => <ActivityActions row={a} /> },
];


/**
 * What a list with nothing in it says, in the story's words. An action that does not exist yet (New opportunity and New quote are later) is left out and its words
 * kept. "Add a contact" (CRM-A2.2) is drawn beside "No contacts yet." by `ContactsEmpty`, where a contact can be added.
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

