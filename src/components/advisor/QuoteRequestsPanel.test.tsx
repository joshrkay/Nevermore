import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { QuoteRequestAddressRow, QuoteRequestEventRow, QuoteRequestNoteRow, QuoteRequestRow } from "@/lib/advisorApi";
import type { PipelineStatus } from "@/data/advisor";
import { EMPTY_CHAMBER_DATA, type ChamberData } from "@/data/chamberTypes";
import type { PeoRecord } from "@/data/peoCatalog";
import { parsePeoCatalog } from "@/data/peoProfiles";

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

/** A PEO whose profile in use holds a sourced minimum headcount, checked on `checked`. */
const withMinimum = (name: string, min: number, checked: string, listed = true): PeoRecord =>
  parsePeoCatalog([{ id: name.length, name, listed, profile: { version: 1, min_headcount: min, sources: { min_headcount: { kind: "document", name: "Broker guide", checked_on: checked } } } }])[0];

// The PEOs as the database lists them (usePeoCatalog), none with a published profile.
const CATALOG: PeoRecord[] = ["Insperity", "Justworks", "TriNet"].map((name) => ({ name, listed: true, lastVerified: null }));
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
      catalog={over.catalog ?? CATALOG}
      onAskProspect={over.onAskProspect ?? vi.fn()}
      onChanged={onChanged}
    />,
  );
  return onChanged;
};

describe("QuoteRequestsPanel", () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue(undefined);
    // Whether a profile is out of date goes by the reader's today: pinned, so every test reads the same day.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 11, 12));
  });
  afterEach(() => vi.useRealTimers());

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

  it("offers the PEOs the database lists, alphabetically as given, and only those", () => {
    panel({ status: "ready_for_market", requests: [], catalog: [{ name: "Acme PEO", listed: true, lastVerified: null }] });
    const options = within(screen.getByLabelText("PEO")).getAllByRole("option").map((o) => o.textContent);
    expect(options.slice(1)).toEqual(["Acme PEO"]);
  });

  it("doesn't offer a PEO that isn't listed, yet still checks a quote request already sent to it", () => {
    panel({
      status: "sent_to_carrier",
      data: { ...EMPTY_CHAMBER_DATA, employee_count: 8 },
      catalog: [
        { name: "Insperity", listed: true, lastVerified: null },
        withMinimum("TriNet", 10, "2026-11-01", false),
      ],
    });
    expect(within(screen.getByLabelText("PEO")).getAllByRole("option").map((o) => o.textContent).slice(1)).toEqual(["Insperity"]);
    expect(within(screen.getByRole("list", { name: "Eligibility checks for TriNet" })).getAllByRole("listitem")[0]).toHaveTextContent("Doesn't meet · Minimum headcount: TriNet takes groups of 10 or more employees; this employer has 8.");
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

  it("shows, on its row, each eligibility check against the PEO's profile, dated, and that one not met never stops a send", () => {
    panel({
      data: { ...EMPTY_CHAMBER_DATA, employee_count: 8 },
      catalog: [withMinimum("TriNet", 10, "2026-11-01")],
      requests: [request(), request({ id: 8, peo_name: "Regional HR Co" })],
    });
    const row = screen.getByTestId("quote-request-7");
    const checks = within(within(row).getByRole("list", { name: "Eligibility checks for TriNet" })).getAllByRole("listitem");
    expect(checks.map((c) => c.textContent?.split(":")[0])).toEqual([
      "Doesn't meet · Minimum headcount", "Can't tell yet · States served", "Can't tell yet · Excluded industries", "Can't tell yet · Excluded class codes", "Can't tell yet · Minimum participation",
    ]);
    expect(checks[0]).toHaveTextContent("TriNet takes groups of 10 or more employees; this employer has 8.checked 1 Nov 2026");
    expect(row).toHaveTextContent("A check that isn't met is a warning. It never stops you sending.");
    // A PEO that isn't listed has no profile to check against.
    expect(within(screen.getByTestId("quote-request-8")).queryByRole("list", { name: /Eligibility checks/ })).not.toBeInTheDocument();
  });

  it("shows the chosen PEO's checks before the send is recorded", () => {
    panel({ status: "ready_for_market", requests: [], data: { ...EMPTY_CHAMBER_DATA, employee_count: 8 }, catalog: [withMinimum("TriNet", 10, "2026-11-01")] });
    expect(screen.queryByRole("list", { name: "Eligibility checks for TriNet" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("PEO"), { target: { value: "TriNet" } });
    expect(within(screen.getByRole("list", { name: "Eligibility checks for TriNet" })).getAllByRole("listitem")[0]).toHaveTextContent("Doesn't meet · Minimum headcount");
    expect(screen.getByRole("button", { name: /Record send/ })).toBeEnabled();
  });

  it("warns, on its row, that a PEO's profile is out of date, with when it was last checked", () => {
    panel({
      catalog: [
        withMinimum("TriNet", 10, "2026-03-02"),
        withMinimum("Justworks", 10, "2026-11-01"),
      ],
      requests: [request(), request({ id: 8, peo_name: "Justworks" })],
    });
    expect(within(screen.getByTestId("quote-request-7")).getByText("TriNet's profile was last checked 2 Mar 2026 and may be out of date.")).toBeInTheDocument();
    expect(within(screen.getByTestId("quote-request-8")).queryByText(/may be out of date/)).not.toBeInTheDocument();
  });

  it("warns, when recording a send, that the chosen PEO's profile is out of date, and still records it", async () => {
    api.recordQuoteSend.mockResolvedValue(undefined);
    panel({
      status: "ready_for_market",
      requests: [],
      catalog: [
        withMinimum("Justworks", 10, "2026-11-01"),
        withMinimum("TriNet", 10, "2026-03-02"),
      ],
    });
    const warning = "TriNet's profile was last checked 2 Mar 2026 and may be out of date.";
    fireEvent.change(screen.getByLabelText("PEO"), { target: { value: "Justworks" } });
    expect(screen.queryByText(/may be out of date/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("PEO"), { target: { value: "TriNet" } });
    expect(screen.getByText(warning)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Record send/ }));
    await waitFor(() => expect(api.recordQuoteSend).toHaveBeenCalledWith("s1", "TriNet", "2026-11-11"));
  });

  it("marks a quote request with PEO mail nobody has opened, and clears the mark once its thread was opened", () => {
    const mail = (over: Record<string, unknown> = {}) => ({
      id: 1, provider_message_id: "re_1", quote_request_id: 7, session_id: "s1", address_local_part: "a.b.c", held_reason: null, direction: "received",
      is_automatic: false, new_sender: false, from_address: "dana@trinet.example", from_name: null, to_addresses: [], cc_addresses: [], subject: null,
      body_text: "Hi", body_truncated: false, headers: {}, held_at: null, moved_by: null, moved_by_email: null, moved_from_quote_request_id: null, moved_note: null,  sent_at: null, recorded_at: "2026-11-10T15:00:05+00:00", ...over,
    });
    const { unmount } = render(
      <QuoteRequestsPanel sessionId="s1" prospectUserId="p1" status="sent_to_carrier" currentVersion={1} requests={[request()]} events={[]} notes={[]}
        addresses={[]} mail={[mail()]} threadReads={[]} data={EMPTY_CHAMBER_DATA} catalog={[]} onAskProspect={vi.fn()} onChanged={vi.fn()} />,
    );
    expect(within(screen.getByTestId("quote-request-7")).getByText("New PEO mail")).toBeInTheDocument();
    unmount();
    render(
      <QuoteRequestsPanel sessionId="s1" prospectUserId="p1" status="sent_to_carrier" currentVersion={1} requests={[request()]} events={[]} notes={[]}
        addresses={[]} mail={[mail()]} threadReads={[{ quote_request_id: 7, last_opened_at: "2026-11-10T15:00:05+00:00", last_opened_by: null, last_opened_by_email: null }]}
        data={EMPTY_CHAMBER_DATA} catalog={[]} onAskProspect={vi.fn()} onChanged={vi.fn()} />,
    );
    expect(within(screen.getByTestId("quote-request-7")).queryByText("New PEO mail")).not.toBeInTheDocument();
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

  // K-1.3: the employer says which PEO it is in now, so an advisor isn't left to submit it to its own PEO unawares.
  describe("a send to the employer's current PEO", () => {
    const inPeo = { ...EMPTY_CHAMBER_DATA, in_peo: true, current_peo: "Summit Employer Services" };
    const warning = () => screen.queryByRole("alert");
    const typeOther = (name: string) => fireEvent.change(screen.getByLabelText("Another PEO"), { target: { value: name } });

    it("warns when the PEO typed is the one the employer is with now, whatever the capitals or spacing", () => {
      panel({ status: "ready_for_market", requests: [], data: inPeo });
      expect(warning()).not.toBeInTheDocument();
      typeOther("  summit employer services ");
      expect(warning()).toHaveTextContent("This employer says it is with Summit Employer Services now.");
    });

    it("still lets the advisor record the send: a warning, never a block", async () => {
      panel({ status: "ready_for_market", requests: [], data: inPeo });
      typeOther("Summit Employer Services");
      fireEvent.click(screen.getByRole("button", { name: /Record send/ }));
      await waitFor(() => expect(api.recordQuoteSend).toHaveBeenCalledWith("s1", "Summit Employer Services", expect.any(String)));
    });

    it("says nothing for another PEO, or when the employer is in no PEO or hasn't said", () => {
      panel({ status: "ready_for_market", requests: [], data: inPeo });
      typeOther("Harbor PEO");
      expect(warning()).not.toBeInTheDocument();
    });

    it("says nothing when the employer has left the PEO it named", () => {
      panel({ status: "ready_for_market", requests: [], data: { ...inPeo, in_peo: false } });
      typeOther("Summit Employer Services");
      expect(warning()).not.toBeInTheDocument();
    });
  });
});
