import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { AdvisorApiError, classifyApiError, type SubmissionSummary } from "@/lib/advisorApi";
import type { TableFields, TableFilter, TablePage, TableSort, ViewCount } from "@/lib/tableQuery";

// The submissions queue's query, run in the database (story CRM-S3.3b, D-44): filters, sort, pages of 50 and the counts
// for view tabs. supabase/migrations/20261117100000_queue_query.sql holds the rules; every call is authorized there.

/**
 * The queue's fields a filter or a sort may name, with the kind of each. The database holds the same list
 * (queue_field_kind; src/data/schemaSync.test.ts compares them) and refuses any other name.
 */
export const QUEUE_FIELDS = {
  company_name: "text",
  contact_name: "text",
  signer_name: "text",
  file_id: "text",
  needs_action_note: "text",
  start_month: "text",
  employee_count: "number",
  open_fields: "number",
  flagged_fields: "number",
  verified_fields: "number",
  quote_requests_sent: "number",
  quotes_received: "number",
  new_peo_mail_requests: "number",
  submitted_at: "date",
  created_at: "date",
  updated_at: "date",
  oldest_waiting_on: "date",
  earliest_quote_expires_on: "date",
  pipeline_status: "choice",
  intake_status: "choice",
  states: "choices",
  missing_required: "choices",
  needs_action: "yes_no",
  sent_older_version: "yes_no",
  has_new_peo_mail: "yes_no",
  waiting_on_peo: "yes_no",
} as const satisfies TableFields;

export type QueueField = keyof typeof QUEUE_FIELDS;
export type QueueFilter = TableFilter<typeof QUEUE_FIELDS>;
export type QueueTableSort = TableSort<QueueField>;

/** How many submissions a page of the workspace's queue holds (CRM-S3.5). */
export const QUEUE_LIST_PAGE_SIZE = 50;

/** One queue row: today's queue row, with the new-PEO-mail mark (D-38's Inbox) and "waiting on a PEO" as yes or no. */
export type QueueRow = Omit<SubmissionSummary, "total_count"> & {
  has_new_peo_mail: boolean;
  waiting_on_peo: boolean;
};

export type QueuePage = TablePage<QueueRow>;

/** The caller's time zone, which decides the day a moment falls on for a date filter. */
const browserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const fail = (error: { message: string; code?: string }, fallback: string): never => {
  if (error.code === "42501") throw new AdvisorApiError("You don't have access to this firm's records.", error.code);
  throw classifyApiError(error, error.message || fallback);
};

/**
 * One page of the queue: the submissions the caller may see that match the search (every word in the company, contact
 * or reference) and every filter, sorted (by default, the queue's own order), 50 a page from page 1, with how many match
 * in all. A page past the end has no rows and the same total. A filter, sort or time zone the database doesn't take is
 * refused with its reason (code 22023), never dropped.
 */
export async function listQueue(opts: {
  filters?: QueueFilter[];
  sort?: QueueTableSort | null;
  page?: number;
  search?: string;
  timeZone?: string;
} = {}): Promise<QueuePage> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const { data, error } = await supabase.rpc("queue_list_submissions", {
    p_filters: (opts.filters ?? []) as unknown as Json,
    p_sort: opts.sort?.field ?? null,
    p_direction: opts.sort?.direction ?? "asc",
    p_page: page,
    p_search: opts.search?.trim() || null,
    p_time_zone: opts.timeZone ?? browserTimeZone(),
  });
  if (error) fail(error, "Couldn't load submissions.");
  const result = (data ?? {}) as { rows?: QueueRow[]; total?: number; page?: number; page_size?: number };
  return {
    rows: result.rows ?? [],
    total: result.total ?? 0,
    page: result.page ?? page,
    pageSize: result.page_size ?? QUEUE_LIST_PAGE_SIZE,
  };
}

/**
 * The count for each view's tab, in one call: each view's filters (and the search, if given) under the same rules as
 * listQueue. Names must be unique; 1 to 20 views. Answers in the order asked.
 */
export async function countQueueViews(
  views: { name: string; filters: QueueFilter[] }[],
  opts: { search?: string; timeZone?: string } = {},
): Promise<ViewCount[]> {
  const { data, error } = await supabase.rpc("queue_view_counts", {
    p_views: views.map((v) => ({ name: v.name, filters: v.filters })) as unknown as Json,
    p_search: opts.search?.trim() || null,
    p_time_zone: opts.timeZone ?? browserTimeZone(),
  });
  if (error) fail(error, "Couldn't count the views.");
  return (data ?? []).map((r) => ({ name: r.view_name, total: Number(r.total) }));
}
