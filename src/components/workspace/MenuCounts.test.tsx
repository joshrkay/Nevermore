import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The numbers on the menu (story CRM-S1.1c, D-39, D-49): open quotes beside Quotes, intakes with new PEO mail beside Inbox. The database
// counts (supabase/tests/menu_counts.sql); these tests are what a person sees: the badge, what a screen reader says, when it refreshes,
// and that a failed refresh is not an error in the menu.
const auth = { user: { id: "u1", email: "sam@example.com", user_metadata: {} as Record<string, unknown> }, session: { access_token: "tok-1" }, signOut: vi.fn() };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const api = { fetchMyFirms: vi.fn(), fetchOwnedFirms: vi.fn(), fetchIsAdmin: vi.fn() };
vi.mock("@/lib/advisorApi", () => api);
// The database's answer, through the real call (src/lib/menuCountsApi.ts): `counts` is what menu_counts() returns, or throws for a failed call.
const counts = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async (fn: string) => {
      if (fn !== "menu_counts") return { data: null, error: null };
      try { return { data: await counts(), error: null }; } catch (e) { return { data: null, error: { message: (e as Error).message } }; }
    }),
  },
}));
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => ({ status: "none" }) }));

const { clearMyFirms, clearOwnedFirms } = await import("@/hooks/useOwnedFirms");
const { default: WorkspaceShell } = await import("./WorkspaceShell");
const { default: RequireFirm } = await import("@/components/RequireFirm");

const alpha = { firm_id: "f1", name: "Alpha Advisory", address: "alpha", role: "agent" };
const settle = () => act(async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); });
// With fake timers a setTimeout of 0 never fires by itself: move the clock instead.
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

const client = () => new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
const shell = (at = "/advisor", guarded = false) => {
  const inner = guarded ? <RequireFirm><WorkspaceShell /></RequireFirm> : <WorkspaceShell />;
  return (
    <QueryClientProvider client={client()}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route element={inner}>
            <Route path="*" element={<p>The page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};
const renderShell = async (guarded = false) => { const v = render(shell("/advisor", guarded)); await settle(); return v; };
const menu = () => screen.getByRole("navigation", { name: "Workspace" });
const link = (name: string | RegExp) => within(menu()).getByRole("link", { name });
const seen = (name: string) => within(menu()).findByRole("link", { name });
// With fake timers: let the firm resolve and the first answer arrive before a test changes what the next one says.
const loaded = async () => {
  for (let i = 0; i < 20 && !within(menu()).queryByRole("link", { name: "Quotes, 4 open" }); i++) await tick(10);
  expect(link("Quotes, 4 open")).toBeInTheDocument();
};
const linkNames = () => within(menu()).getAllByRole("link").map((l) => l.getAttribute("aria-label") ?? l.textContent);

beforeEach(() => {
  clearMyFirms();
  clearOwnedFirms();
  counts.mockReset().mockResolvedValue({ quotes: 4, inbox: 2 });
  api.fetchMyFirms.mockReset().mockResolvedValue([alpha]);
  api.fetchOwnedFirms.mockReset().mockResolvedValue([]);
  api.fetchIsAdmin.mockReset().mockResolvedValue(false);
  window.innerWidth = 1024;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("the menu's counts", () => {
  // Catches: the numbers never reaching the menu, or reaching it as a bare number that a screen reader reads with no meaning.
  it("shows open quotes beside Quotes and intakes with new mail beside Inbox, and says what each means to a screen reader", async () => {
    await renderShell();
    expect(await seen("Quotes, 4 open")).toHaveTextContent("Quotes4");
    expect(link("Inbox, 2 with new mail")).toHaveTextContent("Inbox2");
    // Only the items that have a count carry one.
    expect(link("Reports")).toHaveTextContent(/^Reports$/);
    expect(link("Settings")).toHaveTextContent(/^Settings$/);
  });

  // Catches: a "0" badge on an item with nothing to look at, which trains people to ignore the badges.
  it("shows no badge for zero", async () => {
    counts.mockResolvedValue({ quotes: 0, inbox: 3 });
    await renderShell();
    expect(await seen("Inbox, 3 with new mail")).toBeInTheDocument();
    expect(link("Quotes")).toHaveTextContent(/^Quotes$/);
  });

  // Catches: a long number pushing the label out of the narrow menu; or the cap hiding the real number from a screen reader.
  it("shows 99 as it is, anything above as 99+, and still says the real number aloud", async () => {
    counts.mockResolvedValue({ quotes: 99, inbox: 150 });
    await renderShell();
    expect(await seen("Quotes, 99 open")).toHaveTextContent("Quotes99");
    expect(link("Inbox, 150 with new mail")).toHaveTextContent("Inbox99+");
  });

  // Catches: the phone's sheet drawing the menu without the counts the desktop menu has.
  it("shows them in the menu opened over the page at phone width", async () => {
    window.innerWidth = 500;
    await renderShell();
    expect(screen.queryByRole("link", { name: /^Quotes/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    await settle();
    expect(await seen("Quotes, 4 open")).toBeVisible();
    expect(link("Inbox, 2 with new mail")).toBeVisible();
  });

  // Catches: a menu that shows numbers the database never gave it (before they arrive, or when the answer is malformed).
  it("shows no badge before the first answer arrives, and none for an answer that is not numbers", async () => {
    counts.mockReturnValue(new Promise(() => {}));
    await renderShell();
    expect(linkNames()).toContain("Quotes");
    cleanup();
    counts.mockReset().mockResolvedValue({ quotes: "many", inbox: -1 });
    await renderShell();
    expect(linkNames()).toContain("Quotes");
    expect(linkNames()).toContain("Inbox");
  });
});

describe("keeping the counts fresh", () => {
  // Catches: numbers that stay as they were when the person comes back to the tab after a while.
  it("asks again when the window gets focus, and shows the new numbers", async () => {
    await renderShell();
    expect(counts).toHaveBeenCalledTimes(1);
    counts.mockResolvedValue({ quotes: 5, inbox: 0 });
    await act(async () => { window.dispatchEvent(new Event("visibilitychange")); });
    await settle();
    expect(counts).toHaveBeenCalledTimes(2);
    expect(await seen("Quotes, 5 open")).toBeInTheDocument();
    expect(link("Inbox")).toHaveTextContent(/^Inbox$/);
  });

  // Catches: counts that are only read when the page loads, so a tab left open all day shows yesterday's mail.
  it("asks again every 60 seconds, keeping the old numbers on screen while the next arrive", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval", "Date"] });
    render(shell());
    await loaded();
    expect(counts).toHaveBeenCalledTimes(1);
    await tick(59_000);
    expect(counts).toHaveBeenCalledTimes(1);
    let arrive: (v: { quotes: number; inbox: number }) => void = () => {};
    counts.mockReturnValue(new Promise((resolve) => { arrive = resolve; }));
    await tick(1_000);
    expect(counts).toHaveBeenCalledTimes(2);
    // Still the old numbers while the next are on their way.
    expect(link("Quotes, 4 open")).toBeInTheDocument();
    await act(async () => { arrive({ quotes: 7, inbox: 2 }); });
    await tick(0);
    expect(link("Quotes, 7 open")).toBeInTheDocument();
  });

  // Catches: a failed refresh blanking the numbers, or putting an error in the menu for something not worth one.
  it("keeps the last numbers when a refresh fails, and shows no error", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval", "Date"] });
    render(shell());
    await loaded();
    counts.mockRejectedValue(new Error("offline"));
    await tick(60_000);
    expect(counts).toHaveBeenCalledTimes(2);
    expect(link("Quotes, 4 open")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(menu()).not.toHaveTextContent(/error|couldn|failed|try again/i);
  });

  // Catches: an old number shown as if it were fresh for ever once the connection is gone.
  it("drops the numbers once refreshes have been failing for five minutes", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval", "Date"] });
    render(shell());
    await loaded();
    counts.mockRejectedValue(new Error("offline"));
    await tick(5 * 60_000);
    expect(link("Quotes, 4 open")).toBeInTheDocument();
    await tick(2 * 60_000);
    expect(link("Quotes")).toHaveTextContent(/^Quotes$/);
    expect(link("Inbox")).toHaveTextContent(/^Inbox$/);
    // And they come back with the first good answer.
    counts.mockResolvedValue({ quotes: 1, inbox: 1 });
    await tick(60_000);
    await tick(10);
    expect(link("Quotes, 1 open")).toBeInTheDocument();
  });

  // Catches: a tab that was only in the background losing its badges when it comes back, while the new numbers are still on their way
  // (D-49: keep what is on screen while the next arrive). Old is not the same as failing.
  it("keeps the numbers of a tab that sat in the background, while the refresh on return is in flight", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval", "Date"] });
    const visibility = vi.spyOn(document, "visibilityState", "get");
    render(shell());
    await loaded();
    visibility.mockReturnValue("hidden");
    await act(async () => { window.dispatchEvent(new Event("visibilitychange")); });
    await tick(10 * 60_000);
    expect(counts).toHaveBeenCalledTimes(1);
    expect(link("Quotes, 4 open")).toBeInTheDocument();
    let arrive: (v: { quotes: number; inbox: number }) => void = () => {};
    counts.mockReturnValue(new Promise((resolve) => { arrive = resolve; }));
    visibility.mockReturnValue("visible");
    await act(async () => { window.dispatchEvent(new Event("visibilitychange")); });
    await tick(10);
    expect(counts).toHaveBeenCalledTimes(2);
    expect(link("Quotes, 4 open")).toBeInTheDocument();
    await act(async () => { arrive({ quotes: 9, inbox: 0 }); });
    await tick(10);
    expect(link("Quotes, 9 open")).toBeInTheDocument();
    visibility.mockRestore();
  });

  // Catches: one failed refresh after a long time in the background taking the numbers away at once, as if it had been failing for minutes.
  it("does not drop the numbers for a single failed refresh on return from the background", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval", "Date"] });
    const visibility = vi.spyOn(document, "visibilityState", "get");
    render(shell());
    await loaded();
    visibility.mockReturnValue("hidden");
    await act(async () => { window.dispatchEvent(new Event("visibilitychange")); });
    await tick(10 * 60_000);
    counts.mockRejectedValue(new Error("offline"));
    visibility.mockReturnValue("visible");
    await act(async () => { window.dispatchEvent(new Event("visibilitychange")); });
    await tick(10);
    expect(counts).toHaveBeenCalledTimes(2);
    expect(link("Quotes, 4 open")).toBeInTheDocument();
    visibility.mockRestore();
  });
});

describe("who the counts are fetched for", () => {
  // Catches: the counts being asked for by a person the guard keeps out (a stranger would learn from the error, or the cost, that a firm exists).
  it("are not fetched for someone the guard keeps out of the workspace", async () => {
    api.fetchMyFirms.mockResolvedValue([]);
    await renderShell(true);
    expect(screen.queryByRole("navigation", { name: "Workspace" })).not.toBeInTheDocument();
    expect(counts).not.toHaveBeenCalled();
  });

  // Catches: a shell with no firm to show asking anyway.
  it("are not fetched while the shell has no firm to show", async () => {
    api.fetchMyFirms.mockResolvedValue([]);
    await renderShell();
    expect(counts).not.toHaveBeenCalled();
  });

  // Catches: a support session (which reads, ADR 0024) losing the numbers a member has.
  it("are shown to a platform admin on a support session, who reads", async () => {
    api.fetchMyFirms.mockResolvedValue([{ ...alpha, role: "support" }]);
    await renderShell();
    expect(counts).toHaveBeenCalledTimes(1);
    expect(await seen("Quotes, 4 open")).toBeInTheDocument();
  });
});
