// What the browser checks before a file is uploaded: that its contents are the kind of file its name
// says (by its leading bytes, not the type the browser reports), and its SHA-256 so the same file isn't
// uploaded twice to one intake. These checks are for the prospect's benefit, a clear message before
// anything is sent: the document-upload function runs the same byte checks on what it receives
// (supabase/functions/_shared/fileSignature.ts, shared with this file) and stores nothing that fails them.

import { MAX_UPLOAD_BYTES, SNIFF_BYTES, sniffUpload } from "../../supabase/functions/_shared/fileSignature.ts";

export { MAX_UPLOAD_BYTES, sniffUpload };
export type { SniffResult } from "../../supabase/functions/_shared/fileSignature.ts";

/** Matches documents_limit_per_session in 20261029090000_document_ingestion.sql. */
export const MAX_DOCUMENTS_PER_INTAKE = 25;

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
  const sniff = sniffUpload(await readBytes(file.slice(0, SNIFF_BYTES)), file.name);
  if (!sniff.ok) return { ok: false, reason: "mismatch" };
  return { ok: true, contentType: sniff.contentType, sha256: await fileSha256(file) };
}
