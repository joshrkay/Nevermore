import { describe, expect, it } from "vitest";
import {
  addressesOf, attachmentDecision, bodyText, htmlToText, isAutomatic, keptHeaders, MAX_BODY_CHARS, parseAddress, parseReceivedEmail,
  parseReceivedEvent, replyLocalParts,
} from "./inbound";

describe("reading an address", () => {
  it("takes a bare address and a named one, in lower case", () => {
    expect(parseAddress("Dana@Trinet.Example")).toEqual({ address: "dana@trinet.example", name: null });
    expect(parseAddress('"Dana Whitfield" <Dana@Trinet.Example>')).toEqual({ address: "dana@trinet.example", name: "Dana Whitfield" });
    expect(parseAddress("Dana Whitfield <dana@trinet.example>")).toEqual({ address: "dana@trinet.example", name: "Dana Whitfield" });
    expect(parseAddress("<dana@trinet.example>")).toEqual({ address: "dana@trinet.example", name: null });
  });

  it("refuses what isn't an address", () => {
    for (const bad of ["", "dana", "dana@", "@trinet.example", "dana@trinet", "a b@c.example", "Dana <not an address>"]) {
      expect(parseAddress(bad), bad).toBeNull();
    }
  });

  it("lists addresses once each and drops the rest", () => {
    expect(addressesOf(["Dana <dana@x.example>", "dana@x.example", "junk", "priya@x.example"])).toEqual(["dana@x.example", "priya@x.example"]);
  });
});

describe("the reply addresses a message was sent to", () => {
  const domain = "quotes.nevermorepeo.com";

  it("takes the part before the @ of each address on our domain, in lower case, once", () => {
    expect(
      replyLocalParts(
        ["EAA-2026-0042.TriNet.0123456789abcdef@quotes.nevermorepeo.com", "Support <help@example.com>", "eaa-2026-0042.trinet.0123456789abcdef@QUOTES.nevermorepeo.com"],
        domain,
      ),
    ).toEqual(["eaa-2026-0042.trinet.0123456789abcdef"]);
  });

  it("leaves out another domain and a subdomain of ours", () => {
    expect(replyLocalParts(["a.b.c@nevermorepeo.com", "a.b.c@x.quotes.nevermorepeo.com", "a.b.c@quotes.nevermorepeo.com.evil.example"], domain)).toEqual([]);
  });

  it("finds two reply addresses when a message was sent to two", () => {
    expect(replyLocalParts(["a.b.c@quotes.nevermorepeo.com", "d.e.f@quotes.nevermorepeo.com"], domain)).toEqual(["a.b.c", "d.e.f"]);
  });
});

describe("the webhook for a received email", () => {
  const event = (over: Record<string, unknown> = {}) => ({
    type: "email.received",
    created_at: "2026-11-10T15:42:00.000Z",
    data: {
      email_id: "re_abc", created_at: "2026-11-10T15:41:58.000Z", from: "Priya <priya@trinet.example>", to: ["a.b.c@quotes.nevermorepeo.com"],
      cc: [], bcc: [], received_for: ["a.b.c@quotes.nevermorepeo.com"], message_id: "<m@x>", subject: "Re: Harbor Street",
      attachments: [{ id: "att_1", filename: "p.pdf", content_type: "application/pdf" }],
      ...over,
    },
  });

  it("is read into what the function needs", () => {
    expect(parseReceivedEvent(event())).toEqual({
      kind: "event",
      event: {
        emailId: "re_abc", from: "Priya <priya@trinet.example>", to: ["a.b.c@quotes.nevermorepeo.com"], cc: [], bcc: [],
        receivedFor: ["a.b.c@quotes.nevermorepeo.com"], subject: "Re: Harbor Street", createdAt: "2026-11-10T15:41:58.000Z", attachmentCount: 1,
      },
    });
  });

  it("ignores any other event, which the delivery-event function handles", () => {
    expect(parseReceivedEvent({ type: "email.bounced", data: {} })).toEqual({ kind: "ignore" });
    expect(parseReceivedEvent(null)).toEqual({ kind: "ignore" });
    expect(parseReceivedEvent("x")).toEqual({ kind: "ignore" });
  });

  it("is unusable without an id or a sender", () => {
    expect(parseReceivedEvent(event({ email_id: "" }))).toEqual({ kind: "unusable", reason: "no_email_id" });
    expect(parseReceivedEvent(event({ from: undefined }))).toEqual({ kind: "unusable", reason: "no_sender" });
    expect(parseReceivedEvent({ type: "email.received" })).toEqual({ kind: "unusable", reason: "no_data" });
  });

  it("takes only strings in its address lists, and no time that isn't one", () => {
    const parsed = parseReceivedEvent(event({ to: ["a@b.example", 7, null], created_at: "never" }));
    expect(parsed.kind === "event" && parsed.event.to).toEqual(["a@b.example"]);
    expect(parsed.kind === "event" && parsed.event.createdAt).toBeNull();
  });
});

describe("a message's text", () => {
  it("is its text part, never its HTML", () => {
    expect(bodyText({ text: "  Hello there  ", html: "<p>Different</p>", headers: {} })).toEqual({ text: "Hello there", truncated: false });
  });

  it("is its HTML as plain text when it has no text part", () => {
    expect(bodyText({ text: null, html: "<p>One &amp; two</p><p>Three</p>", headers: {} }).text).toBe("One & two\nThree");
    expect(bodyText({ text: "  ", html: "<div>Only html</div>", headers: {} }).text).toBe("Only html");
  });

  it("is cut to what the database takes, and says so", () => {
    const long = "x".repeat(MAX_BODY_CHARS + 5);
    const body = bodyText({ text: long, html: null, headers: {} });
    expect(body.truncated).toBe(true);
    expect(body.text).toHaveLength(MAX_BODY_CHARS);
    expect(bodyText({ text: "x".repeat(MAX_BODY_CHARS), html: null, headers: {} }).truncated).toBe(false);
  });

  it("drops a null byte the database can't hold", () => {
    expect(bodyText({ text: "a\0b", html: null, headers: {} }).text).toBe("ab");
  });

  it("turns HTML to text without keeping a script, a style or a tag", () => {
    expect(htmlToText('<style>p{color:red}</style><p>Hi <b>Dana</b></p><script>alert(1)</script><br>Bye')).toBe("Hi Dana\n\nBye");
    expect(htmlToText("a&nbsp;b &lt;c&gt; &#65;&#x42; &unknown;")).toBe("a b <c> AB &unknown;");
    expect(htmlToText("&#99999999999;")).toBe("");
  });
});

describe("reading the provider's message", () => {
  it("lower-cases header names and keeps only strings", () => {
    expect(parseReceivedEmail({ text: "t", html: null, headers: { "Message-ID": "<a@b>", "X-Num": 5 } })).toEqual({
      text: "t", html: null, headers: { "message-id": "<a@b>" },
    });
  });

  it("is nothing for what isn't a message", () => {
    expect(parseReceivedEmail(null)).toBeNull();
    expect(parseReceivedEmail("x")).toBeNull();
    expect(parseReceivedEmail({})).toEqual({ text: null, html: null, headers: {} });
  });

  it("keeps the headers that thread a message, and no others", () => {
    expect(keptHeaders({ "message-id": "<a@b>", "in-reply-to": "<c@d>", received: "from x", "x-spam-score": "9", precedence: "bulk" })).toEqual({
      "message-id": "<a@b>", "in-reply-to": "<c@d>", precedence: "bulk",
    });
  });
});

describe("whether a machine wrote a message", () => {
  const from = "dana@trinet.example";

  it("knows an out-of-office reply by Auto-Submitted", () => {
    expect(isAutomatic({ "auto-submitted": "auto-replied" }, from)).toBe(true);
    expect(isAutomatic({ "auto-submitted": "auto-generated" }, from)).toBe(true);
    expect(isAutomatic({ "auto-submitted": "no" }, from)).toBe(false);
  });

  it("knows a bulk or list message, and the autoreply headers", () => {
    for (const p of ["bulk", "junk", "list", "Auto_Reply"]) expect(isAutomatic({ precedence: p }, from), p).toBe(true);
    expect(isAutomatic({ precedence: "normal" }, from)).toBe(false);
    expect(isAutomatic({ "x-autoreply": "yes" }, from)).toBe(true);
    expect(isAutomatic({ "x-autorespond": "yes" }, from)).toBe(true);
  });

  it("knows a delivery failure by its sender", () => {
    expect(isAutomatic({}, "mailer-daemon@trinet.example")).toBe(true);
    expect(isAutomatic({}, "Postmaster@trinet.example")).toBe(true);
    expect(isAutomatic({}, from)).toBe(false);
  });
});

describe("which attachments are worth downloading", () => {
  const MB = 1024 * 1024;

  it("takes the types uploads take, up to 20 MB", () => {
    expect(attachmentDecision({ name: "proposal.pdf", size: 400_000 })).toEqual({ keep: true });
    expect(attachmentDecision({ name: "census.XLSX", size: 20 * MB })).toEqual({ keep: true });
  });

  it("lists a file over 20 MB as too large, before downloading it", () => {
    expect(attachmentDecision({ name: "proposal.pdf", size: 20 * MB + 1 })).toEqual({ keep: false, reason: "too_large" });
  });

  it("lists another type of file as not accepted", () => {
    for (const name of ["rate-model.xlsm", "photo.png", "archive.zip", "run.exe", "noextension"]) {
      expect(attachmentDecision({ name, size: 10 }), name).toEqual({ keep: false, reason: "unsupported_type" });
    }
  });
});
