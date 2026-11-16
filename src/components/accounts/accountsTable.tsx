import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { US_STATE_CODES } from "@/data/chamberValidation";
import { formatDay, locationOf, SOURCE_LABELS, STAGE_LABELS, STATUS_LABELS } from "@/data/accountPage";
import { daysSince } from "@/data/quoteRequests";
import { daysAwayWords, daysFromToday } from "@/data/renewals";
import { Pill } from "@/components/accounts/accountLists";
import {
  useFirmReady, useSavedViewList, withSavedViews, type ColumnDefinition, type FieldChoice, type FieldDefinitions, type TableDefinition, type TableQuery, type TableView,
} from "@/components/workspace/table";
import {
  ACCOUNT_FIELDS, ACCOUNT_OPEN_STAGES, ACCOUNT_SOURCES, ACCOUNT_STATUSES, countAccountViews, listAccounts, listFirmMembers,
  type AccountField, type AccountFilter, type AccountRow, type AccountsPage, type FirmMemberChoice,
} from "@/lib/accountsApi";
import type { ShownColumn } from "@/lib/exportFile";
import type { ExportValue } from "@/lib/exportApi";
import { firmLabels } from "@/lib/bulkChangeApi";
import type { ViewCount } from "@/lib/tableQuery";

// The accounts table (story CRM-A1.1a, screen 16) as a workspace table: its columns, its views, its filters and the two calls to the database. The frame
// (src/components/workspace/table/) does the rest, as it does for the queue (src/components/advisor/queueTable.tsx). The database cuts the pages and runs
// the filters (D-44; supabase/migrations/20261119130000_accounts_table_query.sql).

/**
 * The renewal's two fields (CRM-A2.4a, shown by CRM-A2.4b): `renewal_date` is the Renewal column's (sorted and filtered), `renewing_in_120_days` has no column of its
 * own: it is only the filter the "Renewing in 120 days" view holds (D-450), and "Add filter" offers it too.
 */
type ScreenField = AccountField;
type Fields = typeof ACCOUNT_FIELDS;
const SCREEN_FIELDS = Object.keys(ACCOUNT_FIELDS) as AccountField[];

const dash = <span className="text-muted-foreground">—</span>;

const FIELD_LABELS: Record<ScreenField, string> = {
  name: "Account name",
  trade_name: "Trade name",
  website: "Website",
  city: "City",
  industry: "Industry",
  current_provider: "Current provider",
  opportunity_name: "Opportunity name",
  employees: "Employees",
  open_opportunities: "Open opportunities",
  quote_requests_sent: "Quote requests sent",
  quotes_received: "Quotes back",
  created_at: "Created",
  last_activity_at: "Last activity",
  target_start: "Target start",
  earliest_quote_expires_on: "Earliest quote expiry",
  state: "State",
  source: "Source",
  status: "Status",
  opportunity_stage: "Opportunity stage",
  states_of_operation: "States of operation",
  labels: "Label",
  archived: "Archived",
  waiting_on_peo: "Waiting on a PEO",
  owner: "Owner",
  renewal_date: "Renewal date",
  renewing_in_120_days: "Renewing in 120 days",
};

/** The values of the choice fields, as the database lists them (accounts_field_choices), with their words. */
const FIELD_CHOICES: Partial<Record<AccountField, readonly FieldChoice[]>> = {
  source: ACCOUNT_SOURCES.map((value) => ({ value, label: SOURCE_LABELS[value] })),
  status: ACCOUNT_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] })),
  opportunity_stage: ACCOUNT_OPEN_STAGES.map((value) => ({ value, label: STAGE_LABELS[value] })),
  // The state codes the database takes (`is_us_state_code`); a code reads as itself.
  state: US_STATE_CODES.map((value) => ({ value, label: value })),
  states_of_operation: US_STATE_CODES.map((value) => ({ value, label: value })),
};
/** The lists the database refuses a value outside of. */
const ENFORCED_CHOICES: readonly AccountField[] = ["source", "status", "opportunity_stage", "state", "states_of_operation"];

/** Where a first click on a header starts: the most quote requests first (an account with none would otherwise fill the first page). */
const FIRST_DIRECTIONS: Partial<Record<AccountField, "asc" | "desc">> = { quote_requests_sent: "desc", earliest_quote_expires_on: "asc" };

const fieldsWith = (owners: readonly FieldChoice[] | undefined, labels?: readonly FieldChoice[]) =>
  Object.fromEntries(
    SCREEN_FIELDS.map((id) => [id, {
      label: FIELD_LABELS[id],
      kind: ACCOUNT_FIELDS[id],
      // The firm's own labels are the Label filter's choices, never an enforced list: a word the firm no longer has still matches (nothing), as the database takes it.
      ...(id === "owner" && owners ? { choices: owners } : id === "labels" && labels ? { choices: labels } : FIELD_CHOICES[id] ? { choices: FIELD_CHOICES[id] } : {}),
      ...(FIELD_CHOICES[id] && ENFORCED_CHOICES.includes(id) ? { choicesEnforced: true } : {}),
      ...(FIRST_DIRECTIONS[id] ? { firstDirection: FIRST_DIRECTIONS[id] } : {}),
    }]),
  ) as FieldDefinitions<Fields>;

// ---------- the words of the cells (also the export's) ----------

/** "Jan 2027" from a target start (a day), or null. */
const monthOf = (day: string | null): string | null => {
  const m = day ? /^(\d{4})-(\d{2})-\d{2}$/.exec(day) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : null;
};

/** What the Opportunity column says under its stage: "Jan 2027 start", or "No start date". */
export const startWords = (day: string | null): string => (monthOf(day) ? `${monthOf(day)} start` : "No start date");

/** The Quotes column: how many came back of those asked for, or why there are none. */
export const quotesWords = (row: Pick<AccountRow, "open_opportunities" | "quote_requests_sent" | "quotes_received">): string =>
  row.open_opportunities === 0 ? "None open" : row.quote_requests_sent === 0 ? "None sent" : `${row.quotes_received} of ${row.quote_requests_sent} back`;

/** When the nearest quote expires, in words: "One expires in 4 days" while it is near (screen 16), else the day. `soon` marks one that is near or past. */
export const expiryWords = (day: string, now: Date = new Date()): { text: string; soon: boolean } => {
  const left = -daysSince(day, now);
  if (left < 0) return { text: `Expired ${formatDay(day)}`, soon: true };
  if (left === 0) return { text: "Expires today", soon: true };
  if (left <= 14) return { text: `One expires in ${left} day${left === 1 ? "" : "s"}`, soon: left <= 7 };
  return { text: `Expires ${formatDay(day)}`, soon: false };
};

const contactLine = (row: Pick<AccountRow, "main_contact_email" | "main_contact_phone">) => row.main_contact_email ?? row.main_contact_phone;
const opportunityText = (row: Pick<AccountRow, "opportunity_stage" | "target_start" | "open_opportunities">): string =>
  row.opportunity_stage === null ? "None open" : `${STAGE_LABELS[row.opportunity_stage]}, ${startWords(row.target_start)}${row.open_opportunities > 1 ? `, +${row.open_opportunities - 1} more` : ""}`;

const isoDay = (moment: string) => moment.slice(0, 10);

/** The Renewal column in words: the day and how far away it is ("Jan 1, 2027, in 50 days"), or "None on file". */
const renewalText = (row: Pick<AccountRow, "renewal_date">): string => (row.renewal_date === null ? "None on file" : `${formatDay(row.renewal_date)}, ${daysAwayWords(daysFromToday(row.renewal_date))}`);

// Each column's `id` is kept in the database in a person's column choice (CRM-S3.1a): never rename or reuse one once shipped. A column added later is hidden
// for a person who has a kept choice until they show it from the Columns menu. `usual` (below) says which show until a person chooses.
const accountColumns: ColumnDefinition<AccountRow, keyof Fields>[] = [
  {
    id: "account",
    header: "Account",
    isName: true,
    sortField: "name",
    filterField: "name",
    text: (row) => row.name,
    cell: (row) => (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/accounts/${row.id}`} className="font-medium text-foreground hover:text-primary">{row.name}</Link>
          {/* A client and a former client are marked (D-451, D-455); a prospect account is the default and is not. */}
          {row.status !== "prospect" && <Pill>{STATUS_LABELS[row.status]}</Pill>}
        </div>
        {locationOf(row) && <p className="text-xs text-muted-foreground">{locationOf(row)}</p>}
      </>
    ),
  },
  {
    id: "main_contact",
    header: "Main contact",
    // No sort: the database has none for it (a contact has no one field to sort by); it is found by search.
    text: (row) => [row.main_contact_name, contactLine(row)].filter(Boolean).join(", "),
    cell: (row) => (row.main_contact_name ? (
      <>
        <p className="text-sm">{row.main_contact_name}</p>
        {contactLine(row) && <p className="text-xs text-muted-foreground break-all">{contactLine(row)}</p>}
      </>
    ) : <span className="text-sm text-muted-foreground">No main contact</span>),
  },
  {
    id: "opportunity",
    header: "Opportunity",
    sortField: "opportunity_stage",
    filterField: "opportunity_stage",
    text: (row) => opportunityText(row),
    cell: (row) => (row.opportunity_stage ? (
      <>
        <Pill>{STAGE_LABELS[row.opportunity_stage]}</Pill>
        <p className="mt-1 text-xs text-muted-foreground">
          {startWords(row.target_start)}
          {row.open_opportunities > 1 && <span> · +{row.open_opportunities - 1} more</span>}
        </p>
      </>
    ) : <span className="text-sm text-muted-foreground">None open</span>),
  },
  {
    id: "quotes",
    header: "Quotes",
    sortField: "quote_requests_sent",
    filterField: "quote_requests_sent",
    text: (row) => quotesWords(row),
    cell: (row) => {
      const expiry = row.earliest_quote_expires_on ? expiryWords(row.earliest_quote_expires_on) : null;
      const none = row.open_opportunities === 0 || row.quote_requests_sent === 0;
      return (
        <div className="text-sm">
          <p className={none ? "text-muted-foreground" : undefined}>{quotesWords(row)}</p>
          {expiry && <p className={`text-xs ${expiry.soon ? "font-medium text-warning" : "text-muted-foreground"}`}>{expiry.text}</p>}
        </div>
      );
    },
  },
  {
    id: "renewal",
    header: "Renewal",
    sortField: "renewal_date",
    filterField: "renewal_date",
    text: (row) => renewalText(row),
    cell: (row) => {
      if (row.renewal_date === null) return <span className="text-sm text-muted-foreground">None on file</span>;
      const days = daysFromToday(row.renewal_date);
      // A renewal that has passed and is not done is shown in the warning colour (D-448); the column holds the nearest one not done (D-450).
      return (
        <div className="text-sm">
          <p>{formatDay(row.renewal_date)}</p>
          <p className={`text-xs ${days < 0 ? "font-medium text-warning" : "text-muted-foreground"}`}>{daysAwayWords(days)}</p>
        </div>
      );
    },
  },
  {
    id: "employees", header: "Employees", align: "right", sortField: "employees", filterField: "employees",
    text: (row) => (row.employees === null ? "" : String(row.employees)),
    cell: (row) => <span className="font-mono text-sm">{row.employees ?? "—"}</span>,
  },
  {
    id: "owner", header: "Owner", sortField: "owner", filterField: "owner",
    text: (row) => row.owner_name ?? "",
    cell: (row) => <span className="text-sm">{row.owner_name ?? <span className="text-muted-foreground">No owner</span>}</span>,
  },
  {
    id: "last_activity", header: "Last activity", sortField: "last_activity_at", filterField: "last_activity_at",
    text: (row) => isoDay(row.last_activity_at),
    cell: (row) => <span className="text-sm">{formatDay(row.last_activity_at)}</span>,
  },
  {
    id: "status", header: "Status", sortField: "status", filterField: "status",
    text: (row) => STATUS_LABELS[row.status],
    cell: (row) => <span className="text-sm">{STATUS_LABELS[row.status]}</span>,
  },
  {
    id: "website", header: "Website", sortField: "website", filterField: "website",
    text: (row) => row.website ?? "",
    cell: (row) => <span className="text-sm break-all">{row.website ?? dash}</span>,
  },
  {
    id: "industry", header: "Industry", sortField: "industry", filterField: "industry",
    text: (row) => row.industry ?? "",
    cell: (row) => <span className="text-sm">{row.industry ?? dash}</span>,
  },
  {
    id: "states_of_operation", header: "States of operation", sortField: "states_of_operation", filterField: "states_of_operation",
    text: (row) => row.states_of_operation.join(", "),
    cell: (row) => <span className="text-sm">{row.states_of_operation.length > 0 ? row.states_of_operation.join(", ") : dash}</span>,
  },
  {
    id: "current_provider", header: "Current provider", sortField: "current_provider", filterField: "current_provider",
    text: (row) => row.current_provider ?? "",
    cell: (row) => <span className="text-sm">{row.current_provider ?? dash}</span>,
  },
  {
    id: "labels", header: "Label", sortField: "labels", filterField: "labels",
    text: (row) => row.labels.join(", "),
    cell: (row) => (row.labels.length > 0 ? <span className="flex flex-wrap gap-1">{row.labels.map((l) => <Pill key={l}>{l}</Pill>)}</span> : <span className="text-sm">{dash}</span>),
  },
  {
    id: "source", header: "Source", sortField: "source", filterField: "source",
    text: (row) => SOURCE_LABELS[row.source],
    cell: (row) => <span className="text-sm">{SOURCE_LABELS[row.source]}</span>,
  },
  {
    id: "created", header: "Created", sortField: "created_at", filterField: "created_at",
    text: (row) => isoDay(row.created_at),
    cell: (row) => <span className="text-sm">{formatDay(row.created_at)}</span>,
  },
];

/** The columns shown until a person chooses their own (the story's default columns, Renewal among them: CRM-A2.4b). Label is one of the story's "other columns": shown from the Columns menu, never forced on a person who has a kept choice (D-217). */
const USUAL_COLUMNS = ["account", "main_contact", "opportunity", "quotes", "renewal", "employees", "owner", "last_activity"] as const;

// ---------- views ----------

/** The built-in views, the story's. "Renewing in 120 days" holds accounts with a renewal not done within the next 120 days, overdue included, soonest first (D-450). An archived account is in no other view. */
export const ACCOUNT_VIEWS: TableView<Fields>[] = [
  { id: "open_opportunities", label: "Open opportunities", filters: [{ field: "open_opportunities", op: "more_than", value: 0 }] },
  { id: "waiting_on_quotes", label: "Waiting on quotes", filters: [{ field: "waiting_on_peo", op: "is", value: true }] },
  { id: "renewing_in_120_days", label: "Renewing in 120 days", filters: [{ field: "renewing_in_120_days", op: "is", value: true }], sort: { field: "renewal_date", direction: "asc" } },
  { id: "clients", label: "Clients", filters: [{ field: "status", op: "any_of", value: ["client"] }] },
  { id: "archived", label: "Archived", filters: [{ field: "archived", op: "is", value: true }] },
];

export type AccountsTableDefinition = TableDefinition<Fields, AccountRow>;

export const ACCOUNTS_TABLE: AccountsTableDefinition = {
  id: "accounts",
  noun: { singular: "account", plural: "accounts" },
  fields: fieldsWith(undefined),
  columns: accountColumns,
  usual: USUAL_COLUMNS,
  // The filters shown in the row (the story's): Owner, State and Employees. Every other field is under "Add filter".
  listedFilters: ["owner", "state", "employees"],
  rowKey: (row) => row.id,
  views: ACCOUNT_VIEWS,
  allViewLabel: "All accounts",
  defaultSort: { field: "last_activity_at", direction: "desc" },
  defaultSortLabel: "Last activity, newest first",
  defaultSortReset: "Back to last activity",
  searchMinChars: 2,
  searchHint: "Search covers an account's name, trade name and web domain, and its contacts' names and emails.",
};

export interface AccountsTable {
  table: AccountsTableDefinition;
  /** The words for a person the Owner filter names (never an id). */
  names: (id: string) => string | undefined;
}

/**
 * The accounts table: what is in code, the firm's people as the Owner filter's choices (D-173) and its saved views after the built-in ones once they have
 * loaded (CRM-S3.4a). A person who can't be listed (the call failed) still has "me" and "my team" in the Owner filter. Memoized, so it is the same object
 * until the people or the views change.
 */
export const useAccountsTable = (): AccountsTable => {
  const { firmId, ready } = useFirmReady();
  const members = useQuery<FirmMemberChoice[]>({
    queryKey: ["table", firmId, ACCOUNTS_TABLE.id, "context", "members"],
    queryFn: () => listFirmMembers(firmId),
    enabled: ready,
    retry: false,
    staleTime: 60_000,
  });
  // The firm's own labels, for the Label filter. If they can't be listed the filter still works: a word can be typed.
  const labels = useQuery<{ id: string; name: string }[]>({
    queryKey: ["table", firmId, ACCOUNTS_TABLE.id, "context", "labels"],
    queryFn: () => firmLabels(firmId as string),
    enabled: ready && !!firmId,
    retry: false,
    staleTime: 60_000,
  });
  const { saved, status } = useSavedViewList(ACCOUNTS_TABLE.id);
  return useMemo(() => {
    const people = members.data;
    const words = labels.data?.map((l) => ({ value: l.name, label: l.name }));
    const base: AccountsTableDefinition = people || words ? { ...ACCOUNTS_TABLE, fields: fieldsWith(people, words) } : ACCOUNTS_TABLE;
    const byId = new Map((people ?? []).map((p) => [p.value, p.label]));
    // A person the lookup can't name (it failed, or they have left the firm) reads "A member", never their id (D-227).
    const settled = !members.isPending;
    return { table: withSavedViews(base, saved, status), names: (id: string) => byId.get(id) ?? (settled ? "A member" : undefined) };
  }, [members.data, members.isPending, labels.data, saved, status]);
};

// ---------- the two calls ----------

/** The page's one call for rows: the effective query (the view's filters and the address's together), for the firm. */
export const fetchAccountsPage = (firmId: string | null) => (query: TableQuery<Fields>): Promise<AccountsPage> =>
  listAccounts({ firmId, filters: query.filters as AccountFilter[], sort: query.sort, page: query.page, search: query.search });

/** The counts of the tabs, under the same filters and search. */
export const countAccountsViews = (firmId: string | null) =>
  (views: { name: string; filters: TableQuery<Fields>["filters"] }[], opts: { search: string }): Promise<ViewCount[]> =>
    countAccountViews(firmId, views as { name: string; filters: AccountFilter[] }[], opts);

// ---------- the export ----------

/**
 * The export's columns for the ones the page shows, in the order it shows them: each as the page words it. The database gives a column of its own for every
 * one (export_source_accounts), and the file holds these and no other. A column that isn't here has no export (nothing shows it).
 */
const num = (v: ExportValue | undefined): number => (typeof v === "number" ? v : 0);
const str = (v: ExportValue | undefined): string => (typeof v === "string" ? v : "");
/** The calendar day of a moment in the time zone the page shows it in (the one sent as `time_zone`), as YYYY-MM-DD. */
export const dayInZone = (moment: string, timeZone: string): string => {
  const at = new Date(moment);
  if (Number.isNaN(at.getTime())) return moment.slice(0, 10);
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    return moment.slice(0, 10);
  }
};
const exportedFor = (timeZone: string): Record<string, { id: string; text?: (row: Record<string, ExportValue>) => string }> => ({
  account: { id: "name" },
  main_contact: { id: "main_contact", text: (r) => [str(r.main_contact), str(r.main_contact_email) || str(r.main_contact_phone)].filter(Boolean).join(", ") },
  opportunity: {
    id: "opportunity_stage",
    text: (r) => (str(r.opportunity_stage) === "" ? "None open" : `${str(r.opportunity_stage)}, ${startWords(typeof r.target_start === "string" ? r.target_start : null)}${num(r.open_opportunities) > 1 ? `, +${num(r.open_opportunities) - 1} more` : ""}`),
  },
  quotes: {
    id: "quote_requests_sent",
    text: (r) => {
      const words = quotesWords({ open_opportunities: num(r.open_opportunities), quote_requests_sent: num(r.quote_requests_sent), quotes_received: num(r.quotes_received) });
      // The page's second line under the count: when the nearest quote expires.
      return typeof r.earliest_quote_expires_on === "string" && r.earliest_quote_expires_on ? `${words}, ${expiryWords(r.earliest_quote_expires_on).text}` : words;
    },
  },
  employees: { id: "employees" },
  owner: { id: "owner" },
  last_activity: { id: "last_activity_at", text: (r) => dayInZone(str(r.last_activity_at), timeZone) },
  status: { id: "status" },
  website: { id: "website" },
  industry: { id: "industry" },
  states_of_operation: { id: "states_of_operation" },
  current_provider: { id: "current_provider" },
  source: { id: "source" },
  created: { id: "created_at", text: (r) => dayInZone(str(r.created_at), timeZone) },
});

export const exportColumnsFor = (shown: readonly { id: string; header: string }[], timeZone: string): ShownColumn[] => {
  const known = exportedFor(timeZone);
  return shown.filter((c) => known[c.id]).map((c) => ({ id: known[c.id].id, heading: c.header, ...(known[c.id].text ? { text: known[c.id].text } : {}) }));
};
