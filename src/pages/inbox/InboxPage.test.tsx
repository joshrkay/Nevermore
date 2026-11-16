import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { InboxRow } from "@/lib/inboxApi";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";

// The inbox (story CRM-E1.4, slice 6.5) on the workspace's table frame. The database lists the messages, runs the views, filters and search and decides who
// sees what (supabase/tests/inbox.sql); these tests are what a person sees and does on the page.
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "dana@example.com", app_metadata: { providers: ["email"] } }, signOut: vi.fn() }) }));
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => ({ status: "none" }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), auth: { mfa: { listFactors: vi.fn() } } } }));
const listInbox = vi.fn();
const countInboxViews = vi.fn();
const openConversation = vi.fn();
vi.mock("@/lib/inboxApi", async (original) => ({
  ...(await original<typeof import("@/lib/inboxApi")>()),
  listInbox: async (opts: { page?: number }) => ({ page: opts.page ?? 1, pageSize: 50, ...(await listInbox(opts)) }),
  countInboxViews: (...a: unknown[]) => countInboxViews(...a),
  openConversation: (...a: unknown[]) => openConversation(...a),
}));
const listFirmMembers = vi.fn();
vi.mock("@/lib/accountsApi", async (original) => ({
  ...(await original<typeof import("@/lib/accountsApi")>()),
  browserTimeZone: () => "America/Los_Angeles",
  listFirmMembers: (...a: unknown[]) => listFirmMembers(...a),
}));

const fetchMyMailbox = vi.fn();
const openQuoteRequestThread = vi.fn();
vi.mock("@/lib/advisorApi", async (original) => ({
  ...(await original<typeof import("@/lib/advisorApi")>()),
  fetchMyMailbox: () => fetchMyMailbox(),
  openQuoteRequestThread: (...a: unknown[]) => openQuoteRequestThread(...a),
}));

const { default: InboxPage } = await import("./InboxPage");

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  firm: { id: "f1", name: "Acme Benefits", address: "acme" }, role: "Agent", isOwner: false, isSupport: false, supportEndsAt: null, supportSessionId: null,
  isPlatformAdmin: false, person: "Dana Reyes", ...over,
});

const row = (over: Partial<InboxRow> = {}): InboxRow => ({
  id: "c:m1", kind: "contact", thread_id: "v1", direction: "received", is_new: true, is_automatic: false, from_address: "lucia@reyes.example",
  from_name: "Lucia Reyes", subject: "Re: hello", first_line: "Thanks, see you Tuesday.", at: "2026-11-10T10:00:00Z", account_id: "a1",
  account_name: "Reyes Bakery", contact_id: "k1", contact_name: "Lucia Reyes", lead_id: null, lead_name: null, peo_name: null, session_id: null,
  owner: "u1", owner_name: "Dana Reyes", ...over,
});

// Which lead's page was opened (slice 8.5: a lead's message opens its page, D-696 as 8.5 changed it).
const LeadAt = () => <p>{`A lead's page, ${useLocation().pathname}`}</p>;

const renderAt = (url = "/inbox", ws: Workspace = workspace()) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkspaceContext.Provider value={ws}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/contacts/:id" element={<p>A contact's page</p>} />
            <Route path="/advisor/submissions/:id" element={<p>A submission's page</p>} />
            <Route path="/leads/:id" element={<LeadAt />} />
          </Routes>
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
const headers = () => within(screen.getByRole("table")).getAllByRole("columnheader").map((h) => h.textContent?.trim()).filter((h) => h && h !== "Actions");

beforeEach(() => {
  for (const fn of [listInbox, countInboxViews, listFirmMembers, fetchMyMailbox, openConversation, openQuoteRequestThread]) fn.mockReset();
  openConversation.mockResolvedValue(undefined);
  openQuoteRequestThread.mockResolvedValue(undefined);
  fetchMyMailbox.mockResolvedValue({ connected: true, provider: "google", address: "dana@acme.example" });
  listInbox.mockResolvedValue({ rows: [row()], total: 1 });
  countInboxViews.mockImplementation(async (_f: string, views: { name: string }[]) => views.map((v) => ({ name: v.name, total: 1 })));
  listFirmMembers.mockResolvedValue([{ value: "u1", label: "Dana Reyes" }]);
});
afterEach(() => cleanup());

describe("the inbox (CRM-E1.4)", () => {
  // Catches: the wrong firm asked, or a row missing who, what it is about (linked), the first line, its kind or when.
  it("lists the firm's messages: who, what it is about with its links, the first line, its kind and when", async () => {
    renderAt();
    expect(await screen.findByText("Thanks, see you Tuesday.")).toBeInTheDocument();
    expect(listInbox.mock.lastCall![0]).toMatchObject({ firmId: "f1", filters: [], page: 1, search: "" });
    expect(screen.getByRole("heading", { level: 1, name: "Inbox" })).toBeInTheDocument();
    expect(headers()).toEqual(["From", "About", "Message", "Kind", "When"]);
    const cells = screen.getByText("Thanks, see you Tuesday.").closest("tr")!;
    expect(within(cells).getByText("Re: hello")).toBeInTheDocument();
    expect(within(cells).getByRole("link", { name: "Reyes Bakery" })).toHaveAttribute("href", "/accounts/a1");
    expect(within(cells).getByRole("link", { name: "Lucia Reyes" })).toHaveAttribute("href", "/contacts/k1");
    expect(within(cells).getByText("From a contact")).toBeInTheDocument();
    expect(within(cells).getByText("Nov 10, 2026")).toBeInTheDocument();
  });

  // Catches: a view the story names left out, or a tab that asks the wrong question (a sent message under From, read mail under New).
  it("offers All, New, From PEOs, From contacts and leads and Sent, each with its count", async () => {
    renderAt();
    await screen.findByText("Thanks, see you Tuesday.");
    for (const name of ["All", "New", "From PEOs", "From contacts and leads", "Sent"]) expect(await screen.findByRole("link", { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    const asked = countInboxViews.mock.lastCall![1] as { name: string; filters: unknown[] }[];
    expect(asked.find((v) => v.name === "new")?.filters).toEqual([{ field: "is_new", op: "is", value: true }]);
    expect(asked.find((v) => v.name === "from_peos")?.filters).toEqual([{ field: "kind", op: "any_of", value: ["peo"] }, { field: "direction", op: "any_of", value: ["received"] }]);
    expect(asked.find((v) => v.name === "from_contacts")?.filters).toEqual([
      { field: "kind", op: "any_of", value: ["contact", "lead"] }, { field: "direction", op: "any_of", value: ["received"] },
    ]);
    expect(asked.find((v) => v.name === "sent")?.filters).toEqual([{ field: "direction", op: "any_of", value: ["sent"] }]);
  });

  // Catches: a blank page while the first rows are on the way (the story's Loading state: headings, views and eight grey rows).
  it("shows its heading, its views and eight grey rows while loading", async () => {
    listInbox.mockReturnValue(new Promise(() => {}));
    const { container } = renderAt();
    expect(screen.getByRole("heading", { level: 1, name: "Inbox" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /^From PEOs/ })).toBeInTheDocument();
    expect(container.querySelectorAll('tbody[aria-busy="true"] tr')).toHaveLength(8);
    expect(headers()).toEqual(["From", "About", "Message", "Kind", "When"]);
  });

  // Catches: a firm with no mail told nothing matches, or left with an empty table and no words.
  it("says what will be listed when there is no mail on any record", async () => {
    listInbox.mockResolvedValue({ rows: [], total: 0 });
    renderAt();
    expect(await screen.findByText("Emails with PEOs, contacts and leads will be listed here")).toBeInTheDocument();
  });

  // Catches: an empty New view said as "no messages match" or as an inbox with no mail at all.
  it("says Nothing new when the New view is empty", async () => {
    listInbox.mockResolvedValue({ rows: [], total: 0 });
    renderAt("/inbox?view=new");
    expect(await screen.findByText("Nothing new")).toBeInTheDocument();
    expect(screen.queryByText("Emails with PEOs, contacts and leads will be listed here")).not.toBeInTheDocument();
  });

  // Catches: another narrowed view that finds nothing said as "nothing new" or as an inbox with no mail.
  it("says no messages match when another view or a search finds none", async () => {
    listInbox.mockResolvedValue({ rows: [], total: 0 });
    renderAt("/inbox?view=sent");
    expect(await screen.findByText(/No messages match/)).toBeInTheDocument();
  });

  // Catches: a person with no mailbox not told they can connect one here, or the banner put in place of the mail (it goes above whatever mail there is).
  it("asks to connect a mailbox, above the mail, when the person has none", async () => {
    fetchMyMailbox.mockResolvedValue({ connected: false });
    renderAt();
    const banner = await screen.findByText("Connect your email to send from here");
    expect(screen.getByText("Thanks, see you Tuesday.")).toBeInTheDocument();
    expect(banner.compareDocumentPosition(screen.getByRole("table")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Microsoft" })).toBeInTheDocument();
  });

  // Catches: the banner nagging a person whose mailbox is connected.
  it("shows no banner to a person whose mailbox is connected", async () => {
    renderAt();
    await screen.findByText("Thanks, see you Tuesday.");
    expect(screen.queryByText("Connect your email to send from here")).not.toBeInTheDocument();
  });

  // Catches: opening a message that leaves its thread marked new for everyone, or that doesn't open it on its record.
  it("opens a contact's message on the contact, clearing its conversation's new mark through the newest message shown", async () => {
    listInbox.mockResolvedValue({ rows: [row({ id: "c:m2", at: "2026-11-11T09:00:00Z", subject: "Newer", first_line: "One more thing." }), row()], total: 2 });
    renderAt();
    await userEvent.click(await screen.findByText("Thanks, see you Tuesday."));
    expect(await screen.findByText("A contact's page")).toBeInTheDocument();
    expect(openConversation).toHaveBeenCalledWith("f1", "v1", "2026-11-11T09:00:00Z");
  });

  // Catches: a PEO's message opened as if it were a conversation (the wrong open function, so its mark stays), or not on the submission that holds the thread.
  it("opens a PEO's message on its submission, clearing the PEO thread's new mark", async () => {
    listInbox.mockResolvedValue({
      rows: [row({ id: "q:9", kind: "peo", thread_id: "7", peo_name: "TriNet", session_id: "s1", contact_id: null, contact_name: null, first_line: "We need the census." })],
      total: 1,
    });
    renderAt();
    await userEvent.click(await screen.findByText("We need the census."));
    expect(await screen.findByText("A submission's page")).toBeInTheDocument();
    expect(openQuoteRequestThread).toHaveBeenCalledWith(7, "2026-11-10T10:00:00Z");
    expect(openConversation).not.toHaveBeenCalled();
  });

  // Catches: a lead's message opened nowhere, on the Leads page now that a lead has a page (slice 8.5), or as a contact's, or its conversation's mark left on.
  it("opens a lead's message on the lead's page, clearing its conversation's new mark", async () => {
    listInbox.mockResolvedValue({
      rows: [row({ id: "c:m5", kind: "lead", thread_id: "v5", lead_id: "l5", lead_name: "Ana Ortiz", contact_id: null, contact_name: null, account_id: null, account_name: "Ortiz Plumbing", first_line: "Call me." })],
      total: 1,
    });
    renderAt();
    await userEvent.click(await screen.findByText("Call me."));
    expect(await screen.findByText("A lead's page, /leads/l5")).toBeInTheDocument();
    expect(openConversation).toHaveBeenCalledWith("f1", "v5", "2026-11-10T10:00:00Z");
  });
});
