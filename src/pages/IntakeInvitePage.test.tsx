import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { user: null as { id: string; email?: string } | null, loading: false, isAnonymous: false, signOut: vi.fn() };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const firm = { current: { status: "known", address: "acme-brokers", name: "Acme Brokers" } as Record<string, unknown> };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firm.current }));
const api = { peekIntakeInvite: vi.fn(), acceptIntakeInvite: vi.fn() };
vi.mock("@/lib/brokerIntake", () => api);

const { default: IntakeInvitePage } = await import("./IntakeInvitePage");

// Where the sign-in page would be, showing where it was asked to come back to.
const LoginProbe = () => {
  const loc = useLocation();
  const from = (loc.state as { from?: { pathname: string } } | null)?.from;
  return <p>Sign-in page, back to {from?.pathname}</p>;
};

// The link is `/intake-invite#token=...`: the secret is after the #, which the browser never sends to a server (D-34). The router sees only the path.
const openLink = (url = "/intake-invite#token=the-token") => window.history.replaceState(null, "", url);
const renderAt = (url: string | null = "/intake-invite#token=the-token") => {
  if (url !== null) openLink(url);
  return render(
    <MemoryRouter initialEntries={[url ?? "/intake-invite"]}>
      <Routes>
        <Route path="/intake-invite" element={<IntakeInvitePage />} />
        <Route path="/login" element={<LoginProbe />} />
        <Route path="/start" element={<p>Your intake</p>} />
      </Routes>
    </MemoryRouter>,
  );
};

// A client opens the link their broker's firm emailed them, at the firm's address, signs in or creates their account with the email it was sent to, and the intake becomes theirs (P-2.2, D-1703, D-1711).
describe("IntakeInvitePage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    openLink("/");
    auth.user = null;
    auth.loading = false;
    auth.isAnonymous = false;
    auth.signOut.mockReset();
    firm.current = { status: "known", address: "acme-brokers", name: "Acme Brokers" };
    api.peekIntakeInvite.mockReset().mockResolvedValue({ firmName: "Acme Brokers", contactName: "Lucia" });
    api.acceptIntakeInvite.mockReset().mockResolvedValue({ intakeId: "i1" });
  });

  // Break caught: the client isn't told who invited them, or the opening isn't recorded (the broker's step 3 never shows "last opened").
  it("tells a signed-out visitor who invited them, records that the link was opened, and asks them to sign in or create an account", async () => {
    renderAt();
    expect(await screen.findByRole("heading", { name: "You were invited by Acme Brokers" })).toBeInTheDocument();
    expect(api.peekIntakeInvite).toHaveBeenCalledWith("the-token", "acme-brokers");
    expect(screen.getByText(/Lucia/)).toBeInTheDocument();
    expect(screen.getByText(/sign in or create your account with the email address this invitation was sent to/i)).toBeInTheDocument();
    expect(api.acceptIntakeInvite).not.toHaveBeenCalled();
  });

  // Break caught: signing in loses the link, so the client comes back to a page with no invitation.
  it("sends them to sign in and brings them back to this page", async () => {
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: "Sign in or create an account" }));
    expect(await screen.findByText("Sign-in page, back to /intake-invite")).toBeInTheDocument();
  });

  // Break caught: the one secret the link carries stays in the address bar, the history or the page.
  it("takes the secret out of the address bar as soon as it has read it, and never shows it", async () => {
    renderAt();
    await screen.findByRole("heading", { name: "You were invited by Acme Brokers" });
    expect(window.location.hash).toBe("");
    expect(window.location.href).not.toContain("the-token");
    expect(document.body.textContent).not.toContain("the-token");
  });

  // Break caught: the intake isn't taken over on the press of the button, or the client isn't taken to it.
  it("takes over the intake with the same secret after signing in, and opens it", async () => {
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: "Sign in or create an account" }));
    await screen.findByText("Sign-in page, back to /intake-invite");
    cleanup();
    auth.user = { id: "u1", email: "lucia@client.test" };
    renderAt(null);
    fireEvent.click(await screen.findByRole("button", { name: "Open your intake" }));
    await waitFor(() => expect(api.acceptIntakeInvite).toHaveBeenCalledWith("the-token", "acme-brokers"));
    expect(await screen.findByText("Your intake")).toBeInTheDocument();
  });

  // Break caught: a link that can't be used still offers to sign in, or says nothing of why.
  it("says why a link can't be used, and offers nothing", async () => {
    api.peekIntakeInvite.mockRejectedValue(new Error("This invitation has expired. Ask your broker to send a new one."));
    renderAt();
    expect(await screen.findByRole("alert")).toHaveTextContent("This invitation has expired");
    expect(screen.queryByRole("button", { name: "Sign in or create an account" })).not.toBeInTheDocument();
  });

  // Break caught: a refused acceptance (another address, a member of the firm) is a silent failure, or leaves the person with no way to switch accounts.
  it("shows the database's reason for a refused acceptance, with a way to sign out", async () => {
    auth.user = { id: "u1", email: "someone@else.test" };
    api.acceptIntakeInvite.mockRejectedValue(new Error("This invitation was sent to a different email address than the one you are signed in with."));
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: "Open your intake" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("different email address");
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(auth.signOut).toHaveBeenCalled();
  });

  // Break caught: a page opened with no secret asks the database about nothing, or shows a button that cannot work.
  it("asks the person to use the link from their email when the page is opened with no secret", () => {
    renderAt("/intake-invite");
    expect(screen.getByText(/link is incomplete/i)).toBeInTheDocument();
    expect(api.peekIntakeInvite).not.toHaveBeenCalled();
  });

  // Break caught: the link opens at the bare domain, which isn't any firm, and the database is asked anyway.
  it("asks the person to open it at their broker's address when the page is not at a firm's", () => {
    firm.current = { status: "none" };
    renderAt();
    expect(screen.getByText(/opens at your broker's own address/i)).toBeInTheDocument();
    expect(api.peekIntakeInvite).not.toHaveBeenCalled();
  });
});
