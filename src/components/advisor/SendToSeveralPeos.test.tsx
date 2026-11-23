import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import type { CertifiedVersion } from "@/data/peoCompleteness";
import { parsePeoCatalog } from "@/data/peoProfiles";
import type { ChamberSubmission } from "@/data/manuscript";

// Seam 2 (D-13): an advisor sends the bundle to several PEOs at once from the submission page (M-2.2), with the database faked at its API modules
// (6.6's per-PEO send, the composer's read, the employer's authorizations) and the mailbox check at advisorApi, as useFirstSend (6.1) reads it.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const fetchMyMailbox = vi.fn();
const requestInformation = vi.fn();
vi.mock("@/lib/advisorApi", () => ({ fetchMyMailbox: () => fetchMyMailbox(), requestInformation: (...a: unknown[]) => requestInformation(...a) }));
vi.mock("@/lib/brokerAuth", () => ({ startBrokerSignIn: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const loadPeoSendContext = vi.fn();
const sendToPeo = vi.fn();
vi.mock("@/lib/peoSendApi", () => ({
  loadPeoSendContext: (...a: unknown[]) => loadPeoSendContext(...a),
  sendToPeo: (...a: unknown[]) => sendToPeo(...a),
}));
const loadPeoAuthorizations = vi.fn();
vi.mock("@/lib/peoAuthorizationsApi", () => ({ loadPeoAuthorizations: (...a: unknown[]) => loadPeoAuthorizations(...a) }));
const loadRegisteredElsewhere = vi.fn();
vi.mock("@/lib/peoRegistrationsApi", () => ({ loadRegisteredElsewhere: (...a: unknown[]) => loadRegisteredElsewhere(...a) }));
const fetchFirmApprovedToSend = vi.fn();
vi.mock("@/lib/firmApi", async () => ({ ...(await vi.importActual<object>("@/lib/firmApi")), fetchFirmApprovedToSend: (...a: unknown[]) => fetchFirmApprovedToSend(...a) }));
const issueBundleLink = vi.fn();
vi.mock("@/lib/bundleLink", () => ({ issueBundleLink: (...a: unknown[]) => issueBundleLink(...a), supabaseBundleLinkDeps: async () => ({}) }));

const { default: SendToSeveralPeos } = await import("./SendToSeveralPeos");
const { WorkspaceContext } = await import("@/components/workspace/workspaceContext");

const sourced = { kind: "document", name: "Broker guide", checked_on: "2026-11-02" };
// Justworks: everything it needs to quote is held, and it fits. TriNet: an answer and a document missing, and a headcount check not met (12 of 20).
// Oasis: complete and fitting too, a third PEO for the cases that stop one.
const catalog = parsePeoCatalog([
  { id: 3, name: "Justworks", profile: { version: 2, needed_to_quote: ["company_name", "pay_frequency"], sources: { answers: sourced } } },
  { id: 4, name: "Oasis", profile: { version: 1, needed_to_quote: ["company_name"], sources: { answers: sourced } } },
  { id: 5, name: "TriNet", profile: {
    version: 4, needed_to_quote: ["company_name", "hris_system"],
    documents: [{ category: "workers_comp_loss_runs", description: "Three years of loss runs" }],
    min_headcount: 20, sources: { answers: sourced, documents: sourced, min_headcount: sourced },
  } },
]);
const data = { ...EMPTY_CHAMBER_DATA, company_name: "Reyes Bakery", employee_count: 12, pay_frequency: "Bi-weekly" };
const confirmed = { status: "confirmed" as const, source: { kind: "prospect_edit" as const }, updated_at: "2026-10-01T00:00:00Z" };
const certified: CertifiedVersion = {
  intake: { data, provenance: { company_name: confirmed, employee_count: confirmed, pay_frequency: confirmed }, verified: new Set(), extraAnswers: {} },
  documents: [], version: 3, changedSince: false, cantTell: false,
};
const submission: ChamberSubmission = { signer_name: "Lucia Reyes", signer_title: "Owner", signed_at: "2026-10-01T12:00:00Z", file_id: "EAA-2026-0042", version: 3 };

const contacts: Record<string, { name: string; role: string | null; email: string }[]> = {
  Justworks: [{ name: "Dana Lee", role: "Underwriter", email: "dana@justworks.example" }],
  Oasis: [{ name: "Omar Diaz", role: null, email: "omar@oasis.example" }, { name: "Ruth Kim", role: "Sales", email: "ruth@oasis.example" }],
  TriNet: [{ name: "Tess Park", role: null, email: "tess@trinet.example" }],
};
const authorized = (...peos: string[]) => ["Justworks", "Oasis", "TriNet"].map((peo) => ({
  peo, state: peos.includes(peo) ? "authorized" : "not_asked", signedAt: null, wordingVersion: null,
}));

const props = {
  sessionId: "s1", certified, catalog, submission, fileId: "EAA-2026-0042", companyName: "Reyes Bakery",
  returnTo: "/advisor/submissions/s1", onSent: vi.fn(),
};

const open = async () => {
  render(<SendToSeveralPeos {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Send to several PEOs" }));
  return screen.findByRole("region", { name: "Send to several PEOs" });
};
/** The panel with the extra props, inside a workspace when a firm is given (the panel reads the firm's approval from it). */
const openWith = async (extra: Record<string, unknown>, firm: { id: string; name: string; address: string } | null = null) => {
  render(
    <WorkspaceContext.Provider value={{ firm, role: "Agent", isOwner: false, isSupport: false, supportEndsAt: null, supportSessionId: null, isPlatformAdmin: false, person: "Sam" }}>
      <SendToSeveralPeos {...props} {...extra} />
    </WorkspaceContext.Provider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Send to several PEOs" }));
  return screen.findByRole("region", { name: "Send to several PEOs" });
};
const peoRow = async (region: HTMLElement, peo: string) => (await within(region).findByRole("checkbox", { name: peo })).closest("li")!;

describe("SendToSeveralPeos", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 16, 12));
    fetchMyMailbox.mockReset().mockResolvedValue({ connected: true, provider: "google", address: "sam@acme.example" });
    loadPeoSendContext.mockReset().mockImplementation(async (_s: string, peo: string) => ({
      mailbox: { connected: true, address: "sam@acme.example" }, contacts: contacts[peo] ?? [], reply_address: null,
    }));
    loadPeoAuthorizations.mockReset().mockResolvedValue(authorized("Justworks", "Oasis", "TriNet"));
    loadRegisteredElsewhere.mockReset().mockResolvedValue([]);
    fetchFirmApprovedToSend.mockReset().mockResolvedValue(true);
    sendToPeo.mockReset().mockImplementation(async (s: { peo: string }) => ({ quoteRequestId: s.peo.length, messageId: 40 + s.peo.length }));
    issueBundleLink.mockReset().mockResolvedValue({ id: 9, token: "t", url: "https://app.example/b/t", expiresAt: "2026-12-16T00:00:00Z", version: 3, notIncluded: [] });
  });

  // Break caught (Q-2.2, D-604): a PEO another firm already registered this employer with is sent without the advisor being told, the review names
  // the firm or puts the warning on the wrong PEO, or the PEO is held back: the warning never stops a send.
  it("in the review, tells of each PEO another firm registered this employer with and when, naming nobody, and still sends it", async () => {
    loadRegisteredElsewhere.mockResolvedValue([{ peo: "Oasis", registered_at: "2026-11-03T15:00:00Z" }]);
    const region = await open();
    fireEvent.change(await within(region).findByLabelText("Your note"), { target: { value: "Here it is." } });
    fireEvent.click(within(region).getByRole("button", { name: "Review" }));
    const oasis = await within(region).findByRole("article", { name: "Oasis" });
    expect(await within(oasis).findByText("Another firm registered this employer with this PEO on Nov 3.")).toBeInTheDocument();
    expect(within(region).getByRole("article", { name: "Justworks" })).not.toHaveTextContent("Another firm");
    expect(loadRegisteredElsewhere).toHaveBeenCalledWith("s1");
    fireEvent.click(within(region).getByRole("button", { name: "Send to 2 PEOs" }));
    await waitFor(() => expect(sendToPeo).toHaveBeenCalledTimes(2));
  });

  // Break caught: a PEO that isn't ready (something missing to quote, or an eligibility check not met) ticked by default and sent without the
  // advisor choosing it, or shown without saying what is missing; or a ready PEO left unticked.
  it("ticks each ready PEO and leaves one that isn't ready unticked, saying what it is missing", async () => {
    const region = await open();
    expect(await within(region).findByRole("checkbox", { name: "Justworks" })).toBeChecked();
    expect(within(region).getByRole("checkbox", { name: "Oasis" })).toBeChecked();
    expect(within(region).getByRole("checkbox", { name: "TriNet" })).not.toBeChecked();
    const trinet = await peoRow(region, "TriNet");
    expect(trinet).toHaveTextContent("Not ready");
    expect(trinet).toHaveTextContent("HRIS system");
    expect(trinet).toHaveTextContent("Doesn't meet · Minimum headcount");
    expect(await peoRow(region, "Justworks")).toHaveTextContent("Ready");
  });

  // Break caught: one message to every PEO (each seeing the others' addresses or names), a PEO's send addressed to another PEO's people, the
  // advisor's note lost or written per PEO, a greeting naming someone at another PEO, or a PEO left unticked sent anyway.
  it("sends each chosen PEO its own message, to its own people only, with its own greeting over the one note", async () => {
    const region = await open();
    fireEvent.click(await within(region).findByRole("checkbox", { name: "Oasis" }));
    fireEvent.click(within(region).getByRole("checkbox", { name: "TriNet" }));
    fireEvent.change(within(region).getByLabelText("Your note"), { target: { value: "Here is Reyes Bakery, a 12-person bakery." } });
    fireEvent.click(within(region).getByRole("button", { name: "Review" }));
    fireEvent.click(await within(region).findByRole("button", { name: "Send to 2 PEOs" }));
    await waitFor(() => expect(sendToPeo).toHaveBeenCalledTimes(2));
    const calls = sendToPeo.mock.calls.map(([s]) => s as { sessionId: string; peo: string; to: string[]; subject: string; note: string });
    expect(calls.map(({ sessionId, peo, to, subject, note }) => ({ sessionId, peo, to, subject, note }))).toEqual([
      { sessionId: "s1", peo: "Justworks", to: ["dana@justworks.example"], subject: "Reyes Bakery: EAA-2026-0042, version 3", note: "Hello Dana,\n\nHere is Reyes Bakery, a 12-person bakery." },
      { sessionId: "s1", peo: "TriNet", to: ["tess@trinet.example"], subject: "Reyes Bakery: EAA-2026-0042, version 3", note: "Hello Tess,\n\nHere is Reyes Bakery, a 12-person bakery." },
    ]);
    expect(JSON.stringify(calls[0])).not.toMatch(/trinet|tess/i);
    expect(JSON.stringify(calls[1])).not.toMatch(/justworks|dana/i);
  });

  // Break caught: one link for every PEO, a link made from another PEO's plan (its files, layout and open items), a link for another PEO's quote
  // request, or a PEO that isn't ready sent a message whose block says "Open items: none".
  it("issues each PEO its own link from its own plan, for its own quote request, so a PEO that isn't ready is sent its open items", async () => {
    const region = await open();
    fireEvent.click(await within(region).findByRole("checkbox", { name: "TriNet" }));
    fireEvent.change(within(region).getByLabelText("Your note"), { target: { value: "Here it is." } });
    fireEvent.click(within(region).getByRole("button", { name: "Review" }));
    fireEvent.click(await within(region).findByRole("button", { name: "Send to 3 PEOs" }));
    await waitFor(() => expect(sendToPeo).toHaveBeenCalledTimes(3));
    const links = sendToPeo.mock.calls.map(([s]) => s as { peo: string; issueLink: (id: number) => Promise<unknown> });
    await expect(links[0].issueLink(11)).resolves.toEqual({ id: 9, token: "t" });
    await links[2].issueLink(13);
    const inputs = issueBundleLink.mock.calls.map(([i]) => i as { quoteRequestId: number; plan: { peo: string; version: number; missing: { label: string }[] }; answers: { version: number } });
    expect(inputs.map((i) => [i.quoteRequestId, i.plan.peo, i.plan.version, i.answers.version, i.plan.missing.map((m) => m.label)])).toEqual([
      [11, "Justworks", 3, 3, []],
      [13, "TriNet", 3, 3, ["HRIS system", "Workers' comp loss runs"]],
    ]);
  });

  // Break caught: a send to several PEOs with nothing shown before it goes, or a review that hides who each PEO's message goes to, what its link
  // carries or what it is missing, or that shows a PEO not chosen.
  it("reviews each chosen PEO before anything goes: its recipients, its greeting, its files and its gaps", async () => {
    const region = await open();
    fireEvent.click(await within(region).findByRole("checkbox", { name: "Justworks" }));
    fireEvent.click(within(region).getByRole("checkbox", { name: "TriNet" }));
    await waitFor(() => expect(loadPeoSendContext).toHaveBeenCalledTimes(3));
    fireEvent.click(within(region).getByRole("button", { name: "Review" }));
    const reviewed = await within(region).findAllByRole("article");
    expect(reviewed.map((a) => within(a).getByRole("heading").textContent)).toEqual(["Oasis", "TriNet"]);
    const [oasis, trinet] = reviewed;
    expect(oasis).toHaveTextContent("To: Omar Diaz (omar@oasis.example), Ruth Kim, Sales (ruth@oasis.example)");
    expect(oasis).toHaveTextContent("Hello Omar and Ruth,");
    expect(oasis).toHaveTextContent("Includes: packet, workers' comp application");
    expect(oasis).toHaveTextContent("Open items: none");
    expect(trinet).toHaveTextContent("To: Tess Park (tess@trinet.example)");
    expect(trinet).toHaveTextContent("Open items: HRIS system; Workers' comp loss runs");
    expect(trinet).toHaveTextContent("Doesn't meet · Minimum headcount");
    expect(sendToPeo).not.toHaveBeenCalled();
  });

  const result = async (region: HTMLElement) =>
    within(await within(region).findByRole("list", { name: "What was sent" })).getAllByRole("listitem").map((li) => li.firstChild?.textContent);

  // Break caught: a PEO the employer never authorized sent to, or stopping every other PEO's send with it, or a result that doesn't say which
  // went and why one didn't.
  it("stops a PEO the employer hasn't authorized, sends the rest, and says sent or not sent for each, with the reason", async () => {
    loadPeoAuthorizations.mockResolvedValue(authorized("Justworks", "Oasis"));
    const region = await open();
    fireEvent.click(await within(region).findByRole("checkbox", { name: "TriNet" }));
    fireEvent.click(within(region).getByRole("button", { name: "Review" }));
    const trinet = (await within(region).findByRole("heading", { name: "TriNet" })).closest("article")!;
    expect(trinet).toHaveTextContent("Won't be sent: The employer hasn't authorized TriNet to receive their packet. Ask them to add it.");
    fireEvent.click(within(region).getByRole("button", { name: "Send to 2 PEOs" }));
    expect(await result(region)).toEqual([
      "Justworks: Sent. It is on the Justworks thread.",
      "Oasis: Sent. It is on the Oasis thread.",
      "TriNet: Not sent. The employer hasn't authorized TriNet to receive their packet. Ask them to add it.",
    ]);
    expect(sendToPeo.mock.calls.map(([s]) => (s as { peo: string }).peo)).toEqual(["Justworks", "Oasis"]);
  });

  // Break caught: a PEO with nobody to send to holding up the others, a send attempted to no address, or a result silent about why.
  it("stops a PEO whose profile has no contact address, sends the rest, and says why", async () => {
    contacts.Oasis = [];
    try {
      const region = await open();
      await waitFor(() => expect(loadPeoSendContext).toHaveBeenCalledTimes(3));
      fireEvent.click(within(region).getByRole("button", { name: "Review" }));
      const oasis = (await within(region).findByRole("heading", { name: "Oasis" })).closest("article")!;
      expect(oasis).toHaveTextContent("Won't be sent: Oasis's profile has no contact with an email, so there is nobody to send it to.");
      fireEvent.click(within(region).getByRole("button", { name: "Send to 1 PEO" }));
      expect(await result(region)).toEqual([
        "Justworks: Sent. It is on the Justworks thread.",
        "Oasis: Not sent. Oasis's profile has no contact with an email, so there is nobody to send it to.",
      ]);
      expect(sendToPeo).toHaveBeenCalledTimes(1);
    } finally {
      contacts.Oasis = [{ name: "Omar Diaz", role: null, email: "omar@oasis.example" }, { name: "Ruth Kim", role: "Sales", email: "ruth@oasis.example" }];
    }
  });

  // Break caught: one PEO's send refused by the database (or its link not made) ending the whole run, so the PEOs after it are never sent, or
  // its refusal reported as sent or in other words than the database's.
  it("keeps sending after one PEO's send is refused, and gives that PEO the refusal's own words", async () => {
    sendToPeo.mockImplementation(async (s: { peo: string }) => {
      if (s.peo === "Justworks") throw Object.assign(new Error("The employer withdrew Justworks. Nothing more can be sent to it."), { code: "22023" });
      return { quoteRequestId: 1, messageId: 2 };
    });
    const region = await open();
    await waitFor(() => expect(loadPeoSendContext).toHaveBeenCalledTimes(3));
    fireEvent.click(within(region).getByRole("button", { name: "Review" }));
    fireEvent.click(await within(region).findByRole("button", { name: "Send to 2 PEOs" }));
    expect(await result(region)).toEqual([
      "Justworks: Not sent. The employer withdrew Justworks. Nothing more can be sent to it.",
      "Oasis: Sent. It is on the Oasis thread.",
    ]);
    expect(props.onSent).toHaveBeenCalled();
  });

  // Break caught: an advisor with no connected mailbox (or whose permission was taken back) sending anyway, so every PEO's message is recorded
  // with no From, or left with no way on.
  it("with no mailbox, sends nothing to any PEO and offers to connect one", async () => {
    fetchMyMailbox.mockResolvedValue({ connected: false });
    const region = await open();
    await waitFor(() => expect(loadPeoSendContext).toHaveBeenCalledTimes(3));
    fireEvent.click(within(region).getByRole("button", { name: "Review" }));
    fireEvent.click(await within(region).findByRole("button", { name: "Send to 2 PEOs" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Connect your email to send this");
    expect(within(dialog).queryByRole("button", { name: "Send from your own mail" })).not.toBeInTheDocument();
    expect(sendToPeo).not.toHaveBeenCalled();
  });

  // Break caught: a PEO whose contacts couldn't be read reviewed as going to nobody and sent to no address, or its failure stopping the rest.
  it("stops a PEO whose contacts couldn't be loaded, says so, and sends the rest", async () => {
    loadPeoSendContext.mockImplementation(async (_s: string, peo: string) => {
      if (peo === "Oasis") throw new Error("network");
      return { mailbox: { connected: true, address: "sam@acme.example" }, contacts: contacts[peo] ?? [], reply_address: null };
    });
    const region = await open();
    await waitFor(() => expect(loadPeoSendContext).toHaveBeenCalledTimes(3));
    fireEvent.click(within(region).getByRole("button", { name: "Review" }));
    const oasis = (await within(region).findByRole("heading", { name: "Oasis" })).closest("article")!;
    expect(oasis).toHaveTextContent("Won't be sent: We couldn't load Oasis's contacts. Close this and open it again to try again.");
    fireEvent.click(within(region).getByRole("button", { name: "Send to 1 PEO" }));
    expect(await result(region)).toEqual([
      "Justworks: Sent. It is on the Justworks thread.",
      "Oasis: Not sent. We couldn't load Oasis's contacts. Close this and open it again to try again.",
    ]);
  });

  // Break caught: no way out once the result is shown, or reopening it showing the last run's result and contacts read before, so a PEO's
  // contacts that failed to load can never be read again.
  it("closes, and opens again at the choosing step with each PEO's contacts read afresh", async () => {
    const region = await open();
    await waitFor(() => expect(loadPeoSendContext).toHaveBeenCalledTimes(3));
    fireEvent.click(within(region).getByRole("button", { name: "Review" }));
    fireEvent.click(await within(region).findByRole("button", { name: "Send to 2 PEOs" }));
    await result(region);
    fireEvent.click(within(region).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "Send to several PEOs" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send to several PEOs" }));
    const again = await screen.findByRole("region", { name: "Send to several PEOs" });
    expect(within(again).getByRole("button", { name: "Review" })).toBeInTheDocument();
    await waitFor(() => expect(loadPeoSendContext).toHaveBeenCalledTimes(6));
  });

  // Break caught (found by mutation): a PEO with everything it needs to quote but an eligibility check not met counted as ready and ticked.
  it("leaves a PEO unticked that has everything it needs to quote but fails an eligibility check", async () => {
    const strict = parsePeoCatalog([{ id: 3, name: "Justworks", profile: { version: 2, needed_to_quote: ["company_name"], min_headcount: 20, sources: { answers: sourced, min_headcount: sourced } } }]);
    render(<SendToSeveralPeos {...props} catalog={strict} />);
    fireEvent.click(screen.getByRole("button", { name: "Send to several PEOs" }));
    const region = await screen.findByRole("region", { name: "Send to several PEOs" });
    expect(within(region).getByRole("checkbox", { name: "Justworks" })).not.toBeChecked();
    expect(await peoRow(region, "Justworks")).toHaveTextContent("Not ready: Doesn't meet · Minimum headcount");
  });

  // Break caught (found by mutation): reopening after a failed read still showing the old failure (or old recipients) before the new read answers.
  it("forgets the last opening's reads when closed", async () => {
    loadPeoSendContext.mockImplementationOnce(async () => { throw new Error("network"); });
    const region = await open();
    await waitFor(() => expect(loadPeoSendContext).toHaveBeenCalledTimes(3));
    fireEvent.click(within(region).getByRole("button", { name: "Close" }));
    loadPeoSendContext.mockImplementation(() => new Promise(() => undefined));
    fireEvent.click(screen.getByRole("button", { name: "Send to several PEOs" }));
    const again = await screen.findByRole("region", { name: "Send to several PEOs" });
    fireEvent.click(within(again).getByRole("button", { name: "Review" }));
    expect(await within(again).findAllByRole("article")).toHaveLength(2);
    expect(again).not.toHaveTextContent("couldn't load");
  });
});

// 5.0y: the opportunity's quotes panel places this component as "Choose PEOs", opened at once once the submission it needs has been read.
describe("SendToSeveralPeos: as Choose PEOs on the opportunity's page", () => {
  beforeEach(() => {
    fetchMyMailbox.mockReset().mockResolvedValue({ connected: true, provider: "google", address: "sam@acme.example" });
    loadPeoSendContext.mockReset().mockResolvedValue({ mailbox: { connected: true, address: "sam@acme.example" }, contacts: [], reply_address: null });
    loadPeoAuthorizations.mockReset().mockResolvedValue([]);
    loadRegisteredElsewhere.mockReset().mockResolvedValue([]);
  });

  // Catches: Choose PEOs that needs a second click after the person has already chosen it (the page reads the submission first, then there is nothing left to choose).
  it("opens at once when asked to", async () => {
    render(<SendToSeveralPeos {...props} startOpen />);
    expect(await screen.findByRole("region", { name: "Send to several PEOs" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send to several PEOs" })).not.toBeInTheDocument();
  });
});

// Issue #236: on a database where no PEO has a published profile (every PEO starts as an empty draft), the choosing step used to open with no PEO on it and no
// word why: a note box and a Review button with nothing to choose.
describe("SendToSeveralPeos: when no PEO has a published profile", () => {
  beforeEach(() => {
    fetchMyMailbox.mockReset().mockResolvedValue({ connected: true, provider: "google", address: "sam@acme.example" });
    loadPeoSendContext.mockReset().mockResolvedValue({ mailbox: { connected: true, address: "sam@acme.example" }, contacts: [], reply_address: null });
    loadPeoAuthorizations.mockReset().mockResolvedValue([]);
    loadRegisteredElsewhere.mockReset().mockResolvedValue([]);
  });

  // Catches: an empty list that looks like a list still loading or broken, with a note box and a Review button that lead nowhere.
  it("says nobody can be chosen yet, and offers no note, no Review and no checkbox", async () => {
    render(<SendToSeveralPeos {...props} catalog={[]} startOpen openLabel="Choose PEOs" />);
    const region = await screen.findByRole("region", { name: "Send to several PEOs" });
    expect(within(region).getByText("No PEO can be chosen yet: none has a published profile. Ask Nevermore to publish the PEOs you quote with.")).toBeInTheDocument();
    expect(within(region).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(region).queryByLabelText("Your note")).not.toBeInTheDocument();
    expect(within(region).queryByLabelText("Subject")).not.toBeInTheDocument();
    expect(within(region).queryByRole("button", { name: "Review" })).not.toBeInTheDocument();
  });

  // Catches: an empty panel that can't be put away, so the page keeps a dead panel in place of its Choose PEOs button.
  it("can still be closed, back to the button that opened it", async () => {
    render(<SendToSeveralPeos {...props} catalog={[]} startOpen openLabel="Choose PEOs" />);
    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    expect(await screen.findByRole("button", { name: "Choose PEOs" })).toBeInTheDocument();
  });

  // Catches: the new message shown to a broker whose PEOs do have profiles.
  it("says nothing of the kind when there are PEOs to choose from", async () => {
    render(<SendToSeveralPeos {...props} startOpen />);
    const region = await screen.findByRole("region", { name: "Send to several PEOs" });
    expect(await within(region).findByRole("checkbox", { name: "Justworks" })).toBeInTheDocument();
    expect(region).not.toHaveTextContent("No PEO can be chosen yet");
    expect(within(region).getByRole("button", { name: "Review" })).toBeInTheDocument();
  });
});

describe("SendToSeveralPeos: the label that opens it", () => {
  // Catches: a Choose PEOs that turns into "Send to several PEOs" once it has been closed, two names for one thing on one page.
  it("names the button it comes back to as it was asked to", async () => {
    render(<SendToSeveralPeos {...props} startOpen openLabel="Choose PEOs" />);
    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    expect(await screen.findByRole("button", { name: "Choose PEOs" })).toBeInTheDocument();
  });
});

// 5.8 CRM-Q2.5: step 4 of New quote is this component, so the choosing step says what the story's step 4 says about each PEO.
describe("SendToSeveralPeos: choosing (CRM-Q2.5)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 16, 12));
    fetchMyMailbox.mockReset().mockResolvedValue({ connected: true, provider: "google", address: "sam@acme.example" });
    loadPeoSendContext.mockReset().mockImplementation(async (_s: string, peo: string) => ({
      mailbox: { connected: true, address: "sam@acme.example" }, contacts: contacts[peo] ?? [], reply_address: null,
    }));
    loadPeoAuthorizations.mockReset().mockResolvedValue(authorized("Justworks", "Oasis", "TriNet"));
    loadRegisteredElsewhere.mockReset().mockResolvedValue([]);
    requestInformation.mockReset().mockResolvedValue(undefined);
  });

  // Break caught: a PEO whose fit can't be told yet (its rules aren't sourced) shows nothing about fit, so the agent reads silence as "fits".
  it("says a PEO's fit can't be told yet, with the reason", async () => {
    const region = await open();
    expect(await peoRow(region, "Justworks")).toHaveTextContent("Can't tell yet · Justworks's minimum headcount isn't checked yet.");
  });

  // Break caught (found by mutation): the reason taken from the PEO's first check whatever it said, so a PEO whose first check is met gives a met check's sentence as why its fit can't be told.
  it("gives the reason from the check that says so, not from the first check", async () => {
    const mixed = parsePeoCatalog([{ id: 3, name: "Justworks", profile: { version: 2, needed_to_quote: ["company_name"], min_headcount: 10, sources: { answers: sourced, min_headcount: sourced } } }]);
    render(<SendToSeveralPeos {...props} catalog={mixed} startOpen />);
    const region = await screen.findByRole("region", { name: "Send to several PEOs" });
    expect(await peoRow(region, "Justworks")).toHaveTextContent("Can't tell yet · Justworks's states served aren't checked yet.");
  });

  // Break caught: a PEO that fails a check shows only "Not ready" with a label, never the PEO's fact against the employer's, so the agent can't judge the warning.
  it("says a PEO doesn't fit, with the reason", async () => {
    const region = await open();
    expect(await peoRow(region, "TriNet")).toHaveTextContent("Doesn't meet · TriNet takes groups of 20 or more employees; this employer has 12.");
  });

  // Break caught: the employer's say is hidden until the review, so an agent ticks a PEO the employer never authorized and finds out only at the end.
  it("says, for each PEO, whether the employer authorized it", async () => {
    loadPeoAuthorizations.mockResolvedValue(authorized("Justworks", "Oasis"));
    const region = await open();
    await waitFor(async () => expect(await peoRow(region, "TriNet")).toHaveTextContent("Not authorized"));
    expect(await peoRow(region, "Justworks")).toHaveTextContent("May receive it");
  });

  // Break caught: a PEO the employer hasn't authorized can be ticked (or starts ticked because it is otherwise ready), so the agent builds a send the database must refuse.
  it("doesn't let a PEO the employer hasn't authorized be ticked, even one that is ready", async () => {
    loadPeoAuthorizations.mockResolvedValue(authorized("Justworks"));
    const region = await open();
    await waitFor(() => expect(within(region).getByRole("checkbox", { name: "Oasis" })).toBeDisabled());
    expect(within(region).getByRole("checkbox", { name: "Oasis" })).not.toBeChecked();
    expect(within(region).getByRole("checkbox", { name: "Justworks" })).toBeEnabled();
    expect(within(region).getByRole("checkbox", { name: "Justworks" })).toBeChecked();
  });

  // Break caught (found by mutation): a PEO the employer withdrew treated like one not yet asked, so it can be ticked and the agent builds a send the database refuses.
  it("doesn't let a PEO the employer withdrew be ticked, and says it was withdrawn", async () => {
    loadPeoAuthorizations.mockResolvedValue([
      { peo: "Justworks", state: "authorized", signedAt: null, wordingVersion: null }, { peo: "Oasis", state: "withdrawn", signedAt: null, wordingVersion: null },
      { peo: "TriNet", state: "authorized", signedAt: null, wordingVersion: null },
    ]);
    const region = await open();
    await waitFor(() => expect(within(region).getByRole("checkbox", { name: "Oasis" })).toBeDisabled());
    expect(await peoRow(region, "Oasis")).toHaveTextContent("Withdrawn by the employer");
  });

  // Break caught: no way to get an unauthorized PEO added from here (the agent has to leave step 4 to write to the employer), or an ask that sends nothing,
  // names the wrong PEO, or goes to the wrong person: it is an information request on this intake.
  it("sends the employer an information request to add a PEO they haven't authorized", async () => {
    loadPeoAuthorizations.mockResolvedValue(authorized("Justworks", "Oasis"));
    const region = await open();
    fireEvent.click(await within(region).findByRole("button", { name: "Ask Lucia to add TriNet" }));
    await waitFor(() => expect(requestInformation).toHaveBeenCalledTimes(1));
    const [session, message, fields] = requestInformation.mock.calls[0];
    expect(session).toBe("s1");
    expect(fields).toEqual([]);
    expect(message).toMatch(/send your packet to TriNet/);
    expect(message).not.toMatch(/Justworks|Oasis/);
  });

  // Break caught: an ask that gives no sign it went, so the agent asks twice and the employer gets two emails.
  it("says the employer was asked, and offers the ask once", async () => {
    loadPeoAuthorizations.mockResolvedValue(authorized("Justworks", "Oasis"));
    requestInformation.mockResolvedValue(undefined);
    const region = await open();
    fireEvent.click(await within(region).findByRole("button", { name: "Ask Lucia to add TriNet" }));
    expect(await peoRow(region, "TriNet")).toHaveTextContent("Asked Lucia to add TriNet.");
    expect(within(region).queryByRole("button", { name: "Ask Lucia to add TriNet" })).not.toBeInTheDocument();
  });

  // Break caught: a refused ask (no certification yet, a closing firm) that says nothing, or marks the employer as asked when no email went.
  it("says why an ask was refused, in the database's words, and keeps the ask on offer", async () => {
    loadPeoAuthorizations.mockResolvedValue(authorized("Justworks", "Oasis"));
    requestInformation.mockRejectedValue(Object.assign(new Error("Your firm is closing, so nothing can be sent."), { code: "PT423" }));
    const region = await open();
    fireEvent.click(await within(region).findByRole("button", { name: "Ask Lucia to add TriNet" }));
    expect(await peoRow(region, "TriNet")).toHaveTextContent("Your firm is closing, so nothing can be sent.");
    expect(within(region).getByRole("button", { name: "Ask Lucia to add TriNet" })).toBeInTheDocument();
    expect(await peoRow(region, "TriNet")).not.toHaveTextContent("Asked Lucia");
  });

  // Break caught: the firm's contact at each PEO is only seen in the review, so the agent chooses without knowing who would get it (or that nobody would).
  it("names the firm's contact at each PEO while choosing", async () => {
    const region = await open();
    await waitFor(async () => expect(await peoRow(region, "Oasis")).toHaveTextContent("Contact: Omar Diaz, Ruth Kim (Sales)"));
    expect(await peoRow(region, "Justworks")).toHaveTextContent("Contact: Dana Lee (Underwriter)");
  });

  // Break caught: with no PEO authorized the agent can still press on to a review that has nothing to send, or isn't told why.
  it("with no PEO authorized, disables Review and says the employer hasn't authorized one yet", async () => {
    loadPeoAuthorizations.mockResolvedValue(authorized());
    const region = await open();
    expect(await within(region).findByText("Lucia hasn't authorized a PEO yet.")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Review" })).toBeDisabled();
  });

  // Break caught: the empty-authorization state with no way out, so the agent leaves step 4 to find where to ask; or an ask that names none of the PEOs to pick from.
  it("with no PEO authorized, 'Ask Lucia' sends one information request naming the listed PEOs", async () => {
    loadPeoAuthorizations.mockResolvedValue(authorized());
    const region = await open();
    fireEvent.click(await within(region).findByRole("button", { name: "Ask Lucia" }));
    await waitFor(() => expect(requestInformation).toHaveBeenCalledTimes(1));
    const [session, message, fields] = requestInformation.mock.calls[0];
    expect([session, fields]).toEqual(["s1", []]);
    expect(message).toMatch(/Justworks, Oasis, TriNet/);
    expect(message).toMatch(/Nothing goes to a PEO until you do\./);
  });

  // Break caught: an empty list that shows a blank form, or blames the employer ("hasn't authorized a PEO") for a directory nobody has filled.
  it("with no PEOs listed, says so and who to ask, instead of asking the employer", async () => {
    render(<SendToSeveralPeos {...props} catalog={[]} startOpen />);
    const region = await screen.findByRole("region", { name: "Send to several PEOs" });
    expect(within(region).getByText("No PEO can be chosen yet: none has a published profile. Ask Nevermore to publish the PEOs you quote with.")).toBeInTheDocument();
    expect(region).not.toHaveTextContent("hasn't authorized");
    expect(within(region).queryByRole("button", { name: "Review" })).not.toBeInTheDocument();
  });

  // Break caught (CRM-Q2.6): a send that failed stays failed with no way to retry it, so the agent re-sends all of them (the PEOs that went get a second email),
  // or retries and sends to the wrong PEO.
  it("offers Try again on a PEO whose send failed, which sends that PEO alone", async () => {
    sendToPeo.mockReset()
      .mockRejectedValueOnce(Object.assign(new Error("The mail provider refused the message."), { code: "PT500" }))
      .mockResolvedValue({ quoteRequestId: 1, messageId: 2 });
    const region = await open();
    await waitFor(() => expect(loadPeoSendContext).toHaveBeenCalledTimes(3));
    fireEvent.click(within(region).getByRole("button", { name: "Review" }));
    fireEvent.click(await within(region).findByRole("button", { name: "Send to 2 PEOs" }));
    fireEvent.click(await within(region).findByRole("button", { name: "Try again with Justworks" }));
    await waitFor(() => expect(sendToPeo).toHaveBeenCalledTimes(3));
    expect((sendToPeo.mock.calls[2][0] as { peo: string }).peo).toBe("Justworks");
    expect(await within(region).findByText("Justworks: Sent. It is on the Justworks thread.")).toBeInTheDocument();
    expect(within(region).queryByRole("button", { name: "Try again with Justworks" })).not.toBeInTheDocument();
  });

  // Break caught (found by mutation): Try again sent without the mailbox check the first send makes, so a mailbox lost in between is sent from anyway, or the agent isn't offered Connect.
  it("checks the mailbox again on Try again, and offers to connect one that has gone", async () => {
    sendToPeo.mockReset().mockRejectedValueOnce(Object.assign(new Error("The mail provider refused the message."), { code: "PT500" })).mockResolvedValue({ quoteRequestId: 1, messageId: 2 });
    const region = await open();
    fireEvent.click(await within(region).findByRole("checkbox", { name: "Oasis" }));
    await waitFor(() => expect(loadPeoSendContext).toHaveBeenCalledTimes(3));
    fireEvent.click(within(region).getByRole("button", { name: "Review" }));
    fireEvent.click(await within(region).findByRole("button", { name: "Send to 1 PEO" }));
    const again = await within(region).findByRole("button", { name: "Try again with Justworks" });
    fetchMyMailbox.mockResolvedValue({ connected: false });
    fireEvent.click(again);
    expect(await screen.findByRole("dialog")).toHaveTextContent("Connect your email to send this");
    expect(sendToPeo).toHaveBeenCalledTimes(1);
  });

  // Break caught (found by mutation): a send that goes on Try again leaving the page as if nothing was sent, so the quote it made isn't listed until a reload.
  it("tells the page when a send goes on Try again, after none had", async () => {
    props.onSent.mockClear();
    sendToPeo.mockReset()
      .mockRejectedValueOnce(Object.assign(new Error("The mail provider refused the message."), { code: "PT500" }))
      .mockResolvedValue({ quoteRequestId: 1, messageId: 2 });
    const region = await open();
    fireEvent.click(await within(region).findByRole("checkbox", { name: "Oasis" }));
    await waitFor(() => expect(loadPeoSendContext).toHaveBeenCalledTimes(3));
    fireEvent.click(within(region).getByRole("button", { name: "Review" }));
    fireEvent.click(await within(region).findByRole("button", { name: "Send to 1 PEO" }));
    fireEvent.click(await within(region).findByRole("button", { name: "Try again with Justworks" }));
    await within(region).findByText("Justworks: Sent. It is on the Justworks thread.");
    expect(props.onSent).toHaveBeenCalledTimes(1);
  });

  // Break caught (found by mutation): Try again sending to the first chosen PEO whichever line it was pressed on.
  it("tries again with the PEO whose line it is on, not the first one", async () => {
    sendToPeo.mockReset().mockImplementation(async (s: { peo: string }) => {
      if (s.peo === "Oasis" && sendToPeo.mock.calls.length === 2) throw Object.assign(new Error("The mail provider refused the message."), { code: "PT500" });
      return { quoteRequestId: 1, messageId: 2 };
    });
    const region = await open();
    await waitFor(() => expect(loadPeoSendContext).toHaveBeenCalledTimes(3));
    fireEvent.click(within(region).getByRole("button", { name: "Review" }));
    fireEvent.click(await within(region).findByRole("button", { name: "Send to 2 PEOs" }));
    fireEvent.click(await within(region).findByRole("button", { name: "Try again with Oasis" }));
    await waitFor(() => expect(sendToPeo).toHaveBeenCalledTimes(3));
    expect((sendToPeo.mock.calls[2][0] as { peo: string }).peo).toBe("Oasis");
  });
});

// Say the rule before the click (D-1910). Three of the six things a send needs were learned only by pressing Send: the submission not yet Ready for market, the firm not yet approved, and
// (after a banner) the mailbox. The first two are known on the page before the choosing step, so they are said there, in the database's own words, and Send waits for them.
describe("SendToSeveralPeos: what stops a send, said before it is pressed", () => {
  const firm = { id: "f1", name: "Acme Advisory", address: "acme" };
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 16, 12));
    fetchMyMailbox.mockReset().mockResolvedValue({ connected: true, provider: "google", address: "sam@acme.example" });
    loadPeoSendContext.mockReset().mockImplementation(async (_s: string, peo: string) => ({
      mailbox: { connected: true, address: "sam@acme.example" }, contacts: contacts[peo] ?? [], reply_address: null,
    }));
    loadPeoAuthorizations.mockReset().mockResolvedValue(authorized("Justworks", "Oasis", "TriNet"));
    loadRegisteredElsewhere.mockReset().mockResolvedValue([]);
    fetchFirmApprovedToSend.mockReset().mockResolvedValue(true);
    sendToPeo.mockReset().mockImplementation(async (s: { peo: string }) => ({ quoteRequestId: s.peo.length, messageId: 40 + s.peo.length }));
    issueBundleLink.mockReset().mockResolvedValue({ id: 9, token: "t", url: "https://app.example/b/t", expiresAt: "2026-12-16T00:00:00Z", version: 3, notIncluded: [] });
  });
  const noticeIn = (region: HTMLElement) => within(region).queryByText("Not ready to send yet");

  // Break caught: a submission still Submitted or Under review shows a note box and a Send that the database refuses, with the reason learned only after the click.
  it("says a submission that isn't Ready for market must be moved there first, in the choosing step, and does not let it be sent", async () => {
    const region = await openWith({ stage: "under_review" });
    expect(await within(region).findByText("Move this submission to Ready for market first. It is Under review.")).toBeInTheDocument();
    expect(noticeIn(region)).toBeInTheDocument();
    fireEvent.click(await within(region).findByRole("button", { name: "Review" }));
    const send = await within(region).findByRole("button", { name: "Send to 3 PEOs" }).catch(() => within(region).findByRole("button", { name: /^Send to \d PEO/ }));
    expect(send).toBeDisabled();
    expect(within(region).getByText("Move this submission to Ready for market first. It is Under review.")).toBeInTheDocument();
    fireEvent.click(send);
    expect(sendToPeo).not.toHaveBeenCalled();
  });

  // Break caught: the notice drawn for a submission that can be sent, so every send carries a warning that isn't true, or Send disabled for it.
  it.each(["ready_for_market", "sent_to_carrier", "quoted"] as const)("says nothing for a submission at %s", async (stage) => {
    const region = await openWith({ stage });
    await within(region).findByRole("checkbox", { name: "Justworks" });
    expect(noticeIn(region)).not.toBeInTheDocument();
    fireEvent.click(within(region).getByRole("button", { name: "Review" }));
    expect(await within(region).findByRole("button", { name: /^Send to \d PEO/ })).toBeEnabled();
  });

  // Break caught: a firm Nevermore has not approved sees nothing until Send is refused ("Your firm hasn't been approved...").
  it("says a firm that isn't approved yet can't send, in the database's words, and does not let it be sent", async () => {
    fetchFirmApprovedToSend.mockResolvedValue(false);
    const region = await openWith({ stage: "ready_for_market" }, firm);
    expect(await within(region).findByText(/Your firm hasn't been approved to send to PEOs yet\./)).toBeInTheDocument();
    expect(fetchFirmApprovedToSend).toHaveBeenCalledWith("f1");
    fireEvent.click(within(region).getByRole("button", { name: "Review" }));
    expect(await within(region).findByRole("button", { name: /^Send to \d PEO/ })).toBeDisabled();
    expect(sendToPeo).not.toHaveBeenCalled();
  });

  it("says both when both are true, and nothing when the firm is approved", async () => {
    fetchFirmApprovedToSend.mockResolvedValue(false);
    const both = await openWith({ stage: "submitted" }, firm);
    expect(await within(both).findByText(/Your firm hasn't been approved/)).toBeInTheDocument();
    expect(within(both).getByText("Move this submission to Ready for market first. It is Submitted.")).toBeInTheDocument();
  });

  it("says nothing of approval for an approved firm", async () => {
    const region = await openWith({ stage: "ready_for_market" }, firm);
    await waitFor(() => expect(fetchFirmApprovedToSend).toHaveBeenCalled());
    await within(region).findByRole("checkbox", { name: "Justworks" });
    expect(noticeIn(region)).not.toBeInTheDocument();
  });

  // Break caught: an approval that can't be read (a blip, no firm known) blocks every send, or says the firm isn't approved on no evidence: the database still refuses a send it should.
  it("says nothing, and blocks nothing, when it can't tell whether the firm is approved", async () => {
    fetchFirmApprovedToSend.mockResolvedValue(null);
    const region = await openWith({ stage: "ready_for_market" }, firm);
    await waitFor(() => expect(fetchFirmApprovedToSend).toHaveBeenCalled());
    await within(region).findByRole("checkbox", { name: "Justworks" });
    expect(noticeIn(region)).not.toBeInTheDocument();
    fireEvent.click(within(region).getByRole("button", { name: "Review" }));
    expect(await within(region).findByRole("button", { name: /^Send to \d PEO/ })).toBeEnabled();
  });
});

describe("SendToSeveralPeos: on a workers' comp search it is carriers, in every word (ADR 0029)", () => {
  const carrier = (id: number, name: string) => ({ id, name, line: "workers_comp", profile: { version: 1, needed_to_quote: ["company_name"], sources: { answers: sourced } } });
  const carriers = parsePeoCatalog([carrier(8, "Granite Ridge Mutual"), carrier(9, "Summit Casualty")]);
  const people: Record<string, { name: string; role: string | null; email: string }[]> = {
    "Granite Ridge Mutual": [{ name: "Uma Ward", role: null, email: "uw@granite.example" }],
    "Summit Casualty": [{ name: "Ines Roy", role: null, email: "ines@summit.example" }],
  };
  const said = (...names: string[]) => ["Granite Ridge Mutual", "Summit Casualty"].map((peo) => ({ peo, state: names.includes(peo) ? "authorized" : "not_asked", signedAt: null, wordingVersion: null }));
  const openCarriers = async (extra: Record<string, unknown> = {}) => {
    render(<SendToSeveralPeos {...props} catalog={carriers} line="workers_comp" {...extra} />);
    fireEvent.click(screen.getByRole("button", { name: "Send to several carriers" }));
    return screen.findByRole("region", { name: "Send to several carriers" });
  };
  beforeEach(() => {
    fetchMyMailbox.mockReset().mockResolvedValue({ connected: true, provider: "google", address: "sam@acme.example" });
    loadPeoSendContext.mockReset().mockImplementation(async (_s: string, peo: string) => ({ mailbox: { connected: true, address: "sam@acme.example" }, contacts: people[peo] ?? [], reply_address: null }));
    loadPeoAuthorizations.mockReset().mockResolvedValue(said("Granite Ridge Mutual", "Summit Casualty"));
    loadRegisteredElsewhere.mockReset().mockResolvedValue([]);
    fetchFirmApprovedToSend.mockReset().mockResolvedValue(true);
    requestInformation.mockReset().mockResolvedValue(undefined);
    sendToPeo.mockReset().mockImplementation(async (s: { peo: string }) => ({ quoteRequestId: s.peo.length, messageId: 40 + s.peo.length }));
    issueBundleLink.mockReset().mockResolvedValue({ id: 9, token: "t", url: "https://app.example/b/t", expiresAt: "2026-12-16T00:00:00Z", version: 3, notIncluded: [] });
  });

  // Catches: the button that sends counting "PEOs" on a workers' comp search, or one carrier counted as "1 carriers".
  it("counts the carriers it is about to send to, one or several", async () => {
    const region = await openCarriers();
    fireEvent.change(await within(region).findByLabelText("Your note"), { target: { value: "Here it is." } });
    await waitFor(() => expect(loadPeoSendContext).toHaveBeenCalledTimes(2));
    fireEvent.click(within(region).getByRole("button", { name: "Review" }));
    expect(await within(region).findByRole("button", { name: "Send to 2 carriers" })).toBeInTheDocument();
    expect(region).not.toHaveTextContent("PEO");
  });

  // Catches: one carrier counted as "1 carriers" (the two words swapped).
  it("counts one carrier as one", async () => {
    loadPeoAuthorizations.mockResolvedValue(said("Granite Ridge Mutual"));
    const region = await openCarriers();
    fireEvent.change(await within(region).findByLabelText("Your note"), { target: { value: "Here it is." } });
    await waitFor(() => expect(loadPeoSendContext).toHaveBeenCalledTimes(2));
    fireEvent.click(within(region).getByRole("button", { name: "Review" }));
    expect(await within(region).findByRole("button", { name: "Send to 1 carrier" })).toBeInTheDocument();
  });

  // Catches: the review of a carrier another firm already registered this employer with warning of "this PEO".
  it("in the review, says another firm registered this employer with this carrier", async () => {
    loadRegisteredElsewhere.mockResolvedValue([{ peo: "Summit Casualty", registered_at: "2026-11-03T15:00:00Z" }]);
    const region = await openCarriers();
    fireEvent.change(await within(region).findByLabelText("Your note"), { target: { value: "Here it is." } });
    await waitFor(() => expect(loadPeoSendContext).toHaveBeenCalledTimes(2));
    fireEvent.click(within(region).getByRole("button", { name: "Review" }));
    const summit = await within(region).findByRole("article", { name: "Summit Casualty" });
    expect(await within(summit).findByText("Another firm registered this employer with this carrier on Nov 3.")).toBeInTheDocument();
  });

  // Catches: a workers' comp search with no carrier listed told that no PEO can be chosen.
  it("says no carrier can be chosen yet when none has a published profile", async () => {
    render(<SendToSeveralPeos {...props} catalog={[]} line="workers_comp" startOpen />);
    const region = await screen.findByRole("region", { name: "Send to several carriers" });
    expect(within(region).getByText("No carrier can be chosen yet: none has a published profile. Ask Nevermore to publish the carriers you quote with.")).toBeInTheDocument();
  });

  // Catches: the employer of a workers' comp intake said not to have authorized "a PEO", and asked, in a message they read, to tick a PEO.
  it("says the employer hasn't authorized a carrier yet, and asks them to tick a carrier", async () => {
    loadPeoAuthorizations.mockResolvedValue(said());
    const region = await openCarriers();
    expect(await within(region).findByText("Lucia hasn't authorized a carrier yet.")).toBeInTheDocument();
    fireEvent.click(within(region).getByRole("button", { name: "Ask Lucia" }));
    await waitFor(() => expect(requestInformation).toHaveBeenCalledTimes(1));
    const message = requestInformation.mock.calls[0][1] as string;
    expect(message).toMatch(/^We'd like to send your packet to a carrier\./);
    expect(message).toMatch(/Granite Ridge Mutual, Summit Casualty/);
    expect(message).toMatch(/Nothing goes to a carrier until you do\.$/);
    expect(message).not.toMatch(/PEO/);
  });
});
