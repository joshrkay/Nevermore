import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { user: { id: "u1", email: "advisor@example.com" }, session: { access_token: "tok-1" } as { access_token: string } | null, signOut: vi.fn() };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const api = { fetchOwnedFirms: vi.fn(), fetchMyFirms: vi.fn(), fetchIsAdmin: vi.fn() };
vi.mock("@/lib/advisorApi", () => api);
let firmAddress: { status: "none" } | { status: "known"; address: string; name: string } = { status: "none" };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firmAddress }));

const { clearOwnedFirms, clearMyFirms } = await import("@/hooks/useOwnedFirms");
const { default: AdvisorHeader } = await import("./AdvisorHeader");
const renderHeader = () => render(<MemoryRouter><AdvisorHeader /></MemoryRouter>);
// Lets the question to the database be answered before the page is looked at.
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

// The record of who did what is for the owners of the firm the console is showing (CRM-P2.3, P-1.4): the navigation offers it to
// them alone, so an agent or a lead, or an owner of some other firm, never walks into a page that turns them away.
describe("the advisor header's Activity link", () => {
  const owner = (f: { firm_id: string; name: string; address: string }) => ({ ...f, role: "owner" });
  const alphaFirm = { firm_id: "firm-1", name: "Alpha", address: "alpha" };
  const betaFirm = { firm_id: "firm-2", name: "Beta", address: "beta" };
  beforeEach(() => {
    clearOwnedFirms();
    clearMyFirms();
    auth.session = { access_token: "tok-1" };
    firmAddress = { status: "none" };
    api.fetchOwnedFirms.mockReset();
    api.fetchMyFirms.mockReset().mockResolvedValue([{ ...alphaFirm, role: "agent" }]);
    api.fetchIsAdmin.mockReset().mockResolvedValue(false);
  });

  it("is offered to the owner of the firm the console shows", async () => {
    api.fetchMyFirms.mockResolvedValue([owner(alphaFirm)]);
    renderHeader();
    expect(await screen.findByRole("link", { name: "Activity" })).toHaveAttribute("href", "/advisor/activity");
  });

  it("is not offered to a member who is not an owner, an agent or a lead among them", async () => {
    renderHeader();
    await settle();
    expect(await screen.findByRole("link", { name: "Submissions" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Activity" })).not.toBeInTheDocument();
  });

  it("is not offered to an owner of one firm who is only an agent at another firm's address", async () => {
    firmAddress = { status: "known", address: "beta", name: "Beta" };
    api.fetchMyFirms.mockResolvedValue([owner(alphaFirm), { ...betaFirm, role: "agent" }]);
    renderHeader();
    await settle();
    expect(screen.queryByRole("link", { name: "Activity" })).not.toBeInTheDocument();
  });

  it("is not offered at the address of a firm the owner of another firm does not belong to", async () => {
    firmAddress = { status: "known", address: "beta", name: "Beta" };
    api.fetchMyFirms.mockResolvedValue([owner(alphaFirm)]);
    renderHeader();
    await settle();
    expect(screen.queryByRole("link", { name: "Activity" })).not.toBeInTheDocument();
  });

  it("is not offered on the bare domain to an owner of several firms, as the console is closed to a member of several", async () => {
    api.fetchMyFirms.mockResolvedValue([owner(alphaFirm), owner(betaFirm)]);
    renderHeader();
    await settle();
    expect(screen.queryByRole("link", { name: "Activity" })).not.toBeInTheDocument();
  });

  it("is offered once the sign-in changes to one that owns the firm, such as after the second factor, not held back by the answer from before it", async () => {
    api.fetchMyFirms.mockResolvedValueOnce([]).mockResolvedValue([owner(alphaFirm)]);
    const view = renderHeader();
    await settle();
    expect(screen.queryByRole("link", { name: "Activity" })).not.toBeInTheDocument();
    auth.session = { access_token: "tok-2-after-second-factor" };
    view.rerender(<MemoryRouter><AdvisorHeader /></MemoryRouter>);
    expect(await screen.findByRole("link", { name: "Activity" })).toBeInTheDocument();
    expect(api.fetchMyFirms).toHaveBeenCalledTimes(2);
  });

  it("is not offered while the answer is unknown, or when it can't be had", async () => {
    api.fetchMyFirms.mockRejectedValue(new Error("offline"));
    renderHeader();
    await settle();
    expect(screen.queryByRole("link", { name: "Activity" })).not.toBeInTheDocument();
  });
});

// The members page (CRM-P1.5) is for the owners of the firm the console shows, offered by the same rule as the record of who did what:
// the link is there for them and for no one else, so a member, a platform admin or an owner of another firm never walks into a refusal.
describe("the advisor header's Members link", () => {
  const owner = (f: { firm_id: string; name: string; address: string }) => ({ ...f, role: "owner" });
  const alphaFirm = { firm_id: "firm-1", name: "Alpha", address: "alpha" };
  beforeEach(() => {
    clearOwnedFirms();
    clearMyFirms();
    auth.session = { access_token: "tok-1" };
    firmAddress = { status: "none" };
    api.fetchOwnedFirms.mockReset();
    api.fetchMyFirms.mockReset().mockResolvedValue([{ ...alphaFirm, role: "agent" }]);
    api.fetchIsAdmin.mockReset().mockResolvedValue(false);
  });

  it("is offered to the owner of the firm the console shows", async () => {
    api.fetchMyFirms.mockResolvedValue([owner(alphaFirm)]);
    renderHeader();
    expect(await screen.findByRole("link", { name: "Members" })).toHaveAttribute("href", "/advisor/members");
  });

  it("is not offered to a member who is not an owner", async () => {
    renderHeader();
    await settle();
    expect(await screen.findByRole("link", { name: "Submissions" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Members" })).not.toBeInTheDocument();
  });

  it("is not offered to a platform admin who belongs to no firm (D-16)", async () => {
    api.fetchMyFirms.mockResolvedValue([]);
    api.fetchIsAdmin.mockResolvedValue(true);
    renderHeader();
    await settle();
    expect(screen.queryByRole("link", { name: "Members" })).not.toBeInTheDocument();
  });

  it("is not offered at the address of a firm the owner of another firm does not belong to", async () => {
    firmAddress = { status: "known", address: "beta", name: "Beta" };
    api.fetchMyFirms.mockResolvedValue([owner(alphaFirm)]);
    renderHeader();
    await settle();
    expect(screen.queryByRole("link", { name: "Members" })).not.toBeInTheDocument();
  });
});

// The console's menu is the firm's (story P-1.4): its links are the ones the person can open, and nothing in it names another
// firm or says "advisor" of a member.
describe("the console header's menu", () => {
  const alpha = { firm_id: "firm-1", name: "Alpha Advisory", address: "alpha", role: "agent" };
  const beta = { firm_id: "firm-2", name: "Beta Brokers", address: "beta", role: "owner" };
  beforeEach(() => {
    clearOwnedFirms();
    clearMyFirms();
    api.fetchOwnedFirms.mockReset().mockResolvedValue([]);
    api.fetchMyFirms.mockReset().mockResolvedValue([alpha]);
    api.fetchIsAdmin.mockReset().mockResolvedValue(false);
  });

  it("names the member's firm, and says nothing of an advisor", async () => {
    renderHeader();
    expect(await screen.findByText("Alpha Advisory")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Console" })).toBeInTheDocument();
    expect(screen.queryByText("Advisor")).not.toBeInTheDocument();
  });

  it("offers a member the firm's pages and not the platform's", async () => {
    renderHeader();
    await settle();
    for (const name of ["Submissions", "Outbox & Notifications", "Funnel", "Partners", "PEOs", "Mailbox"]) {
      expect(await screen.findByRole("link", { name })).toBeInTheDocument();
    }
    for (const name of ["Held mail", "Firms", "Organisations"]) expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
  });

  it("offers a platform admin who belongs to no firm the platform's pages and none of a firm's (D-16)", async () => {
    api.fetchMyFirms.mockResolvedValue([]);
    api.fetchIsAdmin.mockResolvedValue(true);
    renderHeader();
    await settle();
    for (const name of ["Held mail", "Firms", "Organisations"]) expect(await screen.findByRole("link", { name })).toBeInTheDocument();
    for (const name of ["Submissions", "Outbox & Notifications", "Funnel", "Partners", "PEOs", "Mailbox", "Activity"]) {
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    }
  });

  it("offers both to an admin who is a member, as an owner of Edgar Allan Advisory is", async () => {
    api.fetchIsAdmin.mockResolvedValue(true);
    renderHeader();
    await settle();
    expect(await screen.findByRole("link", { name: "Held mail" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Submissions" })).toBeInTheDocument();
  });

  it("names no firm when the person belongs to several, since the console can't show them together", async () => {
    api.fetchMyFirms.mockResolvedValue([alpha, beta]);
    renderHeader();
    await settle();
    expect(screen.queryByText("Alpha Advisory")).not.toBeInTheDocument();
    expect(screen.queryByText("Beta Brokers")).not.toBeInTheDocument();
  });

  it("badges the platform's own view as Platform, and a member of several firms as Firm even when they are also an admin", async () => {
    api.fetchMyFirms.mockResolvedValue([]);
    api.fetchIsAdmin.mockResolvedValue(true);
    const first = renderHeader();
    expect(await screen.findByText("Platform")).toBeInTheDocument();
    first.unmount();
    clearMyFirms();
    api.fetchMyFirms.mockResolvedValue([alpha, beta]);
    renderHeader();
    await settle();
    expect(screen.getByText("Firm")).toBeInTheDocument();
    expect(screen.queryByText("Platform")).not.toBeInTheDocument();
  });

  it("offers nothing of a firm until it is known, or when it can't be had", async () => {
    api.fetchMyFirms.mockRejectedValue(new Error("offline"));
    api.fetchIsAdmin.mockRejectedValue(new Error("offline"));
    renderHeader();
    await settle();
    for (const name of ["Submissions", "Held mail"]) expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
  });
});
