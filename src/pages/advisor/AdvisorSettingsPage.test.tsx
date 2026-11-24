import { act, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { user: { id: "u1", email: "sam@example.com" }, session: { access_token: "t" }, signOut: vi.fn() };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const api = { fetchMyFirms: vi.fn(), fetchOwnedFirms: vi.fn(), fetchIsAdmin: vi.fn() };
vi.mock("@/lib/advisorApi", () => api);
// The page also holds the "Leave this firm" action, which reaches the database through its own module; leaving is tested in AdvisorSettingsLeave.test.tsx.
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
let firmAddress: { status: "none" } | { status: "known"; address: string; name: string } = { status: "none" };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firmAddress }));

const { clearMyFirms } = await import("@/hooks/useOwnedFirms");
const { default: AdvisorSettingsPage } = await import("./AdvisorSettingsPage");
const { WorkspaceProvider } = await import("@/components/workspace/useWorkspace");

const renderPage = async (role: string) => {
  clearMyFirms();
  api.fetchMyFirms.mockResolvedValue([{ firm_id: "f1", name: "Alpha", address: "alpha", role }]);
  render(<MemoryRouter><WorkspaceProvider><AdvisorSettingsPage /></WorkspaceProvider></MemoryRouter>);
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return within(screen.getByRole("list", { name: "Settings pages" }));
};

beforeEach(() => { firmAddress = { status: "none" }; api.fetchIsAdmin.mockResolvedValue(false); });

describe("the Settings page", () => {
  it("links an owner to Mailbox, Invitations, Members, Activity, Import, Referral partners, PEOs and Outbox", async () => {
    const list = await renderPage("owner");
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    const links = list.getAllByRole("link").map((l) => [l.querySelector("span span")?.textContent, l.getAttribute("href")]);
    expect(links).toEqual([
      ["Mailbox", "/advisor/mailbox"],
      ["Invitations", "https://alpha.nevermorepeo.com/firm/invitations"],
      ["Members", "/advisor/members"],
      ["Activity", "/advisor/activity"],
      ["Import", "/import"],
      ["Referral partners", "/advisor/partners"],
      ["PEOs", "/advisor/peos"],
      ["Outbox", "/advisor/outbox"],
    ]);
  });

  // Catches: Settings telling a person the product reads replies in their mailbox, which it never does (send only: docs/adr/0005, CRM-E1.1).
  it("describes the Mailbox as the one you write from, which Nevermore only sends from", async () => {
    const list = await renderPage("agent");
    const mailbox = list.getByRole("link", { name: /Mailbox/ });
    expect(mailbox).toHaveTextContent(/only sends/);
    expect(mailbox).not.toHaveTextContent(/read/i);
  });

  it("leaves Activity out for an agent or a lead, who would only be turned away", async () => {
    for (const role of ["agent", "lead"]) {
      const list = await renderPage(role);
      expect(list.queryByRole("link", { name: /Activity/ })).not.toBeInTheDocument();
      expect(list.getByRole("link", { name: /Outbox/ })).toBeInTheDocument();
      document.body.innerHTML = "";
    }
  });

  // CRM-X4.1. Catches: an agent sent to a page that can only tell them they may not import (D-24: no dead button), or a lead not offered it.
  it("offers Import to a lead and not to an agent", async () => {
    const lead = await renderPage("lead");
    expect(lead.getByRole("link", { name: /Import/ })).toHaveAttribute("href", "/import");
    document.body.innerHTML = "";
    const agent = await renderPage("agent");
    expect(agent.queryByRole("link", { name: /Import/ })).not.toBeInTheDocument();
  });

  // On the bare domain the page behind Invitations needs the firm's own address, so the link goes there.
  it("sends Invitations to the firm's own address from the bare domain, as a plain link", async () => {
    const list = await renderPage("owner");
    expect(list.getByRole("link", { name: /Invitations/ })).toHaveAttribute("href", "https://alpha.nevermorepeo.com/firm/invitations");
    expect(list.getByRole("link", { name: /Outbox/ })).toHaveAttribute("href", "/advisor/outbox");
  });

  // Catches (Q-2.1): a firm with no way to take its statement of registrations, or a Nevermore support session offered a download it can't make (D-128).
  it("offers every member the firm's statement of registrations with PEOs, and support none", async () => {
    for (const role of ["agent", "lead", "owner"]) {
      await renderPage(role);
      const section = screen.getByRole("region", { name: "Registrations with PEOs" });
      expect(within(section).getByRole("button", { name: "Download the statement (CSV)" })).toBeInTheDocument();
      document.body.innerHTML = "";
    }
    await renderPage("support");
    expect(screen.queryByRole("region", { name: "Registrations with PEOs" })).not.toBeInTheDocument();
  });

  it("keeps Invitations inside the app at a firm's address", async () => {
    firmAddress = { status: "known", address: "alpha", name: "Alpha" };
    const list = await renderPage("owner");
    expect(list.getByRole("link", { name: /Invitations/ })).toHaveAttribute("href", "/firm/invitations");
  });
});
