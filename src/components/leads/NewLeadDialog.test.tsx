import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const listAccountOwners = vi.fn();
vi.mock("@/lib/accountCreateApi", () => ({ listAccountOwners: (...a: unknown[]) => listAccountOwners(...a) }));
const createLead = vi.fn();
vi.mock("@/lib/leadCreateApi", () => ({ createLead: (...a: unknown[]) => createLead(...a) }));

const checkLeadDuplicates = vi.fn();
vi.mock("@/lib/leadDuplicateApi", () => ({ checkLeadDuplicates: (...a: unknown[]) => checkLeadDuplicates(...a) }));

const { NewLeadDialog } = await import("./NewLeadDialog");
const { AccountError } = await import("@/lib/accountPageApi");

const made = { id: "l9", version: 1, name: "Lucia Reyes", status: "new", source: "added_by_hand", ownerId: "u2" };

function show() {
  const onCreated = vi.fn();
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <NewLeadDialog firmId="f1" person="Dana Reyes" onClose={() => {}} onCreated={onCreated} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { onCreated };
}

beforeEach(() => {
  checkLeadDuplicates.mockReset().mockResolvedValue({ matches: [], more: 0 });
  createLead.mockReset();
  listAccountOwners.mockReset().mockResolvedValue([{ value: "u1", label: "Dana Reyes" }, { value: "u2", label: "Marcus Hale" }]);
});

describe("NewLeadDialog (CRM-L1.2a, screen 21)", () => {
  // Catches: a lead saved with no name, or a blank name sent to the database instead of said beside the field.
  it("says a name is required and saves nothing without one", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: "Save lead" }));
    expect(await screen.findByText("Required")).toBeInTheDocument();
    expect(createLead).not.toHaveBeenCalled();
  });

  // Catches: a field typed but not sent, the owner not defaulting to the person making it, or the made lead not handed back to open.
  it("saves what was typed, owned by the person making it unless they choose another, and hands the lead back", async () => {
    createLead.mockResolvedValue(made);
    const { onCreated } = show();
    await userEvent.type(screen.getByLabelText(/^Name/), "Lucia Reyes");
    await userEvent.type(screen.getByLabelText("Business"), "Reyes Bakery");
    await userEvent.type(screen.getByLabelText("Email"), "lucia@reyes.example");
    await userEvent.type(screen.getByLabelText("Employees"), "23");
    await userEvent.selectOptions(screen.getByLabelText("State"), "OR");
    await userEvent.click(screen.getByRole("button", { name: "Save lead" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(made, false));
    expect(createLead).toHaveBeenCalledWith("f1", expect.objectContaining({
      name: "Lucia Reyes", business: "Reyes Bakery", email: "lucia@reyes.example", employees: 23, state: "OR", ownerId: "u1",
    }));
  });

  // Catches: "Save and add another" closing the form, keeping what was typed, or forgetting the owner chosen.
  it("Save and add another saves, clears the form and keeps the owner chosen", async () => {
    createLead.mockResolvedValue(made);
    const { onCreated } = show();
    await screen.findByRole("option", { name: "Marcus Hale" });
    await userEvent.selectOptions(screen.getByLabelText("Owner"), "u2");
    await userEvent.type(screen.getByLabelText(/^Name/), "Lucia Reyes");
    await userEvent.click(screen.getByRole("button", { name: "Save and add another" }));
    await waitFor(() => expect(createLead).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByLabelText(/^Name/)).toHaveValue(""));
    expect(screen.getByLabelText("Owner")).toHaveValue("u2");
    expect(onCreated).toHaveBeenCalledWith(made, true);
    expect(screen.getByRole("dialog", { name: "New lead" })).toBeInTheDocument();
  });

  // Catches: the database's words for a refused field replaced by a general failure.
  it("shows the database's words when it refuses a field", async () => {
    createLead.mockRejectedValue(new AccountError("invalid", "Enter an email address like name@example.com.", "22023"));
    show();
    await userEvent.type(screen.getByLabelText(/^Name/), "Lucia Reyes");
    await userEvent.click(screen.getByRole("button", { name: "Save lead" }));
    expect(await screen.findByText("Enter an email address like name@example.com.")).toBeInTheDocument();
  });

  // BR-5.4. Catches: a lead made twice because nothing said the first was there; a colleague's lead named to someone who may not see it; a warning that stops the save.
  it("says which lead or account this may already be, names only what the person may see, and still saves", async () => {
    checkLeadDuplicates.mockResolvedValue({ more: 0, matches: [
      { visible: true, kind: "lead", id: "l1", name: "Dana Cole", business: "Cole Plumbing", reasons: ["email"], owner: "Gus Hale" },
      { visible: true, kind: "account", id: "a1", name: "Reyes Bakery", business: null, reasons: ["name"], owner: null },
      { visible: false, kind: "lead", ask: { kind: "owner", names: ["Hal Ito"] } },
    ] });
    createLead.mockResolvedValue(made);
    const { onCreated } = show();
    await userEvent.type(screen.getByLabelText(/^Name/), "D. Cole");
    await userEvent.type(screen.getByLabelText("Email"), "dana@cole.example");
    const warning = await screen.findByRole("status", { name: "Possible duplicate" }, { timeout: 3000 });
    expect(checkLeadDuplicates).toHaveBeenLastCalledWith("f1", { name: "D. Cole", business: "", email: "dana@cole.example", state: "" });
    expect(warning).toHaveTextContent("Dana Cole (a lead · Cole Plumbing · same email · Owner: Gus Hale)");
    expect(warning).toHaveTextContent("Reyes Bakery (an account · same business name and state · No owner)");
    expect(warning).toHaveTextContent("A lead like this exists that you can't see. Ask Hal Ito.");
    expect(screen.getByRole("link", { name: "Dana Cole" })).toHaveAttribute("href", "/leads/l1");
    expect(screen.getByRole("link", { name: "Reyes Bakery" })).toHaveAttribute("href", "/accounts/a1");
    await userEvent.click(screen.getByRole("button", { name: "Save lead" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });

  it("asks nothing until there is an address, or a name with a business, and shows nothing when the check fails", async () => {
    checkLeadDuplicates.mockRejectedValue(new Error("Couldn't check for a duplicate."));
    show();
    await userEvent.type(screen.getByLabelText(/^Name/), "Dana Cole");
    await new Promise((r) => setTimeout(r, 600));
    expect(checkLeadDuplicates).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Business"), "Cole Plumbing");
    await waitFor(() => expect(checkLeadDuplicates).toHaveBeenCalled(), { timeout: 3000 });
    expect(screen.queryByRole("status", { name: "Possible duplicate" })).toBeNull();
  });
});
