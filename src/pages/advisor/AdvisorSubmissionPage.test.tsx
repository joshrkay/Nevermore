import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import type { Manuscript } from "@/data/manuscript";
import type { SubmissionDetail } from "@/lib/advisorApi";

const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "adv@example.com" }, signOut }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const api = {
  loadSubmission: vi.fn(),
  setStatus: vi.fn(),
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
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  data: signedData,
  provenance: {
    employee_count: {
      status: "inferred",
      source: { kind: "transcript", message_id: "m2", quote: "about a dozen people" },
      updated_at: "2026-10-01T00:00:00Z",
    },
  },
  certified: true,
  submission: {
    signer_name: "Jo Doe",
    signer_title: "CEO",
    signed_at: "2026-10-01T12:00:00Z",
    certified_at: "2026-10-01T12:00:05Z",
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
  documents: [
    { id: "d1", file_name: "census.xlsx", file_size: "12 KB", category: "census", status: "uploaded", storage_path: "prospect-1/x_census.xlsx", created_at: "2026-10-01T00:00:00Z" },
  ],
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
    downloadBlob.mockReset();
    buildManuscriptPdf.mockClear();
    api.loadSubmission.mockResolvedValue(detail());
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

  it("changes the status with a note and shows who changed it before", async () => {
    renderPage();
    const panel = (await screen.findByRole("heading", { name: "Status" })).closest("section")!;
    expect(within(panel).getAllByText(/^Prospect ·/).length).toBe(2);
    fireEvent.change(within(panel).getByLabelText("Change status to"), { target: { value: "information_requested" } });
    expect(within(panel).getByText(/The prospect will see/)).toBeInTheDocument();
    fireEvent.change(within(panel).getByLabelText("Change status to"), { target: { value: "lost" } });
    expect(within(panel).getByText(/Internal only/)).toBeInTheDocument();
    fireEvent.change(within(panel).getByLabelText("Internal note (optional)"), { target: { value: "Went with incumbent" } });
    api.setStatus.mockResolvedValue(undefined);
    fireEvent.click(within(panel).getByRole("button", { name: "Update status" }));
    await waitFor(() => expect(api.setStatus).toHaveBeenCalledWith("s1", "lost", "Went with incumbent"));
    await waitFor(() => expect(api.loadSubmission).toHaveBeenCalledTimes(2));
    expect(within(panel).queryByRole("option", { name: "Draft" })).not.toBeInTheDocument();
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
    await waitFor(() => expect(api.reviewField).toHaveBeenCalledWith("s1", "employee_count", "verified", { kind: "keep" }, ""));

    fireEvent.click(within(row).getByRole("button", { name: "Correct" }));
    fireEvent.change(within(row).getByLabelText("Corrected value"), { target: { value: "lots" } });
    fireEvent.change(within(row).getByLabelText("Reason"), { target: { value: "Payroll register" } });
    fireEvent.click(within(row).getByRole("button", { name: "Save correction" }));
    expect(api.reviewField).toHaveBeenCalledTimes(1); // "lots" isn't a number

    fireEvent.change(within(row).getByLabelText("Corrected value"), { target: { value: "14" } });
    fireEvent.click(within(row).getByRole("button", { name: "Save correction" }));
    await waitFor(() =>
      expect(api.reviewField).toHaveBeenLastCalledWith("s1", "employee_count", "follow_up", { kind: "set", value: 14 }, "Payroll register"),
    );
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
          },
        ],
        versions: [
          {
            id: "v1", session_id: "s1", version: 1, file_id: "EAA-2026-S1", storage_path: "s1/v1-a.pdf", pdf_sha256: "a".repeat(64),
            certified_data_hash: "h", certified_signed_at: "2026-10-01T12:00:00Z", review_event_id: 0, corrections_applied: 0,
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
    });
    const [manuscript, opts] = buildManuscriptPdf.mock.calls[0] as unknown as [Manuscript, { revealSensitive: boolean }];
    expect(opts.revealSensitive).toBe(true);
    expect(manuscript.companyRows[0]).toEqual(["Legal Name", "Signed Co LLC", "company_name"]);
    expect(manuscript.advisorReview).toEqual({
      version: 2,
      corrections: [{ field: "company_name", label: "Company legal name", prospectValue: "Signed Co", advisorValue: "Signed Co LLC", reason: "Per W-9" }],
    });
    expect(manuscript.signer?.name).toBe("Jo Doe");
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "The_Manuscript_EAA-2026-S1-v2_Signed_Co.pdf"));
  });

  it("downloads a stored version through a short-lived link", async () => {
    const v = {
      id: "v1", session_id: "s1", version: 1, file_id: "EAA-2026-S1", storage_path: "s1/v1-a.pdf", pdf_sha256: "a".repeat(64),
      certified_data_hash: "h", certified_signed_at: "2026-10-01T12:00:00Z", review_event_id: 0, corrections_applied: 0,
      sensitive_revealed: false, generated_by: "a1", generated_by_email: "adv@example.com", generated_at: "2026-10-01T13:00:00Z",
    };
    api.loadSubmission.mockResolvedValue(detail({ versions: [v] }));
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });
    api.manuscriptUrl.mockResolvedValue("https://storage.example/signed");
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Download v1" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://storage.example/signed"));
    expect(api.manuscriptUrl).toHaveBeenCalledWith(v, "The_Manuscript_EAA-2026-S1-v1_Signed_Co.pdf");
  });

  it("won't generate a Manuscript for an intake that isn't certified", async () => {
    api.loadSubmission.mockResolvedValue(detail({ certified: false, intakeStatus: "in_progress", submission: null, pipelineStatus: "draft" }));
    renderPage();
    expect(await screen.findByText(/Not certified yet. A Manuscript can be generated once/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Generate Manuscript/ })).not.toBeInTheDocument();
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
});
