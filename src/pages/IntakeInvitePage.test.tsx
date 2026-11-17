import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { user: null as { id: string; email?: string } | null, loading: false, isAnonymous: false, signOut: vi.fn() };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const firm = { current: { status: "known", address: "acme-brokers", name: "Acme Brokers" } as Record<string, unknown> };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firm.current }));
const api = { peekIntakeInvite: vi.fn(), acceptIntakeInvite: vi.fn() };
vi.mock("@/lib/brokerIntake", () => api);

import { DRAFT_WORDING_NOTICE, FIRM_SEES_ANSWERS_HEADING, firmSeesAnswersText } from "@/data/legalWording";
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
    cleanup();
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

  // Break caught: the client isn't told who invited them, or the link is never opened against the database (the broker's step 3 never shows "last opened").
  it("tells a visitor who invited them, and records that the link was opened", async () => {
    renderAt();
    expect(await screen.findByRole("heading", { name: "You were invited by Acme Brokers" })).toBeInTheDocument();
    expect(api.peekIntakeInvite).toHaveBeenCalledWith("the-token", "acme-brokers");
  });

  // Break caught: the page doesn't say who the invitation is for, so a client with two brokers can't tell whether it is theirs.
  it("says who the invitation is for", async () => {
    renderAt();
    expect(await screen.findByText(/started this PEO intake for Lucia/)).toBeInTheDocument();
  });

  // Break caught: the page names the firm but not the person in it who invited them, so a client can't tell the invitation is from someone they know (CRM-Q2.3, D-1881).
  it("says which person in the firm invited them", async () => {
    api.peekIntakeInvite.mockResolvedValue({ firmName: "Acme Brokers", contactName: "Lucia", invitedBy: "Ana Agent" });
    renderAt();
    expect(await screen.findByText(/Ana Agent of Acme Brokers started this PEO intake for Lucia/)).toBeInTheDocument();
  });

  // Break caught: the client opens the broker's invitation without being told the firm will see their answers, or the wording is shown as if counsel had approved it (D-12).
  it("says the firm can see their answers, in the draft wording", async () => {
    renderAt();
    expect(await screen.findByRole("heading", { name: FIRM_SEES_ANSWERS_HEADING })).toBeInTheDocument();
    expect(screen.getByText(firmSeesAnswersText("Acme Brokers"))).toBeInTheDocument();
    expect(screen.getByText(DRAFT_WORDING_NOTICE)).toBeInTheDocument();
  });

  // Break caught: a signed-out visitor is shown nothing to do, or is offered to take the intake before they have an account.
  it("asks a signed-out visitor to sign in or create an account with the address it was sent to, and does not take the intake", async () => {
    renderAt();
    expect(await screen.findByText(/sign in or create your account with the email address this invitation was sent to/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in or create an account" })).toBeInTheDocument();
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

  // Break caught: a signed-in client is offered to sign in again, or isn't shown which account the invitation will be taken with.
  it("offers a signed-in person to open the intake, and says which account that is", async () => {
    auth.user = { id: "u1", email: "lucia@client.test" };
    renderAt();
    expect(await screen.findByRole("button", { name: "Open your intake" })).toBeInTheDocument();
    expect(screen.getByText("lucia@client.test")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in or create an account" })).not.toBeInTheDocument();
  });

  // Break caught: the intake isn't taken over on the press of the button (or with another token or address), or the client isn't taken to it.
  it("takes over the intake with the secret from the link when they press the button, and opens it", async () => {
    auth.user = { id: "u1", email: "lucia@client.test" };
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: "Open your intake" }));
    await waitFor(() => expect(api.acceptIntakeInvite).toHaveBeenCalledWith("the-token", "acme-brokers"));
    expect(await screen.findByText("Your intake")).toBeInTheDocument();
  });

  // Break caught: the secret stays in the tab after the intake is theirs, where a later visitor of the same tab could use it.
  it("forgets the secret once the intake is theirs", async () => {
    auth.user = { id: "u1", email: "lucia@client.test" };
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: "Open your intake" }));
    await screen.findByText("Your intake");
    expect(window.sessionStorage.length).toBe(0);
  });

  // Break caught: a refused acceptance (another address, a member of the firm) is a silent failure, or the page navigates on as if it had worked.
  it("shows the reason for a refused acceptance and stays on the page", async () => {
    auth.user = { id: "u1", email: "someone@else.test" };
    api.acceptIntakeInvite.mockRejectedValue(new Error("This invitation was sent to a different email address than the one you are signed in with."));
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: "Open your intake" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("different email address");
    expect(screen.queryByText("Your intake")).not.toBeInTheDocument();
  });

  // Break caught: a person signed in with the wrong account has no way to switch to the right one from this page.
  it("offers to sign out after a refused acceptance", async () => {
    auth.user = { id: "u1", email: "someone@else.test" };
    api.acceptIntakeInvite.mockRejectedValue(new Error("This invitation was sent to a different email address than the one you are signed in with."));
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: "Open your intake" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(auth.signOut).toHaveBeenCalled();
  });

  // Break caught: a refused acceptance throws the secret away, so after switching accounts the same link no longer works.
  it("keeps the secret after a refused acceptance, so the right account can use the same link", async () => {
    auth.user = { id: "u1", email: "someone@else.test" };
    api.acceptIntakeInvite.mockRejectedValue(new Error("different email address"));
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: "Open your intake" }));
    await screen.findByRole("alert");
    expect(window.sessionStorage.length).toBe(1);
  });

  // Break caught: a link that can't be used says nothing of why.
  it("says why a link can't be used", async () => {
    api.peekIntakeInvite.mockRejectedValue(new Error("This invitation has expired. Ask your broker to send a new one."));
    renderAt();
    expect(await screen.findByRole("alert")).toHaveTextContent("This invitation has expired");
  });

  // Break caught: a link that can't be used still offers to sign in, as if signing in would help.
  it("offers nothing to do for a link that can't be used", async () => {
    api.peekIntakeInvite.mockRejectedValue(new Error("This invitation has expired. Ask your broker to send a new one."));
    renderAt();
    await screen.findByRole("alert");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  // Break caught: a page opened with no secret asks the database about nothing and sits waiting, or shows a button that cannot work.
  it("asks the person to use the link from their email when the page is opened with no secret", async () => {
    renderAt("/intake-invite");
    expect(await screen.findByText(/link is incomplete/i)).toBeInTheDocument();
    expect(api.peekIntakeInvite).not.toHaveBeenCalled();
  });

  // Break caught: the link opens at the bare domain, which isn't any firm, and the page says nothing about why it can't work.
  it("asks the person to open it at their broker's address when the page is not at a firm's", async () => {
    firm.current = { status: "none" };
    renderAt();
    expect(await screen.findByText(/opens at your broker's own address/i)).toBeInTheDocument();
  });

  // Break caught: the database is asked about a link at an address that is no firm's (it would answer PT422, and the person is told nothing useful).
  it("asks the database nothing at an address that is not a firm's", async () => {
    firm.current = { status: "none" };
    renderAt();
    await screen.findByText(/opens at your broker's own address/i);
    expect(api.peekIntakeInvite).not.toHaveBeenCalled();
  });

  // Break caught: while the sign-in is still being checked, a signed-in client is shown the sign-in button for a moment.
  it("shows a wait, not a button, while the sign-in is checked", () => {
    auth.loading = true;
    renderAt();
    expect(screen.getByRole("status", { name: "Checking your sign-in" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  // Break caught: while the page is still finding which firm's address it is at, the person is told the link is for another address.
  it("shows a wait while the firm's address is checked, not the 'open it at your broker's address' notice", () => {
    firm.current = { status: "checking" };
    renderAt();
    expect(screen.getByRole("status", { name: "Checking your sign-in" })).toBeInTheDocument();
    expect(screen.queryByText(/opens at your broker's own address/i)).not.toBeInTheDocument();
  });

  // Break caught: a visitor with only an anonymous session (the chamber's guest login) is offered to take the intake with no account, which the database would refuse for want of a verified email.
  it("treats an anonymous session as signed out", async () => {
    auth.user = { id: "guest" };
    auth.isAnonymous = true;
    renderAt();
    expect(await screen.findByRole("button", { name: "Sign in or create an account" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open your intake" })).not.toBeInTheDocument();
  });

  // Break caught: while the link is being looked up, the page is blank, so the person can't tell it is working.
  it("shows a wait while the link is opened", () => {
    api.peekIntakeInvite.mockReturnValue(new Promise(() => {}));
    renderAt();
    expect(screen.getByRole("status", { name: "Opening your invitation" })).toBeInTheDocument();
  });

  // Break caught: a second press while the first is still taking the intake asks the database twice (the second is refused as "used" and shown to the client as an error).
  it("won't take the intake twice while the first press is still working", async () => {
    auth.user = { id: "u1", email: "lucia@client.test" };
    api.acceptIntakeInvite.mockReturnValue(new Promise(() => {}));
    renderAt();
    const button = await screen.findByRole("button", { name: "Open your intake" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(api.acceptIntakeInvite).toHaveBeenCalledTimes(1);
  });

  // Break caught: after a refusal the button stays disabled, so the right account can't try again without reloading.
  it("lets them press the button again after a refusal", async () => {
    auth.user = { id: "u1", email: "lucia@client.test" };
    api.acceptIntakeInvite.mockRejectedValueOnce(new Error("different email address"));
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: "Open your intake" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Open your intake" })).toBeEnabled();
  });
});
// NEXT
