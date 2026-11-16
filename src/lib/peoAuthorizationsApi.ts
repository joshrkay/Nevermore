// The employer's PEO authorizations (M-1.1): each PEO's state on an intake, and the employer authorizing or withdrawing one. The database decides every
// rule (only the intake's employer, only a listed PEO, the wording's version); this sends the words the employer was shown and reads its answer.
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PEO_AUTHORIZATION_VERSION, peoAuthorizationText, peoWithdrawalText } from "@/data/legalWording";

export type PeoAuthorizationStateName = "authorized" | "withdrawn" | "not_asked";

export interface PeoAuthorizationState {
  peo: string;
  state: PeoAuthorizationStateName;
  signedAt: string | null;
  wordingVersion: string | null;
}

/** A refusal, with the database's own words and code (failureWords decides what a person is shown). */
export class PeoAuthorizationError extends Error {
  constructor(message: string, readonly code: string | undefined) {
    super(message);
    this.name = "PeoAuthorizationError";
  }
}

const refused = (error: { message: string; code?: string }) => new PeoAuthorizationError(error.message, error.code);

const statesSchema = z.array(z.object({
  peo: z.string().min(1),
  state: z.enum(["authorized", "withdrawn", "not_asked"]),
  signed_at: z.string().nullable(),
  wording_version: z.string().nullable(),
}));

/** Each PEO's state on an intake (the employer's own, or one of the caller's firm's), alphabetically. */
export async function loadPeoAuthorizations(sessionId: string): Promise<PeoAuthorizationState[]> {
  const { data, error } = await supabase.rpc("peo_authorization_states", { p_session_id: sessionId });
  if (error) throw refused(error);
  return statesSchema.parse(data).map((r) => ({ peo: r.peo, state: r.state, signedAt: r.signed_at, wordingVersion: r.wording_version }));
}

/** The employer authorizes (true) or withdraws (false) a PEO, under the wording in force. */
export async function setPeoAuthorization(sessionId: string, peo: string, authorized: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_peo_authorization", {
    p_session_id: sessionId,
    p_peo: peo,
    p_authorized: authorized,
    p_version: PEO_AUTHORIZATION_VERSION,
    p_text: authorized ? peoAuthorizationText(peo) : peoWithdrawalText(peo),
  });
  if (error) throw refused(error);
}

/** One of the signed-in employer's certified intakes, by its company. */
export interface MyCertifiedIntake {
  id: string;
  company: string;
}

/** The employer's own certified intakes, for their profile: their own only (row security also shows a firm member their firm's), oldest first. */
export async function listMyCertifiedIntakes(userId: string): Promise<MyCertifiedIntake[]> {
  const { data, error } = await supabase
    .from("chamber_sessions")
    .select("id, chamber_data")
    .eq("user_id", userId)
    .eq("status", "submitted")
    .order("created_at");
  if (error) throw refused(error);
  return (data ?? []).map((row) => {
    const company = (row.chamber_data as { company_name?: unknown } | null)?.company_name;
    return { id: row.id, company: typeof company === "string" && company.trim() !== "" ? company : "Your company" };
  });
}
