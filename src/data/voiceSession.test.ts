import { describe, expect, it } from "vitest";
import {
  INITIAL_VOICE_STATE,
  VOICE_FAILURE_MESSAGES,
  failureFromStartError,
  orbForVoice,
  reduceVoice,
  voiceFailureCode,
  voiceInProgress,
  voiceRetryCanHelp,
  type VoiceEvent,
  type VoiceFailure,
  type VoiceState,
} from "./voiceSession";

const run = (events: VoiceEvent[], from: VoiceState = INITIAL_VOICE_STATE) => events.reduce(reduceVoice, from);
const connecting = (phase: "microphone" | "server" = "server", attempt = 1): VoiceState => ({ status: "connecting", attempt, phase });
const active = (attempt = 1): VoiceState => ({ status: "active", attempt, speaking: false });

describe("reduceVoice", () => {
  it("goes from idle through the microphone and the connection to a call, and back when it ends", () => {
    const steps: VoiceEvent[] = [
      { type: "start" },
      { type: "microphone_ready", attempt: 1 },
      { type: "connected", attempt: 1 },
      { type: "mode", attempt: 1, speaking: true },
      { type: "mode", attempt: 1, speaking: false },
      { type: "disconnected", attempt: 1, reason: "user" },
      { type: "dismiss" },
    ];
    const seen: VoiceState[] = [];
    steps.reduce((s, e) => {
      const next = reduceVoice(s, e);
      seen.push(next);
      return next;
    }, INITIAL_VOICE_STATE);
    expect(seen).toEqual([
      { status: "connecting", attempt: 1, phase: "microphone" },
      { status: "connecting", attempt: 1, phase: "server" },
      { status: "active", attempt: 1, speaking: false },
      { status: "active", attempt: 1, speaking: true },
      { status: "active", attempt: 1, speaking: false },
      { status: "disconnected", attempt: 1, by: "prospect" },
      { status: "idle", attempt: 1 },
    ]);
  });

  it("starts nothing on a second start while connecting or in a call", () => {
    for (const state of [connecting("microphone"), connecting("server"), active()]) {
      expect(reduceVoice(state, { type: "start" })).toBe(state);
    }
  });

  it("starts a new attempt after a failure or a finished call", () => {
    expect(reduceVoice({ status: "failed", attempt: 3, failure: "dropped" }, { type: "start" })).toEqual(connecting("microphone", 4));
    expect(reduceVoice({ status: "disconnected", attempt: 3, by: "agent" }, { type: "start" })).toEqual(connecting("microphone", 4));
  });

  it.each<[string, VoiceState, VoiceEvent, VoiceState]>([
    ["a refused microphone", connecting("microphone"), { type: "failed", attempt: 1, failure: "mic_denied" }, { status: "failed", attempt: 1, failure: "mic_denied" }],
    ["a timeout", connecting("server"), { type: "failed", attempt: 1, failure: "connect_timeout" }, { status: "failed", attempt: 1, failure: "connect_timeout" }],
    ["a close with an error before the call started", connecting("server"), { type: "disconnected", attempt: 1, reason: "error" }, { status: "failed", attempt: 1, failure: "connect_failed" }],
    ["a close with an error during the call", active(), { type: "disconnected", attempt: 1, reason: "error" }, { status: "failed", attempt: 1, failure: "dropped" }],
    ["Lenore hanging up", active(), { type: "disconnected", attempt: 1, reason: "agent" }, { status: "disconnected", attempt: 1, by: "agent" }],
    ["Lenore hanging up at once", connecting("server"), { type: "disconnected", attempt: 1, reason: "agent" }, { status: "disconnected", attempt: 1, by: "agent" }],
  ])("settles %s", (_, from, event, to) => {
    expect(reduceVoice(from, event)).toEqual(to);
  });

  it("ignores every event from another attempt", () => {
    // Attempt 1 timed out; its connection finishing late, or dropping, changes nothing.
    const timedOut: VoiceState = { status: "failed", attempt: 1, failure: "connect_timeout" };
    for (const event of [
      { type: "connected", attempt: 1 },
      { type: "disconnected", attempt: 1, reason: "error" },
      { type: "mode", attempt: 1, speaking: true },
    ] as VoiceEvent[]) {
      expect(reduceVoice(timedOut, event)).toBe(timedOut);
    }
    // Attempt 2 is connecting: attempt 1's events still change nothing.
    const retrying = connecting("server", 2);
    for (const event of [
      { type: "connected", attempt: 1 },
      { type: "failed", attempt: 1, failure: "connect_failed" },
      { type: "microphone_ready", attempt: 1 },
    ] as VoiceEvent[]) {
      expect(reduceVoice(retrying, event)).toBe(retrying);
    }
  });

  it("doesn't skip a phase: no call before the connection, no connection before the microphone", () => {
    const waiting = connecting("microphone");
    expect(reduceVoice(waiting, { type: "connected", attempt: 1 })).toBe(waiting);
    const call = active();
    expect(reduceVoice(call, { type: "microphone_ready", attempt: 1 })).toBe(call);
    expect(reduceVoice(INITIAL_VOICE_STATE, { type: "failed", attempt: 0, failure: "dropped" })).toBe(INITIAL_VOICE_STATE);
  });

  it("cancels anything back to idle, keeping the attempt so its late events stay ignored", () => {
    for (const state of [connecting("microphone"), connecting("server"), active(), { status: "failed", attempt: 1, failure: "dropped" } as VoiceState]) {
      expect(reduceVoice(state, { type: "cancel" })).toEqual({ status: "idle", attempt: 1 });
    }
    const cancelled = run([{ type: "start" }, { type: "microphone_ready", attempt: 1 }, { type: "cancel" }]);
    expect(reduceVoice(cancelled, { type: "connected", attempt: 1 })).toBe(cancelled);
    expect(reduceVoice(INITIAL_VOICE_STATE, { type: "cancel" })).toBe(INITIAL_VOICE_STATE);
  });

  it("dismisses only a failure or a finished call", () => {
    expect(reduceVoice({ status: "failed", attempt: 2, failure: "mic_denied" }, { type: "dismiss" })).toEqual({ status: "idle", attempt: 2 });
    const call = active();
    expect(reduceVoice(call, { type: "dismiss" })).toBe(call);
  });
});

describe("what the call shows", () => {
  it("drives the orb only while a call is starting or under way", () => {
    expect(orbForVoice(INITIAL_VOICE_STATE)).toBeNull();
    // Waiting on the prospect's permission prompt: nothing spins.
    expect(orbForVoice(connecting("microphone"))).toBe("idle");
    expect(orbForVoice(connecting("server"))).toBe("thinking");
    expect(orbForVoice(active())).toBe("listening");
    expect(orbForVoice({ status: "active", attempt: 1, speaking: true })).toBe("speaking");
    expect(orbForVoice({ status: "failed", attempt: 1, failure: "dropped" })).toBeNull();
    expect(orbForVoice({ status: "disconnected", attempt: 1, by: "prospect" })).toBeNull();
    expect(voiceInProgress(connecting("microphone"))).toBe(true);
    expect(voiceInProgress({ status: "failed", attempt: 1, failure: "dropped" })).toBe(false);
  });

  it("has its own words for every failure, and offers a retry unless the browser can't do voice", () => {
    const failures: VoiceFailure[] = ["mic_denied", "mic_unavailable", "unsupported", "connect_timeout", "connect_failed", "dropped"];
    const titles = failures.map((f) => VOICE_FAILURE_MESSAGES[f].title);
    expect(new Set(titles).size).toBe(failures.length);
    for (const f of failures) expect(VOICE_FAILURE_MESSAGES[f].body).toMatch(/typing/);
    expect(failures.filter((f) => !voiceRetryCanHelp(f))).toEqual(["unsupported"]);
  });
});

describe("failureFromStartError", () => {
  it.each([
    ["NotAllowedError", "mic_denied"],
    ["SecurityError", "mic_denied"],
    ["PermissionDeniedError", "mic_denied"],
    ["NotFoundError", "mic_unavailable"],
    ["NotReadableError", "mic_unavailable"],
    ["OverconstrainedError", "mic_unavailable"],
  ])("reads a %s as %s, in either phase", (name, failure) => {
    expect(failureFromStartError(new DOMException("x", name), "microphone")).toBe(failure);
    expect(failureFromStartError(new DOMException("x", name), "server")).toBe(failure);
  });

  it("never calls a failure in the microphone phase a refused connection: nothing has connected yet", () => {
    // Headless Chromium, which can't show a permission prompt, rejects with NotSupportedError (found in QA).
    expect(failureFromStartError(new DOMException("Not supported", "NotSupportedError"), "microphone")).toBe("unsupported");
    expect(failureFromStartError(new TypeError("bad constraints"), "microphone")).toBe("mic_unavailable");
    expect(failureFromStartError(null, "microphone")).toBe("mic_unavailable");
  });

  it("reads anything else in the server phase as a refused connection", () => {
    expect(failureFromStartError(new Error("WebSocket closed"), "server")).toBe("connect_failed");
    expect(failureFromStartError("nope", "server")).toBe("connect_failed");
    expect(failureFromStartError(null, "server")).toBe("connect_failed");
  });
});

describe("voiceFailureCode", () => {
  it("reports what fails on our side or the voice service's, never the prospect's own device or choice", () => {
    expect(voiceFailureCode("mic_denied")).toBeNull();
    expect(voiceFailureCode("mic_unavailable")).toBeNull();
    expect(voiceFailureCode("unsupported")).toBeNull();
    expect(voiceFailureCode("connect_timeout")).toBe("voice_connect_timeout");
    expect(voiceFailureCode("connect_failed")).toBe("voice_connect_failed");
    expect(voiceFailureCode("dropped", 1006)).toBe("voice_dropped:1006");
  });
});
