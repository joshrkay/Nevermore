import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ChatMessage } from "@/data/chat";

type Handlers = {
  onConnect: () => void;
  onDisconnect: () => void;
  onMessage: (m: { message: string; role: "user" | "agent" }) => void;
};
// A stand-in for the ElevenLabs conversation: the hook's callbacks, and what it sends back to the agent.
let handlers: Handlers | null = null;
let voiceStatus = "disconnected";
const endSession = vi.fn(async () => {});
const sendContextualUpdate = vi.fn();
vi.mock("@elevenlabs/react", () => ({
  useConversation: (options: Handlers) => {
    handlers = options;
    return { status: voiceStatus, isSpeaking: false, startSession: vi.fn(), endSession, sendContextualUpdate };
  },
}));

const { useLenoreVoice } = await import("./useLenoreVoice");

type Props = { epoch?: unknown; context?: string; onSpokenMessage?: (m: ChatMessage) => Promise<unknown> | void };
const mount = (initial: Props = {}) => {
  const onNewMessage = vi.fn();
  const onLastSpokenText = vi.fn();
  // By default an extraction never settles, so a test that isn't about the update sent after one has none arrive late.
  const onSpokenMessage = vi.fn(initial.onSpokenMessage ?? (() => new Promise<void>(() => {})));
  const hook = renderHook(
    ({ epoch, context }: Props) =>
      useLenoreVoice({ epoch, context: context ?? "update 1", onOrbStateChange: vi.fn(), onNewMessage, onLastSpokenText, onSpokenMessage }),
    { initialProps: { epoch: initial.epoch ?? 0, context: initial.context } },
  );
  return { ...hook, onNewMessage, onLastSpokenText, onSpokenMessage };
};
const said = (message: string, role: "user" | "agent") => act(() => handlers?.onMessage({ message, role }));
// Lets a spoken message's extraction settle, and the update that follows it go.
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  voiceStatus = "disconnected";
  endSession.mockClear();
  sendContextualUpdate.mockReset();
});

describe("useLenoreVoice greetings", () => {
  it("marks the agent's opening line in each voice session as a greeting", () => {
    const { onNewMessage, onLastSpokenText } = mount();
    act(() => handlers?.onConnect());
    said("Hello, I'm Lenore.", "agent");
    said("We're Acme.", "user");
    said("Noted.", "agent");
    expect(onNewMessage.mock.calls.map(([m]) => [m.sender, m.text, m.kind])).toEqual([
      ["lenore", "Hello, I'm Lenore.", "greeting"],
      ["user", "We're Acme.", undefined],
      ["lenore", "Noted.", undefined],
    ]);
    // The orb still shows what she said, kept in the transcript or not.
    expect(onLastSpokenText).toHaveBeenCalledWith("Hello, I'm Lenore.");

    act(() => handlers?.onDisconnect());
    act(() => handlers?.onConnect());
    said("Welcome back.", "agent");
    expect(onNewMessage.mock.calls.at(-1)?.[0]).toMatchObject({ text: "Welcome back.", kind: "greeting" });
  });

  it("doesn't call a reply a greeting when the prospect spoke first (an agent with no opening line)", () => {
    const { onNewMessage } = mount();
    act(() => handlers?.onConnect());
    said("Hi, we're Acme.", "user");
    said("Thank you.", "agent");
    expect(onNewMessage.mock.calls.at(-1)?.[0].kind).toBeUndefined();
  });
});

describe("useLenoreVoice: what the prospect says goes through extraction (US-2.3b)", () => {
  it("records each finished thing the prospect says as a spoken message, then hands that same message on for its answers", () => {
    const { onNewMessage, onSpokenMessage } = mount();
    act(() => handlers?.onConnect());
    said("We're Acme, about forty people.", "user");
    const recorded = onNewMessage.mock.calls[0][0] as ChatMessage;
    expect(recorded).toMatchObject({ sender: "user", text: "We're Acme, about forty people.", spoken: true });
    expect(onSpokenMessage).toHaveBeenCalledTimes(1);
    expect(onSpokenMessage).toHaveBeenCalledWith(recorded);
  });

  it("hands on only the prospect's words, never Lenore's", () => {
    const { onSpokenMessage } = mount();
    act(() => handlers?.onConnect());
    said("Hello, I'm Lenore.", "agent");
    said("How many people work for you?", "agent");
    expect(onSpokenMessage).not.toHaveBeenCalled();
  });

  it("removes the prospect's Social Security number before the message is kept or handed on", () => {
    const { onSpokenMessage } = mount();
    act(() => handlers?.onConnect());
    said("My SSN is 123-45-6789", "user");
    expect(onSpokenMessage.mock.calls[0][0].text).toBe("My SSN is [redacted]");
  });

  it("ignores an <extract> tag in Lenore's reply: nothing is extracted from it, and it never reaches the transcript", () => {
    const { onNewMessage, onLastSpokenText, onSpokenMessage } = mount();
    act(() => handlers?.onConnect());
    said('Noted. <extract>{"employee_count": 40, "field_status": {"employee_count": "confirmed"}}</extract>', "agent");
    expect(onSpokenMessage).not.toHaveBeenCalled();
    expect(onNewMessage.mock.calls.map(([m]) => m.text)).toEqual(["Noted."]);
    expect(onLastSpokenText).toHaveBeenLastCalledWith("Noted.");
    // A reply that is only a tag, or one left unclosed, adds nothing to the transcript.
    said('<extract>{"company_name": "Acme"}</extract>', "agent");
    said('And how often do you run payroll? <extract>{"pay_frequency": "weekly"', "agent");
    expect(onNewMessage.mock.calls.map(([m]) => m.text)).toEqual(["Noted.", "And how often do you run payroll?"]);
    expect(onSpokenMessage).not.toHaveBeenCalled();
  });
});

describe("useLenoreVoice: telling Lenore's voice what is still open (D24)", () => {
  it("sends the intake update when the call connects, and nothing before", () => {
    mount({ context: "Ask about next: Company legal name" });
    expect(sendContextualUpdate).not.toHaveBeenCalled();
    act(() => handlers?.onConnect());
    expect(sendContextualUpdate.mock.calls).toEqual([["Ask about next: Company legal name"]]);
  });

  it("sends it again after every spoken message has been through extraction, changed or not", async () => {
    const { rerender } = mount({ context: "u1", onSpokenMessage: async () => {} });
    act(() => handlers?.onConnect());
    said("We're Acme.", "user");
    // The answers it brought change the update: it goes once, not twice.
    rerender({ epoch: 0, context: "u2" });
    await settle();
    expect(sendContextualUpdate.mock.calls.map(([t]) => t)).toEqual(["u1", "u2"]);
    // Nothing new captured: Lenore still hears, after the message, what is open.
    said("Hmm, let me think.", "user");
    await settle();
    expect(sendContextualUpdate.mock.calls.map(([t]) => t)).toEqual(["u1", "u2", "u2"]);
  });

  it("sends one update, not two, when the answers a message brought land as its extraction settles", async () => {
    let done!: () => void;
    const { rerender } = mount({ context: "u1", onSpokenMessage: () => new Promise<void>((r) => { done = r; }) });
    act(() => handlers?.onConnect());
    said("We're Acme.", "user");
    await act(async () => {
      done();
      await Promise.resolve();
      await Promise.resolve();
      rerender({ epoch: 0, context: "u2" });
    });
    expect(sendContextualUpdate.mock.calls.map(([t]) => t)).toEqual(["u1", "u2"]);
  });

  it("sends it after an extraction that failed too, so Lenore knows nothing was taken from it", async () => {
    const { onSpokenMessage } = mount({ context: "u1", onSpokenMessage: async () => { throw new Error("rate limited"); } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    act(() => handlers?.onConnect());
    said("We're Acme.", "user");
    await settle();
    expect(onSpokenMessage).toHaveBeenCalledTimes(1);
    expect(sendContextualUpdate.mock.calls.map(([t]) => t)).toEqual(["u1", "u1"]);
  });

  it("waits for a message's extraction before sending the update that follows it", async () => {
    let done!: () => void;
    mount({ context: "u1", onSpokenMessage: () => new Promise<void>((r) => { done = r; }) });
    act(() => handlers?.onConnect());
    said("We're Acme.", "user");
    await settle();
    expect(sendContextualUpdate).toHaveBeenCalledTimes(1);
    await act(async () => { done(); });
    await settle();
    expect(sendContextualUpdate).toHaveBeenCalledTimes(2);
  });

  it("sends a change made outside the call (a typed answer, an edit in Review) while the call is open, and nothing once it ends", () => {
    const { rerender } = mount({ context: "u1" });
    act(() => handlers?.onConnect());
    rerender({ epoch: 0, context: "u2" });
    rerender({ epoch: 0, context: "u2" });
    expect(sendContextualUpdate.mock.calls.map(([t]) => t)).toEqual(["u1", "u2"]);
    act(() => handlers?.onDisconnect());
    rerender({ epoch: 0, context: "u3" });
    expect(sendContextualUpdate).toHaveBeenCalledTimes(2);
    // A new call starts from the update as it now stands.
    act(() => handlers?.onConnect());
    expect(sendContextualUpdate.mock.calls.at(-1)).toEqual(["u3"]);
  });

  it("keeps the call going when an update can't be sent, and tries again with the next one", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    sendContextualUpdate.mockImplementationOnce(() => { throw new Error("socket closing"); });
    const { rerender } = mount({ context: "u1" });
    act(() => handlers?.onConnect());
    rerender({ epoch: 0, context: "u2" });
    expect(sendContextualUpdate.mock.calls.map(([t]) => t)).toEqual(["u1", "u2"]);
  });
});

describe("useLenoreVoice when the conversation is replaced", () => {
  it("ends the open voice session, and keeps nothing it still says", () => {
    voiceStatus = "connected";
    const { rerender, onNewMessage, onSpokenMessage } = mount();
    act(() => handlers?.onConnect());
    said("Hello.", "agent");
    expect(onNewMessage).toHaveBeenCalledTimes(1);

    rerender({ epoch: 1 });
    expect(endSession).toHaveBeenCalledTimes(1);
    said("We're Acme.", "user");
    said("Noted.", "agent");
    expect(onNewMessage).toHaveBeenCalledTimes(1);
    expect(onSpokenMessage).not.toHaveBeenCalled();

    // A session opened in the new conversation is heard again.
    act(() => handlers?.onConnect());
    said("Hello again.", "agent");
    expect(onNewMessage).toHaveBeenCalledTimes(2);
  });

  it("sends no update for a message from the old conversation whose extraction settles after it was replaced", async () => {
    let done!: () => void;
    const { rerender } = mount({ context: "u1", onSpokenMessage: () => new Promise<void>((r) => { done = r; }) });
    act(() => handlers?.onConnect());
    said("We're Acme.", "user");
    rerender({ epoch: 1, context: "u1" });
    await act(async () => { done(); });
    await settle();
    expect(sendContextualUpdate.mock.calls.map(([t]) => t)).toEqual(["u1"]);
  });
});
