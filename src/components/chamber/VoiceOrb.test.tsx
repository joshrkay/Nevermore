import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VoiceOrb from "./VoiceOrb";
import { VOICE_FAILURE_MESSAGES, type VoiceFailure, type VoiceState } from "@/data/voiceSession";

const renderOrb = (voice: VoiceState, hasAgentId = true, extra: Partial<ComponentProps<typeof VoiceOrb>> = {}) => {
  const handlers = { onStartVoice: vi.fn(), onEndVoice: vi.fn(), onTypeInstead: vi.fn() };
  render(<VoiceOrb orbState="idle" lastSpokenText="" voice={voice} hasAgentId={hasAgentId} {...handlers} {...extra} />);
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

  it("scales the orb to the size it is given", () => {
    renderOrb({ status: "idle", attempt: 0 }, true, { orbSize: 100 });
    expect(screen.getByTestId("voice-orb").parentElement).toHaveStyle({ width: "100px", height: "100px" });
  });

  it("keeps the two lines of her words to the same height however long they are", () => {
    renderOrb({ status: "idle", attempt: 0 }, true, { lastSpokenText: "Who carries your health coverage today?" });
    expect(screen.getByText(/Who carries/)).toHaveClass("line-clamp-2", "min-h-[3.25rem]");
  });

  describe("folded into a bar", () => {
    const folded = (voice: VoiceState, hasAgentId = true, extra: Partial<ComponentProps<typeof VoiceOrb>> = {}) =>
      renderOrb(voice, hasAgentId, { compact: true, ...extra });

    it("shows a small orb and her latest line, with no hero buttons", () => {
      folded({ status: "idle", attempt: 0 }, true, { lastSpokenText: "Who carries your health coverage today?" });
      expect(screen.getByTestId("voice-orb").parentElement).toHaveStyle({ width: "32px", height: "32px" });
      expect(screen.getByText(/Who carries your health coverage/)).toBeInTheDocument();
      // Text is a tap away in the conversation, which is on screen: no second way in.
      expect(screen.queryByRole("button", { name: "Type instead" })).not.toBeInTheDocument();
    });

    it("starts a call from the button or the orb, under the same name as the open stage", () => {
      const { onStartVoice } = folded({ status: "idle", attempt: 0 });
      fireEvent.click(screen.getByRole("button", { name: "Speak with Lenore" }));
      fireEvent.click(screen.getByTestId("voice-orb"));
      expect(onStartVoice).toHaveBeenCalledTimes(2);
    });

    it("offers no voice when voice isn't set up", () => {
      const { onStartVoice } = folded({ status: "idle", attempt: 0 }, false);
      expect(screen.queryByRole("button", { name: /speak with lenore/i })).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId("voice-orb"));
      expect(onStartVoice).not.toHaveBeenCalled();
    });

    it("starts nothing on a second click while connecting, and can be cancelled", () => {
      const { onStartVoice, onEndVoice } = folded({ status: "connecting", attempt: 1, phase: "server" });
      const connecting = screen.getByRole("button", { name: /connecting/i });
      expect(connecting).toBeDisabled();
      fireEvent.click(connecting);
      fireEvent.click(screen.getByTestId("voice-orb"));
      expect(onStartVoice).not.toHaveBeenCalled();
      expect(screen.getByRole("status")).toHaveTextContent("Connecting to Lenore...");
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onEndVoice).toHaveBeenCalledTimes(1);
    });

    it("ends a call in progress, and still says who is talking", () => {
      const { onEndVoice } = folded({ status: "active", attempt: 1, speaking: false });
      expect(screen.getByRole("status")).toHaveTextContent("Listening...");
      fireEvent.click(screen.getByRole("button", { name: "End voice call" }));
      expect(onEndVoice).toHaveBeenCalledTimes(1);
    });

    it("still explains a voice failure, which must not be hidden by folding", () => {
      const { onStartVoice, onTypeInstead } = folded({ status: "failed", attempt: 1, failure: "mic_denied" });
      expect(screen.getByRole("alert")).toHaveTextContent(VOICE_FAILURE_MESSAGES.mic_denied.title);
      fireEvent.click(screen.getByRole("button", { name: "Continue in text" }));
      expect(onTypeInstead).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: "Try voice again" }));
      expect(onStartVoice).toHaveBeenCalledTimes(1);
    });
  });
});
