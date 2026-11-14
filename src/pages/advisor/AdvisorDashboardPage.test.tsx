import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
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
const GoBack = () => { const navigate = useNavigate(); return <button type="button" onClick={() => navigate(-1)}>Go back</button>; };
const LocationProbe = () => <><p data-testid="location">{useLocation().search}</p><GoBack /></>;

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
// The table's body: the rows (or the grey rows). It, not the headers, is what is busy and dimmed while the next answer arrives.
const tableBody = () => screen.getByRole("table").querySelector("tbody")!;
const where = () => screen.getByTestId("location").textContent;
// The filter row (CRM-S3.3a) and what it holds. A yes-or-no listed filter is set with its button and "Apply".
const filterRow = () => screen.getByRole("group", { name: "Filters" });
const emptyState = () => document.querySelector<HTMLElement>("[data-empty]")!;
const setYes = async (user: ReturnType<typeof userEvent.setup>, label: string, answer: "Yes" | "No" = "Yes") => {
  await user.click(screen.getByRole("button", { name: `Filter by ${label}` }));
  if (answer === "No") await user.selectOptions(screen.getByLabelText(label), "No");
  await user.click(screen.getByRole("button", { name: "Apply" }));
};

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
      expect(await screen.findByText("No submissions have new PEO mail.")).toBeInTheDocument();
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
    const HEADERS = ["Company", "Contact", "States", "Employees", "Submitted", "Status", "Completeness", "Quotes", "Waiting since", "Quote expires"];
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
      expect(tableBody()).toHaveAttribute("aria-busy", "true");
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
      await setYes(userEvent.setup(), "Waiting on a PEO");
      await waitFor(() => expect(where()).toBe("?filter=waiting_on_peo:is:true"));
      expect(spoken()).toHaveLength(1);
      expect(spoken()[0]).toBe(status);
      expect(status).toHaveTextContent("Loading submissions");
    });

    describe("controls while the rows are on their way", () => {
      // Catches: search, which changes the query, being locked while the first answer is slow (a person can't correct what they typed),
      // and the pager and Refresh, which need rows, being usable before there are any.
      it("keeps search, the filters, the sort headers and the tabs usable, and has no pager and no usable Refresh", async () => {
        listQueue.mockReturnValue(new Promise(() => {}));
        renderAt();
        expect(screen.getByRole("searchbox", { name: "Search" })).toBeEnabled();
        for (const name of ["Filter by Needs advisor action", "Filter by Waiting on a PEO", "Add filter"]) expect(screen.getByRole("button", { name })).not.toHaveAttribute("aria-disabled");
        expect(screen.getByRole("button", { name: "Company" })).toBeEnabled();
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
        // The rows of the tab just left stay, dimmed and marked busy, with no slow line at first; a request stuck for ten seconds says so (D-145).
        expect(screen.getByText("Company 1")).toBeInTheDocument();
        expect(tableBody()).toHaveAttribute("aria-busy", "true");
        expect(slowLine()).not.toBeInTheDocument();
        await tick(30_000);
        expect(slowLine()).toBeInTheDocument();
        expect(screen.getByText("Company 1")).toBeInTheDocument();
        listQueue.mockResolvedValue([row({ company_name: "Won Co" })]);
        fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
        await tick(0);
        expect(listQueue.mock.calls.length).toBeGreaterThan(asked);
        expect(screen.getByText("Won Co")).toBeInTheDocument();
        expect(tableBody()).not.toHaveAttribute("aria-busy");
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
        expect(tableBody()).not.toHaveAttribute("aria-busy");
        expect(tableBody()).not.toHaveClass("opacity-70");
      });

      // Catches (D-49): a refresh that finds nothing to show but the rows already there counting as loading: grey rows over the list, or
      // "taking longer than usual" over rows a person is reading.
      it("shows no placeholders, and the slow line only for a stuck next page, while rows are on screen", async () => {
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
        // A refresh of the question already on screen is no wait; the next page that never arrives is (and keeps the rows, with no grey rows).
        await tick(25_000);
        expect(screen.getByText("Company 1")).toBeInTheDocument();
        expect(container.querySelector("tbody[aria-hidden=true]")).toBeNull();
        expect(slowLine()).toBeInTheDocument();
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
      "Company", "Contact", "States", "Employees", "Submitted", "Status", "Completeness", "Quotes", "Waiting since", "Quote expires",
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
      expect(await screen.findByText("No submissions match these filters.")).toBeInTheDocument();
      expect(screen.getByText("View: Won")).toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [pipeline("won")] }));
      expect(where()).toBe("?view=won");
      expect(screen.getByRole("link", { name: /^Won/ })).toHaveAttribute("aria-current", "page");

      listQueue.mockResolvedValue([row()]);
      fireEvent.click(screen.getByRole("button", { name: "Show all statuses" }));
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

  describe("the filter row (CRM-S3.3a)", () => {
    // Opens the editor for a field: its button when the table lists it, else "Add filter" and the field in its list.
    const openFor = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
      const listed = screen.queryByRole("button", { name: `Filter by ${label}` });
      if (listed) return user.click(listed);
      await user.click(screen.getByRole("button", { name: "Add filter" }));
      await user.click(within(screen.getByRole("list", { name: "Fields to filter by" })).getByRole("button", { name: label }));
    };
    const type = (label: string, value: string): void => { fireEvent.change(screen.getByLabelText(label), { target: { value } }); };
    const apply = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Apply" }));
    const choose = async (user: ReturnType<typeof userEvent.setup>, ...labels: string[]) => {
      for (const l of labels) await user.click(within(screen.getByRole("group", { name: "Choices" })).getByRole("checkbox", { name: l }));
    };
    const chip = (words: string) => screen.getByRole("button", { name: words });
    const mounted = async (url = "/advisor", rows: unknown[] = [row()]) => {
      listQueue.mockResolvedValue(rows);
      renderAt(url);
      await screen.findByRole("table");
      await act(async () => {});
      return userEvent.setup();
    };
    // A table that also has the kinds the queue lacks: a person (who can be chosen) and one with no listed values.
    const withMoreKinds = () => setTable({
      ...QUEUE_TABLE,
      fields: {
        ...QUEUE_TABLE.fields,
        owner: { label: "Owner", kind: "person", choices: [{ value: "u1", label: "Pat Agent" }, { value: "u2", label: "Sam Agent" }] },
        mentor: { label: "Mentor", kind: "person" },
        tags: { label: "Tags", kind: "choices" },
      } as never,
    });

    // Catches: a listed filter that does nothing, or one that writes the address without asking the database for the same rows.
    it("sets a listed yes-or-no filter from its button: it goes in the address, is sent to the database, and shows as a chip", async () => {
      const user = await mounted();
      await user.click(screen.getByRole("button", { name: "Filter by Needs advisor action" }));
      await user.click(screen.getByRole("button", { name: "Apply" }));
      await waitFor(() => expect(where()).toBe("?filter=needs_action:is:true"));
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [yes("needs_action")] }));
      expect(screen.getByRole("button", { name: "Needs advisor action: yes" })).toBeInTheDocument();
    });

    // Catches: an operator the database takes missing from the editor, an operator offered for the wrong kind, or a value written in a shape the database does not read.
    // The right filter is in the address and is what listQueue is asked for, for EVERY operator of every kind the table has.
    describe("adds a filter of each kind with each operator", () => {
      type Case = [string, string, string, (u: ReturnType<typeof userEvent.setup>) => Promise<void> | void, Record<string, unknown>, string];
      const cases: Case[] = [
        // text
        ["text contains", "Company", "contains", () => type("Text", "acme"), { field: "company_name", op: "contains", value: "acme" }, "company_name:contains:acme"],
        ["text is", "Company", "is", () => type("Text", "Acme Co"), { field: "company_name", op: "is", value: "Acme Co" }, "company_name:is:Acme+Co"],
        ["text is empty", "Company", "is empty", () => {}, { field: "company_name", op: "is_empty" }, "company_name:is_empty"],
        // number
        ["number is", "Employees", "is", () => type("Number", "5"), { field: "employee_count", op: "is", value: 5 }, "employee_count:is:5"],
        ["number more than", "Employees", "is more than", () => type("Number", "50"), { field: "employee_count", op: "more_than", value: 50 }, "employee_count:more_than:50"],
        ["number less than", "Employees", "is less than", () => type("Number", "8"), { field: "employee_count", op: "less_than", value: 8 }, "employee_count:less_than:8"],
        ["number between", "Employees", "is between", () => { type("From", "10"); type("To", "50"); }, { field: "employee_count", op: "between", value: [10, 50] }, "employee_count:between:10,50"],
        // date
        ["date on", "Submitted", "is on", () => type("Day", "2026-11-01"), { field: "submitted_at", op: "on", value: "2026-11-01" }, "submitted_at:on:2026-11-01"],
        ["date before", "Submitted", "is before", () => type("Day", "2026-11-01"), { field: "submitted_at", op: "before", value: "2026-11-01" }, "submitted_at:before:2026-11-01"],
        ["date after", "Submitted", "is after", () => type("Day", "2026-11-01"), { field: "submitted_at", op: "after", value: "2026-11-01" }, "submitted_at:after:2026-11-01"],
        ["date between", "Submitted", "is between", () => { type("From", "2026-11-01"); type("To", "2026-11-30"); }, { field: "submitted_at", op: "between", value: ["2026-11-01", "2026-11-30"] }, "submitted_at:between:2026-11-01,2026-11-30"],
        ["date in the next N days", "Submitted", "is in the next N days", () => type("Number of days", "7"), { field: "submitted_at", op: "in_next_days", value: 7 }, "submitted_at:in_next_days:7"],
        ["date in the last N days", "Submitted", "is in the last N days", () => type("Number of days", "30"), { field: "submitted_at", op: "in_last_days", value: 30 }, "submitted_at:in_last_days:30"],
        // one choice
        ["choice is any of", "Status", "is any of", (u) => choose(u, "Won", "Lost"), { field: "pipeline_status", op: "any_of", value: ["won", "lost"] }, "pipeline_status:any_of:won,lost"],
        ["choice is none of", "Status", "is none of", (u) => choose(u, "Won"), { field: "pipeline_status", op: "none_of", value: ["won"] }, "pipeline_status:none_of:won"],
        ["choice is empty", "Status", "is empty", () => {}, { field: "pipeline_status", op: "is_empty" }, "pipeline_status:is_empty"],
        // several choices
        ["choices includes any of", "States", "includes any of", (u) => choose(u, "CA", "NY"), { field: "states", op: "any_of", value: ["CA", "NY"] }, "states:any_of:CA,NY"],
        ["choices includes none of", "States", "includes none of", (u) => choose(u, "CA"), { field: "states", op: "none_of", value: ["CA"] }, "states:none_of:CA"],
        ["choices is empty", "States", "is empty", () => {}, { field: "states", op: "is_empty" }, "states:is_empty"],
        // yes or no
        ["yes", "Has new PEO mail", "", () => {}, { field: "has_new_peo_mail", op: "is", value: true }, "has_new_peo_mail:is:true"],
        ["no", "Has new PEO mail", "", async () => { await userEvent.selectOptions(screen.getByLabelText("Has new PEO mail"), "No"); }, { field: "has_new_peo_mail", op: "is", value: false }, "has_new_peo_mail:is:false"],
        // person (a table that has one: the queue has none yet, CRM-A1.1)
        ["person is any of", "Owner", "is any of", (u) => choose(u, "Pat Agent"), { field: "owner", op: "any_of", value: ["u1"] }, "owner:any_of:u1"],
        ["person is me", "Owner", "is me", () => {}, { field: "owner", op: "me" }, "owner:me"],
        ["person is my team", "Owner", "is my team", () => {}, { field: "owner", op: "my_team" }, "owner:my_team"],
        // a field whose values the table does not list: typed, separated by commas
        ["typed values", "Tags", "includes any of", () => type("Values, separated by commas", "a, b"), { field: "tags", op: "any_of", value: ["a", "b"] }, "tags:any_of:a,b"],
      ];
      it.each(cases)("%s", async (_n, label, operator, fill, expected, address) => {
        withMoreKinds();
        const user = await mounted();
        await openFor(user, label);
        if (operator) await user.selectOptions(screen.getByLabelText("Condition"), operator);
        await fill(user);
        await apply(user);
        await waitFor(() => expect(where()).toBe(`?filter=${address}`));
        expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [expected] }));
        // The editor is closed and a chip says what is in force.
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(within(screen.getByRole("list", { name: "Filters in force" })).getAllByRole("listitem")).toHaveLength(1);
      });

      // Catches: the editor offering an operator the codec and the database do not take, or leaving one out (the two lists drifting).
      it("offers exactly the operators of the field's kind, in plain words, from the one list the codec reads", async () => {
        withMoreKinds();
        const user = await mounted();
        const offered = async (label: string) => {
          await openFor(user, label);
          const options = within(screen.getByLabelText("Condition")).getAllByRole("option").map((o) => o.textContent);
          await user.keyboard("{Escape}");
          return options;
        };
        const labels = (kind: keyof typeof OPERATORS) => Object.values(OPERATORS[kind]).map((o) => o.label);
        expect(await offered("Company")).toEqual(labels("text"));
        expect(await offered("Employees")).toEqual(labels("number"));
        expect(await offered("Submitted")).toEqual(labels("date"));
        expect(await offered("Status")).toEqual(labels("choice"));
        expect(await offered("States")).toEqual(labels("choices"));
        expect(await offered("Owner")).toEqual(labels("person"));
        // A person's "is any of" needs people to choose from (CRM-A1.1 gives them): without a list, only "me" and "my team" are offered.
        expect(await offered("Mentor")).toEqual(["is me", "is my team"]);
      });
    });

    // Catches: a filter shown with the database's words, or a chip that is not the one `filterInWords` writes in the empty state.
    it("shows one chip per filter in the address, worded as the empty state words it, each with a remove button that says what it removes", async () => {
      await mounted("/advisor?filter=pipeline_status:any_of:won,lost&filter=employee_count:more_than:50&filter=states:is_empty");
      const list = screen.getByRole("list", { name: "Filters in force" });
      expect(within(list).getAllByRole("listitem").map((i) => i.textContent)).toEqual(["Employees is more than 50", "Status is any of Won or Lost", "States is empty"]);
      expect(screen.getByRole("button", { name: "Remove filter: Status is any of Won or Lost" })).toBeInTheDocument();
      expect(screen.getByRole("group", { name: "Filters" })).toContainElement(list);
    });

    // Catches: a tab's own filter appearing as a chip that can be removed (it would let the person remove what the tab is).
    it("shows no chip for a tab's own filter: the tab is its control", async () => {
      await mounted("/advisor?view=won");
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [pipeline("won")] }));
      expect(screen.queryByRole("list", { name: "Filters in force" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Remove filter/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
    });

    // Catches: a bookmark or a link from a colleague losing its filters, or the colleague's table asking for something else (the database applies their own visibility).
    it("shows the chips of a bookmarked address and asks for exactly those rows, so a colleague who opens the link sees the same filters", async () => {
      const link = "/advisor?filter=employee_count:between:10,50&filter=needs_action:is:true&sort=company_name";
      await mounted(link);
      expect(screen.getByRole("button", { name: "Employees is between 10 and 50" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Needs advisor action: yes" })).toBeInTheDocument();
      const asked = listQueue.mock.calls.at(-1)![0];
      cleanup();
      listQueue.mockClear();
      await mounted(link);
      // The same address asks the same question; which rows answer it is the database's, over the viewer's own membership.
      expect(listQueue).toHaveBeenLastCalledWith(asked);
      expect(where()).toBe("?filter=employee_count:between:10,50&filter=needs_action:is:true&sort=company_name");
    });

    // Catches: removing a chip leaving the filter in force, removing the wrong one, or dropping the page to somewhere else.
    it("removes one filter from its chip, keeps the others, and goes back to the first page", async () => {
      const user = await mounted("/advisor?page=2&filter=employee_count:more_than:50&filter=needs_action:is:true");
      listQueue.mockResolvedValue({ rows: [row()], total: 120 });
      await user.click(screen.getByRole("button", { name: "Remove filter: Employees is more than 50" }));
      await waitFor(() => expect(where()).toBe("?filter=needs_action:is:true"));
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [yes("needs_action")] }));
      expect(screen.queryByRole("button", { name: "Employees is more than 50" })).not.toBeInTheDocument();
      // The field's own button is back, now that nothing filters it.
      expect(screen.getByRole("button", { name: "Filter by Employees" })).toBeInTheDocument();
    });

    // Catches: a chip that cannot be changed (a person would have to remove and rebuild it), or an editor that does not start from the filter's values.
    it("changes a filter by clicking its chip: the editor starts from its values, and applying replaces it", async () => {
      const user = await mounted("/advisor?filter=employee_count:more_than:50");
      await user.click(chip("Employees is more than 50"));
      expect(screen.getByLabelText("Condition")).toHaveValue("more_than");
      expect(screen.getByLabelText("Number")).toHaveValue(50);
      await user.selectOptions(screen.getByLabelText("Condition"), "is between");
      type("From", "10");
      type("To", "20");
      await apply(user);
      await waitFor(() => expect(where()).toBe("?filter=employee_count:between:10,20"));
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [{ field: "employee_count", op: "between", value: [10, 20] }] }));
      expect(screen.queryByRole("button", { name: "Employees is more than 50" })).not.toBeInTheDocument();
      expect(screen.getByRole("list", { name: "Filters in force" }).querySelectorAll("li")).toHaveLength(1);
    });

    // Catches: changing a chosen list dropping a value the table does not list, unseen.
    it("keeps a value the table does not list when a list is changed, shown in quotes as written", async () => {
      const user = await mounted("/advisor?filter=pipeline_status:any_of:won,zzz");
      await user.click(chip("Status is any of Won or “zzz”"));
      expect(within(screen.getByRole("group", { name: "Choices" })).getByRole("checkbox", { name: "“zzz”" })).toBeChecked();
      await choose(user, "Lost");
      await apply(user);
      await waitFor(() => expect(where()).toBe("?filter=pipeline_status:any_of:won,zzz,lost"));
    });

    // Catches: the choice list not being searchable, or searching by value instead of by the words a person reads.
    it("searches the choices by their words", async () => {
      const user = await mounted();
      await openFor(user, "Status");
      await user.type(screen.getByLabelText("Search choices"), "won");
      const group = screen.getByRole("group", { name: "Choices" });
      expect(within(group).getAllByRole("checkbox").map((c) => (c as HTMLInputElement).labels?.[0].textContent)).toEqual(["Won"]);
      await user.clear(screen.getByLabelText("Search choices"));
      await user.type(screen.getByLabelText("Search choices"), "zzzz");
      expect(within(group).getByText("Nothing matches that search.")).toBeInTheDocument();
    });

    // Catches: "Clear filters" clearing the tab, the search or the sort too (D-159), staying when there is nothing to clear, or not being a step Back undoes.
    it("clears every filter, keeps the tab, search and sort, shows only when there is a filter, and is a step Back undoes", async () => {
      const user = await mounted("/advisor?view=won&q=acme&sort=company_name&filter=employee_count:more_than:50&filter=needs_action:is:true");
      await user.click(within(filterRow()).getByRole("button", { name: "Clear filters" }));
      await waitFor(() => expect(where()).toBe("?view=won&q=acme&sort=company_name"));
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [pipeline("won")], search: "acme", sort: { field: "company_name", direction: "asc" } }));
      expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Go back" }));
      await waitFor(() => expect(where()).toBe("?view=won&q=acme&filter=employee_count:more_than:50&filter=needs_action:is:true&sort=company_name"));
    });

    // Catches: an address that cannot be undone (the row replacing history), or a change that keeps the page number the old question had.
    it("makes adding, changing and removing a filter each a step Back undoes, and starts again from page 1", async () => {
      listQueue.mockImplementation(async ({ page }: { page: number }) => pageOf(page, 375));
      renderAt("/advisor?page=3");
      await screen.findByText("101 to 150 of 375 submissions");
      const user = userEvent.setup();
      await openFor(user, "Employees");
      type("Number", "5");
      await apply(user);
      await waitFor(() => expect(where()).toBe("?filter=employee_count:is:5"));
      await user.click(chip("Employees is 5"));
      type("Number", "6");
      await apply(user);
      await waitFor(() => expect(where()).toBe("?filter=employee_count:is:6"));
      await user.click(screen.getByRole("button", { name: "Remove filter: Employees is 6" }));
      await waitFor(() => expect(where()).toBe(""));
      fireEvent.click(screen.getByRole("button", { name: "Go back" }));
      await waitFor(() => expect(where()).toBe("?filter=employee_count:is:6"));
      fireEvent.click(screen.getByRole("button", { name: "Go back" }));
      await waitFor(() => expect(where()).toBe("?filter=employee_count:is:5"));
      fireEvent.click(screen.getByRole("button", { name: "Go back" }));
      await waitFor(() => expect(where()).toBe("?page=3"));
    });

    // Catches: the count above the table not following the filters ("the count above the table is of what matches").
    it("changes the count above the table to what matches the new filter", async () => {
      listQueue.mockImplementation(async ({ filters }: { filters: unknown[] }) => ({ rows: [row()], total: filters.length ? 1 : 375 }));
      renderAt();
      await screen.findByText("1 to 50 of 375 submissions");
      await setYes(userEvent.setup(), "Needs advisor action");
      expect(await screen.findByText("1 to 1 of 1 submission")).toBeInTheDocument();
    });

    // Catches: two filters on different fields replacing each other, or only one reaching the database ("filters combine with and").
    it("combines filters with and: both are in the address and both are sent", async () => {
      const user = await mounted("/advisor?filter=employee_count:more_than:50");
      await setYes(user, "Needs advisor action");
      await waitFor(() => expect(where()).toBe("?filter=employee_count:more_than:50&filter=needs_action:is:true"));
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [{ field: "employee_count", op: "more_than", value: 50 }, yes("needs_action")] }));
    });

    // Catches: "Add filter" offering a field twice, offering one that is already filtered, leaving one out, or offering the listed ones.
    it("lists the table's own filters as buttons and offers every OTHER field under Add filter", async () => {
      await mounted();
      const listedLabels = ["Needs advisor action", "Waiting on a PEO", "Has new PEO mail", "States", "Employees", "Submitted"];
      expect(within(filterRow()).getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent).slice(0, 6)).toEqual(listedLabels.map((l) => `Filter by ${l}`));
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Add filter" }));
      const offered = within(screen.getByRole("list", { name: "Fields to filter by" })).getAllByRole("button").map((b) => b.textContent);
      const everyLabel = Object.values(QUEUE_TABLE.fields).map((f) => f.label);
      expect([...offered].sort()).toEqual(everyLabel.filter((l) => !listedLabels.includes(l)).sort());
      // Searchable by the field's words.
      await user.type(screen.getByLabelText("Search fields"), "quote");
      expect(within(screen.getByRole("list", { name: "Fields to filter by" })).getAllByRole("button").map((b) => b.textContent)).toEqual(["Earliest quote expiry", "Quote requests sent", "Quote requests with new PEO mail", "Quotes received"]);
    });

    // Catches: a field with a filter still offered (a second filter on it from the row), or its listed button left beside its chip.
    it("takes a filtered field out of Add filter and out of the listed buttons: its chip is its control", async () => {
      const user = await mounted("/advisor?filter=company_name:contains:acme&filter=employee_count:is:5");
      await user.click(screen.getByRole("button", { name: "Add filter" }));
      expect(within(screen.getByRole("list", { name: "Fields to filter by" })).queryByRole("button", { name: "Company" })).not.toBeInTheDocument();
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("button", { name: "Filter by Employees" })).not.toBeInTheDocument();
    });

    // Catches: an address that carries two filters on one field (a hand-written one) losing one, or one of them being stuck.
    it("shows two filters on one field as two chips, each removable on its own", async () => {
      const user = await mounted("/advisor?filter=submitted_at:after:2026-10-01&filter=submitted_at:before:2026-11-01");
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [
        { field: "submitted_at", op: "after", value: "2026-10-01" }, { field: "submitted_at", op: "before", value: "2026-11-01" },
      ] }));
      expect(screen.getAllByRole("button", { name: /^Remove filter: Submitted/ })).toHaveLength(2);
      await user.click(screen.getByRole("button", { name: "Remove filter: Submitted is after Oct 1, 2026" }));
      await waitFor(() => expect(where()).toBe("?filter=submitted_at:before:2026-11-01"));
    });

    describe("the limit of 20", () => {
      const filters = (n: number) => Array.from({ length: n }, (_, i) => `filter=employee_count:is:${i + 1}`).join("&");
      // Catches: a 21st filter being offered (the database would refuse the whole question), or no reason being given for the missing button.
      it("makes Add filter and the listed buttons unavailable at 20, says why, and keeps the chips editable", async () => {
        const user = await mounted(`/advisor?${filters(20)}`);
        const add = screen.getByRole("button", { name: "Add filter" });
        expect(add).toHaveAttribute("aria-disabled", "true");
        expect(add).toHaveAccessibleDescription("A table takes up to 20 filters.");
        await user.click(add);
        expect(screen.queryByRole("list", { name: "Fields to filter by" })).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Filter by Needs advisor action" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        await user.click(chip("Employees is 7"));
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
      // Catches: the tab's own filters not counting against the limit.
      it("counts the tab's own filters first: with a tab and 19 filters it is already 20", async () => {
        await mounted(`/advisor?view=won&${filters(19)}`);
        expect(screen.getByRole("button", { name: "Add filter" })).toHaveAttribute("aria-disabled", "true");
      });
      it("still adds at 19", async () => {
        const user = await mounted(`/advisor?${filters(19)}`);
        expect(screen.getByRole("button", { name: "Add filter" })).not.toHaveAttribute("aria-disabled");
        await setYes(user, "Needs advisor action");
        await waitFor(() => expect(screen.getAllByRole("button", { name: /^Remove filter/ })).toHaveLength(20));
      });
    });

    describe("what is typed is checked before anything is applied", () => {
      // Catches: a half-made filter reaching the address (and the database) on a keystroke or an Apply with a missing value.
      it.each([
        ["text, blank", "Company", "contains", [], "Enter some text."],
        ["text, over 200 characters", "Company", "contains", [["Text", "a".repeat(201)]], "Use 200 characters or fewer."],
        ["a number, blank", "Employees", "is", [], "Enter a number."],
        ["a between with only one end", "Employees", "is between", [["From", "5"]], "Enter a number for the other end."],
        ["a between with no ends", "Employees", "is between", [], "Enter a number for one end."],
        ["a day, blank", "Submitted", "is on", [], "Choose a day."],
        ["a between of days with one end", "Submitted", "is between", [["From", "2026-11-01"]], "Choose a day for the other end."],
        ["days, blank", "Submitted", "is in the next N days", [], "Enter a number of days."],
        ["days over 3660", "Submitted", "is in the next N days", [["Number of days", "3661"]], "Enter a whole number of days from 0 to 3660."],
        ["days that are not whole", "Submitted", "is in the last N days", [["Number of days", "1.5"]], "Enter a whole number of days from 0 to 3660."],
        ["days below 0", "Submitted", "is in the last N days", [["Number of days", "-1"]], "Enter a whole number of days from 0 to 3660."],
        ["a list with nothing chosen", "Status", "is any of", [], "Choose at least one."],
        ["typed values, none", "Tags", "includes any of", [], "Enter at least one value."],
        ["typed values, 101", "Tags", "includes any of", [["Values, separated by commas", Array.from({ length: 101 }, (_, i) => `v${i}`).join(",")]], "Use 100 values or fewer."],
      ])("says what is wrong under the field and applies nothing: %s", async (_n, label, operator, fill, message) => {
        withMoreKinds();
        const user = await mounted();
        const asked = listQueue.mock.calls.length;
        await openFor(user, label);
        await user.selectOptions(screen.getByLabelText("Condition"), operator as string);
        for (const [l, v] of fill as string[][]) type(l, v);
        await apply(user);
        await screen.findAllByRole("alert");
        expect(screen.getAllByRole("alert").map((a) => a.textContent).join(" ")).toContain(message as string);
        // The message is tied to its field, and nothing was applied: the address and the question are as they were, and the editor is still open.
        expect(where()).toBe("");
        expect(listQueue.mock.calls.length).toBe(asked);
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
      // Catches: a value being applied that was typed to the exact limit being refused, or the limit being restated with a different number.
      it("takes text of exactly 200 characters and a count of exactly 3660 days", async () => {
        const user = await mounted();
        await openFor(user, "Company");
        await user.selectOptions(screen.getByLabelText("Condition"), "contains");
        type("Text", "a".repeat(200));
        await apply(user);
        await waitFor(() => expect(where()).toBe(`?filter=company_name:contains:${"a".repeat(200)}`));
        await openFor(user, "Submitted");
        await user.selectOptions(screen.getByLabelText("Condition"), "is in the next N days");
        type("Number of days", "3660");
        await apply(user);
        await waitFor(() => expect(where()).toContain("submitted_at:in_next_days:3660"));
        // And 0 days is today alone.
        await user.click(chip("Submitted is in the next 3660 days"));
        type("Number of days", "0");
        await apply(user);
        await waitFor(() => expect(where()).toContain("submitted_at:in_next_days:0"));
      });
      // Catches: errors that do not clear when the person fixes the value, or that stay when the condition changes to one that needs no value.
      it("clears the message once the value is fixed and applies it", async () => {
        const user = await mounted();
        await openFor(user, "Employees");
        await apply(user);
        expect(await screen.findByRole("alert")).toHaveTextContent("Enter a number.");
        type("Number", "12");
        await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
        await apply(user);
        await waitFor(() => expect(where()).toBe("?filter=employee_count:is:12"));
      });
      it("applies with Enter from a field, not on each keystroke", async () => {
        const user = await mounted();
        await openFor(user, "Employees");
        await user.type(screen.getByLabelText("Number"), "12");
        expect(where()).toBe("");
        await user.keyboard("{Enter}");
        await waitFor(() => expect(where()).toBe("?filter=employee_count:is:12"));
      });
    });

    // Catches: Escape or a click away changing the address, or leaving the editor open.
    it.each([
      ["Escape", async (user: ReturnType<typeof userEvent.setup>) => { await user.keyboard("{Escape}"); }],
      ["Cancel", async (user: ReturnType<typeof userEvent.setup>) => { await user.click(screen.getByRole("button", { name: "Cancel" })); }],
    ])("cancels with %s: the address and the question are unchanged, and focus returns to what opened it", async (_n, leave) => {
      const user = await mounted("/advisor?filter=employee_count:is:5");
      const asked = listQueue.mock.calls.length;
      await user.click(chip("Employees is 5"));
      type("Number", "99");
      await leave(user);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(where()).toBe("?filter=employee_count:is:5");
      expect(listQueue.mock.calls.length).toBe(asked);
      await waitFor(() => expect(chip("Employees is 5")).toHaveFocus());
    });

    // Catches: a click elsewhere on the page applying the half-typed filter, or leaving the editor open over the table. (Focus goes where the person clicked.)
    it("cancels by clicking away: nothing is applied and the editor closes", async () => {
      const user = await mounted("/advisor?filter=employee_count:is:5");
      const asked = listQueue.mock.calls.length;
      await user.click(chip("Employees is 5"));
      type("Number", "99");
      await user.click(document.body);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(where()).toBe("?filter=employee_count:is:5");
      expect(listQueue.mock.calls.length).toBe(asked);
    });

    describe("keyboard and screen reader", () => {
      // Catches: an editor that opens with focus left behind on the page, or a control only a mouse can reach.
      it("puts focus in the editor when it opens, and every control can be reached and used from the keyboard", async () => {
        const user = await mounted();
        screen.getByRole("button", { name: "Filter by Employees" }).focus();
        await user.keyboard("{Enter}");
        expect(screen.getByLabelText("Condition")).toHaveFocus();
        await user.keyboard("{Escape}");
        await waitFor(() => expect(screen.getByRole("button", { name: "Filter by Employees" })).toHaveFocus());
        screen.getByRole("button", { name: "Add filter" }).focus();
        await user.keyboard("{Enter}");
        expect(screen.getByLabelText("Search fields")).toHaveFocus();
        await user.tab();
        await user.keyboard("{Enter}");
        // The first field in the list was chosen (a yes or no, "A PEO has an older version"): its editor has focus in its first control.
        expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
        expect(screen.getByLabelText("A PEO has an older version")).toHaveFocus();
      });
      // Catches: focus dropped to the page after applying; the person must find their place again.
      it("puts focus on the chip that was made or changed", async () => {
        const user = await mounted();
        await openFor(user, "Employees");
        type("Number", "5");
        await apply(user);
        await waitFor(() => expect(chip("Employees is 5")).toHaveFocus());
        await user.click(chip("Employees is 5"));
        type("Number", "6");
        await apply(user);
        await waitFor(() => expect(chip("Employees is 6")).toHaveFocus());
        await setYes(user, "Needs advisor action");
        await waitFor(() => expect(chip("Needs advisor action: yes")).toHaveFocus());
      });
      // Catches: focus falling to the page body when the chip that had it is removed.
      it("moves focus to the next chip when one is removed, else the one before, else Add filter, and Clear filters goes to Add filter", async () => {
        const user = await mounted("/advisor?filter=company_name:is_empty&filter=employee_count:is:5&filter=needs_action:is:true");
        await user.click(screen.getByRole("button", { name: "Remove filter: Employees is 5" }));
        await waitFor(() => expect(chip("Needs advisor action: yes")).toHaveFocus());
        await user.click(screen.getByRole("button", { name: "Remove filter: Needs advisor action: yes" }));
        await waitFor(() => expect(chip("Company is empty")).toHaveFocus());
        await user.click(screen.getByRole("button", { name: "Remove filter: Company is empty" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "Add filter" })).toHaveFocus());
        fireEvent.click(screen.getByRole("button", { name: "Go back" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument());
        await user.click(screen.getByRole("button", { name: "Clear filters" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "Add filter" })).toHaveFocus());
        expect(document.body).not.toHaveFocus();
      });
      // Catches: the row saying a change on its own as well as the range line and the empty state (three announcements, the finding on the sort).
      it("announces nothing of its own: the range line is the one polite status that says what a new filter left", async () => {
        listQueue.mockImplementation(async ({ filters }: { filters: unknown[] }) => ({ rows: [row()], total: filters.length ? 1 : 375 }));
        renderAt();
        await screen.findByText("1 to 50 of 375 submissions");
        const user = userEvent.setup();
        await setYes(user, "Needs advisor action");
        await screen.findByText("1 to 1 of 1 submission");
        expect(within(filterRow()).queryAllByRole("status")).toHaveLength(0);
        expect(within(filterRow()).queryAllByRole("alert")).toHaveLength(0);
        expect(spoken().map((s) => s.textContent)).toEqual(["1 to 1 of 1 submission"]);
        expectStatusesOutsideBusy();
      });
      it("is a labelled group, and each chip's two buttons say what they do", async () => {
        await mounted("/advisor?filter=employee_count:is:5");
        const group = screen.getByRole("group", { name: "Filters" });
        expect(within(group).getByRole("button", { name: "Employees is 5" })).toHaveAttribute("aria-haspopup", "dialog");
        expect(within(group).getByRole("button", { name: "Remove filter: Employees is 5" })).toBeInTheDocument();
      });
    });

    describe("while the table is loading", () => {
      // Catches: filters locked while the rows load (D-143: they change the question, so a person can correct a slow one).
      it("keeps the filters usable while the rows are on their way", async () => {
        listQueue.mockReturnValue(new Promise(() => {}));
        renderAt("/advisor?filter=employee_count:is:5");
        const user = userEvent.setup();
        await setYes(user, "Needs advisor action");
        await waitFor(() => expect(where()).toBe("?filter=employee_count:is:5&filter=needs_action:is:true"));
        expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [{ field: "employee_count", op: "is", value: 5 }, yes("needs_action")] }));
      });
      // Catches: a filter on a field that has not loaded yet being dropped, or applied by guesswork, or a listed button that opens an editor for a table not ready.
      it("while the fields load, disables the listed filters and Add filter with the reason, shows a held filter as a quiet chip with its text, and keeps it through other changes", async () => {
        listQueue.mockResolvedValue([row()]);
        setTable({ ...QUEUE_TABLE, fieldsStatus: "loading" });
        renderAt("/advisor?filter=a:contains:acme&filter=employee_count:is:5");
        await screen.findByText("Loading submissions");
        const listed = screen.getByRole("button", { name: "Filter by Needs advisor action" });
        expect(listed).toHaveAttribute("aria-disabled", "true");
        expect(listed).toHaveAccessibleDescription("More filters are available once the table's fields have loaded.");
        expect(screen.getByRole("button", { name: "Add filter" })).toHaveAttribute("aria-disabled", "true");
        fireEvent.click(listed);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        // The known filter is a chip as usual, the held one a quiet chip with its text as written (not a button that opens an editor).
        expect(screen.getByRole("button", { name: "Employees is 5" })).toBeInTheDocument();
        expect(screen.getByRole("list", { name: "Filters waiting for their fields" })).toHaveTextContent("a:contains:acme");
        expect(screen.queryByRole("button", { name: "a:contains:acme" })).not.toBeInTheDocument();
        // Removing the known chip keeps the held filter in the address.
        fireEvent.click(screen.getByRole("button", { name: "Remove filter: Employees is 5" }));
        await waitFor(() => expect(where()).toBe("?filter=a:contains:acme"));
        expect(screen.getByRole("button", { name: "Remove filter: a:contains:acme" })).toBeInTheDocument();
        // Once the field arrives the held filter is judged, shown in words, and applied.
        setTable({ ...QUEUE_TABLE, fieldsStatus: "ready", fields: { ...QUEUE_TABLE.fields, a: { label: "A", kind: "text" } } as never });
        expect(await screen.findByRole("button", { name: "A contains “acme”" })).toBeInTheDocument();
        expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [{ field: "a", op: "contains", value: "acme" }] }));
      });
    });

    // Catches: an unchanged Apply writing a second, identical history entry, and leaving a pending focus that later steals it from the search box.
    it("closes without writing or pushing when Apply leaves the filters as they were, keeps focus on the chip, and leaves a later keystroke in the search box alone", async () => {
      const user = await mounted();
      await setYes(user, "Needs advisor action");
      await waitFor(() => expect(where()).toBe("?filter=needs_action:is:true"));
      await user.click(chip("Needs advisor action: yes"));
      await apply(user);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(chip("Needs advisor action: yes")).toHaveFocus());
      expect(where()).toBe("?filter=needs_action:is:true");
      // Escape from another editor still returns focus to its trigger.
      screen.getByRole("button", { name: "Filter by Employees" }).focus();
      await user.keyboard("{Enter}");
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.getByRole("button", { name: "Filter by Employees" })).toHaveFocus());
      // Typing in the search box keeps focus there.
      const search = screen.getByRole("searchbox", { name: "Search" });
      await user.click(search);
      await user.type(search, "acme");
      await waitFor(() => expect(where()).toBe("?q=acme&filter=needs_action:is:true"));
      expect(search).toHaveFocus();
      // One Back goes to the address before the filter was added: the unchanged Apply made no entry of its own.
      fireEvent.click(screen.getByRole("button", { name: "Go back" }));
      await waitFor(() => expect(where()).toBe(""));
    });

    // Catches: a person's chip reading with the raw id when the table gives its people as choices (an id is never shown).
    it("words a person's chip with the person's name from the field's choices", async () => {
      withMoreKinds();
      await mounted("/advisor?filter=owner:any_of:u1,u2");
      expect(screen.getByRole("button", { name: "Owner is any of Pat Agent or Sam Agent" })).toBeInTheDocument();
      expect(within(filterRow()).queryByText(/u1/)).not.toBeInTheDocument();
    });

    // Catches: a typed list splitting a value that holds a comma into two when the filter is changed.
    it("keeps a typed value that holds a comma whole when the filter is changed", async () => {
      withMoreKinds();
      const user = await mounted("/advisor?filter=tags:any_of:a%5C,b,c");
      await user.click(chip("Tags includes any of “a,b” or “c”"));
      expect(screen.getByLabelText("Values, separated by commas")).toHaveValue("a\\,b, c");
      type("Values, separated by commas", "a\\,b, d");
      await apply(user);
      await waitFor(() => expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [{ field: "tags", op: "any_of", value: ["a,b", "d"] }] })));
    });

    // Catches: a value typed under one condition staying hidden and being checked after the condition changes to one that has no such box.
    it("clears what was typed when the condition changes to one that asks for something else", async () => {
      const user = await mounted();
      await openFor(user, "Submitted");
      await user.selectOptions(screen.getByLabelText("Condition"), "is on");
      type("Day", "2026-11-01");
      await user.selectOptions(screen.getByLabelText("Condition"), "is in the next N days");
      expect(screen.getByLabelText("Number of days")).toHaveValue(null);
      await apply(user);
      expect(await screen.findByRole("alert")).toHaveTextContent("Enter a number of days.");
      expect(where()).toBe("");
    });

    // Catches: year 0000, which the database refuses, getting into the address, and the person's day being kept while the database would fail the whole table.
    it("drops a filter on year 0000 from the address, as the database refuses that day", async () => {
      await mounted("/advisor?filter=submitted_at:on:0000-01-01");
      expect(listQueue).toHaveBeenLastCalledWith(query());
      await waitFor(() => expect(where()).toBe(""));
    });

    // Catches: the choice list's message not being tied to the list, and focus going to the search box when nothing was chosen.
    it("ties the choice list's message to the list and puts focus on its first choice", async () => {
      const user = await mounted();
      await openFor(user, "Status");
      await apply(user);
      const alert = await screen.findByRole("alert");
      const group = screen.getByRole("group", { name: "Choices" });
      expect(group).toHaveAttribute("aria-describedby", alert.id);
      await waitFor(() => expect(within(group).getAllByRole("checkbox")[0]).toHaveFocus());
    });

    // Catches: "Clear filters" in the row leaving a held filter behind (it would apply once its field arrives).
    it("clears a held filter with Clear filters in the row", async () => {
      listQueue.mockResolvedValue([row()]);
      setTable({ ...QUEUE_TABLE, fieldsStatus: "loading" });
      renderAt("/advisor?filter=a:contains:acme&filter=employee_count:is:5");
      await screen.findByText("Loading submissions");
      fireEvent.click(within(filterRow()).getByRole("button", { name: "Clear filters" }));
      await waitFor(() => expect(where()).toBe(""));
      expect(screen.queryByRole("list", { name: "Filters waiting for their fields" })).not.toBeInTheDocument();
      setTable({ ...QUEUE_TABLE, fieldsStatus: "ready", fields: { ...QUEUE_TABLE.fields, a: { label: "A", kind: "text" } } as never });
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query());
    });

    // Catches: the two "Clear filters" buttons sending focus to different places, or the empty state's dropping it to the page.
    it("sends focus to Add filter from either Clear filters, the row's and the empty state's", async () => {
      listQueue.mockResolvedValue([]);
      const user = await mounted("/advisor?filter=employee_count:is:5", []);
      await screen.findByText("No submissions match these filters.");
      expect(screen.getAllByRole("button", { name: "Clear filters" })).toHaveLength(2);
      await user.click(within(emptyState()).getByRole("button", { name: "Clear filters" }));
      await waitFor(() => expect(where()).toBe(""));
      expect(screen.getByRole("button", { name: "Add filter" })).toHaveFocus();
      fireEvent.click(screen.getByRole("button", { name: "Go back" }));
      await waitFor(() => expect(where()).toBe("?filter=employee_count:is:5"));
      await user.click(within(filterRow()).getByRole("button", { name: "Clear filters" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Add filter" })).toHaveFocus());
    });

    // Catches: Back removing the chip that had focus and dropping focus to the page.
    it("puts focus on Add filter when Back removes the chip that had it", async () => {
      const user = await mounted();
      await openFor(user, "Employees");
      type("Number", "5");
      await apply(user);
      await waitFor(() => expect(chip("Employees is 5")).toHaveFocus());
      fireEvent.click(screen.getByRole("button", { name: "Go back" }));
      await waitFor(() => expect(where()).toBe(""));
      await waitFor(() => expect(screen.getByRole("button", { name: "Add filter" })).toHaveFocus());
    });

    // Catches: a refused filter taking the chips away with the table, so the person cannot remove or fix the one that was refused.
    it("keeps the chips when the database refuses a filter, so the offending one can be removed or changed without leaving", async () => {
      listQueue.mockImplementation(async (o: { filters: { field: string; value?: number }[] }) => {
        if (o.filters.some((f) => f.field === "employee_count" && f.value === 5)) throw Object.assign(new Error("Employees can't be 5"), { code: "22023" });
        return [row()];
      });
      renderAt("/advisor?filter=employee_count:is:5&filter=needs_action:is:true");
      expect(await screen.findByRole("alert")).toHaveTextContent("Employees can't be 5");
      const user = userEvent.setup();
      await user.click(chip("Employees is 5"));
      type("Number", "6");
      await apply(user);
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(where()).toBe("?filter=employee_count:is:6&filter=needs_action:is:true");
      // And it can be removed too.
      listQueue.mockImplementation(async () => { throw Object.assign(new Error("No"), { code: "22023" }); });
      await user.click(screen.getByRole("button", { name: "Remove filter: Employees is 6" }));
      await waitFor(() => expect(where()).toBe("?filter=needs_action:is:true"));
    });

    describe("the tab numbers", () => {
      // Catches: the tab numbers keeping the old question's counts after a filter changes (a number and the rows it opens must agree, D-137).
      it("are asked again, under the new filter, when a filter is added, changed or removed, and not when only the sort changes", async () => {
        const user = await mounted();
        const asks = () => countQueueViews.mock.calls.length;
        const lastFiltersOf = (tab: number) => countQueueViews.mock.calls.at(-1)![0][tab].filters;
        const before = asks();
        await setYes(user, "Needs advisor action");
        await waitFor(() => expect(asks()).toBeGreaterThan(before));
        expect(lastFiltersOf(0)).toEqual([yes("needs_action")]);
        // Every tab is counted under it: the first view is Won's neighbour, so its own filter comes first.
        expect(lastFiltersOf(1)).toEqual([expect.objectContaining({ field: "pipeline_status" }), yes("needs_action")]);
        const afterAdd = asks();
        await user.click(screen.getByRole("button", { name: "Remove filter: Needs advisor action: yes" }));
        await waitFor(() => expect(asks()).toBeGreaterThan(afterAdd));
        expect(lastFiltersOf(0)).toEqual([]);
        const afterRemove = asks();
        await user.click(screen.getByRole("button", { name: "Company" }));
        await waitFor(() => expect(where()).toBe("?sort=company_name"));
        await act(async () => {});
        expect(asks()).toBe(afterRemove);
      });
    });

    // Catches: today's links (the old checkbox's, the Inbox's) losing their filter now the checkboxes are gone, or not showing as chips a person can remove.
    describe("today's links keep working", () => {
      it.each([
        ["?action=1", "Needs advisor action: yes", "needs_action"],
        ["?waiting=1", "Waiting on a PEO: yes", "waiting_on_peo"],
        ["?mail=new", "Has new PEO mail: yes", "has_new_peo_mail"],
      ])("%s asks for its filter, shows it as a chip, and the address is rewritten as the new one", async (url, words, field) => {
        await mounted(`/advisor${url}`);
        expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [yes(field)] }));
        expect(screen.getByRole("button", { name: words })).toBeInTheDocument();
        await waitFor(() => expect(where()).toBe(`?filter=${field}:is:true`));
      });
      it("keeps ?status=, and a tab and a filter together", async () => {
        await mounted("/advisor?status=won&action=1");
        expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [pipeline("won"), yes("needs_action")] }));
        await waitFor(() => expect(where()).toBe("?view=won&filter=needs_action:is:true"));
        expect(screen.getByRole("link", { name: /^Won/ })).toHaveAttribute("aria-current", "page");
      });
    });
  });

  it("lists only the submissions that need advisor action, alone or with a status, and says when there are none", async () => {
    listQueue.mockResolvedValue([row({ needs_action: true })]);
    renderAt("/advisor?status=under_review");
    await screen.findByRole("link", { name: "Acme" });
    // Not set yet: the listed button is there and there is no chip.
    expect(screen.getByRole("button", { name: "Filter by Needs advisor action" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Needs advisor action: yes" })).not.toBeInTheDocument();

    listQueue.mockResolvedValue([]);
    await setYes(userEvent.setup(), "Needs advisor action");
    expect(await screen.findByText("No submissions match these filters.")).toBeInTheDocument();
    expect(screen.getByText("View: Under review")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "What is in force" })).getByText("Needs advisor action: yes")).toBeInTheDocument();
    expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [pipeline("under_review"), yes("needs_action")] }));
    // The chip is its control now, so its button in the row is gone.
    expect(screen.getByRole("button", { name: "Needs advisor action: yes" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filter by Needs advisor action" })).not.toBeInTheDocument();
    expect(where()).toBe("?view=under_review&filter=needs_action:is:true");

    listQueue.mockResolvedValue([row()]);
    fireEvent.click(within(filterRow()).getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
    // The tab stays: the button clears the filters its label names.
    expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [pipeline("under_review")] }));
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

    // Catches: a failed load showing the database's own words ("canceling statement due to statement timeout"), a retry that forgets the filters, sort or view,
    // and focus dropping to the page when the panel is replaced by the grey rows.
    it("says in plain words what could not be loaded for any other failure, never the database's words, and Try again keeps the address and focus", async () => {
      listQueue.mockRejectedValueOnce(Object.assign(new Error("canceling statement due to statement timeout"), { code: "57014" }));
      renderAt("/advisor?view=won&sort=-employee_count&filter=states:any_of:CA");
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("We couldn't load the submissions.");
      expect(alert).not.toHaveTextContent(/statement timeout|57014/);
      expect(listQueue).toHaveBeenCalledTimes(1);
      // The toolbar's own controls are still there, and the address is as it was.
      expect(where()).toBe("?view=won&filter=states:any_of:CA&sort=-employee_count");
      expect(screen.getByRole("button", { name: "Filter by Employees" })).toBeInTheDocument();
      listQueue.mockResolvedValue([row()]);
      fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(listQueue).toHaveBeenCalledTimes(2);
      expect(listQueue.mock.calls[1][0]).toEqual(listQueue.mock.calls[0][0]);
      expect(where()).toBe("?view=won&filter=states:any_of:CA&sort=-employee_count");
      // Focus did not fall to the page when the panel went: it stayed with the page's main area, which is there before and after.
      expect(document.activeElement).toBe(screen.getByRole("main"));
      // It was made focusable for that moment only: once focus leaves, main is not a stop in the tab order.
      act(() => screen.getByRole("main").blur());
      expect(screen.getByRole("main")).not.toHaveAttribute("tabindex");
    });

    // Catches: a retry that fails again leaving nothing on screen, or an alert that is not said again.
    it("says so again when Try again fails again, with the button still there", async () => {
      listQueue.mockRejectedValue(new Error("canceling statement due to statement timeout"));
      renderAt();
      fireEvent.click(within(await screen.findByRole("alert")).getByRole("button", { name: "Try again" }));
      await waitFor(() => expect(listQueue).toHaveBeenCalledTimes(2));
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("We couldn't load the submissions.");
      expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument();
      // The first button went with the first failure; focus is on the new one, so a keyboard person can press it again.
      expect(document.activeElement).toBe(within(alert).getByRole("button", { name: "Try again" }));
    });

    // Catches (D-175): a "Try again" whose button never went (the failure stayed on screen while it asked) leaving its press believed, so the next failure to
    // mount within ten seconds, after the rows came, took focus from the Refresh button the person had pressed.
    it("does not let a press whose button never went take focus for a later failure within ten seconds", async () => {
      listQueue.mockRejectedValueOnce(new Error("down"));
      renderAt();
      const failed = await screen.findByRole("alert");
      let answer!: (rows: unknown) => void;
      listQueue.mockReturnValueOnce(new Promise((resolve) => { answer = resolve; }));
      fireEvent.click(within(failed).getByRole("button", { name: "Try again" }));
      await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
      await act(async () => answer([row()]));
      await screen.findByRole("link", { name: "Acme" });
      listQueue.mockRejectedValue(new Error("down again"));
      const refresh = screen.getByRole("button", { name: "Refresh" });
      refresh.focus();
      fireEvent.click(refresh);
      // The rows are on screen, so the failure is a note over them (CRM-S2.4a), not the panel that replaces them.
      await screen.findByText(/We couldn't refresh the submissions/);
      expect(document.activeElement).toBe(refresh);
    });

    // Catches: a later failure, long after "Try again" worked (a refresh a minute on), taking focus from wherever the person is.
    it("does not take focus for a failure that is not the answer to a Try again just pressed", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      listQueue.mockRejectedValueOnce(new Error("down"));
      renderAt();
      const failed = await screen.findByRole("alert");
      listQueue.mockResolvedValue([row()]);
      fireEvent.click(within(failed).getByRole("button", { name: "Try again" }));
      await screen.findByRole("link", { name: "Acme" });
      await act(async () => { vi.advanceTimersByTime(60_000); });
      listQueue.mockRejectedValue(new Error("down again"));
      await act(async () => { vi.advanceTimersByTime(60_000); });
      const note = await screen.findByText(/We couldn't refresh the submissions/);
      expect(document.activeElement).not.toBe(within(note.closest("[role=status]") as HTMLElement).getByRole("button", { name: "Try again" }));
    });
  });


  // Refresh in place (CRM-S2.4a, D-49, D-180): the list is asked again on focus and every minute, and a failure of that must not take the rows away.
  describe("refreshing in place, and a table that fails to refresh", () => {
    // The minute's ask is made at the end of the advance, and its answer arrives after: let it.
    const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); for (let i = 0; i < 3; i++) await vi.advanceTimersByTimeAsync(1); });
    const fake = () => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    const note = () => (screen.queryByText(/We couldn't refresh the submissions/)?.closest("[role=status]") ?? null) as HTMLElement | null;

    // Catches (D-49): the minute's refresh being a redraw: the table rebuilt (scroll lost), the focused control dropped, or half-typed words cleared.
    it("brings new rows in place on the minute and on focus: same table, scroll, focus and typing stay", async () => {
      fake();
      listQueue.mockResolvedValueOnce(pageOf(1, 20));
      renderAt();
      await tick(0);
      const table = screen.getByRole("table");
      const scrollBox = table.parentElement as HTMLElement;
      scrollBox.scrollTop = 120;
      scrollBox.scrollLeft = 40;
      const search = screen.getByRole("searchbox");
      search.focus();
      fireEvent.change(search, { target: { value: "Co" } });
      listQueue.mockResolvedValue({ ...pageOf(1, 21), rows: [row({ session_id: "new", company_name: "Brand New Co" }), ...pageOf(1, 20).rows] });
      await tick(60_000);
      expect(screen.getByText("Brand New Co")).toBeInTheDocument();
      expect(screen.getByRole("table")).toBe(table);
      expect(scrollBox.scrollTop).toBe(120);
      expect(scrollBox.scrollLeft).toBe(40);
      expect(document.activeElement).toBe(search);
      expect(search).toHaveValue("Co");
      // And on focus: the window coming back asks again.
      listQueue.mockResolvedValue({ ...pageOf(1, 22), rows: [row({ session_id: "newer", company_name: "Newest Co" }), ...pageOf(1, 20).rows] });
      act(() => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange", { bubbles: true })); });
      await tick(0);
      expect(screen.getByText("Newest Co")).toBeInTheDocument();
      expect(document.activeElement).toBe(search);
    });

    // Catches: a background refresh that fails replacing the rows a person is reading with the failed-load panel (D-180).
    it("keeps the rows on screen and says so in a note with Try again, instead of the failed-load panel", async () => {
      fake();
      listQueue.mockResolvedValueOnce(pageOf(1, 20));
      renderAt();
      await tick(0);
      expect(screen.getByText("Company 1")).toBeInTheDocument();
      listQueue.mockRejectedValue(Object.assign(new Error("canceling statement due to statement timeout"), { code: "57014" }));
      await tick(60_000);
      expect(screen.getByText("Company 1")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(note()).toHaveTextContent("We couldn't refresh the submissions. What's below may be out of date.");
      expect(note()).not.toHaveTextContent(/statement timeout|57014/);
      expect(within(note()!).getByRole("button", { name: "Try again" })).toBeInTheDocument();
    });

    // Catches: the note being taken away and put back by each failed minute (it would be read again every time, and a focused "Try again" would be lost).
    it("is one note across failed minutes: the same element, never read again, and gone when a refresh works", async () => {
      fake();
      listQueue.mockResolvedValueOnce(pageOf(1, 20));
      renderAt();
      await tick(0);
      listQueue.mockRejectedValue(new Error("down"));
      await tick(60_000);
      const first = note()!;
      within(first).getByRole("button", { name: "Try again" }).focus();
      await tick(60_000);
      await tick(60_000);
      expect(note()).toBe(first);
      expect(document.activeElement).toBe(within(first).getByRole("button", { name: "Try again" }));
      expect(listQueue.mock.calls.length).toBeGreaterThan(3); // it keeps asking quietly while rows are on screen
      listQueue.mockResolvedValue(pageOf(1, 20));
      await tick(60_000);
      expect(note()).toBeNull();
      expect(screen.getByText("Company 1")).toBeInTheDocument();
    });

    // Catches: Try again on the note doing nothing, or losing focus to the page when the note goes.
    it("asks again on its Try again, takes the note away when the rows come, and keeps focus in the page", async () => {
      fake();
      listQueue.mockResolvedValueOnce(pageOf(1, 20));
      renderAt();
      await tick(0);
      listQueue.mockRejectedValue(new Error("down"));
      await tick(60_000);
      const before = listQueue.mock.calls.length;
      listQueue.mockResolvedValue([row({ company_name: "Fresh Co" })]);
      const button = within(note()!).getByRole("button", { name: "Try again" });
      button.focus();
      fireEvent.click(button);
      await tick(0);
      expect(listQueue.mock.calls.length).toBeGreaterThan(before);
      expect(screen.getByText("Fresh Co")).toBeInTheDocument();
      expect(note()).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole("main"));
    });

    // Catches (D-180): an errored table with nothing to show being asked again every minute and on focus, so its panel remounts, a person's un-pressed
    // "Try again" loses focus and the alert is read again each time.
    it("asks a table with no rows again only when Try again is pressed, not on the minute or on focus", async () => {
      fake();
      listQueue.mockRejectedValue(new Error("down"));
      renderAt();
      await tick(0);
      const alert = screen.getByRole("alert");
      const button = within(alert).getByRole("button", { name: "Try again" });
      button.focus();
      expect(listQueue).toHaveBeenCalledTimes(1);
      await tick(60_000);
      await tick(60_000);
      act(() => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange", { bubbles: true })); });
      await tick(0);
      expect(listQueue).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("alert")).toBe(alert);
      expect(document.activeElement).toBe(button);
      listQueue.mockResolvedValue([row()]);
      fireEvent.click(button);
      await tick(0);
      expect(screen.getByRole("link", { name: "Acme" })).toBeInTheDocument();
    });
  });

  it("reads the needs-action filter from the URL", async () => {
    listQueue.mockResolvedValue([]);
    renderAt("/advisor?action=1");
    expect(await screen.findByText("No submissions match these filters.")).toBeInTheDocument();
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
      expect(await screen.findByText("No submissions match this search.")).toBeInTheDocument();
      expect(screen.getByText("Search covers company, contact and File ID.")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
      expect(await screen.findByRole("link", { name: "Acme Holdings" })).toBeInTheDocument();
      expect(screen.getByLabelText("Search")).toHaveValue("");
      expect(companyOrder()).toHaveLength(3);
    });

    it("combines with the status view", async () => {
      listQueue.mockResolvedValue([]);
      renderAt("/advisor?status=won&q=zzz");
      expect(await screen.findByText("No submissions match this search and these filters.")).toBeInTheDocument();
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
      expect(await screen.findByText("Submissions appear here once a prospect has started filling in an intake.")).toBeInTheDocument();
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
      await setYes(userEvent.setup(), "Waiting on a PEO");
      await waitFor(() => expect(where()).toBe("?view=won&q=acme&filter=waiting_on_peo:is:true"));

      fireEvent.click(screen.getByRole("link", { name: "Next" }));
      await screen.findByText("51 to 100 of 375 submissions matching “acme”");
      fireEvent.click(screen.getByRole("button", { name: "Company" }));
      await waitFor(() => expect(where()).toBe("?view=won&q=acme&filter=waiting_on_peo:is:true&sort=company_name"));
      expect(listQueue).toHaveBeenLastCalledWith(query({
        filters: [pipeline("won"), yes("waiting_on_peo")], search: "acme", sort: { field: "company_name", direction: "asc" },
      }));
    });
  });

  it("reads the sort from the address and shows it in the header", async () => {
    listQueue.mockResolvedValue([row()]);
    renderAt("/advisor?sort=-submitted_at");
    await screen.findByRole("link", { name: "Acme" });
    expect(listQueue).toHaveBeenLastCalledWith(query({ sort: { field: "submitted_at", direction: "desc" } }));
    expect(screen.getByRole("columnheader", { name: "Submitted" })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("columnheader", { name: "Company" })).toHaveAttribute("aria-sort", "none");
  });

  it("has an empty state", async () => {
    listQueue.mockResolvedValue([]);
    renderAt();
    expect(await screen.findByText("Submissions appear here once a prospect has started filling in an intake.")).toBeInTheDocument();
  });

  it("shows an error and retries", async () => {
    listQueue.mockRejectedValueOnce(new Error("Network request failed"));
    renderAt();
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load the submissions.");
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
        row({ session_id: "s3", company_name: "Quiet" }),
      ]);
      renderAt();
      const one = (await screen.findByText("One")).closest("tr")!;
      expect(within(one).getByText("New PEO mail")).toBeInTheDocument();
      expect(within(screen.getByText("Two").closest("tr")!).getByText("New PEO mail (3)")).toBeInTheDocument();
      expect(within(screen.getByText("Quiet").closest("tr")!).queryByText(/New PEO mail/)).not.toBeInTheDocument();
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
      // "Waiting since" shows the day the wait began, with how long that is under it; "Quote expires" shows just the day.
      expect(within(acme).getByText("Nov 10, 2026")).toBeInTheDocument();
      expect(within(acme).getByText("Waiting 6 days")).toBeInTheDocument();
      expect(within(acme).getByText("Dec 14, 2026")).toBeInTheDocument();
      expect(within(acme).getByText("A PEO has an older version")).toBeInTheDocument();
      expect(within(acme).getByText("April 2027")).toBeInTheDocument();
      const beta = screen.getByText("Beta").closest("tr")!;
      expect(within(beta).queryByText(/quoted|Waiting|Expires|older version/)).not.toBeInTheDocument();
      vi.useRealTimers();
    });

    it("lists only the submissions waiting on a PEO, keeps it in the URL, and says when there are none", async () => {
      listQueue.mockResolvedValue([]);
      renderAt("/advisor?status=sent_to_carrier");
      await screen.findByText("No submissions match these filters.");
      await setYes(userEvent.setup(), "Waiting on a PEO");
      await waitFor(() => expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [pipeline("sent_to_carrier"), yes("waiting_on_peo")] })));
      expect(await within(screen.getByRole("list", { name: "What is in force" })).findByText("Waiting on a PEO: yes")).toBeInTheDocument();
      expect(screen.getByText("View: Sent to PEOs")).toBeInTheDocument();
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
      company: "Acme", contact: "Pat Prospect", states: "CA, NY", employees: "12", submitted: "2026-10-01", status: "Submitted",
      completeness: "Complete", quotes: "None", waiting_since: "", quote_expires: "",
    });
  
  });

  // Catches: one date column exporting "Oct 1, 2026" and another "2026-11-10", so a spreadsheet can't sort or read them as one kind.
  it("writes every date column's plain text as an ISO day", () => {
    const text = (id: string, r: QueueRow) => QUEUE_TABLE.columns.find((c) => c.id === id)!.text!(r, { problems: new Map() });
    const r = row({ oldest_waiting_on: "2026-11-10", earliest_quote_expires_on: "2026-12-14", submitted_at: "2026-10-01T12:00:00Z" });
    expect(["submitted", "waiting_since", "quote_expires"].map((id) => text(id, r))).toEqual(["2026-10-01", "2026-11-10", "2026-12-14"]);
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

    // Catches: a filter removed through its chip's remove button (not through "Clear filters") staying in force, or applying once the fields arrive.
    it("replaces a held filter when the filters are changed, so it never applies later", async () => {
      listQueue.mockResolvedValue([row()]);
      setTable({ ...QUEUE_TABLE, fieldsStatus: "loading" });
      renderAt("/advisor?filter=a:contains:acme");
      await screen.findByText("Loading submissions");
      expect(where()).toBe("?filter=a:contains:acme");
      // The filter row shows it as a quiet chip with its text as written; removing the chip is a change of the filters, so it never applies later.
      fireEvent.click(screen.getByRole("button", { name: "Remove filter: a:contains:acme" }));
      await waitFor(() => expect(where()).toBe(""));
      setTable({ ...QUEUE_TABLE, fieldsStatus: "ready", fields: { ...QUEUE_TABLE.fields, a: { label: "A", kind: "text" } } as never });
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query());
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
      expect(screen.getByRole("columnheader", { name: "Submitted" })).toHaveAttribute("aria-sort", "none");
    });

    it("shows no sort in the queue's header when the address holds none: its own order is no column's", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt();
      await screen.findByRole("link", { name: "Acme" });
      expect(screen.getAllByRole("columnheader").some((h) => ["ascending", "descending"].includes(h.getAttribute("aria-sort") ?? ""))).toBe(false);
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
      expect(tableBody()).toHaveAttribute("aria-busy", "true");
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

  // CRM-S3.2a: sortable headers. The database does the ordering (supabase/tests/queue_query.sql, section 4); these are what a person sees and does.
  describe("sorting by a column header", () => {
    const sortButton = (name: RegExp | string) => screen.getByRole("button", { name });
    const sorted = () =>
      screen.getAllByRole("columnheader").filter((h) => ["ascending", "descending"].includes(h.getAttribute("aria-sort") ?? "")).map((h) => `${h.textContent}`.trim());

    // Catches: a header that is not a button, or a click that does not reach the database or the address.
    it("sorts by a column when its header is clicked, reverses on the next click, and reverses again on the third", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt();
      await screen.findByRole("link", { name: "Acme" });
      fireEvent.click(sortButton("Company"));
      await waitFor(() => expect(where()).toBe("?sort=company_name"));
      await waitFor(() => expect(listQueue).toHaveBeenLastCalledWith(query({ sort: { field: "company_name", direction: "asc" } })));
      fireEvent.click(sortButton("Company"));
      await waitFor(() => expect(where()).toBe("?sort=-company_name"));
      await waitFor(() => expect(listQueue).toHaveBeenLastCalledWith(query({ sort: { field: "company_name", direction: "desc" } })));
      // A third click reverses again; it never clears the sort (the way back to the default order is its own control).
      fireEvent.click(sortButton("Company"));
      await waitFor(() => expect(where()).toBe("?sort=company_name"));
      expect(listQueue).toHaveBeenLastCalledWith(query({ sort: { field: "company_name", direction: "asc" } }));
    });

    // Catches: a date column starting oldest first (people expect the newest first), or a number column starting largest first.
    it("starts a date with the newest, a day with the soonest, and text and numbers ascending", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt();
      await screen.findByRole("link", { name: "Acme" });
      fireEvent.click(sortButton("Submitted"));
      await waitFor(() => expect(where()).toBe("?sort=-submitted_at"));
      fireEvent.click(sortButton("Employees"));
      await waitFor(() => expect(where()).toBe("?sort=employee_count"));
      fireEvent.click(sortButton("Status"));
      await waitFor(() => expect(where()).toBe("?sort=pipeline_status"));
      fireEvent.click(sortButton("Quote expires"));
      await waitFor(() => expect(where()).toBe("?sort=earliest_quote_expires_on"));
      fireEvent.click(sortButton("Waiting since"));
      await waitFor(() => expect(where()).toBe("?sort=oldest_waiting_on"));
    });

    // Catches: two columns marked at once, a mark that disagrees with the address, and a sortable column with no aria-sort at all.
    it("marks one column at a time, with the direction in the mark and in the name, and says none on the others", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt("/advisor?sort=-company_name");
      await screen.findByRole("link", { name: "Acme" });
      expect(sorted()).toEqual(["Company"]);
      const company = screen.getByRole("columnheader", { name: "Company" });
      expect(company).toHaveAttribute("aria-sort", "descending");
      expect(company.querySelector(".lucide-arrow-down")).not.toBeNull();
      expect(company.querySelector(".lucide-arrow-up")).toBeNull();
      expect(screen.getByRole("columnheader", { name: "Contact" })).toHaveAttribute("aria-sort", "none");
      fireEvent.click(sortButton("Contact"));
      await waitFor(() => expect(sorted()).toEqual(["Contact"]));
      expect(screen.getByRole("columnheader", { name: "Contact" }).querySelector(".lucide-arrow-up")).not.toBeNull();
      expect(screen.getByRole("columnheader", { name: "Company" })).toHaveAttribute("aria-sort", "none");
    });

    // Catches: a worked-out column (Completeness) given a button the database can't honour.
    it("gives a column the database can't sort a plain header: no button and no aria-sort", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt();
      await screen.findByRole("link", { name: "Acme" });
      const header = screen.getByRole("columnheader", { name: "Completeness" });
      expect(header).not.toHaveAttribute("aria-sort");
      expect(within(header).queryByRole("button")).not.toBeInTheDocument();
    });

    // Catches: a header that only works with a mouse.
    it("sorts from the keyboard with Enter and with Space on the focused header button", async () => {
      const user = userEvent.setup();
      listQueue.mockResolvedValue([row()]);
      renderAt();
      await screen.findByRole("link", { name: "Acme" });
      sortButton("Contact").focus();
      await user.keyboard("{Enter}");
      await waitFor(() => expect(where()).toBe("?sort=contact_name"));
      await user.keyboard(" ");
      await waitFor(() => expect(where()).toBe("?sort=-contact_name"));
    });

    // Catches: a sort keeping the old page number, so page 3 of the old order is shown.
    it("goes back to the first page when the sort changes", async () => {
      listQueue.mockImplementation(async ({ page }: { page: number }) => pageOf(page, 375));
      renderAt("/advisor?page=3");
      await screen.findByText("101 to 150 of 375 submissions");
      fireEvent.click(sortButton("Company"));
      await screen.findByText("1 to 50 of 375 submissions");
      expect(where()).toBe("?sort=company_name");
      expect(listQueue).toHaveBeenLastCalledWith(query({ page: 1, sort: { field: "company_name", direction: "asc" } }));
    });

    // Catches: a sort replacing the history entry, so Back leaves the queue instead of undoing the sort; and reversing the same column pushing
    // an entry each time, so asc, desc, asc takes three Backs to unwind.
    it("lets the browser's Back undo a sort: a new column is a step, and reversing the same column is not", async () => {
      listQueue.mockImplementation(async ({ page }: { page: number }) => pageOf(page, 375));
      const BackButton = () => {
        const navigate = useNavigate();
        return <button onClick={() => navigate(-1)}>Browser back</button>;
      };
      render(
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter initialEntries={["/advisor?page=2"]}>
            <Routes>
              <Route path="/advisor" element={<><AdvisorDashboardPage /><LocationProbe /><BackButton /></>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
      await screen.findByText("51 to 100 of 375 submissions");
      fireEvent.click(sortButton("Company"));
      await waitFor(() => expect(where()).toBe("?sort=company_name"));
      fireEvent.click(sortButton("Company"));
      await waitFor(() => expect(where()).toBe("?sort=-company_name"));
      fireEvent.click(sortButton("Company"));
      await waitFor(() => expect(where()).toBe("?sort=company_name"));
      fireEvent.click(sortButton("Contact"));
      await waitFor(() => expect(where()).toBe("?sort=contact_name"));
      // Back leaves Contact for Company as it was last set, then (one Back, however many reversals) the page the person came from.
      fireEvent.click(screen.getByRole("button", { name: "Browser back" }));
      await waitFor(() => expect(where()).toBe("?sort=company_name"));
      fireEvent.click(screen.getByRole("button", { name: "Browser back" }));
      await waitFor(() => expect(where()).toBe("?page=2"));
      expect(await screen.findByText("51 to 100 of 375 submissions")).toBeInTheDocument();
    });

    // Catches: an address naming a field the table doesn't have being kept, or sent to the database to be refused.
    it("drops a sort on an unknown field from the address, and keeps one on a field no column shows", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt("/advisor?sort=-nonsense&q=acme");
      await screen.findByRole("link", { name: "Acme" });
      await waitFor(() => expect(where()).toBe("?q=acme"));
      expect(listQueue).not.toHaveBeenCalledWith(expect.objectContaining({ sort: expect.objectContaining({ field: "nonsense" }) }));
      expect(sorted()).toEqual([]);
      cleanup();
      renderAt("/advisor?sort=signer_name");
      await screen.findByRole("link", { name: "Acme" });
      expect(where()).toBe("?sort=signer_name");
      expect(listQueue).toHaveBeenLastCalledWith(query({ sort: { field: "signer_name", direction: "asc" } }));
      expect(sorted()).toEqual([]);
    });

    // Catches: the header's name carrying its state ("Company, sorted ascending. Sort descending"), which a screen reader reads at every cell
    // move on top of aria-sort; the name is the header's words, the state is aria-sort and what a click does is the button's description.
    it("names the header by its words alone, with the state in aria-sort and what a click does as the button's description", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt("/advisor?sort=company_name");
      await screen.findByRole("link", { name: "Acme" });
      expect(screen.getByRole("columnheader", { name: "Company" })).toHaveAttribute("aria-sort", "ascending");
      expect(sortButton("Company")).toHaveAccessibleDescription("Sort descending");
      expect(sortButton("Contact")).toHaveAccessibleDescription("Sort ascending");
      expect(sortButton("Submitted")).toHaveAccessibleDescription("Sort descending");
      // The mark is decoration.
      for (const icon of Array.from(sortButton("Company").querySelectorAll("svg"))) expect(icon).toHaveAttribute("aria-hidden", "true");
    });

    // Catches: a header cell that is only partly the button (words outside it, or padding around it).
    it("makes the whole header cell the button: the cell holds nothing else and no padding of its own", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt();
      await screen.findByRole("link", { name: "Acme" });
      const th = screen.getByRole("columnheader", { name: "Company" });
      expect(th.children).toHaveLength(1);
      expect(th.firstElementChild).toBe(sortButton("Company"));
      expect(th.textContent).toBe(sortButton("Company").textContent);
      expect(th).toHaveClass("p-0");
    });

    // Catches: a most-requests-first sort that starts with the many rows that have none (0 is a real number), and a blank cell for them.
    it("starts Quotes with the most requests, and says None where there are none", async () => {
      listQueue.mockResolvedValue([row({ company_name: "Busy", quote_requests_sent: 3, quotes_received: 1 }), row({ session_id: "s2", company_name: "Idle" })]);
      renderAt();
      await screen.findByRole("link", { name: "Busy" });
      expect(within(screen.getByText("Idle").closest("tr")!).getByText("None")).toBeInTheDocument();
      fireEvent.click(sortButton("Quotes"));
      await waitFor(() => expect(where()).toBe("?sort=-quote_requests_sent"));
      expect(listQueue).toHaveBeenLastCalledWith(query({ sort: { field: "quote_requests_sent", direction: "desc" } }));
    });

    // Catches: "Waiting since" over a duration ("Waiting 70 days") with an up arrow that lists the LARGEST durations first; it shows the day
    // the wait began, so ascending is the longest wait first, and the first click is ascending.
    it("shows the day a wait began under 'Waiting since', and its first click is ascending (the longest wait first)", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-16T15:00:00"));
      listQueue.mockResolvedValue([row({ oldest_waiting_on: "2026-09-07", quote_requests_sent: 1 })]);
      renderAt();
      const cell = (await screen.findByText("Sep 7, 2026")).closest("td")!;
      expect(within(cell).getByText("Waiting 70 days")).toBeInTheDocument();
      vi.useRealTimers();
      fireEvent.click(sortButton("Waiting since"));
      await waitFor(() => expect(where()).toBe("?sort=oldest_waiting_on"));
      expect(listQueue).toHaveBeenLastCalledWith(query({ sort: { field: "oldest_waiting_on", direction: "asc" } }));
    });

    // Catches: the old link's other sort parameter (oldest_waiting) no longer marking its column.
    it("shows an old link's oldest-wait sort in the Waiting since header", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt("/advisor?sort=oldest_waiting");
      await screen.findByRole("link", { name: "Acme" });
      expect(screen.getByRole("columnheader", { name: "Waiting since" })).toHaveAttribute("aria-sort", "ascending");
      await waitFor(() => expect(where()).toBe("?sort=oldest_waiting_on"));
    });

    describe("focus", () => {
      // Catches: the sort button losing focus when the sorted rows arrive (the header being rebuilt or the table being swapped), which drops a
      // keyboard user back to the top of the page after every sort.
      it("stays on the header button after a click and after the new rows arrive", async () => {
        listQueue.mockResolvedValueOnce([row({ company_name: "First" })]);
        renderAt();
        await screen.findByText("First");
        const button = sortButton("Company");
        button.focus();
        let arrive: (rows: unknown) => void = () => {};
        listQueue.mockReturnValue(new Promise((r) => { arrive = r; }));
        fireEvent.click(button);
        await waitFor(() => expect(where()).toBe("?sort=company_name"));
        expect(document.activeElement).toBe(button);
        await act(async () => arrive([row({ company_name: "Second" })]));
        await screen.findByText("Second");
        expect(sortButton("Company")).toBe(button);
        expect(document.activeElement).toBe(button);
      });

      // Catches: "Back to newest first" being pressed and removed, so focus falls to the page and a keyboard user starts again from the top.
      it("moves to the table's scroll box when 'Back to newest first' is pressed and goes away", async () => {
        const user = userEvent.setup();
        listQueue.mockResolvedValue([row()]);
        renderAt("/advisor?sort=company_name");
        await screen.findByRole("link", { name: "Acme" });
        await user.tab();
        screen.getByRole("button", { name: "Back to newest first" }).focus();
        await user.keyboard("{Enter}");
        await waitFor(() => expect(where()).toBe(""));
        expect(screen.queryByRole("button", { name: "Back to newest first" })).not.toBeInTheDocument();
        expect(document.activeElement).toBe(screen.getByRole("region", { name: /Submissions/ }));
      });
    });

    // Catches: the order line being a live region too, so one click is announced by aria-sort, by the button and by the line.
    it("keeps the order line plain text, not a live region", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt("/advisor?sort=company_name");
      await screen.findByRole("link", { name: "Acme" });
      const line = screen.getByText("Sorted by Company, ascending.");
      expect(line.closest("[aria-live], [role=status], [role=alert]")).toBeNull();
    });

    // Catches: the busy mark and the dimming sitting on the whole box, so the headers (and the button a person just pressed) are dimmed and
    // marked busy while the sorted page loads.
    it("marks only the body busy and dims only the body while the sorted page loads, never the headers", async () => {
      listQueue.mockResolvedValueOnce([row({ company_name: "Old order" })]);
      renderAt();
      await screen.findByText("Old order");
      listQueue.mockReturnValue(new Promise(() => {}));
      fireEvent.click(sortButton("Company"));
      await waitFor(() => expect(tableBody()).toHaveAttribute("aria-busy", "true"));
      expect(screen.getByRole("region", { name: /Submissions/ })).not.toHaveAttribute("aria-busy");
      expect(screen.getByRole("region", { name: /Submissions/ })).not.toHaveClass("opacity-70");
      expect(screen.getByRole("table").querySelector("thead")!.closest("[aria-busy=true], .opacity-70")).toBeNull();
    });

    // Catches: a sort equal to the table's default being kept in the address, so the line and "Back to" show for the order the table has anyway.
    it("treats a sort equal to the table's default as no sort, and drops it from the address", async () => {
      listQueue.mockResolvedValue([row()]);
      setTable({ ...QUEUE_TABLE, defaultSort: { field: "submitted_at", direction: "desc" }, defaultSortLabel: "Newest certified", defaultSortReset: "Back to newest certified" });
      renderAt("/advisor?sort=-submitted_at&q=acme");
      await screen.findByRole("link", { name: "Acme" });
      await waitFor(() => expect(where()).toBe("?q=acme"));
      expect(screen.queryByRole("button", { name: "Back to newest certified" })).not.toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Submitted" })).toHaveAttribute("aria-sort", "descending");
    });

    describe("the order when no column is sorted", () => {
      // Catches: the queue's compound order being invisible when no header can show it, and no way back to it after a column sort.
      it("says what the order is when the address holds no sort, and offers the way back only once one is set", async () => {
        listQueue.mockResolvedValue([row()]);
        renderAt();
        await screen.findByRole("link", { name: "Acme" });
        expect(screen.getByText("Order: Newest first")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Back to newest first/ })).not.toBeInTheDocument();
        expect(sorted()).toEqual([]);
        fireEvent.click(sortButton("Company"));
        await waitFor(() => expect(where()).toBe("?sort=company_name"));
        expect(screen.queryByText("Order: Newest first")).not.toBeInTheDocument();
        expect(screen.getByText("Sorted by Company, ascending.")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Back to newest first" }));
        await waitFor(() => expect(where()).toBe(""));
        expect(listQueue).toHaveBeenLastCalledWith(query());
        expect(screen.getByText("Order: Newest first")).toBeInTheDocument();
      });

      // Catches: the way back keeping the page, the filters or the tab.
      it("keeps the tab, search and filters when going back to the default order, and starts at page 1", async () => {
        listQueue.mockImplementation(async ({ page }: { page: number }) => pageOf(page, 375));
        renderAt("/advisor?view=won&q=acme&page=3&sort=-company_name");
        await screen.findByText("101 to 150 of 375 submissions matching “acme”");
        fireEvent.click(screen.getByRole("button", { name: "Back to newest first" }));
        await waitFor(() => expect(where()).toBe("?view=won&q=acme"));
      });

      // Catches: a table with its own one-column default (a table other than the queue) not showing it, or offering no way back to it.
      it("for a table whose default is one column, shows it in the header, says no order line, and offers the way back after another sort", async () => {
        listQueue.mockResolvedValue([row()]);
        setTable({ ...QUEUE_TABLE, defaultSort: { field: "submitted_at", direction: "desc" }, defaultSortLabel: "Newest certified", defaultSortReset: "Back to newest certified" });
        renderAt();
        await screen.findByRole("link", { name: "Acme" });
        expect(screen.getByRole("columnheader", { name: "Submitted" })).toHaveAttribute("aria-sort", "descending");
        expect(screen.queryByText(/^Order:/)).not.toBeInTheDocument();
        // The default's column reverses from where it is.
        fireEvent.click(sortButton("Submitted"));
        await waitFor(() => expect(where()).toBe("?sort=submitted_at"));
        fireEvent.click(sortButton("Company"));
        await waitFor(() => expect(where()).toBe("?sort=company_name"));
        fireEvent.click(screen.getByRole("button", { name: "Back to newest certified" }));
        await waitFor(() => expect(where()).toBe(""));
        expect(screen.getByRole("columnheader", { name: "Submitted" })).toHaveAttribute("aria-sort", "descending");
      });
    });

    // Catches: the old links' sort parameters stopping to work now that the Sort box is gone.
    it("shows an old link's sort (oldest wait, soonest expiry) in its column's header", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt("/advisor?sort=earliest_expiry");
      await screen.findByRole("link", { name: "Acme" });
      expect(screen.getByRole("columnheader", { name: "Quote expires" })).toHaveAttribute("aria-sort", "ascending");
      expect(screen.queryByLabelText("Sort")).not.toBeInTheDocument();
    });

    describe("while the rows are on their way", () => {
      // Catches: headers that wait for the rows (sort changes the question, so a person can correct it while a slow list loads).
      it("works over the grey rows, and shows the address's sort", async () => {
        listQueue.mockReturnValue(new Promise(() => {}));
        renderAt("/advisor?sort=-employee_count");
        expect(tableBody()).toHaveAttribute("aria-busy", "true");
        expect(screen.getByRole("columnheader", { name: "Employees" })).toHaveAttribute("aria-sort", "descending");
        fireEvent.click(sortButton("Company"));
        await waitFor(() => expect(where()).toBe("?sort=company_name"));
        expect(screen.getByRole("columnheader", { name: "Company" })).toHaveAttribute("aria-sort", "ascending");
        expect(listQueue).toHaveBeenLastCalledWith(query({ sort: { field: "company_name", direction: "asc" } }));
      });

      // Catches: the rows blanking (or staying bright) while the newly sorted page loads: D-144, a different question.
      it("keeps the rows on screen, dimmed, until the newly sorted page arrives", async () => {
        listQueue.mockResolvedValueOnce([row({ company_name: "Old order" })]);
        renderAt();
        await screen.findByText("Old order");
        let arrive: (rows: unknown) => void = () => {};
        listQueue.mockReturnValue(new Promise((r) => { arrive = r; }));
        fireEvent.click(sortButton("Company"));
        await waitFor(() => expect(where()).toBe("?sort=company_name"));
        expect(screen.getByText("Old order")).toBeInTheDocument();
        expect(tableBody()).toHaveAttribute("aria-busy", "true");
        expect(tableBody()).toHaveClass("opacity-70");
        await act(async () => arrive([row({ company_name: "New order" })]));
        expect(await screen.findByText("New order")).toBeInTheDocument();
        expect(tableBody()).not.toHaveAttribute("aria-busy");
      });
    });

    // Catches: a sort refetching the tab counts, which it cannot change (a sort does not change what matches).
    it("does not ask for the tab counts again when the sort changes", async () => {
      listQueue.mockResolvedValue([row()]);
      renderAt();
      await screen.findByRole("link", { name: "Acme" });
      await waitFor(() => expect(countQueueViews).toHaveBeenCalled());
      const counted = countQueueViews.mock.calls.length;
      fireEvent.click(sortButton("Company"));
      await waitFor(() => expect(where()).toBe("?sort=company_name"));
      await waitFor(() => expect(listQueue).toHaveBeenLastCalledWith(query({ sort: { field: "company_name", direction: "asc" } })));
      fireEvent.click(sortButton("Company"));
      await waitFor(() => expect(where()).toBe("?sort=-company_name"));
      await act(async () => {});
      expect(countQueueViews.mock.calls.length).toBe(counted);
    });
  });

  // CRM-S2.2: "nothing yet" and "nothing matches" are two different things, and the person is never told the wrong one.
  describe("when no submissions are shown (CRM-S2.2)", () => {
    const headers = () => screen.getAllByRole("columnheader").map((h) => h.textContent);
    const statuses = () => spoken().map((s) => s.textContent);
    const clearFilters = () => screen.queryByRole("button", { name: /^Clear filters/ });
    // Anything that could create or start a record.
    // The filter row's own buttons ("Add filter", "Filter by Has new PEO mail") narrow the list; they create nothing.
    const offersToCreate = () => {
      const named = /new|create|add|start/i;
      const outsideRow = (e: HTMLElement) => !e.closest("[role=group][aria-label=Filters]");
      return screen.queryAllByRole("link", { name: named }).find(outsideRow) ?? screen.queryAllByRole("button", { name: named }).find(outsideRow) ?? null;
    };

    // Catches: an empty queue at the bare address being worded as a filter that excluded everything, or offering "Clear filters" with nothing to clear.
    it("says nothing yet, in one sentence with no action, when the address is bare and no rows come back", async () => {
      listQueue.mockResolvedValue([]);
      renderAt();
      expect(await screen.findByText("Submissions appear here once a prospect has started filling in an intake.")).toBeInTheDocument();
      expect(clearFilters()).toBeNull();
      expect(screen.queryByText(/match/)).not.toBeInTheDocument();
      expect(offersToCreate()).toBeNull();
      // There is no "create a submission" a member can do yet (New quote arrives with CRM-Q2.1), so the empty state has no action at all.
      expect(within(tableBody()).queryAllByRole("button")).toHaveLength(0);
      expect(within(tableBody()).queryAllByRole("link")).toHaveLength(0);
    });

    // Catches: the empty state replacing the table, so the column headers and the toolbar vanish and the page jumps.
    it("keeps the toolbar, the tabs and the column headers under both kinds of empty", async () => {
      listQueue.mockResolvedValue([]);
      renderAt();
      await screen.findByText(/appear here/);
      const bare = headers();
      expect(bare).toContain("Company");
      expect(bare).toContain("Quote expires");
      expect(screen.getByLabelText("Search")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Filter by Waiting on a PEO" })).toBeInTheDocument();
      expect(screen.getByRole("navigation", { name: "Views" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("link", { name: /^Won/ }));
      await screen.findByText("No submissions match these filters.");
      expect(headers()).toEqual(bare);
      expect(screen.getByLabelText("Search")).toBeInTheDocument();
      expect(screen.getByRole("navigation", { name: "Views" })).toBeInTheDocument();
    });

    // Catches: a filter, tab or search being left out of the words, or worded with the database's names instead of the page's.
    it.each([
      ["a tab", "/advisor?view=won", "No submissions match these filters.", ["View: Won"], "Show all statuses"],
      ["a search", "/advisor?q=zzz", "No submissions match this search.", ["Search: “zzz”"], "Clear search"],
      ["a yes or no filter", "/advisor?action=1", "No submissions match these filters.", ["Needs advisor action: yes"], "Clear filters"],
      ["the waiting box", "/advisor?waiting=1", "No submissions match these filters.", ["Waiting on a PEO: yes"], "Clear filters"],
      ["a list of choices", "/advisor?filter=pipeline_status:any_of:won,lost", "No submissions match these filters.", ["Status is any of Won or Lost"], "Clear filters"],
      ["a list of states", "/advisor?filter=states:any_of:CA,NY", "No submissions match these filters.", ["States includes any of CA or NY"], "Clear filters"],
      ["a between", "/advisor?filter=employee_count:between:10,50", "No submissions match these filters.", ["Employees is between 10 and 50"], "Clear filters"],
      ["a text filter", "/advisor?filter=company_name:contains:acme", "No submissions match these filters.", ["Company contains “acme”"], "Clear filters"],
      ["a filter with no value", "/advisor?filter=company_name:is_empty", "No submissions match these filters.", ["Company is empty"], "Clear filters"],
      ["a day filter", "/advisor?filter=submitted_at:before:2026-11-01", "No submissions match these filters.", ["Submitted is before Nov 1, 2026"], "Clear filters"],
      ["a count of days", "/advisor?filter=submitted_at:in_next_days:7", "No submissions match these filters.", ["Submitted is in the next 7 days"], "Clear filters"],
      ["every kind at once", "/advisor?view=won&q=zzz&filter=needs_action:is:true", "No submissions match this search and these filters.", ["View: Won", "Search: “zzz”", "Needs advisor action: yes"], "Clear filters and search"],
      ["a tab and a search", "/advisor?view=won&q=zzz", "No submissions match this search and these filters.", ["View: Won", "Search: “zzz”"], "Clear search"],
      ["one choice", "/advisor?filter=pipeline_status:any_of:won", "No submissions match these filters.", ["Status is Won"], "Clear filters"],
      ["one choice left out", "/advisor?filter=pipeline_status:none_of:won", "No submissions match these filters.", ["Status is not Won"], "Clear filters"],
      ["two choices left out", "/advisor?filter=pipeline_status:none_of:won,lost", "No submissions match these filters.", ["Status is none of Won or Lost"], "Clear filters"],
      ["three choices", "/advisor?filter=pipeline_status:any_of:won,lost,quoted", "No submissions match these filters.", ["Status is any of Won, Lost or Quoted"], "Clear filters"],
      ["one state", "/advisor?filter=states:any_of:CA", "No submissions match these filters.", ["States includes CA"], "Clear filters"],
      ["one state left out", "/advisor?filter=states:none_of:CA", "No submissions match these filters.", ["States does not include CA"], "Clear filters"],
      ["required items by their names", "/advisor?filter=missing_required:any_of:company_name,states", "No submissions match these filters.", ["Missing required items includes any of Company legal name or States of operation"], "Clear filters"],
      ["a value the table does not list", "/advisor?filter=pipeline_status:any_of:zzz", "No submissions match these filters.", ["Status is “zzz”"], "Clear filters"],
      ["a pair given the wrong way round", "/advisor?filter=employee_count:between:50,10", "No submissions match these filters.", ["Employees is between 10 and 50"], "Clear filters"],
      ["days given the wrong way round", "/advisor?filter=submitted_at:between:2026-11-30,2026-11-01", "No submissions match these filters.", ["Submitted is between Nov 1, 2026 and Nov 30, 2026"], "Clear filters"],
      ["one day ahead", "/advisor?filter=submitted_at:in_next_days:1", "No submissions match these filters.", ["Submitted is in the next day"], "Clear filters"],
      ["no days ahead", "/advisor?filter=submitted_at:in_next_days:0", "No submissions match these filters.", ["Submitted is today"], "Clear filters"],
      ["one day back", "/advisor?filter=submitted_at:in_last_days:1", "No submissions match these filters.", ["Submitted is in the last day"], "Clear filters"],
      ["no days back", "/advisor?filter=submitted_at:in_last_days:0", "No submissions match these filters.", ["Submitted is today"], "Clear filters"],
      ["several days back", "/advisor?filter=submitted_at:in_last_days:30", "No submissions match these filters.", ["Submitted is in the last 30 days"], "Clear filters"],
    ])("says nothing matches, and names what is in force, for %s", async (_name, url, headline, inForce, clear) => {
      listQueue.mockResolvedValue([]);
      renderAt(url);
      expect(await screen.findByText(headline)).toBeInTheDocument();
      const list = screen.getByRole("list", { name: "What is in force" });
      expect(within(list).getAllByRole("listitem").map((i) => i.textContent)).toEqual(inForce);
      expect(within(emptyState()).getByRole("button", { name: clear })).toBeInTheDocument();
      expect(screen.queryByText(/appear here/)).not.toBeInTheDocument();
      expect(offersToCreate()).toBeNull();
    });

    // Catches: the Inbox (an address filter) saying "No submissions match these filters" when the true and specific thing is that none have new mail.
    it("words an empty Inbox as no submissions having new PEO mail, and still names the filter and offers to clear it", async () => {
      listQueue.mockResolvedValue([]);
      renderAt("/advisor?mail=new");
      expect(await screen.findByText("No submissions have new PEO mail.")).toBeInTheDocument();
      expect(screen.queryByText(/match these filters/)).not.toBeInTheDocument();
      expect(within(screen.getByRole("list", { name: "What is in force" })).getByText("Has new PEO mail: yes")).toBeInTheDocument();
      expect(within(emptyState()).getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
      // Inbox together with another filter is no longer only the Inbox.
      cleanup();
      renderAt("/advisor?mail=new&action=1");
      expect(await screen.findByText("No submissions match these filters.")).toBeInTheDocument();
    });

    // Catches: a button that clears more than its label says (the tab), or less (a hand-written filter), or drops the person's sort.
    it("clears the search and every filter, keeps the tab and the sort, and then offers to leave the tab", async () => {
      listQueue.mockImplementation(async (q: { filters: { field: string }[] }) => (q.filters.some((f) => f.field !== "pipeline_status") ? [] : q.filters.length ? [] : [row()]));
      renderAt("/advisor?view=won&q=zzz&filter=needs_action:is:true&filter=company_name:contains:acme&sort=company_name");
      await screen.findByText("No submissions match this search and these filters.");
      fireEvent.click(within(emptyState()).getByRole("button", { name: "Clear filters and search" }));
      expect(await screen.findByRole("button", { name: "Show all statuses" })).toBeInTheDocument();
      expect(where()).toBe("?view=won&sort=company_name");
      expect(screen.getByText("View: Won")).toBeInTheDocument();
      expect(screen.getByLabelText("Search")).toHaveValue("");
      expect(screen.queryByRole("button", { name: /^Remove filter/ })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: /^Won/ })).toHaveAttribute("aria-current", "page");
      fireEvent.click(screen.getByRole("button", { name: "Show all statuses" }));
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query({ sort: { field: "company_name", direction: "asc" } }));
      expect(where()).toBe("?sort=company_name");
    });

    // Catches: clearing replacing the history entry, so Back cannot return to the question the person just cleared (and leaves the page instead).
    it("makes clearing a step Back undoes, for the search and for leaving a tab", async () => {
      listQueue.mockResolvedValue([]);
      renderAt("/advisor?view=won&q=zzz");
      await screen.findByText("No submissions match this search and these filters.");
      fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
      await waitFor(() => expect(where()).toBe("?view=won"));
      fireEvent.click(await screen.findByRole("button", { name: "Show all statuses" }));
      await waitFor(() => expect(where()).toBe(""));
      fireEvent.click(screen.getByRole("button", { name: "Go back" }));
      await waitFor(() => expect(where()).toBe("?view=won"));
      fireEvent.click(screen.getByRole("button", { name: "Go back" }));
      await waitFor(() => expect(where()).toBe("?view=won&q=zzz"));
    });

    // Catches: a bare address that has zero rows being called "nothing matches" (nothing to clear), or a narrowed address being told to create its first one.
    it("never mixes the two up as the address goes from narrowed to bare and back", async () => {
      listQueue.mockResolvedValue([]);
      renderAt("/advisor?q=zzz");
      await screen.findByText("No submissions match this search.");
      fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
      expect(await screen.findByText("Submissions appear here once a prospect has started filling in an intake.")).toBeInTheDocument();
      expect(clearFilters()).toBeNull();
      await setYes(userEvent.setup(), "Waiting on a PEO");
      expect(await screen.findByText("No submissions match these filters.")).toBeInTheDocument();
      expect(screen.queryByText(/appear here/)).not.toBeInTheDocument();
    });

    // Catches: two announcements (the old empty message and the new one, or a status per piece), or none, or one hidden inside a busy region.
    it("is announced once, as one polite status, and is not announced again by a refresh that still finds nothing", async () => {
      listQueue.mockResolvedValue([]);
      renderAt("/advisor?view=won");
      await screen.findByText("No submissions match these filters.");
      expect(statuses()).toHaveLength(1);
      expect(statuses()[0]).toContain("No submissions match these filters.");
      expect(statuses()[0]).toContain("View: Won");
      expect(spoken()[0]).toHaveAttribute("aria-live", "polite");
      expectStatusesOutsideBusy();
      const status = spoken()[0];
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await waitFor(() => expect(listQueue.mock.calls.length).toBeGreaterThan(1));
      await act(async () => {});
      // The same element, still saying the same words: nothing was removed and put back, so nothing is said again.
      expect(spoken()).toEqual([status]);
    });

    // Catches: the table being rebuilt when the answer is empty, which drops the focus and the sideways scroll the grey rows already had.
    it("is the same table, with its scroll box and focus, from the grey rows to the empty state and to the rows", async () => {
      let arrive: (rows: unknown) => void = () => {};
      listQueue.mockReturnValue(new Promise((r) => { arrive = r; }));
      renderAt();
      const table = await screen.findByRole("table");
      const box = screen.getByRole("region", { name: /scrolls sideways/ });
      box.focus();
      expect(box).toHaveFocus();
      await act(async () => arrive([]));
      await screen.findByText(/appear here/);
      expect(screen.getByRole("table")).toBe(table);
      expect(screen.getByRole("region", { name: /scrolls sideways/ })).toBe(box);
      expect(box).toHaveFocus();
      listQueue.mockResolvedValue([row()]);
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await screen.findByRole("link", { name: "Acme" });
      expect(screen.getByRole("table")).toBe(table);
      expect(box).toHaveFocus();
    });

    // Catches: "Clear filters" disappearing under the person's focus and dropping it to the top of the page.
    it("puts focus on the table when Clear filters is pressed", async () => {
      listQueue.mockImplementation(async (q: { search: string }) => (q.search ? [] : [row()]));
      renderAt("/advisor?q=zzz");
      const clear = await screen.findByRole("button", { name: "Clear search" });
      clear.focus();
      fireEvent.click(clear);
      await screen.findByRole("link", { name: "Acme" });
      expect(screen.getByRole("region", { name: /scrolls sideways/ })).toHaveFocus();
    });

    // Catches: an empty answer being shown for a question the person has not asked: the old words must stay, dimmed, until the new answer.
    it("keeps the empty state it has, dimmed and not re-announced, while the next tab's answer is on its way", async () => {
      listQueue.mockResolvedValue([]);
      renderAt();
      await screen.findByText(/appear here/);
      listQueue.mockReturnValue(new Promise(() => {}));
      fireEvent.click(screen.getByRole("link", { name: /^Won/ }));
      await waitFor(() => expect(where()).toBe("?view=won"));
      expect(screen.getByText(/appear here/)).toBeInTheDocument();
      expect(screen.queryByText(/match these filters/)).not.toBeInTheDocument();
      expect(tableBody()).toHaveClass("opacity-70");
    });

    // Catches: an empty list's refresh not turning into rows, or rows into the empty state, when the answer changes.
    it("goes from empty to rows and back to empty when a refresh finds a different answer", async () => {
      listQueue.mockResolvedValue([]);
      renderAt();
      await screen.findByText(/appear here/);
      listQueue.mockResolvedValue([row()]);
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await screen.findByRole("link", { name: "Acme" });
      expect(screen.queryByText(/appear here/)).not.toBeInTheDocument();
      listQueue.mockResolvedValue([]);
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await screen.findByText(/appear here/);
      expect(headers()).toContain("Company");
    });

    // Catches: a request that never answers after an empty (or full) answer leaving the old question's words dimmed for ever with no way out.
    describe("when the answer to the next question never arrives", () => {
      afterEach(() => { vi.useRealTimers(); });
      const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
      it.each([["an empty answer", []], ["rows", [row()]]])("says it is taking longer than usual after ten seconds, with Try again, over %s", async (_n, first) => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        listQueue.mockResolvedValueOnce(first);
        renderAt();
        await screen.findByRole("table");
        await tick(100);
        listQueue.mockReturnValue(new Promise(() => {}));
        fireEvent.click(screen.getByRole("link", { name: /^Won/ }));
        await tick(9_000);
        expect(screen.queryByText("This is taking longer than usual.")).not.toBeInTheDocument();
        await tick(1_500);
        expect(screen.getByText("This is taking longer than usual.")).toBeInTheDocument();
        listQueue.mockResolvedValue([]);
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        await tick(100);
        expect(screen.queryByText("This is taking longer than usual.")).not.toBeInTheDocument();
        expect(await screen.findByText("No submissions match these filters.")).toBeInTheDocument();
      });
    });
  });
});
