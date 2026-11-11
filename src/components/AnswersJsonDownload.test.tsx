import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import type { CertifiedAnswersSource } from "@/data/certifiedAnswersExport";

const downloadBlob = vi.fn();
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: (...a: unknown[]) => downloadBlob(...a) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
const { toast } = await import("sonner");
const { default: AnswersJsonDownload } = await import("./AnswersJsonDownload");

// Made up for the test: nobody real.
const source: CertifiedAnswersSource = {
  intake: { data: { ...EMPTY_CHAMBER_DATA, company_name: "Meridian Creative Group" }, provenance: {}, verified: new Set(), extraAnswers: null },
  submission: { signer_name: "Jo Sample", signer_title: "CEO", signed_at: "2026-05-01T12:00:00Z", file_id: "EAA-2026-0042", version: 3 },
  fileId: "EAA-2026-0042",
};
const button = () => screen.getByRole("button", { name: "Download the answers as JSON" });
const text = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });

describe("AnswersJsonDownload", () => {
  beforeEach(() => {
    downloadBlob.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("says what the file is and which certified version, before the click", () => {
    render(<AnswersJsonDownload source={source} />);
    expect(screen.getByText(
      "The certified answers, census included, as one JSON file for a PEO's or an advisor's own system: intake schema version 2, each answer with its status as certified, and the certification. From certified version 3. It holds no PEO's own questions.",
    )).toBeInTheDocument();
    expect(button()).toBeEnabled();
  });

  it("downloads the document as JSON, named for the File ID and version, busy until it is made", async () => {
    render(<AnswersJsonDownload source={source} />);
    fireEvent.click(button());
    expect(button()).toBeDisabled();
    expect(screen.getByText("Preparing the file…")).toBeInTheDocument();
    fireEvent.click(button());
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    const [blob, name] = downloadBlob.mock.calls[0] as [Blob, string];
    expect(name).toBe("EAA-2026-0042-answers-v3.json");
    expect(blob.type).toBe("application/json");
    const doc = JSON.parse(await text(blob));
    expect(doc.file_id).toBe("EAA-2026-0042");
    expect(doc.version).toBe(3);
    expect(doc.answers.company_name).toBe("Meridian Creative Group");
    await waitFor(() => expect(button()).toBeEnabled());
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("says so when the file couldn't be made, and the button works again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // A certification the builder can't read stands in for any failure: a lost file after a deploy, or a throw.
    render(<AnswersJsonDownload source={{ ...source, intake: undefined } as unknown as CertifiedAnswersSource} />);
    fireEvent.click(button());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("We couldn't generate the JSON file. Please try again."));
    expect(downloadBlob).not.toHaveBeenCalled();
    await waitFor(() => expect(button()).toBeEnabled());
  });

  it("says when no version was recorded", () => {
    render(<AnswersJsonDownload source={{ ...source, submission: { ...source.submission, version: undefined } }} />);
    expect(screen.getByText(/From the certification on record\./)).toBeInTheDocument();
  });
});
