import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "admin@example.com" }, signOut: vi.fn() }) }));
// The header asks which firm the address names; these pages are tested at the bare domain.
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => ({ status: "none" }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const api = { fetchIsAdmin: vi.fn(), loadOrganisationRule: vi.fn(), addAllowedOrganisation: vi.fn(), removeAllowedOrganisation: vi.fn() };
vi.mock("@/lib/advisorApi", () => api);

const { default: AdvisorOrganisationsPage } = await import("./AdvisorOrganisationsPage");

const renderPage = () => render(<MemoryRouter><AdvisorOrganisationsPage /></MemoryRouter>);
const org = (over: Record<string, unknown> = {}) => ({ id: 1, provider: "google", org_id: "advisory.example", label: "Edgar Allan Advisory", added_by: "a1", added_by_email: "admin@example.com", added_at: "2026-11-11T12:00:00Z", ...over });
const event = (over: Record<string, unknown> = {}) => ({ id: 1, kind: "role_granted", provider: "google", org_id: "advisory.example", org_label: "Edgar Allan Advisory", actor_id: "u1", actor_email: "new@advisory.example", at: "2026-11-11T13:00:00Z", ...over });

describe("AdvisorOrganisationsPage", () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    api.fetchIsAdmin.mockResolvedValue(true);
    api.loadOrganisationRule.mockResolvedValue({ organisations: [org()], events: [event()] });
  });

  it("is for admins, and loads nothing for anyone else", async () => {
    api.fetchIsAdmin.mockResolvedValue(false);
    renderPage();
    expect(await screen.findByText("Only an admin can change who gets the advisor role.")).toBeInTheDocument();
    expect(api.loadOrganisationRule).not.toHaveBeenCalled();
  });

  it("says plainly that an empty list means everyone waits", async () => {
    api.loadOrganisationRule.mockResolvedValue({ organisations: [], events: [] });
    renderPage();
    expect(await screen.findByText(/No organisation is allowed yet, so everyone who signs up waits/)).toBeInTheDocument();
  });

  it("lists each organisation with who added it, and the grants and changes", async () => {
    renderPage();
    const list = await screen.findByRole("region", { name: "The list" });
    expect(within(list).getByText("Edgar Allan Advisory")).toBeInTheDocument();
    expect(within(list).getByText("advisory.example")).toBeInTheDocument();
    expect(list).toHaveTextContent("by admin@example.com");
    const log = screen.getByRole("region", { name: "Recent changes and grants" });
    expect(log).toHaveTextContent("new@advisory.example: Got the advisor role through Edgar Allan Advisory (Google)");
  });

  it("asks for a domain for Google and a tenant ID for Microsoft", async () => {
    renderPage();
    expect(await screen.findByLabelText("Verified domain")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "microsoft" } });
    expect(screen.getByLabelText("Tenant ID")).toBeInTheDocument();
  });

  it("adds an organisation and reloads the list", async () => {
    api.addAllowedOrganisation.mockResolvedValue(undefined);
    renderPage();
    fireEvent.change(await screen.findByLabelText("Verified domain"), { target: { value: " other.example " } });
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: " Other Advisors " } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(api.addAllowedOrganisation).toHaveBeenCalledWith("google", "other.example", "Other Advisors"));
    await waitFor(() => expect(api.loadOrganisationRule).toHaveBeenCalledTimes(2));
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows the database's reason when it refuses one, such as a free-mail domain", async () => {
    api.addAllowedOrganisation.mockRejectedValue(new Error("A free-mail domain or personal-account tenant can never be allowed: it would match everyone with a free account"));
    renderPage();
    fireEvent.change(await screen.findByLabelText("Verified domain"), { target: { value: "gmail.com" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Everyone" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("free-mail domain")));
  });

  it("asks before it removes one, and says those who have the role keep it", async () => {
    api.removeAllowedOrganisation.mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Remove Edgar Allan Advisory" }));
    expect(api.removeAllowedOrganisation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Edgar Allan Advisory" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, remove" }));
    await waitFor(() => expect(api.removeAllowedOrganisation).toHaveBeenCalledWith(1));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("keep it until you revoke it"));
  });

  it("offers a retry when it can't load", async () => {
    api.loadOrganisationRule.mockRejectedValueOnce(new Error("boom")).mockResolvedValue({ organisations: [], events: [] });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
    expect(await screen.findByText(/No organisation is allowed yet/)).toBeInTheDocument();
  });
});
