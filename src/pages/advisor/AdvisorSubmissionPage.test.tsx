import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import type { Manuscript } from "@/data/manuscript";
import type { SubmissionDetail } from "@/lib/advisorApi";
import { toast } from "sonner";

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
};
vi.mock("@/lib/advisorApi", () => api);
const downloadBlob = vi.fn();
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: (...a: unknown[]) => downloadBlob(...a) }));
const buildManuscriptPdf = vi.fn((m: Manuscript, _opts?: unknown) => ({ blob: new Blob(["%PDF"]), filename: `${m.fileId}.pdf`, pageCount: 1 }));
vi.mock("@/lib/manuscriptPdf", () => ({ buildManuscriptPdf: (m: Manuscript, o: unknown) => buildManuscriptPdf(m, o) }));

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
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    vi.mocked(toast.error).mockReset();
    downloadBlob.mockReset();
    buildManuscriptPdf.mockClear();
    api.loadSubmission.mockResolvedValue(detail());
    api.listEmailProblems.mockResolvedValue([]);
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
    expect(screen.getByTestId("section-summary-payroll")).toHaveTextContent("1 of 5 verified · 1 advisor overridden");
    expect(screen.getByTestId("section-summary-company")).toHaveTextContent("0 of 5 verified · 1 prospect confirmed");
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
        { id: 1, session_id: "s1", message: "Is the HQ still in New York?", fields: ["hq_state"], requested_by: "adv-1", requested_by_email: "adv@example.com", requested_at: "2026-10-03T09:00:00Z" },
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
    await waitFor(() => expect(api.requestInformation).toHaveBeenCalledWith("s1", "Which payroll vendor, and how often do you pay?", ["pay_frequency", "payroll_vendor"]));
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
      detail({ certified: false, intakeStatus: "in_progress", data: current, signed: { data: signedData, signedAt: "2026-10-01T12:00:05Z" } }),
    );
    renderPage();
    const section = (await screen.findByRole("heading", { name: "Changed since signing" })).closest("section")!;
    const rows = within(section).getAllByRole("row").slice(1).map((r) => r.textContent);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r?.includes("Bi-weekly"))).toContain("Weekly");
    expect(rows.find((r) => r?.includes("12"))).toContain("14");
    expect(screen.getByText(/what changed is listed below/)).toBeInTheDocument();
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
});
