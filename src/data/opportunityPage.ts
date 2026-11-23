import { z } from "zod";
import { dateRule, nameRule, wholeNumberRule } from "@/components/workspace/form/fieldRules";
import type { Json } from "@/integrations/supabase/types";
import type { OpportunityStage } from "@/lib/accountPageApi";
import type { OpportunityChangeRow, OpportunityEdit, OpportunityEditable, OpportunityFields, OpportunityIntakeEvent, OpportunityQuoteEvent } from "@/lib/opportunityPageApi";
import { formatDay, STAGE_LABELS, valueWords } from "./accountPage";
import { MARKET_WORDS, type QuoteLine } from "./lines";
import { DECLINE_REASON_LABELS, isOpenQuoteRequest, type DeclineReason } from "./quoteRequests";

// The words the opportunity's page says (story CRM-O1.1b, screen 19): the stage bar, what would move the stage on, how a quote request's row reads, and the form's
// two conversions between what a person types and what the database holds. Words only: who may see or change an opportunity, and the stage itself, are the
// database's. These are tested through the page that uses them (D-50).

/** The five places the bar always shows (D-415). Won, or Lost for a lost one, takes the sixth. */
export const STAGE_BAR_FIRST_FIVE = ["qualifying", "intake_under_way", "ready_to_send", "in_market", "quoted"] as const satisfies readonly OpportunityStage[];

export interface StagePlace {
  stage: OpportunityStage;
  label: string;
  /** Before the current stage on the way to Won; a lost opportunity has no way to say how far it got, so it marks none. */
  done: boolean;
  current: boolean;
}

/** The bar's six places for an opportunity at `stage`. */
export function stageBar(stage: OpportunityStage): StagePlace[] {
  const last: OpportunityStage = stage === "lost" ? "lost" : "won";
  const at = stage === "won" ? 5 : (STAGE_BAR_FIRST_FIVE as readonly string[]).indexOf(stage);
  return [...STAGE_BAR_FIRST_FIVE, last].map((s, i) => ({ stage: s, label: STAGE_LABELS[s], done: stage !== "lost" && i < at, current: s === stage }));
}

/** A first name from a full one: "Elena Marsh" is "Elena". */
const firstName = (full: string | null | undefined): string | null => {
  const first = (full ?? "").trim().split(/\s+/)[0];
  return first ? first : null;
};

/**
 * What would move the stage on, under the bar (D-414): guidance, never a button a later epic owns (D-402). The name is the prospect's first name, else the main
 * contact's, else "the employer". Null when there is nothing to wait for (Won and Lost: the banner says it, CRM-O1.3b).
 */
export function nextStepWords(stage: OpportunityStage, pipelineStatus: string | null, prospectName: string | null, mainContactName: string | null, line: QuoteLine = "peo"): string | null {
  const name = firstName(prospectName) ?? firstName(mainContactName) ?? "the employer";
  // Who a search is sent to, in its line's word (ADR 0029): a PEO, or a carrier.
  const market = MARKET_WORDS[line].a;
  switch (stage) {
    case "qualifying": return "Start the quote to move to Intake under way";
    case "intake_under_way":
      if (pipelineStatus === "submitted" || pipelineStatus === "under_review") return "Waiting for the review to finish";
      if (pipelineStatus === "information_requested") return `Waiting for ${name} to answer`;
      return `Waiting for ${name} to certify`;
    case "ready_to_send": return `Send to ${market} to move to In market`;
    case "in_market": return `Waiting for ${market} to quote`;
    case "quoted": return "Mark won or lost when the employer decides";
    default: return null;
  }
}

// ---------- the facts in the header ----------

export const employeeCountWords = (n: number): string => `${n.toLocaleString("en-US")} ${n === 1 ? "employee" : "employees"}`;

// ---------- the form ----------

const MOST_VALUE = 1_000_000_000_000;

/**
 * The rules of an opportunity's own fields as the edit form applies them. The database asks the same (opportunity_input_error), so a form that takes a value is a
 * form the database takes: a name, up to 200 characters; a count of employees; a value in dollars under a trillion, to the cent; a source up to 100 characters
 * (the box offers only the list and the opportunity's own older value, which the database accepts unchanged); a next step up to 2,000.
 */
export const opportunityFieldsSchema = z.object({
  name: nameRule("Give the opportunity a name.", 200),
  target_start: dateRule(),
  employees: wholeNumberRule(),
  main_contact_id: z.string(),
  expected_close: dateRule(),
  value: z.string().trim()
    .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Enter an amount in dollars, like 7100.")
    .refine((v) => v === "" || !/^\d+(\.\d{1,2})?$/.test(v) || Number(v) < MOST_VALUE, "Keep the value under a trillion."),
  source: z.string().trim().max(100, "Keep the source to 100 characters."),
  next_step: z.string().trim().max(2000, "Keep the next step to 2,000 characters."),
  owner_id: z.string(),
});

/** What the form holds while it is open: every editable field as text, under the database's column names, so the conflict's comparison lines up with it. */
export type OpportunityForm = {
  name: string; target_start: string; employees: string; main_contact_id: string; expected_close: string; value: string; source: string; next_step: string; owner_id: string;
};

type EditableLike = Pick<OpportunityEditable, "name" | "targetStart" | "employees" | "mainContactId" | "expectedClose" | "value" | "source" | "nextStep" | "ownerId">;

export const formOf = (o: EditableLike): OpportunityForm => ({
  name: o.name,
  target_start: o.targetStart ?? "",
  employees: o.employees === null ? "" : String(o.employees),
  main_contact_id: o.mainContactId ?? "",
  expected_close: o.expectedClose ?? "",
  value: o.value === null ? "" : String(o.value),
  source: o.source ?? "",
  next_step: o.nextStep ?? "",
  owner_id: o.ownerId ?? "",
});

export const formOfOpportunity = (o: OpportunityFields): OpportunityForm => formOf(o);
export const formOfEditable = (o: OpportunityEditable): OpportunityForm => formOf(o);

/** What the form sends: every field, a blank as typed (the database clears it), an owner left empty as "keep". */
export const editOf = (f: OpportunityForm): OpportunityEdit => ({
  name: f.name,
  targetStart: f.target_start,
  employees: f.employees.trim() === "" ? null : Number(f.employees),
  mainContactId: f.main_contact_id === "" ? null : f.main_contact_id,
  expectedClose: f.expected_close,
  value: f.value.trim() === "" ? null : Number(f.value),
  source: f.source,
  nextStep: f.next_step,
  ownerId: f.owner_id === "" ? null : f.owner_id,
});

// ---------- the activity ----------

const FIELD_WORDS: Record<string, string> = {
  name: "name", target_start: "target start", employees: "employees", main_contact_id: "main contact", expected_close: "expected close", value: "value", source: "source",
  next_step: "next step", owner_id: "owner", account_id: "account", lost_by: "lost by", lost_at: "lost on", lost_reason: "lost reason", lost_note: "lost note",
  won_at: "won on", won_by: "won by",
};
/** The fields whose history value is a code, not words: only that they changed is said. */
const CODE_FIELDS = new Set(["main_contact_id", "owner_id", "account_id", "lost_by", "won_by"]);
const DATE_FIELDS = new Set(["target_start", "expected_close", "lost_at", "won_at"]);

/** The page's own words for a field the database names, as a sentence starts with it: "Owner", "Main contact", never "owner_id" or "owner id". For a conflict's `changed` list. */
export function opportunityFieldLabel(field: string): string {
  const words = FIELD_WORDS[field] ?? field.replace(/_/g, " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

const valueOf = (field: string, v: Json | null): string => {
  if (v === null || v === undefined || v === "") return "nothing";
  if (DATE_FIELDS.has(field) && typeof v === "string") return formatDay(v);
  if (field === "value" && typeof v === "number") return dollarsWords(v);
  return valueWords(v);
};

/**
 * One entry of the opportunity's history as a sentence (D-413): "Opportunity created", "Employees changed from 40 to 45", "Main contact changed", and a move of the
 * stage, "Stage: Ready to send to In market, by the send to PEO B" (who made it is in the By column). A person, an owner or an account is never shown as its code.
 */
export function historyWords(row: OpportunityChangeRow): string {
  if (row.kind === "created") return "Opportunity created";
  if (row.kind === "stage_changed") {
    const stage = (v: Json | null) => STAGE_LABELS[v as OpportunityStage] ?? String(v);
    const by = row.cause === "quote_send" ? `, by the send to ${row.causePeo ?? "a PEO"}` : row.cause === "quote_recorded" ? `, by the quote from ${row.causePeo ?? "a PEO"}` : "";
    return `Stage: ${stage(row.from)} to ${stage(row.to)}${by}`;
  }
  const field = row.field ?? "a field";
  // Marked lost with no intake (D-408): the moment is the entry; clearing it reopens the opportunity.
  if (field === "lost_at") return row.to === null || row.to === undefined || row.to === "" ? "No longer marked lost" : `Marked lost on ${valueOf(field, row.to)}`;
  // Marked won (CRM-O1.3b review: a win is a change of the opportunity, with when and by whom); clearing it is the reopening.
  if (field === "won_at") return row.to === null || row.to === undefined || row.to === "" ? "No longer marked won" : `Marked won on ${valueOf(field, row.to)}`;
  const named = opportunityFieldLabel(field);
  return CODE_FIELDS.has(field) ? `${named} changed` : `${named} changed from ${valueOf(field, row.from)} to ${valueOf(field, row.to)}`;
}

/** A decline as a sentence: who, and when it gave one the reason and the PEO's words (N-1.4). */
function declineWords(row: OpportunityQuoteEvent): string {
  if (!row.declineReason) return `${row.peoName} declined`;
  const why = DECLINE_REASON_LABELS[row.declineReason as DeclineReason] ?? row.declineReason;
  return `${row.peoName} declined: ${why}${row.declineWords ? ` (\u201c${row.declineWords}\u201d)` : ""}`;
}

/** An event of one of the opportunity's quote requests as a sentence. */
export function quoteEventWords(row: OpportunityQuoteEvent): string {
  switch (row.event) {
    case "sent": return `Sent to ${row.peoName}`;
    case "acknowledged": return `${row.peoName} acknowledged it has the packet`;
    case "question_open": return `${row.peoName} has a question open`;
    case "quoted": return `${row.peoName} quoted`;
    case "declined": return declineWords(row);
    default: return `${row.peoName}'s quote closed`;
  }
}

/**
 * An event of the opportunity's intake as a sentence (#237): "Intake started", "Invited Elena Marsh to fill in and certify", "Reminded Elena Marsh", "Intake certified
 * (EAA-2026-0117)", and for a later version "Intake certified again, version 2 (EAA-2026-0117)". A name or a File ID the database did not give is not made up.
 */
export function intakeEventWords(row: OpportunityIntakeEvent): string {
  switch (row.event) {
    case "started": return "Intake started";
    case "invited": return `Invited ${row.invitee ?? "the client"} to fill in and certify`;
    case "reminded": return `Reminded ${row.invitee ?? "the client"}`;
    default: return `Intake certified${row.version !== null && row.version > 1 ? ` again, version ${row.version}` : ""}${row.reference ? ` (${row.reference})` : ""}`;
  }
}

// ---------- the quotes ----------

const dayNumber = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

/** "$132", "$7,100", "$132.50": dollars as a person reads them, cents only when there are some. */
export const dollarsWords = (n: number): string =>
  `$${Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const adminFeeWords = (pepm: number): string => `${dollarsWords(pepm)} per employee per month`;

/**
 * What a quote request's status reads (D-424): "Sent", "Acknowledged" or "Question open" with "· N days" while it is open (CRM-Q3.1: the wait keeps counting;
 * the days from the day it was sent to `today`, both YYYY-MM-DD), else the status's own label. The account's lists word a sent request "Waiting"; this page words it as the screen does.
 */
export function quoteStatusWords(status: string, label: string, sentOn: string | null, today: string): string {
  if (!isOpenQuoteRequest(status)) return label;
  const word = status === "sent" ? "Sent" : label;
  if (!sentOn) return word;
  const days = Math.max(0, dayNumber(today) - dayNumber(sentOn));
  return `${word} · ${days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`}`;
}
