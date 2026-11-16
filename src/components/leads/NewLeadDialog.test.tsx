import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const listAccountOwners = vi.fn();
vi.mock("@/lib/accountCreateApi", () => ({ listAccountOwners: (...a: unknown[]) => listAccountOwners(...a) }));
const createLead = vi.fn();
vi.mock("@/lib/leadCreateApi", () => ({ createLead: (...a: unknown[]) => createLead(...a) }));

const { NewLeadDialog } = await import("./NewLeadDialog");
const { AccountError } = await import("@/lib/accountPageApi");

const made = { id: "l9", version: 1, name: "Lucia Reyes", status: "new", source: "added_by_hand", ownerId: "u2" };

function show() {
  const onCreated = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NewLeadDialog firmId="f1" person="Dana Reyes" onClose={() => {}} onCreated={onCreated} />
    </QueryClientProvider>,
  );
  return { onCreated };
}

beforeEach(() => {
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
});
