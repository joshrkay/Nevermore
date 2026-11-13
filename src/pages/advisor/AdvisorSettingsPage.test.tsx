import { act, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { user: { id: "u1", email: "sam@example.com" }, session: { access_token: "t" }, signOut: vi.fn() };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const api = { fetchMyFirms: vi.fn(), fetchOwnedFirms: vi.fn(), fetchIsAdmin: vi.fn() };
vi.mock("@/lib/advisorApi", () => api);
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => ({ status: "none" }) }));

const { clearMyFirms } = await import("@/hooks/useOwnedFirms");
const { default: AdvisorSettingsPage } = await import("./AdvisorSettingsPage");

const renderPage = async (role: string) => {
  clearMyFirms();
  api.fetchMyFirms.mockResolvedValue([{ firm_id: "f1", name: "Alpha", address: "alpha", role }]);
  render(<MemoryRouter><AdvisorSettingsPage /></MemoryRouter>);
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return within(screen.getByRole("list", { name: "Settings pages" }));
};

beforeEach(() => api.fetchIsAdmin.mockResolvedValue(false));

describe("the Settings page", () => {
  it("links an owner to Mailbox, Invitations, Activity, Referral partners, PEOs and Outbox", async () => {
    const list = await renderPage("owner");
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    const links = list.getAllByRole("link").map((l) => [l.querySelector("span span")?.textContent, l.getAttribute("href")]);
    expect(links).toEqual([
      ["Mailbox", "/advisor/mailbox"],
      ["Invitations", "/firm/invitations"],
      ["Activity", "/advisor/activity"],
      ["Referral partners", "/advisor/partners"],
      ["PEOs", "/advisor/peos"],
      ["Outbox", "/advisor/outbox"],
    ]);
  });

  it("leaves Activity out for an agent or a lead, who would only be turned away", async () => {
    for (const role of ["agent", "lead"]) {
      const list = await renderPage(role);
      expect(list.queryByRole("link", { name: /Activity/ })).not.toBeInTheDocument();
      expect(list.getByRole("link", { name: /Outbox/ })).toBeInTheDocument();
      document.body.innerHTML = "";
    }
  });
});
