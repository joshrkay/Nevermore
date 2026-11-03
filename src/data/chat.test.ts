import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA } from "./chamberTypes";
import { chatContext, createChatMessage, dedupeGreetings, isGreeting, OPENING_MESSAGE, openingMessage, parseTranscript } from "./chat";

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
});

describe("sensitive numbers in the transcript", () => {
  it("never keeps a Social Security or account number in a new or stored message", () => {
    expect(createChatMessage("user", "SSN 123-45-6789").text).toBe("SSN [redacted]");
    const [m] = parseTranscript([{ id: "m1", sender: "user", text: "routing 021000021", timestamp: "" }]);
    expect(m.text).toBe("routing [redacted]");
  });
});

describe("chatContext", () => {
  it("is the intake without the roster, which chat never extracts and which holds personal details", () => {
    const context = chatContext({ ...EMPTY_CHAMBER_DATA, company_name: "Acme" });
    expect(context).not.toHaveProperty("census");
    expect(Object.keys(context)).toEqual(Object.keys(EMPTY_CHAMBER_DATA).filter((k) => k !== "census"));
    expect(context.company_name).toBe("Acme");
  });
});

describe("greetings", () => {
  const hello = (text = "Hi, I'm Lenore.") => createChatMessage("lenore", text, "greeting");
  const said = (text: string) => createChatMessage("user", text);
  const reply = (text: string) => createChatMessage("lenore", text);

  it("marks the opening line as a greeting", () => {
    const opening = openingMessage();
    expect(opening).toMatchObject({ sender: "lenore", text: OPENING_MESSAGE, kind: "greeting" });
    expect(isGreeting(opening)).toBe(true);
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
