import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

type Handlers = {
  onConnect: () => void;
  onDisconnect: () => void;
  onMessage: (m: { message: string; role: "user" | "agent" }) => void;
};
let handlers: Handlers | null = null;
vi.mock("@elevenlabs/react", () => ({
  useConversation: (options: Handlers) => {
    handlers = options;
    return { status: "disconnected", isSpeaking: false, startSession: vi.fn(), endSession: vi.fn() };
  },
}));

const { useLenoreVoice } = await import("./useLenoreVoice");

const mount = () => {
  const onNewMessage = vi.fn();
  const onLastSpokenText = vi.fn();
  renderHook(() => useLenoreVoice({ onOrbStateChange: vi.fn(), onNewMessage, onLastSpokenText, onExtract: vi.fn() }));
  return { onNewMessage, onLastSpokenText };
};
const said = (message: string, role: "user" | "agent") => act(() => handlers?.onMessage({ message, role }));

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
