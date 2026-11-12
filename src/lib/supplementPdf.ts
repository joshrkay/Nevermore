import jsPDF from "jspdf";
import { supplementFilename, type Supplement } from "@/data/peoSupplement";
import { PACKET_STYLE, pdfSafe } from "./manuscriptPdf";

export interface SupplementPdfOptions {
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

/**
 * A PEO's supplement as a short PDF in the packet's style (L-2.3): its own questions and the certified answers, which
 * version they are from, what wasn't answered, and what was answered to wording it no longer asks. For that PEO only.
 */
export function buildSupplementPdf(s: Supplement, opts: SupplementPdfOptions = {}): { blob: Blob; filename: string; pageCount: number } {
  const generatedOn = opts.generatedOn ?? new Date();
  const generated = generatedOn.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const version = s.version !== null ? `From certified version ${s.version}` : "From the certification on record";
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter", compress: opts.compress !== false });
  pdf.setProperties({ title: pdfSafe(`${s.title} — ${s.companyName} (${s.fileId})`), subject: pdfSafe(`${s.title}, ${version}`), author: "Nevermore", creator: "Nevermore" });

  let y = TOP;
  const ink = (c: RGB) => pdf.setTextColor(c[0], c[1], c[2]);
  const font = (style: "normal" | "bold" | "italic", size: number) => { pdf.setFont("helvetica", style); pdf.setFontSize(size); };
  const lh = (size: number) => size * 0.3528 * 1.35;
  const lines = (text: string, size: number, style: "normal" | "bold" | "italic", color: RGB, indent = 0) => {
    font(style, size);
    ink(color);
    for (const line of pdf.splitTextToSize(pdfSafe(text), CONTENT_W - indent) as string[]) {
      if (y + lh(size) > BOTTOM) { pdf.addPage(); y = TOP; }
      pdf.text(line, MARGIN + indent, y + lh(size) * 0.75);
      y += lh(size);
    }
  };
  const heading = (title: string) => {
    if (y + 20 > BOTTOM) { pdf.addPage(); y = TOP; }
    y += 4;
    pdf.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    pdf.setLineWidth(0.9);
    pdf.line(MARGIN, y, MARGIN, y + 6);
    font("bold", 12);
    ink(INK);
    pdf.text(pdfSafe(title), MARGIN + 3, y + 4.6);
    y += 10;
  };
  const qa = (question: string, answer: string | null) => {
    lines(question, 9.5, "bold", INK);
    lines(answer ?? "Not answered", 9.5, answer === null ? "italic" : "normal", answer === null ? WARN : INK, 3);
    y += 1.5;
    pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN, y, MARGIN + CONTENT_W, y);
    y += 3;
  };

  lines(s.title, 18, "bold", INK);
  y += 1;
  lines(`${s.companyName} · ${s.fileId} · ${version}`, 9, "normal", MUTED);
  lines(`For ${s.peo} only. These answers are not in the underwriting packet, and no other PEO receives them.`, 9, "normal", MUTED);
  y += 2;
  lines(s.notAnswered.length ? `Not answered: ${s.notAnswered.length} of ${s.rows.length}` : `All ${s.rows.length} answered`, 9, "bold", s.notAnswered.length ? WARN : INK);

  heading(`${s.peo}'s questions`);
  for (const r of s.rows) qa(r.question, r.answer);

  if (s.earlier.length) {
    heading("Answered to earlier wording");
    lines(`${s.peo} has since reworded or stopped asking these. Each answer is shown with the question as it was certified.`, 9, "normal", MUTED);
    y += 2;
    for (const r of s.earlier) qa(r.question, r.answer);
  }

  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    font("normal", 7.5);
    ink(MUTED);
    pdf.text(pdfSafe(`${s.title} · ${s.fileId} · generated ${generated}`), MARGIN, PAGE_H - MARGIN);
    pdf.text(`Page ${i} of ${pages}`, PAGE_W - MARGIN, PAGE_H - MARGIN, { align: "right" });
  }
  const blob = pdf.output("blob");
  return { blob: new Blob([blob], { type: "application/pdf" }), filename: supplementFilename(s), pageCount: pages };
}
