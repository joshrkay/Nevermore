import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import type { Manuscript } from "@/data/manuscript";
import type { Supplement } from "@/data/peoSupplement";
import { workersCompFilename, type WorkersCompApplication } from "@/data/workersCompApplication";
import type { SubmissionDetail } from "@/lib/advisorApi";
import { toast } from "sonner";
import { blobBytes, blobText } from "@/test/blob";
import { unzip } from "@/test/zip";

const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "adv@example.com" }, signOut }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const api = {
  loadSubmission: vi.fn(),
  listEmailProblems: vi.fn(),
  setStatus: vi.fn(),
  setNeedsAction: vi.fn(),
  requestInformation: vi.fn(),
  addNote: vi.fn(),
  reviewField: vi.fn(),
  saveManuscriptVersion: vi.fn(),
  manuscriptUrl: vi.fn(),
  documentUrl: vi.fn(),
  recordQuoteSend: vi.fn(),
  updateQuoteRequest: vi.fn(),
  documentFile: vi.fn(),
  addQuoteRequestNote: vi.fn(),
  openQuoteRequestThread: vi.fn(),
  mailAttachmentUrl: vi.fn(),
  correctQuoteRequestNote: vi.fn(),
  reissueQuoteRequestAddress: vi.fn(),
  recordActivity: vi.fn(),
};
vi.mock("@/lib/advisorApi", () => api);
// The intake as the database holds it at a download's click: what the page loaded, unless a test changes it since.
let intakeNow: { status: string; data_sha256: string | null; version: string | null } | null = null;
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => {
      const loaded = (await api.loadSubmission.mock.results.at(-1)?.value) as SubmissionDetail;
      const v = loaded.submission?.version;
      return { data: intakeNow ?? { status: loaded.intakeStatus, data_sha256: loaded.submission?.data_sha256 ?? null, version: v === undefined ? null : String(v) }, error: null };
    } }) }) }),
  },
}));
const downloadBlob = vi.fn();
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: (...a: unknown[]) => downloadBlob(...a) }));
const buildManuscriptPdf = vi.fn((m: Manuscript, _opts?: unknown) => ({ blob: new Blob(["%PDF"]), filename: `${m.fileId}.pdf`, pageCount: 1 }));
vi.mock("@/lib/manuscriptPdf", () => ({ buildManuscriptPdf: (m: Manuscript, o: unknown) => buildManuscriptPdf(m, o) }));
const buildSupplementPdf = vi.fn((s: Supplement) => ({ blob: new Blob(["%PDF"]), filename: `${s.fileId}-${s.peo}.pdf`, pageCount: 1 }));
vi.mock("@/lib/supplementPdf", () => ({ buildSupplementPdf: (s: Supplement) => buildSupplementPdf(s) }));
const buildWorkersCompPdf = vi.fn((a: WorkersCompApplication) => ({ blob: new Blob(["%PDF"]), filename: workersCompFilename(a), pageCount: 1 }));
vi.mock("@/lib/workersCompPdf", () => ({ buildWorkersCompPdf: (a: WorkersCompApplication) => buildWorkersCompPdf(a) }));

// The PEOs the database lists (public.peo_catalog()), as src/lib/peoCatalog.ts reads them.
let peoCatalogRows: unknown = [];
// Set to make the next reads hang or fail; each read takes the next one, then the rows above are read.
const peoCatalogReads: (() => Promise<unknown>)[] = [];
vi.mock("@/lib/peoCatalog", async () => {
  const { parsePeoCatalog } = await import("@/data/peoProfiles");
  return { readPeoCatalog: async () => parsePeoCatalog(await (peoCatalogReads.shift()?.() ?? peoCatalogRows)) };
});

const { default: AdvisorSubmissionPage } = await import("./AdvisorSubmissionPage");

const signedData = { ...EMPTY_CHAMBER_DATA, company_name: "Signed Co", employee_count: 12, pay_frequency: "Bi-weekly" };

const detail = (over: Partial<SubmissionDetail> = {}): SubmissionDetail => ({
  id: "s1",
  userId: "prospect-1",
  fileId: "EAA-2026-S1",
  intakeStatus: "submitted",
  pipelineStatus: "submitted",
  needsAction: { on: false, note: null, at: null, by: null, byEmail: null },
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  source: { referral_code: null, utm_source: null, utm_medium: null, utm_campaign: null },
  sourcePartnerName: null,
  data: signedData,
  // As stored: only what the prospect gave, before the browser fills in empty fields.
  storedAnswers: { company_name: "Signed Co", employee_count: 12, pay_frequency: "Bi-weekly" },
  provenance: {
    employee_count: {
      status: "inferred",
      source: { kind: "transcript", message_id: "m2", quote: "about a dozen people" },
      updated_at: "2026-10-01T00:00:00Z",
    },
  },
  certified: true,
  signed: null,
  submission: {
    signer_name: "Jo Doe",
    signer_title: "CEO",
    signed_at: "2026-10-01T12:00:00Z",
    certified_at: "2026-10-01T12:00:05Z",
    data_sha256: "c".repeat(64),
    file_id: "EAA-2026-S1",
    chamber_data: signedData,
  },
  transcript: [
    { id: "m1", sender: "lenore", text: "How many people work for you?", timestamp: "9:00" },
    { id: "m2", sender: "user", text: "We're about a dozen people.", timestamp: "9:01" },
  ],
  contactName: "Pat Prospect",
  phone: null,
  history: [
    { id: 2, session_id: "s1", from_status: "draft", to_status: "submitted", note: "Prospect certified the intake", changed_by: "prospect-1", changed_by_email: null, changed_at: "2026-10-01T12:00:05Z" },
    { id: 1, session_id: "s1", from_status: null, to_status: "draft", note: "Intake started", changed_by: "prospect-1", changed_by_email: null, changed_at: "2026-10-01T00:00:00Z" },
  ],
  notes: [],
  reviews: {},
  reviewEvents: [],
  versions: [],
  transcriptChangedSinceCertified: false,
  documents: [
    { id: "d1", file_name: "census.xlsx", file_size: "12 KB", category: "employee_census", status: "uploaded", storage_path: "prospect-1/x_census.xlsx", created_at: "2026-10-01T00:00:00Z" },
  ],
  documentEvents: [],
  informationRequests: [],
  quoteRequests: [],
  quoteRequestEvents: [],
  quoteRequestNotes: [],
  quoteRequestAddresses: [],
  quoteRequestMessages: [],
  quoteRequestMailAttachments: [],
  quoteRequestThreadReads: [],
  currentVersion: 1,
  certificationLacksSnapshot: false,
  extraAnswers: {},
  wonQuoteRequestId: null,
  ...over,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/advisor/submissions/s1"]}>
      <Routes>
        <Route path="/advisor/submissions/:id" element={<AdvisorSubmissionPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("AdvisorSubmissionPage", () => {
  // A test that fakes the clock gets the real one back even when it fails.
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    peoCatalogRows = [];
    peoCatalogReads.length = 0;
    for (const fn of Object.values(api)) fn.mockReset();
    vi.mocked(toast.error).mockReset();
    downloadBlob.mockReset();
    buildManuscriptPdf.mockClear();
    api.loadSubmission.mockResolvedValue(detail());
    api.listEmailProblems.mockResolvedValue([]);
    intakeNow = null;
  });

  // CRM-P2.3: the firm's record of who did what. What is reported is the kind and the id of the record, never its content.
  it("records that the submission was opened, once, and not when it is not found", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Signed Co" });
    await waitFor(() => expect(api.recordActivity).toHaveBeenCalledWith("submission_viewed", "submission", "s1"));
    expect(api.recordActivity).toHaveBeenCalledTimes(1);
  });

  it("records nothing for a submission it can't find", async () => {
    api.loadSubmission.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByText("Submission not found.")).toBeInTheDocument();
    expect(api.recordActivity).not.toHaveBeenCalled();
  });

  it("records a document opened", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });
    api.documentUrl.mockResolvedValue("https://storage.example/doc");
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Open census.xlsx" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://storage.example/doc"));
    expect(api.recordActivity).toHaveBeenCalledWith("document_downloaded", "document", "d1");
  });

  it("shows every captured field with its source, the transcript and the documents", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Signed Co" })).toBeInTheDocument();
    expect(api.loadSubmission).toHaveBeenCalledWith("s1");
    expect(screen.getByText(/Certified by Jo Doe, CEO/)).toBeInTheDocument();
    const count = screen.getByTestId("field-employee_count");
    expect(within(count).getByText("12")).toBeInTheDocument();
    expect(within(count).getByText(/about a dozen people/)).toBeInTheDocument();
    expect(screen.getByTestId("field-hris_system")).toHaveTextContent("No source recorded");
    expect(screen.getByText("census.xlsx")).toBeInTheDocument();
    expect(screen.getByText(/Employee census · 12 KB/)).toBeInTheDocument();

    fireEvent.click(within(count).getByRole("button", { name: "View in transcript" }));
    expect(screen.getByText("We're about a dozen people.").closest("li")).toHaveAttribute("aria-current", "true");
  });

  it("says where the intake came from: the partner who referred it and the campaign tags, or that it had no tagged link", async () => {
    api.loadSubmission.mockResolvedValue(
      detail({
        source: { referral_code: "acme-cfo", utm_source: "partner", utm_medium: null, utm_campaign: null },
        sourcePartnerName: "Acme CFO Partners",
      }),
    );
    const { unmount } = renderPage();
    expect(await screen.findByText("Source: Referred by Acme CFO Partners · Campaign: partner")).toBeInTheDocument();
    unmount();

    api.loadSubmission.mockResolvedValue(detail());
    renderPage();
    expect(await screen.findByText("Source: No tagged link")).toBeInTheDocument();
  });

  it("groups the fields into The Manuscript's seven sections, the census table in Workforce", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Signed Co" });
    const fields = screen.getByRole("region", { name: "Captured fields" });
    const sections = within(fields).getAllByRole("region").filter((r) => r.dataset.testid?.startsWith("section-"));
    expect(sections.map((r) => within(r).getAllByRole("heading")[0].textContent)).toEqual([
      "Company", "Workforce", "Locations", "Payroll", "Benefits", "Workers' comp", "Operations & HR",
    ]);
    expect(within(screen.getByTestId("section-company")).getByTestId("field-company_name")).toBeInTheDocument();
    expect(within(screen.getByTestId("section-payroll")).getByTestId("field-pay_frequency")).toBeInTheDocument();
    const workforce = screen.getByTestId("section-workforce");
    expect(within(workforce).getByTestId("field-employee_count")).toBeInTheDocument();
    expect(within(workforce).getByTestId("field-census")).toBeInTheDocument();
    expect(within(workforce).getByRole("heading", { name: "Employee census" })).toBeInTheDocument();
    // Every field is in exactly one section.
    const rows = within(fields).getAllByTestId(/^field-/);
    expect(new Set(rows.map((r) => r.dataset.testid)).size).toBe(rows.length);
    expect(within(fields).getByRole("navigation", { name: "Field sections" })).toHaveTextContent("CompanyWorkforceLocations");
  });

  it("badges the prospect's confirmed answers and the advisor's overrides, with totals at the top", async () => {
    api.loadSubmission.mockResolvedValue(
      detail({
        provenance: {
          company_name: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: "2026-10-01T00:00:00Z" },
          pay_frequency: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: "2026-10-01T00:00:00Z" },
          employee_count: { status: "inferred", source: { kind: "transcript", message_id: "m2" }, updated_at: "2026-10-01T00:00:00Z" },
        },
        reviews: {
          pay_frequency: {
            field: "pay_frequency", review_state: "verified", has_correction: true, corrected_value: "Weekly",
            reason: "Payroll register", updated_by_email: "adv@example.com", updated_at: "2026-10-02T00:00:00Z",
          },
          employee_count: {
            field: "employee_count", review_state: "follow_up", has_correction: true, corrected_value: 14,
            reason: "Payroll", updated_by_email: "adv@example.com", updated_at: "2026-10-02T00:00:00Z",
          },
        },
      }),
    );
    renderPage();
    await screen.findByRole("heading", { name: "Signed Co" });
    expect(screen.getByTestId("audit-summary-prospect_confirmed")).toHaveTextContent("Prospect confirmed· 1");
    expect(screen.getByTestId("audit-summary-advisor_overridden")).toHaveTextContent("Advisor overridden· 1");
    expect(within(screen.getByTestId("field-company_name")).getByTestId("audit-prospect_confirmed")).toBeInTheDocument();
    // The override replaces the prospect's confirmed answer, so it shows as overridden, not confirmed.
    const pay = screen.getByTestId("field-pay_frequency");
    expect(within(pay).getByTestId("audit-advisor_overridden")).toHaveTextContent("Advisor overridden");
    expect(within(pay).queryByTestId("audit-prospect_confirmed")).not.toBeInTheDocument();
    // A correction not yet verified overrides nothing, and an inferred answer isn't the prospect's confirmation.
    expect(within(screen.getByTestId("field-employee_count")).queryByTestId(/^audit-/)).not.toBeInTheDocument();
    expect(screen.getByTestId("section-summary-payroll")).toHaveTextContent("1 of 6 verified · 1 advisor overridden");
    expect(screen.getByTestId("section-summary-company")).toHaveTextContent("0 of 16 verified · 1 prospect confirmed");
  });

  it("changes the status with a note and shows who changed it before", async () => {
    renderPage();
    const panel = (await screen.findByRole("heading", { name: "Status" })).closest("section")!;
    expect(within(panel).getAllByText(/^Prospect ·/).length).toBe(2);
    fireEvent.change(within(panel).getByLabelText("Change status to"), { target: { value: "information_requested" } });
    expect(within(panel).getByText(/The prospect will see/)).toBeInTheDocument();
    fireEvent.change(within(panel).getByLabelText("Change status to"), { target: { value: "lost" } });
    // An internal status leaves the prospect with their last shared one.
    expect(within(panel).getByText(/The prospect will see: “Received\. .*” \(the status itself stays internal\)/)).toBeInTheDocument();
    fireEvent.change(within(panel).getByLabelText("Internal note (optional)"), { target: { value: "Went with incumbent" } });
    api.setStatus.mockResolvedValue(undefined);
    fireEvent.click(within(panel).getByRole("button", { name: "Update status" }));
    await waitFor(() => expect(api.setStatus).toHaveBeenCalledWith("s1", "lost", "Went with incumbent"));
    await waitFor(() => expect(api.loadSubmission).toHaveBeenCalledTimes(2));
    expect(within(panel).queryByRole("option", { name: "Draft" })).not.toBeInTheDocument();
  });

  it("asks the prospect for information about the answers marked Needs follow-up, and lists what was asked", async () => {
    const review = (field: string, state: string) => ({
      field, review_state: state, has_correction: false, corrected_value: null, reason: null, updated_by_email: "adv@example.com", updated_at: "2026-10-02T00:00:00Z",
    });
    api.loadSubmission.mockResolvedValue(detail({
      reviews: { pay_frequency: review("pay_frequency", "follow_up"), census: review("census", "follow_up"), company_name: review("company_name", "verified") } as SubmissionDetail["reviews"],
      informationRequests: [
        { id: 1, session_id: "s1", message: "Is the HQ still in New York?", fields: ["hq_state"], extra_questions: [], requested_by: "adv-1", requested_by_email: "adv@example.com", requested_at: "2026-10-03T09:00:00Z" },
      ],
    }));
    renderPage();
    const panel = (await screen.findByRole("heading", { name: "Ask the prospect" })).closest("section")!;
    // The follow-ups start selected, in Review's order (the census with Workforce, before Payroll).
    expect(within(within(panel).getByRole("list", { name: "Answers the request is about" })).getAllByRole("listitem").map((li) => li.textContent))
      .toEqual(["Employee census", "Pay frequency"]);
    expect(within(panel).getByText("Is the HQ still in New York?")).toBeInTheDocument();
    expect(within(panel).getByText("About: HQ state")).toBeInTheDocument();

    const send = within(panel).getByRole("button", { name: "Send request" });
    expect(send).toBeDisabled();
    fireEvent.click(within(panel).getByRole("button", { name: "Remove Employee census" }));
    fireEvent.change(within(panel).getByLabelText("Add an answer"), { target: { value: "payroll_vendor" } });
    fireEvent.change(within(panel).getByLabelText("What do you need from them?"), { target: { value: "Which payroll vendor, and how often do you pay?" } });
    api.requestInformation.mockResolvedValue(undefined);
    fireEvent.click(send);
    await waitFor(() => expect(api.requestInformation).toHaveBeenCalledWith("s1", "Which payroll vendor, and how often do you pay?", ["pay_frequency", "payroll_vendor"], []));
    await waitFor(() => expect(api.loadSubmission).toHaveBeenCalledTimes(2));
  });

  it("adds an answer marked Needs follow-up after the page loaded, keeping the advisor's own choices and message", async () => {
    const review = (field: string, state: string) => ({
      field, review_state: state, has_correction: false, corrected_value: null, reason: null, updated_by_email: "adv@example.com", updated_at: "2026-10-02T00:00:00Z",
    });
    api.loadSubmission.mockResolvedValue(detail({ reviews: { pay_frequency: review("pay_frequency", "follow_up") } as SubmissionDetail["reviews"] }));
    api.reviewField.mockResolvedValue(undefined);
    renderPage();
    const panel = (await screen.findByRole("heading", { name: "Ask the prospect" })).closest("section")!;
    const chosen = () => within(within(panel).getByRole("list", { name: "Answers the request is about" })).getAllByRole("listitem").map((li) => li.textContent);
    fireEvent.change(within(panel).getByLabelText("What do you need from them?"), { target: { value: "Two things, please." } });
    fireEvent.change(within(panel).getByLabelText("Add an answer"), { target: { value: "payroll_vendor" } });
    expect(chosen()).toEqual(["Pay frequency", "Payroll vendor"]);

    // The advisor marks HQ state for follow-up in the field review; the page reloads the submission.
    api.loadSubmission.mockResolvedValue(detail({
      reviews: { pay_frequency: review("pay_frequency", "follow_up"), hq_state: review("hq_state", "follow_up") } as SubmissionDetail["reviews"],
    }));
    fireEvent.click(within(panel).getByRole("button", { name: "Remove Pay frequency" }));
    await act(async () => {
      // Any change that reloads the page: the Status panel's update does.
      const status = (screen.getByRole("heading", { name: "Status" })).closest("section")!;
      api.setStatus.mockResolvedValue(undefined);
      fireEvent.change(within(status).getByLabelText("Change status to"), { target: { value: "under_review" } });
      fireEvent.click(within(status).getByRole("button", { name: "Update status" }));
    });
    await waitFor(() => expect(chosen()).toEqual(["HQ state", "Payroll vendor"]));
    expect(within(panel).getByLabelText("What do you need from them?")).toHaveValue("Two things, please.");
  });

  it("says why a request can't be sent, and offers no form", async () => {
    api.loadSubmission.mockResolvedValue(detail({ pipelineStatus: "won" }));
    renderPage();
    const panel = (await screen.findByRole("heading", { name: "Ask the prospect" })).closest("section")!;
    expect(within(panel).getByText("A submission at Won can't move to Information requested.")).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Send request" })).not.toBeInTheDocument();
  });

  it("shows the database's refusal and keeps the message", async () => {
    api.loadSubmission.mockResolvedValue(detail());
    api.requestInformation.mockRejectedValue(new Error("The prospect's account has no email address to send this to"));
    renderPage();
    const panel = (await screen.findByRole("heading", { name: "Ask the prospect" })).closest("section")!;
    fireEvent.change(within(panel).getByLabelText("What do you need from them?"), { target: { value: "Send the register" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("The prospect's account has no email address to send this to"));
    expect(within(panel).getByLabelText("What do you need from them?")).toHaveValue("Send the register");
  });

  it("offers only Archived for an intake the prospect has never certified", async () => {
    api.loadSubmission.mockResolvedValue(detail({ certified: false, intakeStatus: "in_progress", submission: null, pipelineStatus: "draft" }));
    renderPage();
    const panel = (await screen.findByRole("heading", { name: "Status" })).closest("section")!;
    const select = within(panel).getByLabelText("Change status to");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Draft (current)", "Archived"]);
    expect(within(panel).getByText(/can only be archived\. They see no status until they certify/)).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Update status" })).toBeDisabled();
    fireEvent.change(select, { target: { value: "archived" } });
    api.setStatus.mockResolvedValue(undefined);
    fireEvent.click(within(panel).getByRole("button", { name: "Update status" }));
    await waitFor(() => expect(api.setStatus).toHaveBeenCalledWith("s1", "archived", ""));
  });

  it("offers nothing for an archived intake the prospect never certified", async () => {
    api.loadSubmission.mockResolvedValue(detail({ certified: false, intakeStatus: "in_progress", submission: null, pipelineStatus: "archived" }));
    renderPage();
    const panel = (await screen.findByRole("heading", { name: "Status" })).closest("section")!;
    expect(within(panel).getByLabelText("Change status to")).toBeDisabled();
    expect(within(panel).getByText("No status change is available.")).toBeInTheDocument();
    expect(within(panel).getByText(/returns as Submitted if they certify/)).toBeInTheDocument();
  });

  it("says the prospect sees nothing while their certification is withdrawn", async () => {
    api.loadSubmission.mockResolvedValue(detail({ certified: false, intakeStatus: "in_progress", pipelineStatus: "under_review" }));
    renderPage();
    const panel = (await screen.findByRole("heading", { name: "Status" })).closest("section")!;
    expect(within(panel).getAllByRole("option").length).toBe(5);
    expect(within(panel).getByText(/sees no status while their certification is withdrawn; once they certify again/)).toBeInTheDocument();
  });

  it("offers only the next steps from the current status, one at a time (F-4.1)", async () => {
    const reviewing = { id: 3, session_id: "s1", from_status: "submitted", to_status: "under_review", note: null, changed_by: "a1", changed_by_email: "adv@example.com", changed_at: "2026-10-02T12:00:00Z" };
    api.loadSubmission.mockResolvedValue(detail({ pipelineStatus: "under_review", history: [reviewing, ...detail().history] }));
    renderPage();
    const panel = (await screen.findByRole("heading", { name: "Status" })).closest("section")!;
    const select = within(panel).getByLabelText("Change status to");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Under review (current)", "Information requested", "Ready for market", "Lost", "Archived",
    ]);
    expect(within(panel).getByText("From Under review it can move to Information requested, Ready for market, Lost, Archived.")).toBeInTheDocument();
    // Ready for market is internal: the prospect keeps their last shared status.
    fireEvent.change(select, { target: { value: "ready_for_market" } });
    expect(within(panel).getByText(/The prospect will see: “An advisor is reviewing your submission\.” \(the status itself stays internal\)/)).toBeInTheDocument();
    api.setStatus.mockResolvedValue(undefined);
    fireEvent.click(within(panel).getByRole("button", { name: "Update status" }));
    await waitFor(() => expect(api.setStatus).toHaveBeenCalledWith("s1", "ready_for_market", ""));
  });

  it("reopens an archived file as submitted, never straight to under review", async () => {
    api.loadSubmission.mockResolvedValue(detail({ pipelineStatus: "archived" }));
    renderPage();
    const panel = (await screen.findByRole("heading", { name: "Status" })).closest("section")!;
    const select = within(panel).getByLabelText("Change status to");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Archived (current)", "Submitted (reopen)"]);
    expect(within(select).queryByRole("option", { name: "Under review" })).not.toBeInTheDocument();
  });

  it("only archives a certification the prospect withdrew at Submitted, until they certify again", async () => {
    api.loadSubmission.mockResolvedValue(detail({ certified: false, intakeStatus: "in_progress", pipelineStatus: "draft" }));
    renderPage();
    const panel = (await screen.findByRole("heading", { name: "Status" })).closest("section")!;
    expect(within(within(panel).getByLabelText("Change status to")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Draft (current)", "Archived"]);
    expect(within(panel).getByText(/withdrew their certification by changing an answer, so it can only be archived/)).toBeInTheDocument();
  });

  it("says certifying again answers an open request for information", async () => {
    api.loadSubmission.mockResolvedValue(detail({ certified: false, intakeStatus: "in_progress", pipelineStatus: "information_requested" }));
    renderPage();
    const panel = (await screen.findByRole("heading", { name: "Status" })).closest("section")!;
    expect(within(panel).getByLabelText("Change status to")).toHaveValue("information_requested");
    expect(within(panel).getByText(/once they certify again: “Received\. An advisor will review your submission\.”/)).toBeInTheDocument();
  });

  it("marks the submission as needing advisor action, with a note", async () => {
    renderPage();
    const panel = (await screen.findByRole("heading", { name: "Needs advisor action" })).closest("section")!;
    expect(within(panel).getByText(/the prospect never sees it/)).toBeInTheDocument();
    fireEvent.change(within(panel).getByLabelText("What needs doing (optional)"), { target: { value: "Call the CFO" } });
    api.setNeedsAction.mockResolvedValue(undefined);
    fireEvent.click(within(panel).getByRole("button", { name: "Mark as needing advisor action" }));
    await waitFor(() => expect(api.setNeedsAction).toHaveBeenCalledWith("s1", true, "Call the CFO"));
    await waitFor(() => expect(api.loadSubmission).toHaveBeenCalledTimes(2));
  });

  it("shows who marked it and why, at the top and in its panel, and clears it", async () => {
    api.loadSubmission.mockResolvedValue(
      detail({ needsAction: { on: true, note: "Call the CFO", at: "2026-10-02T12:00:00Z", by: "a1", byEmail: "adv@example.com" } }),
    );
    renderPage();
    const heading = await screen.findByRole("heading", { level: 1, name: "Signed Co" });
    expect(heading.parentElement).toHaveTextContent("Needs advisor action");
    const panel = screen.getByRole("heading", { name: "Needs advisor action" }).closest("section")!;
    expect(within(panel).getByText("Call the CFO")).toBeInTheDocument();
    expect(within(panel).getByText(/Marked by adv@example\.com/)).toBeInTheDocument();
    fireEvent.change(within(panel).getByLabelText("What was done (optional)"), { target: { value: "Spoke to the CFO" } });
    api.setNeedsAction.mockResolvedValue(undefined);
    fireEvent.click(within(panel).getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(api.setNeedsAction).toHaveBeenCalledWith("s1", false, "Spoke to the CFO"));
  });

  it("doesn't show the needs-action badge on a submission nobody marked", async () => {
    renderPage();
    const heading = await screen.findByRole("heading", { level: 1, name: "Signed Co" });
    expect(heading.parentElement).not.toHaveTextContent("Needs advisor action");
  });

  it("shows a history row that kept the status as the status and its note, not a change", async () => {
    api.loadSubmission.mockResolvedValue(
      detail({
        pipelineStatus: "quoted",
        history: [
          { id: 3, session_id: "s1", from_status: "quoted", to_status: "quoted", note: "Prospect certified the intake again", changed_by: "prospect-1", changed_by_email: null, changed_at: "2026-10-03T12:00:00Z" },
          { id: 2, session_id: "s1", from_status: "submitted", to_status: "quoted", note: null, changed_by: "a1", changed_by_email: "adv@example.com", changed_at: "2026-10-02T12:00:00Z" },
        ],
      }),
    );
    renderPage();
    const history = await screen.findByRole("list", { name: "Status history" });
    const [kept, changed] = within(history).getAllByRole("listitem");
    expect(kept).toHaveTextContent(/^Quoted/);
    expect(kept).not.toHaveTextContent("Quoted → Quoted");
    expect(kept).toHaveTextContent("Prospect certified the intake again");
    expect(changed).toHaveTextContent("Submitted → Quoted");
  });

  it("marks documents removed, added or re-categorised after certification, with who and when", async () => {
    api.loadSubmission.mockResolvedValue(
      detail({
        documents: [
          { id: "d3", file_name: "late.pdf", file_size: "1 KB", category: "other", status: "uploaded", storage_path: "p/s/late.pdf", created_at: "2026-10-04T00:00:00Z", certification: "added" },
          { id: "d2", file_name: "losses.pdf", file_size: "40 KB", category: "workers_comp_loss_runs", status: "uploaded", storage_path: "p/s/losses.pdf", created_at: "2026-10-01T00:00:00Z", certification: "removed" },
          { id: "d1", file_name: "census.xlsx", file_size: "12 KB", category: "other", status: "uploaded", storage_path: "p/s/census.xlsx", created_at: "2026-10-01T00:00:00Z", certification: "certified", certifiedCategory: "employee_census" },
        ],
        documentEvents: [
          { id: 3, session_id: "s1", document_id: "d2", kind: "removed", file_name: "losses.pdf", from_value: "workers_comp_loss_runs", to_value: null, actor_id: "prospect-1", actor_email: "p@example.com", created_at: "2026-10-03T00:00:00Z", storage_path: "p/s/losses.pdf" },
          { id: 2, session_id: "s1", document_id: "d1", kind: "recategorised", file_name: "census.xlsx", from_value: "employee_census", to_value: "other", actor_id: "prospect-1", actor_email: "p@example.com", created_at: "2026-10-02T00:00:00Z", storage_path: "p/s/census.xlsx" },
        ],
      }),
    );
    renderPage();
    const removed = await screen.findByTestId("document-d2");
    expect(removed).toHaveTextContent(/Removed after certification by Prospect · .*The certified file is kept for review/);
    expect(within(removed).getByRole("button", { name: "Open losses.pdf" })).toBeEnabled();
    expect(screen.getByTestId("document-d3")).toHaveTextContent("Added after certification. Not part of what was certified.");
    expect(screen.getByTestId("document-d1")).toHaveTextContent(/Certified as Employee census; re-categorised by Prospect · /);
  });

  it("shows each employee's dependents, the tier the Manuscript prints, and the PEO the packet is prepared for", async () => {
    const census = [
      { id: "e1", first_name: "Ann", last_name: "Lee", dob: "1980-02-03", work_state: "CA", classification: "w2" as const, compensation_type: "salary" as const, employment_type: "full_time" as const,
        dependents: [
          { first_name: "Bo", last_name: "Lee", dob: "1981-04-05", relationship: "spouse" as const },
          { first_name: "Cy", last_name: "Lee", dob: "2015-06-07", relationship: "child" as const },
        ] },
      { id: "e2", first_name: "Dee", last_name: "Ray", dob: "1990-01-01", work_state: "CA", classification: "w2" as const, compensation_type: "salary" as const, employment_type: "full_time" as const, coverage_tier: "WAIVE" as const },
      { id: "e3", first_name: "Flo", last_name: "Kay", dob: "1985-01-01", work_state: "CA", classification: "1099" as const, compensation_type: "hourly" as const, employment_type: "part_time" as const,
        dependents: [{ first_name: "Gil", last_name: "Kay", dob: "1986-01-01", relationship: "spouse" as const }] },
    ];
    const data = { ...signedData, census };
    api.loadSubmission.mockResolvedValue(detail({ data, submission: { ...detail().submission!, peo: "Acme PEO" } }));
    renderPage();
    expect(await screen.findByText(/Certified by Jo Doe, CEO · .* · Prepared for Acme PEO/)).toBeInTheDocument();
    const ann = screen.getByRole("list", { name: "Dependents of Ann Lee" });
    expect(within(ann).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Bo Lee · Spouse · 1981-04-05", "Cy Lee · Child · 2015-06-07"]);
    const rows = screen.getByRole("heading", { name: "Employee census" }).closest("section")!.querySelectorAll("tbody tr");
    expect(rows[0]).toHaveTextContent("Employee + Family");
    expect(rows[0]).toHaveTextContent("from dependents");
    expect(rows[1]).toHaveTextContent("Waived");
    expect(rows[1]).toHaveTextContent("None");
    // A contractor has no benefits tier, as the Manuscript prints it.
    expect(rows[2]).toHaveTextContent("Not applicable");
    expect(rows[2]).not.toHaveTextContent("Employee + Spouse");
  });

  it("says when the transcript shown is the certified copy of one that has changed since", async () => {
    api.loadSubmission.mockResolvedValue(detail({ transcriptChangedSinceCertified: true }));
    renderPage();
    expect(await screen.findByText(/Showing the conversation as the prospect certified it\. It has changed since\./)).toBeInTheDocument();
  });

  it("adds an internal note", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Signed Co" });
    api.addNote.mockResolvedValue(undefined);
    fireEvent.change(screen.getByLabelText("New note"), { target: { value: "Called the CFO" } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    await waitFor(() => expect(api.addNote).toHaveBeenCalledWith("s1", "Called the CFO"));
  });

  it("marks a field verified, and records a correction with its reason beside the prospect's value", async () => {
    renderPage();
    const row = await screen.findByTestId("field-employee_count");
    api.reviewField.mockResolvedValue(undefined);
    fireEvent.click(within(row).getByRole("button", { name: "Verified" }));
    // The review names the stored answer the advisor was looking at.
    await waitFor(() => expect(api.reviewField).toHaveBeenCalledWith("s1", "employee_count", "verified", { kind: "keep" }, "", 12));

    fireEvent.click(within(row).getByRole("button", { name: "Correct" }));
    fireEvent.change(within(row).getByLabelText("Corrected value"), { target: { value: "lots" } });
    fireEvent.change(within(row).getByLabelText(/^Reason/), { target: { value: "Payroll register" } });
    fireEvent.click(within(row).getByRole("button", { name: "Save correction" }));
    expect(api.reviewField).toHaveBeenCalledTimes(1); // "lots" isn't a number

    fireEvent.change(within(row).getByLabelText("Corrected value"), { target: { value: "14" } });
    fireEvent.click(within(row).getByRole("button", { name: "Save correction" }));
    await waitFor(() =>
      expect(api.reviewField).toHaveBeenLastCalledWith("s1", "employee_count", "follow_up", { kind: "set", value: 14 }, "Payroll register", 12),
    );
  });

  it("names a missing answer as missing, not as the empty value the page shows", async () => {
    renderPage();
    const row = await screen.findByTestId("field-hris_system");
    api.reviewField.mockResolvedValue(undefined);
    fireEvent.click(within(row).getByRole("button", { name: "Needs follow-up" }));
    await waitFor(() => expect(api.reviewField).toHaveBeenCalledWith("s1", "hris_system", "follow_up", { kind: "keep" }, "", undefined));
  });

  it("reloads when the database refuses a review because the prospect changed the answer since the page loaded", async () => {
    renderPage();
    const row = await screen.findByTestId("field-employee_count");
    api.reviewField.mockRejectedValue(
      Object.assign(new Error("The prospect changed this answer after the page was loaded; review the current answer"), { code: "PT409" }),
    );
    fireEvent.click(within(row).getByRole("button", { name: "Verified" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/changed this answer/)));
    await waitFor(() => expect(api.loadSubmission).toHaveBeenCalledTimes(2));
  });

  it("doesn't reload for a review refused for any other reason", async () => {
    renderPage();
    const row = await screen.findByTestId("field-employee_count");
    api.reviewField.mockRejectedValue(Object.assign(new Error("Network request failed"), { code: undefined }));
    fireEvent.click(within(row).getByRole("button", { name: "Verified" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Network request failed"));
    expect(api.loadSubmission).toHaveBeenCalledTimes(1);
  });

  it("shows that the prospect changed a reviewed answer: on the field, in the audit trail and beside the Manuscript", async () => {
    api.loadSubmission.mockResolvedValue(
      detail({
        reviews: {
          company_name: {
            field: "company_name", review_state: null, has_correction: true, corrected_value: "Old Co LLC",
            reason: "Per W-9", updated_by_email: "adv@example.com", updated_at: "2026-10-02T00:00:00Z",
            answer_changed_at: "2026-10-03T00:00:00Z", answer_changed_from: "Old Co",
          },
        },
        reviewEvents: [
          {
            id: 10, session_id: "s1", field: "company_name", from_state: "verified", to_state: null, correction_changed: false,
            from_value: "Old Co LLC", to_value: "Old Co LLC", had_correction: true, has_correction: true, reason: null,
            actor_id: "prospect-1", actor_email: "p@example.com", created_at: "2026-10-03T00:00:00Z",
            cause: "answer_changed", answer_from: "Old Co", answer_to: "Signed Co",
          },
        ],
      }),
    );
    renderPage();
    const row = await screen.findByTestId("field-company_name");
    expect(within(row).getByText(/The prospect changed this answer after it was reviewed/)).toHaveTextContent("(it was Old Co)");
    // The correction made against the old answer stays, but isn't applied until someone verifies it again.
    expect(within(row).getByText("Not used until verified")).toBeInTheDocument();
    const audit = screen.getByRole("heading", { name: "Review audit trail" }).closest("section")!;
    expect(within(audit).getByText("Prospect")).toBeInTheDocument();
    expect(
      within(audit).getByText(/changed Company legal name from Old Co to Signed Co, so its review was reset \(was Verified\)/),
    ).toBeInTheDocument();
    expect(screen.getByText(/The prospect changed 1 answer after it was reviewed, so its review was reset/)).toBeInTheDocument();
  });

  it("shows a pending correction as not yet used, and the review audit trail", async () => {
    api.loadSubmission.mockResolvedValue(
      detail({
        reviews: {
          employee_count: {
            field: "employee_count", review_state: "follow_up", has_correction: true, corrected_value: 14,
            reason: "Payroll register", updated_by_email: "adv@example.com", updated_at: "2026-10-02T00:00:00Z",
          },
        },
        reviewEvents: [
          {
            id: 7, session_id: "s1", field: "employee_count", from_state: null, to_state: "follow_up", correction_changed: true,
            from_value: null, to_value: 14, had_correction: false, has_correction: true, reason: "Payroll register",
            actor_id: "a1", actor_email: "adv@example.com", created_at: "2026-10-02T00:00:00Z",
            cause: "advisor", answer_from: null, answer_to: null,
          },
        ],
      }),
    );
    renderPage();
    const row = await screen.findByTestId("field-employee_count");
    expect(within(row).getByText("12")).toBeInTheDocument();
    expect(within(row).getByText("14")).toBeInTheDocument();
    expect(within(row).getByText("Not used until verified")).toBeInTheDocument();
    const audit = screen.getByRole("heading", { name: "Review audit trail" }).closest("section")!;
    expect(within(audit).getByText(/corrected Employee count to 14; marked Employee count Needs follow-up/)).toBeInTheDocument();
    expect(screen.getByText(/1 correction isn't verified yet and won't be included/)).toBeInTheDocument();
  });

  it("generates the next Manuscript version from the certified data plus verified corrections", async () => {
    api.loadSubmission.mockResolvedValue(
      detail({
        reviews: {
          company_name: {
            field: "company_name", review_state: "verified", has_correction: true, corrected_value: "Signed Co LLC",
            reason: "Per W-9", updated_by_email: "adv@example.com", updated_at: "2026-10-02T00:00:00Z",
          },
        },
        reviewEvents: [
          {
            id: 9, session_id: "s1", field: "company_name", from_state: null, to_state: "verified", correction_changed: true,
            from_value: null, to_value: "Signed Co LLC", had_correction: false, has_correction: true, reason: "Per W-9",
            actor_id: "a1", actor_email: "adv@example.com", created_at: "2026-10-02T00:00:00Z",
            cause: "advisor", answer_from: null, answer_to: null,
          },
        ],
        versions: [
          {
            id: "v1", session_id: "s1", version: 1, file_id: "EAA-2026-S1", storage_path: "s1/v1-a.pdf", pdf_sha256: "a".repeat(64),
            certified_data_hash: "c".repeat(64), certified_signed_at: "2026-10-01T12:00:00Z", certified_at: "2026-10-01T12:00:05Z", review_event_id: 0, corrections_applied: 0,
            sensitive_revealed: false, generated_by: "a1", generated_by_email: "adv@example.com", generated_at: "2026-10-01T13:00:00Z",
          },
        ],
      }),
    );
    renderPage();
    expect(await screen.findByText(/The review has changed since v1/)).toBeInTheDocument();
    api.saveManuscriptVersion.mockResolvedValue({});
    fireEvent.click(screen.getByLabelText("Include full dates of birth"));
    fireEvent.click(screen.getByRole("button", { name: /Regenerate as new version/ }));

    await waitFor(() => expect(api.saveManuscriptVersion).toHaveBeenCalled());
    expect(api.saveManuscriptVersion.mock.calls[0][0]).toMatchObject({
      sessionId: "s1",
      version: 2,
      reviewEventId: 9,
      correctionsApplied: 1,
      sensitiveRevealed: true,
      // The certification the PDF is built from, so the database can refuse it if the prospect certified again.
      certifiedDataHash: "c".repeat(64),
      certifiedAt: "2026-10-01T12:00:05Z",
    });
    const [manuscript, opts] = buildManuscriptPdf.mock.calls[0] as unknown as [Manuscript, { revealSensitive: boolean }];
    expect(opts.revealSensitive).toBe(true);
    expect(manuscript.companyRows[0]).toEqual(["Legal Name", "Signed Co LLC", "company_name"]);
    expect(manuscript.advisorReview).toEqual({
      version: 2,
      corrections: [{ field: "company_name", label: "Company legal name", prospectValue: "Signed Co", advisorValue: "Signed Co LLC", reason: "Per W-9" }],
    });
    expect(manuscript.signer?.name).toBe("Jo Doe");
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "Nevermore_Packet_EAA-2026-S1_Signed_Co_20261001_advisor-v2.pdf"));
  });

  it("generates the packet with its eligibility checks against the chosen PEO's profile in the database", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 11, 12));
    peoCatalogRows = [{ id: 3, name: "Justworks", profile: { version: 1, min_headcount: 20, states_served: null, excluded_class_codes: null,
      sources: { min_headcount: { kind: "person", name: "Dana Reyes", role: "Broker desk", checked_on: "2026-11-02" } } } }];
    api.loadSubmission.mockResolvedValue(detail({ pipelineStatus: "sent_to_carrier", submission: { ...detail().submission!, peo: "Justworks" } }));
    api.saveManuscriptVersion.mockResolvedValue({});
    renderPage();
    await screen.findByRole("heading", { name: "Signed Co" });
    // Once the PEOs have been read.
    await screen.findByRole("option", { name: "Justworks" });
    fireEvent.click(screen.getByRole("button", { name: /Generate packet/ }));
    await waitFor(() => expect(buildManuscriptPdf).toHaveBeenCalled());
    const [manuscript] = buildManuscriptPdf.mock.calls[0] as unknown as [Manuscript];
    expect(manuscript.checks[0]).toEqual({ label: "Minimum headcount: Justworks takes groups of 20 or more employees; this employer has 12.", status: "fail", ofPeoRule: true, checkedOn: "2026-11-02", stale: false });
  });

  it("notes in the packet that the chosen PEO's profile is out of date as of the day it is generated", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 11, 12));
    peoCatalogRows = [{ id: 3, name: "Justworks", profile: { version: 1, min_headcount: 20,
      sources: { min_headcount: { kind: "document", name: "Broker guide", checked_on: "2026-05-01" } } } }];
    // Fresh when it was certified (1 Oct), stale by the day the packet is generated.
    api.loadSubmission.mockResolvedValue(detail({ submission: { ...detail().submission!, peo: "Justworks" } }));
    api.saveManuscriptVersion.mockResolvedValue({});
    renderPage();
    await screen.findByRole("heading", { name: "Signed Co" });
    await waitFor(() => expect(screen.getByRole("button", { name: /Generate packet/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Generate packet/ }));
    await waitFor(() => expect(buildManuscriptPdf).toHaveBeenCalled());
    const [manuscript] = buildManuscriptPdf.mock.calls[0] as unknown as [Manuscript];
    expect(manuscript.checksNote).toBe("Justworks's profile was last checked 1 May 2026 and may be out of date.");
  });

  it("won't generate a packet while the PEOs are loading: its eligibility checks would all read can't tell", async () => {
    peoCatalogReads.push(() => new Promise(() => {}));
    renderPage();
    await screen.findByRole("heading", { name: "Signed Co" });
    const generate = screen.getByRole("button", { name: /Generate packet/ });
    expect(generate).toBeDisabled();
    expect(screen.getByText("Loading the PEOs' profiles. You can generate the packet once they're in.")).toBeInTheDocument();
    fireEvent.click(generate);
    expect(api.saveManuscriptVersion).not.toHaveBeenCalled();
  });

  it("says when the PEOs couldn't be read, won't generate until they are, and reads them again on request", async () => {
    peoCatalogReads.push(() => Promise.reject(new Error("network down")));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    api.saveManuscriptVersion.mockResolvedValue({});
    renderPage();
    await screen.findByRole("heading", { name: "Signed Co" });
    const panel = screen.getByRole("region", { name: "Advisor packet" });
    expect(await within(panel).findByRole("alert")).toHaveTextContent(
      "We couldn't load the PEOs' profiles, so the packet's eligibility checks can't be run. Try again before generating.",
    );
    expect(within(panel).getByRole("button", { name: /Generate packet/ })).toBeDisabled();
    fireEvent.click(within(panel).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(within(panel).getByRole("button", { name: /Generate packet/ })).toBeEnabled());
    expect(within(panel).queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: /Generate packet/ }));
    await waitFor(() => expect(api.saveManuscriptVersion).toHaveBeenCalled());
  });

  it("reloads, and keeps no file, when the prospect certified again while the packet was being generated", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Signed Co" });
    api.saveManuscriptVersion.mockRejectedValue(
      Object.assign(new Error("The prospect certified their intake again while this packet was being generated; generate it again"), {
        code: "PT409",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Generate packet/ }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/certified their intake again.*The page now shows the latest answers/)),
    );
    await waitFor(() => expect(api.loadSubmission).toHaveBeenCalledTimes(2));
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("marks the version shared with the prospect, and one built from an earlier certification", async () => {
    const version = (n: number, over: Record<string, unknown> = {}) => ({
      id: `v${n}`, session_id: "s1", version: n, file_id: "EAA-2026-S1", storage_path: `s1/v${n}.pdf`, pdf_sha256: "a".repeat(64),
      certified_data_hash: "c".repeat(64), certified_signed_at: "2026-10-01T12:00:00Z", certified_at: "2026-10-01T12:00:05Z",
      review_event_id: 0, corrections_applied: 0, sensitive_revealed: false, generated_by: "a1", generated_by_email: "adv@example.com",
      generated_at: "2026-10-01T13:00:00Z", ...over,
    });
    api.loadSubmission.mockResolvedValue(detail({ versions: [version(2), version(1, { certified_at: "2026-09-30T12:00:05Z", certified_data_hash: "d".repeat(64) })] }));
    renderPage();
    const list = await screen.findByRole("list", { name: "Packet versions" });
    const [v2, v1] = within(list).getAllByRole("listitem");
    expect(v2).toHaveTextContent("Shared with the prospect as their final packet");
    expect(v1).toHaveTextContent("Built from an earlier certification");
    expect(v1).not.toHaveTextContent("Shared with the prospect");
    expect(screen.queryByText(/certified again after v2/)).not.toBeInTheDocument();
  });

  it("says the latest version predates the prospect's current certification and isn't offered to them", async () => {
    api.loadSubmission.mockResolvedValue(
      detail({
        versions: [{
          id: "v1", session_id: "s1", version: 1, file_id: "EAA-2026-S1", storage_path: "s1/v1.pdf", pdf_sha256: "a".repeat(64),
          certified_data_hash: "d".repeat(64), certified_signed_at: "2026-09-30T12:00:00Z", certified_at: "2026-09-30T12:00:05Z",
          review_event_id: 0, corrections_applied: 0, sensitive_revealed: false, generated_by: "a1", generated_by_email: "adv@example.com",
          generated_at: "2026-09-30T13:00:00Z",
        }],
      }),
    );
    renderPage();
    expect(await screen.findByText(/The prospect certified again after v1 was generated/)).toBeInTheDocument();
    expect(screen.queryByText("Shared with the prospect as their final packet")).not.toBeInTheDocument();
  });

  it("downloads a stored version through a short-lived link", async () => {
    const v = {
      id: "v1", session_id: "s1", version: 1, file_id: "EAA-2026-S1", storage_path: "s1/v1-a.pdf", pdf_sha256: "a".repeat(64),
      certified_data_hash: "c".repeat(64), certified_signed_at: "2026-10-01T12:00:00Z", certified_at: "2026-10-01T12:00:05Z", review_event_id: 0, corrections_applied: 0,
      sensitive_revealed: false, generated_by: "a1", generated_by_email: "adv@example.com", generated_at: "2026-10-01T13:00:00Z",
    };
    api.loadSubmission.mockResolvedValue(detail({ versions: [v] }));
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });
    api.manuscriptUrl.mockResolvedValue("https://storage.example/signed");
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Download v1" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://storage.example/signed"));
    expect(api.manuscriptUrl).toHaveBeenCalledWith(v, "Nevermore_Packet_EAA-2026-S1_Signed_Co_20261001_advisor-v1.pdf");
    expect(api.recordActivity).toHaveBeenCalledWith("packet_downloaded", "manuscript", "v1");
  });

  it("names a stored version from its own certification, never from the one on record now", async () => {
    // The prospect certified again (version 3, 2026-10-01); v1 was built from the certification of 2026-09-30.
    const v = {
      id: "v1", session_id: "s1", version: 1, file_id: "EAA-2026-S1", storage_path: "s1/v1.pdf", pdf_sha256: "a".repeat(64),
      certified_data_hash: "d".repeat(64), certified_signed_at: "2026-09-30T12:00:00Z", certified_at: "2026-09-30T12:00:05Z", review_event_id: 0, corrections_applied: 0,
      sensitive_revealed: false, generated_by: "a1", generated_by_email: "adv@example.com", generated_at: "2026-09-30T13:00:00Z",
    };
    const base = detail();
    api.loadSubmission.mockResolvedValue(detail({ versions: [v], submission: { ...base.submission!, version: 3 } }));
    Object.defineProperty(window, "location", { value: { ...window.location, assign: vi.fn() }, writable: true });
    api.manuscriptUrl.mockResolvedValue("https://storage.example/signed");
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Download v1" }));
    await waitFor(() => expect(api.manuscriptUrl).toHaveBeenCalled());
    // Its own date, and no certification number it doesn't know: the same name however many times they certify.
    expect(api.manuscriptUrl).toHaveBeenCalledWith(v, "Nevermore_Packet_EAA-2026-S1_Signed_Co_20260930_advisor-v1.pdf");
  });

  it("shows what the prospect signed beside their current answers when they changed them afterwards", async () => {
    const current = { ...signedData, employee_count: 14, pay_frequency: "Weekly" };
    api.loadSubmission.mockResolvedValue(
      detail({ certified: false, intakeStatus: "in_progress", data: current, signed: { data: signedData, signedAt: "2026-10-01T12:00:05Z", provenance: {}, documents: [], extraAnswers: {} } }),
    );
    renderPage();
    const section = (await screen.findByRole("heading", { name: "Changed since signing" })).closest("section")!;
    const rows = within(section).getAllByRole("row").slice(1).map((r) => r.textContent);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r?.includes("Bi-weekly"))).toContain("Weekly");
    expect(rows.find((r) => r?.includes("12"))).toContain("14");
    expect(screen.getByText(/what changed is listed below/)).toBeInTheDocument();
  });

  it("says when it was an answer to a PEO's own questions that changed, without showing it there", async () => {
    const drives = (value: boolean) => ({ "5": { vehicles: { question: "Do employees drive for work?", kind: "yes_no" as const, value, status: "confirmed" as const, source: { kind: "prospect_edit" as const }, updated_at: "2026-10-02T00:00:00Z" } } });
    api.loadSubmission.mockResolvedValue(detail({ certified: false, intakeStatus: "in_progress", data: signedData, extraAnswers: drives(false),
      signed: { data: signedData, signedAt: "2026-10-01T12:00:05Z", provenance: {}, documents: [], extraAnswers: drives(true) } }));
    renderPage();
    const section = (await screen.findByRole("heading", { name: "Changed since signing" })).closest("section")!;
    expect(section).toHaveTextContent("An answer to a PEO's own questions changed since signing. Each PEO's supplement keeps the certified answers.");
    expect(section).not.toHaveTextContent("No answer differs from the signed copy.");
  });

  it("has no signed-copy section while the certification holds", async () => {
    api.loadSubmission.mockResolvedValue(detail());
    renderPage();
    await screen.findByRole("heading", { name: "Signed Co" });
    expect(screen.queryByRole("heading", { name: "Changed since signing" })).not.toBeInTheDocument();
  });

  it("won't generate a Manuscript for an intake that isn't certified", async () => {
    api.loadSubmission.mockResolvedValue(detail({ certified: false, intakeStatus: "in_progress", submission: null, pipelineStatus: "draft" }));
    renderPage();
    expect(await screen.findByText(/Not certified yet. A packet can be generated once/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Generate packet/ })).not.toBeInTheDocument();
  });

  it("says when the submission can't be found", async () => {
    api.loadSubmission.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByText("Submission not found.")).toBeInTheDocument();
  });

  it("shows an error and retries", async () => {
    api.loadSubmission.mockRejectedValueOnce(new Error("Network request failed"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Network request failed");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Signed Co" })).toBeInTheDocument();
  });

  it("ends the session when the server says it has expired", async () => {
    signOut.mockReset().mockResolvedValue(undefined);
    api.loadSubmission.mockRejectedValueOnce(Object.assign(new Error("Your session has expired."), { unauthenticated: true }));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Your session has expired");
    expect(signOut).toHaveBeenCalledWith("expired");
  });

  it("tells an account that has lost advisor access, and doesn't offer a retry", async () => {
    api.loadSubmission.mockRejectedValueOnce(Object.assign(new Error("You don't have advisor access."), { forbidden: true }));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("You no longer have advisor access");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });
  describe("when the prospect cannot be reached by email", () => {
    it("says so at the top, with what to do and the phone number on file", async () => {
      api.listEmailProblems.mockResolvedValue([{ session_id: "s1", reason: "bounced", since: "2026-10-28T12:00:00Z" }]);
      renderPage();
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Email bounced.");
      expect(alert).toHaveTextContent(/bounced for good/);
      expect(alert).toHaveTextContent(/Reach them another way/);
    });

    it("says nothing about another submission's bounce, or when none is flagged", async () => {
      api.listEmailProblems.mockResolvedValue([{ session_id: "other", reason: "complained", since: "2026-10-28T12:00:00Z" }]);
      renderPage();
      expect(await screen.findByRole("heading", { name: "Signed Co" })).toBeInTheDocument();
      expect(screen.queryByText(/Reported as spam|Email bounced/)).not.toBeInTheDocument();
    });

    it("still shows the submission when the check fails", async () => {
      api.listEmailProblems.mockRejectedValue(new Error("Couldn't check for bounced emails."));
      renderPage();
      expect(await screen.findByRole("heading", { name: "Signed Co" })).toBeInTheDocument();
      expect(screen.queryByText(/Email bounced/)).not.toBeInTheDocument();
    });
  });

  it("shows the PEOs the submission went to, flagging one that has an older version", async () => {
    api.loadSubmission.mockResolvedValue(detail({
      pipelineStatus: "sent_to_carrier",
      currentVersion: 2,
      quoteRequests: [{ id: 7, session_id: "s1", peo_name: "TriNet", status: "sent", sent_version: 1, sent_on: "2026-11-10",
        quote_received_on: null, quote_expires_on: null, proposed_start_on: null, admin_fee_pepm: null, note: null }],
    }));
    renderPage();
    const panel = await screen.findByRole("region", { name: "Quote requests" });
    expect(within(within(panel).getByTestId("quote-request-7")).getByText("TriNet")).toBeInTheDocument();
    expect(within(panel).getByText("Sent v1, current v2")).toBeInTheDocument();
  });

  it("checks each PEO against the profile in use the database holds for it, and offers the PEOs it lists", async () => {
    peoCatalogRows = [
      { id: 2, name: "Insperity", profile: null },
      { id: 4, name: "Rippling", listed: false, profile: null },
      { id: 5, name: "TriNet", profile: { version: 3, min_headcount: 20, states_served: null, excluded_class_codes: null, sources: { min_headcount: { kind: "person", name: "Dana Reyes", role: "Broker desk", checked_on: "2026-11-02" } } } },
    ];
    api.loadSubmission.mockResolvedValue(detail({
      pipelineStatus: "sent_to_carrier",
      data: { ...signedData, census: [{ id: "e1", first_name: "Ana", last_name: "Lee", work_state: "CA", compensation_type: "salary", employment_type: "full_time", classification: "w2" }] },
      quoteRequests: [{ id: 7, session_id: "s1", peo_name: "TriNet", status: "sent", sent_version: 1, sent_on: "2026-11-10",
        quote_received_on: null, quote_expires_on: null, proposed_start_on: null, admin_fee_pepm: null, note: null }],
    }));
    renderPage();
    const panel = await screen.findByRole("region", { name: "Quote requests" });
    expect(await within(within(panel).getByTestId("quote-request-7")).findByText("TriNet takes groups of 20 or more employees; this employer has 12.", { exact: false })).toBeInTheDocument();
    expect(within(panel).getByTestId("quote-request-7")).toHaveTextContent("A check that isn't met is a warning. It never stops you sending.");
    expect(within(within(panel).getByLabelText("PEO")).getAllByRole("option").map((o) => o.textContent).slice(1)).toEqual(["Insperity", "TriNet"]);
    // The census beside the table is in our own layout; each PEO's is on its card in What each PEO still needs.
    const census = screen.getByRole("region", { name: "Employee census" });
    expect(within(census).getByText("Our layout, every column named, as a CSV file. From certified version 1.")).toBeInTheDocument();
  });

  it("offers the certified census as a file in a PEO's layout, only while the intake is certified", async () => {
    const census = [{ id: "e1", first_name: "Ana", last_name: "Lee", work_state: "CA", compensation_type: "salary" as const, employment_type: "full_time" as const, classification: "w2" as const }];
    api.loadSubmission.mockResolvedValue(detail({ data: { ...signedData, census } }));
    const { unmount } = renderPage();
    const section = await screen.findByRole("region", { name: "Employee census" });
    expect(within(section).getByRole("button", { name: "Download the census" })).toBeInTheDocument();
    unmount();

    api.loadSubmission.mockResolvedValue(detail({ certified: false, data: { ...signedData, census } }));
    renderPage();
    const draft = await screen.findByRole("region", { name: "Employee census" });
    expect(within(draft).queryByRole("button", { name: "Download the census" })).not.toBeInTheDocument();
  });

  it("offers the certified answers as JSON beside the packet, without a PEO's own answers or the advisor's reviews and notes", async () => {
    api.loadSubmission.mockResolvedValue(detail({
      submission: { ...detail().submission!, version: 1, data_version: 9, consent_version: "2026-04-01", extra_answers: { "3": { vehicles: { question: "Do employees drive for work?" } } } } as SubmissionDetail["submission"],
      extraAnswers: { "3": { vehicles: { question: "Do employees drive for work?", kind: "yes_no", value: true, status: "confirmed", source: { kind: "prospect_edit" }, updated_at: "2026-10-01T00:00:00Z" } } },
      notes: [{ id: 1, session_id: "s1", body: "Call the CFO on Monday", author_id: "a1", author_email: "adv@example.com", created_at: "2026-10-02T00:00:00Z" }] as unknown as SubmissionDetail["notes"],
      reviews: { employee_count: { review_state: "verified", has_correction: true, advisor_value: 14, reason: "Payroll register says 14" } } as unknown as SubmissionDetail["reviews"],
    }));
    renderPage();
    const packet = await screen.findByRole("region", { name: "Advisor packet" });
    expect(within(packet).getByText(/From certified version 1\./)).toBeInTheDocument();
    fireEvent.click(within(packet).getByRole("button", { name: "Download the answers as JSON" }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "EAA-2026-S1-answers-v1.json"));
    const blob = downloadBlob.mock.calls.find((c) => c[1] === "EAA-2026-S1-answers-v1.json")![0] as Blob;
    const json = await blobText(blob);
    const doc = JSON.parse(json);
    // The prospect's answer and its status as certified: the advisor's correction and verification are not in it.
    expect(doc.answers.employee_count).toBe(12);
    expect(doc.answer_status.employee_count).toBe("inferred");
    expect(doc.certification).toEqual({
      signer_name: "Jo Doe", signer_title: "CEO", signed_at: "2026-10-01T12:00:00Z", certified_at: "2026-10-01T12:00:05Z",
      statement_version: "2026-04-01", data_version: 9, stored_data_sha256: "c".repeat(64),
    });
    expect(json).not.toMatch(/vehicles|drive for work|Call the CFO|Payroll register|advisor_value|verified/);
    expect(doc.answers.employee_count).not.toBe(14);
  });

  it("offers no answers as JSON while the certification is withdrawn, saying why as the packet does", async () => {
    api.loadSubmission.mockResolvedValue(detail({ certified: false, intakeStatus: "in_progress", signed: { data: signedData, signedAt: "2026-10-01T12:00:00Z", provenance: {}, documents: [], extraAnswers: null } }));
    renderPage();
    const packet = await screen.findByRole("region", { name: "Advisor packet" });
    expect(within(packet).getByText("The prospect changed their answers after certifying. A packet can be generated once they certify again.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download the answers as JSON" })).not.toBeInTheDocument();
  });

  it("shows each PEO's thread and marks it read when opened, then reloads so the rest of the page drops the mark", async () => {
    const request = { id: 7, session_id: "s1", peo_name: "TriNet", status: "sent", sent_version: 1, sent_on: "2026-11-10",
      quote_received_on: null, quote_expires_on: null, proposed_start_on: null, admin_fee_pepm: null, note: null };
    api.loadSubmission.mockResolvedValue(detail({
      pipelineStatus: "sent_to_carrier",
      quoteRequests: [request],
      quoteRequestMessages: [{ id: 1, provider_message_id: "re_1", quote_request_id: 7, session_id: "s1", address_local_part: "a.b.c", held_reason: null, held_at: null, moved_by: null, moved_by_email: null, moved_from_quote_request_id: null, moved_note: null, 
        direction: "received", is_automatic: false, new_sender: true, from_address: "dana@trinet.example", from_name: "Dana", to_addresses: [], cc_addresses: [],
        subject: "Proposal", body_text: "Proposal attached.", body_truncated: false, headers: {}, sent_at: "2026-11-10T15:00:00Z", recorded_at: "2026-11-10T15:00:05.5+00:00" }],
    }));
    api.openQuoteRequestThread.mockResolvedValue(undefined);
    renderPage();
    const threads = await screen.findByRole("region", { name: "PEO threads" });
    expect(within(threads).getByText("New PEO mail")).toBeInTheDocument();
    // The mark also shows on the quote request itself.
    expect(within(await screen.findByTestId("quote-request-7")).getByText("New PEO mail")).toBeInTheDocument();
    const loads = api.loadSubmission.mock.calls.length;
    fireEvent.click(within(threads).getByRole("button", { name: /TriNet/ }));
    expect(within(threads).getByText("Proposal attached.")).toBeInTheDocument();
    await waitFor(() => expect(api.openQuoteRequestThread).toHaveBeenCalledWith(7, "2026-11-10T15:00:05.5+00:00"));
    await waitFor(() => expect(api.loadSubmission.mock.calls.length).toBeGreaterThan(loads));
  });

  it("puts an underwriter's question into Ask the prospect for the advisor to edit, without sending it or naming the PEO", async () => {
    api.loadSubmission.mockResolvedValue(detail({
      pipelineStatus: "sent_to_carrier",
      quoteRequests: [{ id: 7, session_id: "s1", peo_name: "TriNet", status: "sent", sent_version: 1, sent_on: "2026-11-10",
        quote_received_on: null, quote_expires_on: null, proposed_start_on: null, admin_fee_pepm: null, note: null }],
      quoteRequestNotes: [{ id: 21, quote_request_id: 7, session_id: "s1", kind: "underwriter_question", noted_on: "2026-11-12",
        body: "Can they send last year's loss runs?", created_by: "a1", created_by_email: "adv@example.com", created_at: "2026-11-12T15:00:00Z" }],
    }));
    renderPage();
    const quotes = await screen.findByRole("region", { name: "Quote requests" });
    fireEvent.click(within(quotes).getByRole("button", { name: "Ask the prospect" }));
    const message = screen.getByLabelText(/What do you need from them/i) as HTMLTextAreaElement;
    expect(message.value).toBe("Can they send last year's loss runs?");
    expect(message.value).not.toMatch(/TriNet/);
    expect(api.requestInformation).not.toHaveBeenCalled();
    // Once sent, the question is spent: the next request starts empty.
    api.requestInformation.mockResolvedValue(undefined);
    api.loadSubmission.mockResolvedValue({ ...(await api.loadSubmission.mock.results[0].value), informationRequests: [
      { id: 1, session_id: "s1", message: "Can they send last year's loss runs?", fields: [], extra_questions: [], requested_by: "adv-1", requested_by_email: "adv@example.com", requested_at: "2026-11-12T16:00:00Z" },
    ] });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(api.loadSubmission).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByLabelText(/What do you need from them/i)).toHaveValue(""));
  });

  describe("What each PEO still needs", () => {
    const sourced = { kind: "document", name: "Broker guide", checked_on: "2026-11-02" };
    const catalog = () => [
      { id: 1, name: "ADP TotalSource", listed: false, profile: { version: 1, needed_to_quote: ["hris_system"], sources: { answers: sourced } } },
      { id: 2, name: "Insperity", profile: null },
      { id: 3, name: "Justworks", profile: { version: 2, needed_to_quote: ["company_name", "pay_frequency"], sources: { answers: sourced } } },
      { id: 4, name: "Oasis", profile: null },
      { id: 5, name: "TriNet", profile: {
        version: 4, needed_to_quote: ["company_name", "hris_system"], needed_before_signing: ["payroll_vendor"],
        documents: [{ category: "workers_comp_loss_runs", description: "Three years of loss runs" }],
        min_headcount: 20, sources: { answers: sourced, documents: sourced, min_headcount: sourced },
      } },
    ];
    const panel = async () => screen.findByRole("region", { name: "What each PEO still needs" });

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(2026, 10, 11, 12));
      peoCatalogRows = catalog();
    });

    it("gives no file from a page left open across a withdrawal: the JSON, the census and each PEO's files check at the click", async () => {
      const census = [{ id: "e1", first_name: "Ana", last_name: "Lee", work_state: "CA", compensation_type: "salary" as const, employment_type: "full_time" as const, classification: "w2" as const }];
      api.loadSubmission.mockResolvedValue(detail({ data: { ...signedData, census } }));
      renderPage();
      const packet = await screen.findByRole("region", { name: "Advisor packet" });
      const trinet = (await within(await screen.findByRole("region", { name: "What each PEO still needs" })).findByRole("heading", { name: "TriNet" })).closest("article")!;
      // The prospect changed an answer since the page loaded: the database withdrew the certification.
      intakeNow = { status: "in_progress", data_sha256: "c".repeat(64), version: null };
      const refused = "This intake changed since you opened the page. Reload to get the certified version.";
      const clicks = [
        within(packet).getByRole("button", { name: "Download the answers as JSON" }),
        within(screen.getByRole("region", { name: "Employee census" })).getByRole("button", { name: "Download the census" }),
        within(trinet).getByRole("button", { name: "Download the census" }),
        within(trinet).getByRole("button", { name: "Download Workers' compensation application data" }),
      ];
      for (const [n, button] of clicks.entries()) {
        fireEvent.click(button);
        await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(n + 1));
      }
      expect(vi.mocked(toast.error).mock.calls.map((c) => c[0])).toEqual([refused, refused, refused, refused]);
      expect(downloadBlob).not.toHaveBeenCalled();
      expect(buildWorkersCompPdf).not.toHaveBeenCalled();
    });

    it("groups every listed PEO with a profile by whether the certified version is complete for it, alphabetical and never ranked", async () => {
      renderPage();
      const needs = await panel();
      await within(needs).findByRole("heading", { name: "Complete · 1" });
      expect(within(needs).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Complete · 1", "Something missing · 1", "No profile yet · 2"]);
      expect(needs).toHaveTextContent("Alphabetical in each group. Nothing here is a ranking.");
      expect(needs).toHaveTextContent("From version 1, the prospect's last certification.");
      const complete = within(needs).getByRole("list", { name: "Complete" });
      expect(within(complete).getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual(["Justworks"]);
      expect(complete).toHaveTextContent("Everything it needs to quote is on file");
      const missing = within(needs).getByRole("list", { name: "Something missing" });
      expect(within(missing).getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual(["TriNet"]);
      expect(missing).toHaveTextContent("1 answer and 1 document missing · 1 answer needed only before signing");
      // PEOs with no profile are one sentence, and a PEO no longer listed isn't there at all.
      expect(needs).toHaveTextContent("No profile yet for Insperity and Oasis, so there's nothing to check against.");
      expect(needs).not.toHaveTextContent("ADP TotalSource");
      expect(needs).not.toHaveTextContent(/ready|best|rank(ed|ing) \d/i);
    });

    it("counts a PEO's own extra questions the certified version doesn't answer against it, by their wording", async () => {
      const drives = { key: "vehicles", text: "Do employees drive for work?", kind: "yes_no" };
      peoCatalogRows = catalog().map((p) => (p.name === "Justworks" ? { ...p, profile: { ...p.profile!, extra_questions: [drives, { key: "fleet", text: "How many vans?", kind: "number" }] } } : p));
      api.loadSubmission.mockResolvedValue(detail({ extraAnswers: { "3": { vehicles: { question: drives.text, kind: "yes_no", value: true, status: "confirmed", source: { kind: "prospect_edit" }, updated_at: "2026-10-01T00:00:00Z" } } } }));
      renderPage();
      const needs = await panel();
      const missing = await within(needs).findByRole("list", { name: "Something missing" });
      const justworks = within(missing).getByRole("heading", { name: "Justworks" }).closest("article")!;
      expect(justworks).toHaveTextContent("1 of its own questions missing");
      fireEvent.click(within(justworks).getByRole("button", { name: "Show what's missing" }));
      expect(within(within(justworks).getByRole("region", { name: "Needed to quote" })).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["How many vans?: not answered"]);
    });

    it("offers each PEO's own questions as its supplement, from the certified version, saying what it leaves unanswered", async () => {
      const drives = { key: "vehicles", text: "Do employees drive for work?", kind: "yes_no" };
      peoCatalogRows = catalog().map((p) => (p.name === "TriNet" ? { ...p, profile: { ...p.profile!, extra_questions: [drives, { key: "fleet", text: "How many vans?", kind: "number" }] } } : p));
      api.loadSubmission.mockResolvedValue(detail({
        extraAnswers: { "5": { vehicles: { question: drives.text, kind: "yes_no", value: true, status: "confirmed", source: { kind: "prospect_edit" }, updated_at: "2026-10-01T00:00:00Z" } } },
      }));
      renderPage();
      const trinet = (await within(await panel()).findByRole("heading", { name: "TriNet" })).closest("article")!;
      expect(trinet).toHaveTextContent("From certified version 1, for TriNet only. 1 of 2 answered.");
      expect(trinet).toHaveTextContent("Listed as not answered: How many vans?");
      fireEvent.click(within(trinet).getByRole("button", { name: "Download Additional questions from TriNet" }));
      await waitFor(() => expect(buildSupplementPdf).toHaveBeenCalledWith(expect.objectContaining({ peo: "TriNet", fileId: "EAA-2026-S1", version: 1, rows: [
        { question: "Do employees drive for work?", answer: "Yes" }, { question: "How many vans?", answer: null },
      ] })));
      expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "EAA-2026-S1-TriNet.pdf");
      // A PEO that asks no questions of its own has no supplement.
      const justworks = within(await panel()).getByRole("heading", { name: "Justworks" }).closest("article")!;
      expect(within(justworks).queryByRole("button", { name: /Additional questions/ })).not.toBeInTheDocument();
    });

    it("can't tell a PEO's own questions from a version certified before they were kept, in the list and the supplement", async () => {
      const drives = { key: "vehicles", text: "Do employees drive for work?", kind: "yes_no" };
      peoCatalogRows = catalog().map((p) => (p.name === "TriNet" ? { ...p, profile: { ...p.profile!, extra_questions: [drives] } } : p));
      api.loadSubmission.mockResolvedValue(detail({ extraAnswers: null }));
      renderPage();
      const trinet = (await within(await panel()).findByRole("heading", { name: "TriNet" })).closest("article")!;
      fireEvent.click(within(trinet).getByRole("button", { name: "Show what's missing" }));
      expect(within(trinet).getByRole("region", { name: "Needed to quote" })).toHaveTextContent("Do employees drive for work?: can't tell: certified before these questions were kept");
      expect(trinet).toHaveTextContent("Version 1 was certified before we kept the answers to TriNet's own questions, so we can't tell them from it.");
      expect(within(trinet).queryByRole("button", { name: /Additional questions/ })).not.toBeInTheDocument();
    });

    it("opens what a PEO still needs in place: what it needs to quote, and apart what it needs only before signing", async () => {
      renderPage();
      const needs = await panel();
      const trinet = (await within(needs).findByRole("heading", { name: "TriNet" })).closest("article")!;
      const show = within(trinet).getByRole("button", { name: "Show what's missing" });
      expect(show).toHaveAttribute("aria-expanded", "false");
      expect(within(trinet).queryByRole("region", { name: "Needed to quote" })).not.toBeInTheDocument();
      fireEvent.click(show);
      expect(within(trinet).getByRole("button", { name: "Hide what's missing" })).toHaveAttribute("aria-expanded", "true");
      expect(within(within(trinet).getByRole("region", { name: "Needed to quote" })).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
        "HRIS system: not provided",
        "Workers' comp loss runs: Three years of loss runs (not uploaded)",
      ]);
      expect(within(within(trinet).getByRole("region", { name: "Needed only before signing" })).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
        "Payroll vendor: not provided",
      ]);
    });

    it("marks the prospect's choice and each PEO the packet was sent to, with when and which version", async () => {
      api.loadSubmission.mockResolvedValue(detail({
        submission: { ...detail().submission!, peo: "trinet" },
        // Named as typed when the send was recorded.
        quoteRequests: [{ id: 7, session_id: "s1", peo_name: "justworks", status: "sent", sent_version: 1, sent_on: "2026-11-03",
          quote_received_on: null, quote_expires_on: null, proposed_start_on: null, admin_fee_pepm: null, note: null }],
      }));
      renderPage();
      const needs = await panel();
      const trinet = (await within(needs).findByRole("heading", { name: "TriNet" })).closest("article")!;
      const justworks = within(needs).getByRole("heading", { name: "Justworks" }).closest("article")!;
      expect(within(trinet).getByText("Prospect's choice")).toBeInTheDocument();
      expect(within(trinet).queryByText(/^Sent /)).not.toBeInTheDocument();
      expect(within(justworks).getByText("Sent Nov 3, 2026 · version 1")).toBeInTheDocument();
      expect(within(justworks).queryByText("Prospect's choice")).not.toBeInTheDocument();
    });

    it("names the prospect's choice among the PEOs with no profile", async () => {
      api.loadSubmission.mockResolvedValue(detail({ submission: { ...detail().submission!, peo: "Oasis" } }));
      renderPage();
      const needs = await panel();
      await within(needs).findByRole("heading", { name: "Complete · 1" });
      expect(needs).toHaveTextContent("No profile yet for Insperity and Oasis (the prospect's choice), so there's nothing to check against.");
      expect(needs).not.toHaveTextContent("isn't on the PEO list");
    });

    it("says a PEO named in the prospect's own words isn't on the list", async () => {
      api.loadSubmission.mockResolvedValue(detail({ submission: { ...detail().submission!, peo: "Acme PEO" } }));
      renderPage();
      const needs = await panel();
      await within(needs).findByRole("heading", { name: "Complete · 1" });
      expect(needs).toHaveTextContent("The prospect named Acme PEO, which isn't on the PEO list, so it has no profile.");
    });

    it("says when the prospect's chosen PEO has been taken off the list", async () => {
      api.loadSubmission.mockResolvedValue(detail({ submission: { ...detail().submission!, peo: "adp totalsource" } }));
      renderPage();
      const needs = await panel();
      await within(needs).findByRole("heading", { name: "Complete · 1" });
      expect(needs).toHaveTextContent("The prospect chose ADP TotalSource, which has been taken off the PEO list, so it isn't shown here.");
      expect(needs).not.toHaveTextContent("isn't on the PEO list");
    });

    it("shows each PEO's eligibility checks under it as warnings that never move it, and when its profile is out of date", async () => {
      // TriNet's minimum is 20 and this employer has 12: a warning, while Justworks stays complete.
      peoCatalogRows = catalog().map((p) => (p.name === "Justworks" ? { ...p, profile: { ...p.profile!, min_headcount: 20, sources: { answers: { ...sourced, checked_on: "2026-03-02" }, min_headcount: sourced } } } : p));
      renderPage();
      const needs = await panel();
      const complete = await within(needs).findByRole("list", { name: "Complete" });
      const justworks = within(complete).getByRole("heading", { name: "Justworks" }).closest("article")!;
      expect(within(justworks).getByRole("list", { name: "Eligibility checks for Justworks" })).toHaveTextContent("Doesn't meet · Minimum headcount: Justworks takes groups of 20 or more employees; this employer has 12.checked 2 Nov 2026");
      expect(justworks).toHaveTextContent("A check that isn't met is a warning. It never stops you sending.");
      expect(justworks).toHaveTextContent("Justworks's profile was last checked 2 Mar 2026 and may be out of date.");
      // Complete: its one main action is the bundle, beside its files.
      expect(within(justworks).getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent)).toEqual(["Download Workers' compensation application data", "Download bundle"]);
    });

    it("turns what a PEO still needs into a draft in Ask the prospect, for the advisor to edit and send: the click sends nothing", async () => {
      api.requestInformation.mockResolvedValue(undefined);
      renderPage();
      const needs = await panel();
      const trinet = (await within(needs).findByRole("heading", { name: "TriNet" })).closest("article")!;
      fireEvent.click(within(trinet).getByRole("button", { name: "Draft information request" }));
      const message = screen.getByLabelText(/What do you need from them/i) as HTMLTextAreaElement;
      expect(message.value).toBe([
        "We need a few more things from you to get a quote.",
        "",
        "Please upload these on the Upload tab of your intake:",
        "- Workers' comp loss runs: Three years of loss runs",
        "",
        "Please also answer or confirm the answers this request is about.",
      ].join("\n"));
      expect(message.value).not.toMatch(/TriNet/);
      expect(within(screen.getByRole("list", { name: "Answers the request is about" })).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["HRIS system", "Payroll vendor"]);
      expect(api.requestInformation).not.toHaveBeenCalled();
      fireEvent.change(message, { target: { value: `${message.value}\nThanks!` } });
      fireEvent.click(screen.getByRole("button", { name: "Send request" }));
      await waitFor(() => expect(api.requestInformation).toHaveBeenCalledWith("s1", expect.stringMatching(/Thanks!$/), ["hris_system", "payroll_vendor"], []));
    });

    it("names the PEO's unanswered extra questions in the draft, which the advisor can take out, and sends them with it", async () => {
      peoCatalogRows = catalog().map((p) => (p.name === "TriNet" ? { ...p, profile: { ...p.profile!, extra_questions: [
        { key: "vehicles", text: "Do employees drive for work?", kind: "yes_no" }, { key: "fleet", text: "How many vans?", kind: "number" },
      ] } } : p));
      api.requestInformation.mockResolvedValue(undefined);
      renderPage();
      const trinet = (await within(await panel()).findByRole("heading", { name: "TriNet" })).closest("article")!;
      fireEvent.click(within(trinet).getByRole("button", { name: "Draft information request" }));
      const asked = () => within(screen.getByRole("list", { name: "Extra questions the request is about" })).getAllByRole("listitem").map((li) => li.textContent);
      expect(asked()).toEqual(["Do employees drive for work?", "How many vans?"]);
      expect((screen.getByLabelText(/What do you need from them/i) as HTMLTextAreaElement).value).not.toMatch(/TriNet/);
      fireEvent.click(screen.getByRole("button", { name: "Remove How many vans?" }));
      fireEvent.click(screen.getByRole("button", { name: "Send request" }));
      await waitFor(() => expect(api.requestInformation).toHaveBeenCalledWith("s1", expect.any(String), ["hris_system", "payroll_vendor"],
        [{ peo_id: 5, key: "vehicles", question: "Do employees drive for work?" }]));
    });

    it("starts the next request afresh once a drafted one is sent: no copy of the draft, and the follow-up fields again", async () => {
      const followUp = { field: "hq_state", review_state: "follow_up", has_correction: false, corrected_value: null, reason: null, updated_by_email: "adv@example.com", updated_at: "2026-10-02T00:00:00Z" };
      const reviews = { hq_state: followUp } as SubmissionDetail["reviews"];
      api.loadSubmission.mockResolvedValue(detail({ reviews }));
      api.requestInformation.mockResolvedValue(undefined);
      renderPage();
      const trinet = (await within(await panel()).findByRole("heading", { name: "TriNet" })).closest("article")!;
      fireEvent.click(within(trinet).getByRole("button", { name: "Draft information request" }));
      // The send reloads the submission, which now lists the request just sent.
      api.loadSubmission.mockResolvedValue(detail({
        reviews,
        informationRequests: [{ id: 1, session_id: "s1", message: "We need a few more things", fields: ["hris_system", "payroll_vendor"], extra_questions: [], requested_by: "adv-1", requested_by_email: "adv@example.com", requested_at: "2026-11-11T12:00:00Z" }],
      }));
      fireEvent.click(screen.getByRole("button", { name: "Send request" }));
      await waitFor(() => expect(api.loadSubmission).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getByLabelText(/What do you need from them/i)).toHaveValue(""));
      expect(within(screen.getByRole("list", { name: "Answers the request is about" })).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["HQ state"]);
    });

    it("starts the draft from the PEO's missing answers alone, not the fields marked Needs follow-up", async () => {
      const followUp = { field: "hq_state", review_state: "follow_up", has_correction: false, corrected_value: null, reason: null, updated_by_email: "adv@example.com", updated_at: "2026-10-02T00:00:00Z" };
      api.loadSubmission.mockResolvedValue(detail({ reviews: { hq_state: followUp } as SubmissionDetail["reviews"] }));
      renderPage();
      const answers = () => within(screen.getByRole("list", { name: "Answers the request is about" })).getAllByRole("listitem").map((li) => li.textContent);
      await screen.findByRole("list", { name: "Answers the request is about" });
      expect(answers()).toEqual(["HQ state"]);
      const trinet = (await within(await panel()).findByRole("heading", { name: "TriNet" })).closest("article")!;
      fireEvent.click(within(trinet).getByRole("button", { name: "Draft information request" }));
      expect(answers()).toEqual(["HRIS system", "Payroll vendor"]);
    });

    it("lists what is missing as of the version certified when the prospect has changed answers since", async () => {
      // Certified as version 3 without an HRIS system; the prospect has since added one, which withdrew it.
      const now = { ...signedData, hris_system: "Rippling" };
      api.loadSubmission.mockResolvedValue(detail({
        certified: false, intakeStatus: "in_progress", data: now, currentVersion: 3,
        signed: { data: signedData, signedAt: "2026-10-01T12:00:05Z", provenance: {}, documents: [], extraAnswers: {} },
      }));
      renderPage();
      const needs = await panel();
      const trinet = (await within(needs).findByRole("heading", { name: "TriNet" })).closest("article")!;
      expect(needs).toHaveTextContent("The prospect has changed answers since certifying. What's listed here is as of version 3.");
      fireEvent.click(within(trinet).getByRole("button", { name: "Show what's missing" }));
      expect(within(trinet).getByRole("region", { name: "Needed to quote" })).toHaveTextContent("HRIS system: not provided");
    });

    it("offers the workers' comp application data on each PEO's card, from the last certified version, its blanks listed before the click", async () => {
      // Certified as version 3 with Acme's carrier; the prospect has since changed answers, which withdrew it.
      api.loadSubmission.mockResolvedValue(detail({
        certified: false, intakeStatus: "in_progress", data: { ...signedData, wc_carrier: "Changed Mutual" }, currentVersion: 3,
        signed: { data: { ...signedData, wc_carrier: "Sample Mutual" }, signedAt: "2026-10-01T12:00:05Z", provenance: {}, documents: [], extraAnswers: {} },
      }));
      renderPage();
      const needs = await panel();
      for (const name of ["Justworks", "TriNet"]) {
        const card = (await within(needs).findByRole("heading", { name })).closest("article")!;
        const app = within(card).getByRole("group", { name: "Workers' compensation application data" });
        expect(card).toHaveTextContent("The prospect has changed answers since certifying. These files are from version 3.");
        expect(app).toHaveTextContent("From certified version 3. Our own summary of the certified answers, in the standard application's order. It isn't the ACORD form. The same for every PEO.");
        expect(app).toHaveTextContent(/Left blank, not in the certified answers: \d+ items/);
        expect(within(app).getByRole("list", { name: "Left blank" })).toHaveTextContent("Applicant: Doing business as (DBA), FEIN");
      }
      const trinet = within(needs).getByRole("heading", { name: "TriNet" }).closest("article")!;
      fireEvent.click(within(trinet).getByRole("button", { name: "Download Workers' compensation application data" }));
      await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "EAA-2026-S1-workers-comp-application-v3.pdf"));
      // Built from the version certified, never the answers given since.
      const built = buildWorkersCompPdf.mock.calls.at(-1)![0];
      expect(built.sections.find((s) => s.title === "Prior carriers and loss history")!.entries[0]).toEqual({ label: "Current workers' comp carrier", value: "Sample Mutual" });
    });

    it("offers each PEO's census in the layout its profile holds, on its card, from the last certified version", async () => {
      const census = [{ id: "e1", first_name: "Ana", last_name: "Lee", work_state: "CA", compensation_type: "salary" as const, employment_type: "full_time" as const, classification: "w2" as const }];
      peoCatalogRows = catalog().map((p) => (p.name === "TriNet"
        ? { ...p, profile: { ...p.profile!, census_layout: { format: "csv", template_file: null, columns: [{ header: "Surname", from: "last_name" }, { header: "Gender", from: null }] } } }
        : p));
      // Certified as version 3 with Ana; the prospect has since changed answers, which withdrew it.
      api.loadSubmission.mockResolvedValue(detail({
        certified: false, intakeStatus: "in_progress", data: { ...signedData, census: [] }, currentVersion: 3,
        signed: { data: { ...signedData, census }, signedAt: "2026-10-01T12:00:05Z", provenance: {}, documents: [], extraAnswers: {} },
      }));
      renderPage();
      const needs = await panel();
      const trinet = (await within(needs).findByRole("heading", { name: "TriNet" })).closest("article")!;
      expect(trinet).toHaveTextContent("The prospect has changed answers since certifying. These files are from version 3.");
      expect(trinet).toHaveTextContent("TriNet's census layout, as a CSV file. From certified version 3.");
      expect(trinet).toHaveTextContent("TriNet's layout also asks for: Gender. Fill these in before sending.");
      fireEvent.click(within(trinet).getByRole("button", { name: "Download the census in TriNet's layout" }));
      await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "EAA-2026-S1-census-trinet-v3.csv"));
      // A PEO whose profile has no census layout gets ours.
      const justworks = within(needs).getByRole("heading", { name: "Justworks" }).closest("article")!;
      expect(justworks).toHaveTextContent("We don't have Justworks's census layout yet, so this is ours: every column is named.");
    });

    it("can't tell what a PEO still needs from a certification older than its kept field status and documents", async () => {
      api.loadSubmission.mockResolvedValue(detail({ certificationLacksSnapshot: true }));
      renderPage();
      const needs = await panel();
      expect(needs).toHaveTextContent("Version 1 was certified before we kept each answer's status and the documents it covered, so we can't tell what each PEO still needs from it. Ask the prospect to certify again.");
      expect(within(needs).queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
    });

    it("waits for the prospect's first certification", async () => {
      api.loadSubmission.mockResolvedValue(detail({ certified: false, intakeStatus: "in_progress", signed: null, submission: null, currentVersion: null }));
      renderPage();
      expect(await panel()).toHaveTextContent("Available once the prospect has certified their intake: each PEO's list is built from what they certified.");
    });

    it("says while the PEOs' profiles load, and when they couldn't be loaded, and loads them again on request", async () => {
      let fail!: (e: Error) => void;
      peoCatalogReads.push(() => new Promise((_, reject) => { fail = reject; }));
      vi.spyOn(console, "warn").mockImplementation(() => {});
      renderPage();
      const needs = await panel();
      expect(needs).toHaveTextContent("Loading the PEOs' profiles to see what each still needs.");
      await act(async () => fail(new Error("offline")));
      expect(await within(needs).findByRole("alert")).toHaveTextContent("We couldn't load the PEOs' profiles, so we can't say what each still needs.");
      fireEvent.click(within(needs).getByRole("button", { name: "Load the profiles again" }));
      expect(await within(needs).findByRole("heading", { name: "Complete · 1" })).toBeInTheDocument();
    });

    it("offers no draft when the prospect can't be asked at this stage, and still lists what each PEO needs", async () => {
      api.loadSubmission.mockResolvedValue(detail({ pipelineStatus: "won" }));
      renderPage();
      const needs = await panel();
      const trinet = (await within(needs).findByRole("heading", { name: "TriNet" })).closest("article")!;
      expect(trinet).toHaveTextContent("1 answer and 1 document missing");
      expect(within(trinet).queryByRole("button", { name: "Draft information request" })).not.toBeInTheDocument();
      // It says why instead, in the words Ask the prospect uses.
      expect(trinet).toHaveTextContent("The prospect can't be asked for it now: a submission at Won can't move to Information requested.");
    });

    describe("the bundle", () => {
      const lossRuns = { id: "d7", file_name: "loss-runs.pdf", file_size: "80 KB", category: "workers_comp_loss_runs", status: "uploaded", storage_path: "prospect-1/loss-runs.pdf", created_at: "2026-10-01T00:00:00Z", scan_verdict: "clean", certification: "certified" as const };
      const blocked = { ...lossRuns, id: "d8", file_name: "loss-runs-2024.pdf", storage_path: "prospect-1/loss-runs-2024.pdf", scan_verdict: "infected" };
      const zipOf = async () => {
        await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
        const [blob, name] = downloadBlob.mock.calls.at(-1) as [Blob, string];
        return { name, parts: unzip(await blobBytes(blob)).map((p) => ({ name: p.name, text: new TextDecoder().decode(p.data as Uint8Array) })) };
      };

      beforeEach(() => {
        api.documentFile.mockImplementation(async (d: { storage_path: string }) => new Blob([`BYTES OF ${d.storage_path}`]));
      });

      it("offers a complete PEO's bundle as its main action, saying what is in it, and a PEO missing something the bundle anyway", async () => {
        api.loadSubmission.mockResolvedValue(detail({ pipelineStatus: "ready_for_market", documents: [lossRuns] }));
        renderPage();
        const needs = await panel();
        const justworks = (await within(needs).findByRole("heading", { name: "Justworks" })).closest("article")!;
        expect(within(justworks).getByRole("button", { name: "Download bundle" })).toHaveClass("bg-primary");
        expect(justworks).toHaveTextContent("Includes: packet, workers' comp application. No census file: the certified version holds none. Nothing it requires is missing.");
        const trinet = within(needs).getByRole("heading", { name: "TriNet" }).closest("article")!;
        expect(within(trinet).getByRole("button", { name: "Draft information request" })).toHaveClass("bg-primary");
        expect(within(trinet).getByRole("button", { name: "Download bundle anyway" })).not.toHaveClass("bg-primary");
        expect(trinet).toHaveTextContent("Includes: packet, workers' comp application, 1 document. No census file: the certified version holds none. Missing: 1 answer.");
      });

      it("builds the bundle from the certified copy, not answers changed since, with only documents on file, and names what is missing", async () => {
        const changed = { ...signedData, company_name: "Edited Later Inc" };
        api.loadSubmission.mockResolvedValue(detail({
          pipelineStatus: "ready_for_market", certified: false, intakeStatus: "in_progress", data: changed, currentVersion: 1,
          submission: { ...detail().submission!, version: 1 },
          signed: { data: signedData, signedAt: "2026-10-01T12:00:05Z", provenance: detail().provenance, documents: [blocked], extraAnswers: {} },
        }));
        renderPage();
        const trinet = (await within(await panel()).findByRole("heading", { name: "TriNet" })).closest("article")!;
        fireEvent.click(within(trinet).getByRole("button", { name: "Download bundle anyway" }));
        const { name, parts } = await zipOf();
        expect(name).toBe("EAA-2026-S1-trinet-v1.zip");
        const contents = parts[0].text;
        expect(contents).toContain("Signed Co · File ID EAA-2026-S1 · certified version 1");
        expect(contents).toContain("The prospect has changed answers since certifying. These files are from version 1.");
        expect(contents).toContain("Documents TriNet requires that aren't in this bundle:\r\n- Workers' comp loss runs (Three years of loss runs): blocked by the virus check");
        expect(parts.map((p) => p.text).join("\n")).not.toContain("Edited Later Inc");
        // The blocked file is never fetched, let alone included.
        expect(api.documentFile).not.toHaveBeenCalled();
        expect(parts.map((p) => p.name).filter((n) => n.startsWith("documents/"))).toEqual([]);
      });

      it("warns on the contents page when the PEO's profile is out of date, as its card does, by today's date", async () => {
        // Today is pinned to 11 Nov 2026: checked 2 Mar 2026 is more than 180 days ago.
        peoCatalogRows = catalog().map((p) => (p.name === "Justworks" ? { ...p, profile: { ...p.profile!, sources: { answers: { ...sourced, checked_on: "2026-03-02" } } } } : p));
        api.loadSubmission.mockResolvedValue(detail({ pipelineStatus: "ready_for_market" }));
        renderPage();
        const justworks = (await within(await panel()).findByRole("heading", { name: "Justworks" })).closest("article")!;
        fireEvent.click(within(justworks).getByRole("button", { name: "Download bundle" }));
        const { parts } = await zipOf();
        expect(parts[0].text.split("\r\n")[3]).toBe("Justworks's profile was last checked 2 Mar 2026 and may be out of date.");
      });

      it("carries the documents on file, fetched as the page opens them, and holds no advisor notes or reviews", async () => {
        api.loadSubmission.mockResolvedValue(detail({
          pipelineStatus: "ready_for_market", documents: [lossRuns, blocked],
          notes: [{ id: 1, session_id: "s1", body: "Call the CFO on Monday", author_id: "a1", author_email: "adv@example.com", created_at: "2026-10-02T00:00:00Z" }] as unknown as SubmissionDetail["notes"],
          reviews: { employee_count: { review_state: "follow_up", has_correction: true, corrected_value: 14, reason: "Payroll register says 14" } } as unknown as SubmissionDetail["reviews"],
        }));
        renderPage();
        const trinet = (await within(await panel()).findByRole("heading", { name: "TriNet" })).closest("article")!;
        fireEvent.click(within(trinet).getByRole("button", { name: "Download bundle anyway" }));
        const { parts } = await zipOf();
        expect(api.documentFile).toHaveBeenCalledTimes(1);
        expect(api.documentFile).toHaveBeenCalledWith(expect.objectContaining({ storage_path: "prospect-1/loss-runs.pdf" }));
        expect(parts.find((p) => p.name === "documents/loss-runs.pdf")?.text).toBe("BYTES OF prospect-1/loss-runs.pdf");
        expect(parts.map((p) => p.text).join("\n")).not.toMatch(/Call the CFO|Payroll register says/);
      });

      it("asks whether it was sent once downloaded, and records the send only when the advisor says so", async () => {
        api.loadSubmission.mockResolvedValue(detail({ pipelineStatus: "ready_for_market", currentVersion: 1, submission: { ...detail().submission!, version: 1 } }));
        api.recordQuoteSend.mockResolvedValue(undefined);
        renderPage();
        const justworks = (await within(await panel()).findByRole("heading", { name: "Justworks" })).closest("article")!;
        expect(within(justworks).queryByText("Sent this to Justworks?")).not.toBeInTheDocument();
        fireEvent.click(within(justworks).getByRole("button", { name: "Download bundle" }));
        await zipOf();
        // A download is never a send by itself.
        expect(await within(justworks).findByText("Sent this to Justworks?")).toBeInTheDocument();
        expect(api.recordQuoteSend).not.toHaveBeenCalled();
        fireEvent.click(within(justworks).getByRole("button", { name: "Not yet" }));
        expect(within(justworks).queryByText("Sent this to Justworks?")).not.toBeInTheDocument();
        expect(api.recordQuoteSend).not.toHaveBeenCalled();

        fireEvent.click(within(justworks).getByRole("button", { name: "Download bundle" }));
        fireEvent.click(await within(justworks).findByRole("button", { name: "Record it" }));
        await waitFor(() => expect(api.recordQuoteSend).toHaveBeenCalledWith("s1", "Justworks", "2026-11-11"));
        expect(api.recordQuoteSend).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(api.loadSubmission).toHaveBeenCalledTimes(2));
      });

      it("records no send once the certification has changed since the bundle was made", async () => {
        api.loadSubmission.mockResolvedValue(detail({ pipelineStatus: "ready_for_market" }));
        renderPage();
        const justworks = (await within(await panel()).findByRole("heading", { name: "Justworks" })).closest("article")!;
        fireEvent.click(within(justworks).getByRole("button", { name: "Download bundle" }));
        const record = await within(justworks).findByRole("button", { name: "Record it" });
        intakeNow = { status: "submitted", data_sha256: "d".repeat(64), version: "2" };
        fireEvent.click(record);
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("This intake changed since you opened the page. Reload to get the certified version."));
        expect(api.recordQuoteSend).not.toHaveBeenCalled();
      });

      it("says what the send function refuses instead of hiding it", async () => {
        api.loadSubmission.mockResolvedValue(detail({ pipelineStatus: "ready_for_market" }));
        api.recordQuoteSend.mockRejectedValue(new Error("Move this submission to Ready for market first. It is submitted"));
        renderPage();
        const justworks = (await within(await panel()).findByRole("heading", { name: "Justworks" })).closest("article")!;
        fireEvent.click(within(justworks).getByRole("button", { name: "Download bundle" }));
        fireEvent.click(await within(justworks).findByRole("button", { name: "Record it" }));
        expect(await within(justworks).findByRole("alert")).toHaveTextContent("Move this submission to Ready for market first. It is submitted");
      });

      describe("for a PEO that already has a quote request", () => {
        const request = (status: string) => ({ id: 7, session_id: "s1", peo_name: "justworks", status, sent_version: 1, sent_on: "2026-11-03",
          quote_received_on: null, quote_expires_on: null, proposed_start_on: null, admin_fee_pepm: null, note: null });
        const downloaded = async (status: string, stage = "sent_to_carrier") => {
          api.loadSubmission.mockResolvedValue(detail({ pipelineStatus: stage as SubmissionDetail["pipelineStatus"], quoteRequests: [request(status)] as SubmissionDetail["quoteRequests"] }));
          api.recordQuoteSend.mockResolvedValue(undefined);
          renderPage();
          const justworks = (await within(await panel()).findByRole("heading", { name: "Justworks" })).closest("article")!;
          fireEvent.click(within(justworks).getByRole("button", { name: "Download bundle" }));
          await zipOf();
          await within(justworks).findByText("Already recorded as sent to Justworks on Nov 3, 2026.");
          return justworks;
        };

        it("says when it was sent, and while it is still waiting offers only to record it again as sent today", async () => {
          const justworks = await downloaded("sent");
          expect(within(justworks).queryByText("Sent this to Justworks?")).not.toBeInTheDocument();
          expect(within(justworks).queryByRole("button", { name: "Record it" })).not.toBeInTheDocument();
          fireEvent.click(within(justworks).getByRole("button", { name: "Record it again as sent today" }));
          await waitFor(() => expect(api.recordQuoteSend).toHaveBeenCalledWith("s1", "Justworks", "2026-11-11"));
        });

        it("records nothing on Not yet", async () => {
          const justworks = await downloaded("sent");
          fireEvent.click(within(justworks).getByRole("button", { name: "Not yet" }));
          expect(within(justworks).queryByText("Already recorded as sent to Justworks on Nov 3, 2026.")).not.toBeInTheDocument();
          expect(api.recordQuoteSend).not.toHaveBeenCalled();
        });

        it.each(["quoted", "declined", "closed"])("offers no send to record once it is %s, so its send date is never lost", async (status) => {
          const justworks = await downloaded(status);
          expect(within(justworks).queryByRole("button", { name: /Record it/ })).not.toBeInTheDocument();
          fireEvent.click(within(justworks).getByRole("button", { name: "Close" }));
          expect(within(justworks).queryByText("Already recorded as sent to Justworks on Nov 3, 2026.")).not.toBeInTheDocument();
          expect(api.recordQuoteSend).not.toHaveBeenCalled();
        });

        it("still says what the stage needs before a waiting one can be recorded again", async () => {
          const justworks = await downloaded("sent", "submitted");
          expect(justworks).toHaveTextContent("To record a send to Justworks, move this submission to Ready for market first.");
          expect(within(justworks).queryByRole("button", { name: /Record it/ })).not.toBeInTheDocument();
        });
      });

      it("offers no Record it where the stage allows no send, and says what would", async () => {
        api.loadSubmission.mockResolvedValue(detail({ pipelineStatus: "submitted" }));
        renderPage();
        const justworks = (await within(await panel()).findByRole("heading", { name: "Justworks" })).closest("article")!;
        fireEvent.click(within(justworks).getByRole("button", { name: "Download bundle" }));
        expect(await within(justworks).findByText("To record a send to Justworks, move this submission to Ready for market first.")).toBeInTheDocument();
        expect(within(justworks).queryByRole("button", { name: "Record it" })).not.toBeInTheDocument();
      });
    });
  });
});
