import { describe, expect, it } from "vitest";
import type { OpportunityQuoteEvent } from "@/lib/opportunityPageApi";
import { quoteEventWords, quoteStatusWords } from "./opportunityPage";

const event = (e: OpportunityQuoteEvent["event"]): OpportunityQuoteEvent => ({
  type: "quote", entryKey: "quote_request_event:1", at: "2026-11-06T10:00:00+00:00", quoteRequestId: 1, peoName: "Insperity", event: e, who: "dana@x.example", whoKind: "member",
});

// N-1.2. Break caught: an acknowledgement or a question drawn on the opportunity's activity as "Insperity's quote closed" (the sentence every unknown event fell to).
describe("a quote request's event as a sentence", () => {
  it("says what happened for each of the six events", () => {
    expect(quoteEventWords(event("sent"))).toBe("Sent to Insperity");
    expect(quoteEventWords(event("acknowledged"))).toBe("Insperity acknowledged it has the packet");
    expect(quoteEventWords(event("question_open"))).toBe("Insperity has a question open");
    expect(quoteEventWords(event("quoted"))).toBe("Insperity quoted");
    expect(quoteEventWords(event("declined"))).toBe("Insperity declined");
    expect(quoteEventWords(event("closed"))).toBe("Insperity's quote closed");
  });
});

// CRM-Q3.1: "The wait keeps counting" while a PEO has acknowledged or has a question open. Break caught: the days vanishing from the status the day a PEO replies.
describe("a quote request status with the days it has waited", () => {
  it("counts the days from the send while it is Sent, Acknowledged or has a question open, and for no other status", () => {
    expect(quoteStatusWords("sent", "Waiting", "2026-11-10", "2026-11-13")).toBe("Sent · 3 days");
    expect(quoteStatusWords("acknowledged", "Acknowledged", "2026-11-10", "2026-11-13")).toBe("Acknowledged · 3 days");
    expect(quoteStatusWords("question_open", "Question open", "2026-11-12", "2026-11-13")).toBe("Question open · 1 day");
    expect(quoteStatusWords("acknowledged", "Acknowledged", "2026-11-13", "2026-11-13")).toBe("Acknowledged · today");
    expect(quoteStatusWords("acknowledged", "Acknowledged", null, "2026-11-13")).toBe("Acknowledged");
    expect(quoteStatusWords("quoted", "Quoted", "2026-11-10", "2026-11-13")).toBe("Quoted");
    expect(quoteStatusWords("closed", "Closed", "2026-11-10", "2026-11-13")).toBe("Closed");
  });
});
