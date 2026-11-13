import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { user: null as { id: string; email?: string } | null, loading: false, isAnonymous: false, signOut: vi.fn() };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const firm = { current: { status: "known", address: "acme-brokers", name: "Acme Brokers" } as Record<string, unknown> };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firm.current }));
const api = { acceptInvitation: vi.fn() };
vi.mock("@/lib/invitationApi", () => api);

const { default: JoinFirmPage } = await import("./JoinFirmPage");

// Where the sign-in page would be, showing where it was asked to come back to.
const LoginProbe = () => {
  const loc = useLocation();
  const from = (loc.state as { from?: { pathname: string; hash?: string } } | null)?.from;
  return <p>Sign-in page, back to {from?.pathname}{from?.hash ? ` with ${from.hash}` : ""}</p>;
};

// The link is `/join#token=...`: the secret is after the #, which the browser never sends to a server (D-34). The router sees only
// the path; the page reads the fragment from the address bar.
const openLink = (url = "/join#token=the-token") => window.history.replaceState(null, "", url);
const renderAt = (url: string | null = "/join#token=the-token") => {
  if (url !== null) openLink(url);
  return render(
    <MemoryRouter initialEntries={["/join"]}>
      <Routes>
        <Route path="/join" element={<JoinFirmPage />} />
        <Route path="/login" element={<LoginProbe />} />
        <Route path="/advisor" element={<p>The console</p>} />
      </Routes>
    </MemoryRouter>,
  );
};

// Someone opens an invitation's link at their firm's address, signs in or creates their account with the email it was sent to,
// and joins (story CRM-P1.2).
describe("JoinFirmPage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    openLink("/");
    auth.user = null;
    auth.loading = false;
    auth.isAnonymous = false;
    auth.signOut.mockReset();
    firm.current = { status: "known", address: "acme-brokers", name: "Acme Brokers" };
    api.acceptInvitation.mockReset().mockResolvedValue({ firmAddress: "acme-brokers", role: "agent" });
  });

  it("names the firm and asks a signed-out visitor to sign in or create an account with the invited email, then comes back here", async () => {
    renderAt();
    expect(screen.getByRole("heading", { name: "Join Acme Brokers" })).toBeInTheDocument();
    expect(screen.getByText(/sign in or create your account with the email address this invitation was sent to/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in or create an account" }));
    expect(await screen.findByText("Sign-in page, back to /join")).toBeInTheDocument();
    expect(api.acceptInvitation).not.toHaveBeenCalled();
  });

  it("takes the secret out of the address bar as soon as it has read it, and never shows it", () => {
    renderAt();
    expect(window.location.hash).toBe("");
    expect(window.location.href).not.toContain("the-token");
    expect(document.body.textContent).not.toContain("the-token");
  });

  it("still joins with the same secret after going to sign in and coming back to the page without it", async () => {
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: "Sign in or create an account" }));
    expect(await screen.findByText("Sign-in page, back to /join")).toBeInTheDocument();
    cleanup();
    auth.user = { id: "u1", email: "newcomer@example.test" };
    renderAt(null);
    fireEvent.click(screen.getByRole("button", { name: "Join Acme Brokers" }));
    await waitFor(() => expect(api.acceptInvitation).toHaveBeenCalledWith("the-token", "acme-brokers"));
  });

  it("asks the person to use the link from their email when the page is opened with no secret", () => {
    auth.user = { id: "u1", email: "newcomer@example.test" };
    renderAt("/join");
    expect(screen.getByText(/use the link from the email you were sent/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Join/ })).not.toBeInTheDocument();
  });

  it("tells the firm gate the person is now a member, and forgets the secret, once they have joined", async () => {
    auth.user = { id: "u1", email: "newcomer@example.test" };
    const changed = vi.fn();
    window.addEventListener("nevermore:membership-changed", changed);
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: "Join Acme Brokers" }));
    await screen.findByRole("heading", { name: "You've joined Acme Brokers" });
    window.removeEventListener("nevermore:membership-changed", changed);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("does not tell the firm gate anything when the join is refused, and keeps the secret for another try", async () => {
    auth.user = { id: "u1", email: "other@example.test" };
    api.acceptInvitation.mockRejectedValue(new Error("This invitation was sent to a different email address than the one you are signed in with."));
    const changed = vi.fn();
    window.addEventListener("nevermore:membership-changed", changed);
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: "Join Acme Brokers" }));
    await screen.findByRole("alert");
    window.removeEventListener("nevermore:membership-changed", changed);
    expect(changed).not.toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(1);
  });

  it("treats a guest session as signed out", () => {
    auth.user = { id: "g1" };
    auth.isAnonymous = true;
    renderAt();
    expect(screen.getByRole("button", { name: "Sign in or create an account" })).toBeInTheDocument();
  });

  it("joins only when the signed-in person says so, as the email they are signed in with, and says the role they joined as", async () => {
    auth.user = { id: "u1", email: "newcomer@example.test" };
    renderAt();
    expect(screen.getByText("newcomer@example.test")).toBeInTheDocument();
    expect(api.acceptInvitation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Join Acme Brokers" }));
    await waitFor(() => expect(api.acceptInvitation).toHaveBeenCalledWith("the-token", "acme-brokers"));
    expect(await screen.findByRole("heading", { name: "You've joined Acme Brokers" })).toBeInTheDocument();
    expect(screen.getByText("You're now an agent of Acme Brokers.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/advisor");
  });

  it("says the role in grammatical words", async () => {
    auth.user = { id: "u1", email: "newcomer@example.test" };
    for (const [role, said] of [["owner", "an owner"], ["lead", "a lead"]] as const) {
      api.acceptInvitation.mockResolvedValue({ firmAddress: "acme-brokers", role });
      const view = renderAt();
      fireEvent.click(screen.getByRole("button", { name: "Join Acme Brokers" }));
      expect(await screen.findByText(`You're now ${said} of Acme Brokers.`)).toBeInTheDocument();
      view.unmount();
    }
  });

  it("accepts once however many times the button is pressed", async () => {
    auth.user = { id: "u1", email: "newcomer@example.test" };
    renderAt();
    const button = screen.getByRole("button", { name: "Join Acme Brokers" });
    fireEvent.click(button);
    fireEvent.click(button);
    await screen.findByRole("heading", { name: "You've joined Acme Brokers" });
    expect(api.acceptInvitation).toHaveBeenCalledTimes(1);
  });

  it("says plainly why a link can't be used, with a way to sign out when the wrong email is signed in, and the token is nowhere on screen", async () => {
    auth.user = { id: "u1", email: "other@example.test" };
    api.acceptInvitation.mockRejectedValue(new Error("This invitation was sent to a different email address than the one you are signed in with. Sign out, then sign in or create your account with the address it was sent to."));
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: "Join Acme Brokers" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This invitation was sent to a different email address");
    expect(document.body.textContent).not.toContain("the-token");
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("can be tried again after a refusal that may pass, without leaving the page", async () => {
    auth.user = { id: "u1", email: "newcomer@example.test" };
    api.acceptInvitation.mockRejectedValueOnce(new Error("Couldn't accept the invitation. Try again."));
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: "Join Acme Brokers" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Join Acme Brokers" }));
    expect(await screen.findByRole("heading", { name: "You've joined Acme Brokers" })).toBeInTheDocument();
  });

  it("says the link opens at the firm's own address when it is opened anywhere else", () => {
    firm.current = { status: "none" };
    renderAt();
    expect(screen.getByText(/opens at your firm's own address/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Join/ })).not.toBeInTheDocument();
  });

  it("waits for the sign-in check before showing either choice", () => {
    auth.loading = true;
    renderAt();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
