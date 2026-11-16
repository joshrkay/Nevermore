import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { classifyApiError } from "@/lib/advisorApi";
import { browserTimeZone } from "@/lib/accountsApi";
import type { RenewalKind } from "@/data/renewals";
import { readSaveAnswer, type ChangedField, type RecordConflict, type Saved } from "@/lib/recordVersion";

// What an account's Renewals tab asks the database (story CRM-A2.4b, D-446 to D-455; 20261120110000_placements_renewals.sql): the account's renewals (each with its
// days away worked out in the person's time zone, the opportunity working it and whether it is done), adding one, changing and deleting one from the version the
// person started from, and "Didn't renew" with its undo. The database decides every rule: who may see the account, who may add (anyone who may see it) and change
// (whoever may change the account), an archived account, a closing firm and Nevermore support, and every field. This only puts its answers and refusals into the
// screen's shape and words.

export type { RenewalKind };

export type RenewalFailure = "invalid" | "notAllowed" | "notFound" | "archived" | "readOnly" | "taken" | "failed";

export class RenewalError extends Error {
  constructor(readonly kind: RenewalFailure, message: string, readonly code?: string) {
    super(message);
  }
}

type DbError = { code?: string; message?: string };

/** An ended session is said in its own words (and signs the person out); the database's refusals keep their plain words; anything else is a failure to try again. */
export function renewalRefusal(error: DbError, fallback: string): Error {
  const ended = classifyApiError({ message: error.message ?? "", code: error.code }, "");
  if (ended.unauthenticated) return ended;
  switch (error.code) {
    case "PT404": return new RenewalError("notFound", "That renewal isn't available any more. Reload the page.", error.code);
    case "PT423": return new RenewalError("readOnly", error.message || "This can't be changed right now.", error.code);
    case "PT409": return new RenewalError("taken", error.message || fallback, error.code);
    case "55000": return new RenewalError("archived", error.message || "This account is archived. Nothing can be added to it.", error.code);
    case "22023": return new RenewalError("invalid", error.message || fallback, error.code);
    case "42501": return new RenewalError("notAllowed", error.message || "You can't do that.", error.code);
    default: return new RenewalError("failed", fallback, error.code);
  }
}

const LIST_FALLBACK = "Couldn't load the renewals.";
const SAVE_FALLBACK = "Couldn't save the renewal. Check your connection and try again.";

export interface Renewal {
  id: string;
  /** The version to start the next save from. */
  version: number;
  kind: RenewalKind;
  withWhom: string;
  /** The day it renews, YYYY-MM-DD. */
  renewsOn: string;
  /** Negative: past (D-448). */
  daysAway: number;
  /** The opportunity working it, with its stage; null when none. */
  opportunity: { id: string; name: string; stage: string } | null;
  notRenewedOn: string | null;
  /** Done: renewed by a win, or marked "Didn't renew" (D-449). */
  done: boolean;
  outcome: "renewed" | "not_renewed" | null;
  /** A win made it: it is deleted only by reopening the win (D-452). */
  madeByWin: boolean;
}

export interface AccountRenewals {
  count: number;
  /** The level rule asked of this account: Edit, Delete and Didn't renew are shown to those it will serve. */
  canChange: boolean;
  rows: Renewal[];
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}/).transform((s) => s.slice(0, 10));
type Row = {
  id: string; version: number; kind: RenewalKind; with_whom: string; renews_on: string; days_away: number;
  opportunity: { id: string; name: string; stage: string } | null; not_renewed_on: string | null; done: boolean; outcome: "renewed" | "not_renewed" | null; made_by_win: boolean;
};
// The project's compiler setting makes every zod object key optional, so each schema is given its exact shape.
const rowSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().min(1),
  kind: z.enum(["peo_placement", "current_plan"]),
  with_whom: z.string(),
  renews_on: day,
  days_away: z.number().int(),
  opportunity: z.object({ id: z.string().min(1), name: z.string(), stage: z.string() }).nullable(),
  not_renewed_on: day.nullable(),
  done: z.boolean(),
  outcome: z.enum(["renewed", "not_renewed"]).nullable(),
  made_by_win: z.boolean(),
}) as unknown as z.ZodType<Row>;

const rowOf = (r: Row): Renewal => ({
  id: r.id, version: r.version, kind: r.kind, withWhom: r.with_whom, renewsOn: r.renews_on, daysAway: r.days_away, opportunity: r.opportunity,
  notRenewedOn: r.not_renewed_on, done: r.done, outcome: r.outcome, madeByWin: r.made_by_win,
});

const listSchema = z.object({ count: z.number().int().min(0), can_change: z.boolean(), rows: z.array(rowSchema) }) as unknown as z.ZodType<{ count: number; can_change: boolean; rows: Row[] }>;

/** The account's renewals, those not done first. Null: the account is not there or not the person's. */
export async function getAccountRenewals(firmId: string, accountId: string): Promise<AccountRenewals | null> {
  const { data, error } = await supabase.rpc("account_renewals", { p_firm_id: firmId, p_account_id: accountId, p_time_zone: browserTimeZone() });
  if (error) throw renewalRefusal(error, LIST_FALLBACK);
  if (data === null) return null;
  const parsed = listSchema.safeParse(data);
  if (!parsed.success) throw new RenewalError("failed", LIST_FALLBACK);
  return { count: parsed.data.count, canChange: parsed.data.can_change, rows: parsed.data.rows.map(rowOf) };
}

export interface NewRenewal {
  kind: RenewalKind;
  withWhom: string;
  renewsOn: string;
  /** When a PEO placement started, if known; only for a PEO placement. */
  placementStartOn: string;
}

const addedSchema = z.object({ renewal: rowSchema }).passthrough() as unknown as z.ZodType<{ renewal: Row }>;

export async function addRenewal(firmId: string, accountId: string, r: NewRenewal): Promise<Renewal> {
  const { data, error } = await supabase.rpc("add_renewal", {
    p_account_id: accountId,
    p_kind: r.kind,
    p_with_whom: r.withWhom,
    p_renews_on: r.renewsOn,
    p_placement_start_on: r.kind === "peo_placement" && r.placementStartOn !== "" ? r.placementStartOn : null,
    p_firm_id: firmId,
    p_time_zone: browserTimeZone(),
  });
  if (error) throw renewalRefusal(error, SAVE_FALLBACK);
  const parsed = addedSchema.safeParse(data);
  if (!parsed.success) throw new RenewalError("failed", SAVE_FALLBACK);
  return rowOf(parsed.data.renewal);
}

/** Someone else changed the renewal while the person was editing it: nothing was saved. `current` holds the fields the answer names (the other fields stay null). */
export interface RenewalConflict {
  conflict: true;
  currentVersion: number;
  current: { withWhom: string | null; renewsOn: string | null; notRenewedOn: string | null };
  changed: ChangedField[];
}
export type RenewalSaved = { conflict: false; renewal: Renewal };

type Current = { with_whom?: string; renews_on?: string; not_renewed_on?: string | null };
const currentSchema = z.object({ with_whom: z.string().optional(), renews_on: z.string().optional(), not_renewed_on: z.string().nullable().optional() }) as unknown as z.ZodType<Current>;

function answerOf(data: unknown): RenewalSaved | RenewalConflict {
  const answer = readSaveAnswer(data, rowSchema, currentSchema);
  if (!answer) throw new RenewalError("failed", SAVE_FALLBACK);
  if (!answer.conflict) return { conflict: false, renewal: rowOf((answer as Saved<Row>).record) };
  const c = answer as RecordConflict<Current>;
  return {
    conflict: true,
    currentVersion: c.currentVersion,
    current: { withWhom: c.current.with_whom ?? null, renewsOn: c.current.renews_on ?? null, notRenewedOn: c.current.not_renewed_on ?? null },
    changed: c.changed,
  };
}

/** Saves with whom and the date from the version the person started from (what renews is not changed: delete and add the right one). */
export async function updateRenewal(firmId: string, renewalId: string, edit: { withWhom: string; renewsOn: string }, version: number): Promise<RenewalSaved | RenewalConflict> {
  const { data, error } = await supabase.rpc("update_renewal", {
    p_renewal_id: renewalId, p_with_whom: edit.withWhom, p_renews_on: edit.renewsOn, p_firm_id: firmId, p_version: version, p_time_zone: browserTimeZone(),
  });
  if (error) throw renewalRefusal(error, SAVE_FALLBACK);
  return answerOf(data);
}

/** "Didn't renew" on the day given; the placement it came from ends that day (D-451). */
export async function markNotRenewed(firmId: string, renewalId: string, on: string, version: number): Promise<RenewalSaved | RenewalConflict> {
  const { data, error } = await supabase.rpc("mark_renewal_not_renewed", {
    p_renewal_id: renewalId, p_not_renewed_on: on, p_firm_id: firmId, p_version: version, p_time_zone: browserTimeZone(),
  });
  if (error) throw renewalRefusal(error, SAVE_FALLBACK);
  return answerOf(data);
}

/** Undoes "Didn't renew": the renewal and its placement are back. */
export async function undoNotRenewed(firmId: string, renewalId: string, version: number): Promise<RenewalSaved | RenewalConflict> {
  const { data, error } = await supabase.rpc("undo_renewal_not_renewed", { p_renewal_id: renewalId, p_firm_id: firmId, p_version: version, p_time_zone: browserTimeZone() });
  if (error) throw renewalRefusal(error, SAVE_FALLBACK);
  return answerOf(data);
}

const deletedSchema = z.object({ deleted: z.literal(true), with_whom: z.string() }) as unknown as z.ZodType<{ deleted: true; with_whom: string }>;

/** Deletes the renewal from the version the person started from: `deleted`, or a conflict when someone saved first (nothing deleted). */
export async function deleteRenewal(firmId: string, renewalId: string, version: number): Promise<{ conflict: false } | RenewalConflict> {
  const { data, error } = await supabase.rpc("delete_renewal", { p_renewal_id: renewalId, p_firm_id: firmId, p_version: version });
  if (error) throw renewalRefusal(error, "Couldn't delete the renewal. Check your connection and try again.");
  if (deletedSchema.safeParse(data).success) return { conflict: false };
  const answer = readSaveAnswer(data, rowSchema, currentSchema);
  if (answer && answer.conflict) return answerOf(data) as RenewalConflict;
  throw new RenewalError("failed", "Couldn't delete the renewal. Check your connection and try again.");
}
