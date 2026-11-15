import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toast.success(...a), error: (...a: unknown[]) => toast.error(...a) } }));
const listMoveChoices = vi.fn();
const moveContact = vi.fn();
vi.mock("@/lib/contactApi", async () => {
  const real = await vi.importActual<typeof import("@/lib/contactApi")>("@/lib/contactApi");
  return { ...real, listMoveChoices: (...a: unknown[]) => listMoveChoices(...a), moveContact: (...a: unknown[]) => moveContact(...a) };
});

const { MoveContactDialog } = await import("./MoveContactDialog");
const { ContactError } = await import("@/lib/contactApi");

const onClose = vi.fn();
const onMoved = vi.fn();
const moved = (over: Record<string, unknown> = {}) => ({
  from: { id: "a1", name: "Harborview Dental" }, to: { id: "a2", name: "Harborview East" }, wasMain: false, activitiesMoved: 0, opportunityLinksDropped: 0, mainContactCleared: 0, ...over,
});

const open = async () => {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MoveContactDialog firmId="f1" contact={{ id: "c1", name: "Owen Park" }} onClose={onClose} onMoved={onMoved} />
    </QueryClientProvider>,
  );
  const dialog = await screen.findByRole("dialog", { name: "Move Owen Park" });
  await within(dialog).findByRole("radio", { name: "Harborview East" });
  return { user, dialog };
};

beforeEach(() => {
  for (const m of [listMoveChoices, moveContact, onClose, onMoved, toast.success, toast.error]) m.mockReset();
  listMoveChoices.mockResolvedValue([{ id: "a2", name: "Harborview East" }, { id: "a3", name: "Lakeside Clinic" }]);
  moveContact.mockResolvedValue(moved());
});

describe("Move a contact to another account (D-209)", () => {
  // Catches: offering every account (the ones the database would refuse) instead of the database's own list, or no way to narrow a long list.
  it("offers the accounts the database lists, and narrows them by what is typed", async () => {
    const { user, dialog } = await open();
    expect(listMoveChoices).toHaveBeenCalledWith("f1", "c1", "");
    expect(within(dialog).getByRole("radio", { name: "Lakeside Clinic" })).toBeInTheDocument();
    listMoveChoices.mockResolvedValue([{ id: "a3", name: "Lakeside Clinic" }]);
    await user.type(within(dialog).getByLabelText("Find an account"), "lake");
    await waitFor(() => expect(listMoveChoices).toHaveBeenLastCalledWith("f1", "c1", "lake"));
    await waitFor(() => expect(within(dialog).queryByRole("radio", { name: "Harborview East" })).not.toBeInTheDocument());
  });

  // Catches: a contact "moved" to nothing, or the empty list not saying why nothing is offered.
  it("asks for an account before moving, and says when no account can take the contact", async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("button", { name: "Move contact" }));
    expect(await within(dialog).findByText("Choose an account.")).toBeInTheDocument();
    expect(moveContact).not.toHaveBeenCalled();
    listMoveChoices.mockResolvedValue([]);
    await user.type(within(dialog).getByLabelText("Find an account"), "zzz");
    expect(await within(dialog).findByText("No account you can change matches.")).toBeInTheDocument();
  });

  // Catches: the wrong contact or account sent, a move not confirmed to the person, or the page not told.
  it("moves the contact to the chosen account and says so, with what went with it", async () => {
    moveContact.mockResolvedValue(moved({ wasMain: true, activitiesMoved: 3 }));
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("radio", { name: "Harborview East" }));
    await user.click(within(dialog).getByRole("button", { name: "Move contact" }));
    await waitFor(() => expect(onMoved).toHaveBeenCalledTimes(1));
    expect(moveContact).toHaveBeenCalledWith("f1", "c1", "a2", false);
    expect(toast.success).toHaveBeenCalledWith("Owen Park moved to Harborview East, with 3 calls, notes and tasks. Harborview Dental has no main contact now.");
    expect(onClose).toHaveBeenCalled();
  });

  it("says a move that took no activity along plainly", async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("radio", { name: "Lakeside Clinic" }));
    await user.click(within(dialog).getByRole("button", { name: "Move contact" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Owen Park moved to Harborview East."));
  });

  // Catches: an opportunity's links being dropped in silence (the database asks first), or the question being answered for the person.
  it("shows the database's question when the move would take a call off an opportunity, and moves only when the person agrees", async () => {
    moveContact.mockRejectedValueOnce(new ContactError("confirm", "Moving Owen Park takes 2 calls, notes and tasks off an opportunity on Harborview Dental. Move anyway?", "PT409"));
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("radio", { name: "Harborview East" }));
    await user.click(within(dialog).getByRole("button", { name: "Move contact" }));
    expect(await within(dialog).findByText("Moving Owen Park takes 2 calls, notes and tasks off an opportunity on Harborview Dental. Move anyway?")).toBeInTheDocument();
    expect(onMoved).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Move anyway" }));
    await waitFor(() => expect(onMoved).toHaveBeenCalledTimes(1));
    expect(moveContact).toHaveBeenLastCalledWith("f1", "c1", "a2", true);
  });

  it("goes back to the choice when the person does not agree", async () => {
    moveContact.mockRejectedValueOnce(new ContactError("confirm", "Moving Owen Park takes 1 call, note or task off an opportunity on Harborview Dental. Move anyway?", "PT409"));
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("radio", { name: "Harborview East" }));
    await user.click(within(dialog).getByRole("button", { name: "Move contact" }));
    await user.click(await within(dialog).findByRole("button", { name: "Don't move" }));
    expect(within(dialog).getByRole("button", { name: "Move contact" })).toBeInTheDocument();
    expect(within(dialog).queryByText(/Move anyway\?/)).not.toBeInTheDocument();
    expect(moveContact).toHaveBeenCalledTimes(1);
    expect(onMoved).not.toHaveBeenCalled();
  });

  // Catches: a refusal of the level rule shown as a vague failure, or the form closing over it.
  it("shows the database's refusal in words and stays open", async () => {
    moveContact.mockRejectedValueOnce(new ContactError("notAllowed", "You can't change Harborview East, so you can't move a contact onto it.", "42501"));
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("radio", { name: "Harborview East" }));
    await user.click(within(dialog).getByRole("button", { name: "Move contact" }));
    expect(await within(dialog).findByText("You can't change Harborview East, so you can't move a contact onto it.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    moveContact.mockRejectedValueOnce(new ContactError("failed", "Couldn't move the contact. Check your connection and try again."));
    await user.click(within(dialog).getByRole("button", { name: "Move contact" }));
    expect(await within(dialog).findByText("Couldn't move the contact. Check your connection and try again.")).toBeInTheDocument();
  });

  // Catches: a second click moving the contact twice while the first is in flight, and the dialog closing under a move in flight.
  it("ignores a second click while the move is in flight", async () => {
    let finish: (v: unknown) => void = () => {};
    moveContact.mockReset().mockReturnValue(new Promise((r) => { finish = r; }));
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("radio", { name: "Harborview East" }));
    await user.click(within(dialog).getByRole("button", { name: "Move contact" }));
    await user.click(within(dialog).getByRole("button", { name: "Moving…" }));
    expect(moveContact).toHaveBeenCalledTimes(1);
    finish(moved());
    await waitFor(() => expect(onMoved).toHaveBeenCalledTimes(1));
  });

  it("closes with Cancel", async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Move a contact: when the move fails after the person agreed", () => {
  // Catches: a failure after "Move anyway" (a refusal, a lost race, no connection) put where the question view does not draw it, so the person sees nothing.
  it("says why in the question view and keeps the question to answer again", async () => {
    moveContact.mockRejectedValueOnce(new ContactError("confirm", "Moving Owen Park takes 1 call, note or task off an opportunity on Harborview Dental. Move anyway?", "PT409"));
    moveContact.mockRejectedValueOnce(new ContactError("invalid", "That contact was moved while you were working. Try again.", "40001"));
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("radio", { name: "Harborview East" }));
    await user.click(within(dialog).getByRole("button", { name: "Move contact" }));
    await user.click(await within(dialog).findByRole("button", { name: "Move anyway" }));
    expect(await within(dialog).findByText("That contact was moved while you were working. Try again.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Move anyway" })).toBeInTheDocument();
    moveContact.mockRejectedValueOnce(new ContactError("failed", "Couldn't move the contact. Check your connection and try again."));
    await user.click(within(dialog).getByRole("button", { name: "Move anyway" }));
    expect(await within(dialog).findByText("Couldn't move the contact. Check your connection and try again.")).toBeInTheDocument();
    expect(onMoved).not.toHaveBeenCalled();
  });
});

describe("Move a contact: the search and the choice", () => {
  // Catches: an account chosen and then hidden by a search still being the one moved to (the person cannot see where the contact would go).
  it("forgets the choice when the search changes, and sends only an account in the list shown", async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("radio", { name: "Harborview East" }));
    listMoveChoices.mockResolvedValue([{ id: "a3", name: "Lakeside Clinic" }]);
    await user.type(within(dialog).getByLabelText("Find an account"), "lake");
    await waitFor(() => expect(within(dialog).queryByRole("radio", { name: "Harborview East" })).not.toBeInTheDocument());
    await user.click(within(dialog).getByRole("button", { name: "Move contact" }));
    expect(await within(dialog).findByText("Choose an account.")).toBeInTheDocument();
    expect(moveContact).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("radio", { name: "Lakeside Clinic" })).not.toBeChecked();
  });

  // Catches: a choice kept through a new search even when the account is still in the list (the person typed to look for another).
  it("starts the choice again on a new search, even when the account is still listed", async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("radio", { name: "Harborview East" }));
    listMoveChoices.mockResolvedValue([{ id: "a2", name: "Harborview East" }]);
    await user.type(within(dialog).getByLabelText("Find an account"), "east");
    await waitFor(() => expect(listMoveChoices).toHaveBeenLastCalledWith("f1", "c1", "east"));
    await within(dialog).findByRole("radio", { name: "Harborview East" });
    expect(within(dialog).getByRole("radio", { name: "Harborview East" })).not.toBeChecked();
  });

  // Catches: an account chosen from the old list in the moment before the new search's answer arrives, and still sent when that answer no longer lists it.
  it("sends nothing for an account chosen from a list that the search has since replaced", async () => {
    const { user, dialog } = await open();
    listMoveChoices.mockResolvedValue([{ id: "a3", name: "Lakeside Clinic" }]);
    await user.type(within(dialog).getByLabelText("Find an account"), "lake");
    await user.click(within(dialog).getByRole("radio", { name: "Harborview East" }));
    await waitFor(() => expect(within(dialog).queryByRole("radio", { name: "Harborview East" })).not.toBeInTheDocument());
    await user.click(within(dialog).getByRole("button", { name: "Move contact" }));
    expect(await within(dialog).findByText("Choose an account.")).toBeInTheDocument();
    expect(moveContact).not.toHaveBeenCalled();
  });

  // Catches: the question about an earlier choice staying on screen, to be answered "Move anyway" for an account that is no longer the one chosen.
  it("takes the question away when the search changes", async () => {
    moveContact.mockRejectedValueOnce(new ContactError("confirm", "Moving Owen Park takes 1 call, note or task off an opportunity on Harborview Dental. Move anyway?", "PT409"));
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("radio", { name: "Harborview East" }));
    await user.click(within(dialog).getByRole("button", { name: "Move contact" }));
    await user.click(await within(dialog).findByRole("button", { name: "Don't move" }));
    await user.type(within(dialog).getByLabelText("Find an account"), "x");
    expect(within(dialog).queryByText(/Move anyway\?/)).not.toBeInTheDocument();
  });

  // Catches: a person who may not move the contact seeing "No account you can change matches" or "couldn't load" instead of why.
  it("says in the database's words why no account is offered to a person who may not move the contact", async () => {
    listMoveChoices.mockReset().mockRejectedValue(new ContactError("notAllowed", "You can't change the account this contact is on, so you can't move it off.", "42501"));
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MoveContactDialog firmId="f1" contact={{ id: "c1", name: "Owen Park" }} onClose={onClose} onMoved={onMoved} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("You can't change the account this contact is on, so you can't move it off.")).toBeInTheDocument();
  });
});
