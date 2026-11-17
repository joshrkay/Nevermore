import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type {
  InformationRequestRow, QuoteRequestEventRow, QuoteRequestMailAttachmentRow, QuoteRequestMessageRow, QuoteRequestNoteRow, QuoteRequestRow, QuoteRequestThreadReadRow,
} from "@/lib/advisorApi";

const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("sonner", () => ({ toast }));
const api = { openQuoteRequestThread: vi.fn(), mailAttachmentUrl: vi.fn(), moveMessageOffThread: vi.fn(), recordActivity: vi.fn(), decideReplySuggestion: vi.fn() };
vi.mock("@/lib/advisorApi", () => api);

const { default: PeoThreadPanel } = await import("./PeoThreadPanel");
const { WorkspaceContext } = await import("@/components/workspace/workspaceContext");

const request = (over: Partial<QuoteRequestRow> = {}): QuoteRequestRow => ({
  id: 7, session_id: "s1", peo_name: "TriNet", status: "sent", sent_version: 3, sent_on: "2026-11-07", quote_received_on: null,
  quote_expires_on: null, proposed_start_on: null, admin_fee_pepm: null, note: null, ...over,
});
const message = (over: Partial<QuoteRequestMessageRow> = {}): QuoteRequestMessageRow => ({
  id: 1, provider_message_id: "re_1", quote_request_id: 7, session_id: "s1", address_local_part: "a.b.c", held_reason: null, held_at: null, moved_by: null, moved_by_email: null, moved_from_quote_request_id: null, moved_note: null, direction: "received",
  is_automatic: false, new_sender: false, from_address: "dana@trinet.example", from_name: "Dana Whitfield", to_addresses: [], cc_addresses: [],
  subject: "Re: Harbor Street", body_text: "Proposal attached.", body_truncated: false, headers: {}, sent_at: "2026-11-10T15:00:00Z",
  recorded_at: "2026-11-10T15:00:05.123456+00:00", ...over,
});
const attachment = (over: Partial<QuoteRequestMailAttachmentRow> = {}): QuoteRequestMailAttachmentRow => ({
  id: 1, message_id: 1, provider_attachment_id: "att_1", file_name: "proposal.pdf", content_type: "application/pdf", size_bytes: 412_000, status: "stored",
  not_kept_reason: null, scan_verdict: "clean", scan_signature: null, storage_bucket: "peo-mail", storage_path: "s1/1/1-proposal.pdf", sha256: "x",
  recorded_at: "2026-11-10T15:00:06Z", updated_at: "2026-11-10T15:00:06Z", ...over,
});
const note = (over: Partial<QuoteRequestNoteRow> = {}): QuoteRequestNoteRow => ({
  id: 1, quote_request_id: 7, session_id: "s1", kind: "call", noted_on: "2026-11-09", body: "Dana called about loss runs.", created_by: "a1",
  created_by_email: "adv@example.com", created_at: "2026-11-09T09:00:00Z", ...over,
});
const event = (over: Partial<QuoteRequestEventRow> = {}): QuoteRequestEventRow => ({
  id: 1, quote_request_id: 7, session_id: "s1", note_id: null, field: "status", old_value: "sent", new_value: "quoted", changed_by: "a1",
  changed_by_email: "adv@example.com", changed_at: "2026-11-10T17:00:00Z", ...over,
});
const read = (at: string, id = 7): QuoteRequestThreadReadRow => ({ quote_request_id: id, last_opened_at: at, last_opened_by: "a1", last_opened_by_email: "adv@example.com" });

interface Props {
  requests?: QuoteRequestRow[]; messages?: QuoteRequestMessageRow[]; attachments?: QuoteRequestMailAttachmentRow[]; notes?: QuoteRequestNoteRow[];
  events?: QuoteRequestEventRow[]; reads?: QuoteRequestThreadReadRow[]; informationRequests?: InformationRequestRow[]; pipelineStatus?: string;
}

const panel = (p: Props = {}) => {
  const onOpened = vi.fn();
  render(
    <PeoThreadPanel
      prospectUserId="p1" requests={p.requests ?? [request()]} messages={p.messages ?? []} attachments={p.attachments ?? []} notes={p.notes ?? []}
      events={p.events ?? []} reads={p.reads ?? []} onOpened={onOpened} informationRequests={p.informationRequests} pipelineStatus={p.pipelineStatus}
    />,
  );
  return onOpened;
};

describe("PeoThreadPanel", () => {
  beforeEach(() => {
    for (const fn of [...Object.values(api), toast.success, toast.error]) fn.mockReset();
    api.openQuoteRequestThread.mockResolvedValue(undefined);
  });

  it("shows nothing for a submission with no quote requests", () => {
    const { container } = render(<PeoThreadPanel prospectUserId="p1" requests={[]} messages={[]} attachments={[]} notes={[]} events={[]} reads={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists each PEO with its message count, and shows no thread until one is chosen", () => {
    panel({ requests: [request(), request({ id: 8, peo_name: "Justworks" })], messages: [message(), message({ id: 2, quote_request_id: 8 })] });
    const group = screen.getByRole("group", { name: "Choose a thread" });
    expect(within(group).getByRole("button", { name: /TriNet/ })).toHaveTextContent("1 message");
    expect(within(group).getByRole("button", { name: "All PEOs" })).toBeInTheDocument();
    expect(screen.getByText("Choose a PEO to read its thread.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /thread/ })).not.toBeInTheDocument();
  });

  it("has no All PEOs button for a single quote request", () => {
    panel();
    expect(screen.queryByRole("button", { name: "All PEOs" })).not.toBeInTheDocument();
  });

  it("marks only the PEOs a person wrote to, not automatic replies, copied-in messages or opened threads", () => {
    panel({
      requests: [request(), request({ id: 8, peo_name: "Justworks" }), request({ id: 9, peo_name: "Insperity" }), request({ id: 10, peo_name: "Paychex" })],
      messages: [
        message({ id: 1, quote_request_id: 7 }),
        message({ id: 2, quote_request_id: 8, is_automatic: true }),
        message({ id: 3, quote_request_id: 9, direction: "sent_by_hand" }),
        message({ id: 4, quote_request_id: 10 }),
      ],
      reads: [read("2026-11-11T00:00:00+00:00", 10)],
    });
    const mark = (name: string) => within(screen.getByRole("button", { name: new RegExp(name) })).queryByText("New PEO mail");
    expect(mark("TriNet")).toBeInTheDocument();
    expect(mark("Justworks")).not.toBeInTheDocument();
    expect(mark("Insperity")).not.toBeInTheDocument();
    expect(mark("Paychex")).not.toBeInTheDocument();
  });

  it("opens a thread: shows it newest first, marks it read through the latest message as loaded, and clears the mark", async () => {
    const onOpened = panel({
      messages: [message({ id: 1, recorded_at: "2026-11-10T15:00:05.123456+00:00" }), message({ id: 2, recorded_at: "2026-11-10T16:30:00.654321+00:00", sent_at: "2026-11-10T16:30:00Z", body_text: "Second message" })],
      notes: [note()],
      events: [
        event({ id: 1, field: "status", old_value: null, new_value: "sent", changed_at: "2026-11-07T16:10:00Z" }),
        event({ id: 2, field: "sent_version", old_value: null, new_value: "3", changed_at: "2026-11-07T16:10:00Z" }),
        event({ id: 3, field: "sent_on", old_value: null, new_value: "2026-11-07", changed_at: "2026-11-07T16:10:00Z" }),
        event({ id: 4, field: "status", old_value: "sent", new_value: "quoted", changed_at: "2026-11-10T17:00:00Z" }),
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: /TriNet/ }));
    const thread = screen.getByRole("list", { name: "TriNet thread, newest first" });
    const items = within(thread).getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(items).toHaveLength(5);
    expect(items[0]).toContain("Sent → Quoted");
    expect(items[1]).toContain("Second message");
    expect(items[2]).toContain("Proposal attached.");
    expect(items[3]).toContain("Dana called about loss runs.");
    expect(items[4]).toContain("Version 3 sent Nov 7, 2026");
    // Through the latest message exactly as the database gave it: nothing that arrives later is marked read.
    await waitFor(() => expect(api.openQuoteRequestThread).toHaveBeenCalledWith(7, "2026-11-10T16:30:00.654321+00:00"));
    await waitFor(() => expect(within(screen.getByRole("button", { name: /TriNet/ })).queryByText("New PEO mail")).not.toBeInTheDocument());
    expect(onOpened).toHaveBeenCalledTimes(1);
  });

  // Catches: a quote's own page (CRM-Q3.2) showing a chooser and "Choose a PEO" for the one thread it is about, or leaving its new-mail mark on after it is read.
  it("for one named quote request (a quote's page) opens that thread at once, with no chooser, and marks it read", async () => {
    const onOpened = vi.fn();
    render(
      <PeoThreadPanel
        prospectUserId="p1" requests={[request(), request({ id: 8, peo_name: "Justworks" })]} ofRequest={7}
        messages={[message({ id: 1 }), message({ id: 2, quote_request_id: 8, body_text: "Justworks only" })]} attachments={[]} notes={[]} events={[]} reads={[]} onOpened={onOpened}
      />,
    );
    expect(screen.queryByRole("group", { name: "Choose a thread" })).not.toBeInTheDocument();
    expect(screen.queryByText("Choose a PEO to read its thread.")).not.toBeInTheDocument();
    const thread = screen.getByRole("list", { name: "TriNet thread, newest first" });
    expect(thread).toHaveTextContent("Proposal attached.");
    expect(thread).not.toHaveTextContent("Justworks only");
    await waitFor(() => expect(api.openQuoteRequestThread).toHaveBeenCalledWith(7, "2026-11-10T15:00:05.123456+00:00"));
    expect(api.openQuoteRequestThread).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onOpened).toHaveBeenCalledTimes(1));
  });

  // Catches: a quote's page with no mail yet showing "Choose a PEO to read its thread" instead of its own (empty) thread.
  it("for one named quote request with no mail yet, shows its empty thread rather than asking to choose", () => {
    render(<PeoThreadPanel prospectUserId="p1" requests={[request()]} ofRequest={7} messages={[]} attachments={[]} notes={[]} events={[]} reads={[]} />);
    expect(screen.queryByText("Choose a PEO to read its thread.")).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument();
  });

  it("doesn't mark a thread read that has no new mail", () => {
    panel({ messages: [message()], reads: [read("2026-11-11T00:00:00+00:00")] });
    fireEvent.click(screen.getByRole("button", { name: /TriNet/ }));
    expect(api.openQuoteRequestThread).not.toHaveBeenCalled();
  });

  it("still shows the thread, and keeps its mark, when marking it read fails", async () => {
    api.openQuoteRequestThread.mockRejectedValue(new Error("Couldn't mark the thread as read."));
    const onOpened = panel({ messages: [message()] });
    fireEvent.click(screen.getByRole("button", { name: /TriNet/ }));
    expect(screen.getByRole("list", { name: "TriNet thread, newest first" })).toBeInTheDocument();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't mark the thread as read."));
    expect(within(screen.getByRole("button", { name: /TriNet/ })).getByText("New PEO mail")).toBeInTheDocument();
    expect(onOpened).not.toHaveBeenCalled();
  });

  it("shows every PEO's entries together, each named, and opens each thread with new mail", async () => {
    panel({
      requests: [request(), request({ id: 8, peo_name: "Justworks" })],
      messages: [message({ id: 1 }), message({ id: 2, quote_request_id: 8, from_address: "tomas@justworks.example", from_name: "Tomas", sent_at: "2026-11-11T08:00:00Z", recorded_at: "2026-11-11T08:00:01.5+00:00", body_text: "Updated proposal" })],
    });
    fireEvent.click(screen.getByRole("button", { name: "All PEOs" }));
    const list = screen.getByRole("list", { name: "All PEOs, newest first" });
    const items = within(list).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Justworks");
    expect(items[0]).toHaveTextContent("Updated proposal");
    expect(items[1]).toHaveTextContent("TriNet");
    await waitFor(() => expect(api.openQuoteRequestThread).toHaveBeenCalledTimes(2));
    expect(api.openQuoteRequestThread).toHaveBeenCalledWith(7, "2026-11-10T15:00:05.123456+00:00");
    expect(api.openQuoteRequestThread).toHaveBeenCalledWith(8, "2026-11-11T08:00:01.5+00:00");
  });

  it("says when a thread is empty", () => {
    panel();
    fireEvent.click(screen.getByRole("button", { name: /TriNet/ }));
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument();
  });

  describe("a message", () => {
    const open = (m: Partial<QuoteRequestMessageRow>, extra: Props = {}) => {
      panel({ messages: [message(m)], ...extra });
      fireEvent.click(screen.getByRole("button", { name: /TriNet/ }));
      return within(screen.getByRole("list", { name: "TriNet thread, newest first" }));
    };

    it("says who wrote it and what kind it is", () => {
      const thread = open({ new_sender: true });
      expect(thread.getByText("Received")).toBeInTheDocument();
      expect(thread.getByText("Dana Whitfield")).toBeInTheDocument();
      expect(thread.getByText("dana@trinet.example")).toBeInTheDocument();
      expect(thread.getByText("New sender")).toBeInTheDocument();
      expect(thread.getByText("Re: Harbor Street")).toBeInTheDocument();
    });

    it("is marked as sent by hand with who it went to, or as an automatic reply", () => {
      const hand = open({ direction: "sent_by_hand", to_addresses: ["dana@trinet.example"], from_name: null, from_address: "marcus@advisory.example" });
      expect(hand.getByText("Sent by hand")).toBeInTheDocument();
      expect(hand.getByText("to dana@trinet.example")).toBeInTheDocument();
    });

    // Break caught (M-2.1): a message the product sent through the advisor's mailbox read as received, or as sent when it is still queued or did not
    // go; a failure with no reason; no delivery mark promised (ADR 0005: none is reported); or one the advisor sent offered to move off the thread.
    it("is marked as sent from the advisor's mailbox, with who it went to and whether it went", () => {
      const sent = { direction: "sent", to_addresses: ["dana@trinet.example"], from_name: null, from_address: "sam@acme.example", status: "sent" as const };
      const went = open(sent);
      expect(went.getByText("Sent from the advisor's mailbox")).toBeInTheDocument();
      expect(went.getByText("to dana@trinet.example")).toBeInTheDocument();
      expect(went.getByText("Sent")).toBeInTheDocument();
      expect(went.queryByRole("button", { name: /Move it off this thread/ })).not.toBeInTheDocument();
      cleanup();
      expect(open({ ...sent, status: "queued" }).getByText("Queued")).toBeInTheDocument();
      cleanup();
      const failed = open({ ...sent, status: "failed", failure_kind: "mailbox", failure_reason: "Connect your mailbox again." });
      expect(failed.getByText("Not sent")).toBeInTheDocument();
      expect(failed.getByText("Connect your mailbox again.")).toBeInTheDocument();
    });

    it("is marked as automatic when a machine wrote it", () => {
      const thread = open({ is_automatic: true, body_text: "Out of office" });
      expect(thread.getByText("Automatic reply")).toBeInTheDocument();
    });

    it("can be moved off the thread to the holding list, with a reason, and the page reloads", async () => {
      api.moveMessageOffThread.mockResolvedValue(undefined);
      const thread = open({ id: 41 });
      fireEvent.click(thread.getByRole("button", { name: /Move it off this thread/ }));
      expect(thread.getByText(/not deleted, and the sender is not told/)).toBeInTheDocument();
      fireEvent.change(thread.getByLabelText(/Why \(optional/), { target: { value: "This is Justworks answering." } });
      fireEvent.click(thread.getByRole("button", { name: "Move to the holding list" }));
      await waitFor(() => expect(api.moveMessageOffThread).toHaveBeenCalledWith(41, "This is Justworks answering."));
      await waitFor(() => expect(toast.success).toHaveBeenCalled());
    });

    it("stays where it is, and says why, when the move fails or is cancelled", async () => {
      api.moveMessageOffThread.mockRejectedValue(new Error("That message is not where it was; reload the list."));
      const thread = open({});
      fireEvent.click(thread.getByRole("button", { name: /Move it off this thread/ }));
      fireEvent.click(thread.getByRole("button", { name: "Move to the holding list" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("That message is not where it was; reload the list."));
      fireEvent.click(thread.getByRole("button", { name: "Cancel" }));
      expect(thread.getByRole("button", { name: /Move it off this thread/ })).toBeInTheDocument();
    });

    it("folds its quoted history behind a button", () => {
      const thread = open({ body_text: "Yes, attached.\n\nOn Mon, Nov 10, 2026 at 3:42 PM Marcus <m@x.example> wrote:\n> Can you send loss runs?" });
      expect(thread.getByText("Yes, attached.")).toBeInTheDocument();
      expect(thread.queryByText(/Can you send loss runs/)).not.toBeInTheDocument();
      fireEvent.click(thread.getByRole("button", { name: "Show quoted text" }));
      expect(thread.getByText(/Can you send loss runs/)).toBeInTheDocument();
      expect(thread.getByRole("button", { name: "Hide quoted text" })).toHaveAttribute("aria-expanded", "true");
    });

    it("shows its text as text, never as HTML", () => {
      const thread = open({ body_text: "<img src=x onerror=alert(1)> <b>bold</b>" });
      expect(thread.getByText("<img src=x onerror=alert(1)> <b>bold</b>")).toBeInTheDocument();
      expect(document.querySelector("img")).toBeNull();
    });

    it("says when only part of a long message is kept, or it has no text", () => {
      expect(open({ body_truncated: true }).getByText(/only its first part is kept/)).toBeInTheDocument();
    });

    it("lists a clean attachment with a button that opens its signed link, and no button for the others", async () => {
      const assign = vi.fn();
      Object.defineProperty(window, "location", { value: { assign }, configurable: true });
      api.mailAttachmentUrl.mockResolvedValue("https://files.example/signed");
      const thread = open({}, {
        attachments: [
          attachment(),
          attachment({ id: 2, file_name: "invoice.pdf", status: "blocked", storage_path: null, scan_verdict: "infected" }),
          attachment({ id: 3, file_name: "rate-model.xlsm", status: "not_kept", not_kept_reason: "unsupported_type", storage_path: null, scan_verdict: null }),
          attachment({ id: 4, file_name: "waiting.pdf", status: "pending", storage_path: null, scan_verdict: null }),
        ],
      });
      const files = thread.getByRole("list", { name: "Attachments" });
      const items = within(files).getAllByRole("listitem");
      expect(items).toHaveLength(4);
      expect(items[0]).toHaveTextContent("proposal.pdf");
      expect(items[0]).toHaveTextContent("scanned, clean");
      expect(items[1]).toHaveTextContent("blocked: the malware scan flagged this file");
      expect(items[2]).toHaveTextContent("not kept: this type of file isn't accepted");
      expect(items[3]).toHaveTextContent("being checked for viruses");
      expect(within(files).getAllByRole("button", { name: "Open" })).toHaveLength(1);
      fireEvent.click(within(items[0]).getByRole("button", { name: "Open" }));
      await waitFor(() => expect(assign).toHaveBeenCalledWith("https://files.example/signed"));
      expect(api.mailAttachmentUrl).toHaveBeenCalledWith(expect.objectContaining({ id: 1, storage_path: "s1/1/1-proposal.pdf" }));
      // The firm's record names the quote request the file came in on, once the link is in hand.
      expect(api.recordActivity).toHaveBeenCalledWith("document_downloaded", "quote_request", "7");
    });

    // Catches: a support session is offered "Open" on a PEO's attachment and meets "Couldn't open that file" (the storage policy refuses it).
    it("offers support no way to open an attachment, says so in one line and still lists the file", async () => {
      const workspace = { firm: null, role: null, isOwner: false, isSupport: true, supportEndsAt: null, supportSessionId: null, isPlatformAdmin: true, person: "Sam" };
      render(
        <WorkspaceContext.Provider value={workspace}>
          <PeoThreadPanel prospectUserId="p1" requests={[request()]} messages={[message()]} attachments={[attachment()]} notes={[]} events={[]} reads={[]} />
        </WorkspaceContext.Provider>,
      );
      fireEvent.click(screen.getByRole("button", { name: /TriNet/ }));
      expect(await screen.findByText("proposal.pdf")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Open" })).not.toBeInTheDocument();
      expect(screen.getAllByText("Downloads are off during Nevermore support.")).toHaveLength(1);
    });

    it("says so when a file can't be opened", async () => {
      api.mailAttachmentUrl.mockRejectedValue(new Error("Couldn't open that file."));
      const thread = open({}, { attachments: [attachment()] });
      fireEvent.click(thread.getByRole("button", { name: "Open" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't open that file."));
      expect(api.recordActivity).not.toHaveBeenCalled();
    });
  });

  it("shows a note with its kind, day and author, and says a corrected one was corrected", () => {
    panel({ notes: [note()], events: [event({ id: 9, field: "note_body", old_value: "Dana called.", new_value: "Dana called about loss runs.", note_id: 1 })] });
    fireEvent.click(screen.getByRole("button", { name: /TriNet/ }));
    const item = within(screen.getByRole("list", { name: "TriNet thread, newest first" })).getByRole("listitem");
    expect(item).toHaveTextContent("Note · Call");
    expect(item).toHaveTextContent("Nov 9, 2026");
    expect(item).toHaveTextContent("adv@example.com");
    expect(item).toHaveTextContent("Corrected: the earlier text is in the change log.");
  });

  it("keeps corrections to a quote request's fields in a change log beneath, not on the thread", () => {
    panel({
      events: [
        event({ id: 1, field: "admin_fee_pepm", old_value: "145.50", new_value: "150.00" }),
        event({ id: 2, field: "reply_address", old_value: null, new_value: "a.b.c" }),
        event({ id: 3, field: "status", old_value: "sent", new_value: "quoted" }),
        event({ id: 4, quote_request_id: 8, field: "admin_fee_pepm", old_value: "1", new_value: "2" }),
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: /TriNet/ }));
    const thread = screen.getByRole("list", { name: "TriNet thread, newest first" });
    expect(within(thread).getAllByRole("listitem")).toHaveLength(1); // the status change
    const log = screen.getByText("Change log (2)").closest("details")!;
    const lines = within(log).getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(lines).toHaveLength(2);
    expect(lines.join("\n")).toContain("Admin fee per employee per month: 145.50 → 150.00");
    expect(lines.join("\n")).toContain("Reply address: — → a.b.c");
    expect(lines.join("\n")).not.toContain("Status");
  });

  // Catches: a download by the bundle link (slice 6.6b, ADR 0003) missing from the thread, credited to a person, or buried in the change log.
  it("shows each download by the bundle link on the thread, by the link, and not in the change log", () => {
    panel({
      events: [
        event({ id: 1, field: "bundle_download", old_value: null, new_value: "The packet (EAA-2026-0042-packet-v3.pdf)", changed_by: null, changed_by_email: null, changed_at: "2026-11-12T09:00:00Z" }),
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: /TriNet/ }));
    const thread = screen.getByRole("list", { name: "TriNet thread, newest first" });
    const items = within(thread).getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(items).toHaveLength(1);
    expect(items[0]).toContain("Downloaded The packet (EAA-2026-0042-packet-v3.pdf), by the bundle link");
    expect(screen.queryByText(/Change log/)).not.toBeInTheDocument();
  });

  // N-1.3. Break caught: an agent who asked the employer about a PEO's question and finds no sign of it on the PEO's thread, so asks twice or forgets to answer the PEO.
  describe("the employer asked about an open question", () => {
    const asked = { id: 5, session_id: "s1", message: "How many of your employees work part time?", fields: ["census"], extra_questions: [], requested_by: "a1", requested_by_email: "adv@example.com", requested_at: "2026-11-12T16:00:00Z" };
    const logged = event({ id: 9, field: "asked_employer", old_value: null, new_value: "5", changed_at: "2026-11-12T16:00:01Z" });
    const open = (p: Props) => {
      panel({ reads: [read("2030-01-01T00:00:00Z")], ...p });
      fireEvent.click(screen.getByRole("button", { name: /TriNet/ }));
    };

    it("says what the agent asked and that the employer has not answered yet", () => {
      open({ requests: [request({ status: "question_open" })], events: [logged], informationRequests: [asked], pipelineStatus: "information_requested" });
      const line = screen.getByRole("status");
      expect(line).toHaveTextContent("You asked the employer: \u201cHow many of your employees work part time?\u201d");
      expect(line).toHaveTextContent("Waiting for their answer.");
    });

    // Break caught: the line staying on the thread after the agent has written back to the PEO (the question is answered, the quote request is Sent again).
    it("says nothing once the PEO has been answered and the quote request is Sent again", () => {
      open({ requests: [request({ status: "sent" })], events: [logged], informationRequests: [asked], pipelineStatus: "sent_to_carrier" });
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    // Break caught: a request that goes on saying "waiting" after the employer certified again, or one that leaves the agent not knowing the PEO is still unanswered.
    it("says the request is answered once the submission is no longer waiting on the employer, and that the PEO is still to be answered", () => {
      open({ requests: [request({ status: "question_open" })], events: [logged], informationRequests: [asked], pipelineStatus: "sent_to_carrier" });
      const line = screen.getByRole("status");
      expect(line).not.toHaveTextContent("Waiting for their answer.");
      expect(line).toHaveTextContent("The employer has answered. Write back to TriNet to answer the question.");
    });
  });

  // N-1.1. Break caught: a suggestion the agent never sees (the model read the reply for nothing), or one that looks like it already changed the status.
  describe("a suggestion on a reply", () => {
    const open = (m: Partial<QuoteRequestMessageRow>) => {
      // Already opened by the team, so the only reload asked for is the one a settled suggestion asks for.
      const onOpened = panel({ messages: [message(m)], reads: [read("2030-01-01T00:00:00Z")] });
      fireEvent.click(screen.getByRole("button", { name: /TriNet/ }));
      return Object.assign(within(screen.getByRole("list", { name: "TriNet thread, newest first" })), { onOpened });
    };

    // N-1.3. Break caught: an accepted question that ends in a plain toast, so the agent does not learn the employer can now be asked about it.
    it("tells the agent, on accepting a question, that the employer can be asked about it", async () => {
      api.decideReplySuggestion.mockResolvedValue(undefined);
      const thread = open({ id: 41, suggested_status: "question_open", suggestion_outcome: null });
      fireEvent.click(thread.getByRole("button", { name: "Accept" }));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Recorded as Question open. You can ask the prospect about it: write the question in your own words."));
    });

    it("is offered under the reply as a suggestion only, with Accept and Dismiss", () => {
      const thread = open({ suggested_status: "acknowledged", suggestion_outcome: null });
      expect(thread.getByText(/Suggested: Acknowledged/)).toBeInTheDocument();
      expect(thread.getByText(/nothing changes until you accept/i)).toBeInTheDocument();
      expect(thread.getByRole("button", { name: "Accept" })).toBeInTheDocument();
      expect(thread.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
    });

    // Break caught: an Accept that does nothing, or one that does not ask the page to reload so the status and the suggestion look unchanged.
    it("is accepted with Accept, which settles it in the database and has the page reload", async () => {
      api.decideReplySuggestion.mockResolvedValue(undefined);
      const thread = open({ id: 41, suggested_status: "question_open", suggestion_outcome: null });
      fireEvent.click(thread.getByRole("button", { name: "Accept" }));
      await waitFor(() => expect(api.decideReplySuggestion).toHaveBeenCalledWith(41, "accept"));
      await waitFor(() => expect(toast.success).toHaveBeenCalled());
      expect(thread.onOpened).toHaveBeenCalled();
    });

    // Break caught: a Dismiss that does nothing, so the suggestion stays on the reply for ever.
    it("is dismissed with Dismiss, which settles it as dismissed and has the page reload", async () => {
      api.decideReplySuggestion.mockResolvedValue(undefined);
      const thread = open({ id: 41, suggested_status: "declined", suggestion_outcome: null });
      fireEvent.click(thread.getByRole("button", { name: "Dismiss" }));
      await waitFor(() => expect(api.decideReplySuggestion).toHaveBeenCalledWith(41, "dismiss"));
      await waitFor(() => expect(thread.onOpened).toHaveBeenCalled());
    });

    // Break caught: a refused accept (a decline not recorded yet) that fails silently, or looks recorded and reloads the page as if it were.
    it("says why the database refused an Accept, in its words, and leaves the suggestion to settle", async () => {
      api.decideReplySuggestion.mockRejectedValue(new Error("Record the decline first, with its reason, then accept this"));
      const thread = open({ id: 41, suggested_status: "declined", suggestion_outcome: null });
      fireEvent.click(thread.getByRole("button", { name: "Accept" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Record the decline first, with its reason, then accept this"));
      expect(toast.success).not.toHaveBeenCalled();
      expect(thread.onOpened).not.toHaveBeenCalled();
      expect(thread.getByRole("button", { name: "Accept" })).toBeEnabled();
    });

    // Break caught: a settled suggestion offered again (it can be settled once), or a settled one that says nothing of what became of it.
    it.each([["accepted", "Suggested: Acknowledged, accepted."], ["dismissed", "Suggested: Acknowledged, dismissed."]] as const)(
      "when %s says so and offers no buttons",
      (outcome, words) => {
        const thread = open({ suggested_status: "acknowledged", suggestion_outcome: outcome });
        expect(thread.getByText(words)).toBeInTheDocument();
        expect(thread.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
        expect(thread.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
      },
    );

    // Break caught: a reply with no suggestion showing an empty box.
    // Break caught: a suggestion on a message the firm sent (the database refuses to make one, but the page must not trust that to be so).
    it("is not shown on a message the firm sent", () => {
      const thread = open({ direction: "sent", suggested_status: "quoted", suggestion_outcome: null });
      expect(thread.queryByText(/Suggested/)).not.toBeInTheDocument();
    });

    it("is not shown on a reply with none", () => {
      const thread = open({ suggested_status: null });
      expect(thread.queryByText(/Suggested/)).not.toBeInTheDocument();
    });
  });
});
