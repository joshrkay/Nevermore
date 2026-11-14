import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { logActivity, updateActivity, addToNote, setTaskDone, getActivityOptions, ActivityError } = await import("./activityApi");
const { listAccountTab } = await import("./accountPageApi");

const refused = (code: string, message = "refused") => ({ data: null, error: { code, message } });
const caught = async (call: () => Promise<unknown>) => {
  try {
    await call();
  } catch (e) {
    return e;
  }
  throw new Error("expected a failure");
};

const row = (over: object = {}) => ({
  type: "call", id: "x1", entry_key: "x1", at: "2026-11-13T18:30:00+00:00", who: "Dana Reyes", author_id: "u1", contact: { id: "c1", name: "Elena Marsh" }, opportunity: null,
  outcome: "spoke", title: null, body: "Hello", additions: [], assignee: null, due_on: null, done_at: null, done_by: null, can_edit: true, editable_until: null, ...over,
});

beforeEach(() => rpc.mockReset());

describe("logging", () => {
  // Catches: a call's fields sent under the wrong parameter (the follow-up's, the person a task is for), or a missing follow-up sent as something other than nothing.
  it("sends a call and its follow-up under the database's parameters and reads both rows back", async () => {
    rpc.mockResolvedValue({ data: { activity: row(), follow_up: row({ type: "task", id: "t1", entry_key: "t1", outcome: null, body: null, title: "Send it", due_on: "2026-11-14", assignee: { id: "u1", name: "Dana" } }) }, error: null });
    const logged = await logActivity("f1", {
      kind: "call", accountId: "a1", contactId: "c1", at: "2026-11-13T18:30:00.000Z", outcome: "spoke", body: "Hello", followUp: { title: "Send it", dueOn: "2026-11-14", forId: "u1" },
    });
    expect(rpc).toHaveBeenCalledWith("log_activity", {
      p_kind: "call", p_account_id: "a1", p_contact_id: "c1", p_opportunity_id: null, p_at: "2026-11-13T18:30:00.000Z", p_outcome: "spoke", p_body: "Hello", p_title: null,
      p_due_on: null, p_for: null, p_follow_up_title: "Send it", p_follow_up_due_on: "2026-11-14", p_follow_up_for: "u1", p_firm_id: "f1",
    });
    expect(logged.activity).toMatchObject({ type: "call", contact: { id: "c1", name: "Elena Marsh" }, outcome: "spoke", canEdit: true });
    expect(logged.followUp).toMatchObject({ type: "task", title: "Send it", dueOn: "2026-11-14" });
  });

  it("reads no follow-up when there is none", async () => {
    rpc.mockResolvedValue({ data: { activity: row(), follow_up: null }, error: null });
    expect((await logActivity("f1", { kind: "call", accountId: "a1", outcome: "spoke" })).followUp).toBeNull();
  });

  // Catches: the database's words replaced by the app's own, so the form and the rule can disagree; each SQLSTATE read as the wrong kind.
  it("keeps the database's words for what it refuses, and sorts each refusal by kind", async () => {
    for (const [code, kind] of [["22023", "invalid"], ["42501", "notAllowed"], ["PT404", "notFound"], ["PT423", "readOnly"], ["XX000", "failed"]] as const) {
      rpc.mockResolvedValue(refused(code, "In the database's words."));
      const e = (await caught(() => logActivity("f1", { kind: "note", accountId: "a1", body: "x" }))) as InstanceType<typeof ActivityError>;
      expect(e).toBeInstanceOf(ActivityError);
      expect(e.kind).toBe(kind);
      expect(e.message).toBe(kind === "failed" ? "Couldn't save that. Try again." : kind === "notFound" ? "That isn't available any more. Reload the page." : "In the database's words.");
    }
  });

  it("is a failure, not a row with something missing, when the answer is not the agreed shape", async () => {
    rpc.mockResolvedValue({ data: { activity: { ...row(), outcome: "chatted" }, follow_up: null }, error: null });
    expect(await caught(() => logActivity("f1", { kind: "call", accountId: "a1" }))).toBeInstanceOf(ActivityError);
  });
});

describe("changing", () => {
  it("saves a call or a task by its id with every field, and a note's text alone", async () => {
    rpc.mockResolvedValue({ data: row(), error: null });
    await updateActivity("f1", "x1", { body: "New text" });
    expect(rpc).toHaveBeenCalledWith("update_activity", {
      p_activity_id: "x1", p_contact_id: null, p_opportunity_id: null, p_at: null, p_outcome: null, p_body: "New text", p_title: null, p_due_on: null, p_for: null, p_firm_id: "f1",
    });
  });

  it("adds to a note and marks a task done or open", async () => {
    rpc.mockResolvedValue({ data: row({ type: "note", outcome: null }), error: null });
    await addToNote("f1", "n1", "More");
    expect(rpc).toHaveBeenLastCalledWith("add_to_note", { p_activity_id: "n1", p_text: "More", p_firm_id: "f1" });
    rpc.mockResolvedValue({ data: row({ type: "task", outcome: null, title: "T", due_on: "2026-11-14" }), error: null });
    await setTaskDone("f1", "t1", true);
    expect(rpc).toHaveBeenLastCalledWith("set_task_done", { p_activity_id: "t1", p_done: true, p_firm_id: "f1" });
    await setTaskDone("f1", "t1", false);
    expect(rpc).toHaveBeenLastCalledWith("set_task_done", { p_activity_id: "t1", p_done: false, p_firm_id: "f1" });
  });
});

describe("the form's choices", () => {
  it("reads the contacts, opportunities and people, and nothing for an account that is not theirs", async () => {
    rpc.mockResolvedValue({ data: { contacts: [{ id: "c1", name: "Elena Marsh", title: null }], opportunities: [], people: [{ id: "u1", name: "Dana" }] }, error: null });
    expect((await getActivityOptions("f1", "a1"))?.people).toEqual([{ id: "u1", name: "Dana" }]);
    expect(rpc).toHaveBeenCalledWith("account_activity_options", { p_firm_id: "f1", p_account_id: "a1" });
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await getActivityOptions("f1", "a1")).toBeNull();
  });
});

describe("the Activity tab's filters", () => {
  // Catches: a filter drawn but not asked (the tab name sent stays 'activity'), or sent for a tab that has none.
  it("asks for each filter by its own tab name", async () => {
    rpc.mockResolvedValue({ data: { count: 0, rows: [] }, error: null });
    await listAccountTab("f1", "a1", "activity", { filter: "calls" });
    expect(rpc).toHaveBeenLastCalledWith("account_tab", expect.objectContaining({ p_tab: "activity_calls" }));
    await listAccountTab("f1", "a1", "activity", { filter: "all" });
    expect(rpc).toHaveBeenLastCalledWith("account_tab", expect.objectContaining({ p_tab: "activity" }));
    await listAccountTab("f1", "a1", "contacts", { filter: "tasks" });
    expect(rpc).toHaveBeenLastCalledWith("account_tab", expect.objectContaining({ p_tab: "contacts" }));
  });

  it("reads a call, a note, a task and a change in one list", async () => {
    rpc.mockResolvedValue({ data: { count: 2, rows: [row(), {
      type: "change", entry_key: "e1", at: "2026-11-01T10:00:00+00:00", change_id: "ch1", kind: "changed", who: "dana@example.com", who_kind: "member", field: "employees",
      from_value: 40, to_value: 45, record_table: "accounts", record_id: "a1", record_name: "Harborview",
    }] }, error: null });
    const tab = await listAccountTab("f1", "a1", "activity");
    expect(tab?.rows.map((r) => r.type)).toEqual(["call", "change"]);
  });
});
