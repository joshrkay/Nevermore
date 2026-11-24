import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Home } from "@/data/home";
import type { Workspace } from "@/components/workspace/workspaceContext";

// Home (CRM-H1 with BR-3.1, BR-3.2, BR-5.2): what the page draws from the database's one answer. The database decides what is on it (supabase/tests/home.sql).
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "ada@example.com" }, signOut: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const loadHome = vi.fn();
vi.mock("@/lib/homeApi", () => ({ loadHome: (...a: unknown[]) => loadHome(...a), browserTimeZone: () => "America/Chicago" }));

const { WorkspaceContext } = await import("@/components/workspace/workspaceContext");
const { default: HomePage } = await import("./HomePage");

const home = (over: Partial<Home> = {}): Home => ({
  whose: "mine", whoseChoices: ["mine", "everyone"], empty: false, blocksSending: null, needs: [], needsTotal: 0,
  counts: { openLeads: 2, openOpportunities: 4, quotesWaiting: 1, renewalsDue: 3, wonThisQuarter: 5 },
  stages: [{ stage: "qualifying", count: 1 }, { stage: "intake_under_way", count: 0 }, { stage: "ready_to_send", count: 2 }, { stage: "in_market", count: 0 }, { stage: "quoted", count: 1 }],
  renewals: [], upcomingTasks: [], ...over,
});
const workspace: Workspace = {
  firm: { id: "f1", name: "Acme Brokers", address: "acme-brokers" }, role: "Owner", isOwner: true, isSupport: false, supportEndsAt: null, supportSessionId: null, isPlatformAdmin: false, person: "Ada",
};
const show = () => render(<MemoryRouter><WorkspaceContext.Provider value={workspace}><HomePage /></WorkspaceContext.Provider></MemoryRouter>);

beforeEach(() => loadHome.mockReset());

describe("Home", () => {
  it("asks for the person's own work first, in their own time zone", async () => {
    loadHome.mockResolvedValue(home());
    show();
    await screen.findByRole("heading", { name: "Home" });
    expect(loadHome).toHaveBeenCalledWith("f1", "mine", "America/Chicago");
  });

  // Break caught: a count under the wrong label, or a box that opens nothing.
  it("shows the five counts, each a link to the list it counts", async () => {
    loadHome.mockResolvedValue(home());
    show();
    const counts = await screen.findByRole("list", { name: "Counts" });
    const read = within(counts).getAllByRole("link").map((a) => `${a.textContent} -> ${a.getAttribute("href")}`);
    expect(read).toEqual([
      "2Open leads -> /leads", "4Open opportunities -> /accounts", "1Quotes waiting on a PEO -> /quotes", "3Renewals in the next 120 days -> /accounts", "5Won this quarter -> /accounts",
    ]);
  });

  // Break caught: a line that names its kind and not its record, or links somewhere other than the record it is about.
  it("lists what needs the person: the kind, the record as a link, what it is about, when and whose", async () => {
    loadHome.mockResolvedValue(home({
      needsTotal: 2,
      needs: [
        { kind: "quote_expiring", recordType: "quote", recordId: "17", name: "Reyes Bakery", about: "Harbor PEO", at: "2026-12-04T06:00:00Z", owner: "Ada Park" },
        { kind: "lead_quiet", recordType: "lead", recordId: "l1", name: "Quiet Lead", about: null, at: "2026-11-15T15:00:00Z", owner: null },
      ],
    }));
    show();
    const rows = within(await screen.findByRole("list", { name: "Needs you" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Quote expiring");
    expect(within(rows[0]).getByRole("link", { name: "Reyes Bakery" })).toHaveAttribute("href", "/quotes/17");
    expect(rows[0]).toHaveTextContent("Harbor PEO");
    expect(rows[0]).toHaveTextContent("Expires Dec 4");
    expect(rows[0]).toHaveTextContent("Ada Park");
    expect(within(rows[1]).getByRole("link", { name: "Quiet Lead" })).toHaveAttribute("href", "/leads/l1");
    expect(rows[1]).toHaveTextContent("No activity since Nov 15");
    expect(rows[1]).toHaveTextContent("No owner");
  });

  it("says how many more need the person when the list holds only the first of them", async () => {
    loadHome.mockResolvedValue(home({ needsTotal: 62, needs: [{ kind: "new_mail", recordType: "inbox", recordId: "t1", name: "Harbor PEO", about: "Re: Reyes Bakery", at: "2026-11-24T15:00:00Z", owner: "Ada" }] }));
    show();
    expect(await screen.findByText("Showing the first 1 of 62.")).toBeInTheDocument();
  });

  it("says the person is caught up when records exist and nothing needs them, and still shows the counts", async () => {
    loadHome.mockResolvedValue(home());
    show();
    expect(await screen.findByText("You're caught up.")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Counts" })).toBeInTheDocument();
  });

  // Break caught: an owner unable to see the firm's work, or an agent offered a switch the database will ignore.
  it("offers the choices the database gave, and reads Home again for the one chosen", async () => {
    loadHome.mockResolvedValueOnce(home()).mockResolvedValueOnce(home({ whose: "everyone" }));
    show();
    const group = await screen.findByRole("group", { name: "Whose work" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["Mine", "Everyone"]);
    expect(within(group).getByRole("button", { name: "Mine" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(group).getByRole("button", { name: "Everyone" }));
    await waitFor(() => expect(loadHome).toHaveBeenLastCalledWith("f1", "everyone", "America/Chicago"));
    await waitFor(() => expect(within(screen.getByRole("group", { name: "Whose work" })).getByRole("button", { name: "Everyone" })).toHaveAttribute("aria-pressed", "true"));
  });

  it("offers no switch to a person with one choice", async () => {
    loadHome.mockResolvedValue(home({ whoseChoices: ["mine"] }));
    show();
    await screen.findByRole("list", { name: "Counts" });
    expect(screen.queryByRole("group", { name: "Whose work" })).toBeNull();
  });

  it("lists renewals coming up with how far off each is, an overdue one said as overdue", async () => {
    loadHome.mockResolvedValue(home({ renewals: [
      { id: "r1", accountId: "a1", accountName: "Reyes Bakery", kind: "current_plan", withWhom: "Late PEO", renewsOn: "2026-11-21", daysAway: -3 },
      { id: "r2", accountId: "a1", accountName: "Reyes Bakery", kind: "current_plan", withWhom: "Old PEO", renewsOn: "2026-12-24", daysAway: 30 },
    ] }));
    show();
    const rows = within(await screen.findByRole("list", { name: "Renewals coming up" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Late PEO");
    expect(rows[0]).toHaveTextContent("3 days overdue");
    expect(rows[1]).toHaveTextContent("in 30 days");
    expect(within(rows[1]).getByRole("link", { name: "Reyes Bakery" })).toHaveAttribute("href", "/accounts/a1");
  });

  it("counts open opportunities by stage, in the stages' order and words, a stage with none included", async () => {
    loadHome.mockResolvedValue(home());
    show();
    const rows = within(await screen.findByRole("list", { name: "Open opportunities by stage" })).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual(["Qualifying1", "Intake under way0", "Ready to send2", "In market0", "Quoted1"]);
  });

  it("lists upcoming tasks with the record each is on, when it is due and who it is for", async () => {
    loadHome.mockResolvedValue(home({ upcomingTasks: [
      { id: "t1", title: "Call the garage", dueOn: "2026-11-22", daysAway: -2, recordType: "account", recordId: "a2", name: "Gus Garage", assignee: "Gus" },
      { id: "t2", title: "Send the census template", dueOn: "2026-11-29", daysAway: 5, recordType: "lead", recordId: "l9", name: "Fresh Lead", assignee: "Ada" },
    ] }));
    show();
    const rows = within(await screen.findByRole("list", { name: "Upcoming tasks" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Call the garage");
    expect(rows[0]).toHaveTextContent("2 days overdue");
    expect(within(rows[0]).getByRole("link", { name: "Gus Garage" })).toHaveAttribute("href", "/accounts/a2");
    expect(rows[1]).toHaveTextContent("in 5 days");
    expect(rows[1]).toHaveTextContent("Ada");
    expect(within(rows[1]).getByRole("link", { name: "Fresh Lead" })).toHaveAttribute("href", "/leads/l9");
  });

  // BR-5.2. Break caught: a new firm shown five zeros and no way forward, or an Import button that does nothing.
  it("shows a firm with nothing yet how to start, with New quote and no Import", async () => {
    loadHome.mockResolvedValue(home({ empty: true, counts: { openLeads: 0, openOpportunities: 0, quotesWaiting: 0, renewalsDue: 0, wonThisQuarter: 0 } }));
    show();
    expect(await screen.findByRole("heading", { name: "Start with a quote" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New quote" })).toHaveAttribute("href", "/new-quote");
    expect(within(screen.getByRole("list", { name: "The three steps to a first quote" })).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /import/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /import/i })).toBeNull();
    expect(screen.queryByRole("list", { name: "Needs you" })).toBeNull();
  });

  it.each([
    ["waiting_for_approval" as const, "Nevermore hasn't approved your firm to send to PEOs yet. You can start quotes and work on intakes meanwhile."],
    ["refused" as const, "Nevermore did not approve your firm, so nothing can be sent to a PEO from here."],
  ])("says what stops the firm sending: %s", async (block, words) => {
    loadHome.mockResolvedValue(home({ empty: true, blocksSending: block }));
    show();
    expect(await screen.findByText(words)).toBeInTheDocument();
  });

  it("says a mailbox must be connected, with a link to connect it, and says nothing when nothing stops a send", async () => {
    loadHome.mockResolvedValueOnce(home({ blocksSending: "no_mailbox" }));
    const first = show();
    expect(await screen.findByText(/Connect your mailbox before you send/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connect your mailbox" })).toHaveAttribute("href", "/advisor/mailbox");
    first.unmount();
    loadHome.mockResolvedValueOnce(home());
    show();
    await screen.findByRole("list", { name: "Counts" });
    expect(screen.queryByText(/before you send/)).toBeNull();
  });

  it("says Home couldn't be loaded and reads it again on request, never that nothing needs the person", async () => {
    loadHome.mockRejectedValueOnce(new Error("Couldn't load Home. Try again.")).mockResolvedValueOnce(home());
    show();
    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
    expect(await screen.findByText("You're caught up.")).toBeInTheDocument();
  });
});
