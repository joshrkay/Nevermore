import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { QuoteRequestRow } from "@/lib/advisorApi";
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

const quote = (id: number, peo_name: string, status: string): QuoteRequestRow => ({
  id, session_id: "s1", peo_name, status, sent_version: 1, sent_on: "2026-11-10", quote_received_on: null,
  quote_expires_on: null, proposed_start_on: null, admin_fee_pepm: status === "quoted" ? 150 : null, note: null,
});

const panel = (quoteRequests: QuoteRequestRow[]) => {
  const onChanged = vi.fn();
  render(
    <StatusPanel
      sessionId="s1"
      prospectUserId="p1"
      status="quoted"
      certified
      certifiedOnce
      history={[]}
      quoteRequests={quoteRequests}
      onChanged={onChanged}
    />,
  );
  return onChanged;
};

beforeEach(() => {
  for (const fn of Object.values(opp)) fn.mockReset();
  opp.getOpportunityOfSubmission.mockResolvedValue(null);
});

describe("StatusPanel: marking a submission won", () => {
  beforeEach(() => setStatus.mockReset().mockResolvedValue(undefined));

  it("asks which quote the employer took, from the PEOs that quoted, and sends it with the move", async () => {
    const onChanged = panel([quote(7, "TriNet", "quoted"), quote(8, "Justworks", "declined"), quote(9, "Insperity", "quoted")]);
    fireEvent.change(screen.getByLabelText("Change status to"), { target: { value: "won" } });
    const update = screen.getByRole("button", { name: "Update status" });
    expect(update).toBeDisabled();
    const winner = screen.getByLabelText("Which quote did the employer take?");
    expect([...(winner as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(["Choose a PEO", "TriNet", "Insperity"]);
    fireEvent.change(winner, { target: { value: "9" } });
    fireEvent.click(update);
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith("s1", "won", "", 9));
    expect(onChanged).toHaveBeenCalled();
  });

  it("asks no winner for any other move", async () => {
    panel([quote(7, "TriNet", "quoted")]);
    fireEvent.change(screen.getByLabelText("Change status to"), { target: { value: "lost" } });
    expect(screen.queryByLabelText("Which quote did the employer take?")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith("s1", "lost", ""));
  });
});

// Without a connection (CRM-S2.4a, D-182): Update status can't be used, and says why.
describe("StatusPanel: without a connection", () => {
  afterEach(() => { restoreConnection(); });
  it("makes Update status aria-disabled with the reason, and sends nothing", () => {
    setStatus.mockReset();
    panel([quote(7, "TriNet", "quoted")]);
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
    opp.getOpportunityPage.mockResolvedValue(opportunityPage);
    opp.getOpportunityOutcome.mockResolvedValue({ lostReason: null, lostNote: null, placement: null, payments: [], receivedToDate: 0, quotes: { 7: { closeReason: null, proposedStart: null } } });
    opp.getFirmName.mockResolvedValue("Acme Benefits");
  });
  // The panel has to know the opportunity before Update status is pressed: this waits for the read.
  const choose = async (to: string) => {
    const onChanged = panel([quote(7, "TriNet", "quoted"), quote(9, "Insperity", "sent")]);
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
});
