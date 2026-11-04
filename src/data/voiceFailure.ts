// Why a voice call with Lenore didn't start or didn't last (US-2.3c), and what the prospect is told. Every message
// ends by offering text, which always works: the Chamber shows each one with "Continue in text".

export type VoiceFailure = "mic_denied" | "mic_unavailable" | "connect_failed" | "timeout" | "dropped";

/** How long connecting may take before it is given up, so nothing spins for longer. */
export const VOICE_CONNECT_TIMEOUT_MS = 15_000;

export const VOICE_FAILURE_MESSAGES: Record<VoiceFailure, string> = {
  mic_denied:
    "Lenore can't hear you: this browser has blocked the microphone for this site. Allow it in the browser's site settings to talk, or carry on in text.",
  mic_unavailable: "Lenore can't hear you: no microphone was found, or another app is using it. You can carry on in text.",
  connect_failed: "Lenore's voice couldn't connect. Try again in a moment, or carry on in text.",
  timeout: "Lenore's voice took too long to connect, so we stopped trying. Try again in a moment, or carry on in text.",
  dropped: "The voice call dropped. Everything said before it dropped is in the conversation. Call again, or carry on in text.",
};

// getUserMedia's errors, by name (older Chrome used the second spelling of each).
const DENIED = new Set(["NotAllowedError", "SecurityError", "PermissionDeniedError"]);
const UNAVAILABLE = new Set(["NotFoundError", "NotReadableError", "OverconstrainedError", "AbortError", "DevicesNotFoundError", "TrackStartError"]);

/** The failure a voice session's start threw: a microphone the browser refused or couldn't open, or else no connection. */
export function voiceFailureOf(error: unknown): VoiceFailure {
  const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name: unknown }).name) : "";
  if (DENIED.has(name)) return "mic_denied";
  if (UNAVAILABLE.has(name)) return "mic_unavailable";
  return "connect_failed";
}
