import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReviewedDocument } from "@/data/advisor";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import type { PeoRecord } from "@/data/peoCatalog";
import type { RequirementProfile } from "@/data/peoProfiles";
import type { BundleSource } from "@/data/submissionBundle";
import { CHANGED_SINCE_OPENED, type BuiltFrom } from "@/lib/certificationCheck";
import { blobBytes } from "@/test/blob";
import { intakeIs } from "@/test/intakeNow";
import { unzip } from "@/test/zip";

const downloadBlob = vi.fn();
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: (...a: unknown[]) => downloadBlob(...a) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", async () => ({ supabase: (await import("@/test/intakeNow")).supabaseStub }));
// The builder is loaded on the click: after a deploy its old chunk can be gone, or building can throw.
let loseTheBuilder = false;
vi.mock("@/lib/submissionBundle", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/submissionBundle")>();
  return { ...real, buildBundle: (...a: Parameters<typeof real.buildBundle>) => (loseTheBuilder ? Promise.reject(new Error("chunk gone")) : real.buildBundle(...a)) };
});
const { toast } = await import("sonner");
const { default: BundleDownload } = await import("./BundleDownload");

// Made up for the test: no real PEO's profile, and nobody real.
const profile: RequirementProfile = {
  version: 2, neededToQuote: [], neededBeforeSigning: [], censusLayout: null, extraQuestions: [], sources: {}, publishedAt: null,
  documents: [{ category: "payroll_report", description: "Last quarter's payroll register" }, { category: "workers_comp_loss_runs", description: "Three years of loss runs" }],
  rules: { minHeadcount: null, statesServed: null, excludedIndustries: null, excludedClassCodes: null, minEnrolmentPercent: null },
};
const peo: PeoRecord = { id: 7, name: "Sample PEO", listed: true, lastVerified: "2026-11-01", profile };
const doc = (over: Partial<ReviewedDocument> = {}): ReviewedDocument => ({
  id: "d1", file_name: "register.xlsx", file_size: "40 KB", category: "payroll_report", status: "uploaded",
  storage_path: "u/register.xlsx", created_at: "2026-04-30T00:00:00Z", scan_verdict: "clean", certification: "certified", ...over,
});
const submission = { signer_name: "Jo Sample", signer_title: "CEO", signed_at: "2026-05-01T12:00:00Z", certified_at: "2026-05-01T12:00:03Z", file_id: "EAA-2026-0042", version: 3, data_sha256: "e".repeat(64) };
const source = (over: Partial<BundleSource> = {}): BundleSource => ({
  audience: "advisor", peo, catalog: [peo],
  intake: { data: { ...EMPTY_CHAMBER_DATA, company_name: "Meridian Creative Group" }, provenance: {}, verified: new Set(), extraAnswers: {} },
  documents: [doc(), doc({ id: "d2", file_name: "loss-runs.pdf", storage_path: "u/loss-runs.pdf", category: "workers_comp_loss_runs" })],
  submission, fileId: "EAA-2026-0042", version: 3, changedSince: false, today: "2026-11-11", ...over,
});
const built: BuiltFrom = { sessionId: "s1", status: "submitted", dataSha256: "e".repeat(64), version: 3 };
const fetchDocument = vi.fn(async (d: ReviewedDocument) => {
  if (d.storage_path === "u/loss-runs.pdf") throw new Error("Couldn't open that file.");
  return new Blob(["REGISTER"]);
});
const button = (name = "Download bundle") => screen.getByRole("button", { name });

describe("BundleDownload", () => {
  beforeEach(() => {
    downloadBlob.mockReset();
    fetchDocument.mockClear();
    vi.mocked(toast.error).mockReset();
    intakeIs("submitted", submission);
  });

  it("says what is in it and what is missing before the click", () => {
    render(<BundleDownload source={source()} builtFrom={built} label="Download bundle" fetchDocument={fetchDocument} />);
    expect(screen.getByText("Includes: packet, workers' comp application, 2 documents. No census file: the certified version holds none. Nothing it requires is missing.")).toBeInTheDocument();
    expect(screen.getByText("From certified version 3: one .zip with a contents page.")).toBeInTheDocument();
    expect(button()).toBeEnabled();
  });

  it("says when the prospect has changed answers since, and that the bundle is still the certified version", () => {
    render(<BundleDownload source={source({ changedSince: true })} builtFrom={built} label="Download bundle" fetchDocument={fetchDocument} />);
    expect(screen.getByText("The prospect has changed answers since certifying. These files are from version 3.")).toBeInTheDocument();
  });

  it("downloads one zip named for the File ID, PEO and version, busy and unclickable until it is made", async () => {
    const onSaved = vi.fn();
    render(<BundleDownload source={source({ documents: [doc()] })} builtFrom={built} label="Download bundle" fetchDocument={fetchDocument} onSaved={onSaved} />);
    fireEvent.click(button());
    expect(button()).toBeDisabled();
    fireEvent.click(button());
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    const [blob, name] = downloadBlob.mock.calls[0] as [Blob, string];
    expect(name).toBe("EAA-2026-0042-sample-peo-v3.zip");
    expect(unzip(await blobBytes(blob)).map((p) => p.name)).toContain("documents/register.xlsx");
    expect(fetchDocument).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(button()).toBeEnabled());
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("tells the advisor before saving which documents couldn't be included, and saves only when they say so", async () => {
    const onSaved = vi.fn();
    render(<BundleDownload source={source()} builtFrom={built} label="Download bundle" fetchDocument={fetchDocument} onSaved={onSaved} />);
    fireEvent.click(button());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("1 file couldn't be included. The contents page lists it.");
    expect(within(alert).getByRole("listitem")).toHaveTextContent("loss-runs.pdf (Workers' comp loss runs): It couldn't be downloaded. Download it from the submission page and send it with this bundle.");
    expect(downloadBlob).not.toHaveBeenCalled();
    fireEvent.click(within(alert).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(downloadBlob).not.toHaveBeenCalled();

    fireEvent.click(button());
    fireEvent.click(within(await screen.findByRole("alert")).getByRole("button", { name: "Save the bundle anyway" }));
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "EAA-2026-0042-sample-peo-v3.zip");
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("gives no file once the certification has changed since the page was opened, and says to reload", async () => {
    render(<BundleDownload source={source()} builtFrom={built} label="Download bundle anyway" fetchDocument={fetchDocument} />);
    intakeIs("in_progress", submission);
    fireEvent.click(button("Download bundle anyway"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(CHANGED_SINCE_OPENED));
    await waitFor(() => expect(button("Download bundle anyway")).toBeEnabled());
    expect(fetchDocument).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("says so when the bundle couldn't be made, and the button works again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    loseTheBuilder = true;
    render(<BundleDownload source={source()} builtFrom={built} label="Download bundle" fetchDocument={fetchDocument} />);
    fireEvent.click(button());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("We couldn't make the bundle. Please try again."));
    expect(downloadBlob).not.toHaveBeenCalled();
    await waitFor(() => expect(button()).toBeEnabled());
    loseTheBuilder = false;
  });
});
