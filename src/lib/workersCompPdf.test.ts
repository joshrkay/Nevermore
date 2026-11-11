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

  it("says when the prospect has changed answers since certifying", async () => {
    const text = await readPdf(buildWorkersCompPdf(app(true), { compress: false }).blob);
    expect(text).toContain("The prospect has changed answers since certifying. These files are from version 3.");
  });
});
