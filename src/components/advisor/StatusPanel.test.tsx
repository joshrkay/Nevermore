import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { QuoteRequestMessageRow, QuoteRequestRow } from "@/lib/advisorApi";
import { goOffline, goOnline, restoreConnection } from "@/test/connection";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const setStatus = vi.fn();
vi.mock("@/lib/advisorApi", () => ({ setStatus: (...a: unknown[]) => setStatus(...a) }));
const closeSubmissionAndWithdraw = vi.fn();
vi.mock("@/lib/peoFollowUpApi", () => ({ closeSubmissionAndWithdraw: (...a: unknown[]) => closeSubmissionAndWithdraw(...a) }));

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

// M-2.4: Won, Lost or Archived offers one withdrawal to every PEO still open that the product sent to, written once, sent on each thread.
describe("StatusPanel: the withdrawal offered with Won, Lost or Archived", () => {
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

  // Break caught: a lost submission whose PEOs are never told, a withdrawal that is not offered with its default text, one offered to a PEO the
  // product never wrote to (Justworks was recorded by hand: there is no thread to answer), or a move that skips the withdrawal it offered.
  it("offers, ticked, one withdrawal to each PEO still open on a thread, with its default text, and sends it with the move", async () => {
    offer();
    fireEvent.change(screen.getByLabelText("Change status to"), { target: { value: "lost" } });
    const tell = screen.getByRole("checkbox", { name: "Send a withdrawal to TriNet and Insperity" });
    expect(tell).toBeChecked();
    expect((screen.getByLabelText("The withdrawal") as HTMLTextAreaElement).value).toContain("withdraw Reyes Bakery");
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    await waitFor(() => expect(closeSubmissionAndWithdraw).toHaveBeenCalledTimes(1));
    expect(closeSubmissionAndWithdraw.mock.calls[0][0]).toMatchObject({ sessionId: "s1", status: "lost", note: "", wonQuoteRequestId: null, subject: "Re: Reyes Bakery" });
    expect(setStatus).not.toHaveBeenCalled();
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
