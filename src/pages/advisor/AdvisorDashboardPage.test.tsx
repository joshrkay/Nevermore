import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate, useParams } from "react-router-dom";
import type { SubmissionSummary } from "@/lib/advisorApi";

const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "adv@example.com" }, signOut }) }));
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
  file_id: "EAA-2026-ACME0001",
  states: ["CA", "NY"],
  ...over,
});

const ShowId = () => <p>Detail page for {useParams().id}</p>;

const renderAt = (url = "/advisor") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/advisor" element={<AdvisorDashboardPage />} />
        <Route path="/advisor/submissions/:id" element={<p>Detail page</p>} />
      </Routes>
    </MemoryRouter>,
  );

const companyOrder = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("link")[0].textContent);

describe("AdvisorDashboardPage", () => {
  beforeEach(() => {
    listSubmissions.mockReset();
    signOut.mockReset().mockResolvedValue(undefined);
  });

  it("shows a loading state", () => {
    listSubmissions.mockReturnValue(new Promise(() => {}));
    renderAt();
    expect(screen.getByRole("status")).toHaveTextContent("Loading submissions");
  });

  it("lists company, contact, state footprint, headcount, submission date, status and completeness", async () => {
    listSubmissions.mockResolvedValue([
      row(),
      row({
        session_id: "s2",
        company_name: null,
        contact_name: null,
        pipeline_status: "draft",
        intake_status: "in_progress",
        signer_name: null,
        submitted_at: null,
        file_id: null,
        states: [],
        employee_count: null,
        missing_required: ["Pay frequency", "Employee census"],
      }),
      row({ session_id: "s3", company_name: "Beta", pipeline_status: "under_review", open_fields: 2 }),
    ]);
    renderAt();
    const acme = (await screen.findByRole("link", { name: "Acme" })).closest("tr")!;
    expect(screen.getByRole("link", { name: "Acme" })).toHaveAttribute("href", "/advisor/submissions/s1");
    expect(within(acme).getByText("Pat Prospect")).toBeInTheDocument();
    expect(within(acme).getByText("EAA-2026-ACME0001")).toBeInTheDocument();
    expect(within(acme).getByText("CA, NY")).toBeInTheDocument();
    expect(within(acme).getByText("12")).toBeInTheDocument();
    expect(within(acme).getByText("Submitted")).toBeInTheDocument();
    expect(within(acme).getByText("Oct 1, 2026")).toBeInTheDocument();
    expect(within(acme).getByText("Complete")).toBeInTheDocument();

    const draft = screen.getByRole("link", { name: "Company not provided" }).closest("tr")!;
    expect(within(draft).getByText("Draft")).toBeInTheDocument();
    expect(within(draft).getByText("Not certified")).toBeInTheDocument();
    expect(within(draft).getByText("Missing required")).toBeInTheDocument();
    expect(within(draft).getByText("Pay frequency, Employee census")).toBeInTheDocument();
    // An intake with no certified file id still shows the reference the detail page will show.
    expect(within(draft).getByText("EAA-2026-S2")).toBeInTheDocument();

    const beta = screen.getByRole("link", { name: "Beta" }).closest("tr")!;
    expect(within(beta).getByText("Under review")).toBeInTheDocument();
    expect(within(beta).getByText("Needs review")).toBeInTheDocument();
  });

  it("only lists what an advisor needs to triage, nothing sensitive", async () => {
    listSubmissions.mockResolvedValue([row()]);
    renderAt();
    await screen.findByRole("link", { name: "Acme" });
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Company", "Contact", "States", "Employees", "Submitted", "Status", "Completeness",
    ]);
  });

  it("keeps the order the database chose", async () => {
    listSubmissions.mockResolvedValue([
      row({ session_id: "s1", company_name: "Zeta" }),
      row({ session_id: "s2", company_name: "Alpha" }),
      row({ session_id: "s3", company_name: "Mid" }),
    ]);
    renderAt();
    await screen.findByRole("link", { name: "Zeta" });
    expect(companyOrder()).toEqual(["Zeta", "Alpha", "Mid"]);
    expect(screen.getByText(/Certified submissions first, newest first/)).toBeInTheDocument();
  });

  it("opens the matching submission from a click anywhere on its row", async () => {
    listSubmissions.mockResolvedValue([
      row({ session_id: "s1", contact_name: "Pat Prospect" }),
      row({ session_id: "s2", company_name: "Beta", contact_name: "Bo Buyer" }),
    ]);
    render(
      <MemoryRouter initialEntries={["/advisor"]}>
        <Routes>
          <Route path="/advisor" element={<AdvisorDashboardPage />} />
          <Route path="/advisor/submissions/:id" element={<ShowId />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByText("Bo Buyer"));
    expect(await screen.findByText("Detail page for s2")).toBeInTheDocument();
  });

  it("opens a submission once from its link, so Back returns to the queue", async () => {
    listSubmissions.mockResolvedValue([row({ session_id: "s1" })]);
    const Detail = () => {
      const navigate = useNavigate();
      return <button onClick={() => navigate(-1)}>Back</button>;
    };
    render(
      <MemoryRouter initialEntries={["/advisor"]}>
        <Routes>
          <Route path="/advisor" element={<AdvisorDashboardPage />} />
          <Route path="/advisor/submissions/:id" element={<Detail />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("link", { name: "Acme" }));
    fireEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(await screen.findByRole("heading", { name: "Submissions" })).toBeInTheDocument();
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

  describe("search", () => {
    const rows = [
      row({ session_id: "s1", company_name: "Acme Holdings", contact_name: "Pat Prospect", file_id: "EAA-2026-AAAA1111" }),
      row({ session_id: "s2", company_name: "Beta Works", contact_name: "Bo Buyer", file_id: "EAA-2026-BBBB2222" }),
      row({ session_id: "s3", company_name: "Gamma", contact_name: "Pat Gamma", file_id: "EAA-2026-CCCC3333" }),
    ];

    it("narrows the list by company, contact or reference without reloading", async () => {
      listSubmissions.mockResolvedValue(rows);
      renderAt();
      await screen.findByRole("link", { name: "Acme Holdings" });
      const calls = listSubmissions.mock.calls.length;
      const box = screen.getByLabelText("Search");

      fireEvent.change(box, { target: { value: "beta" } });
      expect(companyOrder()).toEqual(["Beta Works"]);

      fireEvent.change(box, { target: { value: "pat" } });
      expect(companyOrder()).toEqual(["Acme Holdings", "Gamma"]);

      fireEvent.change(box, { target: { value: "pat gamma" } });
      expect(companyOrder()).toEqual(["Gamma"]);

      fireEvent.change(box, { target: { value: "eaa-2026-bbbb" } });
      expect(companyOrder()).toEqual(["Beta Works"]);

      expect(listSubmissions.mock.calls.length).toBe(calls);
    });

    it("says how many match", async () => {
      listSubmissions.mockResolvedValue(rows);
      renderAt();
      await screen.findByRole("link", { name: "Acme Holdings" });
      expect(screen.getByText("3 submissions")).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Search"), { target: { value: "pat" } });
      expect(screen.getByText("2 of 3 submissions match")).toBeInTheDocument();
    });

    it("keeps the search in the URL and reads it back", async () => {
      listSubmissions.mockResolvedValue(rows);
      renderAt("/advisor?q=gamma");
      expect(await screen.findByRole("link", { name: "Gamma" })).toBeInTheDocument();
      expect(screen.getByLabelText("Search")).toHaveValue("gamma");
      expect(companyOrder()).toEqual(["Gamma"]);
    });

    it("explains a search that finds nothing, and clears it", async () => {
      listSubmissions.mockResolvedValue(rows);
      renderAt();
      await screen.findByRole("link", { name: "Acme Holdings" });
      fireEvent.change(screen.getByLabelText("Search"), { target: { value: "zzz" } });
      expect(screen.getByText("No submissions match “zzz”.")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
      expect(screen.getByLabelText("Search")).toHaveValue("");
      expect(companyOrder()).toHaveLength(3);
    });

    it("combines with the status filter", async () => {
      listSubmissions.mockResolvedValue(rows);
      renderAt("/advisor?status=won&q=zzz");
      expect(await screen.findByText("No won submissions match “zzz”.")).toBeInTheDocument();
      expect(listSubmissions).toHaveBeenCalledWith("won");
    });
  });

  it("has an empty state", async () => {
    listSubmissions.mockResolvedValue([]);
    renderAt();
    expect(await screen.findByText("No submissions yet.")).toBeInTheDocument();
  });

  it("shows an error and retries", async () => {
    listSubmissions.mockRejectedValueOnce(new Error("Network request failed"));
    renderAt();
    expect(await screen.findByRole("alert")).toHaveTextContent("Network request failed");
    listSubmissions.mockResolvedValue([row()]);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
  });

  it("ends the session when the server says it has expired", async () => {
    listSubmissions.mockRejectedValueOnce(Object.assign(new Error("Your session has expired."), { unauthenticated: true }));
    renderAt();
    expect(await screen.findByRole("alert")).toHaveTextContent("Your session has expired");
    expect(signOut).toHaveBeenCalledWith("expired");
  });

  it("tells an account that has lost advisor access, and doesn't offer a retry", async () => {
    listSubmissions.mockRejectedValueOnce(Object.assign(new Error("You don't have advisor access."), { forbidden: true }));
    renderAt();
    expect(await screen.findByRole("alert")).toHaveTextContent("You no longer have advisor access");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });
});
