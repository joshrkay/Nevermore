import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FirmMarketContact, MarketRequest } from "@/lib/marketApi";

// A firm's own contacts at a market, its requests for one that isn't listed, and a platform admin's answers (BR-1.3, BR-1.4). The database is faked at
// src/lib/marketApi; what it refuses is shown in its own words.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "gus@example.com" }, signOut: vi.fn() }) }));
const api = {
  loadFirmMarketContacts: vi.fn(), addFirmMarketContact: vi.fn(), removeFirmMarketContact: vi.fn(),
  loadFirmMarketRequests: vi.fn(), requestMarket: vi.fn(), loadAdminMarketRequests: vi.fn(), answerMarketRequest: vi.fn(),
};
vi.mock("@/lib/marketApi", () => api);
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const { AdminMarketRequests, AskForMarket, FirmMarketContacts } = await import("./FirmMarkets");

const contact = (over: Partial<FirmMarketContact>): FirmMarketContact => ({ id: 1, peoId: 2, peoName: "Harbor PEO", name: "Lee Ortiz", role: "Underwriting", email: "lee@harbor.example", phone: null, addedBy: "Gus", ...over });
const request = (over: Partial<MarketRequest>): MarketRequest => ({
  id: 1, firmName: null, name: "Summit PEO", line: "peo", contactName: null, contactEmail: null, note: null, status: "open", answer: null, requestedBy: "Gus", createdAt: "2026-11-27T10:00:00Z", ...over,
});

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));

describe("a firm's contacts at a market", () => {
  // Break caught: the contacts of every market listed under the one on screen, so a broker reads another PEO's person as this one's.
  it("lists the firm's contacts at this market and none at another", async () => {
    api.loadFirmMarketContacts.mockResolvedValue([contact({}), contact({ id: 9, peoId: 3, peoName: "Granite Ridge Mutual", name: "Ana Wu", email: "ana@granite.example" })]);
    render(<FirmMarketContacts firmId="f1" peoId={2} peoName="Harbor PEO" canChange />);
    const list = await screen.findByRole("list", { name: "Your firm's contacts at Harbor PEO" });
    expect(within(list).getByText("Lee Ortiz, Underwriting")).toBeInTheDocument();
    expect(within(list).getByText("lee@harbor.example")).toBeInTheDocument();
    expect(screen.queryByText(/Ana Wu/)).toBeNull();
    expect(api.loadFirmMarketContacts).toHaveBeenCalledWith("f1");
  });

  it("says the firm has none of its own there yet", async () => {
    api.loadFirmMarketContacts.mockResolvedValue([]);
    render(<FirmMarketContacts firmId="f1" peoId={2} peoName="Harbor PEO" canChange />);
    expect(await screen.findByText("Your firm has no contact of its own at Harbor PEO yet.")).toBeInTheDocument();
  });

  // Break caught: a contact added to the wrong market, or the list left showing what it showed before.
  it("adds a contact at this market, clears the form and reads the list again", async () => {
    api.loadFirmMarketContacts.mockResolvedValueOnce([]).mockResolvedValueOnce([contact({})]);
    api.addFirmMarketContact.mockResolvedValue(undefined);
    render(<FirmMarketContacts firmId="f1" peoId={2} peoName="Harbor PEO" canChange />);
    const form = await screen.findByRole("form", { name: "Add a contact at Harbor PEO" });
    fireEvent.change(within(form).getByLabelText("Name (required)"), { target: { value: "Lee Ortiz" } });
    fireEvent.change(within(form).getByLabelText("Email (required)"), { target: { value: "lee@harbor.example" } });
    fireEvent.change(within(form).getByLabelText("Role"), { target: { value: "Underwriting" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add contact" }));
    await waitFor(() => expect(api.addFirmMarketContact).toHaveBeenCalledWith("f1", 2, { name: "Lee Ortiz", role: "Underwriting", email: "lee@harbor.example", phone: "" }));
    expect(await screen.findByText("Lee Ortiz, Underwriting")).toBeInTheDocument();
    expect(within(form).getByLabelText("Name (required)")).toHaveValue("");
  });

  // Break caught: a refusal swallowed, so the broker believes a duplicate was saved, and what they typed thrown away.
  it("shows a refused add in the database's words and keeps what was typed", async () => {
    api.loadFirmMarketContacts.mockResolvedValue([]);
    api.addFirmMarketContact.mockRejectedValue(new Error("lee@harbor.example is already one of your firm's contacts at Harbor PEO"));
    render(<FirmMarketContacts firmId="f1" peoId={2} peoName="Harbor PEO" canChange />);
    const form = await screen.findByRole("form", { name: "Add a contact at Harbor PEO" });
    fireEvent.change(within(form).getByLabelText("Name (required)"), { target: { value: "Lee" } });
    fireEvent.change(within(form).getByLabelText("Email (required)"), { target: { value: "lee@harbor.example" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add contact" }));
    expect(await screen.findByText("lee@harbor.example is already one of your firm's contacts at Harbor PEO")).toBeInTheDocument();
    expect(within(form).getByLabelText("Name (required)")).toHaveValue("Lee");
  });

  it("removes a contact by its own button and reads the list again", async () => {
    api.loadFirmMarketContacts.mockResolvedValueOnce([contact({})]).mockResolvedValueOnce([]);
    api.removeFirmMarketContact.mockResolvedValue(undefined);
    render(<FirmMarketContacts firmId="f1" peoId={2} peoName="Harbor PEO" canChange />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove Lee Ortiz" }));
    await waitFor(() => expect(api.removeFirmMarketContact).toHaveBeenCalledWith("f1", 1));
    expect(await screen.findByText("Your firm has no contact of its own at Harbor PEO yet.")).toBeInTheDocument();
  });

  it("says the contacts couldn't be loaded, and offers to try again, never that there are none", async () => {
    api.loadFirmMarketContacts.mockRejectedValueOnce(new Error("Couldn't load your firm's contacts. Try again.")).mockResolvedValueOnce([contact({})]);
    render(<FirmMarketContacts firmId="f1" peoId={2} peoName="Harbor PEO" canChange />);
    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Lee Ortiz, Underwriting")).toBeInTheDocument();
    expect(screen.queryByText(/has no contact of its own/)).toBeNull();
  });
});

describe("asking for a market that isn't listed", () => {
  // Break caught: a carrier asked for as a PEO, so it is listed where no workers' comp search is offered it.
  it("sends the request with what it quotes, and lists it as waiting", async () => {
    api.loadFirmMarketRequests.mockResolvedValueOnce([]).mockResolvedValueOnce([request({ name: "Ridge Mutual", line: "workers_comp" })]);
    api.requestMarket.mockResolvedValue(undefined);
    render(<AskForMarket firmId="f1" canChange />);
    const form = await screen.findByRole("form", { name: "Ask for a PEO or carrier" });
    fireEvent.change(within(form).getByLabelText("Its name (required)"), { target: { value: "Ridge Mutual" } });
    fireEvent.change(within(form).getByLabelText("What it quotes"), { target: { value: "workers_comp" } });
    fireEvent.change(within(form).getByLabelText("Their email"), { target: { value: "sam@ridge.example" } });
    fireEvent.click(within(form).getByRole("button", { name: "Send the request" }));
    await waitFor(() => expect(api.requestMarket).toHaveBeenCalledWith("f1", { name: "Ridge Mutual", line: "workers_comp", contactName: "", contactEmail: "sam@ridge.example", note: "" }));
    const row = (await screen.findByText("Ridge Mutual")).closest("li")!;
    expect(row).toHaveTextContent("Workers' comp carrier");
    expect(row).toHaveTextContent("Waiting for Nevermore · asked Nov 27, 2026 by Gus");
  });

  it("shows Nevermore's answer on an answered request", async () => {
    api.loadFirmMarketRequests.mockResolvedValue([request({ status: "declined", answer: "A carrier: it is listed under workers' comp." })]);
    render(<AskForMarket firmId="f1" canChange />);
    const row = (await screen.findByText("Summit PEO")).closest("li")!;
    expect(row).toHaveTextContent("Not listed");
    expect(row).toHaveTextContent("A carrier: it is listed under workers' comp.");
  });

  it("shows a refused request in the database's words", async () => {
    api.loadFirmMarketRequests.mockResolvedValue([]);
    api.requestMarket.mockRejectedValue(new Error("Harbor PEO is already listed"));
    render(<AskForMarket firmId="f1" canChange />);
    const form = await screen.findByRole("form", { name: "Ask for a PEO or carrier" });
    fireEvent.change(within(form).getByLabelText("Its name (required)"), { target: { value: "harbor peo" } });
    fireEvent.click(within(form).getByRole("button", { name: "Send the request" }));
    expect(await screen.findByText("Harbor PEO is already listed")).toBeInTheDocument();
  });
});

describe("a platform admin's answers", () => {
  const markets = [{ id: 7, name: "Summit PEO", line: "peo", listed: true }, { id: 8, name: "Granite Ridge Mutual", line: "workers_comp", listed: true }, { id: 9, name: "Old PEO", line: "peo", listed: false }];

  it("draws nothing when no firm has asked for anything", async () => {
    api.loadAdminMarketRequests.mockResolvedValue([]);
    const { container } = render(<AdminMarketRequests markets={markets} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  // Break caught: a PEO request answered as a carrier (or as a market taken off the list), which the firm could then never send to.
  it("offers only listed markets of the request's line, and answers it as listed with the one chosen", async () => {
    api.loadAdminMarketRequests.mockResolvedValue([request({ firmName: "Acme Brokers", contactName: "Sam Cole", contactEmail: "sam@summit.example" })]);
    api.answerMarketRequest.mockResolvedValue(undefined);
    render(<AdminMarketRequests markets={markets} />);
    expect(await screen.findByRole("heading", { name: "Requests from firms (1 waiting)" })).toBeInTheDocument();
    expect(screen.getByText("Their contact there: Sam Cole, sam@summit.example")).toBeInTheDocument();
    const choice = screen.getByLabelText("Listed as");
    expect(within(choice).getAllByRole("option").map((o) => o.textContent)).toEqual(["Choose the PEO on the list", "Summit PEO"]);
    expect(screen.getByRole("button", { name: "It is listed now" })).toBeDisabled();
    fireEvent.change(choice, { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "It is listed now" }));
    await waitFor(() => expect(api.answerMarketRequest).toHaveBeenCalledWith(1, { listed: true, peoId: 7, answer: "" }));
  });

  it("declines only with words the firm will read", async () => {
    api.loadAdminMarketRequests.mockResolvedValue([request({ firmName: "Acme Brokers" })]);
    api.answerMarketRequest.mockResolvedValue(undefined);
    render(<AdminMarketRequests markets={markets} />);
    const decline = await screen.findByRole("button", { name: "Not listing it" });
    expect(decline).toBeDisabled();
    fireEvent.change(screen.getByLabelText("What the firm is told"), { target: { value: "It left the market." } });
    fireEvent.click(decline);
    await waitFor(() => expect(api.answerMarketRequest).toHaveBeenCalledWith(1, { listed: false, peoId: null, answer: "It left the market." }));
  });
});
