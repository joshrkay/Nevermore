import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { CensusEmployee } from "@/data/census";
import type { PeoCensusLayout } from "@/data/censusExport";

const downloadBlob = vi.fn();
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: (...a: unknown[]) => downloadBlob(...a) }));
const { default: CensusDownload } = await import("./CensusDownload");

const census: CensusEmployee[] = [{ id: "1", first_name: "Sarah", last_name: "Chen", work_state: "CA", compensation_type: "salary" as const, employment_type: "full_time" as const, classification: "w2" as const }];
const SAMPLE: PeoCensusLayout = {
  peo: "TriNet",
  columns: [
    { header: "Last Name", from: "last_name" },
    { header: "Hire Date", from: null },
    { header: "Gender", from: null },
  ],
};

const text = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });

describe("CensusDownload", () => {
  beforeEach(() => downloadBlob.mockReset());

  it("downloads the census in our own layout by default, named for the File ID", async () => {
    render(<CensusDownload census={census} fileId="EAA-2026-0042" peos={["Insperity", "TriNet"]} layouts={[SAMPLE]} />);
    fireEvent.click(screen.getByRole("button", { name: "Download the census" }));
    const [blob, name] = downloadBlob.mock.calls[0];
    expect(name).toBe("EAA-2026-0042-census.csv");
    expect((await text(blob)).split("\r\n")[0]).toMatch(/^first_name,last_name,/);
    expect(screen.queryByText(/also asks for/)).not.toBeInTheDocument();
    expect(screen.queryByText(/We don't have/)).not.toBeInTheDocument();
  });

  it("downloads a PEO's layout when one is chosen, and lists the columns to fill in before sending", async () => {
    render(<CensusDownload census={census} fileId="EAA-2026-0042" peos={["Insperity", "TriNet"]} layouts={[SAMPLE]} />);
    fireEvent.change(screen.getByLabelText("Layout"), { target: { value: "TriNet" } });
    expect(screen.getByText("TriNet's layout also asks for: Hire Date, Gender. Fill these in before sending.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download the census" }));
    const [blob, name] = downloadBlob.mock.calls[0];
    expect(name).toBe("EAA-2026-0042-census-trinet.csv");
    expect(await text(blob)).toBe("Last Name,Hire Date,Gender\r\nChen,,\r\n");
  });

  it("says when a PEO has no layout of its own, and gives ours", () => {
    render(<CensusDownload census={census} fileId="EAA-2026-0042" peos={["Insperity", "TriNet"]} layouts={[SAMPLE]} />);
    fireEvent.change(screen.getByLabelText("Layout"), { target: { value: "Insperity" } });
    expect(screen.getByText("We don't have Insperity's census layout yet, so this is ours: every column is named.")).toBeInTheDocument();
  });
});
