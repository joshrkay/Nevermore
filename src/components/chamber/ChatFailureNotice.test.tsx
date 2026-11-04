import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ChatFailureNotice from "./ChatFailureNotice";
import { CHAT_FAILURE_MESSAGES, type AiFailureKind } from "@/data/aiFailure";

describe("ChatFailureNotice", () => {
  it("says something different for each reason, all of them different", () => {
    expect(new Set(Object.values(CHAT_FAILURE_MESSAGES)).size).toBe(Object.keys(CHAT_FAILURE_MESSAGES).length);
  });

  it.each(Object.keys(CHAT_FAILURE_MESSAGES) as AiFailureKind[])("%s: says why, and offers Try again and Continue manually", (kind) => {
    const onRetry = vi.fn();
    const onDismiss = vi.fn();
    render(<ChatFailureNotice failure={{ text: "hi", kind }} pending={false} onRetry={onRetry} onDismiss={onDismiss} />);
    expect(screen.getByRole("alert")).toHaveTextContent(CHAT_FAILURE_MESSAGES[kind]);
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue manually" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("keeps the message for a daily cap, a rate limit, a provider outage and a timeout", () => {
    for (const kind of ["daily_cap", "timeout", "unavailable", "failed"] as const) {
      expect(CHAT_FAILURE_MESSAGES[kind]).toMatch(/message is saved/);
    }
  });
});
