import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { browserTimeZone } from "@/lib/accountsApi";
import { AdvisorApiError, classifyApiError } from "@/lib/advisorApi";
import type { TableFields, TableFilter, TablePage, TableSort, ViewCount } from "@/lib/tableQuery";

// The leads table's query, run in the database (story CRM-L1.1a, slice 8.3; supabase/migrations/20261121110500_leads_table_query.sql): filters, sort, pages
// of 50, search and the counts for view tabs, for one firm at a time and the leads the caller may see by their level (D-809). The bin's leads are in none of it.

/**
 * The leads table's fields a filter or a sort may name, with the kind of each. The database holds the same list (leads_field_kind's `leads_fields` block;
 * src/lib/leadsApi.test.ts compares them) and refuses any other. Email and phone have no sort (CRM-L1.1). `labels` is the firm's own words on a lead (20261206090000_lead_labels_column.sql); a filter names them as text. Custom fields come with Epic 9.
 */
export const LEAD_FIELDS = {
  name: "text",
  title: "text",
  business: "text",
  city: "text",
  current_provider: "text",
  employees: "number",
  created_at: "date",
  last_activity_at: "date",
  state: "choice",
  source: "choice",
  status: "choice",
  not_fit_reason: "choice",
  owner: "person",
  labels: "choices",
} as const satisfies TableFields;

export type LeadField = keyof typeof LEAD_FIELDS;
export type LeadFilter = TableFilter<typeof LEAD_FIELDS>;
export type LeadSort = TableSort<LeadField>;

/** Where a lead came from (D-804), in the database's order. */
export const LEAD_SOURCES = ["added_by_hand", "import", "referral_partner", "firms_link"] as const;
/** A lead's status (CRM-L1.3), in the database's order. */
export const LEAD_STATUSES = ["new", "working", "converted", "not_fit"] as const;
/** Why a lead is Not a fit, the short list (CRM-L1.3). */
export const LEAD_NOT_FIT_REASONS = ["too_small", "wrong_industry", "not_interested", "bad_contact_details", "other"] as const;

/** One row of the table as the database works it out. `owner` is the record owner only while they are a current member of the firm. */
export interface LeadRow {
  id: string;
  name: string;
  title: string | null;
  business: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  employees: number | null;
  current_provider: string | null;
  source: (typeof LEAD_SOURCES)[number];
  status: (typeof LEAD_STATUSES)[number];
  not_fit_reason: (typeof LEAD_NOT_FIT_REASONS)[number] | null;
  created_at: string;
  owner: string | null;
  owner_name: string | null;
  /** The newest of its calls, notes and tasks, or when it was made (D-814). */
  last_activity_at: string;
  /** The firm's labels on the lead, in order; none is an empty list. */
  labels: string[];
}

// The row's columns in the database's order (leads_row; src/lib/leadsApi.test.ts compares them): a column the type gains is a compile error here.
const ROW_COLUMNS: Record<keyof LeadRow, true> = {
  id: true, name: true, title: true, business: true, email: true, phone: true, city: true, state: true, employees: true, current_provider: true,
  source: true, status: true, not_fit_reason: true, created_at: true, owner: true, owner_name: true, last_activity_at: true, labels: true,
};
export const LEAD_ROW_KEYS = Object.keys(ROW_COLUMNS) as (keyof LeadRow)[];

const text = z.string();
const maybeText = z.string().nullable();
const count = z.number().int().min(0);
const rowSchema = z.object({
  id: text, name: text, title: maybeText, business: maybeText, email: maybeText, phone: maybeText, city: maybeText, state: maybeText,
  employees: count.nullable(), current_provider: maybeText, source: z.enum(LEAD_SOURCES), status: z.enum(LEAD_STATUSES),
  not_fit_reason: z.enum(LEAD_NOT_FIT_REASONS).nullable(), created_at: text, owner: maybeText, owner_name: maybeText, last_activity_at: text, labels: z.array(text),
});
const pageSchema = z.object({ rows: z.array(rowSchema), total: count, page: z.number().int().min(1), page_size: z.number().int().min(1) });
const countsSchema = z.array(z.object({ view_name: text, total: z.union([count, z.string().regex(/^\d+$/).transform(Number)]) }));

export type LeadsPage = TablePage<LeadRow>;

const fail = (error: { message: string; code?: string }, fallback: string): never => {
  if (error.code === "42501") throw new AdvisorApiError("You don't have access to this firm's records.", error.code);
  throw classifyApiError(error, error.message || fallback);
};

/**
 * One page of the leads table: the leads the caller may see in that firm (by their level, the bin left out) that the search (every word, in the name,
 * business, email or phone) and every filter match, sorted (by default last activity, newest first), 50 a page, with how many match in all.
 */
export async function listLeads(opts: {
  firmId?: string | null;
  filters?: LeadFilter[];
  sort?: LeadSort | null;
  page?: number;
  search?: string;
  timeZone?: string;
}): Promise<LeadsPage> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const { data, error } = await supabase.rpc("leads_list", {
    p_firm_id: opts.firmId ?? null,
    p_filters: (opts.filters ?? []) as unknown as Json,
    p_sort: opts.sort?.field ?? null,
    p_direction: opts.sort?.direction ?? "asc",
    p_page: page,
    p_search: opts.search?.trim() || null,
    p_time_zone: opts.timeZone ?? browserTimeZone(),
  });
  if (error) fail(error, "Couldn't load leads.");
  const answer = pageSchema.safeParse(data);
  if (!answer.success) throw new AdvisorApiError("Couldn't load leads.");
  return { rows: answer.data.rows as LeadRow[], total: answer.data.total, page: answer.data.page, pageSize: answer.data.page_size };
}

/** The count for each view's tab, in one call, under the same rules, firm and person as listLeads. Answers in the order asked. */
export async function countLeadViews(
  firmId: string | null,
  views: { name: string; filters: LeadFilter[] }[],
  opts: { search?: string; timeZone?: string } = {},
): Promise<ViewCount[]> {
  const { data, error } = await supabase.rpc("leads_view_counts", {
    p_firm_id: firmId,
    p_views: views.map((v) => ({ name: v.name, filters: v.filters })) as unknown as Json,
    p_search: opts.search?.trim() || null,
    p_time_zone: opts.timeZone ?? browserTimeZone(),
  });
  if (error) fail(error, "Couldn't count the views.");
  const answer = countsSchema.safeParse(data);
  if (!answer.success) throw new AdvisorApiError("Couldn't count the views.");
  return answer.data.map((r) => ({ name: r.view_name, total: r.total }));
}
