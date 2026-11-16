import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Conversation, ConversationMessage } from "@/lib/conversationApi";

// The place to write on a record's page (story CRM-E1.2, slice 6.3; CRM-C1.1's and CRM-L2.1's states; D-602, D-605, D-634, D-651, D-652, D-653).
// The database's rules (who may write, Do not email, the files a message may carry) are tested in supabase/tests/conversation_files.sql and
// conversations.sql; here a faked client answers and the place to write draws it.

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const fetchMyMailbox = vi.fn();
vi.mock("@/lib/advisorApi", () => ({ fetchMyMailbox: () => fetchMyMailbox() }));
const startBrokerSignIn = vi.fn();
vi.mock("@/lib/brokerAuth", () => ({ startBrokerSignIn: (...a: unknown[]) => startBrokerSignIn(...a) }));
const api = { getConversation: vi.fn(), sendConversationMessage: vi.fn(), workTheQueue: vi.fn(), listAttachableFiles: vi.fn() };
vi.mock("@/lib/conversationApi", async () => ({ ...(await vi.importActual<object>("@/lib/conversationApi")), ...api }));

const { default: PlaceToWrite } = await import("./PlaceToWrite");

const connected = { connected: true, provider: "google", address: "dana@acme.example" };
const conversation = (messages: ConversationMessage[] = [], mailbox = { connected: true, lastSendFailed: false }): Conversation => ({
  conversationId: messages.length ? "v1" : null, messages, mailbox,
});
const recipient = { contactId: "c1", name: "Elena Marsh", email: "elena@harborview.example", doNotEmail: false, accountId: "a1" };

const renderPlace = (over: Partial<typeof recipient> = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PlaceToWrite firmId="f1" recipient={{ ...recipient, ...over }} returnTo="/contacts/c1" />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  for (const fn of [...Object.values(api), fetchMyMailbox, startBrokerSignIn]) fn.mockReset();
  fetchMyMailbox.mockResolvedValue(connected);
  api.getConversation.mockResolvedValue(conversation());
  api.workTheQueue.mockResolvedValue(undefined);
  api.listAttachableFiles.mockResolvedValue([]);
  try { window.sessionStorage.clear(); } catch { /* none */ }
});

describe("PlaceToWrite: the states", () => {
  // Catches: an empty conversation shown as a blank panel, or with no way to write the first message.
  it("with no emails yet, says so and offers the place to write", async () => {
    renderPlace();
    const place = await screen.findByRole("region", { name: "Emails" });
    expect(await within(place).findByText("No emails yet")).toBeInTheDocument();
    expect(within(place).getByLabelText("Subject")).toBeInTheDocument();
    expect(within(place).getByLabelText("Message")).toBeInTheDocument();
    expect(within(place).getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  // Catches: a place to write offered before the conversation is known (a first message written over mail it didn't show), or a loading panel with no heading.
  it("while loading, shows the heading with grey lines and no place to write yet", async () => {
    api.getConversation.mockReturnValue(new Promise(() => {}));
    renderPlace();
    const place = await screen.findByRole("region", { name: "Emails" });
    expect(within(place).getByRole("status", { name: "Loading emails" })).toBeInTheDocument();
    expect(within(place).queryByLabelText("Subject")).toBeNull();
    expect(within(place).queryByText("No emails yet")).toBeNull();
  });

  // Catches: a place to write offered with no mailbox to send from (CRM-C1.1, CRM-L2.1: it is replaced by the line, with the connect buttons).
  it("with no mailbox, the place to write is replaced by \"Connect your email to write from here\" with the connect buttons", async () => {
    fetchMyMailbox.mockResolvedValue({ connected: false });
    api.getConversation.mockResolvedValue(conversation([], { connected: false, lastSendFailed: false }));
    renderPlace();
    const place = await screen.findByRole("region", { name: "Emails" });
    expect(await within(place).findByText("Connect your email to write from here")).toBeInTheDocument();
    expect(within(place).getByRole("button", { name: "Connect Google" })).toBeInTheDocument();
    expect(within(place).queryByLabelText("Subject")).toBeNull();
    expect(within(place).queryByRole("button", { name: "Send" })).toBeNull();
  });

  // Catches: a contact marked Do not email offered a place to write, or a connect button (CRM-C1.1: it hides the place to write and says why).
  it("for a contact marked Do not email, says so and offers nothing to write or connect", async () => {
    fetchMyMailbox.mockResolvedValue({ connected: false });
    api.getConversation.mockResolvedValue(conversation([], { connected: false, lastSendFailed: false }));
    renderPlace({ doNotEmail: true });
    const place = await screen.findByRole("region", { name: "Emails" });
    expect(await within(place).findByText("This contact is marked Do not email, so nothing can be written to them from here.")).toBeInTheDocument();
    expect(within(place).queryByLabelText("Subject")).toBeNull();
    expect(within(place).queryByRole("button")).toBeNull();
    expect(within(place).queryByText("Connect your email to write from here")).toBeNull();
  });

  // Catches: a place to write for a contact with no address (the database refuses it, PT409), instead of CRM-C1.1's "No email address on file".
  it("for a contact with no email address, says to add one and offers nothing to write", async () => {
    renderPlace({ email: null });
    const place = await screen.findByRole("region", { name: "Emails" });
    expect(await within(place).findByText("No email address on file. Add one to write from here.")).toBeInTheDocument();
    expect(within(place).queryByLabelText("Subject")).toBeNull();
  });
});

const message = (over: Partial<ConversationMessage> = {}): ConversationMessage => ({
  id: "m1", direction: "outbound", from: "dana@acme.example", to: ["elena@harborview.example"], subject: "Your renewal", body: "Hi Elena, the renewal is in.",
  status: "sent", failureKind: null, failureReason: null, at: "2026-11-10T15:00:00+00:00", ...over,
});
const reply = message({ id: "m2", direction: "inbound", from: "elena@harborview.example", to: ["c.harborview.0123456789abcdef@reply.example"], subject: "Re: Your renewal",
  body: "Thanks, can we talk Friday?", at: "2026-11-11T09:00:00+00:00" });

describe("PlaceToWrite: the conversation", () => {
  // Catches: the conversation in the wrong order, received mail left out (as conversation_for returns it, 6.4), or a message that doesn't say which way it went.
  it("lists the messages newest first, sent and received, each with who, the subject and what was said", async () => {
    api.getConversation.mockResolvedValue(conversation([reply, message()]));
    renderPlace();
    const list = await screen.findByRole("list", { name: "Emails with Elena Marsh" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Received");
    expect(items[0]).toHaveTextContent("elena@harborview.example");
    expect(items[0]).toHaveTextContent("Re: Your renewal");
    expect(items[0]).toHaveTextContent("Thanks, can we talk Friday?");
    expect(items[1]).toHaveTextContent("Sent");
    expect(items[1]).toHaveTextContent("Your renewal");
    expect(items[1]).toHaveTextContent("Hi Elena, the renewal is in.");
    expect(screen.queryByText("No emails yet")).toBeNull();
  });
});

const write = async (subject: string, body: string) => {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Subject"), subject);
  await user.type(screen.getByLabelText("Message"), body);
  return user;
};

describe("PlaceToWrite: sending", () => {
  // Catches: a send that goes around send_conversation_message (or the first-send check), or a Send that can be pressed twice while one is on its way.
  it("sends the subject and message through send_conversation_message, showing Sending while it goes", async () => {
    let answer: (v: unknown) => void = () => {};
    api.sendConversationMessage.mockReturnValue(new Promise((r) => { answer = r; }));
    renderPlace();
    const user = await write("Your renewal", "Hi Elena");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("button", { name: "Sending…" })).toBeDisabled();
    expect(fetchMyMailbox).toHaveBeenCalled();
    expect(api.sendConversationMessage).toHaveBeenCalledWith("f1", { contactId: "c1", subject: "Your renewal", body: "Hi Elena", inReplyTo: null, documentIds: [] });
    answer(message({ status: "queued" }));
  });

  // Catches: a sent message left in the boxes (sent twice by a second press), the queue not worked at once (it would wait for the minute schedule), or
  // the conversation not asked again, so the message written doesn't show, on its way and then sent.
  it("once recorded, empties the boxes, works the queue and shows the message on its way, then sent", async () => {
    api.sendConversationMessage.mockResolvedValue(message({ status: "queued" }));
    renderPlace();
    const user = await write("Your renewal", "Hi Elena");
    api.getConversation.mockResolvedValue(conversation([message({ status: "queued" })]));
    await user.click(screen.getByRole("button", { name: "Send" }));
    const list = await screen.findByRole("list", { name: "Emails with Elena Marsh" });
    expect(within(list).getByRole("listitem")).toHaveTextContent("On its way");
    expect(screen.getByLabelText("Subject")).toHaveValue("");
    expect(screen.getByLabelText("Message")).toHaveValue("");
    expect(api.workTheQueue).toHaveBeenCalled();
  });

  // Catches: a message that didn't go shown as sent, its reason hidden, or the mailbox refusal (D-632, kind mailbox) left without Reconnect (D-651).
  it("a message that didn't go says so with its reason, and the mailbox line offers Reconnect", async () => {
    fetchMyMailbox.mockResolvedValue({ connected: false });
    const failed = message({ status: "failed", failureKind: "mailbox", failureReason: "Google or Microsoft wouldn't let Nevermore send as you. Nothing was sent; connect your mailbox again." });
    api.getConversation.mockResolvedValue(conversation([failed], { connected: false, lastSendFailed: true }));
    renderPlace();
    const item = within(await screen.findByRole("list", { name: "Emails with Elena Marsh" })).getByRole("listitem");
    expect(item).toHaveTextContent("Didn't go");
    expect(item).toHaveTextContent("wouldn't let Nevermore send as you");
    expect(item).not.toHaveTextContent(/^Sent/);
    expect(await screen.findByRole("button", { name: "Reconnect Google" })).toBeInTheDocument();
  });

  // Catches: a send the database refused (Do not email set meanwhile, a file not allowed, a closing firm) said nowhere, or the message lost with it.
  it("a send the database refuses says why in its words and keeps what was written", async () => {
    api.sendConversationMessage.mockRejectedValue(new Error("This contact is marked Do not email."));
    renderPlace();
    const user = await write("Your renewal", "Hi Elena");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("This contact is marked Do not email.")).toBeInTheDocument();
    expect(screen.getByLabelText("Subject")).toHaveValue("Your renewal");
    expect(screen.getByLabelText("Message")).toHaveValue("Hi Elena");
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  // Catches: a reply sent as a new thread (no In-Reply-To, so the client's mail program doesn't thread it, D-635), or a reply that doesn't say what it answers.
  it("replying to a message names it, and the send carries it as the message answered", async () => {
    api.getConversation.mockResolvedValue(conversation([reply, message()]));
    api.sendConversationMessage.mockResolvedValue(message({ id: "m3", status: "queued" }));
    renderPlace();
    const user = userEvent.setup();
    const items = within(await screen.findByRole("list", { name: "Emails with Elena Marsh" })).getAllByRole("listitem");
    await user.click(within(items[0]).getByRole("button", { name: "Reply" }));
    expect(screen.getByText(/Replying to/)).toHaveTextContent("Replying to “Re: Your renewal”");
    expect(screen.getByLabelText("Subject")).toHaveValue("Re: Your renewal");
    await user.type(screen.getByLabelText("Message"), "Friday works");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(api.sendConversationMessage).toHaveBeenCalledWith("f1", expect.objectContaining({ inReplyTo: "m2", subject: "Re: Your renewal" })));
  });
});

describe("PlaceToWrite: files", () => {
  // Catches: a file sent as an attachment, or from anywhere but the account's files the database offers (passed the virus check, one the agent may open,
  // D-605), or a ticked file left off the send.
  it("offers the account's files, each to go as an expiring link, and sends the ones ticked", async () => {
    api.listAttachableFiles.mockResolvedValue([
      { id: "d1", fileName: "census.xlsx", category: "employee_census" },
      { id: "d2", fileName: "loss-runs.pdf", category: "workers_comp_loss_runs" },
    ]);
    api.sendConversationMessage.mockResolvedValue(message({ status: "queued" }));
    renderPlace();
    const user = await write("Your census", "Here it is");
    const files = await screen.findByRole("group", { name: "Files from the account" });
    expect(files).toHaveTextContent("Each goes as a link that stops working after 30 days, never as an attachment.");
    await user.click(within(files).getByRole("checkbox", { name: "census.xlsx" }));
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(api.sendConversationMessage).toHaveBeenCalledWith("f1", expect.objectContaining({ documentIds: ["d1"] })));
    expect(api.listAttachableFiles).toHaveBeenCalledWith("f1", "c1");
  });
});

describe("PlaceToWrite: the unsent draft", () => {
  // Catches: what was written lost on the trip to Google or Microsoft to connect (the page is left and come back to, D-653), or a sent message coming back.
  it("keeps what was written when the page is left and come back to, and forgets it once sent", async () => {
    const first = renderPlace();
    const user = await write("Your renewal", "Hi Elena");
    first.unmount();
    const second = renderPlace();
    expect(await screen.findByLabelText("Subject")).toHaveValue("Your renewal");
    expect(screen.getByLabelText("Message")).toHaveValue("Hi Elena");
    api.sendConversationMessage.mockResolvedValue(message({ status: "queued" }));
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByLabelText("Subject")).toHaveValue(""));
    second.unmount();
    renderPlace();
    expect(await screen.findByLabelText("Subject")).toHaveValue("");
  });
});
