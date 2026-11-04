// The orb's controls (US-2.3c): voice only when it is configured, nothing to click twice while connecting, and every
// failure said in words with a way on in text.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import VoiceOrb from "./VoiceOrb";
import { VOICE_FAILURE_MESSAGES, type VoiceFailure } from "@/data/voiceFailure";

const renderOrb = (props: Partial<Parameters<typeof VoiceOrb>[0]> = {}) => {
  const handlers = { onStartVoice: vi.fn(), onTypeInstead: vi.fn(), onContinueInText: vi.fn() };
  render(<VoiceOrb orbState="idle" lastSpokenText="" voiceAvailable {...handlers} {...props} />);
  return handlers;
};

describe("VoiceOrb", () => {
  it("offers no voice, and no setup instructions, when voice isn't configured", () => {
    const { onStartVoice, onTypeInstead } = renderOrb({ voiceAvailable: false });
    expect(screen.queryByRole("button", { name: /Speak with Lenore/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("voice-orb"));
    expect(onStartVoice).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toMatch(/elevenlabs|VITE_|agent|being trained/i);
    fireEvent.click(screen.getByRole("button", { name: "Message Lenore" }));
    expect(onTypeInstead).toHaveBeenCalledTimes(1);
  });

  it("starts a call from the button or the orb when voice is configured", () => {
    const { onStartVoice } = renderOrb();
    fireEvent.click(screen.getByRole("button", { name: "Speak with Lenore" }));
    fireEvent.click(screen.getByTestId("voice-orb"));
    expect(onStartVoice).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Type instead" })).toBeInTheDocument();
  });

  it("says it is connecting, and takes no second click while it does", () => {
    const { onStartVoice } = renderOrb({ isConnecting: true, orbState: "thinking" });
    expect(screen.getByRole("status")).toHaveTextContent("Connecting...");
    const button = screen.getByRole("button", { name: "Connecting..." });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    fireEvent.click(screen.getByTestId("voice-orb"));
    expect(onStartVoice).not.toHaveBeenCalled();
  });

  it("offers to end a call that is connected", () => {
    const { onStartVoice } = renderOrb({ isVoiceConnected: true, orbState: "listening" });
    expect(screen.getByRole("status")).toHaveTextContent("Listening...");
    fireEvent.click(screen.getByRole("button", { name: "End Voice Call" }));
    expect(onStartVoice).toHaveBeenCalledTimes(1);
  });

  it.each(Object.keys(VOICE_FAILURE_MESSAGES) as VoiceFailure[])("says what happened after %s, with Continue in text", (failure) => {
    const { onContinueInText, onStartVoice } = renderOrb({ failure });
    expect(screen.getByRole("alert")).toHaveTextContent(VOICE_FAILURE_MESSAGES[failure]);
    fireEvent.click(screen.getByRole("button", { name: "Continue in text" }));
    expect(onContinueInText).toHaveBeenCalledTimes(1);
    // Calling again stays possible.
    fireEvent.click(screen.getByRole("button", { name: "Speak with Lenore" }));
    expect(onStartVoice).toHaveBeenCalledTimes(1);
  });

  it("shows no failure when there is none", () => {
    renderOrb();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
