import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = {
  user: { id: "u1", email: "sam@example.com", user_metadata: {} as Record<string, unknown> },
  session: { access_token: "tok-1" },
  signOut: vi.fn(),
};
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const api = { fetchMyFirms: vi.fn(), fetchOwnedFirms: vi.fn(), fetchIsAdmin: vi.fn() };
vi.mock("@/lib/advisorApi", () => api);
// The shell's Settings page also holds the "Leave this firm" action, which reaches the database through its own module (tested in AdvisorSettingsLeave.test.tsx).
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
let firmAddress: { status: "none" } | { status: "known"; address: string; name: string } = { status: "none" };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firmAddress }));

const { clearMyFirms, clearOwnedFirms } = await import("@/hooks/useOwnedFirms");
const { default: WorkspaceShell } = await import("./WorkspaceShell");
const { default: SettingsPage } = await import("@/pages/advisor/AdvisorSettingsPage");

const alpha = { firm_id: "f1", name: "Alpha Advisory", address: "alpha", role: "agent" };
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

const renderAt = async (at: string) => {
  const view = render(
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
  return view;
};
const menu = () => screen.getByRole("navigation", { name: "Workspace" });
const current = () => within(menu()).queryAllByRole("link").filter((l) => l.getAttribute("aria-current") === "page").map((l) => l.textContent);

beforeEach(() => {
  clearMyFirms();
  clearOwnedFirms();
  firmAddress = { status: "none" };
  auth.user = { id: "u1", email: "sam@example.com", user_metadata: {} };
  auth.signOut.mockReset();
  api.fetchMyFirms.mockReset().mockResolvedValue([alpha]);
  api.fetchOwnedFirms.mockReset().mockResolvedValue([]);
  api.fetchIsAdmin.mockReset().mockResolvedValue(false);
  window.innerWidth = 1024;
});
afterEach(() => cleanup());

describe("the workspace menu", () => {
  it("holds Quotes, Inbox and Reports, then Settings, and none of the sections that aren't built yet", async () => {
    await renderAt("/advisor");
    expect(within(menu()).getAllByRole("link").map((l) => l.textContent).filter((t) => ["Quotes", "Inbox", "Reports", "Settings"].includes(t ?? ""))).toEqual(["Quotes", "Inbox", "Reports", "Settings"]);
    for (const name of ["New quote", "Home", "Leads", "Accounts"]) {
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("makes each item a real link to where it opens until its own epic", async () => {
    await renderAt("/advisor");
    const href = (name: string) => within(menu()).getByRole("link", { name }).getAttribute("href");
    expect(href("Quotes")).toBe("/advisor");
    expect(href("Inbox")).toBe("/advisor?mail=new");
    expect(href("Reports")).toBe("/advisor/funnel");
    expect(href("Settings")).toBe("/settings");
  });

  it.each([
    ["/advisor", "Quotes"],
    ["/advisor?status=under_review", "Quotes"],
    ["/advisor/submissions/abc", "Quotes"],
    ["/advisor?mail=new", "Inbox"],
    ["/advisor/funnel", "Reports"],
    ["/settings", "Settings"],
    ["/advisor/partners", "Settings"],
    ["/advisor/activity", "Settings"],
    ["/firm/invitations", "Settings"],
  ])("marks exactly one section as current at %s: %s", async (at, section) => {
    await renderAt(at);
    expect(current()).toEqual([section]);
  });

  it("puts the firm's name and address at the top, linking to the queue", async () => {
    await renderAt("/settings");
    const tile = screen.getByRole("link", { name: /Alpha Advisory/ });
    expect(tile).toHaveAttribute("href", "/advisor");
    expect(tile).toHaveTextContent("alpha.nevermorepeo.com");
  });

  it("names the firm the address names when the person belongs to several", async () => {
    const beta = { firm_id: "f2", name: "Beta Brokers", address: "beta", role: "owner" };
    api.fetchMyFirms.mockResolvedValue([alpha, beta]);
    firmAddress = { status: "known", address: "beta", name: "Beta Brokers" };
    await renderAt("/advisor");
    expect(screen.getByRole("link", { name: /Beta Brokers/ })).toBeInTheDocument();
    expect(screen.queryByText(/Alpha Advisory/)).not.toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });

  it("shows the person's name and role at the foot, and their email when they have no name", async () => {
    auth.user = { id: "u1", email: "sam@example.com", user_metadata: { full_name: "Sam Ortiz" } };
    const first = await renderAt("/advisor");
    expect(screen.getByText("Sam Ortiz")).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();
    first.unmount();
    auth.user = { id: "u1", email: "sam@example.com", user_metadata: {} };
    await renderAt("/advisor");
    expect(screen.getByText("sam@example.com")).toBeInTheDocument();
  });

  it("keeps sign-out reachable", async () => {
    await renderAt("/advisor");
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("offers the Nevermore admin link to a platform admin only", async () => {
    const first = await renderAt("/advisor");
    expect(screen.queryByRole("link", { name: "Nevermore admin" })).not.toBeInTheDocument();
    first.unmount();
    clearMyFirms();
    api.fetchIsAdmin.mockResolvedValue(true);
    await renderAt("/advisor");
    expect(screen.getByRole("link", { name: "Nevermore admin" })).toHaveAttribute("href", "/advisor/firms");
  });

  it("offers no admin link when it can't be known whether the person is an admin", async () => {
    api.fetchIsAdmin.mockRejectedValue(new Error("offline"));
    await renderAt("/advisor");
    expect(screen.queryByRole("link", { name: "Nevermore admin" })).not.toBeInTheDocument();
  });

  it("shows the page it wraps and the legal links", async () => {
    await renderAt("/advisor");
    expect(screen.getByText("The page")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toBeInTheDocument();
  });
});

describe("the desktop menu", () => {
  it("can't be hidden with Ctrl+B or Cmd+B, which would leave no way back, and the browser's own shortcut is left alone", async () => {
    await renderAt("/advisor");
    for (const init of [{ ctrlKey: true }, { metaKey: true }]) {
      const event = new KeyboardEvent("keydown", { key: "b", bubbles: true, cancelable: true, ...init });
      act(() => { window.dispatchEvent(event); });
      expect(event.defaultPrevented).toBe(false);
    }
    await settle();
    expect(within(menu()).getByRole("link", { name: "Quotes" })).toBeVisible();
    expect(document.querySelector('[data-state="collapsed"]')).toBeNull();
  });
});

describe("the workspace state", () => {
  it("asks whether the person is a platform admin once for each time the shell is shown, however many parts use it", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/settings"]}>
          <Routes>
            <Route element={<WorkspaceShell />}>
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await settle();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(api.fetchIsAdmin).toHaveBeenCalledTimes(1);
  });
});

describe("the workspace look", () => {
  it("puts the theme class on the document's root while the shell is mounted and takes it off after", async () => {
    const view = await renderAt("/advisor");
    expect(document.documentElement).toHaveClass("theme-workspace");
    view.unmount();
    expect(document.documentElement).not.toHaveClass("theme-workspace");
  });
});

describe("the menu at phone width", () => {
  beforeEach(() => { window.innerWidth = 500; });

  it("collapses to a button that opens the menu over the page, every item still a link", async () => {
    await renderAt("/advisor/funnel");
    expect(screen.queryByRole("navigation", { name: "Workspace" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const dialog = await screen.findByRole("dialog");
    const nav = within(dialog).getByRole("navigation", { name: "Workspace" });
    for (const name of ["Quotes", "Inbox", "Reports", "Settings"]) expect(within(nav).getByRole("link", { name })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Reports" })).toHaveAttribute("aria-current", "page");
    expect(within(dialog).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("closes the menu when the item for the page already shown is chosen, too", async () => {
    await renderAt("/advisor/funnel");
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("link", { name: "Reports" }));
    await settle();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the menu once an item has taken the person to its page", async () => {
    await renderAt("/advisor");
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("link", { name: "Reports" }));
    await settle();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
