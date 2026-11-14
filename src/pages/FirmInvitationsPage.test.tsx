import { readFileSync } from "node:fs";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Link, MemoryRouter, Route, RouterProvider, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const auth = { user: { id: "u1", email: "owner@example.test" } as { id: string; email?: string } | null, loading: false, isAnonymous: false, signOut: vi.fn() };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const firm = { current: { status: "known", address: "acme-brokers", name: "Acme Brokers" } as Record<string, unknown> };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firm.current }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
const api = { fetchMyFirm: vi.fn(), fetchPendingInvitations: vi.fn(), inviteMember: vi.fn(), resendInvitation: vi.fn(), cancelInvitation: vi.fn() };
vi.mock("@/lib/invitationApi", () => api);
// The organisations and requests to join have their own sections, tested in FirmInvitationsPage.join.test.tsx: here they are empty.
vi.mock("@/lib/joinByOrganisationApi", () => ({
  fetchOrganisations: vi.fn().mockResolvedValue([]), fetchJoinRequests: vi.fn().mockResolvedValue([]),
  addOrganisation: vi.fn(), removeOrganisation: vi.fn(), approveJoinRequest: vi.fn(), declineJoinRequest: vi.fn(),
}));

const { default: FirmInvitationsPage } = await import("./FirmInvitationsPage");

const renderPage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={["/firm/invitations"]}><Routes><Route path="/firm/invitations" element={<FirmInvitationsPage />} /><Route path="/login" element={<p>Sign-in page</p>} /></Routes></MemoryRouter></QueryClientProvider>);
const pending = (over: Record<string, unknown> = {}) => ({
  id: "i1", email: "newcomer@example.test", role: "agent", invitedAt: "2026-11-16T10:00:00Z", expiresAt: "2099-11-23T10:00:00Z", expired: false,
  resentAt: null, delivery: "sent", emailError: null, ...over,
});

// An owner invites people by email with a role, sees who is still pending, and resends or withdraws an invitation (story CRM-P1.2).
describe("FirmInvitationsPage", () => {
  beforeEach(() => {
    auth.user = { id: "u1", email: "owner@example.test" };
    auth.loading = false;
    firm.current = { status: "known", address: "acme-brokers", name: "Acme Brokers" };
    api.fetchMyFirm.mockReset().mockResolvedValue({ id: "f1", name: "Acme Brokers", role: "owner" });
    api.fetchPendingInvitations.mockReset().mockResolvedValue([pending(), pending({ id: "i2", email: "late@example.test", role: "lead", expired: true, expiresAt: "2026-11-01T10:00:00Z" }), pending({ id: "i3", email: "lost@example.test", delivery: "failed", emailError: "provider_error" })]);
    api.inviteMember.mockReset().mockResolvedValue({ invitationId: "i9", delivery: "sent" });
    api.resendInvitation.mockReset().mockResolvedValue({ invitationId: "i1", delivery: "sent" });
    api.cancelInvitation.mockReset().mockResolvedValue(undefined);
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("sends a signed-out visitor to sign in", async () => {
    auth.user = null;
    renderPage();
    expect(await screen.findByText("Sign-in page")).toBeInTheDocument();
  });

  it("asks for the firm's own address when opened anywhere else, and loads nothing", () => {
    firm.current = { status: "none" };
    renderPage();
    expect(screen.getByText(/open this page at your firm's own address/i)).toBeInTheDocument();
    expect(api.fetchMyFirm).not.toHaveBeenCalled();
  });

  it("tells a lead or an agent that only an owner can invite, and asks for no invitations", async () => {
    api.fetchMyFirm.mockResolvedValue({ id: "f1", name: "Acme Brokers", role: "lead" });
    renderPage();
    expect(await screen.findByText("Only an owner of the firm can invite people.")).toBeInTheDocument();
    expect(api.fetchPendingInvitations).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Send invitation" })).not.toBeInTheDocument();
  });

  it("lists the pending invitations: who, the role, when it ends, and which have expired or did not go out", async () => {
    renderPage();
    const list = await screen.findByRole("list", { name: "Pending invitations" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("newcomer@example.test");
    expect(items[0]).toHaveTextContent("Agent");
    expect(items[0]).toHaveTextContent(/Expires/);
    expect(items[1]).toHaveTextContent("Lead");
    expect(items[1]).toHaveTextContent("Expired");
    expect(items[2]).toHaveTextContent("The email did not go out");
  });

  // Catches: an empty list that leaves the owner without a way to make the first invitation, offers one that does not lead to the form, or is announced twice.
  it("says what belongs in an empty list, with an action that takes the owner to the invite form, and is one status", async () => {
    api.fetchPendingInvitations.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Invitations you send appear here until they are accepted.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Pending invitations" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Clear filters/ })).not.toBeInTheDocument();
    // Each empty list says its own sentence once, as its own polite status.
    const statuses = screen.getAllByRole("status").filter((s) => s.textContent);
    expect(statuses.filter((s) => s.textContent === "Invitations you send appear here until they are accepted.")).toHaveLength(1);
    expect(statuses.every((s) => s.getAttribute("aria-live") === "polite")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Invite someone" }));
    expect(screen.getByLabelText("Email address")).toHaveFocus();
  });

  it("invites the email typed with the role chosen, then clears the form and reloads the list", async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText("Email address"), { target: { value: "  Hire@Example.test " } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "lead" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));
    await waitFor(() => expect(api.inviteMember).toHaveBeenCalledWith({ firmId: "f1", email: "Hire@Example.test", role: "lead" }));
    expect(toast.success).toHaveBeenCalledWith("Invitation sent to Hire@Example.test.");
    await waitFor(() => expect(screen.getByLabelText("Email address")).toHaveValue(""));
    expect(api.fetchPendingInvitations).toHaveBeenCalledTimes(2);
  });

  it("offers agent first, and owner, lead and agent as the roles", async () => {
    renderPage();
    const select = await screen.findByLabelText("Role");
    expect(select).toHaveValue("agent");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Agent", "Lead", "Owner"]);
  });

  it("says when the invitation was saved but its email did not go, and that it can be resent", async () => {
    api.inviteMember.mockResolvedValue({ invitationId: "i9", delivery: "failed" });
    renderPage();
    fireEvent.change(await screen.findByLabelText("Email address"), { target: { value: "hire@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("The invitation is saved but the email didn't go out. Resend it from the list."));
  });

  it("says it is not known whether the email was delivered, rather than that it did not go, and that a new link replaces the first", async () => {
    api.inviteMember.mockResolvedValue({ invitationId: "i9", delivery: "unknown" });
    renderPage();
    fireEvent.change(await screen.findByLabelText("Email address"), { target: { value: "hire@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(
      "We couldn't confirm the email to hire@example.test was delivered. It may have arrived. Sending again makes a new link, and the first one then stops working.",
    ));
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("says the same for a resend whose delivery is not known", async () => {
    api.resendInvitation.mockResolvedValue({ invitationId: "i1", delivery: "unknown" });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Resend invitation to newcomer@example.test" }));
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(
      "We couldn't confirm the email to newcomer@example.test was delivered. It may have arrived. Sending again makes a new link, and the first one then stops working.",
    ));
  });

  it("lists an invitation whose delivery is not known as that, not as one that did not go out", async () => {
    api.fetchPendingInvitations.mockResolvedValue([pending({ delivery: "unknown", emailError: "timeout" })]);
    renderPage();
    const [item] = await within(await screen.findByRole("list", { name: "Pending invitations" })).findAllByRole("listitem");
    expect(item).toHaveTextContent("Not sure the email was delivered");
    expect(item).not.toHaveTextContent("did not go out");
  });

  it("treats an invitation with no recorded send as not known to have been delivered", async () => {
    api.fetchPendingInvitations.mockResolvedValue([pending({ delivery: null })]);
    renderPage();
    const [item] = await within(await screen.findByRole("list", { name: "Pending invitations" })).findAllByRole("listitem");
    expect(item).toHaveTextContent("Not sure the email was delivered");
  });

  it("shows why the server refused, and keeps what was typed", async () => {
    api.inviteMember.mockRejectedValue(new Error("Something went wrong. Try again."));
    renderPage();
    fireEvent.change(await screen.findByLabelText("Email address"), { target: { value: "hire@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));
    const alert = await within(screen.getByRole("form", { name: "Invite someone" })).findByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong. Try again.");
    // Next to the buttons, not under a field.
    expect(alert.parentElement).toContainElement(screen.getByRole("button", { name: "Send invitation" }));
    expect(screen.getByLabelText("Email address")).toHaveValue("hire@example.test");
    expect(screen.getByRole("button", { name: "Send invitation" })).toBeEnabled();
  });

  // Catches: an address that is already invited or a member shown away from the address field, or the form cleared.
  it.each([
    "That person is already a member of this firm",
    "That email already has a pending invitation to this firm. Resend it instead.",
  ])("shows %j under the email field and puts the cursor there", async (reason) => {
    api.inviteMember.mockRejectedValue(new Error(reason));
    renderPage();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email address"), "hire@example.test");
    await user.click(screen.getByRole("button", { name: "Send invitation" }));
    expect(await screen.findByText(reason)).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toHaveAccessibleDescription(new RegExp(reason.slice(0, 20)));
    await waitFor(() => expect(screen.getByLabelText("Email address")).toHaveFocus());
    expect(screen.getByLabelText("Email address")).toHaveValue("hire@example.test");
    expect(within(screen.getByRole("form", { name: "Invite someone" })).getAllByRole("alert")).toHaveLength(1);
  });

  // The page tells these two refusals apart by their words (the server sends no code the page can read). The sentences are
  // read from the migration that raises them, so rewording one there fails here instead of quietly moving the error away
  // from the email field.
  it("puts every 'already a member' and 'already invited' sentence the database raises under the email field", async () => {
    const sql = readFileSync("supabase/migrations/20261116190500_invitation_fixes.sql", "utf8");
    const raised = [...sql.matchAll(/RAISE EXCEPTION '((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"));
    const about = raised.filter((m) => /already a member|pending invitation to this firm/i.test(m));
    expect(about.length).toBeGreaterThanOrEqual(2);
    for (const sentence of new Set(about)) {
      api.inviteMember.mockReset().mockRejectedValue(new Error(sentence));
      const { unmount } = render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/firm/invitations"]}><Routes><Route path="/firm/invitations" element={<FirmInvitationsPage />} /></Routes></MemoryRouter></QueryClientProvider>);
      const user = userEvent.setup();
      await user.type(await screen.findByLabelText("Email address"), "hire@example.test");
      await user.click(screen.getByRole("button", { name: "Send invitation" }));
      await screen.findByText(sentence);
      expect(screen.getByLabelText("Email address")).toHaveAccessibleDescription(new RegExp(sentence.slice(0, 15)));
      unmount();
    }
  });

  describe("the invite form's rules", () => {
    const open = async () => {
      renderPage();
      const user = userEvent.setup();
      const email = await screen.findByLabelText("Email address");
      return { user, email };
    };

    it("marks the email as Required in words, tied to the field; the role is always chosen so it is not", async () => {
      const { email } = await open();
      expect(email).toHaveAttribute("aria-required", "true");
      expect(email).toHaveAccessibleDescription("Required");
      expect(screen.getByLabelText("Role")).not.toHaveAccessibleDescription(/Required/);
    });

    // Catches: Send disabled until an address is typed (the old behaviour).
    it("leaves Send invitation enabled with nothing typed; pressing it asks for the address under the field and takes focus there", async () => {
      const { user, email } = await open();
      const send = screen.getByRole("button", { name: "Send invitation" });
      expect(send).toBeEnabled();
      await user.click(send);
      expect(await screen.findByText("Enter the email address to invite.")).toHaveAttribute("role", "alert");
      expect(send).toBeEnabled();
      expect(api.inviteMember).not.toHaveBeenCalled();
      expect(email).toHaveAttribute("aria-invalid", "true");
      expect(email).toHaveAccessibleDescription(/Enter the email address to invite\./);
      await waitFor(() => expect(email).toHaveFocus());
    });

    it("says an address that doesn't look like one isn't, when the person leaves the field, without sending", async () => {
      const { user, email } = await open();
      await user.type(email, "not-an-address");
      expect(screen.queryByText(/Enter an email address like/)).not.toBeInTheDocument();
      await user.tab();
      expect(await screen.findByText("Enter an email address like name@example.com.")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Send invitation" }));
      expect(api.inviteMember).not.toHaveBeenCalled();
      await user.clear(email);
      await user.type(email, "ok@example.test");
      expect(screen.queryByText(/Enter an email address like/)).not.toBeInTheDocument();
    });

    it("is filled in and sent by keyboard alone: the address, then the role, then Send invitation", async () => {
      const { user } = await open();
      await user.tab();
      while (document.activeElement !== screen.getByLabelText("Email address")) await user.tab();
      await user.keyboard("hire@example.test");
      await user.tab();
      expect(screen.getByLabelText("Role")).toHaveFocus();
      await user.tab();
      expect(screen.getByRole("button", { name: "Send invitation" })).toHaveFocus();
      await user.keyboard("{Enter}");
      await waitFor(() => expect(api.inviteMember).toHaveBeenCalledWith({ firmId: "f1", email: "hire@example.test", role: "agent" }));
    });

    it("disables Send invitation only while sending, and says Sending…", async () => {
      let finish: (v: unknown) => void = () => {};
      api.inviteMember.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
      const { user, email } = await open();
      await user.type(email, "hire@example.test");
      await user.click(screen.getByRole("button", { name: "Send invitation" }));
      const busy = await screen.findByRole("button", { name: "Sending…" });
      expect(busy).toBeDisabled();
      finish({ invitationId: "i9", delivery: "sent" });
      expect(await screen.findByRole("button", { name: "Send invitation" })).toBeEnabled();
    });

    it("asks before the page is left with an address typed, and not when nothing was typed or once it was sent", async () => {
      const leave = () => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      };
      const { user, email } = await open();
      expect(leave()).toBe(false);
      await user.type(email, "hire@example.test");
      expect(leave()).toBe(true);
      await user.click(screen.getByRole("button", { name: "Send invitation" }));
      await waitFor(() => expect(email).toHaveValue(""));
      expect(leave()).toBe(false);
    });

    it("asks before the app moves to another page with an address typed", async () => {
      const router = createMemoryRouter(
        [
          { path: "/firm/invitations", element: <><Link to="/elsewhere">Elsewhere</Link><FirmInvitationsPage /></> },
          { path: "/elsewhere", element: <p>Elsewhere page</p> },
        ],
        { initialEntries: ["/firm/invitations"] },
      );
      render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>);
      const user = userEvent.setup();
      await user.type(await screen.findByLabelText("Email address"), "hire@example.test");
      await user.click(screen.getByRole("link", { name: "Elsewhere" }));
      const ask = await screen.findByRole("alertdialog");
      expect(ask).toHaveTextContent("Discard your changes?");
      expect(screen.queryByText("Elsewhere page")).not.toBeInTheDocument();
      await user.click(within(ask).getByRole("button", { name: "Discard changes" }));
      expect(await screen.findByText("Elsewhere page")).toBeInTheDocument();
    });
  });

  it("resends one invitation, and withdraws one", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Resend invitation to late@example.test" }));
    await waitFor(() => expect(api.resendInvitation).toHaveBeenCalledWith("i2"));
    expect(toast.success).toHaveBeenCalledWith("Invitation sent again to late@example.test.");
    fireEvent.click(screen.getByRole("button", { name: "Withdraw invitation to newcomer@example.test" }));
    await waitFor(() => expect(api.cancelInvitation).toHaveBeenCalledWith("i1"));
    expect(toast.success).toHaveBeenCalledWith("Invitation to newcomer@example.test withdrawn.");
    expect(api.fetchPendingInvitations.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("reports a refused withdrawal as it was told", async () => {
    api.cancelInvitation.mockRejectedValue(new Error("That invitation has already been used or withdrawn."));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Withdraw invitation to newcomer@example.test" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("That invitation has already been used or withdrawn."));
  });

  it("offers a retry when the list can't be loaded", async () => {
    api.fetchPendingInvitations.mockRejectedValueOnce(new Error("Couldn't load the invitations."));
    renderPage();
    expect(await screen.findByText("We couldn't load the invitations.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("list", { name: "Pending invitations" })).toBeInTheDocument();
  });
});
