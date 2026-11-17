import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import { allStatuses, expectStatusesOutsideBusy, spoken } from "@/test/loading";

// A quote's page through a faked client (story CRM-Q3.2, screen 11; D-185: a quote is a quote request): what a person sees and does. Everything the page is made of
// is a piece that already exists (the thread, the statuses, Follow up or Withdraw, the opportunity's reads), each tested where it lives; these tests hold that the
// page puts them together as the story says. The database's own rules are tested in supabase/tests.

vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "dana@example.com" }, signOut: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const quotes = { getQuotePage: vi.fn() };
vi.mock("@/lib/quotePageApi", async () => ({ ...(await vi.importActual<object>("@/lib/quotePageApi")), ...quotes }));

const peoSend = { loadPeoSendContext: vi.fn(), sendToPeo: vi.fn() };
vi.mock("@/lib/peoSendApi", async () => ({ ...(await vi.importActual<object>("@/lib/peoSendApi")), ...peoSend }));
const peoRegistrations = { loadRegisteredElsewhere: vi.fn() };
vi.mock("@/lib/peoRegistrationsApi", async () => ({ ...(await vi.importActual<object>("@/lib/peoRegistrationsApi")), ...peoRegistrations }));
const outcomes = { getOpportunityOutcome: vi.fn() };
vi.mock("@/lib/opportunityPageApi", async () => ({ ...(await vi.importActual<object>("@/lib/opportunityPageApi")), ...outcomes }));
const advisor = { openQuoteRequestThread: vi.fn(), mailAttachmentUrl: vi.fn(), moveMessageOffThread: vi.fn(), recordActivity: vi.fn(), loadSubmission: vi.fn(), updateQuoteRequest: vi.fn(), setQuoteRequestStatus: vi.fn(), decideReplySuggestion: vi.fn(), fetchMyMailbox: vi.fn(), loadQuotes: vi.fn(), attachQuoteDocument: vi.fn(), uploadQuoteDocument: vi.fn(), askAboutQuestion: vi.fn() };
vi.mock("@/lib/advisorApi", async () => ({ ...(await vi.importActual<object>("@/lib/advisorApi")), ...advisor }));
// What "Still needs" reads, as the submission's and the opportunity's pages read it: the submission (its last certified version) and the PEOs' requirement profiles.
let peoCatalogRows: unknown = [];
vi.mock("@/lib/peoCatalog", async () => {
  const { parsePeoCatalog } = await import("@/data/peoProfiles");
  return { readPeoCatalog: async () => parsePeoCatalog(await peoCatalogRows) };
});

const { default: QuotePage } = await import("./QuotePage");

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  firm: { id: "f1", name: "Acme Benefits", address: "acme" }, role: "Agent", isOwner: false, isSupport: false, supportEndsAt: null, supportSessionId: null,
  isPlatformAdmin: false, person: "Dana Reyes", ...over,
});

const renderPage = (path = "/quotes/7", ws: Workspace = workspace()) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
  const router = createMemoryRouter([{ path: "/quotes/:quoteRequestId", element: <QuotePage /> }, { path: "*", element: null }], { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceContext.Provider value={ws}><RouterProvider router={router} /></WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
  return router;
};

const request = (over: Record<string, unknown> = {}) => ({
  id: 7, session_id: "s1", peo_name: "TriNet", status: "sent", sent_version: 3, sent_on: "2026-11-07", quote_received_on: null, quote_expires_on: null, proposed_start_on: null,
  admin_fee_pepm: null, note: null, ...over,
});
/** What the page's read gives: the quote request, its submission (only what a piece under test reads) and its opportunity's page. */
const quotePage = (over: { request?: Record<string, unknown>; detail?: Record<string, unknown>; opportunity?: Record<string, unknown> } = {}) => ({
  request: request(over.request),
  detail: { id: "s1", userId: "p1", data: { ...EMPTY_CHAMBER_DATA, company_name: "Harborview" }, quoteRequests: [request(over.request)], pipelineStatus: "sent_to_carrier", intakeStatus: "submitted", submission: { signer_name: "Lucia Reyes" }, reviews: {}, informationRequests: [], ...threadOf(), ...over.detail },
  opportunity: {
    opportunity: { id: "o1", name: "January 2027 PEO search", accountId: "a1", submissionId: "s1", stage: "in_market" },
    account: { id: "a1", name: "Harborview Dental Group", archived: false },
    canChange: true, canAdd: true, quotes: [], intake: null, contacts: [], ...over.opportunity,
  },
});

/** The submission as the submission's page reads it, certified, with what a profile's `needed_to_quote` can be checked against. */
const certified = (over: object = {}) => ({
  id: "s1", certified: true, signed: null, currentVersion: 3, certificationLacksSnapshot: false, reviews: {}, documents: [], extraAnswers: {},
  data: { ...EMPTY_CHAMBER_DATA, company_name: "Harborview", states: ["OR"] },
  provenance: { company_name: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: "2026-10-01T00:00:00Z" }, states: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: "2026-10-01T00:00:00Z" } },
  ...over,
});
const profileRow = (id: number, name: string, p: object = {}) => ({ id, name, profile: { version: 1, needed_to_quote: [], needed_before_signing: [], documents: [], extra_questions: [], sources: {}, ...p } });

const message = (over: Record<string, unknown> = {}) => ({
  id: 1, provider_message_id: "re_1", quote_request_id: 7, session_id: "s1", address_local_part: "a.b.c", held_reason: null, held_at: null, moved_by: null, moved_by_email: null,
  moved_from_quote_request_id: null, moved_note: null, direction: "received", is_automatic: false, new_sender: false, from_address: "dana@trinet.example", from_name: "Dana Whitfield",
  to_addresses: [], cc_addresses: [], subject: "Re: Harborview", body_text: "Proposal attached.", body_truncated: false, headers: {}, sent_at: "2026-11-10T15:00:00Z",
  recorded_at: "2026-11-10T15:00:05.123456+00:00", ...over,
});
const threadOf = (over: Record<string, unknown> = {}) => ({ quoteRequestMessages: [], quoteRequestMailAttachments: [], quoteRequestNotes: [], quoteRequestEvents: [], quoteRequestThreadReads: [], quoteRequestAddresses: [], ...over });

beforeEach(() => {
  for (const f of [...Object.values(advisor), ...Object.values(outcomes), ...Object.values(peoSend), ...Object.values(peoRegistrations)]) f.mockReset();
  outcomes.getOpportunityOutcome.mockResolvedValue({ lostReason: null, lostNote: null, placement: null, payments: [], receivedToDate: 0, quotes: {} });
  advisor.loadSubmission.mockResolvedValue(certified());
  advisor.fetchMyMailbox.mockResolvedValue({ connected: true, provider: "google", address: "dana@example.com" });
  peoSend.loadPeoSendContext.mockResolvedValue({ mailbox: { connected: true, address: "dana@example.com" }, contacts: [], reply_address: null });
  peoRegistrations.loadRegisteredElsewhere.mockResolvedValue([]);
  peoCatalogRows = [];
  advisor.openQuoteRequestThread.mockResolvedValue(undefined);
  advisor.loadQuotes.mockResolvedValue([]);
  quotes.getQuotePage.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("QuotePage: the states", () => {
  // Catches: a loading state that shows nothing of the page's frame, or that says nothing (or says it twice) to a screen reader.
  it("shows the page's frame in grey while it loads, and says once that it is loading", async () => {
    quotes.getQuotePage.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(await screen.findByRole("heading", { name: "Emails" })).toBeInTheDocument();
    for (const heading of ["Details", "Quote", "What was sent"]) expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(spoken().map((e) => e.textContent)).toEqual(["Loading the quote"]);
    expectStatusesOutsideBusy();
    expect(allStatuses().length).toBeGreaterThan(0);
  });

  // Catches: a quote that is gone, another firm's or on an account the person may not see showing a blank page or a failure ("It isn't available" is D-180's one answer).
  it("says the quote isn't available, with the way back, when the database shows none", async () => {
    quotes.getQuotePage.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "This quote isn't available." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to all accounts" })).toHaveAttribute("href", "/accounts");
  });

  // Catches: a failed read that leaves a blank page or the grey frame for ever, or no way to ask again.
  it("says the page failed, with Try again, when the quote could not be read at all", async () => {
    const user = userEvent.setup();
    quotes.getQuotePage.mockRejectedValueOnce(new Error("Couldn't load this submission.")).mockResolvedValue(null);
    renderPage();
    expect(await screen.findByText(/We couldn.t load this quote/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "This quote isn't available." })).toBeInTheDocument();
  });
});

describe("QuotePage: the emails", () => {
  // Catches: the thread of another PEO (the submission has several) on this quote's page, or messages oldest first, or the thread behind a click.
  it("shows the emails with this PEO, newest first, and only this PEO's", async () => {
    quotes.getQuotePage.mockResolvedValue(quotePage({
      detail: {
        quoteRequests: [request(), request({ id: 8, peo_name: "Justworks" })],
        ...threadOf({ quoteRequestMessages: [
          message({ id: 1, body_text: "First from TriNet", recorded_at: "2026-11-10T15:00:00+00:00" }),
          message({ id: 2, body_text: "Second from TriNet", recorded_at: "2026-11-11T09:00:00+00:00", sent_at: "2026-11-11T09:00:00Z" }),
          message({ id: 3, quote_request_id: 8, body_text: "Justworks' own" }),
        ] }),
      },
    }));
    renderPage();
    const emails = await screen.findByRole("region", { name: "Emails" });
    const items = within(within(emails).getByRole("list", { name: "TriNet thread, newest first" })).getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(items[0]).toContain("Second from TriNet");
    expect(items[1]).toContain("First from TriNet");
    expect(emails).not.toHaveTextContent("Justworks' own");
  });
});

const SEND_EVENTS = [
  { id: 1, quote_request_id: 7, session_id: "s1", note_id: null, field: "status", old_value: null, new_value: "sent", changed_by: "u1", changed_by_email: "dana@example.com", changed_at: "2026-11-07T16:10:00Z" },
  { id: 2, quote_request_id: 7, session_id: "s1", note_id: null, field: "sent_version", old_value: null, new_value: "3", changed_by: "u1", changed_by_email: "dana@example.com", changed_at: "2026-11-07T16:10:00Z" },
  { id: 3, quote_request_id: 7, session_id: "s1", note_id: null, field: "sent_on", old_value: null, new_value: "2026-11-07", changed_by: "u1", changed_by_email: "dana@example.com", changed_at: "2026-11-07T16:10:00Z" },
];

describe("QuotePage: no reply yet", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 12, 12));
  });
  // Catches: a thread that shows only what was sent and leaves the agent to count the days themselves.
  it("shows what was sent and says No reply yet with the days waiting, while a sent quote has no email back", async () => {
    quotes.getQuotePage.mockResolvedValue(quotePage({ detail: threadOf({ quoteRequestEvents: SEND_EVENTS }) }));
    renderPage();
    const emails = await screen.findByRole("region", { name: "Emails" });
    expect(within(emails).getByRole("list", { name: "TriNet thread, newest first" })).toHaveTextContent("Version 3 sent Nov 7, 2026");
    expect(within(emails).getByText("No reply yet · waiting 5 days")).toBeInTheDocument();
  });
});

const ADDRESS = { id: 1, quote_request_id: 7, session_id: "s1", local_part: "tri.net.7", issued_at: "2026-11-07T16:10:00Z", issued_by: "u1", issued_by_email: "dana@example.com", revoked_at: null, revoked_by: null, revoked_by_email: null };

describe("QuotePage: the details", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 12, 12));
    vi.stubEnv("VITE_QUOTE_REPLY_DOMAIN", "quotes.example.com");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  // Catches: details that leave out a line the story names (the PEO's contact, status, sent, version, what it still needs, the reply address) or take it from another PEO.
  it("lists the PEO contact, status, sent, version, what it still needs and the reply address", async () => {
    peoCatalogRows = [profileRow(1, "TriNet", { needed_to_quote: ["hris_system"] })];
    quotes.getQuotePage.mockResolvedValue(quotePage({
      request: { status: "question_open" },
      detail: {
        ...threadOf({ quoteRequestMessages: [message({ id: 5, direction: "sent", status: "sent", to_addresses: ["dana@trinet.example", "sam@trinet.example"] })] }),
        quoteRequestAddresses: [ADDRESS],
      },
    }));
    renderPage();
    const details = await screen.findByRole("region", { name: "Details" });
    const row = (term: string) => within(details).getByText(term).nextElementSibling as HTMLElement;
    expect(row("PEO contact")).toHaveTextContent("dana@trinet.example, sam@trinet.example");
    expect(row("Status")).toHaveTextContent("Question open · 5 days");
    expect(row("Sent")).toHaveTextContent("Nov 7, 2026");
    expect(row("Version")).toHaveTextContent("3");
    expect(await within(details).findByText("HRIS system")).toBe(row("Still needs"));
    expect(row("Reply address")).toHaveTextContent("tri.net.7@quotes.example.com");
  });
});

describe("QuotePage: Close", () => {
  // Catches: Close that closes at once with no reason (a click that cannot be undone, the quote's figures gone), or that closes another quote request, or leaves the page as it was.
  it("closes the quote request with the reason the agent gives, through the existing answer call, and reads the page again", async () => {
    const user = userEvent.setup();
    quotes.getQuotePage.mockResolvedValue(quotePage());
    advisor.updateQuoteRequest.mockResolvedValue(undefined);
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Close" }));
    await user.type(screen.getByLabelText("Why it is closed (optional)"), "Employer chose another PEO");
    expect(advisor.updateQuoteRequest).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Close this quote" }));
    await waitFor(() => expect(advisor.updateQuoteRequest).toHaveBeenCalledWith(7, { status: "closed", receivedOn: null, expiresOn: null, startOn: null, adminFeePepm: null, note: "Employer chose another PEO" }));
    await waitFor(() => expect(quotes.getQuotePage).toHaveBeenCalledTimes(2));
  });
});

describe("QuotePage: Follow up or withdraw", () => {
  const sentByUs = message({ id: 5, direction: "sent", status: "sent", to_addresses: ["dana@trinet.example"], subject: "Harborview: EAA-2026-0117" });
  beforeEach(() => {
    peoCatalogRows = [profileRow(1, "TriNet")];
    advisor.loadSubmission.mockResolvedValue(certified({ submission: { signer_name: "Elena Marsh" }, fileId: "EAA-2026-0117" }));
  });
  // Catches: the page that shows an email thread and no way to write to the PEO from it, or a follow-up built for another quote request or another version.
  it("offers Follow up and Withdraw, the submission page's own, on an open quote request the product has written to", async () => {
    const user = userEvent.setup();
    quotes.getQuotePage.mockResolvedValue(quotePage({ detail: { currentVersion: 3, ...threadOf({ quoteRequestMessages: [sentByUs] }) } }));
    renderPage();
    expect(await screen.findByRole("button", { name: "Withdraw from TriNet" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Follow up with TriNet" }));
    expect(screen.getByRole("form", { name: "Follow up with TriNet" })).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toHaveValue("dana@trinet.example");
  });
});

describe("QuotePage: what Epic 7 builds", () => {
  // Catches: a Record the quote or Record a decline button that opens nothing (D-1706, D-402: no dead buttons; slice 7.8 adds them), on any status.
  it("has no Record the quote or Record a decline, whatever the status", async () => {
    for (const status of ["sent", "acknowledged", "question_open", "quoted", "declined", "closed"]) {
      quotes.getQuotePage.mockResolvedValue(quotePage({ request: { status } }));
      renderPage();
      await screen.findByRole("heading", { level: 1, name: "TriNet" });
      expect(screen.queryByRole("button", { name: /record (the|a) (quote|decline)/i })).not.toBeInTheDocument();
      cleanup();
    }
  });
});

describe("QuotePage: Send again", () => {
  beforeEach(() => {
    peoCatalogRows = [profileRow(1, "TriNet")];
    advisor.loadSubmission.mockResolvedValue(certified({ submission: { signer_name: "Elena Marsh" }, fileId: "EAA-2026-0117" }));
    advisor.fetchMyMailbox.mockResolvedValue({ connected: true, provider: "google", address: "dana@example.com" });
    peoSend.loadPeoSendContext.mockResolvedValue({ mailbox: { connected: true, address: "dana@example.com" }, contacts: [{ name: "Dana Whitfield", role: null, email: "dana@trinet.example" }], reply_address: null });
    peoRegistrations.loadRegisteredElsewhere.mockResolvedValue([]);
  });
  // Catches: a closed quote with no way on (the agent has to go back to the submission to send again), or a Send again that is a different send from the one the submission's page makes.
  it("offers Send again on a closed quote, which is the submission page's own send to that PEO", async () => {
    const user = userEvent.setup();
    quotes.getQuotePage.mockResolvedValue(quotePage({ request: { status: "closed" }, detail: { currentVersion: 3 } }));
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Send again" }));
    const form = screen.getByRole("form", { name: "Send again" });
    expect(await within(form).findByLabelText(/Dana Whitfield/)).toBeInTheDocument();
    expect(peoSend.loadPeoSendContext).toHaveBeenCalledWith("s1", "TriNet");
  });
});

describe("QuotePage: where Follow up or Withdraw is not offered", () => {
  const sentByUs = message({ id: 5, direction: "sent", status: "sent", to_addresses: ["dana@trinet.example"], subject: "Harborview: EAA-2026-0117" });
  beforeEach(() => {
    peoCatalogRows = [profileRow(1, "TriNet")];
    advisor.loadSubmission.mockResolvedValue(certified({ submission: { signer_name: "Elena Marsh" }, fileId: "EAA-2026-0117" }));
  });
  const offered = async (page: ReturnType<typeof quotePage>, ws: Workspace = workspace()) => {
    quotes.getQuotePage.mockResolvedValue(page);
    renderPage("/quotes/7", ws);
    await screen.findByRole("heading", { level: 1, name: "TriNet" });
    await waitFor(() => expect(advisor.loadSubmission).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 30));
    const yes = screen.queryByRole("button", { name: "Withdraw from TriNet" }) !== null;
    cleanup();
    advisor.loadSubmission.mockClear();
    return yes;
  };
  // Catches: a Follow up the database refuses (a closed or declined quote request, a send the product never made so there is no one to follow up with), or one in a support session.
  it("is not offered on a closed or declined quote request, one the product never wrote to, an archived account or a support session", async () => {
    const withMail = { currentVersion: 3, ...threadOf({ quoteRequestMessages: [sentByUs] }) };
    expect(await offered(quotePage({ detail: withMail }))).toBe(true);
    expect(await offered(quotePage({ request: { status: "quoted" }, detail: withMail }))).toBe(true);
    for (const status of ["closed", "declined"]) expect(await offered(quotePage({ request: { status }, detail: withMail }))).toBe(false);
    expect(await offered(quotePage({ detail: { currentVersion: 3 } }))).toBe(false);
    expect(await offered(quotePage({ detail: withMail, opportunity: { account: { id: "a1", name: "Harborview Dental Group", archived: true } } }))).toBe(false);
    expect(await offered(quotePage({ detail: withMail }), workspace({ isSupport: true }))).toBe(false);
  });
});

describe("QuotePage: a certified version that cannot say what it held", () => {
  // Catches: Follow up or Withdraw built from a version certified before each answer's status was kept (the link's plan would be a guess).
  it("offers no Follow up or Withdraw, as the submission's PEO card offers none", async () => {
    peoCatalogRows = [profileRow(1, "TriNet")];
    advisor.loadSubmission.mockResolvedValue(certified({ certificationLacksSnapshot: true, submission: { signer_name: "Elena Marsh" }, fileId: "EAA-2026-0117" }));
    quotes.getQuotePage.mockResolvedValue(quotePage({ detail: { currentVersion: 3, ...threadOf({ quoteRequestMessages: [message({ id: 5, direction: "sent", status: "sent", to_addresses: ["dana@trinet.example"] })] }) } }));
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "TriNet" });
    await waitFor(() => expect(advisor.loadSubmission).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole("button", { name: "Withdraw from TriNet" })).not.toBeInTheDocument();
  });
});

describe("QuotePage: the PEO's status", () => {
  // Catches: statuses an agent cannot set from the quote's own page (they would have to go back to the submission), or set for another quote request, or never shown after.
  it("sets Acknowledged, Question open or Back to Sent with the submission page's own buttons, then reads the page again", async () => {
    const user = userEvent.setup();
    quotes.getQuotePage.mockResolvedValue(quotePage({ request: { status: "acknowledged" } }));
    advisor.setQuoteRequestStatus.mockResolvedValue(undefined);
    renderPage();
    expect(screen.queryByRole("button", { name: "Mark TriNet acknowledged" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Mark TriNet question open" }));
    expect(advisor.setQuoteRequestStatus).toHaveBeenCalledWith(7, "question_open");
    await waitFor(() => expect(quotes.getQuotePage).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Mark TriNet back to Sent" })).toBeInTheDocument();
  });
});

describe("QuotePage: a suggestion on a reply", () => {
  // N-1.1. Break caught: Accept on the quote's own page that records the status and leaves the page showing the old one (and the suggestion still open).
  it("is accepted on the PEO's thread with the submission page's own Accept, then the page is read again", async () => {
    const user = userEvent.setup();
    quotes.getQuotePage.mockResolvedValue(quotePage({
      detail: threadOf({
        quoteRequestMessages: [message({ id: 1, body_text: "We have your packet.", suggested_status: "acknowledged", suggestion_outcome: null })],
        quoteRequestThreadReads: [{ quote_request_id: 7, last_opened_at: "2030-01-01T00:00:00Z", last_opened_by: "a1", last_opened_by_email: "adv@example.com" }],
      }),
    }));
    advisor.decideReplySuggestion.mockResolvedValue(undefined);
    renderPage();
    expect(await screen.findByText(/Suggested: Acknowledged/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Accept" }));
    expect(advisor.decideReplySuggestion).toHaveBeenCalledWith(1, "accept");
    await waitFor(() => expect(quotes.getQuotePage).toHaveBeenCalledTimes(2));
  });
});

describe("QuotePage: an underwriter's open question", () => {
  const asking = (status = "question_open") => quotePage({
    request: { status },
    detail: {
      pipelineStatus: "sent_to_carrier", intakeStatus: "submitted", submission: { signer_name: "Lucia Reyes" }, reviews: {}, informationRequests: [],
      ...threadOf({ quoteRequestMessages: [message({ id: 1, body_text: "How many of the 12 employees are part time?" })] }),
    },
  });

  // N-1.3. Break caught: no way from the quote's own page to the employer (the agent has to go to the submission), or a draft that holds the PEO's words for the employer to read.
  it("asks the employer from the quote's page, in the agent's own words, tied to this quote request", async () => {
    const user = userEvent.setup();
    quotes.getQuotePage.mockResolvedValue(asking());
    advisor.askAboutQuestion.mockResolvedValue(undefined);
    renderPage();
    const panel = (await screen.findByRole("heading", { name: "Ask the prospect" })).closest("section")!;
    const words = within(panel).getByLabelText(/What do you need from them/i) as HTMLTextAreaElement;
    expect(words.value).toBe("");
    await user.type(words, "How many of your 12 employees work part time?");
    await waitFor(() => expect(advisor.openQuoteRequestThread).toHaveBeenCalled());
    await waitFor(() => expect(quotes.getQuotePage).toHaveBeenCalledTimes(2));
    await user.click(within(panel).getByRole("button", { name: "Send request" }));
    expect(advisor.askAboutQuestion).toHaveBeenCalledWith(7, "How many of your 12 employees work part time?", [], []);
    await waitFor(() => expect(quotes.getQuotePage).toHaveBeenCalledTimes(3));
  });

  // Break caught: the request sent and then not seen on the quote's own thread, so the agent can't tell whether the employer was asked or has answered.
  it("shows on the PEO's thread what the employer was asked, and that it waits", async () => {
    quotes.getQuotePage.mockResolvedValue(quotePage({
      request: { status: "question_open" },
      detail: {
        pipelineStatus: "information_requested",
        informationRequests: [{ id: 5, session_id: "s1", message: "How many of your employees work part time?", fields: [], extra_questions: [], requested_by: "a1", requested_by_email: "dana@example.com", requested_at: "2026-11-12T16:00:00Z" }],
        ...threadOf({ quoteRequestEvents: [{ id: 9, quote_request_id: 7, session_id: "s1", note_id: null, field: "asked_employer", old_value: null, new_value: "5", changed_by: "a1", changed_by_email: "dana@example.com", changed_at: "2026-11-12T16:00:01Z" }] }),
      },
    }));
    renderPage();
    const line = await screen.findByText(/You asked the employer/);
    expect(line).toHaveTextContent("You asked the employer: “How many of your employees work part time?” Waiting for their answer.");
  });

  // Break caught: a panel offered to someone who cannot send it (a Nevermore support session reads only, ADR 0024): a dead button the database would refuse.
  it("offers no way to ask the employer during a support session", async () => {
    quotes.getQuotePage.mockResolvedValue(asking());
    renderPage("/quotes/7", workspace({ isSupport: true }));
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("heading", { name: "Ask the prospect" })).not.toBeInTheDocument();
  });

  // Break caught: a dead panel on a quote that has no question (Ask the prospect offered about nothing; the database would refuse it).
  it("offers nothing on a quote request with no open question", async () => {
    quotes.getQuotePage.mockResolvedValue(asking("sent"));
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("heading", { name: "Ask the prospect" })).not.toBeInTheDocument();
  });
});

describe("QuotePage: declined", () => {
  // N-1.4. Break caught: a declined quote's own page that says Declined in the header and nothing of why, though the card on the submission says it.
  it("says why the PEO declined and in what words, and nothing on a quote that is not declined", async () => {
    quotes.getQuotePage.mockResolvedValue(quotePage({ request: { status: "declined", decline_reason: "claims_history", decline_words: "Three open claims" } }));
    renderPage();
    expect(await screen.findByText("Declined: Claims history")).toBeInTheDocument();
    expect(screen.getByText("\u201cThree open claims\u201d")).toBeInTheDocument();
  });

  it("says nothing of a decline on a quote that has moved on, though the reason is kept", async () => {
    quotes.getQuotePage.mockResolvedValue(quotePage({ request: { status: "quoted", decline_reason: "claims_history" } }));
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText(/^Declined:/)).not.toBeInTheDocument();
  });
});

describe("QuotePage: closed", () => {
  // Catches: a closed quote that looks like any other (no word of why it closed, so the agent cannot tell a withdrawal from a loss).
  it("shows a banner that it is closed, with why: the withdrawal's reason and the note the agent gave", async () => {
    quotes.getQuotePage.mockResolvedValue(quotePage({ request: { status: "closed", withdrawn_reason: "employer_went_elsewhere", note: "Chose their current PEO" } }));
    renderPage();
    const banner = await screen.findByRole("note", { name: "This quote is closed" });
    expect(banner).toHaveTextContent("The employer went elsewhere");
    expect(banner).toHaveTextContent("Chose their current PEO");
  });

  // Catches: a quote closed by the opportunity's won or lost (the other PEOs close with it) saying nothing of why, as the opportunity page's quotes panel does say it (D-424).
  it("says why when the opportunity's close ended it: the search ended or the employer went elsewhere", async () => {
    outcomes.getOpportunityOutcome.mockResolvedValue({ lostReason: null, lostNote: null, placement: null, payments: [], receivedToDate: 0, quotes: { 7: { closeReason: "went_elsewhere", proposedStart: null } } });
    quotes.getQuotePage.mockResolvedValue(quotePage({ request: { status: "closed" } }));
    renderPage();
    const banner = await screen.findByRole("note", { name: "This quote is closed" });
    await waitFor(() => expect(banner).toHaveTextContent("The employer went elsewhere"));
    expect(outcomes.getOpportunityOutcome).toHaveBeenCalledWith("f1", "o1");
  });
});

describe("QuotePage: Close that does not go through", () => {
  // Catches: a failed close that shuts the form and loses what the agent typed, or says nothing.
  it("says so in words, keeps the form and what was typed, and does not read the page again", async () => {
    const user = userEvent.setup();
    quotes.getQuotePage.mockResolvedValue(quotePage());
    advisor.updateQuoteRequest.mockRejectedValue(Object.assign(new Error("This quote request is closed. Record a send to TriNet to reopen it"), { code: "22023" }));
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Close" }));
    await user.type(screen.getByLabelText("Why it is closed (optional)"), "Gone elsewhere");
    await user.click(screen.getByRole("button", { name: "Close this quote" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This quote request is closed. Record a send to TriNet to reopen it");
    expect(screen.getByLabelText("Why it is closed (optional)")).toHaveValue("Gone elsewhere");
    expect(quotes.getQuotePage).toHaveBeenCalledTimes(1);
  });
});

describe("QuotePage: where Close is not offered", () => {
  const closeOffered = async (page: ReturnType<typeof quotePage>, ws: Workspace = workspace()) => {
    quotes.getQuotePage.mockResolvedValue(page);
    renderPage("/quotes/7", ws);
    await screen.findByRole("heading", { level: 1, name: "TriNet" });
    const offered = screen.queryByRole("button", { name: "Close" }) !== null;
    cleanup();
    return offered;
  };
  // Catches: a Close the database will refuse (a quote that is answered, an account that is archived, a support session, a person who may not change the account's records),
  // and a Close on a quote that has quoted, which would wipe its figures.
  it("is offered on an open quote request the person may change, and nowhere else", async () => {
    expect(await closeOffered(quotePage())).toBe(true);
    expect(await closeOffered(quotePage({ request: { status: "acknowledged" } }))).toBe(true);
    expect(await closeOffered(quotePage({ request: { status: "question_open" } }))).toBe(true);
    for (const status of ["quoted", "declined", "closed"]) expect(await closeOffered(quotePage({ request: { status } }))).toBe(false);
    expect(await closeOffered(quotePage({ opportunity: { account: { id: "a1", name: "Harborview Dental Group", archived: true } } }))).toBe(false);
    expect(await closeOffered(quotePage({ opportunity: { canChange: false } }))).toBe(false);
    expect(await closeOffered(quotePage(), workspace({ isSupport: true }))).toBe(false);
  });
});

describe("QuotePage: what was sent", () => {
  // Catches: a page that cannot say which version the PEO holds, or does not warn when the intake has moved on since (D-1623, M-2.3: the agent decides whether to update).
  it("says which version of the packet was sent and when, and warns when a newer one is certified", async () => {
    quotes.getQuotePage.mockResolvedValue(quotePage({ detail: { currentVersion: 4 } }));
    renderPage();
    const panel = await screen.findByRole("region", { name: "What was sent" });
    expect(within(panel).getByText("Version 3 of the packet, sent Nov 7, 2026")).toBeInTheDocument();
    expect(within(panel).getByText("Sent v3, current v4")).toBeInTheDocument();
  });

  // Catches: What was sent showing only a version number, so the agent cannot see to whom, under what subject, with the link to the packet, or as which update.
  it("lists each email the product sent this PEO: when, to whom, the subject, the link to the packet and the update's earlier version", async () => {
    quotes.getQuotePage.mockResolvedValue(quotePage({ detail: threadOf({ quoteRequestMessages: [
      message({ id: 1, direction: "sent", status: "sent", to_addresses: ["dana@trinet.example"], subject: "Harborview: EAA-2026-0117", bundle_link_id: 9, sent_at: "2026-11-07T16:10:00Z", recorded_at: "2026-11-07T16:10:00+00:00" }),
      message({ id: 2, direction: "sent", status: "sent", to_addresses: ["dana@trinet.example", "sam@trinet.example"], subject: "Harborview: update", bundle_link_id: 10, update_from_version: 2, sent_at: "2026-11-09T09:00:00Z", recorded_at: "2026-11-09T09:00:00+00:00" }),
      message({ id: 3, direction: "received", subject: "Re: Harborview" }),
    ] }) }));
    renderPage();
    const items = within(within(await screen.findByRole("region", { name: "What was sent" })).getByRole("list", { name: "Emails sent" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Nov 9, 2026");
    expect(items[0]).toHaveTextContent("to dana@trinet.example, sam@trinet.example");
    expect(items[0]).toHaveTextContent("Harborview: update");
    expect(items[0]).toHaveTextContent("Update to a PEO holding version 2");
    expect(items[0]).toHaveTextContent("With a link to the packet");
    expect(items[1]).toHaveTextContent("Nov 7, 2026");
    expect(items[1]).toHaveTextContent("Harborview: EAA-2026-0117");
    expect(items[1]).not.toHaveTextContent("Update to a PEO");
  });
});

describe("QuotePage: the quote's figures", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 12, 12));
  });
  // Catches: figures left on the opportunity's page only (the agent opens the quote to see what was quoted), or another PEO's, or a fee with no unit.
  it("shows what was quoted: the admin fee, when it came, when it expires and the proposed start", async () => {
    quotes.getQuotePage.mockResolvedValue(quotePage({ request: { status: "quoted", admin_fee_pepm: 132, quote_received_on: "2026-11-03", quote_expires_on: "2026-12-05", proposed_start_on: "2027-01-01" } }));
    renderPage();
    const panel = await screen.findByRole("region", { name: "Quote" });
    const line = (term: string) => within(panel).getByText(term).nextElementSibling as HTMLElement;
    expect(line("Admin fee")).toHaveTextContent("$132 per employee per month");
    expect(line("Received")).toHaveTextContent("Nov 3, 2026");
    expect(line("Expires")).toHaveTextContent("Dec 5, 2026");
    expect(line("Proposed start")).toHaveTextContent("Jan 1, 2027");
  });

  // Catches: empty lines under the Quote heading that read as a missing page; the story's state says each line reads "Not yet".
  it("reads Not yet on each line while no quote is recorded", async () => {
    quotes.getQuotePage.mockResolvedValue(quotePage());
    renderPage();
    const panel = await screen.findByRole("region", { name: "Quote" });
    for (const term of ["Admin fee", "Received", "Expires", "Proposed start"]) expect(within(panel).getByText(term).nextElementSibling).toHaveTextContent("Not yet");
  });
});

describe("QuotePage: the PEO contact", () => {
  // Catches: "Not known" for a PEO the agent has in fact heard from (a send recorded by hand has no addresses of ours, but the PEO's reply names its person).
  it("is the person who last wrote from the PEO when the product sent nothing", async () => {
    quotes.getQuotePage.mockResolvedValue(quotePage({ detail: threadOf({ quoteRequestMessages: [
      message({ id: 1, from_name: "Old Name", from_address: "old@trinet.example", recorded_at: "2026-11-09T10:00:00+00:00" }),
      message({ id: 2, from_name: "Dana Whitfield", from_address: "dana@trinet.example", recorded_at: "2026-11-10T10:00:00+00:00" }),
      message({ id: 3, quote_request_id: 8, from_name: "Justworks Person", from_address: "j@justworks.example", recorded_at: "2026-11-11T10:00:00+00:00" }),
    ] }) }));
    renderPage();
    const details = await screen.findByRole("region", { name: "Details" });
    expect(within(details).getByText("PEO contact").nextElementSibling).toHaveTextContent("Dana Whitfield, dana@trinet.example");
  });
});

describe("QuotePage: sent outside the product", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_QUOTE_REPLY_DOMAIN", "quotes.example.com");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  // Catches: a send the agent recorded by hand looking like one the product made (nothing in the thread to say how it went), and no address to copy so the replies reach it.
  it("says the send was recorded by hand, with the reply address to copy, when the product sent nothing", async () => {
    quotes.getQuotePage.mockResolvedValue(quotePage({ detail: { ...threadOf({ quoteRequestEvents: SEND_EVENTS }), quoteRequestAddresses: [ADDRESS] } }));
    renderPage();
    const emails = await screen.findByRole("region", { name: "Emails" });
    expect(within(emails).getByText(/Sent outside the product/)).toHaveTextContent("recorded by hand");
    expect(within(emails).getByLabelText("Reply address")).toHaveValue("tri.net.7@quotes.example.com");
    expect(within(emails).getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  // Catches: a send the product itself made being called "outside the product", or a quote not yet sent being called sent.
  it("says nothing of it when the product sent the packet, or nothing was sent", async () => {
    quotes.getQuotePage.mockResolvedValue(quotePage({ detail: { ...threadOf({ quoteRequestEvents: SEND_EVENTS, quoteRequestMessages: [message({ direction: "sent", status: "sent", to_addresses: ["dana@trinet.example"] })] }), quoteRequestAddresses: [ADDRESS] } }));
    renderPage();
    const emails = await screen.findByRole("region", { name: "Emails" });
    expect(within(emails).queryByText(/Sent outside the product/)).not.toBeInTheDocument();
    cleanup();
    quotes.getQuotePage.mockResolvedValue(quotePage({ request: { sent_on: null, sent_version: null } }));
    renderPage();
    const again = await screen.findByRole("region", { name: "Emails" });
    expect(within(again).queryByText(/Sent outside the product/)).not.toBeInTheDocument();
  });
});

describe("QuotePage: a reply has come", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 12, 12));
  });
  // Catches: "No reply yet" under a thread that has the PEO's reply in it.
  it("does not say No reply yet once the PEO has written back", async () => {
    quotes.getQuotePage.mockResolvedValue(quotePage({ detail: threadOf({ quoteRequestEvents: SEND_EVENTS, quoteRequestMessages: [message()] }) }));
    renderPage();
    const emails = await screen.findByRole("region", { name: "Emails" });
    expect(within(emails).getByRole("list", { name: "TriNet thread, newest first" })).toHaveTextContent("Proposal attached.");
    expect(within(emails).queryByText(/No reply yet/)).not.toBeInTheDocument();
  });

  // Catches: "No reply yet · waiting" kept on a quote that is already answered or closed, where nothing is being waited for.
  it("does not say it of a quote request that is quoted, declined or closed, and keeps counting for acknowledged and question open", async () => {
    for (const [status, says] of [["quoted", false], ["declined", false], ["closed", false], ["acknowledged", true], ["question_open", true]] as const) {
      quotes.getQuotePage.mockResolvedValue(quotePage({ request: { status }, detail: threadOf({ quoteRequestEvents: SEND_EVENTS }) }));
      renderPage();
      const emails = await screen.findByRole("region", { name: "Emails" });
      if (says) expect(within(emails).getByText("No reply yet · waiting 5 days")).toBeInTheDocument();
      else expect(within(emails).queryByText(/No reply yet/)).not.toBeInTheDocument();
      cleanup();
    }
  });
});

describe("QuotePage: the trail and the header", () => {
  // Catches: a trail that stops at the quote's own page (no way back to the account or the search) or links to the wrong records.
  it("leads back: Accounts, the account, the opportunity, and the PEO as where you are", async () => {
    quotes.getQuotePage.mockResolvedValue(quotePage());
    renderPage();
    const trail = await screen.findByRole("navigation", { name: "Breadcrumb" });
    expect(within(trail).getByRole("link", { name: "Accounts" })).toHaveAttribute("href", "/accounts");
    expect(within(trail).getByRole("link", { name: "Harborview Dental Group" })).toHaveAttribute("href", "/accounts/a1");
    expect(within(trail).getByRole("link", { name: "January 2027 PEO search" })).toHaveAttribute("href", "/opportunities/o1");
    expect(within(trail).getByText("TriNet")).toHaveAttribute("aria-current", "page");
  });

  // Catches: a header that does not say which PEO, how long it has been waiting (the days keep counting, CRM-Q3.1), or which version went on which day.
  it("names the PEO, the status with the days waiting, and when it was sent and from which version", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 12, 12));
    quotes.getQuotePage.mockResolvedValue(quotePage());
    renderPage();
    const header = (await screen.findByRole("heading", { level: 1, name: "TriNet" })).closest("header") as HTMLElement;
    expect(within(header).getByText("Sent · 5 days")).toBeInTheDocument();
    expect(within(header).getByText("Sent Nov 7, 2026 from version 3")).toBeInTheDocument();
  });
});

/** A quote as the quotes table holds it (N-2.1), with its document when it has one. */
const storedQuote = (over: Record<string, unknown> = {}) => ({
  id: 3, quote_request_id: 7, session_id: "s1", kind: "firm_offer", received_on: "2026-11-14", expires_on: null, proposed_start_on: null, admin_fee: null, admin_fee_basis: null,
  one_off_fees: null, workers_comp: null, unemployment: null, medical: null, note: null, document_attachment_id: null, document: null, ...over,
});
const document = (over: Record<string, unknown> = {}) => ({ id: 51, file_name: "proposal.pdf", size_bytes: 412000, storage_path: "s1/41/51-proposal.pdf", ...over });

describe("QuotePage: the quote document (N-2.2)", () => {
  // Catches: a quote that holds its document but gives the agent no way to open it, or a link made from someone else's file, or one that skips the 60-second signed link.
  it("names the quote's document and opens it through a signed link", async () => {
    quotes.getQuotePage.mockResolvedValue(quotePage({ request: { status: "quoted" } }));
    advisor.loadQuotes.mockResolvedValue([storedQuote({ document_attachment_id: 51, document: document() })]);
    advisor.mailAttachmentUrl.mockResolvedValue("https://files.example/signed");
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { assign }, configurable: true });
    renderPage();
    const panel = await screen.findByRole("region", { name: "Quote document" });
    expect(within(panel).getByText("proposal.pdf")).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: "Open proposal.pdf" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://files.example/signed"));
    expect(advisor.mailAttachmentUrl).toHaveBeenCalledWith(expect.objectContaining({ storage_path: "s1/41/51-proposal.pdf", file_name: "proposal.pdf" }));
    expect(advisor.loadQuotes).toHaveBeenCalledWith(7);
  });

  // Catches: a revised quote that hides the earlier one (the history lost), one that lists the current quote as superseded, or an earlier quote with no date to tell it by.
  it("lists each earlier quote as superseded with its received date, newest first, and not the current one", async () => {
    quotes.getQuotePage.mockResolvedValue(quotePage({ request: { status: "quoted" } }));
    advisor.loadQuotes.mockResolvedValue([
      storedQuote({ id: 1, kind: "estimate", received_on: null }),
      storedQuote({ id: 3, kind: "firm_offer", received_on: "2026-11-14" }),
      storedQuote({ id: 2, kind: "estimate", received_on: "2026-11-03", document: document({ file_name: "first-proposal.pdf" }) }),
    ]);
    renderPage();
    const panel = await screen.findByRole("region", { name: "Earlier quotes" });
    const items = within(panel).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "Estimate · received Nov 3, 2026 · Superseded · first-proposal.pdf",
      "Estimate · no received date · Superseded",
    ]);
  });

  // Catches: a quote recorded by hand with nowhere to put the PEO's document, an upload sent for another quote, or a page that doesn't read the quotes again so the file still looks missing.
  it("uploads the quote document of a quote that has none, for that quote, and reads the quotes again", async () => {
    quotes.getQuotePage.mockResolvedValue(quotePage({ request: { status: "quoted" } }));
    advisor.loadQuotes.mockResolvedValue([storedQuote()]);
    advisor.uploadQuoteDocument.mockResolvedValue({ attachmentId: 51, fileName: "quote.pdf", status: "stored" });
    renderPage();
    const panel = await screen.findByRole("region", { name: "Quote document" });
    const file = new File(["%PDF-1.4"], "quote.pdf", { type: "application/pdf" });
    await userEvent.upload(within(panel).getByLabelText("Upload the quote document"), file);
    await waitFor(() => expect(advisor.uploadQuoteDocument).toHaveBeenCalledWith(3, file));
    await waitFor(() => expect(advisor.loadQuotes.mock.calls.length).toBeGreaterThan(1));
  });

  // Catches: a file the virus check blocked reported as saved, so the agent believes the quote has its document.
  it("says the virus check blocked a file, and that it was not kept", async () => {
    const { toast } = await import("sonner");
    quotes.getQuotePage.mockResolvedValue(quotePage({ request: { status: "quoted" } }));
    advisor.loadQuotes.mockResolvedValue([storedQuote()]);
    advisor.uploadQuoteDocument.mockResolvedValue({ attachmentId: 51, fileName: "quote.pdf", status: "blocked" });
    renderPage();
    const panel = await screen.findByRole("region", { name: "Quote document" });
    await userEvent.upload(within(panel).getByLabelText("Upload the quote document"), new File(["x"], "quote.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("The virus check blocked that file, so it was not kept."));
  });

  // Catches: making the agent upload again a proposal that already arrived by email, or offering a blocked file, or another PEO's file, as this quote's document.
  it("offers the stored files that arrived on this quote request's emails, and names the chosen one as the document without uploading it again", async () => {
    quotes.getQuotePage.mockResolvedValue(quotePage({
      request: { status: "quoted" },
      detail: {
        ...threadOf({
          quoteRequestMessages: [message({ id: 1 }), message({ id: 2, quote_request_id: 8 })],
          quoteRequestMailAttachments: [
            { id: 61, message_id: 1, file_name: "Insperity proposal.pdf", size_bytes: 412000, status: "stored", not_kept_reason: null, scan_signature: null, storage_path: "s1/1/61-p.pdf" },
            { id: 62, message_id: 1, file_name: "infected.pdf", size_bytes: 1000, status: "blocked", not_kept_reason: null, scan_signature: "Eicar", storage_path: null },
            { id: 63, message_id: 2, file_name: "Other PEO.pdf", size_bytes: 1000, status: "stored", not_kept_reason: null, scan_signature: null, storage_path: "s1/2/63-o.pdf" },
          ],
        }),
      },
    }));
    advisor.loadQuotes.mockResolvedValue([storedQuote()]);
    advisor.attachQuoteDocument.mockResolvedValue({});
    renderPage();
    const panel = await screen.findByRole("region", { name: "Quote document" });
    const choose = within(panel).getByLabelText("Use a file from the emails");
    expect(within(choose).getAllByRole("option").map((o) => o.textContent)).toEqual(["Choose a file", "Insperity proposal.pdf"]);
    await userEvent.selectOptions(choose, "61");
    await userEvent.click(within(panel).getByRole("button", { name: "Use this file" }));
    await waitFor(() => expect(advisor.attachQuoteDocument).toHaveBeenCalledWith(3, 61));
    await waitFor(() => expect(advisor.loadQuotes.mock.calls.length).toBeGreaterThan(1));
  });

  // Catches: an upload or a file choice offered during a Nevermore support session or on an archived account, where the database would refuse it (ADR 0024, D-432): a dead control.
  it("offers no way to add a document in a support session or on an archived account, and still opens one that is there", async () => {
    advisor.loadQuotes.mockResolvedValue([storedQuote()]);
    quotes.getQuotePage.mockResolvedValue(quotePage({ request: { status: "quoted" } }));
    renderPage("/quotes/7", workspace({ isSupport: true }));
    const panel = await screen.findByRole("region", { name: "Quote document" });
    expect(within(panel).queryByLabelText("Upload the quote document")).not.toBeInTheDocument();
    cleanup();
    quotes.getQuotePage.mockResolvedValue(quotePage({ request: { status: "quoted" }, opportunity: { account: { id: "a1", name: "Harborview Dental Group", archived: true } } }));
    renderPage();
    const archived = await screen.findByRole("region", { name: "Quote document" });
    expect(within(archived).queryByLabelText("Upload the quote document")).not.toBeInTheDocument();
  });
});
