import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "adv@example.com" }, signOut }) }));
const loadFunnel = vi.fn();
const loadIntakeSources = vi.fn();
const loadPeoOutcomes = vi.fn();
const loadLostReasons = vi.fn();
const loadQuestionFields = vi.fn();
vi.mock("@/lib/advisorApi", () => ({
  loadFunnel: (...a: unknown[]) => loadFunnel(...a),
  loadIntakeSources: (...a: unknown[]) => loadIntakeSources(...a),
  loadPeoOutcomes: (...a: unknown[]) => loadPeoOutcomes(...a),
  loadLostReasons: (...a: unknown[]) => loadLostReasons(...a),
  loadQuestionFields: (...a: unknown[]) => loadQuestionFields(...a),
}));

const { default: AdvisorFunnelPage } = await import("./AdvisorFunnelPage");

const renderPage = (path = "/advisor/funnel") => render(<MemoryRouter initialEntries={[path]}><AdvisorFunnelPage /></MemoryRouter>);
const DAY = 24 * 60 * 60 * 1000;

describe("AdvisorFunnelPage", () => {
  beforeEach(() => {
    loadFunnel.mockReset();
    loadIntakeSources.mockReset();
    loadIntakeSources.mockResolvedValue([]);
    loadPeoOutcomes.mockReset().mockResolvedValue([]);
    loadLostReasons.mockReset().mockResolvedValue([]);
    loadQuestionFields.mockReset().mockResolvedValue([]);
  });

  it("shows each PEO's outcomes for the same intakes, alphabetically, declines broken down by reason", async () => {
    loadFunnel.mockResolvedValue([{ step: 1, milestone: "started", intakes: 7, median_minutes: null }]);
    loadPeoOutcomes.mockResolvedValue([
      { peo_name: "Justworks", sent: 3, quoted: 1, declined: 2, decline_reasons: { claims_history: 1, state_not_served: 1 }, median_days_to_quote: 9, won: 0 },
      { peo_name: "TriNet", sent: 2, quoted: 2, declined: 0, decline_reasons: {}, median_days_to_quote: 5.5, won: 1 },
    ]);
    renderPage();
    const table = await screen.findByRole("table", { name: "What each PEO did with the packets it was sent" });
    expect(within(table).getAllByRole("row").slice(1).map((r) => within(r).getByRole("rowheader").textContent)).toEqual(["Justworks", "TriNet"]);
    const justworks = within(table).getByRole("row", { name: /Justworks/ });
    expect(justworks).toHaveTextContent("A state it doesn't serve 1 · Claims or loss history 1");
    expect(within(within(table).getByRole("row", { name: /TriNet/ })).getByText("5.5 days")).toBeInTheDocument();
    const [from, to] = loadPeoOutcomes.mock.calls[0] as [Date, Date];
    expect(Math.round((to.getTime() - from.getTime()) / DAY)).toBe(30);
  });

  it("counts why submissions were lost, and the answers underwriters asked about most", async () => {
    loadFunnel.mockResolvedValue([{ step: 1, milestone: "started", intakes: 7, median_minutes: null }]);
    loadLostReasons.mockResolvedValue([{ reason: "stayed_with_current", submissions: 3 }, { reason: "cost", submissions: 1 }]);
    loadQuestionFields.mockResolvedValue([
      { field: "census", questions: 4, total_questions: 9, tagged_questions: 6 },
      { field: "pay_frequency", questions: 2, total_questions: 9, tagged_questions: 6 },
    ]);
    renderPage();
    const lost = await screen.findByRole("list", { name: "Why submissions were lost" });
    expect(within(lost).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Stayed with their current PEO or broker: 3", "Cost: 1"]);
    const asked = screen.getByRole("list", { name: "Answers underwriters asked about" });
    expect(within(asked).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Employee census: 4", "Pay frequency: 2"]);
    expect(screen.getByText("6 of 9 underwriters' questions were tagged with the answers they're about.")).toBeInTheDocument();
  });

  it("shows each step's count, share of starts and median time, for the last 30 days by default", async () => {
    loadFunnel.mockResolvedValue([
      { step: 1, milestone: "started", intakes: 40, median_minutes: null },
      { step: 2, milestone: "answered", intakes: 30, median_minutes: 2 },
      { step: 7, milestone: "certified", intakes: 10, median_minutes: 4320 },
    ]);
    renderPage();
    const table = await screen.findByRole("table", { name: /reached each step, of those started/ });
    const certified = within(table).getByRole("row", { name: /Certified/ });
    expect(within(certified).getByText("10")).toBeInTheDocument();
    expect(within(certified).getByText("25%")).toBeInTheDocument();
    expect(within(certified).getByText("3 days")).toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(12);
    const [from, to] = loadFunnel.mock.calls[0] as [Date, Date];
    expect(Math.round((to.getTime() - from.getTime()) / DAY)).toBe(30);
    expect(screen.getByRole("radio", { name: "Last 30 days" })).toHaveAttribute("aria-checked", "true");
  });

  it("times the market steps from certification, and says so", async () => {
    loadFunnel.mockResolvedValue([
      { step: 1, milestone: "started", intakes: 10, median_minutes: null, measured_from: "start" },
      { step: 7, milestone: "certified", intakes: 6, median_minutes: 2880, measured_from: "start" },
      { step: 10, milestone: "first_quote", intakes: 3, median_minutes: 8640, measured_from: "certification" },
    ]);
    renderPage();
    const table = await screen.findByRole("table", { name: /reached each step, of those started/ });
    expect(within(within(table).getByRole("row", { name: /Got a first quote/ })).getByText("6 days from certifying")).toBeInTheDocument();
    expect(within(within(table).getByRole("row", { name: /Certified/ })).getByText("2 days")).toBeInTheDocument();
  });

  it("shows the same intakes by source, the partner's name first and its codes under it", async () => {
    loadFunnel.mockResolvedValue([{ step: 1, milestone: "started", intakes: 7, median_minutes: null }]);
    loadIntakeSources.mockResolvedValue([
      { referral_code: "acme-cfo", partner_name: "Acme CFO Partners", utm_source: null, utm_medium: null, utm_campaign: "spring", started: 4, answered: 3, census_provided: 2, ready_to_certify: 2, certified: 1 },
      { referral_code: null, partner_name: null, utm_source: null, utm_medium: null, utm_campaign: null, started: 3, answered: 1, certified: 0 },
    ]);
    renderPage();
    const table = await screen.findByRole("table", { name: "Intakes from each source that reached each step" });
    const acme = within(table).getByRole("row", { name: /Acme CFO Partners/ });
    expect(within(acme).getByText("ref=acme-cfo · spring")).toBeInTheDocument();
    expect(within(acme).getByText("25%")).toBeInTheDocument();
    const direct = within(table).getByRole("row", { name: /No tagged link/ });
    expect(within(direct).getByText("0%")).toBeInTheDocument();
    const [from, to] = loadIntakeSources.mock.calls[0] as [Date, Date];
    expect(Math.round((to.getTime() - from.getTime()) / DAY)).toBe(30);
    expect(screen.getByRole("link", { name: "Referral partners" })).toHaveAttribute("href", "/advisor/partners");
  });

  it("loads another period when one is chosen", async () => {
    loadFunnel.mockResolvedValue([{ step: 1, milestone: "started", intakes: 3, median_minutes: null }]);
    renderPage();
    await screen.findByRole("table", { name: /reached each step, of those started/ });
    fireEvent.click(screen.getByRole("radio", { name: "Last 12 months" }));
    await waitFor(() => expect(loadFunnel).toHaveBeenCalledTimes(2));
    const [from, to] = loadFunnel.mock.calls[1] as [Date, Date];
    expect(Math.round((to.getTime() - from.getTime()) / DAY)).toBe(365);
  });

  it("says so when no intake started in the period", async () => {
    loadFunnel.mockResolvedValue([{ step: 1, milestone: "started", intakes: 0, median_minutes: null }]);
    renderPage("/advisor/funnel?period=7d");
    expect(await screen.findByText("No intakes started in this period.")).toBeInTheDocument();
  });

  it("offers to try again when it can't load", async () => {
    loadFunnel.mockRejectedValueOnce(new Error("Couldn't load the funnel.")).mockResolvedValue([{ step: 1, milestone: "started", intakes: 1, median_minutes: null }]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("table", { name: /reached each step, of those started/ })).toBeInTheDocument();
  });
});
