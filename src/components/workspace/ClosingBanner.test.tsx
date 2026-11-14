import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The banner every workspace page shows while the firm is waiting to close (story CRM-P1.7). It only says what the database enforces: it
// says when the firm closes and that nothing can be changed, and tells an owner how to withdraw. A firm that is not closing shows none.
const auth = { user: { id: "u1", email: "sam@example.com", user_metadata: {} as Record<string, unknown> }, session: { access_token: "tok-1" }, signOut: vi.fn() };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const api = { fetchMyFirms: vi.fn(), fetchOwnedFirms: vi.fn(), fetchIsAdmin: vi.fn() };
vi.mock("@/lib/advisorApi", () => api);
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => ({ status: "none" }) }));

const { clearMyFirms, clearOwnedFirms } = await import("@/hooks/useOwnedFirms");
const { clearFirmClosure } = await import("@/hooks/useFirmClosure");
const { default: WorkspaceShell } = await import("./WorkspaceShell");

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const renderAt = async (at: string) => {
  render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route element={<WorkspaceShell />}>
          <Route path="*" element={<p>The page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  await settle();
};
const answer = (closesAt: string | null) =>
  rpc.mockImplementation(async (fn: string) => (fn === "my_firm_closure" ? { data: closesAt ? [{ asked_at: "2026-11-18T10:00:00Z", closes_at: closesAt }] : [], error: null } : { data: null, error: null }));

beforeEach(() => {
  clearMyFirms();
  clearOwnedFirms();
  clearFirmClosure();
  rpc.mockReset();
  api.fetchMyFirms.mockReset().mockResolvedValue([{ firm_id: "f1", name: "Alpha Advisory", address: "alpha", role: "agent" }]);
  api.fetchOwnedFirms.mockReset().mockResolvedValue([]);
  api.fetchIsAdmin.mockReset().mockResolvedValue(false);
});
afterEach(() => cleanup());

describe("the closing banner", () => {
  // Catches: a closing firm's members are not told, or are told no date, or are not told that nothing can be changed.
  it("tells a member on every page when the firm closes and that nothing can be changed", async () => {
    answer("2026-12-18T12:00:00Z");
    for (const at of ["/advisor", "/advisor/partners", "/settings"]) {
      cleanup();
      clearFirmClosure();
      await renderAt(at);
      const banner = await screen.findByRole("status", { name: "This firm is closing" });
      expect(banner).toHaveTextContent("Alpha Advisory closes on December 18, 2026.");
      expect(banner).toHaveTextContent("nothing can be changed, added, sent or deleted");
      expect(banner).toHaveTextContent("An owner can withdraw the request before then.");
      expect(screen.getByText("The page")).toBeInTheDocument();
    }
    expect(rpc).toHaveBeenCalledWith("my_firm_closure", { p_firm_id: "f1" });
  });

  // Catches: an owner is not told how to withdraw, or is sent somewhere that doesn't exist.
  it("tells an owner where to withdraw", async () => {
    api.fetchMyFirms.mockResolvedValue([{ firm_id: "f1", name: "Alpha Advisory", address: "alpha", role: "owner" }]);
    answer("2026-12-18T12:00:00Z");
    await renderAt("/advisor");
    const banner = await screen.findByRole("status", { name: "This firm is closing" });
    expect(banner).toHaveTextContent("withdraw the request in Settings before that day");
    expect(banner.querySelector("a")).toHaveAttribute("href", "/settings");
  });

  // Catches: a banner is shown for a firm that is not closing, or when the question could not be answered (a guess would be a lie).
  it("shows nothing for a firm that is not closing, or when the question fails", async () => {
    answer(null);
    await renderAt("/advisor");
    expect(screen.queryByRole("status", { name: "This firm is closing" })).not.toBeInTheDocument();
    cleanup();
    clearFirmClosure();
    rpc.mockRejectedValue(new Error("offline"));
    await renderAt("/advisor");
    expect(screen.queryByRole("status", { name: "This firm is closing" })).not.toBeInTheDocument();
    expect(screen.getByText("The page")).toBeInTheDocument();
  });
});
