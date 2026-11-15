import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Archive, restore, delete and change owner for one account (story CRM-A1.1c), through a faked client. The database's own rules (the level rule, a closing firm,
// support, an account that holds an intake) are tested in supabase/tests/account_archive_delete_owner.sql; here the client answers and the dialogs say it.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ toast: (...a: unknown[]) => toast(...a), useToast: () => ({ toasts: [] }) }));
const client = { archiveAccount: vi.fn(), restoreAccount: vi.fn(), deleteAccount: vi.fn(), changeAccountOwner: vi.fn() };
vi.mock("@/lib/accountActionsApi", () => client);
const listFirmMembers = vi.fn();
vi.mock("@/lib/accountsApi", () => ({ listFirmMembers: (...a: unknown[]) => listFirmMembers(...a) }));

const { AccountActions } = await import("./AccountActions");
const { AccountError } = await import("@/lib/accountPageApi");

const base = { id: "a1", name: "Harborview Dental Group", archived: false, ownerId: "u1", openOpportunities: 2 };
const done = vi.fn();
const show = (account = base) =>
  render(<QueryClientProvider client={new QueryClient()}><AccountActions firmId="f1" account={account} onDone={done} /></QueryClientProvider>);
const openMenu = async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Actions for Harborview Dental Group" }));

beforeEach(() => {
  for (const fn of [...Object.values(client), listFirmMembers, toast, done]) fn.mockReset();
  listFirmMembers.mockResolvedValue([{ value: "u1", label: "Dana Reyes" }, { value: "u2", label: "Marcus Hale" }]);
});
afterEach(() => cleanup());

describe("AccountActions: archive and restore", () => {
  // Catches: an account archived without asking, or an Archive that says nothing, or a page not told to reload.
  it("asks before archiving, then archives and says so", async () => {
    const user = userEvent.setup();
    client.archiveAccount.mockResolvedValue({ changed: true });
    show();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Archive" }));
    expect(client.archiveAccount).not.toHaveBeenCalled();
    expect(screen.getByText(/It leaves every view but Archived/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(client.archiveAccount).toHaveBeenCalledWith("f1", "a1"));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Harborview Dental Group is archived." }));
    expect(done).toHaveBeenCalledWith("archived");
  });

  // Catches: the database's refusal swallowed, so a person sees the dialog close as if it worked.
  it("keeps the dialog open and says the database's words when archiving is refused", async () => {
    const user = userEvent.setup();
    client.archiveAccount.mockRejectedValue(new AccountError("notAllowed", "Only the account's owner, a lead of the owner's team or an owner of the firm can change it.", "42501"));
    show();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Archive" }));
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only the account's owner, a lead of the owner's team or an owner of the firm can change it.");
    expect(done).not.toHaveBeenCalled();
  });

  // Catches: Archive offered on an archived account, or a Restore that asks first (it takes nothing away).
  it("offers Restore, not Archive, on an archived account, and restores at once", async () => {
    const user = userEvent.setup();
    client.restoreAccount.mockResolvedValue({ changed: true });
    show({ ...base, archived: true });
    await openMenu(user);
    expect(screen.queryByRole("menuitem", { name: "Archive" })).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: "Restore" }));
    await waitFor(() => expect(client.restoreAccount).toHaveBeenCalledWith("f1", "a1"));
    expect(done).toHaveBeenCalledWith("restored");
  });
});

describe("AccountActions: delete", () => {
  // Catches: a delete without a warning that the contacts go too, or one that does not report to the screen.
  it("warns what goes with the account, then deletes it", async () => {
    const user = userEvent.setup();
    client.deleteAccount.mockResolvedValue({ name: "Harborview Dental Group" });
    show();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(screen.getByText(/deletes the account with its contacts and cannot be undone/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(client.deleteAccount).toHaveBeenCalledWith("f1", "a1"));
    expect(done).toHaveBeenCalledWith("deleted");
  });

  // Catches: an account that holds an intake offered a Delete that can only fail again, with no way to the archive the database says to use.
  it("when the account holds an intake, says so and offers to archive it instead", async () => {
    const user = userEvent.setup();
    client.deleteAccount.mockRejectedValue(new AccountError("holdsIntake", "This account holds an intake, so it can't be deleted. Archive it instead.", "PT409"));
    client.archiveAccount.mockResolvedValue({ changed: true });
    show();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This account holds an intake, so it can't be deleted. Archive it instead.");
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Archive instead" }));
    await user.click(await screen.findByRole("button", { name: "Archive" }));
    await waitFor(() => expect(client.archiveAccount).toHaveBeenCalledWith("f1", "a1"));
    expect(done).toHaveBeenCalledWith("archived");
  });
});

describe("AccountActions: change owner", () => {
  // Catches: the offer for the open opportunities missing, or its answer not sent.
  it("offers the open opportunities too, and sends the choice", async () => {
    const user = userEvent.setup();
    client.changeAccountOwner.mockResolvedValue({ ownerName: "Marcus Hale", opportunitiesChanged: 2, opportunitiesSkipped: 0 });
    show();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Change owner" }));
    await user.selectOptions(await screen.findByLabelText("New owner"), "u2");
    expect(screen.getByLabelText(/Also change the owner of its open opportunities \(2\)/)).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Change owner" }));
    await waitFor(() => expect(client.changeAccountOwner).toHaveBeenCalledWith("f1", "a1", "u2", true));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Harborview Dental Group now belongs to Marcus Hale.", description: "2 open opportunities changed too." }));
    expect(done).toHaveBeenCalledWith("owner");
  });

  // Catches: the box ticked by the dialog and not by the person: unticking must send false.
  it("sends false when the person unticks the offer", async () => {
    const user = userEvent.setup();
    client.changeAccountOwner.mockResolvedValue({ ownerName: "Marcus Hale", opportunitiesChanged: 0, opportunitiesSkipped: 0 });
    show();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Change owner" }));
    await user.selectOptions(await screen.findByLabelText("New owner"), "u2");
    await user.click(screen.getByLabelText(/Also change the owner/));
    await user.click(screen.getByRole("button", { name: "Change owner" }));
    await waitFor(() => expect(client.changeAccountOwner).toHaveBeenCalledWith("f1", "a1", "u2", false));
  });

  // Catches: an offer about opportunities when the account is known to have none open.
  it("does not offer it when no opportunity is open", async () => {
    const user = userEvent.setup();
    show({ ...base, openOpportunities: 0 });
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Change owner" }));
    await screen.findByLabelText("New owner");
    expect(screen.queryByLabelText(/Also change the owner/)).toBeNull();
  });

  // Catches: opportunities the person could not change being passed over without a word.
  it("says how many open opportunities were left with their owners", async () => {
    const user = userEvent.setup();
    client.changeAccountOwner.mockResolvedValue({ ownerName: "Marcus Hale", opportunitiesChanged: 1, opportunitiesSkipped: 2 });
    show();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Change owner" }));
    await user.selectOptions(await screen.findByLabelText("New owner"), "u2");
    await user.click(screen.getByRole("button", { name: "Change owner" }));
    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast.mock.calls[0][0].description).toBe("1 open opportunity changed too. 2 open opportunities were left with their owner because you can't change them.");
  });

  // Catches: Change owner sent with nobody chosen.
  it("asks for a person before it sends anything", async () => {
    const user = userEvent.setup();
    show({ ...base, ownerId: null });
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Change owner" }));
    await screen.findByRole("option", { name: "Dana Reyes" });
    await user.click(screen.getByRole("button", { name: "Change owner" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose who will own this account.");
    expect(client.changeAccountOwner).not.toHaveBeenCalled();
  });
});
