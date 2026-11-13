import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "admin@example.com" }, signOut: vi.fn() }) }));
// The header asks which firm the address names; these pages are tested at the bare domain.
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => ({ status: "none" }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const api = { fetchIsAdmin: vi.fn(), loadHeldMail: vi.fn(), assignHeldMessage: vi.fn(), discardHeldMessage: vi.fn() };
vi.mock("@/lib/advisorApi", () => api);

const { default: AdvisorHeldMailPage } = await import("./AdvisorHeldMailPage");

const renderPage = () => render(<MemoryRouter><AdvisorHeldMailPage /></MemoryRouter>);

const message = (over: Record<string, unknown> = {}) => ({
  id: 5, provider_message_id: "re_5", quote_request_id: null, session_id: null, address_local_part: "eaa-2026-0031.trinet.p3m8v2zt", held_reason: "revoked_address",
  held_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), moved_by: null, moved_by_email: null, moved_from_quote_request_id: null, moved_note: null,
  direction: "received", is_automatic: false, new_sender: false, from_address: "dana.whitfield@trinet.example", from_name: "Dana Whitfield", to_addresses: [], cc_addresses: [],
  subject: "Revised start date", body_text: "We can do a 1 February start.", body_truncated: false, headers: {}, sent_at: null, recorded_at: "2026-11-09T10:00:00Z", ...over,
});
const held = (messages: unknown[], attachments: unknown[] = []) => ({
  messages, attachments,
  requests: [
    { id: 3, fileId: "EAA-2026-0031", company: "Alder & Finch Dental", peo: "TriNet", localParts: ["eaa-2026-0031.trinet.p3m8v2zt"] },
    { id: 4, fileId: "EAA-2026-0042", company: "Harbor Street Bakery LLC", peo: "Justworks", localParts: [] },
  ],
  names: new Map([[4, "EAA-2026-0042, Justworks"]]),
});

describe("AdvisorHeldMailPage", () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    api.fetchIsAdmin.mockResolvedValue(true);
    api.loadHeldMail.mockResolvedValue(held([message()]));
  });

  it("tells anyone but an admin that it is for admins, and loads no mail", async () => {
    api.fetchIsAdmin.mockResolvedValue(false);
    renderPage();
    expect(await screen.findByText("Only an admin can see held mail.")).toBeInTheDocument();
    expect(api.loadHeldMail).not.toHaveBeenCalled();
  });

  it("says when nothing is held", async () => {
    api.loadHeldMail.mockResolvedValue(held([]));
    renderPage();
    expect(await screen.findByText("Nothing is being held.")).toBeInTheDocument();
  });

  it("shows why a message is held, where the revoked address belonged, and when it will be deleted", async () => {
    renderPage();
    const card = (await screen.findByText("Revised start date")).closest("article")!;
    expect(within(card).getByText("Revoked address")).toBeInTheDocument();
    expect(within(card).getByText(/It belonged to EAA-2026-0031 · Alder & Finch Dental · TriNet/)).toBeInTheDocument();
    expect(within(card).getByText(/deleted in 28 days/)).toBeInTheDocument();
    expect(within(card).getByText("We can do a 1 February start.")).toBeInTheDocument();
  });

  it("shows who moved a message, from where, and why", async () => {
    api.loadHeldMail.mockResolvedValue(held([message({ held_reason: "moved_by_advisor", moved_by_email: "marcus@advisory.example", moved_from_quote_request_id: 4, moved_note: "Justworks, not TriNet" })]));
    renderPage();
    expect(await screen.findByText('Moved by marcus@advisory.example from EAA-2026-0042, Justworks: "Justworks, not TriNet"')).toBeInTheDocument();
  });

  it("lists attachments by what became of them", async () => {
    api.loadHeldMail.mockResolvedValue(held([message()], [{ id: 1, message_id: 5, file_name: "offer.pdf", status: "stored", not_kept_reason: null, size_bytes: 2048 }]));
    renderPage();
    const files = await screen.findByRole("list", { name: "Attachments" });
    expect(within(files).getByText("offer.pdf")).toBeInTheDocument();
    expect(within(files).getByText(/scanned, clean/)).toBeInTheDocument();
  });

  it("assigns to the chosen quote request, only once one is chosen, and reloads", async () => {
    api.assignHeldMessage.mockResolvedValue(undefined);
    renderPage();
    const assign = await screen.findByRole("button", { name: "Assign" });
    expect(assign).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Assign to a quote request"), { target: { value: "4" } });
    fireEvent.click(assign);
    await waitFor(() => expect(api.assignHeldMessage).toHaveBeenCalledWith(5, 4));
    await waitFor(() => expect(api.loadHeldMail).toHaveBeenCalledTimes(2));
    expect(toast.success).toHaveBeenCalled();
  });

  it("asks before it discards, and says why when it can't", async () => {
    api.discardHeldMessage.mockRejectedValue(new Error("You can't do that."));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Discard" }));
    expect(api.discardHeldMessage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, discard" }));
    await waitFor(() => expect(api.discardHeldMessage).toHaveBeenCalledWith(5));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("You can't do that."));
  });

  it("offers a retry when the list can't load", async () => {
    api.loadHeldMail.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(held([]));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Nothing is being held.")).toBeInTheDocument();
  });
});
