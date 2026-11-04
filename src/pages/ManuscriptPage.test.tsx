import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";

let row: Record<string, unknown> | null = null;
// What the page asked the database for: the column it filtered on and the value.
let lastQuery: { column: string; value: unknown } | null = null;

// Stable object: the page's effect depends on `user`, as the real provider's state is stable.
const auth = { user: { id: "u1" }, loading: false };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
let sharedStatus: string | null = null;
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: async () => ({ data: sharedStatus, error: null }),
    from: () => ({
      select: () => ({
        eq: (column: string, value: unknown) => {
          lastQuery = { column, value };
          return { maybeSingle: async () => ({ data: row ? { id: "s1", file_id: null, ...row } : null, error: null }) };
        },
      }),
    }),
  },
}));

const downloadBlob = vi.fn();
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: (...args: unknown[]) => downloadBlob(...args) }));
// Real generator, observed: the page decides masking, the generator draws it.
vi.mock("@/lib/manuscriptPdf", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/manuscriptPdf")>();
  return { ...real, buildManuscriptPdf: vi.fn(real.buildManuscriptPdf) };
});

const { default: ManuscriptPage } = await import("./ManuscriptPage");
const { buildManuscriptPdf } = await import("@/lib/manuscriptPdf");

// The app's routes for the page: by File ID, by intake, and the sample.
const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/manuscript" element={<ManuscriptPage />} />
        <Route path="/manuscript/demo" element={<ManuscriptPage demo />} />
        <Route path="/manuscript/:reference" element={<ManuscriptPage />} />
      </Routes>
    </MemoryRouter>,
  );

const signed = { ...EMPTY_CHAMBER_DATA, company_name: "Signed Co", industry: "Bookbinding", pay_frequency: "weekly" };
const certified = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  file_id: "EAA-2026-0042",
  chamber_data: { ...signed, company_name: "Edited Later Inc" },
  submission: {
    signer_name: "Jo Doe",
    signer_title: "CEO",
    signed_at: "2026-05-01T12:00:00Z",
    certified_at: "2026-05-01T12:00:03Z",
    file_id: "EAA-2026-0042",
    version: 2,
    data_version: 17,
    peo: "Justworks",
    chamber_data: signed,
    field_provenance: { company_name: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: "2026-05-01T00:00:00Z" } },
    documents: [{ id: "d1", file_name: "census.csv", category: "employee_census", status: "extracted" }],
  },
  status: "submitted",
  ...over,
});

describe("ManuscriptPage", () => {
  beforeEach(() => {
    lastQuery = null;
    row = null;
  });

  it("loads a submission by its File ID, and renders the snapshot it froze", async () => {
    row = certified();
    renderAt("/manuscript/EAA-2026-0042");
    expect(await screen.findByText("THE MANUSCRIPT")).toBeInTheDocument();
    expect(lastQuery).toEqual({ column: "file_id", value: "EAA-2026-0042" });
    expect(screen.getAllByText(/Signed Co/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Edited Later Inc/)).not.toBeInTheDocument();
    expect(screen.getAllByText("EAA-2026-0042").length).toBeGreaterThan(0);
    // The certification's version and data version, so a packet can be matched to its record.
    expect(screen.getByText("VERSION").parentElement).toHaveTextContent("v2 · data version 17");
    expect(screen.getByText("CERTIFIED").parentElement).toHaveTextContent("May 1, 2026");
    expect(screen.getAllByRole("link", { name: /Back to Review/ })[0]).toHaveAttribute("href", "/start?session=s1");
  });

  it("still opens by intake id, and renders the data as signed, not later edits", async () => {
    row = certified();
    renderAt("/manuscript?session=s1");
    expect(await screen.findByText("THE MANUSCRIPT")).toBeInTheDocument();
    expect(lastQuery).toEqual({ column: "id", value: "s1" });
    expect(screen.getAllByText(/Signed Co/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Edited Later Inc/)).not.toBeInTheDocument();
    // The packet is prepared for the PEO the prospect chose; nothing says it was submitted to them.
    expect(screen.getByText("PREPARED FOR").parentElement).toHaveTextContent("PREPARED FORJustworks");
  });

  it("refuses a guessed identifier that isn't a File ID without asking the database, and shows nothing", async () => {
    row = certified();
    renderAt("/manuscript/not-a-file-id");
    expect(await screen.findByText(/couldn't find that Manuscript/)).toBeInTheDocument();
    expect(lastQuery).toBeNull();
    expect(screen.queryByText(/Signed Co/)).not.toBeInTheDocument();
    expect(screen.queryByText("THE MANUSCRIPT")).not.toBeInTheDocument();
  });

  it("shows the same safe message for a File ID the database won't return (someone else's, or none)", async () => {
    row = null;
    renderAt("/manuscript/EAA-2026-9999");
    expect(await screen.findByText(/couldn't find that Manuscript/)).toBeInTheDocument();
    expect(lastQuery).toEqual({ column: "file_id", value: "EAA-2026-9999" });
    expect(screen.getByText(/link may be out of date, or it belongs to a different account/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Go to The Chamber/ })).toHaveAttribute("href", "/start");
    expect(document.body.textContent).not.toMatch(/Signed Co|Jo Doe|EAA-2026-9999/);
  });

  it("refuses to certify a session that was never signed", async () => {
    row = {
      chamber_data: { ...EMPTY_CHAMBER_DATA, company_name: "Acme" },
      submission: null,
      status: "in_progress",
    };
    renderAt("/manuscript?session=s1");
    expect(await screen.findByText(/hasn't been signed yet/)).toBeInTheDocument();
    expect(screen.queryByText("THE MANUSCRIPT")).not.toBeInTheDocument();
    expect(screen.queryByText(/Acme/)).not.toBeInTheDocument();
  });

  it("says an expired intake has expired, shows none of it, and sends the prospect to start again", async () => {
    row = certified({ chamber_data: { ...EMPTY_CHAMBER_DATA, company_name: "Gone Co" }, status: "expired" });
    renderAt("/manuscript/EAA-2026-0042");
    expect(await screen.findByText(/This intake has expired/)).toBeInTheDocument();
    expect(screen.queryByText("THE MANUSCRIPT")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Gone Co|Signed Co|Jo Doe/);
    expect(screen.getByRole("link", { name: "Go to The Chamber" })).toHaveAttribute("href", "/start");
  });

  it("says the certification no longer applies when the information changed after it, showing none of it", async () => {
    row = certified({ status: "in_progress" });
    renderAt("/manuscript/EAA-2026-0042");
    expect(await screen.findByText(/changed after you certified it/)).toBeInTheDocument();
    expect(screen.queryByText("THE MANUSCRIPT")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Signed Co|Edited Later|Jo Doe/);
    expect(screen.getByRole("link", { name: /Back to The Chamber/ })).toHaveAttribute("href", "/start?session=s1");
  });

  it("shows every section of the packet, with the documents and confirmed facts the certification recorded", async () => {
    row = certified();
    renderAt("/manuscript/EAA-2026-0042");
    expect(await screen.findByText("THE MANUSCRIPT")).toBeInTheDocument();
    for (const name of [
      "1 — Company Profile", "2 — Workforce Summary", "3 — Employee Census", "4 — Dependent Summary", "5 — Locations",
      "6 — Payroll & Time", "7 — Current Benefits", "8 — Workers' Compensation", "9 — Operations & HR", "10 — Documents",
      "11 — Underwriting Readiness",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    const payroll = screen.getByRole("heading", { name: "6 — Payroll & Time" }).closest("section")!;
    expect(payroll).toHaveTextContent("weekly");
    const documents = screen.getByRole("heading", { name: "10 — Documents" }).closest("section")!;
    expect(documents).toHaveTextContent("census.csv");
    expect(documents).toHaveTextContent("Employee census");
    expect(documents).toHaveTextContent("Read");
    const readiness = screen.getByRole("heading", { name: "11 — Underwriting Readiness" }).closest("section")!;
    expect(readiness).toHaveTextContent("Company legal name — confirmed by the prospect");
    expect(readiness).toHaveTextContent("Eligibility checks");
    expect(readiness).toHaveTextContent("States of operation — not provided");
  });

  it("says when a certification predates the document record", async () => {
    row = certified({ submission: { signer_name: "Jo Doe", signer_title: "CEO", signed_at: "2026-05-01T12:00:00Z", file_id: "EAA-2026-0042", chamber_data: signed } });
    renderAt("/manuscript/EAA-2026-0042");
    expect(await screen.findByText(/Documents were not recorded with this certification/)).toBeInTheDocument();
    expect(screen.getByText("VERSION").parentElement).toHaveTextContent("Not recorded");
  });

  describe("advisor status shared with the prospect", () => {
    it("shows a status the advisor chose to share", async () => {
      row = certified();
      sharedStatus = "information_requested";
      renderAt("/manuscript/EAA-2026-0042");
      expect(await screen.findByRole("status")).toHaveTextContent(/needs a little more information/);
      sharedStatus = null;
    });

    it("shows nothing for a status that isn't meant for the prospect", async () => {
      row = certified();
      sharedStatus = "lost";
      renderAt("/manuscript/EAA-2026-0042");
      expect(await screen.findByText("THE MANUSCRIPT")).toBeInTheDocument();
      await new Promise((r) => setTimeout(r, 0));
      expect(screen.queryByText(/^Status:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/lost/i)).not.toBeInTheDocument();
      sharedStatus = null;
    });
  });

  it("marks inferred and conflicting values with their source and lists them as open items", async () => {
    const at = "2026-05-01T12:00:00Z";
    row = certified({
      submission: {
        signer_name: "Jo Doe",
        signer_title: "CEO",
        signed_at: at,
        file_id: "EAA-2026-0042",
        chamber_data: { ...EMPTY_CHAMBER_DATA, company_name: "Signed Co", industry: "Retail", employee_count: 40 },
        field_provenance: {
          company_name: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: at },
          industry: { status: "inferred", source: { kind: "transcript", message_id: "m1", quote: "we sell shoes" }, updated_at: at },
          employee_count: {
            status: "conflicting",
            source: { kind: "transcript", message_id: "m1" },
            updated_at: at,
            candidates: [
              { value: 40, source: { kind: "transcript", message_id: "m1" } },
              { value: 45, source: { kind: "document", document_id: "d1", document_name: "census.csv" } },
            ],
          },
          wc_carrier: { status: "not_applicable", source: { kind: "prospect_edit" }, updated_at: at },
        },
      },
    });
    renderAt("/manuscript/EAA-2026-0042");
    expect(await screen.findByText("THE MANUSCRIPT")).toBeInTheDocument();
    expect(screen.getAllByText("Entered or confirmed by the prospect").length).toBeGreaterThan(0);
    expect(screen.getByText("From the conversation: “we sell shoes”")).toBeInTheDocument();
    expect(screen.getByText("Inferred")).toBeInTheDocument();
    expect(screen.getByText("Conflicting")).toBeInTheDocument();
    expect(screen.getByText("Industry — please confirm")).toBeInTheDocument();
    expect(screen.getByText("Employee count — conflicting answers")).toBeInTheDocument();
    // An answer the prospect marked as not applying says so, instead of reading as missing.
    const wc = screen.getByRole("heading", { name: "8 — Workers' Compensation" }).closest("section")!;
    expect(wc).toHaveTextContent("Not applicable");
    expect(wc).toHaveTextContent("Doesn't apply");
  });

  it("never shows sample data on the live route when no session is given", async () => {
    renderAt("/manuscript");
    expect(await screen.findByText(/Open your Manuscript from The Reckoning/)).toBeInTheDocument();
    expect(screen.queryByText(/Meridian/)).not.toBeInTheDocument();
    expect(screen.queryByText("THE MANUSCRIPT")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Go to The Chamber/ })).toHaveAttribute("href", "/start");
  });

  it("renders the fictional sample only on the demo route, clearly labelled", async () => {
    renderAt("/manuscript/demo");
    expect(await screen.findByText("THE MANUSCRIPT")).toBeInTheDocument();
    expect(screen.getByText(/sample manuscript built from fictional data/)).toBeInTheDocument();
    expect(lastQuery).toBeNull();
  });

  it("masks dates of birth, with no way for a prospect to reveal them", async () => {
    // Signed before the census contract: the snapshot names the roster `employees`, in its old shape.
    const employee = {
      first_name: "Ada", last_name: "Lovelace", dob: "1990-05-17", state: "TX", title: "Engineer",
      salary: 90000, classification: "W2", dependents: [],
    };
    const { census: _census, ...legacy } = EMPTY_CHAMBER_DATA;
    const data = { ...legacy, company_name: "Signed Co", employees: [employee] };
    row = {
      chamber_data: data,
      submission: { signer_name: "Jo", signer_title: "CEO", signed_at: "2026-05-01T12:00:00Z", file_id: "EAA-1", chamber_data: data },
      status: "submitted",
    };
    renderAt("/manuscript?session=s1");
    expect(await screen.findByText("••/••/1990")).toBeInTheDocument();
    expect(screen.queryByText("1990-05-17")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Data masked|Data visible/ })).not.toBeInTheDocument();
    expect(screen.getByText("Dates of birth masked")).toBeInTheDocument();
  });

  describe("PDF download", () => {
    beforeEach(() => {
      downloadBlob.mockClear();
      vi.mocked(buildManuscriptPdf).mockClear();
      const data = { ...EMPTY_CHAMBER_DATA, company_name: "Signed & Co." };
      row = certified({ chamber_data: data, submission: { ...certified().submission, chamber_data: data, field_provenance: {}, documents: [] } });
    });

    it("downloads a PDF named after the submission, its version, the company and the certified date, with sensitive fields masked", async () => {
      renderAt("/manuscript/EAA-2026-0042");
      fireEvent.click((await screen.findAllByRole("button", { name: /Download The Manuscript \(PDF\)/ }))[0]);

      await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
      const [blob, filename] = downloadBlob.mock.calls[0];
      expect(filename).toBe("The_Manuscript_EAA-2026-0042_v2_Signed_Co_20260501.pdf");
      expect((blob as Blob).type).toBe("application/pdf");
      expect(vi.mocked(buildManuscriptPdf).mock.calls[0][1]).toMatchObject({ revealSensitive: false });
    });

    it("builds the PDF from the same packet the page shows", async () => {
      renderAt("/manuscript/EAA-2026-0042");
      fireEvent.click((await screen.findAllByRole("button", { name: /Download The Manuscript \(PDF\)/ }))[0]);
      await waitFor(() => expect(buildManuscriptPdf).toHaveBeenCalled());
      const packet = vi.mocked(buildManuscriptPdf).mock.calls[0][0];
      expect(packet).toMatchObject({ fileId: "EAA-2026-0042", version: 2, dataVersion: 17, companyName: "Signed & Co." });
      expect(screen.getByText("VERSION").parentElement).toHaveTextContent("v2 · data version 17");
    });

    it("tells the user when the PDF can't be generated", async () => {
      vi.mocked(buildManuscriptPdf).mockImplementationOnce(() => { throw new Error("boom"); });
      renderAt("/manuscript/EAA-2026-0042");
      fireEvent.click((await screen.findAllByRole("button", { name: /Download The Manuscript \(PDF\)/ }))[0]);
      await waitFor(() => expect(buildManuscriptPdf).toHaveBeenCalled());
      expect(downloadBlob).not.toHaveBeenCalled();
      // The button is usable again for a retry.
      await waitFor(() => expect(screen.getAllByRole("button", { name: /Download The Manuscript \(PDF\)/ })[0]).toBeEnabled());
    });
  });
});
