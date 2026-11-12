import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Supplement } from "@/data/peoSupplement";
import { CHANGED_SINCE_OPENED, type BuiltFrom } from "@/lib/certificationCheck";
import { intakeIs } from "@/test/intakeNow";

const downloadBlob = vi.fn();
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: (...a: unknown[]) => downloadBlob(...a) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", async () => ({ supabase: (await import("@/test/intakeNow")).supabaseStub }));
const build = vi.fn();
vi.mock("@/lib/supplementPdf", () => ({ buildSupplementPdf: (...a: unknown[]) => build(...a) }));
const { toast } = await import("sonner");
const { default: SupplementDownload } = await import("./SupplementDownload");

// Made up for the test: no real PEO's questions.
const supplement: Supplement = {
  title: "Additional questions from Sample PEO", peo: "Sample PEO", companyName: "Meridian Creative Group", fileId: "EAA-2026-0042", version: 3,
  rows: [{ question: "Do you run a fleet?", answer: "No" }], notAnswered: [], earlier: [], cantTell: false,
};
// The certification the page was built from.
const built: BuiltFrom = { sessionId: "s1", status: "submitted", dataSha256: "e".repeat(64), version: 3 };
const button = () => screen.getByRole("button", { name: "Download Additional questions from Sample PEO" });

describe("SupplementDownload", () => {
  beforeEach(() => {
    downloadBlob.mockReset();
    build.mockReset();
    vi.mocked(toast.error).mockReset();
    intakeIs("submitted", { data_sha256: "e".repeat(64), version: 3 });
  });

  it("downloads the PDF it builds, busy until it is made, and can't be clicked twice meanwhile", async () => {
    const blob = new Blob(["%PDF"]);
    build.mockReturnValue({ blob, filename: "EAA-2026-0042-additional-questions-sample-peo-v3.pdf" });
    render(<SupplementDownload supplement={supplement} builtFrom={built} />);
    fireEvent.click(button());
    expect(button()).toBeDisabled();
    fireEvent.click(button());
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(blob, "EAA-2026-0042-additional-questions-sample-peo-v3.pdf"));
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(button()).toBeEnabled());
  });

  it("says so when the PDF couldn't be made, rather than doing nothing", async () => {
    build.mockImplementation(() => { throw new Error("no"); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<SupplementDownload supplement={supplement} builtFrom={built} />);
    fireEvent.click(button());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("We couldn't generate the PDF. Please try again."));
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("gives no file once the certification has changed since the page was opened, and says to reload", async () => {
    build.mockReturnValue({ blob: new Blob(["%PDF"]), filename: "EAA-2026-0042-additional-questions-sample-peo-v3.pdf" });
    render(<SupplementDownload supplement={supplement} builtFrom={built} />);
    intakeIs("in_progress", { data_sha256: "e".repeat(64), version: 3 });
    fireEvent.click(button());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(CHANGED_SINCE_OPENED));
    expect(build).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
