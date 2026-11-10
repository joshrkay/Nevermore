import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { QuoteRequestEventRow, QuoteRequestRow } from "@/lib/advisorApi";
import type { PipelineStatus } from "@/data/advisor";
import { EMPTY_CHAMBER_DATA, type ChamberData } from "@/data/chamberTypes";
import type { PeoRecord } from "@/data/peoCatalog";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const api = {
  recordQuoteSend: vi.fn(),
  updateQuoteRequest: vi.fn(),
  noteUnderwriterQuestion: vi.fn(),
  setStatus: vi.fn(),
};
vi.mock("@/lib/advisorApi", () => api);

const { default: QuoteRequestsPanel } = await import("./QuoteRequestsPanel");

const request = (over: Partial<QuoteRequestRow> = {}): QuoteRequestRow => ({
  id: 7,
  session_id: "s1",
  peo_name: "TriNet",
  status: "sent",
  sent_version: 1,
  sent_on: "2026-11-10",
  quote_received_on: null,
  quote_expires_on: null,
  proposed_start_on: null,
  admin_fee_pepm: null,
  note: null,
  ...over,
});

const panel = (
  over: {
    status?: PipelineStatus; requests?: QuoteRequestRow[]; events?: QuoteRequestEventRow[]; currentVersion?: number | null;
    data?: ChamberData; catalog?: PeoRecord[]; onAskProspect?: (question: string) => void;
  } = {},
) => {
  const onChanged = vi.fn();
  render(
    <QuoteRequestsPanel
      sessionId="s1"
      prospectUserId="p1"
      status={over.status ?? "sent_to_carrier"}
      currentVersion={over.currentVersion === undefined ? 1 : over.currentVersion}
      requests={over.requests ?? [request()]}
      events={over.events ?? []}
      data={over.data ?? EMPTY_CHAMBER_DATA}
      catalog={over.catalog}
      onAskProspect={over.onAskProspect ?? vi.fn()}
      onChanged={onChanged}
    />,
  );
  return onChanged;
};

describe("QuoteRequestsPanel", () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue(undefined);
  });

  it("lists each PEO with where its quote request stands, when it was sent and which version", () => {
    panel({
      requests: [
        request(),
        request({ id: 8, peo_name: "Justworks", status: "quoted", quote_received_on: "2026-11-14", quote_expires_on: "2026-12-14",
          proposed_start_on: "2027-04-01", admin_fee_pepm: 145.5, note: "Includes the PPO." }),
      ],
    });
    const trinet = screen.getByTestId("quote-request-7");
    expect(within(trinet).getByText("TriNet")).toBeInTheDocument();
    expect(within(trinet).getByText("Waiting")).toBeInTheDocument();
    expect(within(trinet).getByText("Sent Nov 10, 2026 · version 1")).toBeInTheDocument();
    const justworks = screen.getByTestId("quote-request-8");
    expect(within(justworks).getByText("Quoted")).toBeInTheDocument();
    expect(within(justworks).getByText("$145.50 per employee per month · received Nov 14, 2026 · expires Dec 14, 2026 · start Apr 1, 2027")).toBeInTheDocument();
    expect(within(justworks).getByText("Includes the PPO.")).toBeInTheDocument();
  });

  it("flags a PEO that has an older version of the submission than the latest certified, while its request is open", () => {
    panel({
      currentVersion: 2,
      requests: [request(), request({ id: 8, peo_name: "Justworks", status: "declined" }), request({ id: 9, peo_name: "Insperity", sent_version: 2 })],
    });
    expect(within(screen.getByTestId("quote-request-7")).getByText("Sent v1, current v2")).toBeInTheDocument();
    expect(within(screen.getByTestId("quote-request-8")).queryByText(/current v/)).not.toBeInTheDocument();
    expect(within(screen.getByTestId("quote-request-9")).queryByText(/current v/)).not.toBeInTheDocument();
  });

  it("records a send to a PEO from the catalog, or one typed in, on the date given", async () => {
    const onChanged = panel({ status: "ready_for_market", requests: [] });
    fireEvent.change(screen.getByLabelText("PEO"), { target: { value: "Insperity" } });
    fireEvent.change(screen.getByLabelText("Sent on"), { target: { value: "2026-11-09" } });
    fireEvent.click(screen.getByRole("button", { name: "Record send" }));
    await waitFor(() => expect(api.recordQuoteSend).toHaveBeenCalledWith("s1", "Insperity", "2026-11-09"));
    expect(onChanged).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("PEO"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Another PEO"), { target: { value: "  Regional HR Co  " } });
    fireEvent.click(screen.getByRole("button", { name: "Record send" }));
    await waitFor(() => expect(api.recordQuoteSend).toHaveBeenLastCalledWith("s1", "Regional HR Co", "2026-11-09"));
  });

  it("offers sending only from Ready for market on, and says so before then", () => {
    panel({ status: "under_review", requests: [] });
    expect(screen.getByText("Move to Ready for market first.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record send" })).not.toBeInTheDocument();
  });

  it("after a send at Ready for market, offers the one step to Sent to carrier/PEO, and declining changes nothing", async () => {
    const onChanged = panel({ status: "ready_for_market", requests: [] });
    fireEvent.change(screen.getByLabelText("PEO"), { target: { value: "TriNet" } });
    fireEvent.click(screen.getByRole("button", { name: "Record send" }));
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("button", { name: "Move to Sent to carrier/PEO" })).not.toBeInTheDocument();
    expect(api.setStatus).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Record send" }));
    fireEvent.click(await screen.findByRole("button", { name: "Move to Sent to carrier/PEO" }));
    await waitFor(() => expect(api.setStatus).toHaveBeenCalledWith("s1", "sent_to_carrier", ""));
    expect(onChanged).toHaveBeenCalledTimes(3);
  });

  it("offers no move after a send once the submission is already past Ready for market", async () => {
    panel({ status: "sent_to_carrier", requests: [] });
    fireEvent.change(screen.getByLabelText("PEO"), { target: { value: "TriNet" } });
    fireEvent.click(screen.getByRole("button", { name: "Record send" }));
    await waitFor(() => expect(api.recordQuoteSend).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /^Move to/ })).not.toBeInTheDocument();
  });

  it("records a PEO's quote, then offers the step to Quoted", async () => {
    const onChanged = panel({ status: "sent_to_carrier" });
    const row = screen.getByTestId("quote-request-7");
    fireEvent.click(within(row).getByRole("button", { name: "Record answer" }));
    fireEvent.change(within(row).getByLabelText("Answer"), { target: { value: "quoted" } });
    fireEvent.change(within(row).getByLabelText("Admin fee per employee per month ($)"), { target: { value: "145.50" } });
    fireEvent.change(within(row).getByLabelText("Received on"), { target: { value: "2026-11-14" } });
    fireEvent.change(within(row).getByLabelText("Expires on"), { target: { value: "2026-12-14" } });
    fireEvent.change(within(row).getByLabelText("Proposed start"), { target: { value: "2027-04-01" } });
    fireEvent.change(within(row).getByLabelText("Note"), { target: { value: "Includes the PPO." } });
    fireEvent.click(within(row).getByRole("button", { name: "Save answer" }));
    await waitFor(() =>
      expect(api.updateQuoteRequest).toHaveBeenCalledWith(7, {
        status: "quoted", receivedOn: "2026-11-14", expiresOn: "2026-12-14", startOn: "2027-04-01", adminFeePepm: 145.5, note: "Includes the PPO.",
      }),
    );
    expect(onChanged).toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Move to Quoted" }));
    await waitFor(() => expect(api.setStatus).toHaveBeenCalledWith("s1", "quoted", ""));
  });

  it("records a decline with only a note: a decline has no dates or fee", async () => {
    panel({ status: "sent_to_carrier" });
    const row = screen.getByTestId("quote-request-7");
    fireEvent.click(within(row).getByRole("button", { name: "Record answer" }));
    fireEvent.change(within(row).getByLabelText("Answer"), { target: { value: "declined" } });
    expect(within(row).queryByLabelText("Expires on")).not.toBeInTheDocument();
    fireEvent.change(within(row).getByLabelText("Note"), { target: { value: "Outside their appetite." } });
    fireEvent.click(within(row).getByRole("button", { name: "Save answer" }));
    await waitFor(() =>
      expect(api.updateQuoteRequest).toHaveBeenCalledWith(7, {
        status: "declined", receivedOn: null, expiresOn: null, startOn: null, adminFeePepm: null, note: "Outside their appetite.",
      }),
    );
    expect(screen.queryByRole("button", { name: /^Move to/ })).not.toBeInTheDocument();
  });

  it("notes a question from the PEO's underwriter", async () => {
    const onChanged = panel();
    const row = screen.getByTestId("quote-request-7");
    fireEvent.click(within(row).getByRole("button", { name: "Note a question" }));
    fireEvent.change(within(row).getByLabelText("Underwriter's question"), { target: { value: "Can they send loss runs?" } });
    fireEvent.click(within(row).getByRole("button", { name: "Save question" }));
    await waitFor(() => expect(api.noteUnderwriterQuestion).toHaveBeenCalledWith(7, "Can they send loss runs?"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("shows each quote request's history: who changed what, and the underwriter's questions", () => {
    const at = "2026-11-12T15:00:00Z";
    const ev = (over: Partial<QuoteRequestEventRow>): QuoteRequestEventRow => ({
      id: 1, quote_request_id: 7, session_id: "s1", field: "status", old_value: null, new_value: "sent",
      changed_by: "a1", changed_by_email: "adv@example.com", changed_at: at, ...over,
    });
    panel({
      events: [
        ev({ id: 3, field: "underwriter_question", new_value: "Can they send loss runs?" }),
        ev({ id: 2, field: "admin_fee_pepm", old_value: "145.50", new_value: "150.00" }),
        ev({ id: 1 }),
        ev({ id: 4, quote_request_id: 8, field: "status", old_value: "sent", new_value: "declined" }),
      ],
    });
    const history = within(screen.getByTestId("quote-request-7")).getByRole("list", { name: "TriNet history" });
    expect(within(history).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Underwriter asked: Can they send loss runs?"),
      expect.stringContaining("Admin fee per employee per month: 145.50 → 150.00"),
      expect.stringContaining("Status: — → Waiting"),
    ]);
    expect(within(history).getAllByText(/adv@example\.com/)).toHaveLength(3);
  });

  it("drops the fee and dates typed for a quote when the answer is changed to a decline", async () => {
    panel({ status: "sent_to_carrier" });
    const row = screen.getByTestId("quote-request-7");
    fireEvent.click(within(row).getByRole("button", { name: "Record answer" }));
    fireEvent.change(within(row).getByLabelText("Admin fee per employee per month ($)"), { target: { value: "99" } });
    fireEvent.change(within(row).getByLabelText("Expires on"), { target: { value: "2026-12-01" } });
    fireEvent.change(within(row).getByLabelText("Answer"), { target: { value: "declined" } });
    fireEvent.click(within(row).getByRole("button", { name: "Save answer" }));
    await waitFor(() => expect(api.updateQuoteRequest).toHaveBeenCalledWith(7, expect.objectContaining({ adminFeePepm: null, expiresOn: null })));
  });

  it("offers no answer on a closed quote request: only a new send reopens it", () => {
    panel({ requests: [request({ status: "closed" })] });
    const row = screen.getByTestId("quote-request-7");
    expect(within(row).queryByRole("button", { name: "Record answer" })).not.toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Note a question" })).toBeInTheDocument();
  });

  it("warns, on its row, about a PEO whose sourced facts don't fit the submission", () => {
    panel({
      data: { ...EMPTY_CHAMBER_DATA, employee_count: 8 },
      catalog: [{ name: "TriNet", minHeadcount: 10, statesServed: null, excludedClassCodes: null, lastVerified: "2026-11-01",
        sources: { minHeadcount: "https://trinet.example/minimums" } }],
      requests: [request(), request({ id: 8, peo_name: "Regional HR Co" })],
    });
    const alert = within(screen.getByTestId("quote-request-7")).getByRole("alert");
    expect(alert).toHaveTextContent("TriNet lists a 10-employee minimum; you have 8");
    // Only what doesn't fit: the checks that pass or can't be told aren't warnings.
    expect(alert).not.toHaveTextContent(/States of operation|Class codes/);
    expect(within(screen.getByTestId("quote-request-8")).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("turns an underwriter's question into an ask of the prospect, and offers that only on questions", () => {
    const onAskProspect = vi.fn();
    const at = "2026-11-12T15:00:00Z";
    panel({
      onAskProspect,
      events: [
        { id: 3, quote_request_id: 7, session_id: "s1", field: "underwriter_question", old_value: null, new_value: "Can they send loss runs?",
          changed_by: "a1", changed_by_email: "adv@example.com", changed_at: at },
        { id: 1, quote_request_id: 7, session_id: "s1", field: "status", old_value: null, new_value: "sent",
          changed_by: "a1", changed_by_email: "adv@example.com", changed_at: at },
      ],
    });
    const history = within(screen.getByTestId("quote-request-7")).getByRole("list", { name: "TriNet history" });
    const asks = within(history).getAllByRole("button", { name: "Ask the prospect" });
    expect(asks).toHaveLength(1);
    fireEvent.click(asks[0]);
    expect(onAskProspect).toHaveBeenCalledWith("Can they send loss runs?");
  });
});
