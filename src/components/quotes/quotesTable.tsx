import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { formatDay, today } from "@/data/accountPage";
import { dollarsWords } from "@/data/opportunityPage";
import { daysWaiting, quoteIsExpired, quoteRowStatusWords } from "@/data/quotes";
import { useFirmReady, useSavedViewList, withSavedViews, type ColumnDefinition, type FieldChoice, type FieldDefinitions, type TableDefinition, type TableQuery, type TableView } from "@/components/workspace/table";
import { listFirmMembers, type FirmMemberChoice } from "@/lib/accountsApi";
import { countQuoteViews, listQuotes, QUOTE_FIELDS, QUOTE_ROW_STATUSES, type QuoteField, type QuoteFilter, type QuoteRow, type QuotesPage } from "@/lib/quotesApi";
import type { ExportValue } from "@/lib/exportApi";
import type { ShownColumn } from "@/lib/exportFile";
import type { ViewCount } from "@/lib/tableQuery";

// The quotes table (story CRM-Q4.1, slice 5.11, screen 2) as a workspace table: its columns, views, filters and the two calls to the database. The frame
// (src/components/workspace/table/) does the rest, as it does for the leads table (src/components/leads/leadsTable.tsx) and the accounts table.

type Fields = typeof QUOTE_FIELDS;

const dash = <span className="text-muted-foreground">—</span>;

const FIELD_LABELS: Record<QuoteField, string> = {
  account_name: "Account",
  opportunity_name: "Opportunity",
  peo: "PEO",
  file_id: "File ID",
  admin_fee_pepm: "Admin fee PEPM",
  sent_version: "Version sent",
  days_waiting: "Days waiting",
  emails: "Emails",
  sent_on: "Sent",
  expires_on: "Expires",
  proposed_start: "Proposed start",
  target_start: "Target start",
  status: "Status",
  owner: "Owner",
  new_mail: "Has new mail",
};

const FIELD_CHOICES: Partial<Record<QuoteField, readonly FieldChoice[]>> = {
  status: QUOTE_ROW_STATUSES.map((value) => ({ value, label: quoteRowStatusWords(value) })),
};

const fieldsWith = (owners: readonly FieldChoice[] | undefined) =>
  Object.fromEntries(
    (Object.keys(QUOTE_FIELDS) as QuoteField[]).map((id) => [id, {
      label: FIELD_LABELS[id],
      kind: QUOTE_FIELDS[id],
      ...(id === "owner" && owners ? { choices: owners } : FIELD_CHOICES[id] ? { choices: FIELD_CHOICES[id], choicesEnforced: true } : {}),
    }]),
  ) as FieldDefinitions<Fields>;

// Each column's `id` is kept in the database in a person's column choice (CRM-S3.1a): never rename or reuse one once shipped.
const quoteColumns: ColumnDefinition<QuoteRow, keyof Fields>[] = [
  {
    id: "account", header: "Account", isName: true, sortField: "account_name", filterField: "account_name",
    text: (row) => row.account_name,
    cell: (row) => <Link to={`/opportunities/${row.opportunity_id}`} className="font-medium text-foreground hover:text-primary">{row.account_name}</Link>,
  },
  {
    id: "peo", header: "PEO", sortField: "peo", filterField: "peo",
    text: (row) => row.peo ?? "",
    // The quote's own page (slice 5.9): linked by its path, which that slice's route answers.
    cell: (row) => (row.peo && row.quote_request_id !== null ? <Link to={`/quotes/${row.quote_request_id}`} className="text-sm text-foreground hover:text-primary">{row.peo}</Link> : dash),
  },
  {
    id: "status", header: "Status", sortField: "status", filterField: "status",
    text: (row) => quoteRowStatusWords(row.status),
    cell: (row) => (
      <>
        <p className="text-sm">{quoteRowStatusWords(row.status)}</p>
        {quoteIsExpired(row, today()) && <p className="text-xs text-destructive">Expired</p>}
      </>
    ),
  },
  {
    id: "sent", header: "Sent", sortField: "sent_on", filterField: "sent_on",
    text: (row) => row.sent_on ?? "",
    cell: (row) => <span className="text-sm">{row.sent_on ? formatDay(row.sent_on) : dash}</span>,
  },
  {
    id: "admin_fee", header: "Admin fee PEPM", align: "right", sortField: "admin_fee_pepm", filterField: "admin_fee_pepm",
    text: (row) => (row.admin_fee_pepm === null ? "" : String(row.admin_fee_pepm)),
    cell: (row) => <span className="font-mono text-sm">{row.admin_fee_pepm === null ? "—" : dollarsWords(row.admin_fee_pepm)}</span>,
  },
  {
    id: "expires", header: "Expires", sortField: "expires_on", filterField: "expires_on",
    text: (row) => row.expires_on ?? "",
    cell: (row) => <span className="text-sm">{row.expires_on ? formatDay(row.expires_on) : dash}</span>,
  },
  {
    id: "owner", header: "Owner", sortField: "owner", filterField: "owner",
    text: (row) => row.owner_name ?? "",
    cell: (row) => <span className="text-sm">{row.owner_name ?? <span className="text-muted-foreground">No owner</span>}</span>,
  },
  {
    id: "opportunity", header: "Opportunity", sortField: "opportunity_name", filterField: "opportunity_name",
    text: (row) => row.opportunity_name,
    cell: (row) => <span className="text-sm">{row.opportunity_name}</span>,
  },
  {
    id: "version", header: "Version sent", align: "right", sortField: "sent_version", filterField: "sent_version",
    text: (row) => (row.sent_version === null ? "" : String(row.sent_version)),
    cell: (row) => <span className="font-mono text-sm">{row.sent_version ?? "—"}</span>,
  },
  {
    id: "proposed_start", header: "Proposed start", sortField: "proposed_start", filterField: "proposed_start",
    text: (row) => row.proposed_start ?? "",
    cell: (row) => <span className="text-sm">{row.proposed_start ? formatDay(row.proposed_start) : dash}</span>,
  },
  {
    id: "target_start", header: "Target start", sortField: "target_start", filterField: "target_start",
    text: (row) => row.target_start ?? "",
    cell: (row) => <span className="text-sm">{row.target_start ? formatDay(row.target_start) : dash}</span>,
  },
  {
    id: "file_id", header: "File ID", sortField: "file_id", filterField: "file_id",
    text: (row) => row.file_id ?? "",
    cell: (row) => <span className="font-mono text-sm">{row.file_id ?? "—"}</span>,
  },
  {
    // Counted as the database does: open requests only (no wait is kept on a quote that is back or closed), from the day it was sent.
    id: "days_waiting", header: "Days waiting", align: "right", sortField: "days_waiting", filterField: "days_waiting",
    text: (row) => String(daysWaiting(row) ?? ""),
    cell: (row) => <span className="font-mono text-sm">{daysWaiting(row) ?? "—"}</span>,
  },
  {
    id: "emails", header: "Emails", align: "right", sortField: "emails", filterField: "emails",
    text: (row) => String(row.emails),
    cell: (row) => <span className="font-mono text-sm">{row.emails}</span>,
  },
];

/** The columns shown until a person chooses their own. The others are under Columns. */
const USUAL_COLUMNS = ["account", "peo", "status", "sent", "admin_fee", "expires", "owner"] as const;

/**
 * The story's views (CRM-Q4.1). Waiting on a PEO is 5.1's open statuses (D-1736: sent, acknowledged, question open: the menu's count, the glossary's "open");
 * Open is everything not finished: those, the New quotes not sent yet (D-1702) and the quotes that are back and not yet closed; Declined and Closed are finished.
 */
export const QUOTE_VIEWS: TableView<Fields>[] = [
  { id: "open", label: "Open", filters: [{ field: "status", op: "any_of", value: ["not_sent", "sent", "acknowledged", "question_open", "quoted"] }] },
  { id: "not_sent", label: "Not sent yet", filters: [{ field: "status", op: "any_of", value: ["not_sent"] }] },
  { id: "waiting", label: "Waiting on a PEO", filters: [{ field: "status", op: "any_of", value: ["sent", "acknowledged", "question_open"] }] },
  { id: "quoted", label: "Quoted", filters: [{ field: "status", op: "any_of", value: ["quoted"] }] },
  { id: "declined", label: "Declined", filters: [{ field: "status", op: "any_of", value: ["declined"] }] },
  { id: "closed", label: "Closed", filters: [{ field: "status", op: "any_of", value: ["closed"] }] },
];

export type QuotesTableDefinition = TableDefinition<Fields, QuoteRow>;

export const QUOTES_TABLE: QuotesTableDefinition = {
  id: "quotes",
  noun: { singular: "quote", plural: "quotes" },
  fields: fieldsWith(undefined),
  columns: quoteColumns,
  usual: USUAL_COLUMNS,
  listedFilters: ["owner", "status"],
  rowKey: (row) => row.key,
  views: QUOTE_VIEWS,
  allViewLabel: "All quotes",
  // The table's own order: what needs the agent first (D-1705), which no single column shows.
  defaultSort: null,
  defaultSortLabel: "Needs me first",
  defaultSortReset: "Back to needs me first",
  searchMinChars: 2,
  searchHint: "Search covers an account, a PEO and a File ID.",
};

export interface QuotesTable {
  table: QuotesTableDefinition;
  /** The words for a person the Owner filter names (never an id). */
  names: (id: string) => string | undefined;
}

/** The quotes table with the firm's people as the Owner filter's choices and its saved views after the built-in ones, as the leads table has them. */
export const useQuotesTable = (): QuotesTable => {
  const { firmId, ready } = useFirmReady();
  const members = useQuery<FirmMemberChoice[]>({
    queryKey: ["table", firmId, QUOTES_TABLE.id, "context", "members"],
    queryFn: () => listFirmMembers(firmId),
    enabled: ready,
    retry: false,
    staleTime: 60_000,
  });
  const { saved, status } = useSavedViewList(QUOTES_TABLE.id);
  return useMemo(() => {
    const people = members.data;
    const base: QuotesTableDefinition = people ? { ...QUOTES_TABLE, fields: fieldsWith(people) } : QUOTES_TABLE;
    const byId = new Map((people ?? []).map((p) => [p.value, p.label]));
    const settled = !members.isPending;
    return { table: withSavedViews(base, saved, status), names: (id: string) => byId.get(id) ?? (settled ? "A member" : undefined) };
  }, [members.data, members.isPending, saved, status]);
};

/** The page's one call for rows: the effective query (the view's filters and the address's together), for the firm. */
export const fetchQuotesPage = (firmId: string | null) => (query: TableQuery<Fields>): Promise<QuotesPage> =>
  listQuotes({ firmId, filters: query.filters as QuoteFilter[], sort: query.sort, page: query.page, search: query.search });

/** The counts of the tabs, under the same filters and search. */
export const countQuotesViews = (firmId: string | null) =>
  (views: { name: string; filters: TableQuery<Fields>["filters"] }[], opts: { search: string }): Promise<ViewCount[]> =>
    countQuoteViews(firmId, views as { name: string; filters: QuoteFilter[] }[], opts);

/**
 * The export's columns for the ones the page shows, in its order, each as the page words it (the database gives a column of its own for each:
 * export_source_quotes). A column that isn't here has no export.
 */
export const quoteExportColumnsFor = (shown: readonly { id: string; header: string }[]): ShownColumn[] => {
  const known: Record<string, { id: string; text?: (row: Record<string, ExportValue>) => string }> = {
    account: { id: "account" },
    peo: { id: "peo" },
    status: { id: "status" },
    sent: { id: "sent_on" },
    admin_fee: { id: "admin_fee_pepm" },
    expires: { id: "expires_on" },
    owner: { id: "owner" },
    opportunity: { id: "opportunity" },
    version: { id: "sent_version" },
    proposed_start: { id: "proposed_start" },
    target_start: { id: "target_start" },
    file_id: { id: "file_id" },
    emails: { id: "emails" },
  };
  return shown.filter((c) => known[c.id]).map((c) => ({ id: known[c.id].id, heading: c.header, ...(known[c.id].text ? { text: known[c.id].text } : {}) }));
};
