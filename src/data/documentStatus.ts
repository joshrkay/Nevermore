// Processing states for an uploaded document and what to tell the prospect about each.
// A document that can't be read is still kept for the advisor; nothing here blocks the intake.

export type DocumentStatus =
  | "uploading"
  | "uploaded"
  | "processing"
  | "extracted"
  | "no_data"
  | "unsupported"
  | "encrypted"
  | "unreadable"
  | "too_large"
  | "failed";

export type StatusTone = "busy" | "ok" | "warn";

const STATUS: Record<DocumentStatus, { label: string; message: string; tone: StatusTone }> = {
  uploading: { label: "Uploading…", message: "", tone: "busy" },
  uploaded: { label: "Uploaded", message: "Saved with this intake.", tone: "ok" },
  processing: { label: "Reading…", message: "Lenore is reading this file.", tone: "busy" },
  extracted: { label: "Read", message: "Review what Lenore found below before it's added to your intake.", tone: "ok" },
  no_data: {
    label: "Saved",
    message: "Nothing Lenore could fill in automatically, but your advisor will see it.",
    tone: "ok",
  },
  unsupported: {
    label: "Saved, not read",
    message: "Lenore can read PDF, Word (.docx), Excel, and CSV files. This one is saved for your advisor.",
    tone: "warn",
  },
  encrypted: {
    label: "Password-protected",
    message: "This file is password-protected. Remove the password and upload it again, or keep it here for your advisor.",
    tone: "warn",
  },
  unreadable: {
    label: "Couldn't read",
    message: "This looks like a scan or image, so there's no text to read. It's saved for your advisor.",
    tone: "warn",
  },
  too_large: {
    label: "Too large to read",
    message: "Lenore reads files up to 10 MB and 50 pages. This one is saved for your advisor.",
    tone: "warn",
  },
  failed: {
    label: "Couldn't read",
    message: "Something went wrong reading this file. It's saved, and you can try again.",
    tone: "warn",
  },
};

export function documentStatusInfo(status: string) {
  return STATUS[status as DocumentStatus] ?? STATUS.uploaded;
}

/** Statuses worth offering a "Try again" for. */
export function canRetryExtraction(status: string): boolean {
  return status === "failed" || status === "uploaded";
}

// ---------- The malware scan ----------
// Every upload is scanned before anyone can open it (20261104130000_document_scanning.sql). Until it passes,
// Lenore can't read it and the advisor can't open it; the prospect can still remove it or change its category.

export type ScanVerdict = "pending" | "clean" | "skipped" | "infected" | "failed";

/** Whether a file can be read: its scan passed, or the deployment runs without a scanner. */
export const isScanReleased = (verdict: string | null | undefined) => verdict === "clean" || verdict === "skipped";

const SCAN: Record<"pending" | "infected" | "failed", { label: string; message: string; tone: StatusTone }> = {
  pending: {
    label: "Checking for viruses",
    message: "Every file is checked before anyone can open it. Lenore reads it as soon as that's done.",
    tone: "busy",
  },
  infected: {
    label: "Blocked",
    message: "Our virus check flagged this file, so it's set aside and nobody can open it. Remove it, and upload a clean copy if you have one.",
    tone: "warn",
  },
  failed: {
    label: "Couldn't be checked",
    message: "We couldn't finish checking this file for viruses, so nobody can open it yet. Our team has been told; you can also remove it and upload it again.",
    tone: "warn",
  },
};

/** What to tell the prospect while a file's scan hasn't passed; null once it has. */
export function scanStatusInfo(verdict: string | null | undefined) {
  if (isScanReleased(verdict)) return null;
  return SCAN[verdict as keyof typeof SCAN] ?? SCAN.pending;
}

/** Why a file can't be opened yet (or ever), from its malware scan; null when it can. */
export function advisorScanNotice(verdict: string | undefined): string | null {
  // A certified copy whose live row is gone has no verdict here; storage decides.
  if (verdict === undefined || isScanReleased(verdict)) return null;
  if (verdict === "infected") return "Quarantined: the virus scan flagged this file. Nobody can open it; Operations has been alerted.";
  if (verdict === "failed") return "Not openable: the virus scan couldn't finish. Operations has been alerted.";
  return "Being checked for viruses. It can be opened once the check passes.";
}

// ---------- Announcements ----------

/** The state a file shows in the Upload tab: its virus check until that passes (not while it uploads), then its processing. */
export function shownDocumentStatus(status: string, verdict: string | null | undefined) {
  const scan = status === "uploading" ? null : scanStatusInfo(verdict);
  return { scan, status: scan ?? documentStatusInfo(status) };
}

/**
 * What a screen reader should hear about files whose state changed (I-2.2): a line for each file that is new
 * since `before`, or whose shown label changed, like "Payroll.xlsx: Reading…". `labels` is what to pass as
 * `before` next time. A file that went away is not mentioned: the prospect removed it.
 */
export function documentStatusChanges(
  before: ReadonlyMap<string, string>,
  docs: readonly { id: string; file_name: string; status: string; scan_verdict?: string | null }[],
): { labels: Map<string, string>; lines: string[] } {
  const labels = new Map<string, string>();
  const lines: string[] = [];
  for (const doc of docs) {
    const { label } = shownDocumentStatus(doc.status, doc.scan_verdict).status;
    labels.set(doc.id, label);
    if (before.get(doc.id) !== label) lines.push(`${doc.file_name}: ${label}`);
  }
  return { labels, lines };
}
