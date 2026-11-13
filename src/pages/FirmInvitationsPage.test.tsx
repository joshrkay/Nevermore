import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

const auth = { user: { id: "u1", email: "owner@example.test" } as { id: string; email?: string } | null, loading: false, isAnonymous: false, signOut: vi.fn() };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const firm = { current: { status: "known", address: "acme-brokers", name: "Acme Brokers" } as Record<string, unknown> };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firm.current }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
const api = { fetchMyFirm: vi.fn(), fetchPendingInvitations: vi.fn(), inviteMember: vi.fn(), resendInvitation: vi.fn(), cancelInvitation: vi.fn() };
vi.mock("@/lib/invitationApi", () => api);

const { default: FirmInvitationsPage } = await import("./FirmInvitationsPage");

const renderPage = () => render(<MemoryRouter initialEntries={["/firm/invitations"]}><Routes><Route path="/firm/invitations" element={<FirmInvitationsPage />} /><Route path="/login" element={<p>Sign-in page</p>} /></Routes></MemoryRouter>);
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

  it("says plainly when nobody is waiting", async () => {
    api.fetchPendingInvitations.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("No invitations are waiting.")).toBeInTheDocument();
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
    api.inviteMember.mockRejectedValue(new Error("That person is already a member of this firm"));
    renderPage();
    fireEvent.change(await screen.findByLabelText("Email address"), { target: { value: "hire@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That person is already a member of this firm");
    expect(screen.getByLabelText("Email address")).toHaveValue("hire@example.test");
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
    expect(await screen.findByText("Couldn't load the invitations.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("list", { name: "Pending invitations" })).toBeInTheDocument();
  });
});
