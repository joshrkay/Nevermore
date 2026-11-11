import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type {
  QuoteRequestEventRow, QuoteRequestMailAttachmentRow, QuoteRequestMessageRow, QuoteRequestNoteRow, QuoteRequestRow, QuoteRequestThreadReadRow,
} from "@/lib/advisorApi";

const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("sonner", () => ({ toast }));
const api = { openQuoteRequestThread: vi.fn(), mailAttachmentUrl: vi.fn() };
vi.mock("@/lib/advisorApi", () => api);

const { default: PeoThreadPanel } = await import("./PeoThreadPanel");

const request = (over: Partial<QuoteRequestRow> = {}): QuoteRequestRow => ({
  id: 7, session_id: "s1", peo_name: "TriNet", status: "sent", sent_version: 3, sent_on: "2026-11-07", quote_received_on: null,
  quote_expires_on: null, proposed_start_on: null, admin_fee_pepm: null, note: null, ...over,
});
const message = (over: Partial<QuoteRequestMessageRow> = {}): QuoteRequestMessageRow => ({
  id: 1, provider_message_id: "re_1", quote_request_id: 7, session_id: "s1", address_local_part: "a.b.c", held_reason: null, direction: "received",
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
  events?: QuoteRequestEventRow[]; reads?: QuoteRequestThreadReadRow[];
}

const panel = (p: Props = {}) => {
  const onOpened = vi.fn();
  render(
    <PeoThreadPanel
      prospectUserId="p1" requests={p.requests ?? [request()]} messages={p.messages ?? []} attachments={p.attachments ?? []} notes={p.notes ?? []}
      events={p.events ?? []} reads={p.reads ?? []} onOpened={onOpened}
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
    expect(items[0]).toContain("Waiting → Quoted");
    expect(items[1]).toContain("Second message");
    expect(items[2]).toContain("Proposal attached.");
    expect(items[3]).toContain("Dana called about loss runs.");
    expect(items[4]).toContain("Version 3 sent Nov 7, 2026");
    // Through the latest message exactly as the database gave it: nothing that arrives later is marked read.
    await waitFor(() => expect(api.openQuoteRequestThread).toHaveBeenCalledWith(7, "2026-11-10T16:30:00.654321+00:00"));
    await waitFor(() => expect(within(screen.getByRole("button", { name: /TriNet/ })).queryByText("New PEO mail")).not.toBeInTheDocument());
    expect(onOpened).toHaveBeenCalledTimes(1);
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

    it("is marked as automatic when a machine wrote it", () => {
      const thread = open({ is_automatic: true, body_text: "Out of office" });
      expect(thread.getByText("Automatic reply")).toBeInTheDocument();
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
    });

    it("says so when a file can't be opened", async () => {
      api.mailAttachmentUrl.mockRejectedValue(new Error("Couldn't open that file."));
      const thread = open({}, { attachments: [attachment()] });
      fireEvent.click(thread.getByRole("button", { name: "Open" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't open that file."));
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
});
