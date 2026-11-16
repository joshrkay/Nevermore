import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { AccountPage as Page } from "@/lib/accountPageApi";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";

// Merging from an account's page (story CRM-S4.3a, screen 37): the possible-duplicate banner with Merge and Keep separate, merging two contacts of the account, and an
// old address that leads to the record it became. The database decides who may merge and what moves (supabase/tests/merge_records.sql); these are what a person sees.
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "dana@example.com" }, signOut: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const client = { getAccountPage: vi.fn(), listAccountTab: vi.fn(), listAccountFiles: vi.fn() };
vi.mock("@/lib/accountPageApi", async () => ({ ...(await vi.importActual<object>("@/lib/accountPageApi")), ...client }));
const merge = { keepAccountSeparate: vi.fn(), resolveMergedRecord: vi.fn(), previewMerge: vi.fn(), mergeAccounts: vi.fn(), mergeContacts: vi.fn() };
vi.mock("@/lib/mergeApi", async () => ({ ...(await vi.importActual<object>("@/lib/mergeApi")), ...merge }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn(), useToast: () => ({ toasts: [] }) }));
vi.mock("@/lib/searchApi", async () => ({ ...(await vi.importActual<object>("@/lib/searchApi")), noteRecentRecord: vi.fn().mockResolvedValue(true) }));

const { default: AccountPage } = await import("./AccountPage");
const { MergeError } = await import("@/lib/mergeApi");

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  firm: { id: "f1", name: "Acme Benefits", address: "acme" }, role: "Agent", isOwner: false, isSupport: false, supportEndsAt: null, supportSessionId: null,
  isPlatformAdmin: false, person: "Dana Reyes", ...over,
});
const contact = (n: number) => ({
  id: `c${n}`, firstName: n === 1 ? "Elena" : "Priya", lastName: n === 1 ? "Marsh" : "Abel", title: null, email: `p${n}@harborview.example`, phone: null, mobile: null, isMain: n === 1, doNotEmail: false,
});
const tabOf = <R,>(rows: R[]) => ({ count: rows.length, rows });
const account = {
  id: "a1", version: 3, name: "Harborview Dental LLC", tradeName: null, website: null, webDomain: null, phone: null, street: null, city: null, state: null, postalCode: null,
  industry: null, employees: null, statesOfOperation: [], currentProvider: null, source: "employer_intake" as const, archivedAt: null,
  createdAt: "2026-10-28T10:00:00+00:00", updatedAt: "2026-11-01T10:00:00+00:00", status: "prospect" as const, owner: { id: "u1", name: "Dana Reyes" }, sourcePartner: null,
  possibleDuplicateOf: { id: "a9", name: "Harborview Dental" } as { id: string | null; name: string | null } | null,
};
const page = (over: Partial<Page["account"]> = {}, canChange = true): Page => ({
  account: { ...account, ...over }, canChange,
  tabs: { contacts: tabOf([contact(1), contact(2)]), opportunities: tabOf([]), quotes: tabOf([]), activity: tabOf([]), files: tabOf([]) },
});
const previewOf = { kind: "account", problem: null, differs: ["name"], kept: { id: "a9", version: 2, name: "Harborview Dental" }, removed: { id: "a1", version: 3, name: "Harborview Dental LLC" }, moves: { contacts: 1 } };

const Where = () => {
  const l = useLocation();
  return <><p data-testid="where">{l.pathname + l.search}</p><p data-testid="state">{JSON.stringify(l.state)}</p></>;
};
const renderPage = (path = "/accounts/a1", ws: Workspace = workspace()) => {
  const router = createMemoryRouter([{ path: "/accounts/:id", element: <><AccountPage /><Where /></> }, { path: "*", element: <Where /> }], { initialEntries: [path] });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } })}>
      <WorkspaceContext.Provider value={ws}><RouterProvider router={router} /></WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
  return router;
};
const banner = () => screen.findByRole("note", { name: "Possible duplicate" });

beforeEach(() => {
  for (const fn of [...Object.values(client), ...Object.values(merge)]) fn.mockReset();
  vi.mocked(toast.success).mockReset();
  client.getAccountPage.mockImplementation(async (_f: string, id: string) => (id === "a1" ? page() : page({ id, name: "Harborview Dental", possibleDuplicateOf: null })));
  client.listAccountTab.mockImplementation(async (_f: string, _a: string, tab: string) => (tab === "contacts" ? tabOf([contact(1), contact(2)]) : tabOf([])));
  client.listAccountFiles.mockResolvedValue(tabOf([]));
  merge.previewMerge.mockResolvedValue(previewOf);
});

describe("the possible-duplicate banner", () => {
  // Catches: a marked account that looks like any other (nothing tells the agent to merge or keep), or the account it may duplicate not named with a link.
  it("names the account it may duplicate, with a link, and offers Merge and Keep separate", async () => {
    renderPage();
    const b = await banner();
    expect(within(b).getByText(/Possible duplicate of/)).toBeInTheDocument();
    expect(within(b).getByRole("link", { name: "Harborview Dental" })).toHaveAttribute("href", "/accounts/a9");
    expect(within(b).getByRole("button", { name: "Merge" })).toBeInTheDocument();
    expect(within(b).getByRole("button", { name: "Keep separate" })).toBeInTheDocument();
  });

  // Catches: a banner on an account with no mark.
  it("shows no banner on an account that is not marked", async () => {
    client.getAccountPage.mockResolvedValue(page({ possibleDuplicateOf: null }));
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("note", { name: "Possible duplicate" })).toBeNull();
  });

  // Catches: Keep separate that does nothing the person can see, or a page still showing the mark after it was cleared.
  it("clears the mark with Keep separate, says so, and asks the page again", async () => {
    const user = userEvent.setup();
    merge.keepAccountSeparate.mockResolvedValue({ record: { id: "a1", version: 4 }, wasDuplicateOf: { id: "a9", name: "Harborview Dental" } });
    renderPage();
    client.getAccountPage.mockResolvedValue(page({ possibleDuplicateOf: null }));
    await user.click(within(await banner()).getByRole("button", { name: "Keep separate" }));
    await waitFor(() => expect(merge.keepAccountSeparate).toHaveBeenCalledWith("f1", "a1"));
    expect(toast.success).toHaveBeenCalledWith("Kept separate from Harborview Dental. The possible-duplicate mark is gone.");
    await waitFor(() => expect(screen.queryByRole("note", { name: "Possible duplicate" })).toBeNull());
  });

  // Catches: a refusal swallowed, so the banner looks as if the mark was cleared.
  it("says the database's words when Keep separate is refused, and keeps the banner", async () => {
    const user = userEvent.setup();
    merge.keepAccountSeparate.mockRejectedValue(new MergeError("notAllowed", "Only the account's owner or a lead can change it.", "42501"));
    renderPage();
    const b = await banner();
    await user.click(within(b).getByRole("button", { name: "Keep separate" }));
    expect(await within(b).findByRole("alert")).toHaveTextContent("Only the account's owner or a lead can change it.");
    expect(toast.success).not.toHaveBeenCalled();
  });

  // Catches: buttons offered to someone who may not change the account, or to Nevermore support (who can only look).
  it.each([
    ["a person who may not change the account", workspace(), false],
    ["a Nevermore support session", workspace({ isSupport: true }), true],
  ])("shows %s the banner but no buttons", async (_who, ws, canChange) => {
    client.getAccountPage.mockResolvedValue(page({}, canChange));
    renderPage("/accounts/a1", ws);
    const b = await banner();
    expect(within(b).getByRole("link", { name: "Harborview Dental" })).toBeInTheDocument();
    expect(within(b).queryByRole("button")).toBeNull();
  });

  // Catches: the name of an account the person may not see leaking, or a Merge offered that could only be refused.
  it("says only that one exists when the other account is not theirs to see, and offers Keep separate alone", async () => {
    client.getAccountPage.mockResolvedValue(page({ possibleDuplicateOf: { id: null, name: null } }));
    renderPage();
    const b = await banner();
    expect(within(b).getByText("an account you can't see")).toBeInTheDocument();
    expect(within(b).queryByRole("button", { name: "Merge" })).toBeNull();
    expect(within(b).getByRole("button", { name: "Keep separate" })).toBeInTheDocument();
  });

  // Catches: the merge opened with the marked (newer) account kept, or the two records asked for the wrong way round, or the person left on a page that is gone.
  it("merges into the account it may duplicate, then opens that account", async () => {
    const user = userEvent.setup();
    merge.mergeAccounts.mockResolvedValue({
      record: { id: "a9", version: 3 }, removed: { id: "a1", name: "Harborview Dental LLC" }, moved: { contacts: 1, contactsMerged: 0, opportunities: 0, activities: 0, placements: 0, renewals: 0, labels: 0 },
    });
    renderPage();
    await user.click(within(await banner()).getByRole("button", { name: "Merge" }));
    await screen.findByRole("group", { name: "Which value to keep" });
    expect(merge.previewMerge).toHaveBeenCalledWith("f1", "account", "a9", "a1");
    await user.click(screen.getByRole("button", { name: "Merge" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/accounts/a9"));
    expect(merge.mergeAccounts).toHaveBeenCalledWith("f1", "a9", "a1", { name: "kept" }, { kept: 2, removed: 3 });
  });
});

describe("an old address", () => {
  // Catches: an address in a bookmark or an email ending at "not available" after a merge, or leading there without saying why the page differs.
  it("leads to the record it became, with a short note", async () => {
    client.getAccountPage.mockImplementation(async (_f: string, id: string) => (id === "a1" ? null : page({ id, name: "Harborview Dental", possibleDuplicateOf: null })));
    merge.resolveMergedRecord.mockResolvedValue({ kind: "account", id: "a9", name: "Harborview Dental", accountId: null });
    renderPage();
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/accounts/a9"));
    expect(merge.resolveMergedRecord).toHaveBeenCalledWith("f1", "account", "a1");
    expect(await screen.findByRole("status")).toHaveTextContent("merged into Harborview Dental");
  });

  // Catches: an account that never existed (or is not the person's) being answered with anything but "not available".
  it("says the account isn't available when the address was never merged", async () => {
    client.getAccountPage.mockResolvedValue(null);
    merge.resolveMergedRecord.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByText("This account isn't available.")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/accounts/a1");
  });

  // Catches: a failing lookup leaving the page loading for ever.
  it("says the account isn't available when the lookup fails", async () => {
    client.getAccountPage.mockResolvedValue(null);
    merge.resolveMergedRecord.mockRejectedValue(new MergeError("failed", "Couldn't look that record up. Try again."));
    renderPage();
    expect(await screen.findByText("This account isn't available.")).toBeInTheDocument();
  });

  // Catches: the lookup asked for a page that loaded fine.
  it("does not ask where an account that is there leads", async () => {
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(merge.resolveMergedRecord).not.toHaveBeenCalled();
  });
});

describe("merging two contacts of the account", () => {
  // Catches: no way in from the contacts list, a choice of any contact but the account's own, or the dialog asked about the wrong pair.
  it("picks the other contact, then shows the choice for the pair", async () => {
    const user = userEvent.setup();
    client.getAccountPage.mockResolvedValue(page({ possibleDuplicateOf: null }));
    merge.previewMerge.mockResolvedValue({
      kind: "contact", problem: null, differs: ["title"],
      kept: { id: "c1", version: 1, first_name: "Elena", last_name: "Marsh", title: null }, removed: { id: "c2", version: 1, first_name: "Priya", last_name: "Abel", title: "Controller" }, moves: { activities: 0, opportunities_main_contact_of: 0 },
    });
    renderPage("/accounts/a1?tab=contacts");
    await user.click(await screen.findByRole("button", { name: "Merge Elena Marsh with another contact" }));
    const pick = await screen.findByRole("dialog", { name: /Merge Elena Marsh with another contact/ });
    expect(within(pick).queryByRole("radio", { name: /Elena Marsh/ })).toBeNull();
    await user.click(within(pick).getByRole("button", { name: "Continue" }));
    expect(await within(pick).findByRole("alert")).toHaveTextContent("Choose the contact to merge with.");
    await user.click(within(pick).getByRole("radio", { name: /Priya Abel/ }));
    await user.click(within(pick).getByRole("button", { name: "Continue" }));
    await screen.findByRole("group", { name: "Which value to keep" });
    expect(merge.previewMerge).toHaveBeenCalledWith("f1", "contact", "c1", "c2");
  });

  // Catches: a contact merge offered where the person may not change the account (or Nevermore support).
  it("is not offered to someone who may not change the account", async () => {
    client.getAccountPage.mockResolvedValue(page({ possibleDuplicateOf: null }, false));
    renderPage("/accounts/a1?tab=contacts");
    await screen.findByRole("table", { name: "The account's contacts" });
    expect(screen.queryByRole("button", { name: /with another contact/ })).toBeNull();
  });
});
