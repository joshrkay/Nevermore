import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import TranscriptEvidence from "./TranscriptEvidence";
import { formatMessageTime, type ChatMessage } from "@/data/chat";

const at = "2026-11-04T14:34:05.000Z";
const messages: ChatMessage[] = [
  { id: "m1", sender: "lenore", text: "How many people work for you?", timestamp: at },
  { id: "m2", sender: "system", text: "Voice call started", timestamp: at },
  { id: "m3", sender: "user", text: "About fifteen.", timestamp: at, spoken: true },
  { id: "m4", sender: "user", text: "Typed before times had dates", timestamp: "9:01 AM" },
];

describe("TranscriptEvidence", () => {
  it("says who each message is from, whether it was spoken, and when, in the order it happened", () => {
    render(<TranscriptEvidence messages={messages} highlighted="m3" />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.textContent?.split(" · ")[0])).toEqual(["Lenore", "System", "Prospect", "Prospect"]);
    const spoken = items[2];
    expect(spoken).toHaveAttribute("aria-current", "true");
    expect(spoken).toHaveTextContent(`Prospect · spoken · ${formatMessageTime(at, { withDate: true })}`);
    expect(within(spoken).getByText(formatMessageTime(at, { withDate: true }))).toHaveAttribute("datetime", at);
    expect(items[0]).not.toHaveTextContent("spoken");
    expect(items[3]).toHaveTextContent("Prospect · 9:01 AM");
  });
});
