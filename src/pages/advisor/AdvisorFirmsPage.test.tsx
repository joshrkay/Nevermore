import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "admin@example.com" }, signOut: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const advisor = { fetchIsAdmin: vi.fn() };
vi.mock("@/lib/advisorApi", () => advisor);
const firms = { fetchWaitingFirms: vi.fn(), decideFirm: vi.fn(), fetchFirmStates: vi.fn(), suspendFirm: vi.fn(), liftFirmSuspension: vi.fn() };
vi.mock("@/lib/firmApi", () => firms);

const { default: AdvisorFirmsPage } = await import("./AdvisorFirmsPage");

const renderPage = () => render(<MemoryRouter><AdvisorFirmsPage /></MemoryRouter>);
const state = (over: Record<string, unknown> = {}) => ({
  id: "s1", name: "Harbor Benefits", address: "harbor-benefits", state: "approved", signedUpAt: "2026-11-10T10:00:00Z",
  suspended: false, suspendedAt: null, suspensionReason: null, ...over,
});
const firm = (over: Record<string, unknown> = {}) => ({
  id: "f1", name: "Fresh Benefits", address: "fresh-benefits", signedUpByEmail: "founder@example.test", signedUpAt: "2026-11-16T10:00:00Z", ...over,
});

// A platform admin sees the firms waiting for approval, and approves or refuses each (story CRM-P1.1 with Q-1.2).
describe("AdvisorFirmsPage", () => {
  beforeEach(() => {
    advisor.fetchIsAdmin.mockReset().mockResolvedValue(true);
    firms.fetchWaitingFirms.mockReset().mockResolvedValue([firm(), firm({ id: "f2", name: "Capital Brokers", address: "capital-brokers", signedUpByEmail: null })]);
    firms.decideFirm.mockReset().mockResolvedValue(undefined);
    firms.fetchFirmStates.mockReset().mockResolvedValue([state()]);
    firms.suspendFirm.mockReset().mockResolvedValue(undefined);
    firms.liftFirmSuspension.mockReset().mockResolvedValue(undefined);
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  // Catches: a firm waiting out its 30 days looks like any other, a closed one shows no date or no count, or a closed firm can still be suspended.
  it("shows a firm that is closing with the day it closes, and a closed one with the day it closed and what was deleted", async () => {
    firms.fetchFirmStates.mockResolvedValue([
      state({ id: "c1", name: "Closing Co", address: "closing-co", closingOn: "2026-12-18T12:00:00Z" }),
      state({ id: "c2", name: "Closed Co", address: "closed-co", closedOn: "2026-11-01T12:00:00Z", closureDeleted: { saved_views: 2, referral_partners: 1, memberships_ended: 3 } }),
    ]);
    renderPage();
    const items = within(await screen.findByRole("list", { name: "Every firm" })).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Closing on December 18, 2026");
    expect(within(items[0]).getByRole("button", { name: "Suspend Closing Co" })).toBeInTheDocument();
    expect(items[1]).toHaveTextContent("Closed on November 1, 2026");
    expect(items[1]).toHaveTextContent("Deleted, by table: saved views 2, referral partners 1, memberships ended 3.");
    expect(within(items[1]).queryByRole("button")).not.toBeInTheDocument();
  });

  it("is for admins, and loads nothing for anyone else", async () => {
    advisor.fetchIsAdmin.mockResolvedValue(false);
    renderPage();
    expect(await screen.findByText("Only an admin can approve or suspend firms.")).toBeInTheDocument();
    expect(firms.fetchWaitingFirms).not.toHaveBeenCalled();
    expect(firms.fetchFirmStates).not.toHaveBeenCalled();
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

  it("treats a session that ended during a decision as an ended session, not a toast to retry", async () => {
    firms.decideFirm.mockRejectedValue(Object.assign(new Error("Your session has expired. Sign in again to continue."), { unauthenticated: true }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Approve Fresh Benefits" }));
    expect(await screen.findByText("Your session has expired.")).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  // Suspending a firm and lifting the suspension (story CRM-P1.8). Suspension is separate from the approval decision.
  describe("every firm, and suspending one", () => {
    const list = async () => within(await screen.findByRole("list", { name: "Every firm" })).getAllByRole("listitem");

    it("lists every firm with its approval state, and for a suspended one that it is suspended, why and since when", async () => {
      firms.fetchFirmStates.mockResolvedValue([
        state(),
        state({ id: "s2", name: "Cedar Cover", address: "cedar-cover", state: "waiting" }),
        state({ id: "s3", name: "Dune Dealers", address: "dune-dealers", state: "refused" }),
        state({ id: "s4", name: "Elm Agents", address: "elm-agents", suspended: true, suspendedAt: "2026-11-17T09:00:00Z", suspensionReason: "Unpaid invoice" }),
      ]);
      renderPage();
      const items = await list();
      expect(items).toHaveLength(4);
      expect(items[0]).toHaveTextContent("Harbor Benefits");
      expect(items[0]).toHaveTextContent("harbor-benefits.nevermorepeo.com");
      expect(items[0]).toHaveTextContent("Approved");
      expect(items[0]).not.toHaveTextContent("Suspended");
      expect(items[1]).toHaveTextContent("Waiting for approval");
      expect(items[2]).toHaveTextContent("Refused");
      expect(items[3]).toHaveTextContent("Suspended");
      expect(items[3]).toHaveTextContent("Unpaid invoice");
      expect(items[3]).toHaveTextContent("Approved");
    });

    it("says plainly when there are no firms", async () => {
      firms.fetchFirmStates.mockResolvedValue([]);
      renderPage();
      expect(await screen.findByText("There are no firms yet.")).toBeInTheDocument();
    });

    it("offers a firm that is waiting for approval a suspension too: it stays waiting and is simply also suspended", async () => {
      firms.fetchFirmStates.mockResolvedValue([state({ id: "s2", name: "Cedar Cover", state: "waiting", suspended: true, suspendedAt: "2026-11-17T09:00:00Z", suspensionReason: "Looks like a PEO" })]);
      renderPage();
      const [item] = await list();
      expect(item).toHaveTextContent("Waiting for approval");
      expect(item).toHaveTextContent("Suspended");
      expect(within(item).getByRole("button", { name: "Lift suspension of Cedar Cover" })).toBeInTheDocument();
    });

    it("asks for confirmation and a reason before it suspends, and suspends nothing until both", async () => {
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Suspend Harbor Benefits" }));
      expect(firms.suspendFirm).not.toHaveBeenCalled();
      expect(screen.getByText(/can't use it until you lift/)).toBeInTheDocument();
      const confirm = screen.getByRole("button", { name: "Yes, suspend" });
      expect(confirm).toBeDisabled();
      fireEvent.change(screen.getByLabelText("Reason for suspending Harbor Benefits"), { target: { value: "   " } });
      expect(confirm).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Keep it running" }));
      expect(screen.queryByLabelText("Reason for suspending Harbor Benefits")).not.toBeInTheDocument();
      expect(firms.suspendFirm).not.toHaveBeenCalled();
    });

    it("suspends with the reason typed, says so, and reloads", async () => {
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Suspend Harbor Benefits" }));
      fireEvent.change(screen.getByLabelText("Reason for suspending Harbor Benefits"), { target: { value: " Unpaid invoice " } });
      firms.fetchFirmStates.mockResolvedValue([state({ suspended: true, suspendedAt: "2026-11-17T09:00:00Z", suspensionReason: "Unpaid invoice" })]);
      fireEvent.click(screen.getByRole("button", { name: "Yes, suspend" }));
      await waitFor(() => expect(firms.suspendFirm).toHaveBeenCalledWith("s1", "Unpaid invoice"));
      expect(toast.success).toHaveBeenCalledWith("Harbor Benefits is suspended.");
      expect(await screen.findByRole("button", { name: "Lift suspension of Harbor Benefits" })).toBeInTheDocument();
    });

    it("asks before it lifts a suspension, then lifts it", async () => {
      firms.fetchFirmStates.mockResolvedValue([state({ suspended: true, suspendedAt: "2026-11-17T09:00:00Z", suspensionReason: "Unpaid invoice" })]);
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Lift suspension of Harbor Benefits" }));
      expect(firms.liftFirmSuspension).not.toHaveBeenCalled();
      expect(screen.getByText(/Its members get everything back as it was/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Keep suspended" }));
      expect(firms.liftFirmSuspension).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Lift suspension of Harbor Benefits" }));
      firms.fetchFirmStates.mockResolvedValue([state()]);
      fireEvent.click(screen.getByRole("button", { name: "Yes, lift" }));
      await waitFor(() => expect(firms.liftFirmSuspension).toHaveBeenCalledWith("s1"));
      expect(toast.success).toHaveBeenCalledWith("The suspension of Harbor Benefits is lifted.");
      expect(await screen.findByRole("button", { name: "Suspend Harbor Benefits" })).toBeInTheDocument();
    });

    it("shows the database's reason when suspending fails, and keeps the form for another go", async () => {
      firms.suspendFirm.mockRejectedValue(new Error("That firm is suspended already."));
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Suspend Harbor Benefits" }));
      fireEvent.change(screen.getByLabelText("Reason for suspending Harbor Benefits"), { target: { value: "x" } });
      fireEvent.click(screen.getByRole("button", { name: "Yes, suspend" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("That firm is suspended already."));
      expect(screen.getByLabelText("Reason for suspending Harbor Benefits")).toHaveValue("x");
    });

    it("treats a session that ended during a suspension as an ended session, not a toast to retry", async () => {
      firms.suspendFirm.mockRejectedValue(Object.assign(new Error("Your session has expired. Sign in again to continue."), { unauthenticated: true }));
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Suspend Harbor Benefits" }));
      fireEvent.change(screen.getByLabelText("Reason for suspending Harbor Benefits"), { target: { value: "x" } });
      fireEvent.click(screen.getByRole("button", { name: "Yes, suspend" }));
      expect(await screen.findByText("Your session has expired.")).toBeInTheDocument();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("treats a session that ended during a lift the same way", async () => {
      firms.fetchFirmStates.mockResolvedValue([state({ suspended: true, suspendedAt: "2026-11-17T09:00:00Z", suspensionReason: "x" })]);
      firms.liftFirmSuspension.mockRejectedValue(Object.assign(new Error("Your session has expired. Sign in again to continue."), { unauthenticated: true }));
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Lift suspension of Harbor Benefits" }));
      fireEvent.click(screen.getByRole("button", { name: "Yes, lift" }));
      expect(await screen.findByText("Your session has expired.")).toBeInTheDocument();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("lets no second change start while one is being saved", async () => {
      firms.fetchFirmStates.mockResolvedValue([state(), state({ id: "s2", name: "Cedar Cover" })]);
      firms.suspendFirm.mockReturnValue(new Promise<void>(() => {}));
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Suspend Harbor Benefits" }));
      fireEvent.change(screen.getByLabelText("Reason for suspending Harbor Benefits"), { target: { value: "x" } });
      fireEvent.click(screen.getByRole("button", { name: "Yes, suspend" }));
      expect(screen.getByRole("button", { name: "Suspend Cedar Cover" })).toBeDisabled();
    });

    it("offers a retry when the firms can't be loaded", async () => {
      firms.fetchFirmStates.mockRejectedValueOnce(new Error("boom")).mockResolvedValue([]);
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
      expect(await screen.findByText("There are no firms yet.")).toBeInTheDocument();
    });
  });

});
