// Sending the bundle to a PEO (M-2.1, slice 6.6): what the composer shows. The fixed block itself is written by the database (attach_peo_link), so the
// advisor can't edit it; this is its preview, line for line, with the parts only the database knows named in words.
import { PEO_SEND_NOTICE } from "@/data/legalWording";

/** "Reyes Bakery: EAA-2026-0042, version 3": the subject a send starts with, which the advisor may change. */
export const peoSendSubject = (companyName: string, fileId: string, version: number | null) =>
  `${companyName}: ${fileId}${version !== null ? `, version ${version}` : ""}`;

/** The fixed block under the advisor's note, as the PEO will read it. */
export function peoSendBlockPreview(p: { fileId: string; version: number | null; openItems: readonly string[] }): string[] {
  return [
    "The bundle: a link that opens it, made when you send",
    "The link stops working 30 days after it is sent.",
    `File ID ${p.fileId}, version ${p.version ?? "on record"}`,
    `Open items: ${p.openItems.length > 0 ? p.openItems.join("; ") : "none"}`,
    "Your name, your firm and your phone",
    PEO_SEND_NOTICE,
  ];
}

/** "Hello Dana,", "Hello Omar and Ruth,": the line each PEO's message opens with, over the advisor's one note (M-2.2), from its own people's first names. */
export function peoGreeting(names: readonly string[]): string {
  const first = names.map((n) => n.trim().split(/\s+/)[0]).filter(Boolean);
  const list = first.length <= 1 ? first.join("") : `${first.slice(0, -1).join(", ")} and ${first[first.length - 1]}`;
  return list ? `Hello ${list},` : "Hello,";
}
