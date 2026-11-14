import { supabase } from "@/integrations/supabase/client";
import { functionErrorReply } from "@/lib/functionError";
import { hashInvitationToken } from "../../supabase/functions/_shared/invitationToken.ts";

// What the screens ask the database and the invite-member server function for invitations (story CRM-P1.2). The database
// decides every rule (who may invite, one pending invitation per email, who may accept); these only put its refusals into words.

export type FirmRole = "owner" | "lead" | "agent";
export type Delivery = "sent" | "failed" | "unknown";

export interface PendingInvitation {
  id: string;
  email: string;
  role: FirmRole;
  invitedAt: string;
  expiresAt: string;
  expired: boolean;
  resentAt: string | null;
  /** How the email of the current link fared: sent, failed (certainly not delivered), unknown (the provider may have accepted it), or null when no send has been recorded. */
  delivery: Delivery | null;
  emailError: string | null;
}

type DbError = { code?: string; message?: string };

async function callServer(body: Record<string, unknown>): Promise<{ invitationId: string; delivery: Delivery }> {
  const { data, error } = await supabase.functions.invoke("invite-member", { body });
  if (error) throw new Error((await functionErrorReply(error as { context?: unknown })).reason ?? "Couldn't send the invitation. Try again.");
  const reply = data as { invitation_id?: string; delivery?: string } | null;
  if (!reply?.invitation_id) throw new Error("Couldn't send the invitation. Try again.");
  // An answer that does not say it went is not a success.
  return { invitationId: reply.invitation_id, delivery: reply.delivery === "sent" || reply.delivery === "failed" ? reply.delivery : "unknown" };
}

/** Invites an email address to a firm with a role (and, later, a team). Resolves with how the email fared (sent, failed, or unknown when the mail provider may have accepted it): the invitation is kept either way. */
export function inviteMember(input: { firmId: string; email: string; role: FirmRole; teamId?: string | null }) {
  return callServer({ action: "invite", firm_id: input.firmId, email: input.email, role: input.role, ...(input.teamId ? { team_id: input.teamId } : {}) });
}

/** Sends an invitation again, with a new link that replaces the old one. */
export function resendInvitation(invitationId: string) {
  return callServer({ action: "resend", invitation_id: invitationId });
}

/** The firm's invitations that can still be used or resent, oldest first. Owners only. */
export async function fetchPendingInvitations(firmId: string): Promise<PendingInvitation[]> {
  const { data, error } = await supabase.rpc("firm_pending_invitations", { p_firm_id: firmId });
  // A refusal (42501) carries `forbidden`, which the page reads (as it reads the advisor reads') to say there is nothing to retry.
  if (error) throw error.code === "42501" ? Object.assign(new Error("Only an owner of the firm can see invitations."), { forbidden: true }) : new Error("Couldn't load the invitations.");
  return (data ?? []).map((i) => ({
    id: i.invitation_id,
    email: i.email,
    role: i.role as FirmRole,
    invitedAt: i.invited_at,
    expiresAt: i.expires_at,
    expired: i.expired,
    resentAt: i.resent_at,
    delivery: i.email_outcome === "sent" || i.email_outcome === "failed" || i.email_outcome === "unknown" ? i.email_outcome : null,
    emailError: i.email_error,
  }));
}

/** Withdraws an invitation that has not been used. */
export async function cancelInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_invitation", { p_invitation_id: invitationId });
  if (!error) return;
  if (error.code === "PT410") throw new Error("That invitation has already been used or withdrawn.");
  if (error.code === "42501") throw new Error("Only an owner of the firm can withdraw an invitation.");
  throw new Error("Couldn't withdraw the invitation. Try again.");
}

const ASK_AGAIN = "Ask the person who invited you to send a new one.";

/** The words for a refused acceptance. They say why the link or the sign-in can't be used, and never anything about whether an email has an account. */
function acceptanceRefusal(error: DbError): string {
  const said = error.message ?? "";
  switch (error.code) {
    case "PT404": return `This invitation link isn't valid. ${ASK_AGAIN}`;
    case "PT410":
      if (/expired/i.test(said)) return `This invitation has expired. ${ASK_AGAIN}`;
      if (/withdrawn/i.test(said)) return `This invitation was withdrawn. ${ASK_AGAIN}`;
      return "This invitation has already been used.";
    case "PT403": return "This invitation was sent to a different email address than the one you are signed in with. Sign out, then sign in or create your account with the address it was sent to.";
    case "PT422": return "This invitation is for a different firm's address. Open the link from your email as it was sent.";
    case "PT409": return "You're already a member of this firm.";
    case "42501": return "Sign in with a verified email address to accept an invitation.";
    default: return "Couldn't accept the invitation. Try again.";
  }
}

/**
 * Accepts the invitation a link carries, as the signed-in person, at the firm address the link was opened at: the database
 * joins nothing unless that is the address of the invitation's firm (D-34). It is given the token's hash, never the token.
 */
export async function acceptInvitation(token: string, firmAddress: string): Promise<{ firmAddress: string; role: FirmRole }> {
  const { data, error } = await supabase.rpc("accept_invitation", { p_token_hash: await hashInvitationToken(token), p_firm_address: firmAddress });
  if (error) throw new Error(acceptanceRefusal(error));
  const joined = Array.isArray(data) ? data[0] : data;
  if (!joined) throw new Error("Couldn't accept the invitation. Try again.");
  return { firmAddress: joined.firm_address, role: joined.role as FirmRole };
}

/** The firm at an address, for a member who is signed in: its id (to ask about invitations), name and the caller's own role in it, or null. */
export async function fetchMyFirm(address: string): Promise<{ id: string; name: string; role: FirmRole | null } | null> {
  const { data, error } = await supabase.from("firms").select("id, name").eq("address", address).maybeSingle();
  if (error) throw new Error("Couldn't load your firm.");
  if (!data) return null;
  const { data: role, error: roleError } = await supabase.rpc("firm_role", { p_firm_id: data.id });
  if (roleError) throw new Error("Couldn't load your firm.");
  return { id: data.id, name: data.name, role: role as FirmRole | null };
}
