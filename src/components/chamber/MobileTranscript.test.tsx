// The conversation on a phone (US-2.3c): every one of Lenore's replies can be read in full, not only the line the orb
// repeats (which stops at 120 characters).
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import MobileTranscript from "./MobileTranscript";
import type { ChatMessage } from "@/data/chat";

const message = (id: string, sender: ChatMessage["sender"], text: string): ChatMessage => ({ id, sender, text, timestamp: "2026-11-04T10:00:00.000Z" });
const LONG_REPLY =
  "Thank you, that's very helpful. Since the census comes only from a file, the easiest way is the census template on the Upload tab: download it, fill in one row per employee with their date of birth, work state, title and pay, and upload it there. Meanwhile, how often do you run payroll?";

describe("MobileTranscript", () => {
  it("opens the whole conversation, with each of Lenore's replies in full", () => {
    expect(LONG_REPLY.length).toBeGreaterThan(120);
    render(
      <MobileTranscript
        messages={[message("m1", "lenore", "Welcome to the Chamber."), message("m2", "user", "We're Acme, 12 people."), message("m3", "lenore", LONG_REPLY)]}
        onSendMessage={vi.fn()}
      />,
    );
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Conversation" }));
    const dialog = screen.getByRole("dialog", { name: "Conversation with Lenore" });
    const log = within(dialog).getByRole("log", { name: "Conversation with Lenore" });
    expect(within(log).getByText("Welcome to the Chamber.")).toBeInTheDocument();
    expect(within(log).getByText("We're Acme, 12 people.")).toBeInTheDocument();
    expect(within(log).getByText(LONG_REPLY)).toBeInTheDocument();
  });

  it("lets the prospect write from the open conversation, and shows a notice there", () => {
    const onSendMessage = vi.fn();
    render(<MobileTranscript messages={[]} onSendMessage={onSendMessage} notice={<p>Lenore couldn't respond.</p>} />);
    fireEvent.click(screen.getByRole("button", { name: "Conversation" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Lenore couldn't respond.")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByPlaceholderText("Type a message..."), { target: { value: "Weekly." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }));
    expect(onSendMessage).toHaveBeenCalledWith("Weekly.");
  });
});
