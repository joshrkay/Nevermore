import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { classifyApiError } from "@/lib/advisorApi";

// What the search box asks the database (story CRM-S1.2b; 20261119230000_search_everywhere.sql): the accounts, contacts, opportunities and quotes of one firm
// that the person may see and whose own fields hold every word typed (five of each kind), and each person's last opened records. The database decides every
// rule (who is found, what is searched, which firm); this puts its answer into the box's shape and its refusals into words, and refuses an answer that is
// not exactly the agreed shape. Nothing here builds a query out of what was typed (D-44): the words are one value of one call.

/** How many of each kind the box shows. */
export const SEARCH_PAGE_SIZE = 5;
/** How many recent records the box shows ("last five opened"). */
export const RECENT_SHOWN = 5;

export type SearchKind = "account" | "contact" | "opportunity" | "quote";

/** A record as the box shows it. `archived` says its account is archived. */
export type SearchHit =
  | { kind: "account"; id: string; name: string; tradeName: string | null; webDomain: string | null; phone: string | null; city: string | null; state: string | null; archived: boolean }
  | { kind: "contact"; id: string; name: string; title: string | null; email: string | null; phone: string | null; accountId: string; accountName: string; archived: boolean }
  | { kind: "opportunity"; id: string; name: string; stage: string; fileId: string | null; submissionId: string | null; accountId: string; accountName: string; archived: boolean }
  | {
      kind: "quote";
      id: string;
      peoName: string;
      status: string;
      fileId: string | null;
      submissionId: string;
      opportunityId: string;
      opportunityName: string;
      accountId: string;
      accountName: string;
      archived: boolean;
    };

export interface SearchGroup<T extends SearchHit> {
  rows: T[];
  /** Whether more than five were found: the box then offers "see all". */
  more: boolean;
}

export interface SearchResult {
  query: string;
  accounts: SearchGroup<Extract<SearchHit, { kind: "account" }>>;
  contacts: SearchGroup<Extract<SearchHit, { kind: "contact" }>>;
  opportunities: SearchGroup<Extract<SearchHit, { kind: "opportunity" }>>;
  quotes: SearchGroup<Extract<SearchHit, { kind: "quote" }>>;
}

export class SearchError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    /** The session has ended: the page signs the person out rather than retrying. */
    readonly unauthenticated = false,
  ) {
    super(message);
    this.name = "SearchError";
  }
  /** The database refused: the person is no member of that firm. */
  get forbidden() {
    return this.code === "42501";
  }
}

const FALLBACK = "Couldn't search just now. Try again.";

const refusal = (error: { message: string; code?: string }): SearchError => {
  if (error.code === "42501") return new SearchError("You don't have access to this firm's records.", error.code);
  if (error.code === "PT423") return new SearchError("This firm can only be looked at, not changed.", error.code);
  const classified = classifyApiError(error, FALLBACK);
  return new SearchError(classified.message, error.code, classified.unauthenticated);
};

const text = z.string().nullable();
const archived = z.boolean();
const accountRow = z.object({ kind: z.literal("account"), id: z.string(), name: z.string(), trade_name: text, web_domain: text, phone: text, city: text, state: text, archived });
const contactRow = z.object({
  kind: z.literal("contact"),
  id: z.string(),
  name: z.string(),
  title: text,
  email: text,
  phone: text,
  account_id: z.string(),
  account_name: z.string(),
  archived,
});
const opportunityRow = z.object({
  kind: z.literal("opportunity"),
  id: z.string(),
  name: z.string(),
  stage: z.string(),
  file_id: text,
  submission_id: text,
  account_id: z.string(),
  account_name: z.string(),
  archived,
});
const quoteRow = z.object({
  kind: z.literal("quote"),
  id: z.string(),
  peo_name: z.string(),
  status: z.string(),
  file_id: text,
  submission_id: z.string(),
  opportunity_id: z.string(),
  opportunity_name: z.string(),
  account_id: z.string(),
  account_name: z.string(),
  archived,
});
const group = <T extends z.ZodTypeAny>(row: T) => z.object({ rows: z.array(row).max(SEARCH_PAGE_SIZE), more: z.boolean() });
type Rows<T> = { rows: T[]; more: boolean };
const searchSchema = z.object({
  query: z.string(),
  accounts: group(accountRow),
  contacts: group(contactRow),
  opportunities: group(opportunityRow),
  quotes: group(quoteRow),
});
const anyRow = z.discriminatedUnion("kind", [accountRow, contactRow, opportunityRow, quoteRow]);
const recentSchema = z.object({ rows: z.array(anyRow.and(z.object({ opened_at: z.string() }))) });

type Row = z.infer<typeof anyRow>;
const hitOf = (r: Row): SearchHit => {
  switch (r.kind) {
    case "account":
      return { kind: "account", id: r.id, name: r.name, tradeName: r.trade_name, webDomain: r.web_domain, phone: r.phone, city: r.city, state: r.state, archived: r.archived };
    case "contact":
      return { kind: "contact", id: r.id, name: r.name, title: r.title, email: r.email, phone: r.phone, accountId: r.account_id, accountName: r.account_name, archived: r.archived };
    case "opportunity":
      return {
        kind: "opportunity",
        id: r.id,
        name: r.name,
        stage: r.stage,
        fileId: r.file_id,
        submissionId: r.submission_id,
        accountId: r.account_id,
        accountName: r.account_name,
        archived: r.archived,
      };
    case "quote":
      return {
        kind: "quote",
        id: r.id,
        peoName: r.peo_name,
        status: r.status,
        fileId: r.file_id,
        submissionId: r.submission_id,
        opportunityId: r.opportunity_id,
        opportunityName: r.opportunity_name,
        accountId: r.account_id,
        accountName: r.account_name,
        archived: r.archived,
      };
  }
};

/**
 * Searches the firm's records for the words typed. Fewer than two characters is four empty groups, not an error. An answer that is not exactly the agreed
 * shape is a failure, never a result with something missing.
 */
export async function searchRecords(firmId: string, words: string): Promise<SearchResult> {
  const { data, error } = await supabase.rpc("search_records", { p_firm_id: firmId, p_query: words });
  if (error) throw refusal(error);
  const parsed = searchSchema.safeParse(data);
  if (!parsed.success) throw new SearchError(FALLBACK);
  const d = parsed.data;
  const of = <T extends SearchHit>(g: Rows<Row>): SearchGroup<T> => ({ rows: g.rows.map((r) => hitOf(r) as T), more: g.more });
  return {
    query: d.query,
    accounts: of(d.accounts as Rows<Row>),
    contacts: of(d.contacts as Rows<Row>),
    opportunities: of(d.opportunities as Rows<Row>),
    quotes: of(d.quotes as Rows<Row>),
  };
}

/** Notes a record the person has just opened, so it comes first in their recent records. False when they may not see it (it is not noted). */
export async function noteRecentRecord(firmId: string, kind: SearchKind, id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("note_recent_record", { p_kind: kind, p_id: id, p_firm_id: firmId });
  if (error) throw refusal(error);
  return data === true;
}

/** The person's last opened records in the firm, newest first, those they may still see. */
export async function myRecentRecords(firmId: string, limit: number = RECENT_SHOWN): Promise<(SearchHit & { openedAt: string })[]> {
  const { data, error } = await supabase.rpc("my_recent_records", { p_firm_id: firmId, p_limit: limit });
  if (error) throw refusal(error);
  const parsed = recentSchema.safeParse(data);
  if (!parsed.success) throw new SearchError(FALLBACK);
  return parsed.data.rows.map((r) => ({ ...hitOf(r), openedAt: r.opened_at }));
}
