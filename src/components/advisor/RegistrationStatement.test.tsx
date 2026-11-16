import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { blobBytes, blobText } from "@/test/blob";

// Seam 2 (D-13): a firm downloads the dated statement of its own registrations from Settings (Q-2.1, slice 6.10), with the database faked at its API
// module and the download at downloadFile.
const downloadBlob = vi.fn();
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: (...a: unknown[]) => downloadBlob(...a) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const loadRegistrationStatement = vi.fn();
vi.mock("@/lib/peoRegistrationsApi", () => ({ loadRegistrationStatement: (...a: unknown[]) => loadRegistrationStatement(...a) }));

const { default: RegistrationStatement } = await import("./RegistrationStatement");

// Made up for the test: nobody real.
const STATEMENT = {
  firm: "Acme Brokers",
  as_of: "2026-11-16T18:30:00.123+00:00",
  rows: [
    { registered_at: "2026-11-03T15:00:00+00:00", peo: "Insperity", employer: "Reyes Bakery", state: "CA", fein_last_four: "6789", file_id: "EAA-2026-0042", version: 1 },
    { registered_at: "2026-11-04T16:00:00+00:00", peo: "TriNet", employer: "=Bay Cafe", state: "TX", fein_last_four: null, file_id: "EAA-2026-0050", version: 2 },
  ],
};

describe("RegistrationStatement", () => {
  beforeEach(() => {
    downloadBlob.mockReset();
    loadRegistrationStatement.mockReset();
  });

  // Break caught: a firm with no proof to hand over of when it submitted each employer to each PEO; a statement with no date; one that lists the
  // database's rows in another order or drops one; or a cell a spreadsheet would run as a formula.
  it("downloads the firm's statement as a dated CSV: when, the PEO, the employer, its state, the FEIN's last four, the File ID and the version", async () => {
    loadRegistrationStatement.mockResolvedValue(STATEMENT);
    render(<RegistrationStatement firmId="f1" />);
    fireEvent.click(screen.getByRole("button", { name: "Download the statement (CSV)" }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    expect(loadRegistrationStatement).toHaveBeenCalledWith("f1");
    const [blob, name] = downloadBlob.mock.calls[0] as [Blob, string];
    expect(name).toBe("registrations-with-peos-2026-11-16.csv");
    expect(blob.type).toBe("text/csv;charset=utf-8");
    expect([...(await blobBytes(blob)).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect((await blobText(blob)).replace(/^\uFEFF/, "")).toBe([
      "Statement of registrations with PEOs,Acme Brokers",
      "As of,2026-11-16T18:30:00.123+00:00",
      "",
      "Registered at,PEO,Employer,State,FEIN (last four),File ID,Version",
      "2026-11-03T15:00:00+00:00,Insperity,Reyes Bakery,CA,6789,EAA-2026-0042,1",
      "2026-11-04T16:00:00+00:00,TriNet,'=Bay Cafe,TX,,EAA-2026-0050,2",
      "",
    ].join("\r\n"));
  });
});
