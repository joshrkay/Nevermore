import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContactPage as Page } from "@/lib/contactPageApi";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";

// Merging from a contact's page, and a contact's old address (story CRM-S4.3a, screen 37). The database decides who may merge and what moves
// (supabase/tests/merge_records.sql); these tests are what a person sees and does.
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "dana@example.com" }, signOut: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const client = { getContactPage: vi.fn(), listContactActivity: vi.fn() };
vi.mock("@/lib/contactPageApi", async () => ({ ...(await vi.importActual<object>("@/lib/contactPageApi")), ...client }));
const accountApi = { listAccountTab: vi.fn() };
vi.mock("@/lib/accountPageApi", async () => ({ ...(await vi.importActual<object>("@/lib/accountPageApi")), ...accountApi }));
const merge = { resolveMergedRecord: vi.fn(), previewMerge: vi.fn(), mergeContacts: vi.fn() };
vi.mock("@/lib/mergeApi", async () => ({ ...(await vi.importActual<object>("@/lib/mergeApi")), ...merge }));
vi.mock("@/lib/searchApi", async () => ({ ...(await vi.importActual<object>("@/lib/searchApi")), noteRecentRecord: vi.fn().mockResolvedValue(true) }));

const { default: ContactPage } = await import("./ContactPage");

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  firm: { id: "f1", name: "Acme Benefits", address: "acme" }, role: "Agent", isOwner: false, isSupport: false, supportEndsAt: null, supportSessionId: null,
  isPlatformAdmin: false, person: "Dana Reyes", ...over,
});
const contact = {
  id: "c1", version: 3, accountId: "a1", firstName: "Elena", lastName: "Marsh", title: null, email: "elena@harborview.example", phone: null, mobile: null as string | null,
  isMain: true, doNotEmail: false, owner: { id: "u1", name: "Dana Reyes" } as { id: string; name: string } | null,
  createdAt: "2026-09-03T10:00:00+00:00", updatedAt: "2026-11-01T10:00:00+00:00", account: { id: "a1", name: "Harborview Dental Group", archived: false },
};
const page = (over: Partial<Page> = {}, c: Partial<typeof contact> = {}): Page => ({ contact: { ...contact, ...c }, canChange: true, canMove: true, canAdd: true, opportunities: { count: 0, rows: [] }, ...over });
const other = { id: "c2", firstName: "Priya", lastName: "Abel", title: null, email: "priya@harborview.example", phone: null, mobile: null, isMain: false, doNotEmail: false };

const Where = () => {
  const l = useLocation();
  return <><p data-testid="where">{l.pathname}</p><p data-testid="state">{JSON.stringify(l.state)}</p></>;
};
const renderPage = (path = "/contacts/c1", ws: Workspace = workspace()) => {
  const router = createMemoryRouter([{ path: "/contacts/:id", element: <><ContactPage /><Where /></> }, { path: "*", element: <Where /> }], { initialEntries: [path] });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } })}>
      <WorkspaceContext.Provider value={ws}><RouterProvider router={router} /></WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  for (const fn of [...Object.values(client), ...Object.values(accountApi), ...Object.values(merge)]) fn.mockReset();
  client.getContactPage.mockImplementation(async (_f: string, id: string) => (id === "c1" ? page() : page({}, { id, firstName: "Priya", lastName: "Abel" })));
  client.listContactActivity.mockResolvedValue({ count: 0, rows: [] });
  accountApi.listAccountTab.mockResolvedValue({ count: 2, rows: [{ ...other, id: "c1", firstName: "Elena", lastName: "Marsh" }, other] });
  merge.previewMerge.mockResolvedValue({
    kind: "contact", problem: null, differs: ["title"], kept: { id: "c1", version: 3, first_name: "Elena", last_name: "Marsh", title: null },
    removed: { id: "c2", version: 1, first_name: "Priya", last_name: "Abel", title: "Controller" }, moves: { activities: 0, opportunities_main_contact_of: 0 },
  });
});

describe("a contact's page: merge", () => {
  // Catches: no way in from the contact's own page, or the contact being offered a merge with itself or with a contact of another account.
  it("offers the account's other contacts, then the choice with this contact kept", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Merge with another contact" }));
    const pick = await screen.findByRole("dialog");
    expect(accountApi.listAccountTab).toHaveBeenCalledWith("f1", "a1", "contacts", expect.anything());
    expect(within(pick).queryByRole("radio", { name: /Elena Marsh/ })).toBeNull();
    await user.click(await within(pick).findByRole("radio", { name: /Priya Abel/ }));
    await user.click(within(pick).getByRole("button", { name: "Continue" }));
    await screen.findByRole("group", { name: "Which value to keep" });
    expect(merge.previewMerge).toHaveBeenCalledWith("f1", "contact", "c1", "c2");
  });

  // Catches: a contact with no other contact on the account offered a dead end.
  it("says there is no other contact to merge with when the account has none", async () => {
    const user = userEvent.setup();
    accountApi.listAccountTab.mockResolvedValue({ count: 1, rows: [{ ...other, id: "c1", firstName: "Elena", lastName: "Marsh" }] });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Merge with another contact" }));
    expect(await screen.findByText(/no other contact to merge with/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  // Catches: the person left on the page of a contact that no longer exists after merging it away.
  it("opens the kept contact when this contact was the one removed", async () => {
    const user = userEvent.setup();
    merge.previewMerge.mockResolvedValue({
      kind: "contact", problem: null, differs: [], kept: { id: "c2", version: 1, first_name: "Priya", last_name: "Abel" }, removed: { id: "c1", version: 3, first_name: "Elena", last_name: "Marsh" },
      moves: { activities: 0, opportunities_main_contact_of: 0 },
    });
    merge.mergeContacts.mockResolvedValue({ record: { id: "c2", version: 2 }, removed: { id: "c1", name: "Elena Marsh" }, moved: { activities: 0, opportunities: 0 } });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Merge with another contact" }));
    const pick = await screen.findByRole("dialog");
    await user.click(await within(pick).findByRole("radio", { name: /Priya Abel/ }));
    await user.click(within(pick).getByRole("button", { name: "Continue" }));
    await user.click(await screen.findByRole("button", { name: "Merge" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/contacts/c2"));
  });

  // Catches: merging offered to someone who may not change the contact, or to Nevermore support.
  it.each([
    ["a person who may not change the contact", workspace(), false],
    ["a Nevermore support session", workspace({ isSupport: true }), true],
  ])("is not offered to %s", async (_who, ws, canChange) => {
    client.getContactPage.mockResolvedValue(page({ canChange }));
    renderPage("/contacts/c1", ws);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: "Merge with another contact" })).toBeNull();
  });
});

describe("a contact's old address", () => {
  // Catches: a bookmarked contact ending at "not available" after a merge, or leading to the kept contact with no word on why.
  it("leads to the contact it became, with a short note", async () => {
    client.getContactPage.mockImplementation(async (_f: string, id: string) => (id === "c1" ? null : page({}, { id, firstName: "Priya", lastName: "Abel" })));
    merge.resolveMergedRecord.mockResolvedValue({ kind: "contact", id: "c2", name: "Priya Abel", accountId: "a1" });
    renderPage();
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/contacts/c2"));
    expect(merge.resolveMergedRecord).toHaveBeenCalledWith("f1", "contact", "c1");
    expect(await screen.findByRole("status")).toHaveTextContent("merged into Priya Abel");
  });

  // Catches: a contact that was never merged being answered with anything but "not available".
  it("says the contact isn't available when the address was never merged", async () => {
    client.getContactPage.mockResolvedValue(null);
    merge.resolveMergedRecord.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByText("This contact isn't available.")).toBeInTheDocument();
  });
});
