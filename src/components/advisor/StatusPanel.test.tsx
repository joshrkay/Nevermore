import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";
import type { QuoteRequestMessageRow, QuoteRequestRow } from "@/lib/advisorApi";

import { goOffline, goOnline, restoreConnection } from "@/test/connection";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const setStatus = vi.fn();
vi.mock("@/lib/advisorApi", () => ({ setStatus: (...a: unknown[]) => setStatus(...a) }));
const closeSubmissionAndWithdraw = vi.fn();
vi.mock("@/lib/peoFollowUpApi", () => ({ closeSubmissionAndWithdraw: (...a: unknown[]) => closeSubmissionAndWithdraw(...a) }));

// The opportunity that holds the submission (D-470): the console's Won and Lost open that opportunity's own dialog.
const opp = {
  getOpportunityOfSubmission: vi.fn(), getOpportunityPage: vi.fn(), getOpportunityOutcome: vi.fn(), getFirmName: vi.fn(), markOpportunityWon: vi.fn(), markOpportunityLost: vi.fn(),
};
vi.mock("@/lib/opportunityPageApi", async () => ({ ...(await vi.importActual<object>("@/lib/opportunityPageApi")), ...opp }));

const { default: StatusPanel } = await import("./StatusPanel");

const panel = (ws: Workspace | null = null, onOutcomeChanged: (firmId: string) => void = () => undefined) => {
  const onChanged = vi.fn();
  render(
    <WorkspaceContext.Provider value={ws}>
    <StatusPanel
      sessionId="s1"
      prospectUserId="p1"
      status="quoted"
      certified
      certifiedOnce
      history={[]}
      onChanged={onChanged}
      onOutcomeChanged={onOutcomeChanged}
    />
    </WorkspaceContext.Provider>,
  );
  return onChanged;
};

beforeEach(() => {
  for (const fn of Object.values(opp)) fn.mockReset();
  opp.getOpportunityOfSubmission.mockResolvedValue(null);
});

describe("StatusPanel: Won and Lost need the submission's opportunity (D-470)", () => {
  beforeEach(() => setStatus.mockReset().mockResolvedValue(undefined));
  const choose = (to: string) => fireEvent.change(screen.getByLabelText("Change status to"), { target: { value: to } });
  const update = () => screen.getByRole("button", { name: "Update status" });

  // Catches: the console falling back to its old quote picker while the opportunity is still being read: a win made there is refused by the database, and the person has
  // already chosen a quote for nothing.
  it("offers no quote picker while the opportunity is being read, and says it is being checked", async () => {
    opp.getOpportunityOfSubmission.mockReturnValue(new Promise(() => undefined));
    panel();
    choose("won");
    expect(screen.queryByLabelText("Which quote did the employer take?")).not.toBeInTheDocument();
    expect(screen.getByText("Checking this submission's opportunity…")).toBeInTheDocument();
    expect(update()).toBeDisabled();
    fireEvent.click(update());
    expect(setStatus).not.toHaveBeenCalled();
  });

  // Catches: a read that failed taken for "this submission is on no opportunity", which gave the old picker and a move the database refuses.
  it("says the opportunity could not be read, with Try again, and offers no picker", async () => {
    opp.getOpportunityOfSubmission.mockRejectedValueOnce(new Error("boom"));
    opp.getOpportunityOfSubmission.mockResolvedValue({ id: "o1", firmId: "f1" });
    panel();
    choose("lost");
    expect(await screen.findByText(/Couldn't read this submission's opportunity/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Which quote did the employer take?")).not.toBeInTheDocument();
    expect(update()).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByText(/Couldn't read this submission's opportunity/)).not.toBeInTheDocument());
    expect(opp.getOpportunityOfSubmission).toHaveBeenCalledTimes(2);
    expect(update()).toBeEnabled();
  });

  // Catches: an opportunity the person may not read (its account is not theirs to see) treated as no opportunity: the console would offer a win the database refuses.
  it("says when the opportunity is not one the person can open, and offers no picker", async () => {
    opp.getOpportunityOfSubmission.mockResolvedValue(null);
    panel();
    await waitFor(() => expect(opp.getOpportunityOfSubmission).toHaveBeenCalled());
    choose("won");
    expect(await screen.findByText(/isn't one you can open/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Which quote did the employer take?")).not.toBeInTheDocument();
    expect(update()).toBeDisabled();
    expect(setStatus).not.toHaveBeenCalled();
  });

  // Catches: the block reaching moves that are not Won or Lost.
  it("blocks only Won and Lost: another move goes through the console's own status change", async () => {
    opp.getOpportunityOfSubmission.mockRejectedValue(new Error("boom"));
    panel();
    choose("archived");
    expect(screen.queryByText(/Couldn't read this submission's opportunity/)).not.toBeInTheDocument();
    expect(update()).toBeEnabled();
    fireEvent.click(update());
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith("s1", "archived", ""));
  });
});

const quote = (id: number, peo_name: string, status: string): QuoteRequestRow => ({
  id, session_id: "s1", peo_name, status, sent_version: 1, sent_on: "2026-11-10", quote_received_on: null,
  quote_expires_on: null, proposed_start_on: null, admin_fee_pepm: status === "quoted" ? 150 : null, note: null,
});

// M-2.4: Archived offers one withdrawal to every PEO still open that the product sent to, written once, sent on each thread. Won and Lost are marked on the
// opportunity (D-470) and its dialog does not offer the withdrawal yet (D-1717, D-1719), so this panel offers none with them.
describe("StatusPanel: the withdrawal offered with Archived", () => {
  beforeEach(() => {
    setStatus.mockReset().mockResolvedValue(undefined);
    closeSubmissionAndWithdraw.mockReset().mockResolvedValue({ messageIds: [61, 62] });
  });
  const sentTo = (id: number, quote_request_id: number) =>
    ({ id, quote_request_id, direction: "sent", status: "sent", to_addresses: ["x@peo.example"], subject: "Reyes Bakery", recorded_at: "2026-11-10T10:00:00Z" }) as unknown as QuoteRequestMessageRow;
  const offer = () => {
    render(
      <StatusPanel sessionId="s1" prospectUserId="p1" status="quoted" certified certifiedOnce history={[]}
        quoteRequests={[quote(7, "TriNet", "quoted"), quote(8, "Justworks", "sent"), quote(9, "Insperity", "sent")]}
        mail={[sentTo(41, 7), sentTo(42, 9)]} companyName="Reyes Bakery" onChanged={vi.fn()} />,
    );
  };

  // Break caught: an archived submission whose PEOs are never told, a withdrawal that is not offered with its default text, one offered to a PEO the
  // product never wrote to (Justworks was recorded by hand: there is no thread to answer), or a move that skips the withdrawal it offered.
  it("offers, ticked, one withdrawal to each PEO still open on a thread, with its default text, and sends it with the move", async () => {
    offer();
    fireEvent.change(screen.getByLabelText("Change status to"), { target: { value: "archived" } });
    const tell = screen.getByRole("checkbox", { name: "Send a withdrawal to TriNet and Insperity" });
    expect(tell).toBeChecked();
    expect((screen.getByLabelText("The withdrawal") as HTMLTextAreaElement).value).toContain("withdraw Reyes Bakery");
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    await waitFor(() => expect(closeSubmissionAndWithdraw).toHaveBeenCalledTimes(1));
    expect(closeSubmissionAndWithdraw.mock.calls[0][0]).toMatchObject({ sessionId: "s1", status: "archived", note: "", wonQuoteRequestId: null, subject: "Re: Reyes Bakery" });
    expect(setStatus).not.toHaveBeenCalled();
  });

  // Break caught (N-1.2): a PEO that acknowledged, or asked a question, left out of the withdrawal because the panel looked only for Sent and Quoted; the database
  // closes it with the rest (set_submission_status), so it would be closed without a word.
  it("offers the withdrawal to a PEO that acknowledged or has a question open, as to a Sent one", () => {
    render(
      <StatusPanel sessionId="s1" prospectUserId="p1" status="quoted" certified certifiedOnce history={[]}
        quoteRequests={[quote(7, "TriNet", "acknowledged"), quote(9, "Insperity", "question_open"), quote(10, "Paychex", "declined")]}
        mail={[sentTo(41, 7), sentTo(42, 9), sentTo(43, 10)]} companyName="Reyes Bakery" onChanged={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText("Change status to"), { target: { value: "archived" } });
    expect(screen.getByRole("checkbox", { name: "Send a withdrawal to TriNet and Insperity" })).toBeChecked();
  });

  // Break caught (found by mutation): the PEO whose quote the employer took told to set the submission aside (archiving a won submission keeps the
  // winner, D-471), a withdrawal offered on a move that closes no quote request (back to Sent to PEOs), or one offered with Won or Lost, whose dialog
  // on the opportunity has none yet (so the panel must not promise a mail it does not send).
  it("never offers it to the winner, and offers it only with Archived", async () => {
    render(
      <StatusPanel sessionId="s1" prospectUserId="p1" status="won" certified certifiedOnce history={[]}
        quoteRequests={[quote(7, "TriNet", "won"), quote(9, "Insperity", "sent")]} mail={[sentTo(41, 7), sentTo(42, 9)]} companyName="Reyes Bakery" onChanged={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText("Change status to"), { target: { value: "archived" } });
    expect(screen.getByRole("checkbox", { name: "Send a withdrawal to Insperity" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    await waitFor(() => expect(closeSubmissionAndWithdraw).toHaveBeenCalledTimes(1));
    expect(closeSubmissionAndWithdraw.mock.calls[0][0]).toMatchObject({ status: "archived", wonQuoteRequestId: null });
  });

  it("offers none with Won, Lost or a move that closes nothing", async () => {
    offer();
    for (const to of ["won", "lost", "sent_to_carrier"]) {
      fireEvent.change(screen.getByLabelText("Change status to"), { target: { value: to } });
      expect(screen.queryByRole("checkbox", { name: /Send a withdrawal/ }), to).not.toBeInTheDocument();
    }
  });

  // Break caught: an advisor who skips the withdrawal still mailing the PEOs, or unable to move the submission without writing to them. Their links
  // are revoked by the move itself (set_submission_status, supabase/tests/follow_up_and_withdraw.sql 19).
  it("lets the advisor skip it: the move alone, and nothing is sent", async () => {
    offer();
    fireEvent.change(screen.getByLabelText("Change status to"), { target: { value: "archived" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Send a withdrawal to TriNet and Insperity" }));
    expect(screen.queryByLabelText("The withdrawal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith("s1", "archived", ""));
    expect(closeSubmissionAndWithdraw).not.toHaveBeenCalled();
  });
});

// Without a connection (CRM-S2.4a, D-182): Update status can't be used, and says why.
describe("StatusPanel: without a connection", () => {
  afterEach(() => { restoreConnection(); });
  it("makes Update status aria-disabled with the reason, and sends nothing", () => {
    setStatus.mockReset();
    panel();
    fireEvent.change(screen.getByLabelText("Change status to"), { target: { value: "ready_for_market" } });
    goOffline();
    const update = screen.getByRole("button", { name: "Update status" });
    expect(update).toHaveAttribute("aria-disabled", "true");
    expect(update).toHaveAccessibleDescription("You're offline. Saving is back when you are.");
    fireEvent.click(update);
    expect(setStatus).not.toHaveBeenCalled();
    goOnline();
    expect(screen.getByRole("button", { name: "Update status" })).not.toHaveAttribute("aria-disabled");
  });
});


// ---------- CRM-O1.3b, D-470: on an opportunity the console's Won and Lost open the opportunity's own dialog ----------
describe("StatusPanel: a submission on an opportunity (D-470)", () => {
  const opportunityPage = {
    opportunity: { id: "o1", version: 4, accountId: "a1", name: "January 2027 PEO search", targetStart: "2027-01-01", employees: 45, submissionId: "s1", stage: "quoted" },
    account: { id: "a1", name: "Harborview Dental Group", archived: false },
    quotes: [
      { id: 7, peoName: "TriNet", status: "quoted", sentOn: "2026-11-10", quoteReceivedOn: null, quoteExpiresOn: null, adminFeePepm: 150 },
      { id: 9, peoName: "Insperity", status: "sent", sentOn: "2026-11-10", quoteReceivedOn: null, quoteExpiresOn: null, adminFeePepm: null },
    ],
    intake: { censusSize: 45 },
  };
  beforeEach(() => {
    setStatus.mockReset().mockResolvedValue(undefined);
    opp.getOpportunityOfSubmission.mockResolvedValue({ id: "o1", firmId: "f1" });
    opp.getOpportunityPage.mockResolvedValue({ ...opportunityPage, canChange: true });
    opp.getOpportunityOutcome.mockResolvedValue({ lostReason: null, lostNote: null, placement: null, payments: [], receivedToDate: 0, quotes: { 7: { closeReason: null, proposedStart: null } } });
    opp.getFirmName.mockResolvedValue("Acme Benefits");
  });
  // The panel has to know the opportunity before Update status is pressed: this waits for the read.
  const choose = async (to: string) => {
    const onChanged = panel();
    await waitFor(() => expect(opp.getOpportunityOfSubmission).toHaveBeenCalledWith("s1"));
    fireEvent.change(screen.getByLabelText("Change status to"), { target: { value: to } });
    return onChanged;
  };

  // Catches: the console winning a submission with its own quote picker, a second way to win that skips the placement, renewal and commission (D-470).
  it("opens the opportunity's dialog for Won, with no quote picker of its own, and sends nothing itself", async () => {
    await choose("won");
    await waitFor(() => expect(screen.queryByLabelText("Which quote did the employer take?")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Close this opportunity")).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: /Won/ })).toBeChecked();
    expect(within(dialog).getByRole("radio", { name: /TriNet/ })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Broker of record")).toHaveValue("Acme Benefits");
    expect(setStatus).not.toHaveBeenCalled();
  });

  // Catches: Lost from the console going through the old move, which the database now refuses on an opportunity (D-470), or opening on Won.
  it("opens the same dialog on Lost, and marking lost there is the opportunity's own loss, then the console reloads", async () => {
    const onChanged = await choose("lost");
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("radio", { name: /Lost/ })).toBeChecked();
    opp.markOpportunityLost.mockResolvedValue({ conflict: false, stage: "lost", version: 5 });
    await userEvent.selectOptions(within(dialog).getByLabelText("Reason"), "price");
    await userEvent.click(within(dialog).getByRole("button", { name: "Mark lost" }));
    await waitFor(() => expect(opp.markOpportunityLost).toHaveBeenCalledWith("f1", "o1", { reason: "price", note: "" }, 4, undefined));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(setStatus).not.toHaveBeenCalled();
  });

  // Catches: a win from the console not made from the opportunity's version, so it could win over someone else's change.
  it("wins from the console through the opportunity's win, with its version", async () => {
    const onChanged = await choose("won");
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    const dialog = await screen.findByRole("dialog");
    opp.markOpportunityWon.mockResolvedValue({ conflict: false, stage: "won", version: 5 });
    await userEvent.click(within(dialog).getByRole("radio", { name: /TriNet/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Mark won" }));
    await waitFor(() => expect(opp.markOpportunityWon).toHaveBeenCalledWith("f1", "o1", expect.objectContaining({ quoteRequestId: 7, brokerOfRecord: "Acme Benefits" }), 4, undefined));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  // Catches: the accounts table (its status and renewals), the opportunity's own page and the submission read the quotes panel uses left stale after the console wins or
  // loses an opportunity: the page that holds them is told which firm's to ask again.
  it("tells the page which firm's accounts table and opportunity to ask again once an outcome is saved", async () => {
    const outcomeChanged = vi.fn();
    const onChanged = panel(null, outcomeChanged);
    await waitFor(() => expect(opp.getOpportunityOfSubmission).toHaveBeenCalledWith("s1"));
    fireEvent.change(screen.getByLabelText("Change status to"), { target: { value: "lost" } });
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    const dialog = await screen.findByRole("dialog");
    opp.markOpportunityLost.mockResolvedValue({ conflict: false, stage: "lost", version: 5 });
    await userEvent.selectOptions(within(dialog).getByLabelText("Reason"), "price");
    await userEvent.click(within(dialog).getByRole("button", { name: "Mark lost" }));
    await waitFor(() => expect(outcomeChanged).toHaveBeenCalledWith("f1"));
    expect(onChanged).toHaveBeenCalled();
  });

  // Catches: every move sent to the dialog: only Won and Lost are the opportunity's to close.
  it("keeps every other move on the console's own status change", async () => {
    await choose("sent_to_carrier");
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith("s1", "sent_to_carrier", ""));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // Catches: Cancel in the dialog leaving the console's control stuck, or having moved the status.
  it("moves nothing when the dialog is cancelled", async () => {
    await choose("lost");
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(opp.markOpportunityLost).not.toHaveBeenCalled();
    expect(setStatus).not.toHaveBeenCalled();
  });

  // The console asks the opportunity before it opens the dialog, as its own page does: whoever may not change it, an archived account and a support session are told so,
  // and no dialog is offered that could only be refused.

  // Catches: the dialog opened for a person the level rule does not let change the opportunity: they would fill it in and be refused.
  it("says so, and opens no dialog, for a person who may not change the opportunity", async () => {
    opp.getOpportunityPage.mockResolvedValue({ ...opportunityPage, canChange: false });
    await choose("won");
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    expect(await screen.findByText(/only the opportunity's owner, a lead of the owner's team or an owner of the firm can mark it won or lost/i)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(setStatus).not.toHaveBeenCalled();
  });

  // Catches: the dialog opened on an archived account, where nothing can be changed.
  it("says so, and opens no dialog, for an archived account", async () => {
    opp.getOpportunityPage.mockResolvedValue({ ...opportunityPage, canChange: false, account: { id: "a1", name: "Harborview Dental Group", archived: true } });
    await choose("lost");
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    expect(await screen.findByText("This account is archived. Nothing on it can be changed.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // Catches: a Nevermore support session (read only) offered the dialog.
  it("says so, and asks nothing of the database, in a support session", async () => {
    const support: Workspace = {
      firm: { id: "f1", name: "Acme Benefits", address: "acme" }, role: "Nevermore support", isOwner: false, isSupport: true, supportEndsAt: null, supportSessionId: null, isPlatformAdmin: true, person: "Sam",
    };
    cleanup();
    panel(support);
    await waitFor(() => expect(opp.getOpportunityOfSubmission).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Change status to"), { target: { value: "won" } });
    expect(await screen.findByText("Nevermore support can read this submission but not change it.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update status" })).toBeDisabled();
    expect(opp.getOpportunityPage).not.toHaveBeenCalled();
  });

  // Catches: a closed opportunity offered the dialog again (the database says it is already won or lost).
  it("says an opportunity that is already won or lost is reopened on its own page", async () => {
    opp.getOpportunityPage.mockResolvedValue({ ...opportunityPage, opportunity: { ...opportunityPage.opportunity, stage: "won" }, canChange: true });
    await choose("lost");
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    expect(await screen.findByText(/It is already Won\. Reopen it on its opportunity's page first\./)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // Catches: nothing at all drawn while the dialog's page is being read (the button seems dead).
  it("shows that it is opening the opportunity while it reads it", async () => {
    opp.getOpportunityPage.mockReturnValue(new Promise(() => undefined));
    await choose("won");
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Opening the opportunity…");
  });

  // Catches: the read failing in silence.
  it("says the opportunity could not be opened, and closes", async () => {
    opp.getOpportunityPage.mockRejectedValue(new Error("boom"));
    await choose("won");
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    expect(await screen.findByText(/Couldn't open the opportunity to mark it won or lost/)).toBeInTheDocument();
  });
});

// ---------- 5.0y: Won and Lost from the console make the same offer, from the mail the panel already read (D-1725) ----------
describe("StatusPanel: the console's Lost offers the withdrawal (D-1725)", () => {
  const sentTo = (id: number, quote_request_id: number) =>
    ({ id, quote_request_id, direction: "sent", status: "sent", to_addresses: ["x@peo.example"], subject: "Reyes Bakery", recorded_at: "2026-11-10T10:00:00Z" }) as unknown as QuoteRequestMessageRow;
  beforeEach(() => {
    opp.getOpportunityOfSubmission.mockResolvedValue({ id: "o1", firmId: "f1" });
    opp.getOpportunityPage.mockResolvedValue({
      opportunity: { id: "o1", version: 4, accountId: "a1", name: "January 2027 PEO search", targetStart: "2027-01-01", employees: 45, submissionId: "s1", stage: "quoted" },
      account: { id: "a1", name: "Harborview Dental Group", archived: false }, canChange: true, intake: { censusSize: 45 },
      quotes: [
        { id: 7, peoName: "TriNet", status: "quoted", sentOn: "2026-11-10", quoteReceivedOn: null, quoteExpiresOn: null, adminFeePepm: 150 },
        { id: 9, peoName: "Insperity", status: "sent", sentOn: "2026-11-10", quoteReceivedOn: null, quoteExpiresOn: null, adminFeePepm: null },
      ],
    });
    opp.getOpportunityOutcome.mockResolvedValue({ lostReason: null, lostNote: null, placement: null, payments: [], receivedToDate: 0, quotes: {} });
    opp.getFirmName.mockResolvedValue("Acme Benefits");
  });

  // Catches: the console's Lost closing the PEOs without the withdrawal the opportunity's own page offers, or offering it twice (the panel's own offer is Archived's only).
  it("offers the one withdrawal in the opportunity's dialog, from the panel's own mail, and the panel draws none beside it", async () => {
    render(
      <StatusPanel sessionId="s1" prospectUserId="p1" status="quoted" certified certifiedOnce history={[]}
        quoteRequests={[quote(7, "TriNet", "quoted"), quote(9, "Insperity", "sent")]} mail={[sentTo(41, 7), sentTo(42, 9)]} companyName="Reyes Bakery" onChanged={vi.fn()} />,
    );
    await waitFor(() => expect(opp.getOpportunityOfSubmission).toHaveBeenCalledWith("s1"));
    fireEvent.change(screen.getByLabelText("Change status to"), { target: { value: "lost" } });
    expect(screen.queryByText("Tell the PEOs still open")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByRole("checkbox", { name: "Send a withdrawal to TriNet and Insperity" })).toBeChecked();
  });

  // Catches: the console opening the opportunity's dialog for a workers' comp search with a PEO search's words (the page it reads says the line: ADR 0029).
  it("opens the dialog in a carrier's words for a submission on a workers' comp search", async () => {
    const read = await opp.getOpportunityPage();
    opp.getOpportunityPage.mockResolvedValue({ ...read, opportunity: { ...read.opportunity, name: "March 2027 workers' comp search", line: "workers_comp" } });
    render(
      <StatusPanel sessionId="s1" prospectUserId="p1" status="quoted" certified certifiedOnce history={[]}
        quoteRequests={[quote(7, "TriNet", "quoted"), quote(9, "Insperity", "sent")]} mail={[sentTo(41, 7), sentTo(42, 9)]} companyName="Reyes Bakery" onChanged={vi.fn()} />,
    );
    await waitFor(() => expect(opp.getOpportunityOfSubmission).toHaveBeenCalledWith("s1"));
    fireEvent.change(screen.getByLabelText("Change status to"), { target: { value: "lost" } });
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByRole("group", { name: "Tell the carriers still open" })).toBeInTheDocument();
  });
});
