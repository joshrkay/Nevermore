import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
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

// Every intake a browser starts belongs to the default firm (D-101), so only its partners' links can work today. Its id is the one
// default_firm_id() returns (migration 20261116090000_firms.sql).
const DEFAULT_FIRM = "00000000-0000-4000-8000-00000000eaa1";
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

  it("adds a partner under a code taken from its name, until the advisor types one", async () => {
    api.addReferralPartner.mockResolvedValue({ ...acme, code: "smith-jones-llp", name: "Smith & Jones LLP", kind: "law_firm" });
    renderPage();
    await screen.findByRole("row", { name: /Acme CFO Partners/ });
    const add = screen.getByRole("button", { name: "Add partner" });
    expect(add).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Smith & Jones LLP" } });
    expect(screen.getByLabelText("Code in their link")).toHaveValue("smith-jones-llp");
    expect(screen.getByText(/Their link: https:\/\/nevermorepeo\.com\/\?ref=smith-jones-llp/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Kind of partner"), { target: { value: "law_firm" } });
    fireEvent.click(add);

    await waitFor(() => expect(api.addReferralPartner).toHaveBeenCalledWith(DEFAULT_FIRM, "smith-jones-llp", "Smith & Jones LLP", "law_firm"));
    await waitFor(() => expect(api.listReferralPartners).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("refuses a badly formed code before sending it, and shows the database's reason for one it refuses", async () => {
    api.addReferralPartner.mockRejectedValue(new Error("The code acme-cfo is already a partner's. Choose another."));
    renderPage();
    await screen.findByRole("row", { name: /Acme CFO Partners/ });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Another Acme" } });
    fireEvent.change(screen.getByLabelText("Kind of partner"), { target: { value: "other" } });
    fireEvent.change(screen.getByLabelText("Code in their link"), { target: { value: "acme cfo" } });
    expect(screen.getByText(/Use only lowercase letters/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add partner" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Code in their link"), { target: { value: "acme-cfo" } });
    fireEvent.click(screen.getByRole("button", { name: "Add partner" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already a partner's");
    expect(screen.getByLabelText("Name")).toHaveValue("Another Acme");
  });

  it("renames a partner, keeping its code", async () => {
    api.updateReferralPartner.mockResolvedValue({ ...acme, name: "Acme Fractional CFOs" });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit Acme CFO Partners" }));
    fireEvent.change(screen.getByLabelText("Name", { selector: "#name-acme-cfo" }), { target: { value: "Acme Fractional CFOs" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.updateReferralPartner).toHaveBeenCalledWith(DEFAULT_FIRM, "acme-cfo", "Acme Fractional CFOs", "accounting"));
    expect(toast.success).toHaveBeenCalledWith("Partner saved");
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
    });

    it("offers no link while adding a partner to another firm, and the toast carries none", async () => {
      atBeta();
      api.addReferralPartner.mockResolvedValue({ ...betaAcme, code: "new-co", name: "New Co" });
      renderPage();
      await screen.findByRole("row", { name: /Beta's Acme/ });
      fireEvent.change(screen.getByLabelText("Name", { selector: "#partner-name" }), { target: { value: "New Co" } });
      expect(screen.getByLabelText("Code in their link")).toHaveValue("new-co");
      expect(screen.queryByText(/Their link:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/nevermorepeo\.com/)).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Kind of partner", { selector: "#partner-kind" }), { target: { value: "other" } });
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
      api.updateReferralPartner.mockResolvedValue(betaAcme);
      api.addReferralPartner.mockResolvedValue(betaAcme);
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Edit Beta's Acme" }));
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(api.updateReferralPartner).toHaveBeenCalledWith("firm-b", "acme-cfo", "Beta's Acme", "accounting"));
      expect(api.listReferralPartners).toHaveBeenCalledWith("firm-b");
      expect(api.listReferralPartners).not.toHaveBeenCalledWith(DEFAULT_FIRM);
      expect(screen.queryByLabelText("Firm")).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Name", { selector: "#partner-name" }), { target: { value: "New Co" } });
      fireEvent.change(screen.getByLabelText("Kind of partner", { selector: "#partner-kind" }), { target: { value: "other" } });
      fireEvent.click(screen.getByRole("button", { name: "Add partner" }));
      await waitFor(() => expect(api.addReferralPartner).toHaveBeenCalledWith("firm-b", "new-co", "New Co", "other"));
    });

    it("on the bare domain asks a member of several firms which one, and acts for the one chosen", async () => {
      api.listMyFirms.mockResolvedValue([alpha, beta]);
      api.listReferralPartners.mockImplementation(async (firm: string) => (firm === "firm-b" ? [betaAcme] : [acme]));
      api.updateReferralPartner.mockResolvedValue(betaAcme);
      renderPage();
      const choose = await screen.findByLabelText("Firm");
      expect(api.listReferralPartners).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: "Add partner" })).not.toBeInTheDocument();
      fireEvent.change(choose, { target: { value: "firm-b" } });
      fireEvent.click(await screen.findByRole("button", { name: "Edit Beta's Acme" }));
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(api.updateReferralPartner).toHaveBeenCalledWith("firm-b", "acme-cfo", "Beta's Acme", "accounting"));
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
      fireEvent.change(screen.getByLabelText("Name", { selector: "#partner-name" }), { target: { value: "Draft For Alpha" } });

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
      expect(screen.getByLabelText("Name", { selector: "#partner-name" })).toHaveValue("");
    });

    it("does not show a reload of the same firm as a loading page", async () => {
      api.updateReferralPartner.mockResolvedValue(acme);
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
