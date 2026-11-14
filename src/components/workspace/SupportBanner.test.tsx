import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// What a platform admin sees in a firm's workspace on a support session (story CRM-P2.4, D-33): a banner on every page that says whom they
// are looking at, that nothing can be changed and when it ends, with a way to end it now; the role shown as "Nevermore support"; and, once the
// hour is over, a page that says so with the way back to the platform's firms page. It only says what the database enforces.
const auth = { user: { id: "admin1", email: "admin@nevermore.example", user_metadata: {} as Record<string, unknown> }, session: { access_token: "tok-1" }, signOut: vi.fn() };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const api = { fetchMyFirms: vi.fn(), fetchOwnedFirms: vi.fn(), fetchIsAdmin: vi.fn() };
vi.mock("@/lib/advisorApi", () => api);
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => ({ status: "known", address: "alpha", name: "Alpha Advisory" }) }));
const openFirmAddress = vi.fn();
vi.mock("@/lib/firmHost", async () => ({ ...(await vi.importActual<object>("@/lib/firmHost")), openFirmAddress: (...a: unknown[]) => openFirmAddress(...a) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { clearMyFirms, clearOwnedFirms } = await import("@/hooks/useOwnedFirms");
const { clearFirmClosure } = await import("@/hooks/useFirmClosure");
const { default: WorkspaceShell } = await import("./WorkspaceShell");

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const renderAt = async (at: string) => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route element={<WorkspaceShell />}>
            <Route path="*" element={<p>The page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await settle();
};
// The database's answers: a support session for the firm at this address (or none), and no closing.
const session = (endsAt: string) => ({ session_id: "s1", firm_id: "f1", firm_name: "Alpha Advisory", firm_address: "alpha", ends_at: endsAt, ended_at: null, is_open: true, second_factor_pending: false });
const answer = (open: ReturnType<typeof session> | null) =>
  rpc.mockImplementation(async (fn: string) => {
    if (fn === "my_support_session_here") return { data: open ? [open] : [], error: null };
    if (fn === "my_firm_closure") return { data: [], error: null };
    return { data: null, error: null };
  });
const inOneHour = () => new Date(Date.now() + 3_600_000).toISOString();

const originalLocation = window.location;
beforeEach(() => {
  // At a firm's address: the support session is asked only there.
  Object.defineProperty(window, "location", { value: { ...originalLocation, hostname: "alpha.localhost", protocol: "http:", port: "5173" }, configurable: true });
  clearMyFirms();
  clearOwnedFirms();
  clearFirmClosure();
  rpc.mockReset();
  openFirmAddress.mockReset();
  api.fetchMyFirms.mockReset().mockResolvedValue([]);
  api.fetchOwnedFirms.mockReset().mockResolvedValue([]);
  api.fetchIsAdmin.mockReset().mockResolvedValue(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.defineProperty(window, "location", { value: originalLocation, configurable: true });
});

describe("the support banner", () => {
  // Catches: an admin looking at a firm is not told so on every page, or is told they can change things, or is given no end time.
  it("tells an admin on a support session, on every page, whom they are looking at, that they can't change anything and when it ends", async () => {
    answer(session(inOneHour()));
    for (const at of ["/advisor", "/advisor/partners", "/settings"]) {
      cleanup();
      await renderAt(at);
      const banner = screen.getByRole("status", { name: "Nevermore support" });
      expect(banner).toHaveTextContent("Nevermore support: you are looking at Alpha Advisory.");
      expect(banner).toHaveTextContent("You can't change anything.");
      expect(banner.textContent).toMatch(/Ends at \d{1,2}:\d{2} [AP]M\./);
      expect(within(banner).getByRole("button", { name: "End now" })).toBeInTheDocument();
      expect(screen.getByText("The page")).toBeInTheDocument();
    }
  });

  // Catches: the shell names the admin's role as an owner's, lead's or agent's.
  it("shows the role as Nevermore support", async () => {
    answer(session(inOneHour()));
    await renderAt("/advisor");
    expect(screen.getByText("Nevermore support", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByText("Owner")).not.toBeInTheDocument();
  });

  // Catches: a member is shown a support banner, or the support question is asked of someone with no support session.
  it("shows no banner to a member", async () => {
    answer(null);
    api.fetchMyFirms.mockResolvedValue([{ firm_id: "f1", name: "Alpha Advisory", address: "alpha", role: "owner" }]);
    await renderAt("/advisor");
    expect(screen.queryByRole("status", { name: "Nevermore support" })).not.toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });

  // Catches: End now does nothing, or ends it in the database but leaves the admin on a workspace that no longer answers, or sends them anywhere but the firms page.
  it("ends the session and leaves for the platform's firms page", async () => {
    answer(session(inOneHour()));
    await renderAt("/advisor");
    fireEvent.click(screen.getByRole("button", { name: "End now" }));
    await settle();
    expect(rpc).toHaveBeenCalledWith("end_support_session", { p_session_id: "s1" });
    expect(openFirmAddress).toHaveBeenCalledWith("http://localhost:5173/advisor/firms");
  });

  // Catches: the page stays up after the hour, so the admin goes on clicking at pages that no longer answer.
  it("says the hour has ended when it passes, in the page's place, with a link back to the firms page", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    answer(session(new Date(Date.now() + 2_000).toISOString()));
    await renderAt("/advisor");
    expect(screen.getByText("The page")).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(3_000); });
    expect(screen.getByRole("heading", { name: "The support hour has ended" })).toBeInTheDocument();
    expect(screen.queryByText("The page")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the firms page" })).toHaveAttribute("href", "http://localhost:5173/advisor/firms");
  });
});
