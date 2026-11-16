import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Outlet, Route } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
// The dialog itself is tested in NewQuoteDialog.test.tsx; here it is a stand-in that shows what it was given and closes the two ways it can.
vi.mock("./NewQuoteDialog", () => ({
  NewQuoteDialog: ({ firmId, opportunityId, onClose }: { firmId: string; opportunityId?: string; onClose: (closed?: { opportunityId?: string }) => void }) => (
    <div role="dialog" aria-label="New quote">
      <span data-testid="given">{`${firmId}|${opportunityId ?? "none"}`}</span>
      <button type="button" onClick={() => onClose()}>Close without saving</button>
      <button type="button" onClick={() => onClose({ opportunityId: "o9" })}>Save and close</button>
    </div>
  ),
}));

const { BackgroundRoutes, useRealLocation } = await import("./BackgroundRoutes");
const { NewQuoteHost } = await import("./NewQuoteHost");

const workspace: Workspace = { firm: { id: "f1", name: "Alpha Advisory", address: "alpha" }, role: "Agent", isOwner: false, isSupport: false, supportEndsAt: null, supportSessionId: null, isPlatformAdmin: false, person: "Dana Reyes" };

const Where = () => { const real = useRealLocation(); return <span data-testid="where">{real.pathname + real.search}</span>; };
const Shell = () => (
  <WorkspaceContext.Provider value={workspace}>
    <Outlet />
    <NewQuoteHost />
    <Where />
  </WorkspaceContext.Provider>
);

const renderAt = (entry: string | { pathname: string; search?: string; state?: unknown }) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <BackgroundRoutes>
        <Route element={<Shell />}>
          <Route path="/accounts" element={<p>The accounts page</p>} />
          <Route path="/opportunities/:id" element={<p>The opportunity page</p>} />
          <Route path="/advisor" element={<p>The queue</p>} />
          <Route path="/new-quote" element={null} />
          <Route path="/new-quote/:opportunityId" element={null} />
        </Route>
      </BackgroundRoutes>
    </MemoryRouter>,
  );

afterEach(() => cleanup());

describe("New quote drawn over the page it was opened from (D-1709)", () => {
  // Catches: New quote replacing the page the agent was on (it must be drawn over it), or opening without the firm.
  it("keeps the page it was opened from on screen beneath the dialog", () => {
    renderAt({ pathname: "/new-quote", state: { backgroundLocation: { pathname: "/accounts", search: "?view=clients", hash: "", state: null, key: "k" } } });
    expect(screen.getByText("The accounts page")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "New quote" })).toBeInTheDocument();
    expect(screen.getByTestId("given")).toHaveTextContent("f1|none");
  });

  // Catches: closing leaving the agent on New quote's address, or sending them to a default page instead of the one they were on, with its address (filters, views) as it was.
  it("returns to the page it was opened from, with its address, when it closes", async () => {
    renderAt({ pathname: "/new-quote", state: { backgroundLocation: { pathname: "/accounts", search: "?view=clients", hash: "", state: null, key: "k" } } });
    await userEvent.click(screen.getByRole("button", { name: "Close without saving" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/accounts?view=clients");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("The accounts page")).toBeInTheDocument();
  });

  // Catches: opened alone (a typed or bookmarked address, no page beneath), New quote drawing some page behind it, or Save and close leaving the agent on a page that is gone.
  it("stands by itself when opened from its own address, and Save and close then opens the opportunity's page", async () => {
    renderAt("/new-quote");
    expect(screen.getByRole("dialog", { name: "New quote" })).toBeInTheDocument();
    expect(screen.queryByText("The accounts page")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save and close" }));
    expect(screen.getByTestId("where").textContent).toBe("/opportunities/o9");
    expect(screen.getByText("The opportunity page")).toBeInTheDocument();
  });

  // Catches: closing New quote opened alone (nothing saved, no page to return to) leaving the dialog open and the agent stuck on its address.
  it("opened alone and closed without saving, goes to the Quotes queue", async () => {
    renderAt("/new-quote/o1");
    expect(screen.getByTestId("given")).toHaveTextContent("f1|o1");
    await userEvent.click(screen.getByRole("button", { name: "Close without saving" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/advisor");
    expect(screen.getByText("The queue")).toBeInTheDocument();
  });
});
