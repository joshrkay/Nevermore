import { supabase } from "@/integrations/supabase/client";
import { classifyApiError } from "@/lib/advisorApi";
import { clearMyFirms } from "@/hooks/useOwnedFirms";
import { notifyMembershipChanged } from "@/lib/membershipChanged";

// What the Settings page asks the database when a member leaves their firm (story CRM-P1.6). The database decides every rule: only a
// current member of that firm can leave it, and the last owner of a firm cannot (D-18). It ends the membership the way an owner
// removing someone does, writes the leaving to the firm's record and queues the email to the owners, in one step. These only put its
// refusals into words.

export class LeaveFirmError extends Error {}

type DbError = { code?: string; message?: string };

function refusal(error: DbError): Error {
  // A session the server no longer accepts is said in its own words.
  const ended = classifyApiError({ message: error.message ?? "", code: error.code }, "");
  if (ended.unauthenticated) return ended;
  switch (error.code) {
    // The last owner's refusal is a plain sentence of the database's own, and says what to do.
    case "23514": return new LeaveFirmError(error.message || "Couldn't leave the firm. Try again.");
    case "42501": return new LeaveFirmError("You aren't a member of this firm.");
    case "PT404": return new LeaveFirmError("You have already left this firm.");
    default: return new LeaveFirmError("Couldn't leave the firm. Try again.");
  }
}

/** The signed-in person leaves the firm: their membership ends now, the firm's owners are told, and it is written to the firm's record. */
export async function leaveFirm(firmId: string): Promise<void> {
  const { error } = await supabase.rpc("leave_firm", { p_firm_id: firmId });
  if (error) throw refusal(error);
}

/**
 * Once they have left, everything the page remembers about their firms is out of date: the shell's menu, the guards' answers and the
 * firm address's. The browser asks again from the top, which lands a person with no firm on "You aren't a member of any firm" (or,
 * at the firm's own address, "You aren't a member of this firm"), signed in still.
 */
export function afterLeavingFirm(): void {
  clearMyFirms();
  notifyMembershipChanged();
  window.location.reload();
}
