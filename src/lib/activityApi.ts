import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { classifyApiError } from "@/lib/advisorApi";

// What logging a call, a note or a task asks the database (story CRM-E1.5; 20261119180000_calls_notes_tasks.sql). Five calls: log one (a call may carry a
// follow-up task, written in the same step), change a call or a task or a note's text, add to a note, mark a task done or open, and what the log form
// offers (an account's contacts and opportunities and the firm's members). The database decides every rule: who may see an account, who may change a call
// or a task, the note rule of a day and its writer (D-200), a closing firm and Nevermore support. This only puts its answers and refusals into the
// screen's shape and words.

export const CALL_OUTCOMES = ["spoke", "left_message", "no_answer", "wrong_number"] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];
export const OUTCOME_LABELS: Record<CallOutcome, string> = { spoke: "Spoke", left_message: "Left a message", no_answer: "No answer", wrong_number: "Wrong number" };

export type ActivityType = "call" | "note" | "task";

export interface PersonRef { id: string; name: string | null }

/** One call, note or task as the Activity tab shows it. A field a kind does not have is null. */
export interface ActivityItem {
  type: ActivityType;
  id: string;
  entryKey: string;
  /** When a call took place; when a note or a task was made. */
  at: string;
  /** Who logged it: a member's name, else their email. Null if they have left the product. */
  who: string | null;
  authorId: string | null;
  /** The contact it is with or about, and the opportunity it is about. */
  contact: PersonRef | null;
  opportunity: PersonRef | null;
  outcome: CallOutcome | null;
  /** A task: what is to be done. */
  title: string | null;
  /** A call: what was said. A note: its text. */
  body: string | null;
  /** A note's dated additions, oldest first. */
  additions: { at: string; who: string | null; text: string }[];
  /** A task: who it is for, when it is due, and when and by whom it was done. */
  assignee: PersonRef | null;
  dueOn: string | null;
  doneAt: string | null;
  doneBy: string | null;
  /** Whether the person may change it: a note by its writer for a day (D-200); a call or a task by whoever logged it, whoever it is for, or whoever may change the account. */
  canEdit: boolean;
  /** A note: until when its writer may change it. */
  editableUntil: string | null;
}

/** Why a call did not give an answer. The message is in words, the database's own where it says what to do. */
export type ActivityFailure = "invalid" | "notAllowed" | "notFound" | "readOnly" | "failed";

export class ActivityError extends Error {
  constructor(readonly kind: ActivityFailure, message: string, readonly code?: string) {
    super(message);
  }
}

const nullableText = z.string().nullable();
const ref = z.object({ id: z.string().min(1), name: nullableText });

/** One call, note or task as the database gives it (its column names). */
type ItemRow = {
  type: ActivityType; id: string; entry_key: string; at: string; who: string | null; author_id: string | null; contact: PersonRef | null; opportunity: PersonRef | null;
  outcome: CallOutcome | null; title: string | null; body: string | null; additions: { at: string; who: string | null; text: string }[]; assignee: PersonRef | null;
  due_on: string | null; done_at: string | null; done_by: string | null; can_edit: boolean; editable_until: string | null;
};

/** The shape of one call, note or task as the database gives it; `type` tells which. The Activity tab's rows (src/lib/accountPageApi.ts) use it too. */
export const activityItemSchema = z.object({
  type: z.enum(["call", "note", "task"]),
  id: z.string().min(1),
  entry_key: z.string().min(1),
  at: z.string().min(1),
  who: nullableText,
  author_id: nullableText,
  contact: ref.nullable(),
  opportunity: ref.nullable(),
  outcome: z.enum(CALL_OUTCOMES).nullable(),
  title: nullableText,
  body: nullableText,
  additions: z.array(z.object({ at: z.string(), who: nullableText, text: z.string() })),
  assignee: ref.nullable(),
  due_on: nullableText,
  done_at: nullableText,
  done_by: nullableText,
  can_edit: z.boolean(),
  editable_until: nullableText,
}) as unknown as z.ZodType<ItemRow>;

export const activityItemOf = (a: ItemRow): ActivityItem => ({
  type: a.type, id: a.id, entryKey: a.entry_key, at: a.at, who: a.who, authorId: a.author_id, contact: a.contact, opportunity: a.opportunity, outcome: a.outcome,
  title: a.title, body: a.body, additions: a.additions, assignee: a.assignee, dueOn: a.due_on, doneAt: a.done_at, doneBy: a.done_by, canEdit: a.can_edit,
  editableUntil: a.editable_until,
});

const FALLBACK = "Couldn't save that. Try again.";

type DbError = { code?: string; message?: string };

/** An ended session is said in its own words (and signs the person out); the database's refusals keep their plain words; anything else is a failure to try again. */
function refusal(error: DbError, fallback: string): Error {
  const ended = classifyApiError({ message: error.message ?? "", code: error.code }, "");
  if (ended.unauthenticated) return ended;
  switch (error.code) {
    case "PT404": return new ActivityError("notFound", "That isn't available any more. Reload the page.", error.code);
    case "55000": return new ActivityError("readOnly", error.message || "Nothing can be added to this account.", error.code);
    case "PT423": return new ActivityError("readOnly", error.message || "This can't be changed right now.", error.code);
    case "22023": return new ActivityError("invalid", error.message || fallback, error.code);
    case "42501": return new ActivityError("notAllowed", error.message || "You can't change this.", error.code);
    // The key to a contact or an opportunity of the account fails when that contact (CRM-A2.2's Move) or opportunity moved to another account a moment ago.
    case "23503": return new ActivityError("invalid", /activities_contact_fkey/.test(error.message ?? "")
      ? "That contact has just moved to another account. Refresh and try again."
      : "That contact or opportunity has just moved to another account. Refresh and try again.", error.code);
    default: return new ActivityError("failed", fallback, error.code);
  }
}

/** What a person fills in to log a call, a note or a task. A field that does not belong to the kind is left out. Times are ISO text, days are YYYY-MM-DD. */
export interface LogInput {
  kind: ActivityType;
  accountId: string;
  contactId?: string | null;
  opportunityId?: string | null;
  /** A call: when it took place (now when left out). */
  at?: string | null;
  outcome?: CallOutcome | null;
  /** A call: what was said. A note: its text. */
  body?: string;
  /** A task: what, when due and for whom (the person logging it when left out). */
  title?: string;
  dueOn?: string | null;
  forId?: string | null;
  /** A call's follow-up task, written in the same step. */
  followUp?: { title: string; dueOn: string | null; forId: string | null } | null;
}

export interface Logged {
  activity: ActivityItem;
  followUp: ActivityItem | null;
}

const loggedSchema = z.object({ activity: activityItemSchema, follow_up: activityItemSchema.nullable() }) as unknown as z.ZodType<{ activity: ItemRow; follow_up: ItemRow | null }>;

/** Logs a call, a note or a task on an account. A refusal is an `ActivityError`: `invalid` (the database says what is wrong, in words), `notAllowed`, `notFound`, `readOnly` (a closing firm, Nevermore support) or `failed`. */
export async function logActivity(firmId: string, input: LogInput): Promise<Logged> {
  const { data, error } = await supabase.rpc("log_activity", {
    p_kind: input.kind,
    p_account_id: input.accountId,
    p_contact_id: input.contactId ?? null,
    p_opportunity_id: input.opportunityId ?? null,
    p_at: input.at ?? null,
    p_outcome: input.outcome ?? null,
    p_body: input.body ?? null,
    p_title: input.title ?? null,
    p_due_on: input.dueOn ?? null,
    p_for: input.forId ?? null,
    p_follow_up_title: input.followUp?.title ?? null,
    p_follow_up_due_on: input.followUp?.dueOn ?? null,
    p_follow_up_for: input.followUp?.forId ?? null,
    p_firm_id: firmId,
  });
  if (error) throw refusal(error, FALLBACK);
  const parsed = loggedSchema.safeParse(data);
  if (!parsed.success) throw new ActivityError("failed", FALLBACK);
  return { activity: activityItemOf(parsed.data.activity), followUp: parsed.data.follow_up ? activityItemOf(parsed.data.follow_up) : null };
}

/** Logs a call, a note or a task on a lead (log_lead_activity, slice 8.5): as `logActivity`, with no contact or opportunity to name (D-807). A call on a New lead makes it Working (D-808). */
export async function logLeadActivity(firmId: string, input: Omit<LogInput, "accountId" | "contactId" | "opportunityId"> & { leadId: string }): Promise<Logged> {
  const { data, error } = await supabase.rpc("log_lead_activity", {
    p_kind: input.kind,
    p_lead_id: input.leadId,
    p_at: input.at ?? null,
    p_outcome: input.outcome ?? null,
    p_body: input.body ?? null,
    p_title: input.title ?? null,
    p_due_on: input.dueOn ?? null,
    p_for: input.forId ?? null,
    p_follow_up_title: input.followUp?.title ?? null,
    p_follow_up_due_on: input.followUp?.dueOn ?? null,
    p_follow_up_for: input.followUp?.forId ?? null,
    p_firm_id: firmId,
  });
  if (error) throw refusal(error, FALLBACK);
  const parsed = loggedSchema.safeParse(data);
  if (!parsed.success) throw new ActivityError("failed", FALLBACK);
  return { activity: activityItemOf(parsed.data.activity), followUp: parsed.data.follow_up ? activityItemOf(parsed.data.follow_up) : null };
}

/** What a person changes in a call or a task (every field is sent), or a note's text (only `body` is). */
export interface ChangeInput {
  contactId?: string | null;
  opportunityId?: string | null;
  at?: string | null;
  outcome?: CallOutcome | null;
  body?: string;
  title?: string;
  dueOn?: string | null;
  forId?: string | null;
}

/** Saves a call or a task as sent, or a note's text. Refused: a note by anyone but its writer, or after a day (`notAllowed`, in the database's words). */
export async function updateActivity(firmId: string, activityId: string, input: ChangeInput): Promise<ActivityItem> {
  const { data, error } = await supabase.rpc("update_activity", {
    p_activity_id: activityId,
    p_contact_id: input.contactId ?? null,
    p_opportunity_id: input.opportunityId ?? null,
    p_at: input.at ?? null,
    p_outcome: input.outcome ?? null,
    p_body: input.body ?? null,
    p_title: input.title ?? null,
    p_due_on: input.dueOn ?? null,
    p_for: input.forId ?? null,
    p_firm_id: firmId,
  });
  if (error) throw refusal(error, FALLBACK);
  const parsed = activityItemSchema.safeParse(data);
  if (!parsed.success) throw new ActivityError("failed", FALLBACK);
  return activityItemOf(parsed.data);
}

/** Appends a dated addition to a note: "Add to note" (D-200). */
export async function addToNote(firmId: string, noteId: string, text: string): Promise<ActivityItem> {
  const { data, error } = await supabase.rpc("add_to_note", { p_activity_id: noteId, p_text: text, p_firm_id: firmId });
  if (error) throw refusal(error, FALLBACK);
  const parsed = activityItemSchema.safeParse(data);
  if (!parsed.success) throw new ActivityError("failed", FALLBACK);
  return activityItemOf(parsed.data);
}

/** Marks a task done, or open again. Anyone who may see its account can (D-200). */
export async function setTaskDone(firmId: string, taskId: string, done: boolean): Promise<ActivityItem> {
  const { data, error } = await supabase.rpc("set_task_done", { p_activity_id: taskId, p_done: done, p_firm_id: firmId });
  if (error) throw refusal(error, FALLBACK);
  const parsed = activityItemSchema.safeParse(data);
  if (!parsed.success) throw new ActivityError("failed", FALLBACK);
  return activityItemOf(parsed.data);
}

/** What the log form offers for an account. */
export interface ActivityOptions {
  contacts: { id: string; name: string; title: string | null }[];
  opportunities: { id: string; name: string }[];
  people: { id: string; name: string }[];
}

const optionsSchema = z.object({
  contacts: z.array(z.object({ id: z.string().min(1), name: z.string(), title: nullableText })),
  opportunities: z.array(z.object({ id: z.string().min(1), name: z.string() })),
  people: z.array(z.object({ id: z.string().min(1), name: z.string() })),
}) as unknown as z.ZodType<ActivityOptions>;

/** The contacts and opportunities a call can be with or about, and the firm's members a task can be for. Null when the person may not see the account. */
export async function getActivityOptions(firmId: string, accountId: string): Promise<ActivityOptions | null> {
  const { data, error } = await supabase.rpc("account_activity_options", { p_firm_id: firmId, p_account_id: accountId });
  if (error) throw refusal(error, "Couldn't load the choices. Try again.");
  if (data === null) return null;
  const parsed = optionsSchema.safeParse(data);
  if (!parsed.success) throw new ActivityError("failed", "Couldn't load the choices. Try again.");
  return parsed.data;
}

/** The firm's members a task on a lead can be for (lead_activity_options): no contacts or opportunities, a lead has none. Null when the person may not see the lead. */
export async function getLeadActivityOptions(firmId: string, leadId: string): Promise<ActivityOptions | null> {
  const { data, error } = await supabase.rpc("lead_activity_options", { p_firm_id: firmId, p_lead_id: leadId });
  if (error) throw refusal(error, "Couldn't load the choices. Try again.");
  if (data === null) return null;
  const parsed = optionsSchema.safeParse(data);
  if (!parsed.success) throw new ActivityError("failed", "Couldn't load the choices. Try again.");
  return parsed.data;
}
