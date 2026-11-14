import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { AdvisorApiError, classifyApiError } from "@/lib/advisorApi";
import type { TableFields, TableFilter, TablePage, TableSort, ViewCount } from "@/lib/tableQuery";

// The accounts table's query, run in the database (story CRM-A1.1b, D-44): filters, sort, pages of 50, search, the counts for view tabs, and the people
// the Owner filter offers. supabase/migrations/20261119130000_accounts_table_query.sql holds the rules; every call is authorized there, for one firm at a
// time and for the accounts the caller may see by their level.

/**
 * The accounts table's fields a filter or a sort may name, with the kind of each. The database holds the same list (accounts_field_kind's `accounts_fields`
 * block; src/lib/accountsApi.test.ts compares them) and refuses any other name. The main contact is not here: it is shown, never filtered or sorted.
 * Renewal, labels and custom fields are later stories' (D-186, D-198, CRM-X3.1).
 */
export const ACCOUNT_FIELDS = {
  name: "text",
  trade_name: "text",
  website: "text",
  city: "text",
  industry: "text",
  current_provider: "text",
  opportunity_name: "text",
  employees: "number",
  open_opportunities: "number",
  quote_requests_sent: "number",
  quotes_received: "number",
  created_at: "date",
  last_activity_at: "date",
  target_start: "date",
  earliest_quote_expires_on: "date",
  state: "choice",
  source: "choice",
  status: "choice",
  opportunity_stage: "choice",
  states_of_operation: "choices",
  archived: "yes_no",
  waiting_on_peo: "yes_no",
  owner: "person",
} as const satisfies TableFields;

export type AccountField = keyof typeof ACCOUNT_FIELDS;
export type AccountFilter = TableFilter<typeof ACCOUNT_FIELDS>;
export type AccountSort = TableSort<AccountField>;

/** Where an account came from (D-211), in the order the database lists them. Set by the product, never edited. */
export const ACCOUNT_SOURCES = ["employer_intake", "added_by_hand", "new_quote", "lead", "import"] as const;
/** An account's status (D-197), worked out and never stored. A former client arrives with the placement record (Epic 4). */
export const ACCOUNT_STATUSES = ["prospect", "client"] as const;
/** The stages an open opportunity is at (D-206): the Opportunity column shows the open one with the nearest target start, so it is never won or lost. */
export const ACCOUNT_OPEN_STAGES = ["qualifying", "intake_under_way", "ready_to_send", "in_market", "quoted"] as const;

/** How many accounts a page of the table holds. */
export const ACCOUNT_LIST_PAGE_SIZE = 50;

/**
 * One row of the table, as the database works it out. `owner` is the record owner only while they are a current member of the firm (a record whose owner
 * left reads as owned by no one). The Opportunity column is the open opportunity with the nearest target start, and the page says "+N more" for
 * `open_opportunities - 1` when there are others. The Quotes column counts across every opportunity of the account: the quotes asked for that are not
 * closed, how many came back, and the nearest expiry of one that did.
 */
export interface AccountRow {
  id: string;
  name: string;
  trade_name: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  employees: number | null;
  states_of_operation: string[];
  current_provider: string | null;
  source: (typeof ACCOUNT_SOURCES)[number];
  status: (typeof ACCOUNT_STATUSES)[number];
  archived: boolean;
  archived_at: string | null;
  created_at: string;
  owner: string | null;
  owner_name: string | null;
  main_contact_id: string | null;
  main_contact_name: string | null;
  main_contact_email: string | null;
  /** The contact's phone, or else their mobile. */
  main_contact_phone: string | null;
  opportunity_id: string | null;
  opportunity_name: string | null;
  opportunity_stage: (typeof ACCOUNT_OPEN_STAGES)[number] | null;
  target_start: string | null;
  open_opportunities: number;
  quote_requests_sent: number;
  quotes_received: number;
  waiting_on_peo: boolean;
  earliest_quote_expires_on: string | null;
  last_activity_at: string;
}

// The row's columns in the database's order (accounts_row; src/lib/accountsApi.test.ts compares them): a column the type gains is a compile error here.
const ROW_COLUMNS: Record<keyof AccountRow, true> = {
  id: true, name: true, trade_name: true, website: true, city: true, state: true, industry: true, employees: true, states_of_operation: true,
  current_provider: true, source: true, status: true, archived: true, archived_at: true, created_at: true, owner: true, owner_name: true,
  main_contact_id: true, main_contact_name: true, main_contact_email: true, main_contact_phone: true, opportunity_id: true, opportunity_name: true,
  opportunity_stage: true, target_start: true, open_opportunities: true, quote_requests_sent: true, quotes_received: true, waiting_on_peo: true,
  earliest_quote_expires_on: true, last_activity_at: true,
};
export const ACCOUNT_ROW_KEYS = Object.keys(ROW_COLUMNS) as (keyof AccountRow)[];

export type AccountsPage = TablePage<AccountRow>;

/** A person the Owner filter offers, in the shape a person field's `choices` take: the id the filter sends and the name it shows. */
export interface FirmMemberChoice {
  value: string;
  label: string;
}

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
 * One page of the accounts table: the accounts the caller may see in that firm (by their level; archived ones only when a filter on `archived` asks) that
 * the search (every word, in the name, trade name, web domain or a contact's name or email) and every filter match, sorted (by default last activity,
 * newest first), 50 a page from page 1, with how many match in all. A page past the end has no rows and the same total. A filter, sort or time zone the
 * database doesn't take is refused with its reason (code 22023), never dropped. `firmId` names the firm; with none the database takes the firm at the
 * address, and refuses a person of two firms on the bare domain.
 */
export async function listAccounts(opts: {
  firmId?: string | null;
  filters?: AccountFilter[];
  sort?: AccountSort | null;
  page?: number;
  search?: string;
  timeZone?: string;
}): Promise<AccountsPage> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const { data, error } = await supabase.rpc("accounts_list", {
    p_firm_id: opts.firmId ?? null,
    p_filters: (opts.filters ?? []) as unknown as Json,
    p_sort: opts.sort?.field ?? null,
    p_direction: opts.sort?.direction ?? "asc",
    p_page: page,
    p_search: opts.search?.trim() || null,
    p_time_zone: opts.timeZone ?? browserTimeZone(),
  });
  if (error) fail(error, "Couldn't load accounts.");
  const result = (data ?? {}) as { rows?: AccountRow[]; total?: number; page?: number; page_size?: number };
  return {
    rows: result.rows ?? [],
    total: result.total ?? 0,
    page: result.page ?? page,
    pageSize: result.page_size ?? ACCOUNT_LIST_PAGE_SIZE,
  };
}

/**
 * The count for each view's tab, in one call: each view's filters (and the search, if given) under the same rules, firm and person as listAccounts.
 * Names must be unique; 1 to 20 views. Answers in the order asked.
 */
export async function countAccountViews(
  firmId: string | null,
  views: { name: string; filters: AccountFilter[] }[],
  opts: { search?: string; timeZone?: string } = {},
): Promise<ViewCount[]> {
  const { data, error } = await supabase.rpc("accounts_view_counts", {
    p_firm_id: firmId,
    p_views: views.map((v) => ({ name: v.name, filters: v.filters })) as unknown as Json,
    p_search: opts.search?.trim() || null,
    p_time_zone: opts.timeZone ?? browserTimeZone(),
  });
  if (error) fail(error, "Couldn't count the views.");
  return (data ?? []).map((r) => ({ name: r.view_name, total: Number(r.total) }));
}

/**
 * The firm's current members, each by the id a person filter takes and the name to show (their name, else their email), sorted by name: the choices of
 * the Owner filter (D-173). Only a member of the firm is given them.
 */
export async function listFirmMembers(firmId: string | null): Promise<FirmMemberChoice[]> {
  const { data, error } = await supabase.rpc("firm_member_choices", { p_firm_id: firmId });
  if (error) fail(error, "Couldn't load the firm's people.");
  return (data ?? []).map((m) => ({ value: m.user_id, label: m.name }));
}
