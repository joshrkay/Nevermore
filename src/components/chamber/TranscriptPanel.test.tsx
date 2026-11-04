import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import TranscriptPanel from "./TranscriptPanel";
import ChatFailureNotice from "./ChatFailureNotice";
import { CHAT_FAILURE_MESSAGES, type AiFailureKind } from "@/data/aiFailure";
import { createChatMessage, type ChatMessage } from "@/data/chat";

// jsdom lays nothing out: give the conversation a height, a viewport and a scroll position to work with.
const SCROLL_HEIGHT = 1000;
const CLIENT_HEIGHT = 200;
const scrollTo = vi.fn(function (this: HTMLElement & { _top?: number }, options?: ScrollToOptions) {
  if (options?.top !== undefined) this._top = options.top;
});
const saved = {
  scrollHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight"),
  clientHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight"),
  scrollTop: Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop"),
  scrollTo: HTMLElement.prototype.scrollTo,
};
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => SCROLL_HEIGHT });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => CLIENT_HEIGHT });
  Object.defineProperty(Element.prototype, "scrollTop", {
    configurable: true,
    get(this: { _top?: number }) { return this._top ?? 0; },
    set(this: { _top?: number }, value: number) { this._top = value; },
  });
  HTMLElement.prototype.scrollTo = scrollTo as unknown as typeof HTMLElement.prototype.scrollTo;
});
afterAll(() => {
  if (saved.scrollHeight) Object.defineProperty(HTMLElement.prototype, "scrollHeight", saved.scrollHeight);
  if (saved.clientHeight) Object.defineProperty(HTMLElement.prototype, "clientHeight", saved.clientHeight);
  if (saved.scrollTop) Object.defineProperty(Element.prototype, "scrollTop", saved.scrollTop);
  HTMLElement.prototype.scrollTo = saved.scrollTo;
});

const conversation = (n: number): ChatMessage[] =>
  Array.from({ length: n }, (_, i) => createChatMessage(i % 2 ? "user" : "lenore", `message ${i}`));
const panel = (messages: ChatMessage[], restoredThrough: string | null = null) =>
  <TranscriptPanel messages={messages} onSendMessage={vi.fn()} restoredThrough={restoredThrough} />;
const scroller = () => screen.getByTestId("transcript-scroll") as HTMLElement & { _top?: number };
const scrollUpToRead = () => {
  scroller().scrollTop = 0;
  fireEvent.scroll(scroller());
};

describe("TranscriptPanel", () => {
  beforeEach(() => scrollTo.mockClear());

  it("opens a restored conversation at its latest message at once, without animating through it", () => {
    render(panel(conversation(12)));
    expect(scroller().scrollTop).toBe(SCROLL_HEIGHT);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("marks where the restored conversation ends", () => {
    const messages = conversation(4);
    render(panel([...messages, createChatMessage("lenore", "new today")], messages[3].id));
    const divider = screen.getByRole("separator");
    expect(divider).toHaveTextContent("Restored from your last visit");
    // Between the last restored message and the first new one.
    expect(divider.previousElementSibling).toHaveTextContent("message 3");
    expect(divider.nextElementSibling).toHaveTextContent("new today");
  });

  it("shows the Chamber's notes apart from the conversation, and each message's time", () => {
    const at = new Date("2026-11-04T14:34:05Z");
    const note = createChatMessage("system", "Voice call started", { now: at });
    const said = createChatMessage("user", "We have twelve people", { now: at, spoken: true });
    render(panel([note, said, { id: "old", sender: "lenore", text: "Saved before times had dates", timestamp: "02:34 PM" }]));
    const time = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    expect(screen.getByText("Voice call started").closest("p")).toHaveTextContent(`Voice call started · ${time}`);
    expect(screen.getByText("We have twelve people").parentElement).toHaveTextContent(time);
    expect(screen.getByText("02:34 PM")).toBeInTheDocument();
    expect(screen.queryByText(at.toISOString())).not.toBeInTheDocument();
  });

  it("shows no marker for a conversation that wasn't restored", () => {
    render(panel(conversation(3)));
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("follows new messages while the reader is at the latest one", () => {
    const messages = conversation(3);
    const { rerender } = render(panel(messages));
    rerender(panel([...messages, createChatMessage("lenore", "reply")]));
    expect(scrollTo).toHaveBeenCalledWith({ top: SCROLL_HEIGHT, behavior: "smooth" });
  });

  it("leaves a reader who scrolled up where they are, and offers a way down", () => {
    const messages = conversation(10);
    const { rerender } = render(panel(messages));
    scrollUpToRead();
    rerender(panel([...messages, createChatMessage("lenore", "reply")]));
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scroller().scrollTop).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: /new message/i }));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /new message/i })).not.toBeInTheDocument();
  });

  it("always shows the prospect's own message, even when they had scrolled up", () => {
    const messages = conversation(10);
    const { rerender } = render(panel(messages));
    scrollUpToRead();
    rerender(panel([...messages, createChatMessage("user", "my answer")]));
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("drops the way-down button once the reader scrolls back to the latest message", () => {
    const messages = conversation(10);
    const { rerender } = render(panel(messages));
    scrollUpToRead();
    rerender(panel([...messages, createChatMessage("lenore", "reply")]));
    scroller().scrollTop = SCROLL_HEIGHT - CLIENT_HEIGHT;
    fireEvent.scroll(scroller());
    expect(screen.queryByRole("button", { name: /new message/i })).not.toBeInTheDocument();
  });

  // Whether or not trying again is offered, the prospect keeps their words and can carry on typing.
  it.each(Object.keys(CHAT_FAILURE_MESSAGES) as AiFailureKind[])("%s: keeps the prospect's message on screen and the input usable", (kind) => {
    const onSendMessage = vi.fn();
    const notice = <ChatFailureNotice failure={{ text: "We have 12 staff", kind }} pending={false} onRetry={vi.fn()} onDismiss={vi.fn()} />;
    render(<TranscriptPanel messages={[createChatMessage("user", "We have 12 staff")]} onSendMessage={onSendMessage} notice={notice} />);
    expect(screen.getByText("We have 12 staff")).toBeInTheDocument();
    const input = screen.getByPlaceholderText("Type a message...");
    expect(input).toBeEnabled();
    fireEvent.change(input, { target: { value: "And they're all in Texas" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSendMessage).toHaveBeenCalledWith("And they're all in Texas");
  });
});
