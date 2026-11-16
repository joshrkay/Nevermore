import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { US_STATE_CODES } from "@/data/chamberValidation";
import { formatDay, locationOf } from "@/data/accountPage";
import { LEAD_NOT_FIT_REASON_LABELS, LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from "@/data/leads";
import { useFirmReady, useSavedViewList, withSavedViews, type ColumnDefinition, type FieldChoice, type FieldDefinitions, type TableDefinition, type TableQuery, type TableView } from "@/components/workspace/table";
import { listFirmMembers, type FirmMemberChoice } from "@/lib/accountsApi";
import {
  countLeadViews, LEAD_FIELDS, LEAD_NOT_FIT_REASONS, LEAD_SOURCES, LEAD_STATUSES, listLeads, type LeadField, type LeadFilter, type LeadRow, type LeadsPage,
} from "@/lib/leadsApi";
import type { ViewCount } from "@/lib/tableQuery";

// The leads table (story CRM-L1.1a, slice 8.3, screen 14) as a workspace table: its columns, views, filters and the two calls to the database. The frame
// (src/components/workspace/table/) does the rest, as it does for the accounts table (src/components/accounts/accountsTable.tsx).
//
// Not here, and where it goes: selecting rows, bulk changes, the bin and export (slice 8.4, D-811), the Convert row action (slice 8.6),
// labels (8.4) and custom fields (Epic 9). The name links to the lead's page (slice 8.5).

type Fields = typeof LEAD_FIELDS;

const dash = <span className="text-muted-foreground">—</span>;

const FIELD_LABELS: Record<LeadField, string> = {
  name: "Lead",
  title: "Title",
  business: "Business",
  city: "City",
  current_provider: "Current provider",
  employees: "Employees",
  created_at: "Created",
  last_activity_at: "Last activity",
  state: "State",
  source: "Source",
  status: "Status",
  not_fit_reason: "Not a fit because",
  owner: "Owner",
};

const FIELD_CHOICES: Partial<Record<LeadField, readonly FieldChoice[]>> = {
  source: LEAD_SOURCES.map((value) => ({ value, label: LEAD_SOURCE_LABELS[value] })),
  status: LEAD_STATUSES.map((value) => ({ value, label: LEAD_STATUS_LABELS[value] })),
  not_fit_reason: LEAD_NOT_FIT_REASONS.map((value) => ({ value, label: LEAD_NOT_FIT_REASON_LABELS[value] })),
  state: US_STATE_CODES.map((value) => ({ value, label: value })),
};

const fieldsWith = (owners: readonly FieldChoice[] | undefined) =>
  Object.fromEntries(
    (Object.keys(LEAD_FIELDS) as LeadField[]).map((id) => [id, {
      label: FIELD_LABELS[id],
      kind: LEAD_FIELDS[id],
      ...(id === "owner" && owners ? { choices: owners } : FIELD_CHOICES[id] ? { choices: FIELD_CHOICES[id], choicesEnforced: true } : {}),
    }]),
  ) as FieldDefinitions<Fields>;

const isoDay = (moment: string) => moment.slice(0, 10);
const businessLine = (row: LeadRow): string | null => {
  const where = locationOf(row);
  const people = row.employees === null ? null : `${row.employees} employees`;
  return [where, people].filter(Boolean).join(" · ") || null;
};

// Each column's `id` is kept in the database in a person's column choice (CRM-S3.1a): never rename or reuse one once shipped.
const leadColumns: ColumnDefinition<LeadRow, keyof Fields>[] = [
  {
    id: "lead", header: "Lead", isName: true, sortField: "name", filterField: "name",
    text: (row) => row.name,
    cell: (row) => (
      <>
        <p><Link to={`/leads/${row.id}`} className="font-medium text-foreground hover:text-primary">{row.name}</Link></p>
        {row.title && <p className="text-xs text-muted-foreground">{row.title}</p>}
      </>
    ),
  },
  {
    id: "business", header: "Business", sortField: "business", filterField: "business",
    text: (row) => row.business ?? "",
    cell: (row) => (row.business ? (
      <>
        <p className="text-sm">{row.business}</p>
        {businessLine(row) && <p className="text-xs text-muted-foreground">{businessLine(row)}</p>}
      </>
    ) : dash),
  },
  {
    // No sort: the database has none for it (CRM-L1.1). Found by search.
    id: "email_phone", header: "Email and phone",
    text: (row) => [row.email, row.phone].filter(Boolean).join(", "),
    cell: (row) => (row.email || row.phone ? (
      <>
        {row.email && <p className="text-sm break-all">{row.email}</p>}
        {row.phone && <p className="text-xs text-muted-foreground">{row.phone}</p>}
      </>
    ) : dash),
  },
  {
    id: "status", header: "Status", sortField: "status", filterField: "status",
    text: (row) => LEAD_STATUS_LABELS[row.status],
    cell: (row) => (
      <>
        <p className="text-sm">{LEAD_STATUS_LABELS[row.status]}</p>
        {row.not_fit_reason && <p className="text-xs text-muted-foreground">{LEAD_NOT_FIT_REASON_LABELS[row.not_fit_reason]}</p>}
      </>
    ),
  },
  {
    id: "source", header: "Source", sortField: "source", filterField: "source",
    text: (row) => LEAD_SOURCE_LABELS[row.source],
    cell: (row) => <span className="text-sm">{LEAD_SOURCE_LABELS[row.source]}</span>,
  },
  {
    id: "last_activity", header: "Last activity", sortField: "last_activity_at", filterField: "last_activity_at",
    text: (row) => isoDay(row.last_activity_at),
    cell: (row) => <span className="text-sm">{formatDay(row.last_activity_at)}</span>,
  },
  {
    id: "owner", header: "Owner", sortField: "owner", filterField: "owner",
    text: (row) => row.owner_name ?? "",
    cell: (row) => <span className="text-sm">{row.owner_name ?? <span className="text-muted-foreground">No owner</span>}</span>,
  },
  {
    id: "created", header: "Created", sortField: "created_at", filterField: "created_at",
    text: (row) => isoDay(row.created_at),
    cell: (row) => <span className="text-sm">{formatDay(row.created_at)}</span>,
  },
  {
    id: "state", header: "State", sortField: "state", filterField: "state",
    text: (row) => row.state ?? "",
    cell: (row) => <span className="text-sm">{row.state ?? dash}</span>,
  },
  {
    id: "employees", header: "Employees", align: "right", sortField: "employees", filterField: "employees",
    text: (row) => (row.employees === null ? "" : String(row.employees)),
    cell: (row) => <span className="font-mono text-sm">{row.employees ?? "—"}</span>,
  },
  {
    id: "current_provider", header: "Current provider", sortField: "current_provider", filterField: "current_provider",
    text: (row) => row.current_provider ?? "",
    cell: (row) => <span className="text-sm">{row.current_provider ?? dash}</span>,
  },
];

/** The story's default columns. The others are under Columns. */
const USUAL_COLUMNS = ["lead", "business", "email_phone", "status", "source", "last_activity", "owner"] as const;

/** The story's views. Open is New and Working: a converted lead or one that is not a fit is read, not worked. */
export const LEAD_VIEWS: TableView<Fields>[] = [
  { id: "open", label: "Open", filters: [{ field: "status", op: "any_of", value: ["new", "working"] }] },
  { id: "new", label: "New", filters: [{ field: "status", op: "any_of", value: ["new"] }] },
  { id: "working", label: "Working", filters: [{ field: "status", op: "any_of", value: ["working"] }] },
  { id: "converted", label: "Converted", filters: [{ field: "status", op: "any_of", value: ["converted"] }] },
  { id: "not_fit", label: "Not a fit", filters: [{ field: "status", op: "any_of", value: ["not_fit"] }] },
];

export type LeadsTableDefinition = TableDefinition<Fields, LeadRow>;

export const LEADS_TABLE: LeadsTableDefinition = {
  id: "leads",
  noun: { singular: "lead", plural: "leads" },
  fields: fieldsWith(undefined),
  columns: leadColumns,
  usual: USUAL_COLUMNS,
  // The filters the story shows in the row: Owner and Source. Every other field is under "Add filter".
  listedFilters: ["owner", "source"],
  rowKey: (row) => row.id,
  views: LEAD_VIEWS,
  allViewLabel: "All leads",
  defaultSort: { field: "last_activity_at", direction: "desc" },
  defaultSortLabel: "Last activity, newest first",
  defaultSortReset: "Back to last activity",
  searchMinChars: 2,
  searchHint: "Search covers a lead's name, business, email and phone.",
};

export interface LeadsTable {
  table: LeadsTableDefinition;
  /** The words for a person the Owner filter names (never an id). */
  names: (id: string) => string | undefined;
}

/** The leads table with the firm's people as the Owner filter's choices and its saved views after the built-in ones, as the accounts table has them. */
export const useLeadsTable = (): LeadsTable => {
  const { firmId, ready } = useFirmReady();
  const members = useQuery<FirmMemberChoice[]>({
    queryKey: ["table", firmId, LEADS_TABLE.id, "context", "members"],
    queryFn: () => listFirmMembers(firmId),
    enabled: ready,
    retry: false,
    staleTime: 60_000,
  });
  const { saved, status } = useSavedViewList(LEADS_TABLE.id);
  return useMemo(() => {
    const people = members.data;
    const base: LeadsTableDefinition = people ? { ...LEADS_TABLE, fields: fieldsWith(people) } : LEADS_TABLE;
    const byId = new Map((people ?? []).map((p) => [p.value, p.label]));
    const settled = !members.isPending;
    return { table: withSavedViews(base, saved, status), names: (id: string) => byId.get(id) ?? (settled ? "A member" : undefined) };
  }, [members.data, members.isPending, saved, status]);
};

/** The page's one call for rows: the effective query (the view's filters and the address's together), for the firm. */
export const fetchLeadsPage = (firmId: string | null) => (query: TableQuery<Fields>): Promise<LeadsPage> =>
  listLeads({ firmId, filters: query.filters as LeadFilter[], sort: query.sort, page: query.page, search: query.search });

/** The counts of the tabs, under the same filters and search. */
export const countLeadsViews = (firmId: string | null) =>
  (views: { name: string; filters: TableQuery<Fields>["filters"] }[], opts: { search: string }): Promise<ViewCount[]> =>
    countLeadViews(firmId, views as { name: string; filters: LeadFilter[] }[], opts);
