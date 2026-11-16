import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { allStatuses, expectStatusesOutsideBusy, spoken, watchSlowTimers } from "@/test/loading";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blobBytes, blobText } from "@/test/blob";

// The session is the signed-in person's: its token names the sign-in, and the page must hand it to the one shared answer
// about which firms they own, so an answer given before the second factor is not handed out after it.
const auth = { user: { id: "u1", email: "owner@example.com", app_metadata: { providers: ["email"] } }, session: { access_token: "tok-1" } as { access_token: string } | null, signOut: vi.fn() };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
// The page's calls to the database, by the names advisorApi gives them; AdvisorApiError is the real one, so a refusal is read as it is.
const api = { fetchOwnedFirms: vi.fn(), fetchMyFirms: vi.fn(), fetchIsAdmin: vi.fn(), listFirmActivityPeople: vi.fn(), listFirmActivity: vi.fn() };
vi.mock("@/lib/advisorApi", async () => ({ ...(await vi.importActual<object>("@/lib/advisorApi")), ...api, FIRM_ACTIVITY_PAGE_SIZE: 25 }));
// The authenticator's calls (src/lib/secondFactor.ts), faked at the client.
const mfa = { listFactors: vi.fn(), challengeAndVerify: vi.fn() };
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { mfa } } }));
// The Export button asks the database through exportRows (its refusals are the real ExportError) and hands the file to downloadBlob: both are faked here,
// so the test sees the file the person would have been given, never the browser's own download.
const exportRows = vi.fn();
vi.mock("@/lib/exportApi", async () => ({ ...(await vi.importActual<object>("@/lib/exportApi")), exportRows: (...a: unknown[]) => exportRows(...a) }));
const downloadBlob = vi.fn();
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: (...a: unknown[]) => downloadBlob(...a) }));
// The uses of Nevermore support (story CRM-P2.4): the reason and times the database gives an owner, never who.
const supportApi = { fetchFirmSupportUses: vi.fn(), fetchMySupportSessionHere: vi.fn() };
vi.mock("@/lib/supportApi", async () => ({ ...(await vi.importActual<object>("@/lib/supportApi")), ...supportApi }));
let firmAddress: { status: "none" } | { status: "known"; address: string; name: string } = { status: "none" };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firmAddress }));

const { clearOwnedFirms, clearMyFirms } = await import("@/hooks/useOwnedFirms");
const { default: AdvisorActivityPage } = await import("./AdvisorActivityPage");
const { default: WorkspaceShell } = await import("@/components/workspace/WorkspaceShell");
const { default: AdvisorSettingsPage } = await import("./AdvisorSettingsPage");
const { AdvisorApiError, NEVERMORE_FILTER } = await import("@/lib/advisorApi");
const { ExportError } = await import("@/lib/exportApi");
const { WorkspaceContext } = await import("@/components/workspace/workspaceContext");

const renderPage = (at = "/advisor/activity") => render(<MemoryRouter initialEntries={[at]}><AdvisorActivityPage /></MemoryRouter>);
const entry = (over: Record<string, unknown> = {}) => ({
  entry_key: "k1", at: "2026-11-12T15:30:00Z", actor_id: "u1", actor_email: "agent@example.com", kind: "submission_viewed",
  record_type: "submission", record_id: "0b5c1f2e-1111-4222-8333-444455556666", subject_user_id: null, subject_email: null, role: null, by_nevermore: false, ...over,
});

describe("AdvisorActivityPage", () => {
  beforeEach(() => {
    clearOwnedFirms();
    clearMyFirms();
    exportRows.mockReset();
    downloadBlob.mockReset();
    auth.signOut.mockReset();
    auth.user = { id: "u1", email: "owner@example.com", app_metadata: { providers: ["email"] } };
    mfa.listFactors.mockReset().mockResolvedValue({ data: { totp: [], all: [] }, error: null });
    mfa.challengeAndVerify.mockReset();
    firmAddress = { status: "none" };
    auth.session = { access_token: "tok-1" };
    for (const fn of Object.values(api)) fn.mockReset();
    supportApi.fetchFirmSupportUses.mockReset().mockResolvedValue([]);
    supportApi.fetchMySupportSessionHere.mockReset().mockResolvedValue(null);
    api.fetchMyFirms.mockResolvedValue([{ firm_id: "firm-1", name: "Alpha Advisory", address: "alpha", role: "owner" }]);
    api.fetchIsAdmin.mockResolvedValue(false);
    api.fetchOwnedFirms.mockResolvedValue([{ firm_id: "firm-1", name: "Alpha Advisory" }]);
    api.listFirmActivityPeople.mockResolvedValue([{ user_id: "u1", email: "agent@example.com", is_nevermore: false }, { user_id: "u2", email: "lead@example.com", is_nevermore: false }]);
    api.listFirmActivity.mockResolvedValue({ entries: [entry()], hasMore: false });
  });

  it("lists who did what and when, in the order the database gave it, with the record each was about", async () => {
    api.listFirmActivity.mockResolvedValue({
      entries: [
        entry({ entry_key: "k3", at: "2026-11-12T16:00:00Z", actor_email: "lead@example.com", kind: "send_recorded", record_type: "quote_request", record_id: "42" }),
        entry({ entry_key: "k2", actor_email: "agent@example.com", kind: "document_downloaded", record_type: "document", record_id: "doc-9" }),
      ],
      hasMore: false,
    });
    renderPage();
    const table = await screen.findByRole("table", { name: "Who did what" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["When", "Who", "What", "Record"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("lead@example.com");
    expect(rows[0]).toHaveTextContent("Recorded a send");
    expect(rows[0]).toHaveTextContent("Quote request 42");
    expect(rows[1]).toHaveTextContent("agent@example.com");
    expect(rows[1]).toHaveTextContent("Downloaded a document");
    expect(rows[1]).toHaveTextContent("Document doc-9");
    expect(api.listFirmActivity).toHaveBeenCalledWith("firm-1", { person: null, kind: null, after: null });
  });

  it("asks which firms the person owns once for the page and its header together", async () => {
    renderPage();
    await screen.findByRole("table", { name: "Who did what" });
    expect(api.fetchOwnedFirms).toHaveBeenCalledTimes(1);
  });

  it("says who may read it, and loads nothing, when the person owns no firm", async () => {
    api.fetchOwnedFirms.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Only a firm's owners can read its record of who did what.")).toBeInTheDocument();
    expect(api.listFirmActivity).not.toHaveBeenCalled();
    expect(api.listFirmActivityPeople).not.toHaveBeenCalled();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("says the same when the database refuses the read, however the page got there", async () => {
    api.listFirmActivity.mockRejectedValue(new AdvisorApiError("You don't have access to this firm's records.", "42501"));
    renderPage();
    expect(await screen.findByText("Only a firm's owners can read its record of who did what.")).toBeInTheDocument();
    expect(screen.queryByText(/You no longer have access to this firm's records/)).not.toBeInTheDocument();
  });

  describe("loading (CRM-S2.1)", () => {
    const HEADERS = ["When", "Who", "What", "Record"];
    const slowLine = () => screen.queryByText("This is taking longer than usual.");
    const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
    afterEach(() => { cleanup(); vi.useRealTimers(); });
    const hang = () => {
      let arrive: (v: unknown) => void = () => undefined;
      api.listFirmActivity.mockReturnValue(new Promise((resolve) => { arrive = resolve; }));
      return arrive;
    };

    // Catches: the title, the filters and the column headers waiting behind a spinner; grey rows not drawn under the real headers; the
    // placeholders being read row by row; the person filter (which needs the list of people) being usable before the list is there.
    it("shows the title, the filters and the column headers at once, with eight grey rows and one status", async () => {
      hang();
      const { container } = renderPage();
      expect(screen.getByRole("heading", { name: "Who did what" })).toBeInTheDocument();
      const table = screen.getByRole("table", { name: "Who did what" });
      expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(HEADERS);
      expect(container.querySelectorAll("tbody tr")).toHaveLength(8);
      for (const r of Array.from(container.querySelectorAll("tbody tr"))) expect(r.children).toHaveLength(HEADERS.length);
      expect(container.querySelector("tbody")).toHaveAttribute("aria-hidden", "true");
      expect(within(table).getAllByRole("row")).toHaveLength(1);
      expect(spoken()).toHaveLength(1);
      expect(spoken()[0]).toHaveTextContent("Loading the record of who did what");
      expect(allStatuses()).toHaveLength(2);
      expectStatusesOutsideBusy();
      // What changes the question stays usable; what needs the answer's own list does not.
      expect(screen.getByLabelText("Kind")).toBeEnabled();
      // The Person list says why it can't be used yet, stays in the tab order, and ignores a choice.
      expect(screen.getByLabelText("Person")).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByLabelText("Person")).toHaveAccessibleDescription("Available when the record has loaded");
      // No pager, and no placeholders are announced.
      expect(screen.queryByRole("button", { name: "Older" })).not.toBeInTheDocument();
      expect(container.querySelector("[class*='animate-pulse']")!.className).toContain("motion-safe:");
    });

    // Catches: a different table (other headers, a second table, no body) replacing the placeholders, so the page jumps.
    it("is the same table with the same headers once the entries arrive, and the status is gone", async () => {
      const arrive = hang();
      const { container } = renderPage();
      arrive({ entries: [entry(), entry({ entry_key: "k2" })], hasMore: false });
      await waitFor(() => expect(container.querySelectorAll("tbody tr")).toHaveLength(2));
      expect(screen.getAllByRole("table")).toHaveLength(1);
      expect(within(screen.getByRole("table")).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(HEADERS);
      expect(container.querySelectorAll("tbody")).toHaveLength(1);
      expect(container.querySelector("tbody[aria-hidden=true]")).toBeNull();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Person")).not.toHaveAttribute("aria-disabled");
      expect(screen.getByLabelText("Person")).toBeEnabled();
    });

    // Catches: the kind filter being locked while the first answer is slow, so a person can't correct it.
    it("asks again for a corrected filter while the first answer is slow", async () => {
      hang();
      renderPage();
      await waitFor(() => expect(api.listFirmActivity).toHaveBeenCalledTimes(1));
      fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "sign_in" } });
      await waitFor(() => expect(api.listFirmActivity).toHaveBeenCalledTimes(2));
      expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: null, kind: "sign_in", after: null });
      expect(spoken()).toHaveLength(1);
    });

    // Catches: the slow line coming at nine seconds, or not as a status, or Try again not asking again and not starting the count over.
    it("says it is taking longer than usual at ten seconds, not nine, under the title; Try again asks again", async () => {
      vi.useFakeTimers();
      hang();
      renderPage();
      const container = allStatuses().find((e) => !e.textContent)!;
      expect(container).toBeDefined();
      await tick(9_000);
      expect(slowLine()).not.toBeInTheDocument();
      await tick(1_000);
      expect(slowLine()).toBe(container);
      expect(slowLine()).toHaveAttribute("role", "status");
      expectStatusesOutsideBusy();
      expect(screen.getByRole("heading", { name: "Who did what" }).parentElement).toContainElement(slowLine());
      expect(spoken()).toHaveLength(2);
      expect(screen.getByLabelText("Person")).toHaveAttribute("aria-disabled", "true");
      const asked = api.listFirmActivity.mock.calls.length;
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      await tick(0);
      expect(api.listFirmActivity.mock.calls.length).toBe(asked + 1);
      expect(slowLine()).not.toBeInTheDocument();
      await tick(9_000);
      expect(slowLine()).not.toBeInTheDocument();
      await tick(1_000);
      expect(slowLine()).toBeInTheDocument();
    });

    // Catches: the line staying once the entries have arrived or the load has failed.
    it("takes the line away when the entries arrive, and when the load fails", async () => {
      vi.useFakeTimers();
      const arrive = hang();
      renderPage();
      await tick(10_000);
      expect(slowLine()).toBeInTheDocument();
      await act(async () => arrive({ entries: [entry()], hasMore: false }));
      await tick(0);
      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(slowLine()).not.toBeInTheDocument();
      cleanup();
      let fail: (e: Error) => void = () => undefined;
      api.listFirmActivity.mockReturnValue(new Promise((_, reject) => { fail = reject; }));
      renderPage();
      await tick(10_000);
      expect(slowLine()).toBeInTheDocument();
      await act(async () => fail(new Error("The network dropped")));
      await tick(0);
      expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load the record of who did what.");
      expect(screen.queryByText("The network dropped")).not.toBeInTheDocument();
      expect(slowLine()).not.toBeInTheDocument();
    });

    // Catches: a ten-second timer left running after the page is closed.
    it("leaves no timer behind when the page is closed while waiting", async () => {
      vi.useFakeTimers();
      hang();
      const timers = watchSlowTimers();
      const { unmount } = renderPage();
      await tick(3_000);
      unmount();
      timers.expectAllCleared();
      timers.restore();
    });

    // Catches: the firm's name line appearing above the filters on arrival and pushing the filters and the table down a line.
    it("holds the line the firm's name will fill while loading at a firm's address, so nothing is pushed down", async () => {
      api.fetchMyFirms.mockResolvedValue([{ firm_id: "firm-1", name: "Alpha Advisory", address: "alpha", role: "owner" }]);
      firmAddress = { status: "known", address: "alpha", name: "Alpha Advisory" };
      const arrive = hang();
      renderPage();
      const reserved = screen.getByLabelText("Person").closest("div")!.parentElement!.previousElementSibling!;
      expect(reserved).toHaveAttribute("aria-hidden", "true");
      expect(reserved.className).toContain("h-5");
      arrive({ entries: [entry()], hasMore: false });
      const real = await screen.findByText("Alpha Advisory");
      expect(real.closest("p")!.nextElementSibling).toBe(screen.getByLabelText("Person").closest("div")!.parentElement);
      expect(real.closest("p")!.className).toContain("text-sm");
    });

    // Catches: entries of the filter just left staying at full strength under the new filter's choice while its answer loads (it looks like the answer).
    it("dims the entries and marks them busy while another filter or page loads, and not for a refresh of the same one", async () => {
      renderPage();
      const table = await screen.findByRole("table");
      await screen.findByText("agent@example.com", { selector: "td" });
      const box = table.parentElement!;
      expect(box).not.toHaveAttribute("aria-busy");
      api.listFirmActivity.mockReturnValue(new Promise(() => undefined));
      fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "sign_in" } });
      await waitFor(() => expect(box).toHaveAttribute("aria-busy", "true"));
      expect(box).toHaveClass("opacity-70");
      expect(screen.getByText("agent@example.com", { selector: "td" })).toBeInTheDocument();
      expect(screen.getByRole("table").parentElement).toBe(box);
    });

    // Catches: another firm's entries and people (their emails) staying on screen under the new firm's name while it loads.
    it("clears the entries and the Person list at once when another firm is chosen on the bare domain", async () => {
      api.fetchOwnedFirms.mockResolvedValue([{ firm_id: "firm-1", name: "Alpha Advisory" }, { firm_id: "firm-2", name: "Beta Brokers" }]);
      renderPage("/advisor/activity?firm=firm-1");
      await screen.findByText("agent@example.com", { selector: "td" });
      expect(within(screen.getByLabelText("Person")).getByRole("option", { name: "lead@example.com" })).toBeInTheDocument();
      api.listFirmActivity.mockReturnValue(new Promise(() => undefined));
      api.listFirmActivityPeople.mockReturnValue(new Promise(() => undefined));
      fireEvent.change(screen.getByLabelText("Firm"), { target: { value: "firm-2" } });
      await waitFor(() => expect(screen.queryByText("agent@example.com", { selector: "td" })).not.toBeInTheDocument());
      expect(screen.queryByRole("option", { name: "lead@example.com" })).not.toBeInTheDocument();
      expect(document.querySelectorAll("tbody[aria-hidden=true] tr")).toHaveLength(8);
      // The choice of firm stays, so the person can change their mind.
      expect(screen.getByLabelText("Firm")).toHaveValue("firm-2");
    });

    // Catches (D-49): a changed filter or the next page, with entries on screen, bringing back grey rows or the slow line.
    it("shows no placeholders and no slow line while a filter or the next page loads over entries already shown", async () => {
      vi.useFakeTimers();
      api.listFirmActivity.mockResolvedValueOnce({ entries: [entry()], hasMore: true });
      const { container } = renderPage();
      await tick(0);
      expect(screen.getByRole("table")).toBeInTheDocument();
      api.listFirmActivity.mockReturnValue(new Promise(() => undefined));
      fireEvent.click(screen.getByRole("button", { name: "Older" }));
      await tick(25_000);
      expect(container.querySelector("tbody[aria-hidden=true]")).toBeNull();
      expect(screen.getByText("agent@example.com", { selector: "td" })).toBeInTheDocument();
      expect(slowLine()).not.toBeInTheDocument();
      expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    });
  });

  // CRM-S2.2: nothing yet and nothing matches, as one table that keeps its headers and its filters.
  describe("when no entries are shown (CRM-S2.2)", () => {
    const none = { entries: [], hasMore: false };
    const HEADERS = ["When", "Who", "What", "Record"];
    const headers = () => within(screen.getByRole("table", { name: "Who did what" })).getAllByRole("columnheader").map((h) => h.textContent);
    // Catches: an empty record worded as a filter that excluded everything, or an empty message that is false for a firm whose entries have all aged out (the record is pruned at ninety days).
    it("says nothing has been recorded in the last ninety days, which is true for a firm whose entries aged out, and offers no action", async () => {
      api.listFirmActivity.mockResolvedValue(none);
      renderPage();
      expect(await screen.findByText(/Nothing has been recorded for your firm in the last 90 days/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Clear filters/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/match/)).not.toBeInTheDocument();
      // Nobody makes entries by hand: the record is written by what people do, so there is no action.
      expect(within(screen.getByRole("table")).queryAllByRole("button")).toHaveLength(0);
      expect(headers()).toEqual(HEADERS);
      expect(screen.getByLabelText("Person")).toBeInTheDocument();
      expect(screen.getByLabelText("Kind")).toBeInTheDocument();
      expect(spoken()).toHaveLength(1);
      expectStatusesOutsideBusy();
    });

    // Catches: the filters being left out of the words, or the offer to clear them also clearing nothing, or an offer to create.
    it("says no entries match, names the person and the kind chosen, and clears both", async () => {
      renderPage();
      await screen.findByRole("table", { name: "Who did what" });
      api.listFirmActivity.mockResolvedValue(none);
      fireEvent.change(await screen.findByLabelText("Person"), { target: { value: "u2" } });
      fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "export_made" } });
      expect(await screen.findByText("No entries match these filters.")).toBeInTheDocument();
      const list = screen.getByRole("list", { name: "What is in force" });
      expect(within(list).getAllByRole("listitem").map((i) => i.textContent)).toEqual(["Person: lead@example.com", "Kind: Exported records"]);
      expect(screen.queryByText(/Nothing has been recorded/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /new|create|add|start/i })).not.toBeInTheDocument();
      expect(headers()).toEqual(HEADERS);
      expect(spoken()).toHaveLength(1);

      api.listFirmActivity.mockResolvedValue({ entries: [entry()], hasMore: false });
      fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
      expect(await screen.findByText("agent@example.com", { selector: "td" })).toBeInTheDocument();
      expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: null, kind: null, after: null });
      expect(screen.getByLabelText("Person")).toHaveValue("");
      expect(screen.getByLabelText("Kind")).toHaveValue("");
      expect(screen.getByLabelText("Person")).toHaveFocus();
    });

    // Catches: a filter by Nevermore being named by its internal value, or one kind of filter alone being worded as both.
    it("words one filter alone, and Nevermore as Nevermore", async () => {
      api.listFirmActivityPeople.mockResolvedValue([{ user_id: null, email: null, is_nevermore: true }]);
      renderPage();
      await screen.findByRole("table", { name: "Who did what" });
      api.listFirmActivity.mockResolvedValue(none);
      fireEvent.change(screen.getByLabelText("Person"), { target: { value: NEVERMORE_FILTER } });
      await screen.findByText("No entries match these filters.");
      expect(within(screen.getByRole("list", { name: "What is in force" })).getAllByRole("listitem").map((i) => i.textContent)).toEqual(["Person: Nevermore"]);
    });

    // Catches: the table being rebuilt for the empty answer, which would drop focus from a control and make the page jump.
    it("is the same table from the grey rows to the empty state and back to rows, with focus kept on the Kind list", async () => {
      let arrive: (v: unknown) => void = () => undefined;
      api.listFirmActivity.mockReturnValue(new Promise((resolve) => { arrive = resolve; }));
      renderPage();
      const table = screen.getByRole("table", { name: "Who did what" });
      const kind = screen.getByLabelText("Kind");
      kind.focus();
      await act(async () => arrive(none));
      await screen.findByText(/Nothing has been recorded/);
      expect(screen.getByRole("table", { name: "Who did what" })).toBe(table);
      expect(screen.getByLabelText("Kind")).toBe(kind);
      expect(kind).toHaveFocus();
      expect(table.querySelectorAll("tbody")).toHaveLength(1);
      api.listFirmActivity.mockResolvedValue({ entries: [entry()], hasMore: false });
      fireEvent.change(kind, { target: { value: "sign_in" } });
      await screen.findByText("agent@example.com", { selector: "td" });
      expect(screen.getByRole("table", { name: "Who did what" })).toBe(table);
    });

    // Catches: the empty words describing a filter the person has just chosen whose answer has not arrived yet.
    it("keeps the words it has, dimmed, until the answer for a newly chosen filter arrives", async () => {
      api.listFirmActivity.mockResolvedValue(none);
      renderPage();
      await screen.findByText(/Nothing has been recorded/);
      api.listFirmActivity.mockReturnValue(new Promise(() => {}));
      fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "sign_in" } });
      await act(async () => {});
      expect(screen.getByText(/Nothing has been recorded/)).toBeInTheDocument();
      expect(screen.queryByText(/No entries match/)).not.toBeInTheDocument();
    });

    // Catches: "Back to the newest" leaving focus on a button that goes away, which drops it to the top of the page.
    it("puts focus on the Person list when Back to the newest is pressed", async () => {
      api.listFirmActivity.mockResolvedValueOnce({ entries: [entry()], hasMore: true });
      renderPage();
      await screen.findByText("agent@example.com", { selector: "td" });
      api.listFirmActivity.mockResolvedValue(none);
      fireEvent.click(screen.getByRole("button", { name: "Older" }));
      const back = await screen.findByRole("button", { name: "Back to the newest" });
      back.focus();
      api.listFirmActivity.mockResolvedValue({ entries: [entry()], hasMore: false });
      fireEvent.click(back);
      await screen.findByText("agent@example.com", { selector: "td" });
      expect(screen.getByLabelText("Person")).toHaveFocus();
    });

    // Catches: a page after the first that comes back empty under a filter saying nothing matches, when the first page had matches.
    it("says there are no older entries, not that none match, when a later page under a filter is empty", async () => {
      renderPage();
      fireEvent.change(await screen.findByLabelText("Kind"), { target: { value: "sign_in" } });
      api.listFirmActivity.mockResolvedValue({ entries: [entry()], hasMore: true });
      await screen.findByText("agent@example.com", { selector: "td" });
      api.listFirmActivity.mockResolvedValue(none);
      fireEvent.click(screen.getByRole("button", { name: "Older" }));
      expect(await screen.findByText("There are no older entries.")).toBeInTheDocument();
      expect(screen.queryByText(/No entries match/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Back to the newest" })).toBeInTheDocument();
    });

    // Catches: another firm's entries or empty words staying on screen, undimmed, while a new firm loads when the firm changed by a link, not by the list.
    it("clears the entries at once when the firm in the address changes by navigation", async () => {
      api.fetchOwnedFirms.mockResolvedValue([{ firm_id: "firm-1", name: "Alpha Advisory" }, { firm_id: "firm-2", name: "Beta Advisory" }]);
      const { Link } = await import("react-router-dom");
      render(<MemoryRouter initialEntries={["/advisor/activity?firm=firm-1"]}><Link to="/advisor/activity?firm=firm-2">Go to Beta</Link><AdvisorActivityPage /></MemoryRouter>);
      await screen.findByText("agent@example.com", { selector: "td" });
      api.listFirmActivity.mockReturnValue(new Promise(() => {}));
      fireEvent.click(screen.getByRole("link", { name: "Go to Beta" }));
      expect(screen.queryByText("agent@example.com", { selector: "td" })).not.toBeInTheDocument();
      expect(document.querySelector("tbody[aria-hidden=true]")).not.toBeNull();
      cleanup();
      api.listFirmActivity.mockResolvedValue(none);
      render(<MemoryRouter initialEntries={["/advisor/activity?firm=firm-1"]}><Link to="/advisor/activity?firm=firm-2">Go to Beta</Link><AdvisorActivityPage /></MemoryRouter>);
      await screen.findByText(/Nothing has been recorded/);
      api.listFirmActivity.mockReturnValue(new Promise(() => {}));
      fireEvent.click(screen.getByRole("link", { name: "Go to Beta" }));
      expect(screen.queryByText(/Nothing has been recorded/)).not.toBeInTheDocument();
    });

    // Catches: an empty page after the first (the older entries aged out meanwhile) being called "nothing yet", which would be false.
    it("does not say nothing has been recorded when the page after the first comes back empty", async () => {
      api.listFirmActivity.mockResolvedValueOnce({ entries: [entry()], hasMore: true });
      renderPage();
      await screen.findByText("agent@example.com", { selector: "td" });
      api.listFirmActivity.mockResolvedValue(none);
      fireEvent.click(screen.getByRole("button", { name: "Older" }));
      expect(await screen.findByText("There are no older entries.")).toBeInTheDocument();
      expect(screen.queryByText(/Nothing has been recorded/)).not.toBeInTheDocument();
      api.listFirmActivity.mockResolvedValue({ entries: [entry()], hasMore: false });
      fireEvent.click(screen.getByRole("button", { name: "Back to the newest" }));
      expect(await screen.findByText("agent@example.com", { selector: "td" })).toBeInTheDocument();
      expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: null, kind: null, after: null });
    });
  });

  it("says what failed, never the network's own words, and tries again when asked", async () => {
    api.listFirmActivity.mockRejectedValueOnce(new Error("The network dropped"));
    renderPage();
    expect(await screen.findByText("We couldn't load the record of who did what.")).toBeInTheDocument();
    expect(screen.queryByText("The network dropped")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("table", { name: "Who did what" })).toBeInTheDocument();
    expect(api.listFirmActivity).toHaveBeenCalledTimes(2);
  });

  it("shows a person at Nevermore as Nevermore, with no email or id, and offers Nevermore once in the person filter", async () => {
    api.listFirmActivityPeople.mockResolvedValue([
      { user_id: "u1", email: "agent@example.com", is_nevermore: false },
      { user_id: null, email: null, is_nevermore: true },
    ]);
    api.listFirmActivity.mockResolvedValue({
      entries: [entry({ entry_key: "k8", kind: "firm_approved", record_type: "firm", record_id: "firm-1", actor_id: null, actor_email: null, by_nevermore: true })],
      hasMore: false,
    });
    renderPage();
    const row = within(await screen.findByRole("table")).getAllByRole("row")[1];
    expect(within(row).getAllByRole("cell")[1].textContent).toBe("Nevermore");
    expect(within(row).getAllByRole("cell")[1].textContent).not.toBe("System");
    const person = await screen.findByLabelText("Person");
    expect(within(person).getAllByRole("option").map((o) => o.textContent)).toEqual(["Everyone", "agent@example.com", "Nevermore"]);
    fireEvent.change(person, { target: { value: NEVERMORE_FILTER } });
    await waitFor(() => expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: NEVERMORE_FILTER, kind: null, after: null }));
  });

  // Suspending a firm and lifting the suspension (story CRM-P1.8) are in the firm's record, shown as done by Nevermore.
  it("names a suspension and the lifting of one in words, as done by Nevermore", async () => {
    api.listFirmActivity.mockResolvedValue({
      entries: [
        entry({ entry_key: "k9", kind: "firm_restored", record_type: "firm", record_id: "firm-1", actor_id: null, actor_email: null, by_nevermore: true }),
        entry({ entry_key: "k10", kind: "firm_suspended", record_type: "firm", record_id: "firm-1", actor_id: null, actor_email: null, by_nevermore: true }),
      ],
      hasMore: false,
    });
    renderPage();
    const rows = within(await screen.findByRole("table")).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Lifted the firm's suspension");
    expect(rows[2]).toHaveTextContent("Suspended the firm");
    expect(within(rows[1]).getAllByRole("cell")[1].textContent).toBe("Nevermore");
    expect(within(rows[2]).getAllByRole("cell")[1].textContent).toBe("Nevermore");
  });

  it("asks which firms the person owns again when the sign-in changes, such as after the second factor", async () => {
    api.fetchOwnedFirms.mockResolvedValueOnce([]).mockResolvedValue([{ firm_id: "firm-1", name: "Alpha Advisory" }]);
    const view = renderPage();
    expect(await screen.findByText("Only a firm's owners can read its record of who did what.")).toBeInTheDocument();
    auth.session = { access_token: "tok-2" };
    view.rerender(<MemoryRouter initialEntries={["/advisor/activity"]}><AdvisorActivityPage /></MemoryRouter>);
    expect(await screen.findByRole("table", { name: "Who did what" })).toBeInTheDocument();
    expect(api.fetchOwnedFirms).toHaveBeenCalledTimes(2);
  });

  it("sits inside the workspace menu, under Settings, which links to it for an owner", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/advisor/activity"]}>
          <Routes>
            <Route element={<WorkspaceShell />}>
              <Route path="/advisor/activity" element={<AdvisorActivityPage />} />
              <Route path="/settings" element={<AdvisorSettingsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByRole("table");
    const nav = screen.getByRole("navigation", { name: "Workspace" });
    expect(within(nav).getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(within(nav).getByRole("link", { name: "Settings" }));
    expect(await screen.findByRole("link", { name: /Activity/ })).toHaveAttribute("href", "/advisor/activity");
  });

  it("shows the role an invitation offered or withdrew, and for staff still only Nevermore", async () => {
    api.listFirmActivity.mockResolvedValue({
      entries: [
        entry({ entry_key: "k7", kind: "invitation_withdrawn", record_type: "firm", record_id: "firm-1", role: "agent" }),
        entry({ entry_key: "k6", kind: "invitation_sent", record_type: "firm", record_id: "firm-1", role: "lead" }),
        entry({ entry_key: "k5", kind: "firm_approved", record_type: "firm", record_id: "firm-1", actor_id: null, actor_email: null, by_nevermore: true }),
      ],
      hasMore: false,
    });
    renderPage();
    const rows = within(await screen.findByRole("table")).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Withdrew an invitation");
    expect(rows[0]).toHaveTextContent("as agent");
    expect(rows[1]).toHaveTextContent("Sent an invitation");
    expect(rows[1]).toHaveTextContent("as lead");
    expect(rows[2]).not.toHaveTextContent(" as ");
    expect(within(rows[2]).getAllByRole("cell")[1].textContent).toBe("Nevermore");
  });

  it("shows an invitation entry written before roles were recorded without a role, never as 'as null'", async () => {
    api.listFirmActivity.mockResolvedValue({
      entries: [entry({ entry_key: "k8", kind: "invitation_sent", record_type: "firm", record_id: "firm-1", role: null })],
      hasMore: false,
    });
    renderPage();
    const row = within(await screen.findByRole("table")).getAllByRole("row")[1];
    expect(row).toHaveTextContent("Sent an invitation");
    expect(row.textContent).not.toMatch(/ as |null/);
  });

  it("names the person a membership change was about and their role, and never shows a missing person as blank", async () => {
    api.listFirmActivity.mockResolvedValue({
      entries: [
        entry({ entry_key: "k5", kind: "member_added", record_type: "membership", record_id: "7", subject_user_id: "u2", subject_email: "lead@example.com", role: "lead" }),
        entry({ entry_key: "k4", kind: "export_made", record_type: "firm", record_id: "firm-1", actor_id: null, actor_email: null }),
        entry({ entry_key: "k3", kind: "member_ended", record_type: "membership", record_id: "6", actor_id: "gone", actor_email: null, subject_user_id: "gone2", subject_email: null, role: "agent" }),
      ],
      hasMore: false,
    });
    renderPage();
    const rows = within(await screen.findByRole("table")).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Added a member");
    expect(rows[0]).toHaveTextContent("lead@example.com (lead)");
    const whoOf = (row: HTMLElement) => within(row).getAllByRole("cell")[1].textContent;
    expect(whoOf(rows[0])).toBe("agent@example.com");
    expect(whoOf(rows[1])).toBe("System");
    expect(whoOf(rows[2])).toBe("A former member");
    expect(rows[2]).toHaveTextContent("A former member (agent)");
  });

  it("filters by person, offering the people who appear in the record, and shows what the database returns", async () => {
    renderPage();
    const person = await screen.findByLabelText("Person");
    expect(within(person).getAllByRole("option").map((o) => o.textContent)).toEqual(["Everyone", "agent@example.com", "lead@example.com"]);
    api.listFirmActivity.mockResolvedValue({ entries: [entry({ entry_key: "k9", actor_email: "lead@example.com", kind: "send_recorded" })], hasMore: false });
    fireEvent.change(person, { target: { value: "u2" } });
    await waitFor(() => expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: "u2", kind: null, after: null }));
    expect(await within(await screen.findByRole("table")).findByText("Recorded a send")).toBeInTheDocument();
  });

  it("filters by kind, offering every kind by its name", async () => {
    renderPage();
    const kind = await screen.findByLabelText("Kind");
    const options = within(kind).getAllByRole("option").map((o) => o.textContent);
    expect(options).toHaveLength(30);
    expect(options.slice(0, 3)).toEqual(["Every kind", "Signed in", "Opened a submission"]);
    // Removing, suspending and lifting a suspension (CRM-P1.5) are read by name, not as the database wrote them.
    expect(options).toEqual(expect.arrayContaining(["Removed a member", "Suspended a member", "Lifted a member's suspension", "Left the firm", "Listed an organisation", "Removed an organisation", "Asked to join", "Asked to close the firm", "Withdrew the request to close the firm", "Nevermore stopped the request to close the firm", "Declined a request to join"]));
    fireEvent.change(kind, { target: { value: "packet_downloaded" } });
    await waitFor(() => expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: null, kind: "packet_downloaded", after: null }));
  });

  it("says when no entry matches the filters, and leaves the filters in place to change", async () => {
    renderPage();
    const kind = await screen.findByLabelText("Kind");
    api.listFirmActivity.mockResolvedValue({ entries: [], hasMore: false });
    fireEvent.change(kind, { target: { value: "export_made" } });
    expect(await screen.findByText("No entries match these filters.")).toBeInTheDocument();
    expect(screen.queryByText(/Nothing has been recorded/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Kind")).toHaveValue("export_made");
  });

  it("pages through the record by where the last entry seen was, and goes back to the first page when a filter changes", async () => {
    // Two pages: the first has another after it, the second has none.
    const first = entry({ entry_key: "k30", at: "2026-11-12T12:00:00Z" });
    api.listFirmActivity.mockImplementation(async (_firm: string, o: { after: { key: string } | null }) =>
      o.after ? { entries: [entry({ entry_key: "k20", at: "2026-11-12T11:00:00Z" })], hasMore: false } : { entries: [first], hasMore: true });
    renderPage();
    await screen.findByRole("table");
    expect(screen.getByRole("button", { name: "Newer" })).toBeDisabled();
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Older" }));
    await screen.findByText("Page 2");
    expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: null, kind: null, after: { at: "2026-11-12T12:00:00Z", key: "k30" } });
    expect(screen.getByRole("button", { name: "Older" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Newer" }));
    await screen.findByText("Page 1");
    expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: null, kind: null, after: null });
    fireEvent.click(screen.getByRole("button", { name: "Older" }));
    await screen.findByText("Page 2");
    fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "sign_in" } });
    await screen.findByText("Page 1");
    expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: null, kind: "sign_in", after: null });
    fireEvent.click(screen.getByRole("button", { name: "Older" }));
    await screen.findByText("Page 2");
    fireEvent.change(screen.getByLabelText("Person"), { target: { value: "u2" } });
    await screen.findByText("Page 1");
    expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: "u2", kind: "sign_in", after: null });
  });

  describe("an owner of more than one firm", () => {
    const firms = [{ firm_id: "firm-1", name: "Alpha Advisory" }, { firm_id: "firm-2", name: "Beta Brokers" }];
    beforeEach(() => api.fetchOwnedFirms.mockResolvedValue(firms));

    it("is asked which firm, and nothing is read until they say", async () => {
      renderPage();
      const picker = await screen.findByLabelText("Firm");
      expect(within(picker).getAllByRole("option").map((o) => o.textContent)).toEqual(["Choose a firm", "Alpha Advisory", "Beta Brokers"]);
      expect(api.listFirmActivity).not.toHaveBeenCalled();
      expect(api.listFirmActivityPeople).not.toHaveBeenCalled();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("reads the firm they choose, and can switch to the other one, starting again from the newest", async () => {
      renderPage();
      fireEvent.change(await screen.findByLabelText("Firm"), { target: { value: "firm-2" } });
      await screen.findByRole("table");
      expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-2", { person: null, kind: null, after: null });
      expect(api.listFirmActivityPeople).toHaveBeenLastCalledWith("firm-2");
      fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "sign_in" } });
      await waitFor(() => expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-2", { person: null, kind: "sign_in", after: null }));
      fireEvent.change(screen.getByLabelText("Firm"), { target: { value: "firm-1" } });
      await waitFor(() => expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: null, kind: null, after: null }));
      expect(screen.getByLabelText("Kind")).toHaveValue("");
    });

    it("reads the firm the address names, which is how the firm's own address will say it", async () => {
      renderPage("/advisor/activity?firm=firm-2");
      await screen.findByRole("table");
      expect(api.listFirmActivity).toHaveBeenCalledWith("firm-2", { person: null, kind: null, after: null });
      expect(screen.getByLabelText("Firm")).toHaveValue("firm-2");
    });

    describe("at a firm's own address", () => {
      const mine = [
        { firm_id: "firm-1", name: "Alpha Advisory", address: "alpha", role: "owner" },
        { firm_id: "firm-2", name: "Beta Brokers", address: "beta", role: "owner" },
      ];
      beforeEach(() => {
        api.fetchMyFirms.mockResolvedValue(mine);
        firmAddress = { status: "known", address: "beta", name: "Beta Brokers" };
      });

      it("reads the address's firm and asks which firm of no one: the address chooses", async () => {
        renderPage();
        await screen.findByRole("table");
        expect(api.listFirmActivity).toHaveBeenCalledWith("firm-2", { person: null, kind: null, after: null });
        expect(api.listFirmActivity).not.toHaveBeenCalledWith("firm-1", expect.anything());
      });

      it("reads the address's firm whichever firm the link names", async () => {
        renderPage("/advisor/activity?firm=firm-1");
        await screen.findByRole("table");
        expect(api.listFirmActivity).toHaveBeenCalledWith("firm-2", { person: null, kind: null, after: null });
        expect(api.listFirmActivity).not.toHaveBeenCalledWith("firm-1", expect.anything());
      });

      it("shows no firm selector, so no choice can name a firm other than the one whose records are shown, and names the address's firm", async () => {
        renderPage("/advisor/activity?firm=firm-1");
        await screen.findByRole("table");
        expect(screen.queryByLabelText("Firm")).not.toBeInTheDocument();
        expect(within(screen.getByRole("main")).getByText("Beta Brokers")).toBeInTheDocument();
        expect(screen.queryByText("Alpha Advisory")).not.toBeInTheDocument();
      });

      it("reads nothing at an address of a firm the person doesn't belong to at all, whatever other firm they own", async () => {
        api.fetchOwnedFirms.mockResolvedValue([firms[0]]);
        api.fetchMyFirms.mockResolvedValue([mine[0]]);
        renderPage("/advisor/activity?firm=firm-1");
        expect(await screen.findByText("Only a firm's owners can read its record of who did what.")).toBeInTheDocument();
        expect(api.listFirmActivity).not.toHaveBeenCalled();
      });

      it("reads nothing of a firm at an address the person doesn't own: an owner of another firm only is told it is for owners", async () => {
        api.fetchOwnedFirms.mockResolvedValue([firms[0]]);
        api.fetchMyFirms.mockResolvedValue([mine[0], { ...mine[1], role: "agent" }]);
        renderPage();
        expect(await screen.findByText("Only a firm's owners can read its record of who did what.")).toBeInTheDocument();
        expect(api.listFirmActivity).not.toHaveBeenCalled();
      });
    });

    it("is told it is for owners when the address names a firm they don't own, and nothing is read", async () => {
      renderPage("/advisor/activity?firm=firm-9");
      expect(await screen.findByText("Only a firm's owners can read its record of who did what.")).toBeInTheDocument();
      expect(api.listFirmActivity).not.toHaveBeenCalled();
    });
  });

  it("shows no firm picker to an owner of one firm", async () => {
    renderPage();
    await screen.findByRole("table");
    expect(screen.queryByLabelText("Firm")).not.toBeInTheDocument();
  });

  it("keeps showing the entries while a changed filter loads, rather than blanking the page", async () => {
    renderPage();
    const kind = await screen.findByLabelText("Kind");
    api.listFirmActivity.mockReturnValue(new Promise(() => undefined));
    fireEvent.change(kind, { target: { value: "sign_in" } });
    await waitFor(() => expect(api.listFirmActivity).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a kind this version doesn't know as the database wrote it, not as a blank", async () => {
    api.listFirmActivity.mockResolvedValue({ entries: [entry({ kind: "something_new", record_type: "report", record_id: "r1" })], hasMore: false });
    renderPage();
    const row = within(await screen.findByRole("table")).getAllByRole("row")[1];
    expect(within(row).getAllByRole("cell")[2]).toHaveTextContent("something_new");
    expect(row).toHaveTextContent("report r1");
  });

  // Help from Nevermore (story CRM-P2.4, D-33).
  // Catches: the owners see a use of support without its reason or its times, see it under a name or an email, or the end of a use reads as a start.
  it("shows each use of Nevermore support as Nevermore, with the reason and when it started and ended", async () => {
    api.listFirmActivity.mockResolvedValue({
      entries: [
        entry({ entry_key: "e2", at: "2026-11-12T16:00:00Z", actor_id: null, actor_email: null, by_nevermore: true, kind: "support_access", record_type: "support_session_end", record_id: "s1" }),
        entry({ entry_key: "e1", at: "2026-11-12T15:00:00Z", actor_id: null, actor_email: null, by_nevermore: true, kind: "support_access", record_type: "support_session", record_id: "s1" }),
      ],
      hasMore: false,
    });
    supportApi.fetchFirmSupportUses.mockResolvedValue([{ id: "s1", reason: "Customer asked about a stuck quote", startedAt: "2026-11-12T15:00:00Z", endsAt: "2026-11-12T16:00:00Z", endedAt: "2026-11-12T16:00:00Z" }]);
    renderPage();
    const rows = within(await screen.findByRole("table", { name: "Who did what" })).getAllByRole("row").slice(1);
    expect(rows[1]).toHaveTextContent("Nevermore");
    expect(rows[1]).toHaveTextContent("Nevermore support opened your firm's console");
    expect(rows[1]).toHaveTextContent("Reason: Customer asked about a stuck quote");
    expect(rows[0]).toHaveTextContent("Nevermore");
    expect(rows[0]).toHaveTextContent("Nevermore support's access ended");
    expect(rows[0]).toHaveTextContent("Reason: Customer asked about a stuck quote");
    expect(supportApi.fetchFirmSupportUses).toHaveBeenCalledWith("firm-1");
  });

  // Catches: Nevermore support, which is no owner, is told "only owners" and cannot read the record the story promised it.
  it("lets a support session read the record at the firm's address, as an owner does", async () => {
    firmAddress = { status: "known", address: "alpha", name: "Alpha Advisory" };
    api.fetchMyFirms.mockResolvedValue([]);
    supportApi.fetchMySupportSessionHere.mockResolvedValue({ id: "s1", firmId: "firm-1", firmName: "Alpha Advisory", firmAddress: "alpha", endsAt: "2999-01-01T00:00:00Z", endedAt: null, isOpen: true, secondFactorPending: false });
    api.fetchOwnedFirms.mockResolvedValue([]);
    const original = window.location;
    Object.defineProperty(window, "location", { value: { ...original, hostname: "alpha.localhost" }, configurable: true });
    try {
      renderPage();
      expect(await screen.findByRole("table", { name: "Who did what" })).toBeInTheDocument();
      expect(api.listFirmActivity).toHaveBeenCalledWith("firm-1", { person: null, kind: null, after: null });
    } finally {
      Object.defineProperty(window, "location", { value: original, configurable: true });
    }
  });

  describe("what an export in the record says (story CRM-S3.8a)", () => {
    const made = (table: string, count: number | null) => entry({ kind: "export_made", record_type: "table", record_id: table, row_count: count });
    const recordOf = async (e: ReturnType<typeof entry>) => {
      api.listFirmActivity.mockResolvedValue({ entries: [e], hasMore: false });
      renderPage();
      const table = await screen.findByRole("table", { name: "Who did what" });
      return within(table).getAllByRole("row")[1];
    };

    it("reads as how many rows of what were taken, not as a table's code name", async () => {
      const row = await recordOf(made("referral_partners", 42));
      expect(row).toHaveTextContent("Exported records");
      expect(row).toHaveTextContent("Exported 42 referral partners");
      expect(row).not.toHaveTextContent("Table referral_partners");
    });

    it("says one in the singular", async () => {
      expect(await recordOf(made("referral_partners", 1))).toHaveTextContent(/Exported 1 referral partner$/);
    });

    it("puts a thousand as 1,000", async () => {
      expect(await recordOf(made("referral_partners", 1000))).toHaveTextContent("Exported 1,000 referral partners");
    });

    it("names the firm's own record as what was taken", async () => {
      expect(await recordOf(made("firm_activity", 1200))).toHaveTextContent("Exported 1,200 entries in the firm's record");
    });

    it("still reads as a sentence for a table a later version adds, as the database named it", async () => {
      expect(await recordOf(made("quotes", 3))).toHaveTextContent("Exported 3 rows of quotes");
    });

    // CRM-A1.1b: the accounts table is one the database exports, so its entry reads in the accounts' own words.
    it("reads an export of accounts in the accounts' own words", async () => {
      expect(await recordOf(made("accounts", 3))).toHaveTextContent("Exported 3 accounts");
    });

    it("leaves any other table entry as it was when it holds no count", async () => {
      expect(await recordOf(made("referral_partners", null))).toHaveTextContent("Table referral_partners");
    });
  });

  describe("the Export button (story CRM-S3.8a)", () => {
    // The database's columns: the page shows four of them, and words two (the kind and the record).
    const COLUMNS = [
      { id: "at", label: "When" }, { id: "who", label: "Who" }, { id: "kind", label: "What" }, { id: "record_type", label: "Record type" },
      { id: "record_id", label: "Record" }, { id: "subject", label: "About" }, { id: "role", label: "Role" }, { id: "row_count", label: "Rows" },
    ];
    const answer = (rows: Record<string, string | number | null>[], over: Record<string, unknown> = {}) => ({
      table: "firm_activity", label: "The firm's record", columns: COLUMNS, rows, count: rows.length, skipped: 0, exportedAt: "2026-11-19T10:00:00+00:00", ...over,
    });
    const line = (over: Record<string, string | number | null> = {}) => ({
      at: "2026-11-19T09:00:00+00:00", who: "agent@example.com", kind: "sign_in", record_type: "firm", record_id: "firm-1", subject: null, role: null, row_count: null, ...over,
    });
    const exportButton = () => screen.findByRole("button", { name: "Export" });
    const theFile = async () => {
      expect(downloadBlob).toHaveBeenCalledTimes(1);
      const [blob, name] = downloadBlob.mock.calls[0] as [Blob, string];
      return { name, text: await blobText(blob), bytes: await blobBytes(blob) };
    };
    const HEAD = "When,Who,What,Record";
    const tooOld = () => new ExportError("signInAgain", "Sign in again to export a whole table.");

    it("downloads a CSV of the whole record with the columns the page shows, kinds and records in its words, named for the table and the day", async () => {
      exportRows.mockResolvedValue(answer([
        line(),
        line({ who: "Nevermore", kind: "export_made", record_type: "table", record_id: "referral_partners", row_count: 42 }),
        line({ kind: "member_added", record_type: "membership", record_id: "m1", subject: "-Dana \"D\", Esq.", role: "agent" }),
      ]));
      renderPage();
      fireEvent.click(await exportButton());
      expect(await screen.findByText("Exported 3 entries in the firm's record.")).toBeInTheDocument();
      expect(exportRows).toHaveBeenCalledWith({ firmId: "firm-1", table: "firm_activity", filters: {} });
      const { name, text } = await theFile();
      expect(name).toBe("firm-record-2026-11-19.csv");
      // What and Record are worded as the page words them, never as the codes sign_in, table and referral_partners; the columns the page does not show
      // (the record's type and the role) stay out. A subject that starts with a minus would run as a formula; one with quotes and a comma is quoted.
      expect(text).toBe(
        `${HEAD}\r\n` +
        "2026-11-19T09:00:00+00:00,agent@example.com,Signed in,Firm firm-1\r\n" +
        "2026-11-19T09:00:00+00:00,Nevermore,Exported records,Exported 42 referral partners\r\n" +
        `2026-11-19T09:00:00+00:00,agent@example.com,Added a member,"Membership m1 · -Dana ""D"", Esq. (agent)"\r\n`,
      );
    });

    it("words a use of Nevermore support as the page does, with the reason and the times", async () => {
      supportApi.fetchFirmSupportUses.mockResolvedValue([{ id: "s1", reason: "Customer asked about a stuck quote", startedAt: "2026-11-12T15:00:00Z", endsAt: "2026-11-12T16:00:00Z", endedAt: null }]);
      exportRows.mockResolvedValue(answer([line({ who: "Nevermore", kind: "support_access", record_type: "support_session", record_id: "s1" })]));
      renderPage();
      fireEvent.click(await exportButton());
      await screen.findByText("Exported 1 entry in the firm's record.");
      const { text } = await theFile();
      expect(text).toContain("Nevermore support opened your firm's console");
      expect(text).toContain("Reason: Customer asked about a stuck quote");
      expect(text).not.toContain("support_session");
    });

    it("starts the file with a byte order mark", async () => {
      exportRows.mockResolvedValue(answer([line()]));
      renderPage();
      fireEvent.click(await exportButton());
      await screen.findByText("Exported 1 entry in the firm's record.");
      expect([...(await theFile()).bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    });

    it("takes the rows that match the person and the kind the page is filtered by", async () => {
      exportRows.mockResolvedValue(answer([line()]));
      renderPage();
      fireEvent.change(await screen.findByLabelText("Person"), { target: { value: "u2" } });
      await waitFor(() => expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: "u2", kind: null, after: null }));
      fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "send_recorded" } });
      await waitFor(() => expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: "u2", kind: "send_recorded", after: null }));
      await screen.findByRole("table", { name: "Who did what" });
      fireEvent.click(await exportButton());
      await screen.findByText("Exported 1 entry in the firm's record.");
      expect(exportRows).toHaveBeenCalledWith({ firmId: "firm-1", table: "firm_activity", filters: { person: "u2", kind: "send_recorded" } });
    });

    it("names Nevermore's people as the database's filter does, and sends nothing for a filter left alone", async () => {
      exportRows.mockResolvedValue(answer([line()]));
      api.listFirmActivityPeople.mockResolvedValue([{ user_id: null, email: null, is_nevermore: true }]);
      renderPage();
      fireEvent.change(await screen.findByLabelText("Person"), { target: { value: NEVERMORE_FILTER } });
      await waitFor(() => expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: NEVERMORE_FILTER, kind: null, after: null }));
      await screen.findByRole("table", { name: "Who did what" });
      fireEvent.click(await exportButton());
      await screen.findByText("Exported 1 entry in the firm's record.");
      expect(exportRows).toHaveBeenCalledWith({ firmId: "firm-1", table: "firm_activity", filters: { person: "nevermore" } });
    });

    it("exports the firm the owner chose, not the first of several", async () => {
      api.fetchOwnedFirms.mockResolvedValue([{ firm_id: "firm-1", name: "Alpha Advisory" }, { firm_id: "firm-2", name: "Beta Brokers" }]);
      exportRows.mockResolvedValue(answer([line()]));
      renderPage("/advisor/activity?firm=firm-2");
      fireEvent.click(await exportButton());
      await screen.findByText("Exported 1 entry in the firm's record.");
      expect(exportRows).toHaveBeenCalledWith({ firmId: "firm-2", table: "firm_activity", filters: {} });
    });

    it("says nothing matched when the database gave no row, and still gives the file with its headings", async () => {
      exportRows.mockResolvedValue(answer([]));
      renderPage();
      fireEvent.click(await exportButton());
      expect(await screen.findByText("Nothing matched, so the file holds only the headings.")).toBeInTheDocument();
      expect((await theFile()).text).toBe(`${HEAD}\r\n`);
    });

    describe("when the last sign-in is too old for a whole record (PT401)", () => {
      it("steps up in place with the authenticator's code and exports again with the filters the page still has", async () => {
        mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: "factor-1" }], all: [] }, error: null });
        mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
        exportRows.mockRejectedValueOnce(tooOld());
        exportRows.mockResolvedValue(answer([line()]));
        renderPage();
        fireEvent.change(await screen.findByLabelText("Person"), { target: { value: "u2" } });
        await waitFor(() => expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: "u2", kind: null, after: null }));
        fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "send_recorded" } });
        await waitFor(() => expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: "u2", kind: "send_recorded", after: null }));
        await screen.findByRole("table", { name: "Who did what" });
        fireEvent.click(await exportButton());
        const dialog = await screen.findByRole("dialog");
        fireEvent.change(within(dialog).getByLabelText(/6-digit code/), { target: { value: "123456" } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Confirm and export" }));
        expect(await screen.findByText("Exported 1 entry in the firm's record.")).toBeInTheDocument();
        // Not the whole record: the second export asks for exactly what the first did, and the page's filters are still set.
        expect(exportRows).toHaveBeenCalledTimes(2);
        expect(exportRows).toHaveBeenLastCalledWith({ firmId: "firm-1", table: "firm_activity", filters: { person: "u2", kind: "send_recorded" } });
        expect(screen.getByLabelText("Person")).toHaveValue("u2");
        expect(screen.getByLabelText("Kind")).toHaveValue("send_recorded");
        expect(auth.signOut).not.toHaveBeenCalled();
      });

      it.each([["Google", ["google"]], ["a password", ["email"]]])("keeps the page's filters in the address when a person with no authenticator, who signed in with %s, must sign in again, and reads them back from it", async (_, providers) => {
        auth.user = { id: "u1", email: "owner@example.com", app_metadata: { providers } };
        const lead = "5f1c2a9e-0000-4000-8000-000000000002";
        api.listFirmActivityPeople.mockResolvedValue([{ user_id: lead, email: "lead@example.com", is_nevermore: false }]);
        exportRows.mockRejectedValue(tooOld());
        const Where = () => <p data-testid="where">{useLocation().search}</p>;
        render(<MemoryRouter initialEntries={["/advisor/activity"]}><AdvisorActivityPage /><Where /></MemoryRouter>);
        fireEvent.change(await screen.findByLabelText("Person"), { target: { value: lead } });
        fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "send_recorded" } });
        await waitFor(() => expect(api.listFirmActivity).toHaveBeenLastCalledWith("firm-1", { person: lead, kind: "send_recorded", after: null }));
        await screen.findByRole("table", { name: "Who did what" });
        fireEvent.click(await exportButton());
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "Sign in again" }));
        expect(auth.signOut).toHaveBeenCalledWith("step_up");
        const search = new URLSearchParams(screen.getByTestId("where").textContent ?? "");
        expect(search.get("person")).toBe(lead);
        expect(search.get("kind")).toBe("send_recorded");
        // Back from signing in, the page opens on the address it was left at, with the same filters, and then keeps them in its own state only.
        cleanup();
        api.listFirmActivity.mockClear();
        render(<MemoryRouter initialEntries={[`/advisor/activity?${search.toString()}`]}><AdvisorActivityPage /><Where /></MemoryRouter>);
        await waitFor(() => expect(api.listFirmActivity).toHaveBeenCalledWith("firm-1", { person: lead, kind: "send_recorded", after: null }));
        expect(await screen.findByLabelText("Person")).toHaveValue(lead);
        expect(screen.getByLabelText("Kind")).toHaveValue("send_recorded");
        await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/^$/));
      });

      it("ignores a person or a kind in the address that is none the record knows", async () => {
        renderPage("/advisor/activity?person=not-a-person&kind=made_up");
        await screen.findByRole("table", { name: "Who did what" });
        expect(api.listFirmActivity).toHaveBeenCalledWith("firm-1", { person: null, kind: null, after: null });
      });
    });

    it("tells a record too large for one file to be narrowed, and gives no file", async () => {
      exportRows.mockRejectedValue(new ExportError("tooMany", "That is more than 50,000 rows. Narrow it with a filter and export again."));
      renderPage();
      fireEvent.click(await exportButton());
      expect(await screen.findByRole("alert")).toHaveTextContent("Narrow it with a filter");
      expect(downloadBlob).not.toHaveBeenCalled();
    });

    it("is not offered while the record loads, when nothing is in it, or to someone who may not read it", async () => {
      api.listFirmActivity.mockReturnValue(new Promise(() => {}));
      renderPage();
      await screen.findByLabelText("Kind");
      expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
      cleanup();
      api.listFirmActivity.mockResolvedValue({ entries: [], hasMore: false });
      renderPage();
      await screen.findByText(/Nothing has been recorded/);
      expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
      cleanup();
      clearOwnedFirms();
      clearMyFirms();
      api.fetchOwnedFirms.mockResolvedValue([]);
      renderPage();
      await screen.findByText("Only a firm's owners can read its record of who did what.");
      expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
    });

    it("offers no download to Nevermore support, says so in one plain line, and asks the database for nothing", async () => {
      const support = { firm: null, role: "Nevermore support" as const, isOwner: false, isSupport: true, supportEndsAt: null, supportSessionId: null, isPlatformAdmin: true, person: "x" };
      render(<MemoryRouter initialEntries={["/advisor/activity"]}><WorkspaceContext.Provider value={support}><AdvisorActivityPage /></WorkspaceContext.Provider></MemoryRouter>);
      await screen.findByRole("table", { name: "Who did what" });
      expect(screen.queryByRole("button", { name: /Export/ })).not.toBeInTheDocument();
      expect(screen.getByText("Downloads are off during Nevermore support.")).toBeInTheDocument();
      expect(exportRows).not.toHaveBeenCalled();
    });
  });
});
