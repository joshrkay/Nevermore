import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { browserTimeZone } from "@/lib/accountsApi";
import { AdvisorApiError, classifyApiError } from "@/lib/advisorApi";
import type { TableFields, TableFilter, TablePage, ViewCount } from "@/lib/tableQuery";

// The inbox's query, run in the database (story CRM-E1.4, slice 6.5; supabase/migrations/20261122150000_inbox.sql): every message on the PEO threads and the
// conversations with contacts and leads the caller may see, newest first, with the views' filters, search and the counts for view tabs, one firm at a time.
// Only the product's own threads: nothing here reads the agent's mailbox.

/**
 * The inbox's fields a filter may name, with the kind of each. The database holds the same list (inbox_field_kind's `inbox_fields` block;
 * src/lib/inboxApi.test.ts compares them) and refuses any other. The inbox has one order, newest first: no field sorts.
 */
export const INBOX_FIELDS = {
  kind: "choice",
  direction: "choice",
  is_new: "yes_no",
  owner: "person",
  account: "text",
} as const satisfies TableFields;

export type InboxField = keyof typeof INBOX_FIELDS;
export type InboxFilter = TableFilter<typeof INBOX_FIELDS>;

/** Whose thread a message is on, in the database's order. */
export const INBOX_KINDS = ["contact", "lead", "peo"] as const;
/** Which way it went: to the firm, or from it (through the product, or by hand from a person's own mail). */
export const INBOX_DIRECTIONS = ["received", "sent"] as const;

/** One message as the inbox lists it. Never its body: its first line with words in it. */
export interface InboxRow {
  /** "c:<uuid>" for a conversation's message, "q:<id>" for a PEO thread's. */
  id: string;
  kind: (typeof INBOX_KINDS)[number];
  /** The conversation's id, or the quote request's. */
  thread_id: string;
  direction: (typeof INBOX_DIRECTIONS)[number];
  is_new: boolean;
  is_automatic: boolean;
  from_address: string;
  from_name: string | null;
  subject: string | null;
  first_line: string | null;
  /** When the product recorded it. */
  at: string;
  /** The account, when there is one the caller may see; a lead's business stands for its account, with no id. */
  account_id: string | null;
  account_name: string | null;
  contact_id: string | null;
  contact_name: string | null;
  lead_id: string | null;
  lead_name: string | null;
  peo_name: string | null;
  /** A PEO thread's intake: the submission's page holds the thread. */
  session_id: string | null;
  owner: string | null;
  owner_name: string | null;
}

// The row's columns in the database's order (inbox_row; src/lib/inboxApi.test.ts compares them): a column the type gains is a compile error here.
const ROW_COLUMNS: Record<keyof InboxRow, true> = {
  id: true, kind: true, thread_id: true, direction: true, is_new: true, is_automatic: true, from_address: true, from_name: true, subject: true,
  first_line: true, at: true, account_id: true, account_name: true, contact_id: true, contact_name: true, lead_id: true, lead_name: true, peo_name: true,
  session_id: true, owner: true, owner_name: true,
};
export const INBOX_ROW_KEYS = Object.keys(ROW_COLUMNS) as (keyof InboxRow)[];

const text = z.string();
const maybeText = z.string().nullable();
const count = z.number().int().min(0);
const rowSchema = z.object({
  id: text, kind: z.enum(INBOX_KINDS), thread_id: text, direction: z.enum(INBOX_DIRECTIONS), is_new: z.boolean(), is_automatic: z.boolean(),
  from_address: text, from_name: maybeText, subject: maybeText, first_line: maybeText, at: text, account_id: maybeText, account_name: maybeText,
  contact_id: maybeText, contact_name: maybeText, lead_id: maybeText, lead_name: maybeText, peo_name: maybeText, session_id: maybeText, owner: maybeText,
  owner_name: maybeText,
});
const pageSchema = z.object({ rows: z.array(rowSchema), total: count, page: z.number().int().min(1), page_size: z.number().int().min(1) });

export type InboxPage = TablePage<InboxRow>;

const fail = (error: { message: string; code?: string }, fallback: string): never => {
  if (error.code === "42501") throw new AdvisorApiError("You don't have access to this firm's records.", error.code);
  throw classifyApiError(error, error.message || fallback);
};

/**
 * One page of the inbox: the messages the caller may see in that firm that the search (every word, in the sender, the subject or the account; never the
 * body) and every filter match, newest first, 50 a page, with how many match in all.
 */
export async function listInbox(opts: {
  firmId?: string | null;
  filters?: InboxFilter[];
  page?: number;
  search?: string;
  timeZone?: string;
}): Promise<InboxPage> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const { data, error } = await supabase.rpc("inbox_list", {
    p_firm_id: opts.firmId ?? null,
    p_filters: (opts.filters ?? []) as unknown as Json,
    p_sort: null,
    p_direction: "desc",
    p_page: page,
    p_search: opts.search?.trim() || null,
    p_time_zone: opts.timeZone ?? browserTimeZone(),
  });
  if (error) fail(error, "Couldn't load the inbox.");
  const answer = pageSchema.safeParse(data);
  if (!answer.success) throw new AdvisorApiError("Couldn't load the inbox.");
  return { rows: answer.data.rows as InboxRow[], total: answer.data.total, page: answer.data.page, pageSize: answer.data.page_size };
}

const countsSchema = z.array(z.object({ view_name: text, total: z.union([count, z.string().regex(/^\d+$/).transform(Number)]) }));

/** The count for each view's tab, in one call, under the same rules, firm and person as listInbox. Answers in the order asked. */
export async function countInboxViews(
  firmId: string | null,
  views: { name: string; filters: InboxFilter[] }[],
  opts: { search?: string; timeZone?: string } = {},
): Promise<ViewCount[]> {
  const { data, error } = await supabase.rpc("inbox_view_counts", {
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

/**
 * Opens a conversation (6.4's `open_conversation`): clears its "new" mark for everyone in the firm who can see it, through `seenThrough`, the newest message
 * the page showed of it, so mail that came after stays new.
 */
export async function openConversation(firmId: string | null, conversationId: string, seenThrough: string): Promise<void> {
  const { error } = await supabase.rpc("open_conversation", { p_conversation_id: conversationId, p_seen_through: seenThrough, p_firm_id: firmId });
  if (error) fail(error, "Couldn't mark the conversation read.");
}
