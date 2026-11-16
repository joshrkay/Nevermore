import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { classifyApiError } from "@/lib/advisorApi";
import type { AccountMergeField, ContactMergeField, MergeChoices, MergeKind } from "@/data/merge";

// What merging asks the database (story CRM-S4.3b; 20261121100000_merge_records.sql). Five calls: the preview a person chooses from, merging two accounts, merging two
// contacts of one account, "keep separate", and where a merged-away record's old address leads. The database decides every rule (who may see and who may change both,
// a closing firm, Nevermore support, an archived account, the versions chosen from); this puts its answers and refusals into the page's shape and words and checks
// that an answer is exactly the agreed shape. The screens are CRM-S4.3a's.

export type MergeFailure = "invalid" | "notAllowed" | "notFound" | "readOnly" | "archived" | "changed" | "failed";

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
    case "PT404": return new MergeError("notFound", "This record isn't available.", error.code);
    case "PT423": return new MergeError("readOnly", error.message || "This can't be changed right now.", error.code);
    case "22023": return new MergeError("invalid", error.message || fallback, error.code);
    case "42501": return new MergeError("notAllowed", error.message || "You can't merge these.", error.code);
    case "55000": return new MergeError("archived", error.message || "This account is archived.", error.code);
    // A record changed while the person was choosing: the page reloads both and asks again.
    case "40001": return new MergeError("changed", error.message || "One of these was changed while you were choosing. Reload and choose again.", error.code);
    default: return new MergeError("failed", fallback, error.code);
  }
}

const FAILED = "Couldn't merge. Try again.";
const person = z.object({ id: z.string().min(1), name: z.string() }).nullable();
// A record's own fields as a preview shows them: the ones a person chooses between, with its id and version; the rest pass through untouched.
const sideSchema = z.object({ id: z.string().min(1), version: z.number().int().min(1) }).passthrough();

const previewSchema = z.object({
  kind: z.enum(["account", "contact"]),
  problem: z.string().nullable(),
  differs: z.array(z.string()),
  kept: sideSchema,
  removed: sideSchema,
  moves: z.record(z.string(), z.number().int().min(0)),
});

export interface MergePreview {
  kind: MergeKind;
  /** Why the caller may not merge these two, in words; null when they may. */
  problem: string | null;
  /** The fields whose values differ: the ones to choose between. */
  differs: string[];
  /** Each record's fields as the database reads them, with `version`: send both versions back with the merge. */
  kept: Record<string, unknown> & { id: string; version: number };
  removed: Record<string, unknown> & { id: string; version: number };
  /** What would move to the kept record: contacts, opportunities, intakes, activities, placements, renewals, labels (accounts); activities, opportunities_main_contact_of (contacts). */
  moves: Record<string, number>;
}

/** Both records side by side, what differs and what would move. The caller must see both (kind "notFound" otherwise). */
export async function previewMerge(firmId: string, kind: MergeKind, keptId: string, removedId: string): Promise<MergePreview> {
  const { data, error } = await supabase.rpc("merge_preview", { p_firm_id: firmId, p_kind: kind, p_kept_id: keptId, p_removed_id: removedId });
  if (error) throw refusal(error, "Couldn't load the records to merge. Try again.");
  const parsed = previewSchema.safeParse(data);
  if (!parsed.success) throw new MergeError("failed", "Couldn't load the records to merge. Try again.");
  return parsed.data as MergePreview;
}

// zod reads an object's keys as optional when the app is not compiled strictly; the schema has already required both.
const named = (r: { id?: string; name?: string }): { id: string; name: string } => ({ id: r.id ?? "", name: r.name ?? "" });
const removedSchema = z.object({ id: z.string().min(1), name: z.string() });

export interface AccountMerged {
  /** The kept account's fields after the merge, with its new version. */
  record: Record<string, unknown> & { id: string; version: number };
  removed: { id: string; name: string };
  moved: { contacts: number; contactsMerged: number; opportunities: number; activities: number; placements: number; renewals: number; labels: number };
}

const accountMergedSchema = z.object({
  record: sideSchema,
  removed: removedSchema,
  moved: z.object({
    contacts: z.number().int().min(0), contacts_merged: z.number().int().min(0), opportunities: z.number().int().min(0), activities: z.number().int().min(0),
    placements: z.number().int().min(0), renewals: z.number().int().min(0), labels: z.number().int().min(0),
  }),
});

/** The versions of the two records the person chose from (the preview's): a record changed since is refused (kind "changed"). */
export interface MergeVersions {
  kept: number;
  removed: number;
}

/** Merges two accounts: everything on `removedId` moves to `keptId` and `removedId` is deleted. There is no undo (D-203). */
export async function mergeAccounts(
  firmId: string, keptId: string, removedId: string, choices: MergeChoices<AccountMergeField>, versions: MergeVersions,
): Promise<AccountMerged> {
  const { data, error } = await supabase.rpc("merge_accounts", {
    p_kept_id: keptId, p_removed_id: removedId, p_choices: choices, p_kept_version: versions.kept, p_removed_version: versions.removed, p_firm_id: firmId,
  });
  if (error) throw refusal(error, FAILED);
  const parsed = accountMergedSchema.safeParse(data);
  if (!parsed.success) throw new MergeError("failed", FAILED);
  const d = parsed.data;
  return {
    record: d.record as AccountMerged["record"], removed: named(d.removed),
    moved: {
      contacts: d.moved.contacts, contactsMerged: d.moved.contacts_merged, opportunities: d.moved.opportunities, activities: d.moved.activities,
      placements: d.moved.placements, renewals: d.moved.renewals, labels: d.moved.labels,
    },
  };
}

export interface ContactMerged {
  record: Record<string, unknown> & { id: string; version: number };
  removed: { id: string; name: string };
  moved: { activities: number; opportunities: number };
}

const contactMergedSchema = z.object({
  record: sideSchema,
  removed: removedSchema,
  moved: z.object({ activities_moved: z.number().int().min(0), opportunities_repointed: z.number().int().min(0) }),
});

/** Merges two contacts of one account (D-210); two on two accounts are refused (kind "invalid", in words). */
export async function mergeContacts(
  firmId: string, keptId: string, removedId: string, choices: MergeChoices<ContactMergeField>, versions: MergeVersions,
): Promise<ContactMerged> {
  const { data, error } = await supabase.rpc("merge_contacts", {
    p_kept_id: keptId, p_removed_id: removedId, p_choices: choices, p_kept_version: versions.kept, p_removed_version: versions.removed, p_firm_id: firmId,
  });
  if (error) throw refusal(error, FAILED);
  const parsed = contactMergedSchema.safeParse(data);
  if (!parsed.success) throw new MergeError("failed", FAILED);
  const d = parsed.data;
  return { record: d.record as ContactMerged["record"], removed: named(d.removed), moved: { activities: d.moved.activities_moved, opportunities: d.moved.opportunities_repointed } };
}

const separateSchema = z.object({ record: sideSchema, was_duplicate_of: person });

/** "Keep separate": clears the possible-duplicate mark. `wasDuplicateOf` is the account it was marked a duplicate of (null when the caller may not see it). */
export async function keepAccountSeparate(firmId: string, accountId: string): Promise<{ record: Record<string, unknown> & { id: string; version: number }; wasDuplicateOf: { id: string; name: string } | null }> {
  const { data, error } = await supabase.rpc("account_keep_separate", { p_account_id: accountId, p_firm_id: firmId });
  if (error) throw refusal(error, "Couldn't keep these separate. Try again.");
  const parsed = separateSchema.safeParse(data);
  if (!parsed.success) throw new MergeError("failed", "Couldn't keep these separate. Try again.");
  return { record: parsed.data.record as Record<string, unknown> & { id: string; version: number }, wasDuplicateOf: parsed.data.was_duplicate_of ? named(parsed.data.was_duplicate_of) : null };
}

const resolvedSchema = z.object({ kind: z.enum(["account", "contact"]), id: z.string().min(1), name: z.string(), account_id: z.string().optional() });

export interface ResolvedRecord {
  kind: MergeKind;
  id: string;
  name: string;
  /** For a contact: the account it is on, to build its address. */
  accountId: string | null;
}

/**
 * Where the old address of a merged-away account or contact leads: the record it became (following later merges), when the person may see it. Null when the id was
 * never merged away, or what it became is not theirs to see, which reads as "no such record".
 */
export async function resolveMergedRecord(firmId: string, kind: MergeKind, id: string): Promise<ResolvedRecord | null> {
  const { data, error } = await supabase.rpc("resolve_merged_record", { p_firm_id: firmId, p_kind: kind, p_id: id });
  if (error) throw refusal(error, "Couldn't look that record up. Try again.");
  if (data === null) return null;
  const parsed = resolvedSchema.safeParse(data);
  if (!parsed.success) throw new MergeError("failed", "Couldn't look that record up. Try again.");
  return { kind: parsed.data.kind, id: parsed.data.id, name: parsed.data.name, accountId: parsed.data.account_id ?? null };
}
