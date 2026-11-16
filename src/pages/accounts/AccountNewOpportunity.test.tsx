import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { AccountPage as Page } from "@/lib/accountPageApi";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";

// New opportunity on an account's page through a faked client (story CRM-A2.3, screen 25): what a person sees and does. The database's own rules (who may add one,
// an archived account, the owner, the fields and the source) are tested in supabase/tests/opportunity_create.sql; the form's own behaviour in
// NewOpportunityDialog.test.tsx. Here the page offers the form where it can work, and a save opens the new opportunity's page (D-442).

vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "dana@example.com" }, signOut: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const client = { getAccountPage: vi.fn(), listAccountTab: vi.fn(), listAccountFiles: vi.fn(), updateAccount: vi.fn(), getSubmissionAccount: vi.fn() };
vi.mock("@/lib/accountPageApi", async () => ({ ...(await vi.importActual<object>("@/lib/accountPageApi")), ...client }));
const opportunities = { createOpportunity: vi.fn(), getNewOpportunityContext: vi.fn() };
vi.mock("@/lib/opportunityCreateApi", async () => ({ ...(await vi.importActual<object>("@/lib/opportunityCreateApi")), ...opportunities }));
vi.mock("@/lib/advisorApi", () => ({ documentUrl: vi.fn(), recordActivity: vi.fn() }));

const { default: AccountPage } = await import("./AccountPage");

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  firm: { id: "f1", name: "Acme Benefits", address: "acme" }, role: "Agent", isOwner: false, isSupport: false, supportEndsAt: null, supportSessionId: null,
  isPlatformAdmin: false, person: "Dana Reyes", ...over,
});

const tabOf = <R,>(rows: R[], count = rows.length) => ({ count, rows });
const account = {
  id: "a1", version: 3, name: "Harborview Dental Group", tradeName: null, website: null, webDomain: null, phone: null, street: null, city: "Portland", state: "OR", postalCode: null,
  industry: "Dental practice", employees: 45, statesOfOperation: ["OR"], currentProvider: null, source: "added_by_hand" as const, archivedAt: null as string | null,
  createdAt: "2026-10-28T10:00:00+00:00", updatedAt: "2026-11-01T10:00:00+00:00", status: "prospect" as const, owner: { id: "u1", name: "Dana Reyes" }, sourcePartner: null,
};
const page = (over: Partial<Page> = {}): Page => ({
  account, canChange: true,
  tabs: { contacts: tabOf([]), opportunities: tabOf([]), quotes: tabOf([]), activity: tabOf([]), files: tabOf([]) },
  ...over,
});

const Where = () => {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
};
const renderPage = (path = "/accounts/a1", ws: Workspace = workspace()) => {
  const router = createMemoryRouter([
    { path: "/accounts/:id", element: <><AccountPage /><Where /></> },
    { path: "/opportunities/:id", element: <p data-testid="opportunity-page"><Where /></p> },
  ], { initialEntries: [path] });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } })}>
      <WorkspaceContext.Provider value={ws}><RouterProvider router={router} /></WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  for (const fn of [...Object.values(client), ...Object.values(opportunities)]) fn.mockReset();
  vi.mocked(toast.success).mockReset();
  client.getAccountPage.mockResolvedValue(page());
  client.listAccountTab.mockImplementation(async () => tabOf([]));
  opportunities.getNewOpportunityContext.mockResolvedValue({
    account: { id: "a1", name: "Harborview Dental Group", archived: false, employees: 45 }, mainContact: null, contacts: [], partners: [], owners: [{ id: "u1", name: "Dana Reyes" }],
  });
  opportunities.createOpportunity.mockResolvedValue({ id: "o9", version: 1, stage: "qualifying" });
});

describe("New opportunity on an account's page", () => {
  // Catches: no way to start an opportunity from the account (D-436: its header and its Opportunities tab).
  it("offers New opportunity in the header and over the Opportunities tab", async () => {
    const user = userEvent.setup();
    renderPage();
    const header = (await screen.findByRole("heading", { level: 1, name: "Harborview Dental Group" })).closest("header") as HTMLElement;
    expect(within(header).getByRole("button", { name: "New opportunity" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /^Opportunities/ }));
    const panel = await screen.findByRole("region", { name: /^Opportunities/ });
    expect(within(panel).getByRole("button", { name: "New opportunity" })).toBeInTheDocument();
  });

  // Catches: a button where the database will refuse every write (a Nevermore support session, ADR 0024): no button that does nothing (D-24).
  it("offers none to Nevermore support", async () => {
    renderPage("/accounts/a1", workspace({ isSupport: true }));
    await screen.findByRole("heading", { level: 1, name: "Harborview Dental Group" });
    expect(screen.queryByRole("button", { name: "New opportunity" })).toBeNull();
  });
  // Catches: a button where nothing can be added (an archived account, D-222): no button that does nothing (D-24).
  it("offers none on an archived account", async () => {
    client.getAccountPage.mockResolvedValue(page({ account: { ...account, archivedAt: "2026-11-01T00:00:00+00:00" } }));
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Harborview Dental Group" });
    expect(screen.queryByRole("button", { name: "New opportunity" })).toBeNull();
  });

  // Catches: the form opening for another account, a save that leaves the person on the account (D-442: saving opens the new opportunity's page), the page not told
  // to ask its lists again, or the route going to the wrong opportunity.
  it("opens the form on this account and, after a save, the new opportunity's page", async () => {
    const user = userEvent.setup();
    renderPage();
    const header = (await screen.findByRole("heading", { level: 1, name: "Harborview Dental Group" })).closest("header") as HTMLElement;
    await user.click(within(header).getByRole("button", { name: "New opportunity" }));
    const dialog = await screen.findByRole("dialog", { name: "New opportunity" });
    expect(await within(dialog).findByText("On Harborview Dental Group")).toBeInTheDocument();
    expect(opportunities.getNewOpportunityContext).toHaveBeenCalledWith("f1", "a1");
    await user.click(await within(dialog).findByRole("button", { name: "Save opportunity" }));
    await waitFor(() => expect(screen.getByTestId("opportunity-page")).toBeInTheDocument());
    expect(opportunities.createOpportunity).toHaveBeenCalledWith("f1", "a1", expect.objectContaining({ name: "PEO search", ownerId: "u1" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/opportunities/o9");
    expect(toast.success).toHaveBeenCalledWith("Opportunity created");
  });

  // Catches: Cancel leaving the person somewhere else, or making something.
  it("stays on the account when the form is cancelled", async () => {
    const user = userEvent.setup();
    renderPage();
    const header = (await screen.findByRole("heading", { level: 1, name: "Harborview Dental Group" })).closest("header") as HTMLElement;
    await user.click(within(header).getByRole("button", { name: "New opportunity" }));
    const dialog = await screen.findByRole("dialog", { name: "New opportunity" });
    await user.click(await within(dialog).findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(opportunities.createOpportunity).not.toHaveBeenCalled();
    expect(screen.getByTestId("where")).toHaveTextContent("/accounts/a1");
  });
});
