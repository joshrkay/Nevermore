import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

const auth = { user: { id: "u1", email: "owner@example.test" } as { id: string; email?: string } | null, loading: false, isAnonymous: false, signOut: vi.fn() };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const firm = { current: { status: "known", address: "acme-brokers", name: "Acme Brokers" } as Record<string, unknown> };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firm.current }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
const invitations = { fetchMyFirm: vi.fn(), fetchPendingInvitations: vi.fn(), inviteMember: vi.fn(), resendInvitation: vi.fn(), cancelInvitation: vi.fn() };
vi.mock("@/lib/invitationApi", () => invitations);
class JoinByOrganisationError extends Error {}
const join = {
  JoinByOrganisationError,
  fetchOrganisations: vi.fn(), addOrganisation: vi.fn(), removeOrganisation: vi.fn(),
  fetchJoinRequests: vi.fn(), approveJoinRequest: vi.fn(), declineJoinRequest: vi.fn(),
};
vi.mock("@/lib/joinByOrganisationApi", () => join);

const { default: FirmInvitationsPage } = await import("./FirmInvitationsPage");

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={["/firm/invitations"]}><Routes><Route path="/firm/invitations" element={<FirmInvitationsPage />} /></Routes></MemoryRouter>
  </QueryClientProvider>,
);
const organisation = (over: Record<string, unknown> = {}) => ({ id: "o1", provider: "google", orgId: "advisory.example", label: "Acme Brokers (Google)", addedAt: "2026-11-18T10:00:00Z", ...over });
const request = (over: Record<string, unknown> = {}) => ({ id: "r1", email: "new@advisory.example", askedAt: "2026-11-18T11:00:00Z", provider: "google", organisation: "Acme Brokers (Google)", ...over });

// An owner lists the firm's Google domain or Microsoft tenant, and approves or declines the people who asked to join from one
// (story CRM-P1.4). The database decides who may and what can be listed; these tests are about what the owner sees and does.
describe("FirmInvitationsPage: organisations and people who asked to join", () => {
  beforeEach(() => {
    auth.user = { id: "u1", email: "owner@example.test" };
    firm.current = { status: "known", address: "acme-brokers", name: "Acme Brokers" };
    invitations.fetchMyFirm.mockReset().mockResolvedValue({ id: "f1", name: "Acme Brokers", role: "owner" });
    invitations.fetchPendingInvitations.mockReset().mockResolvedValue([]);
    join.fetchOrganisations.mockReset().mockResolvedValue([organisation(), organisation({ id: "o2", provider: "microsoft", orgId: "0f9f1d5c-3a64-4d6e-9f47-1c2b8f7e5a10", label: "Acme Brokers (Microsoft)" })]);
    join.fetchJoinRequests.mockReset().mockResolvedValue([request(), request({ id: "r2", email: "ms@advisory.example", provider: "microsoft", organisation: "Acme Brokers (Microsoft)" })]);
    for (const fn of [join.addOrganisation, join.removeOrganisation, join.declineJoinRequest]) fn.mockReset().mockResolvedValue(undefined);
    join.approveJoinRequest.mockReset().mockImplementation(async (_id: string, role: string) => role);
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  // Catches: the owner can't see which Google domain or Microsoft tenant the firm lists, or which provider each is.
  it("lists the firm's organisations with the provider, the name and the domain or tenant", async () => {
    renderPage();
    const list = await screen.findByRole("list", { name: "Listed organisations" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Google");
    expect(items[0]).toHaveTextContent("Acme Brokers (Google)");
    expect(items[0]).toHaveTextContent("advisory.example");
    expect(items[1]).toHaveTextContent("Microsoft");
    expect(items[1]).toHaveTextContent("0f9f1d5c-3a64-4d6e-9f47-1c2b8f7e5a10");
  });

  // Catches: a firm with nothing listed is left with a blank where the section should explain itself.
  it("says plainly that no organisation is listed and what listing one does, and takes the owner to the form", async () => {
    join.fetchOrganisations.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/Organisations you list appear here; until you list one, nobody can ask to join/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "List an organisation" }));
    expect(screen.getByLabelText("Provider")).toHaveFocus();
  });

  // Catches: listing sends the wrong provider, the wrong field or untrimmed words, or the list does not refresh.
  it("lists a Google domain with the name typed, then clears the form and reloads the list", async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText("Google domain"), { target: { value: " advisory.example " } });
    fireEvent.change(screen.getByLabelText("Name of the organisation"), { target: { value: " Acme Brokers " } });
    fireEvent.click(screen.getByRole("button", { name: "List organisation" }));
    await waitFor(() => expect(join.addOrganisation).toHaveBeenCalledWith({ firmId: "f1", provider: "google", orgId: "advisory.example", label: "Acme Brokers" }));
    expect(toast.success).toHaveBeenCalledWith("Listed. People who sign in from it at your firm's address will show here as asking to join.");
    await waitFor(() => expect(screen.getByLabelText("Google domain")).toHaveValue(""));
    expect(join.fetchOrganisations).toHaveBeenCalledTimes(2);
  });

  // Catches: a Microsoft tenant is typed into a field that says domain (the wrong thing to enter), or sent as Google.
  it("asks for a tenant ID when Microsoft is chosen and sends it as Microsoft", async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText("Provider"), { target: { value: "microsoft" } });
    fireEvent.change(screen.getByLabelText("Microsoft tenant ID"), { target: { value: "0f9f1d5c-3a64-4d6e-9f47-1c2b8f7e5a10" } });
    fireEvent.change(screen.getByLabelText("Name of the organisation"), { target: { value: "Acme" } });
    fireEvent.click(screen.getByRole("button", { name: "List organisation" }));
    await waitFor(() => expect(join.addOrganisation).toHaveBeenCalledWith({ firmId: "f1", provider: "microsoft", orgId: "0f9f1d5c-3a64-4d6e-9f47-1c2b8f7e5a10", label: "Acme" }));
  });

  // Catches: the database's refusal of a free-mail domain is swallowed or shown as a generic failure, or the typed words are lost.
  it("shows the database's reason when it will not list one, and keeps what was typed", async () => {
    join.addOrganisation.mockRejectedValue(new JoinByOrganisationError("A free-mail domain or personal-account tenant can never be listed: it would match everyone with a free account"));
    renderPage();
    fireEvent.change(await screen.findByLabelText("Google domain"), { target: { value: "gmail.com" } });
    fireEvent.change(screen.getByLabelText("Name of the organisation"), { target: { value: "Everyone" } });
    fireEvent.click(screen.getByRole("button", { name: "List organisation" }));
    expect(await screen.findByText(/free-mail domain or personal-account tenant can never be listed/)).toBeInTheDocument();
    expect(screen.getByLabelText("Google domain")).toHaveValue("gmail.com");
  });

  // Catches: one click removes a listing with no question, or removing leaves it on screen.
  it("asks before removing an organisation, and says people already asking stay for the owner to decide", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Remove Acme Brokers (Google)" }));
    expect(join.removeOrganisation).not.toHaveBeenCalled();
    expect(screen.getByText(/People who already asked stay in Asked to join/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yes, remove" }));
    await waitFor(() => expect(join.removeOrganisation).toHaveBeenCalledWith("o1"));
    await waitFor(() => expect(join.fetchOrganisations).toHaveBeenCalledTimes(2));
  });

  // Catches: the owner can't tell who asked, when, or which organisation vouched for them.
  it("lists each person who asked to join: the email, when, and which organisation vouched", async () => {
    renderPage();
    const list = await screen.findByRole("list", { name: "Asked to join" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("new@advisory.example");
    expect(items[0]).toHaveTextContent("Acme Brokers (Google)");
    expect(items[0]).toHaveTextContent(/Asked/);
    expect(items[1]).toHaveTextContent("ms@advisory.example");
    expect(items[1]).toHaveTextContent("Acme Brokers (Microsoft)");
  });

  // Catches: a firm with nobody waiting shows nothing, or the section is left out.
  it("says plainly when nobody has asked", async () => {
    join.fetchJoinRequests.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("People who ask to join from a listed organisation appear here.")).toBeInTheDocument();
    // Nobody can make a request on another's behalf, so the empty list has no action.
    expect(within(screen.getByRole("heading", { name: "Asked to join" }).closest("section")!).queryAllByRole("button")).toHaveLength(0);
  });

  // Catches: approving makes the person a member with a role the owner did not choose (the default must be the least access), or
  // approves the wrong person.
  it("approves a person with the role chosen for them, and offers agent first", async () => {
    renderPage();
    const select = await screen.findByLabelText("Role for new@advisory.example");
    expect(select).toHaveValue("agent");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Agent", "Lead", "Owner"]);
    fireEvent.change(select, { target: { value: "lead" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve new@advisory.example" }));
    await waitFor(() => expect(join.approveJoinRequest).toHaveBeenCalledWith("r1", "lead"));
    expect(join.approveJoinRequest).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("new@advisory.example is now a lead of Acme Brokers.");
    await waitFor(() => expect(join.fetchJoinRequests).toHaveBeenCalledTimes(2));
  });

  // Catches: the owner is told the role they picked when the database kept the role the person already held (they had joined by invitation).
  it("names the role the person actually holds, which the database returns, not the one picked", async () => {
    join.approveJoinRequest.mockResolvedValue("agent");
    renderPage();
    fireEvent.change(await screen.findByLabelText("Role for new@advisory.example"), { target: { value: "owner" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve new@advisory.example" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("new@advisory.example is now an agent of Acme Brokers."));
  });

  // Catches: declining makes a member, declines the wrong person, or asks nothing and loses the person for good by one mis-click.
  it("declines a person after asking, and says a declined person is not listed again", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Decline ms@advisory.example" }));
    expect(join.declineJoinRequest).not.toHaveBeenCalled();
    expect(screen.getByText(/won't be listed again when they sign in/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yes, decline" }));
    await waitFor(() => expect(join.declineJoinRequest).toHaveBeenCalledWith("r2"));
    expect(join.approveJoinRequest).not.toHaveBeenCalled();
    await waitFor(() => expect(join.fetchJoinRequests).toHaveBeenCalledTimes(2));
  });

  // Catches: a refused approval (someone else decided first) looks like success.
  it("tells the owner when an approval is refused, and still reloads the list", async () => {
    join.approveJoinRequest.mockRejectedValue(new JoinByOrganisationError("Someone has already decided that request."));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Approve new@advisory.example" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Someone has already decided that request."));
    expect(toast.success).not.toHaveBeenCalled();
    await waitFor(() => expect(join.fetchJoinRequests).toHaveBeenCalledTimes(2));
  });

  // Catches: a lead or an agent is shown the owners' lists, or the page asks the database for them.
  it("shows neither list to someone who is not an owner, and asks for neither", async () => {
    invitations.fetchMyFirm.mockResolvedValue({ id: "f1", name: "Acme Brokers", role: "lead" });
    renderPage();
    expect(await screen.findByText("Only an owner of the firm can invite people.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Asked to join" })).not.toBeInTheDocument();
    expect(join.fetchOrganisations).not.toHaveBeenCalled();
    expect(join.fetchJoinRequests).not.toHaveBeenCalled();
  });
});
