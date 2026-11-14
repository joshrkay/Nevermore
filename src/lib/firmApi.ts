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

/**
 * Whether the firm at this address is suspended and the signed-in caller is a current member of it (story CRM-P1.8). The
 * database answers true to no one else, so a stranger learns nothing. Only chooses what to show; the database refuses the
 * firm's data to a member of a suspended firm anyway.
 */
export async function fetchIsMySuspendedFirmAtAddress(address: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("my_suspended_firm_at_address", { p_address: address });
  if (error) throw new Error("Couldn't check whether this firm is suspended.");
  return data === true;
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

/** A firm as a platform admin sees it: its approval state, and whether it is suspended now and why. */
export interface FirmState {
  id: string;
  name: string;
  address: string;
  /** The approval decision (CRM-P1.1): waiting for it, approved, or refused. Suspension is separate from it. */
  state: "waiting" | "approved" | "refused";
  signedUpAt: string;
  suspended: boolean;
  suspendedAt: string | null;
  suspensionReason: string | null;
  /** When the firm closes, while its owner's request is waiting out its 30 days (story CRM-P1.7); null otherwise. */
  closingOn: string | null;
  /** When the firm closed; null while it has not. A closed firm is shown at the address it held. */
  closedOn: string | null;
  /** A count per table of what closing deleted: numbers only, no names and no content. */
  closureDeleted: Record<string, number> | null;
}

/** Every firm with its state, by name. Platform admins only. */
export async function fetchFirmStates(): Promise<FirmState[]> {
  const { data, error } = await supabase.rpc("admin_firm_states");
  if (error) throw classifyApiError(error, error.code === "42501" ? "You don't have admin access." : "Couldn't load the firms.");
  return (data ?? []).map((f) => ({
    id: f.firm_id, name: f.name, address: f.address, state: f.state as FirmState["state"], signedUpAt: f.signed_up_at,
    suspended: f.suspended, suspendedAt: f.suspended_at, suspensionReason: f.suspension_reason,
    closingOn: f.closing_on, closedOn: f.closed_on, closureDeleted: f.closure_deleted,
  }));
}

/** Suspends a firm with a reason (story CRM-P1.8). Its people are told it is suspended; nothing is deleted. */
export async function suspendFirm(firmId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("admin_suspend_firm", { p_firm_id: firmId, p_reason: reason });
  if (!error) return;
  if (error.code === "PT409") throw new Error("That firm is suspended already.");
  if (error.code === "PT404") throw new Error("That firm no longer exists.");
  if (error.code === "22023") throw new Error("Give a reason of 1 to 500 characters.");
  throw classifyApiError(error, error.code === "42501"
    ? "Only a platform admin who isn't a member of the firm can suspend it."
    : "Couldn't suspend the firm. Try again.");
}

/** Lifts a firm's suspension: everything is as it was. */
export async function liftFirmSuspension(firmId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_lift_firm_suspension", { p_firm_id: firmId });
  if (!error) return;
  if (error.code === "PT409") throw new Error("That firm is not suspended.");
  if (error.code === "PT404") throw new Error("That firm no longer exists.");
  throw classifyApiError(error, error.code === "42501"
    ? "Only a platform admin who isn't a member of the firm can lift its suspension."
    : "Couldn't lift the suspension. Try again.");
}
