import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Leaving a firm from Settings (story CRM-P1.6). The page is rendered with the real workspace and the real api module; only the
// database is replaced, by a small one that answers the way leave_firm does: a member leaves their own firm, and the last owner of a
// firm can't. What happens afterwards (the person's sign-in is kept and they see no firm) is the page they land on when the browser
// asks again; here the browser's reload is replaced and only asked for.
const auth = { user: { id: "u1", email: "sam@acme.example" }, session: { access_token: "tok" }, loading: false, isAnonymous: false, sessionEnded: null, signOut: vi.fn() };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
let firmAddress: { status: "none" } | { status: "known"; address: string; name: string } = { status: "none" };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firmAddress }));
vi.mock("@/lib/monitoring", () => ({ reportOpsEvent: vi.fn() }));

const db = {
  firms: [] as { firm_id: string; name: string; address: string; role: string }[],
  fail: null as { code?: string; message: string } | "pending" | null,
  calls: [] as [string, Record<string, unknown>][],
};
const rpc = vi.fn(async (fn: string, args: Record<string, unknown> = {}) => {
  db.calls.push([fn, args]);
  if (fn === "leave_firm") {
    if (db.fail === "pending") return new Promise(() => undefined);
    if (db.fail) return { data: null, error: db.fail };
    db.firms = db.firms.filter((f) => f.firm_id !== args.p_firm_id);
    return { data: null, error: null };
  }
  switch (fn) {
    case "my_firms": return { data: db.firms, error: null };
    case "has_role": return { data: false, error: null };
    case "advisor_needs_second_factor": return { data: false, error: null };
    default: throw new Error(`the page asked the database for ${fn}`);
  }
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: [string, Record<string, unknown>?]) => rpc(...a) } }));

const afterLeaving = vi.fn();
vi.mock("@/lib/leaveFirmApi", async (original) => ({ ...(await original<typeof import("@/lib/leaveFirmApi")>()), afterLeavingFirm: () => afterLeaving() }));

const { clearMyFirms, clearOwnedFirms } = await import("@/hooks/useOwnedFirms");
const { default: AdvisorSettingsPage } = await import("./AdvisorSettingsPage");
const { WorkspaceProvider } = await import("@/components/workspace/useWorkspace");

const renderPage = async () => {
  render(<MemoryRouter><WorkspaceProvider><AdvisorSettingsPage /></WorkspaceProvider></MemoryRouter>);
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};
const openDialog = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Leave this firm" }));
  return within(await screen.findByRole("alertdialog"));
};

describe("leaving a firm from Settings", () => {
  beforeEach(() => {
    clearMyFirms();
    clearOwnedFirms();
    rpc.mockClear();
    afterLeaving.mockClear();
    db.calls = [];
    db.fail = null;
    firmAddress = { status: "none" };
    db.firms = [{ firm_id: "f1", name: "Acme Brokers", address: "acme", role: "agent" }];
  });

  // Catches: leaving is not offered to the people it is for (a lead, an agent, an owner), or is offered to someone with no firm.
  it("offers Leave this firm to a member of any role, and to nobody who has no firm", async () => {
    for (const role of ["agent", "lead", "owner"]) {
      document.body.innerHTML = "";
      clearMyFirms();
      db.firms = [{ firm_id: "f1", name: "Acme Brokers", address: "acme", role }];
      await renderPage();
      expect(await screen.findByRole("button", { name: "Leave this firm" })).toBeInTheDocument();
    }
    document.body.innerHTML = "";
    clearMyFirms();
    db.firms = [];
    await renderPage();
    expect(screen.queryByRole("button", { name: "Leave this firm" })).not.toBeInTheDocument();
  });

  // Catches: the person is asked to confirm without being told what will happen, or it happens on the first click.
  it("asks first, in plain words, and changes nothing until they confirm", async () => {
    await renderPage();
    const dialog = await openDialog();
    expect(dialog.getByText("Leave Acme Brokers?")).toBeInTheDocument();
    const body = dialog.getByText(/lose access to Acme Brokers at once/).textContent ?? "";
    expect(body).toContain("stop receiving its alerts");
    expect(body).toContain("Your membership ends today");
    expect(body).toContain("What you created stays with the firm");
    expect(body).toContain("The firm's owners are emailed that you left, and when");
    expect(body).toContain("mailbox you connected is deleted");
    expect(body).toContain("keep your sign-in");
    expect(body).toContain("can't leave if you are its last owner");
    expect(db.calls.filter(([fn]) => fn === "leave_firm")).toEqual([]);
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(db.calls.filter(([fn]) => fn === "leave_firm")).toEqual([]);
    expect(afterLeaving).not.toHaveBeenCalled();
  });

  // Catches: the firm is taken from somewhere other than the page's own firm; the browser is not told to ask again, so the person
  // goes on seeing a firm they have left.
  it("leaves the page's own firm when they confirm, then has the browser ask where they stand", async () => {
    await renderPage();
    const dialog = await openDialog();
    fireEvent.click(dialog.getByRole("button", { name: "Leave Acme Brokers" }));
    await waitFor(() => expect(afterLeaving).toHaveBeenCalledTimes(1));
    expect(db.calls.filter(([fn]) => fn === "leave_firm")).toEqual([["leave_firm", { p_firm_id: "f1" }]]);
  });

  // Catches: a second click while the first is in flight leaves twice, or the dialog closes before the answer.
  it("holds the dialog open and the buttons off while it is leaving", async () => {
    db.fail = "pending";
    await renderPage();
    const dialog = await openDialog();
    fireEvent.click(dialog.getByRole("button", { name: "Leave Acme Brokers" }));
    await waitFor(() => expect(dialog.getByRole("button", { name: "Leave Acme Brokers" })).toBeDisabled());
    expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(db.calls.filter(([fn]) => fn === "leave_firm")).toHaveLength(1);
  });

  // Catches: the last owner is shown a bare error, or is told they left; they stay a member, so nothing is reloaded.
  it("tells the last owner why they can't leave, in the database's plain words, and leaves nothing changed", async () => {
    db.firms = [{ firm_id: "f1", name: "Acme Brokers", address: "acme", role: "owner" }];
    db.fail = { code: "23514", message: "You are the last owner of this firm, so you can't leave it. Make someone else an owner first." };
    await renderPage();
    const dialog = await openDialog();
    fireEvent.click(dialog.getByRole("button", { name: "Leave Acme Brokers" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You are the last owner of this firm, so you can't leave it. Make someone else an owner first.");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(afterLeaving).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Leave this firm" })).toBeEnabled();
  });

  // Catches: a failure we have no words for is shown as the database's text, or hides that the person is still a member.
  it("says it couldn't, without database text, when something else goes wrong", async () => {
    db.fail = { code: "XX000", message: "relation firm_memberships exploded" };
    await renderPage();
    const dialog = await openDialog();
    fireEvent.click(dialog.getByRole("button", { name: "Leave Acme Brokers" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't leave the firm. Try again.");
    expect(alert).not.toHaveTextContent("exploded");
    expect(afterLeaving).not.toHaveBeenCalled();
  });

  // Catches: at a firm's address the confirmation names the wrong firm (or none) for a person who belongs to several.
  it("names and leaves the firm at this address, for a member of several", async () => {
    firmAddress = { status: "known", address: "zenith", name: "Zenith Benefits" };
    db.firms = [
      { firm_id: "f1", name: "Acme Brokers", address: "acme", role: "agent" },
      { firm_id: "f2", name: "Zenith Benefits", address: "zenith", role: "lead" },
    ];
    await renderPage();
    const dialog = await openDialog();
    expect(dialog.getByText("Leave Zenith Benefits?")).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Leave Zenith Benefits" }));
    await waitFor(() => expect(afterLeaving).toHaveBeenCalled());
    expect(db.calls.filter(([fn]) => fn === "leave_firm")).toEqual([["leave_firm", { p_firm_id: "f2" }]]);
  });
});
