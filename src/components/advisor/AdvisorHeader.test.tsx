import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "advisor@example.com" }, signOut: vi.fn() }) }));
const api = { fetchOwnedFirms: vi.fn() };
vi.mock("@/lib/advisorApi", () => api);

const { clearOwnedFirms } = await import("@/lib/ownedFirms");
const { default: AdvisorHeader } = await import("./AdvisorHeader");
const renderHeader = () => render(<MemoryRouter><AdvisorHeader /></MemoryRouter>);
// Lets the question to the database be answered before the page is looked at.
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

// The record of who did what is for a firm's owners (CRM-P2.3): the console's navigation offers it to them alone, so an
// agent or a lead never walks into a page that turns them away (each turn-away is an auth_denied event on the alert).
describe("the advisor header's Activity link", () => {
  beforeEach(() => { clearOwnedFirms(); api.fetchOwnedFirms.mockReset(); });

  it("is offered to someone who owns a firm", async () => {
    api.fetchOwnedFirms.mockResolvedValue([{ firm_id: "firm-1", name: "Alpha" }]);
    renderHeader();
    expect(await screen.findByRole("link", { name: "Activity" })).toHaveAttribute("href", "/advisor/activity");
  });

  it("is not offered to someone who owns no firm, an agent or a lead among them", async () => {
    api.fetchOwnedFirms.mockResolvedValue([]);
    renderHeader();
    await settle();
    expect(await screen.findByRole("link", { name: "Submissions" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Activity" })).not.toBeInTheDocument();
  });

  it("is not offered while the answer is unknown, or when it can't be had", async () => {
    api.fetchOwnedFirms.mockRejectedValue(new Error("offline"));
    renderHeader();
    await settle();
    expect(screen.queryByRole("link", { name: "Activity" })).not.toBeInTheDocument();
  });
});
