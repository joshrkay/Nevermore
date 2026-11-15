import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { classifyApiError } from "@/lib/advisorApi";

// What merging asks the database (story CRM-S4.3b; 20261119220000_merge_records.sql). The database decides every rule: who may see and change both records (the
// level rule, D-209), a closing firm, Nevermore support, an archived account, a version that moved. This puts its answers and refusals in words and checks that an
// answer is exactly the agreed shape. The screen (CRM-S4.3a) draws it; nothing here is a screen.

/** Why a merge, a preview or a follow was refused, as a kind a screen can act on. */
export type MergeFailure = "invalid" | "notAllowed" | "notFound" | "readOnly" | "archived" | "changed" | "retry" | "failed";

export class MergeError extends Error {
  constructor(readonly kind: MergeFailure, message: string, readonly code?: string) {
    super(message);
  }
}

type DbError = { code?: string; message?: string };

function refusal(error: DbError, fallback: string): Error {
  const ended = classifyApiError({ message: error.message ?? "", code: error.code }, "");
  if (ended.unauthenticated) return ended;
  switch (error.code) {
    case "PT404": return new MergeError("notFound", "This isn't available.", error.code);
    case "PT423": return new MergeError("readOnly", error.message || "This can't be changed right now.", error.code);
    case "22023": return new MergeError("invalid", error.message || fallback, error.code);
    case "42501": return new MergeError("notAllowed", error.message || "You can't merge these.", error.code);
    // The kept account (or the contacts' account) is archived: restore it first.
    case "55000": return new MergeError("archived", error.message || "An archived account can't take anything. Restore it first.", error.code);
    // A record changed after the person looked at it: look again, then merge.
    case "PT409": return new MergeError("changed", error.message || "One of these was changed after you looked at it. Look again, then merge.", error.code);
    // A clash with another change at the same moment (a possible-duplicate mark made, a contact moved): trying again settles it.
    case "40001": return new MergeError("retry", error.message || "Something changed while this was starting. Try again.", error.code);
    default: return new MergeError("failed", fallback, error.code);
  }
}

const json: z.ZodType<Json> = z.lazy(() => z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(json), z.record(json)]));
const person = z.object({ id: z.string(), name: z.string().nullable() });
const fieldDiff = z.object({ field: z.string(), keep: json, remove: json });

/** The account's own fields as a merge answers them (its column names), with its owner. */
const accountSchema = z.object({
  id: z.string().min(1), version: z.number().int(), name: z.string(), trade_name: z.string().nullable(), website: z.string().nullable(), phone: z.string().nullable(),
  street: z.string().nullable(), city: z.string().nullable(), state: z.string().nullable(), postal_code: z.string().nullable(), industry: z.string().nullable(),
  employees: z.number().int().nullable(), states_of_operation: z.array(z.string()), current_provider: z.string().nullable(), archived_at: z.string().nullable(),
  owner: person.nullable(),
}).passthrough();

const accountMovesSchema = z.object({
  contacts: z.number().int().min(0), opportunities: z.number().int().min(0), quotes: z.number().int().min(0), calls: z.number().int().min(0),
  notes: z.number().int().min(0), tasks: z.number().int().min(0), labels: z.number().int().min(0), history: z.number().int().min(0),
});

/** Both accounts, `fields` (each field whose value differs, in the order a screen shows them; `owner_id` is the owner, as {id, name} or null; the person picks one value for each) and `moves` (what will move). */
const accountPreviewSchema = z.object({ keep: accountSchema, remove: accountSchema, fields: z.array(fieldDiff), moves: accountMovesSchema });
export type AccountMergePreview = z.infer<typeof accountPreviewSchema>;

/** The fields of an account a person picks between. A field not in `take` stays as the account kept has it. */
export type AccountMergeField = "name" | "trade_name" | "website" | "phone" | "street" | "city" | "state" | "postal_code" | "industry" | "employees" | "states_of_operation" | "current_provider" | "owner_id";
export type ContactMergeField = "first_name" | "last_name" | "title" | "email" | "phone" | "mobile" | "owner_id";

const FALLBACK = "Couldn't merge these. Try again.";
const PREVIEW_FALLBACK = "Couldn't look at these. Try again.";

/** What merging the account `removeId` into `keepId` would do: both accounts, the fields that differ and what moves. Changes nothing. */
export async function previewMergeAccounts(firmId: string, keepId: string, removeId: string): Promise<AccountMergePreview> {
  const { data, error } = await supabase.rpc("merge_accounts_preview", { p_firm_id: firmId, p_keep_id: keepId, p_remove_id: removeId });
  if (error) throw refusal(error, PREVIEW_FALLBACK);
  const parsed = accountPreviewSchema.safeParse(data);
  if (!parsed.success) throw new MergeError("failed", PREVIEW_FALLBACK);
  return parsed.data;
}

const accountMergedSchema = z.object({ record: accountSchema, merged_from: z.object({ id: z.string(), name: z.string() }), moved: accountMovesSchema });
/** The account kept, the account that was removed (by the name it had) and what moved. */
export type AccountMerged = { record: z.infer<typeof accountSchema>; mergedFrom: z.infer<typeof accountMergedSchema>["merged_from"]; moved: z.infer<typeof accountMovesSchema> };

/**
 * Makes `removeId` part of `keepId` for good (there is no unmerge): everything attached moves, the removed account is deleted, and `take` names the fields whose value
 * is the removed account's. The versions are those the preview gave, so a change made after the person looked is refused (kind "changed"), never overwritten.
 */
export async function mergeAccounts(
  firmId: string,
  keepId: string,
  removeId: string,
  options: { take: AccountMergeField[]; keepVersion: number; removeVersion: number },
): Promise<AccountMerged> {
  const { data, error } = await supabase.rpc("merge_accounts", {
    p_firm_id: firmId, p_keep_id: keepId, p_remove_id: removeId, p_take: options.take, p_keep_version: options.keepVersion, p_remove_version: options.removeVersion,
  });
  if (error) throw refusal(error, FALLBACK);
  const parsed = accountMergedSchema.safeParse(data);
  if (!parsed.success) throw new MergeError("failed", FALLBACK);
  return { record: parsed.data.record, mergedFrom: parsed.data.merged_from, moved: parsed.data.moved };
}

const contactSchema = z.object({
  id: z.string().min(1), version: z.number().int(), account_id: z.string(), first_name: z.string().nullable(), last_name: z.string(), title: z.string().nullable(),
  email: z.string().nullable(), phone: z.string().nullable(), mobile: z.string().nullable(), is_main: z.boolean(), do_not_email: z.boolean(), owner: person.nullable(),
}).passthrough();

const contactPreviewSchema = z.object({
  account: z.object({ id: z.string(), name: z.string() }), keep: contactSchema, remove: contactSchema, fields: z.array(fieldDiff),
  moves: z.object({ activities: z.number().int().min(0), opportunities: z.number().int().min(0), history: z.number().int().min(0) }),
  do_not_email: z.boolean(), main: z.boolean(),
});
/** `doNotEmail`: whether the contact kept will be marked "Do not email", which it is when either was (not a choice); `main`: whether it will be the account's main contact, which it is when either was (not a choice). */
export type ContactMergePreview = Omit<z.infer<typeof contactPreviewSchema>, "do_not_email"> & { doNotEmail: boolean };

/** What merging the contact `removeId` into `keepId` (two contacts of one account) would do. Changes nothing. */
export async function previewMergeContacts(firmId: string, keepId: string, removeId: string): Promise<ContactMergePreview> {
  const { data, error } = await supabase.rpc("merge_contacts_preview", { p_firm_id: firmId, p_keep_id: keepId, p_remove_id: removeId });
  if (error) throw refusal(error, PREVIEW_FALLBACK);
  const parsed = contactPreviewSchema.safeParse(data);
  if (!parsed.success) throw new MergeError("failed", PREVIEW_FALLBACK);
  const { do_not_email: doNotEmail, ...rest } = parsed.data;
  return { ...rest, doNotEmail };
}

const contactMergedSchema = z.object({
  record: contactSchema, merged_from: z.object({ id: z.string(), name: z.string() }),
  moved: z.object({ activities: z.number().int().min(0), opportunities: z.number().int().min(0) }),
});
export type ContactMerged = { record: z.infer<typeof contactSchema>; mergedFrom: z.infer<typeof contactMergedSchema>["merged_from"]; moved: z.infer<typeof contactMergedSchema>["moved"] };

/** Makes the contact `removeId` part of `keepId`: its calls, notes and tasks and its place as an opportunity's main contact go to the contact kept. */
export async function mergeContacts(
  firmId: string,
  keepId: string,
  removeId: string,
  options: { take: ContactMergeField[]; keepVersion: number; removeVersion: number },
): Promise<ContactMerged> {
  const { data, error } = await supabase.rpc("merge_contacts", {
    p_firm_id: firmId, p_keep_id: keepId, p_remove_id: removeId, p_take: options.take, p_keep_version: options.keepVersion, p_remove_version: options.removeVersion,
  });
  if (error) throw refusal(error, FALLBACK);
  const parsed = contactMergedSchema.safeParse(data);
  if (!parsed.success) throw new MergeError("failed", FALLBACK);
  return { record: parsed.data.record, mergedFrom: parsed.data.merged_from, moved: parsed.data.moved };
}

const separateSchema = z.object({ changed: z.boolean(), record: accountSchema });

/** "Keep separate": clears the account's possible-duplicate mark. `changed` is false when it had none. */
export async function keepAccountsSeparate(firmId: string, accountId: string): Promise<{ changed: boolean }> {
  const { data, error } = await supabase.rpc("keep_accounts_separate", { p_firm_id: firmId, p_account_id: accountId });
  if (error) throw refusal(error, "Couldn't keep these separate. Try again.");
  const parsed = separateSchema.safeParse(data);
  if (!parsed.success) throw new MergeError("failed", "Couldn't keep these separate. Try again.");
  return { changed: parsed.data.changed };
}

const markSchema = z.object({
  other: z.object({ id: z.string(), name: z.string(), archived: z.boolean() }).nullable(), can_merge: z.boolean(), can_keep_separate: z.boolean(),
});
/** `other` is the account this one is marked a possible duplicate of, null when the person may not see it. */
export type DuplicateMark = { other: z.infer<typeof markSchema>["other"]; canMerge: boolean; canKeepSeparate: boolean };

/** What the possible-duplicate banner needs. Null when the account has no mark, or the person may not see the account. */
export async function getDuplicateMark(firmId: string, accountId: string): Promise<DuplicateMark | null> {
  const { data, error } = await supabase.rpc("account_duplicate_mark", { p_firm_id: firmId, p_account_id: accountId });
  if (error) throw refusal(error, "Couldn't check for a possible duplicate.");
  if (data === null) return null;
  const parsed = markSchema.safeParse(data);
  if (!parsed.success) throw new MergeError("failed", "Couldn't check for a possible duplicate.");
  return { other: parsed.data.other, canMerge: parsed.data.can_merge, canKeepSeparate: parsed.data.can_keep_separate };
}

const followSchema = z.object({
  merged: z.boolean(), kind: z.enum(["account", "contact"]), id: z.string().min(1), account_id: z.string().min(1), name: z.string(),
  from_name: z.string().nullable(), merged_at: z.string().nullable(),
});
/** `merged` is true when the id asked for was merged away (the record is the one kept); `id` is the record to open, `accountId` the account to open (a contact's own account); `fromName` is what the merged-away record was called. */
export type FollowedRecord = { merged: boolean; kind: "account" | "contact"; id: string; accountId: string; name: string; fromName: string | null; mergedAt: string | null };

/**
 * Follows the id of an account or a contact to the record it is, or became: an old link to a record that was merged away leads to the record kept. A record the
 * person may not see, one that was never made and one of another firm all answer the same ("notFound").
 */
export async function followMergedRecord(firmId: string, kind: "account" | "contact", id: string): Promise<FollowedRecord> {
  const { data, error } = await supabase.rpc("follow_merged_record", { p_firm_id: firmId, p_kind: kind, p_id: id });
  if (error) throw refusal(error, "Couldn't open that. Try again.");
  const parsed = followSchema.safeParse(data);
  if (!parsed.success) throw new MergeError("failed", "Couldn't open that. Try again.");
  const f = parsed.data;
  return { merged: f.merged, kind: f.kind, id: f.id, accountId: f.account_id, name: f.name, fromName: f.from_name, mergedAt: f.merged_at };
}
