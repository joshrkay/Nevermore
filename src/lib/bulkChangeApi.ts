import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { classifyApiError } from "@/lib/advisorApi";

// What a bulk change to accounts asks the database (story CRM-S3.7b; 20261119210000_bulk_changes.sql). The database decides every rule: which accounts the
// selection is, the 1,000 cap, the level rule for each account (those the person may not change are skipped, counted and named), the new owner, a closing
// firm and Nevermore support, all or none, the history, the ten minutes of undo. This puts its answers and refusals in the page's shape and words.
// The screen (the bulk bar's actions, the dialog, Undo) is CRM-S3.7a's. "Export the selection" is `exportRows` (exportApi.ts), not a second export.

/** The most accounts one bulk change takes; the database counts and refuses above it (the dialog says so and asks for a narrower selection). */
export const BULK_LIMIT = 1000;

/** How long a bulk change can be undone (the database's ten minutes). The page counts it from the answer with its own timer, never from its clock against the server's. */
export const UNDO_WINDOW_MS = 10 * 60 * 1000;

/** The table's own filters in force, with the search and the person's time zone: what "Select all N that match" sends, and no ids (CRM-S3.6). */
export interface BulkFilters {
  filters: unknown[];
  search?: string;
  time_zone?: string;
}

/** The selection: the ids of the rows ticked, or the table's filters for "all that match". Never both. */
export type BulkSelection = { ids: string[] } | { filters: BulkFilters };

/** The optional standard fields "Set a field" offers (never the name, a required field or one the product works out), in the database's words. */
export const BULK_FIELDS = [
  "trade_name", "website", "phone", "street", "city", "state", "postal_code", "industry", "employees", "states_of_operation", "current_provider",
] as const;
export type BulkField = (typeof BULK_FIELDS)[number];

/** What a bulk change does. A blank value clears an optional field. */
export type BulkAction =
  | { action: "owner"; ownerId: string; changeOpenOpportunities?: boolean }
  | { action: "archive" }
  | { action: "field"; field: BulkField; value: string | number | string[] | null }
  | { action: "label_add"; name: string }
  | { action: "label_remove"; name: string };

export type BulkErrorKind = "notAllowed" | "readOnly" | "tooMany" | "invalid" | "notFound" | "alreadyUndone" | "expired" | "failed";

export class BulkChangeError extends Error {
  constructor(readonly kind: BulkErrorKind, message: string, readonly code?: string) {
    super(message);
    this.name = "BulkChangeError";
  }
}

type DbError = { code?: string; message?: string };

/** A bulk function's refusal in the page's kinds and words (the leads' bulk functions refuse the same way: leadsBulkApi.ts). */
export function refusal(error: DbError, fallback: string): Error {
  const ended = classifyApiError({ message: error.message ?? "", code: error.code }, "");
  if (ended.unauthenticated) return ended;
  const words = error.message || fallback;
  switch (error.code) {
    case "42501": return new BulkChangeError("notAllowed", words, error.code);
    case "PT423": return new BulkChangeError("readOnly", words, error.code);
    case "PT413": return new BulkChangeError("tooMany", words, error.code);
    case "22023": return new BulkChangeError("invalid", words, error.code);
    case "PT404": return new BulkChangeError("notFound", words, error.code);
    case "PT409": return new BulkChangeError("alreadyUndone", words, error.code);
    case "PT410": return new BulkChangeError("expired", words, error.code);
    default: return new BulkChangeError("failed", fallback, error.code);
  }
}

const skippedSchema = z.object({ id: z.string(), name: z.string().nullable(), code: z.string(), reason: z.string() });
const previewSchema = z.object({
  action: z.string(),
  selected: z.number().int().min(0),
  limit: z.number().int(),
  too_many: z.boolean(),
  unavailable: z.number().int().min(0),
  will_change: z.number().int().min(0),
  unchanged: z.number().int().min(0),
  skipped: z.array(skippedSchema),
  owner: z.object({ id: z.string(), name: z.string().nullable() }).optional(),
  label: z.string().optional(),
  opportunities: z.object({ will_change: z.number().int().min(0).optional(), changed: z.number().int().min(0).optional(), skipped: z.number().int().min(0) }).optional(),
  changed: z.number().int().min(0).optional(),
  change_id: z.string().nullable().optional(),
  undo_until: z.string().nullable().optional(),
});
const undoSchema = z.object({
  restored: z.number().int().min(0),
  skipped: z.array(skippedSchema),
  gone: z.number().int().min(0),
  // A lead's undo hands over no opportunities: none reads as none.
  opportunities: z.object({ restored: z.number().int().min(0), skipped: z.number().int().min(0), gone: z.number().int().min(0) })
    .default({ restored: 0, skipped: 0, gone: 0 }),
});

export interface SkippedAccount {
  id: string;
  name: string | null;
  /** `level` (the person may not change it), `archived` (nothing is added to an archived account), or for an undo `changed_since`, `owner_left`, `archived`, `phone_rule`. */
  code: string;
  /** In words, for the dialog. */
  reason: string;
}

/** What the dialog says before anything changes ("Change owner to Marcus Hale on 42 accounts"), and what a change did. */
export interface BulkOutcome {
  /** How many accounts the selection is (the database's own count). */
  selected: number;
  /** More than the limit: nothing else is counted, and the dialog asks for a narrower selection. */
  tooMany: boolean;
  /** Accounts that change (will change, or changed). */
  changed: number;
  /** Accounts already as asked. */
  unchanged: number;
  /** Named ids that were not accounts the person may see (another firm's, gone). */
  unavailable: number;
  skipped: SkippedAccount[];
  ownerName: string | null;
  label: string | null;
  /** For an owner change that took the open opportunities along. */
  opportunities: { changed: number; skipped: number } | null;
  /** The change to undo, until `undoUntil` (ISO text); null when nothing changed or this is a preview. */
  changeId: string | null;
  undoUntil: string | null;
}

export interface UndoOutcome {
  restored: number;
  /** Records changed since, a previous owner who has left, an archived account that can't take its label back, or one that is gone: named with the reason. */
  skipped: SkippedAccount[];
  /** Accounts the change changed that have been deleted since: a count, never a name (none of a deleted record's data is kept). "N accounts were deleted since." */
  gone: number;
  opportunities: { restored: number; skipped: number; gone: number };
}

function params(change: BulkAction): Json {
  switch (change.action) {
    case "owner": return { owner_id: change.ownerId, change_open_opportunities: change.changeOpenOpportunities ?? false };
    case "field": return { field: change.field, value: change.value };
    case "label_add":
    case "label_remove": return { name: change.name };
    case "archive": return {};
  }
}

function selection(selected: BulkSelection): { p_filters: Json | null; p_ids: Json | null } {
  if ("ids" in selected) return { p_filters: null, p_ids: selected.ids };
  return { p_filters: selected.filters as unknown as Json, p_ids: null };
}

/** A preview's or a change's answer in the page's shape (the leads' answer has the same shape). */
export function outcome(data: unknown, fallback: string): BulkOutcome {
  const parsed = previewSchema.safeParse(data);
  if (!parsed.success) throw new BulkChangeError("failed", fallback);
  const d = parsed.data;
  const opp = d.opportunities;
  return {
    selected: d.selected,
    tooMany: d.too_many,
    changed: d.changed ?? d.will_change,
    unchanged: d.unchanged,
    unavailable: d.unavailable,
    skipped: d.skipped as SkippedAccount[],
    ownerName: d.owner?.name ?? null,
    label: d.label ?? null,
    opportunities: opp ? { changed: opp.changed ?? opp.will_change ?? 0, skipped: opp.skipped } : null,
    changeId: d.change_id ?? null,
    undoUntil: d.undo_until ?? null,
  };
}

/** What the change would do, changing nothing: the dialog's words. A selection over the limit is answered `tooMany`, not thrown. */
export async function previewBulkChange(firmId: string, change: BulkAction, selected: BulkSelection): Promise<BulkOutcome> {
  const { data, error } = await supabase.rpc("bulk_accounts_preview", { p_firm_id: firmId, p_action: change.action, p_params: params(change), ...selection(selected) });
  if (error) throw refusal(error, "Couldn't check that change. Try again.");
  return outcome(data, "Couldn't check that change. Try again.");
}

/** Makes the change: the accounts the person may change, all or none; the others come back named in `skipped`. Over the limit it throws `tooMany`. */
export async function applyBulkChange(firmId: string, change: BulkAction, selected: BulkSelection): Promise<BulkOutcome> {
  const { data, error } = await supabase.rpc("bulk_accounts_change", { p_firm_id: firmId, p_action: change.action, p_params: params(change), ...selection(selected) });
  if (error) throw refusal(error, "Couldn't make that change. Try again.");
  return outcome(data, "Couldn't make that change. Try again.");
}

/** Puts back what nobody has changed since, for ten minutes after the change. */
export async function undoBulkChange(firmId: string, changeId: string): Promise<UndoOutcome> {
  const { data, error } = await supabase.rpc("bulk_accounts_undo", { p_change_id: changeId, p_firm_id: firmId });
  if (error) throw refusal(error, "Couldn't undo that change. Try again.");
  return undoOutcome(data);
}

/** An undo's answer in the page's shape (a lead's undo answers the same way). */
export function undoOutcome(data: unknown): UndoOutcome {
  const parsed = undoSchema.safeParse(data);
  if (!parsed.success) throw new BulkChangeError("failed", "Couldn't undo that change. Try again.");
  return parsed.data as UndoOutcome;
}

const labelsSchema = z.array(z.object({ id: z.string(), name: z.string() }));

/** The firm's own labels, alphabetically, for the Label dialog and the Label filter. */
export async function firmLabels(firmId: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.rpc("firm_labels", { p_firm_id: firmId });
  if (error) throw refusal(error, "Couldn't load the labels.");
  const parsed = labelsSchema.safeParse(data);
  if (!parsed.success) throw new BulkChangeError("failed", "Couldn't load the labels.");
  return parsed.data as { id: string; name: string }[];
}
