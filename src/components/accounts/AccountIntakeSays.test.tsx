import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { AccountDetails as Details } from "@/lib/accountPageApi";

// "The intake says 23" with "Use it" on the account's details (story CRM-Q1.2, D-1715, D-1812). The database's rules (what differs, from which certification,
// who may be told) are tested in supabase/tests/intake_teaches_account.sql; here the client answers and the panel draws it and saves through the edit's own call.

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const client = { getIntakeSays: vi.fn(), updateAccount: vi.fn() };
vi.mock("@/lib/accountPageApi", async () => ({ ...(await vi.importActual<object>("@/lib/accountPageApi")), ...client }));
vi.mock("@/lib/accountsApi", async () => ({ ...(await vi.importActual<object>("@/lib/accountsApi")), listFirmMembers: vi.fn().mockResolvedValue([]) }));

const { AccountDetailsPanel } = await import("./AccountDetails");

const account: Details = {
  id: "a1", version: 3, name: "Harborview Dental Group", tradeName: null, website: "harborviewdental.example", webDomain: "harborviewdental.example",
  phone: null, street: "410 SW Alder St", city: "Portland", state: "OR", postalCode: "97204", industry: "Dental practice", employees: 45,
  statesOfOperation: ["OR", "WA"], currentProvider: "Payroll vendor", source: "employer_intake", archivedAt: null,
  createdAt: "2026-10-28T10:00:00+00:00", updatedAt: "2026-11-01T10:00:00+00:00",
  status: "prospect", owner: null, sourcePartner: null, possibleDuplicateOf: null,
} as Details;

const onSaved = vi.fn();
const renderPanel = (canChange = true, over: Partial<Details> = {}) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } })}>
      <AccountDetailsPanel firmId="f1" account={{ ...account, ...over }} canChange={canChange} onSaved={onSaved} />
    </QueryClientProvider>,
  );
const row = (label: string) => screen.getByText(label).closest("div") as HTMLElement;

beforeEach(() => {
  for (const fn of Object.values(client)) fn.mockReset();
  onSaved.mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  client.getIntakeSays.mockResolvedValue({});
});

describe("the account's details: what the intake says", () => {
  // Catches: the page keeping the difference to itself, so the agent never learns the employer certified another headcount.
  it("says what the intake says beside a field where the account differs", async () => {
    client.getIntakeSays.mockResolvedValue({ employees: 23 });
    renderPanel();
    expect(await within(row("Employees")).findByText("The intake says 23")).toBeInTheDocument();
    expect(client.getIntakeSays).toHaveBeenCalledWith("f1", "a1");
  });

  // Catches: "Use it" that changes another field with it, saves from a version the person never saw, or leaves the suggestion standing once used.
  it("Use it saves the account with that one field changed, from the version on the page, and the suggestion goes", async () => {
    const user = userEvent.setup();
    client.getIntakeSays.mockResolvedValueOnce({ employees: 23 }).mockResolvedValue({});
    client.updateAccount.mockResolvedValue({ conflict: false, account: { ...account, employees: 23, version: 4 } });
    renderPanel();
    await user.click(await within(row("Employees")).findByRole("button", { name: /^Use it/ }));
    await waitFor(() => expect(client.updateAccount).toHaveBeenCalledTimes(1));
    expect(client.updateAccount).toHaveBeenCalledWith("f1", "a1", {
      name: "Harborview Dental Group", tradeName: "", website: "harborviewdental.example", phone: "", street: "410 SW Alder St", city: "Portland", state: "OR",
      postalCode: "97204", industry: "Dental practice", employees: 23, statesOfOperation: ["OR", "WA"], currentProvider: "Payroll vendor",
    }, 3);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ employees: 23 }));
    await waitFor(() => expect(screen.queryByText("The intake says 23")).toBeNull());
  });

  // Catches: a field the intake disagrees on that the page never mentions (name, website, industry, provider), or a Use it that writes the intake's value to another field.
  it("says each text field where it differs, and Use it for one changes only that one", async () => {
    const user = userEvent.setup();
    client.getIntakeSays.mockResolvedValueOnce({ name: "Harborview Dental Partners LLC", website: "harborview.example", industry: "Orthodontics", currentProvider: "Paychex PEO" }).mockResolvedValue({});
    client.updateAccount.mockResolvedValue({ conflict: false, account });
    renderPanel();
    expect(await within(row("Account name")).findByText("The intake says Harborview Dental Partners LLC")).toBeInTheDocument();
    expect(within(row("Website")).getByText("The intake says harborview.example")).toBeInTheDocument();
    expect(within(row("Industry")).getByText("The intake says Orthodontics")).toBeInTheDocument();
    expect(within(row("Current provider")).getByText("The intake says Paychex PEO")).toBeInTheDocument();
    await user.click(within(row("Current provider")).getByRole("button", { name: /^Use it/ }));
    await waitFor(() => expect(client.updateAccount).toHaveBeenCalledTimes(1));
    expect(client.updateAccount.mock.calls[0][2]).toMatchObject({ name: "Harborview Dental Group", website: "harborviewdental.example", industry: "Dental practice", currentProvider: "Paychex PEO" });
  });

  // Catches: the address and the states of operation left out of what the intake says; a list of states used as one word instead of the list.
  it("says the street, the state and the states of operation, and Use it for the states sends the list", async () => {
    const user = userEvent.setup();
    client.getIntakeSays.mockResolvedValueOnce({ street: "500 Harbor Street, Austin", state: "TX", statesOfOperation: ["TX", "CA"] }).mockResolvedValue({});
    client.updateAccount.mockResolvedValue({ conflict: false, account });
    renderPanel();
    expect(await within(row("Address")).findByText("The intake says 500 Harbor Street, Austin")).toBeInTheDocument();
    expect(within(row("Address")).getByText("The intake says TX")).toBeInTheDocument();
    expect(within(row("States")).getByText("The intake says TX, CA")).toBeInTheDocument();
    await user.click(within(row("States")).getByRole("button", { name: /^Use it/ }));
    await waitFor(() => expect(client.updateAccount).toHaveBeenCalledTimes(1));
    expect(client.updateAccount.mock.calls[0][2]).toMatchObject({ street: "410 SW Alder St", state: "OR", statesOfOperation: ["TX", "CA"] });
  });

  // Catches: "Use it" claiming success when someone else saved the account first (a save from an old version saves nothing), or hiding why.
  it("says so, and saves nothing, when the account changed since the page was loaded", async () => {
    const user = userEvent.setup();
    client.getIntakeSays.mockResolvedValue({ employees: 23 });
    client.updateAccount.mockResolvedValue({ conflict: true, currentVersion: 4, current: {}, changed: [] });
    renderPanel();
    await user.click(await within(row("Employees")).findByRole("button", { name: /^Use it/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("The account changed since this page was loaded. Reload the page and try again."));
    expect(toast.success).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByText("The intake says 23")).toBeInTheDocument();
  });

  // Catches: "Use it" offered to someone the database will refuse (D-209); they still learn what the intake says.
  it("says it but offers no Use it to someone who may not change the account", async () => {
    client.getIntakeSays.mockResolvedValue({ employees: 23 });
    renderPanel(false);
    expect(await within(row("Employees")).findByText("The intake says 23")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Use it/ })).toBeNull();
  });
});
