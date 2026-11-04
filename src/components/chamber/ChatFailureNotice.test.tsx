import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ChatFailureNotice from "./ChatFailureNotice";
import { CHAT_FAILURE_MESSAGES, type AiFailureKind } from "@/data/aiFailure";

describe("ChatFailureNotice", () => {
  it("says something different for each reason, all of them different", () => {
    expect(new Set(Object.values(CHAT_FAILURE_MESSAGES)).size).toBe(Object.keys(CHAT_FAILURE_MESSAGES).length);
  });

  it.each(["rate_limited", "timeout", "unreachable", "failed"] as AiFailureKind[])("%s: says why, and offers Try again and Continue manually", (kind) => {
    const onRetry = vi.fn();
    const onDismiss = vi.fn();
    render(<ChatFailureNotice failure={{ text: "hi", kind }} pending={false} onRetry={onRetry} onDismiss={onDismiss} />);
    expect(screen.getByRole("alert")).toHaveTextContent(CHAT_FAILURE_MESSAGES[kind]);
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue manually" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // Trying again can't clear a daily cap or a Lenore that isn't set up, so it isn't offered.
  it.each(["daily_cap", "unavailable"] as AiFailureKind[])("%s: says why, and offers only Continue manually", (kind) => {
    const onDismiss = vi.fn();
    render(<ChatFailureNotice failure={{ text: "hi", kind }} pending={false} onRetry={vi.fn()} onDismiss={onDismiss} />);
    expect(screen.getByRole("alert")).toHaveTextContent(CHAT_FAILURE_MESSAGES[kind]);
    // The words don't promise a retry; they say the prospect can carry on in the workspace.
    expect(CHAT_FAILURE_MESSAGES[kind]).not.toMatch(/try again/i);
    expect(CHAT_FAILURE_MESSAGES[kind]).toMatch(/keep filling in the workspace yourself/);
    expect(screen.queryByRole("button", { name: /Try again/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue manually" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("keeps the message for a daily cap, Lenore not being set up, a provider outage, a timeout and any other failure", () => {
    for (const kind of ["daily_cap", "timeout", "unavailable", "unreachable", "failed"] as const) {
      expect(CHAT_FAILURE_MESSAGES[kind]).toMatch(/message is saved/);
    }
  });
});
