import { supabase } from "@/integrations/supabase/client";
import { classifyApiError, type MyFirm } from "@/lib/advisorApi";

// What the screens ask the database for Help from Nevermore (story CRM-P2.4). The database decides every rule: only a platform admin
// starts a session, it lasts one hour of the server's clock, it opens that firm at its own address for reading and nothing else. These
// only put its refusals into words.

/** The most characters of a reason, as the database counts them. */
export const SUPPORT_REASON_MAX = 500;

/** The role the workspace shows for a platform admin looking at a firm on a support session. */
export const SUPPORT_ROLE = "support";

export class SupportError extends Error {}

type DbError = { code?: string; message?: string };

function refusal(error: DbError, fallback: string): Error {
  const ended = classifyApiError({ message: error.message ?? "", code: error.code }, "");
  if (ended.unauthenticated) return ended;
  switch (error.code) {
    case "22023": return new SupportError(`Give a reason of 1 to ${SUPPORT_REASON_MAX} characters.`);
    case "42501": return new SupportError(error.message?.startsWith("An admin does not use") ? "You belong to this firm, so you don't need support access to it." : "Only a platform admin can use support access.");
    case "PT404": return new SupportError("That firm or session is no longer there.");
    case "PT409": return new SupportError("You already have support access open for that firm.");
    case "55000": return new SupportError("That firm is refused or closed, so there is nothing to look at.");
    default: return new SupportError(fallback);
  }
}

/** A session of one admin on one firm, as the platform's page lists it. */
export interface SupportSession {
  id: string;
  firmId: string;
  firmName: string;
  firmAddress: string;
  adminEmail: string;
  reason: string;
  startedAt: string;
  endsAt: string;
  endedAt: string | null;
  /** Whether it can still be used: not ended and not out of time. */
  isOpen: boolean;
  /** Whether it is the signed-in admin's own, so "End now" is theirs to press. */
  isMine: boolean;
}

/** Starts one hour of read-only support access to a firm, with the reason the firm's owners will read. Returns the new session. */
export async function startSupportSession(firmId: string, reason: string): Promise<{ id: string; firmName: string; firmAddress: string; endsAt: string }> {
  const { data, error } = await supabase.rpc("start_support_session", { p_firm_id: firmId, p_reason: reason });
  const row = data?.[0];
  if (error || !row) throw refusal(error ?? {}, "Couldn't start support access. Try again.");
  return { id: row.session_id, firmName: row.firm_name, firmAddress: row.firm_address, endsAt: row.ends_at };
}

/** Ends the admin's own session now. */
export async function endSupportSession(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc("end_support_session", { p_session_id: sessionId });
  if (error) throw refusal(error, "Couldn't end support access. Try again.");
}

/** Every support session, open ones first. Platform admins only. */
export async function fetchSupportSessions(): Promise<SupportSession[]> {
  const { data, error } = await supabase.rpc("admin_support_sessions");
  if (error) throw classifyApiError(error, error.code === "42501" ? "You don't have admin access." : "Couldn't load the support sessions.");
  return (data ?? []).map((s) => ({
    id: s.session_id, firmId: s.firm_id, firmName: s.firm_name, firmAddress: s.firm_address, adminEmail: s.admin_email, reason: s.reason,
    startedAt: s.started_at, endsAt: s.ends_at, endedAt: s.ended_at, isOpen: s.is_open, isMine: s.is_mine,
  }));
}

/** The admin's latest support session for the firm at this address: open, or the one that has just ended. */
export interface MySupportSession {
  id: string;
  firmId: string;
  firmName: string;
  firmAddress: string;
  endsAt: string;
  endedAt: string | null;
  isOpen: boolean;
  /** Whether the sign-in is a password one that still owes its second step: the session grants nothing until it is done. */
  secondFactorPending: boolean;
}

/**
 * The caller's own latest support session for the firm the request names (the browser names it on every request at a firm's address), or
 * null when there is none or the caller is no platform admin. Never throws: a failed question reads as "no session", and the database
 * refuses the data anyway.
 */
export async function fetchMySupportSessionHere(): Promise<MySupportSession | null> {
  try {
    const { data, error } = await supabase.rpc("my_support_session_here");
    const row = data?.[0];
    if (error || !row) return null;
    return { id: row.session_id, firmId: row.firm_id, firmName: row.firm_name, firmAddress: row.firm_address, endsAt: row.ends_at, endedAt: row.ended_at, isOpen: row.is_open, secondFactorPending: row.second_factor_pending };
  } catch {
    return null;
  }
}

/** The firm as the workspace knows it while support is open: the role is "support", which no member holds. */
export function supportFirm(session: MySupportSession): MyFirm {
  return { firm_id: session.firmId, name: session.firmName, address: session.firmAddress, role: SUPPORT_ROLE, refused: false };
}

/** One use of support as a firm's owners read it: the reason written for them and the times, never who. */
export interface FirmSupportUse {
  id: string;
  reason: string;
  startedAt: string;
  endsAt: string;
  endedAt: string | null;
}

/** The uses of support on a firm, newest first. Owners of the firm (and a support session) only. */
export async function fetchFirmSupportUses(firmId: string): Promise<FirmSupportUse[]> {
  const { data, error } = await supabase.rpc("firm_support_sessions", { p_firm_id: firmId });
  if (error) throw classifyApiError(error, error.code === "42501" ? "Only a firm's owners can read its record." : "Couldn't load the uses of support.");
  return (data ?? []).map((s) => ({ id: s.session_id, reason: s.reason, startedAt: s.started_at, endsAt: s.ends_at, endedAt: s.ended_at }));
}

/** The time a session ends, as it is written on the banner: "3:42 PM". */
export const endTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
