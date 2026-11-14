import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allStatuses, expectStatusesOutsideBusy, spoken, watchSlowTimers } from "@/test/loading";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
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

const GoBack = () => { const navigate = useNavigate(); return <button type="button" onClick={() => navigate(-1)}>Go back</button>; };
const Where = () => <><p data-testid="where">{useLocation().search}</p><GoBack /></>;

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
      expect(spoken()).toHaveLength(1);
      expect(spoken()[0]).toHaveTextContent("Loading the outbox");
      expect(allStatuses()).toHaveLength(2);
      expectStatusesOutsideBusy();
      expect(container.querySelector("[class*='animate-pulse']")!.className).toContain("motion-safe:");
      // The filters change the question, so they stay usable; Refresh needs rows, so it waits.
      expect(screen.getByRole("button", { name: /^Dead/ })).toBeEnabled();
      const refresh = screen.getByRole("button", { name: "Refresh" });
      expect(refresh).toHaveAttribute("aria-disabled", "true");
      expect(refresh).toHaveAccessibleDescription("Available when the outbox has loaded");
      const asked = listOutboxEvents.mock.calls.length;
      fireEvent.click(refresh);
      expect(listOutboxEvents.mock.calls.length).toBe(asked);
    });

    // Catches: the table moving down a line when the events arrive (the "N notifications" line was only above the real table), and the
    // status buttons widening when their counts appear.
    it("holds the line above the table and the room for the buttons' counts while loading, so nothing moves when the events arrive", async () => {
      const arrive = hang();
      const { container } = renderAt();
      const table = container.querySelector("table")!.closest("div.border")!;
      const reserved = table.previousElementSibling!;
      expect(reserved).toHaveAttribute("aria-hidden", "true");
      expect(reserved.className).toContain("h-4");
      expect(reserved.className).toContain("mb-2");
      const group = screen.getByRole("group", { name: "Filter by status" });
      expect(within(group).getByRole("button", { name: "Dead" })).toBeInTheDocument();
      const countRoom = (b: HTMLElement) => b.querySelector("span.inline-block")!.className;
      const loadingRoom = within(group).getAllByRole("button").map(countRoom);
      await arrive([event(), event({ id: "e2", company_name: "Beta" })]);
      await screen.findByText("Beta");
      const line = screen.getByText(/2 notifications, newest first/);
      expect(line.nextElementSibling).toBe(container.querySelector("table")!.closest("div.border"));
      expect(line.className).toContain("mb-2");
      expect(within(screen.getByRole("group", { name: "Filter by status" })).getAllByRole("button").map(countRoom)).toEqual(loadingRoom);
      expect(screen.getByRole("button", { name: "Dead (2)" })).toBeInTheDocument();
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
      expect(spoken()).toHaveLength(1);
    });

    // Catches: the slow line at nine seconds, or not a status, or Try again not asking again and not counting afresh.
    it("says it is taking longer than usual at ten seconds, not nine, under the title; Try again asks again", async () => {
      vi.useFakeTimers();
      hang();
      renderAt();
      const container = allStatuses().find((e) => !e.textContent)!;
      expect(container).toBeDefined();
      await tick(9_000);
      expect(slowLine()).not.toBeInTheDocument();
      await tick(1_000);
      expect(slowLine()).toBe(container);
      expect(slowLine()).toHaveAttribute("role", "status");
      expectStatusesOutsideBusy();
      expect(screen.getByRole("heading", { name: "Outbox & Notifications" }).parentElement).toContainElement(slowLine());
      expect(spoken()).toHaveLength(2);
      expect(screen.getByRole("button", { name: "Refresh" })).toHaveAttribute("aria-disabled", "true");
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
      expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load the outbox.");
      expect(slowLine()).not.toBeInTheDocument();
    });

    // Catches: a ten-second timer left running after the page is closed.
    it("leaves no timer behind when the page is closed while waiting", async () => {
      vi.useFakeTimers();
      hang();
      const timers = watchSlowTimers();
      const { unmount } = renderAt();
      await tick(3_000);
      unmount();
      timers.expectAllCleared();
      timers.restore();
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

    // Catches (D-144): a status change blanking the page: the summary empties, the stall alert vanishes and comes back (announced again on every
    // click) and the page jumps. The events of the status just left stay, dimmed and marked busy, which is what says they are not the new one's.
    it("keeps the events, the counts and the stall alert, dimmed and busy, while another status loads, and swaps when its events arrive", async () => {
      ready([event()], summaryOf({ dead: 1, sent: 7 }, "2026-10-29T08:00:00Z"));
      const { container } = renderAt();
      await screen.findByText("Acme");
      const alert = screen.getByRole("alert");
      const box = container.querySelector("table")!.closest("div.border")!;
      expect(box).not.toHaveAttribute("aria-busy");
      let arrive!: (v: unknown) => void;
      listOutboxEvents.mockReturnValue(new Promise((r) => { arrive = r; }));
      fireEvent.click(screen.getByRole("button", { name: /^Sent/ }));
      await waitFor(() => expect(listOutboxEvents).toHaveBeenLastCalledWith("sent"));
      expect(screen.getByText("Acme")).toBeInTheDocument();
      expect(container.querySelector("tbody[aria-hidden=true]")).toBeNull();
      expect(box).toHaveAttribute("aria-busy", "true");
      expect(box).toHaveClass("opacity-70");
      expect(screen.getByRole("button", { name: "Sent (7)" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Dead (1)" })).toBeInTheDocument();
      // The alert is the same node, not removed and put back (which would announce it again).
      expect(screen.getByRole("alert")).toBe(alert);
      expect(allStatuses().filter((e) => e.textContent)).toHaveLength(0);
      await act(async () => arrive([event({ id: "e9", company_name: "Sent Co", status: "sent", last_error: null })]));
      expect(await screen.findByText("Sent Co")).toBeInTheDocument();
      expect(screen.queryByText("Acme")).not.toBeInTheDocument();
      expect(container.querySelector("table")!.closest("div.border")).toBe(box);
      expect(box).not.toHaveAttribute("aria-busy");
      expect(box).not.toHaveClass("opacity-70");
      expect(screen.getByRole("alert")).toBe(alert);
    });

    // Catches: a refresh of the same status dimming the events (dimming says "these answer another status").
    it("does not dim the events for a refresh of the same status", async () => {
      ready([event()]);
      const { container } = renderAt();
      await screen.findByText("Acme");
      listOutboxEvents.mockReturnValue(new Promise(() => {}));
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await waitFor(() => expect(listOutboxEvents).toHaveBeenCalledTimes(2));
      const box = container.querySelector("table")!.closest("div.border")!;
      expect(box).not.toHaveAttribute("aria-busy");
      expect(box).not.toHaveClass("opacity-70");
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

  // CRM-S2.2: nothing yet and nothing matches, as one table that keeps its headers and its status buttons.
  describe("when no notifications are shown (CRM-S2.2)", () => {
    const headers = () => within(screen.getByRole("table")).getAllByRole("columnheader").map((h) => h.textContent);
    const HEADERS = ["Notification", "Status", "Attempts", "When", "Last error", "Actions"];

    // Catches: an empty outbox worded as a filter that excluded everything, or offering "Show all" with nothing to show.
    it("says nothing yet, with no action, when the outbox holds no notification at all", async () => {
      ready([], summaryOf({}));
      renderAt();
      expect(await screen.findByText("Notifications appear here when a prospect certifies an intake.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Show all notifications|Clear/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/No notifications are/)).not.toBeInTheDocument();
      expect(headers()).toEqual(HEADERS);
      expect(screen.getByRole("button", { name: /^Dead/ })).toBeInTheDocument();
      expect(within(screen.getByRole("table")).queryAllByRole("button")).toHaveLength(0);
      expect(spoken().map((e) => e.textContent)).toHaveLength(1);
      expectStatusesOutsideBusy();
    });

    // Catches: a status with none being told "nothing yet" while the outbox holds notifications in other statuses (the summary says they exist).
    it("says no notifications are in that status, names it and offers all, when the others hold some", async () => {
      ready([], summaryOf({ sent: 3 }));
      renderAt("/advisor/outbox?status=dead");
      expect(await screen.findByText("No notifications are dead.")).toBeInTheDocument();
      expect(within(screen.getByRole("list", { name: "What is in force" })).getAllByRole("listitem").map((i) => i.textContent)).toEqual(["Status: Dead"]);
      expect(screen.queryByText(/appear here/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /new|create|add|start/i })).not.toBeInTheDocument();
      expect(headers()).toEqual(HEADERS);
      expect(spoken()).toHaveLength(1);
      listOutboxEvents.mockResolvedValue([event()]);
      const clear = screen.getByRole("button", { name: "Show all notifications" });
      clear.focus();
      fireEvent.click(clear);
      await screen.findByText("Acme");
      expect(listOutboxEvents).toHaveBeenLastCalledWith(null);
      expect(screen.getByTestId("where")).toHaveTextContent("");
      expect(screen.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: /^All/ })).toHaveFocus();
    });

    // Catches: "Show all notifications" replacing the history entry, so Back cannot return to the status the person just left.
    it("makes showing all a step Back undoes", async () => {
      ready([], summaryOf({ sent: 3 }));
      renderAt("/advisor/outbox?status=dead");
      await screen.findByText("No notifications are dead.");
      fireEvent.click(screen.getByRole("button", { name: "Show all notifications" }));
      await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/^$/));
      fireEvent.click(screen.getByRole("button", { name: "Go back" }));
      await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("?status=dead"));
    });

    // Catches: "No notifications are dead" being said when the outbox has no notification of any status, which would suggest others exist.
    it("says nothing yet, not that none are in the status, when a status is chosen and the outbox is empty altogether", async () => {
      ready([], summaryOf({}));
      renderAt("/advisor/outbox?status=dead");
      expect(await screen.findByText("Notifications appear here when a prospect certifies an intake.")).toBeInTheDocument();
      expect(screen.queryByText(/No notifications are/)).not.toBeInTheDocument();
    });

    // Catches: the table being rebuilt for the empty answer (focus lost, page jump), or a status change over an empty list blanking the words.
    it("is the same table from the grey rows to the empty state to the rows, with focus kept on the status button", async () => {
      let arrive: (v: unknown) => void = () => undefined;
      listOutboxEvents.mockReturnValue(new Promise((r) => { arrive = r; }));
      outboxSummary.mockResolvedValue(summaryOf({ sent: 2 }));
      renderAt();
      const table = screen.getByRole("table");
      const dead = screen.getByRole("button", { name: /^Dead/ });
      dead.focus();
      await act(async () => arrive([]));
      await screen.findByText(/appear here/);
      expect(screen.getByRole("table")).toBe(table);
      expect(dead).toHaveFocus();
      listOutboxEvents.mockResolvedValue([event()]);
      fireEvent.click(dead);
      await screen.findByText("Acme");
      expect(screen.getByRole("table")).toBe(table);
      expect(dead).toHaveFocus();
    });

    // Catches: the empty words describing a status the person has just chosen but whose answer has not arrived (it would say "dead" for the previous answer's list).
    it("keeps the words it has, dimmed, until the answer for a newly chosen status arrives", async () => {
      ready([], summaryOf({ sent: 3 }));
      renderAt();
      await screen.findByText(/appear here/);
      listOutboxEvents.mockReturnValue(new Promise(() => {}));
      fireEvent.click(screen.getByRole("button", { name: /^Dead/ }));
      await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("?status=dead"));
      expect(screen.getByText(/appear here/)).toBeInTheDocument();
      expect(screen.queryByText(/No notifications are/)).not.toBeInTheDocument();
    });

    // Catches: an empty outbox that gains a notification not showing it on Refresh, or one that loses its last one not falling back to the words.
    it("goes from empty to rows and back when a refresh finds a different answer", async () => {
      ready([], summaryOf({}));
      renderAt();
      await screen.findByText(/appear here/);
      ready([event()], summaryOf({ dead: 1 }));
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await screen.findByText("Acme");
      ready([], summaryOf({}));
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await screen.findByText(/appear here/);
      expect(headers()).toEqual(HEADERS);
    });
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
      expect(screen.queryByText("Network down")).not.toBeInTheDocument();
      listOutboxEvents.mockResolvedValue([event()]);
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(await screen.findByText("Acme")).toBeInTheDocument();
    });
  });
});
