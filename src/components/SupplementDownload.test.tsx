import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Supplement } from "@/data/peoSupplement";

const downloadBlob = vi.fn();
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: (...a: unknown[]) => downloadBlob(...a) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
const build = vi.fn();
vi.mock("@/lib/supplementPdf", () => ({ buildSupplementPdf: (...a: unknown[]) => build(...a) }));
const { toast } = await import("sonner");
const { default: SupplementDownload } = await import("./SupplementDownload");

// Made up for the test: no real PEO's questions.
const supplement: Supplement = {
  title: "Additional questions from Sample PEO", peo: "Sample PEO", companyName: "Meridian Creative Group", fileId: "EAA-2026-0042", version: 3,
  rows: [{ question: "Do you run a fleet?", answer: "No" }], notAnswered: [], earlier: [], cantTell: false,
};
const button = () => screen.getByRole("button", { name: "Download Additional questions from Sample PEO" });

describe("SupplementDownload", () => {
  beforeEach(() => {
    downloadBlob.mockReset();
    build.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("downloads the PDF it builds", () => {
    const blob = new Blob(["%PDF"]);
    build.mockReturnValue({ blob, filename: "EAA-2026-0042-additional-questions-sample-peo-v3.pdf" });
    render(<SupplementDownload supplement={supplement} />);
    fireEvent.click(button());
    expect(downloadBlob).toHaveBeenCalledWith(blob, "EAA-2026-0042-additional-questions-sample-peo-v3.pdf");
  });

  it("says so when the PDF couldn't be made, rather than doing nothing", () => {
    build.mockImplementation(() => { throw new Error("no"); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<SupplementDownload supplement={supplement} />);
    fireEvent.click(button());
    expect(toast.error).toHaveBeenCalledWith("We couldn't generate the PDF. Please try again.");
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
