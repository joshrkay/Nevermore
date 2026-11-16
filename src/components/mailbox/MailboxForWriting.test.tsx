import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "marcus@advisory.example" }, signOut: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const fetchMyMailbox = vi.fn();
vi.mock("@/lib/advisorApi", () => ({ fetchMyMailbox: () => fetchMyMailbox() }));
const startBrokerSignIn = vi.fn();
vi.mock("@/lib/brokerAuth", () => ({ startBrokerSignIn: (...a: unknown[]) => startBrokerSignIn(...a) }));

const { default: MailboxForWriting } = await import("./MailboxForWriting");

describe("MailboxForWriting (the mailbox line on every place to write, CRM-E1.1)", () => {
  beforeEach(() => {
    fetchMyMailbox.mockReset();
    startBrokerSignIn.mockReset();
    vi.mocked(toast.error).mockReset();
    fetchMyMailbox.mockResolvedValue({ connected: false });
    startBrokerSignIn.mockResolvedValue(undefined);
  });

  // Catches: a place to write with no mailbox that gives no way to connect one from there.
  it("with no mailbox, asks to connect one from here, with Google and Microsoft", async () => {
    render(<MailboxForWriting returnTo="/contacts/c1" />);
    expect(await screen.findByText("Connect your email to write from here")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Microsoft" })).toBeInTheDocument();
  });

  // Catches: connecting from a place to write by any other way than the existing send-only sign-in, or coming back somewhere else.
  it("connects through the existing send-only sign-in and comes back to the place to write", async () => {
    render(<MailboxForWriting returnTo="/contacts/c1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Connect Microsoft" }));
    await waitFor(() => expect(startBrokerSignIn).toHaveBeenCalledWith("microsoft", "/contacts/c1"));
  });

  // Catches: a connected mailbox that still asks to connect, or doesn't say which address the message will go from.
  it("when connected, shows the address it sends from and Connected, and offers no Connect", async () => {
    fetchMyMailbox.mockResolvedValue({ connected: true, provider: "google", address: "marcus@advisory.example" });
    render(<MailboxForWriting returnTo="/contacts/c1" />);
    const line = await screen.findByLabelText("Your mailbox");
    await waitFor(() => expect(line).toHaveTextContent("marcus@advisory.example"));
    expect(line).toHaveTextContent("Connected");
    expect(screen.queryByText("Connect your email to write from here")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Connect/ })).not.toBeInTheDocument();
  });

  // Catches: the provider taking the permission back (the token deleted, the newest send failed for a mailbox reason: D-634) told as a plain
  // "connect your email", as if nothing had happened, instead of saying so with Reconnect.
  it("after the provider took the permission back, says so with Reconnect", async () => {
    render(<MailboxForWriting returnTo="/contacts/c1" lastSendFailed />);
    const line = await screen.findByLabelText("Your mailbox");
    await waitFor(() => expect(line).toHaveTextContent(/no longer lets Nevermore send as you/));
    expect(line).toHaveTextContent(/last message didn't go/);
    expect(screen.queryByText("Connect your email to write from here")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reconnect Google" }));
    await waitFor(() => expect(startBrokerSignIn).toHaveBeenCalledWith("google", "/contacts/c1"));
    expect(screen.getByRole("button", { name: "Reconnect Microsoft" })).toBeInTheDocument();
  });

  // Catches: a send refused by Google or Microsoft (401 or 403: the token is kept, D-632) shown as a healthy "Connected", so the writer keeps
  // sending into the same refusal with no way to reconnect (D-651).
  it("still connected but the last send was refused for a mailbox reason: shows the address, says so, and offers Reconnect", async () => {
    fetchMyMailbox.mockResolvedValue({ connected: true, provider: "microsoft", address: "marcus@advisory.example" });
    render(<MailboxForWriting returnTo="/contacts/c1" lastSendFailed />);
    const line = await screen.findByLabelText("Your mailbox");
    await waitFor(() => expect(line).toHaveTextContent("marcus@advisory.example"));
    expect(line).toHaveTextContent(/last message didn't go/);
    expect(screen.getByRole("button", { name: "Reconnect Microsoft" })).toBeInTheDocument();
  });

  // Catches: a Connect that silently does nothing when the sign-in can't start.
  it("says so when connecting can't start", async () => {
    startBrokerSignIn.mockRejectedValue(new Error("down"));
    render(<MailboxForWriting returnTo="/contacts/c1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Connect Google" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Google")));
  });

  // Catches: a place to write that shows nothing at all, or claims there is no mailbox, when the mailbox couldn't be checked.
  it("says when the mailbox couldn't be checked, and tries again", async () => {
    fetchMyMailbox.mockRejectedValueOnce(new Error("boom")).mockResolvedValue({ connected: false });
    render(<MailboxForWriting returnTo="/contacts/c1" />);
    expect(await screen.findByText(/couldn't load your mailbox/)).toBeInTheDocument();
    expect(screen.queryByText("Connect your email to write from here")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Connect your email to write from here")).toBeInTheDocument();
  });
});
