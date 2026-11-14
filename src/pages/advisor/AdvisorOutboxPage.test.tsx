import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { OutboxEvent, OutboxSummaryRow } from "@/lib/advisorApi";

const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "adv@example.com" }, signOut }) }));
// The header asks which firm the address names; these pages are tested at the bare domain.
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => ({ status: "none" }) }));
const listOutboxEvents = vi.fn();
const outboxSummary = vi.fn();
const requeueOutboxEvent = vi.fn();
vi.mock("@/lib/advisorApi", () => ({
  fetchMyFirms: () => Promise.resolve([{ firm_id: "f1", name: "Alpha Advisory", address: "alpha", role: "agent" }]),
  fetchIsAdmin: () => Promise.resolve(false),
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
  ["pending", "claimed", "sent", "dead", "suppressed"].map((status) => ({
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
  describe("loading (CRM-S2.1)", () => {
    const HEADERS = ["Notification", "Status", "Attempts", "When", "Last error", "Actions"];
    const slowLine = () => screen.queryByText("This is taking longer than usual.");
    const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
    afterEach(() => { cleanup(); vi.useRealTimers(); });
    const hang = () => {
      let arrive!: (v: unknown) => void;
      let arriveSummary!: (v: unknown) => void;
      listOutboxEvents.mockReturnValue(new Promise((r) => { arrive = r; }));
      outboxSummary.mockReturnValue(new Promise((r) => { arriveSummary = r; }));
      return (events: OutboxEvent[]) => act(async () => { arrive(events); arriveSummary(summaryOf({ dead: events.length })); });
    };

    // Catches: the title, the status filters and the column headers waiting behind a spinner; grey rows not drawn under the real
    // headers; the placeholders read row by row; Refresh usable with nothing to refresh.
    it("shows the title, the filters and the column headers at once, with eight grey rows and one status", () => {
      hang();
      const { container } = renderAt();
      expect(screen.getByRole("heading", { name: "Outbox & Notifications" })).toBeInTheDocument();
      expect(screen.getByRole("group", { name: "Filter by status" })).toBeInTheDocument();
      expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(HEADERS);
      expect(container.querySelectorAll("tbody tr")).toHaveLength(8);
      for (const r of Array.from(container.querySelectorAll("tbody tr"))) expect(r.children).toHaveLength(HEADERS.length);
      expect(container.querySelector("tbody")).toHaveAttribute("aria-hidden", "true");
      expect(screen.getAllByRole("row")).toHaveLength(1);
      const statuses = screen.getAllByRole("status");
      expect(statuses).toHaveLength(1);
      expect(statuses[0]).toHaveTextContent("Loading the outbox");
      expect(container.querySelector("[class*='animate-pulse']")!.className).toContain("motion-safe:");
      // The filters change the question, so they stay usable; Refresh needs rows, so it waits.
      expect(screen.getByRole("button", { name: /^Dead/ })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    });

    // Catches: a different table replacing the placeholders (other headers, a second table), so the page jumps; a status left behind.
    it("is the same table with the same headers once the events arrive, and the status is gone", async () => {
      const arrive = hang();
      const { container } = renderAt();
      await arrive([event(), event({ id: "e2", company_name: "Beta" })]);
      await screen.findByText("Beta");
      expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(HEADERS);
      expect(container.querySelectorAll("table")).toHaveLength(1);
      expect(container.querySelectorAll("tbody")).toHaveLength(1);
      expect(container.querySelector("tbody[aria-hidden=true]")).toBeNull();
      expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
      expect(screen.queryByText(/Loading the outbox/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
    });

    // Catches: the filters being locked while the first answer is slow, so a person can't ask for something else.
    it("asks again for another status while the first answer is slow, with one status", async () => {
      hang();
      renderAt();
      fireEvent.click(screen.getByRole("button", { name: /^Sent/ }));
      await waitFor(() => expect(listOutboxEvents).toHaveBeenLastCalledWith("sent"));
      expect(screen.getAllByRole("status")).toHaveLength(1);
    });

    // Catches: the slow line at nine seconds, or not a status, or Try again not asking again and not counting afresh.
    it("says it is taking longer than usual at ten seconds, not nine, under the title; Try again asks again", async () => {
      vi.useFakeTimers();
      hang();
      renderAt();
      await tick(9_000);
      expect(slowLine()).not.toBeInTheDocument();
      await tick(1_000);
      expect(slowLine()).toHaveAttribute("role", "status");
      expect(screen.getByRole("heading", { name: "Outbox & Notifications" }).parentElement).toContainElement(slowLine());
      expect(screen.getAllByRole("status")).toHaveLength(2);
      expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
      const asked = listOutboxEvents.mock.calls.length;
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      await tick(0);
      expect(listOutboxEvents.mock.calls.length).toBe(asked + 1);
      expect(slowLine()).not.toBeInTheDocument();
      await tick(9_000);
      expect(slowLine()).not.toBeInTheDocument();
      await tick(1_000);
      expect(slowLine()).toBeInTheDocument();
    });

    // Catches: the line staying once the events are there or the load has failed.
    it("takes the line away when the events arrive, and when the load fails", async () => {
      vi.useFakeTimers();
      const arrive = hang();
      renderAt();
      await tick(10_000);
      expect(slowLine()).toBeInTheDocument();
      await arrive([event()]);
      await tick(0);
      expect(screen.getByText("Acme")).toBeInTheDocument();
      expect(slowLine()).not.toBeInTheDocument();
      cleanup();
      let fail!: (e: Error) => void;
      listOutboxEvents.mockReturnValue(new Promise((_, r) => { fail = r; }));
      outboxSummary.mockReturnValue(new Promise(() => {}));
      renderAt();
      await tick(10_000);
      expect(slowLine()).toBeInTheDocument();
      await act(async () => fail(new Error("Network request failed")));
      await tick(0);
      expect(screen.getByRole("alert")).toHaveTextContent("Network request failed");
      expect(slowLine()).not.toBeInTheDocument();
    });

    // Catches: a ten-second timer left running after the page is closed.
    it("leaves no timer behind when the page is closed while waiting", async () => {
      vi.useFakeTimers();
      hang();
      const started: unknown[] = [];
      const cleared = new Set<unknown>();
      const realSet = globalThis.setTimeout;
      const realClear = globalThis.clearTimeout;
      vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void, ms?: number, ...rest: unknown[]) => {
        const id = realSet(fn, ms, ...rest);
        if (ms === 10_000) started.push(id);
        return id;
      }) as typeof setTimeout);
      vi.spyOn(globalThis, "clearTimeout").mockImplementation(((id: never) => { cleared.add(id); realClear(id); }) as typeof clearTimeout);
      const { unmount } = renderAt();
      await tick(3_000);
      expect(started.length).toBeGreaterThan(0);
      unmount();
      for (const id of started) expect(cleared.has(id)).toBe(true);
      vi.restoreAllMocks();
    });

    // Catches (D-49): Refresh, or a retry's reload, with events on screen blanking them into grey rows or raising the slow line.
    it("keeps the events on screen, with no placeholders and no slow line, while Refresh asks again", async () => {
      vi.useFakeTimers();
      ready([event()]);
      const { container } = renderAt();
      await tick(0);
      expect(screen.getByText("Acme")).toBeInTheDocument();
      listOutboxEvents.mockReturnValue(new Promise(() => {}));
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await tick(25_000);
      expect(listOutboxEvents).toHaveBeenCalledTimes(2);
      expect(screen.getByText("Acme")).toBeInTheDocument();
      expect(container.querySelector("tbody[aria-hidden=true]")).toBeNull();
      expect(slowLine()).not.toBeInTheDocument();
      expect(screen.queryByText(/Loading the outbox/)).not.toBeInTheDocument();
    });

    // Catches: the rows of one status staying under another status's selected filter while the other's rows load.
    it("draws grey rows, not the old status's events, when another status is chosen", async () => {
      ready([event()]);
      const { container } = renderAt();
      await screen.findByText("Acme");
      listOutboxEvents.mockReturnValue(new Promise(() => {}));
      fireEvent.click(screen.getByRole("button", { name: /^Sent/ }));
      await waitFor(() => expect(container.querySelectorAll("tbody[aria-hidden=true] tr")).toHaveLength(8));
      expect(screen.queryByText("Acme")).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Loading the outbox");
    });
  });

  it("lists each event's kind, company, reference, status, attempts and last error, with a plain reading of it", async () => {
    ready([
      event({ last_error: "auth:403 (validation_error: The mail.example.com domain is not verified.)" }),
      event({ id: "e2", kind: "prospect_confirmation", status: "pending", attempts: 2, company_name: null, reference: null, last_error: "timeout",
              next_attempt_at: "2099-01-01T00:00:00Z", resubmission: true }),
    ], summaryOf({ dead: 1, pending: 1 }));
    renderAt();
    // The table is on screen from the first draw (its rows are grey until the events arrive, CRM-S2.1), so wait for the events.
    await screen.findByText("EAA-2026-ACME0001");
    const rows = screen.getAllByRole("row").slice(1);
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
    ready([event()], summaryOf({ dead: 2, pending: 1, claimed: 0, sent: 40, suppressed: 2 }));
    renderAt();
    const filters = within(await screen.findByRole("group", { name: "Filter by status" }));
    expect(filters.getByRole("button", { name: "All (45)" })).toHaveAttribute("aria-pressed", "true");
    expect(filters.getByRole("button", { name: "Suppressed (2)" })).toBeInTheDocument();
    expect(filters.getByRole("button", { name: "Dead (2)" })).toHaveAttribute("aria-pressed", "false");
    expect(filters.getByRole("button", { name: "Pending (1)" })).toBeInTheDocument();
    expect(filters.getByRole("button", { name: "Claimed (0)" })).toBeInTheDocument();
    expect(filters.getByRole("button", { name: "Sent (40)" })).toBeInTheDocument();
  });

  it.each(["dead", "sent", "pending", "claimed", "suppressed"] as const)("filters by %s, and keeps the filter in the URL", async (status) => {
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

  it("lists a suppressed email with why it was held back, and offers no retry", async () => {
    ready(
      [event({ id: "e9", kind: "prospect_confirmation", status: "suppressed", attempts: 0, last_error: "suppressed: bounced" })],
      summaryOf({ suppressed: 1 }),
    );
    renderAt("/advisor/outbox?status=suppressed");
    await screen.findByText("Suppressed", { selector: "span" });
    const row = within(screen.getAllByRole("row")[1]);
    expect(row.getByText("Suppressed")).toBeInTheDocument();
    expect(row.getByText(/this address bounced for good earlier, so it is not emailed again/)).toBeInTheDocument();
    expect(row.getByText("suppressed: bounced")).toBeInTheDocument();
    expect(row.getByText(/^Held back/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retry send|Rebuild/ })).not.toBeInTheDocument();
    expect(listOutboxEvents).toHaveBeenCalledWith("suppressed");
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
      requeueOutboxEvent.mockRejectedValue(Object.assign(new Error("You don't have access to this firm's records."), { forbidden: true }));
      renderAt();
      fireEvent.click(await screen.findByRole("button", { name: /^Retry send/ }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("You don't have access to this firm's records."));
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
      const denied = Object.assign(new Error("You don't have access to this firm's records."), { forbidden: true });
      listOutboxEvents.mockRejectedValue(denied);
      outboxSummary.mockRejectedValue(denied);
      renderAt();
      expect(await screen.findByText("You no longer have access to this firm's records.")).toBeInTheDocument();
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
