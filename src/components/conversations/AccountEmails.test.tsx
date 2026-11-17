import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountMessage } from "@/lib/conversationApi";

// The mail with an account's contacts, on the account's and the opportunity's pages (story CRM-E1.3, slice 6.4; slice 6.3 draws it), and a new sender
// offered as a contact there (CRM-E1.3: "offered as a contact on that account"). The database's rules are in supabase/tests/conversation_replies.sql.

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const api = { getAccountMessages: vi.fn(), addSenderAsContact: vi.fn() };
vi.mock("@/lib/conversationApi", async () => ({ ...(await vi.importActual<object>("@/lib/conversationApi")), ...api }));

const { AccountEmails } = await import("./AccountEmails");

const message = (over: Partial<AccountMessage> = {}): AccountMessage => ({
  id: "m1", direction: "inbound", from: "elena@harborview.example", to: ["c.harborview.0123456789abcdef@reply.example"], subject: "Re: Your renewal", body: "Thanks.",
  status: "received", failureKind: null, failureReason: null, at: "2026-11-11T09:00:00+00:00", contactId: "c1", fromName: "Elena Marsh", newSender: false, offerContact: false, ...over,
});
const stranger = message({ id: "m2", from: "aisha.khan@harborview.example", fromName: "Aisha Khan", newSender: true, offerContact: true, subject: "Elena is out", at: "2026-11-12T09:00:00+00:00" });

const renderEmails = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AccountEmails firmId="f1" accountId="a1" contactName={(id) => (id === "c1" ? "Elena Marsh" : null)} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
});

describe("AccountEmails: a new sender", () => {
  // Catches: a new sender's message offered nowhere on the account (they stay a stranger in a contact's conversation), or offered on every received message.
  it("offers a new sender as a contact on their message only", async () => {
    api.getAccountMessages.mockResolvedValue([stranger, message()]);
    renderEmails();
    const items = within(await screen.findByRole("list", { name: "Emails with the account's contacts" })).getAllByRole("listitem");
    expect(within(items[0]).getByRole("button", { name: "Add as contact" })).toBeInTheDocument();
    expect(within(items[1]).queryByRole("button", { name: "Add as contact" })).toBeNull();
  });

  // Catches: a stranger's message said to be "Received from" the contact whose conversation it landed on, which names the wrong person.
  it("says who the new sender is, and whose conversation it arrived on", async () => {
    api.getAccountMessages.mockResolvedValue([stranger, message()]);
    renderEmails();
    const items = within(await screen.findByRole("list", { name: "Emails with the account's contacts" })).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Received from Aisha Khan");
    expect(items[0]).toHaveTextContent("on Elena Marsh's emails");
    expect(items[1]).toHaveTextContent("Received from Elena Marsh");
  });

  // Catches: the list not asked again after an add, so a sender who is now a contact is still offered and could be added twice.
  it("after the sender is added, asks for the mail again and the offer is gone", async () => {
    api.getAccountMessages.mockResolvedValue([stranger, message()]);
    api.addSenderAsContact.mockResolvedValue({ id: "k9" });
    renderEmails();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Add as contact" }));
    api.getAccountMessages.mockResolvedValue([{ ...stranger, offerContact: false }, message()]);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Add contact" }));
    await waitFor(() => expect(api.addSenderAsContact).toHaveBeenCalledWith("f1", "m2", { firstName: "Aisha", lastName: "Khan", title: "", phone: "" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Add as contact" })).toBeNull());
  });
});
