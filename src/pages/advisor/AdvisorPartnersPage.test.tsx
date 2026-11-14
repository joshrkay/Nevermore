import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Link, MemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "adv@example.com" }, signOut }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
let firmAddress: { status: string; address?: string; name?: string } = { status: "none" };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firmAddress }));
const api = {
  listMyFirms: vi.fn(),
  listReferralPartners: vi.fn(),
  loadIntakeSources: vi.fn(),
  addReferralPartner: vi.fn(),
  updateReferralPartner: vi.fn(),
};
vi.mock("@/lib/advisorApi", () => api);

const { default: AdvisorPartnersPage } = await import("./AdvisorPartnersPage");
const { DEFAULT_FIRM_ID } = await import("@/data/referralPartners");

// Every intake a browser starts belongs to the default firm (D-101), so only its partners' links can work today.
const DEFAULT_FIRM = DEFAULT_FIRM_ID;
const Where = () => <p data-testid="where">{useLocation().search}</p>;
const renderPage = (path = "/advisor/partners") =>
  render(<MemoryRouter initialEntries={[path]}><AdvisorPartnersPage /><Where /></MemoryRouter>);
const alpha = { id: DEFAULT_FIRM, name: "Alpha Advisory", address: "alpha" };
const beta = { id: "firm-b", name: "Beta Brokers", address: "beta" };
const acme = {
  firm_id: DEFAULT_FIRM,
  code: "acme-cfo",
  name: "Acme CFO Partners",
  kind: "accounting",
  created_at: "2026-11-01T00:00:00Z",
  created_by_email: "adv@example.com",
  updated_at: "2026-11-01T00:00:00Z",
  updated_by_email: "adv@example.com",
  version: 3,
};

describe("AdvisorPartnersPage", () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    firmAddress = { status: "none" };
    api.listMyFirms.mockResolvedValue([alpha]);
    api.listReferralPartners.mockResolvedValue([acme]);
    api.loadIntakeSources.mockResolvedValue([
      { firm_id: DEFAULT_FIRM, referral_code: "acme-cfo", utm_campaign: "spring", started: 3, certified: 1 },
      { firm_id: DEFAULT_FIRM, referral_code: "acme-cfo", utm_campaign: null, started: 2, certified: 1 },
      { firm_id: DEFAULT_FIRM, referral_code: null, utm_source: "linkedin", started: 9, certified: 4 },
    ]);
  });

  it("lists each partner with the link they share and their intakes over the last 30 days", async () => {
    renderPage();
    const row = await screen.findByRole("row", { name: /Acme CFO Partners/ });
    expect(within(row).getByText("Accountant, CPA or fractional CFO")).toBeInTheDocument();
    expect(within(row).getByText("https://nevermorepeo.com/?ref=acme-cfo")).toBeInTheDocument();
    const cells = within(row).getAllByRole("cell");
    expect(cells[1]).toHaveTextContent("5");
    expect(cells[2]).toHaveTextContent("2");
    const [from, to, firm] = api.loadIntakeSources.mock.calls[0] as [Date, Date, string];
    expect(firm).toBe(DEFAULT_FIRM);
    expect(Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000))).toBe(30);
  });

  it("copies a partner's link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Copy Acme CFO Partners's link" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://nevermorepeo.com/?ref=acme-cfo"));
    expect(toast.success).toHaveBeenCalledWith("Link copied");
  });

  describe("the add form", () => {
    const form = () => screen.getByRole("form", { name: "Add a partner" });
    const field = (name: string) => within(form()).getByLabelText(name);
    const ready = async () => {
      renderPage();
      await screen.findByRole("row", { name: /Acme CFO Partners/ });
      return userEvent.setup();
    };

    it("adds a partner under a code taken from its name, until the advisor types one", async () => {
      api.addReferralPartner.mockResolvedValue({ ...acme, code: "smith-jones-llp", name: "Smith & Jones LLP", kind: "law_firm" });
      const user = await ready();
      await user.type(field("Name"), "Smith & Jones LLP");
      expect(field("Code in their link")).toHaveValue("smith-jones-llp");
      expect(screen.getByText(/Their link: https:\/\/nevermorepeo\.com\/\?ref=smith-jones-llp/)).toBeInTheDocument();
      await user.selectOptions(field("Kind of partner"), "law_firm");
      await user.click(screen.getByRole("button", { name: "Add partner" }));

      await waitFor(() => expect(api.addReferralPartner).toHaveBeenCalledWith(DEFAULT_FIRM, "smith-jones-llp", "Smith & Jones LLP", "law_firm"));
      await waitFor(() => expect(api.listReferralPartners).toHaveBeenCalledTimes(2));
      expect(field("Name")).toHaveValue("");
      expect(field("Code in their link")).toHaveValue("");
    });

    // Catches: a required field marked only by colour or an asterisk, or not tied to its control.
    it("marks the required fields with the word Required, which a screen reader reads with the field", async () => {
      await ready();
      for (const name of ["Name", "Kind of partner", "Code in their link"]) {
        expect(field(name)).toHaveAttribute("aria-required", "true");
        const described = (field(name).getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent);
        expect(described).toContain("Required");
      }
    });

    // Catches: Save disabled until the form is valid (the old behaviour), which hides why nothing happens.
    it("leaves Add partner enabled on an empty form, and pressing it names what is missing under each field without sending", async () => {
      const user = await ready();
      const add = screen.getByRole("button", { name: "Add partner" });
      expect(add).toBeEnabled();
      await user.click(add);
      expect(add).toBeEnabled();
      await screen.findByText("Enter the partner's name.");
      expect(api.addReferralPartner).not.toHaveBeenCalled();
      expect(field("Name")).toHaveAccessibleDescription(/Required.*Enter the partner's name\./);
      expect(field("Name")).toHaveAttribute("aria-invalid", "true");
      expect(field("Kind of partner")).toHaveAccessibleDescription(/Choose a kind of partner\./);
      expect(field("Code in their link")).toHaveAccessibleDescription(/Enter the code for their link\./);
    });

    // Catches: focus staying on the Save button, or going to the last or a later field in error.
    it("moves focus to the first field in error when Save is pressed", async () => {
      const user = await ready();
      await user.click(screen.getByRole("button", { name: "Add partner" }));
      await waitFor(() => expect(field("Name")).toHaveFocus());
      await user.type(field("Name"), "Acme");
      await user.click(screen.getByRole("button", { name: "Add partner" }));
      await waitFor(() => expect(field("Kind of partner")).toHaveFocus());
    });

    // Catches: errors that only show on save, or that show before the person has left the field.
    it("shows a field's error when the person leaves it, and not before", async () => {
      const user = await ready();
      await user.click(field("Name"));
      expect(screen.queryByText("Enter the partner's name.")).not.toBeInTheDocument();
      await user.tab();
      const message = await screen.findByText("Enter the partner's name.");
      expect(message).toHaveAttribute("role", "alert");
      expect(field("Name")).toHaveAttribute("aria-invalid", "true");
      expect(screen.queryByText("Choose a kind of partner.")).not.toBeInTheDocument();
      await user.type(field("Name"), "Acme");
      expect(screen.queryByText("Enter the partner's name.")).not.toBeInTheDocument();
    });

    it("does not take a name of only spaces", async () => {
      const user = await ready();
      await user.type(field("Name"), "   ");
      await user.tab();
      expect(await screen.findByText("Enter the partner's name.")).toBeInTheDocument();
    });

    it("can be filled in and saved with the keyboard alone, in reading order", async () => {
      api.addReferralPartner.mockResolvedValue({ ...acme, code: "k", name: "Keys", kind: "other" });
      const user = await ready();
      await user.tab(); // the first control after the page's heading and links is the first one of the form
      // Reach the form's first field from wherever the page starts.
      while (document.activeElement !== field("Name")) await user.tab();
      await user.keyboard("Keys");
      await user.tab();
      expect(field("Kind of partner")).toHaveFocus();
      await user.selectOptions(field("Kind of partner"), "other"); // a native select's picker is not driven by keys in the test browser
      await user.tab();
      expect(field("Code in their link")).toHaveFocus();
      await user.tab();
      expect(screen.getByRole("button", { name: "Add partner" })).toHaveFocus();
      await user.keyboard("{Enter}");
      await waitFor(() => expect(api.addReferralPartner).toHaveBeenCalledWith(DEFAULT_FIRM, "keys", "Keys", expect.any(String)));
    });

    it("refuses a badly formed code before sending it, under the code field", async () => {
      const user = await ready();
      await user.type(field("Name"), "Another Acme");
      await user.selectOptions(field("Kind of partner"), "other");
      await user.clear(field("Code in their link"));
      await user.type(field("Code in their link"), "acme cfo");
      await user.click(screen.getByRole("button", { name: "Add partner" }));
      await screen.findByText(/Use only lowercase letters, digits, dots, hyphens or underscores, starting/);
      expect(api.addReferralPartner).not.toHaveBeenCalled();
      expect(field("Code in their link")).toHaveAccessibleDescription(/Use only lowercase letters/);
      await waitFor(() => expect(field("Code in their link")).toHaveFocus());
    });

    // Catches: a server refusal that belongs to the code shown away from it, or one that clears what was typed.
    it("shows the database's reason for a taken code under the code field, keeps what was typed and focuses the code", async () => {
      api.addReferralPartner.mockRejectedValue(Object.assign(new Error("The code acme-cfo is already a partner's. Choose another."), { code: "23505" }));
      const user = await ready();
      await user.type(field("Name"), "Another Acme");
      await user.selectOptions(field("Kind of partner"), "other");
      await user.clear(field("Code in their link"));
      await user.type(field("Code in their link"), "acme-cfo");
      await user.click(screen.getByRole("button", { name: "Add partner" }));
      expect(await screen.findByText(/already a partner's/)).toBeInTheDocument();
      expect(field("Code in their link")).toHaveAccessibleDescription(/already a partner's/);
      await waitFor(() => expect(field("Code in their link")).toHaveFocus());
      expect(field("Name")).toHaveValue("Another Acme");
      expect(field("Kind of partner")).toHaveValue("other");
    });

    // Catches: clearing the form, closing it, or saying nothing, when the network fails.
    it("keeps everything typed and says what failed beside the buttons when the save fails", async () => {
      api.addReferralPartner.mockRejectedValue(new Error("Couldn't add the partner."));
      const user = await ready();
      await user.type(field("Name"), "Another Acme");
      await user.selectOptions(field("Kind of partner"), "other");
      await user.click(screen.getByRole("button", { name: "Add partner" }));
      const alert = await within(form()).findByRole("alert");
      expect(alert).toHaveTextContent("Couldn't add the partner.");
      // Beside the buttons: the same footer holds the message and Add partner.
      expect(alert.parentElement).toContainElement(screen.getByRole("button", { name: "Add partner" }));
      expect(form()).toBeInTheDocument();
      expect(field("Name")).toHaveValue("Another Acme");
      expect(field("Code in their link")).toHaveValue("another-acme");
      expect(screen.getByRole("button", { name: "Add partner" })).toBeEnabled();
    });

    // The real client answers a dropped network with this shape; its text must never reach the person.
    it("says so in plain words when it can't reach the server, never the client's own text", async () => {
      api.addReferralPartner.mockRejectedValue(Object.assign(new Error("TypeError: Failed to fetch"), { code: "" }));
      const user = await ready();
      await user.type(field("Name"), "Another Acme");
      await user.selectOptions(field("Kind of partner"), "other");
      await user.click(screen.getByRole("button", { name: "Add partner" }));
      const alert = await within(form()).findByRole("alert");
      expect(alert).toHaveTextContent("Couldn't add the partner. Check your connection and try again.");
      expect(alert).not.toHaveTextContent("TypeError");
    });

    // Catches: a timeout or server fault from the database shown as its own words.
    it.each([["57014", "canceling statement due to statement timeout"], ["PGRST301", "JWSError JWSInvalidSignature"]])("does not show a database fault (%s) as the reason", async (code, raw) => {
      api.addReferralPartner.mockRejectedValue(Object.assign(new Error(raw), { code }));
      const user = await ready();
      await user.type(field("Name"), "Another Acme");
      await user.selectOptions(field("Kind of partner"), "other");
      await user.click(screen.getByRole("button", { name: "Add partner" }));
      const alert = await within(form()).findByRole("alert");
      expect(alert).toHaveTextContent("Couldn't add the partner. Check your connection and try again.");
      expect(alert).not.toHaveTextContent(raw);
    });

    // Catches: focus dropped to the page when the disabled Save button comes back.
    it("puts the focus back on Add partner when the save fails, with one message announced", async () => {
      let fail: (e: Error) => void = () => {};
      api.addReferralPartner.mockReturnValue(new Promise((_, reject) => { fail = reject; }));
      const user = await ready();
      await user.type(field("Name"), "Another Acme");
      await user.selectOptions(field("Kind of partner"), "other");
      await user.click(screen.getByRole("button", { name: "Add partner" }));
      await screen.findByRole("button", { name: "Adding…" });
      // A real browser drops the focus from a button that becomes disabled.
      field("Name").focus();
      document.body.tabIndex = -1;
      document.body.focus();
      document.body.removeAttribute("tabindex");
      fail(new Error("Couldn't add the partner."));
      await within(form()).findByRole("alert");
      await waitFor(() => expect(screen.getByRole("button", { name: "Add partner" })).toHaveFocus());
      expect(within(form()).getAllByRole("alert")).toHaveLength(1);
    });

    // The one time Save is disabled, and it says why.
    it("disables Add partner only while the save is in flight, and says it is adding", async () => {
      let finish: (v: unknown) => void = () => {};
      api.addReferralPartner.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
      const user = await ready();
      await user.type(field("Name"), "Slow Partner");
      await user.selectOptions(field("Kind of partner"), "other");
      await user.click(screen.getByRole("button", { name: "Add partner" }));
      const busy = await screen.findByRole("button", { name: "Adding…" });
      expect(busy).toBeDisabled();
      await user.click(busy);
      expect(api.addReferralPartner).toHaveBeenCalledTimes(1);
      finish({ ...acme, name: "Slow Partner" });
      expect(await screen.findByRole("button", { name: "Add partner" })).toBeEnabled();
    });
  });

  describe("editing a partner in place", () => {
    const openEdit = async () => {
      renderPage();
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: "Edit Acme CFO Partners" }));
      const row = screen.getByRole("row", { name: /Save/ });
      return { user, row };
    };

    it("renames a partner, keeping its code", async () => {
      api.updateReferralPartner.mockResolvedValue({ conflict: false, partner: { ...acme, name: "Acme Fractional CFOs" } });
      const { user, row } = await openEdit();
      await user.clear(within(row).getByLabelText("Name"));
      await user.type(within(row).getByLabelText("Name"), "Acme Fractional CFOs");
      await user.click(within(row).getByRole("button", { name: "Save" }));
      await waitFor(() => expect(api.updateReferralPartner).toHaveBeenCalledWith(DEFAULT_FIRM, "acme-cfo", "Acme Fractional CFOs", "accounting", 3));
      expect(toast.success).toHaveBeenCalledWith("Partner saved");
      // The saved name shows at once, from the answer (the list's reload is mocked unchanged).
      await waitFor(() => expect(screen.getByRole("button", { name: "Edit Acme Fractional CFOs" })).toBeInTheDocument());
    });

    it("turns the details into fields marked Required, with Save and Cancel", async () => {
      const { row } = await openEdit();
      expect(within(row).getByLabelText("Name")).toHaveValue("Acme CFO Partners");
      expect(within(row).getByLabelText("Name")).toHaveAccessibleDescription(/Required/);
      expect(within(row).getByLabelText("Kind of partner")).toHaveValue("accounting");
      expect(within(row).getByRole("button", { name: "Save" })).toBeEnabled();
      expect(within(row).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    it("keeps Save enabled with the name cleared, and names the problem under the field on save", async () => {
      const { user, row } = await openEdit();
      await user.clear(within(row).getByLabelText("Name"));
      const save = within(row).getByRole("button", { name: "Save" });
      expect(save).toBeEnabled();
      await user.click(save);
      await within(row).findByText("Enter the partner's name.");
      expect(api.updateReferralPartner).not.toHaveBeenCalled();
      expect(within(row).getByLabelText("Name")).toHaveAccessibleDescription(/Enter the partner's name\./);
      await waitFor(() => expect(within(row).getByLabelText("Name")).toHaveFocus());
    });

    it("keeps the row open with what was typed, and says what failed beside Save and Cancel", async () => {
      api.updateReferralPartner.mockRejectedValue(new Error("Couldn't save the partner."));
      const { user, row } = await openEdit();
      await user.type(within(row).getByLabelText("Name"), " II");
      await user.click(within(row).getByRole("button", { name: "Save" }));
      const alert = await within(row).findByRole("alert");
      expect(alert).toHaveTextContent("Couldn't save the partner.");
      expect(alert.parentElement).toContainElement(within(row).getByRole("button", { name: "Save" }));
      expect(within(row).getByLabelText("Name")).toHaveValue("Acme CFO Partners II");
    });

    // Catches: a save from an out-of-date partner looking as if it worked (or overwriting), or losing what the person typed. Until the conflict
    // dialog (CRM-S2.4a), the row stays open with their typing and says plainly that someone else changed the partner.
    it("says someone else changed the partner, keeps what was typed and does not say it saved", async () => {
      api.updateReferralPartner.mockResolvedValue({
        conflict: true,
        currentVersion: 4,
        current: { name: "Acme Finance Group", kind: "accounting" },
        changed: [{ field: "name", value: "Acme Finance Group", who: "owner@example.com", at: "2026-11-14T10:00:00+00:00" }],
      });
      const { user, row } = await openEdit();
      await user.type(within(row).getByLabelText("Name"), " II");
      await user.click(within(row).getByRole("button", { name: "Save" }));
      const alert = await within(row).findByRole("alert");
      expect(alert).toHaveTextContent("Someone else changed this partner while you were editing. Reload to see their change.");
      expect(api.updateReferralPartner).toHaveBeenCalledWith(DEFAULT_FIRM, "acme-cfo", "Acme CFO Partners II", "accounting", 3);
      expect(toast.success).not.toHaveBeenCalled();
      expect(within(row).getByLabelText("Name")).toHaveValue("Acme CFO Partners II");
    });

    // Catches: Cancel asking when nothing changed.
    it("closes on Cancel without asking when nothing changed", async () => {
      const { user, row } = await openEdit();
      await user.click(within(row).getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Edit Acme CFO Partners" })).toBeInTheDocument();
    });

    // Catches: Cancel throwing away typing without asking.
    it("asks before Cancel throws away changes; Keep editing keeps them, Discard puts the details back", async () => {
      const { user, row } = await openEdit();
      await user.type(within(row).getByLabelText("Name"), " II");
      await user.click(within(row).getByRole("button", { name: "Cancel" }));
      const ask = await screen.findByRole("alertdialog");
      expect(ask).toHaveTextContent("Discard your changes?");
      await user.click(within(ask).getByRole("button", { name: "Keep editing" }));
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(within(row).getByLabelText("Name")).toHaveValue("Acme CFO Partners II");

      await user.click(within(row).getByRole("button", { name: "Cancel" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Discard changes" }));
      expect(screen.getByText("Acme CFO Partners")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Edit Acme CFO Partners" }));
      expect(within(screen.getByRole("row", { name: /Save/ })).getByLabelText("Name")).toHaveValue("Acme CFO Partners");
    });

    // Catches: Escape closing an edited row without asking, and Escape asking when nothing changed.
    it("asks first on Escape when changed, by keyboard alone, and closes at once when not", async () => {
      const { user } = await openEdit();
      await user.keyboard("{Escape}");
      expect(screen.getByRole("button", { name: "Edit Acme CFO Partners" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Edit Acme CFO Partners" }));
      expect(within(screen.getByRole("row", { name: /Save/ })).getByLabelText("Name")).toHaveFocus();
      await user.keyboard(" II");
      await user.keyboard("{Escape}");
      const ask = await screen.findByRole("alertdialog");
      expect(within(ask).getByRole("button", { name: "Keep editing" })).toHaveFocus();
      await user.keyboard("{Escape}"); // Escape on the question keeps editing
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(within(screen.getByRole("row", { name: /Save/ })).getByLabelText("Name")).toHaveValue("Acme CFO Partners II");
    });

    it("says so in plain words when a row save can't reach the server", async () => {
      api.updateReferralPartner.mockRejectedValue(Object.assign(new Error("TypeError: Failed to fetch"), { code: "" }));
      const { user, row } = await openEdit();
      await user.type(within(row).getByLabelText("Name"), " II");
      await user.click(within(row).getByRole("button", { name: "Save" }));
      const alert = await within(row).findByRole("alert");
      expect(alert).toHaveTextContent("Couldn't save the partner. Check your connection and try again.");
      expect(alert).not.toHaveTextContent("TypeError");
      await waitFor(() => expect(within(row).getByRole("button", { name: "Save" })).toHaveFocus());
    });

    // Catches: focus left on the page after the question closes, so a keyboard user starts again from the top.
    it("returns the focus to where it was when the question closes with Keep editing, by button or by Escape", async () => {
      const { user, row } = await openEdit();
      const name = within(row).getByLabelText("Name");
      await user.type(name, " II");
      await user.keyboard("{Escape}");
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Keep editing" }));
      await waitFor(() => expect(name).toHaveFocus());
      await user.keyboard("{Escape}");
      await screen.findByRole("alertdialog");
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      await waitFor(() => expect(name).toHaveFocus());
    });

    // Catches: Escape working only while the cursor is in a field of the row.
    it("asks first on Escape pressed on the row's own Cancel or Save button", async () => {
      const { user, row } = await openEdit();
      await user.type(within(row).getByLabelText("Name"), " II");
      within(row).getByRole("button", { name: "Cancel" }).focus();
      await user.keyboard("{Escape}");
      const ask = await screen.findByRole("alertdialog");
      await user.click(within(ask).getByRole("button", { name: "Keep editing" }));
      within(row).getByRole("button", { name: "Save" }).focus();
      await user.keyboard("{Escape}");
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Discard changes" }));
      expect(screen.getByRole("button", { name: "Edit Acme CFO Partners" })).toBeInTheDocument();
    });

    it("does not ask about a saved edit afterwards", async () => {
      api.updateReferralPartner.mockResolvedValue({ conflict: false, partner: { ...acme, name: "Acme CFO Partners II" } });
      const { user, row } = await openEdit();
      await user.type(within(row).getByLabelText("Name"), " II");
      await user.click(within(row).getByRole("button", { name: "Save" }));
      await screen.findByRole("button", { name: "Edit Acme CFO Partners II" });
      const leave = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(leave);
      expect(leave.defaultPrevented).toBe(false);
    });
  });

  describe("leaving with unsaved changes", () => {
    const leave = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };

    it("lets the browser ask before the page is closed or reloaded, only when the add form has typing in it", async () => {
      renderPage();
      const user = userEvent.setup();
      await screen.findByRole("row", { name: /Acme CFO Partners/ });
      expect(leave()).toBe(false);
      await user.type(within(screen.getByRole("form", { name: "Add a partner" })).getByLabelText("Name"), "Acme");
      expect(leave()).toBe(true);
    });

    const renderInRouter = () => {
      const router = createMemoryRouter(
        [
          { path: "/advisor/partners", element: <><Link to="/advisor/funnel">Go to the funnel</Link><AdvisorPartnersPage /></> },
          { path: "/advisor/funnel", element: <p>Funnel page</p> },
        ],
        { initialEntries: ["/advisor/partners"] },
      );
      render(<RouterProvider router={router} />);
      return userEvent.setup();
    };

    it("asks before the app moves to another page, and stays when the person keeps editing", async () => {
      const user = renderInRouter();
      await screen.findByRole("row", { name: /Acme CFO Partners/ });
      await user.type(within(screen.getByRole("form", { name: "Add a partner" })).getByLabelText("Name"), "Acme");
      await user.click(screen.getByRole("link", { name: "Go to the funnel" }));
      const ask = await screen.findByRole("alertdialog");
      await user.click(within(ask).getByRole("button", { name: "Keep editing" }));
      expect(screen.queryByText("Funnel page")).not.toBeInTheDocument();
      await user.click(screen.getByRole("link", { name: "Go to the funnel" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Discard changes" }));
      expect(await screen.findByText("Funnel page")).toBeInTheDocument();
    });

    // Catches: the question vanishing when the save lands and the move the person asked for being dropped.
    it("goes on to the page the person asked for when a save in flight finishes under the question", async () => {
      let finish: (v: unknown) => void = () => {};
      api.addReferralPartner.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
      const user = renderInRouter();
      await screen.findByRole("row", { name: /Acme CFO Partners/ });
      const add = screen.getByRole("form", { name: "Add a partner" });
      await user.type(within(add).getByLabelText("Name"), "Slow One");
      await user.selectOptions(within(add).getByLabelText("Kind of partner"), "other");
      await user.click(within(add).getByRole("button", { name: "Add partner" }));
      await screen.findByRole("button", { name: "Adding…" });
      await user.click(screen.getByRole("link", { name: "Go to the funnel" }));
      await screen.findByRole("alertdialog");
      finish({ ...acme, code: "slow-one", name: "Slow One" });
      expect(await screen.findByText("Funnel page")).toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    // The router keeps one blocker; two dirty forms on a page must still ask once, and ask until both are clean.
    it("asks once for two forms with unsaved changes, and keeps asking until both are saved or discarded", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      api.updateReferralPartner.mockResolvedValue({ conflict: false, partner: { ...acme, name: "Acme CFO Partners II" } });
      api.addReferralPartner.mockResolvedValue({ ...acme, code: "new-one", name: "New One" });
      const user = renderInRouter();
      await user.click(await screen.findByRole("button", { name: "Edit Acme CFO Partners" }));
      const row = screen.getByRole("row", { name: /Save/ });
      await user.type(within(row).getByLabelText("Name"), " II");
      const add = screen.getByRole("form", { name: "Add a partner" });
      await user.type(within(add).getByLabelText("Name"), "New One");
      await user.selectOptions(within(add).getByLabelText("Kind of partner"), "other");

      await user.click(screen.getByRole("link", { name: "Go to the funnel" }));
      expect(await screen.findAllByRole("alertdialog")).toHaveLength(1);
      await user.click(screen.getByRole("button", { name: "Keep editing" }));

      // Discard the row's change: the add form still has typing in it, so the page still asks.
      await user.click(within(row).getByRole("button", { name: "Cancel" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Discard changes" }));
      await user.click(screen.getByRole("link", { name: "Go to the funnel" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Keep editing" }));
      expect(screen.queryByText("Funnel page")).not.toBeInTheDocument();

      // Save the add form too: now nothing is unsaved, so the move goes straight through.
      await user.click(within(add).getByRole("button", { name: "Add partner" }));
      await waitFor(() => expect(within(add).getByLabelText("Name")).toHaveValue(""));
      await user.click(screen.getByRole("link", { name: "Go to the funnel" }));
      expect(await screen.findByText("Funnel page")).toBeInTheDocument();
      expect(warn.mock.calls.flat().join(" ")).not.toMatch(/one blocker/);
      warn.mockRestore();
    });

    it("moves on without asking when nothing was typed", async () => {
      const user = renderInRouter();
      await screen.findByRole("row", { name: /Acme CFO Partners/ });
      await user.click(screen.getByRole("link", { name: "Go to the funnel" }));
      expect(await screen.findByText("Funnel page")).toBeInTheDocument();
    });

    it("does not ask after a successful save, even when the app moves on at once", async () => {
      api.addReferralPartner.mockResolvedValue({ ...acme, code: "new-one", name: "New One" });
      const user = renderInRouter();
      await screen.findByRole("row", { name: /Acme CFO Partners/ });
      const add = screen.getByRole("form", { name: "Add a partner" });
      await user.type(within(add).getByLabelText("Name"), "New One");
      await user.selectOptions(within(add).getByLabelText("Kind of partner"), "other");
      await user.click(within(add).getByRole("button", { name: "Add partner" }));
      await waitFor(() => expect(api.addReferralPartner).toHaveBeenCalled());
      await waitFor(() => expect(within(add).getByLabelText("Name")).toHaveValue(""));
      await user.click(screen.getByRole("link", { name: "Go to the funnel" }));
      expect(await screen.findByText("Funnel page")).toBeInTheDocument();
    });
  });

  describe("while the list refreshes", () => {
    const beta = { ...acme, code: "beta-law", name: "Beta Law", kind: "law_firm" };

    // The list request answers late here, as it does for a real person: the rows must stay on the page meanwhile.
    it("keeps a row being edited, with its typed text, when another form saves and the list reloads", async () => {
      let answer: (v: unknown[]) => void = () => {};
      api.listReferralPartners.mockReset().mockResolvedValueOnce([acme, beta]).mockReturnValueOnce(new Promise((resolve) => { answer = resolve; }));
      api.addReferralPartner.mockResolvedValue({ ...acme, code: "gamma", name: "Gamma", kind: "other" });
      renderPage();
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: "Edit Beta Law" }));
      const row = screen.getByRole("row", { name: /Save/ });
      await user.clear(within(row).getByLabelText("Name"));
      await user.type(within(row).getByLabelText("Name"), "Beta Legal");

      const add = screen.getByRole("form", { name: "Add a partner" });
      await user.type(within(add).getByLabelText("Name"), "Gamma");
      await user.selectOptions(within(add).getByLabelText("Kind of partner"), "other");
      await user.click(within(add).getByRole("button", { name: "Add partner" }));
      await waitFor(() => expect(api.listReferralPartners).toHaveBeenCalledTimes(2)); // the refresh is in flight
      expect(within(screen.getByRole("row", { name: /Save/ })).getByLabelText("Name")).toHaveValue("Beta Legal");
      expect(screen.queryByRole("status")).not.toBeInTheDocument(); // no "Loading partners…" over a list already shown

      answer([acme, beta, { ...acme, code: "gamma", name: "Gamma", kind: "other" }]);
      await screen.findByRole("row", { name: /Gamma/ });
      expect(within(screen.getByRole("row", { name: /Save/ })).getByLabelText("Name")).toHaveValue("Beta Legal");
    });
  });

  // The version a save sends is the one the person STARTED editing from, never the one a list reload brought later (CRM-S2.4b, review).
  describe("a save names the version the person started from", () => {
    const bobs = { ...acme, name: "Bob's Acme", version: 4 };
    const gamma = { ...acme, code: "gamma", name: "Gamma", kind: "other", version: 1 };
    const addGamma = async (user: ReturnType<typeof userEvent.setup>) => {
      const add = screen.getByRole("form", { name: "Add a partner" });
      await user.type(within(add).getByLabelText("Name"), "Gamma");
      await user.selectOptions(within(add).getByLabelText("Kind of partner"), "other");
      await user.click(within(add).getByRole("button", { name: "Add partner" }));
    };
    const conflict = { conflict: true, currentVersion: 4, current: { name: "Bob's Acme", kind: "accounting" }, changed: [{ field: "name", value: "Bob's Acme", who: "bob@example.com", at: "2026-11-14T10:00:00+00:00" }] };

    // Catches: Save sending the version the row holds NOW, so a reload in between lets old typing overwrite someone else's change.
    it("sends the starting version when a reload brought a newer one, and shows the conflict line again after another reload", async () => {
      api.listReferralPartners.mockReset().mockResolvedValueOnce([acme]).mockResolvedValue([bobs, gamma]);
      api.addReferralPartner.mockResolvedValue(gamma);
      api.updateReferralPartner.mockResolvedValue(conflict);
      renderPage();
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: "Edit Acme CFO Partners" }));
      const row = screen.getByRole("row", { name: /Save/ });
      await user.type(within(row).getByLabelText("Name"), " II");
      await addGamma(user); // the list reloads, and the partner is now version 4
      await waitFor(() => expect(api.listReferralPartners).toHaveBeenCalledTimes(2));
      await screen.findByRole("row", { name: /Gamma/ });
      await user.click(within(screen.getByRole("row", { name: /Save/ })).getByRole("button", { name: "Save" }));
      expect(await within(screen.getByRole("row", { name: /Save/ })).findByRole("alert")).toHaveTextContent("Someone else changed this partner while you were editing.");
      expect(api.updateReferralPartner).toHaveBeenLastCalledWith(DEFAULT_FIRM, "acme-cfo", "Acme CFO Partners II", "accounting", 3);
      // Another reload, then Save again: still the starting version, still a conflict.
      api.listReferralPartners.mockResolvedValue([{ ...bobs, version: 5 }, gamma]);
      api.addReferralPartner.mockResolvedValue({ ...gamma, code: "delta", name: "Delta" });
      const add = screen.getByRole("form", { name: "Add a partner" });
      await user.type(within(add).getByLabelText("Name"), "Delta");
      await user.selectOptions(within(add).getByLabelText("Kind of partner"), "other");
      await user.click(within(add).getByRole("button", { name: "Add partner" }));
      await waitFor(() => expect(api.listReferralPartners).toHaveBeenCalledTimes(3));
      await user.click(within(screen.getByRole("row", { name: /Save/ })).getByRole("button", { name: "Save" }));
      await waitFor(() => expect(api.updateReferralPartner).toHaveBeenCalledTimes(2));
      expect(api.updateReferralPartner).toHaveBeenLastCalledWith(DEFAULT_FIRM, "acme-cfo", "Acme CFO Partners II", "accounting", 3);
      expect(await within(screen.getByRole("row", { name: /Save/ })).findByRole("alert")).toHaveTextContent("Someone else changed this partner");
    });

    // Catches: a closed row keeping its old starting version, so the next edit conflicts with a change the person already saw.
    it("starts again from the then-current version when the row is closed and Edit is opened again", async () => {
      api.listReferralPartners.mockReset().mockResolvedValueOnce([acme]).mockResolvedValue([bobs, gamma]);
      api.addReferralPartner.mockResolvedValue(gamma);
      api.updateReferralPartner.mockResolvedValue({ conflict: false, partner: { ...bobs, name: "Mine", version: 5 } });
      renderPage();
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: "Edit Acme CFO Partners" }));
      await addGamma(user);
      await screen.findByRole("row", { name: /Gamma/ });
      await user.click(within(screen.getByRole("row", { name: /Save/ })).getByRole("button", { name: "Cancel" }));
      await user.click(await screen.findByRole("button", { name: "Edit Bob's Acme" }));
      const row = screen.getByRole("row", { name: /Save/ });
      expect(within(row).getByLabelText("Name")).toHaveValue("Bob's Acme");
      await user.clear(within(row).getByLabelText("Name"));
      await user.type(within(row).getByLabelText("Name"), "Mine");
      await user.click(within(row).getByRole("button", { name: "Save" }));
      await waitFor(() => expect(api.updateReferralPartner).toHaveBeenCalledWith(DEFAULT_FIRM, "acme-cfo", "Mine", "accounting", 4));
    });

    // Catches: a save conflicting with the person's own previous save because the page waits for the list to say the new version.
    it("uses the answer to a save at once, so editing again before the list reloads starts from the new version", async () => {
      api.listReferralPartners.mockReset().mockResolvedValueOnce([acme]).mockReturnValue(new Promise(() => {}));
      api.updateReferralPartner.mockResolvedValueOnce({ conflict: false, partner: { ...acme, name: "First", version: 4 } }).mockResolvedValue({ conflict: false, partner: { ...acme, name: "Second", version: 5 } });
      renderPage();
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: "Edit Acme CFO Partners" }));
      let row = screen.getByRole("row", { name: /Save/ });
      await user.clear(within(row).getByLabelText("Name"));
      await user.type(within(row).getByLabelText("Name"), "First");
      await user.click(within(row).getByRole("button", { name: "Save" }));
      await user.click(await screen.findByRole("button", { name: "Edit First" })); // shown from the answer, though the list has not reloaded
      row = screen.getByRole("row", { name: /Save/ });
      await user.clear(within(row).getByLabelText("Name"));
      await user.type(within(row).getByLabelText("Name"), "Second");
      await user.click(within(row).getByRole("button", { name: "Save" }));
      await waitFor(() => expect(api.updateReferralPartner).toHaveBeenLastCalledWith(DEFAULT_FIRM, "acme-cfo", "Second", "accounting", 4));
    });
  });

  it("says when there are no partners yet, and offers to try again when it can't load", async () => {
    api.listReferralPartners.mockRejectedValueOnce(new Error("Couldn't load the referral partners.")).mockResolvedValue([]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
    expect(await screen.findByText("No referral partners yet.")).toBeInTheDocument();
  });

  describe("links, which only the default firm can use (D-101)", () => {
    const betaAcme = { ...acme, firm_id: "firm-b", name: "Beta's Acme" };
    const atBeta = () => {
      api.listMyFirms.mockResolvedValue([alpha, beta]);
      firmAddress = { status: "known", address: "beta", name: "Beta Brokers" };
      api.listReferralPartners.mockResolvedValue([betaAcme]);
    };

    it("shows and copies a link for the default firm's partners, and offers it when one is added", async () => {
      api.addReferralPartner.mockResolvedValue({ ...acme, code: "new-co", name: "New Co" });
      renderPage();
      const row = await screen.findByRole("row", { name: /Acme CFO Partners/ });
      expect(within(row).getByText("https://nevermorepeo.com/?ref=acme-cfo")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Copy Acme CFO Partners's link" })).toBeInTheDocument();
      expect(screen.queryByText(/links come when/i)).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New Co" } });
      fireEvent.change(screen.getByLabelText("Kind of partner"), { target: { value: "other" } });
      fireEvent.click(screen.getByRole("button", { name: "Add partner" }));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Added New Co. Send them https://nevermorepeo.com/?ref=new-co"));
    });

    it("keeps another firm's partner and its code but shows no link, and says when links come", async () => {
      atBeta();
      renderPage();
      const row = await screen.findByRole("row", { name: /Beta's Acme/ });
      expect(within(row).getByText("acme-cfo")).toBeInTheDocument();
      expect(screen.queryByText(/nevermorepeo\.com/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Copy .*link/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("columnheader", { name: "Their link" })).not.toBeInTheDocument();
      expect(screen.getByText(/links come when the firm can take intakes/i)).toBeInTheDocument();
      // The funnel counts are asked for the page's own firm, not for another membership's.
      expect(api.loadIntakeSources.mock.calls[0][2]).toBe("firm-b");
    });

    it("offers no link while adding a partner to another firm, and the toast carries none", async () => {
      atBeta();
      api.addReferralPartner.mockResolvedValue({ ...betaAcme, code: "new-co", name: "New Co" });
      renderPage();
      await screen.findByRole("row", { name: /Beta's Acme/ });
      fireEvent.change(within(screen.getByRole("form", { name: "Add a partner" })).getByLabelText("Name"), { target: { value: "New Co" } });
      expect(screen.getByLabelText("Code in their link")).toHaveValue("new-co");
      expect(screen.queryByText(/Their link:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/nevermorepeo\.com/)).not.toBeInTheDocument();
      fireEvent.change(within(screen.getByRole("form", { name: "Add a partner" })).getByLabelText("Kind of partner"), { target: { value: "other" } });
      fireEvent.click(screen.getByRole("button", { name: "Add partner" }));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Added New Co."));
    });

    it("says it too for another firm with no partners yet", async () => {
      atBeta();
      api.listReferralPartners.mockResolvedValue([]);
      renderPage();
      expect(await screen.findByText("No referral partners yet.")).toBeInTheDocument();
      expect(screen.getByText(/links come when the firm can take intakes/i)).toBeInTheDocument();
      expect(screen.queryByText(/then send them their link/i)).not.toBeInTheDocument();
    });
  });

  describe("which firm it acts for", () => {
    const betaAcme = { ...acme, firm_id: "firm-b", name: "Beta's Acme" };

    it("reads the partners of the only firm the person belongs to", async () => {
      renderPage();
      await screen.findByRole("row", { name: /Acme CFO Partners/ });
      expect(api.listReferralPartners).toHaveBeenCalledWith(DEFAULT_FIRM);
      expect(screen.queryByLabelText("Firm")).not.toBeInTheDocument();
    });

    it("at a firm's address acts for that firm, though the person belongs to others", async () => {
      api.listMyFirms.mockResolvedValue([alpha, beta]);
      firmAddress = { status: "known", address: "beta", name: "Beta Brokers" };
      api.listReferralPartners.mockResolvedValue([betaAcme]);
      api.updateReferralPartner.mockResolvedValue({ conflict: false, partner: betaAcme });
      api.addReferralPartner.mockResolvedValue(betaAcme);
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Edit Beta's Acme" }));
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(api.updateReferralPartner).toHaveBeenCalledWith("firm-b", "acme-cfo", "Beta's Acme", "accounting", 3));
      expect(api.listReferralPartners).toHaveBeenCalledWith("firm-b");
      expect(api.listReferralPartners).not.toHaveBeenCalledWith(DEFAULT_FIRM);
      expect(screen.queryByLabelText("Firm")).not.toBeInTheDocument();
      fireEvent.change(within(screen.getByRole("form", { name: "Add a partner" })).getByLabelText("Name"), { target: { value: "New Co" } });
      fireEvent.change(within(screen.getByRole("form", { name: "Add a partner" })).getByLabelText("Kind of partner"), { target: { value: "other" } });
      fireEvent.click(screen.getByRole("button", { name: "Add partner" }));
      await waitFor(() => expect(api.addReferralPartner).toHaveBeenCalledWith("firm-b", "new-co", "New Co", "other"));
    });

    it("on the bare domain asks a member of several firms which one, and acts for the one chosen", async () => {
      api.listMyFirms.mockResolvedValue([alpha, beta]);
      api.listReferralPartners.mockImplementation(async (firm: string) => (firm === "firm-b" ? [betaAcme] : [acme]));
      api.updateReferralPartner.mockResolvedValue({ conflict: false, partner: betaAcme });
      renderPage();
      const choose = await screen.findByLabelText("Firm");
      expect(api.listReferralPartners).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: "Add partner" })).not.toBeInTheDocument();
      fireEvent.change(choose, { target: { value: "firm-b" } });
      fireEvent.click(await screen.findByRole("button", { name: "Edit Beta's Acme" }));
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(api.updateReferralPartner).toHaveBeenCalledWith("firm-b", "acme-cfo", "Beta's Acme", "accounting", 3));
    });

    it("counts a partner's intakes only from its own firm when another firm uses the same code", async () => {
      api.loadIntakeSources.mockResolvedValue([
        { firm_id: DEFAULT_FIRM, referral_code: "acme-cfo", started: 3, certified: 1 },
        { firm_id: "firm-b", referral_code: "acme-cfo", started: 40, certified: 20 },
      ]);
      renderPage();
      const row = await screen.findByRole("row", { name: /Acme CFO Partners/ });
      const cells = within(row).getAllByRole("cell");
      expect(cells[1]).toHaveTextContent(/^3$/);
      expect(cells[2]).toHaveTextContent(/^1$/);
    });

    it("leaves the previous firm's table and controls at once when another firm is chosen, and carries no draft over", async () => {
      api.listMyFirms.mockResolvedValue([alpha, beta]);
      let release: (v: unknown[]) => void = () => {};
      api.listReferralPartners.mockImplementation((firm: string) =>
        firm === "firm-b" ? new Promise((resolve) => { release = resolve; }) : Promise.resolve([acme]));
      renderPage(`/advisor/partners?firm=${DEFAULT_FIRM}`);
      await screen.findByRole("row", { name: /Acme CFO Partners/ });
      fireEvent.change(within(screen.getByRole("form", { name: "Add a partner" })).getByLabelText("Name"), { target: { value: "Draft For Alpha" } });

      fireEvent.change(screen.getByLabelText("Firm"), { target: { value: "firm-b" } });
      // While Beta loads, nothing of Alpha's can be clicked, and the chooser is still there to go back.
      expect(screen.getByRole("status")).toHaveTextContent(/Loading partners/);
      expect(screen.queryByRole("button", { name: "Add partner" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Edit Acme CFO Partners" })).not.toBeInTheDocument();
      expect(screen.queryByRole("row", { name: /Acme CFO Partners/ })).not.toBeInTheDocument();
      expect(screen.getByLabelText("Firm")).toHaveValue("firm-b");

      await waitFor(() => expect(api.listReferralPartners).toHaveBeenCalledWith("firm-b"));
      release([{ ...acme, firm_id: "firm-b", name: "Beta's Acme" }]);
      await screen.findByRole("row", { name: /Beta's Acme/ });
      expect(within(screen.getByRole("form", { name: "Add a partner" })).getByLabelText("Name")).toHaveValue("");
    });

    it("does not show a reload of the same firm as a loading page", async () => {
      api.updateReferralPartner.mockResolvedValue({ conflict: false, partner: acme });
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Edit Acme CFO Partners" }));
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(api.listReferralPartners).toHaveBeenCalledTimes(2));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByRole("row", { name: /Acme CFO Partners/ })).toBeInTheDocument();
    });

    it("treats a ?firm= that matches none of the person's firms as absent when they belong to exactly one, and puts that firm's id in the address", async () => {
      renderPage("/advisor/partners?firm=not-a-firm");
      await screen.findByRole("row", { name: /Acme CFO Partners/ });
      expect(screen.queryByText(/aren't a member of a firm/)).not.toBeInTheDocument();
      expect(api.listReferralPartners).toHaveBeenCalledWith(DEFAULT_FIRM);
      expect(api.listReferralPartners).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("where")).toHaveTextContent(`?firm=${DEFAULT_FIRM}`);
    });

    it("still asks a member of several firms to choose when the ?firm= matches none of them", async () => {
      api.listMyFirms.mockResolvedValue([alpha, beta]);
      renderPage("/advisor/partners?firm=not-a-firm");
      expect(await screen.findByLabelText("Firm")).toHaveValue("");
      expect(api.listReferralPartners).not.toHaveBeenCalled();
    });

    it("says so when the person belongs to no firm", async () => {
      api.listMyFirms.mockResolvedValue([]);
      renderPage();
      expect(await screen.findByText(/aren't a member of a firm/)).toBeInTheDocument();
      expect(api.listReferralPartners).not.toHaveBeenCalled();
    });
  });
});
