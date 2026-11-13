import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

const renderPage = (path = "/advisor/partners") => render(<MemoryRouter initialEntries={[path]}><AdvisorPartnersPage /></MemoryRouter>);
const alpha = { id: "firm-a", name: "Alpha Advisory", address: "alpha" };
const beta = { id: "firm-b", name: "Beta Brokers", address: "beta" };
const acme = {
  firm_id: "firm-a",
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
      { firm_id: "firm-a", referral_code: "acme-cfo", utm_campaign: "spring", started: 3, certified: 1 },
      { firm_id: "firm-a", referral_code: "acme-cfo", utm_campaign: null, started: 2, certified: 1 },
      { firm_id: "firm-a", referral_code: null, utm_source: "linkedin", started: 9, certified: 4 },
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

    await waitFor(() => expect(api.addReferralPartner).toHaveBeenCalledWith("firm-a", "smith-jones-llp", "Smith & Jones LLP", "law_firm"));
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
    await waitFor(() => expect(api.updateReferralPartner).toHaveBeenCalledWith("firm-a", "acme-cfo", "Acme Fractional CFOs", "accounting"));
    expect(toast.success).toHaveBeenCalledWith("Partner saved");
  });

  it("says when there are no partners yet, and offers to try again when it can't load", async () => {
    api.listReferralPartners.mockRejectedValueOnce(new Error("Couldn't load the referral partners.")).mockResolvedValue([]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
    expect(await screen.findByText("No referral partners yet.")).toBeInTheDocument();
  });
  describe("which firm it acts for", () => {
    const betaAcme = { ...acme, firm_id: "firm-b", name: "Beta's Acme" };

    it("reads the partners of the only firm the person belongs to", async () => {
      renderPage();
      await screen.findByRole("row", { name: /Acme CFO Partners/ });
      expect(api.listReferralPartners).toHaveBeenCalledWith("firm-a");
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
      expect(api.listReferralPartners).not.toHaveBeenCalledWith("firm-a");
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
        { firm_id: "firm-a", referral_code: "acme-cfo", started: 3, certified: 1 },
        { firm_id: "firm-b", referral_code: "acme-cfo", started: 40, certified: 20 },
      ]);
      renderPage();
      const row = await screen.findByRole("row", { name: /Acme CFO Partners/ });
      const cells = within(row).getAllByRole("cell");
      expect(cells[1]).toHaveTextContent(/^3$/);
      expect(cells[2]).toHaveTextContent(/^1$/);
    });

    it("says so when the person belongs to no firm", async () => {
      api.listMyFirms.mockResolvedValue([]);
      renderPage();
      expect(await screen.findByText(/aren't a member of a firm/)).toBeInTheDocument();
      expect(api.listReferralPartners).not.toHaveBeenCalled();
    });
  });
});
