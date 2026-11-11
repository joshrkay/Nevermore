import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import { workersCompApplication } from "@/data/workersCompApplication";
import { buildWorkersCompPdf } from "./workersCompPdf";

const readPdf = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).replace(/\x97/g, "—").replace(/\x85/g, "…"));
    reader.onerror = reject;
    reader.readAsBinaryString(blob);
  });

// Made up for the test: nobody real.
const app = (changedSince = false) => workersCompApplication({
  intake: {
    data: {
      ...EMPTY_CHAMBER_DATA, company_name: "Meridian Creative Group", states: ["CA"], wc_carrier: "Sample Mutual",
      census: [
        { id: "1", first_name: "Ana", last_name: "Sample", work_state: "CA", class_code: "8810", annual_salary: 85000, compensation_type: "salary", employment_type: "full_time", classification: "w2" },
        { id: "2", first_name: "Lee", last_name: "Sample", work_state: "CA", class_code: "8810", annual_salary: 41600, compensation_type: "hourly", employment_type: "part_time", classification: "w2" },
        { id: "3", first_name: "Kim", last_name: "Sample", work_state: "CA", class_code: "8810", annual_salary: 30000, compensation_type: "salary", employment_type: "full_time", classification: "1099" },
      ],
    },
    provenance: {},
    verified: new Set(),
  },
  fileId: "EAA-2026-0042",
  version: 3,
  changedSince,
});

describe("buildWorkersCompPdf: the workers' comp application data, our own layout", () => {
  it("prints the title, the version, that it is our own summary, every blank listed first, the sections in order and the rating table", async () => {
    const pdf = buildWorkersCompPdf(app(), { generatedOn: new Date(2026, 10, 13), compress: false });
    expect(pdf.filename).toBe("EAA-2026-0042-workers-comp-application-v3.pdf");
    const text = await readPdf(pdf.blob);
    expect(text).toContain("Workers' compensation application data");
    expect(text).toContain("Meridian Creative Group · EAA-2026-0042 · From certified version 3");
    expect(text).toContain("not the ACORD form, and it is not filled in on it.");
    const blanks = app().blanks.length;
    expect(text).toContain(`Left blank: ${blanks} items not in the certified answers`);
    expect(text).toContain("Applicant: FEIN");
    // Sections in the standard application's order, after the list of blanks.
    const at = (s: string) => text.indexOf(s);
    const order = ["Left blank:", "(Applicant)", "(Locations)", "(Owners and officers)", "(Rating by state)", "(Prior carriers and loss history)", "(Nature of business)", "(General questions)"];
    for (let i = 1; i < order.length; i++) expect(at(order[i])).toBeGreaterThan(at(order[i - 1]));
    expect(text).toContain("Not in the certified answers");
    expect(text).toContain("(Sample Mutual)");
    expect(text).toContain("$85,000 + $41,600 = $126,600, the pay the census states for 2 of 2.");
    expect(text).not.toContain("ACORD 130");
    expect(text).not.toContain("changed answers");
  });

  it("shows people the census marks 1099 in their own column, out of the payroll, and leaves rating them to the carrier", async () => {
    const text = await readPdf(buildWorkersCompPdf(app(), { compress: false }).blob);
    expect(text).toContain("(1099, not in payroll)");
    expect(text).toContain("(1 · $30,000)");
    // The employees' pay is theirs alone.
    expect(text).toContain("($126,600)");
    expect(text).toContain("must be rated is for the carrier.");
    // A contractor the census states no pay for.
    const unpaid = app();
    unpaid.ratingTable[0].rows[0] = { ...unpaid.ratingTable[0].rows[0], contractorPay: null };
    expect(await readPdf(buildWorkersCompPdf(unpaid, { compress: false }).blob)).toContain("(1 · no pay stated)");
  });

  it("says there is no rating table when the certified answers hold no census", async () => {
    const none = workersCompApplication({ intake: { data: { ...EMPTY_CHAMBER_DATA, company_name: "Meridian Creative Group" }, provenance: {}, verified: new Set() }, fileId: "EAA-2026-0042", version: 3, changedSince: false });
    const text = await readPdf(buildWorkersCompPdf(none, { compress: false }).blob);
    expect(text).toContain("(No rating table: there is no census in the certified answers.)");
    expect(text).not.toContain("1099, not in payroll");
  });

  it("runs onto more pages, numbering each, with every line inside the page and none cut at the foot", async () => {
    // Forty people in eight states: far more than one page holds.
    const states = ["AZ", "CA", "CO", "FL", "NY", "OR", "TX", "WA"];
    const census = Array.from({ length: 40 }, (_, i) => ({
      id: String(i), first_name: "Pat", last_name: `Sample ${i}`, work_state: states[i % 8], class_code: String(8810 + (i % 5)),
      annual_salary: 40000 + i, compensation_type: "salary" as const, employment_type: "full_time" as const, classification: "w2" as const,
    }));
    const long = workersCompApplication({ intake: { data: { ...EMPTY_CHAMBER_DATA, company_name: "Meridian Creative Group", census }, provenance: {}, verified: new Set() }, fileId: "EAA-2026-0042", version: 3, changedSince: false });
    const pdf = buildWorkersCompPdf(long, { compress: false });
    const text = await readPdf(pdf.blob);
    const n = pdf.pageCount;
    expect(n).toBeGreaterThan(2);
    for (let i = 1; i <= n; i++) expect(text).toContain(`(Page ${i} of ${n})`);
    expect(text).not.toContain(`(Page ${n + 1} of`);
    // The last state's rows reach the last pages whole.
    expect(text).toContain("(WA)");
    // Every line's baseline, in points from the foot of the page: the footer sits at the margin (18 mm), and everything
    // else between the body's top and bottom (28 mm from either edge of the 279.4 mm page).
    const mm = (pt: number) => (pt * 25.4) / 72;
    const baselines = [...text.matchAll(/([\d.]+) ([\d.]+) Td\n\((.*)\) Tj/g)].map((m) => ({ y: mm(Number(m[2])), line: m[3] }));
    expect(baselines.length).toBeGreaterThan(100);
    const footer = baselines.filter((b) => Math.abs(b.y - 18) < 0.01);
    expect(footer.length).toBe(n * 2);
    const outside = baselines.filter((b) => Math.abs(b.y - 18) >= 0.01 && (b.y < 28 || b.y > 279.4 - 28));
    expect(outside).toEqual([]);
  });

  it("says when the prospect has changed answers since certifying", async () => {
    const text = await readPdf(buildWorkersCompPdf(app(true), { compress: false }).blob);
    expect(text).toContain("The prospect has changed answers since certifying. These files are from version 3.");
  });
});
