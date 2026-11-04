// What an uploaded document may be, judged by its bytes rather than the type a browser or client declares
// (E-4.1). The browser runs these checks before uploading, for a clear message (src/lib/uploadCheck.ts);
// the document-upload edge function runs them again on the bytes it receives, and stores nothing that
// fails, so a client that skips the browser can't get a renamed file stored. No imports, so it runs under
// Deno, Vite and Vitest alike.

/** The largest file the intake takes. The documents bucket refuses anything larger too. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** How much of the start of a file the checks read. */
export const SNIFF_BYTES = 4096;

/**
 * The type every document is stored and served as. A browser never shows application/octet-stream inline,
 * so a signed link downloads the file even if its download parameter is stripped; the type its bytes
 * showed is kept in documents.mime_type.
 */
export const STORED_CONTENT_TYPE = "application/octet-stream";

type Family = "pdf" | "office" | "legacy_office" | "text";

// Each extension the intake takes, the content it must start with, and the type it is recorded as.
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

// Programs, whatever they are named. Each would also fail its extension's check below; naming them lets the
// server log a renamed program as such.
const ELF = [0x7f, 0x45, 0x4c, 0x46];
const MACH_O = [
  [0xfe, 0xed, 0xfa, 0xce], [0xfe, 0xed, 0xfa, 0xcf], [0xce, 0xfa, 0xed, 0xfe], [0xcf, 0xfa, 0xed, 0xfe],
  [0xca, 0xfe, 0xba, 0xbe], // universal binary (and Java class file)
];
const MZ = [0x4d, 0x5a]; // Windows .exe, .dll, .scr
const SHEBANG = [0x23, 0x21]; // #! script

const startsWith = (bytes: Uint8Array, sig: number[]) => bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b);
const isText = (bytes: Uint8Array) => bytes.length > 0 && !bytes.includes(0);

/** Whether a file's first bytes are a program's: a Windows, Linux or macOS executable, or a script. */
export function looksExecutable(head: Uint8Array): boolean {
  if (startsWith(head, ELF) || startsWith(head, SHEBANG) || MACH_O.some((sig) => startsWith(head, sig))) return true;
  // A Windows executable's header holds zero bytes; a text file that happens to start "MZ" does not.
  return startsWith(head, MZ) && head.subarray(0, SNIFF_BYTES).includes(0);
}

export type SniffResult =
  | { ok: true; contentType: string }
  | { ok: false; reason: "unsupported" | "mismatch" | "executable" };

const extensionOf = (fileName: string) => {
  const dot = fileName.lastIndexOf(".");
  return dot < 0 ? "" : fileName.slice(dot + 1).toLowerCase();
};

/** Whether a file's first bytes match its extension, and the content type to record it as. */
export function sniffUpload(head: Uint8Array, fileName: string): SniffResult {
  if (looksExecutable(head)) return { ok: false, reason: "executable" };
  const ext = extensionOf(fileName);
  const expected = BY_EXTENSION[ext];
  if (!expected) return { ok: false, reason: "unsupported" };
  const matches =
    expected.family === "pdf" ? startsWith(head, PDF)
    : expected.family === "office" ? startsWith(head, ZIP) || startsWith(head, OLE)
    // Payroll systems often export tab-separated text named .xls; it's read like a CSV.
    : expected.family === "legacy_office" ? startsWith(head, OLE) || (ext === "xls" && isText(head))
    : isText(head);
  return matches ? { ok: true, contentType: expected.contentType } : { ok: false, reason: "mismatch" };
}

// Characters a file name never needs: control characters, and the bidirectional overrides that can make
// "invoice_fdp.exe" display as "invoice_exe.pdf".
// eslint-disable-next-line no-control-regex
const UNSAFE_NAME_CHARS = /[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g;
const MAX_NAME_LENGTH = 200;

/**
 * The name a document is recorded under: the last part of whatever path the client sent, without control or
 * direction-changing characters, at most 200 characters (keeping its extension), never empty.
 */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(UNSAFE_NAME_CHARS, "").replace(/\s+/g, " ").trim();
  if (!cleaned || /^\.+$/.test(cleaned)) return "document";
  if (cleaned.length <= MAX_NAME_LENGTH) return cleaned;
  const ext = extensionOf(cleaned);
  const keep = ext && ext.length < 10 ? `.${ext}` : "";
  return cleaned.slice(0, MAX_NAME_LENGTH - keep.length) + keep;
}

/**
 * The name a signed link asks the browser to save a file under (Content-Disposition: attachment): the
 * recorded name, cleaned as above, without quotes or backslashes either.
 */
export function downloadName(name: string): string {
  return cleanFileName(name).replace(/["\\]/g, "") || "document";
}

/** A file name as one storage key segment: letters, digits, '_', '.' and '-' only. */
export function storageKeyName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Lowercase hex SHA-256 of the bytes. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
