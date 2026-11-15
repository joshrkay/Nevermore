import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { classifyApiError } from "@/lib/advisorApi";
import { browserTimeZone } from "@/lib/accountsApi";
import { OPPORTUNITY_STAGES } from "@/lib/accountPageApi";
import { RENEWAL_KINDS, RENEWAL_STATES, type RenewalKind, type RenewalState } from "@/data/renewals";
import { readSaveAnswer, type ChangedField, type RecordConflict, type Saved } from "@/lib/recordVersion";

// What an account's renewals ask the database (story CRM-A2.4a; 20261120110000_placements_renewals.sql). Five calls: the account's renewals with the days away,
// adding one by hand, saving one (with its version and "Didn't renew"), deleting one, and naming the opportunity that works one. The database decides every
// rule (who may see the account, who may add and who may change, a closing firm, Nevermore support, an archived account, the dates); this puts its answers and
// refusals into the page's shape and words and checks that an answer is exactly the agreed shape. The screens are CRM-A2.4b's.

export interface RenewalOpportunity {
  id: string;
  name: string;
  stage: (typeof OPPORTUNITY_STAGES)[number];
}

/** One renewal of an account, as the Renewals tab reads it (D-448, D-454). */
export interface AccountRenewal {
  id: string;
  /** The version to start the next save from. */
  version: number;
  kind: RenewalKind;
  withWhom: string;
  /** The renewal date (YYYY-MM-DD). */
  renewsOn: string;
  /** From today in the caller's time zone: 45 is "in 45 days", 0 "today", -12 "12 days ago" (src/data/renewals.ts words it). */
  daysAway: number;
  state: RenewalState;
  /** Renewed, or marked "Didn't renew" (D-449). */
  done: boolean;
  /** Past and not done: the warning colour. */
  overdue: boolean;
  /** The opportunity working it, or the lost one it had. */
  opportunity: RenewalOpportunity | null;
  placementId: string | null;
  /** Made by a win: it can be removed only by reopening that win (D-452). */
  fromWin: boolean;
  notRenewedOn: string | null;
}

export interface AccountRenewals {
  count: number;
  /** Anyone who may see the account may add, unless it is archived (D-452). */
  canAdd: boolean;
  /** The level rule (D-209), and not archived. */
  canChange: boolean;
  archived: boolean;
  /** Not done first, nearest first; then those done, the latest first. */
  rows: AccountRenewal[];
}

/** A renewal's own fields as a save answers them. */
export interface RenewalFields {
  id: string;
  version: number;
  accountId: string;
  kind: RenewalKind;
  withWhom: string;
  renewsOn: string;
  placementId: string | null;
  opportunityId: string | null;
  notRenewedOn: string | null;
}

export type RenewalFailure = "invalid" | "notAllowed" | "notFound" | "readOnly" | "archived" | "fromWin" | "failed";

export class RenewalError extends Error {
  constructor(readonly kind: RenewalFailure, message: string, readonly code?: string) {
    super(message);
  }
}

type DbError = { code?: string; message?: string };

function refusal(error: DbError, fallback: string): Error {
  const ended = classifyApiError({ message: error.message ?? "", code: error.code }, "");
  if (ended.unauthenticated) return ended;
  switch (error.code) {
    case "PT404": return new RenewalError("notFound", "This renewal isn't available.", error.code);
    case "PT423": return new RenewalError("readOnly", error.message || "This can't be changed right now.", error.code);
    case "22023": return new RenewalError("invalid", error.message || fallback, error.code);
    case "42501": return new RenewalError("notAllowed", error.message || "You can't change this account.", error.code);
    case "55000": return new RenewalError("archived", error.message || "This account is archived.", error.code);
    // A renewal a win made: the database's words say to reopen the win.
    case "PT409": return new RenewalError("fromWin", error.message || "This renewal came from a win. Reopen the win to remove it.", error.code);
    default: return new RenewalError("failed", fallback, error.code);
  }
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const maybeDay = day.nullable();
const rowSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().min(1),
  kind: z.enum(RENEWAL_KINDS),
  with_whom: z.string().min(1),
  renews_on: day,
  days_away: z.number().int(),
  state: z.enum(RENEWAL_STATES),
  done: z.boolean(),
  overdue: z.boolean(),
  opportunity: z.object({ id: z.string().min(1), name: z.string(), stage: z.enum(OPPORTUNITY_STAGES) }).nullable(),
  placement_id: z.string().nullable(),
  from_win: z.boolean(),
  not_renewed_on: maybeDay,
});
const listSchema = z.object({ count: z.number().int().min(0), can_add: z.boolean(), can_change: z.boolean(), archived: z.boolean(), rows: z.array(rowSchema) });

const fieldsSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().min(1),
  account_id: z.string().min(1),
  kind: z.enum(RENEWAL_KINDS),
  with_whom: z.string().min(1),
  renews_on: day,
  placement_id: z.string().nullable(),
  opportunity_id: z.string().nullable(),
  not_renewed_on: maybeDay,
}).passthrough();
type FieldsRow = z.infer<typeof fieldsSchema>;
const editableSchema = z.object({ with_whom: z.string(), renews_on: day, not_renewed_on: maybeDay });
type EditableRow = z.infer<typeof editableSchema>;

const fieldsOf = (r: FieldsRow): RenewalFields => ({
  id: r.id, version: r.version, accountId: r.account_id, kind: r.kind, withWhom: r.with_whom, renewsOn: r.renews_on, placementId: r.placement_id,
  opportunityId: r.opportunity_id, notRenewedOn: r.not_renewed_on,
});

const FAILED = "Couldn't do that. Try again.";

/** The account's renewals with their days away from today in the caller's time zone; null when the account is not there or the person may not see it. */
export async function listAccountRenewals(firmId: string, accountId: string, timeZone: string = browserTimeZone()): Promise<AccountRenewals | null> {
  const { data, error } = await supabase.rpc("account_renewals", { p_firm_id: firmId, p_account_id: accountId, p_time_zone: timeZone });
  if (error) throw refusal(error, "Couldn't load the renewals. Try again.");
  if (data === null) return null;
  const parsed = listSchema.safeParse(data);
  if (!parsed.success) throw new RenewalError("failed", "Couldn't load the renewals. Try again.");
  const d = parsed.data;
  return {
    count: d.count, canAdd: d.can_add, canChange: d.can_change, archived: d.archived,
    rows: d.rows.map((r) => ({
      id: r.id, version: r.version, kind: r.kind, withWhom: r.with_whom, renewsOn: r.renews_on, daysAway: r.days_away, state: r.state, done: r.done, overdue: r.overdue,
      opportunity: r.opportunity, placementId: r.placement_id, fromWin: r.from_win, notRenewedOn: r.not_renewed_on,
    })),
  };
}

export interface NewRenewal {
  kind: RenewalKind;
  withWhom: string;
  renewsOn: string;
  /** When the PEO placement started, if known; only for a PEO placement. */
  startDate?: string | null;
}

/** Adds a renewal by hand. A PEO placement makes its placement record in the same step; its id comes back. */
export async function addRenewal(firmId: string, accountId: string, input: NewRenewal): Promise<{ renewal: RenewalFields; placementId: string | null }> {
  const { data, error } = await supabase.rpc("renewal_add", {
    p_account_id: accountId, p_kind: input.kind, p_with_whom: input.withWhom, p_renews_on: input.renewsOn, p_start_date: input.startDate ?? null, p_firm_id: firmId,
  });
  if (error) throw refusal(error, "Couldn't add the renewal. Try again.");
  const parsed = z.object({ record: fieldsSchema, placement_id: z.string().nullable() }).safeParse(data);
  if (!parsed.success) throw new RenewalError("failed", "Couldn't add the renewal. Try again.");
  return { renewal: fieldsOf(parsed.data.record), placementId: parsed.data.placement_id };
}

export interface RenewalEdit {
  withWhom: string;
  renewsOn: string;
  /** "Didn't renew" (D-451): the day it ends; null to clear it (Undo). */
  notRenewedOn: string | null;
}

export type RenewalSaveResult =
  | { conflict: false; renewal: RenewalFields }
  | { conflict: true; currentVersion: number; current: RenewalEdit; changed: ChangedField[] };

/** Saves a renewal from the version the person started from. Someone else saving first is a conflict, not an error: nothing was saved. */
export async function updateRenewal(firmId: string, renewalId: string, edit: RenewalEdit, version: number): Promise<RenewalSaveResult> {
  const { data, error } = await supabase.rpc("renewal_update", {
    p_renewal_id: renewalId, p_with_whom: edit.withWhom, p_renews_on: edit.renewsOn, p_not_renewed_on: edit.notRenewedOn, p_firm_id: firmId, p_version: version,
  });
  if (error) throw refusal(error, "Couldn't save the renewal. Try again.");
  const answer = readSaveAnswer(data, fieldsSchema, editableSchema);
  if (!answer) throw new RenewalError("failed", "Couldn't save the renewal. Try again.");
  if (!answer.conflict) return { conflict: false, renewal: fieldsOf((answer as Saved<FieldsRow>).record) };
  const c = answer as RecordConflict<EditableRow>;
  return {
    conflict: true,
    currentVersion: c.currentVersion,
    current: { withWhom: c.current.with_whom, renewsOn: c.current.renews_on, notRenewedOn: c.current.not_renewed_on },
    changed: c.changed,
  };
}

/** Deletes a renewal. `placementDeleted` is true when the placement a hand-made renewal made went with it. One a win made is refused (kind "fromWin"). */
export async function deleteRenewal(firmId: string, renewalId: string): Promise<{ placementDeleted: boolean }> {
  const { data, error } = await supabase.rpc("renewal_delete", { p_renewal_id: renewalId, p_firm_id: firmId });
  if (error) throw refusal(error, "Couldn't delete the renewal. Try again.");
  const parsed = z.object({ deleted: z.literal(true), placement_deleted: z.boolean() }).safeParse(data);
  if (!parsed.success) throw new RenewalError("failed", "Couldn't delete the renewal. Try again.");
  return { placementDeleted: parsed.data.placement_deleted };
}

/** Names the open opportunity of the renewal's account that works the renewal ("Start the renewal" saves through this, CRM-A2.4b). */
export async function linkRenewalOpportunity(firmId: string, renewalId: string, opportunityId: string): Promise<RenewalFields> {
  const { data, error } = await supabase.rpc("renewal_link_opportunity", { p_renewal_id: renewalId, p_opportunity_id: opportunityId, p_firm_id: firmId });
  if (error) throw refusal(error, FAILED);
  const parsed = z.object({ record: fieldsSchema }).safeParse(data);
  if (!parsed.success) throw new RenewalError("failed", FAILED);
  return fieldsOf(parsed.data.record);
}
