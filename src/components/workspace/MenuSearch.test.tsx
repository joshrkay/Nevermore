import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { WorkspaceContext, type Workspace } from "./workspaceContext";

// The search box in the menu (story CRM-S1.2a) through a faked client: what a person sees and does. Who is found and what is searched are the database's
// (supabase/tests/search_everywhere.sql); here the client answers and the box draws it.

vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
const auth = vi.hoisted(() => ({ signOut: vi.fn(), userId: "u1" }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: auth.userId, email: "dana@example.com" }, signOut: auth.signOut }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const client = { searchRecords: vi.fn(), myRecentRecords: vi.fn() };
vi.mock("@/lib/searchApi", async () => ({ ...(await vi.importActual<object>("@/lib/searchApi")), ...client }));
const create = { createAccount: vi.fn(), listAccountOwners: vi.fn() };
vi.mock("@/lib/accountCreateApi", async () => ({ ...(await vi.importActual<object>("@/lib/accountCreateApi")), ...create }));

const { default: MenuSearch, MENU_SEARCH_DELAY_MS } = await import("./MenuSearch");

const workspace: Workspace = {
  firm: { id: "f1", name: "Acme Benefits", address: "acme" }, role: "Agent", isOwner: false, isSupport: false, supportEndsAt: null, supportSessionId: null,
  isPlatformAdmin: false, person: "Dana Reyes",
};
const account = { kind: "account" as const, id: "a1", name: "Harborview Dental Group", tradeName: "Harborview Dental", webDomain: "harborview.example", phone: null, city: "Portland", state: "OR", archived: false };
const contact = { kind: "contact" as const, id: "c1", name: "Elena Marsh", title: "Practice Manager", email: "elena@harborview.example", phone: null, accountId: "a1", accountName: "Harborview Dental Group", archived: false };
const opportunity = { kind: "opportunity" as const, id: "o1", name: "Harborview 2027 search", stage: "in_market", fileId: "EAA-1", submissionId: "i1", accountId: "a1", accountName: "Harborview Dental Group", archived: false };
const lonely = { ...opportunity, id: "o2", name: "Harborview with no intake", submissionId: null };
const quote = { kind: "quote" as const, id: "7", peoName: "Paychex Prime", status: "sent", fileId: "EAA-1", submissionId: "i1", opportunityId: "o1", opportunityName: "Harborview 2027 search", accountId: "a1", accountName: "Harborview Dental Group", archived: false };
const none = { rows: [], more: false };
const found = (over: object = {}) => ({ query: "harbor", accounts: { rows: [account], more: false }, contacts: { rows: [contact], more: false }, opportunities: { rows: [opportunity], more: false }, quotes: { rows: [quote], more: false }, ...over });

const Where = () => {
  const l = useLocation();
  return <span data-testid="where">{l.pathname + l.search}</span>;
};
const renderBox = (over: Partial<Workspace> = {}, queries = new QueryClient()) => render(
  <QueryClientProvider client={queries}>
    <WorkspaceContext.Provider value={{ ...workspace, ...over }}>
      <MemoryRouter initialEntries={["/accounts"]}>
        <SidebarProvider>
          <Routes><Route path="*" element={<><MenuSearch /><Where /></>} /></Routes>
        </SidebarProvider>
      </MemoryRouter>
    </WorkspaceContext.Provider>
  </QueryClientProvider>,
);
const box = () => screen.getByRole("searchbox", { name: /search/i });
const results = () => screen.getByRole("region", { name: "Search results" });
const pause = () => act(async () => { await new Promise((r) => setTimeout(r, MENU_SEARCH_DELAY_MS + 50)); });

beforeEach(() => {
  client.searchRecords.mockReset().mockResolvedValue(found());
  client.myRecentRecords.mockReset().mockResolvedValue([]);
  create.createAccount.mockReset();
  auth.signOut.mockReset();
  auth.userId = "u1";
  create.listAccountOwners.mockReset().mockResolvedValue([]);
});
afterEach(() => cleanup());

describe("the menu's search box: nothing typed", () => {
  it("shows the last opened records, each opening its record", async () => {
    client.myRecentRecords.mockResolvedValue([{ ...contact, openedAt: "2026-11-14T10:00:00Z" }, { ...account, openedAt: "2026-11-13T10:00:00Z" }]);
    const user = userEvent.setup();
    renderBox();
    await user.click(box());
    const list = await within(results()).findByRole("list");
    expect(within(list).getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/contacts/c1", "/accounts/a1"]);
    expect(within(list).getByText("Elena Marsh")).toBeInTheDocument();
    expect(client.myRecentRecords).toHaveBeenCalledWith("f1");
    expect(client.searchRecords).not.toHaveBeenCalled();
  });

  it("says so when nothing has been opened yet", async () => {
    const user = userEvent.setup();
    renderBox();
    await user.click(box());
    expect(await within(results()).findByText(/nothing opened yet/i)).toBeInTheDocument();
  });

  it("says when the recent records can't be loaded", async () => {
    client.myRecentRecords.mockRejectedValue(new Error("down"));
    const user = userEvent.setup();
    renderBox();
    await user.click(box());
    expect(await within(results()).findByRole("alert")).toHaveTextContent("Couldn't load your recent records.");
  });

  it("shows the recent records again for one character, which is too short to search", async () => {
    const user = userEvent.setup();
    renderBox();
    await user.type(box(), "h");
    await pause();
    expect(client.searchRecords).not.toHaveBeenCalled();
    expect(await within(results()).findByText(/nothing opened yet/i)).toBeInTheDocument();
  });
});

describe("the menu's search box: typing", () => {
  it("shows the records found in groups, each name opening its record", async () => {
    const user = userEvent.setup();
    renderBox();
    await user.type(box(), "harbor");
    await pause();
    expect(client.searchRecords).toHaveBeenCalledTimes(1);
    expect(client.searchRecords).toHaveBeenCalledWith("f1", "harbor");
    for (const name of ["Accounts", "Contacts", "Opportunities", "Quotes"]) expect(await within(results()).findByRole("region", { name })).toBeInTheDocument();
    const link = (name: string) => within(results()).getByRole("link", { name: new RegExp(`^${name}`) }).getAttribute("href");
    expect(link("Harborview Dental Group")).toBe("/accounts/a1");
    expect(link("Elena Marsh")).toBe("/contacts/c1");
    expect(link("Harborview 2027 search")).toBe("/advisor/submissions/i1");
    expect(link("Paychex Prime")).toBe("/advisor/submissions/i1");
  });

  it("waits for a pause in typing, and asks once for the words", async () => {
    const user = userEvent.setup();
    renderBox();
    await user.type(box(), "harbor view");
    expect(client.searchRecords).not.toHaveBeenCalled();
    await pause();
    expect(client.searchRecords).toHaveBeenCalledTimes(1);
    expect(client.searchRecords).toHaveBeenCalledWith("f1", "harbor view");
  });

  it("leaves an opportunity with no intake as plain text, as the pages do until it has a page (D-187)", async () => {
    client.searchRecords.mockResolvedValue(found({ accounts: none, contacts: none, quotes: none, opportunities: { rows: [lonely], more: false } }));
    const user = userEvent.setup();
    renderBox();
    await user.type(box(), "harbor");
    await pause();
    expect(await within(results()).findByText("Harborview with no intake")).toBeInTheDocument();
    expect(within(results()).queryByRole("link", { name: /no intake/ })).not.toBeInTheDocument();
  });

  it("marks a record of an archived account", async () => {
    client.searchRecords.mockResolvedValue(found({ accounts: { rows: [{ ...account, archived: true }], more: false }, contacts: none, opportunities: none, quotes: none }));
    const user = userEvent.setup();
    renderBox();
    await user.type(box(), "harbor");
    await pause();
    expect(await within(results()).findByText("Archived")).toBeInTheDocument();
  });

  it("offers See all for accounts when there are more than five, opening the Accounts table with the search", async () => {
    client.searchRecords.mockResolvedValue(found({ accounts: { rows: [account], more: true }, contacts: { rows: [contact], more: true } }));
    const user = userEvent.setup();
    renderBox();
    await user.type(box(), "harbor");
    await pause();
    const all = await within(results()).findByRole("link", { name: "See all accounts" });
    expect(all.getAttribute("href")).toBe("/accounts?q=harbor");
    // Contacts, opportunities and quotes have no table of their own yet (D-240): no See all that goes nowhere.
    expect(within(results()).queryByRole("link", { name: /see all contacts/i })).not.toBeInTheDocument();
    await user.click(all);
    expect(screen.getByTestId("where")).toHaveTextContent("/accounts?q=harbor");
  });

  it("offers no See all for five or fewer", async () => {
    const user = userEvent.setup();
    renderBox();
    await user.type(box(), "harbor");
    await pause();
    await within(results()).findByRole("region", { name: "Accounts" });
    expect(within(results()).queryByRole("link", { name: /see all/i })).not.toBeInTheDocument();
  });

  it("ends the search when a record is chosen", async () => {
    const user = userEvent.setup();
    renderBox();
    await user.type(box(), "harbor");
    await pause();
    await user.click(await within(results()).findByRole("link", { name: /Elena Marsh/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/contacts/c1");
    expect(box()).toHaveValue("");
    expect(screen.queryByRole("region", { name: "Search results" })).not.toBeInTheDocument();
  });

  it("says when the search can't be answered, in the database's words", async () => {
    const { SearchError } = await import("@/lib/searchApi");
    client.searchRecords.mockRejectedValue(new SearchError("You don't have access to this firm's records.", "42501"));
    const user = userEvent.setup();
    renderBox();
    await user.type(box(), "harbor");
    await pause();
    expect(await within(results()).findByRole("alert")).toHaveTextContent("You don't have access to this firm's records.");
  });

  it("closes the results on Escape", async () => {
    const user = userEvent.setup();
    renderBox();
    await user.click(box());
    await within(results()).findByText(/nothing opened yet/i);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Search results" })).not.toBeInTheDocument();
  });
});

describe("the menu's search box: nothing matches", () => {
  const empty = { query: "zzzz", accounts: none, contacts: none, opportunities: none, quotes: none };

  it("says Nothing matches and offers New account", async () => {
    client.searchRecords.mockResolvedValue(empty);
    const user = userEvent.setup();
    renderBox();
    await user.type(box(), "zzzz");
    await pause();
    expect(await within(results()).findByText("Nothing matches")).toBeInTheDocument();
    expect(within(results()).getByRole("button", { name: "New account" })).toBeInTheDocument();
  });

  it("opens the New account form with what was typed as the name, and opens the account made", async () => {
    client.searchRecords.mockResolvedValue({ ...empty, query: "Zed Roofing" });
    create.createAccount.mockResolvedValue({ id: "a9", name: "Zed Roofing" });
    const user = userEvent.setup();
    renderBox();
    await user.type(box(), "Zed Roofing");
    await pause();
    await user.click(await within(results()).findByRole("button", { name: "New account" }));
    const dialog = await screen.findByRole("dialog", { name: "New account" });
    expect(within(dialog).getByLabelText(/Account name/)).toHaveValue("Zed Roofing");
    await user.click(within(dialog).getByRole("button", { name: "Save account" }));
    await waitFor(() => expect(create.createAccount).toHaveBeenCalledWith("f1", expect.objectContaining({ name: "Zed Roofing" })));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/accounts/a9"));
  });

  it("does not say Nothing matches while the search is still out, or for something found", async () => {
    let answer: (v: unknown) => void = () => undefined;
    client.searchRecords.mockReturnValue(new Promise((r) => { answer = r; }));
    const user = userEvent.setup();
    renderBox();
    await user.type(box(), "harbor");
    await pause();
    expect(within(results()).getByText("Searching…")).toBeInTheDocument();
    expect(within(results()).queryByText("Nothing matches")).not.toBeInTheDocument();
    await act(async () => answer(found()));
    expect(await within(results()).findByRole("region", { name: "Accounts" })).toBeInTheDocument();
    expect(within(results()).queryByText("Nothing matches")).not.toBeInTheDocument();
  });
});

describe("the menu's search box: review fixes", () => {
  it("Escape empties and closes the search, so focusing again starts afresh", async () => {
    const user = userEvent.setup();
    renderBox();
    await user.type(box(), "harbor");
    await pause();
    await within(results()).findByText("Harborview Dental Group");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Search results" })).not.toBeInTheDocument();
    expect(box()).toHaveValue("");
  });

  it("a click elsewhere empties the search too", async () => {
    const user = userEvent.setup();
    renderBox();
    await user.type(box(), "harbor");
    await user.click(screen.getByTestId("where"));
    expect(box()).toHaveValue("");
  });

  it("offers no New account in a read-only support session", async () => {
    client.searchRecords.mockResolvedValue(found({ query: "zzz", accounts: none, contacts: none, opportunities: none, quotes: none }));
    const user = userEvent.setup();
    renderBox({ isSupport: true });
    await user.type(box(), "zzz");
    await pause();
    expect(await within(results()).findByText("Nothing matches")).toBeInTheDocument();
    expect(within(results()).queryByRole("button", { name: "New account" })).not.toBeInTheDocument();
  });

  it("signs the person out when the search says the session has ended", async () => {
    const { SearchError } = await import("@/lib/searchApi");
    client.searchRecords.mockRejectedValue(new SearchError("Your session has ended.", "PGRST301", true));
    const user = userEvent.setup();
    renderBox();
    await user.type(box(), "harbor");
    await pause();
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledWith("expired"));
  });

  it("searches at most the 200 characters the database keeps, and shows its answer", async () => {
    const long = "h".repeat(250);
    client.searchRecords.mockImplementation(async (_f: string, q: string) => found({ query: q }));
    const user = userEvent.setup();
    renderBox();
    await user.click(box());
    await user.paste(long);
    await pause();
    await waitFor(() => expect(client.searchRecords).toHaveBeenCalledWith("f1", "h".repeat(200)));
    expect(await within(results()).findByText("Harborview Dental Group")).toBeInTheDocument();
  });
});

describe("the menu's search box: who is signed in", () => {
  it("never shows one person's recent records or results to the next person in the same tab (the cache is kept per person)", async () => {
    const queries = new QueryClient();
    client.myRecentRecords.mockResolvedValue([{ ...account, openedAt: "2026-11-13T10:00:00Z" }]);
    const first = userEvent.setup();
    const one = renderBox({}, queries);
    await first.click(box());
    await within(results()).findByText("Harborview Dental Group");
    one.unmount();

    auth.userId = "u2";
    let release: (rows: object[]) => void = () => {};
    client.myRecentRecords.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    const second = userEvent.setup();
    renderBox({}, queries);
    await second.click(box());
    expect(within(results()).queryByText("Harborview Dental Group")).not.toBeInTheDocument();
    release([]);
    await within(results()).findByText(/nothing opened yet/i);
  });

  it("counts an emoji as one character, as the database does", async () => {
    const user = userEvent.setup();
    renderBox();
    await user.type(box(), "\u{1F600}");
    await pause();
    expect(client.searchRecords).not.toHaveBeenCalled();
    await user.type(box(), "\u{1F600}");
    await pause();
    await waitFor(() => expect(client.searchRecords).toHaveBeenCalledWith("f1", "\u{1F600}\u{1F600}"));
  });
});
