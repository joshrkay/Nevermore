import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "marcus@advisory.example" }, signOut: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const api = { fetchMyMailbox: vi.fn(), disconnectMailbox: vi.fn() };
vi.mock("@/lib/advisorApi", () => api);
const startBrokerSignIn = vi.fn();
vi.mock("@/lib/brokerAuth", () => ({ startBrokerSignIn: (...a: unknown[]) => startBrokerSignIn(...a) }));

const { default: AdvisorMailboxPage } = await import("./AdvisorMailboxPage");

const renderPage = (search = "") => render(<MemoryRouter initialEntries={[`/advisor/mailbox${search}`]}><AdvisorMailboxPage /></MemoryRouter>);

describe("AdvisorMailboxPage", () => {
  beforeEach(() => {
    for (const fn of [...Object.values(api), startBrokerSignIn]) fn.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    api.fetchMyMailbox.mockResolvedValue({ connected: false });
    startBrokerSignIn.mockResolvedValue(undefined);
  });

  it("says no mailbox is connected, and offers Google and Microsoft", async () => {
    renderPage();
    expect(await screen.findByText("Not connected")).toBeInTheDocument();
    expect(screen.getByText(/send by hand from your own mail/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect with Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect with Microsoft" })).toBeInTheDocument();
  });

  it("connects by signing in again, and comes back to this page", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Connect with Microsoft" }));
    await waitFor(() => expect(startBrokerSignIn).toHaveBeenCalledWith("microsoft", "/advisor/mailbox"));
  });

  it("says so when connecting can't start", async () => {
    startBrokerSignIn.mockRejectedValue(new Error("down"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Connect with Google" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Google")));
  });

  it("explains a connection that failed after sign-in", async () => {
    renderPage("?connect=failed");
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't connect your mailbox/);
  });

  it("shows whose mailbox is connected, through whom and since when, and never a token", async () => {
    api.fetchMyMailbox.mockResolvedValue({ connected: true, provider: "google", address: "marcus@advisory.example", connectedAt: "2026-11-11T12:00:00Z" });
    renderPage();
    const section = await screen.findByLabelText("Connected mailbox");
    expect(section).toHaveTextContent("marcus@advisory.example");
    expect(section).toHaveTextContent("through Google");
    expect(section).toHaveTextContent("Connected");
  });

  it("asks before disconnecting, then disconnects and checks again", async () => {
    api.fetchMyMailbox.mockResolvedValueOnce({ connected: true, provider: "google", address: "m@a.example", connectedAt: "2026-11-11T12:00:00Z" }).mockResolvedValue({ connected: false });
    api.disconnectMailbox.mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
    expect(api.disconnectMailbox).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, disconnect" }));
    await waitFor(() => expect(api.disconnectMailbox).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Not connected")).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalled();
  });

  it("says why when disconnecting fails, and stays connected", async () => {
    api.fetchMyMailbox.mockResolvedValue({ connected: true, provider: "google", address: "m@a.example" });
    api.disconnectMailbox.mockRejectedValue(new Error("Couldn't disconnect your mailbox. Try again."));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, disconnect" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't disconnect your mailbox. Try again."));
    expect(screen.getByLabelText("Connected mailbox")).toBeInTheDocument();
  });

  it("offers a retry when the mailbox can't be checked", async () => {
    api.fetchMyMailbox.mockRejectedValueOnce(new Error("boom")).mockResolvedValue({ connected: false });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Not connected")).toBeInTheDocument();
  });
});
