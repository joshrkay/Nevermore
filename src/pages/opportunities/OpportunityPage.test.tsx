import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setSignedInUser } from "@/lib/signedInUser";
import type { OpportunityActivityRow, OpportunityConflict, OpportunityPage as Page } from "@/lib/opportunityPageApi";
import type { ActivityItem } from "@/lib/activityApi";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import { toast } from "sonner";
import { allStatuses, expectStatusesOutsideBusy, spoken } from "@/test/loading";
import { OPPORTUNITY_SOURCES } from "@/data/opportunityFields";

// The opportunity's page through a faked client (story CRM-O1.1b, screen 19): what a person sees and does. The database's own rules (who may see an opportunity,
// who may change it, the version, the stage) are tested in supabase/tests/opportunity_page.sql; here the client answers and the page draws it.

vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "dana@example.com" }, signOut }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const client = {
  getOpportunityPage: vi.fn(), listOpportunityActivity: vi.fn(), updateOpportunity: vi.fn(), getOpportunityOutcome: vi.fn(), markOpportunityWon: vi.fn(), markOpportunityLost: vi.fn(),
  reopenOpportunity: vi.fn(), recordCommissionPayment: vi.fn(), updateCommissionPayment: vi.fn(), deleteCommissionPayment: vi.fn(), setPlacementCommission: vi.fn(),
};
vi.mock("@/lib/opportunityPageApi", async () => ({ ...(await vi.importActual<object>("@/lib/opportunityPageApi")), ...client }));
const activity = { logActivity: vi.fn(), updateActivity: vi.fn(), addToNote: vi.fn(), setTaskDone: vi.fn(), getActivityOptions: vi.fn() };
vi.mock("@/lib/activityApi", async () => ({ ...(await vi.importActual<object>("@/lib/activityApi")), ...activity }));
const listFirmMembers = vi.fn();
vi.mock("@/lib/accountsApi", async () => ({ ...(await vi.importActual<object>("@/lib/accountsApi")), listFirmMembers: (...a: unknown[]) => listFirmMembers(...a) }));
const listAccountOwners = vi.fn();
vi.mock("@/lib/accountCreateApi", async () => ({ ...(await vi.importActual<object>("@/lib/accountCreateApi")), listAccountOwners: (...a: unknown[]) => listAccountOwners(...a) }));
const accountTab = { listAccountTab: vi.fn() };
vi.mock("@/lib/accountPageApi", async () => ({ ...(await vi.importActual<object>("@/lib/accountPageApi")), ...accountTab }));
const peoSend = { loadPeoSendContext: vi.fn(), sendToPeo: vi.fn() };
vi.mock("@/lib/peoSendApi", async () => ({ ...(await vi.importActual<object>("@/lib/peoSendApi")), ...peoSend }));
const peoAuthorizations = { loadPeoAuthorizations: vi.fn() };
vi.mock("@/lib/peoAuthorizationsApi", async () => ({ ...(await vi.importActual<object>("@/lib/peoAuthorizationsApi")), ...peoAuthorizations }));
const peoRegistrations = { loadRegisteredElsewhere: vi.fn() };
vi.mock("@/lib/peoRegistrationsApi", async () => ({ ...(await vi.importActual<object>("@/lib/peoRegistrationsApi")), ...peoRegistrations }));
const search = { noteRecentRecord: vi.fn() };
vi.mock("@/lib/searchApi", async () => ({ ...(await vi.importActual<object>("@/lib/searchApi")), ...search }));

// What "Still needs" reads, as the submission's page reads it: the submission (its last certified version) and the PEOs' requirement profiles.
const advisor = { loadSubmission: vi.fn(), fetchMyMailbox: vi.fn() };
const conversations = { getConversation: vi.fn(), sendConversationMessage: vi.fn(), workTheQueue: vi.fn(), listAttachableFiles: vi.fn(), getAccountMessages: vi.fn() };
vi.mock("@/lib/conversationApi", async () => ({ ...(await vi.importActual<object>("@/lib/conversationApi")), ...conversations }));
vi.mock("@/lib/advisorApi", async () => ({ ...(await vi.importActual<object>("@/lib/advisorApi")), ...advisor }));
let peoCatalogRows: unknown = [];
vi.mock("@/lib/peoCatalog", async () => {
  const { parsePeoCatalog } = await import("@/data/peoProfiles");
  return { readPeoCatalog: async () => parsePeoCatalog(await peoCatalogRows) };
});

const { default: OpportunityPage } = await import("./OpportunityPage");
const { OpportunityError } = await import("@/lib/opportunityPageApi");

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  firm: { id: "f1", name: "Acme Benefits", address: "acme" }, role: "Agent", isOwner: false, isSupport: false, supportEndsAt: null, supportSessionId: null,
  isPlatformAdmin: false, person: "Dana Reyes", ...over,
});

const opportunity = {
  id: "o1", version: 4, accountId: "a1", ownerId: "u1", name: "January 2027 PEO search", targetStart: "2027-01-01", employees: 45, mainContactId: "c1",
  expectedClose: "2026-12-12", value: 7100 as number | null, source: "Referral" as string | null, referralPartner: null as { code: string; name: string } | null, nextStep: "Send PEO B the loss run" as string | null, submissionId: "i1" as string | null,
  createdAt: "2026-10-21T10:00:00+00:00", updatedAt: "2026-11-11T10:00:00+00:00", stage: "in_market" as Page["opportunity"]["stage"],
};
const intake = {
  submissionId: "i1", fileId: "EAA-2026-0117", pipelineStatus: "sent_to_carrier" as string | null, certifiedBy: "Elena Marsh" as string | null, certifiedAt: "2026-10-28T10:00:00+00:00" as string | null,
  version: 2 as number | null, censusSize: 45 as number | null, answered: null as number | null, prospectName: null as string | null,
  openItems: { count: 1, firstLabel: "Loss run for 2024" as string | null, firstField: "loss_run" as string | null },
};
const page = (over: Partial<Page> = {}, o: Partial<typeof opportunity> = {}): Page => ({
  opportunity: { ...opportunity, ...o },
  account: { id: "a1", name: "Harborview Dental Group", archived: false },
  owner: { id: "u1", name: "Dana Reyes" },
  mainContact: { id: "c1", name: "Elena Marsh" },
  canChange: true,
  canAdd: true,
  quotes: [],
  intake,
  contacts: [{ id: "c1", name: "Elena Marsh", title: "Practice Manager", email: "elena@harborview.example", phone: "(503) 555-0142", main: true, fillsInIntake: true }],
  ...over,
});

const noOutcome = { lostReason: null, lostNote: null, placement: null, payments: [], receivedToDate: 0, quotes: {} };

/** The top of the page: the name, the facts, the stage bar and what would move it on. */
const header = () => screen.getByRole("heading", { level: 1 }).closest("header") as HTMLElement;

const Where = () => {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
};
let queryClient: QueryClient;
const renderPage = (path = "/opportunities/o1", ws: Workspace = workspace()) => {
  queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
  const router = createMemoryRouter([{ path: "/opportunities/:id", element: <><OpportunityPage /><Where /></> }, { path: "*", element: <Where /> }], { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceContext.Provider value={ws}><RouterProvider router={router} /></WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
  return router;
};

beforeEach(() => {
  // The app's identity boundary says who is signed in; this page renders without it.
  setSignedInUser("u1");
  for (const fn of [...Object.values(client), ...Object.values(advisor), ...Object.values(conversations), ...Object.values(peoSend), ...Object.values(peoAuthorizations), ...Object.values(peoRegistrations), ...Object.values(activity), listFirmMembers, listAccountOwners, search.noteRecentRecord, signOut]) fn.mockReset();
  peoCatalogRows = [];
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  listFirmMembers.mockResolvedValue([{ value: "u1", label: "Dana Reyes" }, { value: "u2", label: "Marcus Hale" }]);
  listAccountOwners.mockResolvedValue([{ value: "u1", label: "Dana Reyes" }]);
  activity.getActivityOptions.mockResolvedValue({
    contacts: [{ id: "c1", name: "Elena Marsh", title: null }], opportunities: [{ id: "o1", name: "January 2027 PEO search" }, { id: "o2", name: "Another search" }], people: [{ id: "u1", name: "Dana Reyes" }],
  });
  client.getOpportunityPage.mockResolvedValue(page());
  client.listOpportunityActivity.mockResolvedValue({ count: 0, rows: [] });
  client.getOpportunityOutcome.mockResolvedValue(noOutcome);
  search.noteRecentRecord.mockResolvedValue(true);
  advisor.fetchMyMailbox.mockResolvedValue({ connected: true, provider: "google", address: "dana@example.com" });
  conversations.getConversation.mockResolvedValue({ conversationId: null, messages: [], mailbox: { connected: true, lastSendFailed: false } });
  conversations.listAttachableFiles.mockResolvedValue([]);
  conversations.getAccountMessages.mockResolvedValue([]);
  accountTab.listAccountTab.mockResolvedValue({ count: 0, rows: [] });
  peoSend.loadPeoSendContext.mockResolvedValue({ mailbox: { connected: true, address: "dana@example.com" }, contacts: [], reply_address: null });
  peoAuthorizations.loadPeoAuthorizations.mockResolvedValue([]);
  peoRegistrations.loadRegisteredElsewhere.mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

describe("OpportunityPage: the menu's recent records", () => {
  // Catches: an opportunity that never reaches the search box's "last five opened" because its page does not note it (D-620).
  it("notes the opportunity as opened once its page has loaded, once", async () => {
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(search.noteRecentRecord).toHaveBeenCalledWith("f1", "opportunity", "o1"));
    expect(search.noteRecentRecord).toHaveBeenCalledTimes(1);
  });

  // Catches: a note sent for a page that isn't there, or a failing note that stops the page (a convenience, never a reason to interrupt, D-620).
  it("notes nothing for a page that isn't there, and shows the page whatever the note does", async () => {
    client.getOpportunityPage.mockResolvedValue(null);
    renderPage();
    await screen.findByText(/isn.t available/);
    expect(search.noteRecentRecord).not.toHaveBeenCalled();
  });

  // Catches: a failed note of the recent records (a convenience, D-620) taking the page down with it.
  it("is not stopped by a failing note", async () => {
    search.noteRecentRecord.mockRejectedValue(new Error("down"));
    renderPage();
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});

describe("OpportunityPage: the trail and the header", () => {
  // Catches: a trail that does not lead back through the account (D-430).
  it("leads back by a trail: Accounts / the account / the opportunity", async () => {
    renderPage();
    const trail = await screen.findByRole("navigation", { name: "Breadcrumb" });
    expect(within(trail).getByRole("link", { name: "Accounts" })).toHaveAttribute("href", "/accounts");
    expect(within(trail).getByRole("link", { name: "Harborview Dental Group" })).toHaveAttribute("href", "/accounts/a1");
    expect(within(trail).getByText("January 2027 PEO search")).toHaveAttribute("aria-current", "page");
  });

  // Catches: a header that leaves out a fact D-431 names (name, stage, target start, employees, main contact, owner).
  it("shows the name, the stage, the target start, the employees, the main contact and the owner", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "January 2027 PEO search" })).toBeInTheDocument();
    expect(within(header()).getByText("In market", { selector: "span.inline-flex" })).toBeInTheDocument();
    const line = within(header()).getByText(/Target start/).closest("p") as HTMLElement;
    expect(line).toHaveTextContent("Target start Jan 1, 2027 · 45 employees · Main contact Elena Marsh · Owner Dana Reyes");
  });

  // Catches: a header that says "undefined" or an empty fact for what an opportunity has not got, or a main contact name that is not a link.
  it("leaves out what the opportunity has not got, and says it has no owner", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ owner: null, mainContact: null }, { targetStart: null, employees: null }));
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    const line = within(header()).getByText(/No owner/).closest("p") as HTMLElement;
    expect(line).toHaveTextContent("No main contact · No owner");
    expect(line).not.toHaveTextContent(/Target start|employees/);
  });

  // Catches: a "Send to a PEO" drawn in the header (D-1700: Choose PEOs is on the quotes panel, and Email is tested below).
  it("has no Send to a PEO in the header", async () => {
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(within(header()).queryByRole("button", { name: /Send to/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Send to/ })).toBeNull();
  });
});

describe("OpportunityPage: the stage bar", () => {
  const bar = () => screen.getByRole("list", { name: "Stage" });
  const labels = () => within(bar()).getAllByRole("listitem").map((li) => li.textContent?.replace(" (done)", ""));

  // Catches: a bar that shows the wrong places (D-415: the first five, then Won, or Lost for a lost one).
  it("shows the first five stages and Won in the last place, the current one marked", async () => {
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(labels()).toEqual(["Qualifying", "Intake under way", "Ready to send", "In market", "Quoted", "Won"]);
    const current = within(bar()).getAllByRole("listitem").filter((li) => li.getAttribute("aria-current") === "step");
    expect(current.map((li) => li.textContent)).toEqual(["In market"]);
  });

  // Catches: a lost opportunity drawn with Won in the last place, or with no way to tell it is the current stage (D-415).
  it("shows Lost in the last place for a lost opportunity, and it is the current one", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ intake: null }, { stage: "lost", submissionId: null }));
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(labels()).toEqual(["Qualifying", "Intake under way", "Ready to send", "In market", "Quoted", "Lost"]);
    expect(within(bar()).getByText("Lost")).toHaveAttribute("aria-current", "step");
  });

  // Catches: the guidance under the bar (D-414) missing or in other words, for each stage and the name it asks for.
  it.each([
    [{ stage: "qualifying" as const }, null, "Start the quote to move to Intake under way"],
    [{ stage: "intake_under_way" as const }, { pipelineStatus: "draft", prospectName: "Elena Marsh", certifiedAt: null }, "Waiting for Elena to certify"],
    [{ stage: "intake_under_way" as const }, { pipelineStatus: "submitted" }, "Waiting for the review to finish"],
    [{ stage: "intake_under_way" as const }, { pipelineStatus: "under_review" }, "Waiting for the review to finish"],
    [{ stage: "intake_under_way" as const }, { pipelineStatus: "information_requested", prospectName: null }, "Waiting for Elena to answer"],
    [{ stage: "ready_to_send" as const }, { pipelineStatus: "ready_for_market" }, "Send to a PEO to move to In market"],
    [{ stage: "in_market" as const }, {}, "Waiting for a PEO to quote"],
    [{ stage: "quoted" as const }, {}, "Mark won or lost when the employer decides"],
  ])("says what would move %j on: %s", async (o, i, words) => {
    client.getOpportunityPage.mockResolvedValue(page({ intake: i === null ? null : { ...intake, ...i } }, o));
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(within(header()).getByText(words)).toBeInTheDocument();
  });

  // Catches: a name taken from the wrong place: the prospect's first name, else the main contact's, else "the employer".
  it("names the employer when there is no prospect and no main contact", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ mainContact: null, contacts: [], intake: { ...intake, pipelineStatus: "draft", prospectName: null, certifiedAt: null, certifiedBy: null } }, { stage: "intake_under_way" }));
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(within(header()).getByText("Waiting for the employer to certify")).toBeInTheDocument();
  });

  // Catches: words under the bar for a stage that has nothing to wait for (D-414: Won and Lost say nothing).
  it("says nothing under the bar for Won and Lost", async () => {
    client.getOpportunityPage.mockResolvedValue(page({}, { stage: "won" }));
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(within(header()).queryByText(/Waiting for|Start the quote|Send to a PEO|Mark won/)).toBeNull();
  });
});

describe("OpportunityPage: the page states", () => {
  // Catches: one state for an opportunity that is gone, another firm's and one the person may not see, with a hint which (D-421); or an error where there is none.
  it("says the opportunity isn't available, with a way back, when there is none or it isn't theirs", async () => {
    client.getOpportunityPage.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByRole("heading", { name: "This opportunity isn't available." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to all accounts" })).toHaveAttribute("href", "/accounts");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // Catches: an address that is no id at all (22P02) offered a "Try again" that can't work.
  it("says an address that is no id at all is not available either", async () => {
    client.getOpportunityPage.mockRejectedValue(new OpportunityError("failed", "Couldn't load the opportunity. Try again.", "22P02"));
    renderPage("/opportunities/nope");
    expect(await screen.findByRole("heading", { name: "This opportunity isn't available." })).toBeInTheDocument();
  });

  // Catches: a failed load that leaves a blank page, or no way to ask again.
  it("says the page failed, with Try again, when the opportunity could not be read at all", async () => {
    const user = userEvent.setup();
    client.getOpportunityPage.mockRejectedValueOnce(new OpportunityError("failed", "Couldn't load the opportunity. Try again.")).mockResolvedValue(page());
    renderPage();
    expect(await screen.findByText(/We couldn.t load this opportunity/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "January 2027 PEO search" })).toBeInTheDocument();
  });

  // Catches: a loading state that shows nothing of the page's frame, or that says nothing (or says it twice) to a screen reader.
  it("shows the page's frame in grey while it loads, and says once that it is loading", async () => {
    client.getOpportunityPage.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(await screen.findByRole("heading", { name: "Quotes" })).toBeInTheDocument();
    for (const heading of ["Intake", "Activity", "Details", "Contacts on this search"]) expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(spoken().map((e) => e.textContent)).toEqual(["Loading the opportunity"]);
    expectStatusesOutsideBusy();
    expect(allStatuses().length).toBeGreaterThan(0);
  });

  // Catches: the address changing to another opportunity and the page showing the previous one's answer under it.
  it("never shows one opportunity's answer under another's address", async () => {
    const router = renderPage();
    await screen.findByRole("heading", { level: 1, name: "January 2027 PEO search" });
    client.getOpportunityPage.mockReturnValue(new Promise(() => {}));
    await act(async () => { await router.navigate("/opportunities/o2"); });
    await waitFor(() => expect(screen.queryByRole("heading", { level: 1, name: "January 2027 PEO search" })).toBeNull());
  });
});


// ---------- the quotes ----------

const quote = (n: number, over: object = {}) => ({
  id: n, peoName: `PEO ${String.fromCharCode(64 + n)}`, status: "sent", sentOn: "2026-11-06", quoteReceivedOn: null as string | null, quoteExpiresOn: null as string | null,
  adminFeePepm: null as number | null, ...over,
});
const quoted = quote(1, { status: "quoted", sentOn: "2026-10-29", quoteReceivedOn: "2026-11-03", quoteExpiresOn: "2026-12-05", adminFeePepm: 132 });

/** The submission as the submission's page reads it, certified, with what a profile's `needed_to_quote` can be checked against. */
const certified = (over: object = {}) => ({
  id: "i1", certified: true, signed: null, currentVersion: 2, certificationLacksSnapshot: false, reviews: {}, documents: [], extraAnswers: {},
  data: { ...EMPTY_CHAMBER_DATA, company_name: "Harborview", states: ["OR"] },
  provenance: { company_name: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: "2026-10-01T00:00:00Z" }, states: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: "2026-10-01T00:00:00Z" } },
  ...over,
});
const profileRow = (id: number, name: string, p: object = {}) => ({ id, name, profile: { version: 1, needed_to_quote: [], needed_before_signing: [], documents: [], extra_questions: [], sources: {}, ...p } });

const quotesPanel = () => screen.getByRole("region", { name: /^Quotes/ });
const cell = (row: HTMLElement, column: string) => {
  const table = row.closest("table") as HTMLElement;
  const at = within(table).getAllByRole("columnheader").findIndex((h) => h.textContent === column);
  return within(row).getAllByRole("cell")[at];
};

describe("OpportunityPage: the quotes", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 12, 12));
    advisor.loadSubmission.mockResolvedValue(certified());
  });

  // Catches: a quotes panel that leaves out a column D-424 names, or shows a column a later epic owns (Emails is off, D-402; Compare and Send to another PEO too).
  it("lists one row per quote request: PEO, status, sent, admin fee, expires and still needs, with no Emails column", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ quotes: [quoted, quote(2)] }));
    renderPage();
    const panel = await screen.findByRole("region", { name: /^Quotes/ });
    expect(within(panel).getByRole("heading", { name: /^Quotes/ })).toHaveTextContent("Quotes2");
    expect(within(panel).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["PEO", "Status", "Sent", "Admin fee", "Expires", "Still needs"]);
    const [a, b] = within(panel).getAllByRole("row").slice(1);
    expect(cell(a, "PEO")).toHaveTextContent("PEO A");
    expect(cell(a, "Status")).toHaveTextContent("Quoted");
    expect(cell(a, "Sent")).toHaveTextContent("Oct 29, 2026");
    expect(cell(a, "Admin fee")).toHaveTextContent("$132 per employee per month");
    expect(cell(a, "Expires")).toHaveTextContent("Dec 5, 2026");
    expect(cell(b, "Admin fee")).toHaveTextContent("Not yet");
    expect(cell(b, "Expires")).toHaveTextContent("Not yet");
    expect(within(panel).queryByRole("link", { name: /Compare|Send to another PEO/ })).toBeNull();
  });

  // Catches: "Sent · N days" shown for a quote that is no longer waiting, or counted from the wrong day, or "1 days".
  it("counts the days a quote has been sent while it is sent", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ quotes: [quote(1), quote(2, { sentOn: "2026-11-11" }), quote(3, { sentOn: "2026-11-12" }), quoted] }));
    renderPage();
    const rows = within(await screen.findByRole("region", { name: /^Quotes/ })).getAllByRole("row").slice(1);
    expect(rows.map((r) => cell(r, "Status").textContent)).toEqual(["Sent · 6 days", "Sent · 1 day", "Sent · today", "Quoted"]);
  });

  // Catches: a PEO that opens nothing (D-424: each opens the submission's page until the quote's own page, Epic 5).
  it("opens the submission's page from each PEO", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ quotes: [quoted] }));
    renderPage();
    expect(await within(await screen.findByRole("region", { name: /^Quotes/ })).findByRole("link", { name: "PEO A" })).toHaveAttribute("href", "/advisor/submissions/i1");
  });

  // Catches: Still needs read from the wrong place: the same reads as the submission's page (the last certified version and the PEOs' profiles), matched by name
  // ignoring case, as "Nothing", the first missing item, "N of its own questions", or "Not known" for a PEO with no profile (D-424).
  it("works out what each PEO still needs from the last certified version, as the submission's page does", async () => {
    peoCatalogRows = [
      profileRow(1, "PEO A", { needed_to_quote: ["company_name", "states"] }),
      profileRow(2, "peo b", { needed_to_quote: ["company_name", "hris_system"] }),
      profileRow(3, "PEO C", { extra_questions: [{ key: "vehicles", text: "Do employees drive for work?", kind: "yes_no" }, { key: "fleet", text: "How many vehicles?", kind: "number" }] }),
      { id: 4, name: "PEO D", profile: null },
    ];
    client.getOpportunityPage.mockResolvedValue(page({ quotes: [quoted, quote(2), quote(3), quote(4), quote(5, { peoName: "A PEO the catalog never heard of" })] }));
    renderPage();
    const panel = await screen.findByRole("region", { name: /^Quotes/ });
    await waitFor(() => expect(cell(within(panel).getAllByRole("row")[1], "Still needs")).toHaveTextContent("Nothing"));
    const needs = within(panel).getAllByRole("row").slice(1).map((r) => cell(r, "Still needs").textContent);
    expect(needs).toEqual(["Nothing", "HRIS system", "2 of its own questions", "Not known", "Not known"]);
    expect(advisor.loadSubmission).toHaveBeenCalledWith("i1", false);
  });

  // Catches: opening the page recording an opening of the submission in the firm's record (the second argument of loadSubmission is "opening").
  it("reads the submission without opening it", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ quotes: [quoted] }));
    renderPage();
    await screen.findByRole("region", { name: /^Quotes/ });
    await waitFor(() => expect(advisor.loadSubmission).toHaveBeenCalled());
    for (const call of advisor.loadSubmission.mock.calls) expect(call[1]).toBe(false);
  });

  // Catches: a failed read of what a PEO needs hiding the quotes, or passing for "Nothing" (D-426 style: say it, with Try again, and keep the rows).
  it("keeps the rows and says it could not check, with Try again, when the submission or the PEOs cannot be read", async () => {
    const user = userEvent.setup({ advanceTimers: () => {} });
    advisor.loadSubmission.mockRejectedValueOnce(new Error("down")).mockResolvedValue(certified());
    peoCatalogRows = [profileRow(1, "PEO A")];
    client.getOpportunityPage.mockResolvedValue(page({ quotes: [quoted] }));
    renderPage();
    const panel = await screen.findByRole("region", { name: /^Quotes/ });
    expect(within(panel).getByText("PEO A")).toBeInTheDocument();
    const alert = await within(panel).findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't check what each PEO still needs");
    expect(within(panel).queryByText("Nothing")).toBeNull();
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await within(panel).findByText("Nothing")).toBeInTheDocument();
  });

  // Catches: a PEO shown "Nothing" when the version was certified before status was kept, so nothing can say what it held.
  it("says Not known when the certified version cannot say what it held", async () => {
    peoCatalogRows = [profileRow(1, "PEO A", { needed_to_quote: ["hris_system"] })];
    advisor.loadSubmission.mockResolvedValue(certified({ certificationLacksSnapshot: true }));
    client.getOpportunityPage.mockResolvedValue(page({ quotes: [quoted] }));
    renderPage();
    const panel = await screen.findByRole("region", { name: /^Quotes/ });
    await waitFor(() => expect(advisor.loadSubmission).toHaveBeenCalled());
    expect(await within(panel).findByText("Not known")).toBeInTheDocument();
  });

  // Catches: the empty states in the wrong words: with no intake there can be no quote; with an intake none is sent yet.
  it("says there are no quotes yet, and why when there is an intake", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ quotes: [], intake: null }, { stage: "qualifying", submissionId: null }));
    renderPage();
    expect(await within(await screen.findByRole("region", { name: /^Quotes/ })).findByText("No quotes yet.")).toBeInTheDocument();
    expect(advisor.loadSubmission).not.toHaveBeenCalled();
  });

  // Catches: the empty quotes state of an opportunity with an intake said as if it had none, or the submission read for no quote request.
  it("says quotes appear once the opportunity is sent to a PEO, when it has an intake and none is sent", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ quotes: [] }, { stage: "ready_to_send" }));
    renderPage();
    expect(await within(await screen.findByRole("region", { name: /^Quotes/ })).findByText(/No quotes yet\. Quotes appear when the opportunity is sent to a PEO\./)).toBeInTheDocument();
    expect(advisor.loadSubmission).not.toHaveBeenCalled();
  });
});

// ---------- the intake ----------

const intakePanel = () => screen.getByRole("region", { name: /^Intake/ });
const fact = (panel: HTMLElement, label: string) => within(panel).getByText(label, { selector: "dt" }).nextElementSibling as HTMLElement;

describe("OpportunityPage: the intake", () => {
  // Catches: a fact D-425 names left out (File ID, certified by and when, version, census size, open items with the first), or Open intake not leading to the submission.
  it("shows the File ID, who certified and when, the version, the census size and the open items, with Open intake", async () => {
    renderPage();
    const panel = await screen.findByRole("region", { name: /^Intake/ });
    expect(within(panel).getByText("Certified", { selector: "span.inline-flex" })).toBeInTheDocument();
    expect(fact(panel, "File ID")).toHaveTextContent("EAA-2026-0117");
    expect(fact(panel, "Certified by")).toHaveTextContent("Elena Marsh, Oct 28, 2026");
    expect(fact(panel, "Version")).toHaveTextContent("2");
    expect(fact(panel, "Census")).toHaveTextContent("45 employees");
    expect(fact(panel, "Open items")).toHaveTextContent("1 · Loss run for 2024");
    expect(within(panel).getByRole("link", { name: "Open intake" })).toHaveAttribute("href", "/advisor/submissions/i1");
  });

  // Catches: PEOs authorized drawn (it is off, D-402), or a button for asking the contact for more mail (Epic 6).
  it("has no PEOs authorized, and nothing that sends mail", async () => {
    renderPage();
    const panel = await screen.findByRole("region", { name: /^Intake/ });
    expect(within(panel).queryByText("PEOs authorized")).toBeNull();
    expect(within(panel).queryByRole("button")).toBeNull();
    expect(within(panel).queryByRole("link", { name: /^Ask / })).toBeNull();
  });

  // Catches: an open item that names no label, or "None" read as a count of zero with a dangling dot.
  it("says None when nothing is open, and names a field when the first open item is not a required answer", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ intake: { ...intake, openItems: { count: 0, firstLabel: null, firstField: null } } }));
    renderPage();
    expect(fact(await screen.findByRole("region", { name: /^Intake/ }), "Open items")).toHaveTextContent(/^None$/);
    client.getOpportunityPage.mockResolvedValue(page({ intake: { ...intake, openItems: { count: 3, firstLabel: null, firstField: "payroll_vendor" } } }));
    await act(async () => { await queryClient.invalidateQueries(); });
    await waitFor(() => expect(fact(intakePanel(), "Open items")).toHaveTextContent("3 · Payroll vendor"));
  });

  // Catches: the no-intake state drawn as an empty table of facts, or offering Start the quote before New quote (Epic 5) exists (D-426).
  it("says No intake yet, with what would move it on, and no Start the quote", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ intake: null }, { stage: "qualifying", submissionId: null }));
    renderPage();
    const panel = await screen.findByRole("region", { name: /^Intake/ });
    expect(within(panel).getByText("No intake yet")).toBeInTheDocument();
    expect(within(panel).getByText("Start the quote to move to Intake under way")).toBeInTheDocument();
    expect(within(panel).queryByRole("button")).toBeNull();
    expect(within(panel).queryByRole("link", { name: /Start the quote|Open intake/ })).toBeNull();
  });

  // Catches: an intake under way drawn as certified (with a File ID and a version it does not have), or not saying who is filling it in and how far they are (D-426).
  it("says who is filling an intake under way in and how many answers it holds, with no Remind", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ intake: { ...intake, fileId: null, certifiedBy: null, certifiedAt: null, version: null, censusSize: null, answered: 12, prospectName: "Elena Marsh", pipelineStatus: "draft" } }, { stage: "intake_under_way" }));
    renderPage();
    const panel = await screen.findByRole("region", { name: /^Intake/ });
    expect(within(panel).getByText("Elena Marsh is filling it in · 12 answers")).toBeInTheDocument();
    expect(within(panel).queryByText("Certified")).toBeNull();
    expect(within(panel).queryByText("File ID")).toBeNull();
    expect(within(panel).queryByRole("button", { name: /Remind/ })).toBeNull();
    expect(within(panel).getByRole("link", { name: "Open intake" })).toHaveAttribute("href", "/advisor/submissions/i1");
  });

  // Catches: "1 answers", or a nameless prospect shown as an empty name before "is filling it in".
  it("says one answer in the singular, and the prospect when no name was given", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ intake: { ...intake, certifiedAt: null, certifiedBy: null, answered: 1, prospectName: null, pipelineStatus: "draft" } }, { stage: "intake_under_way" }));
    renderPage();
    expect(await within(await screen.findByRole("region", { name: /^Intake/ })).findByText("The prospect is filling it in · 1 answer")).toBeInTheDocument();
  });

  // Catches: a certified intake nothing has been sent from not saying it is ready, or not leading to the place to record the send (D-426, D-403).
  it("says Ready to send, with Record a send opening the submission's page, when it is certified and nothing is sent", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ quotes: [], intake: { ...intake, pipelineStatus: "ready_for_market" } }, { stage: "ready_to_send" }));
    renderPage();
    const panel = await screen.findByRole("region", { name: /^Intake/ });
    expect(within(panel).getByText("Ready to send")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Record a send" })).toHaveAttribute("href", "/advisor/submissions/i1");
  });

  // Catches: Ready to send and Record a send left on after the send was made, offering a second one from the wrong stage.
  it("does not say Ready to send or offer Record a send once it is in the market", async () => {
    renderPage();
    const panel = await screen.findByRole("region", { name: /^Intake/ });
    expect(within(panel).queryByText("Ready to send")).toBeNull();
    expect(within(panel).queryByRole("link", { name: "Record a send" })).toBeNull();
  });
});

// ---------- the contacts ----------

describe("OpportunityPage: contacts on this search", () => {
  const people = [
    { id: "c1", name: "Elena Marsh", title: "Practice Manager", email: "elena@harborview.example", phone: "(503) 555-0142", main: true, fillsInIntake: true },
    { id: "c2", name: "Dr. Owen Park", title: null, email: null, phone: null, main: false, fillsInIntake: false },
    { id: "c3", name: "Priya Shah", title: "Bookkeeper", email: "priya@harborview.example", phone: null, main: false, fillsInIntake: true },
  ];

  // Catches: the usual case, where the prospect is the main contact, drawn as two rows or with one mark missing (D-429); and a contact whose name opens nothing.
  it("lists one row per contact with Main and fills in the intake marked, each name opening its contact's page", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ contacts: people }));
    renderPage();
    const panel = await screen.findByRole("region", { name: "Contacts on this search" });
    const items = within(panel).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByRole("link", { name: "Elena Marsh" })).toHaveAttribute("href", "/contacts/c1");
    expect(within(items[0]).getByText("Main", { selector: "span.inline-flex" })).toBeInTheDocument();
    expect(items[0]).toHaveTextContent("Practice Manager · fills in the intake");
    expect(items[0]).toHaveTextContent("elena@harborview.example");
    expect(items[0]).toHaveTextContent("(503) 555-0142");
    expect(within(items[1]).getByRole("link", { name: "Dr. Owen Park" })).toHaveAttribute("href", "/contacts/c2");
    expect(within(items[1]).queryByText("Main")).toBeNull();
    expect(items[1]).not.toHaveTextContent("fills in the intake");
    expect(items[2]).toHaveTextContent("Bookkeeper · fills in the intake");
    expect(within(items[2]).queryByText("Main")).toBeNull();
  });

  // Catches: a panel with a heading and nothing under it for an opportunity with no contact on it.
  it("says no one is on it yet", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ contacts: [], mainContact: null }));
    renderPage();
    expect(await within(await screen.findByRole("region", { name: "Contacts on this search" })).findByText("No contacts on this search yet.")).toBeInTheDocument();
  });
});


// ---------- the activity ----------

const item = (over: Partial<ActivityItem> = {}): ActivityItem => ({
  type: "call", id: "x1", entryKey: "x1", at: "2026-11-13T18:30:00+00:00", who: "Dana Reyes", authorId: "u1", contact: null, opportunity: { id: "o1", name: "January 2027 PEO search" },
  outcome: null, title: null, body: null, additions: [], assignee: null, dueOn: null, doneAt: null, doneBy: null, canEdit: true, editableUntil: null, ...over, ...(over.id ? { entryKey: over.id } : {}),
});
const note = item({ type: "note", id: "note1", body: "Elena wants to see all three before the owner decides", editableUntil: "2026-11-14T18:30:00+00:00" });
const task = item({ type: "task", id: "task1", title: "Send PEO B the loss run", dueOn: "2020-01-01", assignee: { id: "u1", name: "Dana Reyes" } });
const call = item({ type: "call", id: "call1", outcome: "spoke", body: "Renewal came in 14% up", contact: { id: "c1", name: "Elena Marsh" } });
const stageMove: OpportunityActivityRow = {
  type: "change", entryKey: "e1", at: "2026-11-11T10:00:00+00:00", changeId: "ch1", kind: "stage_changed", who: "dana@example.com", whoKind: "member", field: "stage", from: "ready_to_send", to: "in_market",
  cause: "quote_send", causePeo: "PEO B", recordTable: "opportunities", recordId: "o1", recordName: "January 2027 PEO search",
};
const fieldChange: OpportunityActivityRow = {
  type: "change", entryKey: "e2", at: "2026-11-09T10:00:00+00:00", changeId: "ch2", kind: "changed", who: "dana@example.com", whoKind: "member", field: "employees", from: 40, to: 45,
  cause: null, causePeo: null, recordTable: "opportunities", recordId: "o1", recordName: "January 2027 PEO search",
};
const quoteEvent: OpportunityActivityRow = { type: "quote", entryKey: "quote_request_event:9", at: "2026-11-06T10:00:00+00:00", quoteRequestId: 13, peoName: "PEO B", event: "sent", who: "dana@example.com", whoKind: "member" };

const serveActivity = (all: OpportunityActivityRow[]) =>
  client.listOpportunityActivity.mockImplementation(async (_f: string, _o: string, o?: { offset?: number; limit?: number }) => ({ count: all.length, rows: all.slice(o?.offset ?? 0, (o?.offset ?? 0) + (o?.limit ?? 50)) }));
const activityPanel = () => screen.getByRole("region", { name: /^Activity/ });
const table = () => within(activityPanel()).getByRole("table", { name: "The opportunity's activity" });

describe("OpportunityPage: the activity", () => {
  // Catches: a kind of entry left out or drawn without its words: stage changes with their cause (D-413), a field change, a quote request's event, a call, a note and a task.
  it("lists the history, the quote requests' events and the calls, notes and tasks, each in its words", async () => {
    serveActivity([stageMove, note, fieldChange, quoteEvent, call, task]);
    renderPage();
    await screen.findByRole("heading", { name: /^Activity/ });
    const rows = (await within(await screen.findByRole("table", { name: "The opportunity's activity" })).findAllByRole("row")).slice(1);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toHaveTextContent("Change");
    expect(rows[0]).toHaveTextContent("Stage: Ready to send to In market, by the send to PEO B");
    expect(rows[0]).toHaveTextContent("dana@example.com");
    expect(rows[1]).toHaveTextContent("Note");
    expect(rows[1]).toHaveTextContent("Elena wants to see all three before the owner decides");
    expect(rows[2]).toHaveTextContent("Employees changed from 40 to 45");
    expect(rows[3]).toHaveTextContent("Quote");
    expect(rows[3]).toHaveTextContent("Sent to PEO B");
    expect(rows[4]).toHaveTextContent("Call");
    expect(rows[4]).toHaveTextContent("Spoke with Elena Marsh");
    expect(rows[5]).toHaveTextContent("Task");
    expect(rows[5]).toHaveTextContent("Send PEO B the loss run");
  });

  // Catches: a stage moved by a quote worded as a send (or with no cause), or a quote request event of one kind worded as another (D-413, D-427).
  it("words a stage moved by a quote, and an event of each kind", async () => {
    serveActivity([
      { ...stageMove, entryKey: "e3", cause: "quote_recorded", from: "in_market", to: "quoted" },
      { ...stageMove, entryKey: "e4", cause: null, causePeo: null, from: "qualifying", to: "intake_under_way" },
      { ...quoteEvent, entryKey: "q1", event: "quoted" }, { ...quoteEvent, entryKey: "q2", event: "declined" }, { ...quoteEvent, entryKey: "q3", event: "closed" },
    ]);
    renderPage();
    const rows = (await within(await screen.findByRole("table", { name: "The opportunity's activity" })).findAllByRole("row")).slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell")[2].textContent)).toEqual([
      "Stage: In market to Quoted, by the quote from PEO B", "Stage: Qualifying to Intake under way", "PEO B quoted", "PEO B declined", "PEO B's quote closed",
    ]);
  });

  // Catches: the history's fields worded as the column names, or a date or a person shown as a code.
  it("words the fields of the history as a person reads them, and never shows an id", async () => {
    const change = (n: number, field: string, from: unknown, to: unknown, kind = "changed") =>
      ({ ...fieldChange, entryKey: `c${n}`, field, from, to, kind } as OpportunityActivityRow);
    serveActivity([
      change(1, "target_start", "2027-01-01", "2027-02-01"), change(2, "value", 7100, 8000), change(3, "main_contact_id", "00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"),
      change(4, "owner_id", "u1", "u2"), change(5, "next_step", null, "Call Elena"), change(6, "name", null, null, "created"),
    ]);
    renderPage();
    const rows = (await within(await screen.findByRole("table", { name: "The opportunity's activity" })).findAllByRole("row")).slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell")[2].textContent)).toEqual([
      "Target start changed from Jan 1, 2027 to Feb 1, 2027", "Value changed from $7,100 to $8,000", "Main contact changed", "Owner changed", "Next step changed from nothing to Call Elena", "Opportunity created",
    ]);
  });

  // Catches: the filters asking for the wrong words, or the count and rows not following the filter (the database narrows it, D-212).
  it("narrows the activity to Calls, Notes, Tasks or Changes, asking the database for each", async () => {
    const user = userEvent.setup();
    serveActivity([note]);
    renderPage();
    await screen.findByRole("table", { name: "The opportunity's activity" });
    expect(within(activityPanel()).getAllByRole("button", { pressed: true }).map((b) => b.textContent)).toEqual(["All"]);
    expect(within(activityPanel()).getAllByRole("group", { name: "Show" })[0].querySelectorAll("button")).toHaveLength(5);
    for (const [label, filter] of [["Calls", "calls"], ["Notes", "notes"], ["Tasks", "tasks"], ["Changes", "changes"]] as const) {
      await user.click(within(activityPanel()).getByRole("button", { name: label }));
      await waitFor(() => expect(client.listOpportunityActivity).toHaveBeenCalledWith("f1", "o1", { filter, limit: 50, offset: 0 }));
      expect(within(activityPanel()).getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true");
    }
  });

  // Catches: the empty activity said in the All words under a filter that narrowed it, or a filter with nothing shown as an error.
  it("says in the filter's words that there is nothing, and in the page's that there is no activity", async () => {
    const user = userEvent.setup();
    client.listOpportunityActivity.mockResolvedValue({ count: 0, rows: [] });
    renderPage();
    expect(await within(await screen.findByRole("region", { name: /^Activity/ })).findByText("No activity yet.")).toBeInTheDocument();
    await user.click(within(activityPanel()).getByRole("button", { name: "Notes" }));
    expect(await within(activityPanel()).findByText("No notes yet.")).toBeInTheDocument();
  });

  // Catches: fifty rows being all there is (D-44), or Show more asking from the start again.
  it("shows fifty at a time, with Show more asking from the row after the last", async () => {
    const user = userEvent.setup();
    serveActivity(Array.from({ length: 70 }, (_, i) => ({ ...fieldChange, entryKey: `k${i}`, at: `2026-10-${String(30 - (i % 28)).padStart(2, "0")}T10:00:00+00:00` }) as OpportunityActivityRow));
    renderPage();
    await screen.findByRole("table", { name: "The opportunity's activity" });
    expect(within(table()).getAllByRole("row")).toHaveLength(51);
    expect(within(activityPanel()).getByText("Showing 50 of 70.")).toBeInTheDocument();
    await user.click(within(activityPanel()).getByRole("button", { name: "Show more" }));
    await waitFor(() => expect(within(table()).getAllByRole("row")).toHaveLength(71));
    expect(client.listOpportunityActivity).toHaveBeenCalledWith("f1", "o1", { filter: "all", limit: 50, offset: 50 });
  });

  // Catches: the activity failing taking the rest of the page with it, or with no way to ask again (D-423: its failure shows in its own panel with Try again).
  it("says the activity failed on its own, with Try again, and the rest of the page stays", async () => {
    const user = userEvent.setup();
    client.listOpportunityActivity.mockRejectedValueOnce(new OpportunityError("failed", "Couldn't load the activity. Try again.")).mockResolvedValue({ count: 1, rows: [note] });
    renderPage();
    const alert = await within(await screen.findByRole("region", { name: /^Activity/ })).findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't load the activity");
    expect(screen.getByRole("heading", { level: 1, name: "January 2027 PEO search" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Quotes/ })).toBeInTheDocument();
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await within(activityPanel()).findByText("Elena wants to see all three before the owner decides")).toBeInTheDocument();
  });

  // Catches: Add a note and Add a task opening a form that is not about this opportunity, or saving to the wrong account or opportunity (D-427).
  it("opens Add a note and Add a task about this opportunity, and saves them on it", async () => {
    const user = userEvent.setup();
    activity.logActivity.mockResolvedValue({ activity: note, followUp: null });
    renderPage();
    await user.click(await within(await screen.findByRole("region", { name: /^Activity/ })).findByRole("button", { name: "Add a note" }));
    await waitFor(() => expect(screen.getByLabelText("About")).not.toBeDisabled());
    expect(screen.getByLabelText("About")).toHaveValue("o1");
    await user.type(screen.getByLabelText("Note"), "Prefers mornings");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(activity.logActivity).toHaveBeenCalledTimes(1));
    expect(activity.logActivity.mock.calls[0][1]).toMatchObject({ kind: "note", accountId: "a1", opportunityId: "o1", body: "Prefers mornings" });
    // The activity is asked again, since a new note belongs in it.
    await waitFor(() => expect(client.listOpportunityActivity.mock.calls.length).toBeGreaterThan(1));
    await user.click(await within(activityPanel()).findByRole("button", { name: "Add a task" }));
    await waitFor(() => expect(screen.getByLabelText("About")).not.toBeDisabled());
    expect(screen.getByLabelText("About")).toHaveValue("o1");
    expect(screen.getByRole("button", { name: "Task", pressed: true })).toBeInTheDocument();
  });

  // Catches: marking a task done not working from here, or not asking the activity again.
  it("marks a task done and asks the activity again", async () => {
    const user = userEvent.setup();
    serveActivity([task]);
    activity.setTaskDone.mockResolvedValue({ ...task, doneAt: "2026-11-14T10:00:00+00:00" });
    renderPage();
    const button = await within(await screen.findByRole("table", { name: "The opportunity's activity" })).findByRole("button", { name: /Mark done/ });
    const before = client.listOpportunityActivity.mock.calls.length;
    await user.click(button);
    await waitFor(() => expect(activity.setTaskDone).toHaveBeenCalledWith("f1", "task1", true));
    await waitFor(() => expect(client.listOpportunityActivity.mock.calls.length).toBeGreaterThan(before));
  });

  // Catches: buttons offered where the database refuses every write (a Nevermore support session, ADR 0024).
  it("offers none of it in a Nevermore support session", async () => {
    serveActivity([task, note]);
    renderPage("/opportunities/o1", workspace({ isSupport: true }));
    await screen.findByRole("table", { name: "The opportunity's activity" });
    expect(screen.queryByRole("button", { name: /^Add a task|^Add a note|Mark done|^Edit (call|note|task)|Add to note/ })).toBeNull();
  });

  // Catches: an archived account taking a new note or task through its opportunity (D-222, D-432).
  it("says the account is archived and offers nothing to add", async () => {
    serveActivity([note]);
    client.getOpportunityPage.mockResolvedValue(page({ canAdd: false, canChange: false, account: { id: "a1", name: "Harborview Dental Group", archived: true } }));
    renderPage();
    await screen.findByRole("table", { name: "The opportunity's activity" });
    expect(screen.getByText("This account is archived.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Add a task|^Add a note|Add to note/ })).toBeNull();
  });
});


// ---------- the details ----------

const panel = (name: RegExp | string) => screen.getByRole("region", { name });
/** The query keys asked again so far (the first three parts name what: "opportunity", firm, id). */
const invalidated = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.calls.map((c) => ((c[0] as { queryKey: readonly unknown[] }).queryKey).slice(0, 3).join("/"));

describe("OpportunityPage: the details", () => {
  const value = (label: string) => within(panel("Details")).getByText(label, { selector: "dt" }).nextElementSibling as HTMLElement;

  // Catches: a detail D-428 names left out, shown by a code (the owner by id), or the stage and account offered for editing in the list.
  it("shows the account (linked), stage, target start, employees, expected close, value, source, next step and owner", async () => {
    renderPage();
    await screen.findByRole("region", { name: "Details" });
    expect(within(value("Account")).getByRole("link", { name: "Harborview Dental Group" })).toHaveAttribute("href", "/accounts/a1");
    expect(value("Stage")).toHaveTextContent("In market");
    expect(value("Target start")).toHaveTextContent("Jan 1, 2027");
    expect(value("Employees")).toHaveTextContent("45");
    expect(value("Expected close")).toHaveTextContent("Dec 12, 2026");
    expect(value("Value")).toHaveTextContent("$7,100 a year");
    expect(value("Source")).toHaveTextContent("Referral");
    expect(value("Next step")).toHaveTextContent("Send PEO B the loss run");
    expect(value("Owner")).toHaveTextContent("Dana Reyes");
  });

  // Catches: a referral shown as a bare "Referral" so the partner that sent it is lost (D-439), or a partner shown for a source that is not Referral.
  it("shows a referral as 'Referral · <partner>' when a partner is named, and the source alone otherwise", async () => {
    client.getOpportunityPage.mockResolvedValue(page({}, { referralPartner: { code: "harbor", name: "Harbor Brokers" } }));
    renderPage();
    await screen.findByRole("region", { name: "Details" });
    expect(value("Source")).toHaveTextContent("Referral · Harbor Brokers");
  });

  // Catches: an empty detail drawn as a blank, "null" or "0", or an opportunity with no owner drawn with a stale owner name.
  it("says Not provided for what is empty, and that there is no owner", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ owner: null }, { targetStart: null, employees: null, expectedClose: null, value: null, source: null, nextStep: null, ownerId: null }));
    renderPage();
    await screen.findByRole("region", { name: "Details" });
    for (const label of ["Target start", "Employees", "Expected close", "Value", "Source", "Next step", "Owner"]) expect(value(label)).toHaveTextContent("Not provided");
  });

  describe("edit in place", () => {
    const open = async () => {
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: /^Edit the opportunity/ }));
      return user;
    };
    const saved = (over: object = {}) => ({
      conflict: false as const,
      opportunity: { id: "o1", version: 5, accountId: "a1", ownerId: "u1", name: "January 2027 PEO search", targetStart: "2027-01-01", employees: 45, mainContactId: "c1", expectedClose: "2026-12-12", value: 7100, source: "Referral", referralPartner: null, nextStep: "Send PEO B the loss run", submissionId: "i1", createdAt: opportunity.createdAt, updatedAt: "2026-11-14T10:00:00+00:00", ...over },
    });

    // Catches: Edit shown to someone the level rule refuses (D-422, D-209) or on an archived account (D-432), or missing for someone it serves.
    it("offers Edit only when the database says the person may change the opportunity", async () => {
      client.getOpportunityPage.mockResolvedValue(page({ canChange: false }));
      renderPage();
      await screen.findByRole("region", { name: "Details" });
      expect(screen.queryByRole("button", { name: /^Edit the opportunity/ })).toBeNull();
    });

    // Catches: the stage or the account offered as a box (D-428: they are shown, never edited).
    it("edits the name, target start, employees, main contact, expected close, value, source, next step and owner, and not the stage or the account", async () => {
      renderPage();
      await open();
      await waitFor(() => expect(screen.getByLabelText("Main contact")).not.toBeDisabled());
      for (const label of ["Name", "Target start", "Employees", "Main contact", "Expected close", "Value", "Source", "Next step", "Owner"]) expect(screen.getByLabelText(new RegExp(`^${label}`))).toBeInTheDocument();
      expect(screen.queryByRole("textbox", { name: /^(Stage|Account)/ })).toBeNull();
      expect(screen.queryByRole("combobox", { name: /^(Stage|Account)/ })).toBeNull();
      expect(screen.getByLabelText("Value")).toHaveValue("7100");
      expect(screen.getByLabelText("Target start")).toHaveValue("2027-01-01");
    });

    // Catches: a save that names the wrong version (the page's live one, not the one the edit started from), drops a field, or sends a number as text (D-46).
    it("sends every field with the version the edit started from, and puts the saved values on the page", async () => {
      client.updateOpportunity.mockResolvedValue(saved({ employees: 52, nextStep: "Call Elena" }));
      renderPage();
      const user = await open();
      // A refresh brings a newer version while the form is open: the save still names the one the person started from.
      client.getOpportunityPage.mockResolvedValue(page({}, { version: 5, employees: 52, nextStep: "Call Elena" }));
      await user.clear(screen.getByLabelText("Employees"));
      await user.type(screen.getByLabelText("Employees"), "52");
      await user.clear(screen.getByLabelText("Next step"));
      await user.type(screen.getByLabelText("Next step"), "  Call Elena ");
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(client.updateOpportunity).toHaveBeenCalledTimes(1));
      expect(client.updateOpportunity).toHaveBeenCalledWith("f1", "o1", {
        name: "January 2027 PEO search", targetStart: "2027-01-01", employees: 52, mainContactId: "c1", expectedClose: "2026-12-12", value: 7100, source: "Referral", nextStep: "Call Elena", ownerId: "u1",
      }, 4);
      expect(toast.success).toHaveBeenCalledWith("Opportunity saved");
      expect(await screen.findByRole("button", { name: /^Edit the opportunity/ })).toHaveFocus();
      expect(value("Employees")).toHaveTextContent("52");
      expect(value("Next step")).toHaveTextContent("Call Elena");
    });

    // Catches: a blank field sent as a space or zero, so the database keeps something the person cleared.
    it("sends a cleared number or date as nothing", async () => {
      client.updateOpportunity.mockResolvedValue(saved({ employees: null, value: null, expectedClose: null }));
      renderPage();
      const user = await open();
      for (const label of ["Employees", "Value", "Expected close"]) await user.clear(screen.getByLabelText(label));
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(client.updateOpportunity).toHaveBeenCalledTimes(1));
      expect(client.updateOpportunity.mock.calls[0][2]).toMatchObject({ employees: null, value: null, expectedClose: "" });
    });

    // Catches: a missing name, a value that is not money or a count that is not a number accepted by the form, or said in codes (the database says it again in words).
    it("says in words what is wrong, before asking the database", async () => {
      renderPage();
      const user = await open();
      await user.clear(screen.getByLabelText(/^Name/));
      await user.clear(screen.getByLabelText("Value"));
      await user.type(screen.getByLabelText("Value"), "lots");
      await user.clear(screen.getByLabelText("Employees"));
      await user.type(screen.getByLabelText("Employees"), "forty");
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(await screen.findByText("Give the opportunity a name.")).toBeInTheDocument();
      expect(screen.getByText("Enter an amount in dollars, like 7100.")).toBeInTheDocument();
      expect(screen.getByText("Enter a whole number, like 45.")).toBeInTheDocument();
      expect(client.updateOpportunity).not.toHaveBeenCalled();
    });

    // Catches: the database's refusal (the level rule, a closing firm, an archived account) lost, or shown as a failure to try again; what was typed lost with it.
    it("shows the database's refusal in its own words and keeps what was typed", async () => {
      client.updateOpportunity.mockRejectedValue(new OpportunityError("notAllowed", "Only the opportunity's owner, a lead of the owner's team or an owner of the firm can change it.", "42501"));
      renderPage();
      const user = await open();
      await user.selectOptions(screen.getByLabelText("Source"), "Inbound");
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(await screen.findByText("Only the opportunity's owner, a lead of the owner's team or an owner of the firm can change it.")).toBeInTheDocument();
      expect(screen.getByLabelText("Source")).toHaveValue("Inbound");
      expect(toast.success).not.toHaveBeenCalled();
    });

    // Catches: Source left as free text (D-439), so a value off the list is typed and refused late; or the list in another order or without "No source" to clear it.
    it("offers No source and the fixed list of sources, with the present one chosen", async () => {
      renderPage();
      await open();
      const source = screen.getByLabelText("Source");
      expect(source.tagName).toBe("SELECT");
      expect(within(source).getAllByRole("option").map((o) => o.textContent)).toEqual(["No source", ...OPPORTUNITY_SOURCES]);
      expect(source).toHaveValue("Referral");
    });

    // Catches: a legacy source (one saved before the list) dropped from the box, so the box shows "No source" and a save clears it; or one that cannot be saved as it is (the database accepts it unchanged).
    it("keeps a legacy source as an option, labelled as it is, and saves it unchanged", async () => {
      client.getOpportunityPage.mockResolvedValue(page({}, { source: "Trade show" }));
      client.updateOpportunity.mockResolvedValue(saved({ source: "Trade show", nextStep: "Call Elena" }));
      renderPage();
      const user = await open();
      const source = screen.getByLabelText("Source");
      expect(within(source).getAllByRole("option").map((o) => o.textContent)).toEqual(["No source", ...OPPORTUNITY_SOURCES, "Trade show"]);
      expect(source).toHaveValue("Trade show");
      // Trying another source does not take the legacy one away.
      await user.selectOptions(source, "Event");
      expect(within(source).getByRole("option", { name: "Trade show" })).toBeInTheDocument();
      await user.selectOptions(source, "Trade show");
      await user.clear(screen.getByLabelText("Next step"));
      await user.type(screen.getByLabelText("Next step"), "Call Elena");
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(client.updateOpportunity).toHaveBeenCalledTimes(1));
      expect(client.updateOpportunity.mock.calls[0][2]).toMatchObject({ source: "Trade show" });
    });

    // Catches: an opportunity with no source drawn with a stray option, or No source sent as anything but a blank (the database clears it).
    it("sends No source as a blank", async () => {
      client.updateOpportunity.mockResolvedValue(saved({ source: null }));
      renderPage();
      const user = await open();
      await user.selectOptions(screen.getByLabelText("Source"), "");
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(client.updateOpportunity).toHaveBeenCalledTimes(1));
      expect(client.updateOpportunity.mock.calls[0][2]).toMatchObject({ source: "" });
    });

    // Catches: the database's "Choose a source from the list." (22023) lost or shown as a failure to retry, or what was chosen lost with it (the same way as the other refusals here).
    it("shows the database's refusal of a source in its own words and keeps what was chosen", async () => {
      client.updateOpportunity.mockRejectedValue(new OpportunityError("invalid", "Choose a source from the list.", "22023"));
      renderPage();
      const user = await open();
      await user.selectOptions(screen.getByLabelText("Source"), "Event");
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(await screen.findByText("Choose a source from the list.")).toBeInTheDocument();
      expect(screen.getByLabelText("Source")).toHaveValue("Event");
      expect(toast.success).not.toHaveBeenCalled();
    });

    // Catches: a main contact choice that offers contacts of other accounts (the database refuses them), or no way to clear it.
    it("offers the account's contacts as the main contact, and No main contact", async () => {
      activity.getActivityOptions.mockResolvedValue({ contacts: [{ id: "c1", name: "Elena Marsh", title: "Practice Manager" }, { id: "c2", name: "Dr. Owen Park", title: null }], opportunities: [], people: [] });
      renderPage();
      await open();
      await waitFor(() => expect(within(screen.getByLabelText("Main contact")).getAllByRole("option").map((o) => o.textContent)).toEqual(["No main contact", "Elena Marsh", "Dr. Owen Park"]));
      expect(screen.getByLabelText("Main contact")).toHaveValue("c1");
      expect(activity.getActivityOptions).toHaveBeenCalledWith("f1", "a1");
    });

    // Catches: the owner choice offering the person someone the database would refuse, or dropping the present owner (so saving would change it), or sending an id for none (D-209).
    it("offers the present owner first, then the people the database lets the person give it to", async () => {
      listAccountOwners.mockResolvedValue([{ value: "u1", label: "Dana Reyes" }, { value: "u3", label: "Sam Lee" }]);
      client.getOpportunityPage.mockResolvedValue(page({ owner: { id: "u9", name: "Pat Gone" } }, { ownerId: "u9" }));
      renderPage();
      await open();
      await waitFor(() => expect(within(screen.getByLabelText("Owner")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Pat Gone", "Dana Reyes", "Sam Lee"]));
      expect(screen.getByLabelText("Owner")).toHaveValue("u9");
    });

  // Catches: an opportunity with no owner sent an owner it never chose, so a save would give it to someone (D-209: no owner means keep).
  it("offers No owner for an opportunity that has none, and sends nothing for it", async () => {
      client.getOpportunityPage.mockResolvedValue(page({ owner: null }, { ownerId: null }));
      client.updateOpportunity.mockResolvedValue(saved({ ownerId: null }));
      renderPage();
      const user = await open();
      expect(screen.getByLabelText("Owner")).toHaveValue("");
      await user.selectOptions(screen.getByLabelText("Source"), "Inbound");
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(client.updateOpportunity).toHaveBeenCalledTimes(1));
      expect(client.updateOpportunity.mock.calls[0][2]).toMatchObject({ ownerId: null });
    });

    // Catches: a save leaving the account's lists, the contacts' pages and the page itself showing the old name, main contact and history until their own refresh.
    it("asks the opportunity's lists, its account's and the contacts' pages again", async () => {
      client.updateOpportunity.mockResolvedValue(saved({ name: "Renamed" }));
      renderPage();
      const user = await open();
      const spy = vi.spyOn(queryClient, "invalidateQueries");
      await user.type(screen.getByLabelText(/^Name/), "!");
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(invalidated(spy)).toContain("opportunity/f1/o1"));
      expect(invalidated(spy)).toEqual(expect.arrayContaining(["account/f1/a1", "contact/f1"]));
    });

    describe("when someone saved first", () => {
      const conflict: OpportunityConflict = {
        conflict: true, currentVersion: 6,
        current: { name: "January 2027 PEO search", targetStart: "2027-02-01", employees: 45, mainContactId: "c1", expectedClose: "2026-12-12", value: 9000, source: "Referral", nextStep: "Send PEO B the loss run", ownerId: "u2" },
        changed: [
          { field: "target_start", value: "2027-02-01", who: "bob@example.com", at: "2026-11-14T10:00:00+00:00" },
          { field: "value", value: 9000, who: "bob@example.com", at: "2026-11-14T10:00:00+00:00" },
          { field: "owner_id", value: "u2", who: "bob@example.com", at: "2026-11-14T10:00:00+00:00" },
        ],
      };

      // Catches: a conflict that overwrites, or shows columns, ids and raw numbers instead of words, or without who changed them (D-183).
      it("shows what changed, in words, and saves nothing", async () => {
        client.updateOpportunity.mockResolvedValueOnce(conflict);
        renderPage();
        const user = await open();
        await waitFor(() => expect(listFirmMembers).toHaveBeenCalled());
        await user.selectOptions(screen.getByLabelText("Source"), "Inbound");
        await user.click(screen.getByRole("button", { name: "Save" }));
        const dialog = await screen.findByRole("alertdialog");
        const rows = within(dialog).getAllByRole("row").slice(1).map((r) => r.textContent);
        expect(rows[0]).toContain("Target start");
        expect(rows[0]).toContain("Feb 1, 2027");
        expect(rows[1]).toContain("Value");
        expect(rows[1]).toContain("$9,000");
        expect(rows[2]).toContain("OwnerYou didn't change thisMarcus Hale");
        expect(dialog.textContent).not.toMatch(/target_start|owner_id|u2/);
        expect(dialog.textContent).toContain("bob@example.com");
        expect(toast.success).not.toHaveBeenCalled();
      });

      // Catches: Keep mine saving again from the old version (refused again), or from the wrong fields.
      it("saves again from the version that holds their change with Keep mine", async () => {
        client.updateOpportunity.mockResolvedValueOnce(conflict).mockResolvedValueOnce(saved({ version: 7 }));
        renderPage();
        const user = await open();
        await user.selectOptions(screen.getByLabelText("Source"), "Inbound");
        await user.click(screen.getByRole("button", { name: "Save" }));
        await user.click(await within(await screen.findByRole("alertdialog")).findByRole("button", { name: "Keep mine" }));
        await waitFor(() => expect(client.updateOpportunity).toHaveBeenCalledTimes(2));
        expect(client.updateOpportunity.mock.calls[1][3]).toBe(6);
        // Mine (the source, now Inbound) with their change kept to every field I left alone: the target start, the value and the owner.
        expect(client.updateOpportunity.mock.calls[1][2]).toEqual({
          name: "January 2027 PEO search", targetStart: "2027-02-01", employees: 45, mainContactId: "c1", expectedClose: "2026-12-12", value: 9000, source: "Inbound",
          nextStep: "Send PEO B the loss run", ownerId: "u2",
        });
      });
    });
  });
});


// ---------- review fixes ----------

describe("OpportunityPage: the owner and main contact boxes show what a save will send", () => {
  const theirs: OpportunityConflict = {
    conflict: true, currentVersion: 6,
    current: { name: "January 2027 PEO search", targetStart: "2027-01-01", employees: 45, mainContactId: "c1", expectedClose: "2026-12-12", value: 7100, source: "Referral", nextStep: "Send PEO B the loss run", ownerId: "u2" },
    changed: [{ field: "owner_id", value: "u2", who: "bob@example.com", at: "2026-11-14T10:00:00+00:00" }],
  };

  // Catches: Keep theirs putting an owner in the form that the box has no option for, so it shows the first option ("Dana Reyes") while Save sends the other (u2).
  it("shows their owner after Keep theirs even when the person could not have chosen them, and saves that owner", async () => {
    const user = userEvent.setup();
    client.updateOpportunity.mockResolvedValueOnce(theirs).mockResolvedValueOnce({ conflict: false, opportunity: { ...opportunity, version: 7, ownerId: "u2" } });
    renderPage();
    await user.click(await screen.findByRole("button", { name: /^Edit the opportunity/ }));
    await waitFor(() => expect(listFirmMembers).toHaveBeenCalled());
    await user.selectOptions(screen.getByLabelText("Source"), "Inbound");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(await within(await screen.findByRole("alertdialog")).findByRole("button", { name: "Keep theirs" }));
    await waitFor(() => expect(screen.getByLabelText("Owner")).toHaveValue("u2"));
    expect(within(screen.getByLabelText("Owner")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Dana Reyes", "Marcus Hale"]);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.updateOpportunity).toHaveBeenCalledTimes(2));
    expect(client.updateOpportunity.mock.calls[1][2]).toMatchObject({ ownerId: "u2" });
  });

  it("names an owner it cannot find 'Someone in the firm'", async () => {
    const user = userEvent.setup();
    listFirmMembers.mockRejectedValue(new Error("down"));
    client.updateOpportunity.mockResolvedValueOnce(theirs);
    renderPage();
    await user.click(await screen.findByRole("button", { name: /^Edit the opportunity/ }));
    await user.selectOptions(screen.getByLabelText("Source"), "Inbound");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(await within(await screen.findByRole("alertdialog")).findByRole("button", { name: "Keep theirs" }));
    await waitFor(() => expect(screen.getByLabelText("Owner")).toHaveValue("u2"));
    expect(within(screen.getByLabelText("Owner")).getByRole("option", { name: "Someone in the firm" })).toBeInTheDocument();
  });

  // Catches: the contacts failing to load leaving the main contact box on "No main contact" while Save still sends the contact it held (c1).
  it("keeps the present main contact in the box when the account's contacts could not be loaded", async () => {
    const user = userEvent.setup();
    activity.getActivityOptions.mockRejectedValue(new Error("down"));
    renderPage();
    await user.click(await screen.findByRole("button", { name: /^Edit the opportunity/ }));
    await waitFor(() => expect(activity.getActivityOptions).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByLabelText("Main contact")).not.toBeDisabled());
    expect(screen.getByLabelText("Main contact")).toHaveValue("c1");
    expect(within(screen.getByLabelText("Main contact")).getByRole("option", { name: "Elena Marsh" })).toBeInTheDocument();
  });
});

describe("OpportunityPage: who the guidance names", () => {
  // Catches: "Waiting for <name> to answer" naming the main contact (Owen) when the person filling the intake in is Elena: the prospect's name is gone once the intake is submitted.
  it("names the contact who fills in the intake, not the main contact, once the intake is submitted", async () => {
    client.getOpportunityPage.mockResolvedValue(page({
      mainContact: { id: "c2", name: "Owen Park" },
      contacts: [
        { id: "c2", name: "Owen Park", title: null, email: null, phone: null, main: true, fillsInIntake: false },
        { id: "c1", name: "Elena Marsh", title: null, email: null, phone: null, main: false, fillsInIntake: true },
      ],
      intake: { ...intake, pipelineStatus: "information_requested", prospectName: null, certifiedAt: null, certifiedBy: null, answered: 9 },
    }, { stage: "intake_under_way" }));
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(within(header()).getByText("Waiting for Elena to answer")).toBeInTheDocument();
  });

  it("falls back to who certified, then to the main contact", async () => {
    client.getOpportunityPage.mockResolvedValue(page({
      mainContact: { id: "c2", name: "Owen Park" }, contacts: [],
      intake: { ...intake, pipelineStatus: "information_requested", prospectName: null, certifiedAt: "2026-10-28T10:00:00+00:00", certifiedBy: "Elena Marsh" },
    }, { stage: "intake_under_way" }));
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(within(header()).getByText("Waiting for Elena to answer")).toBeInTheDocument();
  });
});

describe("OpportunityPage: an archived account (D-432)", () => {
  // Catches: Mark done, Open again and Edit still drawn on an archived account's opportunity, where nothing on it can be changed.
  it("draws no Mark done, Open again or Edit on the activity", async () => {
    const done = item({ type: "task", id: "task2", title: "Already done", doneAt: "2026-11-14T10:00:00+00:00", assignee: { id: "u1", name: "Dana Reyes" } });
    serveActivity([task, done, call, note]);
    client.getOpportunityPage.mockResolvedValue(page({ canAdd: false, canChange: false, account: { id: "a1", name: "Harborview Dental Group", archived: true } }));
    renderPage();
    await screen.findByRole("table", { name: "The opportunity's activity" });
    expect(within(table()).getByText("Send PEO B the loss run")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mark done|Open again|^Edit|Add to note/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Edit the opportunity/ })).toBeNull();
  });
});

describe("OpportunityPage: small things the review found", () => {
  const change = (field: string, from: unknown, to: unknown) => ({ ...fieldChange, entryKey: `c-${field}`, field, from, to }) as OpportunityActivityRow;

  // Catches: lost_by shown as a uuid and lost_at as a raw timestamp in the history.
  it("words lost_at and lost_by without showing a code or a timestamp", async () => {
    serveActivity([change("lost_at", null, "2026-11-12T10:00:00+00:00"), change("lost_by", null, "00000000-0000-0000-0000-000000000001")]);
    renderPage();
    const rows = (await within(await screen.findByRole("table", { name: "The opportunity's activity" })).findAllByRole("row")).slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell")[2].textContent)).toEqual(["Marked lost on Nov 12, 2026", "Lost by changed"]);
  });

  // Catches: won_at and won_by (CRM-O1.3b review: a win is a change of the opportunity) shown as a uuid and a raw timestamp in the history.
  it("words won_at and won_by without showing a code or a timestamp", async () => {
    serveActivity([
      change("won_at", null, "2026-11-12T10:00:00+00:00"), change("won_by", null, "00000000-0000-0000-0000-000000000001"),
      { ...change("won_at", "2026-11-12T10:00:00+00:00", null), entryKey: "c-won_at-2" } as OpportunityActivityRow, { ...change("won_by", "00000000-0000-0000-0000-000000000001", null), entryKey: "c-won_by-2" } as OpportunityActivityRow,
    ]);
    renderPage();
    const rows = (await within(await screen.findByRole("table", { name: "The opportunity's activity" })).findAllByRole("row")).slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell")[2].textContent)).toEqual(["Marked won on Nov 12, 2026", "Won by changed", "No longer marked won", "Won by changed"]);
  });

  // Catches: an empty paragraph drawn in the Intake panel for a lost opportunity with no intake, which has nothing to wait for.
  it("draws no empty words in the Intake panel of a lost opportunity with no intake", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ intake: null }, { stage: "lost", submissionId: null }));
    renderPage();
    const panel = await screen.findByRole("region", { name: /^Intake/ });
    expect(within(panel).getByText("No intake yet")).toBeInTheDocument();
    expect(panel.querySelectorAll("p")).toHaveLength(1);
  });

  // Catches: the places already passed marked by colour alone, which a screen reader cannot hear.
  it("says which places of the stage bar are done, in words", async () => {
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    const items = within(screen.getByRole("list", { name: "Stage" })).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["Qualifying (done)", "Intake under way (done)", "Ready to send (done)", "In market", "Quoted", "Won"]);
  });

  // Catches: an id with a character in it breaking the trail's link, the details' account link or a PEO's link (the paths encode their ids as the others do).
  it("encodes the ids in the links it draws", async () => {
    client.getOpportunityPage.mockResolvedValue(page({
      account: { id: "a 1", name: "Harborview Dental Group", archived: false }, quotes: [quote(1)], intake: { ...intake, submissionId: "i 1" },
    }));
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    const links = screen.getAllByRole("link").map((l) => l.getAttribute("href"));
    expect(links).toContain("/accounts/a%201");
    expect(links).toContain("/advisor/submissions/i%201");
    expect(links.filter((h) => h?.includes(" "))).toEqual([]);
  });
});


// ---------- CRM-O1.3b: Mark won or lost (screen 26), the won or lost banner, Record a payment ----------

const quotedQuote = (id: number, peo: string, fee: number | null) => ({ id, peoName: peo, status: "quoted", sentOn: "2026-10-29", quoteReceivedOn: "2026-11-03", quoteExpiresOn: "2026-12-05", adminFeePepm: fee });
const quotedPage = (over: Partial<Page> = {}, o: Partial<typeof opportunity> = {}) =>
  page({ quotes: [quotedQuote(12, "PEO A", 132), quotedQuote(13, "PEO B", 118), { ...quotedQuote(14, "PEO C", null), status: "sent", quoteReceivedOn: null }], ...over }, { stage: "quoted", ...o });
const closedPlacement = {
  id: "pl1", peoName: "PEO B", startDate: "2027-01-01", brokerOfRecord: "Acme Benefits", endedOn: null, renewsOn: "2028-01-01",
  commission: { basis: "share" as const, rate: 20, expectedYearly: 12744 }, version: 1,
};
const wonOutcome = { ...noOutcome, placement: closedPlacement, payments: [{ id: "p1", receivedOn: "2027-02-10", amount: 1500, note: null, version: 1 }], receivedToDate: 1500, quotes: { 12: { closeReason: null, proposedStart: "2027-01-15" }, 13: { closeReason: null, proposedStart: null } } };
const dialog = () => screen.getByRole("dialog");

describe("OpportunityPage: Mark won or lost opens the dialog (D-431, D-463)", () => {
  // Catches: Mark won or lost missing from the header (D-431), or offered to someone the level rule refuses, on a closed opportunity, or in a support session.
  it("puts Mark won or lost in the header for whoever may change an open opportunity, and for no one else", async () => {
    client.getOpportunityPage.mockResolvedValue(quotedPage());
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(within(header()).getByRole("button", { name: "Mark won or lost" })).toBeInTheDocument();
    cleanup();
  });

  it.each([
    ["a person the level rule does not give it to", () => quotedPage({ canChange: false }), workspace()],
    ["a won opportunity", () => quotedPage({}, { stage: "won" }), workspace()],
    ["a lost opportunity", () => quotedPage({}, { stage: "lost" }), workspace()],
    ["a Nevermore support session", () => quotedPage(), workspace({ isSupport: true })],
  ])("offers no Mark won or lost to %s", async (_who, pageOf, ws) => {
    client.getOpportunityPage.mockResolvedValue(pageOf());
    renderPage("/opportunities/o1", ws);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: "Mark won or lost" })).not.toBeInTheDocument();
  });

  // Catches: Won offered with no quote the employer could have taken, which the database would refuse after the person filled it in (D-463).
  it("shows Won disabled with why when no quote is quoted yet", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ quotes: [{ ...quotedQuote(14, "PEO C", null), status: "sent" }] }, { stage: "in_market" }));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Mark won or lost" }));
    const won = within(dialog()).getByRole("radio", { name: /Won/ });
    expect(won).toBeDisabled();
    expect(won).toHaveAccessibleDescription("Won needs a quote the employer took. None of this opportunity's quotes is quoted yet");
  });

  // Catches: the dialog offering a quote that is not quoted, or hiding the admin fee the commission is worked from (D-463).
  it("offers only the quoted quotes, each with its admin fee, and lists what Won will do", async () => {
    client.getOpportunityPage.mockResolvedValue(quotedPage());
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Mark won or lost" }));
    const d = within(dialog());
    expect(d.getByRole("radio", { name: /PEO A.*\$132 per employee per month/ })).toBeInTheDocument();
    expect(d.getByRole("radio", { name: /PEO B.*\$118 per employee per month/ })).toBeInTheDocument();
    expect(d.queryByRole("radio", { name: /PEO C/ })).not.toBeInTheDocument();
    await userEvent.click(d.getByRole("radio", { name: /PEO B/ }));
    expect(d.getByText("Harborview Dental Group becomes a client.")).toBeInTheDocument();
    expect(d.getByText("PEO C's open quote is closed.")).toBeInTheDocument();
    expect(d.getByText("A renewal for Jan 1, 2028 is added to the account.")).toBeInTheDocument();
  });
});

describe("OpportunityPage: marking won (D-464 to D-466)", () => {
  const openWon = async () => {
    client.getOpportunityPage.mockResolvedValue(quotedPage());
    client.getOpportunityOutcome.mockResolvedValue({ ...noOutcome, quotes: { 12: { closeReason: null, proposedStart: "2027-01-15" }, 13: { closeReason: null, proposedStart: null } } });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Mark won or lost" }));
    return within(dialog());
  };

  // Catches: the defaults of D-465 wrong: the start is the quote's proposed start, else the opportunity's target start; the renewal a year after it; the broker the firm.
  it("defaults the start to the quote's proposed start, else the target start, the renewal a year on, and the broker to the firm", async () => {
    const d = await openWon();
    await userEvent.click(d.getByRole("radio", { name: /PEO B/ }));
    expect(d.getByLabelText("Start date")).toHaveValue("2027-01-01");
    expect(d.getByLabelText("Renewal date")).toHaveValue("2028-01-01");
    expect(d.getByLabelText("Broker of record")).toHaveValue("Acme Benefits");
    await userEvent.click(d.getByRole("radio", { name: /PEO A/ }));
    expect(d.getByLabelText("Start date")).toHaveValue("2027-01-15");
    expect(d.getByLabelText("Renewal date")).toHaveValue("2028-01-15");
  });

  // Catches: a start the person typed overwritten by a later choice of quote.
  it("keeps a start the person typed when they change the quote", async () => {
    const d = await openWon();
    await userEvent.click(d.getByRole("radio", { name: /PEO B/ }));
    await userEvent.clear(d.getByLabelText("Start date"));
    await userEvent.type(d.getByLabelText("Start date"), "2027-03-01");
    await userEvent.click(d.getByRole("radio", { name: /PEO A/ }));
    expect(d.getByLabelText("Start date")).toHaveValue("2027-03-01");
  });

  // Catches: a win sent with no quote chosen, no broker or a renewal not after the start (D-463, D-465): said in words, nothing sent.
  it("asks for the quote and the broker, and for a renewal after the start, before it sends anything", async () => {
    const d = await openWon();
    await userEvent.click(d.getByRole("button", { name: "Mark won" }));
    expect(await d.findByText("Choose the quote the employer took.")).toBeInTheDocument();
    await userEvent.click(d.getByRole("radio", { name: /PEO B/ }));
    await userEvent.clear(d.getByLabelText("Broker of record"));
    await userEvent.clear(d.getByLabelText("Renewal date"));
    await userEvent.type(d.getByLabelText("Renewal date"), "2026-12-01");
    await userEvent.click(d.getByRole("button", { name: "Mark won" }));
    expect(await d.findByText("Say who the broker of record is.")).toBeInTheDocument();
    expect(d.getByText("The renewal must come after the start.")).toBeInTheDocument();
    expect(client.markOpportunityWon).not.toHaveBeenCalled();
  });

  // Catches: the yearly figure not worked from the share, the admin fee of the chosen quote and the employees, or not overwritable (D-466).
  it("works the expected commission out, shows the arithmetic, and lets the person overwrite the figure", async () => {
    const d = await openWon();
    await userEvent.click(d.getByRole("radio", { name: /PEO B/ }));
    await userEvent.selectOptions(d.getByLabelText("Commission basis"), "share");
    await userEvent.type(d.getByLabelText("Share (percent)"), "20");
    expect(d.getByLabelText("Expected commission, a year")).toHaveValue("12744");
    expect(d.getByText("20% × $118 × 45 employees × 12 months = $12,744")).toBeInTheDocument();
    await userEvent.clear(d.getByLabelText("Expected commission, a year"));
    await userEvent.type(d.getByLabelText("Expected commission, a year"), "9000");
    await userEvent.click(d.getByRole("radio", { name: /PEO A/ }));
    expect(d.getByLabelText("Expected commission, a year")).toHaveValue("9000");
  });

  // Catches: the win sent with anything but the version the page loaded (D-46), the chosen quote, the dates, the broker and the commission as typed; and a page left stale.
  it("sends the win with the version, the quote, the placement's dates and broker and the commission, then closes and reloads the page", async () => {
    const d = await openWon();
    client.markOpportunityWon.mockResolvedValue({ conflict: false, stage: "won", version: 5 });
    await userEvent.click(d.getByRole("radio", { name: /PEO B/ }));
    await userEvent.selectOptions(d.getByLabelText("Commission basis"), "share");
    await userEvent.type(d.getByLabelText("Share (percent)"), "20");
    client.getOpportunityPage.mockResolvedValue(quotedPage({}, { stage: "won", version: 5 }));
    await userEvent.click(d.getByRole("button", { name: "Mark won" }));
    await waitFor(() => expect(client.markOpportunityWon).toHaveBeenCalledWith(
      "f1", "o1", { quoteRequestId: 13, startDate: "2027-01-01", renewalDate: "2028-01-01", brokerOfRecord: "Acme Benefits", commission: { basis: "share", rate: 20, expectedYearly: 12744 } }, 4, undefined,
    ));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith("Marked won");
    expect(client.getOpportunityPage.mock.calls.length).toBeGreaterThan(1);
  });

  // Catches: a win with no commission sending a commission (D-466: optional).
  it("sends no commission when none was chosen", async () => {
    const d = await openWon();
    client.markOpportunityWon.mockResolvedValue({ conflict: false, stage: "won", version: 5 });
    await userEvent.click(d.getByRole("radio", { name: /PEO A/ }));
    await userEvent.click(d.getByRole("button", { name: "Mark won" }));
    await waitFor(() => expect(client.markOpportunityWon).toHaveBeenCalledWith("f1", "o1", expect.objectContaining({ quoteRequestId: 12, commission: null }), 4, undefined));
  });

  // Catches: the database's refusal lost: it is said in its own words beside Mark won, and what was typed stays.
  it("says the database's refusal in its own words and keeps what was typed", async () => {
    const d = await openWon();
    client.markOpportunityWon.mockRejectedValue(new OpportunityError("invalid", "The renewal must come after the start."));
    await userEvent.click(d.getByRole("radio", { name: /PEO A/ }));
    await userEvent.click(d.getByRole("button", { name: "Mark won" }));
    expect(await d.findByText("The renewal must come after the start.")).toBeInTheDocument();
    expect(d.getByLabelText("Broker of record")).toHaveValue("Acme Benefits");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  // Catches: a win over someone else's change saved anyway, or the person told nothing (D-46): nothing is saved, the dialog says who changed what and offers a reload.
  it("says who changed the opportunity first, saves nothing, and reloads on request", async () => {
    const d = await openWon();
    client.markOpportunityWon.mockResolvedValue({
      conflict: true, currentVersion: 6, stage: "lost", changed: [{ field: "lost_reason", value: "price", who: "marcus@x.example", at: "2026-11-12T10:00:00+00:00" }],
    });
    await userEvent.click(d.getByRole("radio", { name: /PEO A/ }));
    await userEvent.click(d.getByRole("button", { name: "Mark won" }));
    expect(await d.findByText("Someone else changed this opportunity")).toBeInTheDocument();
    expect(d.getByText(/It is now Lost\. Nothing was saved\./)).toBeInTheDocument();
    expect(d.getByText(/Lost reason changed by marcus@x\.example/)).toBeInTheDocument();
    client.getOpportunityPage.mockResolvedValue(quotedPage({}, { stage: "lost", version: 6 }));
    await userEvent.click(d.getByRole("button", { name: "Reload the opportunity" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByRole("region", { name: "Outcome" })).toHaveTextContent("Lost");
  });
});

describe("OpportunityPage: marking lost (D-468)", () => {
  const openLost = async () => {
    client.getOpportunityPage.mockResolvedValue(quotedPage());
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Mark won or lost" }));
    const d = within(dialog());
    await userEvent.click(d.getByRole("radio", { name: /Lost/ }));
    return d;
  };

  // Catches: a reason that is free text, or a list that is not the agreed one (D-468).
  it("asks for a reason from the fixed list", async () => {
    const d = await openLost();
    const options = within(d.getByLabelText("Reason")).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Choose a reason", "Stayed with current provider", "Price", "Went direct to a PEO", "No decision", "Other"]);
    await userEvent.click(d.getByRole("button", { name: "Mark lost" }));
    expect(await d.findByText("Choose why the search was lost.")).toBeInTheDocument();
    expect(client.markOpportunityLost).not.toHaveBeenCalled();
  });

  // Catches: Other accepted with no note (D-468), or a note over 500 characters sent to be refused.
  it("requires a note for Other, at most 500 characters", async () => {
    const d = await openLost();
    await userEvent.selectOptions(d.getByLabelText("Reason"), "other");
    await userEvent.click(d.getByRole("button", { name: "Mark lost" }));
    expect(await d.findByText("Say what happened. Other needs a note.")).toBeInTheDocument();
    await userEvent.click(d.getByLabelText("Note"));
    await userEvent.paste("x".repeat(501));
    await userEvent.click(d.getByRole("button", { name: "Mark lost" }));
    expect(await d.findByText("Keep the note to 500 characters.")).toBeInTheDocument();
    expect(client.markOpportunityLost).not.toHaveBeenCalled();
  });

  // Catches: the loss sent with the wrong version or without the reason and note as typed.
  it("sends the loss with the reason, the note and the version, then closes", async () => {
    const d = await openLost();
    client.markOpportunityLost.mockResolvedValue({ conflict: false, stage: "lost", version: 5 });
    await userEvent.selectOptions(d.getByLabelText("Reason"), "other");
    await userEvent.type(d.getByLabelText("Note"), "Closed the practice");
    await userEvent.click(d.getByRole("button", { name: "Mark lost" }));
    await waitFor(() => expect(client.markOpportunityLost).toHaveBeenCalledWith("f1", "o1", { reason: "other", note: "Closed the practice" }, 4, undefined));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith("Marked lost");
  });
});

describe("OpportunityPage: the won or lost banner (D-426, D-472)", () => {
  const wonPage = (over: Partial<Page> = {}, o: Partial<typeof opportunity> = {}) => quotedPage(over, { stage: "won", ...o });

  // Catches: the banner wording (D-472) or the commission line (D-467) wrong: PEO, start, renewal, expected a year and received to date.
  it("shows Won with the PEO, the start and the renewal, and the commission expected and received", async () => {
    client.getOpportunityPage.mockResolvedValue(wonPage());
    client.getOpportunityOutcome.mockResolvedValue(wonOutcome);
    renderPage();
    const banner = await screen.findByRole("region", { name: "Outcome" });
    expect(banner).toHaveTextContent("Won · PEO B · from Jan 1, 2027 · renews Jan 1, 2028");
    expect(within(banner).getByText("Commission: $12,744 expected a year · $1,500 received so far")).toBeInTheDocument();
  });

  // Catches: a win with no commission expected showing "$0" or "undefined".
  it("says no commission is expected when none was recorded", async () => {
    client.getOpportunityPage.mockResolvedValue(wonPage());
    client.getOpportunityOutcome.mockResolvedValue({ ...wonOutcome, placement: { ...closedPlacement, commission: null }, payments: [], receivedToDate: 0 });
    renderPage();
    expect(await screen.findByText("Commission: none expected recorded")).toBeInTheDocument();
  });

  // Catches: the lost reason shown as its stored code, or a loss with no banner.
  it("shows Lost with the reason in words", async () => {
    client.getOpportunityPage.mockResolvedValue(quotedPage({}, { stage: "lost" }));
    client.getOpportunityOutcome.mockResolvedValue({ ...noOutcome, lostReason: "went_direct" });
    renderPage();
    expect(await screen.findByRole("region", { name: "Outcome" })).toHaveTextContent("Lost · Went direct to a PEO");
  });

  // Catches: a closed opportunity drawn with no banner because the outcome could not be read: it says so and offers Try again, it does not pass for open.
  it("says when how it ended could not be read, and tries again", async () => {
    client.getOpportunityPage.mockResolvedValue(wonPage());
    client.getOpportunityOutcome.mockRejectedValueOnce(new Error("boom"));
    client.getOpportunityOutcome.mockResolvedValue(wonOutcome);
    renderPage();
    const banner = await screen.findByRole("region", { name: "Outcome" });
    expect(await within(banner).findByText(/Couldn.t load how this opportunity ended/)).toBeInTheDocument();
    await userEvent.click(within(banner).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/Won · PEO B/)).toBeInTheDocument();
  });

  // Catches: Reopen shown to someone D-462 does not allow (an agent who is not the opportunity's owner), or hidden from the owner and a firm owner.
  it("offers Reopen to the opportunity's owner and a firm owner, and to no one else", async () => {
    client.getOpportunityOutcome.mockResolvedValue(wonOutcome);
    client.getOpportunityPage.mockResolvedValue(wonPage());
    renderPage();
    await screen.findByRole("region", { name: "Outcome" });
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
    cleanup();

    client.getOpportunityPage.mockResolvedValue(wonPage({}, { ownerId: "u2" }));
    renderPage("/opportunities/o1", workspace());
    await screen.findByRole("region", { name: "Outcome" });
    expect(screen.queryByRole("button", { name: "Reopen" })).not.toBeInTheDocument();
    cleanup();

    renderPage("/opportunities/o1", workspace({ isOwner: true, role: "Owner" }));
    await screen.findByRole("region", { name: "Outcome" });
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
  });

  // Catches: Reopen shown on an archived account or in a support session, where the database refuses it.
  it("offers no Reopen or Record a payment on an archived account or in a support session", async () => {
    client.getOpportunityOutcome.mockResolvedValue(wonOutcome);
    client.getOpportunityPage.mockResolvedValue(wonPage({ account: { id: "a1", name: "Harborview Dental Group", archived: true }, canAdd: false, canChange: false }));
    renderPage();
    await screen.findByRole("region", { name: "Outcome" });
    expect(screen.queryByRole("button", { name: "Reopen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record a payment" })).not.toBeInTheDocument();
  });

  // Catches: a reopen with no question first (it deletes the placement and the renewal), or sent from a stale version (D-469).
  it("asks before reopening, says what it undoes, and reopens from the version loaded", async () => {
    client.getOpportunityPage.mockResolvedValue(wonPage());
    client.getOpportunityOutcome.mockResolvedValue(wonOutcome);
    client.reopenOpportunity.mockResolvedValue({ conflict: false, stage: "quoted", version: 6 });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Reopen" }));
    const d = within(screen.getByRole("alertdialog"));
    expect(d.getByText(/placement and the renewal made with the win are deleted/)).toBeInTheDocument();
    expect(client.reopenOpportunity).not.toHaveBeenCalled();
    client.getOpportunityPage.mockResolvedValue(quotedPage({}, { stage: "quoted", version: 6 }));
    await userEvent.click(d.getByRole("button", { name: "Reopen" }));
    await waitFor(() => expect(client.reopenOpportunity).toHaveBeenCalledWith("f1", "o1", 4));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Outcome" })).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith("Reopened");
  });

  // Catches: the reopen's refusals (a renewal being worked, payments to delete first) hidden: they are said in the database's words and nothing closes.
  it("says why a reopen was refused, in the database's words", async () => {
    client.getOpportunityPage.mockResolvedValue(wonPage());
    client.getOpportunityOutcome.mockResolvedValue(wonOutcome);
    client.reopenOpportunity.mockRejectedValue(new OpportunityError("invalid", "Delete its payments first", "PT409"));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Reopen" }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Reopen" }));
    expect(await screen.findByText("Delete its payments first")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Outcome", hidden: true })).toBeInTheDocument();
  });

  // Catches: a close reason (D-424) missing from a closed quote in the Quotes panel, or shown as the stored code.
  it("shows a closed quote's close reason in the Quotes panel", async () => {
    client.getOpportunityPage.mockResolvedValue(wonPage({ quotes: [quotedQuote(13, "PEO B", 118), { ...quotedQuote(14, "PEO C", null), status: "closed" }] }));
    client.getOpportunityOutcome.mockResolvedValue({ ...wonOutcome, quotes: { 13: { closeReason: null, proposedStart: null }, 14: { closeReason: "went_elsewhere", proposedStart: null } } });
    renderPage();
    const row = (await screen.findByRole("link", { name: "PEO C" })).closest("tr") as HTMLElement;
    expect(await within(row).findByText(/The employer went elsewhere/)).toBeInTheDocument();
  });
});

describe("OpportunityPage: Record a payment (D-467)", () => {
  const openPayment = async (ws: Workspace = workspace()) => {
    client.getOpportunityPage.mockResolvedValue(quotedPage({}, { stage: "won" }));
    client.getOpportunityOutcome.mockResolvedValue(wonOutcome);
    renderPage("/opportunities/o1", ws);
    await userEvent.click(await screen.findByRole("button", { name: "Record a payment" }));
    return within(dialog());
  };

  // Catches: a payment with no day or an amount of zero or less sent to be refused (D-467: an amount above zero), or a note over 500 characters.
  it("asks for the day and an amount above zero before it sends anything", async () => {
    const d = await openPayment();
    await userEvent.clear(d.getByLabelText("Received on"));
    await userEvent.type(d.getByLabelText("Amount"), "0");
    await userEvent.click(d.getByRole("button", { name: "Record payment" }));
    expect(await d.findByText("Enter the day it was received, like 2027-02-10.")).toBeInTheDocument();
    expect(d.getByText("Enter an amount above zero, like 1500.")).toBeInTheDocument();
    expect(client.recordCommissionPayment).not.toHaveBeenCalled();
  });

  // Catches: the payment sent to the wrong placement, the amount as text, or the banner left showing the old total.
  it("records the payment against the placement, and the banner shows what is received to date", async () => {
    const d = await openPayment();
    client.recordCommissionPayment.mockResolvedValue({ receivedToDate: 2500, expectedYearly: 12744 });
    await userEvent.clear(d.getByLabelText("Received on"));
    await userEvent.type(d.getByLabelText("Received on"), "2027-03-10");
    await userEvent.type(d.getByLabelText("Amount"), "1000");
    await userEvent.type(d.getByLabelText("Note"), "Second");
    client.getOpportunityOutcome.mockResolvedValue({ ...wonOutcome, receivedToDate: 2500 });
    await userEvent.click(d.getByRole("button", { name: "Record payment" }));
    await waitFor(() => expect(client.recordCommissionPayment).toHaveBeenCalledWith("f1", "pl1", { receivedOn: "2027-03-10", amount: 1000, note: "Second" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith("Payment recorded");
    expect(await screen.findByText("Commission: $12,744 expected a year · $2,500 received so far")).toBeInTheDocument();
  });

  // Catches: the database's refusal (a level rule, an archived account) lost.
  it("says the database's refusal in its own words", async () => {
    const d = await openPayment();
    client.recordCommissionPayment.mockRejectedValue(new OpportunityError("notAllowed", "Only the opportunity's owner can record commission."));
    await userEvent.type(d.getByLabelText("Amount"), "1000");
    await userEvent.click(d.getByRole("button", { name: "Record payment" }));
    expect(await d.findByText("Only the opportunity's owner can record commission.")).toBeInTheDocument();
  });

  // Catches: Record a payment shown to someone who may not change the opportunity.
  it("is offered only to whoever may change the opportunity", async () => {
    client.getOpportunityPage.mockResolvedValue(quotedPage({ canChange: false }, { stage: "won" }));
    client.getOpportunityOutcome.mockResolvedValue(wonOutcome);
    renderPage();
    await screen.findByRole("region", { name: "Outcome" });
    expect(screen.queryByRole("button", { name: "Record a payment" })).not.toBeInTheDocument();
  });
});


// ---------- CRM-O1.3b review: the version a dialog opens from, payments, commission, and the small things ----------

describe("OpportunityPage: Reopen sends the version its dialog opened from (D-46, P1)", () => {
  const wonPage = (o: Partial<typeof opportunity> = {}) => quotedPage({}, { stage: "won", ...o });

  // Catches: Reopen sending the page query's live version, which a background refetch moves: a Reopen the person opened from an older view then passes D-46 and undoes
  // a newer win.
  it("sends the version the dialog opened from, though the page has been read again with a higher one meanwhile", async () => {
    client.getOpportunityPage.mockResolvedValue(wonPage());
    client.getOpportunityOutcome.mockResolvedValue(wonOutcome);
    client.reopenOpportunity.mockResolvedValue({ conflict: false, stage: "quoted", version: 7 });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Reopen" }));
    const d = within(screen.getByRole("alertdialog"));
    client.getOpportunityPage.mockResolvedValue(wonPage({ version: 6 }));
    await act(async () => { await queryClient.refetchQueries({ queryKey: ["opportunity", "f1", "o1", "page"] }); });
    expect(client.getOpportunityPage).toHaveBeenCalledTimes(2);
    await userEvent.click(d.getByRole("button", { name: "Reopen" }));
    await waitFor(() => expect(client.reopenOpportunity).toHaveBeenCalledWith("f1", "o1", 4));
  });

  // Catches: the conflict answer shown and the dialog left on the old version (a second press can never go through), or moved before the person has seen who changed what.
  it("says who changed what on a conflict, and sends the version it named only from the next press", async () => {
    client.getOpportunityPage.mockResolvedValue(wonPage());
    client.getOpportunityOutcome.mockResolvedValue(wonOutcome);
    client.reopenOpportunity.mockResolvedValueOnce({
      conflict: true, currentVersion: 6, stage: "won", changed: [{ field: "won_at", value: "2026-11-12T10:00:00+00:00", who: "marcus@x.example", at: "2026-11-12T10:00:00+00:00" }],
    });
    client.reopenOpportunity.mockResolvedValue({ conflict: false, stage: "quoted", version: 7 });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Reopen" }));
    const d = within(screen.getByRole("alertdialog"));
    await userEvent.click(d.getByRole("button", { name: "Reopen" }));
    expect(await d.findByText(/Someone else changed this opportunity first\. It is now Won\. Nothing was reopened\./)).toBeInTheDocument();
    expect(d.getByText(/Won on changed by marcus@x\.example/)).toBeInTheDocument();
    expect(client.reopenOpportunity).toHaveBeenCalledTimes(1);
    expect(client.reopenOpportunity).toHaveBeenLastCalledWith("f1", "o1", 4);
    await userEvent.click(d.getByRole("button", { name: "Reopen" }));
    await waitFor(() => expect(client.reopenOpportunity).toHaveBeenLastCalledWith("f1", "o1", 6));
  });
});

describe("OpportunityPage: payments can be edited and deleted (D-467)", () => {
  const openBanner = async (ws: Workspace = workspace(), p: Page = quotedPage({}, { stage: "won" })) => {
    client.getOpportunityPage.mockResolvedValue(p);
    client.getOpportunityOutcome.mockResolvedValue({
      ...wonOutcome, payments: [{ id: "p1", receivedOn: "2027-02-10", amount: 1500, note: "First", version: 1 }, { id: "p2", receivedOn: "2027-03-10", amount: 500, note: null, version: 3 }], receivedToDate: 2000,
    });
    renderPage("/opportunities/o1", ws);
    return within(await screen.findByRole("region", { name: "Outcome" }));
  };
  const conflictAnswer = { conflict: true, currentVersion: 4, current: { receivedOn: "2027-02-11", amount: 1600, note: "Moved" }, changed: [{ field: "amount", value: 1600, who: "marcus@x.example", at: "2026-11-12T10:00:00+00:00" }] };

  // Catches: after one payment Reopen is refused ("Delete its payments first") with no screen that can delete one: each payment listed with Edit and Delete.
  it("lists each payment with its day, amount and note, and Edit and Delete", async () => {
    const banner = await openBanner();
    const rows = within(banner.getByRole("list", { name: "Payments received" })).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("Feb 10, 2027 · $1,500 · First"), expect.stringContaining("Mar 10, 2027 · $500"),
    ]);
    expect(within(rows[0]).getByRole("button", { name: /Edit the payment of \$1,500/ })).toBeInTheDocument();
    expect(within(rows[0]).getByRole("button", { name: /Delete the payment of \$1,500/ })).toBeInTheDocument();
  });

  // Catches: Edit and Delete offered where Record a payment is not: a person who may not change the opportunity, an archived account.
  it("offers them only as Record a payment is offered", async () => {
    const banner = await openBanner(workspace(), quotedPage({ canChange: false }, { stage: "won" }));
    expect(banner.getByRole("list", { name: "Payments received" })).toBeInTheDocument();
    expect(banner.queryByRole("button", { name: /Edit the payment/ })).not.toBeInTheDocument();
    expect(banner.queryByRole("button", { name: /Delete the payment/ })).not.toBeInTheDocument();
  });

  // Catches: an edit that sends the wrong payment, the amount as text, or no version; the banner left showing the old total.
  it("edits a payment from the version it was opened at, and the banner shows what is received to date", async () => {
    const banner = await openBanner();
    await userEvent.click(banner.getByRole("button", { name: /Edit the payment of \$1,500/ }));
    const d = within(dialog());
    expect(d.getByLabelText("Received on")).toHaveValue("2027-02-10");
    expect(d.getByLabelText("Amount")).toHaveValue("1500");
    expect(d.getByLabelText("Note")).toHaveValue("First");
    client.updateCommissionPayment.mockResolvedValue({ conflict: false, receivedToDate: 1900, expectedYearly: 12744 });
    await userEvent.clear(d.getByLabelText("Amount"));
    await userEvent.type(d.getByLabelText("Amount"), "1400");
    client.getOpportunityOutcome.mockResolvedValue({ ...wonOutcome, receivedToDate: 1900 });
    await userEvent.click(d.getByRole("button", { name: "Save payment" }));
    await waitFor(() => expect(client.updateCommissionPayment).toHaveBeenCalledWith("f1", "p1", { receivedOn: "2027-02-10", amount: 1400, note: "First" }, 1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith("Payment saved");
    expect(await screen.findByText("Commission: $12,744 expected a year · $1,900 received so far")).toBeInTheDocument();
  });

  // Catches: the same rules as Record a payment skipped on edit (an amount of zero sent to be refused).
  it("asks for the day and an amount above zero before it sends anything", async () => {
    const banner = await openBanner();
    await userEvent.click(banner.getByRole("button", { name: /Edit the payment of \$1,500/ }));
    const d = within(dialog());
    await userEvent.clear(d.getByLabelText("Amount"));
    await userEvent.type(d.getByLabelText("Amount"), "0");
    await userEvent.click(d.getByRole("button", { name: "Save payment" }));
    expect(await d.findByText("Enter an amount above zero, like 1500.")).toBeInTheDocument();
    expect(client.updateCommissionPayment).not.toHaveBeenCalled();
  });

  // Catches: the conflict answer lost (an edit over someone else's change saved unseen, or a bare failure): the person is told who changed what, keeps what they typed, and the
  // next save starts from the version the answer named.
  it("says who changed the payment first, keeps what was typed, and saves again from the version named", async () => {
    const banner = await openBanner();
    await userEvent.click(banner.getByRole("button", { name: /Edit the payment of \$1,500/ }));
    const d = within(dialog());
    client.updateCommissionPayment.mockResolvedValueOnce(conflictAnswer);
    client.updateCommissionPayment.mockResolvedValue({ conflict: false, receivedToDate: 2100, expectedYearly: null });
    await userEvent.clear(d.getByLabelText("Amount"));
    await userEvent.type(d.getByLabelText("Amount"), "1400");
    await userEvent.click(d.getByRole("button", { name: "Save payment" }));
    expect(await d.findByText(/Someone else changed this payment first/)).toBeInTheDocument();
    expect(d.getByText(/Amount changed by marcus@x\.example/)).toBeInTheDocument();
    expect(d.getByLabelText("Amount")).toHaveValue("1400");
    await userEvent.click(d.getByRole("button", { name: "Save payment" }));
    await waitFor(() => expect(client.updateCommissionPayment).toHaveBeenLastCalledWith("f1", "p1", { receivedOn: "2027-02-10", amount: 1400, note: "First" }, 4));
  });

  // Catches: Delete with no question (the money record is gone), or Cancel deleting it.
  it("asks before deleting, naming the payment, and deletes nothing on Cancel", async () => {
    const banner = await openBanner();
    await userEvent.click(banner.getByRole("button", { name: /Delete the payment of \$1,500/ }));
    const d = within(screen.getByRole("alertdialog"));
    expect(d.getByText("Delete this payment?")).toBeInTheDocument();
    expect(d.getByText(/\$1,500 received Feb 10, 2027/)).toBeInTheDocument();
    await userEvent.click(d.getByRole("button", { name: "Cancel" }));
    expect(client.deleteCommissionPayment).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  // Catches: the delete not versioned (a payment someone else changed deleted unseen), or the banner not following.
  it("deletes from the version it was seen at, then reads the outcome again", async () => {
    const banner = await openBanner();
    await userEvent.click(banner.getByRole("button", { name: /Delete the payment of \$500/ }));
    client.deleteCommissionPayment.mockResolvedValue({ conflict: false, receivedToDate: 1500 });
    client.getOpportunityOutcome.mockResolvedValue({ ...wonOutcome, receivedToDate: 1500 });
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete payment" }));
    await waitFor(() => expect(client.deleteCommissionPayment).toHaveBeenCalledWith("f1", "p2", 3));
    expect(toast.success).toHaveBeenCalledWith("Payment deleted");
    expect(await screen.findByText("Commission: $12,744 expected a year · $1,500 received so far")).toBeInTheDocument();
  });

  // Catches: a delete over someone else's change done anyway, or silent.
  it("says who changed the payment first and deletes nothing, then deletes from the version named", async () => {
    const banner = await openBanner();
    await userEvent.click(banner.getByRole("button", { name: /Delete the payment of \$1,500/ }));
    const d = within(screen.getByRole("alertdialog"));
    client.deleteCommissionPayment.mockResolvedValueOnce(conflictAnswer);
    client.deleteCommissionPayment.mockResolvedValue({ conflict: false, receivedToDate: 500 });
    await userEvent.click(d.getByRole("button", { name: "Delete payment" }));
    expect(await d.findByText(/Someone else changed this payment first\. Nothing was deleted\./)).toBeInTheDocument();
    expect(d.getByText(/Amount changed by marcus@x\.example/)).toBeInTheDocument();
    await userEvent.click(d.getByRole("button", { name: "Delete payment" }));
    await waitFor(() => expect(client.deleteCommissionPayment).toHaveBeenLastCalledWith("f1", "p1", 4));
  });

  it("says the database's refusal of a delete in its own words", async () => {
    const banner = await openBanner();
    await userEvent.click(banner.getByRole("button", { name: /Delete the payment of \$1,500/ }));
    client.deleteCommissionPayment.mockRejectedValue(new OpportunityError("notAllowed", "Only the opportunity's owner can change its payments."));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete payment" }));
    expect(await screen.findByText("Only the opportunity's owner can change its payments.")).toBeInTheDocument();
  });
});

describe("OpportunityPage: adding or changing the commission later (D-466)", () => {
  const openBanner = async (commission: typeof closedPlacement.commission | null, p: Page = quotedPage({}, { stage: "won" })) => {
    client.getOpportunityPage.mockResolvedValue(p);
    client.getOpportunityOutcome.mockResolvedValue({ ...wonOutcome, placement: { ...closedPlacement, commission, version: 2 }, payments: [], receivedToDate: 0 });
    renderPage();
    return within(await screen.findByRole("region", { name: "Outcome" }));
  };

  // Catches: no way to add the commission to a win made without one, or the same words for adding and changing.
  it("offers Add commission when none is recorded and Change commission when there is one", async () => {
    let banner = await openBanner(null);
    expect(await banner.findByRole("button", { name: "Add commission" })).toBeInTheDocument();
    cleanup();
    banner = await openBanner(closedPlacement.commission);
    expect(await banner.findByRole("button", { name: "Change commission" })).toBeInTheDocument();
  });

  // Catches: offered to someone who may not change the opportunity.
  it("is offered only as Record a payment is", async () => {
    const banner = await openBanner(null, quotedPage({ canChange: false }, { stage: "won" }));
    await banner.findByText("Commission: none expected recorded");
    expect(banner.queryByRole("button", { name: /commission$/ })).not.toBeInTheDocument();
  });

  // Catches: the commission saved against the wrong placement or version, or the figure not worked from the quote that was won (the placement's PEO) and the employees.
  it("adds the commission worked from the won quote, versioned on the placement", async () => {
    const banner = await openBanner(null);
    await userEvent.click(await banner.findByRole("button", { name: "Add commission" }));
    const d = within(dialog());
    client.setPlacementCommission.mockResolvedValue({ conflict: false, commission: { basis: "share", rate: 20, expectedYearly: 12744 }, version: 3 });
    await userEvent.selectOptions(d.getByLabelText("Commission basis"), "share");
    await userEvent.type(d.getByLabelText("Share (percent)"), "20");
    expect(d.getByLabelText("Expected commission, a year")).toHaveValue("12744");
    expect(d.getByText("20% × $118 × 45 employees × 12 months = $12,744")).toBeInTheDocument();
    client.getOpportunityOutcome.mockResolvedValue({ ...wonOutcome, placement: { ...closedPlacement, version: 3 } });
    await userEvent.click(d.getByRole("button", { name: "Save commission" }));
    await waitFor(() => expect(client.setPlacementCommission).toHaveBeenCalledWith("f1", "pl1", { basis: "share", rate: 20, expectedYearly: 12744 }, 2));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith("Commission saved");
  });

  // Catches: a change that starts empty (the person retypes what is there), or cannot clear it.
  it("starts from the commission there is, and clears it with None recorded", async () => {
    const banner = await openBanner(closedPlacement.commission);
    await userEvent.click(await banner.findByRole("button", { name: "Change commission" }));
    const d = within(dialog());
    expect(d.getByLabelText("Commission basis")).toHaveValue("share");
    expect(d.getByLabelText("Share (percent)")).toHaveValue("20");
    expect(d.getByLabelText("Expected commission, a year")).toHaveValue("12744");
    client.setPlacementCommission.mockResolvedValue({ conflict: false, commission: null, version: 3 });
    await userEvent.selectOptions(d.getByLabelText("Commission basis"), "");
    await userEvent.click(d.getByRole("button", { name: "Save commission" }));
    await waitFor(() => expect(client.setPlacementCommission).toHaveBeenCalledWith("f1", "pl1", null, 2));
  });

  it("asks for the number before it sends anything", async () => {
    const banner = await openBanner(null);
    await userEvent.click(await banner.findByRole("button", { name: "Add commission" }));
    const d = within(dialog());
    await userEvent.selectOptions(d.getByLabelText("Commission basis"), "flat");
    await userEvent.click(d.getByRole("button", { name: "Save commission" }));
    expect(await d.findByText("Enter the commission's number, like 20.")).toBeInTheDocument();
    expect(client.setPlacementCommission).not.toHaveBeenCalled();
  });

  // Catches: someone else's change to the commission overwritten unseen, or reported as a bare failure.
  it("says who changed the commission first, and saves again from the version named", async () => {
    const banner = await openBanner(closedPlacement.commission);
    await userEvent.click(await banner.findByRole("button", { name: "Change commission" }));
    const d = within(dialog());
    client.setPlacementCommission.mockResolvedValueOnce({
      conflict: true, currentVersion: 5, current: { basis: "share", rate: 25, expectedYearly: null }, changed: [{ field: "commission_rate", value: 25, who: "marcus@x.example", at: "2026-11-12T10:00:00+00:00" }],
    });
    client.setPlacementCommission.mockResolvedValue({ conflict: false, commission: { basis: "share", rate: 20, expectedYearly: 12744 }, version: 6 });
    await userEvent.click(d.getByRole("button", { name: "Save commission" }));
    expect(await d.findByText(/Someone else changed this commission first/)).toBeInTheDocument();
    expect(d.getByText(/Commission rate changed by marcus@x\.example/)).toBeInTheDocument();
    await userEvent.click(d.getByRole("button", { name: "Save commission" }));
    await waitFor(() => expect(client.setPlacementCommission).toHaveBeenLastCalledWith("f1", "pl1", expect.anything(), 5));
  });
});

describe("OpportunityPage: the close dialog's small things (P3)", () => {
  const openWith = async (p: Page, outcome: unknown = { ...noOutcome, quotes: { 12: { closeReason: null, proposedStart: "2027-01-15" }, 13: { closeReason: null, proposedStart: null } } }) => {
    client.getOpportunityPage.mockResolvedValue(p);
    client.getOpportunityOutcome.mockResolvedValue(outcome);
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Mark won or lost" }));
    return within(dialog());
  };

  // Catches: the default start taken from the target start when the dialog opened before the outcome loaded, and never corrected (the quote's proposed start arrives late).
  it("corrects an untouched default start when the outcome arrives after the dialog opened", async () => {
    let arrive: (v: unknown) => void = () => undefined;
    client.getOpportunityPage.mockResolvedValue(quotedPage({ quotes: [quotedQuote(12, "PEO A", 132)] }));
    client.getOpportunityOutcome.mockReturnValue(new Promise((resolve) => { arrive = resolve; }));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Mark won or lost" }));
    const d = within(dialog());
    expect(d.getByLabelText("Start date")).toHaveValue("2027-01-01");
    await act(async () => { arrive({ ...noOutcome, quotes: { 12: { closeReason: null, proposedStart: "2027-01-15" } } }); });
    await waitFor(() => expect(d.getByLabelText("Start date")).toHaveValue("2027-01-15"));
    expect(d.getByLabelText("Renewal date")).toHaveValue("2028-01-15");
  });

  // Catches: the late default overwriting a start the person had already typed.
  it("keeps a start the person typed when the outcome arrives", async () => {
    let arrive: (v: unknown) => void = () => undefined;
    client.getOpportunityPage.mockResolvedValue(quotedPage({ quotes: [quotedQuote(12, "PEO A", 132)] }));
    client.getOpportunityOutcome.mockReturnValue(new Promise((resolve) => { arrive = resolve; }));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Mark won or lost" }));
    const d = within(dialog());
    await userEvent.clear(d.getByLabelText("Start date"));
    await userEvent.type(d.getByLabelText("Start date"), "2027-03-01");
    await act(async () => { arrive({ ...noOutcome, quotes: { 12: { closeReason: null, proposedStart: "2027-01-15" } } }); });
    expect(d.getByLabelText("Start date")).toHaveValue("2027-03-01");
  });

  // Catches: a typed expected commission that survives a change of the basis or the number, so the figure shown is not the arithmetic beside it.
  it("works the expected commission out again when the basis or the number changes, discarding a figure typed over it", async () => {
    const d = await openWith(quotedPage());
    await userEvent.click(d.getByRole("radio", { name: /PEO B/ }));
    await userEvent.selectOptions(d.getByLabelText("Commission basis"), "share");
    await userEvent.type(d.getByLabelText("Share (percent)"), "20");
    await userEvent.clear(d.getByLabelText("Expected commission, a year"));
    await userEvent.type(d.getByLabelText("Expected commission, a year"), "9000");
    await userEvent.clear(d.getByLabelText("Share (percent)"));
    await userEvent.type(d.getByLabelText("Share (percent)"), "25");
    expect(d.getByLabelText("Expected commission, a year")).toHaveValue("15930");
    await userEvent.clear(d.getByLabelText("Expected commission, a year"));
    await userEvent.type(d.getByLabelText("Expected commission, a year"), "9000");
    await userEvent.selectOptions(d.getByLabelText("Commission basis"), "per_employee");
    expect(d.getByLabelText("Expected commission, a year")).toHaveValue("13500");
  });

  // Catches: a broker field that stops at 200 where the database stops at 120 (a name accepted here and refused after the person filled in the rest).
  it("stops the broker of record at 120 characters, as the database does", async () => {
    const d = await openWith(quotedPage());
    expect(d.getByLabelText("Broker of record")).toHaveAttribute("maxlength", "120");
  });

  // Catches: a radio group named by a label on a div (read as a lone label, not a group) and an error that cannot take focus.
  it("names each radio group by a legend, and moves focus to the first radio of the first one in error", async () => {
    const d = await openWith(quotedPage());
    expect(d.getByRole("group", { name: "Outcome" })).toBeInTheDocument();
    expect(d.getByRole("group", { name: "Which quote did they take?" })).toBeInTheDocument();
    await userEvent.click(d.getByRole("button", { name: "Mark won" }));
    expect(await d.findByText("Choose the quote the employer took.")).toBeInTheDocument();
    await waitFor(() => expect(d.getByRole("radio", { name: /PEO A/ })).toHaveFocus());
  });

  // Catches: the conflict notice naming raw columns ("owner id", "main contact id", "lost by"): the page's own words for each field.
  it("words the fields of a conflict as the page does", async () => {
    const d = await openWith(quotedPage());
    client.markOpportunityWon.mockResolvedValue({
      conflict: true, currentVersion: 6, stage: "quoted",
      changed: ["owner_id", "main_contact_id", "next_step", "won_at", "lost_by"].map((field) => ({ field, value: null, who: "marcus@x.example", at: "2026-11-12T10:00:00+00:00" })),
    });
    await userEvent.click(d.getByRole("radio", { name: /PEO A/ }));
    await userEvent.click(d.getByRole("button", { name: "Mark won" }));
    expect(await d.findByText("Someone else changed this opportunity")).toBeInTheDocument();
    const lines = within(d.getByRole("list")).getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(lines.map((l) => l.split(" changed by")[0])).toEqual(["Owner", "Main contact", "Next step", "Won on", "Lost by"]);
  });
});

describe("OpportunityPage: Reopen only where it can work (P3)", () => {
  // Catches: Reopen offered on a submission archived from a stage other than Won or Lost: it reads as Lost, has no lost reason, and the database refuses the reopen.
  it("offers no Reopen for a Lost that has an intake and no lost reason, and says to restore it from the submission", async () => {
    client.getOpportunityPage.mockResolvedValue(quotedPage({}, { stage: "lost", submissionId: "i1" }));
    client.getOpportunityOutcome.mockResolvedValue(noOutcome);
    renderPage();
    const banner = within(await screen.findByRole("region", { name: "Outcome" }));
    expect(await banner.findByText(/Restore it from/)).toHaveTextContent("Restore it from the submission's page.");
    expect(banner.getByRole("link", { name: "the submission's page" })).toHaveAttribute("href", "/advisor/submissions/i1");
    expect(banner.queryByRole("button", { name: "Reopen" })).not.toBeInTheDocument();
  });

  // Catches: Reopen hidden where it works: a loss with its reason, or an opportunity lost with no intake (its own mark).
  it("keeps Reopen for a loss with a reason, and for one with no intake", async () => {
    client.getOpportunityPage.mockResolvedValue(quotedPage({}, { stage: "lost" }));
    client.getOpportunityOutcome.mockResolvedValue({ ...noOutcome, lostReason: "price" });
    renderPage();
    expect(await screen.findByRole("button", { name: "Reopen" })).toBeInTheDocument();
    cleanup();
    client.getOpportunityPage.mockResolvedValue(quotedPage({ intake: null }, { stage: "lost", submissionId: null }));
    client.getOpportunityOutcome.mockResolvedValue(noOutcome);
    renderPage();
    expect(await screen.findByRole("button", { name: "Reopen" })).toBeInTheDocument();
    expect(screen.queryByText(/Restore it from/)).not.toBeInTheDocument();
  });

  // Catches: Reopen offered for a lost opportunity with an intake before the outcome has loaded, when it cannot yet be known that it can work.
  it("offers no Reopen for such a Lost until the outcome has loaded", async () => {
    let arrive: (v: unknown) => void = () => undefined;
    client.getOpportunityPage.mockResolvedValue(quotedPage({}, { stage: "lost" }));
    client.getOpportunityOutcome.mockReturnValue(new Promise((resolve) => { arrive = resolve; }));
    renderPage();
    await screen.findByRole("region", { name: "Outcome" });
    expect(screen.queryByRole("button", { name: "Reopen" })).not.toBeInTheDocument();
    await act(async () => { arrive({ ...noOutcome, lostReason: "price" }); });
    expect(await screen.findByRole("button", { name: "Reopen" })).toBeInTheDocument();
  });
});

describe("OpportunityPage: what a close, a reopen and a payment ask again (P3)", () => {
  // Catches: the accounts table (its status column, its renewals) and the submission read the quotes panel uses left stale after an outcome changes.
  it("asks the accounts table and the submission read again after a reopen, a payment and a win", async () => {
    client.getOpportunityPage.mockResolvedValue(quotedPage({}, { stage: "won" }));
    client.getOpportunityOutcome.mockResolvedValue(wonOutcome);
    client.reopenOpportunity.mockResolvedValue({ conflict: false, stage: "quoted", version: 6 });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Reopen" }));
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Reopen" }));
    await waitFor(() => expect(client.reopenOpportunity).toHaveBeenCalled());
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ["table", "f1", "accounts"] }));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["opportunity-needs", "f1", "i1"] });
  });

  it("does the same after a payment is recorded", async () => {
    client.getOpportunityPage.mockResolvedValue(quotedPage({}, { stage: "won" }));
    client.getOpportunityOutcome.mockResolvedValue(wonOutcome);
    client.recordCommissionPayment.mockResolvedValue({ receivedToDate: 2500, expectedYearly: 12744 });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Record a payment" }));
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    await userEvent.type(within(dialog()).getByLabelText("Amount"), "1000");
    await userEvent.click(within(dialog()).getByRole("button", { name: "Record payment" }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ["table", "f1", "accounts"] }));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["opportunity-needs", "f1", "i1"] });
  });

  it("does the same after a win", async () => {
    client.getOpportunityPage.mockResolvedValue(quotedPage());
    client.getOpportunityOutcome.mockResolvedValue(noOutcome);
    client.markOpportunityWon.mockResolvedValue({ conflict: false, stage: "won", version: 5 });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Mark won or lost" }));
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    await userEvent.click(within(dialog()).getByRole("radio", { name: /PEO A/ }));
    await userEvent.click(within(dialog()).getByRole("button", { name: "Mark won" }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ["table", "f1", "accounts"] }));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["opportunity-needs", "f1", "i1"] });
  });
});

// ---------- 5.0y: the withdrawal offered when the page closes the search ----------
const sentNote = (quoteRequestId: number, subject: string) => ({
  id: quoteRequestId, quote_request_id: quoteRequestId, direction: "sent", subject, recorded_at: "2026-11-02T10:00:00Z", to_addresses: ["dana@peo.example"],
});

describe("OpportunityPage: closing offers the withdrawal (D-1724, D-1726)", () => {
  // Catches: the dialog drawn with no knowledge of which PEOs the product wrote to, so a loss closes them without the note the person was meant to be offered.
  it("offers a loss's withdrawal to the PEOs the submission's mail shows the product wrote to", async () => {
    client.getOpportunityPage.mockResolvedValue(quotedPage());
    advisor.loadSubmission.mockResolvedValue(certified({ quoteRequestMessages: [sentNote(12, "Harborview: version 2"), sentNote(13, "Harborview: version 2"), sentNote(14, "Harborview: version 2")] }));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Mark won or lost" }));
    await userEvent.click(within(dialog()).getByRole("radio", { name: /Lost/ }));
    expect(await within(dialog()).findByRole("checkbox", { name: "Send a withdrawal to PEO A, PEO B and PEO C" })).toBeChecked();
  });
});

// ---------- 5.0y: Email a contact from the header, returning to the opportunity ----------
describe("OpportunityPage: Email a contact (D-1728)", () => {
  const contactRow = (id: string, first: string, main: boolean) => ({ id, firstName: first, lastName: "Park", email: `${first.toLowerCase()}@harborview.example`, doNotEmail: false, isMain: main });
  beforeEach(() => {
    accountTab.listAccountTab.mockReset().mockResolvedValue({ count: 3, rows: [contactRow("c1", "Elena", true), contactRow("c2", "Owen", false), contactRow("c3", "Priya", false)] });
  });

  // Catches: an opportunity with no way to write to the people on it, or one that offers the account's main contact before the opportunity's own (D-683).
  it("offers Email in the header, asking which contact with the opportunity's main contact first", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ mainContact: { id: "c3", name: "Priya Park" } }));
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(within(header()).getByRole("button", { name: "Email" }));
    const choices = await within(await screen.findByRole("dialog")).findAllByRole("button", { name: /^Write to/ });
    expect(choices.map((b) => b.textContent)).toEqual(["Write to Priya Park", "Write to Elena Park", "Write to Owen Park"]);
  });
});

describe("OpportunityPage: back from connecting a mailbox (D-1728)", () => {
  // Catches: coming back from connecting a mailbox to an opportunity's page with the place to write closed, or to the queue, so the unsent message seems lost (D-653, D-650).
  it("opens the place to write for the contact being written to", async () => {
    accountTab.listAccountTab.mockResolvedValue({ count: 1, rows: [{ id: "c1", firstName: "Elena", lastName: "Marsh", email: "elena@harborview.example", doNotEmail: false, isMain: true }] });
    renderPage("/opportunities/o1?email=c1");
    const writing = await screen.findByRole("dialog", { name: "Write to Elena Marsh" });
    expect(await within(writing).findByRole("region", { name: "Emails" })).toBeInTheDocument();
    expect(conversations.getConversation).toHaveBeenCalledWith("f1", "c1");
  });
});

describe("OpportunityPage: the Emails panel (D-1728)", () => {
  // Catches: an opportunity that shows none of the mail with its people (CRM-E1.3), asks for the account's mail instead of this opportunity's, or names no contact.
  it("lists the opportunity's emails, each naming its contact from the page, asked for this opportunity", async () => {
    conversations.getAccountMessages.mockResolvedValue([
      { id: "m2", direction: "inbound", from: "elena@harborview.example", to: [], subject: "Re: Your renewal", body: "Friday?", status: "received", failureKind: null, failureReason: null, at: "2026-11-11T09:00:00+00:00", contactId: "c1" },
    ]);
    renderPage();
    const list = await screen.findByRole("list", { name: "Emails with the account's contacts" });
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("Re: Your renewal");
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("Elena Marsh");
    expect(conversations.getAccountMessages).toHaveBeenCalledWith("f1", { opportunityId: "o1" });
  });
});

describe("OpportunityPage: no Email where the database would refuse (D-1728)", () => {
  // Catches: an Email button on an archived account or in a Nevermore support session, where the place to write would only be refused.
  it.each([
    ["an archived account", page({ account: { id: "a1", name: "Harborview Dental Group", archived: true } }), workspace()],
    ["a support session", page(), workspace({ isSupport: true })],
  ])("draws no Email for %s", async (_who, pageOf, ws) => {
    client.getOpportunityPage.mockResolvedValue(pageOf);
    renderPage("/opportunities/o1", ws);
    await screen.findByRole("heading", { level: 1 });
    expect(within(header()).queryByRole("button", { name: "Email" })).not.toBeInTheDocument();
  });
});

// ---------- 5.0y: Choose PEOs on the quotes panel ----------
describe("OpportunityPage: Choose PEOs (D-1727)", () => {
  const peoProfile = { id: 3, name: "Justworks", profile: { version: 2, needed_to_quote: ["company_name"], sources: { answers: { kind: "document", name: "Broker guide", checked_on: "2026-11-02" } } } };
  const submissionDetail = (over: object = {}) => certified({
    fileId: "EAA-2026-0117", submission: { signer_name: "Elena Marsh", signer_title: "Owner", signed_at: "2026-10-28T10:00:00Z", file_id: "EAA-2026-0117", version: 2 }, ...over,
  });
  beforeEach(() => {
    peoCatalogRows = [peoProfile];
    advisor.loadSubmission.mockResolvedValue(submissionDetail());
  });

  // Catches: a certified search with no way to send its packet to several PEOs from its own page, or a button that opens nothing.
  it("opens Send to several PEOs on the quotes panel, from the certified answers, when the person chooses PEOs", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ quotes: [quote(1)] }));
    renderPage();
    await userEvent.click(await within(await screen.findByRole("region", { name: /^Quotes/ })).findByRole("button", { name: "Choose PEOs" }));
    const sending = await screen.findByRole("region", { name: "Send to several PEOs" });
    expect(await within(sending).findByRole("checkbox", { name: "Justworks" })).toBeChecked();
  });
});

describe("OpportunityPage: Choose PEOs only where it can work (D-1727)", () => {
  // Catches: Choose PEOs on an intake nobody has certified, where there is no certified answer set to send.
  it("is not drawn for an intake the prospect has not certified", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ quotes: [quote(1)], intake: { ...intake, certifiedAt: null, certifiedBy: null, version: null } }));
    renderPage();
    await within(await screen.findByRole("region", { name: /^Quotes/ })).findByRole("table");
    expect(screen.queryByRole("button", { name: "Choose PEOs" })).not.toBeInTheDocument();
  });
});

describe("OpportunityPage: no Choose PEOs where the database would refuse (D-1727)", () => {
  // Catches: Choose PEOs offered in a Nevermore support session or on an archived account, where every send would be refused.
  it.each([
    ["an archived account", page({ quotes: [quote(1)], account: { id: "a1", name: "Harborview Dental Group", archived: true } }), workspace()],
    ["a support session", page({ quotes: [quote(1)] }), workspace({ isSupport: true })],
  ])("draws no Choose PEOs for %s", async (_who, pageOf, ws) => {
    client.getOpportunityPage.mockResolvedValue(pageOf);
    renderPage("/opportunities/o1", ws);
    await within(await screen.findByRole("region", { name: /^Quotes/ })).findByRole("table");
    expect(screen.queryByRole("button", { name: "Choose PEOs" })).not.toBeInTheDocument();
  });
});

describe("OpportunityPage: Choose PEOs when the submission can't be read (D-1727)", () => {
  // Catches: a click on Choose PEOs that does nothing when the read fails, so the person cannot tell whether to wait or try again.
  it("says it could not read the submission, and Try again reads it and opens the choosing", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ quotes: [] }));
    peoCatalogRows = [{ id: 3, name: "Justworks", profile: { version: 2, needed_to_quote: ["company_name"], sources: { answers: { kind: "document", name: "Broker guide", checked_on: "2026-11-02" } } } }];
    advisor.loadSubmission.mockRejectedValueOnce(new Error("down")).mockResolvedValue(certified({
      fileId: "EAA-2026-0117", submission: { signer_name: "Elena Marsh", signer_title: "Owner", signed_at: "2026-10-28T10:00:00Z", file_id: "EAA-2026-0117", version: 2 },
    }));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Choose PEOs" }));
    const said = await screen.findByText("We couldn't read this submission, so PEOs can't be chosen yet.");
    await userEvent.click(within(said.parentElement as HTMLElement).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("region", { name: "Send to several PEOs" })).toBeInTheDocument();
  });
});

describe("OpportunityPage: Choose PEOs when the certification can't say what it held (D-1727)", () => {
  // Catches: PEOs offered ticked as ready from a certification recorded before answers kept their status, which cannot say what it held.
  it("says nothing can be sent from here", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ quotes: [] }));
    peoCatalogRows = [{ id: 3, name: "Justworks", profile: { version: 2, needed_to_quote: ["company_name"], sources: { answers: { kind: "document", name: "Broker guide", checked_on: "2026-11-02" } } } }];
    advisor.loadSubmission.mockResolvedValue(certified({
      certificationLacksSnapshot: true, fileId: "EAA-2026-0117", submission: { signer_name: "Elena Marsh", signer_title: "Owner", signed_at: "2026-10-28T10:00:00Z", file_id: "EAA-2026-0117", version: 2 },
    }));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Choose PEOs" }));
    expect(await screen.findByText("This certification can't say what it held, so nothing can be sent from here. Open the submission to send.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Send to several PEOs" })).not.toBeInTheDocument();
  });
});

describe("OpportunityPage: after Choose PEOs sends (D-1727)", () => {
  // Catches: a send that leaves the quotes panel showing no new quote request until the page is reloaded.
  it("asks the page's lists again once a send went", async () => {
    client.getOpportunityPage.mockResolvedValue(page({ quotes: [] }));
    peoCatalogRows = [{ id: 3, name: "Justworks", profile: { version: 2, needed_to_quote: ["company_name"], sources: { answers: { kind: "document", name: "Broker guide", checked_on: "2026-11-02" } } } }];
    advisor.loadSubmission.mockResolvedValue(certified({
      fileId: "EAA-2026-0117", submission: { signer_name: "Elena Marsh", signer_title: "Owner", signed_at: "2026-10-28T10:00:00Z", file_id: "EAA-2026-0117", version: 2 },
    }));
    peoSend.loadPeoSendContext.mockResolvedValue({ mailbox: { connected: true, address: "dana@example.com" }, contacts: [{ name: "Dana Lee", role: null, email: "dana@justworks.example" }], reply_address: null });
    peoSend.sendToPeo.mockResolvedValue({ quoteRequestId: 21, messageId: 41 });
    peoAuthorizations.loadPeoAuthorizations.mockResolvedValue([{ peo: "Justworks", state: "authorized", signedAt: null, wordingVersion: null }]);
    peoRegistrations.loadRegisteredElsewhere.mockResolvedValue([]);
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Choose PEOs" }));
    const sending = await screen.findByRole("region", { name: "Send to several PEOs" });
    await userEvent.type(await within(sending).findByLabelText("Your note"), "Here it is.");
    await userEvent.click(within(sending).getByRole("button", { name: "Review" }));
    const before = client.getOpportunityPage.mock.calls.length;
    await userEvent.click(await within(sending).findByRole("button", { name: "Send to 1 PEO" }));
    await waitFor(() => expect(peoSend.sendToPeo).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(client.getOpportunityPage.mock.calls.length).toBeGreaterThan(before));
  });
});
