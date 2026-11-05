import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VoiceOrb from "./VoiceOrb";
import { VOICE_FAILURE_MESSAGES, type VoiceFailure, type VoiceState } from "@/data/voiceSession";

const renderOrb = (voice: VoiceState, hasAgentId = true) => {
  const handlers = { onStartVoice: vi.fn(), onEndVoice: vi.fn(), onTypeInstead: vi.fn() };
  render(<VoiceOrb orbState="idle" lastSpokenText="" voice={voice} hasAgentId={hasAgentId} {...handlers} />);
  return handlers;
};

describe("VoiceOrb", () => {
  it("offers no voice, and no setup instructions, when voice isn't set up", () => {
    const { onStartVoice } = renderOrb({ status: "idle", attempt: 0 }, false);
    expect(screen.queryByRole("button", { name: /speak with lenore/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("voice-orb"));
    expect(onStartVoice).not.toHaveBeenCalled();
    expect(screen.queryByText(/VITE_ELEVENLABS_AGENT_ID|elevenlabs|Lovable|being trained/i)).not.toBeInTheDocument();
    // Text is still offered.
    expect(screen.getByRole("button", { name: "Type instead" })).toBeInTheDocument();
  });

  it("starts a call from the button or the orb", () => {
    const { onStartVoice } = renderOrb({ status: "idle", attempt: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Speak with Lenore" }));
    fireEvent.click(screen.getByTestId("voice-orb"));
    expect(onStartVoice).toHaveBeenCalledTimes(2);
  });

  it("starts nothing on a second click while connecting, and can be cancelled", () => {
    const { onStartVoice, onEndVoice } = renderOrb({ status: "connecting", attempt: 1, phase: "server" });
    const connecting = screen.getByRole("button", { name: /connecting/i });
    expect(connecting).toBeDisabled();
    fireEvent.click(connecting);
    fireEvent.click(screen.getByTestId("voice-orb"));
    expect(onStartVoice).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Connecting to Lenore...");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onEndVoice).toHaveBeenCalledTimes(1);
  });

  it("tells the prospect to answer the browser while it asks for the microphone", () => {
    renderOrb({ status: "connecting", attempt: 1, phase: "microphone" });
    expect(screen.getByRole("status")).toHaveTextContent(/allow access/);
  });

  it("ends a call in progress, and says who is talking", () => {
    const { onEndVoice } = renderOrb({ status: "active", attempt: 1, speaking: true });
    expect(screen.getByRole("status")).toHaveTextContent("Lenore is speaking...");
    fireEvent.click(screen.getByRole("button", { name: "End voice call" }));
    expect(onEndVoice).toHaveBeenCalledTimes(1);
  });

  it.each<VoiceFailure>(["mic_denied", "mic_unavailable", "unsupported", "connect_timeout", "connect_failed", "dropped"])(
    "explains a %s failure and offers to continue in text",
    (failure) => {
      const { onStartVoice, onTypeInstead } = renderOrb({ status: "failed", attempt: 1, failure });
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(VOICE_FAILURE_MESSAGES[failure].title);
      expect(alert).toHaveTextContent(VOICE_FAILURE_MESSAGES[failure].body);
      fireEvent.click(screen.getByRole("button", { name: "Continue in text" }));
      expect(onTypeInstead).toHaveBeenCalledTimes(1);
      const retry = screen.queryByRole("button", { name: "Try voice again" });
      if (failure === "unsupported") {
        expect(retry).not.toBeInTheDocument();
      } else {
        fireEvent.click(retry!);
        expect(onStartVoice).toHaveBeenCalledTimes(1);
      }
      // Nothing spins and voice can still be started.
      expect(screen.queryByRole("button", { name: /connecting/i })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Speak with Lenore" })).toBeEnabled();
    },
  );

  it("shows no notice when a call ended normally", () => {
    renderOrb({ status: "disconnected", attempt: 1, by: "agent" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  describe("the orb as a control (I-2.1)", () => {
    it("is a toggle button for the call, reachable from the keyboard", () => {
      const { onStartVoice } = renderOrb({ status: "idle", attempt: 0 });
      const orb = screen.getByRole("button", { name: "Voice call with Lenore" });
      expect(orb).toBe(screen.getByTestId("voice-orb"));
      expect(orb.tagName).toBe("BUTTON");
      expect(orb).toHaveAttribute("aria-pressed", "false");
      orb.focus();
      expect(orb).toHaveFocus();
      fireEvent.click(orb);
      expect(onStartVoice).toHaveBeenCalledTimes(1);
    });

    it("is pressed during a call, and ends it", () => {
      const { onEndVoice } = renderOrb({ status: "active", attempt: 1, speaking: false });
      const orb = screen.getByRole("button", { name: "Voice call with Lenore" });
      expect(orb).toHaveAttribute("aria-pressed", "true");
      fireEvent.click(orb);
      expect(onEndVoice).toHaveBeenCalledTimes(1);
    });

    it("stays focusable but does nothing while a call is starting", () => {
      const { onStartVoice, onEndVoice } = renderOrb({ status: "connecting", attempt: 1, phase: "server" });
      const orb = screen.getByRole("button", { name: "Voice call with Lenore" });
      expect(orb).toHaveAttribute("aria-disabled", "true");
      expect(orb).not.toBeDisabled();
      fireEvent.click(orb);
      expect(onStartVoice).not.toHaveBeenCalled();
      expect(onEndVoice).not.toHaveBeenCalled();
    });

    it("is only a picture, hidden from assistive technology, when voice isn't set up", () => {
      renderOrb({ status: "idle", attempt: 0 }, false);
      expect(screen.queryByRole("button", { name: "Voice call with Lenore" })).not.toBeInTheDocument();
      expect(screen.getByTestId("voice-orb")).toHaveAttribute("aria-hidden", "true");
    });
  });
});
