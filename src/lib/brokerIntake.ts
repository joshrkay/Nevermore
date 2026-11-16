import { supabase } from "@/integrations/supabase/client";
import { functionErrorReply } from "@/lib/functionError";
import { hashInvitationToken } from "../../supabase/functions/_shared/invitationToken.ts";

// What New quote's steps 1 to 3 (slices 5.4, 5.5, 5.7) call to start an intake for a client, invite the client to finish and certify, and see where the invitation
// stands (answers are entered in the existing chamber, which saves them as broker entries: D-1751) (P-2.2, P-2.4; docs/BROKER_CRM_BUILD.md D-1703, D-1710, D-1711, D-1712). No screen of New quote is built here (D-402): these are the server calls those screens will make, with the
// database's refusals put into words. The database decides every rule; nothing here chooses a firm, a source or a status.

type DbError = { code?: string; message?: string };
export type Delivery = "sent" | "failed" | "unknown";

const startRefusal = (error: DbError): string => {
  switch (error.code) {
    case "PT404": return "That opportunity isn't available.";
    case "PT409": return "This opportunity already has an intake.";
    case "55000": return "This account is archived. Nothing can be added to it.";
    case "PT423": return "This firm is closing and can't be changed.";
    case "42501": return "You need to be a member of a firm to start an intake.";
    case "22023": return "You belong to more than one firm. Say which.";
    default: return "Couldn't start the intake. Try again.";
  }
};

/** Starts the intake of an opportunity of the caller's firm, with no employer until the client accepts; the opportunity holds it from the start (ADR 0025). */
export async function startBrokerIntake(opportunityId: string): Promise<{ intakeId: string }> {
  const { data, error } = await supabase.rpc("start_broker_intake", { p_opportunity_id: opportunityId });
  if (error) throw new Error(startRefusal(error));
  const made = data as { intake_id?: string } | null;
  if (!made?.intake_id) throw new Error("Couldn't start the intake. Try again.");
  return { intakeId: made.intake_id };
}

async function callServer(body: Record<string, unknown>): Promise<{ invitationId: string; delivery: Delivery }> {
  const { data, error } = await supabase.functions.invoke("invite-client", { body });
  if (error) throw new Error((await functionErrorReply(error as { context?: unknown })).reason ?? "Couldn't send the invitation. Try again.");
  const reply = data as { invitation_id?: string; delivery?: string } | null;
  if (!reply?.invitation_id) throw new Error("Couldn't send the invitation. Try again.");
  // An answer that does not say it went is not a success.
  return { invitationId: reply.invitation_id, delivery: reply.delivery === "sent" || reply.delivery === "failed" ? reply.delivery : "unknown" };
}

/** Invites the client of a broker-started intake to finish and certify it: a one-use link to the firm's address, good for 14 days, emailed as "<Firm> via Nevermore" (D-1711, D-1712). */
export function inviteClient(input: { intakeId: string; email: string; name?: string }) {
  return callServer({ action: "invite", intake_id: input.intakeId, email: input.email, ...(input.name ? { name: input.name } : {}) });
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

const asDate = (v: unknown): Date | null => (typeof v === "string" ? new Date(v) : null);

/** Where an intake's invitation stands, for step 3: not invited, waiting, expired or accepted, with when they were invited and last opened the link. */
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

const ASK_AGAIN = "Ask your broker to send a new one.";

/** The words for a link that can't be opened or taken: why, and never anything about whether an email has an account. */
function inviteRefusal(error: DbError): string {
  const said = error.message ?? "";
  switch (error.code) {
    case "PT404": return `This invitation link isn't valid. ${ASK_AGAIN}`;
    case "PT410":
      if (/replaced/i.test(said)) return "This link was replaced by a newer one. Use the latest email your broker sent.";
      if (/expired/i.test(said)) return `This invitation has expired. ${ASK_AGAIN}`;
      if (/withdrawn/i.test(said)) return `This invitation was withdrawn. ${ASK_AGAIN}`;
      return "This invitation has already been used.";
    case "PT422": return "This invitation is for a different firm's address. Open the link from your email as it was sent.";
    case "PT403":
      if (/member of the firm/i.test(said)) return "A member of the firm can't take the client's place. The client opens this link with their own account.";
      return "This invitation was sent to a different email address than the one you are signed in with. Sign out, then sign in or create your account with the address it was sent to.";
    case "PT409": return "You already have an intake in progress. Finish it or start over from it, then open this link again.";
    case "42501": return "Sign in with a verified email address to open this invitation.";
    default: return "Couldn't open the invitation. Try again.";
  }
}

const hashOf = hashInvitationToken;

/** What the page behind an invitation link shows before the person signs in: the firm that invited them and who it is for. Opening it is recorded for the broker's step 3. */
export async function peekIntakeInvite(token: string, firmAddress: string): Promise<{ firmName: string; contactName: string | null }> {
  const { data, error } = await supabase.rpc("peek_intake_invite", { p_token_hash: await hashOf(token), p_firm_address: firmAddress });
  if (error) throw new Error(inviteRefusal(error));
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Couldn't open the invitation. Try again.");
  return { firmName: row.firm_name, contactName: row.contact_name ?? null };
}

/** Takes over the intake the link opens, as the signed-in person, at the firm address the link was opened at (D-1703, D-1711). It is given the token's hash, never the token. */
export async function acceptIntakeInvite(token: string, firmAddress: string): Promise<{ intakeId: string }> {
  const { data, error } = await supabase.rpc("accept_intake_invite", { p_token_hash: await hashOf(token), p_firm_address: firmAddress });
  if (error) throw new Error(inviteRefusal(error));
  const taken = data as { intake_id?: string } | null;
  if (!taken?.intake_id) throw new Error("Couldn't open the invitation. Try again.");
  return { intakeId: taken.intake_id };
}
