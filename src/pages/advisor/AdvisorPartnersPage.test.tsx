import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Link, MemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { blobBytes, blobText } from "@/test/blob";

const signOut = vi.fn();
const signIn = vi.fn();
// How the person signed in decides how they step up for an export: `providers` is what Supabase says their account can sign in with.
const auth = { user: { email: "adv@example.com", app_metadata: { providers: ["email"] } } as { email: string; app_metadata: { providers: string[] } }, signOut, signIn };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
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
// The Export button asks the database through exportRows (its refusals are the real ExportError) and hands the file to downloadBlob: both are faked here,
// so the test sees the file the person would have been given, never the browser's own download.
// The authenticator's calls (src/lib/secondFactor.ts), faked at the client: which app the person has, and whether a code is right.
const mfa = { listFactors: vi.fn(), challengeAndVerify: vi.fn() };
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { mfa } } }));
const exportRows = vi.fn();
vi.mock("@/lib/exportApi", async () => ({ ...(await vi.importActual<object>("@/lib/exportApi")), exportRows: (...a: unknown[]) => exportRows(...a) }));
const downloadBlob = vi.fn();
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: (...a: unknown[]) => downloadBlob(...a) }));

const { default: AdvisorPartnersPage } = await import("./AdvisorPartnersPage");
const { DEFAULT_FIRM_ID } = await import("@/data/referralPartners");
const { ExportError } = await import("@/lib/exportApi");
const { WorkspaceContext } = await import("@/components/workspace/workspaceContext");

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
    signOut.mockReset();
    signIn.mockReset();
    mfa.listFactors.mockReset().mockResolvedValue({ data: { totp: [], all: [] }, error: null });
    mfa.challengeAndVerify.mockReset();
    auth.user = { email: "adv@example.com", app_metadata: { providers: ["email"] } };
    exportRows.mockReset();
    downloadBlob.mockReset();
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

    // Catches: a save from an out-of-date partner looking as if it worked (or overwriting), or losing what the person typed, or a dialog that
    // does not say what changed, where and by whom (CRM-S2.4a, D-155, D-181).
    describe("when someone else changed the partner while it was being edited", () => {
      const theirs = {
        conflict: true,
        currentVersion: 4,
        current: { name: "Acme Finance Group", kind: "other" },
        changed: [
          { field: "name", value: "Acme Finance Group", who: "owner@example.com", at: "2026-11-14T12:00:00+00:00" },
          { field: "kind", value: "other", who: "Nevermore", at: "2026-11-14T12:05:00+00:00" },
        ],
      };
      const dialog = () => screen.getByRole("alertdialog");
      const typeII = async () => {
        api.updateReferralPartner.mockResolvedValueOnce(theirs);
        const opened = await openEdit();
        await opened.user.type(within(opened.row).getByLabelText("Name"), " II");
        await opened.user.click(within(opened.row).getByRole("button", { name: "Save" }));
        await screen.findByRole("alertdialog");
        return opened;
      };

      it("opens a dialog that sets what they typed beside what is there now, with who changed each field and when, and saves nothing", async () => {
        const { row } = await typeII();
        expect(within(dialog()).getByRole("heading", { name: "Someone else changed this partner" })).toBeInTheDocument();
        expect(dialog()).toHaveAccessibleName("Someone else changed this partner");
        const rows = within(within(dialog()).getByRole("table")).getAllByRole("row").slice(1);
        expect(rows).toHaveLength(2);
        expect(within(rows[0]).getByRole("rowheader")).toHaveTextContent("Name");
        const [yours, theirsCell, who] = within(rows[0]).getAllByRole("cell");
        expect(yours).toHaveTextContent("Acme CFO Partners II");
        expect(theirsCell).toHaveTextContent("Acme Finance Group");
        expect(who).toHaveTextContent("owner@example.com");
        expect(who).toHaveTextContent(/Nov 1[45], 2026/);
        // A code is shown as the words the form shows, and a person at Nevermore is only ever "Nevermore" (D-33).
        const [, kindTheirs, kindWho] = within(rows[1]).getAllByRole("cell");
        expect(kindTheirs).toHaveTextContent("Other");
        expect(kindWho).toHaveTextContent("Nevermore");
        // Nothing was saved, nothing says it was, and what was typed is still in the form behind.
        expect(api.updateReferralPartner).toHaveBeenCalledTimes(1);
        expect(toast.success).not.toHaveBeenCalled();
        expect(within(row).getByLabelText("Name")).toHaveValue("Acme CFO Partners II");
        expect(screen.queryByText(/Reload to see their change/)).not.toBeInTheDocument();
        // The three choices, and a plain line on what each does.
        for (const name of ["Keep mine", "Keep theirs", "Keep editing"]) expect(within(dialog()).getByRole("button", { name })).toBeInTheDocument();
        expect(dialog()).toHaveAccessibleDescription(/Keep mine saves what you typed over their change\. Keep theirs/);
      });

      // Catches: focus left behind the dialog, or on a choice that overwrites someone's work.
      it("puts focus on the choice that changes nothing, and keeps it inside the dialog", async () => {
        const { user } = await typeII();
        expect(within(dialog()).getByRole("button", { name: "Keep editing" })).toHaveFocus();
        for (let i = 0; i < 5; i++) {
          await user.tab();
          expect(dialog()).toContainElement(document.activeElement as HTMLElement);
        }
        await user.tab({ shift: true });
        expect(dialog()).toContainElement(document.activeElement as HTMLElement);
      });

      // Catches: "Keep mine" saving from the old version again (refused again), or not saving at all.
      it("keeps what the person typed: Keep mine saves it again from the version that holds their change", async () => {
        api.updateReferralPartner.mockResolvedValueOnce(theirs).mockResolvedValueOnce({ conflict: false, partner: { ...acme, name: "Acme CFO Partners II", version: 5 } });
        const { user, row } = await openEdit();
        await user.type(within(row).getByLabelText("Name"), " II");
        await user.click(within(row).getByRole("button", { name: "Save" }));
        await user.click(await within(await screen.findByRole("alertdialog")).findByRole("button", { name: "Keep mine" }));
        await waitFor(() => expect(api.updateReferralPartner).toHaveBeenCalledTimes(2));
        expect(api.updateReferralPartner).toHaveBeenLastCalledWith(DEFAULT_FIRM, "acme-cfo", "Acme CFO Partners II", "accounting", 4);
        expect(await screen.findByRole("button", { name: "Edit Acme CFO Partners II" })).toBeInTheDocument();
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(toast.success).toHaveBeenCalledWith("Partner saved");
        // The row is closed, and focus is on its Edit button rather than lost to the page.
        expect(screen.getByRole("button", { name: "Edit Acme CFO Partners II" })).toHaveFocus();
      });

      // Catches: Keep mine hiding a second change made while the dialog was open.
      it("shows the dialog again, with the newest change, when Keep mine finds yet another change", async () => {
        const third = { ...theirs, currentVersion: 5, current: { name: "Third", kind: "other" }, changed: [{ field: "name", value: "Third", who: "lead@example.com", at: "2026-11-14T12:30:00+00:00" }] };
        api.updateReferralPartner.mockResolvedValueOnce(theirs).mockResolvedValueOnce(third);
        const { user, row } = await openEdit();
        await user.type(within(row).getByLabelText("Name"), " II");
        await user.click(within(row).getByRole("button", { name: "Save" }));
        await user.click(await within(await screen.findByRole("alertdialog")).findByRole("button", { name: "Keep mine" }));
        await waitFor(() => expect(within(screen.getByRole("alertdialog")).getByText("lead@example.com")).toBeInTheDocument());
        expect(within(screen.getByRole("alertdialog")).queryByText("owner@example.com")).not.toBeInTheDocument();
        expect(within(row).getByLabelText("Name")).toHaveValue("Acme CFO Partners II");
      });

      // Catches: "Keep theirs" leaving the old version behind (the next save would conflict with a change the person has just accepted), or leaving their typing
      // in the form as if it were still the thing to save.
      it("takes their version: the form shows it, focus goes to the first field, and a save starts from their version", async () => {
        const { user, row } = await typeII();
        await user.click(within(dialog()).getByRole("button", { name: "Keep theirs" }));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
        expect(within(row).getByLabelText("Name")).toHaveValue("Acme Finance Group");
        expect(within(row).getByLabelText("Kind of partner")).toHaveValue("other");
        expect(within(row).getByLabelText("Name")).toHaveFocus();
        expect(api.updateReferralPartner).toHaveBeenCalledTimes(1);
        api.updateReferralPartner.mockResolvedValueOnce({ conflict: false, partner: { ...acme, name: "Acme Finance Group", kind: "other", version: 5 } });
        await user.click(within(row).getByRole("button", { name: "Save" }));
        await waitFor(() => expect(api.updateReferralPartner).toHaveBeenLastCalledWith(DEFAULT_FIRM, "acme-cfo", "Acme Finance Group", "other", 4));
      });

      // Catches: closing the dialog throwing the typing away, or a way to close it that picks a side.
      it("keeps editing: the dialog closes, what was typed stays, focus is back on Save, and Save conflicts again from the same version", async () => {
        api.updateReferralPartner.mockResolvedValue(theirs);
        const { user, row } = await openEdit();
        await user.type(within(row).getByLabelText("Name"), " II");
        await user.click(within(row).getByRole("button", { name: "Save" }));
        await user.click(await within(await screen.findByRole("alertdialog")).findByRole("button", { name: "Keep editing" }));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
        expect(within(row).getByLabelText("Name")).toHaveValue("Acme CFO Partners II");
        expect(within(row).getByRole("button", { name: "Save" })).toHaveFocus();
        await user.click(within(row).getByRole("button", { name: "Save" }));
        await screen.findByRole("alertdialog");
        expect(api.updateReferralPartner).toHaveBeenLastCalledWith(DEFAULT_FIRM, "acme-cfo", "Acme CFO Partners II", "accounting", 3);
      });

      // Catches: Escape choosing a side or closing the row (it would ask to discard, or silently discard).
      it("treats Escape as keep editing, without asking to discard and without closing the row", async () => {
        const { user, row } = await typeII();
        await user.keyboard("{Escape}");
        await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
        expect(screen.queryByText("Discard your changes?")).not.toBeInTheDocument();
        expect(within(row).getByLabelText("Name")).toHaveValue("Acme CFO Partners II");
      });

      // Catches: an empty comparison when the fields were changed and changed back (the version still moved).
      it("says so when their changes left the fields as they were, and still offers the choices", async () => {
        api.updateReferralPartner.mockResolvedValueOnce({ ...theirs, current: { name: "Acme CFO Partners", kind: "accounting" }, changed: [] });
        const { user, row } = await openEdit();
        await user.type(within(row).getByLabelText("Name"), " II");
        await user.click(within(row).getByRole("button", { name: "Save" }));
        const d = await screen.findByRole("alertdialog");
        expect(d).toHaveTextContent("The fields are as they were when you started");
        expect(within(d).queryByRole("table")).not.toBeInTheDocument();
        expect(within(d).getByRole("button", { name: "Keep mine" })).toBeInTheDocument();
      });
    });

    // Without a connection (CRM-S2.4a, D-182, D-143): Save is not usable and says why; nothing is sent, nothing typed is lost.
    describe("without a connection", () => {
      const goOffline = () => act(() => { vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false); window.dispatchEvent(new Event("offline")); });
      const goOnline = () => act(() => { vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true); window.dispatchEvent(new Event("online")); });
      afterEach(() => { vi.restoreAllMocks(); });

      // Catches: a Save that looks usable and fails with a dropped-connection message after the person has waited, or one that is disabled with no reason.
      it("makes Save aria-disabled with the reason, ignores a click, keeps the typing, and is usable again when the connection is back", async () => {
        const { user, row } = await openEdit();
        await user.type(within(row).getByLabelText("Name"), " II");
        goOffline();
        const save = within(row).getByRole("button", { name: "Save" });
        expect(save).toHaveAttribute("aria-disabled", "true");
        expect(save).not.toBeDisabled();
        expect(save).toHaveAccessibleDescription("You're offline. Saving is back when you are.");
        await user.click(save);
        expect(api.updateReferralPartner).not.toHaveBeenCalled();
        expect(within(row).getByLabelText("Name")).toHaveValue("Acme CFO Partners II");
        goOnline();
        expect(within(row).getByRole("button", { name: "Save" })).not.toHaveAttribute("aria-disabled");
        expect(within(row).getByRole("button", { name: "Save" })).not.toHaveAccessibleDescription(/offline/);
        api.updateReferralPartner.mockResolvedValue({ conflict: false, partner: { ...acme, name: "Acme CFO Partners II", version: 4 } });
        await user.click(within(row).getByRole("button", { name: "Save" }));
        await waitFor(() => expect(api.updateReferralPartner).toHaveBeenCalledTimes(1));
      });

      // Catches: Enter in a field sending a save that cannot arrive, or doing nothing at all.
      it("does not send a save made with Enter, says it was not saved, and keeps the typing", async () => {
        const { user, row } = await openEdit();
        await user.type(within(row).getByLabelText("Name"), " II");
        goOffline();
        await user.keyboard("{Enter}");
        expect(api.updateReferralPartner).not.toHaveBeenCalled();
        expect(await within(row).findByRole("alert")).toHaveTextContent("You're offline, so this wasn't saved. Try again when you're back online. What you typed is still here.");
        expect(within(row).getByLabelText("Name")).toHaveValue("Acme CFO Partners II");
      });

      it("does the same for the add form", async () => {
        renderPage();
        const user = userEvent.setup();
        await screen.findByRole("button", { name: "Edit Acme CFO Partners" });
        goOffline();
        const add = screen.getByRole("button", { name: "Add partner" });
        expect(add).toHaveAttribute("aria-disabled", "true");
        expect(add).toHaveAccessibleDescription("You're offline. Saving is back when you are.");
        await user.click(add);
        expect(api.addReferralPartner).not.toHaveBeenCalled();
      });
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
      expect(await screen.findByRole("alertdialog")).toHaveTextContent("Someone else changed this partner");
      expect(api.updateReferralPartner).toHaveBeenLastCalledWith(DEFAULT_FIRM, "acme-cfo", "Acme CFO Partners II", "accounting", 3);
      await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Keep editing" }));
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
      expect(await screen.findByRole("alertdialog")).toHaveTextContent("Someone else changed this partner");
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

  describe("the Export button (story CRM-S3.8a)", () => {
    // What the database gives for a partner: more columns than the page shows (the kind, when it was added), which stay out of the file.
    const COLUMNS = [
      { id: "code", label: "Code" }, { id: "name", label: "Name" }, { id: "kind", label: "Kind" },
      { id: "started_30d", label: "Started, 30 days" }, { id: "certified_30d", label: "Certified, 30 days" }, { id: "created_at", label: "Added" },
    ];
    const answer = (rows: Record<string, string | number | null>[], over: Record<string, unknown> = {}) => ({
      table: "referral_partners", label: "Referral partners", columns: COLUMNS, rows, count: rows.length, skipped: 0, exportedAt: "2026-11-19T10:00:00+00:00", ...over,
    });
    const row = (over: Record<string, string | number | null> = {}) =>
      ({ code: "acme-cfo", name: "Acme CFO Partners", kind: "accounting", started_30d: 5, certified_30d: 2, created_at: "2026-11-01T00:00:00+00:00", ...over });
    const exportButton = () => screen.findByRole("button", { name: "Export" });
    /** The one file handed to the browser: its name, its text and its first bytes. */
    const theFile = async () => {
      expect(downloadBlob).toHaveBeenCalledTimes(1);
      const [blob, name] = downloadBlob.mock.calls[0] as [Blob, string];
      return { name, text: await blobText(blob), bytes: await blobBytes(blob) };
    };
    // The page's own columns, as the table on screen words them: its default firm shows each partner's link, any other firm its code.
    const HEAD = 'Partner,Their link,"Started, 30 days","Certified, 30 days"';

    it("downloads a CSV of every partner with the columns the page shows, in the order it shows them, named for the table and the day, and says how many", async () => {
      exportRows.mockResolvedValue(answer([row(), row({ code: "acme-law", name: "Acme Law", kind: "law_firm", started_30d: 0, certified_30d: 0 })]));
      renderPage();
      fireEvent.click(await exportButton());
      expect(await screen.findByText("Exported 2 referral partners.")).toBeInTheDocument();
      // A whole table: the firm and the table, and no filters (the page has none) and no ids.
      expect(exportRows).toHaveBeenCalledWith({ firmId: DEFAULT_FIRM, table: "referral_partners", filters: {} });
      const { name, text } = await theFile();
      expect(name).toBe("referral-partners-2026-11-19.csv");
      // The kind and when it was added are the database's, not the page's: they are not in the file. The link is what the page shows for the code.
      expect(text).toBe(
        `${HEAD}\r\n` +
        "Acme CFO Partners,https://nevermorepeo.com/?ref=acme-cfo,5,2\r\n" +
        "Acme Law,https://nevermorepeo.com/?ref=acme-law,0,0\r\n",
      );
    });

    it("names the column as the page does when the firm has no link to show: their code", async () => {
      api.listMyFirms.mockResolvedValue([beta]);
      api.listReferralPartners.mockResolvedValue([{ ...acme, firm_id: "firm-b" }]);
      exportRows.mockResolvedValue(answer([row()]));
      renderPage("/advisor/partners?firm=firm-b");
      fireEvent.click(await exportButton());
      await screen.findByText("Exported 1 referral partner.");
      expect((await theFile()).text).toBe('Partner,Their code,"Started, 30 days","Certified, 30 days"\r\nAcme CFO Partners,acme-cfo,5,2\r\n');
    });

    it("starts the file with a byte order mark, so a spreadsheet reads an accent as it was written", async () => {
      exportRows.mockResolvedValue(answer([row({ name: "José Müller" })]));
      renderPage();
      fireEvent.click(await exportButton());
      await screen.findByText("Exported 1 referral partner.");
      const { bytes, text } = await theFile();
      expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      expect(text).toContain("José Müller");
    });

    it("says one in the singular, and the file holds that one partner", async () => {
      exportRows.mockResolvedValue(answer([row()]));
      renderPage();
      fireEvent.click(await exportButton());
      expect(await screen.findByText("Exported 1 referral partner.")).toBeInTheDocument();
      expect((await theFile()).text).toBe(`${HEAD}\r\nAcme CFO Partners,https://nevermorepeo.com/?ref=acme-cfo,5,2\r\n`);
    });

    it("says nothing matched when the database gave no row, and the file holds only the headings", async () => {
      exportRows.mockResolvedValue(answer([]));
      renderPage();
      fireEvent.click(await exportButton());
      expect(await screen.findByText("Nothing matched, so the file holds only the headings.")).toBeInTheDocument();
      expect((await theFile()).text).toBe(`${HEAD}\r\n`);
    });

    it("fails, with no file, when the database's answer lacks a column the page shows", async () => {
      exportRows.mockResolvedValue(answer([row()], { columns: COLUMNS.filter((c) => c.id !== "certified_30d") }));
      renderPage();
      fireEvent.click(await exportButton());
      expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't export. Try again.");
      expect(downloadBlob).not.toHaveBeenCalled();
    });

    it("neutralises a cell a spreadsheet would run as a formula, and quotes commas, semicolons, quotes and line breaks (RFC 4180)", async () => {
      exportRows.mockResolvedValue(answer([
        row({ code: "a", name: '=HYPERLINK("http://evil.example","x")' }),
        row({ code: "b", name: "+1+1" }),
        row({ code: "c", name: "-2+3" }),
        row({ code: "d", name: "@SUM(A1)" }),
        row({ code: "e", name: 'Say "hi", then\nleave' }),
        row({ code: "f", name: null }),
        row({ code: "g", name: "Fine, Inc." }),
        // An Excel set to a semicolon separator splits at each one, so a cell holding one is quoted, and what starts the cell is still neutralised.
        row({ code: "h", name: "x;=cmd|' /C calc'!A0;" }),
        row({ code: "i", name: "=cmd;x" }),
        // A leading line feed, and the full-width forms of the four characters, which a spreadsheet's input method can turn back into formulas.
        row({ code: "j", name: "\n=1+1" }),
        row({ code: "k", name: "＝1+1" }),
        row({ code: "l", name: "＋1" }),
        row({ code: "m", name: "－1" }),
        row({ code: "n", name: "＠SUM(A1)" }),
        row({ code: "o", name: "\t=1" }),
      ]));
      renderPage();
      fireEvent.click(await exportButton());
      await screen.findByText("Exported 15 referral partners.");
      const { text } = await theFile();
      const lines = text.split("\r\n");
      const tail = (code: string) => `,https://nevermorepeo.com/?ref=${code},5,2`;
      // Each risky value is kept as text by a leading apostrophe; its own quotes are doubled inside a quoted cell.
      expect(lines[1]).toBe(`"'=HYPERLINK(""http://evil.example"",""x"")"${tail("a")}`);
      expect(lines[2]).toBe(`'+1+1${tail("b")}`);
      expect(lines[3]).toBe(`'-2+3${tail("c")}`);
      expect(lines[4]).toBe(`'@SUM(A1)${tail("d")}`);
      expect(text).toContain(`"Say ""hi"", then\nleave"${tail("e")}\r\n`);
      expect(lines[6]).toBe(tail("f"));
      expect(text).toContain(`"Fine, Inc."${tail("g")}\r\n`);
      expect(text).toContain(`"x;=cmd|' /C calc'!A0;"${tail("h")}\r\n`);
      expect(text).toContain(`"'=cmd;x"${tail("i")}\r\n`);
      expect(text).toContain(`"'\n=1+1"${tail("j")}\r\n`);
      expect(text).toContain(`'＝1+1${tail("k")}\r\n`);
      expect(text).toContain(`'＋1${tail("l")}\r\n`);
      expect(text).toContain(`'－1${tail("m")}\r\n`);
      expect(text).toContain(`'＠SUM(A1)${tail("n")}\r\n`);
      expect(text).toContain(`'\t=1${tail("o")}\r\n`);
    });

    it("does not start a second export from a second click made before the page has drawn the first", async () => {
      let finish: (v: unknown) => void = () => {};
      exportRows.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
      renderPage();
      const button = await exportButton();
      // Both clicks reach the button as it was drawn, before React has disabled it: only the control's own guard can stop the second.
      act(() => { button.click(); button.click(); });
      expect(exportRows).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Exporting…" })).toBeDisabled();
      finish(answer([row()]));
      expect(await screen.findByRole("button", { name: "Export" })).toBeEnabled();
      expect(downloadBlob).toHaveBeenCalledTimes(1);
    });

    describe("when the last sign-in is too old for a whole table (PT401)", () => {
      const tooOld = () => new ExportError("signInAgain", "Sign in again to export a whole table.");
      /** The first export is refused for its sign-in; the next, once the person has stepped up, gives the file. */
      const refusedThenGiven = () => {
        exportRows.mockRejectedValueOnce(tooOld());
        exportRows.mockResolvedValue(answer([row()]));
      };
      const press = async () => { fireEvent.click(await exportButton()); return screen.findByRole("dialog"); };

      it("asks a person with an authenticator for its code, in place, and exports again with the same request once it is right", async () => {
        mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: "factor-1" }], all: [] }, error: null });
        mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
        refusedThenGiven();
        renderPage();
        const dialog = await press();
        expect(dialog).toHaveTextContent("Sign in again to export a whole table.");
        expect(downloadBlob).not.toHaveBeenCalled();
        fireEvent.change(within(dialog).getByLabelText(/6-digit code/), { target: { value: "123 456" } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Confirm and export" }));
        expect(await screen.findByText("Exported 1 referral partner.")).toBeInTheDocument();
        expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "factor-1", code: "123456" });
        expect(exportRows).toHaveBeenCalledTimes(2);
        expect(exportRows.mock.calls[1]).toEqual(exportRows.mock.calls[0]);
        expect((await theFile()).name).toBe("referral-partners-2026-11-19.csv");
        // Nobody was signed out, and the dialog is gone.
        expect(signOut).not.toHaveBeenCalled();
        expect(signIn).not.toHaveBeenCalled();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });

      it("says in words that a code was wrong, or could not be checked, and exports nothing until one is right", async () => {
        mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: "factor-1" }], all: [] }, error: null });
        refusedThenGiven();
        renderPage();
        const dialog = await press();
        const code = within(dialog).getByLabelText(/6-digit code/);
        // Not six digits: not even asked.
        fireEvent.change(code, { target: { value: "12" } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Confirm and export" }));
        expect(await within(dialog).findByRole("alert")).toHaveTextContent("Enter the 6 digits from your authenticator app.");
        expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
        mfa.challengeAndVerify.mockResolvedValueOnce({ data: null, error: Object.assign(new Error("bad"), { code: "mfa_verification_failed" }) });
        fireEvent.change(code, { target: { value: "000000" } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Confirm and export" }));
        expect(await within(dialog).findByText(/That code didn't work/)).toBeInTheDocument();
        mfa.challengeAndVerify.mockResolvedValueOnce({ data: null, error: new Error("network") });
        fireEvent.click(within(dialog).getByRole("button", { name: "Confirm and export" }));
        expect(await within(dialog).findByText(/couldn't check your code/)).toBeInTheDocument();
        expect(exportRows).toHaveBeenCalledTimes(1);
        expect(downloadBlob).not.toHaveBeenCalled();
        // The next right code goes through.
        mfa.challengeAndVerify.mockResolvedValueOnce({ data: {}, error: null });
        fireEvent.click(within(dialog).getByRole("button", { name: "Confirm and export" }));
        expect(await screen.findByText("Exported 1 referral partner.")).toBeInTheDocument();
      });

      it("asks a person with a password and no authenticator for the password, in a dialog, and exports again once it is right", async () => {
        signIn.mockResolvedValue({ error: null });
        refusedThenGiven();
        renderPage();
        const dialog = await press();
        expect(mfa.listFactors).toHaveBeenCalled();
        signIn.mockResolvedValueOnce({ error: Object.assign(new Error("Invalid login credentials"), { code: "invalid_credentials" }) });
        fireEvent.change(within(dialog).getByLabelText("Password"), { target: { value: "wrong" } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Confirm and export" }));
        expect(await within(dialog).findByRole("alert")).toHaveTextContent("That password didn't work. Check it and try again.");
        expect(exportRows).toHaveBeenCalledTimes(1);
        fireEvent.change(within(dialog).getByLabelText("Password"), { target: { value: "correct-horse" } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Confirm and export" }));
        expect(await screen.findByText("Exported 1 referral partner.")).toBeInTheDocument();
        expect(signIn).toHaveBeenLastCalledWith("adv@example.com", "correct-horse");
        expect(exportRows).toHaveBeenCalledTimes(2);
        expect(exportRows.mock.calls[1]).toEqual(exportRows.mock.calls[0]);
        expect(signOut).not.toHaveBeenCalled();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });

      it("asks nothing of a password that cannot be checked just now but says so in words", async () => {
        signIn.mockResolvedValue({ error: new Error("network") });
        refusedThenGiven();
        renderPage();
        const dialog = await press();
        fireEvent.change(within(dialog).getByLabelText("Password"), { target: { value: "x" } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Confirm and export" }));
        expect(await within(dialog).findByText(/couldn't check your password/)).toBeInTheDocument();
        expect(exportRows).toHaveBeenCalledTimes(1);
      });

      it("signs out of this device only, and no other, a person who signed in with Google or Microsoft, who has neither a code nor a password to give", async () => {
        auth.user = { email: "adv@example.com", app_metadata: { providers: ["google"] } };
        refusedThenGiven();
        renderPage();
        const dialog = await press();
        expect(within(dialog).queryByLabelText("Password")).not.toBeInTheDocument();
        expect(within(dialog).queryByLabelText(/6-digit code/)).not.toBeInTheDocument();
        expect(dialog).toHaveTextContent("This signs you out on this device only");
        expect(signOut).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole("button", { name: "Sign in again" }));
        // The sign-out that keeps the person's other devices and brings them back to this page (useAuth, RequireAccess).
        expect(signOut).toHaveBeenCalledWith("step_up");
        expect(exportRows).toHaveBeenCalledTimes(1);
      });

      it("leaves the dialog without exporting when the person cancels, and a later press asks again", async () => {
        mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: "factor-1" }], all: [] }, error: null });
        exportRows.mockRejectedValue(tooOld());
        renderPage();
        const dialog = await press();
        fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
        expect(downloadBlob).not.toHaveBeenCalled();
        expect(await exportButton()).toBeEnabled();
        fireEvent.click(await exportButton());
        expect(await screen.findByRole("dialog")).toBeInTheDocument();
      });

      it("says it could not export, with no dialog, when it cannot tell which way the person can step up", async () => {
        mfa.listFactors.mockResolvedValue({ data: null, error: new Error("network") });
        exportRows.mockRejectedValue(tooOld());
        renderPage();
        fireEvent.click(await exportButton());
        expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't export. Try again.");
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it.each([
      ["tooMany", "That is more than 50,000 rows. Narrow it with a filter and export again."],
      ["support", "Nevermore support can look, not change, so it can't export."],
      ["notAllowed", "You aren't a member of this firm."],
      ["failed", "Couldn't export. Try again."],
    ] as const)("says in words why an export was refused (%s), gives no file, and lets the person try again", async (kind, words) => {
      exportRows.mockRejectedValueOnce(new ExportError(kind, words));
      renderPage();
      fireEvent.click(await exportButton());
      expect(await screen.findByRole("alert")).toHaveTextContent(words);
      expect(downloadBlob).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      // The next try is a fresh one: the words go, the file comes.
      exportRows.mockResolvedValue(answer([row()]));
      fireEvent.click(await exportButton());
      expect(await screen.findByText("Exported 1 referral partner.")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("ends the session when the server no longer accepts it, as every other page does", async () => {
      exportRows.mockRejectedValue(Object.assign(new Error("Your session has expired. Sign in again to continue."), { unauthenticated: true }));
      renderPage();
      fireEvent.click(await exportButton());
      expect(await screen.findByRole("alert")).toHaveTextContent("Your session has expired");
      expect(signOut).toHaveBeenCalledWith("expired");
    });

    it("says what went wrong, never the network's words, when the call itself fails", async () => {
      exportRows.mockRejectedValue(new TypeError("Failed to fetch"));
      renderPage();
      fireEvent.click(await exportButton());
      expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't export. Try again.");
      expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
    });

    it("offers no Export when there is no partner to export or the list has not loaded", async () => {
      api.listReferralPartners.mockResolvedValue([]);
      renderPage();
      await screen.findByText("No referral partners yet.");
      expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
    });

    it("exports the firm the page is showing, not another the person belongs to", async () => {
      api.listMyFirms.mockResolvedValue([alpha, beta]);
      api.listReferralPartners.mockResolvedValue([{ ...acme, firm_id: "firm-b" }]);
      exportRows.mockResolvedValue(answer([row()]));
      renderPage("/advisor/partners?firm=firm-b");
      fireEvent.click(await exportButton());
      await screen.findByText("Exported 1 referral partner.");
      expect(exportRows).toHaveBeenCalledWith({ firmId: "firm-b", table: "referral_partners", filters: {} });
    });

    describe("during a Nevermore support session (ADR 0024)", () => {
      const support = { firm: null, role: "Nevermore support" as const, isOwner: false, isSupport: true, supportEndsAt: null, supportSessionId: null, isPlatformAdmin: true, person: "x" };
      it("offers no download, says so in one plain line where the button was, and asks the database for nothing", async () => {
        render(<MemoryRouter initialEntries={["/advisor/partners"]}><WorkspaceContext.Provider value={support}><AdvisorPartnersPage /></WorkspaceContext.Provider></MemoryRouter>);
        await screen.findByRole("row", { name: /Acme CFO Partners/ });
        expect(screen.queryByRole("button", { name: /Export/ })).not.toBeInTheDocument();
        expect(screen.getByText("Downloads are off during Nevermore support.")).toBeInTheDocument();
        expect(exportRows).not.toHaveBeenCalled();
      });

      it("says nothing of the kind to a member who is not on a support session", async () => {
        renderPage();
        await exportButton();
        expect(screen.queryByText("Downloads are off during Nevermore support.")).not.toBeInTheDocument();
      });
    });
  });
});
