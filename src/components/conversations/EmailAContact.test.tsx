import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

// "Email" on an account's page and an opportunity's (story CRM-E1.2's first criterion, slice 6.3): it asks which contact, then opens the same place to
// write as the contact's page. The place to write's own states are PlaceToWrite.test.tsx's.

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const fetchMyMailbox = vi.fn();
vi.mock("@/lib/advisorApi", () => ({ fetchMyMailbox: () => fetchMyMailbox() }));
vi.mock("@/lib/brokerAuth", () => ({ startBrokerSignIn: vi.fn() }));
const api = { getConversation: vi.fn(), sendConversationMessage: vi.fn(), workTheQueue: vi.fn(), listAttachableFiles: vi.fn() };
vi.mock("@/lib/conversationApi", async () => ({ ...(await vi.importActual<object>("@/lib/conversationApi")), ...api }));

const { default: EmailAContact } = await import("./EmailAContact");

const choice = (id: string, name: string, over: object = {}) => ({ id, name, email: `${id}@harborview.example`, doNotEmail: false, isMain: false, ...over });
const contacts = [choice("c2", "Bo Lind"), choice("c1", "Elena Marsh", { isMain: true }), choice("c3", "Ana Ruiz")];

const renderEmail = (props: { firstId?: string | null } = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <EmailAContact firmId="f1" accountId="a1" loadContacts={async () => contacts} returnTo={(c) => `/accounts/a1?email=${c}`} {...props} />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  for (const fn of [...Object.values(api), fetchMyMailbox]) fn.mockReset();
  fetchMyMailbox.mockResolvedValue({ connected: true, provider: "google", address: "dana@acme.example" });
  api.getConversation.mockResolvedValue({ conversationId: null, messages: [], mailbox: { connected: true, lastSendFailed: false } });
  api.listAttachableFiles.mockResolvedValue([]);
});

describe("EmailAContact", () => {
  // Catches: an Email that writes to nobody in particular (or to the wrong contact), or that lists the main contact anywhere but first.
  it("asks which contact, the main contact first, then opens the place to write for the one chosen", async () => {
    const user = userEvent.setup();
    renderEmail();
    await user.click(screen.getByRole("button", { name: "Email" }));
    const dialog = await screen.findByRole("dialog", { name: "Which contact?" });
    const options = within(dialog).getAllByRole("button", { name: /^Write to / });
    expect(options.map((o) => o.textContent)).toEqual([expect.stringContaining("Elena Marsh"), expect.stringContaining("Bo Lind"), expect.stringContaining("Ana Ruiz")]);
    await user.click(within(dialog).getByRole("button", { name: /^Write to Bo Lind/ }));
    expect(await screen.findByRole("region", { name: "Emails" })).toBeInTheDocument();
    expect(api.getConversation).toHaveBeenCalledWith("f1", "c2");
  });

  // Catches: an opportunity's Email that doesn't put the opportunity's own main contact first (it may not be the account's main contact).
  it("on an opportunity, lists the opportunity's main contact first", async () => {
    const user = userEvent.setup();
    renderEmail({ firstId: "c3" });
    await user.click(screen.getByRole("button", { name: "Email" }));
    const dialog = await screen.findByRole("dialog", { name: "Which contact?" });
    const options = within(dialog).getAllByRole("button", { name: /^Write to / });
    expect(options[0]).toHaveTextContent("Ana Ruiz");
  });
});
