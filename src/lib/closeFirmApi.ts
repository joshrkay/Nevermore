import { supabase } from "@/integrations/supabase/client";
import { classifyApiError } from "@/lib/advisorApi";

// What the screens ask the database when a firm is closed (story CRM-P1.7). The database decides every rule: only a current owner of
// the firm, at its address, asks or withdraws; a refused or suspended firm can't; the name must be typed; a firm closes 30 days after
// it was asked, and until then it is read-only (every function that changes the firm's data refuses a member, code PT423). These only
// put its refusals into words.

/** A date in words, in the person's own time zone: "December 18, 2026". */
export const closingDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

export class CloseFirmError extends Error {}

type DbError = { code?: string; message?: string };

function refusal(error: DbError, fallback: string): Error {
  // A session the server no longer accepts is said in its own words.
  const ended = classifyApiError({ message: error.message ?? "", code: error.code }, "");
  if (ended.unauthenticated) return ended;
  switch (error.code) {
    case "22023": return new CloseFirmError("Type the firm's name exactly as it is written above.");
    case "42501": return new CloseFirmError("Only an owner of the firm can do that.");
    case "PT403": return new CloseFirmError("This firm takes the intakes people start on Nevermore, so it can't be closed.");
    case "PT409": return new CloseFirmError(error.message || fallback);
    case "PT423": return new CloseFirmError("This firm is closing and can't be changed.");
    default: return new CloseFirmError(fallback);
  }
}

/** Asks to close the firm. Returns when it will close: 30 days from now, unless an owner withdraws first. */
export async function requestFirmClosure(firmId: string, firmName: string): Promise<string> {
  const { data, error } = await supabase.rpc("request_firm_closure", { p_firm_id: firmId, p_firm_name: firmName });
  if (error) throw refusal(error, "Couldn't ask to close the firm. Try again.");
  return data as string;
}

/** Withdraws the open request to close the firm: the firm is then as it was. */
export async function withdrawFirmClosure(firmId: string): Promise<void> {
  const { error } = await supabase.rpc("withdraw_firm_closure", { p_firm_id: firmId });
  if (error) throw refusal(error, "Couldn't withdraw the request. Try again.");
}

/** Why a person may not ask to close the firm, as the database says it. */
export type CannotAskBecause = "default_firm" | "refused" | "closing" | "not_owner";

export interface FirmClosure {
  /** When the firm closes, or null when it is not closing. */
  closesAt: string | null;
  /** Whether the person may ask to close the firm. */
  canAsk: boolean;
  /** Why not, when not. */
  why: CannotAskBecause | null;
}

/**
 * Whether the firm is closing, whether the person may ask and, when not, why. Only a current member of the firm is told. A failed question
 * throws, so a page can say it failed and offer to try again, and never reads a failure as "this firm can't be closed".
 */
export async function fetchMyFirmClosure(firmId: string): Promise<FirmClosure> {
  const res = await supabase.rpc("my_firm_closure", { p_firm_id: firmId });
  if (!res || res.error) throw classifyApiError(res?.error ?? { message: "" }, "Couldn't check the firm.");
  const row = (res.data ?? [])[0];
  if (!row) return { closesAt: null, canAsk: false, why: null };
  return { closesAt: row.closes_at, canAsk: row.can_ask === true, why: (row.cannot_ask_because as CannotAskBecause | null) ?? null };
}
