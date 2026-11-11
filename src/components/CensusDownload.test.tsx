import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ExcelJS from "exceljs";
import type { CensusEmployee } from "@/data/census";
import type { PeoCensusLayout } from "@/data/censusExport";
import type { PeoRecord } from "@/data/peoCatalog";

const downloadBlob = vi.fn();
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: (...a: unknown[]) => downloadBlob(...a) }));
// Templates are read through readTemplate here; nothing else reaches the database.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const { default: CensusDownload } = await import("./CensusDownload");

const census: CensusEmployee[] = [{ id: "1", first_name: "Sarah", last_name: "Chen", work_state: "CA", compensation_type: "salary" as const, employment_type: "full_time" as const, classification: "w2" as const }];
// Made up for the test: no real PEO's layout is held.
const COLUMNS: PeoCensusLayout["columns"] = [
  { header: "Last Name", from: "last_name" },
  { header: "Hire Date", from: null },
  { header: "Gender", from: null },
];
const peo = (name: string, layout: PeoCensusLayout | null, id = 5): PeoRecord => ({ id, name, listed: true, lastVerified: null, profile: {
  version: 2, neededToQuote: [], neededBeforeSigning: [], censusLayout: layout, documents: [], extraQuestions: [], sources: {}, publishedAt: null,
  rules: { minHeadcount: null, statesServed: null, excludedIndustries: null, excludedClassCodes: null, minEnrolmentPercent: null },
} });
const csvLayout: PeoCensusLayout = { peo: "TriNet", format: "csv", template: null, columns: COLUMNS };
const catalog = [peo("TriNet", csvLayout), peo("Insperity", null, 2)];

const text = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });
const bytes = (blob: Blob) =>
  new Promise<Uint8Array>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(blob);
  });

describe("CensusDownload", () => {
  beforeEach(() => downloadBlob.mockReset());

  it("downloads the census in our own layout when no PEO is named, saying which certified version it is", async () => {
    render(<CensusDownload census={census} fileId="EAA-2026-0042" version={3} peo={null} catalog={catalog} />);
    expect(screen.getByText("Our layout, every column named, as a CSV file. From certified version 3.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download the census" }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
    const [blob, name] = downloadBlob.mock.calls[0];
    expect(name).toBe("EAA-2026-0042-census-v3.csv");
    expect((await text(blob)).split("\r\n")[0]).toMatch(/^first_name,last_name,/);
  });

  it("downloads a PEO's layout from its profile, and lists the columns left blank before the click", async () => {
    render(<CensusDownload census={census} fileId="EAA-2026-0042" version={3} peo="TriNet" catalog={catalog} />);
    expect(screen.getByText("TriNet's census layout, as a CSV file. From certified version 3.")).toBeInTheDocument();
    expect(screen.getByText("TriNet's layout also asks for: Hire Date, Gender. Fill these in before sending.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download the census in TriNet's layout" }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
    const [blob, name] = downloadBlob.mock.calls[0];
    expect(name).toBe("EAA-2026-0042-census-trinet-v3.csv");
    expect(await text(blob)).toBe("Last Name,Hire Date,Gender\r\nChen,,\r\n");
  });

  it("writes an xlsx when the layout says so", async () => {
    render(<CensusDownload census={census} fileId="EAA-2026-0042" version={3} peo="TriNet" catalog={[peo("TriNet", { ...csvLayout, format: "xlsx" })]} />);
    expect(screen.getByText("TriNet's census layout, as an Excel file. From certified version 3.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download the census in TriNet's layout" }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
    expect(downloadBlob.mock.calls[0][1]).toBe("EAA-2026-0042-census-trinet-v3.xlsx");
  });

  it("fills the PEO's own template, read when the download is asked for", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Census").getRow(1).values = ["Gender", "Last Name", "Hire Date"];
    const template = new Uint8Array(await wb.xlsx.writeBuffer());
    const readTemplate = vi.fn(async () => template);
    const layout: PeoCensusLayout = { ...csvLayout, format: "xlsx", template: { id: 12, sheet: "Census", headerRow: 1, firstRow: 2 } };
    render(<CensusDownload census={census} fileId="EAA-2026-0042" version={3} peo="TriNet" catalog={[peo("TriNet", layout)]} readTemplate={readTemplate} />);
    expect(screen.getByText("TriNet's own template, filled in. From certified version 3.")).toBeInTheDocument();
    expect(readTemplate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Download the census in TriNet's layout" }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
    expect(readTemplate).toHaveBeenCalledWith(5, 12);
    const [blob, name] = downloadBlob.mock.calls[0];
    expect(name).toBe("EAA-2026-0042-census-trinet-v3.xlsx");
    const out = new ExcelJS.Workbook();
    await out.xlsx.load((await bytes(blob)) as unknown as ArrayBuffer);
    expect(out.getWorksheet("Census")!.getRow(2).values).toEqual([undefined, undefined, "Chen"]);
  });

  it("says plainly why, and downloads nothing, when the template can't be read or doesn't match", async () => {
    const layout: PeoCensusLayout = { ...csvLayout, format: "xlsx", template: { id: 12, sheet: "Census", headerRow: 1, firstRow: 2 } };
    render(<CensusDownload census={census} fileId="EAA-2026-0042" version={3} peo="TriNet" catalog={[peo("TriNet", layout)]} readTemplate={async () => null} />);
    fireEvent.click(screen.getByRole("button", { name: "Download the census in TriNet's layout" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't get TriNet's template file, so the census couldn't be filled in. Try again.");
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("says why, and downloads nothing, when the template's headers don't match the layout", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Census").getRow(1).values = ["Surname"];
    const template = new Uint8Array(await wb.xlsx.writeBuffer());
    const layout: PeoCensusLayout = { ...csvLayout, format: "xlsx", template: { id: 12, sheet: "Census", headerRow: 1, firstRow: 2 } };
    render(<CensusDownload census={census} fileId="EAA-2026-0042" version={3} peo="TriNet" catalog={[peo("TriNet", layout)]} readTemplate={async () => template} />);
    fireEvent.click(screen.getByRole("button", { name: "Download the census in TriNet's layout" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The template's headers don't match the census layout: row 1 of the sheet \"Census\" has no \"Last Name\", \"Hire Date\" or \"Gender\".");
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("gives our own layout to a PEO with no census layout, or one typed in that isn't on the list, and says so", () => {
    const { rerender } = render(<CensusDownload census={census} fileId="EAA-2026-0042" version={3} peo="Insperity" catalog={catalog} />);
    expect(screen.getByText("We don't have Insperity's census layout yet, so this is ours: every column is named.")).toBeInTheDocument();
    rerender(<CensusDownload census={census} fileId="EAA-2026-0042" version={3} peo="Acme PEO" catalog={catalog} />);
    expect(screen.getByText("We don't have Acme PEO's census layout yet, so this is ours: every column is named.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download the census" })).toBeInTheDocument();
  });
});
