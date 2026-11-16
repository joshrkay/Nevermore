// Following up and withdrawing (M-2.4, slice 6.9): the default text each kind of message opens with. Kept in code, never in a store (a firm's own
// templates are P-3.2); the advisor edits it before sending. Plain words the advisor signs, not legal wording (D-12).
import { formatDay } from "@/data/quoteRequests";
export { WITHDRAWAL_REASONS, WITHDRAWAL_REASON_LABELS, type WithdrawalReason } from "@/data/quoteRequests";

/** "Re: Reyes Bakery: EAA-2026-0042, version 1": a message on the thread answers the subject it was sent under. */
export const replySubject = (subject: string | null, fallback: string) => {
  const s = (subject ?? "").trim() || fallback;
  return /^re:/i.test(s) ? s : `Re: ${s}`;
};

/** What a follow-up opens with: the submission, its File ID and version, when it went, and that a fresh link comes with it. */
export const followUpNote = (p: { companyName: string; fileId: string; version: number | null; sentOn: string | null }) =>
  `Hello,\n\nI'm following up on ${p.companyName} (File ID ${p.fileId}${p.version !== null ? `, version ${p.version}` : ""})` +
  `${p.sentOn ? `, which I sent you on ${formatDay(p.sentOn)}` : ""}. Do you have what you need to quote, or a question I can answer?\n\n` +
  "The link below opens the same bundle; it replaces the one I sent before.";

/** What a withdrawal opens with. It names no reason: the reason is for advisors only. */
export const withdrawalNote = (p: { companyName: string; fileId: string }) =>
  `Hello,\n\nPlease withdraw ${p.companyName} (File ID ${p.fileId}) from consideration; we won't need a quote. ` +
  "The bundle link I sent no longer works. Thank you for your time on it.";

/** What the one withdrawal offered with Won, Lost or Archived opens with: written once, sent on each open PEO's thread, so it names no PEO. */
export const closingWithdrawalNote = (p: { companyName: string }) =>
  `Hello,\n\nPlease withdraw ${p.companyName} from consideration; the employer has made their decision and we won't need a quote. ` +
  "The bundle link I sent no longer works. Thank you for your time on it.";

/** "TriNet", "TriNet and Insperity", "ADP, TriNet and Insperity". */
export const peoNames = (names: readonly string[]) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
