import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { VOICE_CONNECT_TIMEOUT_MS } from "@/data/voiceFailure";

type DisconnectDetails = { reason: "user" } | { reason: "agent" } | { reason: "error"; message?: string };
type Handlers = {
  onConnect: () => void;
  onDisconnect: (details: DisconnectDetails) => void;
  onMessage: (m: { message: string; role: "user" | "agent" }) => void;
  onError: (message: string) => void;
};
let handlers: Handlers | null = null;
let voiceStatus = "disconnected";
const endSession = vi.fn(async () => {});
// By default the session connects as soon as it is asked to, as the SDK does when everything works.
const startSession = vi.fn(async (): Promise<string> => {
  handlers?.onConnect();
  return "conversation-1";
});
vi.mock("@elevenlabs/react", () => ({
  useConversation: (options: Handlers) => {
    handlers = options;
    return { status: voiceStatus, isSpeaking: false, startSession, endSession };
  },
}));

const { useLenoreVoice } = await import("./useLenoreVoice");

beforeEach(() => {
  vi.stubEnv("VITE_ELEVENLABS_AGENT_ID", "agent-1");
  startSession.mockClear();
  endSession.mockClear();
  voiceStatus = "disconnected";
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  // jsdom has no Permissions API; a test that adds one takes it away again.
  delete (navigator as { permissions?: unknown }).permissions;
});

const mount = (epoch = 0) => {
  const onNewMessage = vi.fn();
  const onLastSpokenText = vi.fn();
  const onOrbStateChange = vi.fn();
  const hook = renderHook(({ epoch }) => useLenoreVoice({ epoch, onOrbStateChange, onNewMessage, onLastSpokenText, onExtract: vi.fn() }), {
    initialProps: { epoch },
  });
  const start = () => act(() => hook.result.current.startVoice());
  /** Starts a call whose connect hasn't answered: the act ends at once, so the "connecting" state shows. */
  const begin = async () => {
    let call: Promise<void> = Promise.resolve();
    await act(async () => {
      call = hook.result.current.startVoice();
    });
    // Wrapped, or awaiting begin() would wait for the call itself.
    return { call };
  };
  return { ...hook, onNewMessage, onLastSpokenText, onOrbStateChange, start, begin };
};
const said = (message: string, role: "user" | "agent") => act(() => handlers?.onMessage({ message, role }));
const disconnect = (details: DisconnectDetails) => act(() => handlers?.onDisconnect(details));
/** A start that hasn't answered yet: resolve it, or reject it, when the test says. */
const pendingStart = () => {
  let settle: { resolve: (id: string) => void; reject: (e: unknown) => void } = { resolve: () => {}, reject: () => {} };
  startSession.mockImplementationOnce(() => new Promise<string>((resolve, reject) => (settle = { resolve, reject })));
  return () => settle;
};

describe("useLenoreVoice greetings", () => {
  it("marks the agent's opening line in each voice session as a greeting", async () => {
    const { onNewMessage, onLastSpokenText, start } = mount();
    await start();
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

    disconnect({ reason: "user" });
    await start();
    said("Welcome back.", "agent");
    expect(onNewMessage.mock.calls.at(-1)?.[0]).toMatchObject({ text: "Welcome back.", kind: "greeting" });
  });

  it("doesn't call a reply a greeting when the prospect spoke first (an agent with no opening line)", async () => {
    const { onNewMessage, start } = mount();
    await start();
    said("Hi, we're Acme.", "user");
    said("Thank you.", "agent");
    expect(onNewMessage.mock.calls.at(-1)?.[0].kind).toBeUndefined();
  });
});

describe("useLenoreVoice when the conversation is replaced", () => {
  it("ends the open voice session, and keeps nothing it still says, without calling it a dropped call", async () => {
    const { onNewMessage, start, rerender, result } = mount(0);
    await start();
    voiceStatus = "connected";
    said("Hello.", "agent");
    expect(onNewMessage).toHaveBeenCalledTimes(1);

    rerender({ epoch: 1 });
    expect(endSession).toHaveBeenCalledTimes(1);
    said("We're Acme.", "user");
    said("Noted.", "agent");
    expect(onNewMessage).toHaveBeenCalledTimes(1);
    voiceStatus = "disconnected";
    disconnect({ reason: "error" });
    expect(result.current.failure).toBeNull();

    // A session opened in the new conversation is heard again.
    await start();
    said("Hello again.", "agent");
    expect(onNewMessage).toHaveBeenCalledTimes(2);
  });
});

// US-2.3c: voice is offered only when configured, never connects for longer than 15 seconds, and every failure says
// what happened (VoiceOrb shows it with "Continue in text").
describe("useLenoreVoice without a voice agent", () => {
  it("offers no voice, and starting one does nothing", async () => {
    vi.stubEnv("VITE_ELEVENLABS_AGENT_ID", "");
    const { result, start } = mount();
    expect(result.current.voiceAvailable).toBe(false);
    await start();
    expect(startSession).not.toHaveBeenCalled();
    expect(result.current.failure).toBeNull();
  });
});

describe("useLenoreVoice connecting", () => {
  it("starts nothing on a second click while connecting", async () => {
    const settle = pendingStart();
    const { result, begin } = mount();
    expect(result.current.voiceAvailable).toBe(true);
    await begin();
    expect(result.current.isConnecting).toBe(true);
    await begin();
    expect(startSession).toHaveBeenCalledTimes(1);
    expect(endSession).not.toHaveBeenCalled();

    await act(async () => {
      handlers?.onConnect();
      settle().resolve("conversation-1");
    });
    expect(result.current).toMatchObject({ isConnecting: false, isConnected: true, failure: null });
  });

  it("gives up after 15 seconds, says so, and ends a session that answers late", async () => {
    vi.useFakeTimers();
    pendingStart();
    const { result, begin, onOrbStateChange } = mount();
    await begin();
    expect(onOrbStateChange).toHaveBeenLastCalledWith("thinking");

    await act(async () => vi.advanceTimersByTime(VOICE_CONNECT_TIMEOUT_MS - 1));
    expect(result.current.isConnecting).toBe(true);
    expect(result.current.failure).toBeNull();

    await act(async () => vi.advanceTimersByTime(1));
    expect(result.current).toMatchObject({ isConnecting: false, isConnected: false, failure: "timeout" });
    expect(onOrbStateChange).toHaveBeenLastCalledWith("idle");
    expect(endSession).toHaveBeenCalledTimes(1);

    // The connection finally opens: it is ended, not taken for a call, and its disconnect isn't a dropped call.
    act(() => handlers?.onConnect());
    expect(endSession).toHaveBeenCalledTimes(2);
    expect(result.current.isConnected).toBe(false);
    disconnect({ reason: "user" });
    expect(result.current.failure).toBe("timeout");
  });

  it("tells a blocked microphone from the Permissions API, without asking the SDK to connect", async () => {
    Object.defineProperty(navigator, "permissions", { value: { query: vi.fn(async () => ({ state: "denied" })) }, configurable: true });
    const { result, start, onOrbStateChange } = mount();
    await start();
    expect(startSession).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ isConnecting: false, failure: "mic_denied" });
    expect(onOrbStateChange).toHaveBeenLastCalledWith("idle");
  });

  it.each([
    [new DOMException("Permission denied", "NotAllowedError"), "mic_denied"],
    [new DOMException("Requested device not found", "NotFoundError"), "mic_unavailable"],
    [new DOMException("Could not start audio source", "NotReadableError"), "mic_unavailable"],
    [new Error("WebSocket closed: 1006"), "connect_failed"],
  ] as const)("names the failure when starting throws %s", async (error, kind) => {
    startSession.mockImplementationOnce(async () => {
      throw error;
    });
    const { result, start } = mount();
    await start();
    expect(result.current).toMatchObject({ isConnecting: false, isConnected: false, failure: kind });
  });

  it("keeps the microphone as the reason when the socket's close is reported first", async () => {
    const settle = pendingStart();
    const { result, begin } = mount();
    const { call } = await begin();
    disconnect({ reason: "error", message: "closed" });
    expect(result.current.failure).toBe("connect_failed");
    await act(async () => {
      settle().reject(new DOMException("Permission denied", "NotAllowedError"));
      await call;
    });
    expect(result.current.failure).toBe("mic_denied");
  });

  it("calls a connection that closes before it opens a failed connection", async () => {
    pendingStart();
    const { result, begin } = mount();
    await begin();
    act(() => handlers?.onError("handshake failed"));
    disconnect({ reason: "error", message: "handshake failed" });
    expect(result.current).toMatchObject({ isConnecting: false, failure: "connect_failed" });
  });
});

describe("useLenoreVoice during a call", () => {
  it("calls a call that ends on an error a dropped call", async () => {
    const { result, start, onOrbStateChange } = mount();
    await start();
    expect(result.current.isConnected).toBe(true);
    // An error the call survives changes nothing.
    act(() => handlers?.onError("a client tool failed"));
    expect(result.current).toMatchObject({ isConnected: true, failure: null });
    disconnect({ reason: "error", message: "socket closed" });
    expect(result.current).toMatchObject({ isConnected: false, failure: "dropped" });
    expect(onOrbStateChange).toHaveBeenLastCalledWith("idle");
  });

  it.each([
    ["the prospect", { reason: "user" } as const],
    ["Lenore", { reason: "agent" } as const],
  ])("doesn't call a call that %s ended a failure", async (_who, details) => {
    const { result, start } = mount();
    await start();
    disconnect(details);
    expect(result.current).toMatchObject({ isConnected: false, failure: null });
  });

  it("ends the call when the prospect clicks again, and doesn't call its close a dropped call", async () => {
    const { result, start } = mount();
    await start();
    voiceStatus = "connected";
    await start();
    expect(endSession).toHaveBeenCalledTimes(1);
    // However the SDK reports the close it was asked for.
    disconnect({ reason: "error", message: "closed" });
    expect(result.current.failure).toBeNull();
  });

  it("puts a failure away when dismissed, or when the prospect calls again", async () => {
    const { result, start, begin } = mount();
    await start();
    disconnect({ reason: "error" });
    expect(result.current.failure).toBe("dropped");
    act(() => result.current.dismissFailure());
    expect(result.current.failure).toBeNull();

    await start();
    disconnect({ reason: "error" });
    expect(result.current.failure).toBe("dropped");
    pendingStart();
    await begin();
    expect(result.current).toMatchObject({ isConnecting: true, failure: null });
  });
});
