import { describe, expect, it } from "vitest";
import { daysWaiting, quoteIsExpired, quoteRowStatusWords } from "./quotes";

describe("the quotes table's words", () => {
  // Catches: the days of a wait counted on a quote that is back or closed, or from the wrong day (the database counts open requests from the day sent).
  it("counts the days of an open request from the day it was sent, and none for any other", () => {
    expect(daysWaiting({ status: "sent", sent_on: "2026-11-10" }, "2026-11-16")).toBe(6);
    expect(daysWaiting({ status: "question_open", sent_on: "2026-11-16" }, "2026-11-16")).toBe(0);
    expect(daysWaiting({ status: "quoted", sent_on: "2026-11-10" }, "2026-11-16")).toBeNull();
    expect(daysWaiting({ status: "not_sent", sent_on: null }, "2026-11-16")).toBeNull();
  });

  // Catches: a quote that expires today read as expired (it is good through its last day).
  it("reads a quote as expired the day after its expiry, and only a quote that is back", () => {
    expect(quoteIsExpired({ status: "quoted", expires_on: "2026-11-15" }, "2026-11-16")).toBe(true);
    expect(quoteIsExpired({ status: "quoted", expires_on: "2026-11-16" }, "2026-11-16")).toBe(false);
    expect(quoteIsExpired({ status: "declined", expires_on: "2020-01-01" }, "2026-11-16")).toBe(false);
  });

  it("words a status, and a half-done quote as Not sent yet", () => {
    expect(quoteRowStatusWords("not_sent")).toBe("Not sent yet");
    expect(quoteRowStatusWords("question_open")).toBe("Question open");
  });
});
