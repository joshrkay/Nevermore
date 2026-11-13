import { supabase } from "@/integrations/supabase/client";

// What the screens at a firm address ask the database (story CRM-P1.3a). Both answers only choose what to show;
// the database still checks membership on every row and function (D-18).

/** The name an address shows before sign-in: the firm's name for any firm that exists, approved or not, or null when no firm holds it. */
export async function fetchFirmName(address: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("firm_public_name", { p_address: address });
  if (error) throw new Error("Couldn't look up this firm address.");
  return typeof data === "string" ? data : null;
}

/** Whether the signed-in caller is a current member of the firm at this address. */
export async function fetchIsMemberOfFirmAddress(address: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_member_of_firm_address", { p_address: address });
  if (error) throw new Error("Couldn't check your membership.");
  return data === true;
}

/**
 * Tells the firm's record of who did what (CRM-P2.3) that the caller signed in to the firm at this address. Only the
 * firm's id is sent, and the database refuses a caller who isn't a current member of it. Resolves true once it is
 * written (or already was, within moments); false when it wasn't, never throws: a sign-in is never held up by it.
 */
export async function recordFirmSignIn(address: string): Promise<boolean> {
  try {
    const { data: firmId, error } = await supabase.rpc("my_firm_at_address", { p_address: address });
    if (error || typeof firmId !== "string") return false;
    const { error: reportError } = await supabase.rpc("record_member_activity", { p_kind: "sign_in", p_record_type: "firm", p_record_id: firmId });
    return !reportError;
  } catch {
    return false;
  }
}
