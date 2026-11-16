// Sending the bundle to a PEO from the submission page (M-2.1, slice 6.6; docs/BROKER_CRM_BUILD.md D-670 to D-679). Three steps, in order:
// send_to_peo records the message on the PEO's quote request (creating or continuing it, with the version sent) and queues it; the bundle link is
// issued for that quote request (issueBundleLink, 6.6b); attach_peo_link joins the link to the message, which only then lets send-mail send it
// through the advisor's own mailbox. The browser then asks send-mail to work the queue now; the minute schedule would anyway.
import { supabase } from "@/integrations/supabase/client";
import { AdvisorApiError } from "@/lib/advisorApi";

export interface PeoSendContext {
  mailbox: { connected: boolean; address: string | null };
  /** The people at the PEO with an email, from its profile in use. */
  contacts: { name: string; role: string | null; email: string }[];
  /** The quote request's reply address (its part before the @), when it has one yet. */
  reply_address: string | null;
}

/** What the composer reads: the advisor's mailbox, the PEO's contacts and the reply address. */
export async function loadPeoSendContext(sessionId: string, peo: string): Promise<PeoSendContext> {
  const { data, error } = await supabase.rpc("peo_send_context", { p_session_id: sessionId, p_peo: peo });
  if (error) throw new AdvisorApiError(error.message || "We couldn't load the PEO's contacts.");
  return data as unknown as PeoSendContext;
}

export interface PeoSend {
  sessionId: string;
  peo: string;
  to: string[];
  subject: string;
  note: string;
  /** Stores the made files and issues the bundle link for that quote request (issueBundleLink with the PEO card's plan). */
  issueLink: (quoteRequestId: number) => Promise<{ id: number; token: string }>;
}

/** The send's three steps; answers the quote request and the message. A refusal is thrown in the database's own words. */
export async function sendToPeo(s: PeoSend): Promise<{ quoteRequestId: number; messageId: number }> {
  const sent = await supabase.rpc("send_to_peo", { p_session_id: s.sessionId, p_peo: s.peo, p_to: s.to, p_subject: s.subject, p_note: s.note });
  if (sent.error) throw new AdvisorApiError(sent.error.message || "The send didn't go through. Try again.", sent.error.code);
  const { quote_request_id: quoteRequestId, message_id: messageId } = sent.data as unknown as { quote_request_id: number; message_id: number };
  let link: { id: number; token: string };
  try {
    link = await s.issueLink(quoteRequestId);
  } catch (err) {
    console.error("Failed to issue the bundle link:", err);
    throw new AdvisorApiError("We couldn't make the bundle link, so nothing was sent. Try again.");
  }
  const joined = await supabase.rpc("attach_peo_link", { p_message_id: messageId, p_link_id: link.id, p_token: link.token });
  if (joined.error) throw new AdvisorApiError(joined.error.message || "The send didn't go through. Try again.", joined.error.code);
  // Work the queue now rather than at the next minute; a failure here only means the schedule sends it.
  void supabase.functions.invoke("send-mail", { body: {} }).catch(() => undefined);
  return { quoteRequestId, messageId };
}
