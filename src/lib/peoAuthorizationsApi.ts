// The employer's PEO authorizations (M-1.1): each PEO's state on an intake, and the employer authorizing or withdrawing one. The database decides every
// rule (only the intake's employer, only a listed PEO, the wording's version); this sends the words the employer was shown and reads its answer.
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PEO_AUTHORIZATION_VERSION, peoAuthorizationText, peoWithdrawalText } from "@/data/legalWording";
import { lineOf, type QuoteLine } from "@/data/lines";

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

/**
 * What an intake is for (ADR 0029): its line, which the employer's own boxes are worded by. The employer reads their own intake, and a member of its firm
 * reads it too. Throws when it can't be read; a row that names no line is a PEO intake.
 */
export async function loadIntakeLine(sessionId: string): Promise<QuoteLine> {
  const { data, error } = await supabase.from("chamber_sessions").select("line").eq("id", sessionId).maybeSingle();
  if (error) throw refused(error);
  return lineOf((data as { line?: unknown } | null)?.line);
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

/** The employer ends the firm's access to one of their intakes (CRM-P2.5, D-1714). The database decides who may (the intake's own employer) and what it refuses. */
export async function endFirmAccess(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc("employer_end_firm_access", { p_session_id: sessionId });
  if (error) throw refused(error);
}

/** An intake of the signed-in employer that an outside firm can see, with the firm's name. */
export interface MyIntakeFirm {
  id: string;
  firm: string;
  company: string;
  /** The member of the firm who invited the employer, by name; null when the intake was started at the firm's link and nobody invited them (CRM-Q2.3, D-1881). */
  invitedBy: string | null;
  invitedAt: Date | null;
}

const intakeFirmsSchema = z.array(
  z.object({
    session_id: z.string().min(1),
    firm_name: z.string().min(1),
    company: z.string().nullable(),
    invited_by_name: z.string().nullable().optional(),
    invited_at: z.string().nullable().optional(),
  }),
);

/** The firm that sees each of the employer's own intakes (an employer can't read a firm's name, so the database says it), for "End <Firm>'s access". */
export async function listMyIntakeFirms(): Promise<MyIntakeFirm[]> {
  const { data, error } = await supabase.rpc("my_intake_firms");
  if (error) throw refused(error);
  return intakeFirmsSchema.parse(data).map((r) => ({ id: r.session_id, firm: r.firm_name, company: r.company ?? "Your company",
    invitedBy: r.invited_by_name ?? null,
    invitedAt: r.invited_at ? new Date(r.invited_at) : null,
  }));
}
