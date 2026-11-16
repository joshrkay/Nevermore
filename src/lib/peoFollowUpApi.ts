// Following up and withdrawing on a PEO's thread (M-2.4, slice 6.9; docs/BROKER_CRM_BUILD.md D-1620 to D-1629). A follow-up is a send's three steps
// (6.6): follow_up_peo records the message queued on the quote request's thread, a fresh bundle link is issued for the version already sent, and
// attach_peo_link joins it. A withdrawal is one call: it closes the quote request, revokes its link and queues the message, which carries no link.
import { supabase } from "@/integrations/supabase/client";
import { AdvisorApiError } from "@/lib/advisorApi";
import type { WithdrawalReason } from "@/data/peoFollowUp";
import type { PeoSend } from "@/lib/peoSendApi";

/** Work the queue now rather than at the next minute; a failure here only means the schedule sends it. */
const workQueue = () => void supabase.functions.invoke("send-mail", { body: {} }).catch(() => undefined);

export interface PeoFollowUp {
  quoteRequestId: number;
  to: string[];
  subject: string;
  note: string;
  /** Issues the fresh bundle link for the quote request (the PEO card's plan, the version already sent). */
  issueLink: PeoSend["issueLink"];
}

/** A follow-up's three steps; answers the message. A refusal is thrown in the database's own words. */
export async function followUpPeo(f: PeoFollowUp): Promise<{ quoteRequestId: number; messageId: number }> {
  const made = await supabase.rpc("follow_up_peo", { p_quote_request_id: f.quoteRequestId, p_to: f.to, p_subject: f.subject, p_note: f.note });
  if (made.error) throw new AdvisorApiError(made.error.message || "The follow-up didn't go through. Try again.", made.error.code);
  const { message_id: messageId } = made.data as unknown as { message_id: number };
  let link: { id: number; token: string };
  try {
    link = await f.issueLink(f.quoteRequestId);
  } catch (err) {
    console.error("Failed to issue the bundle link:", err);
    throw new AdvisorApiError("We couldn't make the bundle link, so nothing was sent. Try again.");
  }
  const joined = await supabase.rpc("attach_peo_link", { p_message_id: messageId, p_link_id: link.id, p_token: link.token });
  if (joined.error) throw new AdvisorApiError(joined.error.message || "The follow-up didn't go through. Try again.", joined.error.code);
  workQueue();
  return { quoteRequestId: f.quoteRequestId, messageId };
}

export interface PeoWithdrawal {
  quoteRequestId: number;
  to: string[];
  subject: string;
  note: string;
  reason: WithdrawalReason;
}

/** A withdrawal: closes the quote request, revokes its link and queues the message, in one call. */
export async function withdrawFromPeo(w: PeoWithdrawal): Promise<{ quoteRequestId: number; messageId: number }> {
  const made = await supabase.rpc("withdraw_from_peo", {
    p_quote_request_id: w.quoteRequestId, p_to: w.to, p_subject: w.subject, p_note: w.note, p_reason: w.reason,
  });
  if (made.error) throw new AdvisorApiError(made.error.message || "The withdrawal didn't go through. Try again.", made.error.code);
  workQueue();
  return { quoteRequestId: w.quoteRequestId, messageId: (made.data as unknown as { message_id: number }).message_id };
}

export interface ClosingWithdrawal {
  sessionId: string;
  status: "won" | "lost" | "archived";
  note: string;
  wonQuoteRequestId: number | null;
  subject: string;
  body: string;
}

/** Won, Lost or Archived with one withdrawal queued on each PEO still open, in one call: nothing moves if the withdrawal is refused. */
export async function closeSubmissionAndWithdraw(c: ClosingWithdrawal): Promise<{ messageIds: number[] }> {
  const made = await supabase.rpc("close_submission_and_withdraw", {
    p_session_id: c.sessionId, p_status: c.status, p_note: c.note, p_won_quote_request_id: c.wonQuoteRequestId, p_subject: c.subject, p_body: c.body,
  });
  if (made.error) throw new AdvisorApiError(made.error.message || "The status wasn't changed. Try again.", made.error.code);
  workQueue();
  return { messageIds: (made.data as unknown as { message_ids: number[] }).message_ids };
}
