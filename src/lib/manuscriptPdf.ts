import jsPDF from "jspdf";
import { foldLatin, manuscriptFilename, maskDob, NOT_PROVIDED, type Manuscript } from "@/data/manuscript";

export interface ManuscriptPdfOptions {
  /** Show dates of birth in full. Off unless an authorized workflow turns it on. */
  revealSensitive?: boolean;
  /** Marks the packet as a sample built from fictional data. */
  sample?: boolean;
  /** When the PDF is generated; printed in the footer. Defaults to now. */
  generatedOn?: Date;
  /** Compress page streams. Tests turn this off so the text can be read back. */
  compress?: boolean;
}

export interface ManuscriptPdf {
  blob: Blob;
  filename: string;
  pageCount: number;
}

// US Letter, millimetres.
const PAGE_W = 215.9;
const PAGE_H = 279.4;
const MARGIN = 18;
const HEADER_H = 16; // band above the content on every page
const FOOTER_H = 14; // band below the content on every page
const TOP = MARGIN + HEADER_H;
const BOTTOM = PAGE_H - MARGIN - FOOTER_H;
const CONTENT_W = PAGE_W - MARGIN * 2;
const CELL_PAD_X = 1.8;
const CELL_PAD_Y = 1.6;

type RGB = [number, number, number];
const INK: RGB = [24, 26, 38];
const MUTED: RGB = [96, 100, 118];
const RULE: RGB = [208, 211, 222];
const ACCENT: RGB = [92, 64, 200];
const WARN: RGB = [168, 98, 0];
const HEAD_FILL: RGB = [240, 241, 247];

// jsPDF's built-in fonts only cover Latin-1 and a few Windows-1252 extras. Anything else would
// print as garbage, so fold accents to ASCII and replace what remains with "?".
const CP1252_EXTRAS = "•–—‘’“”…€™";
export function pdfSafe(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const code = ch.codePointAt(0)!;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || CP1252_EXTRAS.includes(ch)) {
      out += ch;
    } else if (ch === "\n") {
      out += "\n";
    } else {
      const base = foldLatin(ch).normalize("NFKD").replace(/[̀-ͯ]/g, "");
      out += /^[\x20-\x7e]+$/.test(base) ? base : "?";
    }
  }
  return out;
}

interface Column {
  header: string;
  width: number; // mm
  align?: "left" | "right";
  mono?: boolean;
}

/** Lays out the manuscript on US Letter pages with text that stays selectable and searchable. */
export function buildManuscriptPdf(m: Manuscript, opts: ManuscriptPdfOptions = {}): ManuscriptPdf {
  const reveal = opts.revealSensitive === true;
  const generated = (opts.generatedOn ?? new Date()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter", compress: opts.compress !== false });
  pdf.setProperties({
    title: pdfSafe(`The Manuscript — ${m.companyName} (${m.fileId})`),
    subject: pdfSafe(`Underwriting packet ${m.fileId}`),
    author: "Edgar Allan Advisory",
    creator: "Edgar Allan Advisory",
  });

  let y = TOP;

  const setInk = (c: RGB) => pdf.setTextColor(c[0], c[1], c[2]);
  const font = (style: "normal" | "bold" | "italic", size: number, family: "helvetica" | "courier" = "helvetica") => {
    pdf.setFont(family, style);
    pdf.setFontSize(size);
  };
  const lineHeight = (size: number) => size * 0.3528 * 1.35; // pt → mm, with leading
  const wrap = (text: string, width: number) => pdf.splitTextToSize(pdfSafe(text), width) as string[];
  const newPage = () => {
    pdf.addPage();
    y = TOP;
  };
  const ensure = (needed: number) => {
    if (y + needed > BOTTOM) newPage();
  };

  const paragraph = (text: string, size = 9, style: "normal" | "bold" | "italic" = "normal", color: RGB = INK, gap = 2) => {
    font(style, size);
    setInk(color);
    const lh = lineHeight(size);
    for (const line of wrap(text, CONTENT_W)) {
      ensure(lh);
      pdf.text(line, MARGIN, y + lh * 0.75);
      y += lh;
    }
    y += gap;
  };

  const sectionHeading = (title: string, keepWith = 28) => {
    ensure(12 + keepWith); // never leave a heading stranded at the foot of a page
    y += 4;
    pdf.setDrawColor(...ACCENT);
    pdf.setLineWidth(0.9);
    pdf.line(MARGIN, y, MARGIN, y + 6);
    font("bold", 12);
    setInk(INK);
    pdf.text(pdfSafe(title), MARGIN + 3, y + 4.6);
    y += 9;
  };

  const subheading = (text: string) => {
    ensure(12);
    font("bold", 8);
    setInk(MUTED);
    pdf.text(pdfSafe(text.toUpperCase()), MARGIN, y + 3);
    y += 6;
  };

  const TABLE_FONT = 8.5;
  const rowCells = (columns: Column[], row: string[]) => {
    font("normal", TABLE_FONT);
    return row.map((text, i) => wrap(text, columns[i].width - CELL_PAD_X * 2));
  };
  const tableHeight = (columns: Column[], rows: string[][]) =>
    rows.reduce((sum, row) => {
      const lines = Math.max(...rowCells(columns, row).map((c) => c.length));
      return sum + lines * lineHeight(TABLE_FONT) + CELL_PAD_Y * 2;
    }, 3);
  const paragraphHeight = (text: string, size: number, style: "normal" | "bold" | "italic", gap: number) => {
    font(style, size);
    return wrap(text, CONTENT_W).length * lineHeight(size) + gap;
  };

  /**
   * Draws a table whose rows stay on one page where they can, and whose header repeats on each new page and whose header repeats on each new page.
   * Cell text wraps inside its column, so nothing is clipped or overlaps its neighbour. A row taller than a page continues onto the next one.
   */
  const table = (columns: Column[], rows: string[][], opts: { header?: boolean; flagged?: Set<number> } = {}) => {
    const showHeader = opts.header !== false;
    const size = TABLE_FONT;
    const lh = lineHeight(size);

    const drawHeader = () => {
      font("bold", size);
      const h = lh + CELL_PAD_Y * 2;
      ensure(h);
      pdf.setFillColor(...HEAD_FILL);
      pdf.rect(MARGIN, y, CONTENT_W, h, "F");
      setInk(MUTED);
      let x = MARGIN;
      for (const col of columns) {
        const tx = col.align === "right" ? x + col.width - CELL_PAD_X : x + CELL_PAD_X;
        pdf.text(pdfSafe(col.header), tx, y + CELL_PAD_Y + lh * 0.75, { align: col.align === "right" ? "right" : "left" });
        x += col.width;
      }
      y += h;
    };

    if (showHeader) {
      // Keep the header with at least the first row.
      ensure(lh * 2 + CELL_PAD_Y * 4);
      drawHeader();
    }

    const rule = () => {
      pdf.setDrawColor(...RULE);
      pdf.setLineWidth(0.15);
      pdf.line(MARGIN, y, MARGIN + CONTENT_W, y);
    };
    const drawRow = (cells: string[][], flagged: boolean) => {
      const h = Math.max(...cells.map((c) => c.length)) * lh + CELL_PAD_Y * 2;
      if (flagged) {
        pdf.setFillColor(255, 247, 230);
        pdf.rect(MARGIN, y, CONTENT_W, h, "F");
      }
      let x = MARGIN;
      cells.forEach((cellLines, i) => {
        const col = columns[i];
        font("normal", size, col.mono ? "courier" : "helvetica");
        setInk(INK);
        const tx = col.align === "right" ? x + col.width - CELL_PAD_X : x + CELL_PAD_X;
        cellLines.forEach((line, li) => {
          pdf.text(line, tx, y + CELL_PAD_Y + lh * 0.75 + li * lh, { align: col.align === "right" ? "right" : "left" });
        });
        x += col.width;
      });
      y += h;
      rule();
    };
    const headerH = showHeader ? lh + CELL_PAD_Y * 2 : 0;
    const pageLines = Math.floor((BOTTOM - TOP - headerH - CELL_PAD_Y * 2) / lh);
    const nextPage = () => {
      newPage();
      if (showHeader) drawHeader();
    };

    rows.forEach((row, rowIndex) => {
      const flagged = opts.flagged?.has(rowIndex) === true;
      let cells = rowCells(columns, row);
      for (;;) {
        const lines = Math.max(...cells.map((c) => c.length));
        const room = Math.floor((BOTTOM - y - CELL_PAD_Y * 2) / lh);
        if (lines <= room) {
          drawRow(cells, flagged);
          break;
        }
        if (lines <= pageLines || room < 1) {
          // Fits on a page of its own (or not even one line fits here): start a fresh page.
          nextPage();
          continue;
        }
        // Taller than a whole page: continue it over as many pages as it needs rather than clip it.
        drawRow(cells.map((c) => c.slice(0, room)), flagged);
        cells = cells.map((c) => c.slice(room));
        nextPage();
      }
    });
    y += 3;
  };

  const keyValues = (rows: [string, string][]) =>
    table(
      [
        { header: "", width: 58 },
        { header: "", width: CONTENT_W - 58 },
      ],
      rows,
      { header: false },
    );

  // ---------- Title block ----------
  font("bold", 22);
  setInk(INK);
  pdf.text("THE MANUSCRIPT", MARGIN, y + 7);
  y += 11;
  font("normal", 9);
  setInk(MUTED);
  pdf.text(pdfSafe(`Edgar Allan Advisory · ${opts.sample ? "Sample" : "Certified"} Submission`), MARGIN, y + 3);
  y += 9;

  if (opts.sample) {
    paragraph("This is a sample manuscript built from fictional data.", 9, "bold", WARN, 3);
  }

  keyValues([
    ...(m.submittedTo ? ([["Submitted To", `${m.submittedTo} — Underwriting`]] as [string, string][]) : []),
    ["Prepared By", "Edgar Allan Advisory · Lenore"],
    [m.signer ? "Certified" : "Date", m.date],
    ["Generated", generated],
    ["File ID", m.fileId],
    ["Prospect", m.companyName],
    ["Sensitive Fields", reveal ? "Shown in full" : "Masked (dates of birth show year only)"],
  ]);

  // ---------- 1 Company ----------
  sectionHeading("1 — Company Profile");
  keyValues(m.companyRows);

  // ---------- 2 Workforce ----------
  sectionHeading("2 — Workforce Summary");
  keyValues(m.workforceRows);
  subheading("State breakdown");
  if (m.states.length === 0) {
    paragraph("No states captured yet.", 9, "normal", MUTED);
  } else {
    table(
      [
        { header: "State", width: 30 },
        { header: "Employees", width: 40 },
        { header: "W/C System", width: CONTENT_W - 70 },
      ],
      m.states.map((s) => [s.state, s.count, s.system]),
    );
  }

  // ---------- 3 Census ----------
  sectionHeading("3 — Employee Census");
  if (m.census.length === 0) {
    paragraph("No employee census captured yet.", 9, "normal", MUTED);
  } else {
    const columns: Column[] = [
      { header: "#", width: 8 },
      { header: "Name", width: 34 },
      { header: "DOB", width: 21, mono: true },
      { header: "St", width: 10 },
      { header: "Title", width: 29 },
      { header: "Salary", width: 21, align: "right" },
      { header: "Type", width: 11 },
      { header: "Coverage Tier", width: 25 },
      { header: "Note", width: CONTENT_W - 159 },
    ];
    const notes: string[] = [];
    const flagged = new Set<number>();
    const rows = m.census.map((e, i) => {
      let noteRef = "—";
      if (e.flag) {
        notes.push(`${i + 1}. ${e.name}: ${e.flag}`);
        flagged.add(i);
        noteRef = `See ${notes.length}`;
      }
      const dob = !reveal && e.dob !== NOT_PROVIDED ? maskDob(e.dob) : e.dob;
      return [String(i + 1), e.name, dob, e.state, e.title, e.salary, e.classification, e.tier, noteRef];
    });
    table(columns, rows, { flagged });
    if (notes.length > 0) {
      subheading("Census notes");
      notes.forEach((n) => paragraph(n, 8.5, "normal", WARN, 1));
    }
  }

  // ---------- 4 Dependents ----------
  sectionHeading("4 — Dependent Summary");
  table(
    [
      { header: "Tier", width: CONTENT_W - 70 },
      { header: "Employees", width: 40, align: "right" },
      { header: "%", width: 30, align: "right" },
    ],
    [
      ...m.dependentTiers.map((t) => [t.tier, String(t.count), t.pct]),
      ["Total Dependents", String(m.totalDependents), ""],
    ],
  );
  paragraph("Dependent figures are self-reported. Actual election rates may vary at open enrollment.", 8.5, "italic", MUTED);

  // ---------- 5 Benefits ----------
  sectionHeading("5 — Current Benefits");
  keyValues(m.benefitsRows);

  // ---------- 6 Readiness ----------
  sectionHeading("6 — Underwriting Readiness");
  subheading("Confirmed");
  if (m.resolved.length === 0) paragraph("Nothing confirmed yet.", 9, "normal", MUTED);
  m.resolved.forEach((item) => paragraph(`•  ${item}`, 9, "normal", INK, 1));
  if (m.open.length > 0) {
    y += 2;
    subheading("Open items");
    m.open.forEach((item) => paragraph(`•  ${item}`, 9, "normal", WARN, 1));
  }

  // ---------- 7 Certification ----------
  // Kept together on one page: a signature block split across pages isn't a signature block.
  const CERT_COLUMNS: Column[] = [
    { header: "", width: 58 },
    { header: "", width: CONTENT_W - 58 },
  ];
  const certIntro = `Authorized representative of ${m.companyName} has reviewed and confirmed accuracy of this submission through Edgar Allan Advisory's intake process.`;
  const certRows: [string, string][] = [
    ["Name", m.signer?.name || "[Full Name]"],
    ["Role", m.signer?.title || "[Role]"],
    ["Company", m.companyName],
    ["Signed", m.signer?.signedAtFull ?? "—"],
    ["File ID", m.fileId],
  ];
  const consentText = m.signer?.consent.replace(/\n+/g, " ") ?? "";
  const signedLine = m.signer
    ? `Signed electronically by ${m.signer.name} on ${m.signer.signedAtFull}.`
    : "Signed: ________________________      Date: _______________";
  const dataNote =
    "Data note: Information collected here constitutes employer HR records, not Protected Health Information under HIPAA. PHI protections apply upon enrollment submission to a health plan carrier.";
  const certHeight =
    4 + 6 + 9 + // rule, gap, heading
    paragraphHeight(certIntro, 9, "normal", 3) +
    tableHeight(CERT_COLUMNS, certRows) +
    (m.signer ? 6 + paragraphHeight(consentText, 9, "italic", 3) : 0) +
    paragraphHeight(signedLine, 9, "normal", 3) +
    paragraphHeight(dataNote, 8, "normal", 0);
  ensure(certHeight);
  y += 4;
  pdf.setDrawColor(...ACCENT);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN, y, MARGIN + CONTENT_W, y);
  y += 6;
  font("bold", 12);
  setInk(INK);
  pdf.text("7 — Submission Certification", MARGIN, y + 3);
  y += 9;
  paragraph(certIntro, 9, "normal", MUTED, 3);
  table(CERT_COLUMNS, certRows, { header: false });
  if (m.signer) {
    subheading("Consent");
    paragraph(consentText, 9, "italic", INK, 3);
  }
  paragraph(signedLine, 9, "normal", MUTED, 3);
  paragraph(dataNote, 8, "normal", MUTED);

  // ---------- Running header and footer ----------
  const pageCount = pdf.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);
    font("bold", 8);
    setInk(MUTED);
    pdf.text("THE MANUSCRIPT", MARGIN, MARGIN + 4);
    font("normal", 8);
    pdf.text(pdfSafe(`File ID ${m.fileId}`), PAGE_W - MARGIN, MARGIN + 4, { align: "right" });
    pdf.setDrawColor(...RULE);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN, MARGIN + 7, PAGE_W - MARGIN, MARGIN + 7);

    const footY = PAGE_H - MARGIN;
    pdf.line(MARGIN, footY - 6, PAGE_W - MARGIN, footY - 6);
    font("normal", 7.5);
    const left = pdfSafe(`Edgar Allan Advisory · ${m.fileId} · ${m.companyName} · Generated ${generated}`);
    const right = `Page ${p} of ${pageCount}`;
    const rightW = pdf.getTextWidth(right);
    const room = CONTENT_W - rightW - 6;
    let leftText = left;
    // Shorten with an ellipsis rather than letting a long company name run into the page number.
    while (leftText.length > 1 && pdf.getTextWidth(leftText) > room) leftText = leftText.slice(0, -2).trimEnd() + "…";
    pdf.text(leftText, MARGIN, footY - 1.5);
    pdf.text(right, PAGE_W - MARGIN, footY - 1.5, { align: "right" });
  }

  return {
    blob: pdf.output("blob"),
    filename: manuscriptFilename(m.fileId, m.companyName === "[Company name not provided]" ? null : m.companyName),
    pageCount,
  };
}
