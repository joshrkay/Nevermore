import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { LeadPage as Page } from "@/lib/leadPageApi";
import type { ActivityItem } from "@/lib/activityApi";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";

// A lead's page through a faked client (story CRM-L2.1, slice 8.5, screen 15): what a person sees and does. The database's own rules (who may see a lead, who may
// change it, Working, Not a fit and Reopen, the version) are tested in supabase/tests/lead_page.sql; here the client answers and the page draws it.

vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "dana@example.com" }, signOut }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const client = { getLeadPage: vi.fn(), listLeadActivity: vi.fn(), updateLead: vi.fn(), markLeadNotFit: vi.fn(), reopenLead: vi.fn() };
vi.mock("@/lib/leadPageApi", async () => ({ ...(await vi.importActual<object>("@/lib/leadPageApi")), ...client }));
const activity = { logLeadActivity: vi.fn(), updateActivity: vi.fn(), addToNote: vi.fn(), setTaskDone: vi.fn(), getLeadActivityOptions: vi.fn() };
vi.mock("@/lib/activityApi", async () => ({ ...(await vi.importActual<object>("@/lib/activityApi")), ...activity }));
const listFirmMembers = vi.fn();
vi.mock("@/lib/accountsApi", async () => ({ ...(await vi.importActual<object>("@/lib/accountsApi")), listFirmMembers: (...a: unknown[]) => listFirmMembers(...a) }));
const listAccountOwners = vi.fn();
vi.mock("@/lib/accountCreateApi", async () => ({ ...(await vi.importActual<object>("@/lib/accountCreateApi")), listAccountOwners: (...a: unknown[]) => listAccountOwners(...a) }));
const conversations = { getConversation: vi.fn(), getLeadConversation: vi.fn(), sendConversationMessage: vi.fn(), workTheQueue: vi.fn(), listAttachableFiles: vi.fn(), openConversation: vi.fn() };
vi.mock("@/lib/conversationApi", async () => ({ ...(await vi.importActual<object>("@/lib/conversationApi")), ...conversations }));
const fetchMyMailbox = vi.fn();
vi.mock("@/lib/advisorApi", async () => ({ ...(await vi.importActual<object>("@/lib/advisorApi")), fetchMyMailbox: () => fetchMyMailbox() }));

const { default: LeadPage } = await import("./LeadPage");

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  firm: { id: "f1", name: "Acme Benefits", address: "acme" }, role: "Agent", isOwner: false, isSupport: false, supportEndsAt: null, supportSessionId: null,
  isPlatformAdmin: false, person: "Dana Reyes", ...over,
});

const lead = {
  id: "l1", version: 4, name: "Lucia Reyes", title: "Owner" as string | null, business: "Reyes Bakery" as string | null, email: "lucia@reyes.example" as string | null,
  phone: "(503) 555-0142" as string | null, city: "Portland" as string | null, state: "OR" as string | null, employees: 23 as number | null,
  currentProvider: "Gusto" as string | null, note: "Met at the chamber breakfast" as string | null, source: "referral_partner" as const,
  status: "working" as Page["lead"]["status"], notFitReason: null as Page["lead"]["notFitReason"], owner: { id: "u1", name: "Dana Reyes" } as { id: string; name: string } | null,
  createdAt: "2026-11-02T10:00:00+00:00", updatedAt: "2026-11-10T10:00:00+00:00",
};
const page = (over: Partial<Page> = {}, l: Partial<typeof lead> = {}): Page => ({
  lead: { ...lead, ...l }, canChange: true, canAdd: true, inBin: false, canReopen: false,
  stages: { new: "2026-11-02T10:00:00+00:00", working: "2026-11-05T10:00:00+00:00", notFit: null, converted: null },
  converted: null,
  ...over,
});

const item = (over: Partial<ActivityItem> = {}): ActivityItem => ({
  type: "call", id: "x1", entryKey: "x1", at: "2026-11-13T18:30:00+00:00", who: "Dana Reyes", authorId: "u1", contact: null, opportunity: null, outcome: null, title: null,
  body: null, additions: [], assignee: null, dueOn: null, doneAt: null, doneBy: null, canEdit: true, editableUntil: null, ...over, ...(over.id ? { entryKey: over.id } : {}),
});
const call = item({ id: "call1", outcome: "spoke", body: "Wants a quote in January" });
const note = item({ type: "note", id: "note1", at: "2026-11-12T18:30:00+00:00", body: "Owner runs payroll herself", editableUntil: "2026-11-13T18:30:00+00:00" });

const pageOf = <R,>(all: R[], o: { offset?: number; limit?: number } = {}) => ({ count: all.length, rows: all.slice(o.offset ?? 0, (o.offset ?? 0) + (o.limit ?? 50)) });
const serveActivity = (all: ActivityItem[]) => client.listLeadActivity.mockImplementation(async (_f: string, _l: string, o?: { offset?: number; limit?: number }) => pageOf(all, o));

const Where = () => {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
};
let queryClient: QueryClient;
const renderPage = (path = "/leads/l1", ws: Workspace = workspace()) => {
  queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
  const router = createMemoryRouter([{ path: "/leads/:id", element: <><LeadPage /><Where /></> }, { path: "*", element: <Where /> }], { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceContext.Provider value={ws}><RouterProvider router={router} /></WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
  return router;
};

beforeEach(() => {
  for (const fn of [...Object.values(client), ...Object.values(activity), ...Object.values(conversations), listFirmMembers, listAccountOwners, fetchMyMailbox, signOut]) fn.mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  client.getLeadPage.mockResolvedValue(page());
  serveActivity([call, note]);
  conversations.getConversation.mockResolvedValue({ conversationId: null, messages: [], mailbox: { connected: true, lastSendFailed: false } });
  conversations.getLeadConversation.mockResolvedValue({ conversationId: null, messages: [], mailbox: { connected: true, lastSendFailed: false } });
  conversations.listAttachableFiles.mockResolvedValue([]);
  conversations.openConversation.mockResolvedValue(undefined);
  fetchMyMailbox.mockResolvedValue({ connected: true, provider: "google", address: "dana@example.com" });
  listFirmMembers.mockResolvedValue([{ value: "u1", label: "Dana Reyes" }, { value: "u2", label: "Marcus Hale" }]);
  listAccountOwners.mockResolvedValue([{ value: "u1", label: "Dana Reyes" }]);
  activity.getLeadActivityOptions.mockResolvedValue({ contacts: [], opportunities: [], people: [{ id: "u1", name: "Dana Reyes" }] });
});

describe("LeadPage: the header", () => {
  // Catches: a header that leaves out a fact the story names (name, status, business, location, employees, source, owner), or offers Convert before slice 8.6
  // builds it (no button that does nothing).
  it("shows the name, status, business, location, employees, source and owner, with Email, Log a call and Not a fit, and no Convert", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Lucia Reyes" })).toBeInTheDocument();
    const header = screen.getByRole("banner");
    expect(within(header).getByText("Working")).toBeInTheDocument();
    expect(header).toHaveTextContent("Owner at Reyes Bakery");
    expect(header).toHaveTextContent("Portland, OR");
    expect(header).toHaveTextContent("23 employees");
    expect(header).toHaveTextContent("Referral partner");
    expect(header).toHaveTextContent("Owner: Dana Reyes");
    expect(within(header).getByRole("link", { name: /^Email/ })).toHaveAttribute("href", "#emails");
    expect(within(header).getByRole("button", { name: /^Log a call/ })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: /^Not a fit/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Convert/ })).toBeNull();
  });
});

describe("LeadPage: Log a call", () => {
  // Catches: a Log a call that does nothing, logs on anything but this lead, or leaves the header's status as it was after a call made the lead Working.
  it("logs a call on the lead from the header and reads the lead again", async () => {
    const user = userEvent.setup();
    client.getLeadPage.mockResolvedValue(page({ stages: { new: "2026-11-02T10:00:00+00:00", working: null, notFit: null, converted: null } }, { status: "new" }));
    activity.logLeadActivity.mockResolvedValue({ activity: call, followUp: null });
    renderPage();
    await user.click(await screen.findByRole("button", { name: /^Log a call/ }));
    const dialog = await screen.findByRole("dialog", { name: "Log a call" });
    expect(dialog).toHaveTextContent("On Lucia Reyes");
    client.getLeadPage.mockResolvedValue(page());
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(activity.logLeadActivity).toHaveBeenCalledWith("f1", expect.objectContaining({ kind: "call", leadId: "l1", outcome: "spoke" })));
    await waitFor(() => expect(within(screen.getByRole("banner")).getByText("Working")).toBeInTheDocument());
  });
});

describe("LeadPage: Not a fit", () => {
  // Catches: Not a fit without a reason from the short list (CRM-L1.3), sent for another lead, or a page left showing the lead as it was.
  it("asks for a reason from the short list and marks the lead Not a fit", async () => {
    const user = userEvent.setup();
    client.markLeadNotFit.mockResolvedValue({ ...lead, status: "not_fit", notFitReason: "too_small" });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Not a fit" }));
    const dialog = await screen.findByRole("dialog", { name: "Not a fit" });
    const reasons = within(dialog).getAllByRole("radio").map((r) => r.closest("label")?.textContent);
    expect(reasons).toEqual(["Too small", "Wrong industry", "Not interested", "Bad contact details", "Other"]);
    expect(within(dialog).getByRole("button", { name: "Mark Not a fit" })).toBeDisabled();
    await user.click(within(dialog).getByRole("radio", { name: "Too small" }));
    client.getLeadPage.mockResolvedValue(page({ canChange: false, canAdd: false, stages: { ...page().stages, notFit: "2026-11-15T10:00:00+00:00" } }, { status: "not_fit", notFitReason: "too_small" }));
    await user.click(within(dialog).getByRole("button", { name: "Mark Not a fit" }));
    await waitFor(() => expect(client.markLeadNotFit).toHaveBeenCalledWith("f1", "l1", "too_small"));
    expect(toast.success).toHaveBeenCalledWith("Marked Not a fit");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(within(screen.getByRole("banner")).getByText("Not a fit", { selector: "span" })).toBeInTheDocument());
  });
});

describe("LeadPage: the Not a fit banner and Reopen", () => {
  // Catches: a Not a fit lead without its reason on show, with no way back (CRM-L2.1: a banner with the reason and Reopen), or changeable while Not a fit.
  it("shows the reason with Reopen, offers nothing to change, and Reopen reopens the lead", async () => {
    const user = userEvent.setup();
    client.getLeadPage.mockResolvedValue(page({ canChange: false, canAdd: false, canReopen: true, stages: { ...page().stages, notFit: "2026-11-15T10:00:00+00:00" } }, { status: "not_fit", notFitReason: "wrong_industry" }));
    client.reopenLead.mockResolvedValue({ ...lead, status: "working" });
    renderPage();
    const banner = await screen.findByRole("note", { name: "Not a fit" });
    expect(banner).toHaveTextContent("Not a fit since Nov 15, 2026: Wrong industry");
    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Log a call/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Not a fit" })).toBeNull();
    client.getLeadPage.mockResolvedValue(page());
    await user.click(within(banner).getByRole("button", { name: "Reopen" }));
    await waitFor(() => expect(client.reopenLead).toHaveBeenCalledWith("f1", "l1"));
    expect(toast.success).toHaveBeenCalledWith("Lead reopened");
    await waitFor(() => expect(screen.queryByRole("note", { name: "Not a fit" })).toBeNull());
  });
});

describe("LeadPage: the Not a fit banner, read only", () => {
  // Catches (from mutation): Reopen offered to someone the level rule does not let change the lead (the database's can_reopen), which reopen_lead refuses.
  it("offers no Reopen to someone who may only read the lead", async () => {
    client.getLeadPage.mockResolvedValue(page({ canChange: false, canAdd: false, canReopen: false }, { status: "not_fit", notFitReason: "other" }));
    renderPage();
    const banner = await screen.findByRole("note", { name: "Not a fit" });
    expect(within(banner).queryByRole("button", { name: "Reopen" })).toBeNull();
  });
});

describe("LeadPage: the Converted banner", () => {
  // Catches: a converted lead with no way to what it became (CRM-L2.1: a banner linking to the account, contact and opportunity), or one that can still be
  // changed, written to or converted again.
  it("links to what converting made and leaves the page read-only", async () => {
    client.getLeadPage.mockResolvedValue(page({
      canChange: false, canAdd: false, stages: { ...page().stages, converted: "2026-11-15T10:00:00+00:00" },
      converted: { account: { id: "a1", name: "Reyes Bakery" }, contact: { id: "c1", name: "Lucia Reyes" }, opportunity: { id: "o1", name: "Reyes Bakery – PEO search" } },
    }, { status: "converted" }));
    renderPage();
    const banner = await screen.findByRole("note", { name: "Converted" });
    expect(banner).toHaveTextContent("Converted on Nov 15, 2026");
    expect(within(banner).getByRole("link", { name: "Reyes Bakery" })).toHaveAttribute("href", "/accounts/a1");
    expect(within(banner).getByRole("link", { name: "Lucia Reyes" })).toHaveAttribute("href", "/contacts/c1");
    expect(within(banner).getByRole("link", { name: "Reyes Bakery – PEO search" })).toHaveAttribute("href", "/opportunities/o1");
    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Log a call/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /^Email/ })).toBeNull();
    expect(screen.queryByRole("region", { name: "Emails" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Converting makes" })).toBeNull();
  });
});

describe("LeadPage: the emails and the place to write", () => {
  // Catches: a lead's page with no emails or no place to write (CRM-L2.1, D-603), or one that reads or writes another record's conversation.
  it("says No emails yet and writes to the lead from the place to write", async () => {
    const user = userEvent.setup();
    conversations.sendConversationMessage.mockResolvedValue({});
    renderPage();
    const emails = await screen.findByRole("region", { name: "Emails" });
    expect(emails).toHaveAttribute("id", "emails");
    expect(await within(emails).findByText("No emails yet")).toBeInTheDocument();
    expect(conversations.getLeadConversation).toHaveBeenCalledWith("f1", "l1");
    await user.type(within(emails).getByLabelText("Subject"), "Your payroll");
    await user.type(within(emails).getByLabelText("Message"), "Hi Lucia");
    await user.click(within(emails).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(conversations.sendConversationMessage).toHaveBeenCalledWith("f1", { leadId: "l1", subject: "Your payroll", body: "Hi Lucia", inReplyTo: null, documentIds: [] }));
    expect(conversations.listAttachableFiles).not.toHaveBeenCalled();
  });
});

describe("LeadPage: the details, edited in place", () => {
  // Catches: a details panel that leaves out a standard field, or an edit that sends another version than the one the person started from, or leaves the page
  // showing the old values after the save.
  it("shows the lead's own fields and saves a change from the version the person started from", async () => {
    const user = userEvent.setup();
    client.updateLead.mockResolvedValue({ conflict: false, lead: { ...lead, version: 5, employees: 30 } });
    renderPage();
    const details = await screen.findByRole("region", { name: "Details" });
    for (const [label, value] of [["Name", "Lucia Reyes"], ["Title", "Owner"], ["Business", "Reyes Bakery"], ["Email", "lucia@reyes.example"], ["Phone", "(503) 555-0142"],
      ["City", "Portland"], ["State", "OR"], ["Employees", "23"], ["Current provider", "Gusto"], ["Note", "Met at the chamber breakfast"], ["Owner", "Dana Reyes"],
      ["Source", "Referral partner"], ["Added", "Nov 2, 2026"]]) {
      expect(within(details).getByText(label, { selector: "dt" }).nextElementSibling).toHaveTextContent(value);
    }
    await user.click(within(details).getByRole("button", { name: /^Edit/ }));
    const employees = within(details).getByLabelText("Employees");
    await user.clear(employees);
    await user.type(employees, "30");
    // The reload after the save answers what was saved.
    client.getLeadPage.mockResolvedValue(page({}, { version: 5, employees: 30 }));
    await user.click(within(details).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.updateLead).toHaveBeenCalled());
    expect(client.updateLead).toHaveBeenCalledWith("f1", "l1", expect.objectContaining({ name: "Lucia Reyes", employees: "30", ownerId: "u1" }), 4);
    await waitFor(() => expect(within(details).getByText("Employees", { selector: "dt" }).nextElementSibling).toHaveTextContent("30"));
  });
});

describe("LeadPage: Converting makes", () => {
  // Catches: a panel that does not say what converting would make (CRM-L2.1), names the opportunity otherwise than converting will (D-810: "<Business> – PEO
  // search"), or promises a contact for a lead whose name is its business's (D-810: a business and no person converts to an account with no contact).
  it("names the account, the contact and the opportunity converting would make", async () => {
    renderPage();
    const panel = await screen.findByRole("region", { name: "Converting makes" });
    expect(within(panel).getByText("Account", { selector: "dt" }).nextElementSibling).toHaveTextContent("Reyes Bakery");
    expect(within(panel).getByText("Contact", { selector: "dt" }).nextElementSibling).toHaveTextContent("Lucia Reyes");
    expect(within(panel).getByText("Opportunity", { selector: "dt" }).nextElementSibling).toHaveTextContent("Reyes Bakery – PEO search");
  });

  it("makes no contact when the lead names only its business, and an account in the person's name when there is no business", async () => {
    client.getLeadPage.mockResolvedValue(page({}, { name: "Reyes Bakery", title: null }));
    renderPage();
    let panel = await screen.findByRole("region", { name: "Converting makes" });
    expect(within(panel).getByText("Contact", { selector: "dt" }).nextElementSibling).toHaveTextContent("None: no person is named");
    client.getLeadPage.mockResolvedValue(page({}, { business: null }));
    await queryClient.invalidateQueries();
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Lucia Reyes"));
    panel = screen.getByRole("region", { name: "Converting makes" });
    expect(within(panel).getByText("Account", { selector: "dt" }).nextElementSibling).toHaveTextContent("Lucia Reyes");
    expect(within(panel).getByText("Contact", { selector: "dt" }).nextElementSibling).toHaveTextContent("Lucia Reyes");
    expect(within(panel).getByText("Opportunity", { selector: "dt" }).nextElementSibling).toHaveTextContent("Lucia Reyes – PEO search");
  });
});

describe("LeadPage: calls, notes and tasks", () => {
  // Catches: the lead's calls, notes and tasks not shown, shown in another order than the database's (newest first), or asked of another record.
  it("lists the lead's calls, notes and tasks, newest first, as the database answers them", async () => {
    renderPage();
    const panel = await screen.findByRole("region", { name: /Calls, notes and tasks/ });
    const rows = await within(panel).findAllByRole("row");
    expect(rows[1]).toHaveTextContent("Wants a quote in January");
    expect(rows[2]).toHaveTextContent("Owner runs payroll herself");
    expect(client.listLeadActivity).toHaveBeenCalledWith("f1", "l1", expect.objectContaining({ filter: "all", offset: 0 }));
  });

  // Catches: the No activity state without its words or its two ways to start (CRM-L2.1: "Nothing logged yet" with Add a note and Add a task), or a note
  // logged on anything but this lead.
  it("says Nothing logged yet with Add a note and Add a task, and a note is logged on the lead", async () => {
    const user = userEvent.setup();
    serveActivity([]);
    activity.logLeadActivity.mockResolvedValue({ activity: note, followUp: null });
    renderPage();
    const panel = await screen.findByRole("region", { name: /Calls, notes and tasks/ });
    expect(await within(panel).findByText("Nothing logged yet")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Add a task" })).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "Add a note" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a note" });
    expect(within(dialog).queryByLabelText("With")).toBeNull();
    await user.type(within(dialog).getByLabelText("Note"), "Owner runs payroll herself");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(activity.logLeadActivity).toHaveBeenCalledWith("f1", expect.objectContaining({ kind: "note", leadId: "l1", body: "Owner runs payroll herself" })));
    expect(toast.success).toHaveBeenCalledWith("Note added");
  });
});

describe("LeadPage: a Nevermore support session", () => {
  // Catches: buttons offered to support that the database refuses (ADR 0024: support reads, changes nothing), even where the database's own answer says
  // something can be added.
  it("reads the page and offers nothing to change", async () => {
    renderPage("/leads/l1", workspace({ isSupport: true }));
    await screen.findByRole("heading", { level: 1, name: "Lucia Reyes" });
    await screen.findByText("Wants a quote in January");
    for (const name of [/^Log a call/, "Not a fit", /^Edit/, "Add a note"]) expect(screen.queryByRole("button", { name })).toBeNull();
  });
});

describe("LeadPage: the states", () => {
  // Catches: a blank page while loading (CRM-L2.1's Loading state: the header and panel headings with grey lines).
  it("shows the header and each panel's heading with grey lines while the lead is on its way", () => {
    client.getLeadPage.mockReturnValue(new Promise(() => {}));
    renderPage();
    for (const heading of ["Details", "Converting makes", "Emails", "Calls, notes and tasks"]) expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.getAllByRole("status").some((s) => /Loading lead/.test(s.textContent ?? ""))).toBe(true);
  });

  // Catches: a lead that is not there, another firm's, or one the level rule hides (the database gives one answer) drawn as a blank page or said in other words.
  it("says This lead isn't available when there is none to show, with the way back to Leads", async () => {
    client.getLeadPage.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByText(/This lead isn't available/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to all leads" })).toHaveAttribute("href", "/leads");
  });

  // Catches: a load that failed said as a lead that isn't there, with no way to try again.
  it("says the page failed to load, with Try again", async () => {
    const user = userEvent.setup();
    const { ContactError } = await import("@/lib/contactApi");
    client.getLeadPage.mockRejectedValueOnce(new ContactError("failed", "Couldn't load the lead. Try again."));
    renderPage();
    await user.click(await screen.findByRole("button", { name: /Try again/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Lucia Reyes" })).toBeInTheDocument();
  });
});

describe("LeadPage: the status bar", () => {
  // Catches: a status bar without the date each status began, or one that marks the wrong status as the lead's own.
  it("shows New, Working and Converted with the date each began, the lead's own marked", async () => {
    renderPage();
    const bar = await screen.findByRole("list", { name: "Status" });
    const steps = within(bar).getAllByRole("listitem");
    expect(steps.map((s) => s.textContent)).toEqual(["NewNov 2, 2026", "WorkingNov 5, 2026", "ConvertedNot yet"]);
    expect(steps[1]).toHaveAttribute("aria-current", "step");
    expect(steps[0]).not.toHaveAttribute("aria-current");
  });

  // Catches (from mutation): a Not a fit lead's status bar marking a step it is not on (its banner says where it is).
  it("marks no step for a Not a fit lead", async () => {
    client.getLeadPage.mockResolvedValue(page({ canChange: false, canAdd: false }, { status: "not_fit", notFitReason: "other" }));
    renderPage();
    const bar = await screen.findByRole("list", { name: "Status" });
    for (const step of within(bar).getAllByRole("listitem")) expect(step).not.toHaveAttribute("aria-current");
  });
});
