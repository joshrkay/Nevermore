import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The funnel and partners pages sit behind RequireFirm in App.tsx. The page tests render the pages bare, so they never meet
// the guard: this file renders them the way a person reaches them.
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "pat@example.com" }, session: { access_token: "t" }, loading: false, isAnonymous: false, sessionEnded: null, signOut: vi.fn() }),
}));
let firmAddress: { status: "none" } | { status: "known"; address: string } = { status: "none" };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firmAddress }));
vi.mock("@/lib/monitoring", () => ({ reportOpsEvent: vi.fn() }));
const api = {
  fetchMyFirms: vi.fn(),
  fetchOwnedFirms: vi.fn(),
  fetchIsAdmin: vi.fn(),
  fetchNeedsSecondFactor: vi.fn(),
  loadFunnel: vi.fn(),
  loadIntakeSourcesOfMyFirms: vi.fn(),
  listMyFirms: vi.fn(),
  listReferralPartners: vi.fn(),
  loadIntakeSources: vi.fn(),
  addReferralPartner: vi.fn(),
  updateReferralPartner: vi.fn(),
};
vi.mock("@/lib/advisorApi", () => api);

const { clearMyFirms, clearOwnedFirms } = await import("@/hooks/useOwnedFirms");
const { default: RequireFirm } = await import("@/components/RequireFirm");
const { default: AdvisorFunnelPage } = await import("./AdvisorFunnelPage");
const { default: AdvisorPartnersPage } = await import("./AdvisorPartnersPage");

const alpha = { firm_id: "f1", name: "Alpha Advisory", address: "alpha", role: "owner" };
const beta = { firm_id: "f2", name: "Beta Brokers", address: "beta", role: "owner" };

const renderRoute = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/advisor/funnel" element={<RequireFirm><AdvisorFunnelPage /></RequireFirm>} />
        <Route path="/advisor/partners" element={<RequireFirm><AdvisorPartnersPage /></RequireFirm>} />
        <Route path="/choose-firm" element={<p>Choose a firm page</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("the funnel and partners routes for a member of two firms", () => {
  beforeEach(() => {
    clearMyFirms();
    clearOwnedFirms();
    firmAddress = { status: "none" };
    for (const fn of Object.values(api)) fn.mockReset();
    api.fetchNeedsSecondFactor.mockResolvedValue(false);
    api.fetchMyFirms.mockResolvedValue([alpha, beta]);
  });

  it.each(["/advisor/funnel", "/advisor/partners"])("%s sends them to Choose a firm on the bare domain and loads no firm's records (D-40, ADR 0016)", async (path) => {
    renderRoute(path);
    expect(await screen.findByText("Choose a firm page")).toBeInTheDocument();
    expect(api.loadFunnel).not.toHaveBeenCalled();
    expect(api.loadIntakeSourcesOfMyFirms).not.toHaveBeenCalled();
    expect(api.listReferralPartners).not.toHaveBeenCalled();
  });

  it.each([["/advisor/funnel", "Funnel"], ["/advisor/partners", "Referral partners"]])("%s lets them in at one of their firms' own address, where the database answers for that firm alone (ADR 0016)", async (path, heading) => {
    firmAddress = { status: "known", address: "alpha" };
    api.listMyFirms.mockResolvedValue([{ id: "f1", name: "Alpha Advisory", address: "alpha" }, { id: "f2", name: "Beta Brokers", address: "beta" }]);
    api.listReferralPartners.mockResolvedValue([]);
    api.loadIntakeSources.mockResolvedValue([]);
    api.loadFunnel.mockResolvedValue([]);
    api.loadIntakeSourcesOfMyFirms.mockResolvedValue([]);
    renderRoute(path);
    expect(await screen.findByRole("heading", { level: 1, name: new RegExp(heading, "i") })).toBeInTheDocument();
    expect(screen.queryByText("Choose a firm page")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "You're a member of more than one firm" })).not.toBeInTheDocument();
  });
});
