import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { OutboxEvent, OutboxSummaryRow } from "@/lib/advisorApi";

const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "adv@example.com" }, signOut }) }));
const listOutboxEvents = vi.fn();
const outboxSummary = vi.fn();
const requeueOutboxEvent = vi.fn();
vi.mock("@/lib/advisorApi", () => ({
  listOutboxEvents: (s: unknown) => listOutboxEvents(s),
  outboxSummary: () => outboxSummary(),
  requeueOutboxEvent: (id: string, rebuild: boolean) => requeueOutboxEvent(id, rebuild),
}));
const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn() });
vi.mock("sonner", () => ({ toast }));

const { default: AdvisorOutboxPage } = await import("./AdvisorOutboxPage");

const event = (over: Partial<OutboxEvent> = {}): OutboxEvent => ({
  id: "e1",
  kind: "advisor_notification",
  status: "dead",
  attempts: 5,
  next_attempt_at: "2026-10-29T10:00:00Z",
  claimed_at: null,
  claim_lapsed: false,
  last_error: "provider_error:503",
  provider_message_id: null,
  created_at: "2026-10-29T09:00:00Z",
  sent_at: null,
  session_id: "s1",
  company_name: "Acme",
  reference: "EAA-2026-ACME0001",
  resubmission: false,
  frozen: false,
  requeue_count: 0,
  last_requeued_at: null,
  ...over,
});

const summaryOf = (counts: Partial<Record<string, number>>, oldestDue: string | null = null): OutboxSummaryRow[] =>
  ["pending", "claimed", "sent", "dead"].map((status) => ({
    status,
    events: counts[status] ?? 0,
    oldest_due_at: status === "pending" ? oldestDue : null,
  }));

const Where = () => <p data-testid="where">{useLocation().search}</p>;

const renderAt = (url = "/advisor/outbox") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/advisor" element={<p>Submissions page</p>} />
        <Route path="/advisor/outbox" element={<><AdvisorOutboxPage /><Where /></>} />
        <Route path="/advisor/submissions/:id" element={<p>Detail page</p>} />
      </Routes>
    </MemoryRouter>,
  );

const ready = (events: OutboxEvent[], summary = summaryOf({ dead: events.length })) => {
  listOutboxEvents.mockResolvedValue(events);
  outboxSummary.mockResolvedValue(summary);
};

beforeEach(() => {
  for (const f of [listOutboxEvents, outboxSummary, requeueOutboxEvent, signOut, toast.success, toast.error, toast.message]) f.mockReset();
  signOut.mockResolvedValue(undefined);
});

describe("AdvisorOutboxPage", () => {
  it("shows a loading state", () => {
    listOutboxEvents.mockReturnValue(new Promise(() => {}));
    outboxSummary.mockReturnValue(new Promise(() => {}));
    renderAt();
    expect(screen.getByRole("status")).toHaveTextContent("Loading the outbox");
  });

  it("is reachable from the advisor header, which marks it as the current page", async () => {
    ready([event()]);
    renderAt();
    await screen.findByText("Acme");
    const nav = screen.getByRole("navigation", { name: "Advisor" });
    expect(within(nav).getByRole("link", { name: "Outbox & Notifications" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Submissions" })).not.toHaveAttribute("aria-current");
    fireEvent.click(within(nav).getByRole("link", { name: "Submissions" }));
    expect(await screen.findByText("Submissions page")).toBeInTheDocument();
  });

  it("lists each event's kind, company, reference, status, attempts and last error, with a plain reading of it", async () => {
    ready([
      event({ last_error: "auth:403 (validation_error: The mail.example.com domain is not verified.)" }),
      event({ id: "e2", kind: "prospect_confirmation", status: "pending", attempts: 2, company_name: null, reference: null, last_error: "timeout",
              next_attempt_at: "2099-01-01T00:00:00Z", resubmission: true }),
    ], summaryOf({ dead: 1, pending: 1 }));
    renderAt();
    const rows = (await screen.findAllByRole("row")).slice(1);
    expect(rows).toHaveLength(2);

    const first = within(rows[0]);
    expect(first.getByText("Advisor alert")).toBeInTheDocument();
    expect(first.getByRole("link", { name: "Acme" })).toHaveAttribute("href", "/advisor/submissions/s1");
    expect(first.getByText("EAA-2026-ACME0001")).toBeInTheDocument();
    expect(first.getByText("Dead")).toBeInTheDocument();
    expect(first.getByText("5 / 5")).toBeInTheDocument();
    expect(first.getByText(/refused our API key or sender domain/)).toBeInTheDocument();
    // The recorded text is still there, so nothing is hidden behind the reading.
    expect(first.getByText(/validation_error: The mail.example.com domain is not verified/)).toBeInTheDocument();

    const second = within(rows[1]);
    expect(second.getByText("Prospect confirmation")).toBeInTheDocument();
    expect(second.getByText("Updated intake")).toBeInTheDocument();
    expect(second.getByText("Company not provided")).toBeInTheDocument();
    expect(second.getByText("Pending")).toBeInTheDocument();
    expect(second.getByText("2 / 5")).toBeInTheDocument();
    expect(second.getByText(/^Next attempt/)).toBeInTheDocument();
  });

  it("shows the counts per status, and which view is selected", async () => {
    ready([event()], summaryOf({ dead: 2, pending: 1, claimed: 0, sent: 40 }));
    renderAt();
    const filters = within(await screen.findByRole("group", { name: "Filter by status" }));
    expect(filters.getByRole("button", { name: "All (43)" })).toHaveAttribute("aria-pressed", "true");
    expect(filters.getByRole("button", { name: "Dead (2)" })).toHaveAttribute("aria-pressed", "false");
    expect(filters.getByRole("button", { name: "Pending (1)" })).toBeInTheDocument();
    expect(filters.getByRole("button", { name: "Claimed (0)" })).toBeInTheDocument();
    expect(filters.getByRole("button", { name: "Sent (40)" })).toBeInTheDocument();
  });

  it.each(["dead", "sent", "pending", "claimed"] as const)("filters by %s, and keeps the filter in the URL", async (status) => {
    ready([event()]);
    renderAt();
    await screen.findByText("Acme");
    expect(listOutboxEvents).toHaveBeenLastCalledWith(null);
    fireEvent.click(within(screen.getByRole("group", { name: "Filter by status" })).getByRole("button", { name: new RegExp(`^${status}`, "i") }));
    await waitFor(() => expect(listOutboxEvents).toHaveBeenLastCalledWith(status));
    expect(screen.getByTestId("where")).toHaveTextContent(`?status=${status}`);
  });

  it("opens on the status in the URL, and ignores one it does not know", async () => {
    ready([event()]);
    renderAt("/advisor/outbox?status=dead");
    await screen.findByText("Acme");
    expect(listOutboxEvents).toHaveBeenCalledWith("dead");
    expect(screen.getByRole("button", { name: /^Dead/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("falls back to everything for an unknown status, including the retired 'sending'", async () => {
    ready([event()]);
    renderAt("/advisor/outbox?status=sending");
    await screen.findByText("Acme");
    expect(listOutboxEvents).toHaveBeenCalledWith(null);
  });

  it("says so, and offers everything, when a status has no events", async () => {
    ready([], summaryOf({ sent: 3 }));
    renderAt("/advisor/outbox?status=dead");
    expect(await screen.findByText("No dead notifications.")).toBeInTheDocument();
    listOutboxEvents.mockResolvedValue([event()]);
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    await screen.findByText("Acme");
    expect(listOutboxEvents).toHaveBeenLastCalledWith(null);
  });

  it("explains an empty queue", async () => {
    ready([], summaryOf({}));
    renderAt();
    expect(await screen.findByText("No notifications yet.")).toBeInTheDocument();
  });

  describe("retrying", () => {
    it("offers Retry send on a dead event only", async () => {
      ready(
        [event(), event({ id: "e2", status: "pending" }), event({ id: "e3", status: "claimed", attempts: 1, last_error: null }), event({ id: "e4", status: "sent", last_error: null, sent_at: "2026-10-29T09:05:00Z" })],
        summaryOf({ dead: 1, pending: 1, claimed: 1, sent: 1 }),
      );
      renderAt();
      await screen.findAllByRole("row");
      expect(screen.getAllByRole("button", { name: /^Retry send/ })).toHaveLength(1);
      expect(screen.queryByRole("button", { name: /Rebuild and retry/ })).not.toBeInTheDocument();
    });

    it("requeues with one click, says it will go out on the next run, and reloads the queue", async () => {
      ready([event()]);
      requeueOutboxEvent.mockResolvedValue(true);
      renderAt();
      const button = await screen.findByRole("button", { name: "Retry send: Advisor alert for Acme" });
      listOutboxEvents.mockResolvedValue([event({ status: "pending", attempts: 0, last_error: null, requeue_count: 1 })]);
      outboxSummary.mockResolvedValue(summaryOf({ pending: 1 }));
      fireEvent.click(button);
      await waitFor(() => expect(requeueOutboxEvent).toHaveBeenCalledWith("e1", false));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("next run")));
      expect(await screen.findByText("0 / 5")).toBeInTheDocument();
      expect(screen.getByText("Retried 1 time")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Retry send/ })).not.toBeInTheDocument();
    });

    it("says nothing was changed when the event was no longer dead", async () => {
      ready([event()]);
      requeueOutboxEvent.mockResolvedValue(false);
      renderAt();
      fireEvent.click(await screen.findByRole("button", { name: /^Retry send/ }));
      await waitFor(() => expect(toast.message).toHaveBeenCalledWith(expect.stringContaining("no longer dead")));
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("shows the database's refusal and stays on the page, ready to try again", async () => {
      ready([event()]);
      requeueOutboxEvent.mockRejectedValue(Object.assign(new Error("You don't have advisor access."), { forbidden: true }));
      renderAt();
      fireEvent.click(await screen.findByRole("button", { name: /^Retry send/ }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("You don't have advisor access."));
      expect(screen.getByRole("button", { name: /^Retry send/ })).toBeEnabled();
    });

    it("cannot be double-clicked while a retry is in flight", async () => {
      ready([event(), event({ id: "e2", session_id: "s2", company_name: "Beta" })], summaryOf({ dead: 2 }));
      let finish!: (v: boolean) => void;
      requeueOutboxEvent.mockReturnValue(new Promise<boolean>((resolve) => { finish = resolve; }));
      renderAt();
      const [first, second] = await screen.findAllByRole("button", { name: /^Retry send/ });
      fireEvent.click(first);
      await waitFor(() => expect(first).toBeDisabled());
      expect(second).toBeDisabled();
      fireEvent.click(first);
      expect(requeueOutboxEvent).toHaveBeenCalledTimes(1);
      finish(true);
      await waitFor(() => expect(toast.success).toHaveBeenCalled());
    });

    describe("an event with an email already written", () => {
      const frozen = () => ready([event({ frozen: true, last_error: "timeout" })]);

      it("offers a rebuild as a separate, confirmed step that says what it risks", async () => {
        frozen();
        requeueOutboxEvent.mockResolvedValue(true);
        renderAt();
        fireEvent.click(await screen.findByRole("button", { name: /^Rebuild and retry/ }));
        const dialog = await screen.findByRole("alertdialog");
        expect(dialog).toHaveTextContent("may have been delivered");
        expect(dialog).toHaveTextContent("second copy");
        expect(requeueOutboxEvent).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole("button", { name: "Rebuild and retry" }));
        await waitFor(() => expect(requeueOutboxEvent).toHaveBeenCalledWith("e1", true));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      });

      it("does nothing if the advisor cancels", async () => {
        frozen();
        renderAt();
        fireEvent.click(await screen.findByRole("button", { name: /^Rebuild and retry/ }));
        fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
        expect(requeueOutboxEvent).not.toHaveBeenCalled();
      });

      it("keeps the plain Retry send as the same-email, same-key path", async () => {
        frozen();
        requeueOutboxEvent.mockResolvedValue(true);
        renderAt();
        fireEvent.click(await screen.findByRole("button", { name: /^Retry send/ }));
        await waitFor(() => expect(requeueOutboxEvent).toHaveBeenCalledWith("e1", false));
      });
    });
  });

  describe("health", () => {
    it("warns when the longest-waiting due event has waited ten minutes or more", async () => {
      const due = new Date(Date.now() - 25 * 60_000).toISOString();
      ready([event({ status: "pending", last_error: "not_configured: ADVISORY_NOTIFY_EMAIL is not set to valid address(es)", attempts: 0 })], summaryOf({ pending: 1 }, due));
      renderAt();
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/Nothing has picked up the queue for 2[45] minutes/);
      // And the event says why, in words.
      expect(screen.getByText(/Not being sent until this is fixed: ADVISORY_NOTIFY_EMAIL is not set to valid address\(es\)/)).toBeInTheDocument();
    });

    it("is quiet while the queue is being worked", async () => {
      ready([event({ status: "pending", attempts: 1 })], summaryOf({ pending: 1 }, new Date(Date.now() - 2 * 60_000).toISOString()));
      renderAt();
      await screen.findByText("Acme");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("flags a claim whose worker is gone", async () => {
      ready([event({ status: "claimed", attempts: 2, claim_lapsed: true, claimed_at: "2026-10-29T08:00:00Z", last_error: null })], summaryOf({ claimed: 1 }));
      renderAt();
      expect(await screen.findByText(/Claim lapsed: its worker is gone/)).toBeInTheDocument();
    });
  });

  describe("when it cannot load", () => {
    it("tells an account that lost the advisor role, with nothing to retry", async () => {
      const denied = Object.assign(new Error("You don't have advisor access."), { forbidden: true });
      listOutboxEvents.mockRejectedValue(denied);
      outboxSummary.mockRejectedValue(denied);
      renderAt();
      expect(await screen.findByText("You no longer have advisor access.")).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("offers a retry for any other failure", async () => {
      listOutboxEvents.mockRejectedValueOnce(new Error("Network down"));
      outboxSummary.mockResolvedValue(summaryOf({}));
      renderAt();
      expect(await screen.findByText("We couldn't load the outbox.")).toBeInTheDocument();
      expect(screen.getByText("Network down")).toBeInTheDocument();
      listOutboxEvents.mockResolvedValue([event()]);
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(await screen.findByText("Acme")).toBeInTheDocument();
    });
  });
});
