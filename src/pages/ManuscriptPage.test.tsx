import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import { rowProvenance } from "@/data/manuscript";

let row: Record<string, unknown> | null = null;
// What the page asked the database for: the column it filtered on and the value.
let lastQuery: { column: string; value: unknown } | null = null;

// Stable object: the page's effect depends on `user`, as the real provider's state is stable.
const auth = { user: { id: "u1" }, loading: false };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
let sharedStatus: string | null = null;
let finalVersions: unknown[] = [];
let verifiedFields: string[] = [];
// What public.peo_catalog() returns: the PEOs and their profiles in use.
let peoCatalogRows: unknown[] = [];
// Set to make the next catalog reads hang ("pending") or fail ("error"); each read takes the next one.
const peoCatalogReads: ("pending" | "error")[] = [];
const createSignedUrl = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: async (fn: string) => {
      const read = fn === "peo_catalog" ? peoCatalogReads.shift() : undefined;
      if (read === "pending") await new Promise(() => {});
      if (read === "error") return { data: null, error: { message: "network down" } };
      return {
        data: fn === "prospect_final_manuscript" ? finalVersions : fn === "session_verified_fields" ? verifiedFields
          : fn === "peo_catalog" ? peoCatalogRows : sharedStatus,
        error: null,
      };
    },
    storage: { from: () => ({ createSignedUrl: (...a: unknown[]) => createSignedUrl(...a) }) },
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

const recordManuscriptDownload = vi.fn();
vi.mock("@/lib/milestones", () => ({ recordManuscriptDownload: (...a: unknown[]) => recordManuscriptDownload(...a) }));
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
    peoCatalogRows = [];
    peoCatalogReads.length = 0;
    row = null;
  });

  it("loads a submission by its File ID, and renders the snapshot it froze", async () => {
    row = certified();
    renderAt("/manuscript/EAA-2026-0042");
    expect(await screen.findByText("Underwriting packet")).toBeInTheDocument();
    expect(lastQuery).toEqual({ column: "file_id", value: "EAA-2026-0042" });
    expect(screen.getAllByText(/Signed Co/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Edited Later Inc/)).not.toBeInTheDocument();
    expect(screen.getAllByText("EAA-2026-0042").length).toBeGreaterThan(0);
    // The certification's version and data version, so a packet can be matched to its record.
    expect(screen.getByText("Version").parentElement).toHaveTextContent("v2 · data version 17");
    expect(screen.getByText("Certified").parentElement).toHaveTextContent("May 1, 2026");
    expect(screen.getAllByRole("link", { name: /Back to Review/ })[0]).toHaveAttribute("href", "/start?session=s1");
  });

  it("marks the consent wording the prospect signed as a draft until counsel approves it, as the PDF does", async () => {
    vi.mocked(buildManuscriptPdf).mockClear();
    row = certified({
      submission: {
        ...certified().submission,
        consent_version: "2026-10-draft-1",
        consent_text: ["The information I've provided is accurate.", "By signing, I certify."],
      },
    });
    renderAt("/manuscript/EAA-2026-0042");
    expect(await screen.findByText("Consent wording 2026-10-draft-1 · DRAFT: NOT LEGALLY REVIEWED")).toBeInTheDocument();
    // The watermark is decoration: the line above says it in words, for everyone.
    expect(screen.getByTestId("consent-draft-watermark")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText(/The information I've provided is accurate\./)).toBeInTheDocument();

    // The PDF is built from the same packet, with the same mark (once the PEOs are read).
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Download the packet \(PDF\)/ })[0]).toBeEnabled());
    fireEvent.click(screen.getAllByRole("button", { name: /Download the packet \(PDF\)/ })[0]);
    await waitFor(() => expect(buildManuscriptPdf).toHaveBeenCalled());
    expect(vi.mocked(buildManuscriptPdf).mock.calls[0][0].signer).toMatchObject({ consentVersion: "2026-10-draft-1", consentDraft: true });
  });

  it("marks a certification that recorded no consent wording as a draft too", async () => {
    row = certified();
    renderAt("/manuscript/EAA-2026-0042");
    expect(await screen.findByText("Consent wording not recorded · DRAFT: NOT LEGALLY REVIEWED")).toBeInTheDocument();
  });

  it("puts no draft mark on the unsigned sample", async () => {
    renderAt("/manuscript/demo");
    expect(await screen.findByText("Sample underwriting packet")).toBeInTheDocument();
    expect(screen.queryByText(/DRAFT: NOT LEGALLY REVIEWED/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("consent-draft-watermark")).not.toBeInTheDocument();
  });

  // What the database leaves behind when a signed intake is edited: the status is back to in progress,
  // the draft holds the new answers, and the signed snapshot is still on the submission.
  it("still shows the packet as signed after the answers changed, marked as withdrawn, never the draft", async () => {
    vi.mocked(buildManuscriptPdf).mockClear();
    downloadBlob.mockClear();
    row = {
      chamber_data: { ...EMPTY_CHAMBER_DATA, company_name: "Edited Later Inc" },
      submission: {
        signer_name: "Jo Doe",
        signer_title: "CEO",
        signed_at: "2026-05-01T12:00:00Z",
        file_id: "EAA-2026-ABC",
        // With a census, so the census download is withheld too, not merely absent.
        chamber_data: { ...EMPTY_CHAMBER_DATA, company_name: "Signed Co", census: [{ id: "1", first_name: "A", last_name: "B", work_state: "CA",
          compensation_type: "salary", employment_type: "full_time", classification: "w2" }] },
      },
      status: "in_progress",
      created_at: "2026-05-01T00:00:00Z",
    };
    renderAt("/manuscript?session=s1");
    expect(await screen.findByText("Underwriting packet")).toBeInTheDocument();
    expect(screen.getAllByText(/Signed Co/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Edited Later Inc/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/changed your answers after certifying/);
    expect(screen.getByText(/Certification withdrawn/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to your intake/ })).toHaveAttribute("href", "/start?session=s1");
    // Shown for reference only: nothing to download that could pass as a current certification.
    expect(screen.queryByRole("button", { name: /Download/ })).not.toBeInTheDocument();
    expect(buildManuscriptPdf).not.toHaveBeenCalled();
  });

  it("asks for a new certification when an edited submission has no stored snapshot to show", async () => {
    row = {
      chamber_data: { ...EMPTY_CHAMBER_DATA, company_name: "Edited Later Inc" },
      submission: { signer_name: "Jo Doe", signer_title: "CEO", signed_at: "2026-05-01T12:00:00Z", file_id: "EAA-2026-ABC" },
      status: "in_progress",
      created_at: "2026-05-01T00:00:00Z",
    };
    renderAt("/manuscript?session=s1");
    expect(await screen.findByText(/changed after you certified it/)).toBeInTheDocument();
    expect(screen.queryByText("Underwriting packet")).not.toBeInTheDocument();
    expect(screen.queryByText(/Edited Later Inc/)).not.toBeInTheDocument();
  });

  it("still opens by intake id, and renders the data as signed, not later edits", async () => {
    row = certified();
    renderAt("/manuscript?session=s1");
    expect(await screen.findByText("Underwriting packet")).toBeInTheDocument();
    expect(lastQuery).toEqual({ column: "id", value: "s1" });
    expect(screen.getAllByText(/Signed Co/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Edited Later Inc/)).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    // The packet is prepared for the PEO the prospect chose; nothing says it was submitted to them.
    expect(screen.getByText("Prepared for").parentElement).toHaveTextContent("Prepared forJustworks");
  });

  it("refuses a guessed identifier that isn't a File ID without asking the database, and shows nothing", async () => {
    row = certified();
    renderAt("/manuscript/not-a-file-id");
    expect(await screen.findByText(/couldn't find that packet/)).toBeInTheDocument();
    expect(lastQuery).toBeNull();
    expect(screen.queryByText(/Signed Co/)).not.toBeInTheDocument();
    expect(screen.queryByText("Underwriting packet")).not.toBeInTheDocument();
  });

  it("shows the same safe message for a File ID the database won't return (someone else's, or none)", async () => {
    row = null;
    renderAt("/manuscript/EAA-2026-9999");
    expect(await screen.findByText(/couldn't find that packet/)).toBeInTheDocument();
    expect(lastQuery).toEqual({ column: "file_id", value: "EAA-2026-9999" });
    expect(screen.getByText(/link may be out of date, or it belongs to a different account/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Go to the intake/ })).toHaveAttribute("href", "/start");
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
    expect(screen.queryByText("Underwriting packet")).not.toBeInTheDocument();
    expect(screen.queryByText(/Acme/)).not.toBeInTheDocument();
  });

  it("says an expired intake has expired, shows none of it, and sends the prospect to start again", async () => {
    row = certified({ chamber_data: { ...EMPTY_CHAMBER_DATA, company_name: "Gone Co" }, status: "expired" });
    renderAt("/manuscript/EAA-2026-0042");
    expect(await screen.findByText(/This intake has expired/)).toBeInTheDocument();
    expect(screen.queryByText("Underwriting packet")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Gone Co|Signed Co|Jo Doe/);
    expect(screen.getByRole("link", { name: "Go to the intake" })).toHaveAttribute("href", "/start");
  });

  it("shows every section of the packet, with the documents and confirmed facts the certification recorded", async () => {
    row = certified();
    renderAt("/manuscript/EAA-2026-0042");
    expect(await screen.findByText("Underwriting packet")).toBeInTheDocument();
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

  it("checks eligibility against the chosen PEO's profile in use, as the database holds it", async () => {
    peoCatalogRows = [{ id: 3, name: "Justworks", profile: { version: 1, min_headcount: 10, states_served: null, excluded_class_codes: null, sources: { min_headcount: { kind: "person", name: "Dana Reyes", role: "Broker desk", checked_on: "2026-11-02" } } } }];
    row = certified({ submission: { ...certified().submission, chamber_data: { ...signed, employee_count: 4 } } });
    renderAt("/manuscript?session=s1");
    const readiness = (await screen.findByRole("heading", { name: "11 — Underwriting Readiness" })).closest("section")!;
    await waitFor(() => expect(readiness).toHaveTextContent("Headcount meets Justworks minimum (4 of 10 employees) — not met"));
  });

  it("says when a certification predates the document record", async () => {
    row = certified({ submission: { signer_name: "Jo Doe", signer_title: "CEO", signed_at: "2026-05-01T12:00:00Z", file_id: "EAA-2026-0042", chamber_data: signed } });
    renderAt("/manuscript/EAA-2026-0042");
    expect(await screen.findByText(/Documents were not recorded with this certification/)).toBeInTheDocument();
    expect(screen.getByText("Version").parentElement).toHaveTextContent("Not recorded");
  });

  describe("the final, advisor-reviewed Manuscript", () => {
    const certified = () => ({
      chamber_data: { ...EMPTY_CHAMBER_DATA, company_name: "Signed Co" },
      submission: { signer_name: "Jo Doe", signer_title: "CEO", signed_at: "2026-05-01T12:00:00Z", file_id: "EAA-1", chamber_data: { ...EMPTY_CHAMBER_DATA, company_name: "Signed Co" } },
      status: "submitted",
      created_at: "2026-05-01T00:00:00Z",
    });

    it("labels the page as the intake as certified, before advisor review, when there's no reviewed version", async () => {
      row = certified();
      finalVersions = [];
      renderAt("/manuscript?session=s1");
      expect(await screen.findByText("As certified, before advisor review")).toBeInTheDocument();
      expect(screen.queryByTestId("final-manuscript")).not.toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /Download the packet \(PDF\)/ }).length).toBeGreaterThan(0);
      expect(screen.queryByRole("button", { name: /Download the final packet/ })).not.toBeInTheDocument();
    });

    it("offers the reviewed version as the final packet, through a short-lived link, and keeps the certified copy", async () => {
      row = certified();
      finalVersions = [{ version: 2, storage_path: "s1/v2-x.pdf", generated_at: "2026-05-03T00:00:00Z", corrections_applied: 1 }];
      createSignedUrl.mockReset().mockResolvedValue({ data: { signedUrl: "https://storage.example/final" }, error: null });
      const assign = vi.fn();
      Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });
      renderAt("/manuscript?session=s1");
      const note = await screen.findByTestId("final-manuscript");
      expect(note).toHaveTextContent(/prepared version 2, with 1 correction listed in it/);
      // Both download buttons (top bar and bottom) fetch the final version; neither offers the old label.
      const finals = screen.getAllByRole("button", { name: /Download the final packet \(PDF\)/ });
      expect(finals.length).toBe(2);
      expect(screen.queryByRole("button", { name: /Download the packet \(PDF\)/ })).not.toBeInTheDocument();
      recordManuscriptDownload.mockClear();
      fireEvent.click(finals[0]);
      await waitFor(() => expect(assign).toHaveBeenCalledWith("https://storage.example/final"));
      // The funnel hears of the download once the link was issued.
      expect(recordManuscriptDownload).toHaveBeenCalledWith("s1");
      expect(createSignedUrl).toHaveBeenCalledWith("s1/v2-x.pdf", 60, { download: expect.stringMatching(/^Nevermore_Packet_EAA-1_Signed_Co_.*advisor-v2\.pdf$/) });
      // The prospect's own copy is still there, as the certified copy.
      expect(screen.getByRole("button", { name: /As certified \(PDF\)/ })).toBeInTheDocument();
      finalVersions = [];
    });

    it("says so when the final Manuscript can't be fetched", async () => {
      row = certified();
      finalVersions = [{ version: 1, storage_path: "s1/v1.pdf", generated_at: "2026-05-03T00:00:00Z", corrections_applied: 0 }];
      createSignedUrl.mockReset().mockResolvedValue({ data: null, error: { message: "Object not found" } });
      const { toast } = await import("sonner");
      const error = vi.spyOn(toast, "error");
      renderAt("/manuscript?session=s1");
      recordManuscriptDownload.mockClear();
      fireEvent.click((await screen.findAllByRole("button", { name: /Download the final packet \(PDF\)/ }))[0]);
      await waitFor(() => expect(error).toHaveBeenCalledWith("We couldn't download your final packet. Please try again."));
      // A link that couldn't be issued is not a download.
      expect(recordManuscriptDownload).not.toHaveBeenCalled();
      error.mockRestore();
      finalVersions = [];
    });
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
      expect(await screen.findByText("Underwriting packet")).toBeInTheDocument();
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
    expect(await screen.findByText("Underwriting packet")).toBeInTheDocument();
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

  // QA F11: EAA-2026-0001 was saved with the same unrelated message quoted beside every "Not known yet" field.
  it("shows no source line beside a field with no answer, whatever its stored provenance quotes", async () => {
    const at = "2026-11-05T12:00:00Z";
    const said = { kind: "transcript", message_id: "m2", quote: "Bi-weekly. We have 12 employees, all paid hourly, and we use a small local payroll provider." };
    row = certified({
      submission: {
        signer_name: "Jo Doe",
        signer_title: "CEO",
        signed_at: at,
        file_id: "EAA-2026-0001",
        chamber_data: { ...EMPTY_CHAMBER_DATA, company_name: "Larkspur Plumbing", pay_frequency: "bi-weekly" },
        field_provenance: {
          company_name: { status: "confirmed", source: { kind: "transcript", message_id: "m1", quote: "Larkspur Plumbing" }, updated_at: at },
          pay_frequency: { status: "confirmed", source: { ...said, quote: "Bi-weekly" }, updated_at: at },
          fein_count: { status: "unknown", source: said, updated_at: at },
          start_month: { status: "unknown", source: said, updated_at: at },
          current_carrier: { status: "unknown", source: said, updated_at: at },
          wc_carrier: { status: "not_applicable", source: said, updated_at: at },
        },
      },
    });
    renderAt("/manuscript/EAA-2026-0001");
    expect(await screen.findByText("Underwriting packet")).toBeInTheDocument();
    expect(screen.getByText("From the conversation: “Larkspur Plumbing”")).toBeInTheDocument();
    expect(screen.getByText("From the conversation: “Bi-weekly”")).toBeInTheDocument();
    // Their status still shows; the quote doesn't.
    expect(screen.getAllByText("Not known yet").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/From the conversation: “Bi-weekly\. We have 12 employees/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/^From the conversation/)).toHaveLength(2);
  });

  it("drops the fields an advisor has verified since from the open items", async () => {
    const at = "2026-05-01T12:00:00Z";
    row = {
      chamber_data: EMPTY_CHAMBER_DATA,
      submission: {
        signer_name: "Jo Doe",
        signer_title: "CEO",
        signed_at: at,
        file_id: "EAA-2026-ABC",
        chamber_data: { ...EMPTY_CHAMBER_DATA, company_name: "Signed Co", industry: "Retail" },
        field_provenance: {
          company_name: { status: "inferred", source: { kind: "transcript", message_id: "m1" }, updated_at: at },
          industry: { status: "inferred", source: { kind: "transcript", message_id: "m1" }, updated_at: at },
        },
      },
      status: "submitted",
      created_at: "2026-05-01T00:00:00Z",
    };
    verifiedFields = ["industry"];
    renderAt("/manuscript?session=s1");
    expect(await screen.findByText("Underwriting packet")).toBeInTheDocument();
    expect(screen.getByText("Company legal name — please confirm")).toBeInTheDocument();
    expect(screen.queryByText("Industry — please confirm")).not.toBeInTheDocument();
    expect(screen.getByText("Pay frequency — not provided")).toBeInTheDocument();
    verifiedFields = [];
  });

  it("shows a conflicting field an advisor verified as settled, on screen and in the PDF, and not as an open item", async () => {
    const at = "2026-05-01T12:00:00Z";
    const said = (id: string) => ({ kind: "transcript", message_id: id });
    row = {
      chamber_data: EMPTY_CHAMBER_DATA,
      submission: {
        signer_name: "Jo Doe",
        signer_title: "CEO",
        signed_at: at,
        file_id: "EAA-2026-ABC",
        chamber_data: { ...EMPTY_CHAMBER_DATA, company_name: "Signed Co", industry: "Retail" },
        field_provenance: {
          industry: {
            status: "conflicting",
            source: said("m1"),
            updated_at: at,
            candidates: [
              { value: "Retail", source: said("m1") },
              { value: "Wholesale", source: said("m2") },
            ],
          },
        },
      },
      status: "submitted",
      created_at: "2026-05-01T00:00:00Z",
    };
    verifiedFields = ["industry"];
    vi.mocked(buildManuscriptPdf).mockClear();
    renderAt("/manuscript?session=s1");
    expect(await screen.findByText("Underwriting packet")).toBeInTheDocument();
    // Verified is settled: no red chip, as in the advisor's packet.
    expect(screen.queryByText("Conflicting")).not.toBeInTheDocument();
    expect(screen.queryByText("Industry — conflicting answers")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Download the packet \(PDF\)/ })[0]);
    await waitFor(() => expect(buildManuscriptPdf).toHaveBeenCalled());
    const m = vi.mocked(buildManuscriptPdf).mock.calls[0][0];
    const industry = m.companyRows.find(([label]) => label === "Industry")!;
    expect(rowProvenance(industry, m.provenance)?.status).toBe("confirmed");
    expect(m.open).not.toContain("Industry — conflicting answers");
    verifiedFields = [];
  });

  it("never shows sample data on the live route when no session is given", async () => {
    renderAt("/manuscript");
    expect(await screen.findByText(/Your packet opens from the Certify & sign tab/)).toBeInTheDocument();
    expect(screen.queryByText(/Meridian/)).not.toBeInTheDocument();
    expect(screen.queryByText("Underwriting packet")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Go to the intake/ })).toHaveAttribute("href", "/start");
  });

  it("renders the fictional sample only on the demo route, clearly labelled", async () => {
    renderAt("/manuscript/demo");
    expect(await screen.findByText("Sample underwriting packet")).toBeInTheDocument();
    expect(screen.getByText(/sample packet built from fictional data/)).toBeInTheDocument();
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
      fireEvent.click((await screen.findAllByRole("button", { name: /Download the packet \(PDF\)/ }))[0]);

      await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
      const [blob, filename] = downloadBlob.mock.calls[0];
      expect(filename).toBe("Nevermore_Packet_EAA-2026-0042_v2_Signed_Co_20260501.pdf");
      expect((blob as Blob).type).toBe("application/pdf");
      expect(vi.mocked(buildManuscriptPdf).mock.calls[0][1]).toMatchObject({ revealSensitive: false });
    });

    it("builds the PDF from the same packet the page shows", async () => {
      renderAt("/manuscript/EAA-2026-0042");
      fireEvent.click((await screen.findAllByRole("button", { name: /Download the packet \(PDF\)/ }))[0]);
      await waitFor(() => expect(buildManuscriptPdf).toHaveBeenCalled());
      const packet = vi.mocked(buildManuscriptPdf).mock.calls[0][0];
      expect(packet).toMatchObject({ fileId: "EAA-2026-0042", version: 2, dataVersion: 17, companyName: "Signed & Co." });
      expect(screen.getByText("Version").parentElement).toHaveTextContent("v2 · data version 17");
    });

    it("won't download while the PEOs are loading: the eligibility checks would all read can't tell", async () => {
      peoCatalogReads.push("pending");
      renderAt("/manuscript/EAA-2026-0042");
      const downloads = await screen.findAllByRole("button", { name: /Download the packet \(PDF\)/ });
      // Both of them: the top bar's and the one at the foot of the packet.
      expect(downloads.length).toBe(2);
      for (const download of downloads) expect(download).toBeDisabled();
      expect(screen.getByText("Loading the PEOs' profiles. You can download your packet once they're in.")).toBeInTheDocument();
      for (const download of downloads) fireEvent.click(download);
      expect(downloadBlob).not.toHaveBeenCalled();
    });

    it("won't download the packet as certified while the PEOs are loading, but offers the advisor's final packet", async () => {
      peoCatalogReads.push("pending");
      finalVersions = [{ version: 2, storage_path: "s1/v2-x.pdf", generated_at: "2026-05-03T00:00:00Z", corrections_applied: 0 }];
      renderAt("/manuscript/EAA-2026-0042");
      expect(await screen.findByRole("button", { name: /As certified \(PDF\)/ })).toBeDisabled();
      for (const final of screen.getAllByRole("button", { name: /Download the final packet \(PDF\)/ })) expect(final).toBeEnabled();
      finalVersions = [];
    });

    it("says when the PEOs couldn't be read, won't download until they are, and reads them again on request", async () => {
      peoCatalogReads.push("error");
      vi.spyOn(console, "warn").mockImplementation(() => {});
      renderAt("/manuscript/EAA-2026-0042");
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "We couldn't load the PEOs' profiles, so your packet's eligibility checks can't be run. Try again before downloading.",
      );
      expect(screen.getAllByRole("button", { name: /Download the packet \(PDF\)/ })[0]).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      await waitFor(() => expect(screen.getAllByRole("button", { name: /Download the packet \(PDF\)/ })[0]).toBeEnabled());
      fireEvent.click(screen.getAllByRole("button", { name: /Download the packet \(PDF\)/ })[0]);
      await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    });

    it("tells the user when the PDF can't be generated", async () => {
      vi.mocked(buildManuscriptPdf).mockImplementationOnce(() => { throw new Error("boom"); });
      renderAt("/manuscript/EAA-2026-0042");
      fireEvent.click((await screen.findAllByRole("button", { name: /Download the packet \(PDF\)/ }))[0]);
      await waitFor(() => expect(buildManuscriptPdf).toHaveBeenCalled());
      expect(downloadBlob).not.toHaveBeenCalled();
      // The button is usable again for a retry.
      await waitFor(() => expect(screen.getAllByRole("button", { name: /Download the packet \(PDF\)/ })[0]).toBeEnabled());
    });
  });

  it("offers the certified census as a file to send with the packet, never a census added after signing", async () => {
    downloadBlob.mockClear();
    const signedCensus = [{ id: "1", first_name: "Signed", last_name: "Person", work_state: "CA" }];
    const base = certified();
    row = certified({
      chamber_data: { ...base.chamber_data, census: [{ id: "2", first_name: "Added", last_name: "Later" }] },
      submission: { ...base.submission, chamber_data: { ...signed, census: signedCensus } },
    });
    peoCatalogRows = [{ id: 3, name: "Justworks", profile: null }, { id: 5, name: "TriNet", listed: false, profile: null }];
    renderAt("/manuscript/EAA-2026-0042");
    fireEvent.click(await screen.findByRole("button", { name: "Download the census" }));
    // The layouts offered are the listed PEOs' only.
    await waitFor(() => expect(screen.getAllByRole("option").map((o) => o.textContent).slice(1)).toEqual(["Justworks"]));
    const [blob, name] = downloadBlob.mock.calls.at(-1)!;
    expect(name).toBe("EAA-2026-0042-census.csv");
    const csv = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(blob as Blob);
    });
    expect(csv).toContain("Signed,Person");
    expect(csv).not.toContain("Added");
  });

  it("offers no census download when the certified packet has no census", async () => {
    row = certified();
    renderAt("/manuscript/EAA-2026-0042");
    await screen.findByText("Underwriting packet");
    expect(screen.queryByRole("button", { name: "Download the census" })).not.toBeInTheDocument();
  });
});
