import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { AccountPage as Page } from "@/lib/accountPageApi";
import type { ActivityItem } from "@/lib/activityApi";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";

// Calls, notes and tasks on an account's page through a faked client (story CRM-E1.5): what a person sees and does. The database's own rules (who may see an
// account, the note rule of a day and its writer, who may change a call or a task, the follow-up written in the same step) are tested in
// supabase/tests/calls_notes_tasks.sql; here the client answers and the page draws it and asks.

// The checkbox measures itself with a ResizeObserver, which jsdom does not have.
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });

const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "dana@example.com" }, signOut }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const client = { getAccountPage: vi.fn(), listAccountTab: vi.fn(), listAccountFiles: vi.fn(), updateAccount: vi.fn(), getSubmissionAccount: vi.fn() };
vi.mock("@/lib/accountPageApi", async () => ({ ...(await vi.importActual<object>("@/lib/accountPageApi")), ...client }));
const activity = { logActivity: vi.fn(), updateActivity: vi.fn(), addToNote: vi.fn(), setTaskDone: vi.fn(), getActivityOptions: vi.fn() };
vi.mock("@/lib/activityApi", async () => ({ ...(await vi.importActual<object>("@/lib/activityApi")), ...activity }));
vi.mock("@/lib/advisorApi", () => ({ documentUrl: vi.fn(), recordActivity: vi.fn() }));

const { default: AccountPage } = await import("./AccountPage");
const { ActivityError } = await import("@/lib/activityApi");

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  firm: { id: "f1", name: "Acme Benefits", address: "acme" }, role: "Agent", isOwner: false, isSupport: false, supportEndsAt: null, supportSessionId: null,
  isPlatformAdmin: false, person: "Dana Reyes", ...over,
});

const item = (over: Partial<ActivityItem> = {}): ActivityItem => ({
  type: "call", id: "x1", entryKey: "x1", at: "2026-11-13T18:30:00+00:00", who: "Dana Reyes", authorId: "u1", contact: null, opportunity: null, outcome: null, title: null, body: null,
  additions: [], assignee: null, dueOn: null, doneAt: null, doneBy: null, canEdit: true, editableUntil: null, ...over, ...(over.id ? { entryKey: over.id } : {}),
});
const call = item({ id: "call1", outcome: "spoke", body: "Elena has the 2024 loss run.", contact: { id: "c1", name: "Elena Marsh" }, opportunity: { id: "o1", name: "January 2027 PEO search" } });
const note = item({ type: "note", id: "note1", body: "Prefers email", editableUntil: "2026-11-14T18:30:00+00:00",
  additions: [{ at: "2026-11-14T09:00:00+00:00", who: "Sam Lee", text: "Confirmed by phone" }] });
const task = item({ type: "task", id: "task1", title: "Send the census template", dueOn: "2020-01-01", assignee: { id: "u2", name: "Sam Lee" } });
const doneTask = item({ type: "task", id: "task2", title: "Call the broker", dueOn: "2020-01-01", assignee: { id: "u1", name: "Dana Reyes" }, doneAt: "2026-11-14T10:00:00+00:00", doneBy: "Sam Lee" });

const tabOf = <R,>(rows: R[], count = rows.length) => ({ count, rows });
const account = {
  id: "a1", version: 3, name: "Harborview Dental Group", tradeName: null, website: null, webDomain: null, phone: null, street: null, city: "Portland", state: "OR", postalCode: null,
  industry: "Dental practice", employees: 45, statesOfOperation: ["OR"], currentProvider: null, source: "added_by_hand" as const, archivedAt: null as string | null,
  createdAt: "2026-10-28T10:00:00+00:00", updatedAt: "2026-11-01T10:00:00+00:00", status: "prospect" as const, owner: { id: "u1", name: "Dana Reyes" }, sourcePartner: null,
};
const contact1 = { id: "c1", firstName: "Elena", lastName: "Marsh", title: "Practice Manager", email: "elena@harborview.example", phone: null, mobile: null, isMain: true, doNotEmail: false };
const page = (over: Partial<Page> = {}, rows: ActivityItem[] = [call, note, task, doneTask]): Page => ({
  account, canChange: true,
  tabs: { contacts: tabOf([contact1]), opportunities: tabOf([]), quotes: tabOf([]), activity: tabOf(rows), files: tabOf([]) },
  ...over,
});
const options = {
  contacts: [{ id: "c1", name: "Elena Marsh", title: "Practice Manager" }, { id: "c2", name: "Sam Park", title: null }],
  opportunities: [{ id: "o1", name: "January 2027 PEO search" }],
  people: [{ id: "u1", name: "Dana Reyes" }, { id: "u2", name: "Sam Lee" }],
};

const renderPage = (path = "/accounts/a1", ws: Workspace = workspace()) => {
  const router = createMemoryRouter([{ path: "/accounts/:id", element: <AccountPage /> }], { initialEntries: [path] });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } })}>
      <WorkspaceContext.Provider value={ws}><RouterProvider router={router} /></WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  for (const fn of [...Object.values(client), ...Object.values(activity), signOut]) fn.mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  client.getAccountPage.mockResolvedValue(page());
  client.listAccountTab.mockImplementation(async () => tabOf([call, note, task, doneTask]));
  activity.getActivityOptions.mockResolvedValue(options);
});

const dialog = () => screen.getByRole("dialog");

describe("the header's buttons", () => {
  // Catches: Log a call and Add a task missing, or shown where the database will refuse every write (a Nevermore support session, ADR 0024) or the page says
  // nothing can be added (an archived account).
  it("offers Log a call and Add a task to a member, and to no one in a support session or on an archived account", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: "Log a call" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a task" })).toBeInTheDocument();
  });

  it("offers neither in a Nevermore support session", async () => {
    renderPage("/accounts/a1", workspace({ isSupport: true }));
    await screen.findByRole("heading", { level: 1, name: "Harborview Dental Group" });
    expect(screen.queryByRole("button", { name: "Log a call" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add a task" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Mark done|Add to note|Edit (call|note|task)/ })).toBeNull();
  });

  it("offers neither on an archived account", async () => {
    client.getAccountPage.mockResolvedValue(page({ account: { ...account, archivedAt: "2026-11-01T00:00:00+00:00" } }));
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Harborview Dental Group" });
    expect(screen.queryByRole("button", { name: "Log a call" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add a task" })).toBeNull();
  });
});

describe("the Activity tab", () => {
  // Catches: a call, a note or a task missing from the one list, or without what it holds (who with, about what, what was said, an addition, a due day,
  // who it is for, overdue, done and by whom).
  it("lists calls, notes and tasks in words", async () => {
    renderPage("/accounts/a1?tab=activity");
    const rows = within(await screen.findByRole("table", { name: "The account's activity" })).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(4);
    const [c, n, t, d] = rows;
    expect(within(c).getByText("Spoke")).toBeInTheDocument();
    expect(c).toHaveTextContent("with Elena Marsh");
    expect(c).toHaveTextContent("about January 2027 PEO search");
    expect(c).toHaveTextContent("Elena has the 2024 loss run.");
    expect(n).toHaveTextContent("Prefers email");
    expect(n).toHaveTextContent("Confirmed by phone");
    expect(n).toHaveTextContent("by Sam Lee");
    expect(t).toHaveTextContent("Send the census template");
    expect(t).toHaveTextContent("Due Jan 1, 2020");
    expect(t).toHaveTextContent("For Sam Lee");
    expect(within(t).getByText("Overdue")).toBeInTheDocument();
    expect(d).toHaveTextContent("Done");
    expect(d).toHaveTextContent("by Sam Lee");
    expect(within(d).queryByText("Overdue")).toBeNull();
  });

  // Catches: a filter that is only drawn and not asked of the database (counts and pages would be of the wrong list).
  it("asks the database for each filter", async () => {
    const user = userEvent.setup();
    renderPage("/accounts/a1?tab=activity");
    await screen.findByRole("table", { name: "The account's activity" });
    for (const [label, filter] of [["Calls", "calls"], ["Notes", "notes"], ["Tasks", "tasks"]] as const) {
      await user.click(within(screen.getByRole("group", { name: "Show" })).getByRole("button", { name: label }));
      await waitFor(() => expect(client.listAccountTab).toHaveBeenLastCalledWith("f1", "a1", "activity", { limit: 50, offset: 0, filter }));
    }
  });

  it("says in the filter's own words when it holds nothing", async () => {
    const user = userEvent.setup();
    renderPage("/accounts/a1?tab=activity");
    await screen.findByRole("table", { name: "The account's activity" });
    client.listAccountTab.mockImplementation(async () => tabOf([]));
    await user.click(within(screen.getByRole("group", { name: "Show" })).getByRole("button", { name: "Notes" }));
    expect(await screen.findByText("No notes yet.")).toBeInTheDocument();
  });
});

describe("logging a call", () => {
  // Catches: the call or its follow-up not sent as typed (the contact, the outcome, what was said, the follow-up's words, day and person), the follow-up sent
  // without the box ticked, the list not asked again, and no word that it was saved.
  it("logs a call with a follow-up task in one step and refreshes the lists", async () => {
    const user = userEvent.setup();
    activity.logActivity.mockResolvedValue({ activity: call, followUp: task });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Log a call" }));
    expect(within(dialog()).getByRole("heading", { name: "Log a call" })).toBeInTheDocument();
    expect(dialog()).toHaveTextContent("On Harborview Dental Group");
    await waitFor(() => expect(screen.getByLabelText("With")).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText("With"), "c1");
    await user.selectOptions(screen.getByLabelText("About"), "o1");
    await user.selectOptions(screen.getByLabelText("Outcome"), "left_message");
    await user.type(screen.getByLabelText("What was said"), "Left a message about the loss run");
    expect(screen.queryByLabelText("Task")).toBeNull();
    await user.click(screen.getByRole("checkbox", { name: "Add a task" }));
    await user.type(screen.getByLabelText("Task"), "Check the loss run arrived");
    await user.type(within(dialog()).getAllByLabelText("Due")[0], "2026-11-14");
    const before = client.getAccountPage.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(activity.logActivity).toHaveBeenCalledTimes(1));
    const [firm, input] = activity.logActivity.mock.calls[0];
    expect(firm).toBe("f1");
    expect(input).toMatchObject({
      kind: "call", accountId: "a1", contactId: "c1", opportunityId: "o1", outcome: "left_message", body: "Left a message about the loss run",
      followUp: { title: "Check the loss run arrived", dueOn: "2026-11-14", forId: "u1" },
    });
    expect(input.at).toMatch(/^\d{4}-\d\d-\d\dT/);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toast.success).toHaveBeenCalledWith("Call logged, with its follow-up task");
    await waitFor(() => expect(client.getAccountPage.mock.calls.length).toBeGreaterThan(before));
  });

  it("sends no follow-up when the box is not ticked", async () => {
    const user = userEvent.setup();
    activity.logActivity.mockResolvedValue({ activity: call, followUp: null });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Log a call" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(activity.logActivity).toHaveBeenCalled());
    expect(activity.logActivity.mock.calls[0][1].followUp).toBeNull();
    expect(toast.success).toHaveBeenCalledWith("Call logged");
  });

  // Catches: a refusal swallowed, or said in words of the form's own so the two disagree; the dialog closing and losing what was typed.
  it("says the database's refusal in its own words and keeps what was typed", async () => {
    const user = userEvent.setup();
    activity.logActivity.mockRejectedValue(new ActivityError("readOnly", "This firm is closing and can't be changed", "PT423"));
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Log a call" }));
    await user.type(screen.getByLabelText("What was said"), "Spoke to Elena");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await within(dialog()).findByRole("alert")).toHaveTextContent("This firm is closing and can't be changed");
    expect(screen.getByLabelText("What was said")).toHaveValue("Spoke to Elena");
    expect(toast.success).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says a failure that is not the database's in plain words", async () => {
    const user = userEvent.setup();
    activity.logActivity.mockRejectedValue(new Error("network"));
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Log a call" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await within(dialog()).findByRole("alert")).toHaveTextContent("Couldn't save that. Check your connection and try again.");
  });
});

describe("an archived account (D-222)", () => {
  it("says the database's words if it refuses something added to an archived account", async () => {
    const user = userEvent.setup();
    activity.logActivity.mockRejectedValue(new ActivityError("readOnly", "This account is archived. Nothing can be added to it.", "55000"));
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Log a call" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await within(dialog()).findByRole("alert")).toHaveTextContent("This account is archived. Nothing can be added to it.");
  });
});

describe("logging a note and a task", () => {
  it("logs a note from the same dialog", async () => {
    const user = userEvent.setup();
    activity.logActivity.mockResolvedValue({ activity: note, followUp: null });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Log a call" }));
    await user.click(within(dialog()).getByRole("button", { name: "Note" }));
    expect(within(dialog()).getByRole("heading", { name: "Add a note" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Outcome")).toBeNull();
    await user.type(screen.getByLabelText("Note"), "Prefers email");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(activity.logActivity).toHaveBeenCalled());
    expect(activity.logActivity.mock.calls[0][1]).toMatchObject({ kind: "note", accountId: "a1", body: "Prefers email", followUp: null });
    expect(toast.success).toHaveBeenCalledWith("Note added");
  });

  it("logs a task from Add a task, for the person by default or whoever is chosen", async () => {
    const user = userEvent.setup();
    activity.logActivity.mockResolvedValue({ activity: task, followUp: null });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Add a task" }));
    expect(within(dialog()).getByRole("heading", { name: "Add a task" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("For")).toHaveValue("u1"));
    await user.type(screen.getByLabelText("What"), "Send the census template");
    await user.type(screen.getByLabelText("Due"), "2026-11-20");
    await user.selectOptions(screen.getByLabelText("For"), "u2");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(activity.logActivity).toHaveBeenCalled());
    expect(activity.logActivity.mock.calls[0][1]).toMatchObject({ kind: "task", accountId: "a1", title: "Send the census template", dueOn: "2026-11-20", forId: "u2" });
    expect(toast.success).toHaveBeenCalledWith("Task added");
  });

  // Catches: logging on a contact from the Contacts tab not naming the contact.
  it("logs a call on a contact from the Contacts tab", async () => {
    const user = userEvent.setup();
    client.listAccountTab.mockImplementation(async () => tabOf([contact1]));
    activity.logActivity.mockResolvedValue({ activity: call, followUp: null });
    renderPage("/accounts/a1?tab=contacts");
    await user.click(await screen.findByRole("button", { name: "Log a call with Elena Marsh" }));
    await waitFor(() => expect(screen.getByLabelText("With")).toHaveValue("c1"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(activity.logActivity).toHaveBeenCalled());
    expect(activity.logActivity.mock.calls[0][1]).toMatchObject({ kind: "call", contactId: "c1" });
  });
});

describe("changing what was logged (D-200)", () => {
  // Catches: Edit offered where the database will refuse it (a note after a day, a call or task the person may not change), or an edit that does not name the row.
  it("offers Edit only on what the database says the person may change", async () => {
    client.listAccountTab.mockImplementation(async () => tabOf([call, { ...task, canEdit: false }, { ...note, canEdit: false }]));
    renderPage("/accounts/a1?tab=activity");
    const rows = within(await screen.findByRole("table", { name: "The account's activity" })).getAllByRole("row").slice(1);
    expect(within(rows[0]).getByRole("button", { name: /^Edit/ })).toBeInTheDocument();
    expect(within(rows[1]).queryByRole("button", { name: /^Edit/ })).toBeNull();
    expect(within(rows[2]).queryByRole("button", { name: /^Edit/ })).toBeNull();
  });

  it("edits a call from what it holds and saves it by its id", async () => {
    const user = userEvent.setup();
    client.listAccountTab.mockImplementation(async () => tabOf([call]));
    activity.updateActivity.mockResolvedValue(call);
    renderPage("/accounts/a1?tab=activity");
    await user.click(await screen.findByRole("button", { name: /^Edit/ }));
    expect(within(dialog()).getByRole("heading", { name: "Edit call" })).toBeInTheDocument();
    expect(within(dialog()).queryByRole("group", { name: "What to log" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "Add a task" })).toBeNull();
    expect(screen.getByLabelText("What was said")).toHaveValue("Elena has the 2024 loss run.");
    await waitFor(() => expect(screen.getByLabelText("With")).toHaveValue("c1"));
    await user.selectOptions(screen.getByLabelText("Outcome"), "no_answer");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(activity.updateActivity).toHaveBeenCalled());
    expect(activity.updateActivity.mock.calls[0].slice(0, 2)).toEqual(["f1", "call1"]);
    expect(activity.updateActivity.mock.calls[0][2]).toMatchObject({ contactId: "c1", opportunityId: "o1", outcome: "no_answer", body: "Elena has the 2024 loss run." });
    expect(toast.success).toHaveBeenCalledWith("Saved");
  });

  // Catches: editing a task whose assignee has left quietly reassigning it to the editor (the list of people no longer holds them).
  it("keeps a departed person on a task unless the editor picks someone else", async () => {
    const user = userEvent.setup();
    const gone = { ...task, assignee: { id: "u9", name: "Mel Gone" } };
    client.listAccountTab.mockImplementation(async () => tabOf([gone]));
    activity.updateActivity.mockResolvedValue(gone);
    renderPage("/accounts/a1?tab=activity");
    await user.click(await screen.findByRole("button", { name: "Edit task" }));
    await waitFor(() => expect(screen.getByLabelText("With")).not.toBeDisabled());
    expect(screen.getByLabelText("For")).toHaveValue("u9");
    expect(within(screen.getByLabelText("For")).getByRole("option", { name: "Mel Gone (left the firm)" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(activity.updateActivity).toHaveBeenCalled());
    expect(activity.updateActivity.mock.calls[0][2]).toMatchObject({ forId: "u9" });
    activity.updateActivity.mockClear();
    await user.click(await screen.findByRole("button", { name: "Edit task" }));
    await waitFor(() => expect(screen.getByLabelText("With")).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText("For"), "u1");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(activity.updateActivity).toHaveBeenCalled());
    expect(activity.updateActivity.mock.calls[0][2]).toMatchObject({ forId: "u1" });
  });

  it("edits a note's text only", async () => {
    const user = userEvent.setup();
    client.listAccountTab.mockImplementation(async () => tabOf([note]));
    activity.updateActivity.mockResolvedValue(note);
    renderPage("/accounts/a1?tab=activity");
    await user.click(await screen.findByRole("button", { name: "Edit note" }));
    expect(screen.queryByLabelText("With")).toBeNull();
    await user.clear(screen.getByLabelText("Note"));
    await user.type(screen.getByLabelText("Note"), "Prefers phone");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(activity.updateActivity).toHaveBeenCalled());
    expect(activity.updateActivity.mock.calls[0][1]).toBe("note1");
    expect(activity.updateActivity.mock.calls[0][2]).toMatchObject({ body: "Prefers phone" });
  });

  // Catches: a note after a day edited in place (the database refuses it); Add to note missing, or not appended by its id.
  it("adds to a note that is fixed: Add to note, with the note shown above what is added", async () => {
    const user = userEvent.setup();
    const old = { ...note, canEdit: false };
    client.listAccountTab.mockImplementation(async () => tabOf([old]));
    activity.addToNote.mockResolvedValue(old);
    renderPage("/accounts/a1?tab=activity");
    const row = within(await screen.findByRole("table", { name: "The account's activity" })).getAllByRole("row")[1];
    expect(within(row).queryByRole("button", { name: /^Edit/ })).toBeNull();
    await user.click(within(row).getByRole("button", { name: "Add to note" }));
    expect(within(dialog()).getByRole("heading", { name: "Add to note" })).toBeInTheDocument();
    expect(dialog()).toHaveTextContent("Prefers email");
    await user.type(screen.getByLabelText("What to add"), "Dr. Park confirmed");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(activity.addToNote).toHaveBeenCalledWith("f1", "note1", "Dr. Park confirmed"));
    expect(toast.success).toHaveBeenCalledWith("Added to the note");
  });

  it("says the database's words when an edit is refused", async () => {
    const user = userEvent.setup();
    client.listAccountTab.mockImplementation(async () => tabOf([note]));
    activity.updateActivity.mockRejectedValue(new ActivityError("notAllowed", "A note can't be changed after a day. Add to it instead.", "42501"));
    renderPage("/accounts/a1?tab=activity");
    await user.click(await screen.findByRole("button", { name: "Edit note" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await within(dialog()).findByRole("alert")).toHaveTextContent("A note can't be changed after a day. Add to it instead.");
  });
});

describe("marking a task done", () => {
  // Catches: Mark done missing for someone who may see the task (anyone may), the wrong state sent, or a done task that cannot be opened again.
  it("marks a task done and opens a done one again", async () => {
    const user = userEvent.setup();
    activity.setTaskDone.mockResolvedValue(task);
    renderPage("/accounts/a1?tab=activity");
    const rows = within(await screen.findByRole("table", { name: "The account's activity" })).getAllByRole("row");
    await user.click(within(rows[3]).getByRole("button", { name: /Mark done/ }));
    await waitFor(() => expect(activity.setTaskDone).toHaveBeenCalledWith("f1", "task1", true));
    await user.click(within(rows[4]).getByRole("button", { name: /Open again/ }));
    await waitFor(() => expect(activity.setTaskDone).toHaveBeenCalledWith("f1", "task2", false));
  });

  it("says why when the task could not be marked", async () => {
    const user = userEvent.setup();
    activity.setTaskDone.mockRejectedValue(new ActivityError("readOnly", "This firm is closing and can't be changed", "PT423"));
    renderPage("/accounts/a1?tab=activity");
    await user.click(await screen.findByRole("button", { name: /Mark done/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("This firm is closing and can't be changed"));
  });
});
