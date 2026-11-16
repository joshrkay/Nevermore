import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Seam 2 (D-13): an advisor follows up with a PEO, or withdraws the submission from it, on the PEO's own thread from its card (M-2.4), with the
// database faked at its API module and the mailbox check at advisorApi, as useFirstSend (6.1) reads it.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const fetchMyMailbox = vi.fn();
vi.mock("@/lib/advisorApi", () => ({ fetchMyMailbox: () => fetchMyMailbox() }));
vi.mock("@/lib/brokerAuth", () => ({ startBrokerSignIn: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const followUpPeo = vi.fn();
const withdrawFromPeo = vi.fn();
vi.mock("@/lib/peoFollowUpApi", () => ({
  followUpPeo: (...a: unknown[]) => followUpPeo(...a),
  withdrawFromPeo: (...a: unknown[]) => withdrawFromPeo(...a),
}));

const { default: FollowUpOrWithdraw } = await import("./FollowUpOrWithdraw");

const issueLink = vi.fn();
const props = {
  quoteRequestId: 7, peo: "Insperity", companyName: "Reyes Bakery", fileId: "EAA-2026-0042", version: 1, certifiedVersion: 1, sentOn: "2026-11-03",
  lastSent: { to: ["dana@insperity.example"], subject: "Reyes Bakery: EAA-2026-0042, version 1" },
  returnTo: "/advisor/submissions/s1", issueLink, onDone: vi.fn(),
};

describe("FollowUpOrWithdraw", () => {
  beforeEach(() => {
    fetchMyMailbox.mockReset();
    followUpPeo.mockReset();
    withdrawFromPeo.mockReset();
    fetchMyMailbox.mockResolvedValue({ connected: true, provider: "google", address: "sam@acme.example" });
  });

  // Break caught: a follow-up that opens empty (no default text kept in code), sends the default the advisor replaced, goes to someone the PEO was
  // never sent to, starts a new subject, or goes without its fresh link.
  it("opens a follow-up with its default text, to the people the PEO was sent to, and sends what the advisor edited with a fresh link", async () => {
    followUpPeo.mockResolvedValue({ quoteRequestId: 7, messageId: 52 });
    render(<FollowUpOrWithdraw {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Follow up with Insperity" }));
    const form = await screen.findByRole("form", { name: "Follow up with Insperity" });
    expect(within(form).getByLabelText("To")).toHaveValue("dana@insperity.example");
    expect(within(form).getByLabelText("Subject")).toHaveValue("Re: Reyes Bakery: EAA-2026-0042, version 1");
    expect((within(form).getByLabelText("Your note") as HTMLTextAreaElement).value).toContain("following up on Reyes Bakery");
    fireEvent.change(within(form).getByLabelText("Your note"), { target: { value: "Dana, any news on Reyes Bakery?" } });
    fireEvent.click(within(form).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(followUpPeo).toHaveBeenCalledTimes(1));
    expect(followUpPeo.mock.calls[0][0]).toEqual({
      quoteRequestId: 7, to: ["dana@insperity.example"], subject: "Re: Reyes Bakery: EAA-2026-0042, version 1", note: "Dana, any news on Reyes Bakery?", issueLink,
    });
  });

  // Break caught: a follow-up whose fresh link is built from a newer certified version than the PEO was sent (that is an update, M-2.3), so the PEO
  // gets answers it was never sent under a follow-up's words.
  it("offers no follow-up when a newer version was certified since the send, and says why; a withdrawal is still offered", () => {
    render(<FollowUpOrWithdraw {...props} certifiedVersion={2} />);
    expect(screen.queryByRole("button", { name: "Follow up with Insperity" })).not.toBeInTheDocument();
    expect(screen.getByText("Insperity was sent version 1 and version 2 is certified since: send it an update instead of a follow-up.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Withdraw from Insperity" })).toBeInTheDocument();
  });

  // Break caught: a withdrawal with no reason recorded, one whose reason the PEO would read, or one that opens empty instead of with its default text.
  it("withdraws with its default text and a reason the advisor must choose, which is for advisors only", async () => {
    withdrawFromPeo.mockResolvedValue({ quoteRequestId: 7, messageId: 53 });
    render(<FollowUpOrWithdraw {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw from Insperity" }));
    const form = await screen.findByRole("form", { name: "Withdraw from Insperity" });
    expect((within(form).getByLabelText("Your note") as HTMLTextAreaElement).value).toContain("withdraw Reyes Bakery");
    expect(within(form).getByRole("button", { name: "Send" })).toBeDisabled();
    expect(within(form).getByText("Only advisors see the reason; Insperity is not told it.")).toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText("Why (for advisors only)"), { target: { value: "peo_not_a_fit" } });
    fireEvent.click(within(form).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(withdrawFromPeo).toHaveBeenCalledTimes(1));
    expect(withdrawFromPeo.mock.calls[0][0]).toMatchObject({ quoteRequestId: 7, to: ["dana@insperity.example"], reason: "peo_not_a_fit" });
    expect(withdrawFromPeo.mock.calls[0][0].note).toContain("withdraw Reyes Bakery");
  });
});
