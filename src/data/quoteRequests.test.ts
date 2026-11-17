import { describe, expect, it } from "vitest";
import { describeQuoteRequestEvent, HELD_REASON_LABELS, heldDaysLeft, isChangeLogEvent, olderVersionNote, quoteKindLabel, quoteNoteKindLabel, quoteReplyDomain, replyAddress, updateFrom } from "./quoteRequests";

describe("the receiving subdomain for reply addresses", () => {
  it("is off unless a subdomain is set", () => {
    expect(quoteReplyDomain(undefined)).toBeNull();
    expect(quoteReplyDomain("")).toBeNull();
    expect(quoteReplyDomain("   ")).toBeNull();
  });

  it("is read trimmed and in lower case", () => {
    expect(quoteReplyDomain("  Quotes.Example.com ")).toBe("quotes.example.com");
  });

  // A value that isn't a domain would build addresses nothing can deliver to.
  it("is off for anything that isn't a domain name", () => {
    for (const bad of ["quotes", "quotes.example.com/", "@quotes.example.com", "quotes..example.com", "-quotes.example.com", "https://quotes.example.com", 7]) {
      expect(quoteReplyDomain(bad), String(bad)).toBeNull();
    }
  });

  it("joins the stored local part and the subdomain into the address", () => {
    expect(replyAddress("eaa-2026-0042.trinet.0123456789abcdef", "quotes.example.com")).toBe(
      "eaa-2026-0042.trinet.0123456789abcdef@quotes.example.com",
    );
  });
});

describe("a quote request's change log", () => {
  it("describes a corrected note's kind by its label, and its date and text as they were", () => {
    expect(describeQuoteRequestEvent({ field: "note_kind", old_value: "call", new_value: "portal_entry" })).toBe("Note kind: Call → Portal entry");
    expect(describeQuoteRequestEvent({ field: "note_noted_on", old_value: "2026-11-09", new_value: "2026-11-08" })).toBe("Note date: 2026-11-09 → 2026-11-08");
    expect(describeQuoteRequestEvent({ field: "note_body", old_value: "A", new_value: "B" })).toBe("Note text: A → B");
  });

  // Catches: a bundle link issued or revoked (slice 6.6b) shown by its column name, or with an empty "before" arrow that reads as a change.
  it("describes a bundle link being issued and revoked in words", () => {
    expect(describeQuoteRequestEvent({ field: "bundle_link", old_value: null, new_value: "Issued for version 3" })).toBe("Bundle link issued for version 3");
    expect(describeQuoteRequestEvent({ field: "bundle_link", old_value: null, new_value: "Revoked: newer_version" })).toBe("Bundle link revoked: a newer version was sent");
  });

  // Catches: a link the employer's ending of the firm's access revoked (CRM-P2.5) shown by its code, "access_ended", in the change log.
  it("describes a bundle link revoked because the employer ended the firm's access", () => {
    expect(describeQuoteRequestEvent({ field: "bundle_link", old_value: null, new_value: "Revoked: access_ended" })).toBe("Bundle link revoked: the employer ended the firm's access");
  });

  it("describes a reply address being issued and reissued", () => {
    expect(describeQuoteRequestEvent({ field: "reply_address", old_value: null, new_value: "a.b.c" })).toBe("Reply address: — → a.b.c");
    expect(describeQuoteRequestEvent({ field: "reply_address", old_value: "a.b.c", new_value: "a.b.d" })).toBe("Reply address: a.b.c → a.b.d");
  });

  it("leaves out a question recorded before questions became notes", () => {
    expect(isChangeLogEvent({ field: "underwriter_question" })).toBe(false);
    expect(isChangeLogEvent({ field: "status" })).toBe(true);
    expect(isChangeLogEvent({ field: "note_body" })).toBe(true);
  });

  it("shows a kind it doesn't know as stored", () => {
    expect(quoteNoteKindLabel("underwriter_question")).toBe("Underwriter's question");
    expect(quoteNoteKindLabel("meeting")).toBe("meeting");
  });
});

describe("held mail", () => {
  it("describes a message moved on or off a thread by its id alone", () => {
    expect(describeQuoteRequestEvent({ field: "mail_moved_off", old_value: null, new_value: "17" })).toBe("A message was moved off this thread to the holding list (message 17)");
    expect(describeQuoteRequestEvent({ field: "mail_assigned", old_value: null, new_value: "17" })).toBe("A held message was assigned to this thread (message 17)");
  });

  it("names every reason the database holds a message for", () => {
    expect(Object.keys(HELD_REASON_LABELS).sort()).toEqual(["ambiguous_address", "moved_by_advisor", "revoked_address", "unknown_address"]);
  });

  it("counts the days left of the 30 a message is held, rounding up and never below zero", () => {
    const now = new Date("2026-11-11T12:00:00Z");
    expect(heldDaysLeft("2026-11-11T12:00:00Z", now)).toBe(30);
    expect(heldDaysLeft("2026-11-10T00:00:00Z", now)).toBe(29);
    expect(heldDaysLeft("2026-10-13T00:00:00Z", now)).toBe(1);
    expect(heldDaysLeft("2026-09-01T00:00:00Z", now)).toBe(0);
  });
});

// M-2.3: which PEOs are offered the update, as the queue counts one holding an older version (an open quote request, sent or quoted).
describe("the update a PEO is offered", () => {
  // Break caught: no update offered to a PEO that quoted on the older version, or one offered to a PEO that declined, was withdrawn, never had the
  // bundle, or already holds the latest.
  it("is the version a PEO still open on the submission holds, when it is older than the latest certified", () => {
    expect(updateFrom({ status: "sent", sent_version: 2 }, 3)).toBe(2);
    expect(updateFrom({ status: "quoted", sent_version: 1 }, 3)).toBe(1);
    expect(updateFrom({ status: "sent", sent_version: 3 }, 3)).toBeNull();
    expect(updateFrom({ status: "declined", sent_version: 2 }, 3)).toBeNull();
    expect(updateFrom({ status: "closed", sent_version: 2 }, 3)).toBeNull();
    expect(updateFrom({ status: "sent", sent_version: null }, 3)).toBeNull();
    expect(updateFrom(undefined, 3)).toBeNull();
    expect(updateFrom({ status: "sent", sent_version: 2 }, null)).toBeNull();
  });

  // Break caught (N-1.2): a PEO that acknowledged, or has a question open, never offered the newer version, though it is waiting on the broker most of all.
  it("is offered to a PEO that acknowledged or has a question open, as to one that is Sent", () => {
    expect(updateFrom({ status: "acknowledged", sent_version: 1 }, 2)).toBe(1);
    expect(updateFrom({ status: "question_open", sent_version: 1 }, 2)).toBe(1);
  });
});

// M-2.3. Break caught: the change log naming the new column by its database name when a new answer moves the version a quote was given on.
describe("the version a quote was given on, in the change log", () => {
  it("is named in words", () => {
    expect(describeQuoteRequestEvent({ field: "quoted_version", old_value: "1", new_value: "2" })).toBe("Quote given on version: 1 → 2");
  });
});

// N-1.2. Break caught: the "Sent v1, current v2" warning vanishing from a PEO the moment it acknowledges or asks a question, while it still holds the old version.
describe("the older-version note", () => {
  it("shows for a PEO that is Sent, Acknowledged, has a question open or has quoted, and for none that declined or was closed", () => {
    for (const status of ["sent", "acknowledged", "question_open", "quoted"]) expect(olderVersionNote({ status, sent_version: 1 }, 2)).toBe("Sent v1, current v2");
    for (const status of ["declined", "closed"]) expect(olderVersionNote({ status, sent_version: 1 }, 2)).toBeNull();
  });
});

// N-1.2. Break caught: a new status shown by its database word ("question_open") on the log of a quote request.
describe("the change log's new statuses", () => {
  it("names Acknowledged and Question open in words", () => {
    expect(describeQuoteRequestEvent({ field: "status", old_value: "sent", new_value: "acknowledged" })).toBe("Status: Sent → Acknowledged");
    expect(describeQuoteRequestEvent({ field: "status", old_value: "acknowledged", new_value: "question_open" })).toBe("Status: Acknowledged → Question open");
  });
});

describe("how a quote says whether it is an estimate or a firm offer", () => {
  // The comparison never shows one as the other (N-2.1), so a quote with no mark, or a word this build doesn't know, reads as neither.
  it("names each mark, and reads anything else as not marked rather than as either", () => {
    expect(quoteKindLabel("estimate")).toBe("Estimate");
    expect(quoteKindLabel("firm_offer")).toBe("Firm offer");
    expect(quoteKindLabel(null)).toBe("Not marked");
    expect(quoteKindLabel("binding")).toBe("Not marked");
  });
});
