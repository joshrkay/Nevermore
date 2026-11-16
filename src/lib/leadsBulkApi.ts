import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { BulkChangeError, outcome, refusal, undoOutcome, type BulkOutcome, type BulkSelection, type UndoOutcome } from "@/lib/bulkChangeApi";
import type { LEAD_NOT_FIT_REASONS } from "@/lib/leadsApi";

type LeadNotFitReason = (typeof LEAD_NOT_FIT_REASONS)[number];

// What a bulk change to leads asks the database (story CRM-L1.1b, slice 8.4; 20261122210000_leads_bulk_and_bin.sql). The database decides every rule, as it
// does for accounts (bulkChangeApi.ts, whose answers and refusals these share): the selection, the 1,000 cap, the level rule, a converted lead (never changed
// or deleted), a Not a fit lead (reopened or deleted, nothing else), a closing firm and Nevermore support, all or none, the history, the ten minutes of undo.

/** The optional standard fields "Set a field" offers on a lead, in the database's words (lead_bulk_fields). */
export const LEAD_BULK_FIELDS = ["title", "business", "email", "phone", "city", "state", "employees", "current_provider"] as const;
export type LeadBulkField = (typeof LEAD_BULK_FIELDS)[number];

/** What a bulk change of leads does. Delete moves them to the bin; its Undo takes them out. */
export type LeadBulkAction =
  | { action: "owner"; ownerId: string }
  | { action: "status"; status: "new" | "working" }
  | { action: "not_fit"; reason: LeadNotFitReason }
  | { action: "field"; field: LeadBulkField; value: string | number | null }
  | { action: "label_add"; name: string }
  | { action: "label_remove"; name: string }
  | { action: "delete" };

function params(change: LeadBulkAction): Json {
  switch (change.action) {
    case "owner": return { owner_id: change.ownerId };
    case "status": return { status: change.status };
    case "not_fit": return { reason: change.reason };
    case "field": return { field: change.field, value: change.value };
    case "label_add":
    case "label_remove": return { name: change.name };
    case "delete": return {};
  }
}

function selection(selected: BulkSelection): { p_filters: Json | null; p_ids: Json | null } {
  if ("ids" in selected) return { p_filters: null, p_ids: selected.ids };
  return { p_filters: selected.filters as unknown as Json, p_ids: null };
}

/** What the change would do, changing nothing: the dialog's words. */
export async function previewLeadsBulk(firmId: string, change: LeadBulkAction, selected: BulkSelection): Promise<BulkOutcome> {
  const { data, error } = await supabase.rpc("bulk_leads_preview", { p_firm_id: firmId, p_action: change.action, p_params: params(change), ...selection(selected) });
  if (error) throw refusal(error, "Couldn't check that change. Try again.");
  return outcome(data, "Couldn't check that change. Try again.");
}

/** Makes the change: the leads the person may change, all or none; the others come back named in `skipped`. Over the limit it throws `tooMany`. */
export async function applyLeadsBulk(firmId: string, change: LeadBulkAction, selected: BulkSelection): Promise<BulkOutcome> {
  const { data, error } = await supabase.rpc("bulk_leads_change", { p_firm_id: firmId, p_action: change.action, p_params: params(change), ...selection(selected) });
  if (error) throw refusal(error, "Couldn't make that change. Try again.");
  return outcome(data, "Couldn't make that change. Try again.");
}

/** A lead in the bin (D-806), as the Deleted view shows it: when it was deleted and the day the nightly removal takes it (YYYY-MM-DD). */
export interface BinnedLead {
  id: string;
  name: string;
  business: string | null;
  email: string | null;
  phone: string | null;
  status: "new" | "working" | "not_fit";
  owner: string | null;
  owner_name: string | null;
  deleted_at: string;
  removed_on: string;
}

const binSchema = z.object({
  rows: z.array(z.object({
    id: z.string(), name: z.string(), business: z.string().nullable(), email: z.string().nullable(), phone: z.string().nullable(),
    status: z.enum(["new", "working", "not_fit"]), owner: z.string().nullable(), owner_name: z.string().nullable(), deleted_at: z.string(), removed_on: z.string(),
  })),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  page_size: z.number().int().min(1),
});

/** One page of the bin: an owner's (the database refuses anyone else, in words). */
export async function listLeadsBin(firmId: string, page = 1): Promise<{ rows: BinnedLead[]; total: number; page: number; pageSize: number }> {
  const { data, error } = await supabase.rpc("leads_bin", { p_firm_id: firmId, p_page: page });
  if (error) throw refusal(error, "Couldn't load the deleted leads.");
  const parsed = binSchema.safeParse(data);
  if (!parsed.success) throw new BulkChangeError("failed", "Couldn't load the deleted leads.");
  return { rows: parsed.data.rows as BinnedLead[], total: parsed.data.total, page: parsed.data.page, pageSize: parsed.data.page_size };
}

/** Takes leads out of the bin, back to the views they were in. An owner's. */
export async function restoreLeads(firmId: string, ids: string[]): Promise<{ restored: number; unavailable: number }> {
  const { data, error } = await supabase.rpc("restore_leads", { p_firm_id: firmId, p_ids: ids });
  if (error) throw refusal(error, "Couldn't restore. Try again.");
  const parsed = z.object({ restored: z.number().int().min(0), unavailable: z.number().int().min(0) }).safeParse(data);
  if (!parsed.success) throw new BulkChangeError("failed", "Couldn't restore. Try again.");
  return parsed.data as { restored: number; unavailable: number };
}

/** Puts back what nobody has changed since, for ten minutes after the change (a delete's undo takes the leads out of the bin). */
export async function undoLeadsBulk(firmId: string, changeId: string): Promise<UndoOutcome> {
  const { data, error } = await supabase.rpc("bulk_leads_undo", { p_change_id: changeId, p_firm_id: firmId });
  if (error) throw refusal(error, "Couldn't undo that change. Try again.");
  return undoOutcome(data);
}
