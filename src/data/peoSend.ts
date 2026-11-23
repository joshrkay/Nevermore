// Sending the bundle to a PEO (M-2.1, slice 6.6): what the composer shows. The fixed block itself is written by the database (attach_peo_link), so the
// advisor can't edit it; this is its preview, line for line, with the parts only the database knows named in words.
import { PIPELINE_LABELS, type PipelineStatus } from "@/data/advisor";
import { CARRIER_SEND_NOTICE, PEO_SEND_NOTICE } from "@/data/legalWording";
import type { QuoteLine } from "@/data/lines";
import { canRecordSend } from "@/data/quoteRequests";

/** "Reyes Bakery: EAA-2026-0042, version 3": the subject a send starts with, which the advisor may change. */
export const peoSendSubject = (companyName: string, fileId: string, version: number | null) =>
  `${companyName}: ${fileId}${version !== null ? `, version ${version}` : ""}`;

/**
 * The fixed block under the advisor's note, as the PEO will read it. Its last line is the notice of the search's own line (ADR 0029), as the database writes
 * it: a carrier's on a workers' comp search, the PEO's otherwise.
 */
export function peoSendBlockPreview(p: { fileId: string; version: number | null; openItems: readonly string[]; line?: QuoteLine }): string[] {
  return [
    "The bundle: a link that opens it, made when you send",
    "The link stops working 30 days after it is sent.",
    `File ID ${p.fileId}, version ${p.version ?? "on record"}`,
    `Open items: ${p.openItems.length > 0 ? p.openItems.join("; ") : "none"}`,
    "Your name, your firm and your phone",
    p.line === "workers_comp" ? CARRIER_SEND_NOTICE : PEO_SEND_NOTICE,
  ];
}

/** "Hello Dana,", "Hello Omar and Ruth,": the line each PEO's message opens with, over the advisor's one note (M-2.2), from its own people's first names. */
export function peoGreeting(names: readonly string[]): string {
  const first = names.map((n) => n.trim().split(/\s+/)[0]).filter(Boolean);
  const list = first.length <= 1 ? first.join("") : `${first.slice(0, -1).join(", ")} and ${first[first.length - 1]}`;
  return list ? `Hello ${list},` : "Hello,";
}

/** The database's own words when a firm Nevermore hasn't approved sends (guard_firm_approved_to_send), so the page and the refusal say the same thing. */
export const FIRM_NOT_APPROVED_WORDS = "Your firm hasn't been approved to send to PEOs yet. Nevermore approves each firm before its first send; you can keep working on intakes meanwhile.";

/**
 * What stops a send, known before it is pressed (D-1910): the submission isn't yet Ready for market (the stages `canRecordSend` allows, which the database holds too), and the firm isn't approved.
 * `stage` undefined or `firmApproved` null mean "can't tell", which says nothing: the database still refuses what it should, and a page that can't read a fact never blocks on it.
 */
export function sendBlockers(stage: PipelineStatus | undefined, firmApproved: boolean | null): string[] {
  const words: string[] = [];
  if (stage !== undefined && !canRecordSend(stage)) words.push(`Move this submission to ${PIPELINE_LABELS.ready_for_market} first. It is ${PIPELINE_LABELS[stage]}.`);
  if (firmApproved === false) words.push(FIRM_NOT_APPROVED_WORDS);
  return words;
}

/** Under a PEO the opportunity was already sent to, in the choosing step (CRM-Q3.4, D-1891): when, and that a second send continues the same quote. */
export const alreadySentWords = (day: string): string => `Already sent on ${day}. Sending again continues its quote.`;

/** The PEOs a quote was sent to, by name, with the day sent (CRM-Q3.4): what the choosing step marks. */
export const sentToPeos = (quotes: readonly { peoName: string; sentOn: string | null }[]): Record<string, string> =>
  Object.fromEntries(quotes.flatMap((q) => (q.sentOn ? [[q.peoName, q.sentOn] as const] : [])));
