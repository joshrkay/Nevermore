import { inflateSync } from "node:zlib";
// Reading a downloaded Blob back in a test, as the browser's FileReader gives it.
const read = <T,>(blob: Blob, as: "text" | "bytes" | "binary") =>
  new Promise<T>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve((as === "bytes" ? new Uint8Array(reader.result as ArrayBuffer) : reader.result) as T);
    if (as === "text") reader.readAsText(blob);
    else if (as === "bytes") reader.readAsArrayBuffer(blob);
    else reader.readAsBinaryString(blob);
  });

/** A Blob's text, read as UTF-8. */
export const blobText = (blob: Blob) => read<string>(blob, "text");

/** A Blob's bytes. */
export const blobBytes = (blob: Blob) => read<Uint8Array>(blob, "bytes");

/** A PDF's text as jsPDF writes it (WinAnsi), with its em dash and ellipsis turned back into the characters. */
export const pdfText = async (blob: Blob) =>
  (await read<string>(blob, "binary")).replace(/\x97/g, "—").replace(/\x85/g, "…");

/**
 * A PDF's text with every compressed (Flate) stream inflated, as jsPDF writes them when compressing: so a test can read
 * what a compressed PDF says, as a reader would show it.
 */
export function inflatedPdf(bytes: Uint8Array): string {
  // Byte for character (Latin-1 proper: TextDecoder's "latin1" is windows-1252, which moves 0x80 to 0x9F).
  const raw = Buffer.from(bytes).toString("latin1");
  return raw.replace(/stream\r?\n([\s\S]*?)\r?\nendstream/g, (whole, body: string) => {
    try {
      return `stream\n${inflateSync(Buffer.from(body, "latin1")).toString("latin1")}\nendstream`;
    } catch {
      return whole;
    }
  }).replace(/\x97/g, "—").replace(/\x85/g, "…");
}
