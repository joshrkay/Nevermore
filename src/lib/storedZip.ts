// A zip file written in the browser with no library: each file stored as it is, not compressed (PDFs and xlsx files
// are compressed already), with UTF-8 names and an optional comment, which unzip tools print above their listing.
// Enough for a submission bundle: under 4 GB and 65,535 files, so no Zip64.

export interface ZipEntry {
  /** Its path in the zip, folders split by "/". */
  name: string;
  data: Uint8Array;
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (data: Uint8Array) => {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** A zip comment's limit: its length is two bytes. */
const COMMENT_MAX = 0xffff;
/** General purpose flag bit 11: names (and the comment) are UTF-8. */
const UTF8 = 0x0800;

/** The zip's time and date fields, in local time, as unzip tools read them. */
const dosTime = (d: Date) => [
  (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
  ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
];

/** The files as one zip, in the order given, each stored. `modified` dates every file. */
export function storedZip(entries: readonly ZipEntry[], comment = "", modified = new Date()): Uint8Array {
  const enc = new TextEncoder();
  const [time, date] = dosTime(modified);
  let note = enc.encode(comment);
  if (note.length > COMMENT_MAX) {
    // Cut at a character's start, never inside one.
    let end = COMMENT_MAX;
    while ((note[end] & 0xc0) === 0x80) end--;
    note = note.subarray(0, end);
  }
  const files = entries.map((e) => ({ name: enc.encode(e.name), data: e.data, crc: crc32(e.data) }));
  const size = files.reduce((n, f) => n + 30 + f.name.length + f.data.length + 46 + f.name.length, 0) + 22 + note.length;
  const out = new Uint8Array(size);
  const v = new DataView(out.buffer);
  let at = 0;
  const u16 = (n: number) => { v.setUint16(at, n, true); at += 2; };
  const u32 = (n: number) => { v.setUint32(at, n, true); at += 4; };
  const bytes = (b: Uint8Array) => { out.set(b, at); at += b.length; };

  const offsets: number[] = [];
  for (const f of files) {
    offsets.push(at);
    u32(0x04034b50); u16(20); u16(UTF8); u16(0); u16(time); u16(date);
    u32(f.crc); u32(f.data.length); u32(f.data.length); u16(f.name.length); u16(0);
    bytes(f.name); bytes(f.data);
  }
  const central = at;
  files.forEach((f, i) => {
    u32(0x02014b50); u16(20); u16(20); u16(UTF8); u16(0); u16(time); u16(date);
    u32(f.crc); u32(f.data.length); u32(f.data.length); u16(f.name.length); u16(0); u16(0); u16(0); u16(0); u32(0);
    u32(offsets[i]); bytes(f.name);
  });
  const centralSize = at - central;
  u32(0x06054b50); u16(0); u16(0); u16(files.length); u16(files.length); u32(centralSize); u32(central); u16(note.length);
  bytes(note);
  return out;
}
