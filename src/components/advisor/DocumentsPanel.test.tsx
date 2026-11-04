import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReviewedDocument } from "@/data/advisor";
import { advisorScanNotice } from "@/data/documentStatus";
import DocumentsPanel from "./DocumentsPanel";

const documentUrl = vi.fn(async () => "https://storage.example/signed");
vi.mock("@/lib/advisorApi", () => ({ documentUrl: (...a: unknown[]) => documentUrl(...(a as [])) }));

const doc = (id: string, scan_verdict: string | undefined): ReviewedDocument => ({
  id,
  file_name: `${id}.pdf`,
  file_size: "1 KB",
  category: "benefits_summary",
  status: "uploaded",
  storage_path: `u/s/${id}.pdf`,
  created_at: "2026-11-04T12:00:00Z",
  ...(scan_verdict === undefined ? {} : { scan_verdict }),
});

const panel = (documents: ReviewedDocument[]) =>
  render(<DocumentsPanel documents={documents} events={[]} prospectUserId="u" />);
const openButton = (id: string) => within(screen.getByTestId(`document-${id}`)).getByRole("button", { name: `Open ${id}.pdf` });

// E-4.3: an advisor opens a file only once its malware scan has passed; until then the button is off and says why.
describe("DocumentsPanel: the malware scan", () => {
  it.each([
    ["pending", "Being checked for viruses"],
    ["infected", "Quarantined: the virus scan flagged this file"],
    ["failed", "Not openable: the virus scan couldn't finish"],
  ])("won't open a %s file, and says why", (verdict, reason) => {
    panel([doc("d1", verdict)]);
    expect(openButton("d1")).toBeDisabled();
    expect(within(screen.getByTestId("document-d1")).getByText(new RegExp(reason))).toBeInTheDocument();
    fireEvent.click(openButton("d1"));
    expect(documentUrl).not.toHaveBeenCalled();
  });

  it.each(["clean", "skipped"])("opens a %s file", async (verdict) => {
    documentUrl.mockClear();
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    try {
      panel([doc("d2", verdict)]);
      expect(openButton("d2")).toBeEnabled();
      expect(screen.queryByText(/virus/)).not.toBeInTheDocument();
      fireEvent.click(openButton("d2"));
      await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("https://storage.example/signed"));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("leaves a certified copy with no live row to storage, which withholds it if its scan hasn't passed", () => {
    panel([doc("d3", undefined)]);
    expect(openButton("d3")).toBeEnabled();
    expect(advisorScanNotice(undefined)).toBeNull();
  });
});
