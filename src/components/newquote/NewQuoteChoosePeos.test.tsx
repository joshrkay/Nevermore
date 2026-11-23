import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";

// New quote step 4, choose PEOs (CRM-Q2.5, slice 5.8; D-1763): New quote opens the existing choose-and-send (6.7's SendToSeveralPeos, as the opportunity's page places it)
// for a certified intake with nothing sent. The database is faked at its API modules, as the opportunity page's own tests do.
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/brokerAuth", () => ({ startBrokerSignIn: vi.fn() }));
const getOpportunityPage = vi.fn();
vi.mock("@/lib/opportunityPageApi", async () => ({ ...(await vi.importActual<object>("@/lib/opportunityPageApi")), getOpportunityPage: (...a: unknown[]) => getOpportunityPage(...a) }));
const advisor = { loadSubmission: vi.fn(), fetchMyMailbox: vi.fn(), requestInformation: vi.fn() };
vi.mock("@/lib/advisorApi", async () => ({ ...(await vi.importActual<object>("@/lib/advisorApi")), ...advisor }));
const peoSend = { loadPeoSendContext: vi.fn(), sendToPeo: vi.fn() };
vi.mock("@/lib/peoSendApi", async () => ({ ...(await vi.importActual<object>("@/lib/peoSendApi")), ...peoSend }));
const peoAuthorizations = { loadPeoAuthorizations: vi.fn() };
vi.mock("@/lib/peoAuthorizationsApi", async () => ({ ...(await vi.importActual<object>("@/lib/peoAuthorizationsApi")), ...peoAuthorizations }));
const peoRegistrations = { loadRegisteredElsewhere: vi.fn() };
vi.mock("@/lib/peoRegistrationsApi", async () => ({ ...(await vi.importActual<object>("@/lib/peoRegistrationsApi")), ...peoRegistrations }));
let peoCatalogRows: unknown = [];
vi.mock("@/lib/peoCatalog", async () => {
  const { parsePeoCatalog } = await import("@/data/peoProfiles");
  return { readPeoCatalog: async () => parsePeoCatalog(await peoCatalogRows) };
});

// An intake the employer has not certified now opens the chamber (step 2, slice 5.5), tested on its own; a stand-in here.
vi.mock("@/pages/ChamberPage", () => ({ default: () => <div data-testid="chamber" /> }));

const { NewQuoteDialog } = await import("./NewQuoteDialog");

const sourced = { kind: "document", name: "Broker guide", checked_on: "2026-11-02" };
const justworks = { id: 3, name: "Justworks", profile: { version: 2, needed_to_quote: ["company_name"], sources: { answers: sourced } } };
const intake = (over: object = {}) => ({
  submissionId: "i1", fileId: "EAA-2026-0117", pipelineStatus: "ready_for_market", certifiedBy: "Elena Marsh", certifiedAt: "2026-10-28T10:00:00+00:00", version: 2,
  censusSize: 45, answered: null, prospectName: null, openItems: { count: 0, firstLabel: null, firstField: null }, ...over,
});
const page = (over: object = {}) => ({
  opportunity: { id: "o1", name: "January 2028 PEO search", stage: "ready_to_send", submissionId: "i1" },
  account: { id: "a1", name: "Harborview Dental Group", archived: false },
  owner: null, mainContact: { id: "c1", name: "Elena Marsh" }, canChange: true, canAdd: true, quotes: [], intake: intake(), contacts: [], ...over,
});
const submissionDetail = () => ({
  id: "i1", certified: true, signed: null, currentVersion: 2, certificationLacksSnapshot: false, reviews: {}, documents: [], extraAnswers: {}, fileId: "EAA-2026-0117",
  submission: { signer_name: "Elena Marsh", signer_title: "Owner", signed_at: "2026-10-28T10:00:00Z", file_id: "EAA-2026-0117", version: 2 },
  data: { ...EMPTY_CHAMBER_DATA, company_name: "Harborview", states: ["OR"] },
  provenance: { company_name: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: "2026-10-01T00:00:00Z" } },
});

const open = async () => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <MemoryRouter>
        <NewQuoteDialog firmId="f1" person="Dana Reyes" opportunityId="o1" onClose={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return screen.findByRole("dialog", { name: "New quote" });
};

beforeEach(() => {
  for (const m of [getOpportunityPage, ...Object.values(advisor), ...Object.values(peoSend), ...Object.values(peoAuthorizations), ...Object.values(peoRegistrations)]) m.mockReset();
  peoCatalogRows = [justworks];
  getOpportunityPage.mockResolvedValue(page());
  advisor.loadSubmission.mockResolvedValue(submissionDetail());
  advisor.fetchMyMailbox.mockResolvedValue({ connected: true, provider: "google", address: "dana@example.com" });
  peoSend.loadPeoSendContext.mockResolvedValue({ mailbox: { connected: true, address: "dana@example.com" }, contacts: [{ name: "Dana Lee", role: null, email: "dana@justworks.example" }], reply_address: null });
  peoAuthorizations.loadPeoAuthorizations.mockResolvedValue([{ peo: "Justworks", state: "authorized", signedAt: null, wordingVersion: null }]);
  peoRegistrations.loadRegisteredElsewhere.mockResolvedValue([]);
});

describe("New quote step 4: choose PEOs (CRM-Q2.5, D-1763)", () => {
  // Catches: step 4 as a second picker of its own, or a certified intake with nothing sent opening on the saved summary alone, with Choose PEOs a click away.
  it("opens the existing choose-and-send at once for a certified intake with nothing sent", async () => {
    const dialog = await open();
    const sending = await within(dialog).findByRole("region", { name: "Send to several PEOs" });
    expect(await within(sending).findByRole("checkbox", { name: "Justworks" })).toBeChecked();
    expect(within(dialog).getByRole("button", { name: "Save and close" })).toBeInTheDocument();
  });

  // Catches: New quote's last step offering PEOs for a workers' comp search (the database refuses each), or naming its carriers PEOs (ADR 0029).
  it("opens on the carriers for a workers' comp search, and offers no PEO", async () => {
    peoCatalogRows = [justworks, { id: 9, name: "Granite Ridge Mutual", line: "workers_comp", profile: { version: 1, needed_to_quote: ["company_name"], sources: { answers: sourced } } }];
    const p = page();
    getOpportunityPage.mockResolvedValue({ ...p, opportunity: { ...p.opportunity, name: "March 2027 workers' comp search", line: "workers_comp" } });
    peoAuthorizations.loadPeoAuthorizations.mockResolvedValue([{ peo: "Granite Ridge Mutual", state: "authorized", signedAt: null, wordingVersion: null }]);
    const dialog = await open();
    const sending = await within(dialog).findByRole("region", { name: "Send to several carriers" });
    expect(await within(sending).findByRole("checkbox", { name: "Granite Ridge Mutual" })).toBeChecked();
    expect(within(sending).queryByRole("checkbox", { name: "Justworks" })).toBeNull();
    expect(within(dialog).queryByRole("region", { name: "Send to several PEOs" })).toBeNull();
  });

  // Catches: a send from the overlay that leaves the overlay's own read of the opportunity as it was, so what it shows (quotes sent, stage) is stale after the send.
  it("reads the opportunity again once a send has gone", async () => {
    peoSend.sendToPeo.mockResolvedValue({ quoteRequestId: 1, messageId: 2 });
    const dialog = await open();
    const sending = await within(dialog).findByRole("region", { name: "Send to several PEOs" });
    await within(sending).findByRole("checkbox", { name: "Justworks" });
    await userEvent.click(within(sending).getByRole("button", { name: "Review" }));
    await userEvent.click(await within(sending).findByRole("button", { name: "Send to 1 PEO" }));
    await within(sending).findByText("Justworks: Sent. It is on the Justworks thread.");
    await waitFor(() => expect(getOpportunityPage).toHaveBeenCalledTimes(2));
  });

  // Catches: choosing PEOs offered while the intake is not certified, where there is no certified answer set to send (steps 2 and 3 are the intake itself, D-1763).
  it.each([
    ["no intake", null],
    ["an intake the employer has not certified", intake({ certifiedAt: null, certifiedBy: null, version: null })],
  ])("draws no choosing for %s", async (_what, held) => {
    getOpportunityPage.mockResolvedValue(page({ intake: held }));
    const dialog = await open();
    await within(dialog).findByText("Harborview Dental Group");
    expect(within(dialog).queryByRole("region", { name: "Send to several PEOs" })).not.toBeInTheDocument();
    expect(advisor.loadSubmission).not.toHaveBeenCalled();
  });
});

// "Send to another PEO" (CRM-Q3.4, 5.10): the same step 4, opened on an opportunity that already has quotes out.
describe("New quote step 4 with quotes already sent (CRM-Q3.4)", () => {
  const insperity = { id: 4, name: "Insperity", profile: { version: 2, needed_to_quote: ["company_name"], sources: { answers: sourced } } };
  const sentQuote = { id: 7, peoName: "Justworks", status: "sent", sentOn: "2026-11-06", quoteReceivedOn: null, quoteExpiresOn: null, adminFeePepm: null };
  beforeEach(() => {
    peoCatalogRows = [justworks, insperity];
    peoAuthorizations.loadPeoAuthorizations.mockResolvedValue([
      { peo: "Justworks", state: "authorized", signedAt: null, wordingVersion: null },
      { peo: "Insperity", state: "authorized", signedAt: null, wordingVersion: null },
    ]);
    getOpportunityPage.mockResolvedValue(page({ quotes: [sentQuote], opportunity: { id: "o1", name: "January 2028 PEO search", stage: "in_market", submissionId: "i1" } }));
  });

  // Catches: a choosing step that lists a PEO already sent to as if it were new, so the agent can't tell which PEOs are already out.
  it("marks the PEOs already sent to, with the day, and no other", async () => {
    const dialog = await open();
    const sending = await within(dialog).findByRole("region", { name: "Send to several PEOs" });
    const sent = (await within(sending).findByRole("checkbox", { name: "Justworks" })).closest("li") as HTMLElement;
    expect(within(sent).getByText("Already sent on Nov 6, 2026. Sending again continues its quote.")).toBeInTheDocument();
    const other = within(sending).getByRole("checkbox", { name: "Insperity" }).closest("li") as HTMLElement;
    expect(within(other).queryByText(/Already sent/)).toBeNull();
  });

  // Catches: a PEO sent to under another capitalisation (the quote request keeps the name as typed) left unmarked, so it looks new.
  it("marks a PEO sent to whatever the case of its name on the quote request", async () => {
    getOpportunityPage.mockResolvedValue(page({ quotes: [{ ...sentQuote, peoName: "justworks" }] }));
    const dialog = await open();
    const sending = await within(dialog).findByRole("region", { name: "Send to several PEOs" });
    expect(await within(sending).findByText(/^Already sent on Nov 6, 2026/)).toBeInTheDocument();
  });

  // Catches: a quote request that was never sent (no day sent) marked as sent, with a day that isn't there.
  it("does not mark a PEO whose quote request was not sent", async () => {
    getOpportunityPage.mockResolvedValue(page({ quotes: [{ ...sentQuote, sentOn: null }] }));
    const dialog = await open();
    const sending = await within(dialog).findByRole("region", { name: "Send to several PEOs" });
    await within(sending).findByRole("checkbox", { name: "Justworks" });
    expect(within(sending).queryByText(/Already sent/)).toBeNull();
  });

  // Catches: New quote's address opened on a won or lost opportunity offering to send, where the database refuses every send and a PEO can be added only before Won or Lost.
  it.each(["won", "lost"])("draws no choosing once the opportunity is %s", async (stage) => {
    getOpportunityPage.mockResolvedValue(page({ quotes: [sentQuote], opportunity: { id: "o1", name: "January 2028 PEO search", stage, submissionId: "i1" } }));
    const dialog = await open();
    await within(dialog).findByText("Harborview Dental Group");
    expect(within(dialog).queryByRole("region", { name: "Send to several PEOs" })).not.toBeInTheDocument();
    expect(advisor.loadSubmission).not.toHaveBeenCalled();
  });
});
