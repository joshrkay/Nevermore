import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blobBytes } from "@/test/blob";

// The Export button on the firm's record of who did what (story CRM-S3.8a; docs/BROKER_CRM_BUILD.md D-48, D-209, D-210), for its owners. The
// database's call, export_table, is faked (supabase/tests/export.sql tests it): these tests prove what the page asks of it and what it does with the
// answer. The record is read through the same fakes as AdvisorActivityPage.test.tsx.
const auth = { user: { id: "u1", email: "owner@example.com" }, session: { access_token: "tok-1" }, signOut: vi.fn() };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const api = { fetchOwnedFirms: vi.fn(), fetchMyFirms: vi.fn(), fetchIsAdmin: vi.fn(), listFirmActivityPeople: vi.fn(), listFirmActivity: vi.fn() };
vi.mock("@/lib/advisorApi", async () => ({ ...(await vi.importActual<object>("@/lib/advisorApi")), ...api, FIRM_ACTIVITY_PAGE_SIZE: 25 }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const supportApi = { fetchFirmSupportUses: vi.fn(), fetchMySupportSessionHere: vi.fn() };
vi.mock("@/lib/supportApi", async () => ({ ...(await vi.importActual<object>("@/lib/supportApi")), ...supportApi }));
let firmAddress: { status: "none" } | { status: "known"; address: string; name: string } = { status: "none" };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firmAddress }));
const exportTable = vi.fn();
vi.mock("@/lib/exportApi", async () => ({ ...(await vi.importActual<object>("@/lib/exportApi")), exportTable: (...args: unknown[]) => exportTable(...args) }));

const { clearOwnedFirms, clearMyFirms } = await import("@/hooks/useOwnedFirms");
const { default: AdvisorActivityPage } = await import("./AdvisorActivityPage");
const { NEVERMORE_FILTER } = await import("@/lib/advisorApi");
const { ExportRefusal } = await import("@/lib/exportApi");

const renderPage = (at = "/advisor/activity") => render(<MemoryRouter initialEntries={[at]}><AdvisorActivityPage /></MemoryRouter>);
const entry = (over: Record<string, unknown> = {}) => ({
  entry_key: "k1", at: "2026-11-12T15:30:00Z", actor_id: "u1", actor_email: "agent@example.com", kind: "submission_viewed",
  record_type: "submission", record_id: "0b5c1f2e-1111-4222-8333-444455556666", subject_user_id: null, subject_email: null, role: null,
  by_nevermore: false, row_count: null, ...over,
});

let saved: { blob: Blob; name: string }[] = [];
let lastBlob: Blob | null = null;
const COLUMNS = ["at", "who", "kind", "record_type", "record_id", "subject", "role", "rows"];
/** The database's answer to export_table for the firm's record. */
const answer = (rows: (string | number | null)[][], over: Record<string, unknown> = {}) => ({
  table: "firm_activity", columns: COLUMNS, rows, rowCount: rows.length, wholeTable: false, exportedAt: "2026-03-02T12:00:00.000Z", ...over,
});
const fileText = async (blob: Blob) => {
  const bytes = await blobBytes(blob);
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  return { bom, text: new TextDecoder("utf-8").decode(bom ? bytes.slice(3) : bytes) };
};
const ready = async () => {
  renderPage();
  await screen.findByRole("table", { name: "Who did what" });
  await screen.findByText("agent@example.com", { selector: "td" });
  return userEvent.setup();
};

describe("AdvisorActivityPage: Export (CRM-S3.8a)", () => {
  beforeEach(() => {
    clearOwnedFirms();
    clearMyFirms();
    firmAddress = { status: "none" };
    for (const fn of Object.values(api)) fn.mockReset();
    auth.signOut.mockReset();
    exportTable.mockReset();
    supportApi.fetchFirmSupportUses.mockReset().mockResolvedValue([]);
    supportApi.fetchMySupportSessionHere.mockReset().mockResolvedValue(null);
    api.fetchMyFirms.mockResolvedValue([{ firm_id: "firm-1", name: "Alpha Advisory", address: "alpha", role: "owner" }]);
    api.fetchIsAdmin.mockResolvedValue(false);
    api.fetchOwnedFirms.mockResolvedValue([{ firm_id: "firm-1", name: "Alpha Advisory" }]);
    api.listFirmActivityPeople.mockResolvedValue([
      { user_id: "u1", email: "agent@example.com", is_nevermore: false },
      { user_id: "u2", email: "lead@example.com", is_nevermore: false },
    ]);
    api.listFirmActivity.mockResolvedValue({ entries: [entry()], hasMore: false });
    saved = [];
    lastBlob = null;
    URL.createObjectURL = vi.fn((blob: Blob) => { lastBlob = blob; return "blob:csv"; });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      saved.push({ blob: lastBlob as Blob, name: this.download });
    });
  });
  afterEach(() => vi.restoreAllMocks());

  // Catches: a CSV of the 25 entries on screen instead of every entry the database holds for the filters; the page's cursor (which page the reader is
  // on) sent as though it narrowed the export; columns in another order than the page's, or its header words changed; a kind or a record type left as
  // the database's code where the page says it in words; a person who has left shown as an empty cell where the page says "A former member".
  it("saves a CSV of every entry the database returns, in the columns the page shows in the order it shows them, whichever page the reader is on", async () => {
    api.listFirmActivity.mockResolvedValueOnce({ entries: [entry()], hasMore: true }).mockResolvedValue({ entries: [entry({ entry_key: "k2" })], hasMore: false });
    exportTable.mockResolvedValue(answer([
      ["2026-11-12T16:00:00.000Z", "lead@example.com", "send_recorded", "quote_request", "42", null, null, null],
      ["2026-11-12T15:30:00.000Z", "Nevermore", "support_access", "support_session", "s-1", null, null, null],
      ["2026-11-12T15:00:00.000Z", null, "member_added", "membership", "m-1", "new@example.com", "agent", null],
      ["2026-11-12T14:00:00.000Z", "owner@example.com", "export_made", "table", "referral_partners", null, null, 12],
    ], { rowCount: 40 }));
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Older" }));
    await screen.findByText("Page 2");
    await user.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(saved).toHaveLength(1));

    expect(exportTable).toHaveBeenCalledTimes(1);
    expect(exportTable).toHaveBeenCalledWith("firm-1", "firm_activity", COLUMNS, { filters: [], timeZone: expect.any(String) });
    // No selection is sent at all, never an empty one (D-212).
    expect(exportTable.mock.calls[0][3]).not.toHaveProperty("keys");
    const file = await fileText(saved[0].blob);
    expect(file.bom).toBe(true);
    expect(file.text).toBe(
      "When,Who,What,Kind of record,Record,Person it was about,Role,Rows\r\n" +
      "2026-11-12T16:00:00.000Z,lead@example.com,Recorded a send,Quote request,42,,,\r\n" +
      "2026-11-12T15:30:00.000Z,Nevermore,Nevermore support opened your firm's console,Support session,s-1,,,\r\n" +
      "2026-11-12T15:00:00.000Z,A former member,Added a member,Membership,m-1,new@example.com,agent,\r\n" +
      "2026-11-12T14:00:00.000Z,owner@example.com,Exported records,Table,referral_partners,,,12\r\n",
    );
    expect(saved[0].name).toBe("who-did-what-2026-03-02.csv");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Exported 40 entries."));
  });

  // Catches: the button offered to a lead or an agent (the record is for owners, D-48), whether by the page showing the table to them or by the
  // button standing outside it; and the database refused them all the same, so nothing is exported.
  it("is never offered to a member who is not an owner, and nothing is asked of the database", async () => {
    api.fetchOwnedFirms.mockResolvedValue([]);
    api.fetchMyFirms.mockResolvedValue([{ firm_id: "firm-1", name: "Alpha Advisory", address: "alpha", role: "agent" }]);
    renderPage();
    expect(await screen.findByText("Only a firm's owners can read its record of who did what.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Export/ })).not.toBeInTheDocument();
    expect(exportTable).not.toHaveBeenCalled();
  });

  // Catches: an export's entry in the record saying only "Table referral_partners", with the count the database recorded (D-200) nowhere on the page;
  // "1 rows"; a count shown on an entry that has none.
  it("shows how many rows an export held, in words, on its entry, and nothing of the kind on any other entry", async () => {
    api.listFirmActivity.mockResolvedValue({
      entries: [
        entry({ entry_key: "k3", kind: "export_made", record_type: "table", record_id: "referral_partners", actor_email: "owner@example.com", row_count: 12 }),
        entry({ entry_key: "k2", kind: "export_made", record_type: "table", record_id: "firm_activity", actor_email: "owner@example.com", row_count: 1 }),
        entry({ entry_key: "k1" }),
      ],
      hasMore: false,
    });
    renderPage();
    const table = await screen.findByRole("table", { name: "Who did what" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Exported records");
    expect(within(rows[0]).getAllByRole("cell")[3]).toHaveTextContent(/^Table referral_partners · 12 rows$/);
    expect(within(rows[1]).getAllByRole("cell")[3]).toHaveTextContent(/^Table firm_activity · 1 row$/);
    expect(within(rows[2]).getAllByRole("cell")[3]).toHaveTextContent(/^Submission 0b5c1f2e-1111-4222-8333-444455556666$/);
  });

  // Catches: a button over an empty record or an empty answer (an export of no rows that the database still writes to the record).
  it("is not offered while the record loads, when it could not be read, or when there are no entries to export", async () => {
    let arrive: (v: unknown) => void = () => undefined;
    api.listFirmActivity.mockReturnValueOnce(new Promise((resolve) => { arrive = resolve; }));
    const loading = renderPage();
    await screen.findByRole("table", { name: "Who did what" });
    expect(screen.queryByRole("button", { name: /Export/ })).not.toBeInTheDocument();
    arrive({ entries: [], hasMore: false });
    await screen.findByText(/Nothing has been recorded for your firm/);
    expect(screen.queryByRole("button", { name: /Export/ })).not.toBeInTheDocument();
    loading.unmount();

    api.listFirmActivity.mockRejectedValue(new Error("boom"));
    renderPage();
    await screen.findByText("We couldn't load the record of who did what.");
    expect(screen.queryByRole("button", { name: /Export/ })).not.toBeInTheDocument();
    expect(exportTable).not.toHaveBeenCalled();
  });

  // Catches: the button shown during Nevermore support, which reads the record as an owner does (D-123); hidden with nothing said about why.
  it("is not offered during Nevermore support, which says so in one plain line", async () => {
    firmAddress = { status: "known", address: "alpha", name: "Alpha Advisory" };
    api.fetchOwnedFirms.mockResolvedValue([]);
    api.fetchMyFirms.mockResolvedValue([{ firm_id: "firm-1", name: "Alpha Advisory", address: "alpha", role: "support" }]);
    const { WorkspaceContext } = await import("@/components/workspace/workspaceContext");
    const { DOWNLOADS_OFF_LINE } = await import("@/components/workspace/downloadsOff");
    const workspace = { firm: { id: "firm-1", name: "Alpha Advisory", address: "alpha" }, role: "Nevermore support" as const, isOwner: false, isSupport: true,
      supportEndsAt: null, supportSessionId: null, isPlatformAdmin: true, person: "admin@example.com" };
    render(<WorkspaceContext.Provider value={workspace}><MemoryRouter initialEntries={["/advisor/activity"]}><AdvisorActivityPage /></MemoryRouter></WorkspaceContext.Provider>);
    await screen.findByText("agent@example.com", { selector: "td" });
    expect(screen.queryByRole("button", { name: /Export/ })).not.toBeInTheDocument();
    expect(screen.getByText(DOWNLOADS_OFF_LINE)).toBeInTheDocument();
    expect(exportTable).not.toHaveBeenCalled();
  });

  // Catches: an owner removed meanwhile being shown the database's sentence, or being told nothing.
  it("says in plain words that the person no longer has access, should the database refuse an owner it no longer knows as one", async () => {
    exportTable.mockRejectedValue(new ExportRefusal("permission denied for function export_table", "forbidden"));
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Export" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You no longer have access to this firm's records.");
    expect(alert).not.toHaveTextContent("permission denied");
    expect(saved).toHaveLength(0);
    expect(screen.getByRole("table", { name: "Who did what" })).toBeInTheDocument();
    expect(api.listFirmActivity).toHaveBeenCalledTimes(1);
  });

  describe("the filters in force", () => {
    const exportWith = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole("button", { name: "Export" }));
      await waitFor(() => expect(exportTable).toHaveBeenCalled());
      return exportTable.mock.calls[exportTable.mock.calls.length - 1][3] as { filters: unknown[] };
    };
    beforeEach(() => exportTable.mockResolvedValue(answer([["2026-11-12T16:00:00.000Z", "lead@example.com", "send_recorded", "quote_request", "42", null, null, null]])));

    // Catches: an export of everything while the page shows one person's entries or one kind (more than the person asked for leaves the product),
    // the person's id sent where the database reads their email (nothing matches), or a kind sent as its words.
    it("asks for the person and the kind the page is filtered to, the person as the email the database holds", async () => {
      const user = await ready();
      fireEvent.change(await screen.findByLabelText("Person"), { target: { value: "u2" } });
      fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "send_recorded" } });
      await screen.findByText("agent@example.com", { selector: "td" });
      expect((await exportWith(user)).filters).toEqual([
        { field: "who", op: "is", value: "lead@example.com" },
        { field: "kind", op: "any_of", value: ["send_recorded"] },
      ]);
    });

    // Catches: everyone at Nevermore exported under an id the firm is never given (D-33), or as an empty name that matches nobody.
    it("asks for Nevermore's entries as Nevermore, the one name a firm knows them by", async () => {
      api.listFirmActivityPeople.mockResolvedValue([{ user_id: "u1", email: "agent@example.com", is_nevermore: false }, { user_id: null, email: null, is_nevermore: true }]);
      const user = await ready();
      fireEvent.change(await screen.findByLabelText("Person"), { target: { value: NEVERMORE_FILTER } });
      await screen.findByText("agent@example.com", { selector: "td" });
      expect((await exportWith(user)).filters).toEqual([{ field: "who", op: "is", value: "Nevermore" }]);
    });

    // Catches: a former member's entries exported as "everyone's" or as another member's (the record no longer holds their email, and the database
    // reads a person by it), or the button left with nothing said about why it is not there.
    it("does not offer the export of one former member's entries, and says why", async () => {
      api.listFirmActivityPeople.mockResolvedValue([{ user_id: "u1", email: "agent@example.com", is_nevermore: false }, { user_id: "u9", email: null, is_nevermore: false }]);
      await ready();
      fireEvent.change(await screen.findByLabelText("Person"), { target: { value: "u9" } });
      await screen.findByText("agent@example.com", { selector: "td" });
      expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
      expect(screen.getByText("The record no longer holds a former member's email, so their entries can't be exported alone. Choose Everyone or another person.")).toBeInTheDocument();
      expect(exportTable).not.toHaveBeenCalled();

      fireEvent.change(screen.getByLabelText("Person"), { target: { value: "" } });
      expect(await screen.findByRole("button", { name: "Export" })).toBeInTheDocument();
    });
  });
});
