import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { DisconnectionDetails } from "@elevenlabs/react";

// What the hook hands the voice service for one attempt: its callbacks, bound to that attempt.
type Session = {
  onConnect: (p: { conversationId: string }) => void;
  onDisconnect: (d: DisconnectionDetails) => void;
  onMessage: (m: { message: string; role: "user" | "agent" }) => void;
  onModeChange: (m: { mode: "speaking" | "listening" }) => void;
  onError: (message: string) => void;
};
const sessions: Session[] = [];
const session = () => sessions[sessions.length - 1];
let voiceStatus = "disconnected";
const startSession = vi.fn(async (options: Session) => {
  sessions.push(options);
  return "conversation-1";
});
const endSession = vi.fn(async () => {});
const sendContextualUpdate = vi.fn();
vi.mock("@elevenlabs/react", () => ({
  useConversation: () => ({ status: voiceStatus, isSpeaking: false, startSession, endSession }),
}));

const reportOpsEvent = vi.fn();
vi.mock("@/lib/monitoring", async (original) => ({ ...(await original<typeof import("@/lib/monitoring")>()), reportOpsEvent }));

// The microphone the browser gives.
const stopTrack = vi.fn();
const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] }));
const setMicrophone = (media: unknown) => Object.defineProperty(navigator, "mediaDevices", { value: media, configurable: true });

vi.stubEnv("VITE_ELEVENLABS_AGENT_ID", "agent_test");
const { useLenoreVoice } = await import("./useLenoreVoice");
const { VOICE_CONNECT_TIMEOUT_MS } = await import("@/data/voiceSession");

type Props = { epoch?: unknown; context?: string; onSpokenMessage?: (m: ChatMessage) => Promise<unknown> | void };
const mount = (initial: Props = {}) => {
  const onNewMessage = vi.fn();
  const onLastSpokenText = vi.fn();
  const hook = renderHook(
    ({ epoch }) => useLenoreVoice({ epoch, intakeId: "intake-1", onNewMessage, onLastSpokenText, onExtract: vi.fn() }),
    { initialProps: { epoch: 0 } },
  );
  return { hook, onNewMessage, onLastSpokenText, voice: () => hook.result.current.voice };
};
type Mounted = ReturnType<typeof mount>;

const start = (m: Mounted) => act(async () => { await m.hook.result.current.startVoice(); });
const connect = async (m: Mounted) => {
  await start(m);
  act(() => session().onConnect({ conversationId: "conversation-1" }));
};
const said = (message: string, role: "user" | "agent") => act(() => session().onMessage({ message, role }));
const voiceReports = () => reportOpsEvent.mock.calls.filter(([kind]) => kind === "voice_failed").map(([, report]) => report);

beforeEach(() => {
  sessions.length = 0;
  voiceStatus = "disconnected";
  startSession.mockClear();
  startSession.mockImplementation(async (options: Session) => {
    sessions.push(options);
    return "conversation-1";
  });
  endSession.mockClear();
  reportOpsEvent.mockClear();
  getUserMedia.mockClear();
  getUserMedia.mockImplementation(async () => ({ getTracks: () => [{ stop: stopTrack }] }));
  stopTrack.mockClear();
  setMicrophone({ getUserMedia });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useLenoreVoice starting a call", () => {
  it("asks for the microphone first, releases it, then connects; the call is active once the service connects", async () => {
    const m = mount();
    await start(m);
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(stopTrack).toHaveBeenCalled();
    expect(startSession).toHaveBeenCalledWith(expect.objectContaining({ agentId: "agent_test", connectionType: "websocket" }));
    expect(m.voice()).toEqual({ status: "connecting", attempt: 1, phase: "server" });
    expect(m.hook.result.current.isConnected).toBe(false);

    act(() => session().onConnect({ conversationId: "conversation-1" }));
    expect(m.voice()).toEqual({ status: "active", attempt: 1, speaking: false });
    expect(m.hook.result.current.isConnected).toBe(true);

    act(() => session().onModeChange({ mode: "speaking" }));
    expect(m.voice()).toMatchObject({ status: "active", speaking: true });
  });

  it("starts nothing on a second click while connecting", async () => {
    let release!: () => void;
    getUserMedia.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ getTracks: () => [] }); }));
    const m = mount();
    let first!: Promise<void>;
    act(() => { first = m.hook.result.current.startVoice(); });
    expect(m.voice()).toEqual({ status: "connecting", attempt: 1, phase: "microphone" });
    await act(async () => { await m.hook.result.current.startVoice(); });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    await act(async () => { release(); await first; });
    expect(startSession).toHaveBeenCalledTimes(1);
    expect(m.voice()).toMatchObject({ status: "connecting", attempt: 1, phase: "server" });
  });

  it("connects nothing when the prospect cancels while the browser asks for the microphone", async () => {
    let release!: () => void;
    getUserMedia.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ getTracks: () => [{ stop: stopTrack }] }); }));
    const m = mount();
    let pending!: Promise<void>;
    act(() => { pending = m.hook.result.current.startVoice(); });
    act(() => m.hook.result.current.endVoice());
    expect(m.voice()).toEqual({ status: "idle", attempt: 1 });
    await act(async () => { release(); await pending; });
    expect(stopTrack).toHaveBeenCalled();
    expect(startSession).not.toHaveBeenCalled();
    expect(m.voice()).toEqual({ status: "idle", attempt: 1 });
  });
});

describe("useLenoreVoice leaving the Chamber", () => {
  it("connects nothing when the microphone prompt is answered after the page has gone", async () => {
    let release!: () => void;
    getUserMedia.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ getTracks: () => [{ stop: stopTrack }] }); }));
    const m = mount();
    let pending!: Promise<void>;
    act(() => { pending = m.hook.result.current.startVoice(); });
    m.hook.unmount();
    await act(async () => { release(); await pending; });
    expect(stopTrack).toHaveBeenCalled();
    expect(startSession).not.toHaveBeenCalled();
  });
});

describe("useLenoreVoice failures", () => {
  it.each([
    ["NotAllowedError", "mic_denied"],
    ["NotFoundError", "mic_unavailable"],
    ["NotReadableError", "mic_unavailable"],
    ["NotSupportedError", "unsupported"],
    ["SomethingNewError", "mic_unavailable"],
  ])("fails a microphone the browser refuses with %s as %s, connects nothing and reports nothing", async (name, failure) => {
    getUserMedia.mockRejectedValueOnce(new DOMException("refused", name));
    const m = mount();
    await start(m);
    expect(m.voice()).toEqual({ status: "failed", attempt: 1, failure });
    expect(startSession).not.toHaveBeenCalled();
    expect(voiceReports()).toEqual([]);
  });

  it("fails as unsupported in a browser with no microphone API", async () => {
    setMicrophone(undefined);
    const m = mount();
    await start(m);
    expect(m.voice()).toEqual({ status: "failed", attempt: 1, failure: "unsupported" });
    expect(startSession).not.toHaveBeenCalled();
  });

  it("fails a refused connection, and reports it against the intake", async () => {
    startSession.mockRejectedValueOnce(new Error("Handshake refused"));
    const m = mount();
    await start(m);
    expect(m.voice()).toEqual({ status: "failed", attempt: 1, failure: "connect_failed" });
    expect(voiceReports()).toEqual([{ code: "voice_connect_failed", detail: "Error: Handshake refused", sessionId: "intake-1" }]);
  });

  it("gives up after 15 seconds of connecting, abandons the connection, and ignores it if it opens later", async () => {
    vi.useFakeTimers();
    startSession.mockImplementationOnce((options: Session) => {
      sessions.push(options);
      return new Promise(() => {}); // the WebSocket stalls
    });
    const m = mount();
    act(() => { void m.hook.result.current.startVoice(); });
    await act(async () => {}); // the microphone answers
    expect(m.voice()).toMatchObject({ status: "connecting", phase: "server" });

    act(() => vi.advanceTimersByTime(VOICE_CONNECT_TIMEOUT_MS - 1));
    expect(m.voice()).toMatchObject({ status: "connecting" });
    expect(endSession).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(m.voice()).toEqual({ status: "failed", attempt: 1, failure: "connect_timeout" });
    expect(endSession).toHaveBeenCalledTimes(1);
    expect(voiceReports()).toEqual([expect.objectContaining({ code: "voice_connect_timeout", sessionId: "intake-1" })]);

    // The stalled connection opens after all, and Lenore says hello: none of it counts.
    act(() => session().onConnect({ conversationId: "late" }));
    said("Hello, I'm Lenore.", "agent");
    expect(m.voice()).toEqual({ status: "failed", attempt: 1, failure: "connect_timeout" });
    expect(m.onNewMessage).not.toHaveBeenCalled();
  });

  it("doesn't time out a call that connected, nor the wait for the microphone", async () => {
    vi.useFakeTimers();
    const m = mount();
    act(() => { void m.hook.result.current.startVoice(); });
    await act(async () => {});
    act(() => session().onConnect({ conversationId: "c" }));
    act(() => vi.advanceTimersByTime(VOICE_CONNECT_TIMEOUT_MS * 4));
    expect(m.voice()).toMatchObject({ status: "active" });

    getUserMedia.mockImplementationOnce(() => new Promise(() => {})); // the prospect never answers the prompt
    const waiting = mount();
    act(() => { void waiting.hook.result.current.startVoice(); });
    act(() => vi.advanceTimersByTime(VOICE_CONNECT_TIMEOUT_MS * 4));
    expect(waiting.voice()).toMatchObject({ status: "connecting", phase: "microphone" });
  });

  it("fails a call that drops, keeping what was said, and reports the close code", async () => {
    const m = mount();
    await connect(m);
    said("We're Acme.", "user");
    act(() => session().onDisconnect({ reason: "error", message: "Connection lost", context: new Event("close"), closeCode: 1006 }));
    expect(m.voice()).toEqual({ status: "failed", attempt: 1, failure: "dropped" });
    expect(m.hook.result.current.isConnected).toBe(false);
    expect(m.onNewMessage).toHaveBeenCalledTimes(1);
    expect(voiceReports()).toEqual([{ code: "voice_dropped:1006", detail: "Connection lost", sessionId: "intake-1" }]);
  });

  it("keeps a call going through an error the service reports, and reports it", async () => {
    const m = mount();
    await connect(m);
    act(() => session().onError("Server error: overloaded"));
    expect(m.voice()).toMatchObject({ status: "active" });
    expect(voiceReports()).toEqual([{ code: "voice_error", detail: "Server error: overloaded", sessionId: "intake-1" }]);
  });

  it("tries again as a new attempt, and the old attempt's late events change nothing", async () => {
    startSession.mockRejectedValueOnce(new Error("refused"));
    const m = mount();
    await start(m);
    const first = session();
    expect(m.voice()).toMatchObject({ status: "failed", attempt: 1 });

    await start(m);
    expect(m.voice()).toEqual({ status: "connecting", attempt: 2, phase: "server" });
    act(() => first?.onConnect({ conversationId: "old" }));
    expect(m.voice()).toMatchObject({ status: "connecting", attempt: 2 });
    act(() => session().onConnect({ conversationId: "new" }));
    expect(m.voice()).toMatchObject({ status: "active", attempt: 2 });
  });

  it("clears a failure when dismissed", async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException("refused", "NotAllowedError"));
    const m = mount();
    await start(m);
    act(() => m.hook.result.current.dismissFailure());
    expect(m.voice()).toEqual({ status: "idle", attempt: 1 });
  });
});

describe("useLenoreVoice ending a call", () => {
  it("ends at once when the prospect hangs up, and the service's own hang-up changes nothing", async () => {
    const m = mount();
    await connect(m);
    act(() => m.hook.result.current.endVoice());
    expect(m.voice()).toEqual({ status: "disconnected", attempt: 1, by: "prospect" });
    expect(endSession).toHaveBeenCalledTimes(1);
    act(() => session().onDisconnect({ reason: "user" }));
    expect(m.voice()).toEqual({ status: "disconnected", attempt: 1, by: "prospect" });
    expect(voiceReports()).toEqual([]);
  });

  it("isn't a failure when Lenore ends the call", async () => {
    const m = mount();
    await connect(m);
    act(() => session().onDisconnect({ reason: "agent" }));
    expect(m.voice()).toEqual({ status: "disconnected", attempt: 1, by: "agent" });
    expect(voiceReports()).toEqual([]);
  });

  it("cancels a connection that is opening", async () => {
    const m = mount();
    await start(m);
    act(() => m.hook.result.current.endVoice());
    expect(m.voice()).toEqual({ status: "idle", attempt: 1 });
    expect(endSession).toHaveBeenCalledTimes(1);
    act(() => session().onConnect({ conversationId: "late" }));
    expect(m.voice()).toEqual({ status: "idle", attempt: 1 });
  });
});

describe("useLenoreVoice greetings", () => {
  it("marks the agent's opening line in each voice session as a greeting", async () => {
    const m = mount();
    await connect(m);
    said("Hello, I'm Lenore.", "agent");
    said("We're Acme.", "user");
    said("Noted.", "agent");
    expect(m.onNewMessage.mock.calls.map(([msg]) => [msg.sender, msg.text, msg.kind])).toEqual([
      ["lenore", "Hello, I'm Lenore.", "greeting"],
      ["user", "We're Acme.", undefined],
      ["lenore", "Noted.", undefined],
    ]);
    // The orb still shows what she said, kept in the transcript or not.
    expect(m.onLastSpokenText).toHaveBeenCalledWith("Hello, I'm Lenore.");

    act(() => session().onDisconnect({ reason: "agent" }));
    await connect(m);
    said("Welcome back.", "agent");
    expect(m.onNewMessage.mock.calls.at(-1)?.[0]).toMatchObject({ text: "Welcome back.", kind: "greeting" });
  });

  it("doesn't call a reply a greeting when the prospect spoke first (an agent with no opening line)", async () => {
    const m = mount();
    await connect(m);
    said("Hi, we're Acme.", "user");
    said("Thank you.", "agent");
    expect(m.onNewMessage.mock.calls.at(-1)?.[0].kind).toBeUndefined();
  });

  it("keeps the prospect's last words that arrive just after they hung up", async () => {
    const m = mount();
    await connect(m);
    act(() => m.hook.result.current.endVoice());
    said("Fifty employees.", "user");
    expect(m.onNewMessage.mock.calls.at(-1)?.[0]).toMatchObject({ sender: "user", text: "Fifty employees." });
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
  it("ends the open voice session, and keeps nothing it still says", async () => {
    const m = mount();
    await connect(m);
    voiceStatus = "connected";
    said("Hello.", "agent");
    expect(m.onNewMessage).toHaveBeenCalledTimes(1);

    m.hook.rerender({ epoch: 1 });
    expect(endSession).toHaveBeenCalledTimes(1);
    expect(m.voice()).toEqual({ status: "idle", attempt: 1 });
    said("We're Acme.", "user");
    said("Noted.", "agent");
    expect(m.onNewMessage).toHaveBeenCalledTimes(1);

    // A session opened in the new conversation is heard again.
    voiceStatus = "disconnected";
    await connect(m);
    said("Hello again.", "agent");
    expect(m.onNewMessage).toHaveBeenCalledTimes(2);
  });

  it("clears a failure from the old conversation", async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException("refused", "NotAllowedError"));
    const m = mount();
    await start(m);
    m.hook.rerender({ epoch: 1 });
    expect(m.voice()).toEqual({ status: "idle", attempt: 1 });
    expect(endSession).not.toHaveBeenCalled();
  });
});

describe("useLenoreVoice without an agent", () => {
  it("offers no voice and starts nothing", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_ELEVENLABS_AGENT_ID", "");
    const { useLenoreVoice: unconfigured } = await import("./useLenoreVoice");
    const { result } = renderHook(() => unconfigured({ onNewMessage: vi.fn(), onLastSpokenText: vi.fn(), onExtract: vi.fn() }));
    expect(result.current.hasAgentId).toBe(false);
    await act(async () => { await result.current.startVoice(); });
    expect(result.current.voice).toEqual({ status: "idle", attempt: 0 });
    expect(getUserMedia).not.toHaveBeenCalled();
    vi.stubEnv("VITE_ELEVENLABS_AGENT_ID", "agent_test");
  });
});
