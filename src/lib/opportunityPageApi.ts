import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { classifyApiError } from "@/lib/advisorApi";
import { activityItemOf, activityItemSchema, type ActivityItem } from "@/lib/activityApi";
import { OPPORTUNITY_STAGES, type OpportunityStage, type TabRows } from "@/lib/accountPageApi";
import { isConflict, readSaveAnswer, type ChangedField, type RecordConflict, type Saved } from "@/lib/recordVersion";

// What the opportunity's page asks the database (story CRM-O1.1b, screen 19; 20261120120000_opportunity_page.sql). Three calls: the page (the opportunity with its
// stage, account, owner and main contact, its quote requests, its intake's summary and its contacts), a page of its activity, and the save of its own fields with
// its version. The database decides every rule: who may see an opportunity (whoever sees its account, D-422), who may change it (the level rule on its own owner,
// D-209, never on an archived account, D-432), a closing firm and Nevermore support. This only puts its answers and refusals into the screen's shape and words, and
// checks that an answer is exactly the agreed shape.

/** The opportunity's own fields as the page and a save answer them. */
export interface OpportunityFields {
  id: string;
  /** The version to start the next save from. */
  version: number;
  accountId: string;
  ownerId: string | null;
  name: string;
  targetStart: string | null;
  employees: number | null;
  mainContactId: string | null;
  expectedClose: string | null;
  /** What the opportunity is worth a year, in dollars. */
  value: number | null;
  source: string | null;
  /** The firm's referral partner that sent it, when the source is Referral and one is named (D-439); null otherwise. Shown, never chosen on this page. */
  referralPartner: { code: string; name: string } | null;
  nextStep: string | null;
  /** The intake (submission) the opportunity holds; null before one is started. */
  submissionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityDetails extends OpportunityFields {
  /** Worked out by the database, never stored (D-408). */
  stage: OpportunityStage;
}

/** One quote request of the intake, PEO by PEO. */
export interface OpportunityQuote {
  id: number;
  peoName: string;
  status: string;
  sentOn: string | null;
  quoteReceivedOn: string | null;
  quoteExpiresOn: string | null;
  /** The admin fee per employee per month, in dollars. */
  adminFeePepm: number | null;
}

/** The intake an opportunity holds, summarised (D-425). What a certification does not hold is null: all of it for an intake never certified. */
export interface IntakeSummary {
  submissionId: string;
  fileId: string | null;
  /** The submission's pipeline status (draft, submitted, ...), which says what is being waited for. */
  pipelineStatus: string | null;
  certifiedBy: string | null;
  certifiedAt: string | null;
  version: number | null;
  censusSize: number | null;
  /** While the draft is live: how many answers it holds, and the name the prospect gave. Null once certified. */
  answered: number | null;
  prospectName: string | null;
  openItems: { count: number; firstLabel: string | null; firstField: string | null };
}

/** A contact on this search (D-429): the main contact and/or the contact made from the intake's prospect. */
export interface OpportunityContact {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  main: boolean;
  fillsInIntake: boolean;
}

export interface OpportunityPage {
  opportunity: OpportunityDetails;
  account: { id: string; name: string; archived: boolean };
  owner: { id: string; name: string } | null;
  mainContact: { id: string; name: string } | null;
  /** The level rule on the opportunity's own owner, and never on an archived account: Edit is shown only to those it will serve. */
  canChange: boolean;
  /** False on an archived account: nothing new can be added there (D-222). */
  canAdd: boolean;
  quotes: OpportunityQuote[];
  intake: IntakeSummary | null;
  contacts: OpportunityContact[];
}

/** One entry of the record history: a creation, a change of a field, or a move of the stage (D-413). */
export interface OpportunityChangeRow {
  type: "change";
  entryKey: string;
  at: string;
  changeId: string;
  kind: "created" | "changed" | "stage_changed";
  /** A member's email, "Nevermore" or "System" (D-33). */
  who: string;
  whoKind: "member" | "nevermore" | "system";
  field: string | null;
  from: Json | null;
  to: Json | null;
  /** What moved the stage, when something did: a send or a quote, with the PEO it was for. */
  cause: "quote_send" | "quote_recorded" | null;
  causePeo: string | null;
  recordTable: "opportunities";
  recordId: string;
  recordName: string | null;
}

/** An event of one of the opportunity's quote requests. */
export interface OpportunityQuoteEvent {
  type: "quote";
  entryKey: string;
  at: string;
  quoteRequestId: number;
  peoName: string;
  event: "sent" | "quoted" | "declined" | "closed";
  who: string;
  whoKind: "member" | "nevermore" | "system";
}

/** One entry of the opportunity's activity (D-427), newest first. `type` tells which. */
export type OpportunityActivityRow = OpportunityChangeRow | OpportunityQuoteEvent | ActivityItem;

/** What the activity is narrowed to. The database narrows it, so counts and pages are of what is shown. */
export const OPPORTUNITY_ACTIVITY_FILTERS = ["all", "calls", "notes", "tasks", "changes"] as const;
export type OpportunityActivityFilter = (typeof OPPORTUNITY_ACTIVITY_FILTERS)[number];

/** The fields a person edits in place. A blank text is cleared; the stage and the account are never edited (D-428). */
export interface OpportunityEdit {
  name: string;
  targetStart: string;
  employees: number | null;
  mainContactId: string | null;
  expectedClose: string;
  value: number | null;
  source: string;
  nextStep: string;
  /** The person chosen as the owner; null leaves it as it is. */
  ownerId: string | null;
}

/** The editable fields as they are now, in a conflict. */
export interface OpportunityEditable {
  name: string;
  targetStart: string | null;
  employees: number | null;
  mainContactId: string | null;
  expectedClose: string | null;
  value: number | null;
  source: string | null;
  nextStep: string | null;
  ownerId: string | null;
}

/** Someone else changed the opportunity while the person was editing it. Nothing was saved. `changed` names each field that differs, by its column name. */
export interface OpportunityConflict {
  conflict: true;
  currentVersion: number;
  current: OpportunityEditable;
  changed: ChangedField[];
}

export type OpportunitySaved = { conflict: false; opportunity: OpportunityFields };

/** Why a call did not give an answer. The message is in words, the database's own where it says what to do. */
export type OpportunityFailure = "invalid" | "notAllowed" | "notFound" | "readOnly" | "failed";

export class OpportunityError extends Error {
  constructor(readonly kind: OpportunityFailure, message: string, readonly code?: string) {
    super(message);
  }
}

const nullableText = z.string().nullable();
const nullableNumber = z.number().nullable();

type FieldsRow = {
  id: string; version: number; account_id: string; owner_id: string | null; name: string; target_start: string | null; employees: number | null;
  main_contact_id: string | null; expected_close: string | null; value: number | null; source: string | null; next_step: string | null; submission_id: string | null;
  created_at: string; updated_at: string;
  /** Missing in an older answer: read as none. */
  referral_partner?: { code: string; name: string } | null;
};
type EditableRow = Pick<FieldsRow, "name" | "target_start" | "employees" | "main_contact_id" | "expected_close" | "value" | "source" | "next_step" | "owner_id">;

const fieldsShape = z.object({
  id: z.string().min(1), version: z.number().int().min(1), account_id: z.string().min(1), owner_id: nullableText, name: z.string(), target_start: nullableText,
  employees: nullableNumber, main_contact_id: nullableText, expected_close: nullableText, value: nullableNumber, source: nullableText, next_step: nullableText,
  submission_id: nullableText, created_at: z.string().min(1), updated_at: z.string().min(1),
  referral_partner: z.object({ code: z.string(), name: z.string() }).nullish(),
});
const fieldsSchema = fieldsShape as unknown as z.ZodType<FieldsRow>;
const editableSchema = z.object({
  name: z.string(), target_start: nullableText, employees: nullableNumber, main_contact_id: nullableText, expected_close: nullableText, value: nullableNumber,
  source: nullableText, next_step: nullableText, owner_id: nullableText,
}) as unknown as z.ZodType<EditableRow>;

const person = z.object({ id: z.string().min(1), name: z.string() });
const quoteSchema = z.object({
  id: z.number().int(), peo_name: z.string(), status: z.string(), sent_on: nullableText, quote_received_on: nullableText, quote_expires_on: nullableText,
  admin_fee_pepm: nullableNumber,
});
const intakeSchema = z.object({
  submission_id: z.string().min(1), file_id: nullableText, pipeline_status: nullableText, certified_by: nullableText, certified_at: nullableText,
  version: z.number().int().nullable(), census_size: z.number().int().nullable(), answered: z.number().int().nullable(), prospect_name: nullableText,
  open_items: z.object({ count: z.number().int().min(0), first_label: nullableText, first_field: nullableText }),
});
const contactSchema = z.object({
  id: z.string().min(1), name: z.string(), title: nullableText, email: nullableText, phone: nullableText, main: z.boolean(), fills_in_intake: z.boolean(),
});
const pageSchema = z.object({
  opportunity: fieldsShape.extend({ stage: z.enum(OPPORTUNITY_STAGES) }),
  account: z.object({ id: z.string().min(1), name: z.string(), archived: z.boolean() }),
  owner: person.nullable(),
  main_contact: person.nullable(),
  can_change: z.boolean(),
  can_add: z.boolean(),
  quotes: z.array(quoteSchema),
  intake: intakeSchema.nullable(),
  contacts: z.array(contactSchema),
});

const whoKind = z.enum(["member", "nevermore", "system"]);
const jsonValue = z.any().refine((v) => v !== undefined, "a value, or null");
const changeSchema = z.object({
  type: z.literal("change"), entry_key: z.string().min(1), at: z.string().min(1), change_id: z.string().min(1), kind: z.enum(["created", "changed", "stage_changed"]),
  who: z.string(), who_kind: whoKind, field: nullableText, from_value: jsonValue, to_value: jsonValue, cause: z.enum(["quote_send", "quote_recorded"]).nullable(),
  cause_peo: nullableText, record_table: z.literal("opportunities"), record_id: z.string().min(1), record_name: nullableText,
});
const quoteEventSchema = z.object({
  type: z.literal("quote"), entry_key: z.string().min(1), at: z.string().min(1), quote_request_id: z.number().int(), peo_name: z.string(),
  event: z.enum(["sent", "quoted", "declined", "closed"]), who: z.string(), who_kind: whoKind,
});
const activityShape = z.union([changeSchema, quoteEventSchema, activityItemSchema]);

const fieldsOf = (f: FieldsRow): OpportunityFields => ({
  id: f.id, version: f.version, accountId: f.account_id, ownerId: f.owner_id, name: f.name, targetStart: f.target_start, employees: f.employees,
  mainContactId: f.main_contact_id, expectedClose: f.expected_close, value: f.value, source: f.source, referralPartner: f.referral_partner ?? null, nextStep: f.next_step,
  submissionId: f.submission_id, createdAt: f.created_at, updatedAt: f.updated_at,
});

const activityOf = (a: z.infer<typeof activityShape>): OpportunityActivityRow => {
  if (a.type === "change") {
    return {
      type: "change", entryKey: a.entry_key, at: a.at, changeId: a.change_id, kind: a.kind, who: a.who, whoKind: a.who_kind, field: a.field, from: a.from_value as Json | null,
      to: a.to_value as Json | null, cause: a.cause, causePeo: a.cause_peo, recordTable: a.record_table, recordId: a.record_id, recordName: a.record_name,
    };
  }
  if (a.type === "quote") {
    return { type: "quote", entryKey: a.entry_key, at: a.at, quoteRequestId: a.quote_request_id, peoName: a.peo_name, event: a.event, who: a.who, whoKind: a.who_kind };
  }
  return activityItemOf(a);
};

const FALLBACK = "Couldn't load the opportunity. Try again.";
const LIST_FALLBACK = "Couldn't load the activity. Try again.";
const SAVE_FALLBACK = "Couldn't save the opportunity. Check your connection and try again.";

type DbError = { code?: string; message?: string };

/** An ended session is said in its own words (and signs the person out); the database's refusals keep their plain words; anything else is a failure to try again. */
function refusal(error: DbError, fallback: string): Error {
  const ended = classifyApiError({ message: error.message ?? "", code: error.code }, "");
  if (ended.unauthenticated) return ended;
  switch (error.code) {
    case "PT404": return new OpportunityError("notFound", "That opportunity isn't available.", error.code);
    case "PT423": return new OpportunityError("readOnly", error.message || "This can't be changed right now.", error.code);
    case "55000": return new OpportunityError("readOnly", error.message || "This account is archived. Nothing on its opportunities can be changed.", error.code);
    case "22023":
    case "PT409":
    case "40001": return new OpportunityError("invalid", error.message || fallback, error.code);
    case "22003": return new OpportunityError("invalid", "That number is too big.", error.code);
    case "42501": return new OpportunityError("notAllowed", error.message || "You can't change this opportunity.", error.code);
    // Anything else keeps its code (an address that is no id at all, 22P02, is told apart by the page).
    default: return new OpportunityError("failed", fallback, error.code);
  }
}

/**
 * The opportunity's page. Null when it is not there, is another firm's or may not be seen (the database refuses all three the same way, PT404, so the screen
 * says "This opportunity isn't available" for any). An answer that is not exactly the agreed shape is a failure, never a page with something missing.
 */
export async function getOpportunityPage(firmId: string, opportunityId: string): Promise<OpportunityPage | null> {
  const { data, error } = await supabase.rpc("opportunity_page", { p_firm_id: firmId, p_opportunity_id: opportunityId });
  if (error) {
    if (error.code === "PT404") return null;
    throw refusal(error, FALLBACK);
  }
  const parsed = pageSchema.safeParse(data);
  if (!parsed.success) throw new OpportunityError("failed", FALLBACK);
  const p = parsed.data;
  return {
    opportunity: { ...fieldsOf(p.opportunity as FieldsRow), stage: p.opportunity.stage },
    account: p.account as OpportunityPage["account"],
    owner: p.owner as OpportunityPage["owner"],
    mainContact: p.main_contact as OpportunityPage["mainContact"],
    canChange: p.can_change,
    canAdd: p.can_add,
    quotes: p.quotes.map((q) => ({
      id: q.id, peoName: q.peo_name, status: q.status, sentOn: q.sent_on, quoteReceivedOn: q.quote_received_on, quoteExpiresOn: q.quote_expires_on, adminFeePepm: q.admin_fee_pepm,
    })),
    intake: p.intake && {
      submissionId: p.intake.submission_id, fileId: p.intake.file_id, pipelineStatus: p.intake.pipeline_status, certifiedBy: p.intake.certified_by,
      certifiedAt: p.intake.certified_at, version: p.intake.version, censusSize: p.intake.census_size, answered: p.intake.answered, prospectName: p.intake.prospect_name,
      openItems: { count: p.intake.open_items.count, firstLabel: p.intake.open_items.first_label, firstField: p.intake.open_items.first_field },
    },
    contacts: p.contacts.map((c) => ({ id: c.id, name: c.name, title: c.title, email: c.email, phone: c.phone, main: c.main, fillsInIntake: c.fills_in_intake })),
  };
}

/** How many rows a page of the activity holds when the caller does not say. The database allows 100 at most. */
export const OPPORTUNITY_ACTIVITY_PAGE_SIZE = 50;

/** A page of the opportunity's activity, newest first, and how many there are in all. Null when the person may not see the opportunity. */
export async function listOpportunityActivity(
  firmId: string,
  opportunityId: string,
  options: { filter?: OpportunityActivityFilter; limit?: number; offset?: number } = {},
): Promise<TabRows<OpportunityActivityRow> | null> {
  const { data, error } = await supabase.rpc("opportunity_activity", {
    p_firm_id: firmId,
    p_opportunity_id: opportunityId,
    p_filter: options.filter ?? "all",
    p_limit: options.limit ?? OPPORTUNITY_ACTIVITY_PAGE_SIZE,
    p_offset: options.offset ?? 0,
  });
  if (error) {
    if (error.code === "PT404") return null;
    throw refusal(error, LIST_FALLBACK);
  }
  const parsed = z.object({ count: z.number().int().min(0), rows: z.array(activityShape) }).safeParse(data);
  if (!parsed.success) throw new OpportunityError("failed", LIST_FALLBACK);
  return { count: parsed.data.count, rows: parsed.data.rows.map(activityOf) };
}

/**
 * Saves the opportunity's own fields from the version the person started from. A save from a version that is no longer current saves nothing and answers with what
 * is there now and who changed what (`conflict: true`), which is not a failure. A refusal is an `OpportunityError`: `invalid` (the database says what is wrong, in
 * words), `notAllowed` (the level rule: the database says who may), `notFound`, `readOnly` (a closing firm, Nevermore support, an archived account) or `failed`.
 */
export async function updateOpportunity(firmId: string, opportunityId: string, edit: OpportunityEdit, version: number): Promise<OpportunitySaved | OpportunityConflict> {
  const { data, error } = await supabase.rpc("update_opportunity", {
    p_opportunity_id: opportunityId,
    p_name: edit.name,
    p_target_start: edit.targetStart === "" ? null : edit.targetStart,
    p_employees: edit.employees,
    p_main_contact_id: edit.mainContactId,
    p_expected_close: edit.expectedClose === "" ? null : edit.expectedClose,
    p_value: edit.value,
    p_source: edit.source,
    p_next_step: edit.nextStep,
    p_owner_id: edit.ownerId,
    p_firm_id: firmId,
    p_version: version,
  });
  if (error) throw refusal(error, SAVE_FALLBACK);
  const answer = readSaveAnswer(data, fieldsSchema, editableSchema);
  if (!answer) throw new OpportunityError("failed", SAVE_FALLBACK);
  if (!answer.conflict) return { conflict: false, opportunity: fieldsOf((answer as Saved<FieldsRow>).record) };
  const c = (answer as RecordConflict<EditableRow>).current;
  return {
    conflict: true,
    currentVersion: (answer as RecordConflict<EditableRow>).currentVersion,
    current: {
      name: c.name, targetStart: c.target_start, employees: c.employees, mainContactId: c.main_contact_id, expectedClose: c.expected_close, value: c.value, source: c.source,
      nextStep: c.next_step, ownerId: c.owner_id,
    },
    changed: (answer as RecordConflict<EditableRow>).changed,
  };
}


// ---------- Closing an opportunity (story CRM-O1.3b, screen 26; 20261120121000_won_lost_commission.sql) ----------
// Won, lost and reopened are each all or none in the database, with the version check (D-461). The answers: {conflict: false, record: {stage, version, ...}} or, when
// someone saved first and nothing was done, {conflict: true, currentVersion, current: {stage}, changed}. The database decides who may (D-462), what is refused (D-463,
// D-469, D-471) and says why in words; this only puts the answers into the screen's shape. The tables the banner reads (placements, renewals, commission payments,
// the lost reason, a quote's close reason) are read through the firm's row security, which shows them to whoever sees the account (D-467).

/** What a close or a reopen did: the stage the opportunity is now at, and the version to start the next save from. */
export type OpportunityClosed = { conflict: false; stage: OpportunityStage; version: number };

/** Someone else changed the opportunity first. Nothing was done. `stage` is where it is now; `changed` names each field that differs, and who changed it. */
export type OpportunityCloseConflict = { conflict: true; currentVersion: number; stage: OpportunityStage; changed: ChangedField[] };

/** The commission a win expects (D-466): its basis, the person's number (a percent for a share, dollars otherwise) and the yearly figure expected. */
export interface PlacementCommission {
  basis: "share" | "per_employee" | "flat";
  rate: number;
  expectedYearly: number | null;
}

export interface WinInput {
  quoteRequestId: number;
  startDate: string;
  renewalDate: string;
  brokerOfRecord: string;
  commission: PlacementCommission | null;
}

const CLOSE_FALLBACK = "Couldn't save. Check your connection and try again.";

const changedSchema = z.object({ field: z.string().min(1), value: z.any().refine((v) => v !== undefined, "a value, or null"), who: z.string().min(1), at: z.string().min(1) });
const closedAnswer = z.union([
  z.object({ conflict: z.literal(false), record: z.object({ stage: z.enum(OPPORTUNITY_STAGES), version: z.number().int().min(1) }) }),
  z.object({ conflict: z.literal(true), currentVersion: z.number().int().min(1), current: z.object({ stage: z.enum(OPPORTUNITY_STAGES) }), changed: z.array(changedSchema) }),
]);

async function close(name: "opportunity_mark_won" | "opportunity_mark_lost" | "opportunity_reopen", args: Record<string, unknown>): Promise<OpportunityClosed | OpportunityCloseConflict> {
  const { data, error } = await (supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: DbError | null }>)(name, args);
  if (error) throw refusal(error, CLOSE_FALLBACK);
  const parsed = closedAnswer.safeParse(data);
  if (!parsed.success) throw new OpportunityError("failed", CLOSE_FALLBACK);
  // The shapes are checked above; the compiler (not strict) cannot narrow the union zod infers, so it is named here.
  const a = parsed.data as unknown as
    | { conflict: false; record: { stage: OpportunityStage; version: number } }
    | { conflict: true; currentVersion: number; current: { stage: OpportunityStage }; changed: ChangedField[] };
  if (isConflict(a)) return { conflict: true, currentVersion: a.currentVersion, stage: a.current.stage, changed: a.changed };
  return { conflict: false, stage: a.record.stage, version: a.record.version };
}

/** Marks the opportunity won on the quote the employer took, making the placement and its renewal, from the version the person started from. */
export const markOpportunityWon = (firmId: string, opportunityId: string, win: WinInput, version: number) =>
  close("opportunity_mark_won", {
    p_opportunity_id: opportunityId, p_quote_request_id: win.quoteRequestId, p_start_date: win.startDate, p_renewal_date: win.renewalDate, p_broker_of_record: win.brokerOfRecord,
    p_firm_id: firmId, p_version: version, p_commission_basis: win.commission?.basis ?? null, p_commission_rate: win.commission?.rate ?? null,
    p_commission_expected_yearly: win.commission?.expectedYearly ?? null,
  });

/** Marks the opportunity lost for a reason from the fixed list (Other needs a note), from the version the person started from. */
export const markOpportunityLost = (firmId: string, opportunityId: string, lost: { reason: string; note: string }, version: number) =>
  close("opportunity_mark_lost", { p_opportunity_id: opportunityId, p_reason: lost.reason, p_note: lost.note.trim() === "" ? null : lost.note.trim(), p_firm_id: firmId, p_version: version });

/** Reopens a won or lost opportunity (ADR 0027): the database refuses it while the win's renewal is being worked or its placement has payments, in words. */
export const reopenOpportunity = (firmId: string, opportunityId: string, version: number) =>
  close("opportunity_reopen", { p_opportunity_id: opportunityId, p_firm_id: firmId, p_version: version });

/** A payment recorded: what the firm has received for the placement to date, against what it expected a year. */
export interface CommissionRecorded {
  receivedToDate: number;
  expectedYearly: number | null;
}

const paymentAnswer = z.object({ received_to_date: z.number(), expected_yearly: z.number().nullable() }).passthrough();

/** Records commission received against the placement won from the opportunity (D-467). */
export async function recordCommissionPayment(firmId: string, placementId: string, payment: { receivedOn: string; amount: number; note: string }): Promise<CommissionRecorded> {
  const { data, error } = await (supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: DbError | null }>)("record_commission_payment", {
    p_placement_id: placementId, p_received_on: payment.receivedOn, p_amount: payment.amount, p_note: payment.note, p_firm_id: firmId,
  });
  if (error) throw refusal(error, "Couldn't record the payment. Check your connection and try again.");
  const parsed = paymentAnswer.safeParse(data);
  if (!parsed.success) throw new OpportunityError("failed", "Couldn't record the payment. Check your connection and try again.");
  return { receivedToDate: parsed.data.received_to_date, expectedYearly: parsed.data.expected_yearly };
}

export interface CommissionPayment {
  id: string;
  receivedOn: string;
  amount: number;
  note: string | null;
  version: number;
}

/** The placement a win made, for the banner (D-472): its PEO, start and the renewal made with it, the broker of record and the commission expected. */
export interface OpportunityPlacement {
  id: string;
  peoName: string;
  startDate: string | null;
  brokerOfRecord: string | null;
  endedOn: string | null;
  renewsOn: string | null;
  commission: PlacementCommission | null;
  version: number;
}

/** What the banner and the quotes panel need beyond the page: the lost reason (D-468), the placement with its payments (D-467) and each quote's close reason (D-424). */
export interface OpportunityOutcome {
  lostReason: string | null;
  lostNote: string | null;
  placement: OpportunityPlacement | null;
  payments: CommissionPayment[];
  receivedToDate: number;
  /** By quote request id: why it closed, and the start the PEO proposed (the win's default start, D-465). */
  quotes: Record<number, { closeReason: string | null; proposedStart: string | null }>;
}

const OUTCOME_FALLBACK = "Couldn't load how this opportunity ended. Try again.";
const untyped = () => supabase as unknown as SupabaseClient;
const money = (v: unknown): number => Number(v);

/** Reads one table; a failed read is a failure, never "nothing there" (a won opportunity must not be drawn without its banner). */
async function readRows<T>(read: PromiseLike<{ data: T | null; error: DbError | null }>): Promise<T | null> {
  const { data, error } = await read;
  if (error) throw refusal(error, OUTCOME_FALLBACK);
  return data;
}

export async function getOpportunityOutcome(firmId: string, opportunityId: string, submissionId: string | null): Promise<OpportunityOutcome> {
  const db = untyped();
  const [opp, pl, quoteRows] = await Promise.all([
    readRows(db.from("opportunities").select("lost_reason, lost_note").eq("id", opportunityId).eq("firm_id", firmId).maybeSingle()),
    readRows(db.from("placements").select("id, peo_name, start_date, broker_of_record, ended_on, commission_basis, commission_rate, commission_expected_yearly, version")
      .eq("opportunity_id", opportunityId).eq("firm_id", firmId).maybeSingle()),
    submissionId === null ? Promise.resolve([]) : readRows(db.from("quote_requests").select("id, close_reason, proposed_start_on").eq("session_id", submissionId)),
  ]);
  const placementRow = pl as { id: string; peo_name: string; start_date: string | null; broker_of_record: string | null; ended_on: string | null; commission_basis: string | null; commission_rate: unknown; commission_expected_yearly: unknown; version: number } | null;
  let renewsOn: string | null = null;
  let payments: CommissionPayment[] = [];
  if (placementRow) {
    const [renewal, paid] = await Promise.all([
      readRows(db.from("renewals").select("renews_on").eq("placement_id", placementRow.id).maybeSingle()),
      readRows(db.from("commission_payments").select("id, received_on, amount, note, version").eq("placement_id", placementRow.id).order("received_on", { ascending: true })),
    ]);
    renewsOn = (renewal as { renews_on: string } | null)?.renews_on ?? null;
    payments = ((paid ?? []) as { id: string; received_on: string; amount: unknown; note: string | null; version: number }[])
      .map((r) => ({ id: r.id, receivedOn: r.received_on, amount: money(r.amount), note: r.note, version: r.version }));
  }
  const o = opp as { lost_reason: string | null; lost_note: string | null } | null;
  return {
    lostReason: o?.lost_reason ?? null,
    lostNote: o?.lost_note ?? null,
    placement: placementRow && {
      id: placementRow.id, peoName: placementRow.peo_name, startDate: placementRow.start_date, brokerOfRecord: placementRow.broker_of_record, endedOn: placementRow.ended_on, renewsOn,
      commission: placementRow.commission_basis
        ? { basis: placementRow.commission_basis as PlacementCommission["basis"], rate: money(placementRow.commission_rate), expectedYearly: placementRow.commission_expected_yearly === null ? null : money(placementRow.commission_expected_yearly) }
        : null,
      version: placementRow.version,
    },
    payments,
    receivedToDate: payments.reduce((sum, p) => Math.round((sum + p.amount) * 100) / 100, 0),
    quotes: Object.fromEntries(((quoteRows ?? []) as { id: number; close_reason: string | null; proposed_start_on: string | null }[]).map((q) => [q.id, { closeReason: q.close_reason, proposedStart: q.proposed_start_on }])),
  };
}

/**
 * The opportunity that holds a submission as its intake, for the console's stage control (D-470): Won and Lost there open the opportunity's own dialog. Null when the
 * submission is on no opportunity, or the read fails: the database still refuses a win or loss the console could not route (`set_submission_status`).
 */
export async function getOpportunityOfSubmission(submissionId: string): Promise<{ id: string; firmId: string } | null> {
  try {
    const { data, error } = await untyped().from("opportunities").select("id, firm_id").eq("intake_id", submissionId).maybeSingle();
    const row = data as { id?: unknown; firm_id?: unknown } | null;
    if (error || typeof row?.id !== "string" || typeof row.firm_id !== "string") return null;
    return { id: row.id, firmId: row.firm_id };
  } catch {
    return null;
  }
}

/** The firm's own name, which the win offers as the broker of record (D-465). Empty when it cannot be read: the person types it. */
export async function getFirmName(firmId: string): Promise<string> {
  try {
    const { data, error } = await untyped().from("firms").select("name").eq("id", firmId).maybeSingle();
    return error ? "" : (data as { name?: string } | null)?.name ?? "";
  } catch {
    return "";
  }
}
