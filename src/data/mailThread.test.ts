import { describe, expect, it } from "vitest";
import {
  buildTimeline, describeAttachment, hasNewMail, isThreadEvent, latestRecordedAt, splitQuotedText,
  type ThreadAttachment, type ThreadEvent, type ThreadMessage, type ThreadNote,
} from "./mailThread";

const message = (over: Partial<ThreadMessage> = {}): ThreadMessage => ({
  id: 1, quote_request_id: 7, direction: "received", is_automatic: false, new_sender: false, from_address: "dana@trinet.example", from_name: "Dana",
  to_addresses: [], cc_addresses: [], subject: "Re: Harbor Street", body_text: "Hello", body_truncated: false, sent_at: "2026-11-10T15:00:00Z",
  recorded_at: "2026-11-10T15:00:05.123456+00:00", ...over,
});
const attachment = (over: Partial<ThreadAttachment> = {}): ThreadAttachment => ({
  id: 1, message_id: 1, file_name: "proposal.pdf", size_bytes: 412_000, status: "stored", not_kept_reason: null, scan_signature: null, storage_path: "s/1/1-p.pdf", ...over,
});
const note = (over: Partial<ThreadNote> = {}): ThreadNote => ({
  id: 1, quote_request_id: 7, kind: "call", noted_on: "2026-11-09", body: "Dana called", created_by: "a1", created_by_email: "adv@example.com", created_at: "2026-11-09T09:00:00Z", ...over,
});
const event = (over: Partial<ThreadEvent> = {}): ThreadEvent => ({
  id: 1, quote_request_id: 7, field: "status", old_value: "sent", new_value: "quoted", changed_by: "a1", changed_by_email: "adv@example.com",
  changed_at: "2026-11-10T10:00:00Z", note_id: null, ...over,
});
const requests = [{ id: 7, peo_name: "TriNet" }, { id: 8, peo_name: "Justworks" }];

describe("the thread's timeline", () => {
  it("holds messages, notes, sends and status changes, newest first", () => {
    const entries = buildTimeline({
      requests,
      messages: [message({ id: 1, sent_at: "2026-11-10T15:00:00Z" })],
      attachments: [],
      notes: [note({ id: 2, noted_on: "2026-11-09" })],
      events: [
        event({ id: 3, field: "status", old_value: null, new_value: "sent", changed_at: "2026-11-07T16:10:00Z" }),
        event({ id: 4, field: "sent_version", old_value: null, new_value: "3", changed_at: "2026-11-07T16:10:00Z" }),
        event({ id: 5, field: "sent_on", old_value: null, new_value: "2026-11-07", changed_at: "2026-11-07T16:10:00Z" }),
        event({ id: 6, field: "status", old_value: "sent", new_value: "quoted", changed_at: "2026-11-10T17:00:00Z" }),
      ],
    });
    expect(entries.map((e) => e.key)).toEqual(["status-6", "message-1", "note-2", "send-5"]);
  });

  it("names the version a send carried, and leaves the first status (the send itself) out", () => {
    const entries = buildTimeline({
      requests, messages: [], attachments: [], notes: [],
      events: [
        event({ id: 1, field: "status", old_value: null, new_value: "sent", changed_at: "2026-11-07T16:10:00Z" }),
        event({ id: 2, field: "sent_version", old_value: null, new_value: "3", changed_at: "2026-11-07T16:10:00Z" }),
        event({ id: 3, field: "sent_on", old_value: null, new_value: "2026-11-07", changed_at: "2026-11-07T16:10:00Z" }),
      ],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: "send", sentOn: "2026-11-07", version: "3", peo: "TriNet" });
  });

  it("shows a second send, and a reopened request's status change, as their own entries", () => {
    const entries = buildTimeline({
      requests, messages: [], attachments: [], notes: [],
      events: [
        event({ id: 1, field: "sent_on", old_value: "2026-11-07", new_value: "2026-11-12", changed_at: "2026-11-12T09:00:00Z" }),
        event({ id: 2, field: "status", old_value: "closed", new_value: "sent", changed_at: "2026-11-12T09:00:00Z" }),
      ],
    });
    expect(entries.map((e) => e.kind).sort()).toEqual(["send", "status"]);
  });

  it("leaves a correction to a field, or to a note, in the change log", () => {
    const entries = buildTimeline({
      requests, messages: [], attachments: [], notes: [],
      events: [
        event({ id: 1, field: "admin_fee_pepm", old_value: "145", new_value: "150" }),
        event({ id: 2, field: "reply_address", old_value: null, new_value: "a.b.c" }),
        event({ id: 3, field: "note_body", old_value: "a", new_value: "b", note_id: 9 }),
        event({ id: 4, field: "underwriter_question", old_value: null, new_value: "Why?" }),
      ],
    });
    expect(entries).toEqual([]);
  });

  it("places a message at the time it was sent, or when it was recorded if that is unknown", () => {
    const entries = buildTimeline({
      requests, attachments: [], notes: [], events: [],
      messages: [message({ id: 1, sent_at: null, recorded_at: "2026-11-10T08:00:00+00:00" }), message({ id: 2, sent_at: "2026-11-10T09:00:00Z" })],
    });
    expect(entries.map((e) => e.key)).toEqual(["message-2", "message-1"]);
    expect(entries[1].at).toBe("2026-11-10T08:00:00+00:00");
  });

  it("puts a message's attachments with it, in order", () => {
    const entries = buildTimeline({
      requests, notes: [], events: [], messages: [message({ id: 1 }), message({ id: 2 })],
      attachments: [attachment({ id: 5, message_id: 1 }), attachment({ id: 4, message_id: 1 }), attachment({ id: 6, message_id: 2 })],
    });
    const first = entries.find((e) => e.key === "message-1");
    expect(first?.kind === "message" && first.attachments.map((a) => a.id)).toEqual([4, 5]);
  });

  it("leaves out held mail and anything on a quote request it wasn't given", () => {
    const entries = buildTimeline({
      requests: [requests[0]], attachments: [], events: [],
      messages: [message({ id: 1, quote_request_id: null }), message({ id: 2, quote_request_id: 8 }), message({ id: 3 })],
      notes: [note({ id: 1, quote_request_id: 8 })],
    });
    expect(entries.map((e) => e.key)).toEqual(["message-3"]);
  });

  it("orders a note by its day, at midday, among the messages of that day", () => {
    const entries = buildTimeline({
      requests, attachments: [], events: [],
      messages: [message({ id: 1, sent_at: "2026-11-09T08:00:00Z" }), message({ id: 2, sent_at: "2026-11-09T18:00:00Z" })],
      notes: [note({ id: 3, noted_on: "2026-11-09" })],
    });
    expect(entries.map((e) => e.key)).toEqual(["message-2", "note-3", "message-1"]);
  });

  it("is the same whichever order the rows come in", () => {
    const rows = { requests, attachments: [], notes: [note({ id: 1 }), note({ id: 2 })], events: [], messages: [message({ id: 1 }), message({ id: 2, sent_at: "2026-11-11T00:00:00Z" })] };
    const a = buildTimeline(rows).map((e) => e.key);
    const b = buildTimeline({ ...rows, messages: [...rows.messages].reverse(), notes: [...rows.notes].reverse() }).map((e) => e.key);
    expect(a).toEqual(b);
  });

  it("says which events the change log keeps", () => {
    expect(isThreadEvent({ field: "sent_on", old_value: null, note_id: null })).toBe(true);
    expect(isThreadEvent({ field: "status", old_value: "sent", note_id: null })).toBe(true);
    expect(isThreadEvent({ field: "status", old_value: null, note_id: null })).toBe(false);
    expect(isThreadEvent({ field: "admin_fee_pepm", old_value: "1", note_id: null })).toBe(false);
    expect(isThreadEvent({ field: "sent_on", old_value: null, note_id: 4 })).toBe(false);
  });
});

describe("new PEO mail", () => {
  const reads = (at: string) => [{ quote_request_id: 7, last_opened_at: at }];

  it("is a person at the PEO writing to a quote request nobody has opened", () => {
    expect(hasNewMail(7, [message()], [])).toBe(true);
  });

  it("is not an automatic reply, an advisor's own copied-in message, or mail on another quote request", () => {
    expect(hasNewMail(7, [message({ is_automatic: true })], [])).toBe(false);
    expect(hasNewMail(7, [message({ direction: "sent_by_hand" })], [])).toBe(false);
    expect(hasNewMail(7, [message({ quote_request_id: 8 })], [])).toBe(false);
    expect(hasNewMail(7, [message({ quote_request_id: null })], [])).toBe(false);
    expect(hasNewMail(7, [], [])).toBe(false);
  });

  it("clears once the thread is opened through the message, and returns with a newer one", () => {
    const m = message({ recorded_at: "2026-11-10T15:00:05.123456+00:00" });
    expect(hasNewMail(7, [m], reads("2026-11-10T15:00:05.123456+00:00"))).toBe(false);
    expect(hasNewMail(7, [m], reads("2026-11-10T16:00:00+00:00"))).toBe(false);
    expect(hasNewMail(7, [m], reads("2026-11-10T15:00:00+00:00"))).toBe(true);
    expect(hasNewMail(7, [m, message({ id: 2, recorded_at: "2026-11-10T17:00:00+00:00" })], reads("2026-11-10T16:00:00+00:00"))).toBe(true);
  });

  it("is per quote request: another's open doesn't clear it", () => {
    expect(hasNewMail(7, [message()], [{ quote_request_id: 8, last_opened_at: "2030-01-01T00:00:00+00:00" }])).toBe(true);
  });

  it("gives the latest time a quote request's mail was recorded, exactly as stored", () => {
    expect(latestRecordedAt(7, [message({ id: 1, recorded_at: "2026-11-10T15:00:05.123456+00:00" }), message({ id: 2, recorded_at: "2026-11-11T08:00:00.5+00:00" }), message({ id: 3, quote_request_id: 8, recorded_at: "2027-01-01T00:00:00+00:00" })]))
      .toBe("2026-11-11T08:00:00.5+00:00");
    expect(latestRecordedAt(7, [])).toBeNull();
  });
});

describe("a message's quoted history", () => {
  it("is split off after an 'On ... wrote:' line and the lines it introduces", () => {
    const text = "Thanks, the loss runs are fine.\n\nOn Mon, Nov 10, 2026 at 3:42 PM Marcus Lee <m@x.example> wrote:\n> Can you send loss runs?\n> Thanks";
    expect(splitQuotedText(text)).toEqual({
      visible: "Thanks, the loss runs are fine.",
      quoted: "On Mon, Nov 10, 2026 at 3:42 PM Marcus Lee <m@x.example> wrote:\n> Can you send loss runs?\n> Thanks",
    });
  });

  it("copes with an attribution wrapped over two lines", () => {
    const text = "Yes.\n\nOn Mon, Nov 10, 2026 at 3:42 PM Marcus Lee\n<m@x.example> wrote:\n> Question?";
    expect(splitQuotedText(text).visible).toBe("Yes.");
    expect(splitQuotedText(text).quoted.startsWith("On Mon")).toBe(true);
  });

  it("is split off at an Original Message line or an Outlook header block", () => {
    expect(splitQuotedText("Done.\n\n-----Original Message-----\nFrom: A\nSent: Monday\nSubject: x\n\nOld text")).toMatchObject({ visible: "Done.", quoted: expect.stringContaining("Original Message") });
    expect(splitQuotedText("Done.\n\nFrom: Marcus Lee <m@x.example>\nSent: Monday, November 10, 2026 3:42 PM\nTo: Dana\nSubject: Re: x\n\nOld text").visible).toBe("Done.");
    expect(splitQuotedText("Done.\n________________________________\nFrom: A\nSent: B\nOld").visible).toBe("Done.");
  });

  it("keeps an inline answer visible: only a trailing quoted block is split off", () => {
    const text = "> Can you send loss runs?\nYes, attached.\n> And the census?\nComing tomorrow.";
    expect(splitQuotedText(text)).toEqual({ visible: text, quoted: "" });
  });

  it("leaves a message with no quoted text alone, and never hides all of one", () => {
    expect(splitQuotedText("Just text.\nTwo lines.")).toEqual({ visible: "Just text.\nTwo lines.", quoted: "" });
    expect(splitQuotedText("> only quoted\n> lines")).toEqual({ visible: "> only quoted\n> lines", quoted: "" });
    expect(splitQuotedText("")).toEqual({ visible: "", quoted: "" });
  });

  it("is not fooled by 'From:' in the body without a Sent or Date line after it, or by a line that merely starts with On", () => {
    const text = "From: our side, we can start 1 January.\nOn Monday we will know more.";
    expect(splitQuotedText(text).quoted).toBe("");
  });

  it("reads Windows line endings", () => {
    expect(splitQuotedText("Thanks.\r\n\r\nOn Mon, Nov 10, 2026 Dana wrote:\r\n> Hi").visible).toBe("Thanks.");
  });
});

describe("what an attachment says", () => {
  it("can be opened only once it is stored", () => {
    expect(describeAttachment({ status: "stored", not_kept_reason: null, size_bytes: 412_000 })).toEqual({ text: "402 KB · scanned, clean", openable: true });
    expect(describeAttachment({ status: "pending", not_kept_reason: null, size_bytes: 10 }).openable).toBe(false);
    expect(describeAttachment({ status: "blocked", not_kept_reason: null, size_bytes: 10 })).toMatchObject({ openable: false, text: expect.stringContaining("blocked") });
  });

  it("says why a file wasn't kept", () => {
    for (const [reason, words] of [["too_large", "over 20 MB"], ["unsupported_type", "isn't accepted"], ["type_mismatch", "type its name says"], ["executable", "a program"]]) {
      expect(describeAttachment({ status: "not_kept", not_kept_reason: reason, size_bytes: 10 }).text, reason).toContain(words);
    }
    expect(describeAttachment({ status: "not_kept", not_kept_reason: "something new", size_bytes: 10 }).text).toContain("isn't accepted");
  });
});
