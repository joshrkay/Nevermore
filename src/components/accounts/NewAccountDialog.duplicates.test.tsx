import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const createAccount = vi.fn();
vi.mock("@/lib/accountCreateApi", () => ({ createAccount: (...a: unknown[]) => createAccount(...a), listAccountOwners: () => Promise.resolve([{ value: "u1", label: "Dana Reyes" }]) }));
const checkAccountDuplicates = vi.fn();
vi.mock("@/lib/duplicateApi", () => ({ checkAccountDuplicates: (...a: unknown[]) => checkAccountDuplicates(...a), checkContactDuplicates: vi.fn() }));

const { NewAccountDialog } = await import("./NewAccountDialog");

const seen = { visible: true, kind: "account", id: "a1", name: "Harbor Dental LLC", archived: false, reasons: ["website"], owner: { id: "u2", name: "Marcus Hale" } };
const mask = { visible: false, kind: "account", ask: { kind: "owner", names: ["Ines Park"] } };

const onCreated = vi.fn();
const open = async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <NewAccountDialog firmId="f1" person="Dana Reyes" onClose={() => {}} onCreated={onCreated} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  const dialog = await screen.findByRole("dialog", { name: "New account" });
  return { user, dialog };
};
const warning = () => screen.queryByRole("status", { name: "Possible duplicate" });

beforeEach(() => {
  checkAccountDuplicates.mockReset();
  createAccount.mockReset().mockResolvedValue({ id: "a9", name: "Harbor Dental East" });
  onCreated.mockReset();
});

describe("New account: the duplicate warning (CRM-S4.2)", () => {
  // Catches: the warning not naming the record, its owner or why, or the link not opening the existing account (in a new tab, so what was typed is kept).
  it("names an account that matches the website, with its owner and a link that opens it in a new tab", async () => {
    checkAccountDuplicates.mockResolvedValue({ matches: [seen], more: 0 });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Website"), "harbordental.example");
    const note = await screen.findByRole("status", { name: "Possible duplicate" });
    const link = within(note).getByRole("link", { name: "Harbor Dental LLC" });
    expect(link).toHaveAttribute("href", "/accounts/a1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(note).toHaveTextContent("same website");
    expect(note).toHaveTextContent("Owner: Marcus Hale");
    expect(checkAccountDuplicates).toHaveBeenLastCalledWith("f1", { name: "", website: "harbordental.example", state: "" });
  });

  // Catches: the warning asking before anything that can match was typed (a name alone never matches, D-193), or on every keystroke.
  it("asks only once there is a website, or a name and a state, and once the person stops typing", async () => {
    checkAccountDuplicates.mockResolvedValue({ matches: [], more: 0 });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Account name"), "Harbor Dental");
    await new Promise((r) => setTimeout(r, 700));
    expect(checkAccountDuplicates).not.toHaveBeenCalled();
    await user.selectOptions(within(dialog).getByLabelText("State"), "OR");
    await waitFor(() => expect(checkAccountDuplicates).toHaveBeenCalledTimes(1));
    expect(checkAccountDuplicates).toHaveBeenCalledWith("f1", { name: "Harbor Dental", website: "", state: "OR" });
  });

  // Catches: a masked match naming the record, or not saying who to ask.
  it("says only that one exists and who to ask for an account the person may not see", async () => {
    checkAccountDuplicates.mockResolvedValue({ matches: [mask], more: 0 });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Website"), "secret.example");
    const note = await screen.findByRole("status", { name: "Possible duplicate" });
    expect(note).toHaveTextContent("An account like this exists that you can't see. Ask Ines Park.");
    expect(within(note).queryByRole("link")).not.toBeInTheDocument();
    expect(note).toHaveTextContent("You can still save.");
  });

  // Catches: the firm's owners named as one person, or nobody, when the account has no owner.
  it("names the firm's owners when the account has none to ask", async () => {
    checkAccountDuplicates.mockResolvedValue({ matches: [{ ...mask, ask: { kind: "firm_owners", names: ["Ana Cruz", "Bo Lee"] } }], more: 0 });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Website"), "secret.example");
    expect(await screen.findByText(/Ask one of the firm's owners: Ana Cruz, Bo Lee\./)).toBeInTheDocument();
  });

  // Catches: the warning blocking the save (CRM-S4.2: "The person can still save"), or asking for a confirmation first.
  it("still saves, in one press, with the warning showing", async () => {
    checkAccountDuplicates.mockResolvedValue({ matches: [seen], more: 0 });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Account name"), "Harbor Dental East");
    await user.type(within(dialog).getByLabelText("Website"), "harbordental.example");
    await screen.findByRole("status", { name: "Possible duplicate" });
    await user.click(within(dialog).getByRole("button", { name: "Save account" }));
    await waitFor(() => expect(createAccount).toHaveBeenCalledTimes(1));
    expect(createAccount.mock.calls[0][1]).toMatchObject({ name: "Harbor Dental East", website: "harbordental.example" });
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });

  // Catches: merging offered from the warning (CRM-S4.3 is a later story: no dead button, D-24).
  it("offers opening the record and continuing, and no merge", async () => {
    checkAccountDuplicates.mockResolvedValue({ matches: [seen, mask], more: 0 });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Website"), "harbordental.example");
    const note = await screen.findByRole("status", { name: "Possible duplicate" });
    expect(within(note).queryByText(/merge/i)).not.toBeInTheDocument();
    expect(within(note).queryByRole("button")).not.toBeInTheDocument();
  });

  // Catches: a warning left on the screen after the typed values stop matching anything, or a failed check shown as a warning or a failure of the form.
  it("goes away when there is nothing to match, and a failed check shows nothing and never stops the save", async () => {
    checkAccountDuplicates.mockResolvedValueOnce({ matches: [seen], more: 0 });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Account name"), "Other Co");
    const site = within(dialog).getByLabelText("Website");
    await user.type(site, "harbordental.example");
    await screen.findByRole("status", { name: "Possible duplicate" });
    await user.clear(site);
    await waitFor(() => expect(warning()).not.toBeInTheDocument());

    checkAccountDuplicates.mockRejectedValue(new Error("Couldn't check for a duplicate."));
    await user.type(site, "other.example");
    await waitFor(() => expect(checkAccountDuplicates).toHaveBeenCalledTimes(2));
    expect(warning()).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Save account" }));
    await waitFor(() => expect(createAccount).toHaveBeenCalledTimes(1));
  });

  // Catches: how many more the person may see being lost.
  it("says how many more the person may see", async () => {
    checkAccountDuplicates.mockResolvedValue({ matches: [seen], more: 3 });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Website"), "harbordental.example");
    expect(await screen.findByText("And 3 more you can see.")).toBeInTheDocument();
  });
});
