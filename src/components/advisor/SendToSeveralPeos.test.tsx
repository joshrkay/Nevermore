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
vi.mock("@/lib/advisorApi", () => ({ fetchMyMailbox: () => fetchMyMailbox() }));
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
const issueBundleLink = vi.fn();
vi.mock("@/lib/bundleLink", () => ({ issueBundleLink: (...a: unknown[]) => issueBundleLink(...a), supabaseBundleLinkDeps: async () => ({}) }));

const { default: SendToSeveralPeos } = await import("./SendToSeveralPeos");

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
    sendToPeo.mockReset().mockImplementation(async (s: { peo: string }) => ({ quoteRequestId: s.peo.length, messageId: 40 + s.peo.length }));
    issueBundleLink.mockReset().mockResolvedValue({ id: 9, token: "t", url: "https://app.example/b/t", expiresAt: "2026-12-16T00:00:00Z", version: 3, notIncluded: [] });
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
    within(await within(region).findByRole("list", { name: "What was sent" })).getAllByRole("listitem").map((li) => li.textContent);

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
});
