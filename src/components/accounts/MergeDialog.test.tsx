import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The merge dialog (story CRM-S4.3a), through a faked client: what it shows of two records, the choice for each field that differs, what it says before it changes
// anything, and what it does with the database's answers. Who may merge, what moves and the versions are the database's (supabase/tests/merge_records.sql).
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("sonner", () => ({ toast }));
const api = { previewMerge: vi.fn(), mergeAccounts: vi.fn(), mergeContacts: vi.fn() };
vi.mock("@/lib/mergeApi", async (original) => ({ ...(await original<typeof import("@/lib/mergeApi")>()), ...api }));

const { MergeDialog } = await import("./MergeDialog");
const { MergeError } = await import("@/lib/mergeApi");

const account = (id: string, version: number, over: Record<string, unknown> = {}) => ({
  id, version, name: "Harborview Marine", trade_name: null, website: null, phone: null, street: null, city: null, state: null, postal_code: null, industry: null,
  employees: null, states_of_operation: [], current_provider: null, owner: { id: "u1", name: "Dana Reyes" }, ...over,
});
const preview = (over: Record<string, unknown> = {}) => ({
  kind: "account", problem: null, differs: ["name", "phone", "owner"],
  kept: account("a1", 3, { phone: null }), removed: account("a2", 5, { name: "Harborview Marine LLC", phone: "(503) 555-0100", owner: { id: "u2", name: "Marcus Hale" } }),
  moves: { contacts: 2, opportunities: 1, intakes: 1, activities: 4, placements: 0, renewals: 0, labels: 1 }, ...over,
});
const merged = { record: { id: "a1", version: 4 }, removed: { id: "a2", name: "Harborview Marine LLC" }, moved: { contacts: 2, contactsMerged: 0, opportunities: 1, activities: 4, placements: 0, renewals: 0, labels: 1 } };

const onClose = vi.fn();
const onMerged = vi.fn();
const show = (kind: "account" | "contact" = "account") =>
  render(<QueryClientProvider client={new QueryClient()}><MergeDialog firmId="f1" kind={kind} keptId="a1" removedId="a2" onClose={onClose} onMerged={onMerged} /></QueryClientProvider>);

beforeEach(() => {
  for (const fn of [...Object.values(api), ...Object.values(toast), onClose, onMerged]) fn.mockReset();
  api.previewMerge.mockResolvedValue(preview());
});
afterEach(() => cleanup());

describe("MergeDialog: the choice", () => {
  // Catches: both records not shown side by side, a field that does not differ offered for choice, or a blank shown as nothing.
  it("shows each differing field with both values, and no field that is the same", async () => {
    show();
    const group = await screen.findByRole("group", { name: "Which value to keep" });
    expect(api.previewMerge).toHaveBeenCalledWith("f1", "account", "a1", "a2");
    expect(within(group).getByRole("group", { name: "Name" })).toBeInTheDocument();
    expect(within(within(group).getByRole("group", { name: "Phone" })).getByText("Blank")).toBeInTheDocument();
    expect(within(within(group).getByRole("group", { name: "Phone" })).getByText("(503) 555-0100")).toBeInTheDocument();
    expect(within(group).getByRole("group", { name: "Owner" })).toHaveTextContent("Dana Reyes");
    expect(within(group).getByRole("group", { name: "Owner" })).toHaveTextContent("Marcus Hale");
    expect(within(group).queryByRole("group", { name: "City" })).toBeNull();
  });

  // Catches: the dialog saying one thing and the merge doing another: a blank on the kept record starts on the other's value, as the database does.
  it("starts each choice on the kept value, or the other one's where the kept is blank", async () => {
    show();
    const group = await screen.findByRole("group", { name: "Which value to keep" });
    const radios = (name: string) => within(within(group).getByRole("group", { name })).getAllByRole("radio") as HTMLInputElement[];
    expect(radios("Name").map((r) => r.checked)).toEqual([true, false]);
    expect(radios("Phone").map((r) => r.checked)).toEqual([false, true]);
  });

  // Catches: what the person is told will happen missing before the change (no count of what moves, no word that there is no undo).
  it("says exactly what will happen, and that a merge can't be split again, before anything changes", async () => {
    show();
    await screen.findByText("What will happen");
    expect(screen.getByText("Harborview Marine LLC will be deleted and everything on it moved to Harborview Marine. A merged account can't be split again.")).toBeInTheDocument();
    expect(screen.getByText("2 contacts, 1 opportunity, 4 calls, notes and tasks, 1 label move to Harborview Marine.")).toBeInTheDocument();
    expect(screen.getByText("1 intake stays on its own opportunity.")).toBeInTheDocument();
    expect(api.mergeAccounts).not.toHaveBeenCalled();
  });

  // Catches: no way to keep the other record, or a swap that keeps asking about the first pair.
  it("keeps the other record instead, asking about the pair the other way round", async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole("group", { name: "Which value to keep" });
    api.previewMerge.mockResolvedValue(preview({ kept: account("a2", 5, { name: "Harborview Marine LLC" }), removed: account("a1", 3) }));
    await user.click(screen.getByRole("button", { name: "Keep Harborview Marine LLC instead" }));
    await waitFor(() => expect(api.previewMerge).toHaveBeenLastCalledWith("f1", "account", "a2", "a1"));
    expect(await screen.findByRole("button", { name: "Keep Harborview Marine instead" })).toBeInTheDocument();
  });
});

describe("MergeDialog: merging", () => {
  // Catches: the versions left off or taken from somewhere else (a merge over a change nobody saw), a choice not sent, or the page not told what was merged.
  it("merges with every choice on screen and the versions it showed, then says so", async () => {
    const user = userEvent.setup();
    api.mergeAccounts.mockResolvedValue(merged);
    show();
    const group = await screen.findByRole("group", { name: "Which value to keep" });
    await user.click(within(within(group).getByRole("group", { name: "Owner" })).getAllByRole("radio")[1]);
    await user.click(screen.getByRole("button", { name: "Merge" }));
    await waitFor(() => expect(api.mergeAccounts).toHaveBeenCalledWith(
      "f1", "a1", "a2", { name: "kept", phone: "removed", owner: "removed" }, { kept: 3, removed: 5 },
    ));
    await waitFor(() => expect(onMerged).toHaveBeenCalledWith({ kind: "account", kept: { id: "a1", name: "Harborview Marine" }, removed: { id: "a2", name: "Harborview Marine LLC" } }));
    expect(toast.success).toHaveBeenCalledWith("Harborview Marine LLC was merged into Harborview Marine. 2 contacts, 1 opportunity, 4 calls, notes and tasks moved over.");
  });

  // Catches: a refusal swallowed (the dialog closing as if it worked), or a failed merge closing the dialog and losing the choices.
  it("keeps the dialog open and says the database's words when it refuses", async () => {
    const user = userEvent.setup();
    api.mergeAccounts.mockRejectedValue(new MergeError("notAllowed", "You can't change Second Account, so you can't merge it.", "42501"));
    show();
    await screen.findByRole("group", { name: "Which value to keep" });
    await user.click(screen.getByRole("button", { name: "Merge" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You can't change Second Account, so you can't merge it.");
    expect(onMerged).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Merge" })).toBeEnabled();
  });

  // Catches: a record changed while choosing being merged over, or the person left looking at values that are gone.
  it("asks again for both records when one changed while the person was choosing", async () => {
    const user = userEvent.setup();
    api.mergeAccounts.mockRejectedValue(new MergeError("changed", "One of these was changed while you were choosing. Reload and choose again.", "40001"));
    show();
    await screen.findByRole("group", { name: "Which value to keep" });
    api.previewMerge.mockResolvedValue(preview({ kept: account("a1", 4) }));
    await user.click(screen.getByRole("button", { name: "Merge" }));
    expect(await screen.findByText("Both are shown again as they are now. Check your choices before merging.")).toBeInTheDocument();
    await waitFor(() => expect(api.previewMerge).toHaveBeenCalledTimes(2));
    expect(onMerged).not.toHaveBeenCalled();
  });
});

describe("MergeDialog: when the person may not", () => {
  // Catches: a Merge button offered where the database says no (the person would learn it only by being refused), or the reason left out.
  it("says why in the database's words and offers no Merge", async () => {
    api.previewMerge.mockResolvedValue(preview({ problem: "You can't change Harborview Marine LLC, so you can't merge it." }));
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("You can't change Harborview Marine LLC, so you can't merge it.");
    expect(screen.queryByRole("button", { name: "Merge" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Close" }).length).toBeGreaterThan(0);
  });

  // Catches: a record the person can't see leaving the dialog loading for ever.
  it("says the records aren't available when the preview is refused, and offers Try again", async () => {
    api.previewMerge.mockRejectedValue(new MergeError("notFound", "This record isn't available.", "PT404"));
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("This record isn't available.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("says when two records differ in nothing", async () => {
    api.previewMerge.mockResolvedValue(preview({ differs: [] }));
    show();
    expect(await screen.findByText("Nothing differs between them: every field is the same.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Merge" })).toBeInTheDocument();
  });
});

describe("MergeDialog: contacts", () => {
  // Catches: contacts merged as accounts (the wrong call), or named by their code ("first_name") rather than as people.
  it("merges two contacts through the contacts' call, named as people", async () => {
    const user = userEvent.setup();
    const contact = (id: string, version: number, over: Record<string, unknown> = {}) => ({ id, version, first_name: "Sam", last_name: "Reyes", title: null, email: "sam@x.test", phone: null, mobile: null, do_not_email: false, owner: null, ...over });
    api.previewMerge.mockResolvedValue({
      kind: "contact", problem: null, differs: ["title", "do_not_email"], kept: contact("a1", 2), removed: contact("a2", 3, { first_name: "S.", title: "Controller", do_not_email: true }),
      moves: { activities: 3, opportunities_main_contact_of: 0 },
    });
    api.mergeContacts.mockResolvedValue({ record: { id: "a1", version: 3 }, removed: { id: "a2", name: "S. Reyes" }, moved: { activities: 3, opportunities: 0 } });
    show("contact");
    const group = await screen.findByRole("group", { name: "Which value to keep" });
    expect(within(group).getByRole("group", { name: "Do not email" })).toHaveTextContent("Yes");
    // A person who asked not to be emailed stays that way unless the choice says otherwise.
    expect((within(within(group).getByRole("group", { name: "Do not email" })).getAllByRole("radio") as HTMLInputElement[]).map((r) => r.checked)).toEqual([false, true]);
    await user.click(screen.getByRole("button", { name: "Merge" }));
    await waitFor(() => expect(api.mergeContacts).toHaveBeenCalledWith("f1", "a1", "a2", { title: "removed", do_not_email: "removed" }, { kept: 2, removed: 3 }));
    expect(api.mergeAccounts).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("S. Reyes was merged into Sam Reyes. 3 calls, notes and tasks moved over.");
  });
});
