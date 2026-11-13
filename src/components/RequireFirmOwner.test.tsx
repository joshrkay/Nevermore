import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const auth = {
  user: null as { id: string; email?: string } | null,
  loading: false,
  isAnonymous: false,
  sessionEnded: null as "signed_out" | "expired" | null,
  signOut: vi.fn(),
};
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
// The guard asks the database which firms the person owns, never whether they hold a platform role: the mock has no
// role check, so a call to one would fail the test.
const fetchOwnedFirms = vi.fn();
const fetchNeedsSecondFactor = vi.fn();
vi.mock("@/lib/advisorApi", () => ({ fetchOwnedFirms: () => fetchOwnedFirms(), fetchNeedsSecondFactor: () => fetchNeedsSecondFactor() }));
vi.mock("@/lib/monitoring", () => ({ reportOpsEvent: vi.fn() }));

const { clearOwnedFirms } = await import("@/hooks/useOwnedFirms");
const { default: RequireFirmOwner } = await import("./RequireFirmOwner");

const Login = () => <p>Login page returning to {(useLocation().state as { from?: { pathname: string } }).from?.pathname ?? "nowhere"}</p>;
const SecondFactor = () => <p>Second factor page returning to {(useLocation().state as { from?: { pathname: string } }).from?.pathname}</p>;

const renderGuarded = () =>
  render(
    <MemoryRouter initialEntries={["/advisor/activity"]}>
      <Routes>
        <Route path="/advisor/activity" element={<RequireFirmOwner><p>The record</p></RequireFirmOwner>} />
        <Route path="/login" element={<Login />} />
        <Route path="/advisor/second-factor" element={<SecondFactor />} />
      </Routes>
    </MemoryRouter>,
  );

describe("RequireFirmOwner", () => {
  beforeEach(() => {
    auth.user = { id: "u1", email: "owner@example.com" };
    auth.loading = false;
    auth.isAnonymous = false;
    auth.sessionEnded = null;
    clearOwnedFirms();
    fetchOwnedFirms.mockReset();
    fetchNeedsSecondFactor.mockReset().mockResolvedValue(false);
  });

  it("lets in a firm's owner who holds no platform role", async () => {
    fetchOwnedFirms.mockResolvedValue([{ firm_id: "f1", name: "Alpha" }]);
    renderGuarded();
    expect(await screen.findByText("The record")).toBeInTheDocument();
  });

  it("sends a signed-out visitor, or a guest, to sign in, remembering the page", () => {
    auth.user = null;
    renderGuarded();
    expect(screen.getByText("Login page returning to /advisor/activity")).toBeInTheDocument();
    expect(fetchOwnedFirms).not.toHaveBeenCalled();
  });

  it("treats a guest session as signed out", () => {
    auth.isAnonymous = true;
    renderGuarded();
    expect(screen.getByText(/Login page/)).toBeInTheDocument();
    expect(fetchOwnedFirms).not.toHaveBeenCalled();
  });

  it("shows nothing protected while ownership is being checked", () => {
    fetchOwnedFirms.mockReturnValue(new Promise(() => {}));
    renderGuarded();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("The record")).not.toBeInTheDocument();
  });

  it("tells someone who owns no firm that the record is for owners", async () => {
    fetchOwnedFirms.mockResolvedValue([]);
    renderGuarded();
    expect(await screen.findByText("Only a firm's owners can read its record of who did what.")).toBeInTheDocument();
    expect(screen.queryByText("The record")).not.toBeInTheDocument();
  });

  it("sends an owner who signed in with a password and has no second factor to add or enter one", async () => {
    fetchOwnedFirms.mockResolvedValue([]);
    fetchNeedsSecondFactor.mockResolvedValue(true);
    renderGuarded();
    expect(await screen.findByText("Second factor page returning to /advisor/activity")).toBeInTheDocument();
    expect(screen.queryByText("The record")).not.toBeInTheDocument();
  });

  it("offers a retry when it can't tell, and ends a session the server rejects", async () => {
    fetchOwnedFirms.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([{ firm_id: "f1", name: "Alpha" }]);
    renderGuarded();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("The record")).toBeInTheDocument();
    auth.signOut.mockReset().mockResolvedValue(undefined);
    clearOwnedFirms();
    fetchOwnedFirms.mockRejectedValue(Object.assign(new Error("expired"), { unauthenticated: true }));
    renderGuarded();
    expect(await screen.findByText("Your session has expired.")).toBeInTheDocument();
    expect(auth.signOut).toHaveBeenCalledWith("expired");
  });
});
