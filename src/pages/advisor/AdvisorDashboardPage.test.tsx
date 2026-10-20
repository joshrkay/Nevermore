import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { SubmissionSummary } from "@/lib/advisorApi";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "adv@example.com" }, signOut: vi.fn() }) }));
const listSubmissions = vi.fn();
vi.mock("@/lib/advisorApi", () => ({ listSubmissions: (s: unknown) => listSubmissions(s) }));

const { default: AdvisorDashboardPage } = await import("./AdvisorDashboardPage");

const row = (over: Partial<SubmissionSummary> = {}): SubmissionSummary => ({
  session_id: "s1",
  company_name: "Acme",
  contact_name: "Pat Prospect",
  employee_count: 12,
  pipeline_status: "submitted",
  intake_status: "submitted",
  signer_name: "Jo Doe",
  submitted_at: "2026-10-01T12:00:00Z",
  created_at: "2026-09-30T12:00:00Z",
  updated_at: "2026-10-01T12:00:00Z",
  missing_required: [],
  open_fields: 0,
  flagged_fields: 0,
  verified_fields: 0,
  ...over,
});

const renderAt = (url = "/advisor") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <AdvisorDashboardPage />
    </MemoryRouter>,
  );

describe("AdvisorDashboardPage", () => {
  beforeEach(() => {
    listSubmissions.mockReset();
  });

  it("shows a loading state", () => {
    listSubmissions.mockReturnValue(new Promise(() => {}));
    renderAt();
    expect(screen.getByRole("status")).toHaveTextContent("Loading submissions");
  });

  it("lists submissions with status, company, submission date and completeness", async () => {
    listSubmissions.mockResolvedValue([
      row(),
      row({
        session_id: "s2",
        company_name: null,
        pipeline_status: "draft",
        intake_status: "in_progress",
        signer_name: null,
        submitted_at: null,
        missing_required: ["Pay frequency", "Employee census"],
      }),
      row({ session_id: "s3", company_name: "Beta", pipeline_status: "under_review", open_fields: 2 }),
    ]);
    renderAt();
    const acme = (await screen.findByRole("link", { name: "Acme" })).closest("tr")!;
    expect(screen.getByRole("link", { name: "Acme" })).toHaveAttribute("href", "/advisor/submissions/s1");
    expect(within(acme).getByText("Submitted")).toBeInTheDocument();
    expect(within(acme).getByText("Oct 1, 2026")).toBeInTheDocument();
    expect(within(acme).getByText("Complete")).toBeInTheDocument();

    const draft = screen.getByRole("link", { name: "Company not provided" }).closest("tr")!;
    expect(within(draft).getByText("Draft")).toBeInTheDocument();
    expect(within(draft).getByText("Not certified")).toBeInTheDocument();
    expect(within(draft).getByText("Missing required")).toBeInTheDocument();
    expect(within(draft).getByText("Pay frequency, Employee census")).toBeInTheDocument();

    const beta = screen.getByRole("link", { name: "Beta" }).closest("tr")!;
    expect(within(beta).getByText("Under review")).toBeInTheDocument();
    expect(within(beta).getByText("Needs review")).toBeInTheDocument();
  });

  it("filters by status", async () => {
    listSubmissions.mockResolvedValue([row()]);
    renderAt();
    await screen.findByRole("link", { name: "Acme" });
    expect(listSubmissions).toHaveBeenLastCalledWith(null);

    listSubmissions.mockResolvedValue([]);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "won" } });
    expect(await screen.findByText("No submissions are won.")).toBeInTheDocument();
    expect(listSubmissions).toHaveBeenLastCalledWith("won");

    listSubmissions.mockResolvedValue([row()]);
    fireEvent.click(screen.getByRole("button", { name: "Show all statuses" }));
    expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
    expect(listSubmissions).toHaveBeenLastCalledWith(null);
  });

  it("reads the filter from the URL", async () => {
    listSubmissions.mockResolvedValue([]);
    renderAt("/advisor?status=information_requested");
    expect(await screen.findByText("No submissions are information requested.")).toBeInTheDocument();
    expect(listSubmissions).toHaveBeenCalledWith("information_requested");
  });

  it("has an empty state", async () => {
    listSubmissions.mockResolvedValue([]);
    renderAt();
    expect(await screen.findByText("No submissions yet.")).toBeInTheDocument();
  });

  it("shows an error and retries", async () => {
    listSubmissions.mockRejectedValueOnce(new Error("You don't have advisor access."));
    renderAt();
    expect(await screen.findByRole("alert")).toHaveTextContent("You don't have advisor access.");
    listSubmissions.mockResolvedValue([row()]);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
  });
});
