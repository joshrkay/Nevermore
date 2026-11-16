import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";
import { goOffline, goOnline, restoreConnection } from "@/test/connection";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const setStatus = vi.fn();
vi.mock("@/lib/advisorApi", () => ({ setStatus: (...a: unknown[]) => setStatus(...a) }));

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
    await waitFor(() => expect(opp.markOpportunityLost).toHaveBeenCalledWith("f1", "o1", { reason: "price", note: "" }, 4));
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
    await waitFor(() => expect(opp.markOpportunityWon).toHaveBeenCalledWith("f1", "o1", expect.objectContaining({ quoteRequestId: 7, brokerOfRecord: "Acme Benefits" }), 4));
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
