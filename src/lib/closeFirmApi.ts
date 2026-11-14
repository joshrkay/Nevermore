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

/**
 * When the firm closes, or null when it is not closing. Only a current member of the firm is told. It is for showing the banner, so a
 * failed question is just no banner: the database refuses every change itself, whatever the screen shows.
 */
export async function fetchMyFirmClosure(firmId: string): Promise<string | null> {
  try {
    const res = await supabase.rpc("my_firm_closure", { p_firm_id: firmId });
    if (!res || res.error) return null;
    const row = (res.data ?? [])[0];
    return row ? row.closes_at : null;
  } catch {
    return null;
  }
}
