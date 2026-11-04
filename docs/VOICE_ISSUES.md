# Voice issues

Every cause found for a voice call with Lenore failing or misbehaving, with its fix (I-5.1). Voice is the
ElevenLabs conversational agent behind `VITE_ELEVENLABS_AGENT_ID`, driven by `src/hooks/useLenoreVoice.ts`
through the state machine in `src/data/voiceSession.ts`. Text never depends on it.

Add an entry for each new cause, whether it comes from an alert (`voice_failed`, `docs/RUNBOOK.md`), a
prospect, or testing. Say how it was found, what the prospect saw, why, the fix, and the test that holds it.

## How a call works now

`idle → connecting (microphone) → connecting (server) → active → disconnected`, and `failed` from any step.
The microphone is asked for first and released, before any connection, so the browser's permission prompt is
never timed. The connection then has 15 seconds. Every SDK callback is bound to the attempt that opened it, so
a late callback from an attempt that was given up on changes nothing. The orb, the button and the notice are
read from the state alone. Each failure has its own message, with "Continue in text", which puts the cursor in
the text input.

| Failure | The prospect sees | Reported (`voice_failed`) |
|---|---|---|
| `mic_denied` | "Lenore can't hear you": allow the microphone in site settings | No: their choice |
| `mic_unavailable` | "We couldn't use your microphone": none, or another app has it | No: their device |
| `unsupported` | "Voice doesn't work in this browser" (no retry offered): no microphone API, or a browser that can't ask for one | No: their browser |
| `connect_timeout` | "Lenore's voice didn't connect" within 15 seconds | `voice_connect_timeout` |
| `connect_failed` | "Lenore's voice couldn't connect" | `voice_connect_failed` |
| `dropped` | "The voice call dropped"; what was said is kept | `voice_dropped:<close code>` |

An error the service reports during a call that carries on is reported as `voice_error` and changes nothing
on screen.

## Causes found

1 to 9 were found on 2026-11-04 by reading `useLenoreVoice.ts` against the SDK's source (`@elevenlabs/react`
0.14.3, `@elevenlabs/client` 0.15.2), and 10 by driving the built app in a browser. None has been seen in the
hosted environment yet (see "Still open"). Each is fixed and tested with a fake SDK in
`src/hooks/useLenoreVoice.test.ts` unless it says otherwise.

### 1. A stalled connection spun forever

- **Saw:** the orb's "thinking" arc, with no end and no message.
- **Why:** `startSession` waits for the WebSocket, and neither the SDK nor the hook put a limit on it.
- **Fix:** connecting fails as `connect_timeout` 15 seconds after the microphone is ready. The pending
  connection is abandoned (`endSession`), and if it opens later its events are ignored.
- **Test:** "gives up after 15 seconds of connecting, abandons the connection, and ignores it if it opens later".

### 2. The browser's permission prompt would have counted as connecting

- **Saw:** nothing yet; it is why the timeout in 1 isn't simply wrapped around `startSession`.
- **Why:** the SDK asks for the microphone itself, inside `startSession`, before it connects. A prospect reading
  the browser's prompt for 15 seconds would have been told the connection failed.
- **Fix:** the hook asks for the microphone first and releases it at once; the SDK's own request is then
  answered without a prompt. Only the connection is timed. While the browser asks, nothing spins, the orb says
  to allow access, and the prospect can cancel.
- **Test:** "doesn't time out a call that connected, nor the wait for the microphone".

### 3. A blocked microphone did nothing

- **Saw:** the orb went back to idle. Nothing said why.
- **Why:** a `denied` permission, or the SDK's `NotAllowedError` in browsers where the permission can't be
  queried (Firefox, older Safari), only reached `console.error`.
- **Fix:** `mic_denied`, with its message. `SecurityError` and the old `PermissionDeniedError` read the same.

### 4. A missing or busy microphone, or a browser without one, read as "Failed to start voice"

- **Why:** `NotFoundError` and `NotReadableError` (no device, or another app holds it) and a page with no
  `navigator.mediaDevices` (plain http, an old browser) all ended in the same `console.error`.
- **Fix:** `mic_unavailable` and `unsupported`, each with its own message. A browser without a microphone API
  isn't offered a retry.

### 5. A dropped call looked like a hang-up

- **Saw:** the orb went back to idle mid-sentence, as if the prospect had ended the call.
- **Why:** `onDisconnect` ignored why the connection closed. The SDK says (`reason: "error"` with the close code,
  `"agent"` when Lenore ends the call, `"user"` when we do).
- **Fix:** a close with an error during a call is `dropped`, reported with its close code. Lenore ending the call
  is a normal end, with no notice. What was said before the drop stays in the transcript.

### 6. A service error made the screen say the call had ended while it carried on

- **Saw:** the orb went idle and the button read "Speak with Lenore" while the microphone was still live and
  Lenore could still answer. Pressing the button then ended the call it said wasn't there.
- **Why:** the hook treated `onError` as a disconnect, but the SDK calls it for error events the service sends
  during a call (and for client-tool errors) without closing anything. Only a close ends a call.
- **Fix:** an error during a call is reported (`voice_error`) and the call's state is left alone; `onDisconnect`
  is what ends it.
- **Test:** "keeps a call going through an error the service reports, and reports it".

### 7. A second click while connecting started again

- **Why:** the button and the orb only checked for a connected call. A click while connecting re-ran the
  permission check and `startSession` (the SDK handed back the pending session, so there was no second call,
  but the orb and the errors were reset and doubled).
- **Fix:** a start while connecting or in a call is ignored by the state machine, and the button is disabled
  and reads "Connecting...", with a separate "Cancel".
- **Test:** "starts nothing on a second click while connecting" (hook) and the `VoiceOrb` component test.

### 8. Prospects were shown how to set voice up

- **Saw:** with no agent id, "Speak with Lenore" opened "Lenore's Voice Is Being Trained", with steps naming
  the ElevenLabs dashboard and the environment variable.
- **Fix:** with no agent id there is no voice button, and the orb isn't clickable. Text is unchanged.
- **Test:** "offers no voice, and no setup instructions, when voice isn't set up" (`VoiceOrb.test.tsx`).

### 9. Late callbacks could act on a call that was given up on

- **Why:** the callbacks were the hook's, shared by every attempt. A connection opening after it timed out, or
  after the prospect started over, would have marked the orb listening and added its greeting.
- **Fix:** each attempt passes its own callbacks to `startSession`, and the state machine ignores events from
  any attempt but the current one. Starting over drops anything the old call still says.

### 10. A browser that can't ask for the microphone was told the connection failed

- **Found:** in QA on 2026-11-04, driving the built Chamber in headless Chromium (the e2e stack, with an agent id
  set), after the fixes above.
- **Saw:** "Lenore's voice couldn't connect", though nothing had tried to connect.
- **Why:** a browser that can't show a permission prompt rejects `getUserMedia` with `NotSupportedError`, a name
  the first version of the fix didn't know, and any unknown error was read as a refused connection.
- **Fix:** errors are read by the phase they come in (`failureFromStartError(error, phase)`). In the microphone
  phase nothing has connected: `NotSupportedError` is `unsupported`, and any other unknown error
  `mic_unavailable`. Only the server phase has `connect_failed`.
- **Test:** `voiceSession.test.ts`, "never calls a failure in the microphone phase a refused connection", and the
  hook's microphone cases.

## Still open

- **A stalled connection holds up the next attempt.** The React SDK keeps a pending connection and a new
  `startSession` waits on it rather than opening another, so trying again right after a timeout waits on the
  same stalled socket and times out too. Each wait is still 15 seconds at most, and reloading the page clears
  it. If `voice_connect_timeout` shows retries failing in a row, the fix is to drive `@elevenlabs/client`
  directly, one `Conversation` per attempt, or an SDK version that cancels.
- **Not yet seen in the hosted environment.** I-5.1 asks for a hosted test with a real microphone in each
  supported browser. It hasn't been run. Check in it that asking for the microphone twice (ours, then the
  SDK's) prompts only once in each browser, Firefox with "Remember this decision" unticked included.
