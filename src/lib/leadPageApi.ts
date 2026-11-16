import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { activityItemOf, activityItemSchema, type ActivityItem } from "@/lib/activityApi";
import { ContactError, refusal } from "@/lib/contactApi";
import type { TabRows } from "@/lib/accountPageApi";
import { LEAD_NOT_FIT_REASONS, LEAD_SOURCES, LEAD_STATUSES } from "@/lib/leadsApi";
import { readSaveAnswer, type ChangedField, type RecordConflict, type Saved } from "@/lib/recordVersion";

// What a lead's page asks the database (story CRM-L2.1, slice 8.5, screen 15; 20261122220000_lead_page.sql): the page, a page of its calls, notes and tasks,
// the save of its own fields with its version, Not a fit and Reopen. The database decides every rule: who may see a lead and who may change it (the level rule
// on its owner, D-809), what Converted, Not a fit and the bin allow (CRM-L1.1), when a lead becomes Working (D-808), a closing firm and Nevermore support. This
// only puts its answers and refusals into the screen's shape and words, and checks that an answer is exactly the agreed shape.

export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type LeadNotFitReason = (typeof LEAD_NOT_FIT_REASONS)[number];

/** The lead's own fields as the page and a save answer them. */
export interface LeadFields {
  id: string;
  /** The version to start the next save from. */
  version: number;
  name: string;
  title: string | null;
  business: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  employees: number | null;
  currentProvider: string | null;
  note: string | null;
  source: (typeof LEAD_SOURCES)[number];
  status: LeadStatus;
  notFitReason: LeadNotFitReason | null;
  /** Null when the lead has no owner. The name is the name the person gave, else their email. */
  owner: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

type Ref = { id: string; name: string };

export interface LeadPage {
  lead: LeadFields;
  /** The level rule on the lead's owner, and the lead not read only: Edit, Not a fit and Reopen are shown only to those they will serve. */
  canChange: boolean;
  /** Whether a call, a note or a task can be logged: not on a lead Converted, Not a fit or in the bin. */
  canAdd: boolean;
  inBin: boolean;
  /** Reopen is offered: a Not a fit lead the person may change. */
  canReopen: boolean;
  /** When each status the status bar shows began (null: not begun, or not now). */
  stages: { new: string; working: string | null; notFit: string | null; converted: string | null };
  /** What converting made, each only where the person may see it; null for a lead not converted. */
  converted: { account: Ref | null; contact: Ref | null; opportunity: Ref | null } | null;
}

/** The fields a person edits in place. A blank text is cleared. */
export interface LeadEdit {
  name: string;
  title: string;
  business: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  /** Digits, or blank for none. */
  employees: string;
  currentProvider: string;
  note: string;
  /** The person chosen as the owner; null leaves it as it is. */
  ownerId: string | null;
}

/** The editable fields as they are now, in a conflict. */
export interface LeadEditable {
  name: string;
  title: string | null;
  business: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  employees: number | null;
  currentProvider: string | null;
  note: string | null;
  ownerId: string | null;
}

export interface LeadConflict {
  conflict: true;
  currentVersion: number;
  current: LeadEditable;
  changed: ChangedField[];
}

export type LeadSaved = { conflict: false; lead: LeadFields };

const nullableText = z.string().nullable();
const refShape = z.object({ id: z.string().min(1), name: z.string() });

type FieldsRow = {
  id: string; version: number; name: string; title: string | null; business: string | null; email: string | null; phone: string | null; city: string | null;
  state: string | null; employees: number | null; current_provider: string | null; note: string | null; source: LeadFields["source"]; status: LeadStatus;
  not_fit_reason: LeadNotFitReason | null; owner: Ref | null; created_at: string; updated_at: string;
};
type EditableRow = {
  name: string; title: string | null; business: string | null; email: string | null; phone: string | null; city: string | null; state: string | null;
  employees: number | null; current_provider: string | null; note: string | null; owner_id: string | null;
};

const fieldsShape = z.object({
  id: z.string().min(1), version: z.number().int().min(1), name: z.string(), title: nullableText, business: nullableText, email: nullableText, phone: nullableText,
  city: nullableText, state: nullableText, employees: z.number().int().min(0).nullable(), current_provider: nullableText, note: nullableText,
  source: z.enum(LEAD_SOURCES), status: z.enum(LEAD_STATUSES), not_fit_reason: z.enum(LEAD_NOT_FIT_REASONS).nullable(), owner: refShape.nullable(),
  created_at: z.string().min(1), updated_at: z.string().min(1),
});
const fieldsSchema = fieldsShape as unknown as z.ZodType<FieldsRow>;
const editableSchema = z.object({
  name: z.string(), title: nullableText, business: nullableText, email: nullableText, phone: nullableText, city: nullableText, state: nullableText,
  employees: z.number().int().nullable(), current_provider: nullableText, note: nullableText, owner_id: nullableText,
}) as unknown as z.ZodType<EditableRow>;

const pageSchema = z.object({
  lead: fieldsShape,
  can_change: z.boolean(),
  can_add: z.boolean(),
  in_bin: z.boolean(),
  can_reopen: z.boolean(),
  stages: z.object({ new: z.string().min(1), working: nullableText, not_fit: nullableText, converted: nullableText }),
  converted: z.object({ account: refShape.nullable(), contact: refShape.nullable(), opportunity: refShape.nullable() }).nullable(),
});

export const leadFieldsOf = (f: FieldsRow): LeadFields => ({
  id: f.id, version: f.version, name: f.name, title: f.title, business: f.business, email: f.email, phone: f.phone, city: f.city, state: f.state,
  employees: f.employees, currentProvider: f.current_provider, note: f.note, source: f.source, status: f.status, notFitReason: f.not_fit_reason, owner: f.owner,
  createdAt: f.created_at, updatedAt: f.updated_at,
});

const FALLBACK = "Couldn't load the lead. Try again.";
const LIST_FALLBACK = "Couldn't load the activity. Try again.";
const SAVE_FALLBACK = "Couldn't save the lead. Check your connection and try again.";

/**
 * A lead's page. Null when the person may not see the lead or there is no such lead (the database answers the same for both). An answer that is not exactly the
 * agreed shape is a failure, never a page with something missing.
 */
export async function getLeadPage(firmId: string, leadId: string): Promise<LeadPage | null> {
  const { data, error } = await supabase.rpc("lead_page", { p_firm_id: firmId, p_lead_id: leadId });
  if (error) throw refusal(error, FALLBACK);
  if (data === null) return null;
  const parsed = pageSchema.safeParse(data);
  if (!parsed.success) throw new ContactError("failed", FALLBACK);
  const p = parsed.data;
  return {
    lead: leadFieldsOf(p.lead as FieldsRow),
    canChange: p.can_change,
    canAdd: p.can_add,
    inBin: p.in_bin,
    canReopen: p.can_reopen,
    stages: { new: p.stages.new, working: p.stages.working, notFit: p.stages.not_fit, converted: p.stages.converted },
    converted: p.converted as LeadPage["converted"],
  };
}

/** What a lead's activity is narrowed to. */
export type LeadActivityFilter = "all" | "calls" | "notes" | "tasks";

/** A page of the lead's calls, notes and tasks, newest first, and how many there are in all. Null when the person may not see the lead. */
export async function listLeadActivity(
  firmId: string,
  leadId: string,
  options: { filter?: LeadActivityFilter; limit?: number; offset?: number } = {},
): Promise<TabRows<ActivityItem> | null> {
  const { data, error } = await supabase.rpc("lead_activity", {
    p_firm_id: firmId, p_lead_id: leadId, p_filter: options.filter ?? "all", p_limit: options.limit ?? 50, p_offset: options.offset ?? 0,
  });
  if (error) throw refusal(error, LIST_FALLBACK);
  if (data === null) return null;
  const parsed = z.object({ count: z.number().int().min(0), rows: z.array(activityItemSchema) }).safeParse(data);
  if (!parsed.success) throw new ContactError("failed", LIST_FALLBACK);
  return { count: parsed.data.count, rows: parsed.data.rows.map(activityItemOf) };
}

/**
 * Saves the lead's own fields from the version the person started from. A save from a version no longer current saves nothing and answers what is there now
 * (`conflict: true`). A refusal is a `ContactError` in the database's words.
 */
export async function updateLead(firmId: string, leadId: string, edit: LeadEdit, version: number): Promise<LeadSaved | LeadConflict> {
  const employees = edit.employees.trim() === "" ? null : Number(edit.employees.trim());
  const { data, error } = await supabase.rpc("update_lead", {
    p_lead_id: leadId, p_name: edit.name, p_title: edit.title, p_business: edit.business, p_email: edit.email, p_phone: edit.phone, p_city: edit.city,
    p_state: edit.state, p_employees: employees, p_current_provider: edit.currentProvider, p_note: edit.note, p_owner_id: edit.ownerId, p_firm_id: firmId,
    p_version: version,
  });
  if (error) throw refusal(error, SAVE_FALLBACK);
  const answer = readSaveAnswer(data, fieldsSchema, editableSchema);
  if (!answer) throw new ContactError("failed", SAVE_FALLBACK);
  if (!answer.conflict) return { conflict: false, lead: leadFieldsOf((answer as Saved<FieldsRow>).record) };
  const c = (answer as RecordConflict<EditableRow>).current;
  return {
    conflict: true,
    currentVersion: (answer as RecordConflict<EditableRow>).currentVersion,
    current: {
      name: c.name, title: c.title, business: c.business, email: c.email, phone: c.phone, city: c.city, state: c.state, employees: c.employees,
      currentProvider: c.current_provider, note: c.note, ownerId: c.owner_id,
    },
    changed: (answer as RecordConflict<EditableRow>).changed,
  };
}

const answerFields = (data: unknown, fallback: string): LeadFields => {
  const parsed = fieldsSchema.safeParse(data);
  if (!parsed.success) throw new ContactError("failed", fallback);
  return leadFieldsOf(parsed.data);
};

/** Marks the lead Not a fit with one reason from the short list (CRM-L1.3). */
export async function markLeadNotFit(firmId: string, leadId: string, reason: LeadNotFitReason): Promise<LeadFields> {
  const { data, error } = await supabase.rpc("mark_lead_not_fit", { p_lead_id: leadId, p_reason: reason, p_firm_id: firmId });
  if (error) throw refusal(error, "Couldn't mark the lead Not a fit. Try again.");
  return answerFields(data, "Couldn't mark the lead Not a fit. Try again.");
}

/** Reopens a Not a fit lead: it is Working again (D-1652). */
export async function reopenLead(firmId: string, leadId: string): Promise<LeadFields> {
  const { data, error } = await supabase.rpc("reopen_lead", { p_lead_id: leadId, p_firm_id: firmId });
  if (error) throw refusal(error, "Couldn't reopen the lead. Try again.");
  return answerFields(data, "Couldn't reopen the lead. Try again.");
}
