import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { QuoteRequestAddressRow, QuoteRequestEventRow, QuoteRequestNoteRow, QuoteRequestRow } from "@/lib/advisorApi";
import type { PipelineStatus } from "@/data/advisor";
import { EMPTY_CHAMBER_DATA, type ChamberData } from "@/data/chamberTypes";
import type { PeoRecord } from "@/data/peoCatalog";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const api = {
  recordQuoteSend: vi.fn(),
  updateQuoteRequest: vi.fn(),
  addQuoteRequestNote: vi.fn(),
  correctQuoteRequestNote: vi.fn(),
  reissueQuoteRequestAddress: vi.fn(),
  setStatus: vi.fn(),
};
vi.mock("@/lib/advisorApi", () => api);

const { default: QuoteRequestsPanel } = await import("./QuoteRequestsPanel");

const request = (over: Partial<QuoteRequestRow> = {}): QuoteRequestRow => ({
  id: 7,
  session_id: "s1",
  peo_name: "TriNet",
  status: "sent",
  sent_version: 1,
  sent_on: "2026-11-10",
  quote_received_on: null,
  quote_expires_on: null,
  proposed_start_on: null,
  admin_fee_pepm: null,
  note: null,
  ...over,
});

const note = (over: Partial<QuoteRequestNoteRow> = {}): QuoteRequestNoteRow => ({
  id: 21,
  quote_request_id: 7,
  session_id: "s1",
  kind: "call",
  noted_on: "2026-11-09",
  body: "Dana called about loss runs.",
  created_by: "a1",
  created_by_email: "adv@example.com",
  created_at: "2026-11-09T15:00:00Z",
  ...over,
});

const address = (over: Partial<QuoteRequestAddressRow> = {}): QuoteRequestAddressRow => ({
  id: 31, quote_request_id: 7, session_id: "s1", local_part: "eaa-2026-0042.trinet.0123456789abcdef",
  issued_at: "2026-11-10T15:00:00Z", issued_by: "a1", issued_by_email: "adv@example.com",
  revoked_at: null, revoked_by: null, revoked_by_email: null, ...over,
});

const event = (over: Partial<QuoteRequestEventRow> = {}): QuoteRequestEventRow => ({
  id: 1, quote_request_id: 7, session_id: "s1", note_id: null, field: "status", old_value: null, new_value: "sent",
  changed_by: "a1", changed_by_email: "adv@example.com", changed_at: "2026-11-12T15:00:00Z", ...over,
});

const panel = (
  over: {
    status?: PipelineStatus; requests?: QuoteRequestRow[]; events?: QuoteRequestEventRow[]; notes?: QuoteRequestNoteRow[]; addresses?: QuoteRequestAddressRow[];
    replyDomain?: string | null; currentVersion?: number | null;
    data?: ChamberData; catalog?: PeoRecord[]; onAskProspect?: (question: string) => void;
  } = {},
) => {
  const onChanged = vi.fn();
  render(
    <QuoteRequestsPanel
      sessionId="s1"
      prospectUserId="p1"
      status={over.status ?? "sent_to_carrier"}
      currentVersion={over.currentVersion === undefined ? 1 : over.currentVersion}
      requests={over.requests ?? [request()]}
      events={over.events ?? []}
      notes={over.notes ?? []}
      addresses={over.addresses ?? []}
      replyDomain={over.replyDomain === undefined ? null : over.replyDomain}
      data={over.data ?? EMPTY_CHAMBER_DATA}
      catalog={over.catalog}
      onAskProspect={over.onAskProspect ?? vi.fn()}
      onChanged={onChanged}
    />,
  );
  return onChanged;
};

describe("QuoteRequestsPanel", () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue(undefined);
  });

  it("lists each PEO with where its quote request stands, when it was sent and which version", () => {
    panel({
      requests: [
        request(),
        request({ id: 8, peo_name: "Justworks", status: "quoted", quote_received_on: "2026-11-14", quote_expires_on: "2026-12-14",
          proposed_start_on: "2027-04-01", admin_fee_pepm: 145.5, note: "Includes the PPO." }),
      ],
    });
    const trinet = screen.getByTestId("quote-request-7");
    expect(within(trinet).getByText("TriNet")).toBeInTheDocument();
    expect(within(trinet).getByText("Waiting")).toBeInTheDocument();
    expect(within(trinet).getByText("Sent Nov 10, 2026 · version 1")).toBeInTheDocument();
    const justworks = screen.getByTestId("quote-request-8");
    expect(within(justworks).getByText("Quoted")).toBeInTheDocument();
    expect(within(justworks).getByText("$145.50 per employee per month · received Nov 14, 2026 · expires Dec 14, 2026 · start Apr 1, 2027")).toBeInTheDocument();
    expect(within(justworks).getByText("Includes the PPO.")).toBeInTheDocument();
  });

  it("flags a PEO that has an older version of the submission than the latest certified, while its request is open", () => {
    panel({
      currentVersion: 2,
      requests: [request(), request({ id: 8, peo_name: "Justworks", status: "declined" }), request({ id: 9, peo_name: "Insperity", sent_version: 2 })],
    });
    expect(within(screen.getByTestId("quote-request-7")).getByText("Sent v1, current v2")).toBeInTheDocument();
    expect(within(screen.getByTestId("quote-request-8")).queryByText(/current v/)).not.toBeInTheDocument();
    expect(within(screen.getByTestId("quote-request-9")).queryByText(/current v/)).not.toBeInTheDocument();
  });

  it("records a send to a PEO from the catalog, or one typed in, on the date given", async () => {
    const onChanged = panel({ status: "ready_for_market", requests: [] });
    fireEvent.change(screen.getByLabelText("PEO"), { target: { value: "Insperity" } });
    fireEvent.change(screen.getByLabelText("Sent on"), { target: { value: "2026-11-09" } });
    fireEvent.click(screen.getByRole("button", { name: "Record send" }));
    await waitFor(() => expect(api.recordQuoteSend).toHaveBeenCalledWith("s1", "Insperity", "2026-11-09"));
    expect(onChanged).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("PEO"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Another PEO"), { target: { value: "  Regional HR Co  " } });
    fireEvent.click(screen.getByRole("button", { name: "Record send" }));
    await waitFor(() => expect(api.recordQuoteSend).toHaveBeenLastCalledWith("s1", "Regional HR Co", "2026-11-09"));
  });

  it("offers sending only from Ready for market on, and says so before then", () => {
    panel({ status: "under_review", requests: [] });
    expect(screen.getByText("Move to Ready for market first.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record send" })).not.toBeInTheDocument();
  });

  it("after a send at Ready for market, offers the one step to Sent to PEOs, and declining changes nothing", async () => {
    const onChanged = panel({ status: "ready_for_market", requests: [] });
    fireEvent.change(screen.getByLabelText("PEO"), { target: { value: "TriNet" } });
    fireEvent.click(screen.getByRole("button", { name: "Record send" }));
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("button", { name: "Move to Sent to PEOs" })).not.toBeInTheDocument();
    expect(api.setStatus).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Record send" }));
    fireEvent.click(await screen.findByRole("button", { name: "Move to Sent to PEOs" }));
    await waitFor(() => expect(api.setStatus).toHaveBeenCalledWith("s1", "sent_to_carrier", ""));
    expect(onChanged).toHaveBeenCalledTimes(3);
  });

  it("offers no move after a send once the submission is already past Ready for market", async () => {
    panel({ status: "sent_to_carrier", requests: [] });
    fireEvent.change(screen.getByLabelText("PEO"), { target: { value: "TriNet" } });
    fireEvent.click(screen.getByRole("button", { name: "Record send" }));
    await waitFor(() => expect(api.recordQuoteSend).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /^Move to/ })).not.toBeInTheDocument();
  });

  it("records a PEO's quote, then offers the step to Quoted", async () => {
    const onChanged = panel({ status: "sent_to_carrier" });
    const row = screen.getByTestId("quote-request-7");
    fireEvent.click(within(row).getByRole("button", { name: "Record answer" }));
    fireEvent.change(within(row).getByLabelText("Answer"), { target: { value: "quoted" } });
    fireEvent.change(within(row).getByLabelText("Admin fee per employee per month ($)"), { target: { value: "145.50" } });
    fireEvent.change(within(row).getByLabelText("Received on"), { target: { value: "2026-11-14" } });
    fireEvent.change(within(row).getByLabelText("Expires on"), { target: { value: "2026-12-14" } });
    fireEvent.change(within(row).getByLabelText("Proposed start"), { target: { value: "2027-04-01" } });
    fireEvent.change(within(row).getByLabelText("Note"), { target: { value: "Includes the PPO." } });
    fireEvent.click(within(row).getByRole("button", { name: "Save answer" }));
    await waitFor(() =>
      expect(api.updateQuoteRequest).toHaveBeenCalledWith(7, {
        status: "quoted", receivedOn: "2026-11-14", expiresOn: "2026-12-14", startOn: "2027-04-01", adminFeePepm: 145.5, note: "Includes the PPO.",
      }),
    );
    expect(onChanged).toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Move to Quoted" }));
    await waitFor(() => expect(api.setStatus).toHaveBeenCalledWith("s1", "quoted", ""));
  });

  it("records a decline with only a note: a decline has no dates or fee", async () => {
    panel({ status: "sent_to_carrier" });
    const row = screen.getByTestId("quote-request-7");
    fireEvent.click(within(row).getByRole("button", { name: "Record answer" }));
    fireEvent.change(within(row).getByLabelText("Answer"), { target: { value: "declined" } });
    expect(within(row).queryByLabelText("Expires on")).not.toBeInTheDocument();
    fireEvent.change(within(row).getByLabelText("Note"), { target: { value: "Outside their appetite." } });
    fireEvent.click(within(row).getByRole("button", { name: "Save answer" }));
    await waitFor(() =>
      expect(api.updateQuoteRequest).toHaveBeenCalledWith(7, {
        status: "declined", receivedOn: null, expiresOn: null, startOn: null, adminFeePepm: null, note: "Outside their appetite.",
      }),
    );
    expect(screen.queryByRole("button", { name: /^Move to/ })).not.toBeInTheDocument();
  });

  it("adds a note of a call, with the day it happened", async () => {
    const onChanged = panel();
    const row = screen.getByTestId("quote-request-7");
    fireEvent.click(within(row).getByRole("button", { name: "Add a note" }));
    expect(within(row).getByLabelText("Kind")).toHaveValue("call");
    fireEvent.change(within(row).getByLabelText("Date it happened"), { target: { value: "2026-11-09" } });
    fireEvent.change(within(row).getByLabelText("Note"), { target: { value: "Dana called about loss runs." } });
    fireEvent.click(within(row).getByRole("button", { name: "Save note" }));
    await waitFor(() =>
      expect(api.addQuoteRequestNote).toHaveBeenCalledWith(7, { kind: "call", notedOn: "2026-11-09", body: "Dana called about loss runs." }),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it("offers every kind of note, and says a note of an email is not a send", () => {
    panel();
    const row = screen.getByTestId("quote-request-7");
    fireEvent.click(within(row).getByRole("button", { name: "Add a note" }));
    const kind = within(row).getByLabelText("Kind");
    expect(within(kind).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Call", "Portal entry", "Email sent elsewhere", "Underwriter's question", "Other",
    ]);
    fireEvent.change(kind, { target: { value: "email_elsewhere" } });
    expect(within(row).getByText(/A note doesn't record a send/)).toBeInTheDocument();
    // Nothing to save until the note says something.
    expect(within(row).getByRole("button", { name: "Save note" })).toBeDisabled();
  });

  it("lists a quote request's notes with their kind, day and author, and marks a corrected one", () => {
    panel({
      notes: [
        note({ id: 22, kind: "portal_entry", noted_on: "2026-11-10", body: "Entered in their portal." }),
        note(),
        note({ id: 23, quote_request_id: 8, body: "On another request." }),
      ],
      events: [event({ id: 9, note_id: 21, field: "note_body", old_value: "Dana called.", new_value: "Dana called about loss runs." })],
    });
    const notes = within(screen.getByTestId("quote-request-7")).getByRole("list", { name: "TriNet notes" });
    const items = within(notes).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Portal entry · Nov 10, 2026 · adv@example.com");
    expect(items[0]).not.toHaveTextContent("corrected");
    expect(items[0]).toHaveTextContent("Entered in their portal.");
    expect(items[1]).toHaveTextContent("Call · Nov 9, 2026 · adv@example.com · corrected");
  });

  it("corrects a note from what it holds now", async () => {
    const onChanged = panel({ notes: [note()] });
    const item = screen.getByTestId("quote-note-21");
    fireEvent.click(within(item).getByRole("button", { name: "Correct" }));
    expect(within(item).getByLabelText("Kind")).toHaveValue("call");
    expect(within(item).getByLabelText("Date it happened")).toHaveValue("2026-11-09");
    expect(within(item).getByLabelText("Note")).toHaveValue("Dana called about loss runs.");
    fireEvent.change(within(item).getByLabelText("Date it happened"), { target: { value: "2026-11-08" } });
    fireEvent.click(within(item).getByRole("button", { name: "Save correction" }));
    await waitFor(() =>
      expect(api.correctQuoteRequestNote).toHaveBeenCalledWith(21, { kind: "call", notedOn: "2026-11-08", body: "Dana called about loss runs." }),
    );
    expect(api.addQuoteRequestNote).not.toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalled();
  });

  it("shows each quote request's change log: who changed what, corrections to notes included", () => {
    panel({
      events: [
        event({ id: 5, note_id: 21, field: "note_kind", old_value: "call", new_value: "portal_entry" }),
        // A question recorded before questions became notes: its note is shown, not this.
        event({ id: 3, field: "underwriter_question", new_value: "Can they send loss runs?" }),
        event({ id: 2, field: "admin_fee_pepm", old_value: "145.50", new_value: "150.00" }),
        event({ id: 1 }),
        event({ id: 4, quote_request_id: 8, field: "status", old_value: "sent", new_value: "declined" }),
      ],
    });
    const history = within(screen.getByTestId("quote-request-7")).getByRole("list", { name: "TriNet history" });
    expect(within(history).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Note kind: Call → Portal entry"),
      expect.stringContaining("Admin fee per employee per month: 145.50 → 150.00"),
      expect.stringContaining("Status: — → Waiting"),
    ]);
    expect(within(history).getAllByText(/adv@example\.com/)).toHaveLength(3);
  });

  it("drops the fee and dates typed for a quote when the answer is changed to a decline", async () => {
    panel({ status: "sent_to_carrier" });
    const row = screen.getByTestId("quote-request-7");
    fireEvent.click(within(row).getByRole("button", { name: "Record answer" }));
    fireEvent.change(within(row).getByLabelText("Admin fee per employee per month ($)"), { target: { value: "99" } });
    fireEvent.change(within(row).getByLabelText("Expires on"), { target: { value: "2026-12-01" } });
    fireEvent.change(within(row).getByLabelText("Answer"), { target: { value: "declined" } });
    fireEvent.click(within(row).getByRole("button", { name: "Save answer" }));
    await waitFor(() => expect(api.updateQuoteRequest).toHaveBeenCalledWith(7, expect.objectContaining({ adminFeePepm: null, expiresOn: null })));
  });

  it("offers no answer on a closed quote request: only a new send reopens it", () => {
    panel({ requests: [request({ status: "closed" })] });
    const row = screen.getByTestId("quote-request-7");
    expect(within(row).queryByRole("button", { name: "Record answer" })).not.toBeInTheDocument();
    // A PEO that phones after its request closed can still be recorded.
    expect(within(row).getByRole("button", { name: "Add a note" })).toBeInTheDocument();
  });

  it("warns, on its row, about a PEO whose sourced facts don't fit the submission", () => {
    panel({
      data: { ...EMPTY_CHAMBER_DATA, employee_count: 8 },
      catalog: [{ name: "TriNet", minHeadcount: 10, statesServed: null, excludedClassCodes: null, lastVerified: "2026-11-01",
        sources: { minHeadcount: "https://trinet.example/minimums" } }],
      requests: [request(), request({ id: 8, peo_name: "Regional HR Co" })],
    });
    const alert = within(screen.getByTestId("quote-request-7")).getByRole("alert");
    expect(alert).toHaveTextContent("TriNet lists a 10-employee minimum; you have 8");
    // Only what doesn't fit: the checks that pass or can't be told aren't warnings.
    expect(alert).not.toHaveTextContent(/States of operation|Class codes/);
    expect(within(screen.getByTestId("quote-request-8")).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows each quote request's reply address to copy, on the receiving subdomain", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    panel({
      replyDomain: "quotes.example.com",
      requests: [request(), request({ id: 8, peo_name: "Justworks" })],
      addresses: [address(), address({ id: 32, quote_request_id: 8, local_part: "eaa-2026-0042.justworks.fedcba9876543210" })],
    });
    const row = screen.getByTestId("quote-request-7");
    expect(within(row).getByLabelText("Reply address")).toHaveValue("eaa-2026-0042.trinet.0123456789abcdef@quotes.example.com");
    expect(within(row).getByText(/Put this address in CC when you email TriNet/)).toBeInTheDocument();
    expect(within(screen.getByTestId("quote-request-8")).getByLabelText("Reply address")).toHaveValue(
      "eaa-2026-0042.justworks.fedcba9876543210@quotes.example.com",
    );
    fireEvent.click(within(row).getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("eaa-2026-0042.trinet.0123456789abcdef@quotes.example.com"));
  });

  it("shows no reply address while no receiving subdomain is set, or for a quote request without one", () => {
    panel({ replyDomain: null, addresses: [address()] });
    expect(screen.queryByLabelText("Reply address")).not.toBeInTheDocument();
  });

  it("keeps showing the address of a closed quote request: a PEO that answers late still reaches it", () => {
    panel({ replyDomain: "quotes.example.com", requests: [request({ status: "closed" })], addresses: [address()] });
    expect(screen.getByLabelText("Reply address")).toBeInTheDocument();
  });

  it("revokes and reissues an address only after the advisor confirms", async () => {
    const onChanged = panel({ replyDomain: "quotes.example.com", addresses: [address()] });
    const row = screen.getByTestId("quote-request-7");
    fireEvent.click(within(row).getByRole("button", { name: "Revoke and issue a new address" }));
    expect(within(row).getByRole("alert")).toHaveTextContent("Mail sent to this one will no longer reach this quote request");
    expect(api.reissueQuoteRequestAddress).not.toHaveBeenCalled();
    fireEvent.click(within(row).getByRole("button", { name: "Keep this one" }));
    expect(within(row).queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: "Revoke and issue a new address" }));
    fireEvent.click(within(row).getByRole("button", { name: "Issue a new address" }));
    await waitFor(() => expect(api.reissueQuoteRequestAddress).toHaveBeenCalledWith(7));
    expect(onChanged).toHaveBeenCalled();
  });

  it("turns an underwriter's question into an ask of the prospect, and offers that only on questions", () => {
    const onAskProspect = vi.fn();
    panel({
      onAskProspect,
      notes: [note({ id: 22, kind: "underwriter_question", body: "Can they send loss runs?" }), note()],
    });
    const notes = within(screen.getByTestId("quote-request-7")).getByRole("list", { name: "TriNet notes" });
    const asks = within(notes).getAllByRole("button", { name: "Ask the prospect" });
    expect(asks).toHaveLength(1);
    fireEvent.click(asks[0]);
    expect(onAskProspect).toHaveBeenCalledWith("Can they send loss runs?");
  });
});
