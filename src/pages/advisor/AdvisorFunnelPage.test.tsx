import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "adv@example.com" }, signOut }) }));
const loadFunnel = vi.fn();
const loadIntakeSourcesOfMyFirms = vi.fn();
vi.mock("@/lib/advisorApi", () => ({
  loadFunnel: (...a: unknown[]) => loadFunnel(...a),
  loadIntakeSourcesOfMyFirms: (...a: unknown[]) => loadIntakeSourcesOfMyFirms(...a),
}));

const { default: AdvisorFunnelPage } = await import("./AdvisorFunnelPage");

const renderPage = (path = "/advisor/funnel") => render(<MemoryRouter initialEntries={[path]}><AdvisorFunnelPage /></MemoryRouter>);
const DAY = 24 * 60 * 60 * 1000;

describe("AdvisorFunnelPage", () => {
  beforeEach(() => {
    loadFunnel.mockReset();
    loadIntakeSourcesOfMyFirms.mockReset();
    loadIntakeSourcesOfMyFirms.mockResolvedValue([]);
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
    expect(within(table).getAllByRole("row")).toHaveLength(9);
    const [from, to] = loadFunnel.mock.calls[0] as [Date, Date];
    expect(Math.round((to.getTime() - from.getTime()) / DAY)).toBe(30);
    expect(screen.getByRole("radio", { name: "Last 30 days" })).toHaveAttribute("aria-checked", "true");
  });

  it("shows the same intakes by source, the partner's name first and its codes under it", async () => {
    loadFunnel.mockResolvedValue([{ step: 1, milestone: "started", intakes: 7, median_minutes: null }]);
    loadIntakeSourcesOfMyFirms.mockResolvedValue([
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
    const [from, to] = loadIntakeSourcesOfMyFirms.mock.calls[0] as [Date, Date];
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
