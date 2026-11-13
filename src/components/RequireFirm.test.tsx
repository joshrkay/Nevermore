import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const auth = {
  user: null as { id: string; email?: string } | null,
  session: null as { access_token: string } | null,
  loading: false,
  isAnonymous: false,
  sessionEnded: null as "signed_out" | "expired" | null,
  signOut: vi.fn(),
};
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
let firmAddress: { status: "none" } | { status: "known"; address: string; name: string } = { status: "none" };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firmAddress }));
// The guards ask the database which firms the person belongs to or owns, or whether they are a platform admin: never
// whether they hold the advisor role. The mock has no such function, so a call to one would fail the test.
const fetchMyFirms = vi.fn();
const fetchOwnedFirms = vi.fn();
const fetchIsAdmin = vi.fn();
const fetchNeedsSecondFactor = vi.fn();
vi.mock("@/lib/advisorApi", () => ({
  fetchMyFirms: () => fetchMyFirms(),
  fetchOwnedFirms: () => fetchOwnedFirms(),
  fetchIsAdmin: () => fetchIsAdmin(),
  fetchNeedsSecondFactor: () => fetchNeedsSecondFactor(),
}));
const reportOpsEvent = vi.fn();
vi.mock("@/lib/monitoring", () => ({ reportOpsEvent: (...a: unknown[]) => reportOpsEvent(...a) }));

const { clearMyFirms, clearOwnedFirms } = await import("@/hooks/useOwnedFirms");
const { default: RequireFirm, RequirePlatformAdmin } = await import("./RequireFirm");

const alpha = { firm_id: "f1", name: "Alpha Advisory", address: "alpha", role: "agent" };
const beta = { firm_id: "f2", name: "Beta Brokers", address: "beta", role: "owner" };

const Login = () => {
  const state = useLocation().state as { from?: { pathname: string }; audience: string; reason?: string };
  return <p>Login page for {state.audience} returning to {state.from?.pathname ?? "nowhere"}{state.reason ? ` (${state.reason})` : ""}</p>;
};
const SecondFactor = () => <p>Second factor page returning to {(useLocation().state as { from?: { pathname: string } }).from?.pathname}</p>;

const renderGuarded = (guard: "member" | "owner" | "admin" = "member") =>
  render(
    <MemoryRouter initialEntries={["/advisor/submissions/s1"]}>
      <Routes>
        <Route
          path="/advisor/submissions/:id"
          element={
            guard === "admin" ? <RequirePlatformAdmin><p>Platform tools</p></RequirePlatformAdmin>
            : guard === "owner" ? <RequireFirm as="owner"><p>The record</p></RequireFirm>
            : <RequireFirm><p>Firm console</p></RequireFirm>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/advisor/second-factor" element={<SecondFactor />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  auth.user = { id: "u1", email: "pat@example.com" };
  auth.session = { access_token: "tok-1" };
  auth.loading = false;
  auth.isAnonymous = false;
  auth.sessionEnded = null;
  auth.signOut.mockReset();
  firmAddress = { status: "none" };
  clearMyFirms();
  clearOwnedFirms();
  fetchMyFirms.mockReset();
  fetchOwnedFirms.mockReset();
  fetchIsAdmin.mockReset();
  fetchNeedsSecondFactor.mockReset().mockResolvedValue(false);
  reportOpsEvent.mockReset();
});

describe("RequireFirm (a current member of a firm)", () => {
  it("lets in a member who holds no platform role: the guard asks for a membership, never for a role", async () => {
    fetchMyFirms.mockResolvedValue([alpha]);
    renderGuarded();
    expect(await screen.findByText("Firm console")).toBeInTheDocument();
  });

  it("sends a signed-out visitor, or a guest, to sign in, remembering the page", () => {
    auth.user = null;
    renderGuarded();
    expect(screen.getByText("Login page for advisor returning to /advisor/submissions/s1")).toBeInTheDocument();
    auth.user = { id: "u1" };
    auth.isAnonymous = true;
    renderGuarded();
    expect(fetchMyFirms).not.toHaveBeenCalled();
  });

  it("tells the sign-in page when the session expired, and after a deliberate sign-out doesn't remember the page", () => {
    auth.user = null;
    auth.sessionEnded = "expired";
    renderGuarded();
    expect(screen.getByText("Login page for advisor returning to /advisor/submissions/s1 (expired)")).toBeInTheDocument();
    auth.sessionEnded = "signed_out";
    renderGuarded();
    expect(screen.getByText("Login page for advisor returning to nowhere (signed_out)")).toBeInTheDocument();
  });

  it("shows nothing of the firm while membership is being checked", () => {
    fetchMyFirms.mockReturnValue(new Promise(() => {}));
    renderGuarded();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Firm console")).not.toBeInTheDocument();
  });

  it("tells a person who belongs to no firm so, in the words of a firm and not of an advisor", async () => {
    fetchMyFirms.mockResolvedValue([]);
    renderGuarded();
    expect(await screen.findByRole("heading", { name: "You aren't a member of any firm" })).toBeInTheDocument();
    expect(screen.getByText(/Your account \(pat@example.com\) isn't a member of a firm/)).toBeInTheDocument();
    expect(screen.queryByText(/advisor|administrator|Waiting for access/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Firm console")).not.toBeInTheDocument();
    expect(reportOpsEvent).toHaveBeenCalledWith("auth_denied", { code: "firm_member_route" });
    expect(screen.getByRole("button", { name: "Sign in with another account" })).toBeInTheDocument();
  });

  it("sends a member who signed in with a password and has no second factor to add or enter one, not to the console", async () => {
    fetchMyFirms.mockResolvedValue([]);
    fetchNeedsSecondFactor.mockResolvedValue(true);
    renderGuarded();
    expect(await screen.findByText("Second factor page returning to /advisor/submissions/s1")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "You aren't a member of any firm" })).not.toBeInTheDocument();
    expect(reportOpsEvent).not.toHaveBeenCalled();
  });

  it("asks again when the sign-in has changed: an answer given before the second factor is not handed out after it", async () => {
    fetchMyFirms.mockResolvedValueOnce([]).mockResolvedValue([alpha]);
    const before = renderGuarded();
    expect(await screen.findByRole("heading", { name: "You aren't a member of any firm" })).toBeInTheDocument();
    before.unmount();
    auth.session = { access_token: "tok-2-after-second-factor" };
    renderGuarded();
    expect(await screen.findByText("Firm console")).toBeInTheDocument();
    expect(fetchMyFirms).toHaveBeenCalledTimes(2);
  });

  it("offers a retry when it can't tell, and ends a session the server rejects", async () => {
    fetchMyFirms.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([alpha]);
    renderGuarded();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Firm console")).toBeInTheDocument();
    auth.signOut.mockResolvedValue(undefined);
    clearMyFirms();
    fetchMyFirms.mockRejectedValue(Object.assign(new Error("expired"), { unauthenticated: true }));
    renderGuarded();
    expect(await screen.findAllByText("Your session has expired.")).not.toHaveLength(0);
    expect(auth.signOut).toHaveBeenCalledWith("expired");
  });

  describe("at a firm's address", () => {
    beforeEach(() => {
      firmAddress = { status: "known", address: "alpha", name: "Alpha Advisory" };
    });

    it("lets in a member of that firm", async () => {
      fetchMyFirms.mockResolvedValue([alpha]);
      renderGuarded();
      expect(await screen.findByText("Firm console")).toBeInTheDocument();
    });

    it("keeps out a member of another firm only, and says it's this firm they aren't a member of", async () => {
      fetchMyFirms.mockResolvedValue([beta]);
      renderGuarded();
      expect(await screen.findByRole("heading", { name: "You aren't a member of this firm" })).toBeInTheDocument();
      expect(screen.queryByText("Firm console")).not.toBeInTheDocument();
    });

    it("does not open for a member of this firm who belongs to another too: the database can't yet tell their records apart, so the console would mix them", async () => {
      fetchMyFirms.mockResolvedValue([alpha, beta]);
      renderGuarded();
      expect(await screen.findByRole("heading", { name: "You're a member of more than one firm" })).toBeInTheDocument();
      expect(screen.getByText(/Alpha Advisory/)).toBeInTheDocument();
      expect(screen.getByText(/Beta Brokers/)).toBeInTheDocument();
      expect(screen.queryByText("Firm console")).not.toBeInTheDocument();
    });
  });

  describe("on the bare domain", () => {
    it("lands a member of exactly one firm in it", async () => {
      fetchMyFirms.mockResolvedValue([beta]);
      renderGuarded();
      expect(await screen.findByText("Firm console")).toBeInTheDocument();
    });

    it("keeps a member of several firms out, naming them, rather than showing one firm's records mixed with another's", async () => {
      fetchMyFirms.mockResolvedValue([alpha, beta]);
      renderGuarded();
      expect(await screen.findByRole("heading", { name: "You're a member of more than one firm" })).toBeInTheDocument();
      expect(screen.queryByText("Firm console")).not.toBeInTheDocument();
    });
  });
});

describe("RequireFirm as an owner (the owner of the firm at this address)", () => {
  const ownerOf = (f: typeof alpha) => ({ ...f, role: "owner" });

  it("lets in a firm's owner who holds no platform role, from the database's answer on the person's own memberships", async () => {
    fetchMyFirms.mockResolvedValue([ownerOf(alpha)]);
    renderGuarded("owner");
    expect(await screen.findByText("The record")).toBeInTheDocument();
    expect(fetchOwnedFirms).not.toHaveBeenCalled();
  });

  it("lets in the owner of the firm whose address it is", async () => {
    firmAddress = { status: "known", address: "alpha", name: "Alpha Advisory" };
    fetchMyFirms.mockResolvedValue([ownerOf(alpha)]);
    renderGuarded("owner");
    expect(await screen.findByText("The record")).toBeInTheDocument();
  });

  it("tells a member who is not an owner that the record is for owners", async () => {
    fetchMyFirms.mockResolvedValue([alpha]);
    renderGuarded("owner");
    expect(await screen.findByText("Only a firm's owners can read its record of who did what.")).toBeInTheDocument();
    expect(screen.queryByText("The record")).not.toBeInTheDocument();
    expect(reportOpsEvent).toHaveBeenCalledWith("auth_denied", { code: "firm_owner_route" });
  });

  it("refuses an owner of one firm who is only an agent at another firm's address", async () => {
    firmAddress = { status: "known", address: "alpha", name: "Alpha Advisory" };
    // Owner of Beta, agent at Alpha, and this is Alpha's address.
    fetchMyFirms.mockResolvedValue([{ ...beta, role: "owner" }, alpha]);
    renderGuarded("owner");
    expect(await screen.findByRole("heading", { name: /more than one firm|For a firm's owners/ })).toBeInTheDocument();
    expect(screen.queryByText("The record")).not.toBeInTheDocument();
  });

  it("refuses an owner of one firm at the address of a firm they do not belong to", async () => {
    firmAddress = { status: "known", address: "gamma", name: "Gamma" };
    fetchMyFirms.mockResolvedValue([ownerOf(alpha)]);
    renderGuarded("owner");
    expect(await screen.findByRole("heading", { name: "For a firm's owners" })).toBeInTheDocument();
    expect(screen.queryByText("The record")).not.toBeInTheDocument();
  });

  it("treats an owner of two firms on the bare domain as it treats a member of two: kept out, told why", async () => {
    fetchMyFirms.mockResolvedValue([ownerOf(alpha), ownerOf(beta)]);
    renderGuarded("owner");
    expect(await screen.findByRole("heading", { name: "You're a member of more than one firm" })).toBeInTheDocument();
    expect(screen.queryByText("The record")).not.toBeInTheDocument();
  });

  it("sends an owner held back for the second factor to add or enter one", async () => {
    fetchMyFirms.mockResolvedValue([]);
    fetchNeedsSecondFactor.mockResolvedValue(true);
    renderGuarded("owner");
    expect(await screen.findByText("Second factor page returning to /advisor/submissions/s1")).toBeInTheDocument();
  });
});

describe("RequirePlatformAdmin (a page that is platform-wide)", () => {
  it("lets in a platform admin, who is not a member of any firm (D-16)", async () => {
    fetchIsAdmin.mockResolvedValue(true);
    renderGuarded("admin");
    expect(await screen.findByText("Platform tools")).toBeInTheDocument();
    expect(fetchMyFirms).not.toHaveBeenCalled();
  });

  it("keeps out a member of a firm who is not a platform admin", async () => {
    fetchIsAdmin.mockResolvedValue(false);
    renderGuarded("admin");
    expect(await screen.findByRole("heading", { name: "For Nevermore's platform admins" })).toBeInTheDocument();
    expect(screen.queryByText("Platform tools")).not.toBeInTheDocument();
    expect(reportOpsEvent).toHaveBeenCalledWith("auth_denied", { code: "platform_admin_route" });
  });

  it("sends an admin who signed in with a password and has no second factor to add or enter one", async () => {
    fetchIsAdmin.mockResolvedValue(false);
    fetchNeedsSecondFactor.mockResolvedValue(true);
    renderGuarded("admin");
    expect(await screen.findByText("Second factor page returning to /advisor/submissions/s1")).toBeInTheDocument();
  });
});
