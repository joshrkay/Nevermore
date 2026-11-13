import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Link, MemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "adv@example.com" }, signOut }) }));
// The header asks which firm the address names; these pages are tested at the bare domain.
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => ({ status: "none" }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const api = {
  listReferralPartners: vi.fn(),
  loadIntakeSources: vi.fn(),
  addReferralPartner: vi.fn(),
  updateReferralPartner: vi.fn(),
};
vi.mock("@/lib/advisorApi", () => api);

const { default: AdvisorPartnersPage } = await import("./AdvisorPartnersPage");

const renderPage = () => render(<MemoryRouter initialEntries={["/advisor/partners"]}><AdvisorPartnersPage /></MemoryRouter>);
const acme = {
  code: "acme-cfo",
  name: "Acme CFO Partners",
  kind: "accounting",
  created_at: "2026-11-01T00:00:00Z",
  created_by_email: "adv@example.com",
  updated_at: "2026-11-01T00:00:00Z",
  updated_by_email: "adv@example.com",
};

describe("AdvisorPartnersPage", () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    api.listReferralPartners.mockResolvedValue([acme]);
    api.loadIntakeSources.mockResolvedValue([
      { referral_code: "acme-cfo", utm_campaign: "spring", started: 3, certified: 1 },
      { referral_code: "acme-cfo", utm_campaign: null, started: 2, certified: 1 },
      { referral_code: null, utm_source: "linkedin", started: 9, certified: 4 },
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
    const [from, to] = api.loadIntakeSources.mock.calls[0] as [Date, Date];
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

      await waitFor(() => expect(api.addReferralPartner).toHaveBeenCalledWith("smith-jones-llp", "Smith & Jones LLP", "law_firm"));
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
      await waitFor(() => expect(api.addReferralPartner).toHaveBeenCalledWith("keys", "Keys", expect.any(String)));
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

    it("says so when it can't reach the server at all, in words rather than a blank", async () => {
      api.addReferralPartner.mockRejectedValue(new Error(""));
      const user = await ready();
      await user.type(field("Name"), "Another Acme");
      await user.selectOptions(field("Kind of partner"), "other");
      await user.click(screen.getByRole("button", { name: "Add partner" }));
      expect(await within(form()).findByRole("alert")).toHaveTextContent(/Couldn't add the partner.*connection/);
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
      api.updateReferralPartner.mockResolvedValue({ ...acme, name: "Acme Fractional CFOs" });
      const { user, row } = await openEdit();
      await user.clear(within(row).getByLabelText("Name"));
      await user.type(within(row).getByLabelText("Name"), "Acme Fractional CFOs");
      await user.click(within(row).getByRole("button", { name: "Save" }));
      await waitFor(() => expect(api.updateReferralPartner).toHaveBeenCalledWith("acme-cfo", "Acme Fractional CFOs", "accounting"));
      expect(toast.success).toHaveBeenCalledWith("Partner saved");
      await waitFor(() => expect(screen.getByRole("button", { name: "Edit Acme CFO Partners" })).toBeInTheDocument());
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

    it("does not ask about a saved edit afterwards", async () => {
      api.updateReferralPartner.mockResolvedValue({ ...acme, name: "Acme CFO Partners II" });
      const { user, row } = await openEdit();
      await user.type(within(row).getByLabelText("Name"), " II");
      await user.click(within(row).getByRole("button", { name: "Save" }));
      await screen.findByRole("button", { name: "Edit Acme CFO Partners" });
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

  it("says when there are no partners yet, and offers to try again when it can't load", async () => {
    api.listReferralPartners.mockRejectedValueOnce(new Error("Couldn't load the referral partners.")).mockResolvedValue([]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
    expect(await screen.findByText("No referral partners yet.")).toBeInTheDocument();
  });
});
