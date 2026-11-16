import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDay } from "@/data/accountPage";
import { useFirmReady, type ColumnDefinition, type FieldChoice, type FieldDefinitions, type TableDefinition, type TableQuery, type TableView } from "@/components/workspace/table";
import { listFirmMembers, type FirmMemberChoice } from "@/lib/accountsApi";
import { countInboxViews, INBOX_FIELDS, listInbox, type InboxField, type InboxFilter, type InboxPage, type InboxRow } from "@/lib/inboxApi";
import type { ViewCount } from "@/lib/tableQuery";

// The inbox (story CRM-E1.4, slice 6.5) as a workspace table: its columns, views, filters and the two calls to the database. The frame
// (src/components/workspace/table/) does the rest, as it does for the leads table (src/components/leads/leadsTable.tsx).

type Fields = typeof INBOX_FIELDS;

/** The page's words for its states (CRM-E1.4). */
export const INBOX_WORDS = {
  nothingYet: "Emails with PEOs, contacts and leads will be listed here",
  nothingNew: "Nothing new",
} as const;

const dash = <span className="text-muted-foreground">—</span>;
const LINK = "text-primary hover:underline";

const FIELD_LABELS: Record<InboxField, string> = {
  kind: "Thread",
  direction: "Direction",
  is_new: "New",
  owner: "Owner",
  account: "Account",
};

const FIELD_CHOICES: Partial<Record<InboxField, readonly FieldChoice[]>> = {
  kind: [{ value: "peo", label: "A PEO" }, { value: "contact", label: "A contact" }, { value: "lead", label: "A lead" }],
  direction: [{ value: "received", label: "Received" }, { value: "sent", label: "Sent" }],
};

const fieldsWith = (owners: readonly FieldChoice[] | undefined) =>
  Object.fromEntries(
    (Object.keys(INBOX_FIELDS) as InboxField[]).map((id) => [id, {
      label: FIELD_LABELS[id],
      kind: INBOX_FIELDS[id],
      ...(id === "owner" && owners ? { choices: owners } : FIELD_CHOICES[id] ? { choices: FIELD_CHOICES[id], choicesEnforced: true } : {}),
    }]),
  ) as FieldDefinitions<Fields>;

const KIND_WORDS: Record<InboxRow["kind"], string> = { peo: "a PEO", contact: "a contact", lead: "a lead" };

/**
 * The record a message opens on (CRM-E1.4): a contact's page; a PEO thread's submission, whose page holds the thread; a lead's page (slice 8.5, which replaced
 * D-696's Leads page searched to the lead).
 */
export const recordPath = (row: InboxRow): string => {
  if (row.kind === "peo") return `/advisor/submissions/${row.session_id}`;
  if (row.kind === "lead") return `/leads/${row.lead_id}`;
  return `/contacts/${row.contact_id}`;
};

/** Its kind in words: which way it went, and whose thread it is on. */
export const kindInWords = (row: InboxRow): string => `${row.direction === "received" ? "From" : "To"} ${KIND_WORDS[row.kind]}`;

/** What the message is about, each part a link to its record where it has one. */
const about = (row: InboxRow) => {
  const account = row.account_name
    ? row.account_id ? <Link to={`/accounts/${row.account_id}`} className={LINK}>{row.account_name}</Link> : <span>{row.account_name}</span>
    : null;
  if (row.kind === "contact") {
    return (
      <>
        <p className="text-sm">{row.contact_id ? <Link to={`/contacts/${row.contact_id}`} className={LINK}>{row.contact_name ?? row.from_address}</Link> : row.contact_name}</p>
        {account && <p className="text-xs text-muted-foreground">{account}</p>}
      </>
    );
  }
  if (row.kind === "lead") {
    return (
      <>
        <p className="text-sm">{row.lead_id ? <Link to={recordPath(row)} className={LINK}>{row.lead_name}</Link> : row.lead_name}</p>
        {account && <p className="text-xs text-muted-foreground">{account}</p>}
      </>
    );
  }
  return (
    <>
      <p className="text-sm">{row.session_id ? <Link to={`/advisor/submissions/${row.session_id}`} className={LINK}>{row.peo_name}</Link> : row.peo_name}</p>
      {account && <p className="text-xs text-muted-foreground">{account}</p>}
    </>
  );
};

// Each column's `id` could be kept in a person's column choice later: never rename or reuse one once shipped.
const inboxColumns: ColumnDefinition<InboxRow, keyof Fields>[] = [
  {
    id: "from", header: "From", isName: true,
    text: (row) => row.from_name ?? row.from_address,
    cell: (row) => (
      <>
        <p className={row.is_new ? "font-semibold text-foreground" : "font-medium text-foreground"}>{row.from_name ?? row.from_address}</p>
        {row.from_name && <p className="text-xs text-muted-foreground break-all">{row.from_address}</p>}
      </>
    ),
  },
  {
    id: "about", header: "About", filterField: "account",
    text: (row) => [row.contact_name ?? row.lead_name ?? row.peo_name, row.account_name].filter(Boolean).join(", "),
    cell: (row) => about(row),
  },
  {
    id: "message", header: "Message",
    text: (row) => row.subject ?? "",
    cell: (row) => (
      <>
        <p className="text-sm">{row.subject || dash}</p>
        {row.first_line && <p className="text-xs text-muted-foreground">{row.first_line}</p>}
      </>
    ),
  },
  {
    id: "kind", header: "Kind", filterField: "kind",
    text: (row) => kindInWords(row),
    cell: (row) => <span className="text-sm">{kindInWords(row)}</span>,
  },
  {
    id: "when", header: "When",
    text: (row) => row.at.slice(0, 10),
    cell: (row) => <span className="text-sm">{formatDay(row.at)}</span>,
  },
];

/** The story's views (CRM-E1.4). "All" is the tab that is no view. */
export const INBOX_VIEWS: TableView<Fields>[] = [
  { id: "new", label: "New", filters: [{ field: "is_new", op: "is", value: true }] },
  { id: "from_peos", label: "From PEOs", filters: [{ field: "kind", op: "any_of", value: ["peo"] }, { field: "direction", op: "any_of", value: ["received"] }] },
  {
    id: "from_contacts", label: "From contacts and leads",
    filters: [{ field: "kind", op: "any_of", value: ["contact", "lead"] }, { field: "direction", op: "any_of", value: ["received"] }],
  },
  { id: "sent", label: "Sent", filters: [{ field: "direction", op: "any_of", value: ["sent"] }] },
];

export type InboxTableDefinition = TableDefinition<Fields, InboxRow>;

export const INBOX_TABLE: InboxTableDefinition = {
  id: "inbox",
  noun: { singular: "message", plural: "messages" },
  fields: fieldsWith(undefined),
  columns: inboxColumns,
  listedFilters: ["owner", "account"],
  rowKey: (row) => row.id,
  views: INBOX_VIEWS,
  allViewLabel: "All",
  defaultSort: null,
  defaultSortLabel: "Newest first",
  defaultSortReset: "Back to newest first",
  searchMinChars: 2,
  searchHint: "Search covers who sent it, its subject and its account, never what it says.",
};

export interface InboxTable {
  table: InboxTableDefinition;
  /** The words for a person the Owner filter names (never an id). */
  names: (id: string) => string | undefined;
}

/** The inbox with the firm's people as the Owner filter's choices. */
export const useInboxTable = (): InboxTable => {
  const { firmId, ready } = useFirmReady();
  const members = useQuery<FirmMemberChoice[]>({
    queryKey: ["table", firmId, INBOX_TABLE.id, "context", "members"],
    queryFn: () => listFirmMembers(firmId),
    enabled: ready,
    retry: false,
    staleTime: 60_000,
  });
  return useMemo(() => {
    const people = members.data;
    const table: InboxTableDefinition = people ? { ...INBOX_TABLE, fields: fieldsWith(people) } : INBOX_TABLE;
    const byId = new Map((people ?? []).map((p) => [p.value, p.label]));
    const settled = !members.isPending;
    return { table, names: (id: string) => byId.get(id) ?? (settled ? "A member" : undefined) };
  }, [members.data, members.isPending]);
};

/** The page's one call for rows: the effective query (the view's filters and the address's together), for the firm. */
export const fetchInboxPage = (firmId: string | null) => (query: TableQuery<Fields>): Promise<InboxPage> =>
  listInbox({ firmId, filters: query.filters as InboxFilter[], page: query.page, search: query.search });

/** The counts of the tabs, under the same filters and search. */
export const countInboxTabs = (firmId: string | null) =>
  (views: { name: string; filters: TableQuery<Fields>["filters"] }[], opts: { search: string }): Promise<ViewCount[]> =>
    countInboxViews(firmId, views as { name: string; filters: InboxFilter[] }[], opts);
