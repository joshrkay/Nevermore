import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Workspace } from "@/components/workspace/workspaceContext";

// Who the PEOs page offers slice A's sections to (BR-1.3, BR-1.4): a firm's member gets their firm's contacts at the market on screen and the request
// form; a support session neither; a platform admin the firms' requests to answer. The sections' own behaviour is in FirmMarkets.test.tsx.
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "gus@example.com" }, signOut: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const harbor = { id: 2, name: "Harbor PEO", line: "peo", listed: true, versions: [] };
const api = { loadPeoDirectory: vi.fn(), loadPeoCatalogDirectory: vi.fn(), fetchHasPlatformRole: vi.fn(), fetchIsAdmin: vi.fn(), loadVersionContacts: vi.fn() };
vi.mock("@/lib/advisorApi", () => api);
const market = { loadFirmMarketContacts: vi.fn(), loadFirmMarketRequests: vi.fn(), loadAdminMarketRequests: vi.fn() };
vi.mock("@/lib/marketApi", () => market);

const { WorkspaceContext } = await import("@/components/workspace/workspaceContext");
const { default: AdvisorPeosPage } = await import("./AdvisorPeosPage");

const workspace = (over: Partial<Workspace>): Workspace => ({
  firm: { id: "f1", name: "Acme Brokers", address: "acme-brokers" }, role: "Agent", isOwner: false, isSupport: false, supportEndsAt: null, supportSessionId: null,
  isPlatformAdmin: false, person: "Gus", ...over,
});
const show = (w: Workspace | null) => render(
  <MemoryRouter><WorkspaceContext.Provider value={w}><AdvisorPeosPage /></WorkspaceContext.Provider></MemoryRouter>,
);

beforeEach(() => {
  [...Object.values(api), ...Object.values(market)].forEach((f) => f.mockReset());
  api.fetchHasPlatformRole.mockResolvedValue(false);
  api.fetchIsAdmin.mockResolvedValue(false);
  api.loadPeoCatalogDirectory.mockResolvedValue([harbor]);
  api.loadPeoDirectory.mockResolvedValue([harbor]);
  api.loadVersionContacts.mockResolvedValue({});
  market.loadFirmMarketContacts.mockResolvedValue([]);
  market.loadFirmMarketRequests.mockResolvedValue([]);
  market.loadAdminMarketRequests.mockResolvedValue([{ id: 1, firmName: "Acme Brokers", name: "Summit PEO", line: "peo", contactName: null, contactEmail: null, note: null, status: "open", answer: null, requestedBy: null, createdAt: "2026-11-27T10:00:00Z" }]);
});

describe("the PEOs page, for a firm", () => {
  it("offers a member their firm's contacts at the market on screen, and a way to ask for one that isn't listed", async () => {
    show(workspace({}));
    expect(await screen.findByRole("heading", { name: "Your firm's contacts at Harbor PEO" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ask for a PEO or carrier that isn't listed" })).toBeInTheDocument();
    // The heading is drawn before the read is asked for: wait for the ask rather than assume it has happened.
    await waitFor(() => expect(market.loadFirmMarketContacts).toHaveBeenCalledWith("f1"));
    expect(market.loadAdminMarketRequests).not.toHaveBeenCalled();
  });

  // Break caught: a support session shown a failed read, or offered a form it can't use (ADR 0024).
  it("offers a support session neither, and reads neither", async () => {
    show(workspace({ isSupport: true, role: "Nevermore support" }));
    expect(await screen.findByRole("heading", { name: "Harbor PEO" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Your firm's contacts/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: /Ask for a PEO or carrier/ })).toBeNull();
    expect(market.loadFirmMarketContacts).not.toHaveBeenCalled();
  });

  it("offers no contacts of its own at a market taken off the list", async () => {
    api.loadPeoCatalogDirectory.mockResolvedValue([{ ...harbor, listed: false }]);
    show(workspace({}));
    expect(await screen.findByRole("heading", { name: "Ask for a PEO or carrier that isn't listed" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Your firm's contacts/ })).toBeNull();
  });

  it("shows a platform admin the firms' requests to answer", async () => {
    api.fetchHasPlatformRole.mockResolvedValue(true);
    api.fetchIsAdmin.mockResolvedValue(true);
    show(null);
    expect(await screen.findByRole("heading", { name: "Requests from firms (1 waiting)" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Your firm's contacts/ })).toBeNull();
  });
});
