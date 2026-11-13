import { supabase } from "@/integrations/supabase/client";
import { classifyApiError } from "@/lib/advisorApi";

// What the screens at a firm address ask the database (story CRM-P1.3a). Both answers only choose what to show;
// the database still checks membership on every row and function (D-18).

/** The name an address shows before sign-in: the firm's name for any firm that exists and is not refused, approved or waiting, or null when no firm holds it or the firm was refused (a refused firm is treated as unknown). */
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

// Signing up a firm and a platform admin's decision on it (story CRM-P1.1 with Q-1.2). The database applies every rule
// (the address rules, who may sign up, who may decide, deciding once); these only put its refusals into words.

type DbError = { code?: string; message?: string };

/** The reason the database gave for a refused name or address, or a plain one when all it gave is a constraint's name. */
function refusalReason(error: DbError): string {
  const said = error.message ?? "";
  if (/check constraint|violates/i.test(said) || !said) {
    return "That address can't be used. Use 3 to 40 letters, digits or hyphens, not starting or ending with a hyphen, and not a reserved word or the name of Nevermore.";
  }
  return said;
}

/**
 * Signs a firm up: the signed-in person becomes its owner, and the firm waits for a platform admin's approval. Returns the
 * firm's id. Throws an error whose message is fit to show.
 */
export async function signUpFirm(name: string, address: string): Promise<string> {
  const { data, error } = await supabase.rpc("sign_up_firm", { p_name: name, p_address: address });
  if (error) {
    if (error.code === "23505") throw new Error("That address is taken. Choose another.");
    if (error.code === "23514") throw new Error(refusalReason(error));
    if (error.code === "PT409") throw new Error("You already have a firm waiting for approval.");
    if (error.code === "42501") throw new Error("Sign in with a verified email to sign up a firm.");
    throw new Error("Couldn't sign your firm up. Try again.");
  }
  return data as string;
}

/** A firm waiting for a platform admin's decision. */
export interface WaitingFirm {
  id: string;
  name: string;
  address: string;
  signedUpByEmail: string | null;
  signedUpAt: string;
}

/** The firms waiting for approval, oldest first. Platform admins only. */
export async function fetchWaitingFirms(): Promise<WaitingFirm[]> {
  const { data, error } = await supabase.rpc("admin_waiting_firms");
  if (error) throw classifyApiError(error, error.code === "42501" ? "You don't have admin access." : "Couldn't load the waiting firms.");
  return (data ?? []).map((f) => ({ id: f.firm_id, name: f.name, address: f.address, signedUpByEmail: f.signed_up_by_email, signedUpAt: f.signed_up_at }));
}

/** Approves or refuses a waiting firm, with an optional note. A firm is decided once. */
export async function decideFirm(firmId: string, approve: boolean, note?: string): Promise<void> {
  const { error } = await supabase.rpc("admin_decide_firm", { p_firm_id: firmId, p_approve: approve, p_note: note ?? null });
  if (!error) return;
  if (error.code === "55000") throw new Error("That firm has been decided already.");
  if (error.code === "PT404") throw new Error("That firm no longer exists.");
  // 42501 is either a lost admin role or the admin belonging to this firm; either way the page reports what the database refused.
  throw classifyApiError(error, error.code === "42501"
    ? "Only a platform admin who isn't a member of the firm can decide on it."
    : "Couldn't record the decision. Try again.");
}
