import { Link } from "react-router-dom";
import { BellRing } from "lucide-react";
import {
  completenessOf, formatStates, isPipelineStatus, NEEDS_ACTION_LABEL, PIPELINE_LABELS, PIPELINE_STATUSES, QUEUE_SEARCH_MIN_CHARS, referenceOf, type Completeness,
} from "@/data/advisor";
import { emailProblemHelp, emailProblemLabel } from "@/data/outbox";
import { formatDay, waitingLabel } from "@/data/quoteRequests";
import { US_STATE_CODES } from "@/data/chamberValidation";
import { RECOMMENDED_ITEMS, REQUIRED_ITEMS } from "@/data/readiness";
import { PipelineBadge } from "@/components/advisor/PipelineBadge";
import { INBOX_PARAM } from "@/components/workspace/menu";
import type { ColumnDefinition, FieldChoice, FieldDefinitions, TableDefinition, TableQuery, TableView } from "@/components/workspace/table";
import { QUEUE_FIELDS, listQueue, type QueueField, type QueueFilter, type QueuePage, type QueueRow } from "@/lib/queueApi";
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

/**
 * The queue's own order, with no sort in the address: certified submissions first, the latest certification first, then the latest change
 * (advisor_list_submissions). No single column shows it, so the table's `defaultSort` is null and the frame says these words in a line over
 * the table, and offers "Back to newest first" once a column is sorted (CRM-S3.2a).
 */
const DEFAULT_SORT_LABEL = "Newest first";
const DEFAULT_SORT_RESET = "Back to newest first";

/** Today's status tabs, as the queue's built-in views: the view's id is the status. */
export const QUEUE_VIEWS: TableView<Fields>[] = PIPELINE_STATUSES.map((status) => ({
  id: status,
  label: PIPELINE_LABELS[status],
  filters: [{ field: "pipeline_status", op: "any_of", value: [status] }],
}));

const FIELD_LABELS: Record<QueueField, string> = {
  company_name: "Company",
  contact_name: "Contact",
  signer_name: "Signer",
  file_id: "File ID",
  needs_action_note: "Advisor's note",
  start_month: "Target start",
  employee_count: "Employees",
  open_fields: "Open items",
  flagged_fields: "Flagged items",
  verified_fields: "Verified items",
  quote_requests_sent: "Quote requests sent",
  quotes_received: "Quotes received",
  new_peo_mail_requests: "Quote requests with new PEO mail",
  submitted_at: "Submitted",
  created_at: "Started",
  updated_at: "Last changed",
  oldest_waiting_on: "Waiting on a PEO since",
  earliest_quote_expires_on: "Earliest quote expiry",
  pipeline_status: "Status",
  intake_status: "Intake",
  states: "States",
  missing_required: "Missing required items",
  needs_action: NEEDS_ACTION_LABEL,
  sent_older_version: "A PEO has an older version",
  has_new_peo_mail: "Has new PEO mail",
  waiting_on_peo: "Waiting on a PEO",
};

/** The values of the queue's choice fields, as the database lists them (queue_field_choices), with their words. */
const FIELD_CHOICES: Partial<Record<QueueField, readonly FieldChoice[]>> = {
  pipeline_status: PIPELINE_STATUSES.map((value) => ({ value, label: PIPELINE_LABELS[value] })),
  // The state codes the database takes (`is_us_state_code`); a code reads as itself.
  states: US_STATE_CODES.map((value) => ({ value, label: value })),
  // The required answers an intake can lack, by the keys the database names (the same list the Reckoning uses, `REQUIRED_ITEMS`), plus the recommended ones.
  missing_required: [...REQUIRED_ITEMS, ...RECOMMENDED_ITEMS].map((item) => ({ value: item.key, label: item.label })),
  intake_status: [
    { value: "in_progress", label: "In progress" },
    { value: "submitted", label: "Submitted" },
    { value: "expired", label: "Expired (idle draft)" },
    { value: "archived", label: "Archived by prospect" },
    { value: "revoked", label: "Revoked" },
  ],
};

/**
 * A first click on a date column sorts newest first, except these two, where the person wants the oldest day first: the longest wait on a
 * PEO is the earliest "waiting since", and the quote about to lapse is the earliest expiry (the two orders the old Sort box offered). A
 * first click on Quotes sorts the most requests first (an intake with none has the number 0 and would otherwise fill the first page).
 */
const FIRST_DIRECTIONS: Partial<Record<QueueField, "asc" | "desc">> = { oldest_waiting_on: "asc", earliest_quote_expires_on: "asc", quote_requests_sent: "desc" };

/** The queue's fields: each id and kind from the list the database holds (`QUEUE_FIELDS`), with its words and choices. */
const queueFields = Object.fromEntries(
  (Object.keys(QUEUE_FIELDS) as QueueField[]).map((id) => [id, {
    label: FIELD_LABELS[id],
    kind: QUEUE_FIELDS[id],
    ...(FIELD_CHOICES[id] ? { choices: FIELD_CHOICES[id] } : {}),
    ...(FIRST_DIRECTIONS[id] ? { firstDirection: FIRST_DIRECTIONS[id] } : {}),
  }]),
) as FieldDefinitions<Fields>;

/** What the queue's cells need besides their row: which contacts' confirmations bounced. */
export interface QueueContext {
  problems: Map<string, EmailProblem>;
}

const submittedText = (row: QueueRow) =>
  row.submitted_at
    ? formatDate(row.submitted_at)
    : CLOSED_INTAKE_LABELS[row.intake_status ?? ""] ?? (row.intake_status === "submitted" ? "Date not recorded" : row.signer_name ? "Needs re-certification" : "Not certified");

const queueColumns: ColumnDefinition<QueueRow, keyof Fields, QueueContext>[] = [
  {
    id: "company",
    header: "Company",
    isName: true,
    sortField: "company_name",
    filterField: "company_name",
    text: (row) => row.company_name ?? "Company not provided",
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
    filterField: "contact_name",
    text: (row) => row.contact_name ?? "",
    cell: (row, { problems }) => {
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
  { id: "states", header: "States", sortField: "states", filterField: "states", text: (row) => row.states.join(", "), cell: (row) => <span className="text-sm">{formatStates(row.states) ?? dash}</span> },
  { id: "employees", header: "Employees", align: "right", sortField: "employee_count", filterField: "employee_count", text: (row) => (row.employee_count === null ? "" : String(row.employee_count)), cell: (row) => <span className="font-mono text-sm">{row.employee_count ?? "—"}</span> },
  {
    id: "submitted",
    header: "Submitted",
    sortField: "submitted_at",
    filterField: "submitted_at",
    // An export writes the day as ISO (every date column does); a draft has no date, so it keeps the words that say why.
    text: (row) => (row.submitted_at ? row.submitted_at.slice(0, 10) : submittedText(row)),
    cell: (row) => (
      <span className="text-sm">{row.submitted_at ? submittedText(row) : <span className="text-muted-foreground">{submittedText(row)}</span>}</span>
    ),
  },
  {
    id: "status",
    header: "Status",
    sortField: "pipeline_status",
    filterField: "pipeline_status",
    text: (row) => (isPipelineStatus(row.pipeline_status) ? PIPELINE_LABELS[row.pipeline_status] : row.pipeline_status),
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
    text: (row) => completenessOf(row).label,
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
    // Sorts by how many quote requests were sent (the "3" of "1 / 3 quoted"), and a row with none says "None", so what sorts as 0 reads as a value.
    sortField: "quote_requests_sent",
    filterField: "quote_requests_sent",
    text: (row) => (row.quote_requests_sent > 0 ? `${row.quotes_received} / ${row.quote_requests_sent} quoted` : "None"),
    cell: (row) => (
      <div className="text-sm space-y-1">
        <p>{row.quote_requests_sent > 0 ? `${row.quotes_received} / ${row.quote_requests_sent} quoted` : <span className="text-muted-foreground">None</span>}</p>
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
  // The two days that used to be lines inside "Quotes" have columns of their own, so their headers can sort them (a header sorts one field).
  {
    id: "waiting_since",
    header: "Waiting since",
    sortField: "oldest_waiting_on",
    filterField: "oldest_waiting_on",
    text: (row) => row.oldest_waiting_on ?? "",
    // The day the wait began (so ascending is the longest wait first, which is true of a date), with how long that is under it.
    cell: (row) => (row.oldest_waiting_on ? (
      <>
        <span className="text-sm">{formatDay(row.oldest_waiting_on)}</span>
        <p className="text-xs text-muted-foreground">{waitingLabel(row.oldest_waiting_on)}</p>
      </>
    ) : dash),
  },
  {
    id: "quote_expires",
    header: "Quote expires",
    sortField: "earliest_quote_expires_on",
    filterField: "earliest_quote_expires_on",
    text: (row) => row.earliest_quote_expires_on ?? "",
    cell: (row) => (row.earliest_quote_expires_on ? <span className="text-sm">{formatDay(row.earliest_quote_expires_on)}</span> : dash),
  },
];

type QueueTableDefinition = TableDefinition<Fields, QueueRow, QueueContext>;

/**
 * The queue's old address parameters, mapped onto the table address (so today's links, bookmarks and the menu's Inbox link land on
 * the right thing): status=<stage> is view=<stage>; action=1 is the filter "needs advisor action is yes"; waiting=1 is "waiting on a
 * PEO is yes"; mail=new is "has new PEO mail is yes"; sort=oldest_waiting and sort=earliest_expiry are the sorts by those dates, oldest first.
 * q and page are unchanged.
 */
const legacy: NonNullable<QueueTableDefinition["legacy"]> = (params) => {
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

/** The queue as a table: a constant, so nothing is rebuilt when a lookup the cells use arrives (that goes in `QueueContext`). */
export const QUEUE_TABLE: QueueTableDefinition = {
  id: "submissions",
  noun: { singular: "submission", plural: "submissions" },
  fields: queueFields,
  columns: queueColumns,
  // The filters a broker reaches for, always in the row: the three yes-or-no marks the old checkboxes and links stood for (needs action,
  // waiting on a PEO, new PEO mail: "Status" is the tabs), then the three columns most often narrowed by (the states a prospect is in, how many
  // people they employ, and when they submitted). Every other field is under "Add filter".
  listedFilters: ["needs_action", "waiting_on_peo", "has_new_peo_mail", "states", "employee_count", "submitted_at"],
  rowKey: (row) => row.session_id,
  views: QUEUE_VIEWS,
  allViewLabel: "All statuses",
  defaultSort: null,
  defaultSortLabel: DEFAULT_SORT_LABEL,
  defaultSortReset: DEFAULT_SORT_RESET,
  searchMinChars: QUEUE_SEARCH_MIN_CHARS,
  searchHint: "Search covers company, contact and File ID.",
  legacy,
};

/**
 * The queue's definition. A hook so that CRM-S3.4a can add the firm's saved views to it once they have loaded (with `viewsStatus`
 * "loading" until then); today everything is in code and it is always ready.
 */
export const useQueueTable = (): QueueTableDefinition => QUEUE_TABLE;

/** The page's one call to the database: the effective query (the view's filters and the address's together). */
export const fetchQueuePage = (query: TableQuery<Fields>): Promise<QueuePage> => listQueue(query);
