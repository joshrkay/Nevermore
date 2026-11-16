import { isOpenQuoteRequest, waitingLabel } from "@/data/quoteRequests";

// What a quote's page says in words (CRM-Q3.2). Worked out in the browser from what the page already read; nothing is stored.

/** Who the PEO's packet went to: the addresses of the message the product sent it (D-1620's thread). */
export function peoContactWords(
  messages: readonly { quote_request_id: number; direction: string; to_addresses: string[]; from_name: string | null; from_address: string; recorded_at: string }[],
  requestId: number,
): string {
  const ofRequest = messages.filter((m) => m.quote_request_id === requestId);
  const sent = ofRequest.find((m) => m.direction === "sent");
  if (sent) return sent.to_addresses.join(", ");
  const heard = ofRequest.filter((m) => m.direction === "received").sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0];
  return heard ? [heard.from_name, heard.from_address].filter(Boolean).join(", ") : "Not known";
}

/** "No reply yet · waiting 6 days": for a quote request still open (sent, acknowledged, question open) that has no email back from the PEO; null otherwise. */
export function noReplyWords(request: { status: string; sent_on: string | null }, hasReply: boolean, now?: Date): string | null {
  if (hasReply || !isOpenQuoteRequest(request.status) || !request.sent_on) return null;
  return `No reply yet · ${waitingLabel(request.sent_on, now).toLowerCase()}`;
}
