import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Reports } from "@/data/reports";
import type { Workspace } from "@/components/workspace/workspaceContext";

// Reports (BR-6.1; CRM-R1.1 to R1.3): what the page draws from the database's one answer. The database decides what is counted (supabase/tests/reports.sql).
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "ada@example.com" }, signOut: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const loadReports = vi.fn();
vi.mock("@/lib/reportsApi", () => ({ loadReports: (...a: unknown[]) => loadReports(...a) }));
const downloadBlob = vi.fn();
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: (...a: unknown[]) => downloadBlob(...a) }));

const { WorkspaceContext } = await import("@/components/workspace/workspaceContext");
const { default: ReportsPage } = await import("./ReportsPage");

const reports = (over: Partial<Reports> = {}): Reports => ({
  whose: "mine", whoseChoices: ["mine", "everyone"], line: null, from: "2026-10-01", to: "2026-11-24", today: "2026-11-24",
  pipeline: {
    count: 3, value: 5000,
    stages: [
      { stage: "qualifying", count: 2, value: 5000, medianDays: 20 }, { stage: "intake_under_way", count: 0, value: 0, medianDays: null },
      { stage: "ready_to_send", count: 0, value: 0, medianDays: null }, { stage: "in_market", count: 0, value: 0, medianDays: null }, { stage: "quoted", count: 1, value: 0, medianDays: 6 },
    ],
    owners: [{ ownerId: "u1", owner: "Ada", count: 2, value: 5000 }, { ownerId: "u2", owner: "Gus", count: 1, value: 0 }],
    rows: [{ id: "o1", name: "Old qualifying", account: "Reyes Bakery", stage: "qualifying", days: 40, value: 5000, owner: "Ada" }],
  },
  markets: {
    sent: 2, quoted: 1, declined: 1, won: 1,
    markets: [
      { market: "Harbor PEO", sent: 1, quoted: 1, declined: 0, won: 1, medianDays: 4, declineReasons: {} },
      { market: "Slow PEO", sent: 1, quoted: 0, declined: 1, won: 0, medianDays: null, declineReasons: { not_said: 1 } },
    ],
    rows: [{ id: 7, market: "Harbor PEO", opportunityId: "o2", opportunity: "Market search", account: "Reyes Bakery", sentOn: "2026-11-18", status: "quoted", placed: true }],
  },
  wonLost: {
    won: 1, lost: 2, valueWon: 12000,
    owners: [{ ownerId: "u1", owner: "Ada", won: 1, lost: 1 }], sources: [{ source: "Referral", won: 1, lost: 0 }], reasons: [{ reason: "price", count: 1 }, { reason: "no_decision", count: 1 }],
    rows: [{ id: "o3", name: "Won search", account: "Reyes Bakery", outcome: "won", on: "2026-11-14", value: 12000, reason: null, owner: "Ada" }],
  },
  renewals: {
    months: [{ month: "2026-11", due: 0, worked: 0 }, { month: "2026-12", due: 2, worked: 1 }], kept: 1, lost: 1, open: 0,
    rows: [{ id: "r1", accountId: "a1", account: "Reyes Bakery", withWhom: "Gone PEO", renewsOn: "2026-11-09", outcome: "lost", worked: false }],
  },
  commission: {
    expected: 400, received: 150, months: [{ month: "2026-10", expected: 200, received: 0 }, { month: "2026-11", expected: 200, received: 150 }],
    rows: [{ placementId: "p1", accountId: "a1", account: "Reyes Bakery", market: "Harbor PEO", expected: 400, received: 150 }],
  },
  ...over,
});
const owner: Workspace = {
  firm: { id: "f1", name: "Acme Brokers", address: "acme-brokers" }, role: "Owner", isOwner: true, isSupport: false, supportEndsAt: null, supportSessionId: null, isPlatformAdmin: false, person: "Ada",
};
const show = (workspace: Workspace = owner, at = "/reports") =>
  render(<MemoryRouter initialEntries={[at]}><WorkspaceContext.Provider value={workspace}><ReportsPage /></WorkspaceContext.Provider></MemoryRouter>);
const cells = (table: HTMLElement) => within(table).getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell").map((c) => c.textContent).join("|"));

beforeEach(() => { loadReports.mockReset(); downloadBlob.mockReset(); });

describe("Reports", () => {
  it("asks for this quarter, the person's own work and every line first", async () => {
    loadReports.mockResolvedValue(reports());
    show();
    await screen.findByRole("heading", { name: "Pipeline" });
    const ask = loadReports.mock.calls[0][0];
    expect(ask).toMatchObject({ firmId: "f1", whose: "mine", line: null });
    expect(ask.from).toMatch(/^\d{4}-\d{2}-01$/);
    expect(screen.getByRole("button", { name: "This quarter" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: "Intake funnel" })).toHaveAttribute("href", "/advisor/funnel");
  });

  // Break caught: a figure under the wrong label, a stage left out, or a record a figure counts that can't be opened.
  it("shows the pipeline by stage and by owner, and lists the open opportunities as links", async () => {
    loadReports.mockResolvedValue(reports());
    show();
    const section = await screen.findByRole("region", { name: "Pipeline" });
    expect(within(section).getByText("Open opportunities").nextSibling).toHaveTextContent("3");
    expect(cells(within(section).getByRole("table", { name: "Open opportunities by stage" }))).toEqual([
      "Qualifying|2||$5,000|20 days", "Intake under way|0||$0|", "Ready to send|0||$0|", "In market|0||$0|", "Quoted|1||$0|6 days",
    ]);
    expect(cells(within(section).getByRole("table", { name: "Open opportunities by owner" }))).toEqual(["Ada|2|$5,000", "Gus|1|$0"]);
    expect(within(section).getByRole("link", { name: "Old qualifying" })).toHaveAttribute("href", "/opportunities/o1");
    expect(within(section).getByText("Reyes Bakery · Qualifying · open 40 days · Ada")).toBeInTheDocument();
  });

  it("shows quotes by market with the win rate and why each declined", async () => {
    loadReports.mockResolvedValue(reports());
    show();
    const section = await screen.findByRole("region", { name: "Quotes by market" });
    expect(cells(within(section).getByRole("table"))).toEqual(["Harbor PEO|1|1|0|1|100%|4 days|", "Slow PEO|1|0|1|0|-||Not said (1)"]);
    expect(within(section).getByRole("link", { name: "Reyes Bakery: Market search" })).toHaveAttribute("href", "/opportunities/o2");
  });

  it("shows what was won and lost, the win rate, and why", async () => {
    loadReports.mockResolvedValue(reports());
    show();
    const section = await screen.findByRole("region", { name: "Won and lost" });
    expect(within(section).getByText("Win rate").nextSibling).toHaveTextContent("33%");
    expect(within(section).getByText("Value won").nextSibling).toHaveTextContent("$12,000");
    expect(cells(within(section).getByRole("table", { name: "Lost because" }))).toEqual(["Price|1", "No decision|1"]);
    expect(within(section).getByRole("link", { name: "Won search" })).toHaveAttribute("href", "/opportunities/o3");
  });

  it("shows renewals by month and how the period's ended", async () => {
    loadReports.mockResolvedValue(reports());
    show();
    const section = await screen.findByRole("region", { name: "Renewals" });
    expect(cells(within(section).getByRole("table"))).toEqual(["Nov 2026|0||0", "Dec 2026|2||1"]);
    expect(within(section).getByText("Not renewed").nextSibling).toHaveTextContent("1");
    expect(within(section).getByRole("link", { name: "Reyes Bakery" })).toHaveAttribute("href", "/accounts/a1");
  });

  // Break caught: commission shown to someone the database gave none.
  it("shows commission to an owner, and no commission panel to anyone given none", async () => {
    loadReports.mockResolvedValue(reports());
    const first = show();
    const section = await screen.findByRole("region", { name: "Commission" });
    expect(cells(within(section).getByRole("table", { name: "Commission by month" }))).toEqual(["Oct 2026|$200|$0|", "Nov 2026|$200|$150|"]);
    first.unmount();
    loadReports.mockResolvedValue(reports({ commission: null, whoseChoices: ["mine"] }));
    show({ ...owner, role: "Agent", isOwner: false });
    await screen.findByRole("region", { name: "Pipeline" });
    expect(screen.queryByRole("region", { name: "Commission" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Whose work" })).not.toBeInTheDocument();
  });

  it("asks again when the period, whose work or the line changes", async () => {
    loadReports.mockResolvedValue(reports());
    show();
    await screen.findByRole("region", { name: "Pipeline" });
    fireEvent.click(screen.getByRole("button", { name: "This year" }));
    await waitFor(() => expect(loadReports.mock.calls.at(-1)[0].from).toMatch(/-01-01$/));
    fireEvent.click(screen.getByRole("button", { name: "Everyone" }));
    await waitFor(() => expect(loadReports.mock.calls.at(-1)[0].whose).toBe("everyone"));
    fireEvent.change(screen.getByLabelText("Line"), { target: { value: "workers_comp" } });
    await waitFor(() => expect(loadReports.mock.calls.at(-1)[0].line).toBe("workers_comp"));
  });

  // Break caught: two dates that make no period sent to the database anyway.
  it("takes two dates, and says what is wrong with them without asking", async () => {
    loadReports.mockResolvedValue(reports());
    show(owner, "/reports?period=custom&from=2026-11-10&to=2026-11-01");
    expect(await screen.findByRole("alert")).toHaveTextContent("The first date is after the second.");
    expect(loadReports).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-11-20" } });
    await waitFor(() => expect(loadReports).toHaveBeenCalledTimes(1));
    expect(loadReports.mock.calls[0][0]).toMatchObject({ from: "2026-11-10", to: "2026-11-20" });
  });

  // Break caught: a file offered during a support session (D-128), or one that holds another report's table.
  it("saves a report's table as a CSV, and offers no file during a support session", async () => {
    loadReports.mockResolvedValue(reports());
    const first = show();
    fireEvent.click(await screen.findByRole("button", { name: "Export Renewals as CSV" }));
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(downloadBlob.mock.calls[0][1]).toBe("renewals-2026-10-01-to-2026-11-24.csv");
    first.unmount();
    show({ ...owner, isSupport: true });
    await screen.findByRole("region", { name: "Pipeline" });
    expect(screen.queryByRole("button", { name: /Export/ })).not.toBeInTheDocument();
    expect(screen.getByText("Downloads are off during Nevermore support.")).toBeInTheDocument();
  });

  it("says a failed load and offers to try again", async () => {
    loadReports.mockRejectedValueOnce(new Error("Couldn't load the reports. Try again.")).mockResolvedValue(reports());
    show();
    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("region", { name: "Pipeline" })).toBeInTheDocument();
  });
});
