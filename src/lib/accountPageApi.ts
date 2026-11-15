import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { classifyApiError } from "@/lib/advisorApi";
import { activityItemOf, activityItemSchema, type ActivityItem } from "@/lib/activityApi";
import { readSaveAnswer, type ChangedField, type RecordConflict, type Saved } from "@/lib/recordVersion";

// What an account's page asks the database (story CRM-A2.1a; 20261119140000_account_page.sql). Four calls: the page (the account and each tab's count and
// first five rows), the Files list, the save of the account's own fields with its version, and a submission's account. The database decides every rule:
// who may see an account (by level), who may change it (the level rule, D-209), the closing firm and Nevermore support. This only puts its answers and its
// refusals into the page's shape and words, and checks that an answer is exactly the agreed shape. A file here is named and placed; its link is made by
// `documentUrl` (src/lib/advisorApi.ts), the one place that signs, and Storage refuses the people its own file rule refuses.

/** What an opportunity's stage is, worked out from its submission (D-206). */
export const OPPORTUNITY_STAGES = ["qualifying", "intake_under_way", "ready_to_send", "in_market", "quoted", "won", "lost"] as const;
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

/** An account is a prospect account or a client (D-197). */
export type AccountStatus = "prospect" | "client";

/** Where an account came from, set by the product and never edited (D-211). */
export const ACCOUNT_SOURCES = ["employer_intake", "added_by_hand", "new_quote", "lead", "import"] as const;
export type AccountSource = (typeof ACCOUNT_SOURCES)[number];

/** The account's own fields as the page and a save answer them. */
export interface AccountFields {
  id: string;
  /** The version to start the next save from. */
  version: number;
  name: string;
  tradeName: string | null;
  website: string | null;
  /** The website reduced to its domain, worked out and never typed. */
  webDomain: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  industry: string | null;
  employees: number | null;
  statesOfOperation: string[];
  currentProvider: string | null;
  source: AccountSource;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The account as the page shows it: its own fields, its worked-out status, its owner and, for an account made from a partner's link, the partner. */
export interface AccountDetails extends AccountFields {
  status: AccountStatus;
  /** Null when the account has no owner. The name is the name the person gave, else their email. */
  owner: { id: string; name: string } | null;
  /** The referral partner whose link the account's first intake came by, read from the intake. */
  sourcePartner: string | null;
}

export interface ContactRow {
  id: string;
  firstName: string | null;
  lastName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isMain: boolean;
  doNotEmail: boolean;
}

export interface OpportunityRow {
  id: string;
  name: string;
  stage: OpportunityStage;
  targetStart: string | null;
  /** The submission the name opens until the opportunity has a page of its own (D-187); null when it holds none, and the name is plain text. */
  submissionId: string | null;
}

/** A quote request with the quote it returns, if any (D-185). */
export interface QuoteRow {
  id: number;
  submissionId: string;
  opportunityId: string;
  opportunityName: string;
  peoName: string;
  status: string;
  sentOn: string | null;
  quoteReceivedOn: string | null;
  quoteExpiresOn: string | null;
}

/** One entry of the record history on the Activity tab (`type` "change"): a creation or a change of a field of the account or one of its contacts. */
export interface ChangeRow {
  type: "change";
  entryKey: string;
  at: string;
  changeId: string;
  kind: "created" | "changed";
  /** A member's email, "Nevermore" or "System" (D-33). */
  who: string;
  whoKind: "member" | "nevermore" | "system";
  field: string | null;
  from: Json | null;
  to: Json | null;
  /** The record the entry is about: the account, or one of its contacts. */
  recordTable: "accounts" | "contacts";
  recordId: string;
  recordName: string | null;
}

/** One entry of the Activity tab (D-212): a change in the record's history, or a call, a note or a task (CRM-E1.5), newest first. `type` tells which. */
export type ActivityRow = ChangeRow | ActivityItem;

export interface AccountFile {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  category: string;
  createdAt: string;
  submissionId: string;
  /** Where the file is stored, for `documentUrl`. Not a link: Storage makes the link, only to someone its own rule lets read the file. */
  storagePath: string;
}

/** A tab's whole count and the rows asked for. */
export interface TabRows<Row> {
  count: number;
  rows: Row[];
}

export interface AccountPage {
  account: AccountDetails;
  /** Whether the person may change the account (the level rule), so the screen shows Edit only to those it will serve. */
  canChange: boolean;
  /** Each tab's count and first five rows. There is no Renewals tab (D-186). */
  tabs: {
    contacts: TabRows<ContactRow>;
    opportunities: TabRows<OpportunityRow>;
    quotes: TabRows<QuoteRow>;
    activity: TabRows<ActivityRow>;
    files: TabRows<AccountFile>;
  };
}

/** The fields a person edits in place. Owner, archiving and source are not among them. A blank text is cleared. */
export interface AccountEdit {
  name: string;
  tradeName: string;
  website: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  industry: string;
  employees: number | null;
  statesOfOperation: string[];
  currentProvider: string;
}

/** The editable fields as they are now, in a conflict. */
export interface AccountEditable {
  name: string;
  tradeName: string | null;
  website: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  industry: string | null;
  employees: number | null;
  statesOfOperation: string[];
  currentProvider: string | null;
}

/** Someone else changed the account while the person was editing it. Nothing was saved. `changed` names each field that differs, by its column name. */
export interface AccountConflict {
  conflict: true;
  currentVersion: number;
  current: AccountEditable;
  changed: ChangedField[];
}

export type AccountSaved = { conflict: false; account: AccountFields };

/** Why a call did not give an answer. The message is in words, the database's own where it says what to do. */
export type AccountFailure = "invalid" | "notAllowed" | "notFound" | "readOnly" | "failed";

export class AccountError extends Error {
  constructor(readonly kind: AccountFailure, message: string, readonly code?: string) {
    super(message);
  }
}

/** The account's own fields as the database gives them (its column names). */
type FieldsRow = {
  id: string;
  version: number;
  name: string;
  trade_name: string | null;
  website: string | null;
  web_domain: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  industry: string | null;
  employees: number | null;
  states_of_operation: string[];
  current_provider: string | null;
  source: AccountSource;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};
/** The fields a person edits, as the database gives them in a conflict. */
type EditableRow = Pick<
  FieldsRow,
  "name" | "trade_name" | "website" | "phone" | "street" | "city" | "state" | "postal_code" | "industry" | "employees" | "states_of_operation" | "current_provider"
>;

const nullableText = z.string().nullable();
const nullableNumber = z.number().nullable();

const fieldsShape = z.object({
  id: z.string().min(1),
  version: z.number().int().min(1),
  name: z.string(),
  trade_name: nullableText,
  website: nullableText,
  web_domain: nullableText,
  phone: nullableText,
  street: nullableText,
  city: nullableText,
  state: nullableText,
  postal_code: nullableText,
  industry: nullableText,
  employees: nullableNumber,
  states_of_operation: z.array(z.string()),
  current_provider: nullableText,
  source: z.enum(ACCOUNT_SOURCES),
  archived_at: nullableText,
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});

const fieldsSchema = fieldsShape as unknown as z.ZodType<FieldsRow>;

const detailsSchema = fieldsShape.extend({
  status: z.enum(["prospect", "client"]),
  owner: z.object({ id: z.string().min(1), name: z.string() }).nullable(),
  source_partner: nullableText,
});

const editableSchema: z.ZodType<EditableRow> = z.object({
  name: z.string(),
  trade_name: nullableText,
  website: nullableText,
  phone: nullableText,
  street: nullableText,
  city: nullableText,
  state: nullableText,
  postal_code: nullableText,
  industry: nullableText,
  employees: nullableNumber,
  states_of_operation: z.array(z.string()),
  current_provider: nullableText,
}) as unknown as z.ZodType<EditableRow>;

const jsonValue = z.any().refine((v) => v !== undefined, "a value, or null");

const contactSchema = z.object({
  id: z.string().min(1), first_name: nullableText, last_name: z.string(), title: nullableText, email: nullableText, phone: nullableText, mobile: nullableText,
  is_main: z.boolean(), do_not_email: z.boolean(),
});
const opportunitySchema = z.object({
  id: z.string().min(1), name: z.string(), stage: z.enum(OPPORTUNITY_STAGES), target_start: nullableText, submission_id: nullableText,
});
const quoteSchema = z.object({
  id: z.number().int(), submission_id: z.string().min(1), opportunity_id: z.string().min(1), opportunity_name: z.string(), peo_name: z.string(), status: z.string(),
  sent_on: nullableText, quote_received_on: nullableText, quote_expires_on: nullableText,
});
const changeSchema = z.object({
  type: z.literal("change"), entry_key: z.string().min(1), at: z.string().min(1), change_id: z.string().min(1), kind: z.enum(["created", "changed"]), who: z.string(),
  who_kind: z.enum(["member", "nevermore", "system"]), field: nullableText, from_value: jsonValue, to_value: jsonValue,
  record_table: z.enum(["accounts", "contacts"]), record_id: z.string().min(1), record_name: nullableText,
});
const activitySchema = z.union([changeSchema, activityItemSchema]);
const fileSchema = z.object({
  id: z.string().min(1), file_name: z.string(), mime_type: nullableText, size_bytes: nullableNumber, category: z.string(), created_at: z.string().min(1),
  submission_id: z.string().min(1), storage_path: z.string().min(1),
});

const tab = <T extends z.ZodTypeAny>(row: T) => z.object({ count: z.number().int().min(0), rows: z.array(row) });

const pageSchema = z.object({
  account: detailsSchema,
  can_change: z.boolean(),
  tabs: z.object({
    contacts: tab(contactSchema),
    opportunities: tab(opportunitySchema),
    quotes: tab(quoteSchema),
    activity: tab(activitySchema),
    files: tab(fileSchema),
  }),
});

const fieldsOf = (f: FieldsRow): AccountFields => ({
  id: f.id,
  version: f.version,
  name: f.name,
  tradeName: f.trade_name,
  website: f.website,
  webDomain: f.web_domain,
  phone: f.phone,
  street: f.street,
  city: f.city,
  state: f.state,
  postalCode: f.postal_code,
  industry: f.industry,
  employees: f.employees,
  statesOfOperation: f.states_of_operation,
  currentProvider: f.current_provider,
  source: f.source,
  archivedAt: f.archived_at,
  createdAt: f.created_at,
  updatedAt: f.updated_at,
});

const fileOf = (f: z.infer<typeof fileSchema>): AccountFile => ({
  id: f.id,
  fileName: f.file_name,
  mimeType: f.mime_type,
  sizeBytes: f.size_bytes,
  category: f.category,
  createdAt: f.created_at,
  submissionId: f.submission_id,
  storagePath: f.storage_path,
});

const contactOf = (c: z.infer<typeof contactSchema>): ContactRow => ({
  id: c.id, firstName: c.first_name, lastName: c.last_name, title: c.title, email: c.email, phone: c.phone, mobile: c.mobile, isMain: c.is_main, doNotEmail: c.do_not_email,
});
const opportunityOf = (o: z.infer<typeof opportunitySchema>): OpportunityRow => ({ id: o.id, name: o.name, stage: o.stage, targetStart: o.target_start, submissionId: o.submission_id });
const quoteOf = (q: z.infer<typeof quoteSchema>): QuoteRow => ({
  id: q.id, submissionId: q.submission_id, opportunityId: q.opportunity_id, opportunityName: q.opportunity_name, peoName: q.peo_name, status: q.status,
  sentOn: q.sent_on, quoteReceivedOn: q.quote_received_on, quoteExpiresOn: q.quote_expires_on,
});
const activityOf = (a: z.infer<typeof activitySchema>): ActivityRow => (a.type === "change" ? changeOf(a) : activityItemOf(a));
const changeOf = (a: z.infer<typeof changeSchema>): ChangeRow => ({
  type: a.type, entryKey: a.entry_key, at: a.at, changeId: a.change_id, kind: a.kind, who: a.who, whoKind: a.who_kind, field: a.field,
  from: a.from_value as Json | null, to: a.to_value as Json | null, recordTable: a.record_table, recordId: a.record_id, recordName: a.record_name,
});

const FALLBACK = "Couldn't load the account. Try again.";
const LIST_FALLBACK = "Couldn't load the list. Try again.";
const SAVE_FALLBACK = "Couldn't save the account. Try again.";

type DbError = { code?: string; message?: string };

/** An ended session is said in its own words (and signs the person out); the database's refusals keep their plain words; anything else is a failure to try again. */
function refusal(error: DbError, fallback: string): Error {
  const ended = classifyApiError({ message: error.message ?? "", code: error.code }, "");
  if (ended.unauthenticated) return ended;
  switch (error.code) {
    case "PT404": return new AccountError("notFound", "This account isn't available.", error.code);
    case "PT423": return new AccountError("readOnly", error.message || "This can't be changed right now.", error.code);
    case "22023": return new AccountError("invalid", error.message || fallback, error.code);
    case "42501": return new AccountError("notAllowed", error.message || "You can't change this account.", error.code);
    default: return new AccountError("failed", fallback, error.code);
  }
}

/**
 * An account's page: the account, whether the person may change it, and each tab's count and first five rows. Null when the person may not see the account
 * or there is none (the database answers the same for both, so the screen says "This account isn't available" for either). An answer that is not exactly the
 * agreed shape is a failure, never a page with something missing.
 */
export async function getAccountPage(firmId: string, accountId: string): Promise<AccountPage | null> {
  const { data, error } = await supabase.rpc("account_page", { p_firm_id: firmId, p_account_id: accountId });
  if (error) throw refusal(error, FALLBACK);
  if (data === null) return null;
  const parsed = pageSchema.safeParse(data);
  if (!parsed.success) throw new AccountError("failed", FALLBACK);
  const { account, can_change: canChange, tabs } = parsed.data;
  return {
    account: { ...fieldsOf(account as FieldsRow), status: account.status, owner: account.owner as { id: string; name: string } | null, sourcePartner: account.source_partner },
    canChange,
    tabs: {
      contacts: { count: tabs.contacts.count, rows: tabs.contacts.rows.map(contactOf) },
      opportunities: { count: tabs.opportunities.count, rows: tabs.opportunities.rows.map(opportunityOf) },
      quotes: { count: tabs.quotes.count, rows: tabs.quotes.rows.map(quoteOf) },
      activity: { count: tabs.activity.count, rows: tabs.activity.rows.map(activityOf) },
      files: { count: tabs.files.count, rows: tabs.files.rows.map(fileOf) },
    },
  };
}

/** How many files a page of the Files list holds when the caller does not say. The database allows 100 at most. */
export const ACCOUNT_FILES_PAGE_SIZE = 50;
/** How many rows a page of a tab holds when the caller does not say. The database allows 100 at most. */
export const ACCOUNT_TAB_PAGE_SIZE = 50;

/**
 * An account's files that passed the virus check, newest first: a page of them and how many there are in all. Null when the person may not see the account.
 * Each file is named and placed; the link that opens one is made by the one place that signs (src/lib/advisorApi.ts), from its storage path and name, and Storage allows it only to those its own file rule lets read it.
 */
export async function listAccountFiles(
  firmId: string,
  accountId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<TabRows<AccountFile> | null> {
  const { data, error } = await supabase.rpc("account_files", {
    p_firm_id: firmId,
    p_account_id: accountId,
    p_limit: options.limit ?? ACCOUNT_FILES_PAGE_SIZE,
    p_offset: options.offset ?? 0,
  });
  if (error) throw refusal(error, "Couldn't load the files. Try again.");
  if (data === null) return null;
  const parsed = tab(fileSchema).safeParse(data);
  if (!parsed.success) throw new AccountError("failed", "Couldn't load the files. Try again.");
  return { count: parsed.data.count, rows: parsed.data.rows.map(fileOf) };
}

/** The tabs that list more than the page's first five rows through `listAccountTab`. Files has `listAccountFiles`. */
export interface AccountTabRows {
  contacts: ContactRow;
  opportunities: OpportunityRow;
  quotes: QuoteRow;
  activity: ActivityRow;
}
export type AccountListTab = keyof AccountTabRows;

/** What the Activity tab is narrowed to: everything, or only calls, notes, tasks or the record's changes. The database narrows it, so counts and pages are of what is shown. */
export const ACTIVITY_FILTERS = ["all", "calls", "notes", "tasks", "changes"] as const;
export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number];

const tabShapes = {
  contacts: [tab(contactSchema), contactOf],
  opportunities: [tab(opportunitySchema), opportunityOf],
  quotes: [tab(quoteSchema), quoteOf],
  activity: [tab(activitySchema), activityOf],
} as const;

/**
 * A page of one tab of an account's page, from the first row or any later one: the rows the page holds the first five of, and how many the tab holds in all.
 * Null when the person may not see the account. Rows that are not the agreed shape for the tab are a failure, never a list with something missing.
 */
export async function listAccountTab<T extends AccountListTab>(
  firmId: string,
  accountId: string,
  which: T,
  options: { limit?: number; offset?: number; filter?: ActivityFilter } = {},
): Promise<TabRows<AccountTabRows[T]> | null> {
  const { data, error } = await supabase.rpc("account_tab", {
    p_firm_id: firmId,
    p_account_id: accountId,
    p_tab: which === "activity" && options.filter && options.filter !== "all" ? `activity_${options.filter}` : which,
    p_limit: options.limit ?? ACCOUNT_TAB_PAGE_SIZE,
    p_offset: options.offset ?? 0,
  });
  if (error) throw refusal(error, LIST_FALLBACK);
  if (data === null) return null;
  const [shape, rowOf] = tabShapes[which] as unknown as [ReturnType<typeof tab>, (row: unknown) => AccountTabRows[T]];
  const parsed = shape.safeParse(data);
  if (!parsed.success) throw new AccountError("failed", LIST_FALLBACK);
  return { count: parsed.data.count, rows: (parsed.data.rows as unknown[]).map(rowOf) };
}

/**
 * Saves the account's own fields from the version the person started from. A save from a version that is no longer current saves nothing and answers with
 * what is there now and who changed what (`conflict: true`), which is not a failure. A refusal is an `AccountError`: `invalid` (the database says what is
 * wrong, in words), `notAllowed` (the level rule: the database says who may), `notFound`, `readOnly` (a closing firm, Nevermore support) or `failed`.
 */
export async function updateAccount(firmId: string, accountId: string, edit: AccountEdit, version: number): Promise<AccountSaved | AccountConflict> {
  const { data, error } = await supabase.rpc("update_account", {
    p_account_id: accountId,
    p_name: edit.name,
    p_trade_name: edit.tradeName,
    p_website: edit.website,
    p_phone: edit.phone,
    p_street: edit.street,
    p_city: edit.city,
    p_state: edit.state,
    p_postal_code: edit.postalCode,
    p_industry: edit.industry,
    p_employees: edit.employees,
    p_states_of_operation: edit.statesOfOperation,
    p_current_provider: edit.currentProvider,
    p_firm_id: firmId,
    p_version: version,
  });
  if (error) throw refusal(error, SAVE_FALLBACK);
  const answer = readSaveAnswer(data, fieldsSchema, editableSchema);
  if (!answer) throw new AccountError("failed", SAVE_FALLBACK);
  if (!answer.conflict) return { conflict: false, account: fieldsOf((answer as Saved<FieldsRow>).record) };
  const c = (answer as RecordConflict<EditableRow>).current;
  return {
    conflict: true,
    currentVersion: (answer as RecordConflict<EditableRow>).currentVersion,
    current: {
      name: c.name,
      tradeName: c.trade_name,
      website: c.website,
      phone: c.phone,
      street: c.street,
      city: c.city,
      state: c.state,
      postalCode: c.postal_code,
      industry: c.industry,
      employees: c.employees,
      statesOfOperation: c.states_of_operation,
      currentProvider: c.current_provider,
    },
    changed: (answer as RecordConflict<EditableRow>).changed,
  };
}

/** The account that holds a submission, for the link "Account: <name>" on the submission's page (D-213). Null when it is on none or the person may not see it. */
export async function getSubmissionAccount(firmId: string, submissionId: string): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase.rpc("submission_account", { p_firm_id: firmId, p_submission_id: submissionId });
  if (error) throw refusal(error, FALLBACK);
  if (data === null) return null;
  const parsed = z.object({ id: z.string().min(1), name: z.string() }).safeParse(data);
  if (!parsed.success) throw new AccountError("failed", FALLBACK);
  return parsed.data as { id: string; name: string };
}
