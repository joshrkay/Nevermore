import { supabase } from "@/integrations/supabase/client";
import { functionErrorReply } from "@/lib/functionError";
import { hashInvitationToken } from "../../supabase/functions/_shared/invitationToken.ts";

// The server calls New quote's steps will make for a broker-started intake (P-2.2, P-2.4; D-1703, D-1710..D-1712). The database decides every rule.

const startRefusal = (code: string | undefined): string => {
  switch (code) {
    case "PT409": return "This opportunity already has an intake.";
    case "55000": return "This account is archived. Nothing can be added to it.";
    case "PT423": return "This firm is closing and can't be changed.";
    case "42501": return "You need to be a member of a firm to start an intake.";
    case "22023": return "You belong to more than one firm. Say which.";
    case "PT404": return "That opportunity isn't available.";
    default: return "Couldn't start the intake. Try again.";
  }
};

/** Starts the intake of an opportunity of the caller's firm, with no employer until the client accepts. */
export async function startBrokerIntake(opportunityId: string): Promise<{ intakeId: string }> {
  const { data, error } = await supabase.rpc("start_broker_intake", { p_opportunity_id: opportunityId });
  if (error) throw new Error(startRefusal(error.code));
  const intakeId = (data as { intake_id?: string } | null)?.intake_id;
  if (!intakeId) throw new Error(startRefusal(undefined));
  return { intakeId };
}

export type Delivery = "sent" | "failed" | "unknown";

async function callServer(body: Record<string, unknown>): Promise<{ invitationId: string; delivery: Delivery }> {
  const { data, error } = await supabase.functions.invoke("invite-client", { body });
  if (error) throw new Error((await functionErrorReply(error as { context?: unknown })).reason ?? "Couldn't send the invitation. Try again.");
  const reply = data as { invitation_id?: string; delivery?: string } | null;
  if (!reply?.invitation_id) throw new Error("Couldn't send the invitation. Try again.");
  return { invitationId: reply.invitation_id, delivery: reply.delivery === "sent" || reply.delivery === "failed" ? reply.delivery : "unknown" };
}

/** Invites the client of a broker-started intake to finish and certify it: a one-use link to the firm's address, emailed as "<Firm> via Nevermore" (D-1711, D-1712). */
export function inviteClient(input: { intakeId: string; email: string; name?: string }) {
  return callServer({ action: "invite", intake_id: input.intakeId, email: input.email, name: input.name });
}

/** Remind: a fresh link that replaces the old one, which stops working. */
export function remindClient(intakeId: string) {
  return callServer({ action: "remind", intake_id: intakeId });
}

export type IntakeInviteStatus =
  | { state: "none" }
  | {
      state: "waiting" | "expired" | "accepted";
      email: string;
      contactName: string | null;
      invitedAt: Date;
      lastOpenedAt: Date | null;
      expiresAt: Date;
      sendCount: number;
      acceptedAt: Date | null;
      delivery: Delivery | null;
    };

const ASK_AGAIN = "Ask your broker to send a new one.";

/** The words for a link that can't be opened or taken: why, and never anything about whether an email has an account. */
function inviteRefusal(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case "PT404": return `This invitation link isn't valid. ${ASK_AGAIN}`;
    case "PT410":
      if (/replaced/i.test(error.message ?? "")) return "This link was replaced by a newer one. Use the latest email your broker sent.";
      if (/expired/i.test(error.message ?? "")) return `This invitation has expired. ${ASK_AGAIN}`;
      if (/withdrawn/i.test(error.message ?? "")) return `This invitation was withdrawn. ${ASK_AGAIN}`;
      return "This invitation has already been used.";
    case "PT422": return "This invitation is for a different firm's address. Open the link from your email as it was sent.";
    case "PT403":
      if (/member of the firm/i.test(error.message ?? "")) return "A member of the firm can't take the client's place. The client opens this link with their own account.";
      return "This invitation was sent to a different email address than the one you are signed in with. Sign out, then sign in or create your account with the address it was sent to.";
    case "PT409": return "You already have an intake in progress. Finish it or start over from it, then open this link again.";
    case "42501": return "Sign in with a verified email address to open this invitation.";
    default: return "Couldn't open the invitation. Try again.";
  }
}

/** What the page behind an invitation link shows before the person signs in: the firm that invited them and who it is for. */
export async function peekIntakeInvite(token: string, firmAddress: string): Promise<{ firmName: string; contactName: string | null }> {
  const { data, error } = await supabase.rpc("peek_intake_invite", { p_token_hash: await hashInvitationToken(token), p_firm_address: firmAddress });
  if (error) throw new Error(inviteRefusal(error));
  const row = (Array.isArray(data) ? data[0] : data) as { firm_name: string; contact_name?: string | null } | undefined;
  if (!row) throw new Error(inviteRefusal({}));
  return { firmName: row.firm_name, contactName: row.contact_name ?? null };
}

const asDate = (v: unknown): Date | null => (typeof v === "string" ? new Date(v) : null);

/** Where an intake's invitation stands, for step 3. */
export async function fetchIntakeInviteStatus(intakeId: string): Promise<IntakeInviteStatus> {
  const { data, error } = await supabase.rpc("intake_invite_status", { p_intake_id: intakeId });
  if (error) throw new Error(error.code === "PT404" ? "That intake isn't available." : "Couldn't load the invitation. Try again.");
  const s = data as Record<string, unknown> | null;
  if (!s || s.state === "none") return { state: "none" };
  return {
    state: s.state === "accepted" || s.state === "expired" ? s.state : "waiting",
    email: String(s.email),
    contactName: typeof s.contact_name === "string" ? s.contact_name : null,
    invitedAt: asDate(s.invited_at)!,
    lastOpenedAt: asDate(s.last_opened_at),
    expiresAt: asDate(s.expires_at)!,
    sendCount: Number(s.send_count),
    acceptedAt: asDate(s.accepted_at),
    delivery: s.email_outcome === "sent" || s.email_outcome === "failed" || s.email_outcome === "unknown" ? s.email_outcome : null,
  };
}

/** Takes over the intake the link opens, as the signed-in person, at the firm address the link was opened at (D-1703, D-1711). */
export async function acceptIntakeInvite(token: string, firmAddress: string): Promise<{ intakeId: string }> {
  const { data, error } = await supabase.rpc("accept_intake_invite", { p_token_hash: await hashInvitationToken(token), p_firm_address: firmAddress });
  if (error) throw new Error(inviteRefusal(error));
  const intakeId = (data as { intake_id?: string } | null)?.intake_id;
  if (!intakeId) throw new Error(inviteRefusal({}));
  return { intakeId };
}
