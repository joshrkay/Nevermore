import { supabase } from "@/integrations/supabase/client";

// What the members screen asks the database (story CRM-P1.5). The database decides every rule: only a current owner of the firm
// may list, remove, suspend or lift (D-18), a firm keeps an owner, and a platform admin who is no member may do none of it (D-16).
// These only put its refusals into words.

export type MemberRole = "owner" | "lead" | "agent";
/** `current` is a member; `suspended` is kept on the list and grants nothing until an owner lifts it. A removed person is not listed. */
export type MemberState = "current" | "suspended";

export interface FirmMember {
  userId: string;
  email: string;
  role: MemberRole;
  state: MemberState;
  /** Since when: the membership began (current) or the suspension was made (suspended). */
  since: string;
  /** The reader: an owner can neither remove nor suspend themself here. */
  isYou: boolean;
}

export class MemberApiError extends Error {
  constructor(message: string, readonly forbidden = false) {
    super(message);
  }
}

type DbError = { code?: string; message?: string };

/** The words for a refused or failed change. A rule's own message (a firm keeps its last owner, you can't remove yourself) is plain and is given as it is. */
function changeRefusal(error: DbError): MemberApiError {
  switch (error.code) {
    case "42501": return new MemberApiError("Only an owner of the firm can do that.", true);
    case "PT404": return new MemberApiError("That person's membership has already changed. Reload the list.");
    case "23514":
    case "PT409": return new MemberApiError(error.message || "Couldn't do that. Try again.");
    default: return new MemberApiError("Couldn't do that. Try again.");
  }
}

/** The firm's current and suspended members, owners first. Owners of the firm only. */
export async function fetchFirmMembers(firmId: string): Promise<FirmMember[]> {
  const { data, error } = await supabase.rpc("firm_members", { p_firm_id: firmId });
  if (error) {
    throw error.code === "42501" ? new MemberApiError("Only an owner of the firm can see its members.", true) : new MemberApiError("Couldn't load the members.");
  }
  return (data ?? []).map((m) => ({
    userId: m.user_id,
    email: m.email,
    role: m.role as MemberRole,
    state: m.state === "suspended" ? "suspended" : "current",
    since: m.since,
    isYou: m.is_you,
  }));
}

async function change(fn: "remove_member" | "suspend_member" | "lift_member_suspension", firmId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc(fn, { p_firm_id: firmId, p_user_id: userId });
  if (error) throw changeRefusal(error);
}

/** Ends the person's membership now. It is kept, dated, never deleted. */
export const removeMember = (firmId: string, userId: string) => change("remove_member", firmId, userId);

/** Keeps the person on the list but grants them nothing until an owner lifts it. */
export const suspendMember = (firmId: string, userId: string) => change("suspend_member", firmId, userId);

/** Gives a suspended person back the role and team they had. */
export const liftSuspension = (firmId: string, userId: string) => change("lift_member_suspension", firmId, userId);
