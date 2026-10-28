import { inflateSync } from "node:zlib";

// jsPDF writes text as `(escaped string) Tj` inside deflated page streams, so the words are not in
// the file's raw bytes.
const TEXT_OPERATOR = /\(((?:\\[\s\S]|[^\\()])*)\)\s*Tj/g;
const STREAM = /<<([^<>]*)>>\s*stream\r?\n/g;

// WinAnsi bytes 0x80-0x9F; every other byte is the same character as in Latin-1. (Not TextDecoder:
// Node decodes "windows-1252" as Latin-1, which would leave an em dash as U+0097.)
const WIN_ANSI_80_9F = "\u20ac\x81\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\x8d\u017d\x8f\x90\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\x9d\u017e\u0178";

/** The PDF string escapes: \n \r \t \b \f, \ddd (octal), \( \) \\, and a backslash before anything else. */
function unescapeLiteral(literal: string): string {
  return literal.replace(/\\([nrtbf]|[0-7]{1,3}|[\s\S])/g, (_, escape: string) => {
    if (/^[0-7]+$/.test(escape)) return String.fromCharCode(parseInt(escape, 8));
    const control: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };
    return control[escape] ?? escape;
  });
}

/**
 * The text of a PDF made by jsPDF with its standard fonts, one string per line of text drawn, so a test
 * can search for what a reader would see. Non-ASCII characters arrive as WinAnsi (Windows-1252) bytes,
 * which are decoded back, so an em dash is an em dash.
 */
export function pdfText(pdf: Buffer): string {
  const raw = pdf.toString("latin1"); // one character per byte, so an index in the string is an index in the buffer
  const lines: string[] = [];

  for (const stream of raw.matchAll(STREAM)) {
    const dictionary = stream[1];
    if (!dictionary.includes("/FlateDecode")) continue;
    const length = Number(/\/Length\s+(\d+)/.exec(dictionary)?.[1]);
    if (!Number.isInteger(length)) throw new Error(`PDF stream without a direct /Length: ${dictionary.trim()}`);

    const start = stream.index + stream[0].length;
    const content = inflateSync(pdf.subarray(start, start + length)).toString("latin1");
    for (const operator of content.matchAll(TEXT_OPERATOR)) {
      lines.push(unescapeLiteral(operator[1]).replace(/[\x80-\x9f]/g, (byte) => WIN_ANSI_80_9F[byte.charCodeAt(0) - 0x80]));
    }
  }
  return lines.join("\n");
}
