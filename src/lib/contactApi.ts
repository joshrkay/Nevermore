import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { classifyApiError } from "@/lib/advisorApi";

// What adding a contact to an account and moving one ask the database (story CRM-A2.2, screen 24; 20261119170000_add_contact.sql). Four calls: what the form
// needs (the account's name, whether it takes more, who is its main contact), adding, where a contact may be moved to, and moving. The database decides every rule:
// who may see an account, the level rule on a contact and on both accounts (D-209), an archived account, a closing firm and Nevermore support, each field (D-29),
// and the one main contact. This only puts its answers and refusals into the screen's shape and words.

export type ContactFailure = "invalid" | "notAllowed" | "notFound" | "archived" | "readOnly" | "confirm" | "failed";

export class ContactError extends Error {
  constructor(readonly kind: ContactFailure, message: string, readonly code?: string) {
    super(message);
  }
}

type DbError = { code?: string; message?: string };

/** An ended session is said in its own words (and signs the person out); the database's refusals keep their plain words; anything else is a failure to try again. */
function refusal(error: DbError, fallback: string): Error {
  const ended = classifyApiError({ message: error.message ?? "", code: error.code }, "");
  if (ended.unauthenticated) return ended;
  switch (error.code) {
    case "PT404": return new ContactError("notFound", "That isn't available any more. Reload the page.", error.code);
    case "PT423": return new ContactError("readOnly", error.message || "This can't be changed right now.", error.code);
    case "55000": return new ContactError("archived", error.message || "This account is archived.", error.code);
    // What moving would take off an opportunity: the database asks, and the person agrees or not.
    case "PT409": return new ContactError("confirm", error.message || "Move anyway?", error.code);
    // A move that lost a race with another move (40001) says so in words, and the person tries again.
    case "22023":
    case "40001": return new ContactError("invalid", error.message || fallback, error.code);
    case "42501": return new ContactError("notAllowed", error.message || "You can't change this.", error.code);
    default: return new ContactError("failed", fallback, error.code);
  }
}

const nullableText = z.string().nullable();
// The project's compiler setting makes every zod object key optional, so each schema is given its exact shape (as activityApi's are).
type Ref = { id: string; name: string };
const ref = z.object({ id: z.string().min(1), name: z.string() }) as unknown as z.ZodType<Ref>;

const CONTEXT_FALLBACK = "Couldn't load the account.";
const SAVE_FALLBACK = "Couldn't save the contact. Check your connection and try again.";
const MOVE_FALLBACK = "Couldn't move the contact. Check your connection and try again.";
const CHOICES_FALLBACK = "Couldn't load the accounts.";

// ---------- the form's context ----------

const contextSchema = z.object({
  account: z.object({ id: z.string().min(1), name: z.string(), archived: z.boolean() }),
  main_contact: ref.nullable(),
}) as unknown as z.ZodType<{ account: { id: string; name: string; archived: boolean }; main_contact: Ref | null }>;

export interface AddContactContext {
  account: { id: string; name: string; archived: boolean };
  /** The account's main contact now: ticking "Main contact" makes the new one the main contact instead. */
  mainContact: { id: string; name: string } | null;
}

export async function getAddContactContext(firmId: string, accountId: string): Promise<AddContactContext> {
  const { data, error } = await supabase.rpc("add_contact_context", { p_firm_id: firmId, p_account_id: accountId });
  if (error) throw refusal(error, CONTEXT_FALLBACK);
  const parsed = contextSchema.safeParse(data);
  if (!parsed.success) throw new ContactError("failed", CONTEXT_FALLBACK);
  return { account: parsed.data.account, mainContact: parsed.data.main_contact };
}

// ---------- adding ----------

/** What a person types into the form, every text as typed (a blank is nothing). */
export interface NewContact {
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  phone: string;
  mobile: string;
  /** The person chosen as the owner; null leaves it to the database, which makes the maker the owner. */
  ownerId: string | null;
  isMain: boolean;
  doNotEmail: boolean;
}

const addedSchema = z.object({
  record: z.object({ id: z.string().min(1), first_name: nullableText, last_name: z.string(), is_main: z.boolean() }).passthrough(),
  previous_main: ref.nullable(),
}) as unknown as z.ZodType<{ record: { id: string; first_name: string | null; last_name: string; is_main: boolean }; previous_main: Ref | null }>;

export interface AddedContact {
  contact: { id: string; firstName: string | null; lastName: string; isMain: boolean };
  /** The main contact this one took over from, when "Main contact" was ticked and the account had one. */
  previousMain: { id: string; name: string } | null;
}

export async function addContact(firmId: string, accountId: string, contact: NewContact): Promise<AddedContact> {
  const { data, error } = await supabase.rpc("add_contact", {
    p_account_id: accountId,
    p_first_name: contact.firstName,
    p_last_name: contact.lastName,
    p_title: contact.title,
    p_email: contact.email,
    p_phone: contact.phone,
    p_mobile: contact.mobile,
    p_owner_id: contact.ownerId,
    p_is_main: contact.isMain,
    p_do_not_email: contact.doNotEmail,
    p_firm_id: firmId,
  });
  if (error) throw refusal(error, SAVE_FALLBACK);
  const parsed = addedSchema.safeParse(data);
  if (!parsed.success) throw new ContactError("failed", SAVE_FALLBACK);
  const r = parsed.data.record;
  return { contact: { id: r.id, firstName: r.first_name, lastName: r.last_name, isMain: r.is_main }, previousMain: parsed.data.previous_main };
}

// ---------- moving ----------

const choicesSchema = z.array(z.object({ id: z.string().min(1), name: z.string() })) as unknown as z.ZodType<Ref[]>;

/** The accounts a contact may be moved to (seen and changeable by the person, live, not where it is), narrowed by what was typed. */
export async function listMoveChoices(firmId: string, contactId: string, search: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.rpc("contact_move_choices", { p_firm_id: firmId, p_contact_id: contactId, p_search: search.trim() });
  // A person who may not move the contact is told why in the database's words, not "couldn't load".
  if (error) throw error.code === "42501" ? new ContactError("notAllowed", error.message || CHOICES_FALLBACK, error.code) : new ContactError("failed", CHOICES_FALLBACK, error.code);
  const parsed = choicesSchema.safeParse(data);
  if (!parsed.success) throw new ContactError("failed", CHOICES_FALLBACK);
  return parsed.data;
}

const movedSchema = z.object({
  record: z.object({ id: z.string().min(1) }).passthrough(),
  from: ref,
  to: ref,
  was_main: z.boolean(),
  activities_moved: z.number().int(),
  opportunity_links_dropped: z.number().int(),
  main_contact_cleared: z.number().int(),
}) as unknown as z.ZodType<{
  record: { id: string }; from: Ref; to: Ref; was_main: boolean; activities_moved: number; opportunity_links_dropped: number; main_contact_cleared: number;
}>;

export interface MovedContact {
  from: { id: string; name: string };
  to: { id: string; name: string };
  wasMain: boolean;
  activitiesMoved: number;
  opportunityLinksDropped: number;
  mainContactCleared: number;
}

/**
 * Moves the contact, with its calls, notes and tasks, to another account. `confirm` is the person's agreement to what the move takes off an opportunity left behind:
 * without it the database refuses with a question (a `ContactError` of kind `confirm`, its message the question) and changes nothing.
 */
export async function moveContact(firmId: string, contactId: string, toAccountId: string, confirm: boolean): Promise<MovedContact> {
  const { data, error } = await supabase.rpc("move_contact", { p_contact_id: contactId, p_to_account_id: toAccountId, p_confirm: confirm, p_firm_id: firmId });
  if (error) throw refusal(error, MOVE_FALLBACK);
  const parsed = movedSchema.safeParse(data);
  if (!parsed.success) throw new ContactError("failed", MOVE_FALLBACK);
  const m = parsed.data;
  return {
    from: m.from, to: m.to, wasMain: m.was_main, activitiesMoved: m.activities_moved, opportunityLinksDropped: m.opportunity_links_dropped, mainContactCleared: m.main_contact_cleared,
  };
}
