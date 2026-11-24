import { beforeEach, describe, expect, it, vi } from "vitest";

// Home's one read at the browser's edge (CRM-H1): the call, the shape read back, and a failed load for anything else.
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
const { loadHome } = await import("./homeApi");

const answer = {
  whose: "everyone", whose_choices: ["mine", "everyone"], empty: false, blocks_sending: "no_mailbox",
  needs: [{ kind: "quote_expiring", record_type: "quote", record_id: "17", name: "Reyes Bakery", about: "Harbor PEO", at: "2026-12-04T06:00:00+00:00", owner: "Ada Park" }],
  needs_total: 1,
  counts: { open_leads: 2, open_opportunities: 4, quotes_waiting: 1, renewals_due: 3, won_this_quarter: 5 },
  stages: [{ stage: "qualifying", count: 1 }],
  renewals: [{ id: "r1", account_id: "a1", account_name: "Reyes Bakery", kind: "current_plan", with_whom: "Old PEO", renews_on: "2026-12-24", days_away: 30 }],
  upcoming_tasks: [{ id: "t1", title: "Call", due_on: "2026-11-22", days_away: -2, record_type: "account", record_id: "a2", name: "Gus Garage", assignee: "Gus" }],
};

describe("loadHome", () => {
  beforeEach(() => rpc.mockReset());

  it("asks for the firm's Home for whose work was chosen, in the time zone given, and reads the answer", async () => {
    rpc.mockResolvedValue({ data: answer, error: null });
    const home = await loadHome("f1", "everyone", "America/Chicago");
    expect(rpc).toHaveBeenCalledWith("home_page", { p_firm_id: "f1", p_whose: "everyone", p_time_zone: "America/Chicago" });
    expect(home.whose).toBe("everyone");
    expect(home.blocksSending).toBe("no_mailbox");
    expect(home.needs[0]).toEqual({ kind: "quote_expiring", recordType: "quote", recordId: "17", name: "Reyes Bakery", about: "Harbor PEO", at: "2026-12-04T06:00:00+00:00", owner: "Ada Park" });
    expect(home.counts).toEqual({ openLeads: 2, openOpportunities: 4, quotesWaiting: 1, renewalsDue: 3, wonThisQuarter: 5 });
    expect(home.renewals[0]).toMatchObject({ accountId: "a1", withWhom: "Old PEO", daysAway: 30 });
    expect(home.upcomingTasks[0]).toMatchObject({ dueOn: "2026-11-22", daysAway: -2, recordType: "account", recordId: "a2" });
  });

  // Break caught: an answer missing its counts drawn as a page of blanks.
  it("fails the load when the answer is not Home's shape, and never shows the database's own text", async () => {
    rpc.mockResolvedValue({ data: { ...answer, counts: undefined }, error: null });
    await expect(loadHome("f1", "mine", "UTC")).rejects.toThrow("Couldn't load Home. Try again.");
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "relation does not exist" } });
    await expect(loadHome("f1", "mine", "UTC")).rejects.toThrow("Couldn't load Home. Try again.");
  });

  it("says Home is for members when the database refuses", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Not a member of that firm" } });
    await expect(loadHome("f1", "mine", "UTC")).rejects.toThrow("Home is for members of the firm.");
  });
});
