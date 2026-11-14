import { Link } from "react-router-dom";
import { BellRing } from "lucide-react";
import {
  completenessOf, formatStates, isPipelineStatus, NEEDS_ACTION_LABEL, PIPELINE_LABELS, PIPELINE_STATUSES, referenceOf, type Completeness,
} from "@/data/advisor";
import { emailProblemHelp, emailProblemLabel } from "@/data/outbox";
import { formatDay, waitingLabel } from "@/data/quoteRequests";
import { PipelineBadge } from "@/components/advisor/PipelineBadge";
import { INBOX_PARAM } from "@/components/workspace/menu";
import type { BuiltInView, ColumnDefinition, TableAddress, TableDefinition } from "@/components/workspace/table";
import { QUEUE_FIELDS, listQueue, type QueueFilter, type QueuePage, type QueueRow } from "@/lib/queueApi";
import type { EmailProblem } from "@/lib/advisorApi";

// The submissions queue as a workspace table (story CRM-S3.5a): its columns, its built-in views (today's status tabs), and the one call
// that loads a page. The frame (src/components/workspace/table/) does the rest.

type Fields = typeof QUEUE_FIELDS;

// Drafts the prospect can no longer open (docs/intake-schema.md, "Session lifecycle").
const CLOSED_INTAKE_LABELS: Record<string, string> = {
  expired: "Expired (idle draft)",
  archived: "Archived by prospect",
  revoked: "Revoked",
};

const COMPLETENESS_CLASS: Record<Completeness["state"], string> = {
  complete: "bg-success/15 text-success",
  needs_review: "bg-warning/15 text-warning",
  missing_required: "bg-destructive/15 text-destructive",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

const dash = <span className="text-muted-foreground">—</span>;

/** The three filters the old links and the page's checkboxes stand for. */
export const NEEDS_ACTION_FILTER: QueueFilter = { field: "needs_action", op: "is", value: true };
export const WAITING_FILTER: QueueFilter = { field: "waiting_on_peo", op: "is", value: true };
export const NEW_PEO_MAIL_FILTER: QueueFilter = { field: "has_new_peo_mail", op: "is", value: true };

/** The queue's sorts the page's Sort box offers until CRM-S3.2a's headers replace it. */
export const QUEUE_SORTS = [
  { label: "Newest first", sort: null },
  { label: "Longest wait on a PEO", sort: { field: "oldest_waiting_on", direction: "asc" } },
  { label: "Quote expiring soonest", sort: { field: "earliest_quote_expires_on", direction: "asc" } },
] as const;

/** Today's status tabs, as the queue's built-in views: the view's id is the status. */
export const QUEUE_VIEWS: BuiltInView<Fields>[] = PIPELINE_STATUSES.map((status) => ({
  id: status,
  label: PIPELINE_LABELS[status],
  filters: [{ field: "pipeline_status", op: "any_of", value: [status] }],
}));

const queueColumns = (problems: Map<string, EmailProblem>): ColumnDefinition<QueueRow, keyof Fields>[] => [
  {
    id: "company",
    header: "Company",
    isName: true,
    sortField: "company_name",
    kind: "text",
    cell: (row) => (
      <>
        <Link to={`/advisor/submissions/${row.session_id}`} className="font-medium text-foreground hover:text-primary">
          {row.company_name ?? "Company not provided"}
        </Link>
        <p className="text-xs text-muted-foreground font-mono">{referenceOf(row) ?? "No File ID yet"}</p>
      </>
    ),
  },
  {
    id: "contact",
    header: "Contact",
    sortField: "contact_name",
    kind: "text",
    cell: (row) => {
      const problem = problems.get(row.session_id);
      return (
        <div className="text-sm">
          {row.contact_name ?? dash}
          {problem && (
            <p className="mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive whitespace-nowrap">
                {emailProblemLabel(problem.reason)}
                <span className="sr-only">. {emailProblemHelp(problem.reason)}</span>
              </span>
            </p>
          )}
        </div>
      );
    },
  },
  { id: "states", header: "States", sortField: "states", kind: "choices", cell: (row) => <span className="text-sm">{formatStates(row.states) ?? dash}</span> },
  { id: "employees", header: "Employees", align: "right", sortField: "employee_count", kind: "number", cell: (row) => <span className="font-mono text-sm">{row.employee_count ?? "—"}</span> },
  {
    id: "submitted",
    header: "Submitted",
    sortField: "submitted_at",
    kind: "date",
    cell: (row) => (
      <span className="text-sm">
        {row.submitted_at ? (
          formatDate(row.submitted_at)
        ) : (
          <span className="text-muted-foreground">
            {CLOSED_INTAKE_LABELS[row.intake_status ?? ""]
              ?? (row.intake_status === "submitted" ? "Date not recorded" : row.signer_name ? "Needs re-certification" : "Not certified")}
          </span>
        )}
      </span>
    ),
  },
  {
    id: "status",
    header: "Status",
    sortField: "pipeline_status",
    kind: "choice",
    cell: (row) => (
      <>
        <PipelineBadge status={isPipelineStatus(row.pipeline_status) ? row.pipeline_status : "draft"} />
        {row.needs_action && (
          <div className="mt-1 max-w-[14rem]" data-testid={`needs-action-${row.session_id}`}>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning whitespace-nowrap">
              <BellRing className="w-3 h-3" aria-hidden="true" /> {NEEDS_ACTION_LABEL}
            </span>
            {row.needs_action_note && (
              <p className="text-xs text-muted-foreground mt-1 truncate" title={row.needs_action_note}>{row.needs_action_note}</p>
            )}
          </div>
        )}
      </>
    ),
  },
  {
    id: "completeness",
    header: "Completeness",
    sortField: null,
    kind: null,
    cell: (row) => {
      const completeness = completenessOf(row);
      return (
        <>
          <span className={`text-xs px-2 py-0.5 rounded-full ${COMPLETENESS_CLASS[completeness.state]}`}>{completeness.label}</span>
          <p className="text-xs text-muted-foreground mt-1">{completeness.detail}</p>
        </>
      );
    },
  },
  {
    id: "quotes",
    header: "Quotes",
    sortField: null,
    kind: null,
    cell: (row) => (
      <div className="text-sm space-y-1">
        {row.quote_requests_sent > 0 && <p>{`${row.quotes_received} / ${row.quote_requests_sent} quoted`}</p>}
        {row.oldest_waiting_on && <p className="text-xs text-muted-foreground">{waitingLabel(row.oldest_waiting_on)}</p>}
        {row.earliest_quote_expires_on && <p className="text-xs text-muted-foreground">{`Expires ${formatDay(row.earliest_quote_expires_on)}`}</p>}
        {row.new_peo_mail_requests > 0 && (
          <p>
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground whitespace-nowrap font-semibold">
              {row.new_peo_mail_requests === 1 ? "New PEO mail" : `New PEO mail (${row.new_peo_mail_requests})`}
            </span>
          </p>
        )}
        {row.sent_older_version && (
          <p><span className="text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning whitespace-nowrap">A PEO has an older version</span></p>
        )}
        {row.start_month && <p className="text-xs text-muted-foreground">Target start: <span>{row.start_month}</span></p>}
      </div>
    ),
  },
];

/**
 * The queue's old address parameters, mapped onto the table address (so today's links, bookmarks and the menu's Inbox link land on
 * the right thing): status=<stage> is view=<stage>; action=1 is the filter "needs advisor action is yes"; waiting=1 is "waiting on a
 * PEO is yes"; mail=new is "has new PEO mail is yes"; sort=oldest_waiting and sort=earliest_expiry are the sorts by those dates, oldest first.
 * q and page are unchanged.
 */
const legacy: NonNullable<TableDefinitionOf["legacy"]> = (params) => {
  const status = params.get("status");
  const sort = params.get("sort");
  const filters: QueueFilter[] = [];
  if (params.get("action") === "1") filters.push(NEEDS_ACTION_FILTER);
  if (params.get("waiting") === "1") filters.push(WAITING_FILTER);
  if (params.get(INBOX_PARAM.name) === INBOX_PARAM.value) filters.push(NEW_PEO_MAIL_FILTER);
  return {
    view: status ?? undefined,
    filters,
    sort: sort === "oldest_waiting" ? { field: "oldest_waiting_on", direction: "asc" } : sort === "earliest_expiry" ? { field: "earliest_quote_expires_on", direction: "asc" } : undefined,
  };
};

type TableDefinitionOf = TableDefinition<Fields, QueueRow>;

/** The queue as a table; `problems` marks a contact whose confirmation bounced. */
export const queueTable = (problems: Map<string, EmailProblem>): TableDefinitionOf => ({
  id: "submissions",
  fields: QUEUE_FIELDS,
  columns: queueColumns(problems),
  rowKey: (row) => row.session_id,
  builtInViews: QUEUE_VIEWS,
  isView: (id) => QUEUE_VIEWS.some((v) => v.id === id),
  searchMinChars: 3,
  legacy,
});

/** The filters the database is asked for: the view's own, then the address's. */
export const queueFiltersOf = (address: TableAddress<Fields>): QueueFilter[] => [
  ...(QUEUE_VIEWS.find((v) => v.id === address.view)?.filters ?? []),
  ...address.filters,
];

/** The page's one call to the database. */
export const fetchQueuePage = (address: TableAddress<Fields>): Promise<QueuePage> =>
  listQueue({ filters: queueFiltersOf(address), sort: address.sort, page: address.page, search: address.search });

export const hasFilter = (address: TableAddress<Fields>, filter: QueueFilter) =>
  address.filters.some((f) => JSON.stringify(f) === JSON.stringify(filter));
