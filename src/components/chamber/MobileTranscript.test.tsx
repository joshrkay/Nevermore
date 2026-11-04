import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MobileTranscript from "./MobileTranscript";
import type { ChatMessage } from "@/data/chat";

const LONG_REPLY =
  "Thank you. I've noted Acme Logistics as the legal name and that you run payroll every two weeks. " +
  "Next, could you tell me which states your employees work in, including anyone fully remote, so the PEOs can quote correctly?";

const messages: ChatMessage[] = [
  { id: "1", sender: "user", text: "We're Acme Logistics, biweekly payroll.", timestamp: "2026-11-04T10:00:00.000Z" },
  { id: "2", sender: "lenore", text: LONG_REPLY, timestamp: "2026-11-04T10:00:05.000Z" },
];

describe("MobileTranscript", () => {
  it("opens the whole conversation, with every reply in full", () => {
    expect(LONG_REPLY.length).toBeGreaterThan(120); // longer than the orb's caption
    render(<MobileTranscript messages={messages} onSendMessage={vi.fn()} />);
    expect(screen.queryByText(LONG_REPLY)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Read the conversation" }));
    const sheet = screen.getByRole("dialog", { name: "Conversation with Lenore" });
    expect(within(sheet).getByText(LONG_REPLY)).toBeInTheDocument();
    expect(within(sheet).getByText("We're Acme Logistics, biweekly payroll.")).toBeInTheDocument();
    // Opening it to read doesn't put the cursor in the input (which would raise a phone's keyboard).
    expect(within(sheet).getByPlaceholderText("Type a message...")).not.toHaveFocus();
  });

  it("lets the prospect reply from it", () => {
    const onSendMessage = vi.fn();
    render(<MobileTranscript messages={messages} onSendMessage={onSendMessage} />);
    fireEvent.click(screen.getByRole("button", { name: "Read the conversation" }));
    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "California and Texas" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSendMessage).toHaveBeenCalledWith("California and Texas");
  });
});
