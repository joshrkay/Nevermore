// What a zip file (an .xlsx is one) says it holds, read from its central directory alone: each part's name and the
// size it declares unpacked. Nothing is unpacked, so a file built to unpack to gigabytes (a zip bomb) is caught by
// what it declares before anything reads it. A file that lies about its sizes is still bounded where it is read.
// Used by census-template-upload and, in the browser, by src/lib/censusWorkbook.ts before a PEO template workbook
// is loaded. No imports, so it runs under Deno, Vitest and Vite alike.

/** The most a PEO template workbook may unpack to: a census form is a few megabytes at most. */
export const MAX_UNPACKED_BYTES = 100 * 1024 * 1024;

export interface ZipEntry {
  name: string;
  /** The size it declares unpacked. One of 4 GB or more says 0xFFFFFFFF (its real size is in a zip64 field), far over any limit. */
  size: number;
}

/** The parts a zip file declares, in order; null when it isn't a zip that can be read this way. */
export function zipEntries(bytes: Uint8Array): ZipEntry[] | null {
  if (bytes.length < 22) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end of central directory record: 22 bytes, then a comment of up to 64 KiB.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const entries: ZipEntry[] = [];
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) return null;
    const declared = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extra = view.getUint16(at + 30, true);
    const comment = view.getUint16(at + 32, true);
    if (at + 46 + nameLength > bytes.length) return null;
    entries.push({ name: decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength)), size: declared });
    at += 46 + nameLength + extra + comment;
  }
  return entries;
}

/** Whether a zip's parts declare more than `limit` bytes unpacked, all together. */
export const unpacksTooLarge = (entries: readonly ZipEntry[], limit = MAX_UNPACKED_BYTES) =>
  entries.reduce((sum, e) => sum + e.size, 0) > limit;
