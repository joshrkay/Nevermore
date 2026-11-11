import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import { workersCompApplication } from "@/data/workersCompApplication";

const downloadBlob = vi.fn();
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: (...a: unknown[]) => downloadBlob(...a) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
// The PDF module is loaded on the click: after a deploy its old chunk can be gone, or building can throw.
const build = vi.fn();
vi.mock("@/lib/workersCompPdf", () => ({ buildWorkersCompPdf: (...a: unknown[]) => build(...a) }));
const { toast } = await import("sonner");
const { default: WorkersCompDownload } = await import("./WorkersCompDownload");

// Made up for the test: nobody real.
const application = workersCompApplication({
  intake: { data: { ...EMPTY_CHAMBER_DATA, company_name: "Meridian Creative Group" }, provenance: {}, verified: new Set() },
  fileId: "EAA-2026-0042",
  version: 3,
  changedSince: false,
});
const button = () => screen.getByRole("button", { name: "Download Workers' compensation application data" });

describe("WorkersCompDownload", () => {
  beforeEach(() => {
    downloadBlob.mockReset();
    build.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("downloads the PDF it builds, under its name", async () => {
    const blob = new Blob(["%PDF"]);
    build.mockReturnValue({ blob, filename: "EAA-2026-0042-workers-comp-application-v3.pdf", pageCount: 1 });
    render(<WorkersCompDownload application={application} />);
    fireEvent.click(button());
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(blob, "EAA-2026-0042-workers-comp-application-v3.pdf"));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("says so when the PDF couldn't be made, and the button works again", async () => {
    build.mockImplementation(() => { throw new Error("no"); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<WorkersCompDownload application={application} />);
    fireEvent.click(button());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("We couldn't generate the PDF. Please try again."));
    expect(downloadBlob).not.toHaveBeenCalled();
    await waitFor(() => expect(button()).toBeEnabled());
  });

  it("can't be clicked twice while it is being made", async () => {
    build.mockReturnValue({ blob: new Blob(["%PDF"]), filename: "a.pdf", pageCount: 1 });
    render(<WorkersCompDownload application={application} />);
    fireEvent.click(button());
    // Busy from the click itself, while the PDF module is still loading.
    expect(button()).toBeDisabled();
    expect(screen.getByText("Preparing the PDF…")).toBeInTheDocument();
    fireEvent.click(button());
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    expect(build).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(button()).toBeEnabled());
  });
});
