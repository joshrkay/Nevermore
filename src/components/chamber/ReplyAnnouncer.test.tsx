import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createChatMessage } from "@/data/chat";
import ReplyAnnouncer from "./ReplyAnnouncer";

const region = () => screen.getByTestId("reply-announcer");

describe("ReplyAnnouncer", () => {
  it("is a polite live region holding Lenore's latest reply, not the prospect's message", () => {
    const hello = createChatMessage("lenore", "Hello, I'm Lenore.");
    const { rerender } = render(<ReplyAnnouncer messages={[hello]} />);
    expect(region()).toHaveAttribute("aria-live", "polite");
    rerender(<ReplyAnnouncer messages={[hello, createChatMessage("user", "We have 12 people")]} />);
    expect(region()).toHaveTextContent("Lenore: Hello, I'm Lenore.");
    rerender(<ReplyAnnouncer messages={[hello, createChatMessage("user", "We have 12 people"), createChatMessage("lenore", "Thank you. What state are you in?")]} />);
    expect(region()).toHaveTextContent("Lenore: Thank you. What state are you in?");
    expect(region()).not.toHaveTextContent("Hello");
  });

  it("replaces the node for each reply, so the same words twice are read twice", () => {
    const first = createChatMessage("lenore", "Could you say that again?");
    const { rerender } = render(<ReplyAnnouncer messages={[first]} />);
    const before = region().firstElementChild;
    rerender(<ReplyAnnouncer messages={[first, createChatMessage("lenore", "Could you say that again?")]} />);
    expect(region().firstElementChild).not.toBe(before);
  });

  it("says nothing before Lenore has spoken", () => {
    render(<ReplyAnnouncer messages={[]} />);
    expect(region()).toBeEmptyDOMElement();
  });
});
