import jsPDF from "jspdf";
import { money, NOT_IN_CERTIFIED, workersCompFilename, type RatingRow, type WorkersCompApplication } from "@/data/workersCompApplication";
import { PACKET_STYLE, pdfSafe } from "./manuscriptPdf";

export interface WorkersCompPdfOptions {
  /** When the PDF is generated; printed in the footer. Defaults to now. */
  generatedOn?: Date;
  /** Compress page streams. Tests turn this off so the text can be read back. */
  compress?: boolean;
}

const { INK, MUTED, RULE, ACCENT, WARN, PAGE_W, PAGE_H, MARGIN } = PACKET_STYLE;
const CONTENT_W = PAGE_W - MARGIN * 2;
const TOP = MARGIN + 10;
const BOTTOM = PAGE_H - MARGIN - 10;
type RGB = readonly [number, number, number];

/** The rating table's columns: heading, where it sits from the left margin (mm), and how it lines up. */
const COLUMNS: readonly [string, number, "left" | "right"][] = [
  ["Class code", 0, "left"],
  ["Employees", 45, "right"],
  ["Full time", 64, "right"],
  ["Part time", 83, "right"],
  ["Not stated", 103, "right"],
  ["Annual pay", 140, "right"],
  ["1099, not in payroll", CONTENT_W, "right"],
];

/** The 1099 column's cell: how many, and the pay the census states for them. */
const contractorsCell = (r: RatingRow) => (r.contractors === 0 ? "None" : `${r.contractors} · ${r.contractorPay === null ? "no pay stated" : money(r.contractorPay)}`);

/**
 * The workers' comp application data as a PDF in the packet's style (L-3.2): a thin renderer of
 * workersCompApplication's document, which decides every word. Our own layout, in the standard application's order;
 * never the ACORD form. The blanks are counted and listed first, so nothing is found missing afterwards.
 */
export function buildWorkersCompPdf(a: WorkersCompApplication, opts: WorkersCompPdfOptions = {}): { blob: Blob; filename: string; pageCount: number } {
  const generatedOn = opts.generatedOn ?? new Date();
  const generated = generatedOn.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter", compress: opts.compress !== false });
  pdf.setProperties({ title: pdfSafe(`${a.title}, ${a.companyName} (${a.fileId})`), subject: pdfSafe(`${a.title}, ${a.fromVersion}`), author: "Nevermore", creator: "Nevermore" });

  let y = TOP;
  const ink = (c: RGB) => pdf.setTextColor(c[0], c[1], c[2]);
  const font = (style: "normal" | "bold" | "italic", size: number) => { pdf.setFont("helvetica", style); pdf.setFontSize(size); };
  const lh = (size: number) => size * 0.3528 * 1.35;
  const spaceFor = (needed: number) => { if (y + needed > BOTTOM) { pdf.addPage(); y = TOP; } };
  const lines = (text: string, size: number, style: "normal" | "bold" | "italic", color: RGB, indent = 0) => {
    font(style, size);
    ink(color);
    for (const line of pdf.splitTextToSize(pdfSafe(text), CONTENT_W - indent) as string[]) {
      spaceFor(lh(size));
      pdf.text(line, MARGIN + indent, y + lh(size) * 0.75);
      y += lh(size);
    }
  };
  const divider = () => {
    pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN, y, MARGIN + CONTENT_W, y);
  };
  const heading = (title: string) => {
    spaceFor(20);
    y += 4;
    pdf.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    pdf.setLineWidth(0.9);
    pdf.line(MARGIN, y, MARGIN, y + 6);
    font("bold", 12);
    ink(INK);
    pdf.text(pdfSafe(title), MARGIN + 3, y + 4.6);
    y += 10;
  };
  const table = (rows: readonly RatingRow[]) => {
    spaceFor(lh(8.5) * 3);
    font("bold", 8.5);
    ink(MUTED);
    for (const [label, x, align] of COLUMNS) pdf.text(label, MARGIN + x, y + lh(8.5) * 0.75, { align });
    y += lh(8.5) + 1;
    for (const r of rows) {
      spaceFor(lh(9) + lh(8) * 2);
      font("normal", 9);
      ink(INK);
      const cells = [r.classCode ?? "None given", String(r.employees), String(r.fullTime), String(r.partTime), String(r.hoursNotStated), r.pay === null ? "None stated" : money(r.pay), contractorsCell(r)];
      cells.forEach((c, i) => pdf.text(pdfSafe(c), MARGIN + COLUMNS[i][1], y + lh(9) * 0.75, { align: COLUMNS[i][2] }));
      y += lh(9);
      lines(r.basis, 8, "italic", MUTED, 2);
      y += 1;
      divider();
      y += 1.5;
    }
  };

  // What it is, which version, and that it is ours.
  lines(a.title, 18, "bold", INK);
  y += 1;
  lines(`${a.companyName} · ${a.fileId} · ${a.fromVersion}`, 9, "normal", MUTED);
  if (a.changedNotice) lines(a.changedNotice, 9, "bold", WARN);
  lines(a.ourOwn, 9, "normal", MUTED);
  y += 2;

  // Every blank, before anything else.
  lines(`Left blank: ${a.blanks.length} items not in the certified answers`, 10, "bold", a.blanks.length ? WARN : INK);
  lines(a.intakeGaps, 9, "normal", MUTED);
  y += 1;
  for (const b of a.blanks) lines(`• ${b}`, 8.5, "normal", INK, 2);

  for (const s of a.sections) {
    heading(s.title);
    for (const e of s.entries) {
      lines(e.label, 9.5, "bold", INK);
      lines(e.value ?? `${NOT_IN_CERTIFIED}${e.note ? ` (${e.note})` : ""}`, 9.5, e.value === null ? "italic" : "normal", e.value === null ? WARN : INK, 3);
      y += 1;
      divider();
      y += 2.5;
    }
    if (s.title === "Rating by state") {
      if (a.ratingTable.length === 0) lines("No rating table: there is no census in the certified answers.", 9, "italic", WARN);
      for (const st of a.ratingTable) {
        spaceFor(20);
        lines(st.state ?? "No work state given", 10.5, "bold", INK);
        table(st.rows);
        y += 2;
      }
      if (a.ratingTable.length > 0) {
        lines("Each row counts the people in the certified census with that work state and class code. Full or part time is counted only where the census states it, and pay is summed only where it states an amount; each row says how.", 8, "normal", MUTED);
      }
      if (a.contractorsNote) lines(a.contractorsNote, 8, "bold", INK);
    }
  }

  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    font("normal", 7.5);
    ink(MUTED);
    pdf.text(pdfSafe(`${a.title} · ${a.fileId} · generated ${generated}`), MARGIN, PAGE_H - MARGIN);
    pdf.text(`Page ${i} of ${pages}`, PAGE_W - MARGIN, PAGE_H - MARGIN, { align: "right" });
  }
  const blob = pdf.output("blob");
  return { blob: new Blob([blob], { type: "application/pdf" }), filename: workersCompFilename(a), pageCount: pages };
}
