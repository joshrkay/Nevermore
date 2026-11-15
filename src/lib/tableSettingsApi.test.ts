import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const {
  listSavedViews, saveView, renameSavedView, changeSavedView, deleteSavedView, shareSavedView, unshareSavedView, fetchMyColumns, setMyColumns,
} = await import("./tableSettingsApi");

const refused = (code: string, message = "refused") => ({ data: null, error: { code, message } });
const done = { data: null, error: null };

const row = {
  view_id: "v1", name: "Waiting on PEOs", filters: [{ field: "status", op: "any_of", value: ["sent"] }], sort: { field: "submitted_at", direction: "desc" },
  columns: ["company_name", "status"], shared: true, mine: false, can_change: false, can_share: false, can_unshare: true, updated_at: "2026-11-17T10:00:00Z",
};

describe("saved views", () => {
  beforeEach(() => rpc.mockReset());

  it("lists a table's views in the shape the tabs use, saying which are the person's and what they may do with each", async () => {
    rpc.mockResolvedValue({ data: [row], error: null });
    expect(await listSavedViews("f1", "submissions")).toEqual([{
      id: "v1", name: "Waiting on PEOs", filters: [{ field: "status", op: "any_of", value: ["sent"] }], sort: { field: "submitted_at", direction: "desc" },
      columns: ["company_name", "status"], shared: true, mine: false, canChange: false, canShare: false, canUnshare: true, updatedAt: "2026-11-17T10:00:00Z",
    }]);
    expect(rpc).toHaveBeenCalledWith("list_saved_views", { p_firm_id: "f1", p_table: "submissions" });
  });

  it("reads a view with no sort or columns of its own as none, and filters that are not a list as no filters", async () => {
    rpc.mockResolvedValue({ data: [{ ...row, filters: null, sort: null, columns: null }], error: null });
    const [view] = await listSavedViews("f1", "submissions");
    expect(view).toMatchObject({ filters: [], sort: null, columns: null });
  });

  it("says the person is not a member when the database refuses the list", async () => {
    rpc.mockResolvedValue(refused("42501"));
    await expect(listSavedViews("f1", "submissions")).rejects.toThrow("You aren't a member of this firm.");
  });

  it("saves the current filters, sort and columns as the person's own view and returns its id", async () => {
    rpc.mockResolvedValue({ data: "v9", error: null });
    expect(await saveView({ firmId: "f1", table: "submissions", name: "Mine", filters: [{ field: "status", op: "is_empty" }], sort: null, columns: ["company_name"] })).toBe("v9");
    expect(rpc).toHaveBeenCalledWith("save_view", {
      p_firm_id: "f1", p_table: "submissions", p_name: "Mine", p_filters: [{ field: "status", op: "is_empty" }], p_sort: null, p_columns: ["company_name"],
    });
  });

  it("gives the database's own words for a name already taken, the ceiling, and what can't be kept", async () => {
    rpc.mockResolvedValue(refused("PT409", 'You already have a view called "Mine" on this table'));
    await expect(saveView({ firmId: "f1", table: "submissions", name: "Mine", filters: [], sort: null, columns: null })).rejects.toThrow('You already have a view called "Mine" on this table');
    rpc.mockResolvedValue(refused("PT422", "You can keep at most 30 views of a table. Delete one first."));
    await expect(saveView({ firmId: "f1", table: "submissions", name: "Mine", filters: [], sort: null, columns: null })).rejects.toThrow("You can keep at most 30 views of a table. Delete one first.");
    rpc.mockResolvedValue(refused("22023", "A view's name is 1 to 60 characters"));
    await expect(saveView({ firmId: "f1", table: "submissions", name: "", filters: [], sort: null, columns: null })).rejects.toThrow("A view's name is 1 to 60 characters");
  });

  it("falls back to a plain message for any other failure, never the database's text", async () => {
    rpc.mockResolvedValue(refused("XX000", "internal detail"));
    await expect(saveView({ firmId: "f1", table: "submissions", name: "Mine", filters: [], sort: null, columns: null })).rejects.toThrow("Couldn't save the view. Try again.");
  });

  it("renames, changes and deletes one view by its id", async () => {
    rpc.mockResolvedValue(done);
    await renameSavedView("v1", "New name");
    expect(rpc).toHaveBeenLastCalledWith("rename_saved_view", { p_view_id: "v1", p_name: "New name" });
    await changeSavedView("v1", { filters: [], sort: { field: "company_name", direction: "asc" }, columns: null });
    expect(rpc).toHaveBeenLastCalledWith("change_saved_view", { p_view_id: "v1", p_filters: [], p_sort: { field: "company_name", direction: "asc" }, p_columns: null });
    await deleteSavedView("v1");
    expect(rpc).toHaveBeenLastCalledWith("delete_saved_view", { p_view_id: "v1" });
  });

  it("says a view that isn't there (or isn't the person's to see) is not available, in the same words either way", async () => {
    rpc.mockResolvedValue(refused("PT404"));
    await expect(renameSavedView("v1", "x")).rejects.toThrow("That view isn't available.");
    await expect(deleteSavedView("v1")).rejects.toThrow("That view isn't available.");
    await expect(shareSavedView("v1")).rejects.toThrow("That view isn't available.");
  });

  it("says only the person who saved a view can change it", async () => {
    rpc.mockResolvedValue(refused("42501"));
    await expect(renameSavedView("v1", "x")).rejects.toThrow("Only the person who saved this view can rename it.");
    await expect(changeSavedView("v1", { filters: [], sort: null, columns: null })).rejects.toThrow("Only the person who saved this view can change it.");
    await expect(deleteSavedView("v1")).rejects.toThrow("Only the person who saved this view can delete it.");
  });

  it("shares and unshares, and says only an owner can", async () => {
    rpc.mockResolvedValue(done);
    await shareSavedView("v1");
    expect(rpc).toHaveBeenLastCalledWith("share_saved_view", { p_view_id: "v1" });
    await unshareSavedView("v1");
    expect(rpc).toHaveBeenLastCalledWith("unshare_saved_view", { p_view_id: "v1" });
    rpc.mockResolvedValue(refused("42501"));
    await expect(shareSavedView("v1")).rejects.toThrow("Only an owner of the firm can share a view.");
    await expect(unshareSavedView("v1")).rejects.toThrow("Only an owner of the firm can stop sharing a view.");
    rpc.mockResolvedValue(refused("PT409", 'The firm already shares a view called "Open" on this table'));
    await expect(shareSavedView("v1")).rejects.toThrow('The firm already shares a view called "Open" on this table');
  });
});

describe("column choices", () => {
  beforeEach(() => rpc.mockReset());

  it("reads the person's columns for a table and where they came from", async () => {
    rpc.mockResolvedValue({ data: [{ columns: ["status", "company_name"], source: "mine" }], error: null });
    expect(await fetchMyColumns("f1", "submissions")).toEqual({ columns: ["status", "company_name"], source: "mine" });
    expect(rpc).toHaveBeenCalledWith("my_table_columns", { p_firm_id: "f1", p_table: "submissions", p_view_id: null });
  });

  it("reads them for a saved view", async () => {
    rpc.mockResolvedValue({ data: [{ columns: ["status"], source: "view" }], error: null });
    expect(await fetchMyColumns("f1", "submissions", "v1")).toEqual({ columns: ["status"], source: "view" });
    expect(rpc).toHaveBeenCalledWith("my_table_columns", { p_firm_id: "f1", p_table: "submissions", p_view_id: "v1" });
  });

  it("reads no choice as the table's defaults", async () => {
    rpc.mockResolvedValue({ data: [{ columns: null, source: "default" }], error: null });
    expect(await fetchMyColumns("f1", "submissions")).toEqual({ columns: null, source: "default" });
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await fetchMyColumns("f1", "submissions")).toEqual({ columns: null, source: "default" });
    rpc.mockResolvedValue({ data: [{ columns: ["a"], source: "something else" }], error: null });
    expect(await fetchMyColumns("f1", "submissions")).toEqual({ columns: null, source: "default" });
  });

  it("keeps the person's columns, for the table or a view, and forgets them when given none", async () => {
    rpc.mockResolvedValue(done);
    await setMyColumns("f1", "submissions", null, ["company_name", "status"]);
    expect(rpc).toHaveBeenLastCalledWith("set_my_table_columns", { p_firm_id: "f1", p_table: "submissions", p_view_id: null, p_columns: ["company_name", "status"] });
    await setMyColumns("f1", "submissions", "v1", null);
    expect(rpc).toHaveBeenLastCalledWith("set_my_table_columns", { p_firm_id: "f1", p_table: "submissions", p_view_id: "v1", p_columns: null });
  });

  // Catches: a person on a closing firm, or Nevermore support, told "Try again" for a save that can never work, or told nothing about why.
  it("says, in the database's own words, that a closing firm or a support session can't keep columns", async () => {
    rpc.mockResolvedValue(refused("PT423", "This firm is closing and can't be changed"));
    await expect(setMyColumns("f1", "submissions", null, ["a"])).rejects.toThrow("This firm is closing and can't be changed, so your columns weren't kept.");
    rpc.mockResolvedValue(refused("PT423", "Nevermore support can look, not change"));
    await expect(setMyColumns("f1", "submissions", null, ["a"])).rejects.toThrow("Nevermore support can look, not change, so your columns weren't kept.");
    rpc.mockResolvedValue(refused("PT423", ""));
    await expect(setMyColumns("f1", "submissions", null, ["a"])).rejects.toThrow("This firm can't be changed, so your columns weren't kept.");
  });

  it("puts a refusal into words", async () => {
    rpc.mockResolvedValue(refused("42501"));
    await expect(setMyColumns("f1", "submissions", null, ["a"])).rejects.toThrow("You aren't a member of this firm.");
    rpc.mockResolvedValue(refused("PT404"));
    await expect(fetchMyColumns("f1", "submissions", "v1")).rejects.toThrow("That view isn't available.");
    rpc.mockResolvedValue(refused("22023", "Columns are a list of 1 to 60 different column names"));
    await expect(setMyColumns("f1", "submissions", null, [])).rejects.toThrow("Columns are a list of 1 to 60 different column names");
    rpc.mockResolvedValue(refused("XX000", "internal"));
    await expect(fetchMyColumns("f1", "submissions")).rejects.toThrow("Couldn't load your columns.");
  });
});
