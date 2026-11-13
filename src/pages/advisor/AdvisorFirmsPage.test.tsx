import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "admin@example.com" }, signOut: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const advisor = { fetchIsAdmin: vi.fn() };
vi.mock("@/lib/advisorApi", () => advisor);
const firms = { fetchWaitingFirms: vi.fn(), decideFirm: vi.fn() };
vi.mock("@/lib/firmApi", () => firms);

const { default: AdvisorFirmsPage } = await import("./AdvisorFirmsPage");

const renderPage = () => render(<MemoryRouter><AdvisorFirmsPage /></MemoryRouter>);
const firm = (over: Record<string, unknown> = {}) => ({
  id: "f1", name: "Fresh Benefits", address: "fresh-benefits", ownerEmail: "founder@example.test", signedUpAt: "2026-11-16T10:00:00Z", ...over,
});

// A platform admin sees the firms waiting for approval, and approves or refuses each (story CRM-P1.1 with Q-1.2).
describe("AdvisorFirmsPage", () => {
  beforeEach(() => {
    advisor.fetchIsAdmin.mockReset().mockResolvedValue(true);
    firms.fetchWaitingFirms.mockReset().mockResolvedValue([firm(), firm({ id: "f2", name: "Capital Brokers", address: "capital-brokers", ownerEmail: null })]);
    firms.decideFirm.mockReset().mockResolvedValue(undefined);
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("is for admins, and loads nothing for anyone else", async () => {
    advisor.fetchIsAdmin.mockResolvedValue(false);
    renderPage();
    expect(await screen.findByText("Only an admin can approve firms.")).toBeInTheDocument();
    expect(firms.fetchWaitingFirms).not.toHaveBeenCalled();
  });

  it("lists each waiting firm with its name, address and who signed it up", async () => {
    renderPage();
    const list = await screen.findByRole("list", { name: "Firms waiting for approval" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Fresh Benefits");
    expect(items[0]).toHaveTextContent("fresh-benefits.nevermorepeo.com");
    expect(items[0]).toHaveTextContent("founder@example.test");
    expect(items[1]).toHaveTextContent("Capital Brokers");
  });

  it("says plainly when no firm is waiting", async () => {
    firms.fetchWaitingFirms.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("No firm is waiting for approval.")).toBeInTheDocument();
  });

  it("approves a firm with the note typed for it, then reloads the list", async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText("Note for Fresh Benefits"), { target: { value: " Known broker " } });
    firms.fetchWaitingFirms.mockResolvedValue([firm({ id: "f2", name: "Capital Brokers", address: "capital-brokers" })]);
    fireEvent.click(screen.getByRole("button", { name: "Approve Fresh Benefits" }));
    await waitFor(() => expect(firms.decideFirm).toHaveBeenCalledWith("f1", true, "Known broker"));
    await waitFor(() => expect(screen.queryByText("Fresh Benefits")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith("Fresh Benefits is approved.");
  });

  it("asks before it refuses, and a refusal can't be taken back", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Refuse Fresh Benefits" }));
    expect(firms.decideFirm).not.toHaveBeenCalled();
    expect(screen.getByText(/can't be undone/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep waiting" }));
    expect(firms.decideFirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Refuse Fresh Benefits" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, refuse" }));
    await waitFor(() => expect(firms.decideFirm).toHaveBeenCalledWith("f1", false, undefined));
    expect(toast.success).toHaveBeenCalledWith("Fresh Benefits is refused.");
  });

  it("shows the database's reason when a decision fails, and keeps the firm listed", async () => {
    firms.decideFirm.mockRejectedValue(new Error("That firm has been decided already."));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Approve Fresh Benefits" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("That firm has been decided already."));
    expect(screen.getByText("Fresh Benefits")).toBeInTheDocument();
  });

  it("offers a retry when it can't load", async () => {
    firms.fetchWaitingFirms.mockRejectedValueOnce(new Error("boom")).mockResolvedValue([]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
    expect(await screen.findByText("No firm is waiting for approval.")).toBeInTheDocument();
  });

  it("lets no second decision start while one is being saved", async () => {
    let finish: () => void = () => {};
    firms.decideFirm.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Approve Fresh Benefits" }));
    expect(screen.getByRole("button", { name: "Approve Capital Brokers" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Refuse Capital Brokers" })).toBeDisabled();
    finish();
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });
});
