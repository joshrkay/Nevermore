// What the browser checks before a file is stored: that its contents are the kind of file its name
// says (by its leading bytes, not the type the browser reports), and its SHA-256 so the same file
// isn't stored twice in one intake. The server enforces the size and type again (the bucket's
// limits) and reads the bytes itself (document-extract), so these checks are for the prospect's
// benefit: a clear message before anything is uploaded.

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
/** Matches documents_limit_per_session in 20261029090000_document_ingestion.sql. */
export const MAX_DOCUMENTS_PER_INTAKE = 25;

type Family = "pdf" | "office" | "legacy_office" | "text";

// Each extension, the content it must start with, and the type it is stored as.
const BY_EXTENSION: Record<string, { family: Family; contentType: string }> = {
  pdf: { family: "pdf", contentType: "application/pdf" },
  xlsx: { family: "office", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  docx: { family: "office", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  xls: { family: "legacy_office", contentType: "application/vnd.ms-excel" },
  doc: { family: "legacy_office", contentType: "application/msword" },
  csv: { family: "text", contentType: "text/csv" },
};

const PDF = [0x25, 0x50, 0x44, 0x46]; // %PDF
const ZIP = [0x50, 0x4b, 0x03, 0x04]; // .xlsx and .docx are zip files
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // .xls, .doc, and password-protected .xlsx/.docx

const startsWith = (bytes: Uint8Array, sig: number[]) => sig.every((b, i) => bytes[i] === b);
const isText = (bytes: Uint8Array) => bytes.length > 0 && !bytes.includes(0);

export type SniffResult = { ok: true; contentType: string } | { ok: false };

/** Whether a file's first bytes match its extension, and the content type to store it as. */
export function sniffUpload(head: Uint8Array, fileName: string): SniffResult {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const expected = BY_EXTENSION[ext];
  if (!expected) return { ok: false };
  const matches =
    expected.family === "pdf" ? startsWith(head, PDF)
    : expected.family === "office" ? startsWith(head, ZIP) || startsWith(head, OLE)
    // Payroll systems often export tab-separated text named .xls; it's read like a CSV.
    : expected.family === "legacy_office" ? startsWith(head, OLE) || (ext === "xls" && isText(head))
    : isText(head);
  return matches ? { ok: true, contentType: expected.contentType } : { ok: false };
}

function readBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer().then((b) => new Uint8Array(b));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/** Lowercase hex SHA-256, or null where the browser offers no Web Crypto (an insecure origin). */
export async function fileSha256(blob: Blob): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await crypto.subtle.digest("SHA-256", await readBytes(blob));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type InspectedUpload =
  | { ok: true; contentType: string; sha256: string | null }
  | { ok: false; reason: "empty" | "mismatch" };

/** Checks a file before upload: not empty, and its contents match its name. */
export async function inspectUpload(file: File): Promise<InspectedUpload> {
  if (file.size === 0) return { ok: false, reason: "empty" };
  const sniff = sniffUpload(await readBytes(file.slice(0, 4096)), file.name);
  if (!sniff.ok) return { ok: false, reason: "mismatch" };
  return { ok: true, contentType: sniff.contentType, sha256: await fileSha256(file) };
}
