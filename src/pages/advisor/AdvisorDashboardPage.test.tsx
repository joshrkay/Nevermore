import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import type { SubmissionSummary } from "@/lib/advisorApi";

const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "adv@example.com" }, signOut }) }));
const listSubmissions = vi.fn();
const listEmailProblems = vi.fn();
// A test can resolve a plain list (one page holding everything) or a page with its own total.
vi.mock("@/lib/advisorApi", () => ({
  QUEUE_PAGE_SIZE: 25,
  listSubmissions: async (opts: unknown) => {
    const result = await listSubmissions(opts);
    return Array.isArray(result) ? { rows: result, total: result.length } : result;
  },
  listEmailProblems: () => listEmailProblems(),
}));
const query = (over: Record<string, unknown> = {}) => ({ status: null, search: "", page: 1, needsAction: false, waiting: false, sort: null, ...over });

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
  needs_action: false,
  needs_action_note: null,
  quote_requests_sent: 0,
  quotes_received: 0,
  oldest_waiting_on: null,
  earliest_quote_expires_on: null,
  sent_older_version: false,
  start_month: null,
  total_count: 1,
  ...over,
});

const ShowId = () => <p>Detail page for {useParams().id}</p>;
const LocationProbe = () => <p data-testid="location">{useLocation().search}</p>;

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
    listEmailProblems.mockReset().mockResolvedValue([]);
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
    expect(within(draft).getByText("No File ID yet")).toBeInTheDocument(); // assigned when the prospect certifies

    const beta = screen.getByRole("link", { name: "Beta" }).closest("tr")!;
    expect(within(beta).getByText("Under review")).toBeInTheDocument();
    expect(within(beta).getByText("Needs review")).toBeInTheDocument();
  });

  it("says what is true when there is no submission date", async () => {
    listSubmissions.mockResolvedValue([
      // Submitted before the server stamped certification dates: certified, date unknown.
      row({ session_id: "legacy", company_name: "Legacy Co", submitted_at: null, intake_status: "submitted", signer_name: "Jo Doe" }),
      // Certified once, then the prospect changed their answers.
      row({ session_id: "withdrawn", company_name: "Changed Co", submitted_at: null, intake_status: "in_progress", signer_name: "Jo Doe", pipeline_status: "draft" }),
      row({ session_id: "never", company_name: "Never Co", submitted_at: null, intake_status: "in_progress", signer_name: null, pipeline_status: "draft" }),
    ]);
    renderAt();
    const cell = async (name: string) => (await screen.findByRole("link", { name })).closest("tr")!;
    expect(within(await cell("Legacy Co")).getByText("Date not recorded")).toBeInTheDocument();
    expect(within(await cell("Changed Co")).getByText("Needs re-certification")).toBeInTheDocument();
    expect(within(await cell("Never Co")).getByText("Not certified")).toBeInTheDocument();
  });

  it("says when a draft can no longer be opened by its prospect", async () => {
    listSubmissions.mockResolvedValue([
      row({ session_id: "e", company_name: "Idle Co", submitted_at: null, intake_status: "expired", signer_name: null, pipeline_status: "draft" }),
      row({ session_id: "a", company_name: "Restarted Co", submitted_at: null, intake_status: "archived", signer_name: null, pipeline_status: "draft" }),
      row({ session_id: "r", company_name: "Closed Co", submitted_at: null, intake_status: "revoked", signer_name: null, pipeline_status: "draft" }),
    ]);
    renderAt();
    const cell = async (name: string) => (await screen.findByRole("link", { name })).closest("tr")!;
    expect(within(await cell("Idle Co")).getByText("Expired (idle draft)")).toBeInTheDocument();
    expect(within(await cell("Restarted Co")).getByText("Archived by prospect")).toBeInTheDocument();
    expect(within(await cell("Closed Co")).getByText("Revoked")).toBeInTheDocument();
  });

  it("only lists what an advisor needs to triage, nothing sensitive", async () => {
    listSubmissions.mockResolvedValue([row()]);
    renderAt();
    await screen.findByRole("link", { name: "Acme" });
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Company", "Contact", "States", "Employees", "Submitted", "Status", "Completeness", "Quotes",
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
    expect(listSubmissions).toHaveBeenLastCalledWith(query());

    listSubmissions.mockResolvedValue([]);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "won" } });
    expect(await screen.findByText("No submissions are won.")).toBeInTheDocument();
    expect(listSubmissions).toHaveBeenLastCalledWith(query({ status: "won" }));

    listSubmissions.mockResolvedValue([row()]);
    fireEvent.click(screen.getByRole("button", { name: "Show all statuses" }));
    expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
    expect(listSubmissions).toHaveBeenLastCalledWith(query());
  });

  it("reads the filter from the URL", async () => {
    listSubmissions.mockResolvedValue([]);
    renderAt("/advisor?status=information_requested");
    expect(await screen.findByText("No submissions are information requested.")).toBeInTheDocument();
    expect(listSubmissions).toHaveBeenCalledWith(query({ status: "information_requested" }));
  });

  it("marks a submission that needs advisor action on its row, with the advisor's note", async () => {
    listSubmissions.mockResolvedValue([
      row({ session_id: "s1", needs_action: true, needs_action_note: "Call the CFO about payroll" }),
      row({ session_id: "s2", company_name: "Beta" }),
    ]);
    renderAt();
    await screen.findByRole("link", { name: "Acme" });
    const marked = screen.getByTestId("needs-action-s1");
    expect(marked).toHaveTextContent("Needs advisor action");
    expect(marked).toHaveTextContent("Call the CFO about payroll");
    expect(screen.queryByTestId("needs-action-s2")).not.toBeInTheDocument();
  });

  it("lists only the submissions that need advisor action, alone or with a status, and says when there are none", async () => {
    listSubmissions.mockResolvedValue([row({ needs_action: true })]);
    renderAt("/advisor?status=under_review");
    await screen.findByRole("link", { name: "Acme" });
    const toggle = screen.getByRole("checkbox", { name: "Needs advisor action only" });
    expect(toggle).not.toBeChecked();

    listSubmissions.mockResolvedValue([]);
    fireEvent.click(toggle);
    expect(await screen.findByText("No under review submissions that need advisor action.")).toBeInTheDocument();
    expect(listSubmissions).toHaveBeenLastCalledWith(query({ status: "under_review", needsAction: true }));
    expect(screen.getByRole("checkbox", { name: "Needs advisor action only" })).toBeChecked();

    listSubmissions.mockResolvedValue([row()]);
    fireEvent.click(screen.getByRole("button", { name: "Show all submissions" }));
    expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
    expect(listSubmissions).toHaveBeenLastCalledWith(query());
  });

  it("reads the needs-action filter from the URL", async () => {
    listSubmissions.mockResolvedValue([]);
    renderAt("/advisor?action=1");
    expect(await screen.findByText("No submissions that need advisor action.")).toBeInTheDocument();
    expect(listSubmissions).toHaveBeenCalledWith(query({ needsAction: true }));
  });

  describe("search", () => {
    const all = [
      row({ session_id: "s1", company_name: "Acme Holdings", contact_name: "Pat Prospect", file_id: "EAA-2026-AAAA1111" }),
      row({ session_id: "s2", company_name: "Beta Works", contact_name: "Bo Buyer", file_id: "EAA-2026-BBBB2222" }),
      row({ session_id: "s3", company_name: "Gamma", contact_name: "Pat Gamma", file_id: "EAA-2026-CCCC3333" }),
    ];
    // Stands in for the database's search: every word in the company, contact or reference.
    const searchDb = ({ search = "" }: { search?: string }) => {
      const words = search.toLowerCase().split(/\s+/).filter(Boolean);
      return all.filter((r) => words.every((w) => [r.company_name, r.contact_name, r.file_id].join("\n").toLowerCase().includes(w)));
    };

    it("searches in the database once typing pauses, from the first page, and keeps the search in the URL", async () => {
      listSubmissions.mockImplementation(async (opts: { search?: string }) => searchDb(opts));
      render(
        <MemoryRouter initialEntries={["/advisor?page=2"]}>
          <Routes>
            <Route path="/advisor" element={<><AdvisorDashboardPage /><LocationProbe /></>} />
          </Routes>
        </MemoryRouter>,
      );
      await screen.findByText(/nothing on page 2|Acme Holdings/);
      fireEvent.change(screen.getByLabelText("Search"), { target: { value: "pat gamma" } });
      // Not once per keystroke: nothing is asked until typing pauses.
      expect(listSubmissions).not.toHaveBeenCalledWith(query({ search: "pat gamma" }));
      await waitFor(() => expect(listSubmissions).toHaveBeenLastCalledWith(query({ search: "pat gamma" })));
      await waitFor(() => expect(companyOrder()).toEqual(["Gamma"]));
      expect(screen.getByTestId("location")).toHaveTextContent("?q=pat+gamma");
    });

    it("keeps a space typed just before a pause", async () => {
      listSubmissions.mockImplementation(async (opts: { search?: string }) => searchDb(opts));
      renderAt();
      await screen.findByRole("link", { name: "Acme Holdings" });
      const box = screen.getByLabelText("Search");
      fireEvent.change(box, { target: { value: "pat " } });
      await waitFor(() => expect(listSubmissions).toHaveBeenLastCalledWith(query({ search: "pat" })));
      expect(box).toHaveValue("pat ");
      fireEvent.change(box, { target: { value: "pat gamma" } });
      await waitFor(() => expect(listSubmissions).toHaveBeenLastCalledWith(query({ search: "pat gamma" })));
    });

    it("doesn't search until at least 3 characters are typed, and says so (F-2.2)", async () => {
      listSubmissions.mockImplementation(async (opts: { search?: string }) => searchDb(opts));
      render(
        <MemoryRouter initialEntries={["/advisor"]}>
          <Routes>
            <Route path="/advisor" element={<><AdvisorDashboardPage /><LocationProbe /></>} />
          </Routes>
        </MemoryRouter>,
      );
      await screen.findByRole("link", { name: "Acme Holdings" });
      const box = screen.getByLabelText("Search");
      fireEvent.change(box, { target: { value: " pa " } });
      expect(screen.getByText("Type at least 3 characters to search.")).toBeInTheDocument();
      // Give the pause time to pass: still nothing searched, the URL unchanged, every row listed.
      await new Promise((r) => setTimeout(r, 400));
      expect(listSubmissions).not.toHaveBeenCalledWith(expect.objectContaining({ search: "pa" }));
      expect(screen.getByTestId("location")).toHaveTextContent(/^$/);
      expect(companyOrder()).toEqual(["Acme Holdings", "Beta Works", "Gamma"]);
      expect(box).toHaveValue(" pa ");

      fireEvent.change(box, { target: { value: "pat" } });
      await waitFor(() => expect(listSubmissions).toHaveBeenLastCalledWith(query({ search: "pat" })));
      expect(screen.queryByText("Type at least 3 characters to search.")).not.toBeInTheDocument();
      await waitFor(() => expect(companyOrder()).toEqual(["Acme Holdings", "Gamma"]));

      // Deleting back below the minimum lists everything again, and keeps what's typed.
      fireEvent.change(box, { target: { value: "pa" } });
      await waitFor(() => expect(listSubmissions).toHaveBeenLastCalledWith(query()));
      await waitFor(() => expect(companyOrder()).toEqual(["Acme Holdings", "Beta Works", "Gamma"]));
      expect(box).toHaveValue("pa");
      expect(screen.getByText("Type at least 3 characters to search.")).toBeInTheDocument();
    });

    it("treats a link with a search under 3 characters as no search", async () => {
      listSubmissions.mockImplementation(async (opts: { search?: string }) => searchDb(opts));
      renderAt("/advisor?q=ga");
      await screen.findByRole("link", { name: "Beta Works" });
      expect(listSubmissions).toHaveBeenCalledWith(query());
      expect(listSubmissions).not.toHaveBeenCalledWith(query({ search: "ga" }));
      expect(screen.getByText("3 submissions")).toBeInTheDocument();
      expect(screen.getByText("Type at least 3 characters to search.")).toBeInTheDocument();
    });

    it("says how many match, across every page", async () => {
      listSubmissions.mockImplementation(async (opts: { search?: string }) => searchDb(opts));
      renderAt();
      await screen.findByRole("link", { name: "Acme Holdings" });
      expect(screen.getByText("3 submissions")).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Search"), { target: { value: "pat" } });
      expect(await screen.findByText("2 submissions match “pat”")).toBeInTheDocument();
    });

    it("reads the search from the URL", async () => {
      listSubmissions.mockImplementation(async (opts: { search?: string }) => searchDb(opts));
      renderAt("/advisor?q=gamma");
      expect(await screen.findByRole("link", { name: "Gamma" })).toBeInTheDocument();
      expect(screen.getByLabelText("Search")).toHaveValue("gamma");
      expect(listSubmissions).toHaveBeenCalledWith(query({ search: "gamma" }));
    });

    it("explains a search that finds nothing, and clears it", async () => {
      listSubmissions.mockImplementation(async (opts: { search?: string }) => searchDb(opts));
      renderAt("/advisor?q=zzz");
      expect(await screen.findByText("No submissions match “zzz”.")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
      expect(screen.getByLabelText("Search")).toHaveValue("");
      expect(await screen.findByRole("link", { name: "Acme Holdings" })).toBeInTheDocument();
      expect(companyOrder()).toHaveLength(3);
    });

    it("combines with the status filter", async () => {
      listSubmissions.mockResolvedValue([]);
      renderAt("/advisor?status=won&q=zzz");
      expect(await screen.findByText("No won submissions match “zzz”.")).toBeInTheDocument();
      expect(listSubmissions).toHaveBeenCalledWith(query({ status: "won", search: "zzz" }));
    });
  });

  describe("pages", () => {
    const pageOf = (page: number, total: number) => ({
      rows: Array.from({ length: Math.min(25, total - (page - 1) * 25) }, (_, i) =>
        row({ session_id: `s${(page - 1) * 25 + i}`, company_name: `Company ${(page - 1) * 25 + i + 1}` })),
      total,
    });

    it("shows 25 at a time with the total, and moves between pages", async () => {
      listSubmissions.mockImplementation(async ({ page }: { page: number }) => pageOf(page, 60));
      render(
        <MemoryRouter initialEntries={["/advisor"]}>
          <Routes>
            <Route path="/advisor" element={<><AdvisorDashboardPage /><LocationProbe /></>} />
          </Routes>
        </MemoryRouter>,
      );
      expect(await screen.findByText("1–25 of 60 submissions")).toBeInTheDocument();
      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      expect(await screen.findByText("26–50 of 60 submissions")).toBeInTheDocument();
      expect(listSubmissions).toHaveBeenLastCalledWith(query({ page: 2 }));
      expect(screen.getByTestId("location")).toHaveTextContent("?page=2");
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      expect(await screen.findByText("51–60 of 60 submissions")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Previous" }));
      expect(await screen.findByText("26–50 of 60 submissions")).toBeInTheDocument();
    });

    it("lets the browser's Back undo a page change", async () => {
      listSubmissions.mockImplementation(async ({ page }: { page: number }) => pageOf(page, 60));
      const BackButton = () => {
        const navigate = useNavigate();
        return <button onClick={() => navigate(-1)}>Browser back</button>;
      };
      render(
        <MemoryRouter initialEntries={["/advisor"]}>
          <Routes>
            <Route path="/advisor" element={<><AdvisorDashboardPage /><BackButton /></>} />
          </Routes>
        </MemoryRouter>,
      );
      expect(await screen.findByText("1–25 of 60 submissions")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      expect(await screen.findByText("26–50 of 60 submissions")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Browser back" }));
      expect(await screen.findByText("1–25 of 60 submissions")).toBeInTheDocument();
    });

    it("starts from the first page when the filter changes", async () => {
      listSubmissions.mockImplementation(async ({ page }: { page: number }) => pageOf(page, 60));
      renderAt("/advisor?page=3");
      expect(await screen.findByText("51–60 of 60 submissions")).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Status"), { target: { value: "submitted" } });
      expect(await screen.findByText("1–25 of 60 submissions")).toBeInTheDocument();
      expect(listSubmissions).toHaveBeenLastCalledWith(query({ status: "submitted" }));
    });

    it("says when a page is past the end, and goes back to the first", async () => {
      listSubmissions.mockImplementation(async ({ page }: { page: number }) => (page === 1 ? pageOf(1, 3) : { rows: [], total: 0 }));
      renderAt("/advisor?page=9");
      expect(await screen.findByText("There's nothing on page 9.")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Go to the first page" }));
      expect(await screen.findByText("3 submissions")).toBeInTheDocument();
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
  describe("prospects who cannot be reached by email", () => {
    it("flags the submissions whose confirmation bounced or was reported as spam, and only those", async () => {
      listSubmissions.mockResolvedValue([
        row({ session_id: "s1", company_name: "Bounced Co" }),
        row({ session_id: "s2", company_name: "Spam Co" }),
        row({ session_id: "s3", company_name: "Fine Co" }),
      ]);
      listEmailProblems.mockResolvedValue([
        { session_id: "s1", reason: "bounced", since: "2026-10-28T12:00:00Z" },
        { session_id: "s2", reason: "complained", since: "2026-10-28T12:00:00Z" },
      ]);
      renderAt();
      const rows = (await screen.findAllByRole("row")).slice(1);
      const by = (name: string) => within(rows.find((r) => within(r).queryByText(name))!);
      expect(by("Bounced Co").getByText("Email bounced")).toBeInTheDocument();
      expect(by("Spam Co").getByText("Reported as spam")).toBeInTheDocument();
      expect(by("Fine Co").queryByText(/Email bounced|Reported as spam|Email blocked/)).not.toBeInTheDocument();
      // And says what to do, for a screen reader as much as anyone.
      expect(by("Bounced Co").getByText(/Reach them another way/)).toBeInTheDocument();
    });

    it("still shows the queue, with no flags, when the check fails", async () => {
      listSubmissions.mockResolvedValue([row({ company_name: "Acme" })]);
      listEmailProblems.mockRejectedValue(new Error("Couldn't check for bounced emails."));
      renderAt();
      expect(await screen.findByText("Acme")).toBeInTheDocument();
      expect(screen.queryByText("Email bounced")).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("still shows the queue when the check throws before it can even ask", async () => {
      listSubmissions.mockResolvedValue([row({ company_name: "Acme" })]);
      listEmailProblems.mockImplementation(() => { throw new Error("synchronous"); });
      renderAt();
      expect(await screen.findByText("Acme")).toBeInTheDocument();
    });
  });

  describe("quote requests", () => {
    it("shows quotes back out of sent, the longest wait, the earliest expiry, the target start and an older version", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-16T15:00:00"));
      listSubmissions.mockResolvedValue([
        row({ quote_requests_sent: 3, quotes_received: 1, oldest_waiting_on: "2026-11-10", earliest_quote_expires_on: "2026-12-14",
          sent_older_version: true, start_month: "April 2027" }),
        row({ session_id: "s2", company_name: "Beta" }),
      ]);
      renderAt();
      const acme = (await screen.findByText("Acme")).closest("tr")!;
      expect(within(acme).getByText("1 / 3 quoted")).toBeInTheDocument();
      expect(within(acme).getByText("Waiting 6 days")).toBeInTheDocument();
      expect(within(acme).getByText("Expires Dec 14, 2026")).toBeInTheDocument();
      expect(within(acme).getByText("A PEO has an older version")).toBeInTheDocument();
      expect(within(acme).getByText("April 2027")).toBeInTheDocument();
      const beta = screen.getByText("Beta").closest("tr")!;
      expect(within(beta).queryByText(/quoted|Waiting|Expires|older version/)).not.toBeInTheDocument();
      vi.useRealTimers();
    });

    it("lists only the submissions waiting on a PEO, keeps it in the URL, and says when there are none", async () => {
      listSubmissions.mockResolvedValue([]);
      renderAt("/advisor?status=sent_to_carrier");
      await screen.findByText(/No submissions are/);
      fireEvent.click(screen.getByLabelText("Waiting on a PEO only"));
      await waitFor(() => expect(listSubmissions).toHaveBeenLastCalledWith(query({ status: "sent_to_carrier", waiting: true })));
      expect(await screen.findByText("No sent to carrier/peo submissions waiting on a PEO.")).toBeInTheDocument();
    });

    it("sorts by the longest wait or the earliest expiry, from the first page, and reads the sort from the URL", async () => {
      listSubmissions.mockResolvedValue([row()]);
      renderAt("/advisor?page=2&sort=earliest_expiry");
      await waitFor(() => expect(listSubmissions).toHaveBeenLastCalledWith(query({ page: 2, sort: "earliest_expiry" })));
      fireEvent.change(await screen.findByLabelText("Sort"), { target: { value: "oldest_waiting" } });
      await waitFor(() => expect(listSubmissions).toHaveBeenLastCalledWith(query({ sort: "oldest_waiting" })));
      fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "" } });
      await waitFor(() => expect(listSubmissions).toHaveBeenLastCalledWith(query()));
    });

    it("refreshes every minute and when the tab is back in focus, keeping the rows on screen meanwhile", async () => {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      listSubmissions.mockResolvedValueOnce([row()]);
      const { unmount } = renderAt();
      await screen.findByText("Acme");
      listSubmissions.mockReturnValue(new Promise(() => {}));
      act(() => vi.advanceTimersByTime(60_000));
      expect(listSubmissions).toHaveBeenCalledTimes(2);
      expect(screen.getByText("Acme")).toBeInTheDocument();
      expect(screen.queryByText(/Loading submissions/)).not.toBeInTheDocument();
      act(() => { window.dispatchEvent(new Event("focus")); });
      expect(listSubmissions).toHaveBeenCalledTimes(3);
      unmount();
      act(() => vi.advanceTimersByTime(60_000));
      expect(listSubmissions).toHaveBeenCalledTimes(3);
      vi.useRealTimers();
    });
  });
});
