import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "owner@example.com" }, signOut: vi.fn() }) }));
// The page's calls to the database, by the names advisorApi gives them; AdvisorApiError is the real one, so a refusal is read as it is.
const api = { fetchOwnedFirms: vi.fn(), listFirmActivityPeople: vi.fn(), listFirmActivity: vi.fn() };
vi.mock("@/lib/advisorApi", async () => ({ ...(await vi.importActual<object>("@/lib/advisorApi")), ...api, FIRM_ACTIVITY_PAGE_SIZE: 25 }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const { clearOwnedFirms } = await import("@/hooks/useOwnedFirms");
const { default: AdvisorActivityPage } = await import("./AdvisorActivityPage");
const { AdvisorApiError } = await import("@/lib/advisorApi");

const renderPage = (at = "/advisor/activity") => render(<MemoryRouter initialEntries={[at]}><AdvisorActivityPage /></MemoryRouter>);
const entry = (over: Record<string, unknown> = {}) => ({
  entry_key: "k1", at: "2026-11-12T15:30:00Z", actor_id: "u1", actor_email: "agent@example.com", kind: "submission_viewed",
  record_type: "submission", record_id: "0b5c1f2e-1111-4222-8333-444455556666", subject_user_id: null, subject_email: null, role: null, ...over,
});

describe("AdvisorActivityPage", () => {
  beforeEach(() => {
    clearOwnedFirms();
    for (const fn of Object.values(api)) fn.mockReset();
    api.fetchOwnedFirms.mockResolvedValue([{ firm_id: "firm-1", name: "Alpha Advisory" }]);
    api.listFirmActivityPeople.mockResolvedValue([{ user_id: "u1", email: "agent@example.com" }, { user_id: "u2", email: "lead@example.com" }]);
    api.listFirmActivity.mockResolvedValue({ entries: [entry()], hasMore: false });
  });

  it("lists who did what and when, in the order the database gave it, with the record each was about", async () => {
    api.listFirmActivity.mockResolvedValue({
      entries: [
        entry({ entry_key: "k3", at: "2026-11-12T16:00:00Z", actor_email: "lead@example.com", kind: "send_recorded", record_type: "quote_request", record_id: "42" }),
        entry({ entry_key: "k2", actor_email: "agent@example.com", kind: "document_downloaded", record_type: "document", record_id: "doc-9" }),
      ],
      hasMore: false,
    });
    renderPage();
    const table = await screen.findByRole("table", { name: "Who did what" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["When", "Who", "What", "Record"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("lead@example.com");
    expect(rows[0]).toHaveTextContent("Recorded a send");
    expect(rows[0]).toHaveTextContent("Quote request 42");
    expect(rows[1]).toHaveTextContent("agent@example.com");
    expect(rows[1]).toHaveTextContent("Downloaded a document");
    expect(rows[1]).toHaveTextContent("Document doc-9");
    expect(api.listFirmActivity).toHaveBeenCalledWith("firm-1", { person: null, kind: null, after: null });
  });

  it("asks which firms the person owns once for the page and its header together", async () => {
    renderPage();
    await screen.findByRole("table", { name: "Who did what" });
    expect(api.fetchOwnedFirms).toHaveBeenCalledTimes(1);
  });

  it("says who may read it, and loads nothing, when the person owns no firm", async () => {
    api.fetchOwnedFirms.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Only a firm's owners can read its record of who did what.")).toBeInTheDocument();
    expect(api.listFirmActivity).not.toHaveBeenCalled();
    expect(api.listFirmActivityPeople).not.toHaveBeenCalled();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("says the same when the database refuses the read, however the page got there", async () => {
    api.listFirmActivity.mockRejectedValue(new AdvisorApiError("You don't have advisor access.", "42501"));
    renderPage();
    expect(await screen.findByText("Only a firm's owners can read its record of who did what.")).toBeInTheDocument();
    expect(screen.queryByText(/You no longer have advisor access/)).not.toBeInTheDocument();
  });

  it("shows that it is loading until the record arrives", async () => {
    let arrive: (v: unknown) => void = () => undefined;
    api.listFirmActivity.mockReturnValue(new Promise((resolve) => { arrive = resolve; }));
    renderPage();
    expect(await screen.findByRole("status")).toHaveTextContent("Loading");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    arrive({ entries: [entry()], hasMore: false });
    expect(await screen.findByRole("table", { name: "Who did what" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says when nothing has been recorded yet", async () => {
    api.listFirmActivity.mockResolvedValue({ entries: [], hasMore: false });
    renderPage();
    expect(await screen.findByText("Nothing has been recorded for your firm yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("says what failed, with the reason, and tries again when asked", async () => {
    api.listFirmActivity.mockRejectedValueOnce(new Error("The network dropped"));
    renderPage();
    expect(await screen.findByText("We couldn't load the record of who did what.")).toBeInTheDocument();
    expect(screen.getByText("The network dropped")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("table", { name: "Who did what" })).toBeInTheDocument();
    expect(api.listFirmActivity).toHaveBeenCalledTimes(2);
  });

  it("is reached from the advisor console's navigation", async () => {
    renderPage();
    await screen.findByRole("table");
    expect(within(screen.getByRole("navigation", { name: "Advisor" })).getByRole("link", { name: "Activity" })).toHaveAttribute("href", "/advisor/activity");
  });

  it("names the person a membership change was about and their role, and never shows a missing person as blank", async () => {
    api.listFirmActivity.mockResolvedValue({
      entries: [
        entry({ entry_key: "k5", kind: "member_added", record_type: "membership", record_id: "7", subject_user_id: "u2", subject_email: "lead@example.com", role: "lead" }),
        entry({ entry_key: "k4", kind: "export_made", record_type: "firm", record_id: "firm-1", actor_id: null, actor_email: null }),
        entry({ entry_key: "k3", kind: "member_ended", record_type: "membership", record_id: "6", actor_id: "gone", actor_email: null, subject_user_id: "gone2", subject_email: null, role: "agent" }),
      ],
      hasMore: false,
    });
    renderPage();
    const rows = within(await screen.findByRole("table")).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Added a member");
    expect(rows[0]).toHaveTextContent("lead@example.com (lead)");
    const whoOf = (row: HTMLElement) => within(row).getAllByRole("cell")[1].textContent;
    expect(whoOf(rows[0])).toBe("agent@example.com");
    expect(whoOf(rows[1])).toBe("System");
    expect(whoOf(rows[2])).toBe("A former member");
    expect(rows[2]).toHaveTextContent("A former member (agent)");
  });

  it("filters by person, offering the people who appear in the record, and shows what the database returns", async () => {
    renderPage();
    const person = await screen.findByLabelText("Person");
    expect(within(person).getAllByRole("option").map((o) => o.textContent)).toEqual(["Everyone", "agent@example.com", "lead@example.com"]);
    api.listFirmActivity.mockResolvedValue({ entries: [entry({ entry_key: "k9", actor_email: "lead@example.com", kind: "send_recorded" })], hasMore: false });
    fireEvent.change(person, { target: { value: "u2" } });
    await waitFor(() => expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: "u2", kind: null, after: null }));
    expect(await within(await screen.findByRole("table")).findByText("Recorded a send")).toBeInTheDocument();
  });

  it("filters by kind, offering every kind by its name", async () => {
    renderPage();
    const kind = await screen.findByLabelText("Kind");
    const options = within(kind).getAllByRole("option").map((o) => o.textContent);
    expect(options).toHaveLength(17);
    expect(options.slice(0, 3)).toEqual(["Every kind", "Signed in", "Opened a submission"]);
    fireEvent.change(kind, { target: { value: "packet_downloaded" } });
    await waitFor(() => expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: null, kind: "packet_downloaded", after: null }));
  });

  it("says when no entry matches the filters, and leaves the filters in place to change", async () => {
    renderPage();
    const kind = await screen.findByLabelText("Kind");
    api.listFirmActivity.mockResolvedValue({ entries: [], hasMore: false });
    fireEvent.change(kind, { target: { value: "export_made" } });
    expect(await screen.findByText("No entries match these filters.")).toBeInTheDocument();
    expect(screen.queryByText("Nothing has been recorded for your firm yet.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Kind")).toHaveValue("export_made");
  });

  it("pages through the record by where the last entry seen was, and goes back to the first page when a filter changes", async () => {
    // Two pages: the first has another after it, the second has none.
    const first = entry({ entry_key: "k30", at: "2026-11-12T12:00:00Z" });
    api.listFirmActivity.mockImplementation(async (_firm: string, o: { after: { key: string } | null }) =>
      o.after ? { entries: [entry({ entry_key: "k20", at: "2026-11-12T11:00:00Z" })], hasMore: false } : { entries: [first], hasMore: true });
    renderPage();
    await screen.findByRole("table");
    expect(screen.getByRole("button", { name: "Newer" })).toBeDisabled();
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Older" }));
    await screen.findByText("Page 2");
    expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: null, kind: null, after: { at: "2026-11-12T12:00:00Z", key: "k30" } });
    expect(screen.getByRole("button", { name: "Older" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Newer" }));
    await screen.findByText("Page 1");
    expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: null, kind: null, after: null });
    fireEvent.click(screen.getByRole("button", { name: "Older" }));
    await screen.findByText("Page 2");
    fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "sign_in" } });
    await screen.findByText("Page 1");
    expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: null, kind: "sign_in", after: null });
    fireEvent.click(screen.getByRole("button", { name: "Older" }));
    await screen.findByText("Page 2");
    fireEvent.change(screen.getByLabelText("Person"), { target: { value: "u2" } });
    await screen.findByText("Page 1");
    expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: "u2", kind: "sign_in", after: null });
  });

  describe("an owner of more than one firm", () => {
    const firms = [{ firm_id: "firm-1", name: "Alpha Advisory" }, { firm_id: "firm-2", name: "Beta Brokers" }];
    beforeEach(() => api.fetchOwnedFirms.mockResolvedValue(firms));

    it("is asked which firm, and nothing is read until they say", async () => {
      renderPage();
      const picker = await screen.findByLabelText("Firm");
      expect(within(picker).getAllByRole("option").map((o) => o.textContent)).toEqual(["Choose a firm", "Alpha Advisory", "Beta Brokers"]);
      expect(api.listFirmActivity).not.toHaveBeenCalled();
      expect(api.listFirmActivityPeople).not.toHaveBeenCalled();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("reads the firm they choose, and can switch to the other one, starting again from the newest", async () => {
      renderPage();
      fireEvent.change(await screen.findByLabelText("Firm"), { target: { value: "firm-2" } });
      await screen.findByRole("table");
      expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-2", { person: null, kind: null, after: null });
      expect(api.listFirmActivityPeople).toHaveBeenLastCalledWith("firm-2");
      fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "sign_in" } });
      await waitFor(() => expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-2", { person: null, kind: "sign_in", after: null }));
      fireEvent.change(screen.getByLabelText("Firm"), { target: { value: "firm-1" } });
      await waitFor(() => expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: null, kind: null, after: null }));
      expect(screen.getByLabelText("Kind")).toHaveValue("");
    });

    it("reads the firm the address names, which is how the firm's own address will say it", async () => {
      renderPage("/advisor/activity?firm=firm-2");
      await screen.findByRole("table");
      expect(api.listFirmActivity).toHaveBeenCalledWith("firm-2", { person: null, kind: null, after: null });
      expect(screen.getByLabelText("Firm")).toHaveValue("firm-2");
    });

    it("is told it is for owners when the address names a firm they don't own, and nothing is read", async () => {
      renderPage("/advisor/activity?firm=firm-9");
      expect(await screen.findByText("Only a firm's owners can read its record of who did what.")).toBeInTheDocument();
      expect(api.listFirmActivity).not.toHaveBeenCalled();
    });
  });

  it("shows no firm picker to an owner of one firm", async () => {
    renderPage();
    await screen.findByRole("table");
    expect(screen.queryByLabelText("Firm")).not.toBeInTheDocument();
  });

  it("keeps showing the entries while a changed filter loads, rather than blanking the page", async () => {
    renderPage();
    const kind = await screen.findByLabelText("Kind");
    api.listFirmActivity.mockReturnValue(new Promise(() => undefined));
    fireEvent.change(kind, { target: { value: "sign_in" } });
    await waitFor(() => expect(api.listFirmActivity).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a kind this version doesn't know as the database wrote it, not as a blank", async () => {
    api.listFirmActivity.mockResolvedValue({ entries: [entry({ kind: "something_new", record_type: "report", record_id: "r1" })], hasMore: false });
    renderPage();
    const row = within(await screen.findByRole("table")).getAllByRole("row")[1];
    expect(within(row).getAllByRole("cell")[2]).toHaveTextContent("something_new");
    expect(row).toHaveTextContent("report r1");
  });
});
