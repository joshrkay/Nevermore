import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "marcus@advisory.example" }, signOut: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const fetchMyMailbox = vi.fn();
vi.mock("@/lib/advisorApi", () => ({ fetchMyMailbox: () => fetchMyMailbox() }));
const startBrokerSignIn = vi.fn();
vi.mock("@/lib/brokerAuth", () => ({ startBrokerSignIn: (...a: unknown[]) => startBrokerSignIn(...a) }));

const { useFirstSend } = await import("./useFirstSend");

/** A place to write as 6.3 and 6.6 will have one: its Send goes through `beforeSend`, and it draws the hook's `choice`. */
function Writer({ send, ownMail }: { send: () => Promise<void>; ownMail?: Parameters<typeof useFirstSend>[0]["ownMail"] }) {
  const { beforeSend, choice } = useFirstSend({ returnTo: "/contacts/c1", ownMail });
  return (
    <div>
      <button type="button" onClick={() => void beforeSend(send)}>Send</button>
      {choice}
    </div>
  );
}

describe("useFirstSend (what the first send does with no mailbox, CRM-E1.1)", () => {
  beforeEach(() => {
    fetchMyMailbox.mockReset();
    startBrokerSignIn.mockReset();
    startBrokerSignIn.mockResolvedValue(undefined);
  });

  // Catches: a connected writer stopped and asked to connect before every send.
  it("with a mailbox connected, sends straight away and asks nothing", async () => {
    fetchMyMailbox.mockResolvedValue({ connected: true, provider: "google", address: "marcus@advisory.example" });
    const send = vi.fn().mockResolvedValue(undefined);
    render(<Writer send={send} />);
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // Catches: a first send with no mailbox that is attempted anyway (and refused, PT412) instead of offering to connect Google or Microsoft.
  it("with no mailbox, sends nothing and offers to connect Google or Microsoft, coming back to the place to write", async () => {
    fetchMyMailbox.mockResolvedValue({ connected: false });
    const send = vi.fn().mockResolvedValue(undefined);
    render(<Writer send={send} />);
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Connect your email to send this");
    expect(screen.getByRole("button", { name: "Connect Microsoft" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect Google" }));
    await waitFor(() => expect(startBrokerSignIn).toHaveBeenCalledWith("google", "/contacts/c1"));
    expect(send).not.toHaveBeenCalled();
    // Writing to a contact or a lead never offers to send it by hand: only a PEO send does (CRM-E1.1, D-652).
    expect(screen.queryByRole("button", { name: /own mail/ })).not.toBeInTheDocument();
  });

  // Catches: a PEO send with no mailbox that leaves no way to send it at all, or one sent by hand without the reply address in CC (the reply
  // would never reach the quote).
  it("on a PEO send, also offers sending from your own mail with the reply address in CC", async () => {
    fetchMyMailbox.mockResolvedValue({ connected: false });
    const send = vi.fn().mockResolvedValue(undefined);
    const onSendYourself = vi.fn();
    render(<Writer send={send} ownMail={{ replyAddress: "q.bay.00000000000000a1@reply.nevermore.example", onSendYourself }} />);
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("q.bay.00000000000000a1@reply.nevermore.example");
    expect(dialog).toHaveTextContent(/in CC/);
    fireEvent.click(screen.getByRole("button", { name: "Send from your own mail" }));
    expect(onSendYourself).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  // Catches: a Send that does nothing and says nothing (an unhandled rejection) when the mailbox couldn't be checked.
  it("when the mailbox can't be checked, sends nothing and says so", async () => {
    fetchMyMailbox.mockRejectedValue(new Error("Couldn't check your mailbox."));
    const send = vi.fn().mockResolvedValue(undefined);
    render(<Writer send={send} />);
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/couldn't check your mailbox.*nothing was sent/i)));
    expect(send).not.toHaveBeenCalled();
  });
});
