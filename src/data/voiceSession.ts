import type { OrbState } from "@/components/chamber/VoiceOrb";

// A voice call with Lenore, as one state (I-5.1, US-2.3c). Only `reduceVoice` changes it, and everything the
// Chamber shows about voice (the orb while a call is under way, the button, the failure notice) is read from
// it, so the screen can't disagree with the call.
//
//   idle ─start─▶ connecting (microphone) ─microphone_ready─▶ connecting (server) ─connected─▶ active
//                      │ blocked, missing, unsupported              │ 15 s, or refused             │ dropped
//                      ▼                                           ▼                              ▼
//                   failed ◀───────────────────────────────────────┴──────────────────────────────┘
//   active ─ended by the prospect or Lenore─▶ disconnected
//   failed or disconnected ─start─▶ connecting (a new attempt);  ─dismiss─▶ idle
//   anything ─cancel─▶ idle (the prospect cancelled, or the conversation was replaced)
//
// The microphone comes first, before any connection, so the time a prospect spends on the browser's permission
// prompt is never counted against the connection: only the server phase is timed. Nothing spins in the
// microphone phase, and it can be cancelled.
//
// Each attempt has a number, and every event but start, cancel and dismiss names the attempt it belongs to.
// An event from another attempt changes nothing: a connection that finishes after its attempt timed out, or
// the hang-up of a call that was cancelled, can't move the state.

/** How long the connection may take once the microphone is ready, before the attempt fails. */
export const VOICE_CONNECT_TIMEOUT_MS = 15_000;

/** Why a call couldn't start, or stopped without anyone ending it. Each has its own words for the prospect. */
export type VoiceFailure =
  /** The browser, or the prospect, refused the microphone. */
  | "mic_denied"
  /** No microphone, one another app holds, or one that couldn't start. */
  | "mic_unavailable"
  /** No microphone API at all: an old browser, or a page not served over https. */
  | "unsupported"
  /** The microphone was ready but the connection didn't open within VOICE_CONNECT_TIMEOUT_MS. */
  | "connect_timeout"
  /** The connection was refused or closed before the call started. */
  | "connect_failed"
  /** The call was under way and the connection closed with an error. */
  | "dropped";

export type VoiceState =
  | { status: "idle"; attempt: number }
  | { status: "connecting"; attempt: number; phase: "microphone" | "server" }
  | { status: "active"; attempt: number; speaking: boolean }
  | { status: "disconnected"; attempt: number; by: "prospect" | "agent" }
  | { status: "failed"; attempt: number; failure: VoiceFailure };

export type VoiceStatus = VoiceState["status"];

/** How the voice service said the connection closed: the prospect or the app ended it, Lenore did, or it broke. */
export type DisconnectReason = "user" | "agent" | "error";

export type VoiceEvent =
  | { type: "start" }
  | { type: "microphone_ready"; attempt: number }
  | { type: "connected"; attempt: number }
  | { type: "mode"; attempt: number; speaking: boolean }
  | { type: "disconnected"; attempt: number; reason: DisconnectReason }
  | { type: "failed"; attempt: number; failure: VoiceFailure }
  | { type: "cancel" }
  | { type: "dismiss" };

export const INITIAL_VOICE_STATE: VoiceState = { status: "idle", attempt: 0 };

/**
 * The state after an event. The same object comes back when the event changes nothing (a second start while
 * one is under way, an event from another attempt, a transition the machine doesn't have), so a caller can
 * tell with `===`.
 */
export function reduceVoice(state: VoiceState, event: VoiceEvent): VoiceState {
  switch (event.type) {
    case "start":
      // A second click while connecting, or during a call, starts nothing.
      if (state.status === "connecting" || state.status === "active") return state;
      return { status: "connecting", attempt: state.attempt + 1, phase: "microphone" };
    case "cancel":
      return state.status === "idle" ? state : { status: "idle", attempt: state.attempt };
    case "dismiss":
      return state.status === "failed" || state.status === "disconnected" ? { status: "idle", attempt: state.attempt } : state;
  }

  if (event.attempt !== state.attempt) return state;
  switch (event.type) {
    case "microphone_ready":
      return state.status === "connecting" && state.phase === "microphone" ? { ...state, phase: "server" } : state;
    case "connected":
      return state.status === "connecting" && state.phase === "server" ? { status: "active", attempt: state.attempt, speaking: false } : state;
    case "mode":
      return state.status === "active" && state.speaking !== event.speaking ? { ...state, speaking: event.speaking } : state;
    case "disconnected":
      if (state.status === "active") {
        return event.reason === "error"
          ? { status: "failed", attempt: state.attempt, failure: "dropped" }
          : { status: "disconnected", attempt: state.attempt, by: event.reason === "agent" ? "agent" : "prospect" };
      }
      // Closed before the call started. A close the app asked for comes only from a cancel, which has already
      // left this state; Lenore hanging up at once is still a call that ended, not a failure.
      if (state.status === "connecting") {
        return event.reason === "error"
          ? { status: "failed", attempt: state.attempt, failure: "connect_failed" }
          : { status: "disconnected", attempt: state.attempt, by: event.reason === "agent" ? "agent" : "prospect" };
      }
      return state;
    case "failed":
      return state.status === "connecting" || state.status === "active"
        ? { status: "failed", attempt: state.attempt, failure: event.failure }
        : state;
  }
}

/** Whether a call is starting or under way: the voice button is then not "Speak with Lenore". */
export const voiceInProgress = (state: VoiceState): boolean => state.status === "connecting" || state.status === "active";

/**
 * What the orb shows for the call, or null when no call is starting or under way and the text chat drives it.
 * Nothing spins while the browser waits on the prospect for the microphone; the connection spins, and that is
 * bounded by VOICE_CONNECT_TIMEOUT_MS.
 */
export function orbForVoice(state: VoiceState): OrbState | null {
  switch (state.status) {
    case "connecting":
      return state.phase === "server" ? "thinking" : "idle";
    case "active":
      return state.speaking ? "speaking" : "listening";
    default:
      return null;
  }
}

/** What the prospect is told, for each failure. Text always works, and the notice says so with its button. */
export const VOICE_FAILURE_MESSAGES: Record<VoiceFailure, { title: string; body: string }> = {
  mic_denied: {
    title: "Lenore can't hear you",
    body: "Microphone access is blocked for this site. Allow it in your browser's site settings and try again, or carry on by typing.",
  },
  mic_unavailable: {
    title: "We couldn't use your microphone",
    body: "None was found, or another app is using it. Check it's connected and free, then try again, or carry on by typing.",
  },
  unsupported: {
    title: "Voice doesn't work in this browser",
    body: "This browser can't give Lenore a microphone. You can carry on by typing, or try voice in an up-to-date Chrome, Edge, Firefox or Safari.",
  },
  connect_timeout: {
    title: "Lenore's voice didn't connect",
    body: "The connection took longer than 15 seconds, so we stopped waiting. Try again, or carry on by typing.",
  },
  connect_failed: {
    title: "Lenore's voice couldn't connect",
    body: "The voice service didn't accept the call. Try again in a moment, or carry on by typing.",
  },
  dropped: {
    title: "The voice call dropped",
    body: "What was said before it dropped is in the conversation. Try again, or carry on by typing.",
  },
};

/** Whether trying again could work without the prospect changing anything first. A browser with no microphone API won't. */
export const voiceRetryCanHelp = (failure: VoiceFailure): boolean => failure !== "unsupported";

/** The DOMException names a refused microphone comes as, across browsers (older Chrome and Firefox used their own). */
const DENIED = new Set(["NotAllowedError", "SecurityError", "PermissionDeniedError"]);
/** The names for a microphone that is missing, held by another app, or couldn't start. */
const UNAVAILABLE = new Set(["NotFoundError", "DevicesNotFoundError", "NotReadableError", "TrackStartError", "OverconstrainedError", "AbortError"]);

/**
 * The failure a rejected start comes to, by the phase it was rejected in. Nothing has connected in the
 * microphone phase, so whatever goes wrong there is about the microphone: refused, or a browser that can't ask
 * for one (`NotSupportedError`, e.g. where it can't show a permission prompt), or else unavailable. In the server
 * phase the voice service asks for the microphone again, so a microphone error can still come; anything else is
 * a refused connection.
 */
export function failureFromStartError(error: unknown, phase: "microphone" | "server"): VoiceFailure {
  const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name: unknown }).name) : "";
  if (DENIED.has(name)) return "mic_denied";
  if (UNAVAILABLE.has(name)) return "mic_unavailable";
  if (phase === "server") return "connect_failed";
  return name === "NotSupportedError" ? "unsupported" : "mic_unavailable";
}

/**
 * The ops-event code for a failure (`voice_failed`, docs/RUNBOOK.md), or null when it isn't reported. A blocked
 * or missing microphone, or a browser without one, is the prospect's device or choice: they are told, and
 * nobody is alerted. A close code, when the connection gave one, is kept: it is what tells a server refusal
 * (1008, 4xxx) from a network drop (1006).
 */
export function voiceFailureCode(failure: VoiceFailure, closeCode?: number): string | null {
  switch (failure) {
    case "mic_denied":
    case "mic_unavailable":
    case "unsupported":
      return null;
    default:
      return typeof closeCode === "number" ? `voice_${failure}:${closeCode}` : `voice_${failure}`;
  }
}
