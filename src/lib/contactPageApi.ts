import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { activityItemOf, activityItemSchema, type ActivityItem } from "@/lib/activityApi";
import { ContactError, refusal } from "@/lib/contactApi";
import { OPPORTUNITY_STAGES, type OpportunityRow, type TabRows } from "@/lib/accountPageApi";
import { readSaveAnswer, type ChangedField, type RecordConflict, type Saved } from "@/lib/recordVersion";

// What a contact's page asks the database (story CRM-C1.1, screen 18; 20261119240000_contact_page.sql). Three calls: the page (the contact, its account, whether the
// person may change or move it, and the opportunities it is the main contact of), a page of the contact's calls, notes and tasks, and the save of the contact's
// own fields with its version. The database decides every rule: who may see a contact (its account's visibility), who may change it (the level rule on the
// contact's own owner, D-209), the one main contact, a closing firm and Nevermore support. This only puts its answers and refusals into the screen's shape and
// words, and checks that an answer is exactly the agreed shape.

/** The contact's own fields as the page and a save answer them. */
export interface ContactFields {
  id: string;
  /** The version to start the next save from. */
  version: number;
  accountId: string;
  firstName: string | null;
  lastName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isMain: boolean;
  /** Kept and shown (D-186); it hides nothing until emails exist (Epic 6). */
  doNotEmail: boolean;
  /** Null when the contact has no owner (or its owner has left the firm). The name is the name the person gave, else their email. */
  owner: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** The contact as the page shows it: its own fields and the account it is on. */
export interface ContactDetails extends ContactFields {
  account: { id: string; name: string; archived: boolean };
}

export interface ContactPage {
  contact: ContactDetails;
  /** The level rule on the contact's own owner: Edit is shown only to those it will serve. */
  canChange: boolean;
  /** Whether the person may move the contact off its account (the contact's own level and the account's): the picker would refuse otherwise. */
  canMove: boolean;
  /** False on an archived account: nothing new can be logged there (D-222). */
  canAdd: boolean;
  /** The opportunities the contact is the main contact of. `count` may be more than the rows held. */
  opportunities: TabRows<OpportunityRow>;
}

/** What a contact's activity is narrowed to. The database narrows it, so counts and pages are of what is shown. */
export const CONTACT_ACTIVITY_FILTERS = ["all", "calls", "notes", "tasks"] as const;
export type ContactActivityFilter = (typeof CONTACT_ACTIVITY_FILTERS)[number];

/** The fields a person edits in place. A blank text is cleared. */
export interface ContactEdit {
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  phone: string;
  mobile: string;
  /** The person chosen as the owner; null leaves it as it is. */
  ownerId: string | null;
  isMain: boolean;
  doNotEmail: boolean;
}

/** The editable fields as they are now, in a conflict. */
export interface ContactEditable {
  firstName: string | null;
  lastName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  ownerId: string | null;
  isMain: boolean;
  doNotEmail: boolean;
}

/** Someone else changed the contact while the person was editing it. Nothing was saved. `changed` names each field that differs, by its column name. */
export interface ContactConflict {
  conflict: true;
  currentVersion: number;
  current: ContactEditable;
  changed: ChangedField[];
}

export type ContactSaved = {
  conflict: false;
  contact: ContactFields;
  /** The main contact this one took over from, when "Main contact" was ticked and the account had one. */
  previousMain: { id: string; name: string } | null;
};

const nullableText = z.string().nullable();
const ownerShape = z.object({ id: z.string().min(1), name: z.string() }).nullable();

type FieldsRow = {
  id: string; version: number; account_id: string; first_name: string | null; last_name: string; title: string | null; email: string | null; phone: string | null;
  mobile: string | null; is_main: boolean; do_not_email: boolean; owner: { id: string; name: string } | null; created_at: string; updated_at: string;
};
type EditableRow = Pick<FieldsRow, "first_name" | "last_name" | "title" | "email" | "phone" | "mobile" | "is_main" | "do_not_email"> & { owner_id: string | null };

const fieldsShape = z.object({
  id: z.string().min(1), version: z.number().int().min(1), account_id: z.string().min(1), first_name: nullableText, last_name: z.string(), title: nullableText,
  email: nullableText, phone: nullableText, mobile: nullableText, is_main: z.boolean(), do_not_email: z.boolean(), owner: ownerShape,
  created_at: z.string().min(1), updated_at: z.string().min(1),
});
const fieldsSchema = fieldsShape as unknown as z.ZodType<FieldsRow>;
const editableSchema = z.object({
  first_name: nullableText, last_name: z.string(), title: nullableText, email: nullableText, phone: nullableText, mobile: nullableText, owner_id: nullableText,
  is_main: z.boolean(), do_not_email: z.boolean(),
}) as unknown as z.ZodType<EditableRow>;

const opportunitySchema = z.object({
  id: z.string().min(1), name: z.string(), stage: z.enum(OPPORTUNITY_STAGES), target_start: nullableText, submission_id: nullableText,
});
const pageSchema = z.object({
  contact: fieldsShape.extend({ account: z.object({ id: z.string().min(1), name: z.string(), archived: z.boolean() }) }),
  can_change: z.boolean(),
  can_move: z.boolean(),
  can_add: z.boolean(),
  opportunities: z.object({ count: z.number().int().min(0), rows: z.array(opportunitySchema) }),
});

const fieldsOf = (f: FieldsRow): ContactFields => ({
  id: f.id, version: f.version, accountId: f.account_id, firstName: f.first_name, lastName: f.last_name, title: f.title, email: f.email, phone: f.phone, mobile: f.mobile,
  isMain: f.is_main, doNotEmail: f.do_not_email, owner: f.owner, createdAt: f.created_at, updatedAt: f.updated_at,
});

const FALLBACK = "Couldn't load the contact. Try again.";
const LIST_FALLBACK = "Couldn't load the activity. Try again.";
const SAVE_FALLBACK = "Couldn't save the contact. Check your connection and try again.";

/**
 * A contact's page. Null when the person may not see the contact's account or there is no such contact (the database answers the same for both, so the screen says
 * "This contact isn't available" for either). An answer that is not exactly the agreed shape is a failure, never a page with something missing.
 */
export async function getContactPage(firmId: string, contactId: string): Promise<ContactPage | null> {
  const { data, error } = await supabase.rpc("contact_page", { p_firm_id: firmId, p_contact_id: contactId });
  if (error) throw refusal(error, FALLBACK);
  if (data === null) return null;
  const parsed = pageSchema.safeParse(data);
  if (!parsed.success) throw new ContactError("failed", FALLBACK);
  const { contact, can_change, can_move, can_add, opportunities } = parsed.data;
  return {
    contact: { ...fieldsOf(contact as FieldsRow), account: contact.account as ContactDetails["account"] },
    canChange: can_change,
    canMove: can_move,
    canAdd: can_add,
    opportunities: {
      count: opportunities.count,
      rows: opportunities.rows.map((o) => ({ id: o.id, name: o.name, stage: o.stage, targetStart: o.target_start, submissionId: o.submission_id })),
    },
  };
}

/** How many rows a page of the contact's activity holds when the caller does not say. The database allows 100 at most. */
export const CONTACT_ACTIVITY_PAGE_SIZE = 50;

/** A page of the contact's calls, notes and tasks, newest first, and how many there are in all. Null when the person may not see the contact. */
export async function listContactActivity(
  firmId: string,
  contactId: string,
  options: { filter?: ContactActivityFilter; limit?: number; offset?: number } = {},
): Promise<TabRows<ActivityItem> | null> {
  const { data, error } = await supabase.rpc("contact_activity", {
    p_firm_id: firmId,
    p_contact_id: contactId,
    p_filter: options.filter ?? "all",
    p_limit: options.limit ?? CONTACT_ACTIVITY_PAGE_SIZE,
    p_offset: options.offset ?? 0,
  });
  if (error) throw refusal(error, LIST_FALLBACK);
  if (data === null) return null;
  const parsed = z.object({ count: z.number().int().min(0), rows: z.array(activityItemSchema) }).safeParse(data);
  if (!parsed.success) throw new ContactError("failed", LIST_FALLBACK);
  return { count: parsed.data.count, rows: parsed.data.rows.map(activityItemOf) };
}

/**
 * Saves the contact's own fields from the version the person started from. A save from a version that is no longer current saves nothing and answers with what is
 * there now and who changed what (`conflict: true`), which is not a failure. A refusal is a `ContactError`: `invalid` (the database says what is wrong, in words),
 * `notAllowed` (the level rule: the database says who may), `notFound`, `readOnly` (a closing firm, Nevermore support) or `failed`.
 */
export async function updateContact(firmId: string, contactId: string, edit: ContactEdit, version: number): Promise<ContactSaved | ContactConflict> {
  const { data, error } = await supabase.rpc("update_contact", {
    p_contact_id: contactId,
    p_first_name: edit.firstName,
    p_last_name: edit.lastName,
    p_title: edit.title,
    p_email: edit.email,
    p_phone: edit.phone,
    p_mobile: edit.mobile,
    p_owner_id: edit.ownerId,
    p_is_main: edit.isMain,
    p_do_not_email: edit.doNotEmail,
    p_firm_id: firmId,
    p_version: version,
  });
  if (error) throw refusal(error, SAVE_FALLBACK);
  const answer = readSaveAnswer(data, fieldsSchema, editableSchema);
  if (!answer) throw new ContactError("failed", SAVE_FALLBACK);
  if (!answer.conflict) {
    const previous = z.object({ previous_main: z.object({ id: z.string().min(1), name: z.string() }).nullable() }).safeParse(data);
    return { conflict: false, contact: fieldsOf((answer as Saved<FieldsRow>).record), previousMain: previous.success ? (previous.data.previous_main as ContactSaved["previousMain"]) : null };
  }
  const c = (answer as RecordConflict<EditableRow>).current;
  return {
    conflict: true,
    currentVersion: (answer as RecordConflict<EditableRow>).currentVersion,
    current: { firstName: c.first_name, lastName: c.last_name, title: c.title, email: c.email, phone: c.phone, mobile: c.mobile, ownerId: c.owner_id, isMain: c.is_main, doNotEmail: c.do_not_email },
    changed: (answer as RecordConflict<EditableRow>).changed,
  };
}
