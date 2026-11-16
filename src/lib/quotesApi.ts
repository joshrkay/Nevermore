import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { browserTimeZone } from "@/lib/accountsApi";
import { AdvisorApiError, classifyApiError } from "@/lib/advisorApi";
import type { TableFields, TableFilter, TablePage, TableSort, ViewCount } from "@/lib/tableQuery";

// The quotes table's query, run in the database (story CRM-Q4.1, slice 5.11; supabase/migrations/20261123180000_quotes_table.sql): filters, sort, pages of 50,
// search and the counts for view tabs, for one firm at a time and the quotes the caller may see by their level.

/** The quotes table's fields a filter or a sort may name, with the kind of each. The database holds the same list (quotes_field_kind's `quotes_fields` block). */
export const QUOTE_FIELDS = {
  account_name: "text",
  opportunity_name: "text",
  peo: "text",
  file_id: "text",
  admin_fee_pepm: "number",
  sent_version: "number",
  days_waiting: "number",
  emails: "number",
  sent_on: "date",
  expires_on: "date",
  proposed_start: "date",
  target_start: "date",
  status: "choice",
  owner: "person",
  new_mail: "yes_no",
} as const satisfies TableFields;

export type QuoteField = keyof typeof QUOTE_FIELDS;
export type QuoteFilter = TableFilter<typeof QUOTE_FIELDS>;
export type QuoteSort = TableSort<QuoteField>;

/** A quote row's status, in the database's order. "Not sent" is no quote request status (D-1702): it is an opportunity left half done. */
export const QUOTE_ROW_STATUSES = ["not_sent", "sent", "acknowledged", "question_open", "quoted", "declined", "closed"] as const;

/** One row of the table as the database works it out: a PEO of an opportunity, or an opportunity left half done (no PEO, no quote request). */
export interface QuoteRow {
  key: string;
  quote_request_id: number | null;
  opportunity_id: string;
  account_id: string;
  account_name: string;
  opportunity_name: string;
  target_start: string | null;
  peo: string | null;
  status: (typeof QUOTE_ROW_STATUSES)[number];
  sent_on: string | null;
  sent_version: number | null;
  admin_fee_pepm: number | null;
  expires_on: string | null;
  proposed_start: string | null;
  file_id: string | null;
  owner: string | null;
  owner_name: string | null;
  new_mail: boolean;
  emails: number;
  last_message_at: string | null;
}

// The row's columns in the database's order (quotes_row; src/lib/quotesApi.test.ts compares them): a column the type gains is a compile error here.
const ROW_COLUMNS: Record<keyof QuoteRow, true> = {
  key: true, quote_request_id: true, opportunity_id: true, account_id: true, account_name: true, opportunity_name: true, target_start: true, peo: true, status: true,
  sent_on: true, sent_version: true, admin_fee_pepm: true, expires_on: true, proposed_start: true, file_id: true, owner: true, owner_name: true, new_mail: true,
  emails: true, last_message_at: true,
};
export const QUOTE_ROW_KEYS = Object.keys(ROW_COLUMNS) as (keyof QuoteRow)[];

const text = z.string();
const maybeText = z.string().nullable();
const count = z.number().int().min(0);
const rowSchema = z.object({
  key: text, quote_request_id: z.number().int().nullable(), opportunity_id: text, account_id: text, account_name: text, opportunity_name: text,
  target_start: maybeText, peo: maybeText, status: z.enum(QUOTE_ROW_STATUSES), sent_on: maybeText, sent_version: count.nullable(), admin_fee_pepm: z.number().nullable(),
  expires_on: maybeText, proposed_start: maybeText, file_id: maybeText, owner: maybeText, owner_name: maybeText, new_mail: z.boolean(), emails: count,
  last_message_at: maybeText,
});
const pageSchema = z.object({ rows: z.array(rowSchema), total: count, page: z.number().int().min(1), page_size: z.number().int().min(1) });

const countsSchema = z.array(z.object({ view_name: text, total: z.union([count, z.string().regex(/^\d+$/).transform(Number)]) }));

export type QuotesPage = TablePage<QuoteRow>;

const fail = (error: { message: string; code?: string }, fallback: string): never => {
  if (error.code === "42501") throw new AdvisorApiError("You don't have access to this firm's records.", error.code);
  throw classifyApiError(error, error.message || fallback);
};

/**
 * One page of the quotes table: the rows the caller may see in that firm (by their level) that the search (every word, in the account, the PEO or the File ID)
 * and every filter match, sorted (by default what needs the agent first, D-1705), 50 a page, with how many match in all.
 */
export async function listQuotes(opts: {
  firmId?: string | null;
  filters?: QuoteFilter[];
  sort?: QuoteSort | null;
  page?: number;
  search?: string;
  timeZone?: string;
}): Promise<QuotesPage> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const { data, error } = await supabase.rpc("quotes_list", {
    p_firm_id: opts.firmId ?? null,
    p_filters: (opts.filters ?? []) as unknown as Json,
    p_sort: opts.sort?.field ?? null,
    p_direction: opts.sort?.direction ?? "asc",
    p_page: page,
    p_search: opts.search?.trim() || null,
    p_time_zone: opts.timeZone ?? browserTimeZone(),
  });
  if (error) fail(error, "Couldn't load quotes.");
  const answer = pageSchema.safeParse(data);
  if (!answer.success) throw new AdvisorApiError("Couldn't load quotes.");
  return { rows: answer.data.rows as QuoteRow[], total: answer.data.total, page: answer.data.page, pageSize: answer.data.page_size };
}

/** The count for each view's tab, in one call, under the same rules, firm and person as listQuotes. Answers in the order asked. */
export async function countQuoteViews(
  firmId: string | null,
  views: { name: string; filters: QuoteFilter[] }[],
  opts: { search?: string; timeZone?: string } = {},
): Promise<ViewCount[]> {
  const { data, error } = await supabase.rpc("quotes_view_counts", {
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
