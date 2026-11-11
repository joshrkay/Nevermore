import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA } from "./chamberTypes";
import {
  chatAnswers,
  chatRequestBody,
  createChatMessage,
  dedupeGreetings,
  formatMessageTime,
  isGreeting,
  MAX_MESSAGE_CHARS,
  OPENING_MESSAGE,
  openingMessage,
  parseTranscript,
} from "./chat";

describe("parseTranscript", () => {
  it("returns an empty transcript for non-arrays", () => {
    expect(parseTranscript(null)).toEqual([]);
    expect(parseTranscript({ text: "hi" })).toEqual([]);
  });

  it("keeps well-formed messages and skips malformed ones", () => {
    const parsed = parseTranscript([
      { id: "1", sender: "lenore", text: "Hello", timestamp: "09:00" },
      { id: "2", sender: "robot", text: "nope" },
      { sender: "user", text: "Hi" },
      "junk",
    ]);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({ id: "1", sender: "lenore", text: "Hello", timestamp: "09:00" });
    expect(parsed[1]).toMatchObject({ sender: "user", text: "Hi", timestamp: "" });
    expect(parsed[1].id).toBeTruthy();
  });

  it("keeps the Chamber's own notes and the spoken mark, in the stored order", () => {
    const parsed = parseTranscript([
      { id: "1", sender: "system", text: "Voice call started", timestamp: "2026-11-04T14:34:00.000Z" },
      { id: "2", sender: "user", text: "twelve people", timestamp: "2026-11-04T14:34:05.000Z", spoken: true },
      { id: "3", sender: "lenore", text: "Twelve. Thank you.", timestamp: "2026-11-04T14:34:05.000Z", spoken: "yes" },
    ]);
    expect(parsed.map((m) => m.id)).toEqual(["1", "2", "3"]);
    expect(parsed[0].sender).toBe("system");
    expect(parsed[1].spoken).toBe(true);
    expect(parsed[2]).not.toHaveProperty("spoken");
  });

  it("returns only what the database accepts, so saving it back is never refused", () => {
    const [long] = parseTranscript([{ id: "x".repeat(101), sender: "user", text: "a".repeat(MAX_MESSAGE_CHARS + 5), timestamp: "9".repeat(65) }]);
    expect(long.id).not.toBe("x".repeat(101));
    expect(long.id.length).toBeLessThanOrEqual(100);
    expect(long.text).toHaveLength(MAX_MESSAGE_CHARS);
    expect(long.timestamp).toBe("");
    const [blankId] = parseTranscript([{ id: "  ", sender: "user", text: "hi" }]);
    expect(blankId.id.trim()).not.toBe("");
    // Only the fields a message has survive.
    const [extra] = parseTranscript([{ id: "1", sender: "user", text: "hi", extraction: { company_name: "Acme" } }]);
    expect(Object.keys(extra).sort()).toEqual(["id", "sender", "text", "timestamp"]);
  });
});

describe("message times", () => {
  it("stamps a new message with the full instant, not a time of day", () => {
    const m = createChatMessage("user", "hi", { now: new Date("2026-11-04T14:34:05.123Z") });
    expect(m.timestamp).toBe("2026-11-04T14:34:05.123Z");
    expect(m).not.toHaveProperty("spoken");
    expect(createChatMessage("user", "twelve", { spoken: true }).spoken).toBe(true);
  });

  it("cuts very long text without leaving half an emoji", () => {
    const text = "a".repeat(MAX_MESSAGE_CHARS - 1) + "\u{1F600}" + "tail";
    const m = createChatMessage("user", text);
    expect(m.text).toHaveLength(MAX_MESSAGE_CHARS - 1);
    expect(/[\uD800-\uDBFF]$/.test(m.text)).toBe(false);
  });

  it("shows an instant in the reader's time, with the date when asked", () => {
    const at = "2026-11-04T14:34:05.123Z";
    expect(formatMessageTime(at)).toBe(new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    expect(formatMessageTime(at, { withDate: true })).toContain("2026");
  });

  it("shows a time of day saved before the full instant was kept as it was saved", () => {
    expect(formatMessageTime("02:34 PM")).toBe("02:34 PM");
    expect(formatMessageTime("02:34 PM", { withDate: true })).toBe("02:34 PM");
    expect(formatMessageTime("")).toBe("");
    expect(formatMessageTime("2026-13-45T99:99:99Z")).toBe("2026-13-45T99:99:99Z");
  });
});

describe("sensitive numbers in the transcript", () => {
  it("never keeps a Social Security or account number in a new or stored message", () => {
    expect(createChatMessage("user", "SSN 123-45-6789").text).toBe("SSN [redacted]");
    const [m] = parseTranscript([{ id: "m1", sender: "user", text: "routing 021000021", timestamp: "" }]);
    expect(m.text).toBe("routing [redacted]");
  });
});

describe("chatAnswers", () => {
  it("is the intake without the roster, which chat never extracts and which holds personal details", () => {
    const context = chatAnswers({ ...EMPTY_CHAMBER_DATA, company_name: "Acme" });
    expect(context).not.toHaveProperty("census");
    expect(Object.keys(context)).toEqual(Object.keys(EMPTY_CHAMBER_DATA).filter((k) => k !== "census"));
    expect(context.company_name).toBe("Acme");
  });
});

describe("chatRequestBody", () => {
  const at = "2026-11-04T12:00:00Z";
  it("sends the message, the answers without the roster, each field's status and the conversation before the message", () => {
    const opening = createChatMessage("lenore", "Tell me about your business.");
    const system = createChatMessage("system", "Voice call started");
    const message = createChatMessage("user", "We are Acme");
    const body = chatRequestBody(
      message,
      { ...EMPTY_CHAMBER_DATA, company_name: "Acme" },
      { company_name: { status: "inferred", source: { kind: "transcript", message_id: "m0" }, updated_at: at }, industry: undefined },
      [opening, system, message],
    );
    expect(body.message).toBe("We are Acme");
    expect(body.context).not.toHaveProperty("census");
    expect(body.context.company_name).toBe("Acme");
    // A field with no provenance has no status to send.
    expect(body.statuses).toEqual({ company_name: "inferred" });
    // The Chamber's own lines and the message itself stay out of the conversation.
    expect(body.recent).toEqual([{ sender: "lenore", text: "Tell me about your business." }]);
  });

  it("sends no statuses when there is no provenance", () => {
    expect(chatRequestBody({ text: "Hi" }, EMPTY_CHAMBER_DATA, undefined, []).statuses).toEqual({});
  });
});

describe("greetings", () => {
  const hello = (text = "Hi, I'm Lenore.") => createChatMessage("lenore", text, { kind: "greeting" });
  const said = (text: string) => createChatMessage("user", text);
  const reply = (text: string) => createChatMessage("lenore", text);

  it("marks the opening line as a greeting", () => {
    const opening = openingMessage();
    expect(opening).toMatchObject({ sender: "lenore", text: OPENING_MESSAGE, kind: "greeting" });
    expect(isGreeting(opening)).toBe(true);
  });

  it("introduces Lenore as the intake assistant, in plain words", () => {
    expect(OPENING_MESSAGE).toMatch(/^Hi, I'm Lenore, your intake assistant\./);
    expect(OPENING_MESSAGE).not.toMatch(/Good evening|Chamber|guide through|demonstration/i);
  });

  it("keeps the first greeting and drops the rest, wherever they are", () => {
    const first = openingMessage();
    const question = said("We're Acme");
    const answer = reply("Noted.");
    expect(dedupeGreetings([first, hello(), question, hello("Welcome back!"), answer])).toEqual([first, question, answer]);
  });

  it("recognises openings saved before greetings were marked, including the old wording", () => {
    const stored = parseTranscript([
      { id: "a", sender: "lenore", text: OPENING_MESSAGE, timestamp: "" },
      { id: "b", sender: "lenore", text: OPENING_MESSAGE, timestamp: "" },
      { id: "c", sender: "user", text: "Hi", timestamp: "" },
      { id: "d", sender: "lenore", text: "Good evening. I'm Lenore — your guide through The Chamber. Before we begin, I want to be transparent: what you see in the workspace beside us is a demonstration. By the time our conversation is complete, it will hold your company's information instead. Shall we begin with something simple — tell me a little about your business and what you do.", timestamp: "" },
      { id: "e", sender: "lenore", text: "Good evening. I'm Lenore — your guide through The Chamber. As we talk, I'll fill in the workspace beside us, and you can check or correct anything there. Shall we begin with something simple — tell me a little about your business and what you do.", timestamp: "" },
    ]);
    expect(dedupeGreetings(stored).map((m) => m.id)).toEqual(["a", "c"]);
  });

  it("never treats the prospect's words or Lenore's ordinary replies as greetings", () => {
    const messages = [said(OPENING_MESSAGE), reply("Good evening."), reply("Good evening.")];
    expect(dedupeGreetings(messages)).toBe(messages);
  });

  it("keeps a greeting's mark through a save and load, and only on Lenore's messages", () => {
    const [kept, dropped] = parseTranscript([
      { id: "a", sender: "lenore", text: "Hello", timestamp: "", kind: "greeting" },
      { id: "b", sender: "user", text: "Hello", timestamp: "", kind: "greeting" },
    ]);
    expect(kept.kind).toBe("greeting");
    expect(dropped).not.toHaveProperty("kind");
  });
});

// K-1.1: what Lenore's model is sent of the answers so far never holds a whole FEIN.
describe("chatAnswers and the FEIN", () => {
  it("sends the model only the last four digits of the employer's FEIN and of each legal entity's", () => {
    const sent = chatAnswers({ ...EMPTY_CHAMBER_DATA, fein: "841234567", entities: [{ legal_name: "Acme LLC", fein: "841234568" }, { legal_name: "Acme Inc" }] });
    expect(sent.fein).toBe("**-***4567");
    expect(sent.entities).toEqual([{ legal_name: "Acme LLC", fein: "**-***4568" }, { legal_name: "Acme Inc" }]);
    expect(JSON.stringify(sent)).not.toMatch(/8412345/);
  });

  it("sends nothing for a FEIN that isn't held", () => {
    expect(chatAnswers(EMPTY_CHAMBER_DATA).fein).toBeNull();
  });
});
