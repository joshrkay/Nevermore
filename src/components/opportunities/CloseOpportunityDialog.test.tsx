import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const markOpportunityLost = vi.fn();
const markOpportunityWon = vi.fn();
vi.mock("@/lib/opportunityPageApi", async () => ({
  ...(await vi.importActual<object>("@/lib/opportunityPageApi")),
  markOpportunityLost: (...a: unknown[]) => markOpportunityLost(...a),
  markOpportunityWon: (...a: unknown[]) => markOpportunityWon(...a),
}));

const { CloseOpportunityDialog } = await import("./CloseOpportunityDialog");

// The offer to tell the PEOs still open when a search is closed (5.0y, D-1720, D-1724). The database decides who is told and refuses what it must; this holds that the dialog
// offers it, sends what the person left ticked and wrote, and says what it could not check.

const quote = (id: number, peoName: string, status: string) => ({ id, peoName, status, sentOn: "2026-11-01", quoteReceivedOn: null, quoteExpiresOn: null, adminFeePepm: null });
const sent = (quoteRequestId: number, subject: string) => ({ quote_request_id: quoteRequestId, direction: "sent", subject, recorded_at: "2026-11-02T10:00:00Z" });

const target = { id: "o1", version: 4, name: "Reyes search", targetStart: "2027-01-01", employees: 45 };
const onClose = vi.fn();
const onDone = vi.fn();

const open = async (over: Record<string, unknown> = {}) => {
  const user = userEvent.setup();
  render(
    <CloseOpportunityDialog
      firmId="f1" target={target} accountName="Reyes Bakery" quotes={[quote(1, "Insperity", "quoted"), quote(2, "TriNet", "sent")]} proposedStarts={{}} brokerDefault="Acme Brokers"
      initial="lost" mail={{ status: "ready", messages: [sent(1, "Reyes Bakery: version 1"), sent(2, "Reyes Bakery: version 1")] }} onClose={onClose} onDone={onDone} {...over}
    />,
  );
  const dialog = await screen.findByRole("dialog", { name: "Close this opportunity" });
  return { user, dialog };
};

beforeEach(() => {
  for (const m of [markOpportunityLost, markOpportunityWon, onClose, onDone]) m.mockReset();
  markOpportunityLost.mockResolvedValue({ conflict: false, stage: "lost", version: 5 });
});

describe("the dialog fits the window (D-1832)", () => {
  // Break caught: with the withdrawal offered the dialog is taller than a 900px window and its whole content scrolls as one, so Cancel and Mark lost sit below the fold. The body scrolls inside the viewport and the buttons stay in view.
  it("scrolls its body inside the window and keeps Cancel and Mark lost outside what scrolls", async () => {
    const { dialog } = await open();
    expect(dialog).toHaveClass("max-h-[90vh]", "overflow-hidden");
    const scroller = within(dialog).getByLabelText("The withdrawal").closest(".overflow-y-auto");
    expect(scroller).not.toBeNull();
    for (const name of ["Cancel", "Mark lost"]) expect(within(dialog).getByRole("button", { name }).closest(".overflow-y-auto")).toBeNull();
  });
});

describe("the withdrawal offered on Lost", () => {
  // Catches: a loss that closes the PEOs and tells none of them, so each learns from a link that no longer opens.
  it("offers the PEOs still open ticked, and a loss sent with it is one call that carries the subject and the note", async () => {
    const { user, dialog } = await open();
    expect(within(dialog).getByRole("checkbox", { name: "Send a withdrawal to Insperity and TriNet" })).toBeChecked();
    await user.selectOptions(within(dialog).getByLabelText("Reason"), "price");
    await user.click(within(dialog).getByRole("button", { name: "Mark lost" }));
    await waitFor(() => expect(markOpportunityLost).toHaveBeenCalledTimes(1));
    expect(markOpportunityLost).toHaveBeenCalledWith("f1", "o1", { reason: "price", note: "" }, 4, {
      subject: "Re: Reyes Bakery: version 1",
      body: expect.stringContaining("Please withdraw Reyes Bakery from consideration"),
    });
  });

  // Catches: a ticked box that cannot be unticked, so the advisor who wants to close quietly (the PEOs' links stop either way) has to tell them.
  it("closes with the plain call when the box is unticked", async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("checkbox", { name: "Send a withdrawal to Insperity and TriNet" }));
    await user.selectOptions(within(dialog).getByLabelText("Reason"), "price");
    await user.click(within(dialog).getByRole("button", { name: "Mark lost" }));
    await waitFor(() => expect(markOpportunityLost).toHaveBeenCalledTimes(1));
    expect(markOpportunityLost).toHaveBeenCalledWith("f1", "o1", { reason: "price", note: "" }, 4, undefined);
  });

  // Catches: a subject and note the advisor cannot change before they go to every PEO, or edits that are dropped for the default text.
  it("sends the subject and the note as the person edited them", async () => {
    const { user, dialog } = await open();
    const subject = within(dialog).getByLabelText("Subject");
    await user.clear(subject);
    await user.type(subject, "Re: Reyes, closed");
    const text = within(dialog).getByLabelText("The withdrawal");
    await user.clear(text);
    await user.type(text, "No longer needed.");
    await user.selectOptions(within(dialog).getByLabelText("Reason"), "price");
    await user.click(within(dialog).getByRole("button", { name: "Mark lost" }));
    await waitFor(() => expect(markOpportunityLost).toHaveBeenCalledTimes(1));
    expect(markOpportunityLost).toHaveBeenCalledWith("f1", "o1", { reason: "price", note: "" }, 4, { subject: "Re: Reyes, closed", body: "No longer needed." });
  });

  // Catches: a win that offers to withdraw from the PEO the employer chose, or one that offers a list before any quote is chosen.
  it("on Won, offers the other PEOs only once a quote is chosen, and never the one chosen", async () => {
    const { user, dialog } = await open({ initial: "won", quotes: [quote(1, "Insperity", "quoted"), quote(2, "TriNet", "quoted"), quote(3, "Justworks", "sent")], mail: { status: "ready", messages: [sent(1, "Reyes"), sent(2, "Reyes"), sent(3, "Reyes")] } });
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("radio", { name: /Insperity/ }));
    expect(within(dialog).getByRole("checkbox", { name: "Send a withdrawal to TriNet and Justworks" })).toBeChecked();
    await user.click(within(dialog).getByRole("radio", { name: /TriNet/ }));
    expect(within(dialog).getByRole("checkbox", { name: "Send a withdrawal to Insperity and Justworks" })).toBeChecked();
  });

  // Catches: a win that offers the withdrawal and then closes through the plain function, so the PEOs are never told.
  it("a win sent with the box ticked is one call that carries the subject and the note", async () => {
    markOpportunityWon.mockResolvedValue({ conflict: false, stage: "won", version: 5 });
    const { user, dialog } = await open({ initial: "won", quotes: [quote(1, "Insperity", "quoted"), quote(2, "TriNet", "quoted")] });
    await user.click(within(dialog).getByRole("radio", { name: /Insperity/ }));
    await user.click(within(dialog).getByRole("button", { name: "Mark won" }));
    await waitFor(() => expect(markOpportunityWon).toHaveBeenCalledTimes(1));
    expect(markOpportunityWon).toHaveBeenCalledWith("f1", "o1", { quoteRequestId: 1, startDate: "2027-01-01", renewalDate: "2028-01-01", brokerOfRecord: "Acme Brokers", commission: null }, 4, {
      subject: "Re: Reyes Bakery: version 1",
      body: expect.stringContaining("Please withdraw Reyes Bakery from consideration"),
    });
  });

  // Catches: a close made while the mail is still being read, which would skip a withdrawal the person had no chance to see offered.
  it("refuses to close while it is still checking which PEOs are open, and says so beside the button", async () => {
    const { user, dialog } = await open({ mail: { status: "loading" } });
    await user.selectOptions(within(dialog).getByLabelText("Reason"), "price");
    await user.click(within(dialog).getByRole("button", { name: "Mark lost" }));
    expect(await within(dialog).findByText("Still checking which PEOs are open. Try again in a moment.")).toBeInTheDocument();
    expect(markOpportunityLost).not.toHaveBeenCalled();
  });

  // Catches: a failed read taken for "no PEO is open" (a close that silently skips the withdrawal), or one that blocks the close for good.
  it("says it could not check which PEOs are open, offers no withdrawal, and still closes", async () => {
    const { user, dialog } = await open({ mail: { status: "failed" } });
    expect(within(dialog).getByText("We couldn't check which PEOs are still open, so no withdrawal is offered. Their links stop working either way.")).toBeInTheDocument();
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText("Reason"), "price");
    await user.click(within(dialog).getByRole("button", { name: "Mark lost" }));
    await waitFor(() => expect(markOpportunityLost).toHaveBeenCalledWith("f1", "o1", { reason: "price", note: "" }, 4, undefined));
  });

  // Catches: a workers' comp search closed under words about PEOs: the offer to tell who is still open names carriers (ADR 0029).
  it("offers to tell the carriers still open on a workers' comp search, and says PEO nowhere", async () => {
    const { dialog } = await open({ line: "workers_comp", quotes: [quote(1, "Granite Ridge Mutual", "quoted"), quote(2, "Summit Casualty", "sent")] });
    expect(within(dialog).getByRole("group", { name: "Tell the carriers still open" })).toBeInTheDocument();
    expect(within(dialog).getByRole("checkbox", { name: "Send a withdrawal to Granite Ridge Mutual and Summit Casualty" })).toBeChecked();
    // The reason for a loss is the same list, with going direct said of a carrier.
    expect(within(within(dialog).getByLabelText("Reason")).getAllByRole("option").map((o) => o.textContent)).toEqual(
      ["Choose a reason", "Stayed with current provider", "Price", "Went direct to a carrier", "No decision", "Other"]);
    expect(within(dialog).queryByText(/PEO/)).not.toBeInTheDocument();
  });

  // Catches: a workers' comp search told it is still checking which PEOs are open.
  it("says it is still checking which carriers are open, on a workers' comp search", async () => {
    const { user, dialog } = await open({ line: "workers_comp", mail: { status: "loading" } });
    await user.selectOptions(within(dialog).getByLabelText("Reason"), "price");
    await user.click(within(dialog).getByRole("button", { name: "Mark lost" }));
    expect(await within(dialog).findByText("Still checking which carriers are open. Try again in a moment.")).toBeInTheDocument();
    expect(markOpportunityLost).not.toHaveBeenCalled();
  });

  // Catches: a workers' comp search told the PEOs still open could not be checked.
  it("says it could not check which carriers are still open, on a workers' comp search", async () => {
    const { dialog } = await open({ line: "workers_comp", mail: { status: "failed" } });
    expect(within(dialog).getByText("We couldn't check which carriers are still open, so no withdrawal is offered. Their links stop working either way.")).toBeInTheDocument();
  });

  // Catches: a win that still sends the withdrawal after the person unticked it (only the loss was held to the box).
  it("(pinning) a win with the box unticked closes with the plain call", async () => {
    markOpportunityWon.mockResolvedValue({ conflict: false, stage: "won", version: 5 });
    const { user, dialog } = await open({ initial: "won", quotes: [quote(1, "Insperity", "quoted"), quote(2, "TriNet", "quoted")] });
    await user.click(within(dialog).getByRole("radio", { name: /Insperity/ }));
    await user.click(within(dialog).getByRole("checkbox", { name: "Send a withdrawal to TriNet" }));
    await user.click(within(dialog).getByRole("button", { name: "Mark won" }));
    await waitFor(() => expect(markOpportunityWon).toHaveBeenCalledTimes(1));
    expect(markOpportunityWon).toHaveBeenCalledWith("f1", "o1", expect.objectContaining({ quoteRequestId: 1 }), 4, undefined);
  });
});
