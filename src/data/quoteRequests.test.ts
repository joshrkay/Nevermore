import { describe, expect, it } from "vitest";
import { describeQuoteRequestEvent, isChangeLogEvent, quoteNoteKindLabel, quoteReplyDomain, replyAddress } from "./quoteRequests";

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
