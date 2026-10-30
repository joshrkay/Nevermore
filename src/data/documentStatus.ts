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
