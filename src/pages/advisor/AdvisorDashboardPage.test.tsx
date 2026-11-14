import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import type { QueueRow } from "@/lib/queueApi";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";
import { allStatuses, expectStatusesOutsideBusy, spoken, watchSlowTimers } from "@/test/loading";
import { changeAddress, judgeAddress, OPERATORS, readAddress, sameAddress } from "@/components/workspace/table";

// The submissions queue on the workspace's table frame (story CRM-S3.5a). The database cuts the pages and runs the filters (supabase/tests/
// queue_query.sql); these tests are what a person sees and does through the page: the rows, "1 to 50 of 375 submissions", the pager's links, every
// old address, a garbage address, the Inbox filter, a refused filter, and that the rows stay while the next arrive (D-49, D-50).
const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "adv@example.com" }, signOut }) }));
// The header asks which firm the address names; these pages are tested at the bare domain.
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => ({ status: "none" }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
const listQueue = vi.fn();
const countQueueViews = vi.fn();
const listEmailProblems = vi.fn();
vi.mock("@/lib/advisorApi", async (original) => ({ ...(await original<typeof import("@/lib/advisorApi")>()), listEmailProblems: () => listEmailProblems() }));
// A test can resolve a plain list (one page holding everything) or a whole page with its own total.
vi.mock("@/lib/queueApi", async (original) => ({
  ...(await original<typeof import("@/lib/queueApi")>()),
  listQueue: async (opts: { page?: number }) => {
    const result = await listQueue(opts);
    return Array.isArray(result) ? { rows: result, total: result.length, page: opts.page ?? 1, pageSize: 50 } : { page: opts.page ?? 1, pageSize: 50, ...result };
  },
  countQueueViews: (...args: unknown[]) => countQueueViews(...args),
}));
// What the page asks listQueue for, for an address.
const query = (over: Record<string, unknown> = {}) => ({ filters: [], sort: null, page: 1, search: "", ...over });
const pipeline = (...values: string[]) => ({ field: "pipeline_status", op: "any_of", value: values });
const yes = (field: string) => ({ field, op: "is", value: true });

// A test can stand in for the definition the page reads, so a table whose views or fields arrive late can be tried through the page
// (the queue's own definition is in code and always ready).
const lateTable = vi.hoisted(() => ({ table: null as unknown, version: 0, listeners: new Set<() => void>() }));
vi.mock("@/components/advisor/queueTable", async (original) => {
  const real = await original<typeof import("@/components/advisor/queueTable")>();
  const { useSyncExternalStore } = await import("react");
  return {
    ...real,
    useQueueTable: () => {
      useSyncExternalStore((cb) => { lateTable.listeners.add(cb); return () => lateTable.listeners.delete(cb); }, () => lateTable.version);
      return (lateTable.table as typeof real.QUEUE_TABLE | null) ?? real.QUEUE_TABLE;
    },
  };
});
const { QUEUE_TABLE, QUEUE_VIEWS } = await vi.importActual<typeof import("@/components/advisor/queueTable")>("@/components/advisor/queueTable");
const setTable = (table: typeof QUEUE_TABLE | null) =>
  act(() => { lateTable.table = table; lateTable.version++; lateTable.listeners.forEach((l) => l()); });

const { default: AdvisorDashboardPage } = await import("./AdvisorDashboardPage");

const row = (over: Partial<QueueRow> = {}): QueueRow => ({
  session_id: "s1",
  company_name: "Acme",
  contact_name: "Pat Prospect",
  employee_count: 12,
  pipeline_status: "submitted",
  intake_status: "submitted",
  signer_name: "Jo Doe",
  submitted_at: "2026-10-01T12:00:00Z",
  created_at: "2026-09-30T12:00:00Z",
  updated_at: "2026-10-01T12:00:00Z",
  missing_required: [],
  open_fields: 0,
  flagged_fields: 0,
  verified_fields: 0,
  file_id: "EAA-2026-ACME0001",
  states: ["CA", "NY"],
  needs_action: false,
  needs_action_note: null,
  quote_requests_sent: 0,
  quotes_received: 0,
  oldest_waiting_on: null,
  earliest_quote_expires_on: null,
  sent_older_version: false,
  new_peo_mail_requests: 0,
  start_month: null,
  has_new_peo_mail: false,
  waiting_on_peo: false,
  ...over,
});

const ShowId = () => <p>Detail page for {useParams().id}</p>;
const LocationProbe = () => <p data-testid="location">{useLocation().search}</p>;

const renderAt = (url = "/advisor") =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/advisor" element={<><AdvisorDashboardPage /><LocationProbe /></>} />
          <Route path="/advisor/submissions/:id" element={<ShowId />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
const where = () => screen.getByTestId("location").textContent;

const companyOrder = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("link")[0].textContent);

// A page of a list of `total` companies, 50 to a page, as the database cuts it.
const pageOf = (page: number, total: number) => ({
  rows: Array.from({ length: Math.max(0, Math.min(50, total - (page - 1) * 50)) }, (_, i) =>
    row({ session_id: `s${(page - 1) * 50 + i}`, company_name: `Company ${(page - 1) * 50 + i + 1}` })),
  total,
});

describe("AdvisorDashboardPage", () => {
  beforeEach(() => {
    lateTable.table = null;
    listQueue.mockReset();
    countQueueViews.mockReset().mockResolvedValue([]);
    listEmailProblems.mockReset().mockResolvedValue([]);
    signOut.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  describe("the Inbox", () => {
    // Catches: Inbox (the menu's "Inbox, 2 with new mail") opening the whole queue, so the number and the rows disagree (D-133).
    it("asks the database only for the intakes with new PEO mail when opened from the menu's Inbox link, and says so in the address", async () => {
      listQueue.mockResolvedValue([row({ new_peo_mail_requests: 1, has_new_peo_mail: true })]);
      renderAt("/advisor?mail=new");
      await screen.findByRole("link", { name: "Acme" });
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [yes("has_new_peo_mail")] }));
      expect(listQueue).not.toHaveBeenCalledWith(query());
      await waitFor(() => expect(where()).toBe("?filter=has_new_peo_mail:is:true"));
      expect(screen.getByText("New PEO mail")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Submissions" })).toBeInTheDocument();
    });

    // Catches: the interim "Showing every submission" line surviving now that the filter is real.
    it("shows no line saying every submission is shown, and says what an empty Inbox means", async () => {
      listQueue.mockResolvedValue([]);
      renderAt("/advisor?mail=new");
      expect(await screen.findByText("No submissions with new PEO mail.")).toBeInTheDocument();
      expect(screen.queryByText(/Showing every submission/)).not.toBeInTheDocument();
    });

    // Catches: the ordinary queue, or another value of the parameter, being filtered.
    it("filters nothing on the ordinary queue or for another value of the parameter", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt("/advisor?mail=old");
      await screen.findByRole("link", { name: "Acme" });
      expect(listQueue).toHaveBeenLastCalledWith(query());
      await waitFor(() => expect(where()).toBe(""));
    });
  });

  describe("loading (CRM-S2.1)", () => {
    const HEADERS = ["Company", "Contact", "States", "Employees", "Submitted", "Status", "Completeness", "Quotes"];
    const placeholderRows = (container: HTMLElement) => container.querySelectorAll("tbody tr");

    // Catches: the whole page waiting behind one spinner, so the title, search, tabs and column headers pop in late; or the grey rows
    // not being drawn inside the real table under the real headers; or the placeholders being read out row by row.
    it("shows the frame at once, with eight grey rows under the real column headers and one status", () => {
      listQueue.mockReturnValue(new Promise(() => {}));
      const { container } = renderAt();
      expect(screen.getByRole("heading", { name: "Submissions" })).toBeInTheDocument();
      expect(screen.getByRole("searchbox", { name: "Search" })).toBeEnabled();
      expect(screen.getByRole("navigation", { name: "Views" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
      expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(HEADERS);
      expect(placeholderRows(container)).toHaveLength(8);
      for (const r of Array.from(placeholderRows(container))) expect(r.children).toHaveLength(HEADERS.length);
      // Hidden from a screen reader, and one polite status says what is loading.
      expect(container.querySelector("tbody")).toHaveAttribute("aria-hidden", "true");
      expect(screen.queryAllByRole("row")).toHaveLength(1);
      expect(spoken()).toHaveLength(1);
      expect(spoken()[0]).toHaveTextContent("Loading submissions");
      expect(spoken()[0]).toHaveAttribute("aria-live", "polite");
      // The slow-load line's status is already on the page, empty, ready to be filled; neither is inside a busy element.
      expect(allStatuses()).toHaveLength(2);
      expectStatusesOutsideBusy();
      expect(screen.getByRole("region", { name: /Submissions/ })).toHaveAttribute("aria-busy", "true");
      expect(screen.queryByRole("link", { name: "Next" })).not.toBeInTheDocument();
    });

    // Catches: the table being torn down and rebuilt when the rows arrive (a loading table and a real table as different elements), which loses
    // a keyboard user's focus on the scroll box and the sideways scroll, so the page jumps; and a status left behind after the data is there.
    it("is the very same table element when the rows arrive: focus and the scroll position stay, headers and columns stay, the status is gone", async () => {
      let arrive!: (v: unknown) => void;
      listQueue.mockReturnValue(new Promise((r) => { arrive = r; }));
      const { container } = renderAt();
      const box = screen.getByRole("region", { name: /Submissions/ });
      const table = screen.getByRole("table");
      const head = container.querySelector("thead")!;
      box.focus();
      box.scrollLeft = 40;
      expect(document.activeElement).toBe(box);
      const before = screen.getAllByRole("columnheader").map((h) => h.textContent);
      await act(async () => arrive([row(), row({ session_id: "s2", company_name: "Beta" })]));
      await screen.findByRole("link", { name: "Acme" });
      expect(screen.getByRole("region", { name: /Submissions/ })).toBe(box);
      expect(screen.getByRole("table")).toBe(table);
      expect(container.querySelector("thead")).toBe(head);
      expect(document.activeElement).toBe(box);
      expect(box.scrollLeft).toBe(40);
      expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(before);
      expect(container.querySelectorAll("tbody")).toHaveLength(1);
      expect(placeholderRows(container)).toHaveLength(2);
      expect(container.querySelector("tbody[aria-hidden=true]")).toBeNull();
      expect(box).not.toHaveAttribute("aria-busy");
      // The only status left is the pager's range.
      expect(spoken().map((e) => e.textContent)).toEqual(["1 to 2 of 2 submissions"]);
      expect(allStatuses()).toHaveLength(1);
    });

    // Catches: a column's grey bar not following its alignment, so the headcount's bars sit on the left under a right-aligned header.
    it("draws a column's grey bars on the side its header is on", () => {
      listQueue.mockReturnValue(new Promise(() => {}));
      const { container } = renderAt();
      const employees = HEADERS.indexOf("Employees");
      const company = HEADERS.indexOf("Company");
      const cells = (i: number) => Array.from(placeholderRows(container)).map((r) => r.children[i]);
      expect(screen.getAllByRole("columnheader")[employees]).toHaveClass("text-right");
      for (const cell of cells(employees)) expect(cell.firstElementChild).toHaveClass("justify-end");
      // The name column's bar is the widest.
      const width = (cell: Element) => cell.querySelector("span span")!.className.match(/w-(\d+)/)![1];
      expect(Number(width(cells(company)[0]))).toBeGreaterThan(Number(width(cells(HEADERS.indexOf("Contact"))[0])));
    });

    // Catches: the shimmer running for a person who asked for less motion (the class must only animate when motion is allowed).
    it("shimmers only when motion is allowed", () => {
      listQueue.mockReturnValue(new Promise(() => {}));
      const { container } = renderAt();
      const bars = container.querySelectorAll("tbody span span");
      expect(bars.length).toBe(8 * HEADERS.length);
      for (const bar of Array.from(bars)) {
        expect(bar.className).toContain("motion-safe:animate-pulse");
        expect(bar.className).not.toMatch(/(^|\s)animate-pulse/);
      }
    });

    // Catches: the status being announced again each time the page draws (it must keep the same element and words), or once per row.
    it("keeps the one status through a re-draw of the page while it waits", async () => {
      listQueue.mockReturnValue(new Promise(() => {}));
      renderAt();
      const status = spoken()[0];
      fireEvent.click(screen.getByLabelText("Waiting on a PEO only"));
      await waitFor(() => expect(where()).toBe("?filter=waiting_on_peo:is:true"));
      expect(spoken()).toHaveLength(1);
      expect(spoken()[0]).toBe(status);
      expect(status).toHaveTextContent("Loading submissions");
    });

    describe("controls while the rows are on their way", () => {
      // Catches: search, which changes the query, being locked while the first answer is slow (a person can't correct what they typed),
      // and the pager and Refresh, which need rows, being usable before there are any.
      it("keeps search, the filters, the Sort box and the tabs usable, and has no pager and no usable Refresh", async () => {
        listQueue.mockReturnValue(new Promise(() => {}));
        renderAt();
        expect(screen.getByRole("searchbox", { name: "Search" })).toBeEnabled();
        expect(screen.getByLabelText("Needs advisor action only")).toBeEnabled();
        expect(screen.getByLabelText("Waiting on a PEO only")).toBeEnabled();
        expect(screen.getByLabelText("Sort")).toBeEnabled();
        // Refresh stays in the tab order, says why it can't be used, and ignores the click.
        const refresh = screen.getByRole("button", { name: "Refresh" });
        expect(refresh).toHaveAttribute("aria-disabled", "true");
        expect(refresh).toHaveAccessibleDescription("Available when the list has loaded");
        const asked = listQueue.mock.calls.length;
        fireEvent.click(refresh);
        expect(listQueue.mock.calls.length).toBe(asked);
        expect(screen.queryByRole("navigation", { name: "Pages" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Next" })).not.toBeInTheDocument();
        fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), { target: { value: "acme" } });
        await waitFor(() => expect(where()).toBe("?q=acme"));
        fireEvent.click(screen.getByRole("link", { name: /^Won/ }));
        await waitFor(() => expect(where()).toBe("?view=won&q=acme"));
        // Asked again for the corrected question; still one status.
        expect(listQueue).toHaveBeenLastCalledWith(query({ search: "acme", filters: [pipeline("won")] }));
        expect(spoken()).toHaveLength(1);
      });
    });

    describe("taking longer than usual", () => {
      const slowLine = () => screen.queryByText("This is taking longer than usual.");
      const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

      // Catches: the line coming at nine seconds or never, or arriving without its status role (so it is not announced), or without a way out.
      it("appears at ten seconds, not at nine, under the title, as one status with a Try again button", async () => {
        vi.useFakeTimers();
        listQueue.mockReturnValue(new Promise(() => {}));
        renderAt();
        // The status is on the page from the first draw, empty, so that what fills it is announced.
        const container = allStatuses().find((e) => !e.textContent)!;
        expect(container).toBeDefined();
        await tick(9_000);
        expect(slowLine()).not.toBeInTheDocument();
        expect(container).toBeEmptyDOMElement();
        await tick(1_000);
        const line = slowLine()!;
        expect(line).toBeInTheDocument();
        expect(line).toBe(container);
        expect(line).toHaveAttribute("role", "status");
        expectStatusesOutsideBusy();
        expect(within(line).getByRole("button", { name: "Try again" })).toBeInTheDocument();
        // Under the title, in the page's own frame, and now two statuses: the loading words and this line, each once.
        const title = screen.getByRole("heading", { name: "Submissions" });
        expect(title.parentElement).toContainElement(line);
        expect(spoken().map((e) => e.textContent)).toEqual(expect.arrayContaining(["Loading submissions", "This is taking longer than usual. Try again"]));
        expect(spoken()).toHaveLength(2);
      });

      // Catches: "Try again" doing nothing, or not starting the ten seconds over (so it comes straight back).
      it("asks for the rows again on Try again, takes the line away, and counts ten seconds afresh", async () => {
        vi.useFakeTimers();
        listQueue.mockReturnValue(new Promise(() => {}));
        renderAt();
        await tick(10_000);
        const asked = listQueue.mock.calls.length;
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        await tick(0);
        expect(listQueue.mock.calls.length).toBe(asked + 1);
        expect(slowLine()).not.toBeInTheDocument();
        await tick(9_000);
        expect(slowLine()).not.toBeInTheDocument();
        await tick(1_000);
        expect(slowLine()).toBeInTheDocument();
      });

      // Catches: the line staying once the rows are there, or a late arrival leaving the placeholders.
      it("goes away when the rows arrive", async () => {
        vi.useFakeTimers();
        let arrive!: (v: unknown) => void;
        listQueue.mockReturnValue(new Promise((r) => { arrive = r; }));
        renderAt();
        await tick(10_000);
        expect(slowLine()).toBeInTheDocument();
        await act(async () => arrive([row()]));
        await tick(0);
        expect(screen.getByText("Acme")).toBeInTheDocument();
        expect(slowLine()).not.toBeInTheDocument();
        await tick(30_000);
        expect(slowLine()).not.toBeInTheDocument();
      });

      // Catches: the line staying beside the error panel when the load fails, or the timer firing after a failure.
      it("goes away when the load fails, and does not come back", async () => {
        vi.useFakeTimers();
        let fail!: (e: Error) => void;
        listQueue.mockReturnValue(new Promise((_, r) => { fail = r; }));
        renderAt();
        await tick(10_000);
        expect(slowLine()).toBeInTheDocument();
        await act(async () => fail(new Error("boom")));
        await tick(0);
        expect(slowLine()).not.toBeInTheDocument();
        await tick(20_000);
        expect(slowLine()).not.toBeInTheDocument();
      });

      // Catches: a ten-second timer left running after the person leaves the page (it would set state on a page that is gone).
      it("leaves no timer behind when the page is closed while waiting", async () => {
        vi.useFakeTimers();
        listQueue.mockReturnValue(new Promise(() => {}));
        const timers = watchSlowTimers();
        const { unmount } = renderAt();
        await tick(3_000);
        unmount();
        timers.expectAllCleared();
        timers.restore();
      });

      // Catches: "Try again" offered where there is nothing it could ask again (the table is waiting on its definitions, so nothing has been asked).
      it("says what it is waiting for, with no Try again, while the table's views are not known yet", async () => {
        vi.useFakeTimers();
        setTable({ ...QUEUE_TABLE, viewsStatus: "loading" });
        renderAt("/advisor?view=saved-1");
        await tick(10_000);
        expect(screen.getByText(/This is taking longer than usual\. Still waiting for the table's views and fields/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
        expect(listQueue).not.toHaveBeenCalled();
      });

      // Catches: a stuck request for the next tab leaving the person no way out: with rows on screen there is (rightly) no slow line, and Refresh
      // handed back the same stuck request instead of asking again.
      it("lets Refresh ask again when a request for the next tab is stuck over rows on screen", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
        listQueue.mockImplementationOnce(async () => pageOf(1, 20));
        renderAt();
        await tick(0);
        expect(screen.getByText("Company 1")).toBeInTheDocument();
        listQueue.mockReturnValue(new Promise(() => {}));
        fireEvent.click(screen.getByRole("link", { name: /^Won/ }));
        await tick(0);
        const asked = listQueue.mock.calls.length;
        // The rows of the tab just left stay, dimmed and marked busy, and there is no slow line over them.
        expect(screen.getByText("Company 1")).toBeInTheDocument();
        expect(screen.getByRole("region", { name: /Submissions/ })).toHaveAttribute("aria-busy", "true");
        await tick(30_000);
        expect(slowLine()).not.toBeInTheDocument();
        listQueue.mockResolvedValue([row({ company_name: "Won Co" })]);
        fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
        await tick(0);
        expect(listQueue.mock.calls.length).toBeGreaterThan(asked);
        expect(screen.getByText("Won Co")).toBeInTheDocument();
        expect(screen.getByRole("region", { name: /Submissions/ })).not.toHaveAttribute("aria-busy");
      });

      // Catches: a refresh of the question already on screen dimming the rows (dimming says "these answer another question"; a refresh changes nothing).
      it("does not dim the rows for a refresh of the same question", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
        listQueue.mockImplementationOnce(async () => pageOf(1, 20));
        renderAt();
        await tick(0);
        listQueue.mockReturnValue(new Promise(() => {}));
        fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
        await tick(0);
        expect(listQueue).toHaveBeenCalledTimes(2);
        expect(screen.getByRole("region", { name: /Submissions/ })).not.toHaveAttribute("aria-busy");
        expect(screen.getByRole("region", { name: /Submissions/ })).not.toHaveClass("opacity-70");
      });

      // Catches (D-49): a refresh that finds nothing to show but the rows already there counting as loading: grey rows over the list, or
      // "taking longer than usual" over rows a person is reading.
      it("shows no placeholders and no slow line while a refresh or the next page is on its way and rows are on screen", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
        listQueue.mockImplementationOnce(async () => pageOf(1, 375));
        const { container } = renderAt();
        await tick(0);
        expect(screen.getByText("Company 1")).toBeInTheDocument();
        listQueue.mockReturnValue(new Promise(() => {}));
        fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
        await tick(0);
        fireEvent.click(screen.getByRole("link", { name: "Next" }));
        await tick(0);
        await tick(25_000);
        expect(screen.getByText("Company 1")).toBeInTheDocument();
        expect(container.querySelector("tbody[aria-hidden=true]")).toBeNull();
        expect(slowLine()).not.toBeInTheDocument();
        expect(screen.queryByText(/Loading submissions/)).not.toBeInTheDocument();
      });
    });
  });

  it("lists company, contact, state footprint, headcount, submission date, status and completeness", async () => {
    listQueue.mockResolvedValue([
      row(),
      row({
        session_id: "s2",
        company_name: null,
        contact_name: null,
        pipeline_status: "draft",
        intake_status: "in_progress",
        signer_name: null,
        submitted_at: null,
        file_id: null,
        states: [],
        employee_count: null,
        missing_required: ["Pay frequency", "Employee census"],
      }),
      row({ session_id: "s3", company_name: "Beta", pipeline_status: "under_review", open_fields: 2 }),
    ]);
    renderAt();
    const acme = (await screen.findByRole("link", { name: "Acme" })).closest("tr")!;
    expect(screen.getByRole("link", { name: "Acme" })).toHaveAttribute("href", "/advisor/submissions/s1");
    expect(within(acme).getByText("Pat Prospect")).toBeInTheDocument();
    expect(within(acme).getByText("EAA-2026-ACME0001")).toBeInTheDocument();
    expect(within(acme).getByText("CA, NY")).toBeInTheDocument();
    expect(within(acme).getByText("12")).toBeInTheDocument();
    expect(within(acme).getByText("Submitted")).toBeInTheDocument();
    expect(within(acme).getByText("Oct 1, 2026")).toBeInTheDocument();
    expect(within(acme).getByText("Complete")).toBeInTheDocument();

    const draft = screen.getByRole("link", { name: "Company not provided" }).closest("tr")!;
    expect(within(draft).getByText("Draft")).toBeInTheDocument();
    expect(within(draft).getByText("Not certified")).toBeInTheDocument();
    expect(within(draft).getByText("Missing required")).toBeInTheDocument();
    expect(within(draft).getByText("Pay frequency, Employee census")).toBeInTheDocument();
    // An intake with no certified file id still shows the reference the detail page will show.
    expect(within(draft).getByText("No File ID yet")).toBeInTheDocument(); // assigned when the prospect certifies

    const beta = screen.getByRole("link", { name: "Beta" }).closest("tr")!;
    expect(within(beta).getByText("Under review")).toBeInTheDocument();
    expect(within(beta).getByText("Needs review")).toBeInTheDocument();
  });

  // Catches: the frame losing what makes a table a table to a screen reader: its caption, column headers with scope, the first column as the row's header, its own scroll box.
  it("is a real table: a caption, column headers, the company as each row's header, and a box that scrolls sideways", async () => {
    listQueue.mockResolvedValue([row()]);
    renderAt();
    // The table is on screen from the first draw (its rows are grey until the data arrives, CRM-S2.1), so wait for the rows.
    await screen.findByRole("rowheader");
    const table = screen.getByRole("table", { name: "Submissions" });
    expect(screen.getAllByRole("columnheader").every((h) => h.getAttribute("scope") === "col")).toBe(true);
    expect(within(table).getByRole("rowheader")).toHaveTextContent("Acme");
    expect(within(table).getByRole("rowheader")).toHaveAttribute("scope", "row");
    expect(table.closest("[role=region]")).toHaveClass("overflow-x-auto");
  });

  it("says what is true when there is no submission date", async () => {
    listQueue.mockResolvedValue([
      // Submitted before the server stamped certification dates: certified, date unknown.
      row({ session_id: "legacy", company_name: "Legacy Co", submitted_at: null, intake_status: "submitted", signer_name: "Jo Doe" }),
      // Certified once, then the prospect changed their answers.
      row({ session_id: "withdrawn", company_name: "Changed Co", submitted_at: null, intake_status: "in_progress", signer_name: "Jo Doe", pipeline_status: "draft" }),
      row({ session_id: "never", company_name: "Never Co", submitted_at: null, intake_status: "in_progress", signer_name: null, pipeline_status: "draft" }),
    ]);
    renderAt();
    const cell = async (name: string) => (await screen.findByRole("link", { name })).closest("tr")!;
    expect(within(await cell("Legacy Co")).getByText("Date not recorded")).toBeInTheDocument();
    expect(within(await cell("Changed Co")).getByText("Needs re-certification")).toBeInTheDocument();
    expect(within(await cell("Never Co")).getByText("Not certified")).toBeInTheDocument();
  });

  it("says when a draft can no longer be opened by its prospect", async () => {
    listQueue.mockResolvedValue([
      row({ session_id: "e", company_name: "Idle Co", submitted_at: null, intake_status: "expired", signer_name: null, pipeline_status: "draft" }),
      row({ session_id: "a", company_name: "Restarted Co", submitted_at: null, intake_status: "archived", signer_name: null, pipeline_status: "draft" }),
      row({ session_id: "r", company_name: "Closed Co", submitted_at: null, intake_status: "revoked", signer_name: null, pipeline_status: "draft" }),
    ]);
    renderAt();
    const cell = async (name: string) => (await screen.findByRole("link", { name })).closest("tr")!;
    expect(within(await cell("Idle Co")).getByText("Expired (idle draft)")).toBeInTheDocument();
    expect(within(await cell("Restarted Co")).getByText("Archived by prospect")).toBeInTheDocument();
    expect(within(await cell("Closed Co")).getByText("Revoked")).toBeInTheDocument();
  });

  it("only lists what an advisor needs to triage, nothing sensitive", async () => {
    listQueue.mockResolvedValue([row()]);
    renderAt();
    await screen.findByRole("link", { name: "Acme" });
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Company", "Contact", "States", "Employees", "Submitted", "Status", "Completeness", "Quotes",
    ]);
  });

  it("keeps the order the database chose", async () => {
    listQueue.mockResolvedValue([
      row({ session_id: "s1", company_name: "Zeta" }),
      row({ session_id: "s2", company_name: "Alpha" }),
      row({ session_id: "s3", company_name: "Mid" }),
    ]);
    renderAt();
    await screen.findByRole("link", { name: "Zeta" });
    expect(companyOrder()).toEqual(["Zeta", "Alpha", "Mid"]);
    expect(screen.getByText(/Certified submissions first, newest first/)).toBeInTheDocument();
  });

  it("opens the matching submission from a click anywhere on its row", async () => {
    listQueue.mockResolvedValue([
      row({ session_id: "s1", contact_name: "Pat Prospect" }),
      row({ session_id: "s2", company_name: "Beta", contact_name: "Bo Buyer" }),
    ]);
    renderAt();
    fireEvent.click(await screen.findByText("Bo Buyer"));
    expect(await screen.findByText("Detail page for s2")).toBeInTheDocument();
  });

  it("opens a submission once from its link, so Back returns to the queue", async () => {
    listQueue.mockResolvedValue([row({ session_id: "s1" })]);
    const Detail = () => {
      const navigate = useNavigate();
      return <button onClick={() => navigate(-1)}>Back</button>;
    };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/advisor"]}>
          <Routes>
            <Route path="/advisor" element={<AdvisorDashboardPage />} />
            <Route path="/advisor/submissions/:id" element={<Detail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("link", { name: "Acme" }));
    fireEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(await screen.findByRole("heading", { name: "Submissions" })).toBeInTheDocument();
  });

  describe("the status tabs, which are the queue's built-in views", () => {
    // Catches: a tab that doesn't ask for its status, or doesn't say so in the address.
    it("filters by status from a tab, keeps the view in the address, and goes back to all", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt();
      await screen.findByRole("link", { name: "Acme" });
      expect(listQueue).toHaveBeenLastCalledWith(query());
      expect(screen.getByRole("link", { name: /^All statuses/ })).toHaveAttribute("aria-current", "page");

      listQueue.mockResolvedValue([]);
      fireEvent.click(screen.getByRole("link", { name: /^Won/ }));
      expect(await screen.findByText("No submissions are won.")).toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [pipeline("won")] }));
      expect(where()).toBe("?view=won");
      expect(screen.getByRole("link", { name: /^Won/ })).toHaveAttribute("aria-current", "page");

      listQueue.mockResolvedValue([row()]);
      fireEvent.click(screen.getByRole("link", { name: "Show all statuses" }));
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query());
      expect(where()).toBe("");
    });

    // Catches: a tab's number not coming from the database's view counts, or counting something other than what its rows would total.
    it("shows each tab's count from the view counts, under the search and filters on screen", async () => {
      listQueue.mockResolvedValue([row()]);
      countQueueViews.mockResolvedValue([{ name: "all", total: 20 }, { name: "draft", total: 5 }, { name: "won", total: 3 }]);
      renderAt("/advisor?action=1&q=acme");
      expect(await screen.findByRole("link", { name: "Won 3" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "All statuses 20" })).toBeInTheDocument();
      const [views, opts] = countQueueViews.mock.calls.at(-1)!;
      expect(views[0]).toEqual({ name: "all", filters: [yes("needs_action")] });
      expect(views.find((v: { name: string }) => v.name === "won")).toEqual({ name: "won", filters: [pipeline("won"), yes("needs_action")] });
      expect(opts).toEqual({ search: "acme" });
    });

    it("still lists the rows, with no numbers on the tabs, when the counts fail", async () => {
      listQueue.mockResolvedValue([row()]);
      countQueueViews.mockRejectedValue(new Error("nope"));
      renderAt();
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Won" })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("marks a submission that needs advisor action on its row, with the advisor's note", async () => {
    listQueue.mockResolvedValue([
      row({ session_id: "s1", needs_action: true, needs_action_note: "Call the CFO about payroll" }),
      row({ session_id: "s2", company_name: "Beta" }),
    ]);
    renderAt();
    await screen.findByRole("link", { name: "Acme" });
    const marked = screen.getByTestId("needs-action-s1");
    expect(marked).toHaveTextContent("Needs advisor action");
    expect(marked).toHaveTextContent("Call the CFO about payroll");
    expect(screen.queryByTestId("needs-action-s2")).not.toBeInTheDocument();
  });

  it("lists only the submissions that need advisor action, alone or with a status, and says when there are none", async () => {
    listQueue.mockResolvedValue([row({ needs_action: true })]);
    renderAt("/advisor?status=under_review");
    await screen.findByRole("link", { name: "Acme" });
    const toggle = screen.getByRole("checkbox", { name: "Needs advisor action only" });
    expect(toggle).not.toBeChecked();

    listQueue.mockResolvedValue([]);
    fireEvent.click(toggle);
    expect(await screen.findByText("No under review submissions that need advisor action.")).toBeInTheDocument();
    expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [pipeline("under_review"), yes("needs_action")] }));
    expect(screen.getByRole("checkbox", { name: "Needs advisor action only" })).toBeChecked();
    expect(where()).toBe("?view=under_review&filter=needs_action:is:true");

    listQueue.mockResolvedValue([row()]);
    fireEvent.click(screen.getByRole("link", { name: "Show all submissions" }));
    expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
    expect(listQueue).toHaveBeenLastCalledWith(query());
  });

  describe("every old address form still works, and is rewritten as the new one", () => {
    // Catches: an old link, bookmark or the menu's link landing on the wrong rows, or leaving the old parameters in the address.
    it.each([
      ["?status=information_requested", query({ filters: [pipeline("information_requested")] }), "?view=information_requested"],
      ["?action=1", query({ filters: [yes("needs_action")] }), "?filter=needs_action:is:true"],
      ["?waiting=1", query({ filters: [yes("waiting_on_peo")] }), "?filter=waiting_on_peo:is:true"],
      ["?mail=new", query({ filters: [yes("has_new_peo_mail")] }), "?filter=has_new_peo_mail:is:true"],
      ["?q=gamma", query({ search: "gamma" }), "?q=gamma"],
      ["?page=2", query({ page: 2 }), "?page=2"],
      ["?sort=oldest_waiting", query({ sort: { field: "oldest_waiting_on", direction: "asc" } }), "?sort=oldest_waiting_on"],
      ["?sort=earliest_expiry", query({ sort: { field: "earliest_quote_expires_on", direction: "asc" } }), "?sort=earliest_quote_expires_on"],
      [
        "?status=won&action=1&waiting=1&mail=new&q=pat+gamma&sort=oldest_waiting&page=3",
        query({
          filters: [pipeline("won"), yes("has_new_peo_mail"), yes("needs_action"), yes("waiting_on_peo")],
          search: "pat gamma",
          sort: { field: "oldest_waiting_on", direction: "asc" },
          page: 3,
        }),
        "?view=won&q=pat+gamma&filter=has_new_peo_mail:is:true&filter=needs_action:is:true&filter=waiting_on_peo:is:true&sort=oldest_waiting_on&page=3",
      ],
    ])("%s", async (url, expected, rewritten) => {
      listQueue.mockImplementation(async (o: { page: number }) => ({ ...pageOf(o.page, 200) }));
      renderAt(`/advisor${url}`);
      await screen.findByRole("table");
      expect(listQueue).toHaveBeenLastCalledWith(expected);
      await waitFor(() => expect(where()).toBe(rewritten));
    });

    // Catches: the new parameters losing to old ones that happen to be on the same address.
    it("lets the new parameters win over old ones", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt("/advisor?view=lost&status=won&sort=-company_name");
      await screen.findByRole("link", { name: "Acme" });
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [pipeline("lost")], sort: { field: "company_name", direction: "desc" } }));
    });
  });

  // Catches: a bookmarked, hand-edited or stale address crashing the page, or being sent to the database as it is.
  it("reads a garbage address without crashing, keeps only what it can read, and rewrites the address cleanly", async () => {
    listQueue.mockResolvedValue([row()]);
    renderAt(
      "/advisor?page=-4&page=banana&sort=--x&filter=nope:is:1&filter=needs_action:between:5&filter=company_name:contains&filter=%5Cu&view=zzz&q=ab&junk=1"
      + "&filter=pipeline_status:any_of:won,lost&filter=employee_count:more_than:abc&filter=submitted_at:on:2026-02-30&filter=",
    );
    expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
    expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [pipeline("won", "lost")] }));
    expect(listQueue).not.toHaveBeenCalledWith(expect.objectContaining({ page: -4 }));
    await waitFor(() => expect(where()).toBe("?filter=pipeline_status:any_of:won,lost"));
  });

  // Catches: a page number that isn't a place (zero, negative, fractional, words, enormous) being sent to the database or kept in the address.
  it.each(["0", "-4", "2.5", "abc", "99999999999", "1"])("treats page=%s as the first page", async (bad) => {
    listQueue.mockResolvedValue([row()]);
    renderAt(`/advisor?page=${bad}`);
    await screen.findByRole("link", { name: "Acme" });
    expect(listQueue).toHaveBeenLastCalledWith(query());
    // Never asked for, not even once before the address was tidied.
    expect(listQueue.mock.calls.every(([o]) => o.page === 1)).toBe(true);
    await waitFor(() => expect(where()).toBe(""));
  });

  it("keeps a filter's value whole when it holds a colon or a comma", async () => {
    listQueue.mockResolvedValue([row()]);
    renderAt("/advisor?filter=company_name:contains:Smith%5C,%20Jones%5C:%20Co&filter=states:any_of:CA,NY&filter=employee_count:between:5,50&filter=submitted_at:in_last_days:30&filter=missing_required:is_empty");
    await screen.findByRole("link", { name: "Acme" });
    expect(listQueue).toHaveBeenLastCalledWith(query({
      filters: [
        { field: "company_name", op: "contains", value: "Smith, Jones: Co" },
        { field: "employee_count", op: "between", value: [5, 50] },
        { field: "missing_required", op: "is_empty" },
        { field: "states", op: "any_of", value: ["CA", "NY"] },
        { field: "submitted_at", op: "in_last_days", value: 30 },
      ],
    }));
    // Written back in the one canonical order, with the comma and colon inside the text still escaped, so a copied link means the same.
    await waitFor(() => expect(where()).toBe("?filter=company_name:contains:Smith%5C,+Jones%5C:+Co&filter=employee_count:between:5,50&filter=missing_required:is_empty&filter=states:any_of:CA,NY&filter=submitted_at:in_last_days:30"));
  });

  describe("when the database refuses the query", () => {
    // Catches: a refused filter leaving a blank page or a "try again" that can never work. The codes and words are the database's (queue_query.sql).
    it.each([
      ["22023", 'The filter "pipeline_status any_of" can\'t match "nonsense": it isn\'t one of the field\'s values'],
      ["0A000", "Filters on a person arrive with CRM-A1.1, when records have an owner"],
    ])("shows the reason of a %s refusal plainly, with a way back to every submission and no retry", async (code, reason) => {
      listQueue.mockImplementation(async (o: { filters: unknown[] }) => {
        if (o.filters.length) throw Object.assign(new Error(reason), { code });
        return [row()];
      });
      renderAt("/advisor?filter=pipeline_status:any_of:nonsense");
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("These filters can't be used.");
      expect(alert).toHaveTextContent(reason);
      expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
      fireEvent.click(within(alert).getByRole("link", { name: "Show all submissions" }));
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(where()).toBe("");
    });

    it("keeps today's panel, with a retry, for any other failure", async () => {
      listQueue.mockRejectedValueOnce(Object.assign(new Error("canceling statement due to statement timeout"), { code: "57014" }));
      renderAt();
      expect(await screen.findByRole("alert")).toHaveTextContent("canceling statement due to statement timeout");
      expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    });
  });

  it("reads the needs-action filter from the URL", async () => {
    listQueue.mockResolvedValue([]);
    renderAt("/advisor?action=1");
    expect(await screen.findByText("No submissions that need advisor action.")).toBeInTheDocument();
    expect(listQueue).toHaveBeenCalledWith(query({ filters: [yes("needs_action")] }));
  });

  describe("search", () => {
    const all = [
      row({ session_id: "s1", company_name: "Acme Holdings", contact_name: "Pat Prospect", file_id: "EAA-2026-AAAA1111" }),
      row({ session_id: "s2", company_name: "Beta Works", contact_name: "Bo Buyer", file_id: "EAA-2026-BBBB2222" }),
      row({ session_id: "s3", company_name: "Gamma", contact_name: "Pat Gamma", file_id: "EAA-2026-CCCC3333" }),
    ];
    // Stands in for the database's search: every word in the company, contact or reference.
    const searchDb = ({ search = "" }: { search?: string }) => {
      const words = search.toLowerCase().split(/\s+/).filter(Boolean);
      return all.filter((r) => words.every((w) => [r.company_name, r.contact_name, r.file_id].join("\n").toLowerCase().includes(w)));
    };

    it("searches in the database once typing pauses, from the first page, and keeps the search in the URL", async () => {
      listQueue.mockImplementation(async (opts: { search?: string }) => searchDb(opts));
      renderAt("/advisor?page=2");
      await screen.findByText(/Acme Holdings/).catch(() => undefined);
      fireEvent.change(screen.getByLabelText("Search"), { target: { value: "pat gamma" } });
      // Not once per keystroke: nothing is asked until typing pauses.
      expect(listQueue).not.toHaveBeenCalledWith(query({ search: "pat gamma" }));
      await waitFor(() => expect(listQueue).toHaveBeenLastCalledWith(query({ search: "pat gamma" })));
      await waitFor(() => expect(companyOrder()).toEqual(["Gamma"]));
      expect(where()).toBe("?q=pat+gamma");
    });

    it("keeps a space typed just before a pause", async () => {
      listQueue.mockImplementation(async (opts: { search?: string }) => searchDb(opts));
      renderAt();
      await screen.findByRole("link", { name: "Acme Holdings" });
      const box = screen.getByLabelText("Search");
      fireEvent.change(box, { target: { value: "pat " } });
      await waitFor(() => expect(listQueue).toHaveBeenLastCalledWith(query({ search: "pat" })));
      expect(box).toHaveValue("pat ");
      fireEvent.change(box, { target: { value: "pat gamma" } });
      await waitFor(() => expect(listQueue).toHaveBeenLastCalledWith(query({ search: "pat gamma" })));
    });

    it("doesn't search until at least 3 characters are typed, and says so (F-2.2)", async () => {
      listQueue.mockImplementation(async (opts: { search?: string }) => searchDb(opts));
      renderAt();
      await screen.findByRole("link", { name: "Acme Holdings" });
      const box = screen.getByLabelText("Search");
      fireEvent.change(box, { target: { value: " pa " } });
      expect(screen.getByText("Type at least 3 characters to search.")).toBeInTheDocument();
      // Give the pause time to pass: still nothing searched, the URL unchanged, every row listed.
      await new Promise((r) => setTimeout(r, 400));
      expect(listQueue).not.toHaveBeenCalledWith(expect.objectContaining({ search: "pa" }));
      expect(where()).toBe("");
      expect(companyOrder()).toEqual(["Acme Holdings", "Beta Works", "Gamma"]);
      expect(box).toHaveValue(" pa ");

      fireEvent.change(box, { target: { value: "pat" } });
      await waitFor(() => expect(listQueue).toHaveBeenLastCalledWith(query({ search: "pat" })));
      expect(screen.queryByText("Type at least 3 characters to search.")).not.toBeInTheDocument();
      await waitFor(() => expect(companyOrder()).toEqual(["Acme Holdings", "Gamma"]));

      // Deleting back below the minimum lists everything again, and keeps what's typed.
      fireEvent.change(box, { target: { value: "pa" } });
      await waitFor(() => expect(listQueue).toHaveBeenLastCalledWith(query()));
      await waitFor(() => expect(companyOrder()).toEqual(["Acme Holdings", "Beta Works", "Gamma"]));
      expect(box).toHaveValue("pa");
      expect(screen.getByText("Type at least 3 characters to search.")).toBeInTheDocument();
    });


    // Catches: spaces counting toward the 3-character minimum, so "a b" would search for almost everything.
    it("doesn't count spaces toward the minimum", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt();
      await screen.findByRole("link", { name: "Acme" });
      fireEvent.change(screen.getByLabelText("Search"), { target: { value: "a b" } });
      expect(screen.getByText("Type at least 3 characters to search.")).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Search"), { target: { value: "a bc" } });
      await waitFor(() => expect(listQueue).toHaveBeenLastCalledWith(query({ search: "a bc" })));
    });

    // Catches: a link with a search too short to run being sent to the database, or left in the address.
    it("treats a link with a search under 3 characters as no search, and takes it out of the address", async () => {
      listQueue.mockImplementation(async (opts: { search?: string }) => searchDb(opts));
      renderAt("/advisor?q=ga");
      await screen.findByRole("link", { name: "Beta Works" });
      expect(listQueue).toHaveBeenCalledWith(query());
      expect(listQueue).not.toHaveBeenCalledWith(query({ search: "ga" }));
      expect(screen.getByText("1 to 3 of 3 submissions")).toBeInTheDocument();
      await waitFor(() => expect(where()).toBe(""));
    });

    it("says how many match, across every page", async () => {
      listQueue.mockImplementation(async (opts: { search?: string }) => searchDb(opts));
      renderAt();
      await screen.findByRole("link", { name: "Acme Holdings" });
      expect(screen.getByText("1 to 3 of 3 submissions")).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Search"), { target: { value: "pat" } });
      expect(await screen.findByText("1 to 2 of 2 submissions matching “pat”")).toBeInTheDocument();
    });

    it("reads the search from the URL", async () => {
      listQueue.mockImplementation(async (opts: { search?: string }) => searchDb(opts));
      renderAt("/advisor?q=gamma");
      expect(await screen.findByRole("link", { name: "Gamma" })).toBeInTheDocument();
      expect(screen.getByLabelText("Search")).toHaveValue("gamma");
      expect(listQueue).toHaveBeenCalledWith(query({ search: "gamma" }));
    });

    it("explains a search that finds nothing, and clears it", async () => {
      listQueue.mockImplementation(async (opts: { search?: string }) => searchDb(opts));
      renderAt("/advisor?q=zzz");
      expect(await screen.findByText("No submissions match “zzz”.")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("link", { name: "Clear search" }));
      expect(await screen.findByRole("link", { name: "Acme Holdings" })).toBeInTheDocument();
      expect(screen.getByLabelText("Search")).toHaveValue("");
      expect(companyOrder()).toHaveLength(3);
    });

    it("combines with the status view", async () => {
      listQueue.mockResolvedValue([]);
      renderAt("/advisor?status=won&q=zzz");
      expect(await screen.findByText("No won submissions match “zzz”.")).toBeInTheDocument();
      expect(listQueue).toHaveBeenCalledWith(query({ filters: [pipeline("won")], search: "zzz" }));
    });
  });

  describe("pages", () => {
    // Catches: the range line or the pager not saying what the story says: 50 a page, "1 to 50 of 375 submissions", Previous and Next as links with addresses.
    it("shows 50 at a time as '1 to 50 of 375', with Previous and Next as real links that keep the rest of the address", async () => {
      listQueue.mockImplementation(async ({ page }: { page: number }) => pageOf(page, 375));
      renderAt("/advisor?view=won&q=acme");
      expect(await screen.findByText("1 to 50 of 375 submissions matching “acme”")).toBeInTheDocument();
      expect(screen.getAllByRole("row")).toHaveLength(51);
      const next = screen.getByRole("link", { name: "Next" });
      expect(next).toHaveAttribute("href", "/advisor?view=won&q=acme&page=2");
      expect(screen.queryByRole("link", { name: "Previous" })).not.toBeInTheDocument();
      expect(screen.getByText("Previous").closest("[aria-disabled]")).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(next);
      expect(await screen.findByText("51 to 100 of 375 submissions matching “acme”")).toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query({ page: 2, filters: [pipeline("won")], search: "acme" }));
      expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute("href", "/advisor?view=won&q=acme");
      expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/advisor?view=won&q=acme&page=3");
    });

    it("disables Next on the last page, and Back undoes a page change", async () => {
      listQueue.mockImplementation(async ({ page }: { page: number }) => pageOf(page, 375));
      renderAt("/advisor?page=7");
      expect(await screen.findByText("301 to 350 of 375 submissions")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("link", { name: "Next" }));
      expect(await screen.findByText("351 to 375 of 375 submissions")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Next" })).not.toBeInTheDocument();
      expect(screen.getByText("Next").closest("[aria-disabled]")).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(screen.getByRole("link", { name: "Previous" }));
      expect(await screen.findByText("301 to 350 of 375 submissions")).toBeInTheDocument();
    });

    it("lets the browser's Back undo a page change", async () => {
      listQueue.mockImplementation(async ({ page }: { page: number }) => pageOf(page, 375));
      const BackButton = () => {
        const navigate = useNavigate();
        return <button onClick={() => navigate(-1)}>Browser back</button>;
      };
      render(
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter initialEntries={["/advisor"]}>
            <Routes>
              <Route path="/advisor" element={<><AdvisorDashboardPage /><BackButton /></>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
      expect(await screen.findByText("1 to 50 of 375 submissions")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("link", { name: "Next" }));
      expect(await screen.findByText("51 to 100 of 375 submissions")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Browser back" }));
      expect(await screen.findByText("1 to 50 of 375 submissions")).toBeInTheDocument();
    });

    // Catches: a page number past the end showing an empty table, or leaving the address lying.
    it("lands on the last page when the address names one past the end, and rewrites the address", async () => {
      listQueue.mockImplementation(async ({ page }: { page: number }) => pageOf(page, 375));
      renderAt("/advisor?page=99");
      expect(await screen.findByText("351 to 375 of 375 submissions")).toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query({ page: 8 }));
      expect(where()).toBe("?page=8");
    });

    it("lands on the first page, with the empty state, when the list has shrunk to nothing", async () => {
      listQueue.mockImplementation(async ({ page }: { page: number }) => pageOf(page, 0));
      renderAt("/advisor?page=4");
      expect(await screen.findByText("No submissions yet.")).toBeInTheDocument();
      await waitFor(() => expect(where()).toBe(""));
    });

    // Catches: a new search, filter, sort or view keeping the old page number, so the rows under it mean nothing.
    it("starts from the first page when the search, a tab, a filter or the sort changes", async () => {
      listQueue.mockImplementation(async ({ page }: { page: number }) => pageOf(page, 375));
      renderAt("/advisor?page=3");
      expect(await screen.findByText("101 to 150 of 375 submissions")).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Search"), { target: { value: "acme" } });
      await waitFor(() => expect(where()).toBe("?q=acme"));
      expect(await screen.findByText("1 to 50 of 375 submissions matching “acme”")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("link", { name: "Next" }));
      await screen.findByText("51 to 100 of 375 submissions matching “acme”");
      fireEvent.click(screen.getByRole("link", { name: /^Won/ }));
      await waitFor(() => expect(where()).toBe("?view=won&q=acme"));

      fireEvent.click(screen.getByRole("link", { name: "Next" }));
      await screen.findByText("51 to 100 of 375 submissions matching “acme”");
      fireEvent.click(screen.getByLabelText("Waiting on a PEO only"));
      await waitFor(() => expect(where()).toBe("?view=won&q=acme&filter=waiting_on_peo:is:true"));

      fireEvent.click(screen.getByRole("link", { name: "Next" }));
      await screen.findByText("51 to 100 of 375 submissions matching “acme”");
      fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "1" } });
      await waitFor(() => expect(where()).toBe("?view=won&q=acme&filter=waiting_on_peo:is:true&sort=oldest_waiting_on"));
      expect(listQueue).toHaveBeenLastCalledWith(query({
        filters: [pipeline("won"), yes("waiting_on_peo")], search: "acme", sort: { field: "oldest_waiting_on", direction: "asc" },
      }));
    });
  });

  it("reads the sort from the address, shows it in the header, and lets the Sort box change it", async () => {
    listQueue.mockResolvedValue([row()]);
    renderAt("/advisor?sort=-submitted_at");
    await screen.findByRole("link", { name: "Acme" });
    expect(listQueue).toHaveBeenLastCalledWith(query({ sort: { field: "submitted_at", direction: "desc" } }));
    expect(screen.getByRole("columnheader", { name: "Submitted" })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("columnheader", { name: "Company" })).not.toHaveAttribute("aria-sort");
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "2" } });
    await waitFor(() => expect(listQueue).toHaveBeenLastCalledWith(query({ sort: { field: "earliest_quote_expires_on", direction: "asc" } })));
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "0" } });
    await waitFor(() => expect(listQueue).toHaveBeenLastCalledWith(query()));
  });

  it("has an empty state", async () => {
    listQueue.mockResolvedValue([]);
    renderAt();
    expect(await screen.findByText("No submissions yet.")).toBeInTheDocument();
  });

  it("shows an error and retries", async () => {
    listQueue.mockRejectedValueOnce(new Error("Network request failed"));
    renderAt();
    expect(await screen.findByRole("alert")).toHaveTextContent("Network request failed");
    listQueue.mockResolvedValue([row()]);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
  });

  it("ends the session when the server says it has expired", async () => {
    listQueue.mockRejectedValueOnce(Object.assign(new Error("Your session has expired."), { unauthenticated: true }));
    renderAt();
    expect(await screen.findByRole("alert")).toHaveTextContent("Your session has expired");
    expect(signOut).toHaveBeenCalledWith("expired");
  });

  it("tells an account that has lost access to the firm, and doesn't offer a retry", async () => {
    listQueue.mockRejectedValueOnce(Object.assign(new Error("You don't have access to this firm's records."), { forbidden: true }));
    renderAt();
    expect(await screen.findByRole("alert")).toHaveTextContent("You no longer have access to this firm's records");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  describe("prospects who cannot be reached by email", () => {
    it("flags the submissions whose confirmation bounced or was reported as spam, and only those", async () => {
      listQueue.mockResolvedValue([
        row({ session_id: "s1", company_name: "Bounced Co" }),
        row({ session_id: "s2", company_name: "Spam Co" }),
        row({ session_id: "s3", company_name: "Fine Co" }),
      ]);
      listEmailProblems.mockResolvedValue([
        { session_id: "s1", reason: "bounced", since: "2026-10-28T12:00:00Z" },
        { session_id: "s2", reason: "complained", since: "2026-10-28T12:00:00Z" },
      ]);
      renderAt();
      await screen.findByText("Bounced Co");
      await screen.findByText("Email bounced");
      const rows = screen.getAllByRole("row").slice(1);
      const by = (name: string) => within(rows.find((r) => within(r).queryByText(name))!);
      expect(by("Bounced Co").getByText("Email bounced")).toBeInTheDocument();
      expect(by("Spam Co").getByText("Reported as spam")).toBeInTheDocument();
      expect(by("Fine Co").queryByText(/Email bounced|Reported as spam|Email blocked/)).not.toBeInTheDocument();
      // And says what to do, for a screen reader as much as anyone.
      expect(by("Bounced Co").getByText(/Reach them another way/)).toBeInTheDocument();
    });

    it("still shows the queue, with no flags, when the check fails", async () => {
      listQueue.mockResolvedValue([row({ company_name: "Acme" })]);
      listEmailProblems.mockRejectedValue(new Error("Couldn't check for bounced emails."));
      renderAt();
      expect(await screen.findByText("Acme")).toBeInTheDocument();
      expect(screen.queryByText("Email bounced")).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("still shows the queue when the check throws before it can even ask", async () => {
      listQueue.mockResolvedValue([row({ company_name: "Acme" })]);
      listEmailProblems.mockImplementation(() => { throw new Error("synchronous"); });
      renderAt();
      expect(await screen.findByText("Acme")).toBeInTheDocument();
    });
  });

  describe("quote requests", () => {
    it("marks a submission with PEO mail nobody has opened, and counts the quote requests when there are several", async () => {
      listQueue.mockResolvedValue([
        row({ company_name: "One", new_peo_mail_requests: 1, quote_requests_sent: 1 }),
        row({ session_id: "s2", company_name: "Two", new_peo_mail_requests: 3, quote_requests_sent: 3 }),
        row({ session_id: "s3", company_name: "None" }),
      ]);
      renderAt();
      const one = (await screen.findByText("One")).closest("tr")!;
      expect(within(one).getByText("New PEO mail")).toBeInTheDocument();
      expect(within(screen.getByText("Two").closest("tr")!).getByText("New PEO mail (3)")).toBeInTheDocument();
      expect(within(screen.getByText("None").closest("tr")!).queryByText(/New PEO mail/)).not.toBeInTheDocument();
    });

    it("shows quotes back out of sent, the longest wait, the earliest expiry, the target start and an older version", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-16T15:00:00"));
      listQueue.mockResolvedValue([
        row({ quote_requests_sent: 3, quotes_received: 1, oldest_waiting_on: "2026-11-10", earliest_quote_expires_on: "2026-12-14",
          sent_older_version: true, start_month: "April 2027" }),
        row({ session_id: "s2", company_name: "Beta" }),
      ]);
      renderAt();
      const acme = (await screen.findByText("Acme")).closest("tr")!;
      expect(within(acme).getByText("1 / 3 quoted")).toBeInTheDocument();
      expect(within(acme).getByText("Waiting 6 days")).toBeInTheDocument();
      expect(within(acme).getByText("Expires Dec 14, 2026")).toBeInTheDocument();
      expect(within(acme).getByText("A PEO has an older version")).toBeInTheDocument();
      expect(within(acme).getByText("April 2027")).toBeInTheDocument();
      const beta = screen.getByText("Beta").closest("tr")!;
      expect(within(beta).queryByText(/quoted|Waiting|Expires|older version/)).not.toBeInTheDocument();
      vi.useRealTimers();
    });

    it("lists only the submissions waiting on a PEO, keeps it in the URL, and says when there are none", async () => {
      listQueue.mockResolvedValue([]);
      renderAt("/advisor?status=sent_to_carrier");
      await screen.findByText(/No submissions are/);
      fireEvent.click(screen.getByLabelText("Waiting on a PEO only"));
      await waitFor(() => expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [pipeline("sent_to_carrier"), yes("waiting_on_peo")] })));
      expect(await screen.findByText("No sent to peos submissions waiting on a PEO.")).toBeInTheDocument();
    });
  });

  describe("an address that can't break the page", () => {
    const soon = () => new Promise((r) => setTimeout(r, 50));
    // Catches: a link whose search ends in an emoji at the 200th place crashing the page (a cut in the middle of the emoji made the address unwritable).
    it("opens a link whose search runs to 200 characters and ends in an emoji, whole", async () => {
      listQueue.mockResolvedValue([row()]);
      const term = `${"a".repeat(199)}😀`;
      renderAt(`/advisor?q=${encodeURIComponent(term)}`);
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query({ search: term }));
    });

    it("cuts a longer search at 200 whole characters, never in the middle of one", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt(`/advisor?q=${encodeURIComponent(`${"a".repeat(199)}😀😀😀`)}`);
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query({ search: `${"a".repeat(199)}😀` }));
      await waitFor(() => expect(where()).toBe(`?q=${"a".repeat(199)}%F0%9F%98%80`));
    });

    // Catches: half a character typed or pasted into the box (a lone surrogate) breaking the address, so the search never applies.
    it("searches for what is typed even when it holds half a character", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt();
      await screen.findByRole("link", { name: "Acme" });
      fireEvent.change(screen.getByLabelText("Search"), { target: { value: "pat\ud800gamma" } });
      await waitFor(() => expect(listQueue).toHaveBeenLastCalledWith(query({ search: "pat�gamma" })));
      expect(screen.getByRole("link", { name: "Acme" })).toBeInTheDocument();
      await soon();
      expect(where()).toBe("?q=pat%EF%BF%BDgamma");
    });

    it("reads and writes any address without throwing", () => {
      const nasty = ["\ud800", "q=\ud800", `filter=${"x".repeat(5000)}`, "filter=%00:is:%00", "page=%", "view=\udc00x", "sort=-\ud83d", "filter=a:b:c:d:e"];
      for (const text of nasty) {
        const params = new URLSearchParams(text);
        expect(() => readAddress(QUEUE_TABLE, params)).not.toThrow();
      }
      const params = new URLSearchParams();
      params.set("q", `pat\ud800${"\ud83d"}`);
      expect(readAddress(QUEUE_TABLE, params).search).toBe("pat��");
    });

    // Catches: a page above the database's limit reaching it and showing "These filters can't be used", instead of being corrected.
    it.each(["100001", "200000"])("treats page=%s, above the database's limit, as the first page", async (bad) => {
      listQueue.mockResolvedValue([row()]);
      renderAt(`/advisor?page=${bad}`);
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(listQueue.mock.calls.every(([o]) => o.page === 1)).toBe(true);
      await waitFor(() => expect(where()).toBe(""));
    });

    // Catches: a filter the database would refuse for its shape (blank text, blank list values) being sent, or text not trimmed as the database trims it.
    it("drops a filter whose text or list values are blank, and trims the text it keeps", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt("/advisor?filter=company_name:contains:%20%20&filter=contact_name:is:%20Pat%20&filter=states:any_of:CA,%20&filter=file_id:contains:" + encodeURIComponent("x".repeat(201)));
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [{ field: "contact_name", op: "is", value: "Pat" }] }));
      await waitFor(() => expect(where()).toBe("?filter=contact_name:is:Pat"));
    });

    // Catches: the same filters written in another order being another address, key and bookmark.
    it("writes filters in one canonical order, so the same filters are one address", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt("/advisor?filter=waiting_on_peo:is:true&filter=needs_action:is:true");
      await screen.findByRole("link", { name: "Acme" });
      await waitFor(() => expect(where()).toBe("?filter=needs_action:is:true&filter=waiting_on_peo:is:true"));
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [yes("needs_action"), yes("waiting_on_peo")] }));
      // Never asked for in the order it was written, not even once before the address was tidied.
      expect(listQueue.mock.calls.every(([o]) => o.filters[0].field === "needs_action")).toBe(true);
      const a = readAddress(QUEUE_TABLE, new URLSearchParams("filter=waiting_on_peo:is:true&filter=needs_action:is:true"));
      const b = readAddress(QUEUE_TABLE, new URLSearchParams("filter=needs_action:is:true&filter=waiting_on_peo:is:true"));
      expect(sameAddress(a, b)).toBe(true);
      expect(sameAddress(a, readAddress(QUEUE_TABLE, new URLSearchParams("filter=needs_action:is:true")))).toBe(false);
    });

    // Catches: an old parameter and a new filter on the same field both applying, so "yes" and "no" together match nothing.
    it("lets a new filter win over an old parameter that names the same field", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt("/advisor?filter=needs_action:is:false&action=1&waiting=1");
      await screen.findByRole("link", { name: "Acme" });
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [{ field: "needs_action", op: "is", value: false }, yes("waiting_on_peo")] }));
    });

    // Catches: a change that holds more than the page keeping the page ("no control can forget" is the writer's job).
    it("goes back to the first page for any change that holds more than the page", () => {
      const at = readAddress(QUEUE_TABLE, new URLSearchParams("page=3&view=won"));
      expect(changeAddress(at, { page: 4 }).page).toBe(4);
      expect(changeAddress(at, { page: 3, filters: [] }).page).toBe(1);
      expect(changeAddress(at, { search: "acme" }).page).toBe(1);
      expect(changeAddress(at, { view: null, page: 5 }).page).toBe(1);
    });

    // Catches: more filters than the database takes (20 in all, the tab's own counting first) being sent, which it refuses.
    it("counts the tab's own filters against the 20 the database takes, and rewrites the address to what is used", async () => {
      listQueue.mockResolvedValue([row()]);
      const many = Array.from({ length: 20 }, (_, i) => `filter=employee_count:is:${i + 1}`).join("&");
      renderAt(`/advisor?view=won&${many}`);
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      const sent = listQueue.mock.calls.at(-1)![0].filters;
      expect(sent).toHaveLength(20);
      expect(sent[0]).toEqual(pipeline("won"));
      await waitFor(() => expect(where().match(/filter=/g)).toHaveLength(19));
      // And the numbers on every tab were asked for within the limit too.
      expect(countQueueViews.mock.calls.at(-1)![0].every((v: { filters: unknown[] }) => v.filters.length <= 20)).toBe(true);
    });

    it("keeps all 20 filters when no view is chosen", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt(`/advisor?${Array.from({ length: 21 }, (_, i) => `filter=employee_count:is:${i + 1}`).join("&")}`);
      await screen.findByRole("link", { name: "Acme" });
      expect(listQueue.mock.calls.at(-1)![0].filters).toHaveLength(20);
      await waitFor(() => expect(where().match(/filter=/g)).toHaveLength(20));
    });
  });

  describe("a table whose views or fields arrive late (CRM-S3.4a, CRM-X3.1 will)", () => {
    const saved = { id: "saved-1", label: "My saved view", filters: [{ field: "needs_action", op: "is", value: true }] } as const;
    const custom = { label: "Custom", kind: "text" as const };
    const loadingViews = () => ({ ...QUEUE_TABLE, viewsStatus: "loading" as const });
    const readyViews = () => ({ ...QUEUE_TABLE, views: [...QUEUE_VIEWS, { ...saved, filters: [...saved.filters] }], viewsStatus: "ready" as const });

    // Catches: a bookmark of a saved view landing on "All" because the view was not known on the first draw and was dropped.
    it("keeps a view it can't judge yet, asks for no rows until it can, then honours it", async () => {
      listQueue.mockResolvedValue([row()]);
      setTable(loadingViews());
      renderAt("/advisor?view=saved-1");
      expect(await screen.findByText("Loading submissions")).toBeInTheDocument();
      await new Promise((r) => setTimeout(r, 80));
      expect(listQueue).not.toHaveBeenCalled();
      expect(countQueueViews).not.toHaveBeenCalled();
      expect(where()).toBe("?view=saved-1");
      setTable(readyViews());
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(listQueue).toHaveBeenCalledTimes(1);
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [yes("needs_action")] }));
      expect(where()).toBe("?view=saved-1");
      expect(screen.getByRole("link", { name: /^My saved view/ })).toHaveAttribute("aria-current", "page");
    });

    // Catches: a view that never existed being kept for ever once the table knows its views.
    it("drops a view that is not there once the views have arrived, and rewrites the address once", async () => {
      listQueue.mockResolvedValue([row()]);
      setTable(loadingViews());
      renderAt("/advisor?view=gone");
      await screen.findByText("Loading submissions");
      expect(where()).toBe("?view=gone");
      setTable(readyViews());
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(listQueue).toHaveBeenCalledTimes(1);
      expect(listQueue).toHaveBeenLastCalledWith(query());
      await waitFor(() => expect(where()).toBe(""));
      // A shared link to a view that is gone says so, and the line goes with the next change of the address.
      expect(screen.getByText("That view isn't available, so this shows all statuses.")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("link", { name: /^Won/ }));
      await waitFor(() => expect(screen.queryByText(/isn't available/)).not.toBeInTheDocument());
    });

    // Catches: a filter on a custom field being thrown away before the custom fields are known, or kept after they are known not to include it.
    it("keeps a filter on a field it doesn't know yet as written, then sends it once the field is known (a field id with a colon is escaped)", async () => {
      listQueue.mockResolvedValue([row()]);
      setTable({ ...QUEUE_TABLE, fieldsStatus: "loading" });
      renderAt("/advisor?filter=a%5C:b:contains:acme&sort=-a:b&filter=needs_action:is:true");
      await screen.findByText("Loading submissions");
      await new Promise((r) => setTimeout(r, 80));
      expect(listQueue).not.toHaveBeenCalled();
      expect(where()).toBe("?filter=a%5C:b:contains:acme&filter=needs_action:is:true&sort=-a:b");
      setTable({ ...QUEUE_TABLE, fieldsStatus: "ready", fields: { ...QUEUE_TABLE.fields, "a:b": custom } as never });
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(listQueue).toHaveBeenCalledTimes(1);
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [{ field: "a:b", op: "contains", value: "acme" }, yes("needs_action")], sort: { field: "a:b", direction: "desc" } }));
      expect(where()).toBe("?filter=a%5C:b:contains:acme&filter=needs_action:is:true&sort=-a:b");
    });

    it("drops a filter on a field that is not there once the fields have arrived", async () => {
      listQueue.mockResolvedValue([row()]);
      setTable({ ...QUEUE_TABLE, fieldsStatus: "loading" });
      renderAt("/advisor?filter=nope:contains:acme");
      await screen.findByText("Loading submissions");
      setTable({ ...QUEUE_TABLE, fieldsStatus: "ready" });
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query());
      await waitFor(() => expect(where()).toBe(""));
    });

    // Catches: a failed load of the views leaving the person on a view that can't be shown, or dropping it without a word.
    it("falls back to what it has when the views fail to load, drops the view and says so in one line", async () => {
      listQueue.mockResolvedValue([row()]);
      setTable({ ...QUEUE_TABLE, viewsStatus: "failed" });
      renderAt("/advisor?view=saved-1");
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query());
      expect(screen.getByText("That view isn't available, so this shows all statuses.")).toBeInTheDocument();
      await waitFor(() => expect(where()).toBe(""));
    });

    // Catches: a filter silently left out because it names a field that is gone, once the fields are known.
    it("says so when a filter names a field that isn't there once the fields are ready too, and keeps the others", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt("/advisor?filter=nope:contains:acme&filter=needs_action:is:true");
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(screen.getByText("A filter on a field that isn't available was left out.")).toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [yes("needs_action")] }));
    });

    it("says so when the fields fail to load and a filter had to be left out", async () => {
      listQueue.mockResolvedValue([row()]);
      setTable({ ...QUEUE_TABLE, fieldsStatus: "failed" });
      renderAt("/advisor?filter=nope:contains:acme");
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(screen.getByText("A filter on a field that isn't available was left out.")).toBeInTheDocument();
    });

    it("judges a held address the same way the page does", () => {
      const params = new URLSearchParams("view=saved-1&filter=a:contains:x");
      const held = judgeAddress({ ...QUEUE_TABLE, viewsStatus: "loading", fieldsStatus: "loading" }, params);
      expect(held.address.held).toEqual({ view: "saved-1", sort: null, filters: ["a:contains:x"] });
      expect(held.dropped).toEqual({ view: null, filterFields: [] });
      const settled = judgeAddress(QUEUE_TABLE, params);
      expect(settled.address.held).toEqual({ view: null, sort: null, filters: [] });
      expect(settled.dropped).toEqual({ view: "saved-1", filterFields: ["a"] });
    });
  });

  describe("each request is made once", () => {
    const firm = (id: string | null): Workspace => ({
      firm: id ? { id, name: "Alpha", address: "alpha" } : null, role: "Agent", isOwner: false, isSupport: false, supportEndsAt: null,
      supportSessionId: null, isPlatformAdmin: false, person: "Sam",
    });
    // Catches: every load asking for the rows, the counts and the bounced emails twice, once for "no firm" and once for the firm (and showing the first answer).
    it("asks for the rows, the counts and the bounced emails once each, and only once the firm is known", async () => {
      listQueue.mockResolvedValue([row()]);
      const client = new QueryClient();
      const tree = (id: string | null) => (
        <WorkspaceContext.Provider value={firm(id)}>
          <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={["/advisor"]}>
              <Routes><Route path="/advisor" element={<AdvisorDashboardPage />} /></Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </WorkspaceContext.Provider>
      );
      const { rerender } = render(tree(null));
      await new Promise((r) => setTimeout(r, 80));
      expect(listQueue).not.toHaveBeenCalled();
      expect(countQueueViews).not.toHaveBeenCalled();
      expect(listEmailProblems).not.toHaveBeenCalled();
      rerender(tree("firm-1"));
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      await new Promise((r) => setTimeout(r, 80));
      expect(listQueue).toHaveBeenCalledTimes(1);
      expect(countQueueViews).toHaveBeenCalledTimes(1);
      expect(listEmailProblems).toHaveBeenCalledTimes(1);
    });

    it("asks once each outside the shell too", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt();
      await screen.findByRole("link", { name: "Acme" });
      await new Promise((r) => setTimeout(r, 80));
      expect(listQueue).toHaveBeenCalledTimes(1);
      expect(countQueueViews).toHaveBeenCalledTimes(1);
      expect(listEmailProblems).toHaveBeenCalledTimes(1);
    });

    // Catches: Refresh asking again only for the rows, leaving the tab numbers and the bounced-email marks as they were.
    it("asks again for the rows, the tab numbers and the bounced emails when Refresh is pressed", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt();
      await screen.findByRole("link", { name: "Acme" });
      const range = screen.getByText("1 to 1 of 1 submission");
      await new Promise((r) => setTimeout(r, 50));
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await waitFor(() => expect(listQueue).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(countQueueViews).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(listEmailProblems).toHaveBeenCalledTimes(2));
      // The same words in the same place: a polite live region doesn't announce a refresh that changed nothing.
      expect(screen.getByText("1 to 1 of 1 submission")).toBe(range);
    });
  });

  describe("the tab numbers through a failure (D-134, D-137)", () => {
    // Catches: a failed refresh blanking the tab numbers at once, or keeping a number nobody can confirm for ever.
    it("keeps the last numbers through a failed refresh, and drops them once refreshes have failed for five minutes", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-16T15:00:00Z"));
      listQueue.mockResolvedValue([row()]);
      countQueueViews.mockResolvedValue([{ name: "all", total: 9 }, { name: "won", total: 3 }]);
      renderAt();
      expect(await screen.findByRole("link", { name: "Won 3" })).toBeInTheDocument();
      countQueueViews.mockRejectedValue(new Error("down"));
      const refresh = () => act(async () => { fireEvent.click(screen.getByRole("button", { name: "Refresh" })); await new Promise((r) => setTimeout(r, 30)); });
      await refresh();
      expect(countQueueViews).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("link", { name: "Won 3" })).toBeInTheDocument();
      vi.setSystemTime(new Date("2026-11-16T15:06:00Z"));
      await refresh();
      expect(screen.queryByRole("link", { name: "Won 3" })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Won" })).toBeInTheDocument();
      vi.useRealTimers();
    });
  });

  it("gives each column's plain text for an export, and leaves out a column that has none", () => {
    const r = row({ needs_action: true });
    const text = Object.fromEntries(QUEUE_TABLE.columns.map((c) => [c.id, c.text?.(r, { problems: new Map() })]));
    expect(text).toEqual({
      company: "Acme", contact: "Pat Prospect", states: "CA, NY", employees: "12", submitted: "Oct 1, 2026", status: "Submitted",
      completeness: "Complete", quotes: "",
    });
  });

  describe("keeping up with a definition that changes", () => {
    const view = (filters: unknown[]) => ({ id: "saved-1", label: "My saved view", filters }) as never;
    const withView = (filters: unknown[]) => ({ ...QUEUE_TABLE, views: [...QUEUE_VIEWS, view(filters)] });

    // Catches: a saved view edited under the same id showing the old rows and the old tab numbers until the next refresh.
    it("asks again at once, for the rows and the tab numbers, when a view's filters change under the same id", async () => {
      listQueue.mockResolvedValue([row()]);
      countQueueViews.mockResolvedValue([{ name: "all", total: 5 }, { name: "saved-1", total: 2 }]);
      setTable(withView([yes("needs_action")]));
      renderAt("/advisor?view=saved-1");
      await screen.findByRole("link", { name: "Acme" });
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [yes("needs_action")] }));
      const askedRows = listQueue.mock.calls.length;
      const askedCounts = countQueueViews.mock.calls.length;
      listQueue.mockResolvedValue([row({ company_name: "Edited Co" })]);
      setTable(withView([yes("waiting_on_peo")]));
      expect(await screen.findByRole("link", { name: "Edited Co" })).toBeInTheDocument();
      expect(listQueue.mock.calls.length).toBe(askedRows + 1);
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [yes("waiting_on_peo")] }));
      await waitFor(() => expect(countQueueViews.mock.calls.length).toBe(askedCounts + 1));
      const views = countQueueViews.mock.calls.at(-1)![0] as { name: string; filters: unknown[] }[];
      expect(views.find((v) => v.name === "saved-1")!.filters).toEqual([yes("waiting_on_peo")]);
    });

    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `v${i}`, label: `View ${i}`, filters: [yes("needs_action")] })) as never[];
    const answer = (views: { name: string }[]) => views.map((v, i) => ({ name: v.name, total: 100 + i }));

    // Catches: "All" plus 20 or more views sent in one call, which the database refuses, so no tab is ever numbered.
    it("asks for tab numbers in calls of at most 20 views and numbers every tab", async () => {
      listQueue.mockResolvedValue([row()]);
      countQueueViews.mockImplementation(async (views: { name: string }[]) => answer(views));
      setTable({ ...QUEUE_TABLE, views: [...QUEUE_VIEWS, ...many(45 - QUEUE_VIEWS.length)] });
      renderAt();
      await screen.findByRole("link", { name: "Acme" });
      await waitFor(() => expect(countQueueViews).toHaveBeenCalledTimes(3));
      expect(countQueueViews.mock.calls.map(([v]) => v.length)).toEqual([20, 20, 6]);
      const names = countQueueViews.mock.calls.flatMap(([v]) => v.map((x: { name: string }) => x.name));
      expect(new Set(names).size).toBe(46);
      const tabs = within(screen.getByRole("navigation", { name: "Views" })).getAllByRole("link");
      expect(tabs).toHaveLength(46);
      await waitFor(() => expect(tabs.every((t) => /\d$/.test(t.textContent ?? ""))).toBe(true));
    });

    it("loses only a failed batch's numbers, and keeps showing the others", async () => {
      listQueue.mockResolvedValue([row()]);
      countQueueViews.mockImplementation(async (views: { name: string }[]) => {
        if (views.some((v) => v.name === "v30")) throw new Error("down");
        return answer(views);
      });
      setTable({ ...QUEUE_TABLE, views: [...QUEUE_VIEWS, ...many(45 - QUEUE_VIEWS.length)] });
      renderAt();
      await screen.findByRole("link", { name: "Acme" });
      const nav = screen.getByRole("navigation", { name: "Views" });
      await waitFor(() => expect(within(nav).getByRole("link", { name: /^All statuses \d+/ })).toBeInTheDocument());
      // v30 is in the last batch, which failed: those tabs have no number, the others do.
      expect(within(nav).getByRole("link", { name: "View 33" })).toBeInTheDocument();
      expect(within(nav).getByRole("link", { name: /^View 5 \d+/ })).toBeInTheDocument();
    });

    // Catches: a batch that fails after it once answered blanking its tabs at the first failure, instead of keeping the last numbers.
    it("keeps a failed batch's last numbers through the failure", async () => {
      listQueue.mockResolvedValue([row()]);
      let down = false;
      countQueueViews.mockImplementation(async (views: { name: string }[]) => {
        if (down && views.some((v) => v.name === "v30")) throw new Error("down");
        return answer(views);
      });
      setTable({ ...QUEUE_TABLE, views: [...QUEUE_VIEWS, ...many(45 - QUEUE_VIEWS.length)] });
      renderAt();
      await screen.findByRole("link", { name: "Acme" });
      const nav = screen.getByRole("navigation", { name: "Views" });
      await waitFor(() => expect(within(nav).getByRole("link", { name: /^View 33 \d+/ })).toBeInTheDocument());
      down = true;
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await waitFor(() => expect(countQueueViews).toHaveBeenCalledTimes(6));
      await new Promise((r) => setTimeout(r, 50));
      expect(within(nav).getByRole("link", { name: /^View 33 \d+/ })).toBeInTheDocument();
    });

    // Catches: a filter held while custom fields load surviving "Clear filters", and applying once the fields arrive.
    it("replaces a held filter when the filters are changed, so it never applies later", async () => {
      listQueue.mockResolvedValue([row()]);
      setTable({ ...QUEUE_TABLE, fieldsStatus: "loading" });
      renderAt("/advisor?filter=a:contains:acme");
      await screen.findByText("Loading submissions");
      expect(where()).toBe("?filter=a:contains:acme");
      fireEvent.click(screen.getByLabelText("Waiting on a PEO only"));
      await waitFor(() => expect(where()).toBe("?filter=waiting_on_peo:is:true"));
      setTable({ ...QUEUE_TABLE, fieldsStatus: "ready", fields: { ...QUEUE_TABLE.fields, a: { label: "A", kind: "text" } } as never });
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [yes("waiting_on_peo")] }));
    });

    // Catches: a table's own default sort not showing in its header, or hiding the sort the address holds.
    it("shows the table's default sort in the header, and the address's sort over it", async () => {
      listQueue.mockResolvedValue([row()]);
      setTable({ ...QUEUE_TABLE, defaultSort: { field: "submitted_at", direction: "desc" } });
      renderAt();
      await screen.findByRole("link", { name: "Acme" });
      expect(screen.getByRole("columnheader", { name: "Submitted" })).toHaveAttribute("aria-sort", "descending");
      cleanup();
      renderAt("/advisor?sort=company_name");
      await screen.findByRole("link", { name: "Acme" });
      expect(screen.getByRole("columnheader", { name: "Company" })).toHaveAttribute("aria-sort", "ascending");
      expect(screen.getByRole("columnheader", { name: "Submitted" })).not.toHaveAttribute("aria-sort");
    });

    it("shows no sort in the queue's header when the address holds none: its own order is no column's", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt();
      await screen.findByRole("link", { name: "Acme" });
      expect(screen.getAllByRole("columnheader").some((h) => h.hasAttribute("aria-sort"))).toBe(false);
    });
  });

  describe("text the database can't hold", () => {
    // Catches: a NUL in a link reaching the database, which fails the call (22P05, not a refusal) and offers a "Try again" that can never work.
    it("drops a NUL from the search and from filter text, whole characters kept", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt("/advisor?q=abc%00&filter=company_name:contains:ac%00me&filter=contact_name:is:%00");
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query({ search: "abc", filters: [{ field: "company_name", op: "contains", value: "acme" }] }));
      expect(JSON.stringify(listQueue.mock.calls)).not.toContain("\\u0000");
      await waitFor(() => expect(where()).toBe("?q=abc&filter=company_name:contains:acme"));
    });

    it("drops a NUL typed into the search box", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt();
      await screen.findByRole("link", { name: "Acme" });
      fireEvent.change(screen.getByLabelText("Search"), { target: { value: "pat\u0000 gamma" } });
      await waitFor(() => expect(listQueue).toHaveBeenLastCalledWith(query({ search: "pat gamma" })));
    });
  });

  describe("a refused sort or page", () => {
    // Catches: every refusal headed "These filters can't be used", and a way back that keeps the sort that was refused.
    it("says what was refused and goes back to the table's bare address", async () => {
      listQueue.mockImplementation(async (o: { sort: unknown }) => {
        if (o.sort) throw Object.assign(new Error('The queue has no field "company_name" to sort by'), { code: "22023" });
        return [row()];
      });
      renderAt("/advisor?sort=company_name&q=acme&view=won&filter=needs_action:is:true&page=2");
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("This sort can't be used.");
      expect(alert).toHaveTextContent('The queue has no field "company_name" to sort by');
      expect(within(alert).getByRole("link", { name: "Show all submissions" })).toHaveAttribute("href", "/advisor");
      fireEvent.click(within(alert).getByRole("link", { name: "Show all submissions" }));
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(where()).toBe("");
    });

    it("heads any other refusal neutrally, with the database's reason", async () => {
      listQueue.mockRejectedValueOnce(Object.assign(new Error('Unknown time zone "Nowhere/Here"'), { code: "22023" }));
      renderAt();
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("This view of the submissions can't be shown.");
      expect(alert).toHaveTextContent('Unknown time zone "Nowhere/Here"');
    });
  });

  it("lists each kind's operators with words, and the codec reads every one of them", () => {
    const sample: Record<string, string> = { none: "", text: "x", number: "5", numbers: "1,2", day: "2026-01-02", days: "2026-01-02,2026-01-03", count: "5", list: "a,b", bool: "true" };
    const kinds = Object.keys(OPERATORS) as (keyof typeof OPERATORS)[];
    const fields = Object.fromEntries(kinds.map((k) => [`f_${k}`, { label: k, kind: k }]));
    const table = { ...QUEUE_TABLE, fields } as never;
    for (const kind of kinds) {
      for (const [op, def] of Object.entries(OPERATORS[kind])) {
        expect(def.label, `${kind} ${op}`).not.toBe("");
        const text = `f_${kind}:${op}${def.shape === "none" ? "" : `:${sample[def.shape]}`}`;
        expect(readAddress(table, new URLSearchParams({ filter: text })).filters, text).toHaveLength(1);
      }
    }
    // Exactly the operators src/lib/tableQuery.ts types and the database takes.
    expect(Object.fromEntries(kinds.map((k) => [k, Object.keys(OPERATORS[k])]))).toEqual({
      text: ["contains", "is", "is_empty"],
      number: ["is", "more_than", "less_than", "between"],
      date: ["on", "before", "after", "between", "in_next_days", "in_last_days"],
      choice: ["any_of", "none_of", "is_empty"],
      choices: ["any_of", "none_of", "is_empty"],
      yes_no: ["is"],
      person: ["any_of", "me", "my_team"],
    });
  });

  describe("staying fresh (D-49)", () => {
    // Catches: the rows disappearing into a spinner while the next page loads, which loses the reader's place.
    it("keeps the rows on screen while the next page loads, and says the range once it arrives", async () => {
      listQueue.mockImplementation(async ({ page }: { page: number }) => pageOf(page, 375));
      renderAt();
      await screen.findByText("1 to 50 of 375 submissions");
      let arrive!: (v: unknown) => void;
      listQueue.mockReturnValue(new Promise((r) => { arrive = r; }));
      fireEvent.click(screen.getByRole("link", { name: "Next" }));
      await waitFor(() => expect(listQueue).toHaveBeenLastCalledWith(query({ page: 2 })));
      // Still the first page's rows, and no loading spinner.
      expect(screen.getByText("Company 1")).toBeInTheDocument();
      expect(screen.queryByText(/Loading submissions/)).not.toBeInTheDocument();
      expect(screen.getByRole("region", { name: /Submissions/ })).toHaveAttribute("aria-busy", "true");
      // The range is a polite live region.
      expect(screen.getByText("1 to 50 of 375 submissions")).toHaveAttribute("aria-live", "polite");
      await act(async () => arrive(pageOf(2, 375)));
      expect(await screen.findByText("51 to 100 of 375 submissions")).toBeInTheDocument();
      expect(screen.getByText("Company 51")).toBeInTheDocument();
    });

    // Catches: the queue going stale: no refresh on a minute or on returning to the tab, or one that blanks the rows, or one that outlives the page.
    it("refreshes every minute and when the tab is back in focus, keeping the rows on screen meanwhile", async () => {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      listQueue.mockResolvedValueOnce([row()]);
      const { unmount } = renderAt();
      await screen.findByText("Acme");
      let arrive!: (v: unknown) => void;
      listQueue.mockReturnValue(new Promise((r) => { arrive = r; }));
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
      expect(listQueue).toHaveBeenCalledTimes(2);
      expect(screen.getByText("Acme")).toBeInTheDocument();
      expect(screen.queryByText(/Loading submissions/)).not.toBeInTheDocument();
      await act(async () => arrive([row({ company_name: "Acme (refreshed)" })]));
      expect(await screen.findByText("Acme (refreshed)")).toBeInTheDocument();
      listQueue.mockReturnValue(new Promise(() => {}));
      await act(async () => { window.dispatchEvent(new Event("visibilitychange")); });
      expect(listQueue).toHaveBeenCalledTimes(3);
      expect(screen.getByText("Acme (refreshed)")).toBeInTheDocument();
      unmount();
      // Leaving the page stops the refresh: no timer is left behind.
      expect(vi.getTimerCount()).toBe(0);
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
      expect(listQueue).toHaveBeenCalledTimes(3);
      vi.useRealTimers();
    });
  });
});
